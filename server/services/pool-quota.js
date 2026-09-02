const governanceService = require('./governance');

const BYTES_PER_GIB = 1024 ** 3;

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
  return { breaches, nextVmCount, nextRunningVmCount, nextTotalMemoryGiB: Math.round(nextTotalMemoryGiB * 10) / 10 };
}

function quotaError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = 409;
  Object.assign(error, details);
  return error;
}

async function enforcePoolQuota(xenApi, requestedVm, options = {}) {
  const { requireResolvedTarget = false, autoSelect = false, eligiblePoolRefs = [] } = options;
  if (!requestedVm.hostRef && !autoSelect) {
    if (requireResolvedTarget) throw quotaError('POOL_QUOTA_TARGET_UNRESOLVED', 'A deployment pool could not be resolved for quota enforcement.');
    return null;
  }
  const loaders = [xenApi.getHosts(), xenApi.getVMs()];
  if (autoSelect) loaders.push(xenApi.getPools());
  const [hostsResult, vmsResult, poolsResult = { records: {} }] = await Promise.all(loaders);
  const hosts = Object.entries(hostsResult.records || {}).map(([ref, record]) => ({ ref, ...record }));
  const vms = Object.entries(vmsResult.records || {}).map(([ref, record]) => ({ ref, ...record }));
  let host = hosts.find((entry) => entry.ref === requestedVm.hostRef);
  let poolRef = host?.pool || '';
  if (!requestedVm.hostRef && autoSelect) {
    const allowed = new Set((eligiblePoolRefs || []).map(String).filter(Boolean));
    const pools = Object.entries(poolsResult.records || {})
      .map(([ref, record]) => ({ ref, ...record }))
      .filter((pool) => !allowed.size || allowed.has(pool.ref));
    const candidates = pools.map((pool) => {
      const poolHosts = hosts.filter((entry) => entry.pool === pool.ref || (pools.length === 1 && !entry.pool));
      const quota = governanceService.getQuota(pool.ref);
      const usage = buildQuotaUsageForPool(pool.ref, hosts.map((entry) => ({ ...entry, pool: entry.pool || (pools.length === 1 ? pool.ref : '') })), vms);
      const evaluation = quota?.enabled ? evaluateQuotaBreach(quota, usage, requestedVm) : null;
      return { pool, hosts: poolHosts, quota, usage, evaluation };
    }).filter((candidate) => candidate.hosts.length && !candidate.evaluation?.breaches.length)
      .sort((left, right) => left.usage.vmCount - right.usage.vmCount || left.pool.ref.localeCompare(right.pool.ref));
    const selected = candidates[0];
    if (!selected) throw quotaError('POOL_QUOTA_NO_ELIGIBLE_TARGET', 'No eligible deployment pool has quota capacity for this request.');
    host = selected.hosts.find((entry) => entry.enabled !== false) || selected.hosts[0];
    poolRef = selected.pool.ref;
    requestedVm.hostRef = host.ref;
  }
  if (!poolRef && requireResolvedTarget) throw quotaError('POOL_QUOTA_TARGET_UNRESOLVED', 'A deployment pool could not be resolved for quota enforcement.');
  const quota = poolRef ? governanceService.getQuota(poolRef) : null;
  if (!quota?.enabled) return poolRef ? { quota: null, selectedPoolRef: poolRef, selectedHostRef: host?.ref || '' } : null;
  const usage = buildQuotaUsageForPool(poolRef, hosts, vms);
  const evaluation = evaluateQuotaBreach(quota, usage, requestedVm);
  if (!evaluation.breaches.length) return { quota, usage, evaluation, selectedPoolRef: poolRef, selectedHostRef: host?.ref || '' };
  throw quotaError('QUOTA_EXCEEDED', `The deployment would exceed the configured pool quota for ${evaluation.breaches.join(', ')}.`, { quota, usage, evaluation });
}

module.exports = { buildQuotaUsageForPool, evaluateQuotaBreach, enforcePoolQuota };
