const { test, expect } = require('@playwright/test');

async function stubAuthenticatedRoutes(page) {
  const connections = [
    { id: 1, name: 'Production Pool', host: '10.0.0.1', username: 'root', port: 443, is_default: 1 },
  ];
  const hostTargets = [
    { id: 1, name: 'branch-host-r4', host: '10.0.0.25', username: 'root', port: 443, mode: 'standalone', pool_connection_id: null, pool_name: null, notes: '' },
  ];
  const credentials = [
    {
      id: 1,
      ownerUserId: 1,
      scope: 'shared',
      targetType: 'pool',
      targetHint: '10.0.0.1',
      name: 'Production Pool Root',
      username: 'root',
      createdAt: '2026-08-24T09:00:00.000Z',
      updatedAt: '2026-08-24T09:05:00.000Z',
      lastUsedAt: '2026-08-24T09:15:00.000Z',
      lastUsedBy: 1,
    },
  ];
  const hostInventory = [
    {
      ref: 'OpaqueRef:host1',
      name_label: 'alpha-xen',
      address: '10.0.0.11',
      uuid: 'host-uuid-1',
      pool: 'OpaqueRef:pool1',
      enabled: true,
      tags: ['prod'],
      PIFs: ['OpaqueRef:pif1', 'OpaqueRef:pif2'],
      PBDs: ['OpaqueRef:pbd1'],
      cpu_info: { cpu_count: '24', modelname: 'AMD EPYC' },
      resident_VMs: ['OpaqueRef:vm1'],
    },
    {
      ref: 'OpaqueRef:host2',
      name_label: 'beta-xen',
      address: '10.0.0.12',
      uuid: 'host-uuid-2',
      pool: 'OpaqueRef:pool1',
      enabled: true,
      tags: ['prod'],
      PIFs: ['OpaqueRef:pif3', 'OpaqueRef:pif4'],
      PBDs: ['OpaqueRef:pbd1'],
      cpu_info: { cpu_count: '24', modelname: 'AMD EPYC' },
      resident_VMs: ['OpaqueRef:vm2'],
    },
  ];
  const vmInventory = [
    {
      ref: 'OpaqueRef:vm1',
      name_label: 'app-01',
      name_description: 'Primary application node',
      power_state: 'Running',
      VCPUs_at_startup: 4,
      VCPUs_max: 4,
      memory_static_max: 8589934592,
      memory_dynamic_max: 8589934592,
      uuid: 'vm-uuid-1',
      tags: ['prod'],
      resident_on: 'OpaqueRef:host1',
      affinity: 'OpaqueRef:host1',
      VBDs: ['OpaqueRef:vbd1'],
      VIFs: ['OpaqueRef:vif1'],
      HVM_boot_policy: 'UEFI',
      platform: { secureboot: 'enabled' },
    },
    {
      ref: 'OpaqueRef:vm2',
      name_label: 'db-01',
      name_description: 'Database node',
      power_state: 'Running',
      VCPUs_at_startup: 8,
      VCPUs_max: 8,
      memory_static_max: 17179869184,
      memory_dynamic_max: 17179869184,
      uuid: 'vm-uuid-2',
      tags: ['prod', 'database'],
      resident_on: 'OpaqueRef:host2',
      affinity: 'OpaqueRef:host2',
      VBDs: ['OpaqueRef:vbd2'],
      VIFs: [],
      HVM_boot_policy: 'UEFI',
      platform: { secureboot: 'enabled' },
    },
  ];
  const templateInventory = [
    {
      ref: 'OpaqueRef:template1',
      name_label: 'ubuntu-golden',
      name_description: 'Golden Ubuntu image for service deployments',
      VCPUs_at_startup: 2,
      memory_static_max: 4294967296,
      uuid: 'template-uuid-1',
      is_a_template: true,
      tags: ['golden', 'linux', 'stable', 'baseline'],
      platform: { secureboot: 'enabled' },
    },
    {
      ref: 'OpaqueRef:template2',
      name_label: 'windows-2025-core',
      name_description: 'Windows Server 2025 hardened candidate',
      VCPUs_at_startup: 4,
      memory_static_max: 8589934592,
      uuid: 'template-uuid-2',
      is_a_template: true,
      tags: ['golden', 'windows', 'staged'],
      platform: { vtpm: 'enabled' },
    },
  ];
  const templateGovernance = [
    {
      templateRef: 'OpaqueRef:template1',
      versionLabel: '2026.08-lts',
      profileLabel: 'Secure Linux',
      lifecycleStage: 'stable',
      goldenImage: true,
      guestCustomization: 'cloud-init baseline',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-19T00:00:00.000Z',
      owner: 'Platform Ops',
      notes: 'Approved for production rollout.',
      updatedAt: '2026-08-19T12:20:00.000Z',
    },
    {
      templateRef: 'OpaqueRef:template2',
      versionLabel: '2026.08-hardened',
      profileLabel: 'Secure Windows',
      lifecycleStage: 'staged',
      goldenImage: true,
      guestCustomization: 'sysprep-core',
      validationStatus: 'validated',
      lastValidatedAt: '2026-08-20T00:00:00.000Z',
      owner: 'Windows Platform',
      notes: 'Validated for promotion after the Monday, August 24, 2026 review gate.',
      updatedAt: '2026-08-20T11:20:00.000Z',
    },
  ];
  const templateGovernanceHistory = [
    {
      id: 'tmplhist-seed-1',
      templateRef: 'OpaqueRef:template1',
      templateName: 'ubuntu-golden',
      eventType: 'saved',
      actor: 'root',
      happenedAt: '2026-08-19T12:20:00.000Z',
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: '2026.08-lts governance saved after production baseline review.',
      snapshot: {
        templateRef: 'OpaqueRef:template1',
        versionLabel: '2026.08-lts',
        profileLabel: 'Secure Linux',
        lifecycleStage: 'stable',
        goldenImage: true,
        guestCustomization: 'cloud-init baseline',
        validationStatus: 'validated',
        lastValidatedAt: '2026-08-19T00:00:00.000Z',
        owner: 'Platform Ops',
        notes: 'Approved for production rollout.',
        updatedAt: '2026-08-19T12:20:00.000Z',
      },
    },
    {
      id: 'tmplhist-seed-2',
      templateRef: 'OpaqueRef:template2',
      templateName: 'windows-2025-core',
      eventType: 'saved',
      actor: 'root',
      happenedAt: '2026-08-20T11:20:00.000Z',
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: '2026.08-hardened governance saved pending promotion review.',
      snapshot: {
        templateRef: 'OpaqueRef:template2',
        versionLabel: '2026.08-hardened',
        profileLabel: 'Secure Windows',
        lifecycleStage: 'staged',
        goldenImage: true,
        guestCustomization: 'sysprep-core',
        validationStatus: 'validated',
        lastValidatedAt: '2026-08-20T00:00:00.000Z',
        owner: 'Windows Platform',
        notes: 'Validated for promotion after the Monday, August 24, 2026 review gate.',
        updatedAt: '2026-08-20T11:20:00.000Z',
      },
    },
  ];
  const templateDeployments = [];
  const storageInventory = [
    {
      ref: 'OpaqueRef:sr1',
      name_label: 'Primary SR',
      type: 'lvm',
      physical_size: 32212254720,
      virtual_allocation: 21474836480,
      uuid: 'sr-uuid-1',
      PBDs: ['OpaqueRef:pbd1'],
    },
  ];
  const vdiInventory = [
    { ref: 'OpaqueRef:vdi1', SR: 'OpaqueRef:sr1', name_label: 'disk-01', virtual_size: 10737418240, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd1'] },
  ];
  const networkInventory = [
    {
      ref: 'OpaqueRef:net1',
      name_label: 'VM Network',
      bridge: 'xenbr0',
      managed: true,
      uuid: 'net-uuid-1',
      VIFs: ['OpaqueRef:vif1'],
      PIFs: ['OpaqueRef:pif1', 'OpaqueRef:pif3'],
      other_config: { vlan: '120' },
    },
    {
      ref: 'OpaqueRef:net2',
      name_label: 'Backup Network',
      bridge: 'xenbr1',
      managed: true,
      uuid: 'net-uuid-2',
      VIFs: [],
      PIFs: ['OpaqueRef:pif2', 'OpaqueRef:pif4'],
      other_config: { vlan: '220' },
    },
  ];
  const alertInventory = [
    {
      ref: 'OpaqueRef:msg1',
      name: 'Storage nearing threshold',
      cls: 'SR',
      body: 'Primary SR crossed the warning threshold.',
      timestamp: '2026-08-19T12:00:00.000Z',
      uuid: 'msg-uuid-1',
      obj_uuid: 'sr-uuid-1',
    },
    {
      ref: 'OpaqueRef:msg2',
      name: 'Host maintenance scheduled',
      cls: 'host',
      body: 'alpha-xen entered a maintenance preparation window.',
      timestamp: '2026-08-19T11:40:00.000Z',
      uuid: 'msg-uuid-2',
      obj_uuid: 'host-uuid-1',
    },
  ];
  const alertStates = {};
  const alertPolicies = [];
  const remediationTemplates = [];
  const lifecyclePlans = [];
  const inventoryWorkspaces = [];
  const governancePolicy = {
    defaultRole: 'admin',
    requireDestructiveApproval: true,
    approvalTtlMinutes: 240,
  };
  let governanceCurrentRole = 'admin';
  const governanceQuotas = [
    {
      poolRef: 'OpaqueRef:pool1',
      enabled: true,
      owner: 'Platform Ops',
      maxVmCount: 8,
      maxRunningVmCount: 6,
      maxTotalMemoryGiB: 48,
      notes: 'Production cap for Friday, August 21, 2026 operations.',
      updatedAt: '2026-08-21T08:30:00.000Z',
    },
  ];
  const governanceApprovals = [
    {
      id: 'approval-seed-1',
      actionKey: 'vm_shutdown',
      entityType: 'vm',
      entityRef: 'OpaqueRef:vm2',
      entityName: 'db-01',
      requestedBy: 'root',
      justification: 'Controlled shutdown during the Friday, August 21, 2026 maintenance window.',
      route: '/vms',
      status: 'approved',
      requestedAt: '2026-08-21T09:10:00.000Z',
      expiresAt: '2026-08-21T13:10:00.000Z',
      decidedBy: 'root',
      decidedAt: '2026-08-21T09:15:00.000Z',
      decisionNotes: 'Approved for the maintenance window.',
      usedBy: '',
      usedAt: '',
    },
  ];
  const users = [
    {
      id: 1,
      username: 'admin',
      display_name: 'Platform Administrator',
      email: 'admin@xenmange.local',
      role: 'admin',
      active: true,
      created_at: '2026-08-20T08:00:00.000Z',
      last_login_at: '2026-08-24T08:14:00.000Z',
      groups: ['Platform Operations'],
      group_count: 1,
    },
    {
      id: 2,
      username: 'readonly-analyst',
      display_name: 'Read Only Analyst',
      email: 'analyst@xenmange.local',
      role: 'read-only',
      active: true,
      created_at: '2026-08-21T09:00:00.000Z',
      last_login_at: '2026-08-23T15:20:00.000Z',
      groups: ['Reporting'],
      group_count: 1,
    },
  ];
  const systemConfig = {
    general: {
      appName: 'XenMange',
      timezone: 'America/Chicago',
    },
    network: {
      publicBaseUrl: 'https://xenmange.example.com',
      trustProxy: true,
    },
    security: {
      sessionMaxAgeMs: 7200000,
      failedLoginWindowMinutes: 15,
      failedLoginMaxAttempts: 20,
    },
    logging: {
      level: 'info',
      structuredJson: false,
    },
    retention: {
      sweepIntervalHours: 24,
      vacuumAfterSweep: true,
    },
    vault: {
      hasConfiguredMasterKey: true,
      usingDevelopmentFallback: false,
      hasPreviousMasterKey: true,
      rotationRecommended: false,
      keySource: 'environment',
      vaultDatabasePath: './data/vault.db',
    },
    runtime: {
      env: 'test',
      port: 3000,
      restartRequiredSettings: ['server.port', 'security.failedLoginWindowMinutes', 'security.failedLoginMaxAttempts'],
      liveAppliedSettings: ['net.trustProxy', 'security.sessionMaxAgeMs', 'logging.level', 'logging.structuredJson', 'retention.sweepIntervalHours', 'retention.vacuumAfterSweep'],
    },
  };
  const retentionPolicies = [
    {
      domain: 'audit-log',
      label: 'Audit Log',
      description: 'Historical operator and configuration change entries kept in xenmange.db.',
      enabled: true,
      retentionDays: 180,
      lastRunAt: '2026-08-22T18:10:00.000Z',
      lastPurgedCount: 2,
    },
    {
      domain: 'remediation-tasks',
      label: 'Remediation Tasks',
      description: 'Closed remediation queue items whose follow-through has already completed.',
      enabled: true,
      retentionDays: 90,
      lastRunAt: '2026-08-22T18:10:00.000Z',
      lastPurgedCount: 1,
    },
    {
      domain: 'auth-events',
      label: 'Authentication Events',
      description: 'Login and logout activity persisted in security.db for traceability.',
      enabled: true,
      retentionDays: 60,
      lastRunAt: '',
      lastPurgedCount: 0,
    },
  ];
  const resilienceRunbooks = [
    {
      poolRef: 'OpaqueRef:pool1',
      recoveryTier: 'tier-1',
      haPolicy: 'auto-failover',
      restartPriority: 'high',
      backupWindowHours: 12,
      rpoMinutes: 30,
      rtoMinutes: 90,
      restorePointStatus: 'review',
      owner: 'Platform Ops',
      standbyHostRef: 'OpaqueRef:host2',
      failoverNetworkRef: 'OpaqueRef:net2',
      lastVerifiedAt: '2026-08-20T15:10:00.000Z',
      runbookSteps: [
        'Confirm the latest backup chain for the production pool.',
        'Evacuate app-01 and db-01 to the standby host before failover.',
        'Validate backup network and storage attach readiness.',
        'Run an application restore verification and capture findings.',
      ],
      notes: 'Database dependency ordering must be verified before service cutover.',
      updatedAt: '2026-08-20T15:10:00.000Z',
    },
  ];
  const resilienceDrills = [
    {
      id: 'drill-seed-1',
      poolRef: 'OpaqueRef:pool1',
      drillType: 'restore',
      status: 'warning',
      scope: 'Pool-wide restore validation',
      executedAt: '2026-08-20T09:10:00.000Z',
      durationMinutes: 47,
      summary: 'Recovery path worked but startup ordering still needs tuning.',
      findings: 'Database dependency ordering added 9 minutes to recovery time.',
      nextStep: 'Update the runbook order and repeat the drill before August 28, 2026.',
      operator: 'root',
      createdAt: '2026-08-20T09:15:00.000Z',
    },
  ];
  const tasks = [
    {
      ref: 'OpaqueRef:task1',
      name_label: 'Migrate app-01',
      status: 'success',
      progress: 1,
      created: '2026-08-19T11:50:00.000Z',
      finished: '2026-08-19T11:53:00.000Z',
      uuid: 'task-uuid-1',
      error_info: [],
    },
    {
      ref: 'OpaqueRef:task2',
      name_label: 'Patch compliance scan',
      status: 'pending',
      progress: 0.4,
      created: '2026-08-19T12:10:00.000Z',
      finished: '',
      uuid: 'task-uuid-2',
      error_info: [],
    },
  ];
  const auditLog = [
    {
      id: 'audit-seed-1',
      category: 'session',
      action: 'session_login',
      actionLabel: 'Logged into Xen host',
      entityType: 'session',
      entityRef: '10.0.0.1',
      entityName: '10.0.0.1',
      operator: 'root',
      route: '/login',
      status: 'success',
      before: null,
      after: { host: '10.0.0.1', username: 'root' },
      changedFields: [],
      summary: 'Logged into Xen host 10.0.0.1',
      detail: 'Authenticated to 10.0.0.1 as root.',
      happenedAt: '2026-08-20T08:05:00.000Z',
    },
  ];
  const authEvents = [
    {
      id: 'auth-seed-1',
      username: 'root',
      event_type: 'login_success',
      ip_address: '10.0.0.1',
      user_agent: 'Playwright Auth Fixture',
      created_at: '2026-08-20T08:04:30.000Z',
    },
  ];
  let targetAttached = false;

  const buildChangedFields = (before = null, after = null) => {
    const left = before && typeof before === 'object' ? before : {};
    const right = after && typeof after === 'object' ? after : {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys]
      .filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]))
      .slice(0, 12)
      .map((key) => ({
        field: key,
        before: left[key] === undefined || left[key] === null || left[key] === '' ? '-' : String(left[key]),
        after: right[key] === undefined || right[key] === null || right[key] === '' ? '-' : String(right[key]),
      }));
  };

  const recordAudit = (entry) => {
    const before = entry.before ? JSON.parse(JSON.stringify(entry.before)) : null;
    const after = entry.after ? JSON.parse(JSON.stringify(entry.after)) : null;
    const record = {
      id: entry.id || `audit-${auditLog.length + 1}`,
      category: entry.category || 'operations',
      action: entry.action || 'update',
      actionLabel: entry.actionLabel || '',
      entityType: entry.entityType || 'record',
      entityRef: entry.entityRef || '',
      entityName: entry.entityName || '',
      operator: entry.operator || 'root',
      route: entry.route || '',
      status: entry.status || 'success',
      before,
      after,
      changedFields: entry.changedFields || buildChangedFields(before, after),
      summary: entry.summary || `${entry.actionLabel || entry.action || 'Updated'} ${entry.entityName || entry.entityRef || ''}`.trim(),
      detail: entry.detail || '',
      happenedAt: entry.happenedAt || '2026-08-20T09:30:00.000Z',
    };
    auditLog.unshift(record);
    return record;
  };

  const fulfillNeedsConnection = async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'XEN_TARGET_NOT_CONNECTED' }),
    });
  };

  const buildLogEntries = () => {
    const authEntries = authEvents.map((entry) => ({
      id: `auth:${entry.id}`,
      source: 'auth',
      category: 'auth',
      timestamp: entry.created_at || '',
      actor: entry.username || 'unknown',
      operator: entry.username || 'unknown',
      entityType: 'session',
      entityRef: entry.ip_address || '',
      entityName: entry.username || 'Unknown User',
      message: `${entry.username || 'User'} ${String(entry.event_type || 'auth_event').replace(/_/g, ' ')}`.trim(),
      detail: `${entry.user_agent || 'Unknown client'} from ${entry.ip_address || 'unknown address'}`.trim(),
      severity: String(entry.event_type || '').includes('failure') ? 'failure' : 'success',
      route: '/login',
      status: String(entry.event_type || '').includes('failure') ? 'failure' : 'success',
      action: entry.event_type || 'auth_event',
      raw: entry,
    }));

    const auditEntries = auditLog.map((entry) => ({
      id: `audit:${entry.id}`,
      source: 'audit',
      category: entry.category || 'operations',
      timestamp: entry.happenedAt || '',
      actor: entry.operator || 'root',
      operator: entry.operator || 'root',
      entityType: entry.entityType || 'record',
      entityRef: entry.entityRef || '',
      entityName: entry.entityName || '',
      message: entry.summary || entry.detail || entry.actionLabel || entry.action || 'Audit entry',
      detail: entry.detail || '',
      severity: String(entry.status || 'success').toLowerCase(),
      route: entry.route || '',
      status: entry.status || 'success',
      action: entry.action || '',
      raw: entry,
    }));

    const alertEntries = alertInventory.map((entry) => ({
      id: `alert:${entry.ref}`,
      source: 'alert',
      category: 'alerts',
      timestamp: entry.timestamp || '',
      actor: 'system',
      operator: 'system',
      entityType: 'alert',
      entityRef: entry.ref || '',
      entityName: entry.name || '',
      message: entry.name || entry.body || 'Alert',
      detail: entry.body || '',
      severity: entry.ref === 'OpaqueRef:msg1' ? 'warning' : 'info',
      route: entry.cls === 'SR' ? '/storage' : '/hosts',
      status: 'open',
      action: '',
      raw: entry,
    }));

    const remediationEntries = tasks
      .filter((entry) => entry.task_kind === 'remediation' || entry.source === 'remediation')
      .map((entry) => ({
        id: `remediation-task:${entry.ref}`,
        source: 'remediation-task',
        category: 'tasks',
        timestamp: entry.finished || entry.created || '',
        actor: entry.created_by || entry.assignee || 'root',
        operator: entry.created_by || entry.assignee || 'root',
        entityType: 'task',
        entityRef: entry.ref || '',
        entityName: entry.name_label || '',
        message: entry.name_label || 'Remediation task',
        detail: entry.result || entry.name_description || '',
        severity: String(entry.status || 'pending').toLowerCase(),
        route: '/activity',
        status: entry.status || 'pending',
        action: entry.action_type || '',
        raw: entry,
      }));

    const xenTaskEntries = tasks
      .filter((entry) => entry.task_kind !== 'remediation' && entry.source !== 'remediation')
      .map((entry) => ({
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
        detail: entry.result || '',
        severity: String(entry.status || 'pending').toLowerCase(),
        route: '/activity',
        status: entry.status || 'pending',
        action: entry.name_label || '',
        raw: entry,
      }));

    return [...authEntries, ...auditEntries, ...alertEntries, ...remediationEntries, ...xenTaskEntries]
      .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
  };

  const buildTrendPoints = (latestValue, { range = '24h', amplitude = 5, floor = 0, ceiling = Number.MAX_SAFE_INTEGER, seed = 'metric' } = {}) => {
    const pointCounts = { '1h': 6, '6h': 8, '24h': 12, '7d': 10, '30d': 12 };
    const totalMsByRange = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const normalizedRange = totalMsByRange[range] ? range : '24h';
    const count = pointCounts[normalizedRange];
    const stepMs = totalMsByRange[normalizedRange] / (count - 1);
    const hash = String(seed).split('').reduce((sum, character, index) => sum + (character.charCodeAt(0) * (index + 1)), 0);
    const now = Date.parse('2026-08-24T10:30:00.000Z');

    return Array.from({ length: count }, (_, index) => {
      const wave = Math.sin((index + 1) * 0.85 + hash / 25) * amplitude;
      const drift = (index - (count / 2)) * (amplitude / count) * 0.18;
      const value = Math.max(floor, Math.min(ceiling, Number(latestValue || 0) + wave + drift));

      return {
        ts: Math.round(now - ((count - index - 1) * stepMs)),
        value: Math.round(value * 100) / 100,
      };
    });
  };

  const buildClusterMetricHistory = (range = '24h') => {
    const hostTotals = {
      'OpaqueRef:host1': { total: 68719476736, free: 12884901888 },
      'OpaqueRef:host2': { total: 68719476736, free: 25769803776 },
    };
    const totalMemory = Object.values(hostTotals).reduce((sum, entry) => sum + entry.total, 0);
    const usedMemory = Object.values(hostTotals).reduce((sum, entry) => sum + (entry.total - entry.free), 0);
    const totalStorage = storageInventory.reduce((sum, entry) => sum + Number(entry.physical_size || 0), 0);
    const usedStorage = storageInventory.reduce((sum, entry) => sum + Number(entry.virtual_allocation || 0), 0);
    const vmMemory = vmInventory.reduce((sum, entry) => sum + Number(entry.memory_static_max || 0), 0);

    return {
      range,
      generatedAt: '2026-08-24T10:30:00.000Z',
      metrics: [
        {
          metricName: 'cluster_memory_used_percent',
          points: buildTrendPoints((usedMemory / totalMemory) * 100, { range, amplitude: 6, floor: 0, ceiling: 100, seed: 'cluster-memory' }),
        },
        {
          metricName: 'cluster_storage_utilization_percent',
          points: buildTrendPoints((usedStorage / totalStorage) * 100, { range, amplitude: 5, floor: 0, ceiling: 100, seed: 'cluster-storage' }),
        },
        {
          metricName: 'cluster_vm_memory_actual_bytes',
          points: buildTrendPoints(vmMemory * 0.78, { range, amplitude: vmMemory * 0.05, floor: 0, seed: 'cluster-vm-memory' }),
        },
      ],
    };
  };

  const buildHostMetricHistory = (ref, range = '24h') => {
    const metricsByRef = {
      'OpaqueRef:host1': { total: 68719476736, free: 12884901888 },
      'OpaqueRef:host2': { total: 68719476736, free: 25769803776 },
    };
    const metrics = metricsByRef[ref] || { total: 0, free: 0 };
    const used = Math.max(0, metrics.total - metrics.free);
    return {
      entityType: 'host',
      entityRef: ref,
      range,
      generatedAt: '2026-08-24T10:30:00.000Z',
      metrics: [
        { metricName: 'memory_total_bytes', points: buildTrendPoints(metrics.total, { range, amplitude: 0, seed: `${ref}-total` }) },
        { metricName: 'memory_free_bytes', points: buildTrendPoints(metrics.free, { range, amplitude: metrics.total * 0.05, floor: 0, ceiling: metrics.total, seed: `${ref}-free` }) },
        { metricName: 'memory_used_bytes', points: buildTrendPoints(used, { range, amplitude: metrics.total * 0.04, floor: 0, ceiling: metrics.total, seed: `${ref}-used` }) },
        { metricName: 'memory_used_percent', points: buildTrendPoints(metrics.total ? (used / metrics.total) * 100 : 0, { range, amplitude: 6, floor: 0, ceiling: 100, seed: `${ref}-used-percent` }) },
      ],
    };
  };

  const buildVmMetricHistory = (ref, range = '24h') => {
    const vm = vmInventory.find((entry) => entry.ref === ref) || {};
    const configured = Number(vm.memory_static_max || vm.memory_dynamic_max || 0);
    const actual = configured * 0.78;
    return {
      entityType: 'vm',
      entityRef: ref,
      range,
      generatedAt: '2026-08-24T10:30:00.000Z',
      metrics: [
        { metricName: 'memory_actual_bytes', points: buildTrendPoints(actual, { range, amplitude: configured * 0.08, floor: 0, ceiling: configured, seed: `${ref}-actual` }) },
        { metricName: 'memory_static_max_bytes', points: buildTrendPoints(configured, { range, amplitude: 0, seed: `${ref}-static` }) },
        { metricName: 'memory_usage_percent', points: buildTrendPoints(configured ? (actual / configured) * 100 : 0, { range, amplitude: 8, floor: 0, ceiling: 100, seed: `${ref}-usage` }) },
        { metricName: 'vcpu_count', points: buildTrendPoints(Number(vm.VCPUs_at_startup || 0), { range, amplitude: 0, seed: `${ref}-vcpu` }) },
      ],
    };
  };

  const buildStorageMetricHistory = (ref, range = '24h') => {
    const sr = storageInventory.find((entry) => entry.ref === ref) || {};
    const allocation = Number(sr.virtual_allocation || 0);
    const physical = Number(sr.physical_size || 0);
    return {
      entityType: 'sr',
      entityRef: ref,
      range,
      generatedAt: '2026-08-24T10:30:00.000Z',
      metrics: [
        { metricName: 'allocation_bytes', points: buildTrendPoints(allocation, { range, amplitude: physical * 0.03, floor: 0, ceiling: physical, seed: `${ref}-allocation` }) },
        { metricName: 'physical_bytes', points: buildTrendPoints(physical, { range, amplitude: 0, seed: `${ref}-physical` }) },
        { metricName: 'utilization_percent', points: buildTrendPoints(physical ? (allocation / physical) * 100 : 0, { range, amplitude: 4, floor: 0, ceiling: 100, seed: `${ref}-utilization` }) },
      ],
    };
  };

  const inferSeverity = (message) => {
    const haystack = `${message?.name || ''} ${message?.body || ''} ${message?.cls || ''}`.toLowerCase();
    if (/(critical|fatal|failed|failure|panic|error|offline|down|corrupt|exhausted|unavailable)/.test(haystack)) return 'critical';
    if (/(warn|warning|degraded|threshold|latency|retry|paused|stopped|maintenance|high)/.test(haystack)) return 'warning';
    if (/(resolved|healthy|restored|recovered|success|info|notice)/.test(haystack)) return 'info';
    return 'notice';
  };

  const getAlertRoute = (cls = '') => {
    const value = String(cls).toLowerCase();
    if (value === 'host') return '/hosts';
    if (value === 'sr' || value === 'vdi' || value === 'vbd') return '/storage';
    if (value === 'vm') return '/vms';
    if (value === 'pool') return '/pools';
    if (value === 'network' || value === 'vif' || value === 'pif') return '/networking';
    if (value === 'task') return '/activity';
    return '/inventory';
  };

  const getAlertLabel = (cls = '') => {
    const route = getAlertRoute(cls);
    if (route === '/hosts') return 'Host View';
    if (route === '/storage') return 'Storage View';
    if (route === '/vms') return 'VM View';
    if (route === '/pools') return 'Pool View';
    if (route === '/networking') return 'Network View';
    if (route === '/activity') return 'Activity View';
    return 'Inventory View';
  };

  const buildAlertRecord = (message) => {
    const state = alertStates[message.ref] || {};
    const baseSeverity = inferSeverity(message);
    const targetRoute = getAlertRoute(message.cls);
    const matchingPolicies = alertPolicies
      .filter((policy) => {
        if (!policy.enabled || !policy.name) return false;
        if (policy.matchClass && policy.matchClass !== String(message.cls || '').toLowerCase()) return false;
        if (policy.matchTargetRoute && policy.matchTargetRoute !== targetRoute) return false;
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
      })
      .sort((left, right) => {
        const leftScore = (left.matchClass ? 2 : 0) + (left.matchTargetRoute ? 2 : 0) + (left.matchSeverity ? 2 : 0) + (left.matchObject ? 3 + left.matchObject.length / 100 : 0) + (left.matchText ? 3 + left.matchText.length / 100 : 0);
        const rightScore = (right.matchClass ? 2 : 0) + (right.matchTargetRoute ? 2 : 0) + (right.matchSeverity ? 2 : 0) + (right.matchObject ? 3 + right.matchObject.length / 100 : 0) + (right.matchText ? 3 + right.matchText.length / 100 : 0);
        return rightScore - leftScore;
      });
    const policy = matchingPolicies[0] || null;
    const hasManualState = Boolean(state.updatedAt);
    const policyState = policy ? {
      acknowledged: Boolean(policy.autoAcknowledge),
      acknowledgedAt: policy.autoAcknowledge ? (message.timestamp || '2026-08-22T12:00:00.000Z') : '',
      acknowledgedBy: policy.autoAcknowledge ? `policy:${policy.name}` : '',
      suppressionUntil: policy.suppressionHours > 0
        ? new Date(new Date(message.timestamp || '2026-08-22T12:00:00.000Z').getTime() + policy.suppressionHours * 60 * 60 * 1000).toISOString()
        : '',
      severityOverride: policy.severityOverride || '',
      healthAction: policy.healthAction || 'none',
      notes: policy.notes || '',
      updatedAt: policy.updatedAt || '2026-08-22T12:00:00.000Z',
      policyId: policy.id,
      policyName: policy.name,
    } : null;
    const mergedState = hasManualState ? state : { ...(policyState || {}), ...state };
    const suppressionUntil = mergedState.suppressionUntil || '';
    const suppressed = suppressionUntil ? new Date(suppressionUntil).getTime() > Date.now() : false;

    return {
      ...message,
      summary: message.name || message.body || message.cls || 'Alert',
      baseSeverity,
      effectiveSeverity: mergedState.severityOverride || baseSeverity,
      targetRoute,
      targetLabel: getAlertLabel(message.cls),
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
  };

  await page.route('**/api/connections', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(connections),
      });
      return;
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const record = {
        id: connections.length + 1,
        name: payload.name,
        host: payload.host,
        username: payload.username,
        port: payload.port || 443,
        is_default: payload.isDefault ? 1 : 0,
      };
      if (record.is_default) {
        connections.forEach((connection) => { connection.is_default = 0; });
      }
      connections.push(record);
      recordAudit({
        category: 'connections',
        action: 'connection_created',
        actionLabel: 'Registered pool target',
        entityType: 'connection',
        entityRef: String(record.id),
        entityName: record.name,
        route: '/pools',
        after: record,
        detail: `${record.host}:${record.port} saved for future logins.`,
        happenedAt: '2026-08-20T09:01:00.000Z',
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(connections),
    });
  });

  await page.route('**/api/connections/*', async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split('/');
    const id = Number(parts[3]);
    const method = route.request().method();

    if (method === 'PUT') {
      const payload = route.request().postDataJSON();
      const record = connections.find((connection) => connection.id === id);
      const previous = { ...record };
      Object.assign(record, {
        name: payload.name,
        host: payload.host,
        username: payload.username,
        port: payload.port || 443,
        is_default: payload.isDefault ? 1 : 0,
      });
      if (record.is_default) {
        connections.forEach((connection) => {
          if (connection.id !== id) connection.is_default = 0;
        });
      }
      recordAudit({
        category: 'connections',
        action: 'connection_updated',
        actionLabel: 'Updated pool target',
        entityType: 'connection',
        entityRef: String(record.id),
        entityName: record.name,
        route: '/pools',
        before: previous,
        after: record,
        detail: `${record.host}:${record.port} connection metadata updated.`,
        happenedAt: '2026-08-20T09:02:00.000Z',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    if (method === 'DELETE') {
      const index = connections.findIndex((connection) => connection.id === id);
      const previous = index !== -1 ? { ...connections[index] } : null;
      if (index !== -1) connections.splice(index, 1);
      if (previous) {
        recordAudit({
          category: 'connections',
          action: 'connection_deleted',
          actionLabel: 'Removed pool target',
          entityType: 'connection',
          entityRef: String(id),
          entityName: previous.name,
          route: '/pools',
          before: previous,
          after: { success: true },
          detail: 'Saved connection removed from the management target catalog.',
          happenedAt: '2026-08-20T09:03:00.000Z',
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === 'POST' && url.pathname.endsWith('/default')) {
      const previous = connections.map((connection) => ({ id: connection.id, is_default: connection.is_default }));
      connections.forEach((connection) => { connection.is_default = connection.id === id ? 1 : 0; });
      const record = connections.find((connection) => connection.id === id);
      recordAudit({
        category: 'connections',
        action: 'connection_default_set',
        actionLabel: 'Set default pool target',
        entityType: 'connection',
        entityRef: String(id),
        entityName: record?.name || String(id),
        route: '/pools',
        before: previous,
        after: record,
        detail: 'Default connection target updated for the login workspace.',
        happenedAt: '2026-08-20T09:04:00.000Z',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/host-targets', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(hostTargets),
      });
      return;
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const pool = connections.find((connection) => connection.id === Number(payload.poolConnectionId || 0));
      const record = {
        id: hostTargets.length + 1,
        name: payload.name,
        host: payload.host,
        username: payload.username,
        port: payload.port || 443,
        mode: payload.mode,
        pool_connection_id: payload.mode === 'pool-member' ? Number(payload.poolConnectionId) : null,
        pool_name: payload.mode === 'pool-member' ? pool?.name || null : null,
        notes: payload.notes || '',
      };
      hostTargets.push(record);
      recordAudit({
        category: 'hosts',
        action: 'host_target_created',
        actionLabel: 'Registered host target',
        entityType: 'host-target',
        entityRef: String(record.id),
        entityName: record.name,
        route: '/hosts',
        after: record,
        detail: `${record.host}:${record.port} saved in ${record.mode} mode.`,
        happenedAt: '2026-08-20T09:05:00.000Z',
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/host-targets/*', async (route) => {
    const url = new URL(route.request().url());
    const id = Number(url.pathname.split('/')[3]);
    const method = route.request().method();

    if (method === 'PUT') {
      const payload = route.request().postDataJSON();
      const record = hostTargets.find((target) => target.id === id);
      const previous = { ...record };
      const pool = connections.find((connection) => connection.id === Number(payload.poolConnectionId || 0));
      Object.assign(record, {
        name: payload.name,
        host: payload.host,
        username: payload.username,
        port: payload.port || 443,
        mode: payload.mode,
        pool_connection_id: payload.mode === 'pool-member' ? Number(payload.poolConnectionId) : null,
        pool_name: payload.mode === 'pool-member' ? pool?.name || null : null,
        notes: payload.notes || '',
      });
      recordAudit({
        category: 'hosts',
        action: 'host_target_updated',
        actionLabel: 'Updated host target',
        entityType: 'host-target',
        entityRef: String(record.id),
        entityName: record.name,
        route: '/hosts',
        before: previous,
        after: record,
        detail: `${record.host}:${record.port} registration metadata updated.`,
        happenedAt: '2026-08-20T09:06:00.000Z',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    if (method === 'DELETE') {
      const index = hostTargets.findIndex((target) => target.id === id);
      const previous = index !== -1 ? { ...hostTargets[index] } : null;
      if (index !== -1) hostTargets.splice(index, 1);
      if (previous) {
        recordAudit({
          category: 'hosts',
          action: 'host_target_deleted',
          actionLabel: 'Removed host target',
          entityType: 'host-target',
          entityRef: String(id),
          entityName: previous.name,
          route: '/hosts',
          before: previous,
          after: { success: true },
          detail: 'Saved host target removed from the registration catalog.',
          happenedAt: '2026-08-20T09:07:00.000Z',
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/auth/login', async (route) => {
    targetAttached = false;
    recordAudit({
      category: 'session',
      action: 'app_session_login',
      actionLabel: 'Signed into XenMange as',
      entityType: 'user',
      entityRef: '1',
      entityName: 'admin',
      route: '/login',
      after: { id: 1, username: 'admin', role: 'admin' },
      detail: 'Signed into the XenMange control plane as admin.',
      happenedAt: '2026-08-20T08:14:00.000Z',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        authenticated: true,
        connected: false,
        authMode: 'local',
        username: 'admin',
        user: {
          id: 1,
          username: 'admin',
          displayName: 'Platform Administrator',
          role: 'admin',
        },
        governance: {
          currentRole: governanceCurrentRole,
          policy: governancePolicy,
        },
      }),
    });
  });

  await page.route('**/api/auth/xen-login', async (route) => {
    targetAttached = true;
    recordAudit({
      category: 'session',
      action: 'session_login',
      actionLabel: 'Logged into Xen host',
      entityType: 'session',
      entityRef: '10.0.0.1',
      entityName: '10.0.0.1',
      route: '/login',
      after: { host: '10.0.0.1', username: 'root' },
      detail: 'Authenticated to 10.0.0.1 as root.',
      happenedAt: '2026-08-20T08:15:00.000Z',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        authenticated: true,
        connected: true,
        authMode: 'legacy-xen',
        host: '10.0.0.1',
        username: 'root',
        governance: {
          currentRole: governanceCurrentRole,
          policy: governancePolicy,
        },
      }),
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    targetAttached = false;
    recordAudit({
      category: 'session',
      action: 'session_logout',
      actionLabel: 'Logged out of Xen host',
      entityType: 'session',
      entityRef: '10.0.0.1',
      entityName: '10.0.0.1',
      route: '/login',
      before: { host: '10.0.0.1', username: 'root' },
      after: { success: true },
      detail: 'Session for root on 10.0.0.1 was closed.',
      happenedAt: '2026-08-23T10:31:00.000Z',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/workspaces/inventory', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: inventoryWorkspaces.length,
          data: inventoryWorkspaces,
        }),
      });
      return;
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const record = {
        id: `workspace-${inventoryWorkspaces.length + 1}`,
        name: payload.name,
        scope: payload.scope || 'all',
        query: payload.query || '',
        targetConnectionId: payload.targetConnectionId ?? null,
        notes: payload.notes || '',
        createdAt: '2026-08-23T10:30:00.000Z',
        updatedAt: '2026-08-23T10:30:00.000Z',
        createdBy: 'root',
      };
      inventoryWorkspaces.unshift(record);
      recordAudit({
        category: 'inventory',
        action: 'inventory_workspace_created',
        actionLabel: 'Saved inventory workspace',
        entityType: 'workspace',
        entityRef: record.id,
        entityName: record.name,
        route: '/inventory',
        after: record,
        detail: `${record.name} now captures the ${record.scope} scope${record.targetConnectionId ? ` with target ${record.targetConnectionId}` : ''}.`,
        happenedAt: '2026-08-23T10:30:00.000Z',
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/workspaces/inventory/*', async (route) => {
    const id = decodeURIComponent(route.request().url().split('/api/workspaces/inventory/')[1] || '');
    const method = route.request().method();

    if (method === 'DELETE') {
      const index = inventoryWorkspaces.findIndex((workspace) => workspace.id === id);
      const previous = index === -1 ? null : { ...inventoryWorkspaces[index] };
      if (index !== -1) inventoryWorkspaces.splice(index, 1);
      if (previous) {
        recordAudit({
          category: 'inventory',
          action: 'inventory_workspace_deleted',
          actionLabel: 'Removed inventory workspace',
          entityType: 'workspace',
          entityRef: previous.id,
          entityName: previous.name,
          route: '/inventory',
          before: previous,
          after: { success: true },
          detail: `${previous.name} workspace was removed from the shared inventory catalog.`,
          happenedAt: '2026-08-23T10:32:00.000Z',
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/dashboard/messages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(alertInventory.map((message) => buildAlertRecord(message))),
    });
  });

  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: alertInventory.length,
        data: alertInventory.map((message) => buildAlertRecord(message)),
      }),
    });
  });

  await page.route('**/api/alerts/policies', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: alertPolicies.length,
          data: alertPolicies,
        }),
      });
      return;
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const record = {
        id: `alert-policy-${alertPolicies.length + 1}`,
        enabled: payload.enabled !== false,
        name: payload.name,
        matchClass: payload.matchClass || '',
        matchTargetRoute: payload.matchTargetRoute || '',
        matchObject: payload.matchObject || '',
        matchSeverity: payload.matchSeverity || '',
        matchText: payload.matchText || '',
        textMatchMode: payload.textMatchMode || 'phrase',
        autoAcknowledge: Boolean(payload.autoAcknowledge),
        suppressionHours: Number(payload.suppressionHours || 0),
        severityOverride: payload.severityOverride || '',
        healthAction: payload.healthAction || 'none',
        notes: payload.notes || '',
        updatedAt: '2026-08-22T15:40:00.000Z',
      };
      alertPolicies.unshift(record);
      recordAudit({
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
        happenedAt: '2026-08-22T15:40:00.000Z',
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/alerts/bulk-state', async (route) => {
    const payload = route.request().postDataJSON();
    const updated = (payload.refs || []).map((ref) => {
      alertStates[ref] = {
        acknowledged: Boolean(payload.state?.acknowledged),
        acknowledgedAt: payload.state?.acknowledged ? (alertStates[ref]?.acknowledgedAt || '2026-08-22T15:42:00.000Z') : '',
        acknowledgedBy: payload.state?.acknowledged ? 'root' : '',
        suppressionUntil: payload.state?.suppressionUntil || '',
        severityOverride: payload.state?.severityOverride || '',
        healthAction: payload.state?.healthAction || 'none',
        notes: payload.state?.notes || '',
        updatedAt: '2026-08-22T15:42:00.000Z',
      };
      return buildAlertRecord(alertInventory.find((entry) => entry.ref === ref) || { ref });
    });
    recordAudit({
      category: 'alerts',
      action: 'alert_bulk_state_updated',
      actionLabel: 'Bulk-updated alert state for',
      entityType: 'alert-batch',
      entityRef: (payload.refs || []).join(','),
      entityName: `${updated.length} alerts`,
      route: '/alerts',
      before: { refs: payload.refs || [] },
      after: { refs: payload.refs || [], state: payload.state || {} },
      detail: `${updated.length} alerts received the same triage state in a single operation.`,
      happenedAt: '2026-08-22T15:42:00.000Z',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: updated.length,
        data: updated,
      }),
    });
  });

  await page.route('**/api/alerts/*/state', async (route) => {
    const ref = decodeURIComponent(route.request().url().split('/api/alerts/')[1].replace('/state', ''));
    const payload = route.request().postDataJSON();
    const message = alertInventory.find((entry) => entry.ref === ref);
    if (!message) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    const previousAlert = buildAlertRecord(message);
    alertStates[ref] = {
      acknowledged: Boolean(payload.acknowledged),
      acknowledgedAt: payload.acknowledged ? (alertStates[ref]?.acknowledgedAt || '2026-08-19T12:30:00.000Z') : '',
      acknowledgedBy: payload.acknowledged ? 'root' : '',
      suppressionUntil: payload.suppressionUntil || '',
      severityOverride: payload.severityOverride || '',
      healthAction: payload.healthAction || 'none',
      notes: payload.notes || '',
      updatedAt: '2026-08-19T12:31:00.000Z',
    };
    const alert = buildAlertRecord(message);
    recordAudit({
      category: 'alerts',
      action: 'alert_state_updated',
      actionLabel: 'Updated alert state for',
      entityType: 'alert',
      entityRef: ref,
      entityName: alert.summary,
      route: '/alerts',
      before: previousAlert,
      after: alert,
      detail: `${alert.healthAction || 'none'} action with ${alert.effectiveSeverity || alert.baseSeverity || 'notice'} severity.`,
      happenedAt: '2026-08-20T09:08:00.000Z',
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(alert),
    });
  });

  await page.route('**/api/alerts/policies/*', async (route) => {
    const id = decodeURIComponent(route.request().url().split('/api/alerts/policies/')[1] || '');
    const index = alertPolicies.findIndex((policy) => policy.id === id);
    const method = route.request().method();

    if (method === 'PUT') {
      const payload = route.request().postDataJSON();
      const previous = index !== -1 ? { ...alertPolicies[index] } : null;
      const record = {
        ...(alertPolicies[index] || { id }),
        enabled: payload.enabled !== false,
        name: payload.name,
        matchClass: payload.matchClass || '',
        matchTargetRoute: payload.matchTargetRoute || '',
        matchObject: payload.matchObject || '',
        matchSeverity: payload.matchSeverity || '',
        matchText: payload.matchText || '',
        textMatchMode: payload.textMatchMode || 'phrase',
        autoAcknowledge: Boolean(payload.autoAcknowledge),
        suppressionHours: Number(payload.suppressionHours || 0),
        severityOverride: payload.severityOverride || '',
        healthAction: payload.healthAction || 'none',
        notes: payload.notes || '',
        updatedAt: '2026-08-22T15:44:00.000Z',
      };
      if (index === -1) alertPolicies.unshift(record);
      else alertPolicies[index] = record;
      recordAudit({
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
        happenedAt: '2026-08-22T15:44:00.000Z',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    if (method === 'DELETE') {
      const previous = index !== -1 ? { ...alertPolicies[index] } : null;
      if (index !== -1) alertPolicies.splice(index, 1);
      recordAudit({
        category: 'alerts',
        action: 'alert_policy_deleted',
        actionLabel: 'Removed alert policy for',
        entityType: 'alert-policy',
        entityRef: id,
        entityName: previous?.name || id,
        route: '/alerts',
        before: previous,
        after: { success: true },
        detail: 'Alert suppression policy removed from persisted automation.',
        happenedAt: '2026-08-22T15:45:00.000Z',
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/tasks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: tasks.length,
        data: tasks,
      }),
    });
  });

  await page.route('**/api/tasks/remediation', async (route) => {
    const payload = route.request().postDataJSON();
    const template = payload.templateId
      ? remediationTemplates.find((entry) => entry.id === payload.templateId) || null
      : null;
    const taskPayload = {
      ...payload,
      templateId: template?.id || payload.templateId || '',
      templateName: template?.name || payload.templateName || '',
      templateLaunchMode: template?.launchMode || payload.templateLaunchMode || 'draft',
      recurrenceMode: template?.recurrenceMode || payload.recurrenceMode || 'manual',
      recurrenceScope: template?.recurrenceScope || payload.recurrenceScope || 'object',
      cooldownDays: template?.cooldownDays ?? payload.cooldownDays ?? 0,
    };
    const recurrenceKey = String(taskPayload.relatedObject || taskPayload.alertUuid || taskPayload.alertRef || '').toLowerCase();
    const existingTask = taskPayload.templateId
      ? tasks.find((task) =>
        task.template_id === taskPayload.templateId
        && task.recurrence_window_key === recurrenceKey
        && ['pending', 'queued', 'in_progress', 'success', 'warning'].includes(String(task.status || '').toLowerCase()))
      : null;

    if (existingTask && String(taskPayload.recurrenceMode || '').toLowerCase() === 'daily') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'REMEDIATION_TASK_RECURRENCE_BLOCKED',
          existingTask,
          nextEligibleAt: '2026-08-23T16:05:00.000Z',
        }),
      });
      return;
    }

    const record = {
      ref: `OpaqueRef:remediation-${tasks.length + 1}`,
      uuid: `remediation-task-${tasks.length + 1}`,
      name_label: taskPayload.nameLabel,
      name_description: taskPayload.nameDescription || '',
      status: 'pending',
      progress: 0,
      created: '2026-08-22T16:05:00.000Z',
      finished: '',
      result: 'Queued for operator follow-through.',
      error_info: [],
      resident_on: taskPayload.relatedObject || '',
      task_kind: 'remediation',
      source: 'remediation',
      action_type: taskPayload.actionType || 'review',
      assignee: taskPayload.assignee || '',
      due_date: taskPayload.dueDate || '',
      related_alert_ref: taskPayload.alertRef || '',
      related_alert_uuid: taskPayload.alertUuid || '',
      related_alert_summary: taskPayload.alertSummary || '',
      related_class: taskPayload.relatedClass || '',
      related_object: taskPayload.relatedObject || '',
      target_route: taskPayload.targetRoute || '',
      workspace_summary: taskPayload.workspaceSummary || '',
      evidence_checklist: taskPayload.evidenceChecklist || [],
      completion_criteria: taskPayload.completionCriteria || [],
      template_id: taskPayload.templateId || '',
      template_name: taskPayload.templateName || '',
      template_launch_mode: taskPayload.templateLaunchMode || 'draft',
      recurrence_mode: taskPayload.recurrenceMode || 'manual',
      recurrence_scope: taskPayload.recurrenceScope || 'object',
      recurrence_cooldown_days: Number(taskPayload.cooldownDays || 0),
      recurrence_window_key: recurrenceKey,
      created_by: 'root',
      updated_at: '2026-08-22T16:05:00.000Z',
    };

    tasks.unshift(record);
    recordAudit({
      category: 'alerts',
      action: 'remediation_task_created',
      actionLabel: 'Created remediation task for',
      entityType: 'task',
      entityRef: record.ref,
      entityName: record.name_label,
      route: '/activity',
      after: record,
      detail: `Queued ${record.action_type} follow-through from alert ${record.related_alert_summary || record.related_alert_ref || 'alert'}.`,
      happenedAt: '2026-08-22T16:05:00.000Z',
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(record),
    });
  });

  await page.route('**/api/tasks/remediation/*', async (route) => {
    const suffix = decodeURIComponent(route.request().url().split('/api/tasks/remediation/')[1] || '');
    if (suffix === 'templates') {
      const method = route.request().method();

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            total: remediationTemplates.length,
            data: remediationTemplates,
          }),
        });
        return;
      }

      if (method === 'POST') {
        const payload = route.request().postDataJSON();
        const record = {
          id: `remediation-template-${remediationTemplates.length + 1}`,
          enabled: payload.enabled !== false,
          name: payload.name,
          matchClass: payload.matchClass || '',
          matchTargetRoute: payload.matchTargetRoute || '',
          matchObject: payload.matchObject || '',
          matchSeverity: payload.matchSeverity || '',
          matchText: payload.matchText || '',
          textMatchMode: payload.textMatchMode || 'phrase',
          actionType: payload.actionType || 'review',
          taskNameTemplate: payload.taskNameTemplate || 'Review: {summary}',
          defaultAssignee: payload.defaultAssignee || '',
          defaultDueDays: Number(payload.defaultDueDays || 0),
          defaultTargetRoute: payload.defaultTargetRoute || '',
          defaultNotes: payload.defaultNotes || '',
          workspaceSummaryTemplate: payload.workspaceSummaryTemplate || '',
          evidenceChecklist: payload.evidenceChecklist || [],
          completionCriteria: payload.completionCriteria || [],
          launchMode: payload.launchMode || 'draft',
          recurrenceMode: payload.recurrenceMode || 'manual',
          recurrenceScope: payload.recurrenceScope || 'object',
          cooldownDays: Number(payload.cooldownDays || 0),
          updatedAt: '2026-08-22T16:35:00.000Z',
        };
        remediationTemplates.unshift(record);
        recordAudit({
          category: 'alerts',
          action: 'remediation_template_created',
          actionLabel: 'Created remediation template for',
          entityType: 'task-template',
          entityRef: record.id,
          entityName: record.name,
          route: '/alerts',
          after: record,
          detail: `${record.name} now maps ${record.matchClass || 'any class'} alerts into ${record.actionType || 'review'} follow-through work.`,
          happenedAt: '2026-08-22T16:35:00.000Z',
        });
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(record),
        });
        return;
      }
    }

    if (suffix.startsWith('templates/')) {
      const id = suffix.replace('templates/', '');
      const method = route.request().method();

      if (method === 'PUT') {
        const payload = route.request().postDataJSON();
        const index = remediationTemplates.findIndex((template) => template.id === id);
        const previous = index === -1 ? null : { ...remediationTemplates[index] };
        if (index === -1) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'REMEDIATION_TEMPLATE_NOT_FOUND' }) });
          return;
        }

        const record = {
          ...previous,
          ...payload,
          updatedAt: '2026-08-22T16:38:00.000Z',
        };
        remediationTemplates[index] = record;
        recordAudit({
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
          happenedAt: '2026-08-22T16:38:00.000Z',
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(record),
        });
        return;
      }

      if (method === 'DELETE') {
        const index = remediationTemplates.findIndex((template) => template.id === id);
        const previous = index === -1 ? null : { ...remediationTemplates[index] };
        if (index === -1) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'REMEDIATION_TEMPLATE_NOT_FOUND' }) });
          return;
        }

        remediationTemplates.splice(index, 1);
        recordAudit({
          category: 'alerts',
          action: 'remediation_template_deleted',
          actionLabel: 'Removed remediation template for',
          entityType: 'task-template',
          entityRef: id,
          entityName: previous?.name || id,
          route: '/alerts',
          before: previous,
          after: { success: true },
          detail: `${previous?.name || id} remediation template was removed from the alerts workflow.`,
          happenedAt: '2026-08-22T16:39:00.000Z',
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }
    }

    const ref = suffix;
    const payload = route.request().postDataJSON();
    const index = tasks.findIndex((task) => task.ref === ref);
    const previous = index === -1 ? null : { ...tasks[index] };
    if (index === -1) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'REMEDIATION_TASK_NOT_FOUND' }) });
      return;
    }

    const status = String(payload.status || previous.status || 'pending').toLowerCase();
    const record = {
      ...previous,
      status,
      assignee: payload.assignee || '',
      due_date: payload.dueDate || '',
      result: payload.result || '',
      name_description: payload.nameDescription || previous.name_description || '',
      finished: ['success', 'warning', 'failure', 'cancelled'].includes(status) ? '2026-08-22T16:22:00.000Z' : '',
      updated_at: '2026-08-22T16:22:00.000Z',
    };

    tasks[index] = record;
    recordAudit({
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
      happenedAt: '2026-08-22T16:22:00.000Z',
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(record),
    });
  });

  await page.route('**/api/audit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: auditLog.length,
        data: auditLog,
      }),
    });
  });

  await page.route('**/api/logs', async (route) => {
    const entries = buildLogEntries();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: entries.length,
        page: 1,
        pageSize: entries.length,
        data: entries,
        summary: {
          total: entries.length,
          sourceCounts: entries.reduce((counts, entry) => {
            counts[entry.source] = (counts[entry.source] || 0) + 1;
            return counts;
          }, {}),
        },
      }),
    });
  });

  await page.route('**/api/settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...systemConfig,
        retentionPolicies,
      }),
    });
  });

  await page.route('**/api/credentials', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: credentials.length,
          data: credentials,
        }),
      });
      return;
    }

    const payload = route.request().postDataJSON();
    const created = {
      id: credentials.length ? Math.max(...credentials.map((entry) => Number(entry.id))) + 1 : 1,
      ownerUserId: 1,
      scope: payload.scope,
      targetType: payload.targetType,
      targetHint: payload.targetHint || '',
      name: payload.name,
      username: payload.username,
      createdAt: '2026-08-24T10:12:00.000Z',
      updatedAt: '2026-08-24T10:12:00.000Z',
      lastUsedAt: '',
      lastUsedBy: null,
    };
    credentials.unshift(created);

    recordAudit({
      category: 'credentials',
      action: 'credential_created',
      actionLabel: 'Saved vault credential',
      entityType: 'credential',
      entityRef: String(created.id),
      entityName: created.name,
      route: '/settings',
      after: { ...created, password: 'redacted' },
      detail: `${created.scope} ${created.targetType} credential saved to the XenMange vault.`,
      happenedAt: '2026-08-24T10:12:00.000Z',
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

  await page.route('**/api/credentials/*', async (route) => {
    const id = Number(route.request().url().split('/api/credentials/')[1] || 0);
    const index = credentials.findIndex((entry) => Number(entry.id) === id);

    if (index === -1) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'CREDENTIAL_NOT_FOUND' }) });
      return;
    }

    if (route.request().method() === 'DELETE') {
      const [removed] = credentials.splice(index, 1);
      recordAudit({
        category: 'credentials',
        action: 'credential_deleted',
        actionLabel: 'Removed vault credential',
        entityType: 'credential',
        entityRef: String(id),
        entityName: removed.name,
        route: '/settings',
        before: removed,
        after: { success: true },
        detail: 'Credential removed from the XenMange vault.',
        happenedAt: '2026-08-24T10:14:00.000Z',
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    const payload = route.request().postDataJSON();
    const previous = { ...credentials[index] };
    credentials[index] = {
      ...credentials[index],
      name: payload.name,
      scope: payload.scope,
      targetType: payload.targetType,
      targetHint: payload.targetHint || '',
      username: payload.username,
      updatedAt: '2026-08-24T10:13:00.000Z',
    };

    recordAudit({
      category: 'credentials',
      action: 'credential_updated',
      actionLabel: 'Updated vault credential',
      entityType: 'credential',
      entityRef: String(id),
      entityName: credentials[index].name,
      route: '/settings',
      before: previous,
      after: { ...credentials[index], password: payload.password ? 'rotated' : 'unchanged' },
      detail: `${credentials[index].scope} ${credentials[index].targetType} credential metadata updated in the XenMange vault.`,
      happenedAt: '2026-08-24T10:13:00.000Z',
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(credentials[index]),
    });
  });

  await page.route('**/api/settings/retention/preview*', async (route) => {
    const url = new URL(route.request().url());
    const requestedDomain = url.searchParams.get('domain') || '';
    const policies = requestedDomain
      ? retentionPolicies.filter((policy) => policy.domain === requestedDomain)
      : retentionPolicies;

    const results = policies.map((policy) => ({
      domain: policy.domain,
      label: policy.label,
      cutoffDate: policy.domain === 'audit-log' ? '2026-02-26T12:00:00.000Z' : '2026-05-26T12:00:00.000Z',
      candidateCount: policy.domain === 'auth-events' ? 1 : 0,
    }));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dryRun: true,
        generatedAt: '2026-08-24T10:15:00.000Z',
        results,
        totalCandidates: results.reduce((sum, entry) => sum + Number(entry.candidateCount || 0), 0),
        totalPurged: 0,
      }),
    });
  });

  await page.route('**/api/settings/retention/run', async (route) => {
    const payload = route.request().postDataJSON();
    const requestedDomain = payload.domain || '';
    const policies = requestedDomain
      ? retentionPolicies.filter((policy) => policy.domain === requestedDomain)
      : retentionPolicies;

    const results = policies.map((policy) => {
      const purgedCount = policy.domain === 'auth-events' ? 1 : 0;
      policy.lastRunAt = '2026-08-24T10:20:00.000Z';
      policy.lastPurgedCount = purgedCount;
      return {
        domain: policy.domain,
        label: policy.label,
        cutoffDate: policy.domain === 'audit-log' ? '2026-02-26T12:00:00.000Z' : '2026-05-26T12:00:00.000Z',
        purgedCount,
      };
    });

    recordAudit({
      category: 'system',
      action: 'retention_sweep_completed',
      actionLabel: 'Ran retention sweep for',
      entityType: 'retention-domain',
      entityRef: requestedDomain || 'all',
      entityName: requestedDomain || 'All Domains',
      route: '/settings',
      detail: `Retention sweep completed on Monday, August 24, 2026 with ${results.reduce((sum, entry) => sum + Number(entry.purgedCount || 0), 0)} purged records.`,
      happenedAt: '2026-08-24T10:20:00.000Z',
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        dryRun: false,
        generatedAt: '2026-08-24T10:20:00.000Z',
        results,
        totalCandidates: 0,
        totalPurged: results.reduce((sum, entry) => sum + Number(entry.purgedCount || 0), 0),
      }),
    });
  });

  await page.route('**/api/settings/retention/policies/*', async (route) => {
    const domain = decodeURIComponent(route.request().url().split('/api/settings/retention/policies/')[1] || '');
    const payload = route.request().postDataJSON();
    const policy = retentionPolicies.find((entry) => entry.domain === domain);

    if (!policy) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    const previous = { ...policy };
    policy.enabled = payload.enabled !== false;
    policy.retentionDays = Number(payload.retentionDays || policy.retentionDays);
    recordAudit({
      category: 'system',
      action: 'retention_policy_saved',
      actionLabel: 'Saved retention policy for',
      entityType: 'retention-domain',
      entityRef: policy.domain,
      entityName: policy.label,
      route: '/settings',
      before: previous,
      after: { ...policy },
      detail: `${policy.retentionDays} day retention with ${policy.enabled ? 'enabled' : 'disabled'} execution state.`,
      happenedAt: '2026-08-24T10:18:00.000Z',
    });

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(policy) });
  });

  await page.route('**/api/settings/*', async (route) => {
    const section = route.request().url().split('/api/settings/')[1] || '';
    const payload = route.request().postDataJSON();
    if (!systemConfig[section]) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    const previous = { ...systemConfig[section] };
    systemConfig[section] = {
      ...systemConfig[section],
      ...payload,
    };

    recordAudit({
      category: 'system',
      action: 'system_config_saved',
      actionLabel: 'Saved system configuration for',
      entityType: 'settings-section',
      entityRef: section,
      entityName: section,
      route: '/settings',
      before: previous,
      after: { ...systemConfig[section] },
      detail: `${section} settings were updated from the Settings workspace on Monday, August 24, 2026.`,
      happenedAt: '2026-08-24T10:16:00.000Z',
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        section: systemConfig[section],
        retentionPolicies,
        runtime: systemConfig.runtime,
      }),
    });
  });

  await page.route('**/api/governance', async (route) => {
    const userSummary = {
      totalUsers: users.length,
      activeUsers: users.filter((entry) => entry.active !== false).length,
      activeAdmins: users.filter((entry) => entry.active !== false && entry.role === 'admin').length,
    };
    const quotaRows = connections.map((connection) => {
      const quota = governanceQuotas.find((entry) => entry.poolRef === 'OpaqueRef:pool1') || null;
      const currentVmCount = vmInventory.length;
      const currentRunningVmCount = vmInventory.filter((vm) => (vm.power_state || '').toLowerCase() === 'running').length;
      const currentTotalMemoryGiB = Math.round((vmInventory.reduce((sum, vm) => sum + Number(vm.memory_static_max || 0), 0) / (1024 ** 3)) * 10) / 10;
      const breaches = [];
      if (quota?.enabled) {
        if (quota.maxVmCount > 0 && currentVmCount > quota.maxVmCount) breaches.push('VM count');
        if (quota.maxRunningVmCount > 0 && currentRunningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
        if (quota.maxTotalMemoryGiB > 0 && currentTotalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');
      }

      return {
        poolRef: 'OpaqueRef:pool1',
        poolName: connection.name,
        status: breaches.length ? 'critical' : quota?.enabled ? 'info' : 'success',
        currentVmCount,
        currentRunningVmCount,
        currentTotalMemoryGiB,
        quota,
        detail: breaches.length
          ? `Quota pressure is present for ${breaches.join(', ')}.`
          : quota?.enabled
            ? 'Quota is configured and current usage remains within the allowed envelope.'
            : 'No pool quota is currently enforced for this pool.',
      };
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-08-21T15:20:00.000Z',
        policy: governancePolicy,
        currentRole: governanceCurrentRole,
        quotas: governanceQuotas,
        approvals: governanceApprovals,
        quotaRows,
        userSummary,
        summary: {
          pendingApprovalCount: governanceApprovals.filter((entry) => entry.status === 'pending').length,
          approvedApprovalCount: governanceApprovals.filter((entry) => entry.status === 'approved').length,
          enforcedQuotaCount: governanceQuotas.filter((entry) => entry.enabled).length,
          poolCount: 1,
        },
      }),
    });
  });

  await page.route('**/api/governance/policy', async (route) => {
    const payload = route.request().postDataJSON();
    const previous = { ...governancePolicy };
    Object.assign(governancePolicy, {
      defaultRole: payload.defaultRole || 'admin',
      requireDestructiveApproval: payload.requireDestructiveApproval !== false,
      approvalTtlMinutes: Number(payload.approvalTtlMinutes || 240),
    });
    recordAudit({
      category: 'governance',
      action: 'governance_policy_saved',
      actionLabel: 'Saved governance policy for',
      entityType: 'policy',
      entityRef: 'governance.policy',
      entityName: 'Governance Policy',
      route: '/governance',
      before: previous,
      after: { ...governancePolicy },
      detail: `${governancePolicy.defaultRole} default role with ${governancePolicy.requireDestructiveApproval ? 'approval-gated' : 'direct'} destructive actions.`,
      happenedAt: '2026-08-21T15:25:00.000Z',
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(governancePolicy) });
  });

  await page.route('**/api/governance/role', async (route) => {
    const payload = route.request().postDataJSON();
    const previousRole = governanceCurrentRole;
    const roleOrder = { 'read-only': 0, operator: 1, admin: 2 };
    const currentUserRole = users.find((entry) => entry.id === 1)?.role || 'admin';
    if ((roleOrder[payload.role || previousRole] ?? 0) > (roleOrder[currentUserRole] ?? 0)) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'ROLE_ESCALATION_NOT_ALLOWED' }) });
      return;
    }
    governanceCurrentRole = payload.role || previousRole;
    recordAudit({
      category: 'governance',
      action: 'governance_role_switched',
      actionLabel: 'Switched governance role for',
      entityType: 'session',
      entityRef: 'test-session',
      entityName: 'root',
      route: '/governance',
      before: { role: previousRole },
      after: { role: governanceCurrentRole },
      detail: `Session role changed from ${previousRole} to ${governanceCurrentRole}.`,
      happenedAt: '2026-08-21T15:28:00.000Z',
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ role: governanceCurrentRole }) });
  });

  await page.route('**/api/users', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: users.length,
          data: users,
          summary: {
            totalUsers: users.length,
            activeUsers: users.filter((entry) => entry.active !== false).length,
            activeAdmins: users.filter((entry) => entry.active !== false && entry.role === 'admin').length,
          },
        }),
      });
      return;
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const duplicate = users.find((entry) => String(entry.username || '').toLowerCase() === String(payload.username || '').toLowerCase());
      if (duplicate) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'USERNAME_ALREADY_EXISTS' }) });
        return;
      }
      const record = {
        id: users.length + 1,
        username: payload.username,
        display_name: payload.displayName || '',
        email: payload.email || '',
        role: payload.role || 'operator',
        active: payload.active !== false,
        created_at: '2026-08-24T14:20:00.000Z',
        last_login_at: '',
        groups: [],
        group_count: 0,
      };
      users.push(record);
      recordAudit({
        category: 'governance',
        action: 'user_created',
        actionLabel: 'Created local user',
        entityType: 'user',
        entityRef: String(record.id),
        entityName: record.username,
        route: '/governance',
        after: record,
        detail: `Created local ${record.role} account ${record.username}${record.active ? '' : ' in a disabled state'}.`,
        happenedAt: '2026-08-24T14:20:00.000Z',
      });
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(record) });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/users/*', async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const id = Number(url.split('/api/users/')[1].split('/')[0] || 0);
    const index = users.findIndex((entry) => entry.id === id);

    if (index === -1) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'USER_NOT_FOUND' }) });
      return;
    }

    if (method === 'PUT') {
      const payload = route.request().postDataJSON();
      const duplicate = users.find((entry) =>
        entry.id !== id
        && String(entry.username || '').toLowerCase() === String(payload.username || '').toLowerCase()
      );
      if (duplicate) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'USERNAME_ALREADY_EXISTS' }) });
        return;
      }
      const activeAdminsExcludingCurrent = users.filter((entry) => entry.id !== id && entry.active !== false && entry.role === 'admin').length;
      const nextRole = payload.role || users[index].role || 'operator';
      const nextActive = payload.active !== false;
      if (users[index].role === 'admin' && users[index].active !== false && (nextRole !== 'admin' || !nextActive) && !activeAdminsExcludingCurrent) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'LAST_ACTIVE_ADMIN_REQUIRED' }) });
        return;
      }
      const previous = { ...users[index] };
      users[index] = {
        ...users[index],
        username: payload.username,
        display_name: payload.displayName || '',
        email: payload.email || '',
        role: nextRole,
        active: nextActive,
      };
      recordAudit({
        category: 'governance',
        action: 'user_updated',
        actionLabel: 'Updated local user',
        entityType: 'user',
        entityRef: String(id),
        entityName: users[index].username,
        route: '/governance',
        before: previous,
        after: users[index],
        detail: `Updated local account ${users[index].username} (${users[index].role}, ${users[index].active ? 'active' : 'disabled'}).`,
        happenedAt: '2026-08-24T14:26:00.000Z',
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(users[index]) });
      return;
    }

    if (method === 'POST' && url.endsWith('/password')) {
      recordAudit({
        category: 'governance',
        action: 'user_password_reset',
        actionLabel: 'Reset password for',
        entityType: 'user',
        entityRef: String(id),
        entityName: users[index].username,
        route: '/governance',
        after: { ...users[index], password: 'rotated' },
        detail: `Rotated the local password for ${users[index].username}.`,
        happenedAt: '2026-08-24T14:28:00.000Z',
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user: users[index] }) });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/governance/quotas/*', async (route) => {
    const method = route.request().method();
    const poolRef = decodeURIComponent(route.request().url().split('/').pop() || '');

    if (method === 'PUT') {
      const payload = route.request().postDataJSON();
      const previous = governanceQuotas.find((entry) => entry.poolRef === poolRef) || null;
      const record = {
        poolRef,
        enabled: payload.enabled !== false,
        owner: payload.owner || '',
        maxVmCount: Number(payload.maxVmCount || 0),
        maxRunningVmCount: Number(payload.maxRunningVmCount || 0),
        maxTotalMemoryGiB: Number(payload.maxTotalMemoryGiB || 0),
        notes: payload.notes || '',
        updatedAt: '2026-08-21T15:32:00.000Z',
      };
      const index = governanceQuotas.findIndex((entry) => entry.poolRef === poolRef);
      if (index === -1) governanceQuotas.push(record);
      else governanceQuotas[index] = record;
      recordAudit({
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
        happenedAt: '2026-08-21T15:32:00.000Z',
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) });
      return;
    }

    if (method === 'DELETE') {
      const index = governanceQuotas.findIndex((entry) => entry.poolRef === poolRef);
      const previous = index !== -1 ? governanceQuotas[index] : null;
      if (index !== -1) governanceQuotas.splice(index, 1);
      recordAudit({
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
        happenedAt: '2026-08-21T15:34:00.000Z',
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/governance/approvals', async (route) => {
    const payload = route.request().postDataJSON();
    const record = {
      id: `approval-${governanceApprovals.length + 1}`,
      actionKey: payload.actionKey || '',
      entityType: payload.entityType || 'resource',
      entityRef: payload.entityRef || '',
      entityName: payload.entityName || '',
      requestedBy: 'root',
      justification: payload.justification || '',
      route: payload.route || '',
      status: 'pending',
      requestedAt: '2026-08-21T15:36:00.000Z',
      expiresAt: '2026-08-21T19:36:00.000Z',
      decidedBy: '',
      decidedAt: '',
      decisionNotes: '',
      usedBy: '',
      usedAt: '',
    };
    governanceApprovals.unshift(record);
    recordAudit({
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
      happenedAt: '2026-08-21T15:36:00.000Z',
    });
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(record) });
  });

  await page.route('**/api/governance/approvals/*/decision', async (route) => {
    const payload = route.request().postDataJSON();
    const approvalId = decodeURIComponent(route.request().url().split('/api/governance/approvals/')[1].replace('/decision', ''));
    const index = governanceApprovals.findIndex((entry) => entry.id === approvalId);
    if (index === -1) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'APPROVAL_NOT_FOUND' }) });
      return;
    }
    const previous = { ...governanceApprovals[index] };
    governanceApprovals[index] = {
      ...governanceApprovals[index],
      status: payload.decision === 'rejected' ? 'rejected' : 'approved',
      decidedBy: 'root',
      decidedAt: '2026-08-21T15:38:00.000Z',
      decisionNotes: payload.notes || '',
    };
    recordAudit({
      category: 'governance',
      action: payload.decision === 'rejected' ? 'governance_approval_rejected' : 'governance_approval_approved',
      actionLabel: payload.decision === 'rejected' ? 'Rejected governance approval for' : 'Approved governance approval for',
      entityType: governanceApprovals[index].entityType,
      entityRef: governanceApprovals[index].entityRef,
      entityName: governanceApprovals[index].entityName || governanceApprovals[index].entityRef,
      route: '/governance',
      before: previous,
      after: governanceApprovals[index],
      detail: `${governanceApprovals[index].actionKey} request is now ${governanceApprovals[index].status}.`,
      happenedAt: '2026-08-21T15:38:00.000Z',
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(governanceApprovals[index]) });
  });

  await page.route(/.*\/api\/resilience(?:\?.*)?$/, async (route) => {
    const buildResiliencePayload = () => ({
      generatedAt: '2026-08-21T12:15:00.000Z',
      summary: {
        protectedVmCount: 1,
        atRiskVmCount: 1,
        maintenanceHostCount: 0,
        recoveryPlanCount: 1,
        recentEventCount: 4,
        runbookCoverageCount: resilienceRunbooks.length,
        staleRestorePointCount: 0,
        overdueDrillCount: 0,
      },
      protectionPolicies: [
        {
          ref: 'OpaqueRef:vm1',
          poolRef: 'OpaqueRef:pool1',
          poolName: 'Production Pool',
          name_label: 'app-01',
          power_state: 'Running',
          policy: 'Tier-1',
          recoveryTier: 'tier-1',
          status: 'warning',
          hasRecentProtection: true,
          lastProtectedAt: '2026-08-20T10:15:00.000Z',
          backupAgeHours: 22,
          backupWindowHours: 12,
          restorePointStatus: 'review',
          restorePointLabel: 'Aged 22h',
          haRestartPriority: 'high',
          lastTaskLabel: 'Backup verify app-01',
          lastAlertLabel: 'Replication lag warning',
          recommendation: 'Confirm backup freshness before the next change window.',
          tags: ['prod'],
          uuid: 'vm-uuid-1',
          lastDrillAt: resilienceDrills[0]?.executedAt || '',
          lastDrillStatus: resilienceDrills[0]?.status || '',
          runbookOwner: resilienceRunbooks[0]?.owner || '',
        },
      ],
      hostPlans: [
        {
          ref: 'OpaqueRef:host1',
          poolRef: 'OpaqueRef:pool1',
          poolName: 'Production Pool',
          name_label: 'alpha-xen',
          address: '10.0.0.11',
          status: 'success',
          evacuationTarget: 'beta-xen',
          standbyHostRef: 'OpaqueRef:host2',
          residentVmCount: 1,
          recentTask: 'Recovery drill Production Pool',
          recentAlert: 'No recent host alert',
          summary: 'Failover posture looks healthy.',
          haPolicy: resilienceRunbooks[0]?.haPolicy || 'manual',
          restartPriority: resilienceRunbooks[0]?.restartPriority || 'medium',
          lastDrillAt: resilienceDrills[0]?.executedAt || '',
          lastDrillStatus: resilienceDrills[0]?.status || '',
          maintenanceWindow: 'Sat 01:00',
          uuid: 'host-uuid-1',
        },
      ],
      recoveryPlans: [
        {
          ref: 'OpaqueRef:pool1',
          name_label: 'Production Pool',
          status: 'warning',
          enabledHostCount: 2,
          protectedVmCount: 1,
          atRiskVmCount: 1,
          staleRestorePointCount: 0,
          reviewRestorePointCount: 1,
          nextAction: 'Prioritize backup verification and restore testing.',
          hasRunbook: resilienceRunbooks.length > 0,
          recoveryTier: resilienceRunbooks[0]?.recoveryTier || 'standard',
          haPolicy: resilienceRunbooks[0]?.haPolicy || 'manual',
          restartPriority: resilienceRunbooks[0]?.restartPriority || 'medium',
          backupWindowHours: resilienceRunbooks[0]?.backupWindowHours || 24,
          rpoMinutes: resilienceRunbooks[0]?.rpoMinutes || 60,
          rtoMinutes: resilienceRunbooks[0]?.rtoMinutes || 120,
          restorePointStatus: 'review',
          owner: resilienceRunbooks[0]?.owner || '',
          standbyHostRef: resilienceRunbooks[0]?.standbyHostRef || '',
          standbyHostLabel: 'beta-xen',
          failoverNetworkRef: resilienceRunbooks[0]?.failoverNetworkRef || '',
          failoverNetworkLabel: 'Backup Network',
          lastVerifiedAt: resilienceRunbooks[0]?.lastVerifiedAt || '',
          lastDrillAt: resilienceDrills[0]?.executedAt || '',
          lastDrillStatus: resilienceDrills[0]?.status || '',
          drillCount: resilienceDrills.length,
          runbookSteps: resilienceRunbooks[0]?.runbookSteps || [],
          notes: resilienceRunbooks[0]?.notes || '',
          drills: resilienceDrills.slice(0, 5),
          uuid: 'pool-uuid-1',
        },
      ],
      recentEvents: [
        {
          type: 'alert',
          ref: 'OpaqueRef:msg-r1',
          label: 'Replication lag warning',
          status: 'critical',
          timestamp: '2026-08-20T12:12:00.000Z',
          detail: 'app-01 missed its last protection target.',
        },
        {
          type: 'drill',
          ref: resilienceDrills[0]?.id || 'drill-seed-1',
          label: 'restore drill',
          status: resilienceDrills[0]?.status || 'warning',
          timestamp: resilienceDrills[0]?.executedAt || '2026-08-20T09:10:00.000Z',
          detail: resilienceDrills[0]?.summary || 'Recovery path worked but startup ordering still needs tuning.',
        },
      ],
      runbooks: resilienceRunbooks,
      drills: resilienceDrills,
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildResiliencePayload()),
    });
  });

  await page.route('**/api/resilience/plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: resilienceRunbooks.length,
        data: resilienceRunbooks,
      }),
    });
  });

  await page.route('**/api/resilience/drills', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: resilienceDrills.length,
        data: resilienceDrills,
      }),
    });
  });

  await page.route('**/api/resilience/plans/*', async (route) => {
    const method = route.request().method();
    const body = route.request().postDataJSON?.() || {};
    const poolRef = decodeURIComponent(route.request().url().split('/').pop() || '');

    if (method === 'PUT') {
      const previous = resilienceRunbooks.find((record) => record.poolRef === poolRef) || null;
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
        runbookSteps: Array.isArray(body.runbookSteps) ? body.runbookSteps.slice(0, 8) : [],
        notes: body.notes || '',
        updatedAt: '2026-08-21T13:30:00.000Z',
      };
      const index = resilienceRunbooks.findIndex((entry) => entry.poolRef === poolRef);
      if (index === -1) {
        resilienceRunbooks.push(record);
      } else {
        resilienceRunbooks[index] = record;
      }
      recordAudit({
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) });
      return;
    }

    if (method === 'DELETE') {
      const index = resilienceRunbooks.findIndex((entry) => entry.poolRef === poolRef);
      const previous = index !== -1 ? resilienceRunbooks[index] : null;
      if (index !== -1) resilienceRunbooks.splice(index, 1);
      recordAudit({
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
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/resilience/drills/*', async (route) => {
    const poolRef = decodeURIComponent(route.request().url().split('/').pop() || '');
    const body = route.request().postDataJSON?.() || {};
    const record = {
      id: `drill-${resilienceDrills.length + 1}`,
      poolRef,
      drillType: body.drillType || 'restore',
      status: body.status || 'success',
      scope: body.scope || '',
      executedAt: body.executedAt || '2026-08-21T14:00:00.000Z',
      durationMinutes: Number(body.durationMinutes || 0),
      summary: body.summary || '',
      findings: body.findings || '',
      nextStep: body.nextStep || '',
      operator: 'root',
      createdAt: '2026-08-21T14:05:00.000Z',
    };
    resilienceDrills.unshift(record);
    recordAudit({
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(record) });
  });

  await page.route('**/api/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        poolCount: 1,
        hostCount: 2,
        vmCount: 4,
        templateCount: 1,
        srCount: 3,
        networkCount: 2,
        vmStates: { running: 3, halted: 1, suspended: 0, paused: 0, other: 0 },
        hostStates: { enabled: 2, disabled: 0, offline: 0 },
        pools: [{ ref: 'OpaqueRef:pool1', name_label: 'Production Pool', uuid: 'pool-uuid', tags: ['prod'] }],
        hosts: [
          { ref: 'OpaqueRef:host1', name: 'alpha-xen', name_label: 'alpha-xen', address: '10.0.0.11', enabled: true },
        ],
      }),
    });
  });

  await page.route('**/api/pools', async (route) => {
    if (!targetAttached) {
      await fulfillNeedsConnection(route);
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        data: [
          {
            ref: 'OpaqueRef:pool1',
            name_label: 'Production Pool',
            uuid: 'pool-uuid',
            master: 'OpaqueRef:host1',
            slaves: ['OpaqueRef:host2'],
            tags: ['prod'],
            default_SR: 'OpaqueRef:sr1',
            migration_network: 'OpaqueRef:net1',
          },
        ],
      }),
    });
  });

  await page.route('**/api/hosts', async (route) => {
    if (!targetAttached) {
      await fulfillNeedsConnection(route);
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: hostInventory.length,
        data: hostInventory,
      }),
    });
  });

  await page.route('**/api/hosts/*/metrics', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const metricsByRef = {
      'OpaqueRef:host1': { live: true, memory_total: 68719476736, memory_free: 12884901888 },
      'OpaqueRef:host2': { live: true, memory_total: 68719476736, memory_free: 25769803776 },
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(metricsByRef[ref] || { live: false, memory_total: 0, memory_free: 0 }),
    });
  });

  await page.route('**/api/metrics/cluster*', async (route) => {
    const url = new URL(route.request().url());
    const range = url.searchParams.get('range') || '24h';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildClusterMetricHistory(range)),
    });
  });

  await page.route('**/api/metrics/collect', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        captured: true,
        ts: Date.parse('2026-08-24T10:30:00.000Z'),
        sampleCount: 19,
        hostCount: hostInventory.length,
        vmCount: vmInventory.length,
        srCount: storageInventory.length,
      }),
    });
  });

  await page.route('**/api/metrics/hosts/*', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[4] || '');
    const range = url.searchParams.get('range') || '24h';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildHostMetricHistory(ref, range)),
    });
  });

  await page.route('**/api/metrics/vms/*', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[4] || '');
    const range = url.searchParams.get('range') || '24h';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildVmMetricHistory(ref, range)),
    });
  });

  await page.route('**/api/metrics/storage/*', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[4] || '');
    const range = url.searchParams.get('range') || '24h';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildStorageMetricHistory(ref, range)),
    });
  });

  await page.route('**/api/vms/templates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: templateInventory.length,
        data: templateInventory,
      }),
    });
  });

  await page.route('**/api/vms/templates/governance', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: templateGovernance.length,
          data: templateGovernance,
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/vms/templates/*/history', async (route) => {
    const templateRef = decodeURIComponent(route.request().url().split('/api/vms/templates/')[1].replace('/history', ''));
    const history = templateGovernanceHistory.filter((entry) => entry.templateRef === templateRef);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: history.length,
        data: history,
      }),
    });
  });

  await page.route('**/api/vms/templates/deployments', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: templateDeployments.length,
          data: templateDeployments,
        }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/vms/templates/*/governance', async (route) => {
    const templateRef = decodeURIComponent(route.request().url().split('/api/vms/templates/')[1].replace('/governance', ''));
    const payload = route.request().postDataJSON();
    const previous = templateGovernance.find((entry) => entry.templateRef === templateRef) || null;
    const record = {
      templateRef,
      versionLabel: payload.versionLabel || '',
      profileLabel: payload.profileLabel || '',
      lifecycleStage: payload.lifecycleStage || 'draft',
      goldenImage: Boolean(payload.goldenImage),
      guestCustomization: payload.guestCustomization || '',
      validationStatus: payload.validationStatus || 'untested',
      lastValidatedAt: payload.lastValidatedAt || '',
      owner: payload.owner || '',
      notes: payload.notes || '',
      updatedAt: '2026-08-20T09:15:00.000Z',
    };
    const index = templateGovernance.findIndex((entry) => entry.templateRef === templateRef);
    if (index === -1) {
      templateGovernance.push(record);
    } else {
      templateGovernance[index] = record;
    }
    templateGovernanceHistory.unshift({
      id: `tmplhist-${Date.now()}`,
      templateRef,
      templateName: templateInventory.find((entry) => entry.ref === templateRef)?.name_label || templateRef,
      eventType: 'saved',
      actor: 'root',
      happenedAt: '2026-08-20T09:15:00.000Z',
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: `${record.versionLabel || templateRef} governance saved from the template library workbench.`,
      snapshot: { ...record },
    });
    recordAudit({
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
      happenedAt: '2026-08-20T09:15:00.000Z',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(record),
    });
  });

  await page.route('**/api/vms/templates/*/promote', async (route) => {
    const templateRef = decodeURIComponent(route.request().url().split('/api/vms/templates/')[1].replace('/promote', ''));
    const payload = route.request().postDataJSON();
    const index = templateGovernance.findIndex((entry) => entry.templateRef === templateRef);
    const template = templateInventory.find((entry) => entry.ref === templateRef);

    if (index === -1 || !template) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'TEMPLATE_GOVERNANCE_NOT_FOUND' }) });
      return;
    }

    const current = templateGovernance[index];
    if (current.validationStatus !== 'validated') {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'PROMOTION_REQUIRES_VALIDATED_TEMPLATE' }) });
      return;
    }

    const profileLabel = String(current.profileLabel || '').trim().toLowerCase();
    const baseline = templateGovernance.find((entry) =>
      entry.templateRef !== templateRef
      && entry.lifecycleStage === 'stable'
      && String(entry.profileLabel || '').trim().toLowerCase() === profileLabel
    ) || null;
    const deprecated = [];

    if (baseline && payload.retireExistingStable !== false) {
      baseline.lifecycleStage = 'deprecated';
      baseline.goldenImage = false;
      baseline.updatedAt = '2026-08-20T09:17:00.000Z';
      deprecated.push({ ...baseline });
      templateGovernanceHistory.unshift({
        id: `tmplhist-${Date.now()}-retire`,
        templateRef: baseline.templateRef,
        templateName: templateInventory.find((entry) => entry.ref === baseline.templateRef)?.name_label || baseline.templateRef,
        eventType: 'retired',
        actor: 'root',
        happenedAt: '2026-08-20T09:17:00.000Z',
        baselineTemplateRef: templateRef,
        baselineTemplateName: template.name_label,
        baselineVersionLabel: current.versionLabel || '',
        promotionNotes: payload.promotionNotes || '',
        detail: `${current.versionLabel || templateRef} replaced this stable baseline during promotion.`,
        snapshot: { ...baseline },
      });
    }

    current.lifecycleStage = 'stable';
    current.goldenImage = true;
    current.updatedAt = '2026-08-20T09:17:00.000Z';
    current.notes = [current.notes, payload.promotionNotes || ''].filter(Boolean).join(' ');

    templateGovernanceHistory.unshift({
      id: `tmplhist-${Date.now()}-promote`,
      templateRef,
      templateName: template.name_label,
      eventType: 'promoted',
      actor: 'root',
      happenedAt: '2026-08-20T09:17:00.000Z',
      baselineTemplateRef: baseline?.templateRef || '',
      baselineTemplateName: baseline ? (templateInventory.find((entry) => entry.ref === baseline.templateRef)?.name_label || baseline.templateRef) : '',
      baselineVersionLabel: baseline?.versionLabel || '',
      promotionNotes: payload.promotionNotes || '',
      detail: `${current.versionLabel || templateRef} promoted to stable lifecycle stage.`,
      snapshot: { ...current },
    });

    recordAudit({
      category: 'templates',
      action: 'template_promoted',
      actionLabel: 'Promoted template',
      entityType: 'template',
      entityRef: templateRef,
      entityName: template.name_label || templateRef,
      route: '/templates',
      before: { ...current, lifecycleStage: 'staged' },
      after: { ...current },
      detail: `${current.versionLabel || templateRef} promoted to stable${deprecated.length ? ' and retired the previous stable baseline' : ''}.`,
      happenedAt: '2026-08-20T09:17:00.000Z',
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        promoted: { ...current },
        deprecated,
        history: templateGovernanceHistory.filter((entry) => entry.templateRef === templateRef),
      }),
    });
  });

  await page.route('**/api/vms/templates/deployments/*/validation', async (route) => {
    const deploymentId = decodeURIComponent(route.request().url().split('/api/vms/templates/deployments/')[1].replace('/validation', ''));
    const payload = route.request().postDataJSON();
    const index = templateDeployments.findIndex((entry) => entry.id === deploymentId);
    const current = templateDeployments[index];
    const record = {
      ...current,
      validationStatus: payload.validationStatus,
      validationNotes: payload.validationNotes || '',
      guestCustomization: payload.guestCustomization || '',
      bootVerified: Boolean(payload.bootVerified),
      networkVerified: Boolean(payload.networkVerified),
      storageVerified: Boolean(payload.storageVerified),
      policyTagged: Boolean(payload.policyTagged),
      updatedAt: '2026-08-20T09:20:00.000Z',
    };
    templateDeployments[index] = record;
    recordAudit({
      category: 'templates',
      action: 'template_deployment_validated',
      actionLabel: 'Updated deployment validation for',
      entityType: 'vm',
      entityRef: record.vmRef || record.id,
      entityName: record.vmName || record.id,
      route: '/templates',
      before: current,
      after: record,
      detail: `${record.validationStatus} validation with guest customization ${record.guestCustomization || 'unset'}.`,
      happenedAt: '2026-08-20T09:20:00.000Z',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(record),
    });
  });

  await page.route('**/api/vms/templates/*/deploy', async (route) => {
    const payload = route.request().postDataJSON();
    const nextIndex = vmInventory.length + 1;
    const nextVmRef = `OpaqueRef:vm${nextIndex}`;
    const nextVbdRef = `OpaqueRef:vbd${nextIndex}`;
    const nextVdiRef = `OpaqueRef:vdi${vdiInventory.length + 1}`;
    const nextVifRef = `OpaqueRef:vif${nextIndex}`;
    const record = {
      ref: nextVmRef,
      name_label: payload.nameLabel,
      name_description: payload.nameDescription || '',
      power_state: payload.startAfter ? 'Running' : 'Halted',
      VCPUs_at_startup: payload.vcpus,
      VCPUs_max: payload.vcpus,
      memory_static_max: payload.memoryStaticMax,
      memory_dynamic_max: payload.memoryStaticMax,
      uuid: `vm-uuid-${nextIndex}`,
      tags: payload.tags || [],
      resident_on: payload.hostRef,
      affinity: payload.hostRef,
      VBDs: payload.storageRef ? [nextVbdRef] : [],
      VIFs: payload.networkRef ? [nextVifRef] : [],
      HVM_boot_policy: 'UEFI',
      platform: { secureboot: 'enabled' },
    };

    vmInventory.push(record);

    if (payload.storageRef) {
      vdiInventory.push({
        ref: nextVdiRef,
        SR: payload.storageRef,
        name_label: `${payload.nameLabel}-root`,
        virtual_size: payload.memoryStaticMax,
        type: 'user',
        managed: true,
        VBDs: [nextVbdRef],
      });
    }

    if (payload.networkRef) {
      const network = networkInventory.find((item) => item.ref === payload.networkRef);
      if (network) {
        network.VIFs = [...network.VIFs, nextVifRef];
      }
    }

    if (payload.hostRef) {
      const host = hostInventory.find((item) => item.ref === payload.hostRef);
      if (host) {
        host.resident_VMs = [...host.resident_VMs, nextVmRef];
      }
    }

    const governance = templateGovernance.find((entry) => entry.templateRef === 'OpaqueRef:template1');
    const deploymentAudit = {
      id: `tmpldep-${nextIndex}`,
      templateRef: 'OpaqueRef:template1',
      templateName: 'ubuntu-golden',
      templateVersion: governance?.versionLabel || '',
      vmRef: nextVmRef,
      vmName: payload.nameLabel,
      hostRef: payload.hostRef,
      hostLabel: hostInventory.find((item) => item.ref === payload.hostRef)?.name_label || '',
      storageRef: payload.storageRef,
      storageLabel: storageInventory.find((item) => item.ref === payload.storageRef)?.name_label || '',
      networkRef: payload.networkRef,
      networkLabel: networkInventory.find((item) => item.ref === payload.networkRef)?.name_label || '',
      startAfter: Boolean(payload.startAfter),
      submittedBy: 'root',
      submittedAt: '2026-08-20T09:18:00.000Z',
      validationStatus: governance?.validationStatus === 'validated' ? 'pending' : 'warning',
      validationNotes: governance?.validationStatus === 'validated'
        ? 'Validate guest boot, networking, storage mapping, and policy tags after first start.'
        : 'Template governance is not fully validated yet. Review this deployment before promotion.',
      guestCustomization: governance?.guestCustomization || '',
      bootVerified: false,
      networkVerified: false,
      storageVerified: false,
      policyTagged: Array.isArray(payload.tags) && payload.tags.length > 0,
      updatedAt: '2026-08-20T09:18:00.000Z',
    };
    templateDeployments.unshift(deploymentAudit);
    recordAudit({
      category: 'templates',
      action: 'template_deployed',
      actionLabel: 'Deployed template to',
      entityType: 'vm',
      entityRef: nextVmRef,
      entityName: payload.nameLabel,
      route: '/templates',
      before: templateInventory[0],
      after: { ...record, deploymentAudit },
      detail: `ubuntu-golden deployed with ${deploymentAudit.validationStatus} validation status.`,
      happenedAt: '2026-08-20T09:18:00.000Z',
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...record, deploymentAudit }),
    });
  });

  await page.route('**/api/vms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: vmInventory.length,
        data: vmInventory,
      }),
    });
  });

  await page.route('**/api/storage', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: storageInventory.length,
        data: storageInventory,
      }),
    });
  });

  await page.route('**/api/storage/OpaqueRef%3Asr1/vdis', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: vdiInventory.length,
        data: vdiInventory,
      }),
    });
  });

  await page.route('**/api/networks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: networkInventory.length,
        data: networkInventory,
      }),
    });
  });

  await page.route('**/api/lifecycle/plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: lifecyclePlans.length,
        data: lifecyclePlans,
      }),
    });
  });

  await page.route('**/api/lifecycle/plans/*', async (route) => {
    const hostRef = decodeURIComponent(route.request().url().split('/api/lifecycle/plans/')[1] || '');
    const method = route.request().method();

    if (method === 'PUT') {
      const payload = route.request().postDataJSON();
      const previous = lifecyclePlans.find((plan) => plan.hostRef === hostRef) || null;
      const record = {
        hostRef,
        baselineStatus: payload.baselineStatus,
        targetStage: payload.targetStage,
        maintenanceWindow: payload.maintenanceWindow || '',
        patchGroup: payload.patchGroup || '',
        owner: payload.owner || '',
        nextAction: payload.nextAction,
        rebootRequired: Boolean(payload.rebootRequired),
        evacuationRequired: Boolean(payload.evacuationRequired),
        dueDate: payload.dueDate || '',
        notes: payload.notes || '',
        updatedAt: '2026-08-19T15:25:00.000Z',
      };
      const index = lifecyclePlans.findIndex((plan) => plan.hostRef === hostRef);
      if (index === -1) {
        lifecyclePlans.push(record);
      } else {
        lifecyclePlans[index] = record;
      }
      recordAudit({
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
        happenedAt: '2026-08-20T09:25:00.000Z',
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    if (method === 'DELETE') {
      const index = lifecyclePlans.findIndex((plan) => plan.hostRef === hostRef);
      const previous = index !== -1 ? lifecyclePlans[index] : null;
      if (index !== -1) lifecyclePlans.splice(index, 1);
      if (previous) {
        recordAudit({
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
          happenedAt: '2026-08-20T09:26:00.000Z',
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  return {
    connections,
    hostTargets,
    hostInventory,
    vmInventory,
    templateInventory,
    templateGovernance,
    templateGovernanceHistory,
    templateDeployments,
    auditLog,
    storageInventory,
    vdiInventory,
    networkInventory,
    lifecyclePlans,
    governancePolicy,
    governanceCurrentRole,
    governanceQuotas,
    governanceApprovals,
    users,
    resilienceRunbooks,
    resilienceDrills,
    inventoryWorkspaces,
    tasks,
    remediationTemplates,
    alertInventory,
    alertStates,
    alertPolicies,
  };
}

test('login shell renders the control-plane and direct xen entry points', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'XenMange' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'XenMange Sign In' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Direct Xen Login' })).toBeVisible();
  await expect(page.getByText('admin / admin123!')).toBeVisible();
});

test('demo button opens the dashboard with built-in mock infrastructure data', async ({ page }) => {
  await page.route('**/api/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.goto('/');

  await page.getByRole('button', { name: 'Open Demo Dashboard' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('main').getByText('Demo Production Pool', { exact: true })).toBeVisible();
  await expect(page.getByText('Critical storage latency detected')).toBeVisible();
});

test('dashboard loads after login and shows aggregated metrics', async ({ page }) => {
  await stubAuthenticatedRoutes(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Direct Xen Login' }).click();
  await page.getByLabel('Host Address').fill('10.0.0.1');
  await page.getByLabel('Username').fill('root');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Initialize Connection' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('.dash-card-label').filter({ hasText: 'Virtual Machines' })).toBeVisible();
  await expect(page.getByText('Storage nearing threshold')).toBeVisible();
  await expect(page.getByText('Capacity Watch')).toBeVisible();
  await expect(page.getByText('Capacity drift detected')).toBeVisible();
  await expect(page.getByText('db-01')).toBeVisible();
});

test('control-plane sign-in can attach a saved pool target from the pools workspace', async ({ page }) => {
  await stubAuthenticatedRoutes(page);
  await page.goto('/');

  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin123!');
  await page.getByRole('button', { name: 'Sign In to XenMange' }).click();

  await expect(page).toHaveURL(/\/pools$/);
  await expect(page.getByText('Connect a registered pool target to load live topology.')).toBeVisible();
  await page.locator('.stack-item').filter({ hasText: 'Production Pool' }).getByRole('button', { name: 'Connect' }).click();
  await page.getByLabel('Pool Password').fill('secret');
  await page.getByRole('button', { name: 'Connect to Pool' }).click();

  await expect(page.getByText('connected now')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Production Pool', { exact: true })).toBeVisible();
});

test('local governance workspace can manage control-plane users and session role posture', async ({ page }) => {
  const fixtures = await stubAuthenticatedRoutes(page);
  await page.goto('/');

  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin123!');
  await page.getByRole('button', { name: 'Sign In to XenMange' }).click();

  await page.getByText('Governance').first().click();
  await expect(page).toHaveURL(/\/governance$/);
  await expect(page.getByRole('heading', { name: 'Governance' })).toBeVisible();
  await expect(page.getByText('Role-aware operations, local user administration, pool quotas, and approval-gated destructive actions for the evolving XenMange control plane.')).toBeVisible();
  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByLabel('Username').fill('ops-admin');
  await page.getByLabel('Initial Password').fill('TempPassword123!');
  await page.getByLabel('Display Name').fill('Operations Admin');
  await page.getByLabel('Email').fill('ops-admin@example.com');
  await page.getByLabel('Role Ceiling').selectOption('operator');
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect.poll(() => fixtures.users.some((entry) => entry.username === 'ops-admin')).toBe(true);

  await page.getByRole('button', { name: /Operations Admin/ }).click();
  await page.getByLabel('Email').fill('ops-admin+updated@example.com');
  await page.getByLabel('Role Ceiling').selectOption('admin');
  await page.getByRole('button', { name: 'Save User' }).click();
  await expect.poll(() => fixtures.users.find((entry) => entry.username === 'ops-admin')?.role || '').toBe('admin');

  await page.getByRole('button', { name: 'Reset Password' }).click();
  await page.getByLabel('New Password').fill('BetterPassword123!');
  await page.getByRole('button', { name: 'Rotate Password' }).click();
  await expect(page.getByText('Edit Local User')).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.locator('.dash-card').filter({ hasText: 'Session Role' }).getByRole('button', { name: /Operator/ }).click();
  await page.locator('.dash-card').filter({ hasText: 'Session Role' }).getByRole('button', { name: /Admin/ }).click();
  await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();
});

test('vm operations open a floating window and submit lifecycle actions', async ({ page }) => {
  let shutdownCalled = false;
  let configSaved = false;
  let diskAdded = false;
  let nicAdded = false;
  await stubAuthenticatedRoutes(page);

  const vmRecord = {
    ref: 'OpaqueRef:vm1',
    name_label: 'app-01',
    name_description: 'Primary application node',
    power_state: 'Running',
    VCPUs_at_startup: 4,
    VCPUs_max: 4,
    memory_static_max: 8589934592,
    memory_dynamic_max: 8589934592,
    uuid: 'vm-uuid-1',
    tags: ['prod'],
    resident_on: 'OpaqueRef:host1',
    affinity: 'OpaqueRef:host1',
    VBDs: ['OpaqueRef:vbd1'],
    VIFs: ['OpaqueRef:vif1'],
    HVM_boot_policy: 'UEFI',
    platform: { secureboot: 'enabled' },
  };
  const vdis = [
    { ref: 'OpaqueRef:vdi1', SR: 'OpaqueRef:sr1', name_label: 'disk-01', virtual_size: 10737418240, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd1'] },
  ];
  const networks = [
    { ref: 'OpaqueRef:net1', name_label: 'VM Network', bridge: 'xenbr0', managed: true, uuid: 'net-uuid-1', VIFs: ['OpaqueRef:vif1'], PIFs: ['OpaqueRef:pif1', 'OpaqueRef:pif3'], other_config: { vlan: '120' } },
    { ref: 'OpaqueRef:net2', name_label: 'Backup Network', bridge: 'xenbr1', managed: true, uuid: 'net-uuid-2', VIFs: [], PIFs: ['OpaqueRef:pif2', 'OpaqueRef:pif4'], other_config: { vlan: '220' } },
  ];

  await page.route('**/api/vms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        data: [vmRecord],
      }),
    });
  });

  await page.route('**/api/vms/OpaqueRef%3Avm1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(vmRecord),
    });
  });

  await page.route('**/api/storage/OpaqueRef%3Asr1/vdis', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: vdis.length,
        data: vdis,
      }),
    });
  });

  await page.route('**/api/networks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: networks.length,
        data: networks,
      }),
    });
  });

  await page.route('**/api/vms/OpaqueRef%3Avm1/config', async (route) => {
    const payload = route.request().postDataJSON();
    configSaved = true;
    Object.assign(vmRecord, {
      name_label: payload.nameLabel,
      name_description: payload.nameDescription,
      VCPUs_at_startup: payload.vcpus,
      VCPUs_max: payload.vcpus,
      memory_static_max: payload.memoryStaticMax,
      memory_dynamic_max: payload.memoryStaticMax,
      tags: payload.tags,
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(vmRecord),
    });
  });

  await page.route('**/api/vms/OpaqueRef%3Avm1/disks', async (route) => {
    const payload = route.request().postDataJSON();
    diskAdded = true;
    const nextVbd = `OpaqueRef:vbd${vdis.length + 1}`;
    const nextVdi = `OpaqueRef:vdi${vdis.length + 1}`;
    vmRecord.VBDs = [...vmRecord.VBDs, nextVbd];
    vdis.push({
      ref: nextVdi,
      SR: payload.srRef,
      name_label: payload.nameLabel,
      virtual_size: payload.sizeBytes,
      type: 'user',
      managed: true,
      VBDs: [nextVbd],
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, vdiRef: nextVdi, vbdRef: nextVbd }),
    });
  });

  await page.route('**/api/vms/OpaqueRef%3Avm1/nics', async (route) => {
    const payload = route.request().postDataJSON();
    nicAdded = true;
    const nextVif = `OpaqueRef:vif${vmRecord.VIFs.length + 1}`;
    vmRecord.VIFs = [...vmRecord.VIFs, nextVif];
    const targetNetwork = networks.find((network) => network.ref === payload.networkRef);
    if (targetNetwork) {
      targetNetwork.VIFs = [...targetNetwork.VIFs, nextVif];
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, vifRef: nextVif }),
    });
  });

  await page.route('**/api/vms/shutdown', async (route) => {
    shutdownCalled = true;
    vmRecord.power_state = 'Halted';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Direct Xen Login' }).click();
  await page.getByLabel('Host Address').fill('10.0.0.1');
  await page.getByLabel('Username').fill('root');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Initialize Connection' }).click();

  await page.getByText('Virtual Machines').first().click();
  await expect(page).toHaveURL(/\/vms$/);
  await page.getByText('app-01').click();

  await expect(page.getByText('VM Details')).toBeVisible();
  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Config' }).click();
  await page.getByLabel('VM Name').fill('app-01-renamed');
  await page.getByRole('button', { name: 'Save VM Config' }).click();
  await expect.poll(() => configSaved).toBe(true);
  await expect(page.getByRole('heading', { name: 'app-01-renamed' })).toBeVisible();

  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Add Devices' }).click();
  await page.getByLabel('Disk Name').fill('data-disk-02');
  await page.getByRole('button', { name: 'Add Disk Device' }).click();
  await expect.poll(() => diskAdded).toBe(true);

  await page.getByLabel('Network').selectOption('OpaqueRef:net2');
  await page.getByLabel('Device Slot').fill('1');
  await page.getByRole('button', { name: 'Add Network Device' }).click();
  await expect.poll(() => nicAdded).toBe(true);

  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Resources' }).click();
  await expect(page.getByText('data-disk-02')).toBeVisible();
  await expect(page.getByText('Backup Network')).toBeVisible();

  await page.getByRole('button', { name: 'Shutdown' }).click();

  await expect.poll(() => shutdownCalled).toBe(true);
});

test('pool and host registration flows live alongside the broader operator workbenches', async ({ page }) => {
  const fixtures = await stubAuthenticatedRoutes(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Direct Xen Login' }).click();
  await page.getByLabel('Host Address').fill('10.0.0.1');
  await page.getByLabel('Username').fill('root');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Initialize Connection' }).click();

  await page.getByText('Pools').first().click();
  await expect(page).toHaveURL(/\/pools$/);
  await page.getByRole('button', { name: 'Register Pool' }).click();
  await page.getByLabel('Profile Name').fill('DR Pool');
  await page.getByLabel('Pool Address').fill('10.0.0.55');
  await page.getByRole('button', { name: 'Save Pool Target' }).click();
  await expect(page.getByText('DR Pool')).toBeVisible();
  await page.locator('.data-table').getByText('Production Pool', { exact: true }).click();
  await expect(page.getByText('Associated Hosts')).toBeVisible();
  await expect(page.getByText('alpha-xen')).toBeVisible();
  await page.locator('.floating-window').getByRole('button').last().click();

  await page.getByText('Hosts').first().click();
  await expect(page).toHaveURL(/\/hosts$/);
  await page.getByRole('button', { name: 'Register Host' }).click();
  await page.getByLabel('Host Name').fill('gamma-xen');
  await page.getByLabel('Host Address').fill('10.0.0.13');
  await page.getByLabel('Registration Mode').selectOption('pool-member');
  await page.getByLabel('Target Pool').selectOption('1');
  await page.getByRole('button', { name: 'Save Host Target' }).click();
  await expect(page.getByText('gamma-xen')).toBeVisible();
  await page.locator('.data-table').getByText('alpha-xen', { exact: true }).first().click();
  await expect(page.getByText('Pool Membership')).toBeVisible();
  await expect(page.getByText('Related Host Inventory')).toBeVisible();
  await expect(page.getByText('Primary SR')).toBeVisible();
  await expect(page.getByText('VM Network')).toBeVisible();
  await page.locator('.floating-window').getByRole('button').last().click();

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await expect(page.getByRole('heading', { name: 'Networks' })).toBeVisible();
  await page.locator('.data-table').getByText('VM Network', { exact: true }).click();
  await expect(page.locator('.floating-window').getByText('Host Uplinks', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Connected Workloads', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('alpha-xen', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('app-01', { exact: true })).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.getByText('Templates').first().click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
  await expect(page.getByText('ubuntu-golden')).toBeVisible();
  await expect(page.locator('.data-table').getByText('windows-2025-core', { exact: true })).toBeVisible();
  await expect(page.getByText('Promotion Queue')).toBeVisible();
  await page.locator('.dash-card').filter({ hasText: 'Promotion Queue' }).getByRole('button', { name: /windows-2025-core/ }).click();
  await expect(page.getByText('Template Promotion Review')).toBeVisible();
  await expect(page.getByText('No active stable baseline')).toBeVisible();
  await page.getByLabel('Promotion Notes').fill('Promoted after the Monday, August 24, 2026 template review.');
  await page.getByRole('button', { name: 'Promote to Stable' }).click();
  await expect.poll(() => fixtures.templateGovernance.find((entry) => entry.templateRef === 'OpaqueRef:template2')?.lifecycleStage || '').toBe('stable');
  await expect.poll(() => fixtures.templateGovernanceHistory.some((entry) => entry.templateRef === 'OpaqueRef:template2' && entry.eventType === 'promoted')).toBe(true);
  await page.locator('.data-table').getByText('ubuntu-golden', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Deploy Template' })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('2026.08-lts').first()).toBeVisible();
  await page.getByRole('button', { name: 'Edit Governance' }).click();
  await page.getByLabel('Catalog Owner').fill('Cloud Platform');
  await page.getByLabel('Governance Notes').fill('Validated for the August 20, 2026 production ring.');
  await page.getByRole('button', { name: 'Save Governance' }).click();
  await expect.poll(() => fixtures.templateGovernance.find((entry) => entry.templateRef === 'OpaqueRef:template1')?.owner || '').toBe('Cloud Platform');
  await page.getByRole('button', { name: 'Deploy Template' }).click();
  await page.getByLabel('VM Name').fill('ubuntu-prod-01');
  await page.getByRole('button', { name: 'Deploy VM' }).click();
  await expect(page.getByText('Deployment Submitted')).toBeVisible();
  await expect(page.getByText(/ubuntu-prod-01 prepared on alpha-xen and started\./)).toBeVisible();
  await page.locator('.floating-window .fw-close').last().click();
  await page.locator('.floating-window .fw-close').first().click();
  await expect(page.getByText('Recent Deployments', { exact: true })).toBeVisible();
  await expect(page.getByText(/Primary SR · VM Network/)).toBeVisible();
  await page.getByRole('button', { name: /ubuntu-prod-01 ubuntu-golden/ }).click();
  await expect(page.getByText('Deployment Record')).toBeVisible();
  await page.getByLabel('Validation Status').selectOption('validated');
  await page.getByLabel('Guest Customization').fill('cloud-init baseline');
  await page.getByLabel('Guest boot completed and operator console access was confirmed').evaluate((element) => { element.click(); });
  await page.getByLabel('Primary network, addressing, and expected connectivity were verified').evaluate((element) => { element.click(); });
  await page.getByLabel('Root disk, mapped storage, and expected capacity were validated').evaluate((element) => { element.click(); });
  await page.getByLabel('Governance or workload tags were applied to the deployed VM').evaluate((element) => { element.click(); });
  await page.getByLabel('Validation Notes').fill('Validated after first boot on August 20, 2026.');
  await page.getByRole('button', { name: 'Save Validation' }).click();
  await expect.poll(() => fixtures.templateDeployments.find((entry) => entry.vmName === 'ubuntu-prod-01')?.validationStatus || '').toBe('validated');
  await page.locator('.floating-window .fw-close').last().click();

  await page.getByText('Alerts').first().click();
  await expect(page).toHaveURL(/\/alerts$/);
  await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();
  await expect(page.getByText('Storage nearing threshold')).toBeVisible();
  await page.locator('.data-table').getByText('Storage nearing threshold', { exact: true }).click();
  await expect(page.getByText('Alert Record')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Storage View' })).toBeVisible();
  await page.getByRole('button', { name: 'Create Follow-Through Task' }).click();
  await expect(page.getByLabel('Task Name')).toBeVisible();
  await page.getByLabel('Task Name').fill('Capacity Review: Storage nearing threshold');
  await page.getByLabel('Assignee').fill('Cloud Operations');
  await page.getByLabel('Due Date').fill('2026-08-24');
  await page.getByLabel('Task Notes').fill('Review the datastore pressure before the Monday, August 24, 2026 capacity review.');
  await page.getByRole('button', { name: 'Create Remediation Task' }).last().click();
  await expect.poll(() => fixtures.tasks[0]?.name_label || '').toBe('Capacity Review: Storage nearing threshold');
  await expect(page).toHaveURL(/\/activity\?/);
  await expect(page.getByText('Task Detail')).toBeVisible();
  await expect(page.getByText('Remediation Context')).toBeVisible();
  await expect(page.getByText('Cloud Operations', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('2026-08-24', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Source Alert' })).toBeVisible();
  await page.getByLabel('Status').selectOption('success');
  await page.getByLabel('Result / Closure Note').fill('Mitigation completed on Saturday, August 22, 2026.');
  await page.getByRole('button', { name: 'Save Task Update' }).click();
  await expect.poll(() => fixtures.tasks[0]?.status || '').toBe('success');
  await expect(page.getByText('Mitigation completed on Saturday, August 22, 2026.')).toBeVisible();
  await page.getByText('Alerts').first().click();
  await expect(page).toHaveURL(/\/alerts$/);
  await page.locator('.data-table').getByText('Storage nearing threshold', { exact: true }).click();
  await page.getByLabel('Severity Override').selectOption('info');
  await page.getByLabel('Health Action').selectOption('review');
  await page.getByLabel('Operator Notes').fill('Handled during storage maintenance.');
  await page.getByLabel('Acknowledge this alert for the current operator queue').evaluate((element) => { element.click(); });
  await page.getByRole('button', { name: 'Save Alert State' }).click();
  await expect.poll(() => fixtures.alertStates['OpaqueRef:msg1']?.acknowledged || false).toBe(true);
  await expect.poll(() => fixtures.alertStates['OpaqueRef:msg1']?.healthAction || '').toBe('review');
  await page.locator('.floating-window .fw-close').first().click();
  await page.locator('.data-table').getByText('Storage nearing threshold', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Storage View' }).click();
  await expect(page).toHaveURL(/\/storage\?/);
  await expect(page.locator('.floating-window').getByText('Primary SR', { exact: true })).toBeVisible();
  await expect(page.getByText('Attached VDIs')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Attachment Topology', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText(/OpaqueRef:vbd1 · app-01/)).toBeVisible();
  await page.locator('.floating-window').getByRole('button', { name: 'Open VM' }).first().click();
  await expect(page).toHaveURL(/\/vms\?/);
  await expect(page.getByText('VM Details')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('app-01', { exact: true })).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();
  await page.getByText('Alerts').first().click();
  await expect(page).toHaveURL(/\/alerts$/);
  await page.getByRole('button', { name: 'New Policy' }).click();
  await page.getByLabel('Policy Name').fill('Storage Warning Review');
  await page.getByLabel('Match Class').selectOption('sr');
  await page.getByLabel('Target Workspace').selectOption('/storage');
  await page.getByLabel('Match Object / UUID').fill('sr-uuid-1');
  await page.getByLabel('Match Severity').selectOption('warning');
  await page.getByLabel('Match Text').fill('storage threshold');
  await page.getByLabel('Text Match Mode').selectOption('all');
  await page.getByLabel('Suppress For (hours)').fill('12');
  await page.getByLabel('Workflow Action').selectOption('capacity');
  await page.getByLabel('Policy Notes').fill('Create this policy on Saturday, August 22, 2026 for recurring storage warnings.');
  await page.getByRole('button', { name: 'Create Alert Policy' }).click();
  await expect.poll(() => fixtures.alertPolicies[0]?.name || '').toBe('Storage Warning Review');
  await expect.poll(() => fixtures.alertPolicies[0]?.matchTargetRoute || '').toBe('/storage');
  await expect.poll(() => fixtures.alertPolicies[0]?.textMatchMode || '').toBe('all');
  await expect(page.getByRole('button', { name: 'Storage Warning Review' })).toBeVisible();
  await expect(page.getByText(/policy Storage Warning Review/i)).toBeVisible();
  await page.getByRole('button', { name: 'New Template' }).click();
  await page.getByLabel('Template Name').fill('Storage Capacity Review Template');
  await page.getByLabel('Match Class').selectOption('sr');
  await page.getByLabel('Match Workspace').selectOption('/storage');
  await page.getByLabel('Match Text').fill('storage threshold');
  await page.getByLabel('Text Match Mode').selectOption('all');
  await page.getByLabel('Workflow Action').selectOption('capacity');
  await page.getByLabel('Launch Behavior').selectOption('queue');
  await page.getByLabel('Recurrence Guard').selectOption('daily');
  await page.getByLabel('Task Name Template').fill('Template Capacity Review: {summary}');
  await page.getByLabel('Default Assignee').fill('Template Ops');
  await page.getByLabel('Default Due In (days)').fill('2');
  await page.getByLabel('Default Target Workspace').selectOption('/capacity');
  await page.getByLabel('Default Task Notes').fill('Standardize the datastore review before Monday, August 24, 2026.');
  await page.getByLabel('Workspace Brief Template').fill('Validate datastore pressure, confirm the follow-through owner, and capture supporting evidence for {summary}.');
  await page.getByLabel('Evidence Checklist').fill('Capture current latency evidence for {summary}.\nReview affected workloads on {object}.');
  await page.getByLabel('Completion Criteria').fill('Named owner accepts the remediation task.\nClosure note is recorded in Activity after validation.');
  await page.getByRole('button', { name: 'Create Remediation Template' }).click();
  await expect.poll(() => fixtures.remediationTemplates[0]?.name || '').toBe('Storage Capacity Review Template');
  await expect(page.getByText('Launch: queue immediately · Guard: daily per object')).toBeVisible();
  await page.locator('.data-table').getByText('Storage nearing threshold', { exact: true }).click();
  await expect(page.getByText('Recommended Templates')).toBeVisible();
  await page.locator('.stack-item').filter({ hasText: 'Storage Capacity Review Template' }).getByRole('button', { name: 'Queue Now' }).click();
  await expect.poll(() => fixtures.tasks[0]?.name_label || '').toBe('Template Capacity Review: Storage nearing threshold');
  await expect(page).toHaveURL(/\/activity\?/);
  await expect(page.locator('.floating-window').getByText('Template Ops', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Queue Immediately')).toBeVisible();
  await expect(page.getByText('Daily per object')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Due in 2d', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Validate datastore pressure, confirm the follow-through owner, and capture supporting evidence for Storage nearing threshold.')).toBeVisible();
  await expect(page.getByText('Capture current latency evidence for Storage nearing threshold.')).toBeVisible();
  await expect(page.getByText('Named owner accepts the remediation task.')).toBeVisible();
  await page.getByText('Capacity').first().click();
  await expect(page).toHaveURL(/\/capacity$/);
  await expect(page.getByText('Telemetry Window', { exact: true })).toBeVisible();
  await expect(page.getByText('Cluster Memory Trend', { exact: true })).toBeVisible();
  await expect(page.getByText('Staged Automation Queue')).toBeVisible();
  await expect(page.getByText('Due in 2d')).toBeVisible();
  await expect(page.getByText('2 evidence · 2 completion')).toBeVisible();
  await page.getByText('Alerts').first().click();
  await expect(page).toHaveURL(/\/alerts$/);
  await page.getByLabel('Select Storage nearing threshold').click();
  await page.getByLabel('Select Host maintenance scheduled').click();
  await page.getByRole('button', { name: 'Suppress 4h' }).click();
  await expect.poll(() => Boolean(fixtures.alertStates['OpaqueRef:msg1']?.suppressionUntil)).toBe(true);
  await expect.poll(() => Boolean(fixtures.alertStates['OpaqueRef:msg2']?.suppressionUntil)).toBe(true);

  await page.getByText('Activity').first().click();
  await expect(page).toHaveURL(/\/activity$/);
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await page.getByRole('button', { name: 'Tasks' }).click();
  await expect(page.getByText('Patch compliance scan')).toBeVisible();
  await page.getByRole('button', { name: 'Recent Changes' }).click();
  await expect(page.getByText('Saved template governance for 2026.08-lts')).toBeVisible();
  await page.getByRole('button', { name: 'Log Center' }).click();
  await expect(page.getByRole('button', { name: 'Auth Events' })).toBeVisible();
  await expect(page.locator('.data-table').getByText('Storage nearing threshold', { exact: true })).toBeVisible();
  await page.locator('.data-table').getByText('Storage nearing threshold', { exact: true }).click();
  await expect(page.getByText('Log Detail')).toBeVisible();
  await expect(page.getByText('Raw Record')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Origin Workspace' })).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();
  await page.getByRole('button', { name: 'Audit Trail' }).click();
  await expect(page.getByText('Updated deployment validation for ubuntu-prod-01')).toBeVisible();
  await page.locator('.data-table').getByText('Updated deployment validation for ubuntu-prod-01', { exact: true }).click();
  await expect(page.getByText('Audit Detail')).toBeVisible();
  await expect(page.getByText('validated validation with guest customization cloud-init baseline.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Affected Record' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Affected Record' }).click();
  await expect(page).toHaveURL(/\/vms\?/);
  await expect(page.getByText('VM Details')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('ubuntu-prod-01', { exact: true })).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.locator('.tree-item').filter({ hasText: 'Inventory' }).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await page.getByRole('button', { name: 'VBDs' }).click();
  await page.getByPlaceholder('Search live inventory, alerts, tasks, UUIDs, and tags...').fill('OpaqueRef:vbd1');
  await expect(page.getByText('VBD app-01')).toBeVisible();
  await page.locator('.data-table').getByText('VBD app-01', { exact: true }).click();
  await expect(page.getByText('Inventory Result Detail')).toBeVisible();
  await page.getByRole('button', { name: 'Open Workspace' }).click();
  await expect(page).toHaveURL(/\/storage\?/);
  await expect(page.locator('.floating-window').getByText('Attachment Topology', { exact: true })).toBeVisible();
  await expect(page.getByText('focused attachment')).toBeVisible();
  await page.locator('.stack-item').filter({ hasText: 'focused attachment' }).getByRole('button', { name: 'Open Host' }).click();
  await expect(page).toHaveURL(/\/hosts\?/);
  await expect(page.getByText('Related Host Inventory')).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.locator('.tree-item').filter({ hasText: 'Inventory' }).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await page.getByRole('button', { name: 'VIFs' }).click();
  await page.getByPlaceholder('Search live inventory, alerts, tasks, UUIDs, and tags...').fill('OpaqueRef:vif1');
  await expect(page.getByText('VIF app-01')).toBeVisible();
  await page.locator('.data-table').getByText('VIF app-01', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Workspace' }).click();
  await expect(page).toHaveURL(/\/networking\?/);
  await expect(page.getByText('focused interface')).toBeVisible();
  await page.locator('.stack-item').filter({ hasText: 'focused interface' }).getByRole('button', { name: 'Open VM' }).click();
  await expect(page).toHaveURL(/\/vms\?/);
  await expect(page.getByText('VM Details')).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.locator('.tree-item').filter({ hasText: 'Inventory' }).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await page.getByRole('button', { name: 'All' }).click();
  await page.getByPlaceholder('Search live inventory, alerts, tasks, UUIDs, and tags...').fill('alpha');
  await page.getByPlaceholder('Name this search preset...').fill('Host Alpha');
  await page.locator('select.form-input').selectOption('1');
  await page.getByRole('button', { name: 'Save Workspace' }).click();
  await expect(page.getByText('Host Alpha')).toBeVisible();
  await expect(page.getByText('Target Production Pool')).toBeVisible();
  await page.getByRole('button', { name: 'Open Target' }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Direct Xen Login' })).toHaveClass(/btn-primary/);
  await expect(page.getByLabel('Host Address')).toHaveValue('10.0.0.1');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Initialize Connection' }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await page.locator('.data-table').getByText('alpha-xen', { exact: true }).click();
  await expect(page.getByText('Inventory Result Detail')).toBeVisible();
  await page.getByRole('button', { name: 'Open Workspace' }).click();
  await expect(page).toHaveURL(/\/hosts\?/);
  await expect(page.getByText('Host Properties')).toBeVisible();
  await expect(page.locator('.floating-window .property-grid').getByText('10.0.0.11').first()).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.getByText('Governance').first().click();
  await expect(page).toHaveURL(/\/governance$/);
  await expect(page.getByRole('heading', { name: 'Governance' })).toBeVisible();
  await expect(page.getByText('Role-aware operations, local user administration, pool quotas, and approval-gated destructive actions for the evolving XenMange control plane.')).toBeVisible();
  await page.locator('.dash-card').filter({ hasText: 'Session Role' }).getByRole('button', { name: /Operator/ }).click();
  await page.getByRole('button', { name: 'Request Approval' }).click();
  await page.getByLabel('Approval Action').selectOption('vm_suspend');
  await page.getByLabel('Entity Type').selectOption('vm');
  await page.getByLabel('Entity Ref').fill('OpaqueRef:vm1');
  await page.getByLabel('Entity Name').fill('app-01');
  await page.getByLabel('Route').fill('/vms');
  await page.getByLabel('Justification').fill('Controlled suspend request for the Friday, August 21, 2026 recovery validation window.');
  await page.locator('.floating-window').last().locator('form').getByRole('button', { name: 'Request Approval' }).click();
  await expect.poll(() => fixtures.governanceApprovals[0]?.actionKey || '').toBe('vm_suspend');
  await page.locator('.dash-card').filter({ hasText: 'Session Role' }).getByRole('button', { name: /Admin/ }).click();
  await page.locator('.dash-card').filter({ hasText: 'Governance Policy' }).getByLabel('Default Role').selectOption('operator');
  await page.locator('.dash-card').filter({ hasText: 'Governance Policy' }).getByLabel('Approval Window (minutes)').fill('180');
  await page.locator('.dash-card').filter({ hasText: 'Governance Policy' }).getByRole('button', { name: 'Save Governance Policy' }).click();
  await page.locator('.dash-card').filter({ hasText: 'Pool Quotas' }).getByRole('button', { name: /Production Pool/ }).click();
  await page.getByLabel('Max VMs').fill('9');
  await page.getByLabel('Quota Notes').fill('Updated on Friday, August 21, 2026 for the current production envelope.');
  await page.locator('.floating-window').last().getByRole('button', { name: 'Save Pool Quota' }).click();
  await expect.poll(() => fixtures.governanceQuotas.find((entry) => entry.poolRef === 'OpaqueRef:pool1')?.maxVmCount || 0).toBe(9);
  await page.locator('.dash-card').filter({ hasText: 'Approval Queue' }).getByRole('button', { name: 'Approve' }).first().click();
  await expect.poll(() => fixtures.governanceApprovals[0]?.status || '').toBe('approved');

  await page.getByText('Lifecycle').first().click();
  await expect(page).toHaveURL(/\/lifecycle$/);
  await expect(page.getByRole('heading', { name: 'Lifecycle' })).toBeVisible();
  await expect(page.getByText('Compliance posture, maintenance prep, and drift review in one queue.')).toBeVisible();
  await page.locator('.dash-card').filter({ hasText: 'Compliance Queue' }).getByText('alpha-xen', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Lifecycle Plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Lifecycle Plan' }).click();
  await page.getByLabel('Baseline Status').selectOption('drifted');
  await page.getByLabel('Target Stage').selectOption('remediate');
  await page.getByLabel('Next Action').selectOption('patch');
  await page.getByLabel('Maintenance Window').fill('Sat 01:00');
  await page.getByLabel('Patch Group').fill('Production Ring B');
  await page.getByLabel('Owner').fill('Platform Ops');
  await page.getByLabel('Due Date').fill('2026-08-23');
  await page.getByLabel('Plan Notes').fill('Apply August host baseline');
  await page.getByLabel('Reboot required after remediation').evaluate((element) => { element.click(); });
  await page.getByLabel('Evacuate workloads before work begins').evaluate((element) => { element.click(); });
  await page.getByRole('button', { name: 'Save Lifecycle Plan' }).click();
  await expect(page.getByText('Current Planner Record')).toBeVisible();
  await expect.poll(() => fixtures.lifecyclePlans.find((plan) => plan.hostRef === 'OpaqueRef:host1')?.owner || '').toBe('Platform Ops');
  await expect.poll(() => fixtures.lifecyclePlans.find((plan) => plan.hostRef === 'OpaqueRef:host1')?.patchGroup || '').toBe('Production Ring B');
  await page.locator('.floating-window .fw-close').last().click();
  await page.locator('.floating-window .fw-close').first().click();

  await page.getByText('Capacity').first().click();
  await expect(page).toHaveURL(/\/capacity$/);
  await expect(page.getByRole('heading', { name: 'Capacity' })).toBeVisible();
  await expect(page.getByText('Headroom, saturation, and imbalance before they become incidents.')).toBeVisible();
  await expect(page.getByRole('button', { name: /alpha-xen 10\.0\.0\.11 · 2 VMs/ })).toBeVisible();
  await expect(page.getByText('Top VM Consumers')).toBeVisible();
  await expect(page.getByText('Noisy-Neighbor Candidates')).toBeVisible();
  await page.getByRole('button', { name: /db-01/ }).click();
  await expect(page.getByText('Placement Guidance')).toBeVisible();
  await page.locator('.floating-window .fw-close').last().click();

  await page.getByText('Resilience').first().click();
  await expect(page).toHaveURL(/\/resilience$/);
  await expect(page.getByRole('heading', { name: 'Resilience' })).toBeVisible();
  await expect(page.getByText('Protection coverage, failover posture, recovery runbooks, and drill evidence in one operator workspace.')).toBeVisible();
  await expect(page.getByRole('button', { name: /app-01/ })).toBeVisible();
  await page.locator('.dash-card').filter({ hasText: 'Recovery Plans' }).getByRole('button', { name: /Production Pool/ }).click();
  await expect(page.getByText('Runbook Steps')).toBeVisible();
  await page.locator('.floating-window').last().getByRole('button', { name: 'Edit Runbook' }).click();
  await page.getByLabel('Recovery Tier').selectOption('tier-1');
  await page.getByLabel('HA Policy').selectOption('priority-restart');
  await page.getByLabel('Restart Priority').selectOption('highest');
  await page.getByLabel('Backup Window (hours)').fill('8');
  await page.getByLabel('Restore-Point Status').selectOption('current');
  await page.getByLabel('RPO (minutes)').fill('20');
  await page.getByLabel('RTO (minutes)').fill('60');
  await page.getByLabel('Owner').fill('Recovery Ops');
  await page.getByLabel('Runbook Notes').fill('Tighten sequencing and confirm application dependency order.');
  await page.getByRole('button', { name: 'Save Recovery Runbook' }).click();
  await expect.poll(() => fixtures.resilienceRunbooks.find((record) => record.poolRef === 'OpaqueRef:pool1')?.owner || '').toBe('Recovery Ops');
  await expect.poll(() => fixtures.resilienceRunbooks.find((record) => record.poolRef === 'OpaqueRef:pool1')?.haPolicy || '').toBe('priority-restart');
  await page.locator('.floating-window').last().getByRole('button', { name: 'Log Drill' }).click();
  await page.getByLabel('Drill Type').selectOption('failover');
  await page.getByLabel('Outcome').selectOption('success');
  await page.getByLabel('Scope').fill('Primary workload failover rehearsal');
  await page.getByLabel('Executed At').fill('2026-08-21T14:00');
  await page.getByLabel('Duration (minutes)').fill('39');
  await page.getByLabel('Summary').fill('Failover run completed within the target envelope.');
  await page.getByLabel('Findings').fill('The standby host absorbed the workload without manual storage repair.');
  await page.getByLabel('Next Step').fill('Repeat the same drill after the next template rollout.');
  await page.locator('.floating-window').last().locator('form').getByRole('button', { name: 'Log Drill' }).click();
  await expect.poll(() => fixtures.resilienceDrills[0]?.drillType || '').toBe('failover');
  await expect.poll(() => fixtures.resilienceDrills[0]?.summary || '').toBe('Failover run completed within the target envelope.');
});

test('settings workspace saves runtime configuration and previews retention', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await page.goto('/');
  await page.getByRole('button', { name: 'Direct Xen Login' }).click();
  await page.getByLabel('Host Address').fill('10.0.0.1');
  await page.getByLabel('Username').fill('root');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Initialize Connection' }).click();

  await page.getByText('Settings').first().click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('Configuration Plane')).toBeVisible();
  await expect(page.getByText('Production Pool Root')).toBeVisible();
  await expect(page.getByText('Environment Variable')).toBeVisible();

  await page.getByLabel('Application Name').fill('XenMange Ops');
  await page.getByRole('button', { name: 'Save General Settings' }).click();
  await expect(page.getByText('XenMange Ops')).toBeVisible();

  await page.getByRole('button', { name: 'Add Credential' }).click();
  await expect(page.locator('.floating-window .fw-title').last()).toHaveText('Add Vault Credential');
  await page.getByLabel('Credential Name').fill('Branch Host Root');
  await page.getByLabel('Visibility').selectOption('private');
  await page.getByLabel('Target Type').selectOption('host');
  await page.getByLabel('Target Hint').fill('10.0.0.25');
  await page.getByLabel('Username').fill('root');
  await page.getByLabel('Password').fill('branch-secret');
  await page.getByRole('button', { name: 'Save Vault Credential' }).click();
  await expect.poll(() => page.locator('body').textContent()).toContain('Branch Host Root');

  await page.getByText('Branch Host Root').click();
  await expect(page.locator('.floating-window .fw-title').last()).toHaveText('Edit Vault Credential');
  await page.getByLabel('Credential Name').fill('Branch Host Root Rotated');
  await page.getByLabel('Rotate Secret').fill('branch-secret-2');
  await page.getByRole('button', { name: 'Save Credential Changes' }).click();
  await expect.poll(() => page.locator('body').textContent()).toContain('Branch Host Root Rotated');
  await page.getByRole('button', { name: 'Delete Credential' }).click();
  await expect.poll(() => page.locator('body').textContent()).not.toContain('Branch Host Root Rotated');

  await page.getByText('Authentication Events').click();
  await expect(page.locator('.floating-window .fw-title').last()).toHaveText('Retention Policy');
  await page.getByLabel('Retention Window (days)').fill('45');
  await page.getByRole('button', { name: 'Save Retention Policy' }).click();
  await expect(page.getByText('45 day window')).toBeVisible();

  await page.getByRole('button', { name: 'Preview This Domain' }).click();
  await expect(page.getByText('1 record(s) would be purged.')).toBeVisible();
});
