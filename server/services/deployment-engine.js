const { deploymentRunModel } = require('../models/connection');
const governanceService = require('./governance');

const VARIABLE_PATTERN = /\$\{([a-zA-Z0-9_]+)\}/g;
const BYTES_PER_GIB = 1024 ** 3;

function createComposeError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = 400;
  return error;
}

function interpolateValue(value, variables) {
  if (typeof value === 'string') {
    return value.replace(VARIABLE_PATTERN, (match, name) => {
      if (!Object.prototype.hasOwnProperty.call(variables, name)) {
        throw createComposeError('COMPOSE_UNKNOWN_VARIABLE', `Unknown variable "${name}" referenced in the compose spec.`);
      }
      return String(variables[name]);
    });
  }
  if (Array.isArray(value)) {
    return value.map((entry) => interpolateValue(entry, variables));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, interpolateValue(entry, variables)]));
  }
  return value;
}

function toNumber(value, fieldLabel) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw createComposeError('COMPOSE_INVALID_NUMBER', `"${fieldLabel}" must resolve to a positive number.`);
  }
  return num;
}

function topologicalSort(vmsMap) {
  const keys = Object.keys(vmsMap);
  const visited = new Set();
  const visiting = new Set();
  const order = [];

  function visit(key) {
    if (visited.has(key)) return;
    if (visiting.has(key)) {
      throw createComposeError('COMPOSE_DEPENDENCY_CYCLE', `Dependency cycle detected at VM "${key}".`);
    }
    if (!vmsMap[key]) {
      throw createComposeError('COMPOSE_UNKNOWN_DEPENDENCY', `VM "${key}" depends on an undefined VM.`);
    }
    visiting.add(key);
    for (const dep of vmsMap[key].dependsOn || []) {
      if (!vmsMap[dep]) {
        throw createComposeError('COMPOSE_UNKNOWN_DEPENDENCY', `VM "${key}" depends on undefined VM "${dep}".`);
      }
      visit(dep);
    }
    visiting.delete(key);
    visited.add(key);
    order.push(key);
  }

  keys.forEach(visit);
  return order;
}

async function resolveRefByNameOrUuid(xenApi, className, nameOrRef, label) {
  const value = String(nameOrRef || '').trim();
  if (!value) {
    throw createComposeError('COMPOSE_REF_REQUIRED', `A ${label} reference is required.`);
  }
  if (/^OpaqueRef:/.test(value)) {
    return value;
  }
  const records = await xenApi.getAllRecords(className);
  const match = Object.entries(records).find(
    ([, record]) => record.uuid === value || record.name_label === value
  );
  if (!match) {
    throw createComposeError('COMPOSE_REF_NOT_FOUND', `Could not resolve ${label} "${value}" on the target pool.`);
  }
  return match[0];
}

function buildQuotaUsageForPool(poolRef, hosts = [], vms = []) {
  const hostPoolMap = Object.fromEntries(hosts.map((host) => [host.ref, host.pool || '']));
  const poolVms = vms.filter((vm) => {
    if (vm.is_a_template) return false;
    const pool = vm.pool || hostPoolMap[vm.resident_on] || hostPoolMap[vm.affinity] || '';
    return pool === poolRef;
  });

  return {
    vmCount: poolVms.length,
    runningVmCount: poolVms.filter((vm) => String(vm.power_state || '').toLowerCase() === 'running').length,
    totalMemoryGiB: poolVms.reduce((sum, vm) => sum + Number(vm.memory_static_max || vm.memory_dynamic_max || 0), 0) / BYTES_PER_GIB,
  };
}

function evaluateQuotaBreach(quota, usage, requestedVm) {
  const nextVmCount = usage.vmCount + 1;
  const nextRunningVmCount = usage.runningVmCount + (requestedVm.startAfter ? 1 : 0);
  const nextTotalMemoryGiB = usage.totalMemoryGiB + (Number(requestedVm.memoryStaticMax || 0) / BYTES_PER_GIB);
  const breaches = [];

  if (quota.maxVmCount > 0 && nextVmCount > quota.maxVmCount) breaches.push('VM count');
  if (quota.maxRunningVmCount > 0 && nextRunningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
  if (quota.maxTotalMemoryGiB > 0 && nextTotalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');

  return {
    breaches,
    usage: {
      vmCount: nextVmCount,
      runningVmCount: nextRunningVmCount,
      totalMemoryGiB: Math.round(nextTotalMemoryGiB * 10) / 10,
    },
  };
}

/**
 * Resolves variables, refs, and dependency order for a compose spec without touching XenAPI's
 * create/start calls — shared by both dry-run planning and real execution.
 */
async function planCompose(xenApi, spec) {
  const variables = spec.variables || {};
  const resolvedVms = interpolateValue(spec.vms, variables);
  const resolvedNetworks = interpolateValue(spec.networks || {}, variables);
  const resolvedStorageRepositories = interpolateValue(spec.storageRepositories || {}, variables);

  const order = topologicalSort(resolvedVms);

  const networkRefCache = new Map();
  const srRefCache = new Map();
  const hostRefCache = new Map();
  const creationSources = await xenApi.getVmCreationSources();
  const deployableTemplates = creationSources.deployableTemplates || [];
  const plannedNames = new Set();

  function resolveDeployableTemplate(value) {
    const identifier = String(value || '').trim();
    if (!identifier) {
      throw createComposeError('COMPOSE_REF_REQUIRED', 'A deployment template reference is required.');
    }
    const match = deployableTemplates.find((template) => (
      template.ref === identifier || template.uuid === identifier || template.name_label === identifier
    ));
    if (!match) {
      throw createComposeError(
        'COMPOSE_TEMPLATE_NOT_DEPLOYABLE',
        `Template "${identifier}" is not a deployable golden template. Compose can only deploy golden templates with an installed boot disk; use New VM for operating-system profiles.`
      );
    }
    return match;
  }

  async function resolveNetworkAlias(alias) {
    if (networkRefCache.has(alias)) return networkRefCache.get(alias);
    const entry = resolvedNetworks[alias];
    const ref = entry
      ? await resolveRefByNameOrUuid(xenApi, 'network', entry.ref, `network "${alias}"`)
      : await resolveRefByNameOrUuid(xenApi, 'network', alias, 'network');
    networkRefCache.set(alias, ref);
    return ref;
  }

  async function resolveStorageAlias(alias) {
    if (srRefCache.has(alias)) return srRefCache.get(alias);
    const entry = resolvedStorageRepositories[alias];
    const ref = entry
      ? await resolveRefByNameOrUuid(xenApi, 'SR', entry.ref, `storage repository "${alias}"`)
      : await resolveRefByNameOrUuid(xenApi, 'SR', alias, 'storage repository');
    srRefCache.set(alias, ref);
    return ref;
  }

  async function resolveHostAffinity(value) {
    if (!value) return '';
    if (hostRefCache.has(value)) return hostRefCache.get(value);
    const ref = await resolveRefByNameOrUuid(xenApi, 'host', value, `host "${value}"`);
    hostRefCache.set(value, ref);
    return ref;
  }

  const plans = [];
  for (const key of order) {
    const vmSpec = resolvedVms[key];
    const template = resolveDeployableTemplate(vmSpec.template);
    const nameLabel = String(vmSpec.nameLabel || '').trim();
    if (plannedNames.has(nameLabel)) {
      throw createComposeError('COMPOSE_DUPLICATE_VM_NAME', `VM name "${nameLabel}" is declared more than once in this compose spec.`);
    }
    plannedNames.add(nameLabel);
    const memoryStaticMax = toNumber(vmSpec.memoryStaticMax, `vms.${key}.memoryStaticMax`);
    const memoryDynamicMax = vmSpec.memoryDynamicMax ? toNumber(vmSpec.memoryDynamicMax, `vms.${key}.memoryDynamicMax`) : memoryStaticMax;
    const memoryDynamicMin = vmSpec.memoryDynamicMin ? toNumber(vmSpec.memoryDynamicMin, `vms.${key}.memoryDynamicMin`) : memoryDynamicMax;
    const vcpusAtStartup = Math.round(toNumber(vmSpec.vcpusAtStartup || 1, `vms.${key}.vcpusAtStartup`));
    const vcpusMax = Math.round(toNumber(vmSpec.vcpusMax || vcpusAtStartup, `vms.${key}.vcpusMax`));
    if (vcpusAtStartup > vcpusMax) {
      throw createComposeError('COMPOSE_INVALID_VCPU_TOPOLOGY', `VM "${nameLabel}" cannot start with more vCPUs than its maximum.`);
    }
    if (memoryDynamicMin > memoryDynamicMax || memoryDynamicMax > memoryStaticMax) {
      throw createComposeError('COMPOSE_INVALID_MEMORY_TOPOLOGY', `VM "${nameLabel}" must satisfy dynamic minimum <= dynamic maximum <= static maximum.`);
    }

    const disks = [];
    for (const [index, disk] of (vmSpec.disks || []).entries()) {
      disks.push({
        srRef: await resolveStorageAlias(disk.sr),
        srAlias: disk.sr,
        sizeBytes: Math.round(toNumber(disk.sizeGb, `vms.${key}.disks[].sizeGb`) * BYTES_PER_GIB),
        nameLabel: disk.nameLabel || `${nameLabel}-data-${index + 1}`,
        nameDescription: disk.nameDescription || '',
      });
    }

    const networkInterfaces = [];
    for (const nic of vmSpec.networkInterfaces || []) {
      networkInterfaces.push({
        networkRef: await resolveNetworkAlias(nic.network),
        networkAlias: nic.network,
        mac: nic.mac || '',
      });
    }

    plans.push({
      key,
      template: template.name_label || vmSpec.template,
      templateRef: template.ref,
      nameLabel,
      nameDescription: vmSpec.nameDescription || '',
      memoryStaticMax,
      memoryDynamicMax,
      memoryDynamicMin,
      vcpusAtStartup,
      vcpusMax,
      affinityRef: await resolveHostAffinity(vmSpec.affinity),
      disks,
      networkInterfaces,
      otherConfig: vmSpec.otherConfig || {},
      xenstoreData: vmSpec.xenstoreData || {},
      tags: vmSpec.tags || [],
      dependsOn: vmSpec.dependsOn || [],
      startAfter: typeof vmSpec.startAfter === 'boolean' ? vmSpec.startAfter : Boolean(spec.startAfter),
    });
  }

  return { order, plans, variables };
}

async function executeCompose(xenApi, spec, { submittedBy = '', beforeDeploy } = {}) {
  const { plans } = await planCompose(xenApi, spec);

  let hosts = [];
  let vms = [];
  let hostsLoaded = false;
  const quotaUsageByPool = new Map();

  const steps = [];
  let failed = false;

  for (const plan of plans) {
    const step = {
      key: plan.key,
      label: plan.nameLabel,
      status: 'pending',
      detail: '',
      started_at: new Date().toISOString(),
      finished_at: null,
      error_text: '',
    };
    steps.push(step);

    if (failed) {
      step.status = 'skipped';
      step.detail = 'Skipped because an earlier VM in the plan failed.';
      step.finished_at = new Date().toISOString();
      continue;
    }

    try {
      if (plan.affinityRef) {
        if (!hostsLoaded) {
          const [hostsResult, vmsResult] = await Promise.all([xenApi.getHosts(), xenApi.getVMs()]);
          hosts = Object.entries(hostsResult.records || {}).map(([ref, record]) => ({ ref, ...record }));
          vms = Object.entries(vmsResult.records || {}).map(([ref, record]) => ({ ref, ...record }));
          hostsLoaded = true;
        }
        const host = hosts.find((entry) => entry.ref === plan.affinityRef);
        const poolRef = host?.pool || '';
        if (poolRef) {
          const quota = governanceService.getQuota(poolRef);
          if (quota?.enabled) {
            const usage = quotaUsageByPool.get(poolRef) || buildQuotaUsageForPool(poolRef, hosts, vms);
            const evaluation = evaluateQuotaBreach(quota, usage, {
              startAfter: plan.startAfter,
              memoryStaticMax: plan.memoryStaticMax,
            });
            if (evaluation.breaches.length) {
              throw createComposeError(
                'QUOTA_EXCEEDED',
                `Deploying "${plan.nameLabel}" would exceed the pool quota for ${evaluation.breaches.join(', ')}.`
              );
            }
            quotaUsageByPool.set(poolRef, evaluation.usage);
          }
        }
      }

      if (typeof beforeDeploy === 'function') {
        await beforeDeploy(plan);
      }

      const createdVm = await xenApi.deployComposeVM(plan.templateRef, {
        nameLabel: plan.nameLabel,
        nameDescription: plan.nameDescription,
        vcpusAtStartup: plan.vcpusAtStartup,
        vcpusMax: plan.vcpusMax,
        memoryStaticMax: plan.memoryStaticMax,
        memoryDynamicMax: plan.memoryDynamicMax,
        memoryDynamicMin: plan.memoryDynamicMin,
        tags: plan.tags,
        otherConfig: plan.otherConfig,
        xenstoreData: plan.xenstoreData,
        affinity: plan.affinityRef,
        disks: plan.disks,
        networkInterfaces: plan.networkInterfaces,
        startAfter: plan.startAfter,
      });

      step.status = 'success';
      step.detail = `Provisioned from "${plan.template}" as ${plan.nameLabel} (${createdVm.ref}).`;
      step.finished_at = new Date().toISOString();
      step.ref = createdVm.ref;
    } catch (error) {
      failed = true;
      step.status = 'failure';
      step.error_text = error.message || String(error);
      step.detail = `Deployment of "${plan.nameLabel}" failed: ${step.error_text}`;
      step.finished_at = new Date().toISOString();
    }
  }

  const successCount = steps.filter((step) => step.status === 'success').length;
  const overallStatus = failed ? (successCount > 0 ? 'warning' : 'failure') : 'success';
  const progress = plans.length ? successCount / plans.length : 1;
  const result = failed
    ? `${successCount} of ${plans.length} VM(s) deployed before this compose run stopped on a failure.`
    : `All ${plans.length} VM(s) in "${spec.name}" deployed successfully.`;

  const run = deploymentRunModel.create({
    templateRef: spec.name,
    templateName: spec.name,
    templateVersion: spec.version || '1',
    vmName: spec.name,
    submittedBy,
    submittedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: overallStatus,
    progress,
    startAfter: Boolean(spec.startAfter),
    validationStatus: 'pending',
    result,
    targetRoute: '/vms',
    runKind: 'compose',
    specJson: JSON.stringify(spec),
  }, steps);

  return { run, steps, failed };
}

module.exports = {
  planCompose,
  executeCompose,
  resolveRefByNameOrUuid,
  interpolateValue,
  topologicalSort,
};
