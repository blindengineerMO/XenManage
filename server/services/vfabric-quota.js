const { vFabricModel } = require('../models/connection');
const governanceService = require('./governance');
const { getConnection, rehydrateConnection } = require('./xenapi');
const { isVisibleToActor, resolveActor } = require('./resource-ownership');

const BYTES_PER_GIB = 1024 ** 3;

function memberMatchesTarget(member, target) {
  if (!member || !target) return false;
  return member.kind === 'pool'
    ? Number(member.target_id || 0) === Number(target.connectionId || 0)
    : Number(member.target_id || 0) === Number(target.hostTargetId || 0);
}

function asRecords(records = {}) {
  return Object.entries(records).map(([ref, record]) => ({ ref, ...record }));
}

function buildUsage(hosts = [], vms = []) {
  const hostRefs = new Set(hosts.map((host) => host.ref));
  const scopedVms = vms.filter((vm) => !vm.is_a_template && (
    hostRefs.has(vm.resident_on) || hostRefs.has(vm.affinity)
  ));
  return {
    vmCount: scopedVms.length,
    runningVmCount: scopedVms.filter((vm) => String(vm.power_state || '').toLowerCase() === 'running').length,
    totalMemoryGiB: scopedVms.reduce((sum, vm) => sum + Number(vm.memory_static_max || vm.memory_dynamic_max || 0), 0) / BYTES_PER_GIB,
  };
}

function mergeUsage(rows = []) {
  return rows.reduce((total, row) => ({
    vmCount: total.vmCount + Number(row?.vmCount || 0),
    runningVmCount: total.runningVmCount + Number(row?.runningVmCount || 0),
    totalMemoryGiB: total.totalMemoryGiB + Number(row?.totalMemoryGiB || 0),
  }), { vmCount: 0, runningVmCount: 0, totalMemoryGiB: 0 });
}

function evaluateQuota(quota, usage, requestedVm = null) {
  const projected = {
    vmCount: Number(usage.vmCount || 0) + (requestedVm ? 1 : 0),
    runningVmCount: Number(usage.runningVmCount || 0) + (requestedVm?.startAfter ? 1 : 0),
    totalMemoryGiB: Number(usage.totalMemoryGiB || 0) + (requestedVm ? Number(requestedVm.memoryStaticMax || 0) / BYTES_PER_GIB : 0),
  };
  const breaches = [];
  if (quota?.maxVmCount > 0 && projected.vmCount > quota.maxVmCount) breaches.push('VM count');
  if (quota?.maxRunningVmCount > 0 && projected.runningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
  if (quota?.maxTotalMemoryGiB > 0 && projected.totalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');
  return {
    breaches,
    projected: { ...projected, totalMemoryGiB: Math.round(projected.totalMemoryGiB * 10) / 10 },
  };
}

function resolveTargets(req, record, enforce = false) {
  const actor = resolveActor(req);
  const members = (record.members || []).filter((member) => enforce || isVisibleToActor(member, actor));
  const sessionTargets = Array.isArray(req.session?.xenTargets) ? req.session.xenTargets : [];
  const sessionId = req.session?.id || req.sessionID;
  const seenTargetKeys = new Set();
  const targets = [];

  members.forEach((member) => {
    const target = sessionTargets.find((candidate) => memberMatchesTarget(member, candidate));
    if (!target || seenTargetKeys.has(target.targetKey)) return;
    const xenApi = getConnection(sessionId, target.targetKey) || rehydrateConnection(sessionId, target);
    if (!xenApi) return;
    seenTargetKeys.add(target.targetKey);
    targets.push({ target, member, xenApi });
  });

  return {
    members,
    targets,
    unavailableMembers: members.filter((member) => !targets.some((entry) => entry.member.id === member.id)),
  };
}

async function evaluateVFabricQuota(req, vFabricId, options = {}) {
  const record = vFabricModel.getById(vFabricId);
  if (!record || (!options.enforce && !isVisibleToActor(record, resolveActor(req)))) {
    const error = new Error('VFABRIC_NOT_FOUND');
    error.code = 'VFABRIC_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  const quota = governanceService.getVFabricQuota(vFabricId);
  const resolution = resolveTargets(req, record, Boolean(options.enforce));
  const targetUsage = await Promise.all(resolution.targets.map(async ({ target, member, xenApi }) => {
    const [hostsResult, vmsResult] = await Promise.all([xenApi.getHosts(), xenApi.getVMs()]);
    const usage = buildUsage(asRecords(hostsResult?.records), asRecords(vmsResult?.records));
    return {
      targetKey: target.targetKey,
      connectionName: target.connectionName || member.name || target.host || target.targetKey,
      usage: { ...usage, totalMemoryGiB: Math.round(usage.totalMemoryGiB * 10) / 10 },
    };
  }));
  const usage = mergeUsage(targetUsage.map((entry) => entry.usage));
  usage.totalMemoryGiB = Math.round(usage.totalMemoryGiB * 10) / 10;
  const coverageComplete = resolution.members.length > 0 && resolution.unavailableMembers.length === 0;
  const evaluation = quota?.enabled ? evaluateQuota(quota, usage, options.requestedVm || null) : null;
  const status = !quota?.enabled
    ? 'success'
    : !coverageComplete
      ? 'warning'
      : evaluation.breaches.length
        ? 'critical'
        : 'info';
  const detail = !quota?.enabled
    ? 'No vFabric quota is currently enforced for this scope.'
    : !coverageComplete
      ? `Quota coverage is incomplete: ${resolution.unavailableMembers.length} member target${resolution.unavailableMembers.length === 1 ? '' : 's'} must be attached before this aggregate can be enforced.`
      : evaluation.breaches.length
        ? `vFabric quota pressure is present for ${evaluation.breaches.join(', ')}.`
        : 'vFabric quota is configured and aggregate usage remains within the allowed envelope.';

  return {
    vFabricId: Number(vFabricId),
    vFabricName: record.name,
    quota,
    status,
    detail,
    coverageComplete,
    usage,
    evaluation,
    targetUsage,
    attachedTargetCount: resolution.targets.length,
    memberCount: resolution.members.length,
    unavailableMembers: resolution.unavailableMembers.map((member) => ({
      id: member.id,
      kind: member.kind,
      targetId: member.target_id,
      name: member.name || '',
    })),
  };
}

async function enforceVFabricQuotas(req, requestedVm = {}) {
  const activeTarget = req.xenTarget;
  if (!activeTarget) return null;
  const applicable = governanceService.listVFabricQuotas()
    .filter((quota) => quota.enabled)
    .map((quota) => ({ quota, record: vFabricModel.getById(quota.vFabricId) }))
    .filter(({ record }) => record?.members?.some((member) => memberMatchesTarget(member, activeTarget)));

  for (const { quota, record } of applicable) {
    const result = await evaluateVFabricQuota(req, quota.vFabricId, { enforce: true, requestedVm });
    if (!result.coverageComplete) {
      const error = new Error(`Cannot verify vFabric quota for "${record.name}" because not all member targets are attached.`);
      error.code = 'VFABRIC_QUOTA_SCOPE_INCOMPLETE';
      error.status = 409;
      error.quota = quota;
      error.evaluation = result;
      throw error;
    }
    if (result.evaluation?.breaches.length) {
      const error = new Error(`The deployment would exceed vFabric quota "${record.name}" for ${result.evaluation.breaches.join(', ')}.`);
      error.code = 'VFABRIC_QUOTA_EXCEEDED';
      error.status = 409;
      error.quota = quota;
      error.evaluation = result;
      throw error;
    }
  }
  return null;
}

module.exports = { evaluateVFabricQuota, enforceVFabricQuotas };
