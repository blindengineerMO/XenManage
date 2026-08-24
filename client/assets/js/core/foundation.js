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
      VCPUs_max: 4,
      memory_static_max: 8589934592,
      memory_dynamic_max: 8589934592,
      uuid: 'vm-demo-uuid-1',
      is_a_template: false,
      resident_on: 'OpaqueRef:host-demo-1',
      affinity: 'OpaqueRef:host-demo-1',
      VBDs: ['OpaqueRef:vbd-demo-1'],
      VIFs: ['OpaqueRef:vif-demo-1'],
      HVM_boot_policy: 'BIOS order',
      platform: { secureboot: 'enabled', firmware: 'uefi' },
      tags: ['prod', 'api'],
    },
    {
      ref: 'OpaqueRef:vm-demo-2',
      name_label: 'billing-worker-01',
      name_description: 'Queue worker',
      power_state: 'Running',
      VCPUs_at_startup: 2,
      VCPUs_max: 2,
      memory_static_max: 4294967296,
      memory_dynamic_max: 4294967296,
      uuid: 'vm-demo-uuid-2',
      is_a_template: false,
      resident_on: 'OpaqueRef:host-demo-1',
      affinity: 'OpaqueRef:host-demo-1',
      VBDs: ['OpaqueRef:vbd-demo-2'],
      VIFs: ['OpaqueRef:vif-demo-2'],
      HVM_boot_policy: 'BIOS order',
      platform: { secureboot: 'enabled' },
      tags: ['prod', 'worker'],
    },
    {
      ref: 'OpaqueRef:vm-demo-3',
      name_label: 'analytics-web-01',
      name_description: 'Analytics frontend',
      power_state: 'Halted',
      VCPUs_at_startup: 4,
      VCPUs_max: 4,
      memory_static_max: 12884901888,
      memory_dynamic_max: 12884901888,
      uuid: 'vm-demo-uuid-3',
      is_a_template: false,
      resident_on: 'OpaqueRef:host-demo-2',
      affinity: 'OpaqueRef:host-demo-2',
      VBDs: ['OpaqueRef:vbd-demo-3'],
      VIFs: ['OpaqueRef:vif-demo-3'],
      HVM_boot_policy: 'UEFI',
      platform: { secureboot: 'disabled' },
      tags: ['staging', 'web'],
    },
    {
      ref: 'OpaqueRef:vm-demo-4',
      name_label: 'branch-cache-01',
      name_description: 'Edge cache appliance',
      power_state: 'Suspended',
      VCPUs_at_startup: 2,
      VCPUs_max: 2,
      memory_static_max: 2147483648,
      memory_dynamic_max: 2147483648,
      uuid: 'vm-demo-uuid-4',
      is_a_template: false,
      resident_on: 'OpaqueRef:host-demo-3',
      affinity: 'OpaqueRef:host-demo-3',
      VBDs: ['OpaqueRef:vbd-demo-4'],
      VIFs: ['OpaqueRef:vif-demo-4'],
      HVM_boot_policy: 'BIOS order',
      platform: { firmware: 'legacy' },
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
      tags: ['golden', 'linux', 'stable', 'baseline'],
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
      tags: ['golden', 'windows', 'staged'],
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
      { ref: 'OpaqueRef:vdi-demo-1', uuid: 'vdi-demo-uuid-1', SR: 'OpaqueRef:sr-demo-1', name_label: 'billing-api-root', virtual_size: 68719476736, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd-demo-1'] },
      { ref: 'OpaqueRef:vdi-demo-2', uuid: 'vdi-demo-uuid-2', SR: 'OpaqueRef:sr-demo-1', name_label: 'billing-worker-root', virtual_size: 42949672960, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd-demo-2'] },
      { ref: 'OpaqueRef:vdi-demo-3', uuid: 'vdi-demo-uuid-3', SR: 'OpaqueRef:sr-demo-1', name_label: 'analytics-data', virtual_size: 274877906944, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd-demo-3'] },
    ],
    'OpaqueRef:sr-demo-2': [
      { ref: 'OpaqueRef:vdi-demo-4', uuid: 'vdi-demo-uuid-4', SR: 'OpaqueRef:sr-demo-2', name_label: 'branch-cache-root', virtual_size: 21474836480, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd-demo-4'] },
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
      VIFs: ['OpaqueRef:vif-demo-1', 'OpaqueRef:vif-demo-2', 'OpaqueRef:vif-demo-3'],
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
      VIFs: ['OpaqueRef:vif-demo-4'],
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
  remediationTasks: [
    {
      ref: 'OpaqueRef:remediation-demo-1',
      uuid: 'remediation-demo-uuid-1',
      name_label: 'Capacity review: Tier-1 SSD SR',
      name_description: 'Investigate the sustained storage latency alert, verify active workloads on the datastore, and prepare a mitigation plan for the next platform review.',
      status: 'pending',
      progress: 0,
      created: '2026-08-19T15:16:00.000Z',
      finished: '',
      result: 'Queued for operator follow-through.',
      error_info: [],
      resident_on: 'sr-demo-uuid-1',
      task_kind: 'remediation',
      source: 'remediation',
      action_type: 'capacity',
      assignee: 'Platform Ops',
      due_date: '2026-08-23',
      related_alert_ref: 'OpaqueRef:msg-demo-1',
      related_alert_uuid: 'msg-demo-uuid-1',
      related_alert_summary: 'Critical storage latency detected',
      related_class: 'sr',
      related_object: 'sr-demo-uuid-1',
      target_route: '/capacity',
      workspace_summary: 'Validate datastore pressure, confirm the follow-through owner, and capture supporting evidence for Critical storage latency detected.',
      evidence_checklist: [
        'Confirm active workloads attached to sr-demo-uuid-1.',
        'Capture current latency or utilization evidence for Critical storage latency detected.',
        'Review related host pressure before scheduling mitigation.',
      ],
      completion_criteria: [
        'Named owner accepts the remediation task.',
        'Mitigation or expansion path is documented.',
        'Closure note is recorded in Activity after validation.',
      ],
      template_id: 'remediation-template-demo-1',
      template_name: 'Storage Capacity Review',
      template_launch_mode: 'queue',
      recurrence_mode: 'daily',
      recurrence_scope: 'object',
      recurrence_cooldown_days: 0,
      recurrence_window_key: 'sr-demo-uuid-1',
      created_by: 'demo',
      updated_at: '2026-08-19T15:16:00.000Z',
    },
  ],
  remediationTemplates: [
    {
      id: 'remediation-template-demo-1',
      enabled: true,
      name: 'Storage Capacity Review',
      matchClass: 'sr',
      matchTargetRoute: '/storage',
      matchObject: '',
      matchSeverity: 'warning',
      matchText: 'storage threshold',
      textMatchMode: 'all',
      actionType: 'capacity',
      taskNameTemplate: 'Capacity Review: {summary}',
      defaultAssignee: 'Platform Ops',
      defaultDueDays: 2,
      defaultTargetRoute: '/capacity',
      defaultNotes: 'Review the affected datastore, validate active workloads, and prepare a mitigation summary for the next capacity review window.',
      workspaceSummaryTemplate: 'Validate datastore pressure, confirm the follow-through owner, and capture supporting evidence for {summary}.',
      evidenceChecklist: [
        'Confirm active workloads attached to {object}.',
        'Capture current latency or utilization evidence for {summary}.',
        'Review related host pressure before scheduling mitigation.',
      ],
      completionCriteria: [
        'Named owner accepts the remediation task.',
        'Mitigation or expansion path is documented.',
        'Closure note is recorded in Activity after validation.',
      ],
      launchMode: 'queue',
      recurrenceMode: 'daily',
      recurrenceScope: 'object',
      cooldownDays: 0,
      updatedAt: '2026-08-22T09:45:00.000Z',
    },
  ],
  connections: [
    {
      id: 1,
      name: 'Demo Production Pool',
      host: '10.42.0.11',
      username: 'root',
      port: 443,
      owner_user_id: 1,
      visibility: 'shared',
      is_default: 1,
      last_connected_at: '2026-08-19T15:00:00.000Z',
    },
    {
      id: 2,
      name: 'Demo Edge Pool',
      host: '10.43.0.21',
      username: 'root',
      port: 443,
      owner_user_id: 1,
      visibility: 'private',
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
      owner_user_id: 1,
      visibility: 'shared',
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
      owner_user_id: 3,
      visibility: 'private',
      mode: 'pool-member',
      pool_connection_id: 1,
      pool_name: 'Demo Production Pool',
      notes: 'Pending registration as production pool member',
    },
  ],
  inventoryWorkspaces: [
    {
      id: 'workspace-demo-1',
      name: 'Production Health Sweep',
      scope: 'host',
      query: 'production',
      targetConnectionId: 1,
      notes: '',
      ownerUserId: 1,
      visibility: 'shared',
      createdAt: '2026-08-23T09:30:00.000Z',
      updatedAt: '2026-08-24T08:15:00.000Z',
      createdBy: 'demo',
    },
    {
      id: 'workspace-demo-2',
      name: 'Edge Follow-Up',
      scope: 'alert',
      query: 'edge',
      targetConnectionId: 2,
      notes: '',
      ownerUserId: 1,
      visibility: 'private',
      createdAt: '2026-08-23T10:10:00.000Z',
      updatedAt: '2026-08-24T07:45:00.000Z',
      createdBy: 'demo',
    },
  ],
  alertStates: {
    'OpaqueRef:msg-demo-2': {
      acknowledged: true,
      acknowledgedAt: '2026-08-19T14:40:00.000Z',
      acknowledgedBy: 'demo',
      suppressionUntil: '',
      severityOverride: 'warning',
      healthAction: 'review',
      notes: 'Track during the maintenance prep window.',
      updatedAt: '2026-08-19T14:40:00.000Z',
    },
  },
  alertPolicies: [
    {
      id: 'alert-policy-demo-1',
      enabled: true,
      name: 'Storage Threshold Review',
      matchClass: 'sr',
      matchTargetRoute: '/storage',
      matchObject: 'sr-demo-uuid-1',
      matchSeverity: 'warning',
      matchText: 'storage',
      textMatchMode: 'phrase',
      autoAcknowledge: false,
      suppressionHours: 6,
      severityOverride: '',
      healthAction: 'capacity',
      notes: 'Route recurring storage warnings into the capacity workspace before escalating.',
      updatedAt: '2026-08-22T09:15:00.000Z',
    },
  ],
  lifecyclePlans: [
    {
      hostRef: 'OpaqueRef:host-demo-1',
      baselineStatus: 'drifted',
      targetStage: 'remediate',
      maintenanceWindow: 'Fri 23:00',
      patchGroup: 'Production Ring A',
      owner: 'Platform Ops',
      nextAction: 'patch',
      rebootRequired: true,
      evacuationRequired: true,
      dueDate: '2026-08-22',
      notes: 'Apply the August host baseline and validate microcode alignment before returning workload placement.',
      updatedAt: '2026-08-19T15:06:00.000Z',
    },
  ],
  governancePolicy: {
    defaultRole: 'admin',
    requireDestructiveApproval: true,
    approvalTtlMinutes: 240,
  },
  governanceQuotas: [
    {
      poolRef: 'OpaqueRef:pool-demo-1',
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 8,
      maxRunningVmCount: 6,
      maxTotalMemoryGiB: 48,
      notes: 'Production pool budget for the current August 2026 service envelope.',
      updatedAt: '2026-08-21T08:30:00.000Z',
    },
  ],
  governanceApprovals: [
    {
      id: 'approval-demo-1',
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm-demo-3',
      entityName: 'analytics-web-01',
      requestedBy: 'demo',
      justification: 'Allow a controlled shutdown during the Friday, August 21, 2026 staging maintenance window.',
      route: '/vms',
      status: 'approved',
      requestedAt: '2026-08-21T09:10:00.000Z',
      expiresAt: '2026-08-21T13:10:00.000Z',
      decidedBy: 'demo',
      decidedAt: '2026-08-21T09:18:00.000Z',
      decisionNotes: 'Approved for the staging maintenance window.',
      usedBy: '',
      usedAt: '',
    },
  ],
  users: [
    {
      id: 1,
      username: 'demo',
      display_name: 'Demo Operator',
      email: 'demo@xenmange.local',
      role: 'admin',
      active: true,
      created_at: '2026-08-20T08:00:00.000Z',
      last_login_at: '2026-08-24T08:05:00.000Z',
    },
    {
      id: 2,
      username: 'readonly-analyst',
      display_name: 'Read Only Analyst',
      email: 'analyst@xenmange.local',
      role: 'read-only',
      active: true,
      created_at: '2026-08-21T09:00:00.000Z',
      last_login_at: '2026-08-23T16:15:00.000Z',
    },
    {
      id: 3,
      username: 'ops-engineer',
      display_name: 'Operations Engineer',
      email: 'ops@xenmange.local',
      role: 'operator',
      active: true,
      created_at: '2026-08-22T10:00:00.000Z',
      last_login_at: '2026-08-24T07:45:00.000Z',
    },
  ],
  groups: [
    {
      id: 1,
      name: 'Platform Operations',
      created_at: '2026-08-20T08:15:00.000Z',
      memberUserIds: [1, 3],
    },
    {
      id: 2,
      name: 'Reporting',
      created_at: '2026-08-21T09:10:00.000Z',
      memberUserIds: [2],
    },
  ],
  resilienceRunbooks: [
    {
      poolRef: 'OpaqueRef:pool-demo-1',
      recoveryTier: 'tier-1',
      haPolicy: 'auto-failover',
      restartPriority: 'high',
      backupWindowHours: 12,
      rpoMinutes: 30,
      rtoMinutes: 90,
      restorePointStatus: 'review',
      owner: 'Platform Ops',
      standbyHostRef: 'OpaqueRef:host-demo-2',
      failoverNetworkRef: 'OpaqueRef:net-demo-2',
      lastVerifiedAt: '2026-08-20T14:25:00.000Z',
      runbookSteps: [
        'Confirm the latest backup chain for production workloads.',
        'Evacuate priority workloads to xen-host-a02 before maintenance or failover.',
        'Validate storage paths and replication network reachability.',
        'Run an application restore verification and record findings.',
      ],
      notes: 'Keep the storage replication VLAN clear during recovery windows and validate DNS dependencies before application cutover.',
      updatedAt: '2026-08-20T14:25:00.000Z',
    },
  ],
  resilienceDrills: [
    {
      id: 'drill-demo-1',
      poolRef: 'OpaqueRef:pool-demo-1',
      drillType: 'restore',
      status: 'warning',
      scope: 'Billing application recovery rehearsal',
      executedAt: '2026-08-20T09:35:00.000Z',
      durationMinutes: 52,
      summary: 'Restore path validated but boot sequencing still needs tuning.',
      findings: 'Database dependency ordering added 11 minutes to the recovery window.',
      nextStep: 'Update the runbook with explicit startup ordering and repeat the drill before the August 28, 2026 change window.',
      operator: 'demo',
      createdAt: '2026-08-20T09:40:00.000Z',
    },
  ],
  auditLog: [
    {
      id: 'audit-demo-1',
      category: 'session',
      action: 'session_login',
      actionLabel: 'Logged into Xen host',
      entityType: 'session',
      entityRef: '10.42.0.11',
      entityName: '10.42.0.11',
      operator: 'demo',
      route: '/login',
      status: 'success',
      before: null,
      after: { host: '10.42.0.11', username: 'demo' },
      changedFields: [],
      summary: 'Logged into Xen host 10.42.0.11',
      detail: 'Authenticated to 10.42.0.11 as demo.',
      happenedAt: '2026-08-20T08:10:00.000Z',
    },
    {
      id: 'audit-demo-2',
      category: 'templates',
      action: 'template_governance_saved',
      actionLabel: 'Saved template governance for',
      entityType: 'template',
      entityRef: 'OpaqueRef:template-demo-2',
      entityName: '2026.08-hardened',
      operator: 'demo',
      route: '/templates',
      status: 'success',
      before: { lifecycleStage: 'draft', validationStatus: 'untested' },
      after: { lifecycleStage: 'staged', validationStatus: 'review' },
      changedFields: [
        { field: 'lifecycleStage', before: 'draft', after: 'staged' },
        { field: 'validationStatus', before: 'untested', after: 'review' },
      ],
      summary: 'Saved template governance for 2026.08-hardened',
      detail: 'staged stage with review validation status.',
      happenedAt: '2026-08-20T08:42:00.000Z',
    },
    {
      id: 'audit-demo-3',
      category: 'lifecycle',
      action: 'lifecycle_plan_saved',
      actionLabel: 'Saved lifecycle plan for',
      entityType: 'host',
      entityRef: 'OpaqueRef:host-demo-1',
      entityName: 'OpaqueRef:host-demo-1',
      operator: 'demo',
      route: '/lifecycle',
      status: 'success',
      before: { targetStage: 'review', baselineStatus: 'unknown' },
      after: { targetStage: 'remediate', baselineStatus: 'drifted' },
      changedFields: [
        { field: 'targetStage', before: 'review', after: 'remediate' },
        { field: 'baselineStatus', before: 'unknown', after: 'drifted' },
      ],
      summary: 'Saved lifecycle plan for OpaqueRef:host-demo-1',
      detail: 'remediate stage with drifted baseline status.',
      happenedAt: '2026-08-20T09:05:00.000Z',
    },
  ],
  templateGovernance: [
    {
      templateRef: 'OpaqueRef:template-demo-1',
      versionLabel: '2026.08-lts',
      profileLabel: 'Secure Linux',
      lifecycleStage: 'stable',
      goldenImage: true,
      guestCustomization: 'cloud-init baseline',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-19T00:00:00.000Z',
      owner: 'Platform Ops',
      notes: 'Validated against the August Linux baseline and approved for production service rollout.',
      updatedAt: '2026-08-19T15:10:00.000Z',
    },
    {
      templateRef: 'OpaqueRef:template-demo-2',
      versionLabel: '2026.08-hardened',
      profileLabel: 'Secure Windows',
      lifecycleStage: 'staged',
      goldenImage: true,
      guestCustomization: 'sysprep-core',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-18T00:00:00.000Z',
      owner: 'Windows Platform',
      notes: 'Awaiting final domain-join and monitoring agent validation before promotion.',
      updatedAt: '2026-08-19T14:20:00.000Z',
    },
  ],
  templateGovernanceHistory: [
    {
      id: 'tmplhist-demo-1',
      templateRef: 'OpaqueRef:template-demo-1',
      templateName: 'ubuntu-24-golden',
      eventType: 'saved',
      actor: 'demo',
      happenedAt: '2026-08-19T15:10:00.000Z',
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: '2026.08-lts governance saved after production baseline review.',
      snapshot: {
        templateRef: 'OpaqueRef:template-demo-1',
        versionLabel: '2026.08-lts',
        profileLabel: 'Secure Linux',
        lifecycleStage: 'stable',
        goldenImage: true,
        guestCustomization: 'cloud-init baseline',
        validationStatus: 'validated',
        lastValidatedAt: '2026-08-19T00:00:00.000Z',
        owner: 'Platform Ops',
        notes: 'Validated against the August Linux baseline and approved for production service rollout.',
        updatedAt: '2026-08-19T15:10:00.000Z',
      },
    },
    {
      id: 'tmplhist-demo-2',
      templateRef: 'OpaqueRef:template-demo-2',
      templateName: 'windows-2025-core',
      eventType: 'saved',
      actor: 'demo',
      happenedAt: '2026-08-19T14:20:00.000Z',
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: '2026.08-hardened governance saved pending promotion review.',
      snapshot: {
        templateRef: 'OpaqueRef:template-demo-2',
        versionLabel: '2026.08-hardened',
        profileLabel: 'Secure Windows',
        lifecycleStage: 'staged',
        goldenImage: true,
        guestCustomization: 'sysprep-core',
        validationStatus: 'validated',
        lastValidatedAt: '2026-08-18T00:00:00.000Z',
        owner: 'Windows Platform',
        notes: 'Awaiting final domain-join and monitoring agent validation before promotion.',
        updatedAt: '2026-08-19T14:20:00.000Z',
      },
    },
  ],
  templateDeployments: [
    {
      id: 'tmpldep-demo-1',
      templateRef: 'OpaqueRef:template-demo-1',
      templateName: 'ubuntu-24-golden',
      templateVersion: '2026.08-lts',
      vmRef: 'OpaqueRef:vm-demo-1',
      vmName: 'billing-api-01',
      hostRef: 'OpaqueRef:host-demo-1',
      hostLabel: 'xen-host-a01',
      storageRef: 'OpaqueRef:sr-demo-1',
      storageLabel: 'Tier-1 SSD SR',
      networkRef: 'OpaqueRef:net-demo-1',
      networkLabel: 'VMLAN Production',
      startAfter: true,
      submittedBy: 'demo',
      submittedAt: '2026-08-19T12:40:00.000Z',
      validationStatus: 'validated',
      validationNotes: 'Guest boot, management address, and baseline tagging were confirmed.',
      guestCustomization: 'cloud-init baseline',
      bootVerified: true,
      networkVerified: true,
      storageVerified: true,
      policyTagged: true,
      updatedAt: '2026-08-19T13:05:00.000Z',
    },
  ],
};

const DEMO_RANGE_TO_MS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const DEMO_RANGE_POINTS = {
  '1h': 6,
  '6h': 8,
  '24h': 12,
  '7d': 10,
  '30d': 12,
};

function normalizeDemoMetricRange(range = '24h') {
  return DEMO_RANGE_TO_MS[range] ? range : '24h';
}

function demoMetricPercent(numerator, denominator) {
  const top = Number(numerator || 0);
  const bottom = Number(denominator || 0);
  if (!bottom) return 0;
  return Math.max(0, Math.min(100, (top / bottom) * 100));
}

function metricSeed(value = '') {
  return String(value || '')
    .split('')
    .reduce((sum, character, index) => sum + (character.charCodeAt(0) * (index + 1)), 0);
}

function buildDemoTrendPoints(range, latestValue, options = {}) {
  const normalizedRange = normalizeDemoMetricRange(range);
  const pointCount = DEMO_RANGE_POINTS[normalizedRange] || 8;
  const totalMs = DEMO_RANGE_TO_MS[normalizedRange];
  const stepMs = Math.round(totalMs / Math.max(1, pointCount - 1));
  const now = Date.now();
  const amplitude = Number(options.amplitude ?? Math.max(1, Number(latestValue || 0) * 0.08));
  const floor = Number(options.floor ?? 0);
  const ceiling = Number(options.ceiling ?? Number.MAX_SAFE_INTEGER);
  const seed = metricSeed(options.seed || latestValue);

  return Array.from({ length: pointCount }, (_, index) => {
    const wave = Math.sin((index + 1) * 0.85 + seed / 25) * amplitude;
    const drift = (index - (pointCount / 2)) * (amplitude / Math.max(pointCount, 1)) * 0.18;
    const value = Math.max(floor, Math.min(ceiling, Number(latestValue || 0) + wave + drift));

    return {
      ts: now - ((pointCount - index - 1) * stepMs),
      value: Math.round(value * 100) / 100,
    };
  });
}

function buildDemoClusterMetrics(range = '24h') {
  const normalizedRange = normalizeDemoMetricRange(range);
  const totalMemory = demoDb.hosts.reduce((sum, host) => sum + Number(demoDb.hostMetrics[host.ref]?.memory_total || 0), 0);
  const freeMemory = demoDb.hosts.reduce((sum, host) => sum + Number(demoDb.hostMetrics[host.ref]?.memory_free || 0), 0);
  const usedMemory = Math.max(0, totalMemory - freeMemory);
  const totalStorage = demoDb.srs.reduce((sum, sr) => sum + Number(sr.physical_size || 0), 0);
  const usedStorage = demoDb.srs.reduce((sum, sr) => sum + Number(sr.virtual_allocation || 0), 0);
  const vmMemory = demoDb.vms
    .filter((vm) => !vm.is_a_template)
    .reduce((sum, vm) => sum + Number(vm.memory_static_max || 0), 0);

  return {
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    metrics: [
      {
        metricName: 'cluster_memory_used_percent',
        points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(usedMemory, totalMemory), {
          amplitude: 6,
          floor: 20,
          ceiling: 98,
          seed: 'cluster-memory',
        }),
      },
      {
        metricName: 'cluster_storage_utilization_percent',
        points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(usedStorage, totalStorage), {
          amplitude: 4,
          floor: 15,
          ceiling: 98,
          seed: 'cluster-storage',
        }),
      },
      {
        metricName: 'cluster_vm_memory_actual_bytes',
        points: buildDemoTrendPoints(normalizedRange, vmMemory * 0.82, {
          amplitude: vmMemory * 0.06,
          floor: 0,
          seed: 'cluster-vm-memory',
        }),
      },
    ],
  };
}

function buildDemoHostMetricHistory(ref, range = '24h') {
  const normalizedRange = normalizeDemoMetricRange(range);
  const metrics = demoDb.hostMetrics[ref] || { memory_total: 0, memory_free: 0 };
  const total = Number(metrics.memory_total || 0);
  const free = Number(metrics.memory_free || 0);
  const used = Math.max(0, total - free);

  return {
    entityType: 'host',
    entityRef: ref,
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    metrics: [
      { metricName: 'memory_total_bytes', points: buildDemoTrendPoints(normalizedRange, total, { amplitude: 0, floor: 0, seed: `${ref}-total` }) },
      { metricName: 'memory_free_bytes', points: buildDemoTrendPoints(normalizedRange, free, { amplitude: Math.max(1, total * 0.05), floor: 0, ceiling: total, seed: `${ref}-free` }) },
      { metricName: 'memory_used_bytes', points: buildDemoTrendPoints(normalizedRange, used, { amplitude: Math.max(1, total * 0.04), floor: 0, ceiling: total, seed: `${ref}-used` }) },
      { metricName: 'memory_used_percent', points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(used, total), { amplitude: 6, floor: 0, ceiling: 100, seed: `${ref}-used-percent` }) },
    ],
  };
}

function buildDemoVmMetricHistory(ref, range = '24h') {
  const normalizedRange = normalizeDemoMetricRange(range);
  const vm = demoDb.vms.find((entry) => entry.ref === ref) || {};
  const configured = Number(vm.memory_static_max || vm.memory_dynamic_max || 0);
  const actual = vm.power_state === 'Halted' ? configured * 0.08 : vm.power_state === 'Suspended' ? configured * 0.24 : configured * 0.78;

  return {
    entityType: 'vm',
    entityRef: ref,
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    metrics: [
      { metricName: 'memory_actual_bytes', points: buildDemoTrendPoints(normalizedRange, actual, { amplitude: Math.max(1, configured * 0.09), floor: 0, ceiling: configured, seed: `${ref}-actual` }) },
      { metricName: 'memory_static_max_bytes', points: buildDemoTrendPoints(normalizedRange, configured, { amplitude: 0, floor: 0, seed: `${ref}-static` }) },
      { metricName: 'memory_usage_percent', points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(actual, configured), { amplitude: 8, floor: 0, ceiling: 100, seed: `${ref}-usage` }) },
      { metricName: 'vcpu_count', points: buildDemoTrendPoints(normalizedRange, Number(vm.VCPUs_at_startup || 0), { amplitude: 0, floor: 0, seed: `${ref}-vcpu` }) },
    ],
  };
}

function buildDemoStorageMetricHistory(ref, range = '24h') {
  const normalizedRange = normalizeDemoMetricRange(range);
  const sr = demoDb.srs.find((entry) => entry.ref === ref) || {};
  const allocation = Number(sr.virtual_allocation || 0);
  const physical = Number(sr.physical_size || 0);

  return {
    entityType: 'sr',
    entityRef: ref,
    range: normalizedRange,
    generatedAt: new Date().toISOString(),
    metrics: [
      { metricName: 'allocation_bytes', points: buildDemoTrendPoints(normalizedRange, allocation, { amplitude: Math.max(1, physical * 0.03), floor: 0, ceiling: physical, seed: `${ref}-allocation` }) },
      { metricName: 'physical_bytes', points: buildDemoTrendPoints(normalizedRange, physical, { amplitude: 0, floor: 0, seed: `${ref}-physical` }) },
      { metricName: 'utilization_percent', points: buildDemoTrendPoints(normalizedRange, demoMetricPercent(allocation, physical), { amplitude: 4, floor: 0, ceiling: 100, seed: `${ref}-utilization` }) },
    ],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextDemoId(collection) {
  return collection.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
}

let demoOpaqueCounter = 100;

function nextDemoOpaqueRef(prefix) {
  demoOpaqueCounter += 1;
  return `OpaqueRef:${prefix}-demo-${demoOpaqueCounter}`;
}

function getDemoChangedFields(before = null, after = null) {
  const left = before && typeof before === 'object' ? before : {};
  const right = after && typeof after === 'object' ? after : {};
  const fields = new Set([...Object.keys(left), ...Object.keys(right)]);

  return [...fields]
    .filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]))
    .slice(0, 12)
    .map((field) => ({
      field,
      before: left[field] === undefined || left[field] === null || left[field] === '' ? '-' : String(left[field]),
      after: right[field] === undefined || right[field] === null || right[field] === '' ? '-' : String(right[field]),
    }));
}

function recordDemoAudit(entry = {}) {
  const before = entry.before ? clone(entry.before) : null;
  const after = entry.after ? clone(entry.after) : null;
  const changedFields = Array.isArray(entry.changedFields) ? clone(entry.changedFields) : getDemoChangedFields(before, after);
  const record = {
    id: entry.id || `audit-${Date.now()}`,
    category: entry.category || 'operations',
    action: entry.action || 'update',
    actionLabel: entry.actionLabel || '',
    entityType: entry.entityType || 'record',
    entityRef: entry.entityRef || '',
    entityName: entry.entityName || '',
    operator: entry.operator || store.username || 'demo',
    route: entry.route || '',
    status: entry.status || 'success',
    before,
    after,
    changedFields,
    summary: entry.summary || `${entry.actionLabel || entry.action || 'Updated'} ${entry.entityName || entry.entityRef || ''}`.trim(),
    detail: entry.detail || '',
    happenedAt: entry.happenedAt || new Date().toISOString(),
  };

  demoDb.auditLog.unshift(record);
  demoDb.auditLog = demoDb.auditLog.slice(0, 200);
  return record;
}

function buildDemoLogEntries() {
  const auditEntries = demoDb.auditLog.map((entry) => ({
    id: `audit:${entry.id}`,
    source: 'audit',
    category: entry.category || 'operations',
    timestamp: entry.happenedAt || '',
    actor: entry.operator || 'demo',
    operator: entry.operator || 'demo',
    entityType: entry.entityType || 'record',
    entityRef: entry.entityRef || '',
    entityName: entry.entityName || '',
    message: entry.summary || entry.detail || entry.actionLabel || entry.action || 'Audit entry',
    detail: entry.detail || '',
    severity: String(entry.status || 'success').toLowerCase(),
    route: entry.route || '',
    status: entry.status || 'success',
    action: entry.action || '',
    raw: clone(entry),
  }));

  const alertEntries = listDemoAlerts().map((entry) => ({
    id: `alert:${entry.ref}`,
    source: 'alert',
    category: 'alerts',
    timestamp: entry.timestamp || '',
    actor: entry.acknowledgedBy || entry.policyName || 'demo',
    operator: entry.acknowledgedBy || entry.policyName || 'demo',
    entityType: 'alert',
    entityRef: entry.ref || '',
    entityName: entry.summary || entry.ref || '',
    message: entry.summary || entry.name || entry.body || 'Alert',
    detail: entry.body || entry.notes || '',
    severity: String(entry.effectiveSeverity || entry.baseSeverity || 'notice').toLowerCase(),
    route: entry.targetRoute || '/alerts',
    status: entry.stateLabel || 'open',
    action: entry.healthAction || '',
    raw: clone(entry),
  }));

  const remediationEntries = demoDb.remediationTasks.map((entry) => ({
    id: `remediation-task:${entry.ref}`,
    source: 'remediation-task',
    category: 'tasks',
    timestamp: entry.finished || entry.updated_at || entry.created || '',
    actor: entry.created_by || entry.assignee || 'demo',
    operator: entry.created_by || entry.assignee || 'demo',
    entityType: 'task',
    entityRef: entry.ref || '',
    entityName: entry.name_label || '',
    message: entry.name_label || 'Remediation task',
    detail: entry.result || entry.name_description || '',
    severity: String(entry.status || 'pending').toLowerCase(),
    route: '/activity',
    status: entry.status || 'pending',
    action: entry.action_type || '',
    raw: clone(entry),
  }));

  const xenTaskEntries = demoDb.tasks.map((entry) => ({
    id: `xen-task:${entry.ref}`,
    source: 'xen-task',
    category: 'tasks',
    timestamp: entry.finished || entry.created || '',
    actor: 'xenserver',
    operator: 'xenserver',
    entityType: 'task',
    entityRef: entry.ref || '',
    entityName: entry.name_label || '',
    message: entry.name_label || 'Xen task',
    detail: entry.result || (Array.isArray(entry.error_info) ? entry.error_info.join(' | ') : ''),
    severity: String(entry.status || 'pending').toLowerCase(),
    route: '/activity',
    status: entry.status || 'pending',
    action: entry.name_label || '',
    raw: clone(entry),
  }));

  return [...auditEntries, ...alertEntries, ...remediationEntries, ...xenTaskEntries]
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

function getDemoGovernanceState() {
  return {
    currentRole: store.governance?.currentRole || demoDb.governancePolicy.defaultRole || 'admin',
    policy: clone(demoDb.governancePolicy),
  };
}

function listDemoGovernanceApprovals() {
  return clone([...demoDb.governanceApprovals].sort((left, right) => new Date(right.requestedAt || 0) - new Date(left.requestedAt || 0)));
}

function listDemoGroups() {
  return clone(
    [...demoDb.groups]
      .map((group) => {
        const memberUserIds = [...new Set((group.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean))];
        const members = memberUserIds
          .map((userId) => demoDb.users.find((user) => Number(user.id) === Number(userId)))
          .filter(Boolean);

        return {
          id: Number(group.id),
          name: group.name || '',
          created_at: group.created_at || '',
          member_count: members.length,
          member_ids: members.map((user) => user.id),
          members: members.map((user) => user.display_name || user.username),
        };
      })
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
  );
}

function applyDemoUserGroupMembership(userId, groupIds = []) {
  const normalizedUserId = Number(userId || 0);
  const normalizedGroupIds = [...new Set((Array.isArray(groupIds) ? groupIds : []).map((value) => Number(value || 0)).filter(Boolean))];
  demoDb.groups.forEach((group) => {
    const memberUserIds = new Set((group.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean));
    memberUserIds.delete(normalizedUserId);
    if (normalizedGroupIds.includes(Number(group.id))) {
      memberUserIds.add(normalizedUserId);
    }
    group.memberUserIds = [...memberUserIds];
  });
}

function listDemoUsers() {
  const groups = listDemoGroups();
  return clone(
    [...demoDb.users]
      .map((user) => {
        const memberships = groups.filter((group) => group.member_ids.includes(Number(user.id)));
        return {
          ...user,
          groups: memberships.map((group) => group.name),
          groupsDetailed: memberships.map((group) => ({ id: group.id, name: group.name })),
          group_ids: memberships.map((group) => group.id),
          group_count: memberships.length,
        };
      })
      .sort((left, right) => String(left.username || '').localeCompare(String(right.username || '')))
  );
}

function getDemoUserSummary() {
  return {
    totalUsers: demoDb.users.length,
    activeUsers: demoDb.users.filter((user) => user.active !== false).length,
    activeAdmins: demoDb.users.filter((user) => user.active !== false && user.role === 'admin').length,
    totalGroups: demoDb.groups.length,
  };
}

function getDemoActor() {
  return {
    userId: Number(store.user?.id || 0) || null,
    role: store.user?.role || store.governance?.currentRole || 'admin',
  };
}

function normalizeDemoVisibility(value, fallback = 'private') {
  return value === 'shared' || value === 'private' ? value : fallback;
}

function demoActorIsAdmin(actor = getDemoActor()) {
  return actor.role === 'admin';
}

function demoRecordIsVisible(record, actor = getDemoActor()) {
  if (!record) return false;
  if (demoActorIsAdmin(actor)) return true;

  const ownerUserId = Number(record.owner_user_id || record.ownerUserId || 0) || null;
  const visibility = normalizeDemoVisibility(record.visibility, ownerUserId ? 'private' : 'shared');

  if (visibility === 'shared' || ownerUserId === null) {
    return true;
  }

  return ownerUserId === actor.userId;
}

function demoCanManageRecord(record, actor = getDemoActor()) {
  if (!record) return false;
  if (demoActorIsAdmin(actor)) return true;

  const ownerUserId = Number(record.owner_user_id || record.ownerUserId || 0) || null;
  const visibility = normalizeDemoVisibility(record.visibility, ownerUserId ? 'private' : 'shared');

  if (ownerUserId !== null) {
    return ownerUserId === actor.userId;
  }

  return visibility === 'shared';
}

function enrichDemoOwnedRecord(record, actor = getDemoActor()) {
  if (!record) return null;
  const ownerUserId = Number(record.owner_user_id || record.ownerUserId || 0) || null;
  const owner = demoDb.users.find((entry) => Number(entry.id) === ownerUserId) || null;
  const visibility = normalizeDemoVisibility(record.visibility, ownerUserId ? 'private' : 'shared');

  return {
    ...clone(record),
    owner_user_id: ownerUserId,
    ownerUserId,
    visibility,
    owner_username: owner?.username || '',
    owner_display_name: owner?.display_name || owner?.username || '',
    is_owner: ownerUserId !== null && ownerUserId === actor.userId,
    can_manage: demoCanManageRecord(record, actor),
  };
}

function listDemoConnections() {
  const actor = getDemoActor();
  return demoDb.connections
    .filter((record) => demoRecordIsVisible(record, actor))
    .map((record) => enrichDemoOwnedRecord(record, actor))
    .sort((left, right) => Number(right.is_default || 0) - Number(left.is_default || 0) || String(left.name || '').localeCompare(String(right.name || '')));
}

function listDemoHostTargets() {
  const actor = getDemoActor();
  return demoDb.hostTargets
    .filter((record) => demoRecordIsVisible(record, actor))
    .map((record) => enrichDemoOwnedRecord(record, actor))
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
}

function listDemoInventoryWorkspaces() {
  const actor = getDemoActor();
  return demoDb.inventoryWorkspaces
    .filter((record) => demoRecordIsVisible(record, actor))
    .map((record) => enrichDemoOwnedRecord(record, actor))
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
}

function buildDemoQuotaRows() {
  return demoDb.pools.map((pool) => {
    const quota = demoDb.governanceQuotas.find((record) => record.poolRef === pool.ref) || null;
    const poolHosts = demoDb.hosts.filter((host) => host.pool === pool.ref);
    const hostRefs = new Set(poolHosts.map((host) => host.ref));
    const poolVms = demoDb.vms.filter((vm) => !vm.is_a_template && (hostRefs.has(vm.resident_on) || hostRefs.has(vm.affinity)));
    const currentRunningVmCount = poolVms.filter((vm) => String(vm.power_state || '').toLowerCase() === 'running').length;
    const currentTotalMemoryGiB = Math.round((poolVms.reduce((sum, vm) => sum + Number(vm.memory_static_max || vm.memory_dynamic_max || 0), 0) / (1024 ** 3)) * 10) / 10;
    const breaches = [];

    if (quota?.enabled) {
      if (quota.maxVmCount > 0 && poolVms.length > quota.maxVmCount) breaches.push('VM count');
      if (quota.maxRunningVmCount > 0 && currentRunningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
      if (quota.maxTotalMemoryGiB > 0 && currentTotalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');
    }

    return {
      poolRef: pool.ref,
      poolName: pool.name_label || pool.ref,
      status: breaches.length ? 'critical' : quota?.enabled ? 'info' : 'success',
      currentVmCount: poolVms.length,
      currentRunningVmCount,
      currentTotalMemoryGiB,
      quota: quota ? clone(quota) : null,
      detail: breaches.length
        ? `Quota pressure is present for ${breaches.join(', ')}.`
        : quota?.enabled
          ? 'Quota is configured and current usage remains within the allowed envelope.'
          : 'No pool quota is currently enforced for this pool.',
    };
  });
}

function ensureDemoMutationAllowed(options = {}) {
  const governance = getDemoGovernanceState();

  if (governance.currentRole === 'read-only') {
    const error = new Error('The current governance role is read-only. Switch to operator or admin mode before making changes.');
    error.code = 'READ_ONLY_MODE';
    throw error;
  }

  if (options.destructive && governance.currentRole !== 'admin' && governance.policy.requireDestructiveApproval) {
    const approvalId = options.approvalId || '';
    if (!approvalId) {
      const error = new Error('A governance approval is required before this destructive action can run in operator mode.');
      error.code = 'APPROVAL_REQUIRED';
      throw error;
    }

    const index = demoDb.governanceApprovals.findIndex((approval) => approval.id === approvalId);
    const approval = index === -1 ? null : demoDb.governanceApprovals[index];
    if (!approval || approval.status !== 'approved' || approval.actionKey !== options.actionKey || approval.entityRef !== options.entityRef || approval.entityType !== options.entityType) {
      const error = new Error('The provided governance approval is missing, expired, already used, or scoped to a different action.');
      error.code = 'APPROVAL_SCOPE_MISMATCH';
      throw error;
    }

    demoDb.governanceApprovals[index] = {
      ...approval,
      status: 'used',
      usedBy: store.username || 'demo',
      usedAt: new Date().toISOString(),
    };
  }
}

function sortTasks(tasks) {
  return [...(tasks || [])].sort((left, right) =>
    new Date(right.finished || right.created || 0) - new Date(left.finished || left.created || 0)
  );
}

function buildDemoRemediationRecurrenceKey(payload = {}) {
  const scope = String(payload.recurrenceScope || payload.recurrence_scope || 'object').trim().toLowerCase();
  const alertRef = String(payload.alertRef || payload.related_alert_ref || '').trim().toLowerCase();
  const alertUuid = String(payload.alertUuid || payload.related_alert_uuid || '').trim().toLowerCase();
  const relatedObject = String(payload.relatedObject || payload.related_object || '').trim().toLowerCase();
  const relatedClass = String(payload.relatedClass || payload.related_class || '').trim().toLowerCase();
  const targetRoute = String(payload.targetRoute || payload.target_route || '').trim().toLowerCase();
  const summary = String(payload.alertSummary || payload.related_alert_summary || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160);
  const classSummaryKey = [relatedClass, targetRoute, summary].filter(Boolean).join('|');

  if (scope === 'alert') return alertRef || alertUuid || relatedObject || classSummaryKey;
  if (scope === 'class') return classSummaryKey || relatedObject || alertUuid || alertRef;
  return relatedObject || alertUuid || alertRef || classSummaryKey;
}

function demoNextEligibleAt(task = {}, recurrenceMode, cooldownDays) {
  const createdAt = new Date(task.created || task.updated_at || 0);
  if (Number.isNaN(createdAt.getTime())) return '';

  const next = new Date(createdAt);
  const mode = String(recurrenceMode || '').trim().toLowerCase();
  if (mode === 'daily') next.setDate(next.getDate() + 1);
  else if (mode === 'weekly') next.setDate(next.getDate() + 7);
  else if (mode === 'cooldown') next.setDate(next.getDate() + Math.max(1, Number(cooldownDays || 0)));
  else return '';

  return next.toISOString();
}

function normalizeDemoLifecyclePlanSeed(seed = {}, current = null) {
  const source = seed && typeof seed === 'object' ? seed : {};
  const fallback = current && typeof current === 'object' ? current : {};

  if (source.enabled === false && !fallback.enabled) return null;
  if (!source.enabled && !fallback.enabled && !Object.keys(source).length) return null;

  return {
    enabled: source.enabled !== undefined ? Boolean(source.enabled) : Boolean(fallback.enabled),
    baselineStatus: String(source.baselineStatus || fallback.baselineStatus || 'unknown').trim().toLowerCase(),
    targetStage: String(source.targetStage || fallback.targetStage || 'review').trim().toLowerCase(),
    maintenanceWindow: String(source.maintenanceWindow || fallback.maintenanceWindow || '').trim(),
    patchGroup: String(source.patchGroup || fallback.patchGroup || '').trim(),
    owner: String(source.owner || fallback.owner || '').trim(),
    nextAction: String(source.nextAction || fallback.nextAction || 'scan').trim().toLowerCase(),
    rebootRequired: source.rebootRequired !== undefined ? Boolean(source.rebootRequired) : Boolean(fallback.rebootRequired),
    evacuationRequired: source.evacuationRequired !== undefined ? Boolean(source.evacuationRequired) : Boolean(fallback.evacuationRequired),
    dueDays: Number(source.dueDays ?? fallback.dueDays ?? 0),
    dueDate: String(source.dueDate || fallback.dueDate || '').trim(),
    notes: String(source.notes || fallback.notes || '').trim(),
    sourceTaskRef: String(source.sourceTaskRef || fallback.sourceTaskRef || '').trim(),
    sourceTemplateId: String(source.sourceTemplateId || fallback.sourceTemplateId || '').trim(),
    sourceTemplateName: String(source.sourceTemplateName || fallback.sourceTemplateName || '').trim(),
  };
}

function normalizeDemoResilienceRunbookSeed(seed = {}, current = null) {
  const source = seed && typeof seed === 'object' ? seed : {};
  const fallback = current && typeof current === 'object' ? current : {};

  if (source.enabled === false && !fallback.enabled) return null;
  if (!source.enabled && !fallback.enabled && !Object.keys(source).length) return null;

  return {
    enabled: source.enabled !== undefined ? Boolean(source.enabled) : Boolean(fallback.enabled),
    recoveryTier: String(source.recoveryTier || fallback.recoveryTier || 'standard').trim().toLowerCase(),
    haPolicy: String(source.haPolicy || fallback.haPolicy || 'manual').trim().toLowerCase(),
    restartPriority: String(source.restartPriority || fallback.restartPriority || 'medium').trim().toLowerCase(),
    backupWindowHours: Number(source.backupWindowHours ?? fallback.backupWindowHours ?? 24),
    rpoMinutes: Number(source.rpoMinutes ?? fallback.rpoMinutes ?? 60),
    rtoMinutes: Number(source.rtoMinutes ?? fallback.rtoMinutes ?? 120),
    restorePointStatus: String(source.restorePointStatus || fallback.restorePointStatus || 'review').trim().toLowerCase(),
    owner: String(source.owner || fallback.owner || '').trim(),
    standbyHostRef: String(source.standbyHostRef || fallback.standbyHostRef || '').trim(),
    failoverNetworkRef: String(source.failoverNetworkRef || fallback.failoverNetworkRef || '').trim(),
    runbookSteps: Array.isArray(source.runbookSteps || fallback.runbookSteps)
      ? (source.runbookSteps || fallback.runbookSteps).map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    notes: String(source.notes || fallback.notes || '').trim(),
    sourceTaskRef: String(source.sourceTaskRef || fallback.sourceTaskRef || '').trim(),
    sourceTemplateId: String(source.sourceTemplateId || fallback.sourceTemplateId || '').trim(),
    sourceTemplateName: String(source.sourceTemplateName || fallback.sourceTemplateName || '').trim(),
  };
}

function buildDemoRemediationTask(payload = {}) {
  const now = new Date().toISOString();
  return {
    ref: nextDemoOpaqueRef('remediation'),
    uuid: `remediation-task-${Date.now()}`,
    name_label: String(payload.nameLabel || '').trim(),
    name_description: String(payload.nameDescription || '').trim(),
    status: 'pending',
    progress: 0,
    created: now,
    finished: '',
    result: 'Queued for operator follow-through.',
    error_info: [],
    resident_on: String(payload.relatedObject || '').trim(),
    task_kind: 'remediation',
    source: 'remediation',
    action_type: String(payload.actionType || 'review').trim().toLowerCase(),
    assignee: String(payload.assignee || '').trim(),
    due_date: String(payload.dueDate || '').trim(),
    related_alert_ref: String(payload.alertRef || '').trim(),
    related_alert_uuid: String(payload.alertUuid || '').trim(),
    related_alert_summary: String(payload.alertSummary || '').trim(),
    related_class: String(payload.relatedClass || '').trim().toLowerCase(),
    related_object: String(payload.relatedObject || '').trim(),
    target_route: String(payload.targetRoute || '').trim(),
    workspace_summary: String(payload.workspaceSummary || '').trim(),
    evidence_checklist: Array.isArray(payload.evidenceChecklist)
      ? payload.evidenceChecklist.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    completion_criteria: Array.isArray(payload.completionCriteria)
      ? payload.completionCriteria.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    template_id: String(payload.templateId || '').trim(),
    template_name: String(payload.templateName || '').trim(),
    template_launch_mode: String(payload.templateLaunchMode || 'draft').trim().toLowerCase(),
    recurrence_mode: String(payload.recurrenceMode || 'manual').trim().toLowerCase(),
    recurrence_scope: String(payload.recurrenceScope || 'object').trim().toLowerCase(),
    recurrence_cooldown_days: Number(payload.cooldownDays || 0),
    recurrence_window_key: buildDemoRemediationRecurrenceKey(payload),
    lifecycle_plan_seed: normalizeDemoLifecyclePlanSeed(payload.lifecyclePlanSeed, payload.lifecycle_plan_seed),
    resilience_runbook_seed: normalizeDemoResilienceRunbookSeed(payload.resilienceRunbookSeed, payload.resilience_runbook_seed),
    created_by: store.username || 'demo',
    updated_at: now,
  };
}

function buildDemoRemediationTemplate(payload = {}, current = {}) {
  return {
    id: current.id || payload.id || `remediation-template-${Date.now()}`,
    enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : Boolean(current.enabled ?? true),
    name: String(payload.name || current.name || '').trim(),
    matchClass: String(payload.matchClass || current.matchClass || '').trim().toLowerCase(),
    matchTargetRoute: String(payload.matchTargetRoute || current.matchTargetRoute || '').trim(),
    matchObject: String(payload.matchObject || current.matchObject || '').trim(),
    matchSeverity: String(payload.matchSeverity || current.matchSeverity || '').trim().toLowerCase(),
    matchText: String(payload.matchText || current.matchText || '').trim().toLowerCase(),
    textMatchMode: String(payload.textMatchMode || current.textMatchMode || 'phrase').trim().toLowerCase(),
    actionType: String(payload.actionType || current.actionType || 'review').trim().toLowerCase(),
    taskNameTemplate: String(payload.taskNameTemplate || current.taskNameTemplate || 'Review: {summary}').trim(),
    defaultAssignee: String(payload.defaultAssignee || current.defaultAssignee || '').trim(),
    defaultDueDays: Number(payload.defaultDueDays ?? current.defaultDueDays ?? 0),
    defaultTargetRoute: String(payload.defaultTargetRoute || current.defaultTargetRoute || '').trim(),
    defaultNotes: String(payload.defaultNotes || current.defaultNotes || '').trim(),
    workspaceSummaryTemplate: String(payload.workspaceSummaryTemplate || current.workspaceSummaryTemplate || '').trim(),
    evidenceChecklist: Array.isArray(payload.evidenceChecklist || current.evidenceChecklist)
      ? (payload.evidenceChecklist || current.evidenceChecklist).map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    completionCriteria: Array.isArray(payload.completionCriteria || current.completionCriteria)
      ? (payload.completionCriteria || current.completionCriteria).map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 8)
      : [],
    launchMode: String(payload.launchMode || current.launchMode || 'draft').trim().toLowerCase(),
    recurrenceMode: String(payload.recurrenceMode || current.recurrenceMode || 'manual').trim().toLowerCase(),
    recurrenceScope: String(payload.recurrenceScope || current.recurrenceScope || 'object').trim().toLowerCase(),
    cooldownDays: Number(payload.cooldownDays ?? current.cooldownDays ?? 0),
    lifecyclePlanSeed: normalizeDemoLifecyclePlanSeed(payload.lifecyclePlanSeed, current.lifecyclePlanSeed),
    resilienceRunbookSeed: normalizeDemoResilienceRunbookSeed(payload.resilienceRunbookSeed, current.resilienceRunbookSeed),
    updatedAt: payload.updatedAt || current.updatedAt || new Date().toISOString(),
  };
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
  const hostsByRef = Object.fromEntries(demoDb.hosts.map((host) => [host.ref, host]));
  const poolsByRef = Object.fromEntries(demoDb.pools.map((pool) => [pool.ref, pool]));
  const networksByRef = Object.fromEntries(demoDb.networks.map((network) => [network.ref, network]));
  const drillsByPool = demoDb.resilienceDrills.reduce((acc, drill) => {
    if (!acc[drill.poolRef]) acc[drill.poolRef] = [];
    acc[drill.poolRef].push(drill);
    return acc;
  }, {});
  const runbookByPool = Object.fromEntries(demoDb.resilienceRunbooks.map((runbook) => [runbook.poolRef, runbook]));

  const policies = demoDb.vms
    .filter((vm) => !vm.is_a_template)
    .map((vm) => {
      const host = hostsByRef[vm.resident_on] || hostsByRef[vm.affinity] || null;
      const poolRef = host?.pool || '';
      const pool = poolsByRef[poolRef] || null;
      const runbook = runbookByPool[poolRef] || null;
      const latestDrill = [...(drillsByPool[poolRef] || [])].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0))[0] || null;
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
      const backupWindowHours = Number(runbook?.backupWindowHours || (tier === 'Tier-1' ? 12 : 24));
      const lastProtectedAt = lastSuccessTask?.finished || lastSuccessTask?.created || '';
      const backupAgeHours = lastProtectedAt
        ? Math.round(((Date.now() - new Date(lastProtectedAt).getTime()) / 3600000) * 10) / 10
        : null;
      const restorePointStatus = runbook?.restorePointStatus || (backupAgeHours === null ? 'missing' : backupAgeHours <= backupWindowHours ? 'current' : backupAgeHours <= backupWindowHours * 1.5 ? 'review' : 'stale');

      let status = 'info';
      let recommendation = 'Review protection coverage for this workload.';

      if (relatedMessages.some((message) => getMessageSeverity(message) === 'critical') || ['missing', 'stale'].includes(restorePointStatus)) {
        status = 'critical';
        recommendation = 'Protection drift or restore-point staleness is present. Investigate before relying on this VM for recovery.';
      } else if (restorePointStatus === 'review') {
        status = 'warning';
        recommendation = 'Backup coverage exists but the restore point needs validation before the next change window.';
      } else if (lastSuccessTask) {
        status = 'success';
        recommendation = 'Recent protection work completed successfully. Schedule routine restore verification.';
      } else if (tier === 'Tier-1' && (vm.power_state || '').toLowerCase() === 'running') {
        status = 'warning';
        recommendation = 'This production VM should be checked for a fresh backup or snapshot before the next change window.';
      }

      return {
        ref: vm.ref,
        poolRef,
        poolName: pool?.name_label || 'Unassigned Pool',
        name_label: vm.name_label,
        power_state: vm.power_state,
        policy: tier,
        recoveryTier: runbook?.recoveryTier || tier,
        status,
        hasRecentProtection: Boolean(lastSuccessTask),
        lastProtectedAt,
        backupAgeHours,
        backupWindowHours,
        restorePointStatus,
        restorePointLabel: restorePointStatus === 'current'
          ? `Within ${backupWindowHours}h target`
          : restorePointStatus === 'review'
            ? `Aged ${backupAgeHours ?? '-'}h`
            : restorePointStatus === 'stale'
              ? `Stale at ${backupAgeHours ?? '-'}h`
              : 'Missing restore point',
        haRestartPriority: runbook?.restartPriority || (tier === 'Tier-1' ? 'high' : tier === 'Edge' ? 'medium' : 'low'),
        lastTaskLabel: lastSuccessTask?.name_label || relatedTasks[0]?.name_label || 'No recent protection task',
        lastAlertLabel: relatedMessages[0]?.name || 'No resilience alerts',
        recommendation,
        tags: vm.tags || [],
        uuid: vm.uuid,
        lastDrillAt: latestDrill?.executedAt || '',
        lastDrillStatus: latestDrill?.status || '',
        runbookOwner: runbook?.owner || '',
      };
    });

  const hostPlans = demoDb.hosts.map((host) => {
    const runbook = runbookByPool[host.pool] || null;
    const latestDrill = [...(drillsByPool[host.pool] || [])].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0))[0] || null;
    const evacuationTarget = demoDb.hosts.find((candidate) => candidate.ref !== host.ref && candidate.enabled && candidate.pool === host.pool)
      || demoDb.hosts.find((candidate) => candidate.ref !== host.ref && candidate.enabled);
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
    } else if (!runbook || !latestDrill) {
      status = 'warning';
      summary = 'Runbook coverage or recent drill evidence is missing for this host pool.';
    }

    return {
      ref: host.ref,
      poolRef: host.pool || '',
      poolName: poolsByRef[host.pool]?.name_label || 'Standalone Host',
      name_label: host.name_label,
      address: host.address,
      status,
      evacuationTarget: evacuationTarget?.name_label || 'No alternate host available',
      standbyHostRef: runbook?.standbyHostRef || '',
      residentVmCount: (host.resident_VMs || []).length,
      recentTask: taskText[0]?.name_label || 'No recent host resilience task',
      recentAlert: relatedMessages[0]?.name || 'No recent host alert',
      summary,
      haPolicy: runbook?.haPolicy || 'manual',
      restartPriority: runbook?.restartPriority || 'medium',
      lastDrillAt: latestDrill?.executedAt || '',
      lastDrillStatus: latestDrill?.status || '',
      maintenanceWindow: host?.other_config?.maintenance_window || 'No maintenance window',
      other_config: host.other_config || {},
      uuid: host.uuid,
    };
  });

  const recoveryPlans = demoDb.pools.map((pool) => {
    const runbook = runbookByPool[pool.ref] || null;
    const drills = [...(drillsByPool[pool.ref] || [])].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0));
    const latestDrill = drills[0] || null;
    const poolHosts = demoDb.hosts.filter((host) => host.pool === pool.ref);
    const poolPolicies = policies.filter((policy) => policy.poolRef === pool.ref);
    const enabledHostCount = poolHosts.filter((host) => host.enabled).length;
    const protectedVmCount = poolPolicies.filter((policy) => policy.hasRecentProtection).length;
    const atRiskVmCount = poolPolicies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length;
    const staleRestorePointCount = poolPolicies.filter((policy) => ['stale', 'missing'].includes(policy.restorePointStatus)).length;
    const reviewRestorePointCount = poolPolicies.filter((policy) => policy.restorePointStatus === 'review').length;
    let status = 'success';
    let nextAction = 'Continue periodic recovery drills and evacuation target validation.';

    if (!runbook) {
      status = 'warning';
      nextAction = 'Author a recovery runbook before relying on this pool for failover.';
    }
    if (enabledHostCount < 2) {
      status = 'warning';
      nextAction = 'Add more failover capacity or re-enable a standby host before relying on this pool for recovery.';
    }
    if (staleRestorePointCount > 0 || atRiskVmCount > protectedVmCount) {
      status = 'critical';
      nextAction = 'Prioritize backup verification and restore testing.';
    } else if (reviewRestorePointCount > 0 || !latestDrill) {
      status = 'warning';
      nextAction = latestDrill
        ? 'Recent restore evidence needs review. Schedule another drill and update the runbook.'
        : 'Log a restore or failover drill so recovery readiness is visible.';
    }

    return {
      ref: pool.ref,
      name_label: pool.name_label,
      status,
      enabledHostCount,
      protectedVmCount,
      atRiskVmCount,
      staleRestorePointCount,
      reviewRestorePointCount,
      nextAction,
      hasRunbook: Boolean(runbook),
      recoveryTier: runbook?.recoveryTier || 'standard',
      haPolicy: runbook?.haPolicy || 'manual',
      restartPriority: runbook?.restartPriority || 'medium',
      backupWindowHours: Number(runbook?.backupWindowHours || 24),
      rpoMinutes: Number(runbook?.rpoMinutes || 60),
      rtoMinutes: Number(runbook?.rtoMinutes || 120),
      restorePointStatus: staleRestorePointCount > 0 ? 'stale' : reviewRestorePointCount > 0 ? 'review' : 'current',
      owner: runbook?.owner || '',
      standbyHostRef: runbook?.standbyHostRef || '',
      standbyHostLabel: hostsByRef[runbook?.standbyHostRef]?.name_label || '',
      failoverNetworkRef: runbook?.failoverNetworkRef || '',
      failoverNetworkLabel: networksByRef[runbook?.failoverNetworkRef]?.name_label || '',
      lastVerifiedAt: runbook?.lastVerifiedAt || '',
      lastDrillAt: latestDrill?.executedAt || '',
      lastDrillStatus: latestDrill?.status || '',
      drillCount: drills.length,
      runbookSteps: runbook?.runbookSteps?.length ? runbook.runbookSteps : [
        `Confirm ${pool.name_label} backup currency and replication health.`,
        'Evacuate impacted workloads before maintenance or failover begins.',
        'Validate storage paths and failover network reachability.',
        'Execute a restore drill and capture operator notes.',
      ],
      notes: runbook?.notes || '',
      drills: drills.slice(0, 5),
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
    })), ...demoDb.resilienceDrills.map((drill) => ({
      type: 'drill',
      ref: drill.id,
      label: `${drill.drillType} drill`,
      status: drill.status,
      timestamp: drill.executedAt,
      detail: drill.summary,
    }))].sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0)).slice(0, 14);

  return {
    generatedAt: '2026-08-21T15:12:00.000Z',
    summary: {
      protectedVmCount: policies.filter((policy) => policy.hasRecentProtection).length,
      atRiskVmCount: policies.filter((policy) => ['critical', 'warning'].includes(policy.status)).length,
      maintenanceHostCount: hostPlans.filter((plan) => plan.status === 'disabled').length,
      recoveryPlanCount: recoveryPlans.length,
      recentEventCount: recentEvents.length,
      runbookCoverageCount: recoveryPlans.filter((plan) => plan.hasRunbook).length,
      staleRestorePointCount: policies.filter((policy) => ['stale', 'missing'].includes(policy.restorePointStatus)).length,
      overdueDrillCount: recoveryPlans.filter((plan) => !plan.lastDrillAt).length,
    },
    protectionPolicies: policies,
    hostPlans,
    recoveryPlans,
    recentEvents,
    runbooks: clone(demoDb.resilienceRunbooks),
    drills: clone([...demoDb.resilienceDrills].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0))),
  };
}

function mapDemoTargetRoute(cls = '') {
  const value = String(cls).toLowerCase();
  if (value === 'host') return '/hosts';
  if (value === 'sr' || value === 'vdi' || value === 'vbd') return '/storage';
  if (value === 'vm') return '/vms';
  if (value === 'pool') return '/pools';
  if (value === 'network' || value === 'vif' || value === 'pif') return '/networking';
  if (value === 'task') return '/activity';
  return '/inventory';
}

function mapDemoTargetLabel(cls = '') {
  const route = mapDemoTargetRoute(cls);
  if (route === '/hosts') return 'Host View';
  if (route === '/storage') return 'Storage View';
  if (route === '/vms') return 'VM View';
  if (route === '/pools') return 'Pool View';
  if (route === '/networking') return 'Network View';
  if (route === '/activity') return 'Activity View';
  return 'Inventory View';
}

function normalizeDemoAlertPolicy(policy = {}) {
  return {
    id: policy.id || `alert-policy-${Date.now()}`,
    enabled: policy.enabled !== false,
    name: String(policy.name || '').trim(),
    matchClass: String(policy.matchClass || '').trim().toLowerCase(),
    matchTargetRoute: String(policy.matchTargetRoute || '').trim(),
    matchObject: String(policy.matchObject || '').trim().toLowerCase(),
    matchSeverity: String(policy.matchSeverity || '').trim().toLowerCase(),
    matchText: String(policy.matchText || '').trim().toLowerCase(),
    textMatchMode: String(policy.textMatchMode || 'phrase').trim().toLowerCase() === 'all' ? 'all' : 'phrase',
    autoAcknowledge: Boolean(policy.autoAcknowledge),
    suppressionHours: Math.max(0, Number(policy.suppressionHours || 0)),
    severityOverride: String(policy.severityOverride || '').trim().toLowerCase(),
    healthAction: String(policy.healthAction || 'none').trim().toLowerCase(),
    notes: String(policy.notes || '').trim(),
    updatedAt: policy.updatedAt || new Date().toISOString(),
  };
}

function listDemoAlertPolicies() {
  return clone((demoDb.alertPolicies || [])
    .map((policy) => normalizeDemoAlertPolicy(policy))
    .sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)));
}

function matchesDemoAlertPolicy(message, policy, baseSeverity) {
  if (!policy?.enabled || !policy?.name) return false;
  if (policy.matchClass && policy.matchClass !== String(message?.cls || '').toLowerCase()) return false;
  if (policy.matchTargetRoute && policy.matchTargetRoute !== mapDemoTargetRoute(message?.cls)) return false;
  if (policy.matchSeverity && policy.matchSeverity !== baseSeverity) return false;

  if (policy.matchObject) {
    const identityHaystack = `${message?.ref || ''} ${message?.name || ''} ${message?.uuid || ''} ${message?.obj_uuid || ''}`.toLowerCase();
    if (!identityHaystack.includes(policy.matchObject)) return false;
  }

  if (policy.matchText) {
    const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.uuid || ''} ${message?.obj_uuid || ''}`.toLowerCase();
    if (policy.textMatchMode === 'all') {
      const terms = policy.matchText.split(/[\s,]+/).map((term) => term.trim()).filter(Boolean);
      if (!terms.length || !terms.every((term) => haystack.includes(term))) return false;
    } else if (!haystack.includes(policy.matchText)) {
      return false;
    }
  }

  return true;
}

function getBestDemoAlertPolicy(message, baseSeverity) {
  let bestPolicy = null;
  let bestScore = -1;

  for (const policy of listDemoAlertPolicies()) {
    if (!matchesDemoAlertPolicy(message, policy, baseSeverity)) continue;

    const score = [
      policy.matchClass ? 2 : 0,
      policy.matchTargetRoute ? 2 : 0,
      policy.matchSeverity ? 2 : 0,
      policy.matchObject ? 3 + policy.matchObject.length / 100 : 0,
      policy.matchText ? 3 + policy.matchText.length / 100 : 0,
    ].reduce((sum, value) => sum + value, 0);

    if (score > bestScore) {
      bestPolicy = policy;
      bestScore = score;
      continue;
    }

    if (score === bestScore && bestPolicy) {
      if (new Date(policy.updatedAt || 0) > new Date(bestPolicy.updatedAt || 0)) {
        bestPolicy = policy;
      }
    }
  }

  return bestPolicy;
}

function buildDemoAlert(message) {
  const baseSeverity = getMessageSeverity(message);
  const state = demoDb.alertStates[message.ref] || {};
  const hasManualState = Boolean(state.updatedAt);
  const policy = getBestDemoAlertPolicy(message, baseSeverity);
  const policyState = policy ? {
    acknowledged: Boolean(policy.autoAcknowledge),
    acknowledgedAt: policy.autoAcknowledge ? (message.timestamp || new Date().toISOString()) : '',
    acknowledgedBy: policy.autoAcknowledge ? `policy:${policy.name}` : '',
    suppressionUntil: policy.suppressionHours > 0
      ? new Date(new Date(message.timestamp || Date.now()).getTime() + policy.suppressionHours * 60 * 60 * 1000).toISOString()
      : '',
    severityOverride: policy.severityOverride || '',
    healthAction: policy.healthAction || 'none',
    notes: policy.notes || '',
    updatedAt: policy.updatedAt || '',
    policyId: policy.id,
    policyName: policy.name,
  } : null;
  const mergedState = hasManualState ? state : { ...(policyState || {}), ...state };
  const suppressionUntil = mergedState.suppressionUntil || '';
  const suppressed = suppressionUntil ? new Date(suppressionUntil).getTime() > Date.now() : false;

  return {
    ...clone(message),
    summary: getMessageHeadline(message),
    baseSeverity,
    effectiveSeverity: mergedState.severityOverride || baseSeverity,
    targetRoute: mapDemoTargetRoute(message.cls),
    targetLabel: mapDemoTargetLabel(message.cls),
    acknowledged: Boolean(mergedState.acknowledged),
    acknowledgedAt: mergedState.acknowledgedAt || '',
    acknowledgedBy: mergedState.acknowledgedBy || '',
    suppressionUntil,
    severityOverride: mergedState.severityOverride || '',
    healthAction: mergedState.healthAction || 'none',
    notes: mergedState.notes || '',
    updatedAt: mergedState.updatedAt || '',
    suppressed,
    stateLabel: suppressed ? 'suppressed' : mergedState.acknowledged ? 'acknowledged' : 'open',
    managedByPolicy: Boolean(policyState && !hasManualState),
    policyId: policyState?.policyId || '',
    policyName: policyState?.policyName || '',
  };
}

function resolveDemoInventoryLabel(collection, ref, fallback = '') {
  const record = (collection || []).find((item) => item.ref === ref);
  if (!record) return fallback || ref || '';
  return record.name_label || record.hostname || record.bridge || record.address || record.ref || fallback || '';
}

function demoRequest(method, url, body) {
  const parsedUrl = new URL(url, window.location.origin);
  const path = parsedUrl.pathname;
  const search = parsedUrl.searchParams.get('search');
  const range = parsedUrl.searchParams.get('range') || '24h';

  if (method === 'POST' && path === '/api/auth/logout') {
    return { success: true };
  }

  if (method === 'GET' && path === '/api/auth/status') {
    return {
      authenticated: true,
      host: store.host || 'Demo Fabric',
      username: store.username || 'demo',
      demoMode: true,
      governance: getDemoGovernanceState(),
    };
  }

  if (method === 'GET' && path === '/api/dashboard') {
    return buildDemoDashboard();
  }

  if (method === 'GET' && path === '/api/dashboard/messages') {
    return clone(demoDb.messages.map((message) => buildDemoAlert(message)));
  }

  if (method === 'GET' && path === '/api/alerts') {
    const alerts = demoDb.messages.map((message) => buildDemoAlert(message))
      .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
    return { total: alerts.length, data: clone(alerts) };
  }

  if (method === 'GET' && path === '/api/alerts/policies') {
    const policies = listDemoAlertPolicies();
    return { total: policies.length, data: clone(policies) };
  }

  if (method === 'PUT' && path.startsWith('/api/alerts/') && path.endsWith('/state')) {
    ensureDemoMutationAllowed({ actionKey: 'alert_state_save', entityType: 'alert', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const previousAlert = buildDemoAlert(demoDb.messages.find((entry) => entry.ref === ref) || { ref });
    const state = {
      acknowledged: Boolean(body.acknowledged),
      acknowledgedAt: body.acknowledged ? (demoDb.alertStates[ref]?.acknowledgedAt || new Date().toISOString()) : '',
      acknowledgedBy: body.acknowledged ? (store.username || 'demo') : '',
      suppressionUntil: body.suppressionUntil || '',
      severityOverride: body.severityOverride || '',
      healthAction: body.healthAction || 'none',
      notes: body.notes || '',
      updatedAt: new Date().toISOString(),
    };
    demoDb.alertStates[ref] = state;
    const message = demoDb.messages.find((entry) => entry.ref === ref);
    if (!message) throw new Error('ALERT_NOT_FOUND');
    const alert = buildDemoAlert(message);
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_state_updated',
      actionLabel: 'Updated alert state for',
      entityType: 'alert',
      entityRef: ref,
      entityName: alert.summary || ref,
      route: '/alerts',
      before: previousAlert,
      after: alert,
      detail: `${alert.healthAction || 'none'} action with ${alert.effectiveSeverity || alert.baseSeverity || 'notice'} severity.`,
    });
    return clone(alert);
  }

  if (method === 'PUT' && path === '/api/alerts/bulk-state') {
    ensureDemoMutationAllowed({ actionKey: 'alert_bulk_state_save', entityType: 'alert-batch', entityRef: String((body.refs || []).length) });
    const updated = (body.refs || []).map((ref) => {
      const state = {
        acknowledged: Boolean(body.state?.acknowledged),
        acknowledgedAt: body.state?.acknowledged ? (demoDb.alertStates[ref]?.acknowledgedAt || new Date().toISOString()) : '',
        acknowledgedBy: body.state?.acknowledged ? (store.username || 'demo') : '',
        suppressionUntil: body.state?.suppressionUntil || '',
        severityOverride: body.state?.severityOverride || '',
        healthAction: body.state?.healthAction || 'none',
        notes: body.state?.notes || '',
        updatedAt: new Date().toISOString(),
      };
      demoDb.alertStates[ref] = state;
      return buildDemoAlert(demoDb.messages.find((entry) => entry.ref === ref) || { ref });
    });
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_bulk_state_updated',
      actionLabel: 'Bulk-updated alert state for',
      entityType: 'alert-batch',
      entityRef: (body.refs || []).join(','),
      entityName: `${updated.length} alerts`,
      route: '/alerts',
      before: { refs: body.refs || [] },
      after: { refs: body.refs || [], state: body.state || {} },
      detail: `${updated.length} alerts received the same triage state in a single operation.`,
    });
    return { total: updated.length, data: clone(updated) };
  }

  if (method === 'POST' && path === '/api/alerts/policies') {
    ensureDemoMutationAllowed({ actionKey: 'alert_policy_save', entityType: 'alert-policy', entityRef: 'new' });
    const record = normalizeDemoAlertPolicy({
      ...body,
      id: `alert-policy-${demoDb.alertPolicies.length + 1}`,
      updatedAt: new Date().toISOString(),
    });
    demoDb.alertPolicies.unshift(record);
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_policy_created',
      actionLabel: 'Created alert policy for',
      entityType: 'alert-policy',
      entityRef: record.id,
      entityName: record.name,
      route: '/alerts',
      before: null,
      after: record,
      detail: `${record.name} now governs ${record.matchClass || 'all classes'} alerts in ${record.matchTargetRoute || 'any workspace'} with ${record.matchSeverity || 'any'} severity.`,
    });
    return clone(record);
  }

  if (method === 'PUT' && path.startsWith('/api/alerts/policies/')) {
    ensureDemoMutationAllowed({ actionKey: 'alert_policy_save', entityType: 'alert-policy', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const id = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.alertPolicies.findIndex((policy) => policy.id === id);
    if (index === -1) throw new Error('ALERT_POLICY_NOT_FOUND');
    const previous = clone(demoDb.alertPolicies[index]);
    const record = normalizeDemoAlertPolicy({
      ...demoDb.alertPolicies[index],
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    });
    demoDb.alertPolicies[index] = record;
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_policy_updated',
      actionLabel: 'Updated alert policy for',
      entityType: 'alert-policy',
      entityRef: id,
      entityName: record.name,
      route: '/alerts',
      before: previous,
      after: record,
      detail: `${record.name} policy criteria or automation settings were updated.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/alerts/policies/')) {
    ensureDemoMutationAllowed({ actionKey: 'alert_policy_delete', entityType: 'alert-policy', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const id = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.alertPolicies.findIndex((policy) => policy.id === id);
    if (index === -1) throw new Error('ALERT_POLICY_NOT_FOUND');
    const previous = clone(demoDb.alertPolicies[index]);
    demoDb.alertPolicies.splice(index, 1);
    recordDemoAudit({
      category: 'alerts',
      action: 'alert_policy_deleted',
      actionLabel: 'Removed alert policy for',
      entityType: 'alert-policy',
      entityRef: id,
      entityName: previous.name,
      route: '/alerts',
      before: previous,
      after: { success: true },
      detail: 'Alert suppression policy removed from persisted automation.',
    });
    return { success: true };
  }

  if (method === 'GET' && path === '/api/tasks') {
    const tasks = sortTasks([...(demoDb.tasks || []), ...(demoDb.remediationTasks || [])]);
    return { total: tasks.length, data: clone(tasks) };
  }

  if (method === 'POST' && path === '/api/tasks/remediation') {
    ensureDemoMutationAllowed({ actionKey: 'remediation_task_create', entityType: 'task', entityRef: body.alertRef || 'remediation' });
    const template = body.templateId
      ? demoDb.remediationTemplates.find((entry) => entry.id === body.templateId) || null
      : null;
    if (body.templateId && !template) {
      const error = new Error('REMEDIATION_TEMPLATE_NOT_FOUND');
      error.code = 'REMEDIATION_TEMPLATE_NOT_FOUND';
      throw error;
    }
    if (template && !template.enabled) {
      const error = new Error('REMEDIATION_TEMPLATE_DISABLED');
      error.code = 'REMEDIATION_TEMPLATE_DISABLED';
      throw error;
    }

    const taskPayload = {
      ...body,
      templateId: template?.id || body.templateId || '',
      templateName: template?.name || body.templateName || '',
      templateLaunchMode: template?.launchMode || body.templateLaunchMode || 'draft',
      recurrenceMode: template?.recurrenceMode || body.recurrenceMode || 'manual',
      recurrenceScope: template?.recurrenceScope || body.recurrenceScope || 'object',
      cooldownDays: template?.cooldownDays ?? body.cooldownDays ?? 0,
    };
    const recurrenceKey = buildDemoRemediationRecurrenceKey(taskPayload);
    const recurrenceMode = String(taskPayload.recurrenceMode || 'manual').trim().toLowerCase();
    const blockingStatuses = new Set(['pending', 'queued', 'in_progress', 'success', 'warning']);
    const existingTask = recurrenceMode === 'manual'
      ? null
      : [...demoDb.remediationTasks]
        .filter((task) =>
          task.template_id === taskPayload.templateId
          && task.recurrence_window_key === recurrenceKey
          && blockingStatuses.has(String(task.status || '').trim().toLowerCase())
        )
        .sort((left, right) => new Date(right.created || right.updated_at || 0) - new Date(left.created || left.updated_at || 0))[0];

    if (existingTask) {
      const nextEligibleAt = recurrenceMode === 'once'
        ? ''
        : demoNextEligibleAt(existingTask, recurrenceMode, taskPayload.cooldownDays);
      if (recurrenceMode === 'once' || (nextEligibleAt && new Date(nextEligibleAt).getTime() > Date.now())) {
        recordDemoAudit({
          category: 'alerts',
          action: 'remediation_task_recurrence_blocked',
          actionLabel: 'Skipped recurring remediation for',
          entityType: 'task-template',
          entityRef: taskPayload.templateId || body.alertRef || 'template',
          entityName: taskPayload.templateName || body.nameLabel || 'Remediation Template',
          route: '/alerts',
          status: 'warning',
          after: existingTask,
          detail: nextEligibleAt
            ? `${taskPayload.templateName || 'This remediation template'} already queued follow-through until ${nextEligibleAt}.`
            : `${taskPayload.templateName || 'This remediation template'} already queued follow-through for this alert scope.`,
        });
        const error = new Error('REMEDIATION_TASK_RECURRENCE_BLOCKED');
        error.code = 'REMEDIATION_TASK_RECURRENCE_BLOCKED';
        error.payload = {
          existingTask: clone(existingTask),
          nextEligibleAt,
        };
        throw error;
      }
    }

    const record = buildDemoRemediationTask(taskPayload);
    demoDb.remediationTasks.unshift(record);
    demoDb.remediationTasks = demoDb.remediationTasks.slice(0, 200);
    recordDemoAudit({
      category: 'alerts',
      action: 'remediation_task_created',
      actionLabel: 'Created remediation task for',
      entityType: 'task',
      entityRef: record.ref,
      entityName: record.name_label,
      route: '/activity',
      before: null,
      after: record,
      detail: record.template_name
        ? `Queued ${record.action_type || 'review'} follow-through from template ${record.template_name} for alert ${record.related_alert_summary || record.related_alert_ref || body.alertRef || 'alert'}.`
        : `Queued ${record.action_type || 'review'} follow-through from alert ${record.related_alert_summary || record.related_alert_ref || body.alertRef || 'alert'}.`,
    });
    return clone(record);
  }

  if (method === 'PUT' && path.startsWith('/api/tasks/remediation/') && !path.startsWith('/api/tasks/remediation/templates/')) {
    ensureDemoMutationAllowed({ actionKey: 'remediation_task_update', entityType: 'task', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const ref = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.remediationTasks.findIndex((task) => task.ref === ref);
    if (index === -1) throw new Error('REMEDIATION_TASK_NOT_FOUND');

    const previous = clone(demoDb.remediationTasks[index]);
    const status = String(body.status || previous.status || 'pending').trim().toLowerCase();
    const record = {
      ...previous,
      status,
      assignee: body.assignee !== undefined ? String(body.assignee || '').trim() : previous.assignee,
      due_date: body.dueDate !== undefined ? String(body.dueDate || '').trim() : previous.due_date,
      result: body.result !== undefined ? String(body.result || '').trim() : previous.result,
      name_description: body.nameDescription !== undefined ? String(body.nameDescription || '').trim() : previous.name_description,
      finished: ['success', 'warning', 'failure', 'cancelled'].includes(status) ? new Date().toISOString() : '',
      updated_at: new Date().toISOString(),
    };

    demoDb.remediationTasks[index] = record;
    recordDemoAudit({
      category: 'activity',
      action: 'remediation_task_updated',
      actionLabel: 'Updated remediation task for',
      entityType: 'task',
      entityRef: record.ref,
      entityName: record.name_label,
      route: '/activity',
      before: previous,
      after: record,
      detail: `Set remediation task ${record.name_label} to ${record.status}.`,
    });
    return clone(record);
  }

  if (method === 'GET' && path === '/api/tasks/remediation/templates') {
    return {
      total: demoDb.remediationTemplates.length,
      data: clone([...demoDb.remediationTemplates].sort((left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0))),
    };
  }

  if (method === 'POST' && path === '/api/tasks/remediation/templates') {
    ensureDemoMutationAllowed({ actionKey: 'remediation_template_save', entityType: 'task-template', entityRef: 'new' });
    const record = buildDemoRemediationTemplate({
      ...body,
      updatedAt: new Date().toISOString(),
    });
    demoDb.remediationTemplates.unshift(record);
    demoDb.remediationTemplates = demoDb.remediationTemplates.slice(0, 100);
    recordDemoAudit({
      category: 'alerts',
      action: 'remediation_template_created',
      actionLabel: 'Created remediation template for',
      entityType: 'task-template',
      entityRef: record.id,
      entityName: record.name,
      route: '/alerts',
      before: null,
      after: record,
      detail: `${record.name} now maps ${record.matchClass || 'any class'} alerts into ${record.actionType || 'review'} follow-through work.`,
    });
    return clone(record);
  }

  if (method === 'PUT' && path.startsWith('/api/tasks/remediation/templates/')) {
    ensureDemoMutationAllowed({ actionKey: 'remediation_template_save', entityType: 'task-template', entityRef: decodeURIComponent(path.split('/')[5] || '') });
    const id = decodeURIComponent(path.split('/')[5] || '');
    const index = demoDb.remediationTemplates.findIndex((template) => template.id === id);
    if (index === -1) throw new Error('REMEDIATION_TEMPLATE_NOT_FOUND');

    const previous = clone(demoDb.remediationTemplates[index]);
    const record = buildDemoRemediationTemplate({
      ...previous,
      ...body,
      updatedAt: new Date().toISOString(),
    }, previous);
    demoDb.remediationTemplates[index] = record;
    recordDemoAudit({
      category: 'alerts',
      action: 'remediation_template_updated',
      actionLabel: 'Updated remediation template for',
      entityType: 'task-template',
      entityRef: record.id,
      entityName: record.name,
      route: '/alerts',
      before: previous,
      after: record,
      detail: `${record.name} template criteria or defaults were updated.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/tasks/remediation/templates/')) {
    ensureDemoMutationAllowed({ actionKey: 'remediation_template_delete', entityType: 'task-template', entityRef: decodeURIComponent(path.split('/')[5] || '') });
    const id = decodeURIComponent(path.split('/')[5] || '');
    const index = demoDb.remediationTemplates.findIndex((template) => template.id === id);
    if (index === -1) throw new Error('REMEDIATION_TEMPLATE_NOT_FOUND');

    const previous = clone(demoDb.remediationTemplates[index]);
    demoDb.remediationTemplates.splice(index, 1);
    recordDemoAudit({
      category: 'alerts',
      action: 'remediation_template_deleted',
      actionLabel: 'Removed remediation template for',
      entityType: 'task-template',
      entityRef: previous.id,
      entityName: previous.name,
      route: '/alerts',
      before: previous,
      after: { success: true },
      detail: `${previous.name} remediation template was removed from the alerts workflow.`,
    });
    return { success: true };
  }

  if (method === 'GET' && path === '/api/audit') {
    return { total: demoDb.auditLog.length, data: clone(demoDb.auditLog) };
  }

  if (method === 'GET' && path === '/api/logs') {
    const entries = buildDemoLogEntries();
    return {
      total: entries.length,
      page: 1,
      pageSize: 50,
      data: clone(entries),
      summary: {
        sourceCounts: {
          audit: entries.filter((entry) => entry.source === 'audit').length,
          auth: 0,
          alert: entries.filter((entry) => entry.source === 'alert').length,
          'remediation-task': entries.filter((entry) => entry.source === 'remediation-task').length,
          'xen-task': entries.filter((entry) => entry.source === 'xen-task').length,
        },
      },
    };
  }

  if (method === 'GET' && path === '/api/metrics/cluster') {
    return clone(buildDemoClusterMetrics(range));
  }

  if (method === 'POST' && path === '/api/metrics/collect') {
    return {
      captured: true,
      ts: Date.now(),
      sampleCount: (demoDb.hosts.length * 4) + (demoDb.vms.filter((vm) => !vm.is_a_template).length * 4) + (demoDb.srs.length * 3),
      hostCount: demoDb.hosts.length,
      vmCount: demoDb.vms.filter((vm) => !vm.is_a_template).length,
      srCount: demoDb.srs.length,
    };
  }

  if (method === 'GET' && path.startsWith('/api/metrics/hosts/')) {
    const ref = decodeURIComponent(path.split('/')[4] || '');
    return clone(buildDemoHostMetricHistory(ref, range));
  }

  if (method === 'GET' && path.startsWith('/api/metrics/vms/')) {
    const ref = decodeURIComponent(path.split('/')[4] || '');
    return clone(buildDemoVmMetricHistory(ref, range));
  }

  if (method === 'GET' && path.startsWith('/api/metrics/storage/')) {
    const ref = decodeURIComponent(path.split('/')[4] || '');
    return clone(buildDemoStorageMetricHistory(ref, range));
  }

  if (method === 'GET' && path === '/api/governance') {
    const approvals = listDemoGovernanceApprovals();
    const quotaRows = buildDemoQuotaRows();
    return {
      generatedAt: '2026-08-21T15:20:00.000Z',
      policy: clone(demoDb.governancePolicy),
      currentRole: getDemoGovernanceState().currentRole,
      quotas: clone(demoDb.governanceQuotas),
      approvals,
      quotaRows,
      userSummary: getDemoUserSummary(),
      summary: {
        pendingApprovalCount: approvals.filter((entry) => entry.status === 'pending').length,
        approvedApprovalCount: approvals.filter((entry) => entry.status === 'approved').length,
        enforcedQuotaCount: demoDb.governanceQuotas.filter((entry) => entry.enabled).length,
        poolCount: demoDb.pools.length,
      },
    };
  }

  if (method === 'PUT' && path === '/api/governance/policy') {
    ensureDemoMutationAllowed({ actionKey: 'governance_policy_save', entityType: 'policy', entityRef: 'governance.policy' });
    const previous = clone(demoDb.governancePolicy);
    demoDb.governancePolicy = {
      defaultRole: body.defaultRole || 'admin',
      requireDestructiveApproval: body.requireDestructiveApproval !== false,
      approvalTtlMinutes: Number(body.approvalTtlMinutes || 240),
    };
    recordDemoAudit({
      category: 'governance',
      action: 'governance_policy_saved',
      actionLabel: 'Saved governance policy for',
      entityType: 'policy',
      entityRef: 'governance.policy',
      entityName: 'Governance Policy',
      route: '/governance',
      before: previous,
      after: demoDb.governancePolicy,
      detail: `${demoDb.governancePolicy.defaultRole} default role with ${demoDb.governancePolicy.requireDestructiveApproval ? 'approval-gated' : 'direct'} destructive actions.`,
    });
    return clone(demoDb.governancePolicy);
  }

  if (method === 'PUT' && path === '/api/governance/role') {
    const previousRole = store.governance?.currentRole || demoDb.governancePolicy.defaultRole || 'admin';
    const desiredRole = body.role || previousRole;
    const currentUserRole = store.user?.role || 'admin';
    const roleOrder = { 'read-only': 0, operator: 1, admin: 2 };
    if ((roleOrder[desiredRole] ?? 0) > (roleOrder[currentUserRole] ?? 0)) {
      const error = new Error('ROLE_ESCALATION_NOT_ALLOWED');
      error.code = 'ROLE_ESCALATION_NOT_ALLOWED';
      throw error;
    }
    store.governance = {
      ...store.governance,
      currentRole: desiredRole,
      policy: clone(demoDb.governancePolicy),
    };
    recordDemoAudit({
      category: 'governance',
      action: 'governance_role_switched',
      actionLabel: 'Switched governance role for',
      entityType: 'session',
      entityRef: 'demo-session',
      entityName: store.username || 'demo',
      route: '/governance',
      before: { role: previousRole },
      after: { role: store.governance.currentRole },
      detail: `Session role changed from ${previousRole} to ${store.governance.currentRole}.`,
    });
    return { role: store.governance.currentRole };
  }

  if (method === 'GET' && path === '/api/users') {
    const data = listDemoUsers();
    return {
      total: data.length,
      data,
      summary: getDemoUserSummary(),
    };
  }

  if (method === 'POST' && path === '/api/users') {
    const duplicate = demoDb.users.find((entry) => String(entry.username || '').toLowerCase() === String(body.username || '').toLowerCase());
    if (duplicate) {
      const error = new Error('USERNAME_ALREADY_EXISTS');
      error.code = 'USERNAME_ALREADY_EXISTS';
      throw error;
    }
    const record = {
      id: nextDemoId(demoDb.users),
      username: body.username || '',
      display_name: body.displayName || '',
      email: body.email || '',
      role: body.role || 'operator',
      active: body.active !== false,
      created_at: new Date().toISOString(),
      last_login_at: '',
    };
    demoDb.users.push(record);
    applyDemoUserGroupMembership(record.id, body.groupIds || []);
    const responseRecord = listDemoUsers().find((entry) => Number(entry.id) === Number(record.id)) || record;
    recordDemoAudit({
      category: 'governance',
      action: 'user_created',
      actionLabel: 'Created local user',
      entityType: 'user',
      entityRef: String(record.id),
      entityName: record.username,
      route: '/governance',
      before: null,
      after: responseRecord,
      detail: `Created local ${record.role} account ${record.username}${record.active ? '' : ' in a disabled state'}.`,
    });
    return clone(responseRecord);
  }

  if (method === 'PUT' && path.startsWith('/api/users/')) {
    const userId = Number(path.split('/')[3] || 0);
    const roleOrder = { 'read-only': 0, operator: 1, admin: 2 };
    const index = demoDb.users.findIndex((entry) => Number(entry.id) === userId);
    if (index === -1) {
      const error = new Error('USER_NOT_FOUND');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    const previous = clone(demoDb.users[index]);
    const duplicate = demoDb.users.find((entry) =>
      Number(entry.id) !== userId
      && String(entry.username || '').toLowerCase() === String(body.username || previous.username || '').toLowerCase()
    );
    if (duplicate) {
      const error = new Error('USERNAME_ALREADY_EXISTS');
      error.code = 'USERNAME_ALREADY_EXISTS';
      throw error;
    }
    const activeAdminsExcludingCurrent = demoDb.users.filter((entry) =>
      Number(entry.id) !== userId && entry.active !== false && entry.role === 'admin'
    ).length;
    const nextRole = body.role || previous.role || 'operator';
    const nextActive = body.active !== false;
    if (previous.role === 'admin' && previous.active !== false && (nextRole !== 'admin' || !nextActive) && !activeAdminsExcludingCurrent) {
      const error = new Error('LAST_ACTIVE_ADMIN_REQUIRED');
      error.code = 'LAST_ACTIVE_ADMIN_REQUIRED';
      throw error;
    }
    demoDb.users[index] = {
      ...demoDb.users[index],
      username: body.username || previous.username,
      display_name: body.displayName || '',
      email: body.email || '',
      role: nextRole,
      active: nextActive,
    };
    applyDemoUserGroupMembership(userId, body.groupIds || []);
    const responseRecord = listDemoUsers().find((entry) => Number(entry.id) === Number(userId)) || demoDb.users[index];
    if (String(store.user?.id || '') === String(userId)) {
      store.user = {
        ...store.user,
        username: responseRecord.username,
        displayName: responseRecord.display_name || responseRecord.username,
        role: responseRecord.role,
      };
      if ((roleOrder[store.governance.currentRole] ?? 0) > (roleOrder[responseRecord.role] ?? 0)) {
        store.governance.currentRole = responseRecord.role;
      }
    }
    recordDemoAudit({
      category: 'governance',
      action: 'user_updated',
      actionLabel: 'Updated local user',
      entityType: 'user',
      entityRef: String(userId),
      entityName: responseRecord.username,
      route: '/governance',
      before: previous,
      after: responseRecord,
      detail: `Updated local account ${responseRecord.username} (${responseRecord.role}, ${responseRecord.active ? 'active' : 'disabled'}).`,
    });
    return clone(responseRecord);
  }

  if (method === 'POST' && path.startsWith('/api/users/') && path.endsWith('/password')) {
    const userId = Number(path.split('/')[3] || 0);
    const index = demoDb.users.findIndex((entry) => Number(entry.id) === userId);
    if (index === -1) {
      const error = new Error('USER_NOT_FOUND');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    recordDemoAudit({
      category: 'governance',
      action: 'user_password_reset',
      actionLabel: 'Reset password for',
      entityType: 'user',
      entityRef: String(userId),
      entityName: demoDb.users[index].username,
      route: '/governance',
      before: clone(demoDb.users[index]),
      after: { ...clone(demoDb.users[index]), password: 'rotated' },
      detail: `Rotated the local password for ${demoDb.users[index].username}.`,
    });
    return { success: true, user: clone(demoDb.users[index]) };
  }

  if (method === 'GET' && path === '/api/groups') {
    const data = listDemoGroups();
    return {
      total: data.length,
      data,
    };
  }

  if (method === 'POST' && path === '/api/groups') {
    const duplicate = demoDb.groups.find((entry) => String(entry.name || '').toLowerCase() === String(body.name || '').toLowerCase());
    if (duplicate) {
      const error = new Error('GROUP_NAME_ALREADY_EXISTS');
      error.code = 'GROUP_NAME_ALREADY_EXISTS';
      throw error;
    }

    const record = {
      id: nextDemoId(demoDb.groups),
      name: body.name || '',
      created_at: new Date().toISOString(),
      memberUserIds: [...new Set((body.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean))],
    };
    demoDb.groups.push(record);
    const responseRecord = listDemoGroups().find((entry) => Number(entry.id) === Number(record.id)) || record;
    recordDemoAudit({
      category: 'governance',
      action: 'group_created',
      actionLabel: 'Created local group',
      entityType: 'group',
      entityRef: String(record.id),
      entityName: record.name,
      route: '/governance',
      before: null,
      after: responseRecord,
      detail: `Created local group ${record.name} with ${responseRecord.member_count || 0} assigned member${(responseRecord.member_count || 0) === 1 ? '' : 's'}.`,
    });
    return clone(responseRecord);
  }

  if (method === 'PUT' && path.startsWith('/api/groups/')) {
    const groupId = Number(path.split('/')[3] || 0);
    const index = demoDb.groups.findIndex((entry) => Number(entry.id) === groupId);
    if (index === -1) {
      const error = new Error('GROUP_NOT_FOUND');
      error.code = 'GROUP_NOT_FOUND';
      throw error;
    }

    const duplicate = demoDb.groups.find((entry) =>
      Number(entry.id) !== groupId
      && String(entry.name || '').toLowerCase() === String(body.name || '').toLowerCase()
    );
    if (duplicate) {
      const error = new Error('GROUP_NAME_ALREADY_EXISTS');
      error.code = 'GROUP_NAME_ALREADY_EXISTS';
      throw error;
    }

    const previous = listDemoGroups().find((entry) => Number(entry.id) === Number(groupId)) || clone(demoDb.groups[index]);
    demoDb.groups[index] = {
      ...demoDb.groups[index],
      name: body.name || demoDb.groups[index].name || '',
      memberUserIds: [...new Set((body.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean))],
    };
    const responseRecord = listDemoGroups().find((entry) => Number(entry.id) === Number(groupId)) || demoDb.groups[index];
    recordDemoAudit({
      category: 'governance',
      action: 'group_updated',
      actionLabel: 'Updated local group',
      entityType: 'group',
      entityRef: String(groupId),
      entityName: responseRecord.name,
      route: '/governance',
      before: previous,
      after: responseRecord,
      detail: `Updated local group ${responseRecord.name} and synchronized ${responseRecord.member_count || 0} member assignment${(responseRecord.member_count || 0) === 1 ? '' : 's'}.`,
    });
    return clone(responseRecord);
  }

  if (method === 'DELETE' && path.startsWith('/api/groups/')) {
    const groupId = Number(path.split('/')[3] || 0);
    const index = demoDb.groups.findIndex((entry) => Number(entry.id) === groupId);
    if (index === -1) {
      const error = new Error('GROUP_NOT_FOUND');
      error.code = 'GROUP_NOT_FOUND';
      throw error;
    }

    const previous = listDemoGroups().find((entry) => Number(entry.id) === Number(groupId)) || clone(demoDb.groups[index]);
    demoDb.groups.splice(index, 1);
    recordDemoAudit({
      category: 'governance',
      action: 'group_deleted',
      actionLabel: 'Removed local group',
      entityType: 'group',
      entityRef: String(groupId),
      entityName: previous.name,
      route: '/governance',
      before: previous,
      after: { success: true },
      detail: `Removed local group ${previous.name} from the control-plane access catalog.`,
    });
    return { success: true };
  }

  if (method === 'PUT' && path.startsWith('/api/governance/quotas/')) {
    ensureDemoMutationAllowed({ actionKey: 'governance_quota_save', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.governanceQuotas.find((entry) => entry.poolRef === poolRef) || null;
    const record = {
      poolRef,
      enabled: body.enabled !== false,
      owner: body.owner || '',
      maxVmCount: Number(body.maxVmCount || 0),
      maxRunningVmCount: Number(body.maxRunningVmCount || 0),
      maxTotalMemoryGiB: Number(body.maxTotalMemoryGiB || 0),
      notes: body.notes || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.governanceQuotas.findIndex((entry) => entry.poolRef === poolRef);
    if (index === -1) demoDb.governanceQuotas.push(record);
    else demoDb.governanceQuotas[index] = record;
    recordDemoAudit({
      category: 'governance',
      action: 'governance_quota_saved',
      actionLabel: 'Saved governance quota for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/governance',
      before: previous,
      after: record,
      detail: `${record.maxVmCount || 0} VM cap and ${record.maxTotalMemoryGiB || 0} GiB cap configured.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/governance/quotas/')) {
    ensureDemoMutationAllowed({ actionKey: 'governance_quota_delete', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.governanceQuotas.find((entry) => entry.poolRef === poolRef) || null;
    demoDb.governanceQuotas = demoDb.governanceQuotas.filter((entry) => entry.poolRef !== poolRef);
    recordDemoAudit({
      category: 'governance',
      action: 'governance_quota_removed',
      actionLabel: 'Removed governance quota for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/governance',
      before: previous,
      after: { success: true },
      detail: 'Pool quota record removed from the governance policy store.',
    });
    return { success: true };
  }

  if (method === 'POST' && path === '/api/governance/approvals') {
    const record = {
      id: `approval-${Date.now()}`,
      actionKey: body.actionKey || '',
      entityType: body.entityType || 'resource',
      entityRef: body.entityRef || '',
      entityName: body.entityName || '',
      requestedBy: store.username || 'demo',
      justification: body.justification || '',
      route: body.route || '',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + Number(demoDb.governancePolicy.approvalTtlMinutes || 240) * 60000).toISOString(),
      decidedBy: '',
      decidedAt: '',
      decisionNotes: '',
      usedBy: '',
      usedAt: '',
    };
    demoDb.governanceApprovals.unshift(record);
    recordDemoAudit({
      category: 'governance',
      action: 'governance_approval_requested',
      actionLabel: 'Requested governance approval for',
      entityType: record.entityType,
      entityRef: record.entityRef,
      entityName: record.entityName || record.entityRef,
      route: '/governance',
      status: 'pending',
      before: null,
      after: record,
      detail: `${record.actionKey} requested with a pending approval window until ${record.expiresAt}.`,
    });
    return clone(record);
  }

  if (method === 'POST' && path.startsWith('/api/governance/approvals/') && path.endsWith('/decision')) {
    const approvalId = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.governanceApprovals.findIndex((entry) => entry.id === approvalId);
    if (index === -1) throw new Error('APPROVAL_NOT_FOUND');
    const previous = clone(demoDb.governanceApprovals[index]);
    demoDb.governanceApprovals[index] = {
      ...demoDb.governanceApprovals[index],
      status: body.decision === 'rejected' ? 'rejected' : 'approved',
      decidedBy: store.username || 'demo',
      decidedAt: new Date().toISOString(),
      decisionNotes: body.notes || '',
    };
    recordDemoAudit({
      category: 'governance',
      action: body.decision === 'rejected' ? 'governance_approval_rejected' : 'governance_approval_approved',
      actionLabel: body.decision === 'rejected' ? 'Rejected governance approval for' : 'Approved governance approval for',
      entityType: demoDb.governanceApprovals[index].entityType,
      entityRef: demoDb.governanceApprovals[index].entityRef,
      entityName: demoDb.governanceApprovals[index].entityName || demoDb.governanceApprovals[index].entityRef,
      route: '/governance',
      status: body.decision === 'rejected' ? 'warning' : 'success',
      before: previous,
      after: demoDb.governanceApprovals[index],
      detail: `${demoDb.governanceApprovals[index].actionKey} request is now ${demoDb.governanceApprovals[index].status}.`,
    });
    return clone(demoDb.governanceApprovals[index]);
  }

  if (method === 'GET' && path === '/api/resilience') {
    return buildDemoResilience();
  }

  if (method === 'GET' && path === '/api/resilience/plans') {
    return { total: demoDb.resilienceRunbooks.length, data: clone(demoDb.resilienceRunbooks) };
  }

  if (method === 'GET' && path === '/api/resilience/drills') {
    return {
      total: demoDb.resilienceDrills.length,
      data: clone([...demoDb.resilienceDrills].sort((left, right) => new Date(right.executedAt || 0) - new Date(left.executedAt || 0))),
    };
  }

  if (method === 'PUT' && path.startsWith('/api/resilience/plans/')) {
    ensureDemoMutationAllowed({ actionKey: 'resilience_runbook_save', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.resilienceRunbooks.find((record) => record.poolRef === poolRef) || null;
    const record = {
      poolRef,
      recoveryTier: body.recoveryTier || 'standard',
      haPolicy: body.haPolicy || 'manual',
      restartPriority: body.restartPriority || 'medium',
      backupWindowHours: Number(body.backupWindowHours || 24),
      rpoMinutes: Number(body.rpoMinutes || 60),
      rtoMinutes: Number(body.rtoMinutes || 120),
      restorePointStatus: body.restorePointStatus || 'review',
      owner: body.owner || '',
      standbyHostRef: body.standbyHostRef || '',
      failoverNetworkRef: body.failoverNetworkRef || '',
      lastVerifiedAt: body.lastVerifiedAt || '',
      runbookSteps: Array.isArray(body.runbookSteps) ? body.runbookSteps.filter(Boolean).slice(0, 8) : [],
      notes: body.notes || '',
      sourceTaskRef: body.sourceTaskRef || '',
      sourceTemplateId: body.sourceTemplateId || '',
      sourceTemplateName: body.sourceTemplateName || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.resilienceRunbooks.findIndex((entry) => entry.poolRef === poolRef);
    if (index === -1) {
      demoDb.resilienceRunbooks.push(record);
    } else {
      demoDb.resilienceRunbooks[index] = record;
    }
    recordDemoAudit({
      category: 'resilience',
      action: 'resilience_runbook_saved',
      actionLabel: 'Saved resilience runbook for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/resilience',
      before: previous,
      after: record,
      detail: `${record.haPolicy} HA policy with ${record.backupWindowHours}h backup window.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/resilience/plans/')) {
    ensureDemoMutationAllowed({ actionKey: 'resilience_runbook_delete', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.resilienceRunbooks.find((record) => record.poolRef === poolRef) || null;
    const index = demoDb.resilienceRunbooks.findIndex((entry) => entry.poolRef === poolRef);
    if (index === -1) throw new Error('RESILIENCE_RUNBOOK_NOT_FOUND');
    demoDb.resilienceRunbooks.splice(index, 1);
    recordDemoAudit({
      category: 'resilience',
      action: 'resilience_runbook_removed',
      actionLabel: 'Cleared resilience runbook for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/resilience',
      before: previous,
      after: { success: true },
      detail: 'Recovery runbook removed from persisted resilience planning state.',
    });
    return { success: true };
  }

  if (method === 'POST' && path.startsWith('/api/resilience/drills/')) {
    ensureDemoMutationAllowed({ actionKey: 'resilience_drill_log', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const record = {
      id: `drill-${Date.now()}`,
      poolRef,
      drillType: body.drillType || 'restore',
      status: body.status || 'success',
      scope: body.scope || '',
      executedAt: body.executedAt || new Date().toISOString(),
      durationMinutes: Number(body.durationMinutes || 0),
      summary: body.summary || '',
      findings: body.findings || '',
      nextStep: body.nextStep || '',
      operator: store.username || 'demo',
      createdAt: new Date().toISOString(),
    };
    demoDb.resilienceDrills.unshift(record);
    demoDb.resilienceDrills = demoDb.resilienceDrills.slice(0, 80);
    recordDemoAudit({
      category: 'resilience',
      action: 'resilience_drill_logged',
      actionLabel: 'Logged resilience drill for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/resilience',
      before: null,
      after: record,
      detail: `${record.drillType} drill logged with ${record.status} status.`,
    });
    return clone(record);
  }

  if (method === 'GET' && path === '/api/lifecycle/plans') {
    return { total: demoDb.lifecyclePlans.length, data: clone(demoDb.lifecyclePlans) };
  }

  if (method === 'PUT' && path.startsWith('/api/lifecycle/plans/')) {
    ensureDemoMutationAllowed({ actionKey: 'lifecycle_plan_save', entityType: 'host', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const hostRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.lifecyclePlans.find((plan) => plan.hostRef === hostRef) || null;
    const record = {
      hostRef,
      baselineStatus: body.baselineStatus || 'unknown',
      targetStage: body.targetStage || 'review',
      maintenanceWindow: body.maintenanceWindow || '',
      patchGroup: body.patchGroup || '',
      owner: body.owner || '',
      nextAction: body.nextAction || 'scan',
      rebootRequired: Boolean(body.rebootRequired),
      evacuationRequired: Boolean(body.evacuationRequired),
      dueDate: body.dueDate || '',
      notes: body.notes || '',
      sourceTaskRef: body.sourceTaskRef || '',
      sourceTemplateId: body.sourceTemplateId || '',
      sourceTemplateName: body.sourceTemplateName || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.lifecyclePlans.findIndex((plan) => plan.hostRef === hostRef);
    if (index === -1) {
      demoDb.lifecyclePlans.push(record);
    } else {
      demoDb.lifecyclePlans[index] = record;
    }
    recordDemoAudit({
      category: 'lifecycle',
      action: 'lifecycle_plan_saved',
      actionLabel: 'Saved lifecycle plan for',
      entityType: 'host',
      entityRef: hostRef,
      entityName: hostRef,
      route: '/lifecycle',
      before: previous,
      after: record,
      detail: `${record.targetStage} stage with ${record.baselineStatus} baseline status.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/lifecycle/plans/')) {
    ensureDemoMutationAllowed({ actionKey: 'lifecycle_plan_delete', entityType: 'host', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const hostRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.lifecyclePlans.find((plan) => plan.hostRef === hostRef) || null;
    const index = demoDb.lifecyclePlans.findIndex((plan) => plan.hostRef === hostRef);
    if (index === -1) throw new Error('LIFECYCLE_PLAN_NOT_FOUND');
    demoDb.lifecyclePlans.splice(index, 1);
    recordDemoAudit({
      category: 'lifecycle',
      action: 'lifecycle_plan_removed',
      actionLabel: 'Cleared lifecycle plan for',
      entityType: 'host',
      entityRef: hostRef,
      entityName: hostRef,
      route: '/lifecycle',
      before: previous,
      after: { success: true },
      detail: 'Lifecycle planner entry removed from persisted state.',
    });
    return { success: true };
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

  if (method === 'GET' && path === '/api/vms/templates/governance') {
    return { total: demoDb.templateGovernance.length, data: clone(demoDb.templateGovernance) };
  }

  if (method === 'PUT' && path.startsWith('/api/vms/templates/') && path.endsWith('/governance')) {
    ensureDemoMutationAllowed({ actionKey: 'template_governance_save', entityType: 'template', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.templateGovernance.find((entry) => entry.templateRef === templateRef) || null;
    const record = {
      templateRef,
      versionLabel: body.versionLabel || '',
      profileLabel: body.profileLabel || '',
      lifecycleStage: body.lifecycleStage || 'draft',
      goldenImage: Boolean(body.goldenImage),
      guestCustomization: body.guestCustomization || '',
      validationStatus: body.validationStatus || 'untested',
      lastValidatedAt: body.lastValidatedAt || '',
      owner: body.owner || '',
      notes: body.notes || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.templateGovernance.findIndex((entry) => entry.templateRef === templateRef);
    if (index === -1) {
      demoDb.templateGovernance.push(record);
    } else {
      demoDb.templateGovernance[index] = record;
    }
    demoDb.templateGovernanceHistory.unshift({
      id: `tmplhist-${Date.now()}`,
      templateRef,
      templateName: demoDb.vms.find((entry) => entry.ref === templateRef)?.name_label || templateRef,
      eventType: 'saved',
      actor: store.username || 'demo',
      happenedAt: record.updatedAt,
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: `${record.versionLabel || templateRef} governance saved from the template library workbench.`,
      snapshot: clone(record),
    });
    recordDemoAudit({
      category: 'templates',
      action: 'template_governance_saved',
      actionLabel: 'Saved template governance for',
      entityType: 'template',
      entityRef: templateRef,
      entityName: record.versionLabel || templateRef,
      route: '/templates',
      before: previous,
      after: record,
      detail: `${record.lifecycleStage} stage with ${record.validationStatus} validation status.`,
    });
    return clone(record);
  }

  if (method === 'GET' && path.startsWith('/api/vms/templates/') && path.endsWith('/history')) {
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const records = demoDb.templateGovernanceHistory.filter((entry) => entry.templateRef === templateRef);
    return { total: records.length, data: clone(records) };
  }

  if (method === 'POST' && path.startsWith('/api/vms/templates/') && path.endsWith('/promote')) {
    ensureDemoMutationAllowed({ actionKey: 'template_promote', entityType: 'template', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const template = demoDb.vms.find((entry) => entry.ref === templateRef);
    const index = demoDb.templateGovernance.findIndex((entry) => entry.templateRef === templateRef);
    if (!template || index === -1) throw new Error('TEMPLATE_GOVERNANCE_NOT_FOUND');

    const current = demoDb.templateGovernance[index];
    if (current.validationStatus !== 'validated') throw new Error('PROMOTION_REQUIRES_VALIDATED_TEMPLATE');

    const previous = clone(current);
    const profileLabel = String(current.profileLabel || '').trim().toLowerCase();
    const baseline = demoDb.templateGovernance.find((entry) =>
      entry.templateRef !== templateRef
      && entry.lifecycleStage === 'stable'
      && String(entry.profileLabel || '').trim().toLowerCase() === profileLabel
    ) || null;
    const deprecated = [];

    if (baseline && body.retireExistingStable !== false) {
      baseline.lifecycleStage = 'deprecated';
      baseline.goldenImage = false;
      baseline.updatedAt = new Date().toISOString();
      deprecated.push(clone(baseline));
      demoDb.templateGovernanceHistory.unshift({
        id: `tmplhist-${Date.now()}-retire`,
        templateRef: baseline.templateRef,
        templateName: demoDb.vms.find((entry) => entry.ref === baseline.templateRef)?.name_label || baseline.templateRef,
        eventType: 'retired',
        actor: store.username || 'demo',
        happenedAt: baseline.updatedAt,
        baselineTemplateRef: templateRef,
        baselineTemplateName: template.name_label || templateRef,
        baselineVersionLabel: current.versionLabel || '',
        promotionNotes: body.promotionNotes || '',
        detail: `${current.versionLabel || templateRef} replaced this stable baseline during promotion.`,
        snapshot: clone(baseline),
      });
    }

    Object.assign(current, {
      lifecycleStage: 'stable',
      goldenImage: true,
      updatedAt: new Date().toISOString(),
      notes: [current.notes, body.promotionNotes || ''].filter(Boolean).join(' '),
    });

    demoDb.templateGovernanceHistory.unshift({
      id: `tmplhist-${Date.now()}-promote`,
      templateRef,
      templateName: template.name_label || templateRef,
      eventType: 'promoted',
      actor: store.username || 'demo',
      happenedAt: current.updatedAt,
      baselineTemplateRef: baseline?.templateRef || '',
      baselineTemplateName: baseline ? (demoDb.vms.find((entry) => entry.ref === baseline.templateRef)?.name_label || baseline.templateRef) : '',
      baselineVersionLabel: baseline?.versionLabel || '',
      promotionNotes: body.promotionNotes || '',
      detail: `${current.versionLabel || templateRef} promoted to stable lifecycle stage.`,
      snapshot: clone(current),
    });

    recordDemoAudit({
      category: 'templates',
      action: 'template_promoted',
      actionLabel: 'Promoted template',
      entityType: 'template',
      entityRef: templateRef,
      entityName: template.name_label || templateRef,
      route: '/templates',
      before: previous,
      after: clone(current),
      detail: `${current.versionLabel || templateRef} promoted to stable${deprecated.length ? ' and retired the previous stable baseline' : ''}.`,
    });

    return {
      promoted: clone(current),
      deprecated: clone(deprecated),
      history: clone(demoDb.templateGovernanceHistory.filter((entry) => entry.templateRef === templateRef)),
    };
  }

  if (method === 'GET' && path === '/api/vms/templates/deployments') {
    const records = [...demoDb.templateDeployments].sort((left, right) => new Date(right.updatedAt || right.submittedAt || 0) - new Date(left.updatedAt || left.submittedAt || 0));
    return { total: records.length, data: clone(records) };
  }

  if (method === 'PUT' && path.startsWith('/api/vms/templates/deployments/') && path.endsWith('/validation')) {
    ensureDemoMutationAllowed({ actionKey: 'template_deployment_validate', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[5] || '') });
    const deploymentId = decodeURIComponent(path.split('/')[5] || '');
    const index = demoDb.templateDeployments.findIndex((entry) => entry.id === deploymentId);
    if (index === -1) throw new Error('TEMPLATE_DEPLOYMENT_NOT_FOUND');

    const previous = demoDb.templateDeployments[index];
    const nextRecord = {
      ...demoDb.templateDeployments[index],
      validationStatus: body.validationStatus || 'pending',
      validationNotes: body.validationNotes || '',
      guestCustomization: body.guestCustomization || '',
      bootVerified: Boolean(body.bootVerified),
      networkVerified: Boolean(body.networkVerified),
      storageVerified: Boolean(body.storageVerified),
      policyTagged: Boolean(body.policyTagged),
      updatedAt: new Date().toISOString(),
    };
    demoDb.templateDeployments[index] = nextRecord;
    recordDemoAudit({
      category: 'templates',
      action: 'template_deployment_validated',
      actionLabel: 'Updated deployment validation for',
      entityType: 'vm',
      entityRef: nextRecord.vmRef || nextRecord.id,
      entityName: nextRecord.vmName || nextRecord.id,
      route: '/templates',
      before: previous,
      after: nextRecord,
      detail: `${nextRecord.validationStatus} validation with guest customization ${nextRecord.guestCustomization || 'unset'}.`,
    });
    return clone(nextRecord);
  }

  if (method === 'POST' && path.includes('/api/vms/templates/') && path.endsWith('/deploy')) {
    ensureDemoMutationAllowed({ actionKey: 'template_deploy', entityType: 'template', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const template = demoDb.vms.find((vm) => vm.ref === templateRef && vm.is_a_template);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    if (body.hostRef) {
      const host = demoDb.hosts.find((entry) => entry.ref === body.hostRef);
      const quota = demoDb.governanceQuotas.find((entry) => entry.poolRef === host?.pool) || null;
      if (quota?.enabled && host?.pool) {
        const row = buildDemoQuotaRows().find((entry) => entry.poolRef === host.pool);
        const nextVmCount = (row?.currentVmCount || 0) + 1;
        const nextRunningVmCount = (row?.currentRunningVmCount || 0) + (body.startAfter ? 1 : 0);
        const nextTotalMemoryGiB = (row?.currentTotalMemoryGiB || 0) + (Number(body.memoryStaticMax || 0) / (1024 ** 3));
        const breaches = [];
        if (quota.maxVmCount > 0 && nextVmCount > quota.maxVmCount) breaches.push('VM count');
        if (quota.maxRunningVmCount > 0 && nextRunningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
        if (quota.maxTotalMemoryGiB > 0 && nextTotalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');
        if (breaches.length) {
          const error = new Error(`The deployment would exceed the configured pool quota for ${breaches.join(', ')}.`);
          error.code = 'QUOTA_EXCEEDED';
          throw error;
        }
      }
    }

    const vmRef = nextDemoOpaqueRef('vm');
    const vbdRef = nextDemoOpaqueRef('vbd');
    const vdiRef = nextDemoOpaqueRef('vdi');
    const vifRef = body.networkRef ? nextDemoOpaqueRef('vif') : null;
    const hostRef = body.hostRef || '';
    const host = demoDb.hosts.find((entry) => entry.ref === hostRef);
    const srRef = body.storageRef || demoDb.srs[0]?.ref || '';
    const network = demoDb.networks.find((entry) => entry.ref === body.networkRef);

    const vmRecord = {
      ref: vmRef,
      name_label: body.nameLabel,
      name_description: body.nameDescription || '',
      power_state: body.startAfter ? 'Running' : 'Halted',
      VCPUs_at_startup: Number(body.vcpus || template.VCPUs_at_startup || 1),
      VCPUs_max: Number(body.vcpus || template.VCPUs_at_startup || 1),
      memory_static_max: Number(body.memoryStaticMax || template.memory_static_max || 0),
      memory_dynamic_max: Number(body.memoryStaticMax || template.memory_static_max || 0),
      uuid: `${vmRef.replace('OpaqueRef:', '')}-uuid`,
      is_a_template: false,
      resident_on: hostRef || '',
      affinity: hostRef || '',
      VBDs: [vbdRef],
      VIFs: vifRef ? [vifRef] : [],
      HVM_boot_policy: template.HVM_boot_policy || 'UEFI',
      platform: clone(template.platform || {}),
      tags: Array.isArray(body.tags) ? body.tags : clone(template.tags || []),
    };

    demoDb.vms.push(vmRecord);

    if (host) {
      host.resident_VMs = [...(host.resident_VMs || []), vmRef];
    }

    if (srRef) {
      if (!demoDb.vdis[srRef]) demoDb.vdis[srRef] = [];
      demoDb.vdis[srRef].push({
        ref: vdiRef,
        uuid: `${vdiRef.replace('OpaqueRef:', '')}-uuid`,
        SR: srRef,
        name_label: `${body.nameLabel}-root`,
        virtual_size: 42949672960,
        type: 'user',
        managed: true,
        VBDs: [vbdRef],
      });
    }

    if (network && vifRef) {
      network.VIFs = [...(network.VIFs || []), vifRef];
    }
    const governance = demoDb.templateGovernance.find((entry) => entry.templateRef === templateRef);
    const deploymentAudit = {
      id: `tmpldep-${Date.now()}`,
      templateRef,
      templateName: template.name_label || templateRef,
      templateVersion: governance?.versionLabel || '',
      vmRef,
      vmName: vmRecord.name_label,
      hostRef,
      hostLabel: resolveDemoInventoryLabel(demoDb.hosts, hostRef, ''),
      storageRef: srRef,
      storageLabel: resolveDemoInventoryLabel(demoDb.srs, srRef, ''),
      networkRef: body.networkRef || '',
      networkLabel: resolveDemoInventoryLabel(demoDb.networks, body.networkRef, ''),
      startAfter: Boolean(body.startAfter),
      submittedBy: store.username || 'demo',
      submittedAt: new Date().toISOString(),
      validationStatus: governance?.validationStatus === 'validated' ? 'pending' : 'warning',
      validationNotes: governance?.validationStatus === 'validated'
        ? 'Validate guest boot, networking, storage mapping, and policy tags after first start.'
        : 'Template governance is not fully validated yet. Review this deployment before promotion.',
      guestCustomization: governance?.guestCustomization || '',
      bootVerified: false,
      networkVerified: false,
      storageVerified: false,
      policyTagged: Array.isArray(body.tags) && body.tags.length > 0,
      updatedAt: new Date().toISOString(),
    };
    demoDb.templateDeployments.unshift(deploymentAudit);
    recordDemoAudit({
      category: 'templates',
      action: 'template_deployed',
      actionLabel: 'Deployed template to',
      entityType: 'vm',
      entityRef: vmRef,
      entityName: vmRecord.name_label,
      route: '/templates',
      before: template,
      after: { ...vmRecord, deploymentAudit },
      detail: `${template.name_label || templateRef} deployed with ${deploymentAudit.validationStatus} validation status.`,
    });

    return clone({ ...vmRecord, deploymentAudit });
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

  if (method === 'PUT' && path.startsWith('/api/vms/') && path.endsWith('/config')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_config_update', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    Object.assign(vm, {
      name_label: body.nameLabel,
      name_description: body.nameDescription || '',
      VCPUs_at_startup: Number(body.vcpus || 1),
      VCPUs_max: Number(body.vcpus || 1),
      memory_static_max: Number(body.memoryStaticMax || 0),
      memory_dynamic_max: Number(body.memoryStaticMax || 0),
      tags: Array.isArray(body.tags) ? body.tags : [],
    });

    return clone(vm);
  }

  if (method === 'POST' && path.startsWith('/api/vms/') && path.endsWith('/disks')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_disk_add', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    const vbdRef = nextDemoOpaqueRef('vbd');
    const vdiRef = nextDemoOpaqueRef('vdi');
    const srRef = body.srRef;
    const vdi = {
      ref: vdiRef,
      uuid: vdiRef.replace('OpaqueRef:', '') + '-uuid',
      SR: srRef,
      name_label: body.nameLabel,
      virtual_size: Number(body.sizeBytes || 0),
      type: 'user',
      managed: true,
      VBDs: [vbdRef],
    };

    if (!demoDb.vdis[srRef]) {
      demoDb.vdis[srRef] = [];
    }

    demoDb.vdis[srRef].push(vdi);
    vm.VBDs = [...(vm.VBDs || []), vbdRef];
    return { success: true, vdiRef, vbdRef };
  }

  if (method === 'POST' && path.startsWith('/api/vms/') && path.endsWith('/nics')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_nic_add', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    const network = demoDb.networks.find((entry) => entry.ref === body.networkRef);
    if (!vm) throw new Error('VM_NOT_FOUND');
    if (!network) throw new Error('NETWORK_NOT_FOUND');

    const vifRef = nextDemoOpaqueRef('vif');
    vm.VIFs = [...(vm.VIFs || []), vifRef];
    network.VIFs = [...(network.VIFs || []), vifRef];
    return { success: true, vifRef };
  }

  if (method === 'POST' && path.startsWith('/api/vms/')) {
    const action = path.split('/')[3];
    const actionKey = action === 'shutdown' ? 'vm_shutdown' : action === 'reboot' ? 'vm_reboot' : action === 'suspend' ? 'vm_suspend' : action === 'resume' ? 'vm_resume' : 'vm_start';
    ensureDemoMutationAllowed({
      actionKey,
      entityType: 'vm',
      entityRef: body.ref,
      destructive: ['shutdown', 'reboot', 'suspend'].includes(action),
      approvalId: body.approvalId || '',
    });
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
    return listDemoConnections();
  }

  if (method === 'POST' && path === '/api/connections') {
    ensureDemoMutationAllowed({ actionKey: 'connection_create', entityType: 'connection', entityRef: 'new' });
    const actor = getDemoActor();
    const nextRecord = {
      id: nextDemoId(demoDb.connections),
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      owner_user_id: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      is_default: body.isDefault ? 1 : 0,
      last_connected_at: '',
    };

    if (nextRecord.is_default) {
      demoDb.connections.forEach((connection) => {
        if (Number(connection.owner_user_id || 0) === Number(nextRecord.owner_user_id || 0)) {
          connection.is_default = 0;
        }
      });
    }

    demoDb.connections.push(nextRecord);
    return enrichDemoOwnedRecord(nextRecord, actor);
  }

  if (method === 'PUT' && path.startsWith('/api/connections/')) {
    ensureDemoMutationAllowed({ actionKey: 'connection_update', entityType: 'connection', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const record = demoDb.connections.find((connection) => connection.id === id);
    if (!record) throw new Error('CONNECTION_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('CONNECTION_FORBIDDEN');
      error.code = 'CONNECTION_FORBIDDEN';
      throw error;
    }

    Object.assign(record, {
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, record.visibility || 'private') : 'shared',
      owner_user_id: record.owner_user_id || actor.userId || null,
      is_default: body.isDefault ? 1 : 0,
    });

    if (record.is_default) {
      demoDb.connections.forEach((connection) => {
        if (connection.id !== id && Number(connection.owner_user_id || 0) === Number(record.owner_user_id || 0)) {
          connection.is_default = 0;
        }
      });
    }

    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'POST' && path.startsWith('/api/connections/') && path.endsWith('/default')) {
    ensureDemoMutationAllowed({ actionKey: 'connection_default', entityType: 'connection', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const record = demoDb.connections.find((connection) => connection.id === id);
    if (!record) throw new Error('CONNECTION_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('CONNECTION_FORBIDDEN');
      error.code = 'CONNECTION_FORBIDDEN';
      throw error;
    }

    demoDb.connections.forEach((connection) => {
      if (Number(connection.owner_user_id || 0) === Number(record.owner_user_id || 0)) {
        connection.is_default = connection.id === id ? 1 : 0;
      }
    });
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'DELETE' && path.startsWith('/api/connections/')) {
    ensureDemoMutationAllowed({ actionKey: 'connection_delete', entityType: 'connection', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const index = demoDb.connections.findIndex((connection) => connection.id === id);
    if (index === -1) throw new Error('CONNECTION_NOT_FOUND');
    if (!demoCanManageRecord(demoDb.connections[index], actor)) {
      const error = new Error('CONNECTION_FORBIDDEN');
      error.code = 'CONNECTION_FORBIDDEN';
      throw error;
    }
    demoDb.connections.splice(index, 1);
    return { success: true };
  }

  if (method === 'GET' && path === '/api/host-targets') {
    return listDemoHostTargets();
  }

  if (method === 'POST' && path === '/api/host-targets') {
    ensureDemoMutationAllowed({ actionKey: 'host_target_create', entityType: 'host-target', entityRef: 'new' });
    const actor = getDemoActor();
    const pool = demoDb.connections.find((connection) => connection.id === Number(body.poolConnectionId || 0));
    const record = {
      id: nextDemoId(demoDb.hostTargets),
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      owner_user_id: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      mode: body.mode || 'standalone',
      pool_connection_id: body.mode === 'pool-member' ? Number(body.poolConnectionId || 0) || null : null,
      pool_name: body.mode === 'pool-member' ? (pool?.name || null) : null,
      notes: body.notes || '',
    };
    demoDb.hostTargets.push(record);
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'PUT' && path.startsWith('/api/host-targets/')) {
    ensureDemoMutationAllowed({ actionKey: 'host_target_update', entityType: 'host-target', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const record = demoDb.hostTargets.find((target) => target.id === id);
    const pool = demoDb.connections.find((connection) => connection.id === Number(body.poolConnectionId || 0));
    if (!record) throw new Error('HOST_TARGET_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('HOST_TARGET_FORBIDDEN');
      error.code = 'HOST_TARGET_FORBIDDEN';
      throw error;
    }

    Object.assign(record, {
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      owner_user_id: record.owner_user_id || actor.userId || null,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, record.visibility || 'private') : 'shared',
      mode: body.mode || 'standalone',
      pool_connection_id: body.mode === 'pool-member' ? Number(body.poolConnectionId || 0) || null : null,
      pool_name: body.mode === 'pool-member' ? (pool?.name || null) : null,
      notes: body.notes || '',
    });
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'DELETE' && path.startsWith('/api/host-targets/')) {
    ensureDemoMutationAllowed({ actionKey: 'host_target_delete', entityType: 'host-target', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const index = demoDb.hostTargets.findIndex((target) => target.id === id);
    if (index === -1) throw new Error('HOST_TARGET_NOT_FOUND');
    if (!demoCanManageRecord(demoDb.hostTargets[index], actor)) {
      const error = new Error('HOST_TARGET_FORBIDDEN');
      error.code = 'HOST_TARGET_FORBIDDEN';
      throw error;
    }
    demoDb.hostTargets.splice(index, 1);
    return { success: true };
  }

  if (method === 'GET' && path === '/api/workspaces/inventory') {
    const workspaces = listDemoInventoryWorkspaces();
    return { total: workspaces.length, data: clone(workspaces) };
  }

  if (method === 'POST' && path === '/api/workspaces/inventory') {
    ensureDemoMutationAllowed({ actionKey: 'inventory_workspace_save', entityType: 'workspace', entityRef: 'new' });
    const actor = getDemoActor();
    const record = {
      id: `workspace-${demoDb.inventoryWorkspaces.length + 1}`,
      name: body.name,
      scope: body.scope || 'all',
      query: body.query || '',
      targetConnectionId: body.targetConnectionId ?? null,
      notes: body.notes || '',
      ownerUserId: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: store.username || 'demo',
    };
    demoDb.inventoryWorkspaces.unshift(record);
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'PUT' && path.startsWith('/api/workspaces/inventory/')) {
    ensureDemoMutationAllowed({ actionKey: 'inventory_workspace_save', entityType: 'workspace', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const actor = getDemoActor();
    const id = decodeURIComponent(path.split('/')[4] || '');
    const record = demoDb.inventoryWorkspaces.find((workspace) => workspace.id === id);
    if (!record) throw new Error('INVENTORY_WORKSPACE_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('INVENTORY_WORKSPACE_FORBIDDEN');
      error.code = 'INVENTORY_WORKSPACE_FORBIDDEN';
      throw error;
    }

    Object.assign(record, {
      name: body.name,
      scope: body.scope || 'all',
      query: body.query || '',
      targetConnectionId: body.targetConnectionId ?? null,
      notes: body.notes || '',
      ownerUserId: record.ownerUserId || actor.userId || null,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, record.visibility || 'private') : 'shared',
      updatedAt: new Date().toISOString(),
    });
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'DELETE' && path.startsWith('/api/workspaces/inventory/')) {
    ensureDemoMutationAllowed({ actionKey: 'inventory_workspace_delete', entityType: 'workspace', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const actor = getDemoActor();
    const id = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.inventoryWorkspaces.findIndex((workspace) => workspace.id === id);
    if (index === -1) throw new Error('INVENTORY_WORKSPACE_NOT_FOUND');
    if (!demoCanManageRecord(demoDb.inventoryWorkspaces[index], actor)) {
      const error = new Error('INVENTORY_WORKSPACE_FORBIDDEN');
      error.code = 'INVENTORY_WORKSPACE_FORBIDDEN';
      throw error;
    }
    demoDb.inventoryWorkspaces.splice(index, 1);
    return { success: true };
  }

  throw new Error(`DEMO_ROUTE_UNSUPPORTED: ${method} ${path}`);
}
