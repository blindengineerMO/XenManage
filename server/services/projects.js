const { projectModel } = require('../models/connection');
const managedTargetService = require('./managed-targets');

const BYTES_PER_GIB = 1024 ** 3;

function toRequestedVm(input = {}) {
  const diskPlan = input.diskPlan || input.disks || [];
  const memoryGiB = Number(input.memoryGiB || 0) || (Number(input.memoryStaticMax || 0) / BYTES_PER_GIB);
  return {
    vmCount: 1,
    vcpus: Number(input.vcpus || input.vcpusAtStartup || 0),
    memoryGiB,
    storageGiB: diskPlan.reduce((sum, disk) => sum + (Number(disk.sizeGiB || disk.sizeGb || 0) || (Number(disk.sizeBytes || 0) / BYTES_PER_GIB)), 0),
    gpuCount: input.vgpuTypeRef || input.gpuGroupRef ? 1 : 0,
    networkCount: (input.networkInterfaces || []).length,
    startAfter: Boolean(input.startAfter),
  };
}

function evaluateQuota(quota, usage, requested) {
  const projected = {
    vmCount: usage.vmCount + requested.vmCount,
    vcpus: usage.vcpus + requested.vcpus,
    memoryGiB: usage.memoryGiB + requested.memoryGiB,
    storageGiB: usage.storageGiB + requested.storageGiB,
    gpuCount: usage.gpuCount + requested.gpuCount,
    networkCount: usage.networkCount + requested.networkCount,
  };
  const limits = [
    ['VM count', 'max_vm_count', 'vmCount'], ['vCPU', 'max_vcpus', 'vcpus'], ['memory', 'max_memory_gib', 'memoryGiB'],
    ['storage', 'max_storage_gib', 'storageGiB'], ['GPU', 'max_gpu_count', 'gpuCount'], ['network', 'max_network_count', 'networkCount'],
  ];
  return {
    projected,
    breaches: limits.filter(([, limit, metric]) => Number(quota?.[limit] || 0) > 0 && projected[metric] > Number(quota[limit])).map(([label]) => label),
  };
}

async function getUsage(project, xenApi) {
  const assignments = projectModel.listAssignments(project.id).filter((assignment) => assignment.resource_type === 'vm');
  const refs = new Set(assignments.map((assignment) => assignment.resource_ref));
  const records = refs.size ? await xenApi.getVMs() : { records: {} };
  const vms = Object.entries(records.records || {}).map(([ref, record]) => ({ ref, ...record }))
    .filter((vm) => refs.has(vm.ref) && !vm.is_a_template);
  return vms.reduce((usage, vm) => ({
    vmCount: usage.vmCount + 1,
    vcpus: usage.vcpus + Number(vm.VCPUs_at_startup || vm.VCPUs_max || 0),
    memoryGiB: usage.memoryGiB + Number(vm.memory_static_max || vm.memory_dynamic_max || 0) / BYTES_PER_GIB,
    storageGiB: usage.storageGiB,
    gpuCount: usage.gpuCount + (vm.VGPUs?.length ? 1 : 0),
    networkCount: usage.networkCount + Number(vm.VIFs?.length || 0),
  }), { vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, gpuCount: 0, networkCount: 0 });
}

function canAccessProject(project, actor = {}) {
  if (!project?.enabled) return false;
  if (actor.role === 'admin') return true;
  if (Number(project.owner_user_id || 0) === Number(actor.userId || 0)) return true;
  return project.members.some((member) => Number(member.user_id) === Number(actor.userId || 0));
}

async function evaluateProjectQuota({ projectId, actor, xenApi, targetKey = '', requestedVm = null }) {
  const project = projectModel.getProject(projectId);
  if (!project) {
    const error = new Error('PROJECT_NOT_FOUND'); error.code = 'PROJECT_NOT_FOUND'; error.status = 404; throw error;
  }
  if (!canAccessProject(project, actor)) {
    const error = new Error('PROJECT_FORBIDDEN'); error.code = 'PROJECT_FORBIDDEN'; error.status = 403; throw error;
  }
  const managedTargetId = managedTargetService.parseManagedTargetKey(targetKey);
  if (project.target_ids.length && (!managedTargetId || !project.target_ids.includes(managedTargetId))) {
    const error = new Error('PROJECT_TARGET_FORBIDDEN'); error.code = 'PROJECT_TARGET_FORBIDDEN'; error.status = 403; throw error;
  }
  const usage = await getUsage(project, xenApi);
  const requested = requestedVm ? toRequestedVm(requestedVm) : { vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, gpuCount: 0, networkCount: 0 };
  const evaluation = project.quota?.enabled ? evaluateQuota(project.quota, usage, requested) : { projected: usage, breaches: [] };
  return { project, usage, requested, evaluation, managedTargetId };
}

async function enforceProjectQuota(options) {
  const result = await evaluateProjectQuota(options);
  if (result.evaluation.breaches.length) {
    const error = new Error(`The requested VM would exceed project quota for ${result.evaluation.breaches.join(', ')}.`);
    error.code = 'PROJECT_QUOTA_EXCEEDED'; error.status = 409; error.evaluation = result; throw error;
  }
  return result;
}

module.exports = { toRequestedVm, evaluateProjectQuota, enforceProjectQuota, canAccessProject };
