/* ============================================
   XenMange - Vue.js Application
   ============================================ */

const { createApp, reactive, computed } = Vue;
const { createRouter, createWebHistory, useRouter, useRoute } = VueRouter;

const demoDb = {
  pools: [
    {
      ref: 'OpaqueRef:pool-demo-1',
      name_label: 'Demo Production Pool',
      name_description: 'Primary shared virtualization pool',
      uuid: 'pool-demo-uuid-1',
      master: 'OpaqueRef:host-demo-1',
      slaves: ['OpaqueRef:host-demo-2'],
      tags: ['production', 'ha', 'demo'],
      default_SR: 'OpaqueRef:sr-demo-1',
      migration_network: 'OpaqueRef:net-demo-1',
      other_config: { cluster_profile: 'balanced', lifecycle: 'managed' },
    },
    {
      ref: 'OpaqueRef:pool-demo-2',
      name_label: 'Demo Edge Pool',
      name_description: 'Latency-sensitive edge pool',
      uuid: 'pool-demo-uuid-2',
      master: 'OpaqueRef:host-demo-3',
      slaves: [],
      tags: ['edge', 'branch'],
      default_SR: 'OpaqueRef:sr-demo-2',
      migration_network: 'OpaqueRef:net-demo-2',
      other_config: { cluster_profile: 'performance' },
    },
  ],
  hosts: [
    {
      ref: 'OpaqueRef:host-demo-1',
      name_label: 'xen-host-a01',
      hostname: 'xen-host-a01.lab.local',
      address: '10.42.0.11',
      uuid: 'host-demo-uuid-1',
      pool: 'OpaqueRef:pool-demo-1',
      enabled: true,
      tags: ['production', 'compute'],
      PIFs: ['OpaqueRef:pif-demo-1', 'OpaqueRef:pif-demo-2'],
      PBDs: ['OpaqueRef:pbd-demo-1'],
      resident_VMs: ['OpaqueRef:vm-demo-1', 'OpaqueRef:vm-demo-2'],
      cpu_info: { cpu_count: '32', socket_count: '2', modelname: 'AMD EPYC 7543P' },
      other_config: { rack: 'R1', profile: 'gpu-ready' },
    },
    {
      ref: 'OpaqueRef:host-demo-2',
      name_label: 'xen-host-a02',
      hostname: 'xen-host-a02.lab.local',
      address: '10.42.0.12',
      uuid: 'host-demo-uuid-2',
      pool: 'OpaqueRef:pool-demo-1',
      enabled: true,
      tags: ['production', 'compute'],
      PIFs: ['OpaqueRef:pif-demo-3', 'OpaqueRef:pif-demo-4'],
      PBDs: ['OpaqueRef:pbd-demo-1'],
      resident_VMs: ['OpaqueRef:vm-demo-3'],
      cpu_info: { cpu_count: '32', socket_count: '2', modelname: 'AMD EPYC 7543P' },
      other_config: { rack: 'R1', lifecycle: 'patched' },
    },
    {
      ref: 'OpaqueRef:host-demo-3',
      name_label: 'xen-host-b01',
      hostname: 'xen-host-b01.lab.local',
      address: '10.43.0.21',
      uuid: 'host-demo-uuid-3',
      pool: 'OpaqueRef:pool-demo-2',
      enabled: false,
      tags: ['edge', 'maintenance'],
      PIFs: ['OpaqueRef:pif-demo-5', 'OpaqueRef:pif-demo-6'],
      PBDs: ['OpaqueRef:pbd-demo-2'],
      resident_VMs: ['OpaqueRef:vm-demo-4'],
      cpu_info: { cpu_count: '16', socket_count: '1', modelname: 'Intel Xeon Silver 4310' },
      other_config: { rack: 'R4', maintenance_window: 'Sun 02:00' },
    },
  ],
  vms: [
    {
      ref: 'OpaqueRef:vm-demo-1',
      name_label: 'billing-api-01',
      name_description: 'Primary billing API node',
      power_state: 'Running',
      VCPUs_at_startup: 4,
      memory_static_max: 8589934592,
      uuid: 'vm-demo-uuid-1',
      is_a_template: false,
      resident_on: 'OpaqueRef:host-demo-1',
      tags: ['prod', 'api'],
    },
    {
      ref: 'OpaqueRef:vm-demo-2',
      name_label: 'billing-worker-01',
      name_description: 'Queue worker',
      power_state: 'Running',
      VCPUs_at_startup: 2,
      memory_static_max: 4294967296,
      uuid: 'vm-demo-uuid-2',
      is_a_template: false,
      resident_on: 'OpaqueRef:host-demo-1',
      tags: ['prod', 'worker'],
    },
    {
      ref: 'OpaqueRef:vm-demo-3',
      name_label: 'analytics-web-01',
      name_description: 'Analytics frontend',
      power_state: 'Halted',
      VCPUs_at_startup: 4,
      memory_static_max: 12884901888,
      uuid: 'vm-demo-uuid-3',
      is_a_template: false,
      resident_on: 'OpaqueRef:host-demo-2',
      tags: ['staging', 'web'],
    },
    {
      ref: 'OpaqueRef:vm-demo-4',
      name_label: 'branch-cache-01',
      name_description: 'Edge cache appliance',
      power_state: 'Suspended',
      VCPUs_at_startup: 2,
      memory_static_max: 2147483648,
      uuid: 'vm-demo-uuid-4',
      is_a_template: false,
      resident_on: 'OpaqueRef:host-demo-3',
      tags: ['edge', 'cache'],
    },
    {
      ref: 'OpaqueRef:template-demo-1',
      name_label: 'ubuntu-24-golden',
      name_description: 'Golden Ubuntu server template',
      power_state: 'Halted',
      VCPUs_at_startup: 2,
      memory_static_max: 4294967296,
      uuid: 'template-demo-uuid-1',
      is_a_template: true,
      tags: ['golden', 'linux'],
      platform: { secureboot: 'enabled' },
    },
    {
      ref: 'OpaqueRef:template-demo-2',
      name_label: 'windows-2025-core',
      name_description: 'Windows Server 2025 hardened template',
      power_state: 'Halted',
      VCPUs_at_startup: 4,
      memory_static_max: 8589934592,
      uuid: 'template-demo-uuid-2',
      is_a_template: true,
      tags: ['golden', 'windows'],
      platform: { vtpm: 'enabled' },
    },
  ],
  srs: [
    {
      ref: 'OpaqueRef:sr-demo-1',
      name_label: 'Tier-1 SSD SR',
      type: 'ext',
      physical_size: 1374389534720,
      virtual_allocation: 901943132160,
      uuid: 'sr-demo-uuid-1',
      PBDs: ['OpaqueRef:pbd-demo-1'],
      tags: ['flash', 'performance'],
    },
    {
      ref: 'OpaqueRef:sr-demo-2',
      name_label: 'Edge Archive SR',
      type: 'nfs',
      physical_size: 549755813888,
      virtual_allocation: 188978561024,
      uuid: 'sr-demo-uuid-2',
      PBDs: ['OpaqueRef:pbd-demo-2'],
      tags: ['archive', 'edge'],
    },
  ],
  vdis: {
    'OpaqueRef:sr-demo-1': [
      { ref: 'OpaqueRef:vdi-demo-1', name_label: 'billing-api-root', virtual_size: 68719476736, type: 'user', managed: true },
      { ref: 'OpaqueRef:vdi-demo-2', name_label: 'analytics-data', virtual_size: 274877906944, type: 'user', managed: true },
    ],
    'OpaqueRef:sr-demo-2': [
      { ref: 'OpaqueRef:vdi-demo-3', name_label: 'branch-cache-root', virtual_size: 21474836480, type: 'user', managed: true },
    ],
  },
  networks: [
    {
      ref: 'OpaqueRef:net-demo-1',
      name_label: 'VMLAN Production',
      bridge: 'xenbr0',
      managed: true,
      uuid: 'net-demo-uuid-1',
      PIFs: ['OpaqueRef:pif-demo-1', 'OpaqueRef:pif-demo-3'],
      tags: ['prod', 'management'],
      default_locking_mode: 'network_default',
      other_config: { vlan: '120' },
    },
    {
      ref: 'OpaqueRef:net-demo-2',
      name_label: 'Storage Replication',
      bridge: 'xenbr2',
      managed: true,
      uuid: 'net-demo-uuid-2',
      PIFs: ['OpaqueRef:pif-demo-5', 'OpaqueRef:pif-demo-6'],
      tags: ['storage', 'replication'],
      default_locking_mode: 'locked',
      other_config: { vlan: '240' },
    },
  ],
  hostMetrics: {
    'OpaqueRef:host-demo-1': { live: true, memory_total: 137438953472, memory_free: 42949672960 },
    'OpaqueRef:host-demo-2': { live: true, memory_total: 137438953472, memory_free: 60129542144 },
    'OpaqueRef:host-demo-3': { live: false, memory_total: 68719476736, memory_free: 17179869184 },
  },
  messages: [
    {
      ref: 'OpaqueRef:msg-demo-1',
      uuid: 'msg-demo-uuid-1',
      name: 'Critical storage latency detected',
      cls: 'SR',
      body: 'Tier-1 SSD SR exceeded the latency threshold for 4 minutes.',
      timestamp: '2026-08-19T15:08:00.000Z',
      obj_uuid: 'sr-demo-uuid-1',
    },
    {
      ref: 'OpaqueRef:msg-demo-2',
      uuid: 'msg-demo-uuid-2',
      name: 'Host maintenance scheduled',
      cls: 'host',
      body: 'xen-host-b01 entered maintenance preparation window.',
      timestamp: '2026-08-19T14:32:00.000Z',
      obj_uuid: 'host-demo-uuid-3',
    },
    {
      ref: 'OpaqueRef:msg-demo-3',
      uuid: 'msg-demo-uuid-3',
      name: 'Template library sync successful',
      cls: 'VM',
      body: 'Golden image catalog completed successfully.',
      timestamp: '2026-08-19T13:10:00.000Z',
      obj_uuid: 'template-demo-uuid-1',
    },
    {
      ref: 'OpaqueRef:msg-demo-4',
      uuid: 'msg-demo-uuid-4',
      name: 'Replication lag warning',
      cls: 'VM',
      body: 'billing-api-01 missed its last protection target due to upstream storage latency.',
      timestamp: '2026-08-19T15:11:00.000Z',
      obj_uuid: 'vm-demo-uuid-1',
    },
  ],
  tasks: [
    {
      ref: 'OpaqueRef:task-demo-1',
      uuid: 'task-demo-uuid-1',
      name_label: 'Live migrate billing-api-01',
      name_description: 'Relocating workload to xen-host-a02 for balancing',
      status: 'success',
      progress: 1,
      created: '2026-08-19T14:58:00.000Z',
      finished: '2026-08-19T15:02:00.000Z',
      result: 'Migration completed',
      error_info: [],
      resident_on: 'OpaqueRef:host-demo-2',
    },
    {
      ref: 'OpaqueRef:task-demo-2',
      uuid: 'task-demo-uuid-2',
      name_label: 'Patch compliance scan',
      name_description: 'Evaluating host lifecycle baseline drift',
      status: 'pending',
      progress: 0.42,
      created: '2026-08-19T15:04:00.000Z',
      finished: '',
      result: '',
      error_info: [],
      resident_on: 'OpaqueRef:host-demo-1',
    },
    {
      ref: 'OpaqueRef:task-demo-3',
      uuid: 'task-demo-uuid-3',
      name_label: 'Snapshot analytics-web-01',
      name_description: 'Pre-maintenance protection point',
      status: 'failure',
      progress: 1,
      created: '2026-08-19T13:40:00.000Z',
      finished: '2026-08-19T13:41:20.000Z',
      result: '',
      error_info: ['SR_IO_TIMEOUT', 'Snapshot metadata write failed'],
      resident_on: 'OpaqueRef:host-demo-2',
    },
    {
      ref: 'OpaqueRef:task-demo-4',
      uuid: 'task-demo-uuid-4',
      name_label: 'Backup verify billing-worker-01',
      name_description: 'Validating the latest protection point for worker recovery',
      status: 'success',
      progress: 1,
      created: '2026-08-19T12:16:00.000Z',
      finished: '2026-08-19T12:24:00.000Z',
      result: 'Verification completed',
      error_info: [],
      resident_on: 'OpaqueRef:host-demo-1',
    },
    {
      ref: 'OpaqueRef:task-demo-5',
      uuid: 'task-demo-uuid-5',
      name_label: 'Recovery drill Demo Production Pool',
      name_description: 'Quarterly evacuation and restore readiness validation',
      status: 'success',
      progress: 1,
      created: '2026-08-19T10:05:00.000Z',
      finished: '2026-08-19T10:42:00.000Z',
      result: 'Drill completed',
      error_info: [],
      resident_on: 'OpaqueRef:host-demo-2',
    },
  ],
  connections: [
    {
      id: 1,
      name: 'Demo Production Pool',
      host: '10.42.0.11',
      username: 'root',
      port: 443,
      is_default: 1,
      last_connected_at: '2026-08-19T15:00:00.000Z',
    },
    {
      id: 2,
      name: 'Demo Edge Pool',
      host: '10.43.0.21',
      username: 'root',
      port: 443,
      is_default: 0,
      last_connected_at: '',
    },
  ],
  hostTargets: [
    {
      id: 1,
      name: 'branch-host-r4',
      host: '10.43.0.22',
      username: 'root',
      port: 443,
      mode: 'standalone',
      pool_connection_id: null,
      pool_name: null,
      notes: 'Standalone edge hypervisor candidate',
    },
    {
      id: 2,
      name: 'compute-node-b03',
      host: '10.42.0.13',
      username: 'root',
      port: 443,
      mode: 'pool-member',
      pool_connection_id: 1,
      pool_name: 'Demo Production Pool',
      notes: 'Pending registration as production pool member',
    },
  ],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextDemoId(collection) {
  return collection.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

function sortTasks(tasks) {
  return [...(tasks || [])].sort((left, right) =>
    new Date(right.finished || right.created || 0) - new Date(left.finished || left.created || 0)
  );
}

function buildDemoDashboard() {
  const vms = demoDb.vms.filter((vm) => !vm.is_a_template);
  const templates = demoDb.vms.filter((vm) => vm.is_a_template);
  const vmStates = { running: 0, halted: 0, suspended: 0, paused: 0, other: 0 };

  for (const vm of vms) {
    const state = (vm.power_state || 'other').toLowerCase();
    if (vmStates[state] !== undefined) {
      vmStates[state] += 1;
    } else {
      vmStates.other += 1;
    }
  }

  const hostStates = {
    enabled: demoDb.hosts.filter((host) => host.enabled).length,
    disabled: demoDb.hosts.filter((host) => !host.enabled).length,
    offline: 0,
  };

  return {
    poolCount: demoDb.pools.length,
    hostCount: demoDb.hosts.length,
    vmCount: vms.length,
    templateCount: templates.length,
    srCount: demoDb.srs.length,
    networkCount: demoDb.networks.length,
    vmStates,
    hostStates,
    pools: clone(demoDb.pools),
    hosts: clone(demoDb.hosts.map((host) => ({ ref: host.ref, name: host.name_label, ...host }))),
  };
}

function buildDemoResilience() {
  const vms = demoDb.vms.filter((vm) => !vm.is_a_template);
  const policies = vms.map((vm) => {
    const relatedTasks = sortTasks(demoDb.tasks.filter((task) => {
      const haystack = `${task.name_label || ''} ${task.name_description || ''}`.toLowerCase();
      return haystack.includes((vm.name_label || '').toLowerCase()) || haystack.includes((vm.uuid || '').toLowerCase());
    }));
    const relatedMessages = sortMessages(demoDb.messages.filter((message) => {
      const haystack = `${message.name || ''} ${message.body || ''} ${message.obj_uuid || ''}`.toLowerCase();
      return haystack.includes((vm.name_label || '').toLowerCase()) || haystack.includes((vm.uuid || '').toLowerCase());
    }));
    const lastSuccessTask = relatedTasks.find((task) => (task.status || '').toLowerCase() === 'success');
    const tier = (vm.tags || []).some((tag) => ['prod', 'production', 'critical'].includes(String(tag).toLowerCase()))
      ? 'Tier-1'
      : (vm.tags || []).some((tag) => ['edge', 'branch'].includes(String(tag).toLowerCase()))
        ? 'Edge'
        : (vm.tags || []).some((tag) => ['staging', 'dev', 'test'].includes(String(tag).toLowerCase()))
          ? 'Non-Prod'
          : 'Standard';

    let status = 'info';
    let recommendation = 'Review protection coverage for this workload.';

    if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical')) {
      status = 'critical';
      recommendation = 'Protection drift or replication lag is present. Investigate before relying on this VM for recovery.';
    } else if (lastSuccessTask) {
      status = 'success';
      recommendation = 'Recent protection work completed successfully. Schedule routine restore verification.';
    } else if (tier === 'Tier-1' && (vm.power_state || '').toLowerCase() === 'running') {
      status = 'warning';
      recommendation = 'This production VM should be checked for a fresh backup or snapshot before the next change window.';
    }

    return {
      ref: vm.ref,
      name_label: vm.name_label,
      power_state: vm.power_state,
      policy: tier,
      status,
      hasRecentProtection: Boolean(lastSuccessTask),
      lastProtectedAt: lastSuccessTask?.finished || lastSuccessTask?.created || '',
      lastTaskLabel: lastSuccessTask?.name_label || relatedTasks[0]?.name_label || 'No recent protection task',
      lastAlertLabel: relatedMessages[0]?.name || 'No resilience alerts',
      recommendation,
      tags: vm.tags || [],
      uuid: vm.uuid,
    };
  });

  const hostPlans = demoDb.hosts.map((host) => {
    const evacuationTarget = demoDb.hosts.find((candidate) => candidate.ref !== host.ref && candidate.enabled);
    const taskText = sortTasks(demoDb.tasks.filter((task) => {
      const haystack = `${task.name_label || ''} ${task.name_description || ''} ${task.resident_on || ''}`.toLowerCase();
      return haystack.includes((host.ref || '').toLowerCase()) || haystack.includes((host.name_label || '').toLowerCase());
    }));
    const relatedMessages = sortMessages(demoDb.messages.filter((message) => {
      const haystack = `${message.name || ''} ${message.body || ''} ${message.obj_uuid || ''}`.toLowerCase();
      return haystack.includes((host.uuid || '').toLowerCase()) || haystack.includes((host.name_label || '').toLowerCase());
    }));

    let status = 'success';
    let summary = 'Failover posture looks healthy.';
    if (!host.enabled) {
      status = 'disabled';
      summary = 'Host is currently disabled or parked for maintenance.';
    } else if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical')) {
      status = 'critical';
      summary = 'Resilience-affecting alerts are active on this host.';
    } else if (taskText.some((task) => ['pending', 'queued'].includes((task.status || '').toLowerCase()))) {
      status = 'pending';
      summary = 'A resilience-related action is still in progress.';
    }

    return {
      ref: host.ref,
      name_label: host.name_label,
      address: host.address,
      status,
      evacuationTarget: evacuationTarget?.name_label || 'No alternate host available',
      residentVmCount: (host.resident_VMs || []).length,
      recentTask: taskText[0]?.name_label || 'No recent host resilience task',
      recentAlert: relatedMessages[0]?.name || 'No recent host alert',
      summary,
      other_config: host.other_config || {},
      uuid: host.uuid,
    };
  });

  const recoveryPlans = demoDb.pools.map((pool) => {
    const enabledHostCount = demoDb.hosts.filter((host) => host.enabled).length;
    const protectedVmCount = policies.filter((policy) => policy.hasRecentProtection).length;
    const atRiskVmCount = policies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length;
    const status = atRiskVmCount > protectedVmCount ? 'critical' : enabledHostCount < 2 ? 'warning' : 'success';

    return {
      ref: pool.ref,
      name_label: pool.name_label,
      status,
      enabledHostCount,
      protectedVmCount,
      atRiskVmCount,
      nextAction: status === 'critical'
        ? 'Prioritize protection coverage for at-risk workloads before the next maintenance cycle.'
        : status === 'warning'
          ? 'Add more failover capacity or re-enable a standby host before relying on this pool for recovery.'
          : 'Continue periodic recovery drills and evacuation target validation.',
      uuid: pool.uuid,
    };
  });

  const recentEvents = [...demoDb.tasks
    .filter((task) => /(snapshot|backup|recover|drill|migrat|protect)/i.test(`${task.name_label} ${task.name_description}`))
    .map((task) => ({
      type: 'task',
      ref: task.ref,
      label: task.name_label,
      status: task.status,
      timestamp: task.finished || task.created,
      detail: task.name_description,
    })), ...demoDb.messages
    .filter((message) => /(replicat|protect|storage|backup|recovery|failover)/i.test(`${message.name} ${message.body}`))
    .map((message) => ({
      type: 'alert',
      ref: message.ref,
      label: message.name,
      status: getMessageSeverity(message),
      timestamp: message.timestamp,
      detail: message.body,
    }))].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0)).slice(0, 12);

  return {
    generatedAt: '2026-08-19T15:12:00.000Z',
    summary: {
      protectedVmCount: policies.filter((policy) => policy.hasRecentProtection).length,
      atRiskVmCount: policies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length,
      maintenanceHostCount: hostPlans.filter((plan) => plan.status === 'disabled').length,
      recoveryPlanCount: recoveryPlans.length,
      recentEventCount: recentEvents.length,
    },
    protectionPolicies: policies,
    hostPlans,
    recoveryPlans,
    recentEvents,
  };
}

function demoRequest(method, url, body) {
  const parsedUrl = new URL(url, window.location.origin);
  const path = parsedUrl.pathname;
  const search = parsedUrl.searchParams.get('search');

  if (method === 'POST' && path === '/api/auth/logout') {
    return { success: true };
  }

  if (method === 'GET' && path === '/api/auth/status') {
    return {
      authenticated: true,
      host: store.host || 'Demo Fabric',
      username: store.username || 'demo',
      demoMode: true,
    };
  }

  if (method === 'GET' && path === '/api/dashboard') {
    return buildDemoDashboard();
  }

  if (method === 'GET' && path === '/api/dashboard/messages') {
    return clone(demoDb.messages);
  }

  if (method === 'GET' && path === '/api/tasks') {
    return { total: demoDb.tasks.length, data: clone(sortTasks(demoDb.tasks)) };
  }

  if (method === 'GET' && path === '/api/resilience') {
    return buildDemoResilience();
  }

  if (method === 'GET' && path === '/api/pools') {
    return { total: demoDb.pools.length, data: clone(demoDb.pools) };
  }

  if (method === 'GET' && path === '/api/hosts') {
    return { total: demoDb.hosts.length, data: clone(demoDb.hosts) };
  }

  if (method === 'GET' && path.startsWith('/api/hosts/') && path.endsWith('/metrics')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    return clone(demoDb.hostMetrics[ref] || { live: false, memory_total: 0, memory_free: 0 });
  }

  if (method === 'GET' && path === '/api/vms/templates') {
    const templates = demoDb.vms.filter((vm) => vm.is_a_template);
    return { total: templates.length, data: clone(templates) };
  }

  if (method === 'GET' && path === '/api/vms') {
    let vms = demoDb.vms.filter((vm) => !vm.is_a_template);
    if (search) {
      const query = search.toLowerCase();
      vms = vms.filter((vm) =>
        (vm.name_label || '').toLowerCase().includes(query) ||
        (vm.name_description || '').toLowerCase().includes(query)
      );
    }
    return { total: vms.length, data: clone(vms) };
  }

  if (method === 'GET' && path.startsWith('/api/vms/')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    return clone(demoDb.vms.find((vm) => vm.ref === ref) || {});
  }

  if (method === 'POST' && path.startsWith('/api/vms/')) {
    const action = path.split('/')[3];
    const vm = demoDb.vms.find((entry) => entry.ref === body.ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    if (action === 'start' || action === 'resume') vm.power_state = 'Running';
    if (action === 'shutdown') vm.power_state = 'Halted';
    if (action === 'suspend') vm.power_state = 'Suspended';
    if (action === 'reboot') vm.power_state = 'Running';

    return { success: true };
  }

  if (method === 'GET' && path === '/api/storage') {
    return { total: demoDb.srs.length, data: clone(demoDb.srs) };
  }

  if (method === 'GET' && path.startsWith('/api/storage/') && path.endsWith('/vdis')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vdis = demoDb.vdis[ref] || [];
    return { total: vdis.length, data: clone(vdis) };
  }

  if (method === 'GET' && path === '/api/networks') {
    return { total: demoDb.networks.length, data: clone(demoDb.networks) };
  }

  if (method === 'GET' && path === '/api/connections') {
    return clone(demoDb.connections);
  }

  if (method === 'POST' && path === '/api/connections') {
    const nextRecord = {
      id: nextDemoId(demoDb.connections),
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      is_default: body.isDefault ? 1 : 0,
      last_connected_at: '',
    };

    if (nextRecord.is_default) {
      demoDb.connections.forEach((connection) => { connection.is_default = 0; });
    }

    demoDb.connections.push(nextRecord);
    return clone(nextRecord);
  }

  if (method === 'PUT' && path.startsWith('/api/connections/')) {
    const id = Number(path.split('/')[3]);
    const record = demoDb.connections.find((connection) => connection.id === id);
    if (!record) throw new Error('CONNECTION_NOT_FOUND');

    Object.assign(record, {
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      is_default: body.isDefault ? 1 : 0,
    });

    if (record.is_default) {
      demoDb.connections.forEach((connection) => {
        if (connection.id !== id) connection.is_default = 0;
      });
    }

    return clone(record);
  }

  if (method === 'POST' && path.startsWith('/api/connections/') && path.endsWith('/default')) {
    const id = Number(path.split('/')[3]);
    const record = demoDb.connections.find((connection) => connection.id === id);
    if (!record) throw new Error('CONNECTION_NOT_FOUND');

    demoDb.connections.forEach((connection) => { connection.is_default = connection.id === id ? 1 : 0; });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/connections/')) {
    const id = Number(path.split('/')[3]);
    const index = demoDb.connections.findIndex((connection) => connection.id === id);
    if (index === -1) throw new Error('CONNECTION_NOT_FOUND');
    demoDb.connections.splice(index, 1);
    return { success: true };
  }

  if (method === 'GET' && path === '/api/host-targets') {
    return clone(demoDb.hostTargets);
  }

  if (method === 'POST' && path === '/api/host-targets') {
    const pool = demoDb.connections.find((connection) => connection.id === Number(body.poolConnectionId || 0));
    const record = {
      id: nextDemoId(demoDb.hostTargets),
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      mode: body.mode || 'standalone',
      pool_connection_id: body.mode === 'pool-member' ? Number(body.poolConnectionId || 0) || null : null,
      pool_name: body.mode === 'pool-member' ? (pool?.name || null) : null,
      notes: body.notes || '',
    };
    demoDb.hostTargets.push(record);
    return clone(record);
  }

  if (method === 'PUT' && path.startsWith('/api/host-targets/')) {
    const id = Number(path.split('/')[3]);
    const record = demoDb.hostTargets.find((target) => target.id === id);
    const pool = demoDb.connections.find((connection) => connection.id === Number(body.poolConnectionId || 0));
    if (!record) throw new Error('HOST_TARGET_NOT_FOUND');

    Object.assign(record, {
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      mode: body.mode || 'standalone',
      pool_connection_id: body.mode === 'pool-member' ? Number(body.poolConnectionId || 0) || null : null,
      pool_name: body.mode === 'pool-member' ? (pool?.name || null) : null,
      notes: body.notes || '',
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/host-targets/')) {
    const id = Number(path.split('/')[3]);
    const index = demoDb.hostTargets.findIndex((target) => target.id === id);
    if (index === -1) throw new Error('HOST_TARGET_NOT_FOUND');
    demoDb.hostTargets.splice(index, 1);
    return { success: true };
  }

  throw new Error(`DEMO_ROUTE_UNSUPPORTED: ${method} ${path}`);
}
