const { test, expect } = require('@playwright/test');

function getFloatingWindowByTitle(page, title) {
  return page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: title }),
  }).last();
}

async function openDataTableRecord(page, name) {
  const row = page.locator('.data-table tbody tr').filter({ hasText: name }).first();
  await row.locator('td').last().click();
}

async function signInToControlPlane(page, options = {}) {
  await page.goto('/');
  await page.getByLabel('Username').fill(options.username || 'admin');
  await page.getByLabel('Password').fill(options.password || 'admin123!');
  await page.getByRole('button', { name: 'Sign In to XenMange' }).click();
}

async function connectSavedPoolTarget(page, options = {}) {
  await page.locator('.section-head').getByRole('button', { name: /Registered Pool Targets/ }).click();
  const registeredTargetsWindow = getFloatingWindowByTitle(page, 'Registered Pool Targets');
  await registeredTargetsWindow
    .locator('.stack-item')
    .filter({ hasText: options.connectionName || 'Production Pool' })
    .getByRole('button', { name: 'Connect' })
    .click();
  await page.getByLabel('Pool Password').fill(options.password || 'secret');
  await page.getByRole('button', { name: 'Connect to Pool' }).click();
}

async function signInAndConnectDefaultTarget(page, options = {}) {
  await signInToControlPlane(page, options);
  await expect(page).toHaveURL(/\/pools(?:\?.*)?$/);
  await connectSavedPoolTarget(page, options);
}

async function stubAuthenticatedRoutes(page, options = {}) {
  const connections = [
    { id: 1, name: 'Production Pool', host: '10.0.0.1', username: 'root', port: 443, is_default: 1 },
  ];
  const poolInventory = [
    {
      ref: 'OpaqueRef:pool1',
      name_label: 'Production Pool',
      name_description: 'Primary shared virtualization pool.',
      uuid: 'pool-uuid',
      master: 'OpaqueRef:host1',
      slaves: ['OpaqueRef:host2'],
      tags: ['prod'],
      default_SR: 'OpaqueRef:sr1',
      vswitch_controller: '10.0.0.80',
      migration_compression: false,
      wlb_enabled: false,
      wlb_url: 'https://wlb-west.example.internal',
      IGMP_snooping_enabled: false,
      migration_network: 'OpaqueRef:net1',
      ha_enabled: false,
      ha_configuration: {},
      ha_host_failures_to_tolerate: 0,
      ha_overcommitted: false,
      ha_plan_exists_for: 0,
      ha_statefiles: [],
      ha_cluster_stack: '',
      other_config: { cluster_profile: 'balanced', lifecycle: 'managed' },
    },
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
    {
      id: 2,
      ownerUserId: 1,
      scope: 'private',
      targetType: 'host',
      targetHint: '10.0.0.25',
      name: 'Branch Host Root',
      username: 'root',
      createdAt: '2026-08-24T09:10:00.000Z',
      updatedAt: '2026-08-24T09:11:00.000Z',
      lastUsedAt: '',
      lastUsedBy: null,
    },
  ];
  const hostInventory = [
    {
      ref: 'OpaqueRef:host1',
      name_label: 'alpha-xen',
      name_description: 'Primary compute node in the west pool.',
      address: '10.0.0.11',
      uuid: 'host-uuid-1',
      pool: 'OpaqueRef:pool1',
      enabled: true,
      maintenance_mode: false,
      tags: ['prod'],
      edition: 'Enterprise',
      license_server: { address: '10.0.0.90', port: '27000' },
      software_version: { product_version: '8.4.0', product_brand: 'XenServer', platform_name: 'west-cluster-master' },
      virtual_hardware_platform_versions: ['1', '2', '3', '4'],
      external_auth_type: 'AD',
      external_auth_service_name: 'corp.example.internal',
      external_auth_configuration: { domain: 'corp.example.internal', server: 'ldap01.corp.example.internal' },
      guest_VCPUs_params: { weight: '256', cap: '0' },
      sched_gran: 'cpu',
      ssl_legacy: false,
      bios_strings: { 'system-manufacturer': 'Dell Inc.', 'system-product-name': 'PowerEdge R750', 'bios-version': '1.12.2' },
      PIFs: ['OpaqueRef:pif1', 'OpaqueRef:pif2'],
      PBDs: ['OpaqueRef:pbd1'],
      cpu_info: { cpu_count: '24', socket_count: '2', cores_per_socket: '6', threads_per_core: '2', modelname: 'AMD EPYC' },
      logging: { syslog_destination: '10.0.0.50' },
      resident_VMs: ['OpaqueRef:vm1'],
    },
    {
      ref: 'OpaqueRef:host2',
      name_label: 'beta-xen',
      name_description: 'Secondary compute node in the west pool.',
      address: '10.0.0.12',
      uuid: 'host-uuid-2',
      pool: 'OpaqueRef:pool1',
      enabled: true,
      maintenance_mode: false,
      tags: ['prod'],
      edition: 'Standard',
      license_server: {},
      software_version: { product_version: '8.4.0', product_brand: 'XenServer', platform_name: 'west-cluster-secondary' },
      virtual_hardware_platform_versions: ['1', '2', '3'],
      external_auth_type: '',
      external_auth_service_name: '',
      external_auth_configuration: {},
      guest_VCPUs_params: {},
      sched_gran: 'core',
      ssl_legacy: false,
      bios_strings: { 'system-manufacturer': 'Dell Inc.', 'system-product-name': 'PowerEdge R750', 'bios-version': '1.11.0' },
      PIFs: ['OpaqueRef:pif3', 'OpaqueRef:pif4'],
      PBDs: ['OpaqueRef:pbd1'],
      cpu_info: { cpu_count: '24', socket_count: '2', cores_per_socket: '6', threads_per_core: '2', modelname: 'AMD EPYC' },
      logging: {},
      resident_VMs: ['OpaqueRef:vm2'],
    },
  ];
  const vmInventory = [
    {
      ref: 'OpaqueRef:vm1',
      name_label: 'app-01',
      name_description: 'Primary application node',
      user_version: 4,
      start_delay: 15,
      shutdown_delay: 20,
      order: 2,
      power_state: 'Running',
      VCPUs_at_startup: 4,
      VCPUs_max: 4,
      memory_static_min: 4294967296,
      memory_dynamic_min: 6442450944,
      memory_static_max: 8589934592,
      memory_dynamic_max: 8589934592,
      uuid: 'vm-uuid-1',
      tags: ['prod'],
      resident_on: 'OpaqueRef:host1',
      affinity: 'OpaqueRef:host1',
      appliance: 'OpaqueRef:appliance1',
      snapshot_schedule: 'OpaqueRef:vmss1',
      guest_metrics: 'OpaqueRef:guestmetrics1',
      guest_metrics_record: {
        ref: 'OpaqueRef:guestmetrics1',
        live: true,
        last_updated: '2026-08-27T11:05:00.000Z',
        os_version: { name: 'Ubuntu', distro: '24.04 LTS', uname: '6.8.0-40-generic' },
        PV_drivers_detected: true,
        PV_drivers_up_to_date: true,
        PV_drivers_version: { major: '9', minor: '4' },
        networks: { '0/ip': '10.0.0.101', '0/ipv6/0': 'fd00::101' },
      },
      recommendations: '<restrictions><vcpus max="8"/><memory static-min="4294967296"/></restrictions>',
      blocked_operations: {},
      other_config: { owner: 'platform-ops' },
      xenstore_data: { 'vm-data/cloud-init': 'disabled' },
      NVRAM: { 'EFI/BootOrder': '0001,0002' },
      VBDs: ['OpaqueRef:vbd1'],
      VIFs: ['OpaqueRef:vif1'],
      consoles: ['OpaqueRef:console1'],
      HVM_boot_policy: 'UEFI',
      domain_type: 'hvm',
      hardware_platform_version: 3,
      has_vendor_device: true,
      last_boot_CPU_flags: { aes: 'true', avx: 'true', sse4_2: 'true' },
      platform: { secureboot: 'enabled', videoram: '8', igd_passthrough: 'false' },
      VCPUs_params: { weight: '256', cap: '0' },
    },
    {
      ref: 'OpaqueRef:vm2',
      name_label: 'db-01',
      name_description: 'Database node',
      user_version: 9,
      start_delay: 60,
      shutdown_delay: 75,
      order: 4,
      power_state: 'Running',
      VCPUs_at_startup: 8,
      VCPUs_max: 8,
      memory_static_min: 8589934592,
      memory_dynamic_min: 12884901888,
      memory_static_max: 17179869184,
      memory_dynamic_max: 17179869184,
      uuid: 'vm-uuid-2',
      tags: ['prod', 'database'],
      resident_on: 'OpaqueRef:host2',
      affinity: 'OpaqueRef:host2',
      appliance: 'OpaqueRef:appliance2',
      snapshot_schedule: 'OpaqueRef:vmss2',
      guest_metrics: 'OpaqueRef:guestmetrics2',
      guest_metrics_record: {
        ref: 'OpaqueRef:guestmetrics2',
        live: true,
        last_updated: '2026-08-27T10:15:00.000Z',
        os_version: { name: 'Windows Server', major: '2025' },
        PV_drivers_detected: true,
        PV_drivers_up_to_date: true,
        PV_drivers_version: { major: '9', minor: '4' },
        networks: { '0/ip': '10.0.0.102' },
      },
      recommendations: '',
      blocked_operations: { pool_migrate: 'OPERATION_NOT_ALLOWED' },
      other_config: { owner: 'database-team' },
      xenstore_data: { 'vm-data/cloud-init': 'enabled' },
      NVRAM: { 'EFI/BootOrder': '0001' },
      VBDs: ['OpaqueRef:vbd2'],
      VIFs: [],
      consoles: ['OpaqueRef:console2'],
      HVM_boot_policy: 'UEFI',
      domain_type: 'hvm',
      hardware_platform_version: 3,
      has_vendor_device: true,
      last_boot_CPU_flags: { aes: 'true', avx: 'true' },
      platform: { secureboot: 'enabled', videoram: '16', igd_passthrough: 'false' },
      VCPUs_params: { weight: '128', cap: '0' },
    },
  ];
  const vmAppliances = [
    {
      ref: 'OpaqueRef:appliance1',
      uuid: 'appliance-uuid-1',
      name_label: 'Application Stack',
      name_description: 'Coordinates the primary application workloads.',
      VMs: ['OpaqueRef:vm1'],
    },
    {
      ref: 'OpaqueRef:appliance2',
      uuid: 'appliance-uuid-2',
      name_label: 'Database Stack',
      name_description: 'Coordinates the database workloads.',
      VMs: ['OpaqueRef:vm2'],
    },
  ];
  const vmSnapshotSchedules = [
    {
      ref: 'OpaqueRef:vmss1',
      uuid: 'vmss-uuid-1',
      name_label: 'Nightly Application Recovery',
      name_description: 'Nightly snapshots for the application tier.',
      enabled: true,
      type: 'snapshot',
      frequency: 'daily',
      retained_snapshots: 7,
      schedule: { hour: '02', min: '30', days: '1,2,3,4,5' },
      VMs: ['OpaqueRef:vm1'],
    },
    {
      ref: 'OpaqueRef:vmss2',
      uuid: 'vmss-uuid-2',
      name_label: 'Weekly Database Checkpoint',
      name_description: 'Weekly checkpoint cadence for the database tier.',
      enabled: true,
      type: 'checkpoint',
      frequency: 'weekly',
      retained_snapshots: 4,
      schedule: { hour: '03', min: '15', days: '0' },
      VMs: ['OpaqueRef:vm2'],
    },
  ];
  const consoleInventory = [
    {
      ref: 'OpaqueRef:console1',
      VM: 'OpaqueRef:vm1',
      protocol: 'rfb',
      location: '/console?ref=OpaqueRef:vm1',
      uuid: 'console-uuid-1',
      other_config: { display: 'main' },
    },
    {
      ref: 'OpaqueRef:console2',
      VM: 'OpaqueRef:vm2',
      protocol: 'rfb',
      location: '/console?ref=OpaqueRef:vm2',
      uuid: 'console-uuid-2',
      other_config: { display: 'main' },
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
  const templateDeploymentRuns = [];
  const storageInventory = JSON.parse(JSON.stringify(Array.isArray(options.storageInventory) ? options.storageInventory : [
    {
      ref: 'OpaqueRef:sr1',
      name_label: 'Primary SR',
      name_description: 'Primary shared repository for production workloads.',
      tags: ['flash', 'prod'],
      type: 'lvm',
      shared: false,
      local_cache_enabled: false,
      physical_size: 32212254720,
      virtual_allocation: 21474836480,
      uuid: 'sr-uuid-1',
      PBDs: ['OpaqueRef:pbd1'],
    },
    {
      ref: 'OpaqueRef:sr2',
      name_label: 'Operations Archive SR',
      name_description: 'Shared operator archive repository for overflow workloads.',
      tags: ['archive', 'shared'],
      type: 'nfs',
      shared: true,
      local_cache_enabled: false,
      physical_size: 64424509440,
      virtual_allocation: 17179869184,
      uuid: 'sr-uuid-2',
      PBDs: ['OpaqueRef:pbd1'],
    },
  ]));
  const vdiInventory = JSON.parse(JSON.stringify(Array.isArray(options.vdiInventory) ? options.vdiInventory : [
    { ref: 'OpaqueRef:vdi1', SR: 'OpaqueRef:sr1', name_label: 'disk-01', virtual_size: 10737418240, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd1'] },
  ]));
  const networkInventory = [
    {
      ref: 'OpaqueRef:net1',
      name_label: 'VM Network',
      bridge: 'xenbr0',
      MTU: 1500,
      managed: true,
      uuid: 'net-uuid-1',
      VIFs: ['OpaqueRef:vif1'],
      PIFs: ['OpaqueRef:pif1', 'OpaqueRef:pif3'],
      other_config: { vlan: '120' },
      purpose: [],
      default_locking_mode: 'unlocked',
    },
    {
      ref: 'OpaqueRef:net2',
      name_label: 'Backup Network',
      bridge: 'xenbr1',
      MTU: 9000,
      managed: true,
      uuid: 'net-uuid-2',
      VIFs: [],
      PIFs: ['OpaqueRef:pif2', 'OpaqueRef:pif4'],
      other_config: { vlan: '220' },
      purpose: [],
      default_locking_mode: 'unlocked',
    },
    {
      ref: 'OpaqueRef:net3',
      name_label: 'Archive Transit',
      bridge: 'xenbr8',
      MTU: 1500,
      managed: true,
      uuid: 'net-uuid-3',
      VIFs: [],
      PIFs: [],
      other_config: { vlan: '820' },
      tags: ['archive'],
      purpose: [],
      default_locking_mode: 'unlocked',
    },
  ];
  const syncStorageInventoryVdis = () => {
    storageInventory.forEach((sr) => {
      sr.VDIs = vdiInventory
        .filter((entry) => entry.SR === sr.ref)
        .map((entry) => entry.ref);
    });
  };
  syncStorageInventoryVdis();
  const vifInventory = [
    {
      ref: 'OpaqueRef:vif1',
      uuid: 'vif-uuid-1',
      VM: 'OpaqueRef:vm1',
      network: 'OpaqueRef:net1',
      device: '0',
      MAC: '02:16:3e:10:00:01',
      MTU: 1500,
      locking_mode: 'network_default',
      qos_algorithm_type: 'ratelimit',
      qos_algorithm_params: { kbps: '50000' },
      qos_supported_algorithms: ['ratelimit'],
      currently_attached: true,
      allowed_operations: ['unplug', 'destroy'],
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
    {
      ref: 'OpaqueRef:msg3',
      name: 'VM interface flapping',
      cls: 'VIF',
      body: 'The primary workload interface is reporting intermittent connectivity.',
      timestamp: '2026-08-19T11:35:00.000Z',
      uuid: 'msg-uuid-3',
      obj_uuid: 'vif-uuid-1',
      object_ref: 'OpaqueRef:vif1',
    },
    {
      ref: 'OpaqueRef:msg4',
      name: 'Recovery VLAN drift detected',
      cls: 'VLAN',
      body: 'The recovery uplink is reporting VLAN tag drift on the standby path.',
      timestamp: '2026-08-19T11:30:00.000Z',
      uuid: 'msg-uuid-4',
      obj_uuid: 'vlan-uuid-1',
      object_ref: 'OpaqueRef:pif2',
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
    },
  ];
  const groups = [
    {
      id: 1,
      name: 'Platform Operations',
      created_at: '2026-08-20T08:15:00.000Z',
      memberUserIds: [1],
    },
    {
      id: 2,
      name: 'Reporting',
      created_at: '2026-08-21T09:10:00.000Z',
      memberUserIds: [2],
    },
  ];

  const rebuildUsersWithGroups = () => {
    return users.map((user) => {
      const memberships = groups.filter((group) => (group.memberUserIds || []).includes(user.id));
      return {
        ...user,
        groups: memberships.map((group) => group.name),
        group_ids: memberships.map((group) => group.id),
        group_count: memberships.length,
      };
    });
  };

  const listGroups = () => {
    return groups.map((group) => {
      const members = users.filter((user) => (group.memberUserIds || []).includes(user.id));
      return {
        id: group.id,
        name: group.name,
        created_at: group.created_at,
        member_count: members.length,
        member_ids: members.map((user) => user.id),
        members: members.map((user) => user.display_name || user.username),
      };
    });
  };

  const applyUserGroups = (userId, groupIds = []) => {
    groups.forEach((group) => {
      const memberIds = new Set(group.memberUserIds || []);
      memberIds.delete(userId);
      if ((groupIds || []).includes(group.id)) {
        memberIds.add(userId);
      }
      group.memberUserIds = [...memberIds];
    });
  };
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
    performance: {
      collectionEnabled: true,
      collectionIntervalSeconds: 60,
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
      totalCredentialCount: 1,
      staleCredentialCount: 1,
      rewrapAvailable: true,
      scanAvailable: true,
      scanError: '',
    },
    runtime: {
      env: 'test',
      port: 3000,
      restartRequiredSettings: ['server.port', 'security.failedLoginWindowMinutes', 'security.failedLoginMaxAttempts'],
      liveAppliedSettings: ['net.trustProxy', 'security.sessionMaxAgeMs', 'logging.level', 'logging.structuredJson', 'performance.collectionEnabled', 'performance.collectionIntervalSeconds', 'retention.sweepIntervalHours', 'retention.vacuumAfterSweep'],
      metricsCollector: {
        enabled: true,
        intervalSeconds: 60,
        active: true,
        inFlight: false,
        targetCount: 1,
        runCount: 4,
        lastRunAt: '2026-08-24T10:10:00.000Z',
        lastDurationMs: 42,
        nextRunAt: '2026-08-24T10:11:00.000Z',
        lastError: '',
        lastResult: {
          source: 'scheduler',
          captured: true,
          targetCount: 1,
          capturedTargetCount: 1,
          sampleCount: 12,
          results: [],
          errors: [],
        },
      },
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
    {
      domain: 'template-deployment-runs',
      label: 'Template Deployment Runs',
      description: 'Completed template deployment work persisted in xenmange.db for Activity tracking and post-deploy traceability.',
      enabled: true,
      retentionDays: 90,
      lastRunAt: '2026-08-22T18:10:00.000Z',
      lastPurgedCount: 0,
    },
    {
      domain: 'metric-samples',
      label: 'Metric Samples',
      description: 'Raw persisted telemetry snapshots stored in perf.db for capacity and trend views.',
      enabled: true,
      retentionDays: 7,
      lastRunAt: '2026-08-22T18:10:00.000Z',
      lastPurgedCount: 3,
    },
    {
      domain: 'metric-hourly-rollups',
      label: 'Metric Hourly Rollups',
      description: 'Hourly telemetry aggregates stored in perf.db for longer-range capacity and trend history.',
      enabled: true,
      retentionDays: 90,
      lastRunAt: '2026-08-22T18:10:00.000Z',
      lastPurgedCount: 1,
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
  let liveTargets = [];
  let activeTargetKey = '';

  const setLiveTargets = (targets = []) => {
    liveTargets = targets.map((target) => ({ ...target }));
    activeTargetKey = liveTargets.find((target) => target.active)?.targetKey || liveTargets[0]?.targetKey || '';
    liveTargets = liveTargets.map((target) => ({
      ...target,
      active: target.targetKey === activeTargetKey,
    }));
    targetAttached = liveTargets.length > 0;
  };

  const buildAuthStatus = (overrides = {}) => {
    const activeTarget = liveTargets.find((target) => target.active) || liveTargets[0] || null;
    return {
      authenticated: true,
      connected: liveTargets.length > 0,
      authMode: overrides.authMode || 'local',
      host: overrides.host || activeTarget?.connectionName || activeTarget?.host || '',
      username: overrides.username || 'admin',
      currentTargetKey: activeTarget?.targetKey || '',
      connectedTargets: liveTargets.map((target) => ({ ...target })),
      user: overrides.user === undefined ? {
        id: 1,
        username: 'admin',
        displayName: 'Platform Administrator',
        role: 'admin',
      } : overrides.user,
      governance: {
        currentRole: governanceCurrentRole,
        policy: governancePolicy,
      },
    };
  };

  if (Array.isArray(options.liveTargets) && options.liveTargets.length) {
    setLiveTargets(options.liveTargets);
  }

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
      'OpaqueRef:host1': { total: 68719476736, free: 12884901888, cpu: 68 },
      'OpaqueRef:host2': { total: 68719476736, free: 25769803776, cpu: 44 },
    };
    const totalMemory = Object.values(hostTotals).reduce((sum, entry) => sum + entry.total, 0);
    const usedMemory = Object.values(hostTotals).reduce((sum, entry) => sum + (entry.total - entry.free), 0);
    const averageCpu = Object.values(hostTotals).reduce((sum, entry) => sum + entry.cpu, 0) / Math.max(1, Object.values(hostTotals).length);
    const hostNetworkRx = Object.values(hostTotals).reduce((sum, entry, index) => sum + (entry.cpu * 6) + (120 * (index + 1)), 0);
    const hostNetworkTx = Object.values(hostTotals).reduce((sum, entry, index) => sum + (entry.cpu * 4.2) + (90 * (index + 1)), 0);
    const totalStorage = storageInventory.reduce((sum, entry) => sum + Number(entry.physical_size || 0), 0);
    const usedStorage = storageInventory.reduce((sum, entry) => sum + Number(entry.virtual_allocation || 0), 0);
    const vmMemory = vmInventory.reduce((sum, entry) => sum + Number(entry.memory_static_max || 0), 0);
    const vmNetworkRx = vmInventory.reduce((sum, entry) => sum + Math.max(12, (Number(entry.VCPUs_at_startup || 0) * 34) + 130), 0);
    const vmNetworkTx = vmInventory.reduce((sum, entry) => sum + Math.max(10, (Number(entry.VCPUs_at_startup || 0) * 24) + 96), 0);
    const vmDiskRead = vmInventory.reduce((sum, entry) => sum + Math.max(8, (Number(entry.VCPUs_at_startup || 0) * 18) + 52), 0);
    const vmDiskWrite = vmInventory.reduce((sum, entry) => sum + Math.max(6, (Number(entry.VCPUs_at_startup || 0) * 12) + 34), 0);

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
          metricName: 'cluster_cpu_usage_percent',
          points: buildTrendPoints(averageCpu, { range, amplitude: 7, floor: 0, ceiling: 100, seed: 'cluster-cpu' }),
        },
        {
          metricName: 'cluster_vm_memory_actual_bytes',
          points: buildTrendPoints(vmMemory * 0.78, { range, amplitude: vmMemory * 0.05, floor: 0, seed: 'cluster-vm-memory' }),
        },
        {
          metricName: 'cluster_host_network_rx_kib_per_s',
          points: buildTrendPoints(hostNetworkRx, { range, amplitude: Math.max(16, hostNetworkRx * 0.14), floor: 0, seed: 'cluster-host-network-rx' }),
        },
        {
          metricName: 'cluster_host_network_tx_kib_per_s',
          points: buildTrendPoints(hostNetworkTx, { range, amplitude: Math.max(14, hostNetworkTx * 0.13), floor: 0, seed: 'cluster-host-network-tx' }),
        },
        {
          metricName: 'cluster_vm_network_rx_kib_per_s',
          points: buildTrendPoints(vmNetworkRx, { range, amplitude: Math.max(18, vmNetworkRx * 0.16), floor: 0, seed: 'cluster-vm-network-rx' }),
        },
        {
          metricName: 'cluster_vm_network_tx_kib_per_s',
          points: buildTrendPoints(vmNetworkTx, { range, amplitude: Math.max(16, vmNetworkTx * 0.15), floor: 0, seed: 'cluster-vm-network-tx' }),
        },
        {
          metricName: 'cluster_vm_disk_read_kib_per_s',
          points: buildTrendPoints(vmDiskRead, { range, amplitude: Math.max(14, vmDiskRead * 0.14), floor: 0, seed: 'cluster-vm-disk-read' }),
        },
        {
          metricName: 'cluster_vm_disk_write_kib_per_s',
          points: buildTrendPoints(vmDiskWrite, { range, amplitude: Math.max(12, vmDiskWrite * 0.12), floor: 0, seed: 'cluster-vm-disk-write' }),
        },
      ],
    };
  };

  const buildHostMetricHistory = (ref, range = '24h') => {
    const metricsByRef = {
      'OpaqueRef:host1': { total: 68719476736, free: 12884901888, cpu: 68 },
      'OpaqueRef:host2': { total: 68719476736, free: 25769803776, cpu: 44 },
    };
    const metrics = metricsByRef[ref] || { total: 0, free: 0, cpu: 0 };
    const used = Math.max(0, metrics.total - metrics.free);
    const networkRx = Math.max(24, Math.round((metrics.cpu * 6) + 120));
    const networkTx = Math.max(18, Math.round((metrics.cpu * 4.2) + 88));
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
        { metricName: 'cpu_usage_percent', points: buildTrendPoints(metrics.cpu, { range, amplitude: 7, floor: 0, ceiling: 100, seed: `${ref}-cpu` }) },
        { metricName: 'network_rx_kib_per_s', points: buildTrendPoints(networkRx, { range, amplitude: Math.max(10, networkRx * 0.18), floor: 0, seed: `${ref}-network-rx` }) },
        { metricName: 'network_tx_kib_per_s', points: buildTrendPoints(networkTx, { range, amplitude: Math.max(8, networkTx * 0.16), floor: 0, seed: `${ref}-network-tx` }) },
      ],
    };
  };

  const buildVmMetricHistory = (ref, range = '24h') => {
    const vm = vmInventory.find((entry) => entry.ref === ref) || {};
    const configured = Number(vm.memory_static_max || vm.memory_dynamic_max || 0);
    const actual = configured * 0.78;
    const cpuUsage = Math.max(8, Math.min(94, (Number(vm.VCPUs_at_startup || 0) * 9) + 18));
    const networkRx = Math.max(12, (Number(vm.VCPUs_at_startup || 0) * 34) + 130);
    const networkTx = Math.max(10, (Number(vm.VCPUs_at_startup || 0) * 24) + 96);
    const diskRead = Math.max(8, (Number(vm.VCPUs_at_startup || 0) * 18) + 52);
    const diskWrite = Math.max(6, (Number(vm.VCPUs_at_startup || 0) * 12) + 34);
    return {
      entityType: 'vm',
      entityRef: ref,
      range,
      generatedAt: '2026-08-24T10:30:00.000Z',
      metrics: [
        { metricName: 'memory_actual_bytes', points: buildTrendPoints(actual, { range, amplitude: configured * 0.08, floor: 0, ceiling: configured, seed: `${ref}-actual` }) },
        { metricName: 'memory_static_max_bytes', points: buildTrendPoints(configured, { range, amplitude: 0, seed: `${ref}-static` }) },
        { metricName: 'memory_usage_percent', points: buildTrendPoints(configured ? (actual / configured) * 100 : 0, { range, amplitude: 8, floor: 0, ceiling: 100, seed: `${ref}-usage` }) },
        { metricName: 'cpu_usage_percent', points: buildTrendPoints(cpuUsage, { range, amplitude: 9, floor: 0, ceiling: 100, seed: `${ref}-cpu` }) },
        { metricName: 'vcpu_count', points: buildTrendPoints(Number(vm.VCPUs_at_startup || 0), { range, amplitude: 0, seed: `${ref}-vcpu` }) },
        { metricName: 'network_rx_kib_per_s', points: buildTrendPoints(networkRx, { range, amplitude: Math.max(10, networkRx * 0.19), floor: 0, seed: `${ref}-network-rx` }) },
        { metricName: 'network_tx_kib_per_s', points: buildTrendPoints(networkTx, { range, amplitude: Math.max(8, networkTx * 0.17), floor: 0, seed: `${ref}-network-tx` }) },
        { metricName: 'disk_read_kib_per_s', points: buildTrendPoints(diskRead, { range, amplitude: Math.max(8, diskRead * 0.15), floor: 0, seed: `${ref}-disk-read` }) },
        { metricName: 'disk_write_kib_per_s', points: buildTrendPoints(diskWrite, { range, amplitude: Math.max(6, diskWrite * 0.14), floor: 0, seed: `${ref}-disk-write` }) },
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

  const buildCapacityBaseline = () => {
    const generatedAt = '2026-08-24T10:30:00.000Z';
    const hostMetricsByRef = {
      'OpaqueRef:host1': { total: 68719476736, free: 12884901888, cpu: 68 },
      'OpaqueRef:host2': { total: 68719476736, free: 25769803776, cpu: 44 },
    };

    return {
      generatedAt,
      resolution: 'raw',
      hosts: hostInventory.map((host) => {
        const metrics = hostMetricsByRef[host.ref] || { total: 0, free: 0, cpu: 0 };
        const used = Math.max(0, metrics.total - metrics.free);
        return {
          entityRef: host.ref,
          ts: generatedAt,
          memory_total_bytes: metrics.total,
          memory_free_bytes: metrics.free,
          memory_used_bytes: used,
          memory_used_percent: metrics.total ? (used / metrics.total) * 100 : 0,
          cpu_usage_percent: metrics.cpu,
          network_rx_kib_per_s: Math.max(24, Math.round((metrics.cpu * 6) + 120)),
          network_tx_kib_per_s: Math.max(18, Math.round((metrics.cpu * 4.2) + 88)),
        };
      }),
      vms: vmInventory.map((vm) => {
        const configured = Number(vm.memory_static_max || vm.memory_dynamic_max || 0);
        const actual = configured * 0.78;
        const cpuUsage = Math.max(8, Math.min(94, (Number(vm.VCPUs_at_startup || 0) * 9) + 18));
        return {
          entityRef: vm.ref,
          ts: generatedAt,
          memory_actual_bytes: actual,
          memory_static_max_bytes: configured,
          memory_usage_percent: configured ? (actual / configured) * 100 : 0,
          cpu_usage_percent: cpuUsage,
          vcpu_count: Number(vm.VCPUs_at_startup || 0),
          network_rx_kib_per_s: Math.max(12, (Number(vm.VCPUs_at_startup || 0) * 34) + 130),
          network_tx_kib_per_s: Math.max(10, (Number(vm.VCPUs_at_startup || 0) * 24) + 96),
          disk_read_kib_per_s: Math.max(8, (Number(vm.VCPUs_at_startup || 0) * 18) + 52),
          disk_write_kib_per_s: Math.max(6, (Number(vm.VCPUs_at_startup || 0) * 12) + 34),
        };
      }),
      storage: storageInventory.map((sr) => {
        const allocation = Number(sr.virtual_allocation || 0);
        const physical = Number(sr.physical_size || 0);
        return {
          entityRef: sr.ref,
          ts: generatedAt,
          allocation_bytes: allocation,
          physical_bytes: physical,
          utilization_percent: physical ? (allocation / physical) * 100 : 0,
        };
      }),
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
    if (value === 'network' || value === 'vif' || value === 'pif' || value === 'bond' || value === 'vlan') return '/networking';
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
      object_ref: message.object_ref || '',
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
        vault_credential_id: payload.vaultCredentialId || null,
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
        vault_credential_id: payload.vaultCredentialId || null,
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
    // Some workflows begin with already attached live targets; preserve that
    // bootstrap state instead of discarding the destination fabric on sign-in.
    if (!Array.isArray(options.liveTargets) || !options.liveTargets.length) {
      setLiveTargets([]);
    }
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
        ...buildAuthStatus({ authMode: 'local', username: 'admin' }),
      }),
    });
  });

  await page.route('**/api/auth/xen-login', async (route) => {
    const payload = route.request().postDataJSON();
    const connection = connections.find((entry) => entry.id === Number(payload.connectionId || 0)) || null;
    const host = payload.host || connection?.host || '10.0.0.1';
    const username = payload.username || connection?.username || 'root';
    const port = Number(payload.port || connection?.port || 443) || 443;
    const targetKey = connection ? `connection:${connection.id}` : `host:${host.toLowerCase()}|user:${username.toLowerCase()}|port:${port}`;
    const nextTarget = {
      targetKey,
      connectionId: connection?.id || null,
      connectionName: connection?.name || payload.connectionName || host,
      host,
      username,
      port,
      connectedAt: '2026-08-20T08:15:00.000Z',
      lastActivatedAt: '2026-08-20T08:15:00.000Z',
      active: true,
    };
    setLiveTargets([
      ...liveTargets.filter((target) => target.targetKey !== targetKey).map((target) => ({ ...target, active: false })),
      nextTarget,
    ]);
    targetAttached = true;
    recordAudit({
      category: 'session',
      action: 'session_login',
      actionLabel: 'Logged into Xen host',
      entityType: 'session',
      entityRef: nextTarget.targetKey,
      entityName: nextTarget.connectionName,
      route: '/login',
      after: { host, username },
      detail: `Authenticated to ${host} as ${username}.`,
      happenedAt: '2026-08-20T08:15:00.000Z',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        ...buildAuthStatus({
          authMode: 'local',
          host: nextTarget.connectionName,
          username: 'admin',
        }),
      }),
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    const previousActiveTarget = liveTargets.find((target) => target.active) || null;
    setLiveTargets([]);
    recordAudit({
      category: 'session',
      action: 'session_logout',
      actionLabel: 'Logged out of Xen host',
      entityType: 'session',
      entityRef: previousActiveTarget?.host || '10.0.0.1',
      entityName: previousActiveTarget?.connectionName || previousActiveTarget?.host || '10.0.0.1',
      route: '/login',
      before: previousActiveTarget ? { host: previousActiveTarget.host, username: previousActiveTarget.username } : { host: '10.0.0.1', username: 'root' },
      after: { success: true },
      detail: `Session for ${previousActiveTarget?.username || 'root'} on ${previousActiveTarget?.host || '10.0.0.1'} was closed.`,
      happenedAt: '2026-08-23T10:31:00.000Z',
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/auth/targets*', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname !== '/api/auth/targets') {
      await route.fallback();
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildAuthStatus()),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/auth/targets/activate', async (route) => {
    const payload = route.request().postDataJSON();
    const target = liveTargets.find((entry) =>
      (payload.targetKey && entry.targetKey === payload.targetKey)
      || (payload.connectionId && Number(entry.connectionId || 0) === Number(payload.connectionId || 0))
    );
    if (!target) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'XEN_TARGET_NOT_FOUND' }) });
      return;
    }

    setLiveTargets(liveTargets.map((entry) => ({
      ...entry,
      active: entry.targetKey === target.targetKey,
      lastActivatedAt: entry.targetKey === target.targetKey ? '2026-08-24T14:45:00.000Z' : entry.lastActivatedAt,
    })));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildAuthStatus()),
    });
  });

  await page.route('**/api/auth/targets/*', async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    const targetKey = decodeURIComponent(route.request().url().split('/api/auth/targets/')[1] || '');
    const exists = liveTargets.some((entry) => entry.targetKey === targetKey);
    if (!exists) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'XEN_TARGET_NOT_FOUND' }) });
      return;
    }

    setLiveTargets(liveTargets.filter((entry) => entry.targetKey !== targetKey));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildAuthStatus()),
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
    const taskData = [...tasks, ...templateDeploymentRuns]
      .sort((left, right) => new Date(right.finished || right.created || 0) - new Date(left.finished || left.created || 0));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: taskData.length,
        data: taskData,
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
      lifecycle_plan_seed: taskPayload.lifecyclePlanSeed || null,
      resilience_runbook_seed: taskPayload.resilienceRunbookSeed || null,
      vm_migration_seed: taskPayload.vmMigrationSeed || null,
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
          lifecyclePlanSeed: payload.lifecyclePlanSeed || null,
          resilienceRunbookSeed: payload.resilienceRunbookSeed || null,
          vmMigrationSeed: payload.vmMigrationSeed || null,
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

  await page.route('**/api/settings/vault/rewrap', async (route) => {
    systemConfig.vault.staleCredentialCount = 0;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        result: {
          scanned: credentials.length,
          rewrapped: 1,
          alreadyCurrent: Math.max(credentials.length - 1, 0),
          failed: 0,
          staleRemaining: 0,
          rewrapAvailable: true,
          scanError: '',
        },
        vault: systemConfig.vault,
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
    if (section === 'vault/rewrap') {
      await route.fallback();
      return;
    }
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

    if (section === 'performance') {
      systemConfig.runtime.metricsCollector = {
        ...systemConfig.runtime.metricsCollector,
        enabled: systemConfig.performance.collectionEnabled,
        intervalSeconds: systemConfig.performance.collectionIntervalSeconds,
        active: systemConfig.performance.collectionEnabled,
        nextRunAt: systemConfig.performance.collectionEnabled ? '2026-08-24T10:19:00.000Z' : '',
      };
    }

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
      const userRows = rebuildUsersWithGroups();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: userRows.length,
          data: userRows,
          summary: {
            totalUsers: userRows.length,
            activeUsers: userRows.filter((entry) => entry.active !== false).length,
            activeAdmins: userRows.filter((entry) => entry.active !== false && entry.role === 'admin').length,
            totalGroups: groups.length,
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
      };
      users.push(record);
      applyUserGroups(record.id, payload.groupIds || []);
      const responseRecord = rebuildUsersWithGroups().find((entry) => entry.id === record.id) || record;
      recordAudit({
        category: 'governance',
        action: 'user_created',
        actionLabel: 'Created local user',
        entityType: 'user',
        entityRef: String(record.id),
        entityName: record.username,
        route: '/governance',
        after: responseRecord,
        detail: `Created local ${record.role} account ${record.username}${record.active ? '' : ' in a disabled state'}.`,
        happenedAt: '2026-08-24T14:20:00.000Z',
      });
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(responseRecord) });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/users/*', async (route) => {
    const url = route.request().url();
    if (new URL(url).pathname === '/api/users') {
      await route.fallback();
      return;
    }
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
      applyUserGroups(id, payload.groupIds || []);
      const responseRecord = rebuildUsersWithGroups().find((entry) => entry.id === id) || users[index];
      recordAudit({
        category: 'governance',
        action: 'user_updated',
        actionLabel: 'Updated local user',
        entityType: 'user',
        entityRef: String(id),
        entityName: responseRecord.username,
        route: '/governance',
        before: previous,
        after: responseRecord,
        detail: `Updated local account ${responseRecord.username} (${responseRecord.role}, ${responseRecord.active ? 'active' : 'disabled'}).`,
        happenedAt: '2026-08-24T14:26:00.000Z',
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseRecord) });
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

  await page.route('**/api/groups', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      const data = listGroups();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: data.length,
          data,
        }),
      });
      return;
    }

    if (method === 'POST') {
      const payload = route.request().postDataJSON();
      const duplicate = groups.find((entry) => String(entry.name || '').toLowerCase() === String(payload.name || '').toLowerCase());
      if (duplicate) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'GROUP_NAME_ALREADY_EXISTS' }) });
        return;
      }

      const record = {
        id: groups.length + 1,
        name: payload.name,
        created_at: '2026-08-24T14:21:00.000Z',
        memberUserIds: (payload.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean),
      };
      groups.push(record);
      const responseRecord = listGroups().find((entry) => entry.id === record.id) || record;
      recordAudit({
        category: 'governance',
        action: 'group_created',
        actionLabel: 'Created local group',
        entityType: 'group',
        entityRef: String(record.id),
        entityName: record.name,
        route: '/governance',
        after: responseRecord,
        detail: `Created local group ${record.name} with ${responseRecord.member_count || 0} assigned member${(responseRecord.member_count || 0) === 1 ? '' : 's'}.`,
        happenedAt: '2026-08-24T14:21:00.000Z',
      });
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(responseRecord) });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
  });

  await page.route('**/api/groups/*', async (route) => {
    const url = route.request().url();
    if (new URL(url).pathname === '/api/groups') {
      await route.fallback();
      return;
    }
    const method = route.request().method();
    const id = Number(url.split('/api/groups/')[1] || 0);
    const index = groups.findIndex((entry) => entry.id === id);

    if (index === -1) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'GROUP_NOT_FOUND' }) });
      return;
    }

    if (method === 'PUT') {
      const payload = route.request().postDataJSON();
      const duplicate = groups.find((entry) => entry.id !== id && String(entry.name || '').toLowerCase() === String(payload.name || '').toLowerCase());
      if (duplicate) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'GROUP_NAME_ALREADY_EXISTS' }) });
        return;
      }

      const previous = listGroups().find((entry) => entry.id === id) || null;
      groups[index] = {
        ...groups[index],
        name: payload.name,
        memberUserIds: (payload.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean),
      };
      const responseRecord = listGroups().find((entry) => entry.id === id) || groups[index];
      recordAudit({
        category: 'governance',
        action: 'group_updated',
        actionLabel: 'Updated local group',
        entityType: 'group',
        entityRef: String(id),
        entityName: responseRecord.name,
        route: '/governance',
        before: previous,
        after: responseRecord,
        detail: `Updated local group ${responseRecord.name} and synchronized ${responseRecord.member_count || 0} member assignment${(responseRecord.member_count || 0) === 1 ? '' : 's'}.`,
        happenedAt: '2026-08-24T14:23:00.000Z',
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseRecord) });
      return;
    }

    if (method === 'DELETE') {
      const previous = listGroups().find((entry) => entry.id === id) || null;
      groups.splice(index, 1);
      recordAudit({
        category: 'governance',
        action: 'group_deleted',
        actionLabel: 'Removed local group',
        entityType: 'group',
        entityRef: String(id),
        entityName: previous?.name || String(id),
        route: '/governance',
        before: previous,
        after: { success: true },
        detail: `Removed local group ${previous?.name || String(id)} from the control-plane access catalog.`,
        happenedAt: '2026-08-24T14:24:00.000Z',
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
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

  await page.route('**/api/pools/*/config', async (route) => {
    if (!targetAttached) {
      await fulfillNeedsConnection(route);
      return;
    }

    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const payload = route.request().postDataJSON();
    const pool = poolInventory.find((entry) => entry.ref === ref);
    if (!pool) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'POOL_NOT_FOUND' }) });
      return;
    }

    pool.name_label = payload.nameLabel;
    pool.name_description = payload.nameDescription || '';
    pool.default_SR = payload.defaultSrRef || pool.default_SR;
    pool.vswitch_controller = payload.vswitchController || '';
    if (typeof payload.migrationCompressionEnabled === 'boolean') {
      pool.migration_compression = payload.migrationCompressionEnabled;
    }
    if (typeof payload.wlbEnabled === 'boolean') {
      pool.wlb_enabled = payload.wlbEnabled;
    }
    if (typeof payload.igmpSnoopingEnabled === 'boolean') {
      pool.IGMP_snooping_enabled = payload.igmpSnoopingEnabled;
    }
    pool.tags = Array.isArray(payload.tags) ? [...payload.tags] : pool.tags;
    pool.other_config = payload.otherConfig || {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pool),
    });
  });

  await page.route('**/api/pools/*/ha', async (route) => {
    if (!targetAttached) {
      await fulfillNeedsConnection(route);
      return;
    }

    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const payload = route.request().postDataJSON();
    const pool = poolInventory.find((entry) => entry.ref === ref);
    if (!pool) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'POOL_NOT_FOUND' }) });
      return;
    }

    const enabled = Boolean(payload.enabled);
    const requestedTolerance = Math.max(0, Number(payload.haHostFailuresToTolerate || 0));
    pool.ha_enabled = enabled;
    pool.ha_configuration = payload.configuration || pool.ha_configuration || {};
    pool.ha_cluster_stack = enabled ? 'xhad' : '';
    pool.ha_overcommitted = false;
    pool.ha_host_failures_to_tolerate = enabled ? requestedTolerance : 0;
    pool.ha_plan_exists_for = enabled ? requestedTolerance : 0;
    pool.ha_statefiles = enabled ? ['OpaqueRef:ha-statefile-1'] : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pool),
    });
  });

  await page.route('**/api/pools*', async (route) => {
    if (!targetAttached) {
      await fulfillNeedsConnection(route);
      return;
    }
    const url = new URL(route.request().url());
    const targetKey = url.searchParams.get('targetKey') || activeTargetKey || '';
    const recoveryPools = [
      {
        ref: 'OpaqueRef:pool9',
        name_label: 'Recovery Pool',
        uuid: 'pool-uuid-9',
        master: 'OpaqueRef:host9',
        slaves: [],
        tags: ['dr'],
        default_SR: 'OpaqueRef:sr9',
        migration_network: 'OpaqueRef:net9',
      },
    ];
    const data = targetKey === 'host:10.0.1.1|user:root|port:443'
      ? recoveryPools
      : poolInventory;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: data.length,
        data,
      }),
    });
  });

  await page.route('**/api/hosts*', async (route) => {
    if (!targetAttached) {
      await fulfillNeedsConnection(route);
      return;
    }
    const url = new URL(route.request().url());
    const targetKey = url.searchParams.get('targetKey') || activeTargetKey || '';
    const data = targetKey === 'host:10.0.1.1|user:root|port:443'
      ? [
          {
            ref: 'OpaqueRef:host9',
            name_label: 'gamma-xen',
            address: '10.0.1.21',
            uuid: 'host-uuid-9',
            pool: 'OpaqueRef:pool9',
            enabled: true,
            maintenance_mode: false,
            tags: ['dr'],
            PIFs: ['OpaqueRef:pif9'],
            PBDs: ['OpaqueRef:pbd9'],
            resident_VMs: [],
          },
        ]
      : hostInventory;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: data.length,
        data,
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

  await page.route('**/api/hosts/*/config', async (route) => {
    if (!targetAttached) {
      await fulfillNeedsConnection(route);
      return;
    }

    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const payload = route.request().postDataJSON();
    const host = hostInventory.find((entry) => entry.ref === ref);

    if (!host) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'HOST_NOT_FOUND' }) });
      return;
    }

    host.name_label = payload.nameLabel;
    host.name_description = payload.nameDescription || '';
    if (Array.isArray(payload.tags)) {
      host.tags = [...payload.tags];
    }
    if (payload.guestVcpusParams && typeof payload.guestVcpusParams === 'object') {
      host.guest_VCPUs_params = { ...payload.guestVcpusParams };
    }
    if (payload.schedGran) {
      host.sched_gran = payload.schedGran;
    }
    if (payload.logging && typeof payload.logging === 'object') {
      host.logging = { ...payload.logging };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(host),
    });
  });

  await page.route('**/api/hosts/*/maintenance/enter', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const payload = route.request().postDataJSON();
    const host = hostInventory.find((entry) => entry.ref === ref);

    if (!host) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    host.enabled = false;
    host.maintenance_mode = true;
    host.other_config = {
      ...(host.other_config || {}),
      maintenance_mode: 'true',
      maintenance_network: payload.networkRef || '',
    };

    if (payload.evacuateRunningVms) {
      const destination = hostInventory.find((entry) => entry.pool === host.pool && entry.ref !== host.ref);
      if (destination) {
        const movedVmRefs = [...(host.resident_VMs || [])];
        destination.resident_VMs = [...new Set([...(destination.resident_VMs || []), ...movedVmRefs])];
        host.resident_VMs = [];
        vmInventory.forEach((vm) => {
          if (movedVmRefs.includes(vm.ref)) {
            vm.resident_on = destination.ref;
            vm.affinity = destination.ref;
          }
        });
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ref,
        maintenance_mode: true,
        maintenanceNetworkRef: payload.networkRef || '',
        ...host,
      }),
    });
  });

  await page.route('**/api/hosts/*/maintenance/exit', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const host = hostInventory.find((entry) => entry.ref === ref);

    if (!host) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    host.enabled = true;
    host.maintenance_mode = false;
    host.other_config = {
      ...(host.other_config || {}),
      maintenance_mode: 'false',
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ref,
        maintenance_mode: false,
        ...host,
      }),
    });
  });

  await page.route('**/api/hosts/*/reboot', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, ref }),
    });
  });

  await page.route('**/api/hosts/*/shutdown', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const host = hostInventory.find((entry) => entry.ref === ref);
    if (host) host.enabled = false;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, ref }),
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

  await page.route('**/api/metrics/capacity-baseline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildCapacityBaseline()),
    });
  });

  await page.route('**/api/metrics/collect', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        captured: true,
        ts: Date.parse('2026-08-24T10:30:00.000Z'),
        sampleCount: 33,
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

  await page.route('**/api/vms/templates/*/history/*/restore', async (route) => {
    const url = new URL(route.request().url());
    const segments = url.pathname.split('/');
    const templateRef = decodeURIComponent(segments[4] || '');
    const historyId = decodeURIComponent(segments[6] || '');
    const template = templateInventory.find((entry) => entry.ref === templateRef);
    const sourceEntry = templateGovernanceHistory.find((entry) => entry.templateRef === templateRef && entry.id === historyId);

    if (!sourceEntry) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'TEMPLATE_GOVERNANCE_HISTORY_NOT_FOUND' }) });
      return;
    }

    const previous = templateGovernance.find((entry) => entry.templateRef === templateRef) || null;
    const record = {
      ...(sourceEntry.snapshot || {}),
      templateRef,
      updatedAt: '2026-08-20T09:16:30.000Z',
    };
    const index = templateGovernance.findIndex((entry) => entry.templateRef === templateRef);
    if (index === -1) {
      templateGovernance.push(record);
    } else {
      templateGovernance[index] = record;
    }

    templateGovernanceHistory.unshift({
      id: `tmplhist-${Date.now()}-restore`,
      templateRef,
      templateName: template?.name_label || templateRef,
      eventType: 'restored',
      actor: 'root',
      happenedAt: '2026-08-20T09:16:30.000Z',
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: `Restored governance snapshot from ${sourceEntry.eventType || 'history'} recorded on ${sourceEntry.happenedAt || 'an earlier revision'}.`,
      snapshot: { ...record },
    });

    recordAudit({
      category: 'templates',
      action: 'template_governance_restored',
      actionLabel: 'Restored template governance for',
      entityType: 'template',
      entityRef: templateRef,
      entityName: template?.name_label || templateRef,
      route: '/templates',
      before: previous,
      after: record,
      detail: `Restored governance from ${sourceEntry.eventType || 'history'} snapshot ${sourceEntry.id}.`,
      happenedAt: '2026-08-20T09:16:30.000Z',
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        record,
        sourceEntry,
        history: templateGovernanceHistory.filter((entry) => entry.templateRef === templateRef),
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
    const runIndex = templateDeploymentRuns.findIndex((entry) => entry.vm_ref === record.vmRef);
    let deploymentRun = null;
    if (runIndex !== -1) {
      const status = String(payload.validationStatus || '').toLowerCase();
      deploymentRun = {
        ...templateDeploymentRuns[runIndex],
        status: status === 'validated' ? 'success' : (status === 'failed' ? 'failure' : (status === 'warning' ? 'warning' : 'pending')),
        progress: status === 'validated' || status === 'failed' ? 1 : (status === 'warning' ? 0.9 : 0.8),
        finished: status === 'validated' || status === 'failed' ? '2026-08-20T09:20:00.000Z' : '',
        result: payload.validationNotes
          || (status === 'validated'
            ? `${record.vmName} provisioning and post-deploy validation completed successfully.`
            : (status === 'failed'
              ? `${record.vmName} was provisioned, but post-deploy validation failed and needs operator follow-through.`
              : `${record.vmName} was provisioned and is waiting for operator review.`)),
        validation_status: record.validationStatus,
        validation_notes: record.validationNotes,
        guest_customization: record.guestCustomization,
        boot_verified: Boolean(record.bootVerified),
        network_verified: Boolean(record.networkVerified),
        storage_verified: Boolean(record.storageVerified),
        policy_tagged: Boolean(record.policyTagged),
        steps: (templateDeploymentRuns[runIndex].steps || []).map((step) =>
          step.key === 'validation'
            ? {
              ...step,
              status: status === 'validated' ? 'success' : (status === 'failed' ? 'failure' : (status === 'warning' ? 'warning' : 'pending')),
              detail: record.validationNotes || step.detail,
            }
            : step),
      };
      templateDeploymentRuns[runIndex] = deploymentRun;
    }
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
      body: JSON.stringify({ ...record, deploymentRun }),
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
      VCPUs_at_startup: payload.vcpusAtStartup || payload.vcpus,
      VCPUs_max: payload.vcpusMax || payload.vcpusAtStartup || payload.vcpus,
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
    const deploymentRun = {
      ref: `tmplrun-${nextIndex}`,
      uuid: `template-deployment-${nextIndex}`,
      name_label: payload.nameLabel,
      name_description: deploymentAudit.validationNotes,
      status: deploymentAudit.validationStatus === 'warning' ? 'warning' : 'pending',
      progress: deploymentAudit.validationStatus === 'warning' ? 0.9 : 0.8,
      created: '2026-08-20T09:18:00.000Z',
      finished: '',
      result: deploymentAudit.validationStatus === 'warning'
        ? `${payload.nameLabel} was provisioned and is waiting for operator review before it can be treated as a validated baseline deployment.`
        : `${payload.nameLabel} was provisioned and is waiting for post-deploy validation checks.`,
      error_info: [],
      resident_on: payload.hostRef || '',
      task_kind: 'template_deployment',
      source: 'template_deployment',
      template_ref: 'OpaqueRef:template1',
      template_name: 'ubuntu-golden',
      template_version: governance?.versionLabel || '',
      vm_ref: nextVmRef,
      vm_name: payload.nameLabel,
      host_ref: payload.hostRef || '',
      host_label: hostInventory.find((item) => item.ref === payload.hostRef)?.name_label || '',
      storage_ref: payload.storageRef || '',
      storage_label: storageInventory.find((item) => item.ref === payload.storageRef)?.name_label || '',
      network_ref: payload.networkRef || '',
      network_label: networkInventory.find((item) => item.ref === payload.networkRef)?.name_label || '',
      submitted_by: 'root',
      validation_status: deploymentAudit.validationStatus,
      validation_notes: deploymentAudit.validationNotes,
      guest_customization: governance?.guestCustomization || '',
      boot_verified: false,
      network_verified: false,
      storage_verified: false,
      policy_tagged: Array.isArray(payload.tags) && payload.tags.length > 0,
      target_route: '/vms',
      related_class: 'vm',
      related_object: nextVmRef,
      steps: [
        { key: 'clone', label: 'Clone Template', status: 'success', detail: `ubuntu-golden was cloned into ${payload.nameLabel}.` },
        { key: 'config', label: 'Apply VM Configuration', status: 'success', detail: 'Compute, naming, and metadata settings were applied to the deployed VM.' },
        { key: 'affinity', label: 'Place on Target Host', status: payload.hostRef ? 'success' : 'info', detail: payload.hostRef ? `Initial placement was directed to ${payload.hostRef}.` : 'No explicit host placement was requested for this deployment.' },
        { key: 'network', label: 'Attach Primary Network', status: payload.networkRef ? 'success' : 'info', detail: payload.networkRef ? `Primary network attachment was requested for ${payload.networkRef}.` : 'No explicit primary network attachment was requested at deploy time.' },
        { key: 'power', label: 'Initial Power Action', status: payload.startAfter ? 'success' : 'info', detail: payload.startAfter ? 'The deployed VM was started after provisioning completed.' : 'The deployed VM was left halted for operator-led validation.' },
        { key: 'validation', label: 'Post-Deploy Validation', status: deploymentAudit.validationStatus === 'warning' ? 'warning' : 'pending', detail: deploymentAudit.validationNotes },
      ],
    };
    templateDeploymentRuns.unshift(deploymentRun);
    recordAudit({
      category: 'templates',
      action: 'template_deployed',
      actionLabel: 'Deployed template to',
      entityType: 'vm',
      entityRef: nextVmRef,
      entityName: payload.nameLabel,
      route: '/templates',
      before: templateInventory[0],
      after: { ...record, deploymentAudit, deploymentRun },
      detail: `ubuntu-golden deployed with ${deploymentAudit.validationStatus} validation status.`,
      happenedAt: '2026-08-20T09:18:00.000Z',
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...record, deploymentAudit, deploymentRun }),
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

  await page.route('**/api/vms/appliances', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: vmAppliances.length,
        data: vmAppliances,
      }),
    });
  });

  await page.route('**/api/vms/snapshot-schedules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: vmSnapshotSchedules.length,
        data: vmSnapshotSchedules,
      }),
    });
  });

  await page.route('**/api/vms/*/disks', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const payload = route.request().postDataJSON();
    const vm = vmInventory.find((entry) => entry.ref === ref);
    if (!vm) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'VM_NOT_FOUND' }) });
      return;
    }

    const nextVbdRef = `OpaqueRef:vbd${vdiInventory.length + 1}`;
    const nextVdiRef = `OpaqueRef:vdi${vdiInventory.length + 1}`;
    vm.VBDs = [...(vm.VBDs || []), nextVbdRef];
    vdiInventory.push({
      ref: nextVdiRef,
      SR: payload.srRef,
      name_label: payload.nameLabel,
      virtual_size: payload.sizeBytes,
      type: 'user',
      managed: true,
      VBDs: [nextVbdRef],
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, vdiRef: nextVdiRef, vbdRef: nextVbdRef }),
    });
  });

  await page.route('**/api/vms/*/nics', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const payload = route.request().postDataJSON() || {};
    const vm = vmInventory.find((entry) => entry.ref === ref);
    if (!vm) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'VM_NOT_FOUND' }) });
      return;
    }

    const network = networkInventory.find((entry) => entry.ref === payload.networkRef);
    if (!network) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NETWORK_NOT_FOUND' }) });
      return;
    }

    const existingVifCount = vmInventory.reduce((count, entry) => count + (Array.isArray(entry.VIFs) ? entry.VIFs.length : 0), 0);
    const nextVifRef = `OpaqueRef:vif${existingVifCount + 1}`;
    vm.VIFs = [...(vm.VIFs || []), nextVifRef];
    network.VIFs = [...(network.VIFs || []), nextVifRef];
    vifInventory.push({
      ref: nextVifRef,
      uuid: `vif-uuid-${existingVifCount + 1}`,
      VM: ref,
      network: payload.networkRef,
      device: String(payload.deviceLabel || Math.max(0, (vm.VIFs || []).length - 1)),
      MAC: String(payload.mac || ''),
      MTU: 1500,
      locking_mode: 'network_default',
      qos_algorithm_type: '',
      qos_algorithm_params: {},
      qos_supported_algorithms: ['ratelimit'],
      currently_attached: String(vm.power_state || '').toLowerCase() === 'running',
      allowed_operations: ['unplug', 'destroy'],
    });

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, vifRef: nextVifRef }),
    });
  });

  await page.route(/.*\/api\/vms\/[^/]+\/nics\/[^/]+\/disconnect$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const parts = new URL(route.request().url()).pathname.split('/');
    const ref = decodeURIComponent(parts[3] || '');
    const vifRef = decodeURIComponent(parts[5] || '');
    const vm = vmInventory.find((entry) => entry.ref === ref);
    if (!vm) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'VM_NOT_FOUND' }) });
      return;
    }

    if (!(vm.VIFs || []).includes(vifRef)) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'VM_NIC_NOT_FOUND' }) });
      return;
    }

    const vif = vifInventory.find((entry) => entry.ref === vifRef);
    const alreadyDisconnected = !Boolean(vif?.currently_attached);
    if (vif) {
      vif.currently_attached = false;
      vif.allowed_operations = ['plug', 'destroy'];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        vmRef: ref,
        vifRef,
        networkRef: vif?.network || '',
        alreadyDisconnected,
        currentlyAttached: false,
        device: vif?.device || '',
        mac: vif?.MAC || '',
      }),
    });
  });

  await page.route(/.*\/api\/vms\/[^/]+\/nics\/[^/]+$/, async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fallback();
      return;
    }

    const parts = new URL(route.request().url()).pathname.split('/');
    const ref = decodeURIComponent(parts[3] || '');
    const vifRef = decodeURIComponent(parts[5] || '');
    const vm = vmInventory.find((entry) => entry.ref === ref);
    if (!vm) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'VM_NOT_FOUND' }) });
      return;
    }

    if (!(vm.VIFs || []).includes(vifRef)) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'VM_NIC_NOT_FOUND' }) });
      return;
    }

    vm.VIFs = (vm.VIFs || []).filter((entry) => entry !== vifRef);
    networkInventory.forEach((network) => {
      network.VIFs = (network.VIFs || []).filter((entry) => entry !== vifRef);
    });
    const vifIndex = vifInventory.findIndex((entry) => entry.ref === vifRef);
    if (vifIndex >= 0) vifInventory.splice(vifIndex, 1);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, vmRef: ref, vifRef }),
    });
  });

  await page.route(/.*\/api\/vms\/[^/]+\/compatibility$/, async (route) => {
    const ref = decodeURIComponent(route.request().url().split('/api/vms/')[1].split('/compatibility')[0] || '');
    const vm = vmInventory.find((entry) => entry.ref === ref);
    const currentHost = hostInventory.find((host) => host.ref === vm?.resident_on || host.ref === vm?.affinity) || null;
    const currentCpuModel = String(currentHost?.cpu_info?.modelname || '').trim().toLowerCase();
    const hosts = hostInventory.map((host) => {
      const sameCpuFamily = currentCpuModel
        ? String(host?.cpu_info?.modelname || '').trim().toLowerCase() === currentCpuModel
        : true;
      const compatible = Boolean(host.enabled) && !host.maintenance_mode && sameCpuFamily;
      return {
        ref: host.ref,
        uuid: host.uuid || '',
        name_label: host.name_label || host.ref,
        address: host.address || '',
        enabled: Boolean(host.enabled),
        maintenance_mode: Boolean(host.maintenance_mode),
        currentResident: host.ref === vm?.resident_on,
        possiblePlacement: compatible || host.ref === vm?.resident_on,
        compatible: compatible || host.ref === vm?.resident_on,
        readiness: compatible || host.ref === vm?.resident_on ? 'compatible' : (host.maintenance_mode ? 'maintenance' : 'incompatible'),
        compatibilityError: compatible || host.ref === vm?.resident_on ? '' : (host.maintenance_mode ? 'HOST_IN_MAINTENANCE' : 'CPU_FAMILY_MISMATCH'),
        sameCpuFamily,
        cpuModel: host?.cpu_info?.modelname || '',
        cpuCount: Number(host?.cpu_info?.cpu_count || 0) || 0,
        socketCount: Number(host?.cpu_info?.socket_count || 0) || 0,
      };
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ref,
        uuid: vm?.uuid || '',
        name_label: vm?.name_label || ref,
        power_state: vm?.power_state || '',
        resident_on: vm?.resident_on || '',
        affinity: vm?.affinity || '',
        hardwarePlatformVersion: vm?.hardware_platform_version || 0,
        lastBootCpuFlags: vm?.last_boot_CPU_flags || {},
        possibleHostRefs: hosts.filter((host) => host.possiblePlacement).map((host) => host.ref),
        hosts,
        maskingApiAvailable: false,
      }),
    });
  });

  await page.route(/.*\/api\/vms\/[^/]+\/consoles$/, async (route) => {
    const ref = decodeURIComponent(route.request().url().split('/api/vms/')[1].split('/consoles')[0] || '');
    const consoles = consoleInventory
      .filter((entry) => entry.VM === ref)
      .map((entry) => ({
        ...entry,
        launchPath: `/api/vms/${encodeURIComponent(ref)}/consoles/${encodeURIComponent(entry.ref)}/launch`,
      }));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: consoles.length,
        data: consoles,
      }),
    });
  });

  await page.route('**/api/storage', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON();
    const host = hostInventory.find((entry) => entry.ref === payload.hostRef);
    if (!host) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'HOST_NOT_FOUND' }) });
      return;
    }

    const nextIndex = storageInventory.length + 1;
    const created = {
      ref: `OpaqueRef:sr${nextIndex}`,
      name_label: payload.nameLabel,
      name_description: payload.nameDescription || '',
      type: payload.type || 'nfs',
      content_type: payload.contentType || 'user',
      shared: Boolean(payload.shared),
      physical_size: 0,
      physical_utilisation: 0,
      virtual_allocation: 0,
      uuid: `sr-uuid-${nextIndex}`,
      PBDs: [],
      VDIs: [],
      other_config: {},
      sm_config: { ...(payload.smConfig || {}) },
      device_config: { ...(payload.deviceConfig || {}) },
    };

    storageInventory.push(created);
    syncStorageInventoryVdis();

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

  await page.route('**/api/storage/probe', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON();
    const requiredByType = {
      nfs: ['server', 'serverpath'],
      lvmoiscsi: ['target', 'targetIQN', 'SCSIid'],
      ext: ['device'],
      lvm: ['device'],
    };
    const requestedConfiguration = { ...(payload.deviceConfig || {}) };
    const missingKeys = (requiredByType[payload.type] || []).filter((key) => !String(requestedConfiguration[key] || '').trim());

    if (missingKeys.length) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mode: 'probe_ext',
          requestedConfiguration,
          rawXml: '',
          results: [
            {
              complete: false,
              configuration: requestedConfiguration,
              extraInfo: {
                hint: `Provide ${missingKeys.join(', ')} to complete discovery.`,
              },
              sr: null,
            },
          ],
          summary: {
            totalResults: 1,
            completeResults: 0,
            incompleteResults: 1,
            existingSrs: 0,
            legacyXmlAvailable: false,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'probe_ext',
        requestedConfiguration,
        rawXml: '',
        results: [
          {
            complete: true,
            configuration: requestedConfiguration,
            extraInfo: {
              discovery: 'existing-sr',
              transport: payload.type || 'storage',
            },
            sr: {
              uuid: `imported-${payload.type || 'sr'}-uuid`,
              name_label: payload.type === 'nfs' ? 'Imported Archive SR' : 'Imported Storage Repository',
              name_description: 'Existing repository discovered during probe.',
              health: 'healthy',
              total_space: 21474836480,
              free_space: 8589934592,
              clustered: false,
            },
          },
        ],
        summary: {
          totalResults: 1,
          completeResults: 1,
          incompleteResults: 0,
          existingSrs: 1,
          legacyXmlAvailable: false,
        },
      }),
    });
  });

  await page.route('**/api/storage/import', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON();
    const host = hostInventory.find((entry) => entry.ref === payload.hostRef);
    if (!host) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'HOST_NOT_FOUND' }) });
      return;
    }

    let target = storageInventory.find((entry) => entry.uuid === payload.uuid) || null;
    let introduced = false;
    if (!target) {
      const nextIndex = storageInventory.length + 1;
      target = {
        ref: `OpaqueRef:sr${nextIndex}`,
        name_label: payload.nameLabel,
        name_description: payload.nameDescription || '',
        type: payload.type || 'nfs',
        content_type: payload.contentType || 'user',
        shared: Boolean(payload.shared),
        physical_size: 21474836480,
        physical_utilisation: 0,
        virtual_allocation: 0,
        uuid: payload.uuid,
        PBDs: [],
        VDIs: [],
        other_config: {},
        sm_config: { ...(payload.smConfig || {}) },
        device_config: { ...(payload.deviceConfig || {}) },
      };
      storageInventory.push(target);
      introduced = true;
    }

    const existingPbdRef = (target.PBDs || []).find((ref) => (host.PBDs || []).includes(ref)) || '';
    const pbdRef = existingPbdRef || `OpaqueRef:pbd${storageInventory.length + 1}`;
    if (!existingPbdRef) {
      target.PBDs = [...(target.PBDs || []), pbdRef];
      host.PBDs = [...(host.PBDs || []), pbdRef];
    }

    await route.fulfill({
      status: introduced ? 201 : 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...target,
        pbdRef,
        introduced,
        createdPbd: !existingPbdRef,
        updatedPbdConfig: false,
        pluggedPbd: !existingPbdRef,
        alreadyAttached: Boolean(existingPbdRef),
        attachedHostRef: payload.hostRef,
      }),
    });
  });

  await page.route('**/api/storage/*/rescan', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const target = storageInventory.find((entry) => entry.ref === ref);
    if (!target) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    target.other_config = {
      ...(target.other_config || {}),
      last_rescan_at: '2026-08-26T18:45:00.000Z',
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(target),
    });
  });

  await page.route('**/api/storage/*/config', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const payload = route.request().postDataJSON() || {};
    const target = storageInventory.find((entry) => entry.ref === ref);
    if (!target) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'SR_NOT_FOUND' }) });
      return;
    }

    target.name_label = payload.nameLabel || target.name_label;
    target.name_description = payload.nameDescription || '';
    target.tags = Array.isArray(payload.tags) ? [...payload.tags] : [];
    target.other_config = {
      ...Object.fromEntries(
        Object.entries(target.other_config || {})
          .filter(([key]) => ['last_rescan_at', 'last_repair_at'].includes(String(key || '').trim()))
      ),
      ...(payload.otherConfig || {}),
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(target),
    });
  });

  await page.route('**/api/storage/*/repair', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const target = storageInventory.find((entry) => entry.ref === ref);
    if (!target) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    const repairedPbdRefs = Array.isArray(target.PBDs) ? [...target.PBDs] : [];
    target.other_config = {
      ...(target.other_config || {}),
      last_repair_at: '2026-08-26T19:10:00.000Z',
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...target,
        checkedPbdRefs: Array.isArray(target.PBDs) ? [...target.PBDs] : [],
        repairedPbdRefs,
        reattachedCount: repairedPbdRefs.length,
      }),
    });
  });

  await page.route('**/api/storage/*/local-cache', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const payload = route.request().postDataJSON() || {};
    const target = storageInventory.find((entry) => entry.ref === ref);
    const host = hostInventory.find((entry) => entry.ref === payload.hostRef);
    if (!target) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'SR_NOT_FOUND' }) });
      return;
    }
    if (!host) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'HOST_NOT_FOUND' }) });
      return;
    }
    if (target.shared && payload.enabled) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'LOCAL_CACHE_REQUIRES_LOCAL_SR',
          message: 'Local storage caching only applies to non-shared storage repositories attached to a specific host.',
        }),
      });
      return;
    }

    const hasPath = Array.isArray(target.PBDs) && Array.isArray(host.PBDs) && target.PBDs.some((pbdRef) => host.PBDs.includes(pbdRef));
    if (!hasPath) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'LOCAL_CACHE_REQUIRES_ATTACHED_HOST_PATH',
          message: 'The selected host does not currently expose an attached path to this storage repository.',
        }),
      });
      return;
    }

    target.local_cache_enabled = Boolean(payload.enabled);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...target,
        hostRef: payload.hostRef || '',
        requestedEnabled: Boolean(payload.enabled),
      }),
    });
  });

  await page.route('**/api/storage/*/forget', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const index = storageInventory.findIndex((entry) => entry.ref === ref);
    if (index === -1) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'SR_NOT_FOUND' }) });
      return;
    }

    storageInventory.splice(index, 1);
    for (let pointer = vdiInventory.length - 1; pointer >= 0; pointer -= 1) {
      if (vdiInventory[pointer]?.SR === ref) {
        vdiInventory.splice(pointer, 1);
      }
    }
    syncStorageInventoryVdis();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, ref }),
    });
  });

  await page.route('**/api/storage/*/destroy', async (route) => {
    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const index = storageInventory.findIndex((entry) => entry.ref === ref);
    if (index === -1) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'SR_NOT_FOUND' }) });
      return;
    }

    const mappedVdis = vdiInventory.filter((entry) => entry.SR === ref);
    if (mappedVdis.length) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'SR_DESTROY_REQUIRES_EMPTY_REPOSITORY',
          message: `Destroy requires an empty repository. ${mappedVdis.length} VDI${mappedVdis.length === 1 ? '' : 's'} still map to this storage repository.`,
        }),
      });
      return;
    }

    storageInventory.splice(index, 1);
    syncStorageInventoryVdis();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, ref }),
    });
  });

  await page.route('**/api/storage/*/vdis', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const ref = decodeURIComponent(url.pathname.split('/')[3] || '');
    const target = storageInventory.find((entry) => entry.ref === ref);
    if (!target) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'NOT_FOUND' }) });
      return;
    }

    const payload = route.request().postDataJSON();
    const nextIndex = vdiInventory.length + 1;
    const created = {
      ref: `OpaqueRef:vdi${nextIndex}`,
      SR: ref,
      name_label: payload.nameLabel,
      virtual_size: Number(payload.sizeBytes || 0),
      type: payload.type || 'user',
      managed: true,
      VBDs: [],
    };

    vdiInventory.push(created);
    target.virtual_allocation = Number(target.virtual_allocation || 0) + Number(payload.sizeBytes || 0);
    syncStorageInventoryVdis();

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(created),
    });
  });

  await page.route('**/api/storage/*/vdis/*/resize', async (route) => {
    const url = new URL(route.request().url());
    const srRef = decodeURIComponent(url.pathname.split('/')[3] || '');
    const vdiRef = decodeURIComponent(url.pathname.split('/')[5] || '');
    const target = storageInventory.find((entry) => entry.ref === srRef);
    const vdi = vdiInventory.find((entry) => entry.ref === vdiRef && entry.SR === srRef);
    if (!target) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'SR_NOT_FOUND' }) });
      return;
    }
    if (!vdi) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'VDI_NOT_FOUND' }) });
      return;
    }

    const payload = route.request().postDataJSON();
    const previousSize = Number(vdi.virtual_size || 0);
    const nextSize = Number(payload.sizeBytes || previousSize);
    vdi.virtual_size = nextSize;
    target.virtual_allocation = Number(target.virtual_allocation || 0) + (nextSize - previousSize);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(vdi),
    });
  });

  await page.route('**/api/storage/*/vdis/*', async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fallback();
      return;
    }

    const url = new URL(route.request().url());
    const srRef = decodeURIComponent(url.pathname.split('/')[3] || '');
    const vdiRef = decodeURIComponent(url.pathname.split('/')[5] || '');
    const target = storageInventory.find((entry) => entry.ref === srRef);
    const index = vdiInventory.findIndex((entry) => entry.ref === vdiRef && entry.SR === srRef);
    if (!target) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'SR_NOT_FOUND' }) });
      return;
    }
    if (index === -1) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'VDI_NOT_FOUND' }) });
      return;
    }
    if (Array.isArray(vdiInventory[index].VBDs) && vdiInventory[index].VBDs.length) {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'VDI_DELETE_REQUIRES_DETACHED_DISK',
          message: `Delete only supports detached VDIs. ${vdiInventory[index].VBDs.length} attachment path${vdiInventory[index].VBDs.length === 1 ? '' : 's'} still map to this disk.`,
        }),
      });
      return;
    }

    const [removed] = vdiInventory.splice(index, 1);
    target.virtual_allocation = Math.max(0, Number(target.virtual_allocation || 0) - Number(removed?.virtual_size || 0));
    syncStorageInventoryVdis();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, vdiRef }),
    });
  });

  await page.route('**/api/storage*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname !== '/api/storage' || route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const targetKey = url.searchParams.get('targetKey') || activeTargetKey || '';
    const data = targetKey === 'host:10.0.1.1|user:root|port:443'
      ? [
          {
            ref: 'OpaqueRef:sr9',
            name_label: 'Recovery SR',
            uuid: 'sr-uuid-9',
            physical_size: 107374182400,
            virtual_allocation: 32212254720,
            VDIs: [],
          },
        ]
      : storageInventory.map((sr) => ({ ...sr, VDIs: Array.isArray(sr.VDIs) ? [...sr.VDIs] : [] }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: data.length,
        data,
      }),
    });
  });

  await page.route('**/api/storage/*/vdis', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const ref = decodeURIComponent(route.request().url().split('/api/storage/')[1].split('/vdis')[0] || '');
    const data = vdiInventory.filter((entry) => entry.SR === ref);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: data.length,
        data,
      }),
    });
  });

  await page.route('**/api/networks**', async (route) => {
    if (route.request().method() === 'GET' && new URL(route.request().url()).pathname === '/api/networks/interfaces') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total: vifInventory.length,
          data: vifInventory,
        }),
      });
      return;
    }

    if (route.request().method() === 'PUT' && /\/api\/networks\/interfaces\/.+\/config$/.test(new URL(route.request().url()).pathname)) {
      const vifRef = decodeURIComponent(new URL(route.request().url()).pathname.split('/')[4] || '');
      const payload = route.request().postDataJSON() || {};
      const vif = vifInventory.find((entry) => entry.ref === vifRef);

      if (!vif) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'VIF_NOT_FOUND' }),
        });
        return;
      }

      vif.qos_algorithm_type = String(payload.qosAlgorithmType || '').trim();
      vif.qos_algorithm_params = { ...(payload.qosAlgorithmParams || {}) };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(vif),
      });
      return;
    }

    if (route.request().method() === 'POST') {
      if (route.request().url().includes('/bonds')) {
        const payload = route.request().postDataJSON() || {};
        const network = networkInventory.find((entry) => entry.ref === payload.networkRef);

        if (!network) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'NETWORK_NOT_FOUND' }),
          });
          return;
        }

        const members = Array.isArray(payload.pifRefs) ? payload.pifRefs : [];
        network.PIFs = Array.from(new Set([...(network.PIFs || []), ...members]));
        network.other_config = {
          ...(network.other_config || {}),
          bond_mode: payload.mode || 'balance-slb',
        };

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            ref: `OpaqueRef:bond${networkInventory.length + 1}`,
            uuid: `bond-uuid-${networkInventory.length + 1}`,
            master: members[0] || '',
            slaves: members,
            primary_slave: members[0] || '',
            links_up: members.length,
            mode: payload.mode || 'balance-slb',
            networkRef: payload.networkRef,
            memberPifRefs: members,
            network,
          }),
        });
        return;
      }

      if (route.request().url().includes('/vlans')) {
        const payload = route.request().postDataJSON() || {};
        const network = networkInventory.find((entry) => entry.ref === payload.networkRef);

        if (!network) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'NETWORK_NOT_FOUND' }),
          });
          return;
        }

        network.other_config = {
          ...(network.other_config || {}),
          vlan: String(payload.tag || ''),
        };

        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            ref: `OpaqueRef:vlan${networkInventory.length + 1}`,
            uuid: `vlan-uuid-${networkInventory.length + 1}`,
            tagged_PIF: payload.pifRef,
            untagged_PIF: 'OpaqueRef:pif-generated',
            tag: Number(payload.tag || 0),
            networkRef: payload.networkRef,
            taggedPifRef: payload.pifRef,
            network,
          }),
        });
        return;
      }

      if (route.request().url().includes('/destroy')) {
        const payload = route.request().postDataJSON() || {};
        const ref = decodeURIComponent(route.request().url().split('/api/networks/')[1].split('/destroy')[0] || '');
        const index = networkInventory.findIndex((entry) => entry.ref === ref);
        const record = index === -1 ? null : networkInventory[index];

        if (!record) {
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'NETWORK_NOT_FOUND' }),
          });
          return;
        }

        const pifCount = Array.isArray(record.PIFs) ? record.PIFs.length : 0;
        const vifCount = Array.isArray(record.VIFs) ? record.VIFs.length : 0;
        if (pifCount || vifCount) {
          const segments = [];
          if (pifCount) segments.push(`${pifCount} host uplink${pifCount === 1 ? '' : 's'}`);
          if (vifCount) segments.push(`${vifCount} workload interface${vifCount === 1 ? '' : 's'}`);
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'NETWORK_DESTROY_REQUIRES_DETACHED_ATTACHMENTS',
              message: `Destroy requires a detached managed network. ${segments.join(' and ')} still map to this network.`,
            }),
          });
          return;
        }

        networkInventory.splice(index, 1);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            ref,
            approvalId: payload.approvalId || '',
          }),
        });
        return;
      }

      const payload = route.request().postDataJSON() || {};
      const record = {
        ref: `OpaqueRef:net${networkInventory.length + 1}`,
        name_label: payload.nameLabel,
        name_description: payload.nameDescription || '',
        bridge: payload.bridge || '',
        MTU: Number(payload.mtu || 1500),
        managed: true,
        uuid: `net-uuid-${networkInventory.length + 1}`,
        VIFs: [],
        PIFs: [],
        tags: payload.tags || [],
        other_config: payload.otherConfig || {},
        default_locking_mode: 'unlocked',
      };
      networkInventory.push(record);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    if (route.request().method() === 'PUT' && route.request().url().includes('/api/networks/')) {
      const payload = route.request().postDataJSON() || {};
      const ref = decodeURIComponent(route.request().url().split('/api/networks/')[1].split('/config')[0] || '');
      const record = networkInventory.find((entry) => entry.ref === ref);

      if (!record) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'NETWORK_NOT_FOUND' }),
        });
        return;
      }

      record.name_label = payload.nameLabel;
      record.name_description = payload.nameDescription || '';
      record.MTU = Number(payload.mtu || record.MTU || 1500);
      record.default_locking_mode = payload.defaultLockingMode || record.default_locking_mode || 'unlocked';
      record.purpose = payload.purpose || [];
      record.tags = payload.tags || [];
      record.other_config = payload.otherConfig || {};

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    const url = new URL(route.request().url());
    const targetKey = url.searchParams.get('targetKey') || activeTargetKey || '';
    const data = targetKey === 'host:10.0.1.1|user:root|port:443'
      ? [
          {
            ref: 'OpaqueRef:net9',
            name_label: 'Recovery VM Network',
            bridge: 'xenbr9',
            MTU: 1500,
            managed: true,
            uuid: 'net-uuid-9',
            VIFs: [],
            PIFs: ['OpaqueRef:pif9'],
            other_config: { vlan: '920' },
          },
        ]
      : networkInventory;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: data.length,
        data,
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
    poolInventory,
    hostTargets,
    hostInventory,
    vmInventory,
    templateInventory,
    templateGovernance,
    templateGovernanceHistory,
    templateDeployments,
    templateDeploymentRuns,
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
    groups,
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

test('login shell renders the control-plane sign-in flow', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'XenMange' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In to XenMange' })).toBeVisible();
  await expect(page.getByText('Pool and host target registration now happens after sign-in from the Pools and Hosts workspaces.')).toBeVisible();
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
  await signInAndConnectDefaultTarget(page);
  await page.getByText('Dashboard').first().click();

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
  await page.locator('.section-head').getByRole('button', { name: /Registered Pool Targets/ }).click();
  const registeredTargetsWindow = page.locator('.floating-window').filter({ hasText: 'Registered Pool Targets' }).last();
  await registeredTargetsWindow.locator('.stack-item').filter({ hasText: 'Production Pool' }).getByRole('button', { name: 'Connect' }).click();
  await page.getByLabel('Pool Password').fill('secret');
  await page.getByRole('button', { name: 'Connect to Pool' }).click();

  await expect(page.getByText('connected now')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Production Pool', { exact: true })).toBeVisible();
});

test('hosts workspace can connect a registered standalone host target without leaving the app', async ({ page }) => {
  await stubAuthenticatedRoutes(page);
  await signInAndConnectDefaultTarget(page);

  await page.getByText('Hosts').first().click();
  await expect(page).toHaveURL(/\/hosts$/);
  await page.getByRole('button', { name: 'Register Host' }).click();
  await page.getByLabel('Host Name').fill('edge-a');
  await page.getByLabel('Host Address').fill('10.0.0.44');
  await page.getByRole('button', { name: 'Save Host Target' }).click();

  await page.locator('.section-head').getByRole('button', { name: /Registered Host Targets/ }).click();
  const registeredHostTargetsWindow = getFloatingWindowByTitle(page, 'Registered Host Targets');
  const targetRow = registeredHostTargetsWindow.locator('.stack-item').filter({ hasText: 'edge-a' });
  await targetRow.getByRole('button', { name: 'Connect' }).click();
  const connectHostWindow = getFloatingWindowByTitle(page, 'Connect to Host Target');
  await connectHostWindow.getByLabel('Host Password').fill('secret');
  await connectHostWindow.getByRole('button', { name: 'Connect to Host' }).click();

  await expect(registeredHostTargetsWindow.getByText('edge-a', { exact: true })).toBeVisible();
  await expect(page.getByText('connected now')).toBeVisible();
});

test('pools workspace can activate and detach multiple attached live sessions', async ({ page }) => {
  await stubAuthenticatedRoutes(page);
  await page.goto('/');

  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password').fill('admin123!');
  await page.getByRole('button', { name: 'Sign In to XenMange' }).click();

  await page.locator('.section-head').getByRole('button', { name: /Registered Pool Targets/ }).click();
  let registeredTargetsWindow = page.locator('.floating-window').filter({ hasText: 'Registered Pool Targets' }).last();
  await registeredTargetsWindow.locator('.stack-item').filter({ hasText: 'Production Pool' }).getByRole('button', { name: 'Connect' }).click();
  await page.getByLabel('Pool Password').fill('secret');
  await page.getByRole('button', { name: 'Connect to Pool' }).click();

  await page.getByRole('button', { name: 'Register Pool' }).click();
  await page.getByLabel('Profile Name').fill('DR Pool');
  await page.getByLabel('Pool Address').fill('10.0.0.55');
  await page.getByRole('button', { name: 'Save Pool Target' }).click();

  await page.locator('.section-head').getByRole('button', { name: /Registered Pool Targets/ }).click();
  registeredTargetsWindow = page.locator('.floating-window').filter({ hasText: 'Registered Pool Targets' }).last();
  await registeredTargetsWindow.locator('.stack-item').filter({ hasText: 'DR Pool' }).getByRole('button', { name: 'Connect' }).click();
  await page.getByLabel('Pool Password').fill('secret');
  await page.getByRole('button', { name: 'Connect to Pool' }).click();

  await page.locator('.section-head').getByRole('button', { name: /Attached Live Targets/ }).click();
  const attachedTargetsWindow = page.locator('.floating-window').filter({ hasText: 'Attached Live Targets' }).last();
  await expect(attachedTargetsWindow).toContainText('Production Pool');
  await expect(attachedTargetsWindow).toContainText('DR Pool');

  const drRow = attachedTargetsWindow.locator('.stack-item').filter({ hasText: 'DR Pool' }).first();

  await drRow.getByRole('button', { name: 'Detach' }).click();
  await expect(attachedTargetsWindow.locator('.stack-item').filter({ hasText: 'DR Pool' })).toHaveCount(0);
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

  await page.getByRole('button', { name: 'Add Group' }).click();
  await page.getByLabel('Group Name').fill('Site Reliability');
  await page.getByLabel('Members').selectOption('1');
  await page.getByRole('button', { name: 'Create Group' }).click();
  await expect.poll(() => fixtures.groups.find((entry) => entry.name === 'Site Reliability')?.id || 0).toBeGreaterThan(0);
  const siteReliabilityId = fixtures.groups.find((entry) => entry.name === 'Site Reliability').id;

  await page.getByRole('button', { name: 'Add User' }).click();
  await page.getByLabel('Username').fill('ops-admin');
  await page.getByLabel('Initial Password').fill('TempPassword123!');
  await page.getByLabel('Display Name').fill('Operations Admin');
  await page.getByLabel('Email').fill('ops-admin@example.com');
  await page.getByLabel('Role Ceiling').selectOption('operator');
  await page.getByLabel('Group Membership').selectOption(String(siteReliabilityId));
  await page.getByRole('button', { name: 'Create User' }).click();
  await expect.poll(() => fixtures.users.some((entry) => entry.username === 'ops-admin')).toBe(true);
  const opsAdminId = fixtures.users.find((entry) => entry.username === 'ops-admin').id;
  await expect.poll(() => fixtures.groups.find((entry) => entry.id === siteReliabilityId)?.memberUserIds.includes(opsAdminId) || false).toBe(true);

  await getFloatingWindowByTitle(page, 'Governance Control Panel')
    .getByRole('button', { name: /^Operations Admin/ })
    .click();
  await page.getByLabel('Email').fill('ops-admin+updated@example.com');
  await page.getByLabel('Role Ceiling').selectOption('admin');
  await page.getByLabel('Group Membership').selectOption([String(siteReliabilityId), '2']);
  await page.getByRole('button', { name: 'Save User' }).click();
  await expect.poll(() => fixtures.users.find((entry) => entry.username === 'ops-admin')?.role || '').toBe('admin');
  await expect.poll(() => fixtures.groups.find((entry) => entry.id === 2)?.memberUserIds.includes(opsAdminId) || false).toBe(true);

  await page.getByRole('button', { name: 'Reset Password' }).click();
  await page.getByLabel('New Password').fill('BetterPassword123!');
  await page.getByRole('button', { name: 'Rotate Password' }).click();
  await expect(page.getByText('Edit Local User')).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.getByRole('button', { name: /Site Reliability/ }).click();
  await page.getByLabel('Members').selectOption(String(opsAdminId));
  await page.getByRole('button', { name: 'Save Group' }).click();
  await expect.poll(() => fixtures.groups.find((entry) => entry.id === siteReliabilityId)?.memberUserIds.join(',') || '').toBe(String(opsAdminId));
  await getFloatingWindowByTitle(page, 'Governance Control Panel')
    .getByRole('button', { name: /Site Reliability/ })
    .click();
  await page.getByRole('button', { name: 'Remove Group' }).click();
  await expect.poll(() => fixtures.groups.some((entry) => entry.id === siteReliabilityId)).toBe(false);

  await page.locator('.dash-card').filter({ hasText: 'Session Role' }).getByRole('button', { name: /Operator/ }).click();
  await page.locator('.dash-card').filter({ hasText: 'Session Role' }).getByRole('button', { name: /Admin/ }).click();
  await expect(page.getByRole('button', { name: 'Add User' })).toBeVisible();
});

test('vm operations open a floating window and submit lifecycle actions', async ({ page }) => {
  let shutdownCalled = false;
  let rebootCalls = 0;
  let configSaved = false;
  let diskAdded = false;
  let nicAdded = false;
  let migrationSubmitted = false;
  let crossPoolMigrationSubmitted = false;
  let duplicateCreated = false;
  let importCompleted = false;
  let exportCompleted = false;
  let snapshotCreated = false;
  let snapshotReverted = false;
  let snapshotDeleted = false;
  await stubAuthenticatedRoutes(page, {
    liveTargets: [
      {
        targetKey: 'host:10.0.0.1|user:root|port:443',
        connectionId: null,
        connectionName: 'Production Pool',
        host: '10.0.0.1',
        username: 'root',
        port: 443,
        connectedAt: '2026-08-24T14:10:00.000Z',
        lastActivatedAt: '2026-08-24T14:10:00.000Z',
        active: true,
      },
      {
        targetKey: 'host:10.0.1.1|user:root|port:443',
        connectionId: null,
        connectionName: 'Recovery Pool',
        host: '10.0.1.1',
        username: 'root',
        port: 443,
        connectedAt: '2026-08-24T14:11:00.000Z',
        lastActivatedAt: '2026-08-24T14:11:00.000Z',
        active: false,
      },
    ],
  });

  const vmRecord = {
    ref: 'OpaqueRef:vm1',
    name_label: 'app-01',
    name_description: 'Primary application node',
    power_state: 'Running',
    VCPUs_at_startup: 4,
    VCPUs_max: 4,
    memory_static_min: 4294967296,
    memory_dynamic_min: 6442450944,
    memory_static_max: 8589934592,
    memory_dynamic_max: 8589934592,
    uuid: 'vm-uuid-1',
    tags: ['prod'],
    resident_on: 'OpaqueRef:host1',
    affinity: 'OpaqueRef:host1',
    appliance: 'OpaqueRef:appliance1',
    snapshot_schedule: 'OpaqueRef:vmss1',
    protection_policy: 'OpaqueRef:vmpp-legacy-1',
    guest_metrics: 'OpaqueRef:guestmetrics1',
    guest_metrics_record: {
      ref: 'OpaqueRef:guestmetrics1',
      live: true,
      last_updated: '2026-08-27T11:05:00.000Z',
      os_version: { name: 'Ubuntu', distro: '24.04 LTS', uname: '6.8.0-40-generic' },
      PV_drivers_detected: true,
      PV_drivers_up_to_date: true,
      PV_drivers_version: { major: '9', minor: '4' },
      networks: { '0/ip': '10.0.0.101', '0/ipv6/0': 'fd00::101' },
    },
    recommendations: '<restrictions><vcpus max="8"/><memory static-min="4294967296"/></restrictions>',
    VBDs: ['OpaqueRef:vbd1'],
    VIFs: ['OpaqueRef:vif1'],
    HVM_boot_policy: 'UEFI',
    platform: { secureboot: 'enabled', videoram: '8', igd_passthrough: 'false' },
  };
  const vmRecords = [vmRecord];
  const vmAppliances = [
    {
      ref: 'OpaqueRef:appliance1',
      uuid: 'appliance-uuid-1',
      name_label: 'Application Stack',
      name_description: 'Coordinates the application service tier.',
      VMs: ['OpaqueRef:vm1'],
    },
    {
      ref: 'OpaqueRef:appliance2',
      uuid: 'appliance-uuid-2',
      name_label: 'Database Stack',
      name_description: 'Coordinates dependent database startup ordering.',
      VMs: [],
    },
  ];
  const vmSnapshotSchedules = [
    {
      ref: 'OpaqueRef:vmss1',
      uuid: 'vmss-uuid-1',
      name_label: 'Nightly Application Recovery',
      name_description: 'Nightly snapshots for the application tier.',
      enabled: true,
      type: 'snapshot',
      frequency: 'daily',
      retained_snapshots: 7,
      schedule: { hour: '02', min: '30', days: '1,2,3,4,5' },
      VMs: ['OpaqueRef:vm1'],
    },
    {
      ref: 'OpaqueRef:vmss2',
      uuid: 'vmss-uuid-2',
      name_label: 'Weekly Database Checkpoint',
      name_description: 'Weekly checkpoint cadence for the database tier.',
      enabled: true,
      type: 'checkpoint',
      frequency: 'weekly',
      retained_snapshots: 4,
      schedule: { hour: '03', min: '15', days: '0' },
      VMs: [],
    },
  ];
  const vdis = [
    { ref: 'OpaqueRef:vdi1', SR: 'OpaqueRef:sr1', name_label: 'disk-01', virtual_size: 10737418240, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd1'] },
  ];
  const networks = [
    { ref: 'OpaqueRef:net1', name_label: 'VM Network', bridge: 'xenbr0', managed: true, uuid: 'net-uuid-1', VIFs: ['OpaqueRef:vif1'], PIFs: ['OpaqueRef:pif1', 'OpaqueRef:pif3'], other_config: { vlan: '120' } },
    { ref: 'OpaqueRef:net2', name_label: 'Backup Network', bridge: 'xenbr1', managed: true, uuid: 'net-uuid-2', VIFs: [], PIFs: ['OpaqueRef:pif2', 'OpaqueRef:pif4'], other_config: { vlan: '220' } },
  ];
  const destinationHosts = [
    { ref: 'OpaqueRef:host9', name_label: 'gamma-xen', address: '10.0.1.21', uuid: 'host-uuid-9', pool: 'OpaqueRef:pool9', enabled: true, maintenance_mode: false },
  ];
  const destinationPools = [
    { ref: 'OpaqueRef:pool9', name_label: 'Recovery Pool', uuid: 'pool-uuid-9', master: 'OpaqueRef:host9', default_SR: 'OpaqueRef:sr9', migration_network: 'OpaqueRef:net9' },
  ];
  const destinationStorage = [
    { ref: 'OpaqueRef:sr9', name_label: 'Recovery SR', uuid: 'sr-uuid-9', physical_size: 107374182400, virtual_allocation: 32212254720 },
  ];
  const destinationNetworks = [
    { ref: 'OpaqueRef:net9', name_label: 'Recovery VM Network', bridge: 'xenbr9', managed: true, uuid: 'net-uuid-9', VIFs: [], PIFs: ['OpaqueRef:pif9'], other_config: { vlan: '920' } },
  ];
  const snapshots = [
    {
      ref: 'OpaqueRef:snap1',
      name_label: 'pre-maintenance',
      name_description: 'Created before the Monday, August 24, 2026 maintenance window.',
      snapshot_time: '2026-08-24T08:00:00.000Z',
      snapshot_mode: 'snapshot',
    },
  ];

  await page.route('**/api/vms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: vmRecords.length,
        data: vmRecords,
      }),
    });
  });

  await page.route('**/api/vms/appliances', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: vmAppliances.length,
        data: vmAppliances,
      }),
    });
  });

  await page.route('**/api/vms/snapshot-schedules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: vmSnapshotSchedules.length,
        data: vmSnapshotSchedules,
      }),
    });
  });

  await page.route('**/api/vms/import*', async (route) => {
    const url = new URL(route.request().url());
    const fileName = route.request().headers()['x-xenmange-filename'] || 'imported-app-01.xva';
    importCompleted = true;
    const nextVm = {
      ref: 'OpaqueRef:vm3',
      name_label: 'imported-app-01',
      name_description: 'Imported from an XVA package through the VM portability flow.',
      power_state: 'Halted',
      VCPUs_at_startup: 2,
      VCPUs_max: 2,
      memory_static_min: 2147483648,
      memory_dynamic_min: 2147483648,
      memory_static_max: 4294967296,
      memory_dynamic_max: 4294967296,
      uuid: 'vm-uuid-3',
      tags: ['imported'],
      resident_on: 'OpaqueRef:host1',
      affinity: 'OpaqueRef:host1',
      VBDs: [],
      VIFs: [],
      HVM_boot_policy: 'UEFI',
      platform: { secureboot: 'enabled' },
    };

    if (url.searchParams.get('metadataOnly') !== 'true') {
      const nextVbd = 'OpaqueRef:vbd-import-1';
      const nextVdi = 'OpaqueRef:vdi-import-1';
      nextVm.VBDs = [nextVbd];
      vdis.push({
        ref: nextVdi,
        SR: url.searchParams.get('srRef') || 'OpaqueRef:sr1',
        name_label: 'imported-app-01-root',
        virtual_size: 21474836480,
        type: 'user',
        managed: true,
        VBDs: [nextVbd],
      });
    }

    vmRecords.push(nextVm);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        fileName,
        metadataOnly: url.searchParams.get('metadataOnly') === 'true',
        importedVm: nextVm,
      }),
    });
  });

  await page.route(/.*\/api\/vms\/[^/]+\/snapshots\/[^/]+\/revert$/, async (route) => {
    const snapshotRef = decodeURIComponent(route.request().url().split('/snapshots/')[1].replace('/revert', ''));
    snapshotReverted = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, snapshotRef }),
    });
  });

  await page.route(/.*\/api\/vms\/[^/]+\/snapshots\/[^/]+$/, async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fallback();
      return;
    }

    const snapshotRef = decodeURIComponent(route.request().url().split('/snapshots/')[1]);
    snapshotDeleted = true;
    const index = snapshots.findIndex((entry) => entry.ref === snapshotRef);
    if (index >= 0) snapshots.splice(index, 1);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, snapshotRef }),
    });
  });

  await page.route(/.*\/api\/vms\/[^/]+\/snapshots$/, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON();
      snapshotCreated = true;
      snapshots.unshift({
        ref: 'OpaqueRef:snap2',
        name_label: payload.nameLabel,
        name_description: payload.nameDescription,
        snapshot_time: '2026-08-24T12:30:00.000Z',
        snapshot_mode: payload.mode,
      });
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(snapshots[0]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: snapshots.length,
        data: snapshots,
      }),
    });
  });

  await page.route(/.*\/api\/vms\/OpaqueRef%3A[^/]+$/, async (route) => {
    const ref = decodeURIComponent(route.request().url().split('/api/vms/')[1]);
    const record = vmRecords.find((entry) => entry.ref === ref) || {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(record),
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

  await page.route('**/api/pools', async (route) => {
    const url = new URL(route.request().url());
    const targetKey = url.searchParams.get('targetKey') || '';
    const pools = targetKey === 'host:10.0.1.1|user:root|port:443'
      ? destinationPools
      : [{ ref: 'OpaqueRef:pool1', name_label: 'Production Pool', uuid: 'pool-uuid-1', master: 'OpaqueRef:host1', default_SR: 'OpaqueRef:sr1', migration_network: 'OpaqueRef:net1', migration_compression: false }];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: pools.length,
        data: pools,
      }),
    });
  });

  await page.route('**/api/hosts', async (route) => {
    const url = new URL(route.request().url());
    const targetKey = url.searchParams.get('targetKey') || '';
    const hosts = targetKey === 'host:10.0.1.1|user:root|port:443'
      ? destinationHosts
      : [
          { ref: 'OpaqueRef:host1', name_label: 'alpha-xen', address: '10.0.0.11', uuid: 'host-uuid-1', pool: 'OpaqueRef:pool1', enabled: true, maintenance_mode: false },
          { ref: 'OpaqueRef:host2', name_label: 'beta-xen', address: '10.0.0.12', uuid: 'host-uuid-2', pool: 'OpaqueRef:pool1', enabled: true, maintenance_mode: false },
        ];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: hosts.length,
        data: hosts,
      }),
    });
  });

  await page.route('**/api/storage', async (route) => {
    const url = new URL(route.request().url());
    const targetKey = url.searchParams.get('targetKey') || '';
    const storageList = targetKey === 'host:10.0.1.1|user:root|port:443'
      ? destinationStorage
      : [{ ref: 'OpaqueRef:sr1', name_label: 'Primary SR', uuid: 'sr-uuid-1', physical_size: 214748364800, virtual_allocation: 85899345920 }];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: storageList.length,
        data: storageList,
      }),
    });
  });

  await page.route('**/api/networks', async (route) => {
    const url = new URL(route.request().url());
    const targetKey = url.searchParams.get('targetKey') || '';
    const networkList = targetKey === 'host:10.0.1.1|user:root|port:443'
      ? destinationNetworks
      : networks;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: networkList.length,
        data: networkList,
      }),
    });
  });

  await page.route('**/api/vms/OpaqueRef%3Avm1/config', async (route) => {
    const payload = route.request().postDataJSON();
    configSaved = true;
    Object.assign(vmRecord, {
      name_label: payload.nameLabel,
      name_description: payload.nameDescription,
      user_version: Number(payload.userVersion || 0),
      start_delay: Number(payload.startDelay || 0),
      shutdown_delay: Number(payload.shutdownDelay || 0),
      order: Number(payload.order || 0),
      VCPUs_at_startup: payload.vcpusAtStartup,
      VCPUs_max: payload.vcpusMax || payload.vcpusAtStartup,
      memory_static_min: payload.memoryStaticMin,
      memory_dynamic_min: payload.memoryDynamicMin || payload.memoryDynamicMax || payload.memoryStaticMin,
      memory_static_max: payload.memoryStaticMax,
      memory_dynamic_max: payload.memoryDynamicMax || payload.memoryStaticMax,
      hardware_platform_version: Number(payload.hardwarePlatformVersion || 0),
      domain_type: String(payload.domainType || 'unspecified').trim() || 'unspecified',
      has_vendor_device: Boolean(payload.hasVendorDevice),
      affinity: payload.affinity || '',
      appliance: payload.applianceRef || '',
      snapshot_schedule: payload.snapshotScheduleRef || '',
      tags: payload.tags,
      blocked_operations: payload.blockedOperations || {},
      VCPUs_params: payload.vcpusParams || {},
      other_config: payload.otherConfig || {},
      xenstore_data: payload.xenstoreData || {},
      NVRAM: payload.nvram || {},
      platform: payload.platform || {},
    });
    vmAppliances.forEach((appliance) => {
      appliance.VMs = (appliance.VMs || []).filter((vmRef) => vmRef !== vmRecord.ref);
    });
    const selectedAppliance = vmAppliances.find((appliance) => appliance.ref === vmRecord.appliance);
    if (selectedAppliance) {
      selectedAppliance.VMs = [...new Set([...(selectedAppliance.VMs || []), vmRecord.ref])];
    }
    vmSnapshotSchedules.forEach((schedule) => {
      schedule.VMs = (schedule.VMs || []).filter((vmRef) => vmRef !== vmRecord.ref);
    });
    const selectedSnapshotSchedule = vmSnapshotSchedules.find((schedule) => schedule.ref === vmRecord.snapshot_schedule);
    if (selectedSnapshotSchedule) {
      selectedSnapshotSchedule.VMs = [...new Set([...(selectedSnapshotSchedule.VMs || []), vmRecord.ref])];
    }

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

  await page.route(/.*\/api\/vms\/[^/]+\/duplicate$/, async (route) => {
    const payload = route.request().postDataJSON();
    const ref = decodeURIComponent(route.request().url().split('/api/vms/')[1].split('/duplicate')[0] || '');
    const sourceVm = vmRecords.find((entry) => entry.ref === ref) || vmRecord;
    duplicateCreated = true;
    const nextVbd = 'OpaqueRef:vbd-copy-1';
    const nextVdi = 'OpaqueRef:vdi-copy-1';
    const nextVif = 'OpaqueRef:vif-copy-1';
    const nextVm = {
      ...sourceVm,
      ref: 'OpaqueRef:vm2',
      uuid: 'vm-uuid-2',
      name_label: payload.nameLabel,
      name_description: payload.nameDescription,
      power_state: payload.startAfter ? 'Running' : 'Halted',
      VBDs: [nextVbd],
      VIFs: [nextVif],
    };

    vmRecords.push(nextVm);
    vdis.push({
      ref: nextVdi,
      SR: payload.srRef || 'OpaqueRef:sr1',
      name_label: `${payload.nameLabel}-disk-01`,
      virtual_size: 10737418240,
      type: 'user',
      managed: true,
      VBDs: [nextVbd],
    });
    networks[0].VIFs = [...networks[0].VIFs, nextVif];

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ...nextVm,
        duplication_mode: payload.mode,
        targetSrRef: payload.srRef || '',
      }),
    });
  });

  await page.route('**/api/vms/OpaqueRef%3Avm1/migrate', async (route) => {
    const payload = route.request().postDataJSON();
    if (payload.mode === 'cross-pool') {
      crossPoolMigrationSubmitted = true;
      const destinationVm = {
        ...vmRecord,
        ref: 'OpaqueRef:vm9',
        uuid: 'vm-uuid-9',
        resident_on: 'OpaqueRef:host9',
        affinity: 'OpaqueRef:host9',
      };
      vmRecords.push(destinationVm);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...destinationVm,
          migration_mode: 'cross-pool-live',
          destinationTargetKey: payload.destinationTargetKey,
          destinationVmRef: 'OpaqueRef:vm9',
          destinationVmUuid: 'vm-uuid-9',
          targetSrRef: payload.srRef,
          transferNetworkRef: payload.transferNetworkRef,
          homeServerUpdated: false,
          homeServerUpdateError: '',
        }),
      });
      return;
    }

    migrationSubmitted = true;
    vmRecord.resident_on = payload.hostRef;
    if (payload.setAsHomeServer) {
      vmRecord.affinity = payload.hostRef;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...vmRecord,
        migration_mode: payload.live ? 'live' : 'relocate',
        migrated_to: payload.hostRef,
        homeServerUpdated: Boolean(payload.setAsHomeServer),
        homeServerUpdateError: '',
      }),
    });
  });

  await page.route(/.*\/api\/vms\/[^/]+\/export.*/, async (route) => {
    exportCompleted = true;
    const metadataOnly = new URL(route.request().url()).searchParams.get('metadataOnly') === 'true';
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="app-01${metadataOnly ? '-metadata' : ''}.xva"`,
      },
      body: metadataOnly ? 'demo-metadata-package' : 'demo-xva-package',
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

  await page.route('**/api/vms/reboot', async (route) => {
    rebootCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  // The fixture starts with both source and recovery fabrics attached.
  await signInToControlPlane(page);
  await expect(page).toHaveURL(/\/pools(?:\?.*)?$/);

  await page.getByText('Virtual Machines').first().click();
  await expect(page).toHaveURL(/\/vms$/);
  await page.getByLabel('Select app-01').click();
  await expect(page.getByText('1 VMs selected')).toBeVisible();
  await page.getByRole('button', { name: 'Reboot Selected (1)' }).click();
  await expect.poll(() => rebootCalls).toBe(1);
  await page.getByRole('button', { name: 'Clear Selection' }).click();
  await page.getByRole('button', { name: 'Import XVA' }).click();
  await page.getByLabel('XVA Package').setInputFiles({
    name: 'imported-app-01.xva',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('demo-import-payload'),
  });
  await page.getByRole('button', { name: 'Import Virtual Machine' }).click();
  await expect.poll(() => importCompleted).toBe(true);
  await expect(page.getByRole('heading', { name: 'imported-app-01' })).toBeVisible();
  await page.locator('.fw-close').first().click();

  await page.getByText('app-01', { exact: true }).click();

  await expect(page.getByText('VM Details')).toBeVisible();
  await expect(page.getByText('Guest Runtime & Guidance')).toBeVisible();
  const guestMetricsCard = page.locator('.dash-card').filter({ hasText: 'Guest Metrics' }).first();
  const recommendationsCard = page.locator('.dash-card').filter({ hasText: 'Recommendations' }).first();
  await expect(guestMetricsCard.getByText(/Guest heartbeat detected · updated/)).toBeVisible();
  await expect(guestMetricsCard.getByText('name=Ubuntu · distro=24.04 LTS · uname=6.8.0-40-generic', { exact: true })).toBeVisible();
  await expect(guestMetricsCard.getByText('Detected · major=9 · minor=4', { exact: true })).toBeVisible();
  await expect(guestMetricsCard.getByText('0/ip=10.0.0.101 · 0/ipv6/0=fd00::101', { exact: true })).toBeVisible();
  await expect(recommendationsCard.getByText('<restrictions><vcpus max=\"8\"/><memory static-min=\"4294967296\"/></restrictions>', { exact: true })).toBeVisible();
  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Config' }).click();
  await page.getByLabel('VM Name').fill('app-01-renamed');
  await page.getByLabel('Description').fill('Updated operator-facing VM description.');
  await page.getByLabel('Version Tag').fill('8');
  await page.getByLabel('Start Delay (s)').fill('45');
  await page.getByLabel('Shutdown Delay (s)').fill('90');
  await page.getByLabel('Boot Order').fill('3');
  await page.getByLabel('Startup vCPUs').fill('4');
  await page.getByLabel('Max vCPUs').fill('6');
  await page.getByLabel('Static Max Memory (GiB)').fill('8');
  await page.getByLabel('Dynamic Max Memory (GiB)').fill('7');
  await page.getByLabel('Dynamic Min Memory (GiB)').fill('6');
  await page.getByLabel('Static Min Memory (GiB)').fill('4');
  await page.getByLabel('Virtual Hardware Platform').fill('4');
  await page.getByLabel('Domain Type').selectOption('pvh');
  await page.getByLabel('Secure Boot').uncheck();
  await page.getByLabel('Video RAM (MiB)').fill('32');
  await page.getByLabel('IGD Passthrough').check();
  await page.getByLabel('Vendor Device Emulation').uncheck();
  await page.getByLabel('Home Server Affinity').selectOption('OpaqueRef:host2');
  await page.getByLabel('VM Appliance').selectOption('OpaqueRef:appliance2');
  await page.getByLabel('Snapshot Schedule').selectOption('OpaqueRef:vmss2');
  await page.getByLabel('Tags').fill('prod, linux, tier-1');
  await page.getByRole('checkbox', { name: /^Start/ }).check();
  await page.getByRole('checkbox', { name: /^Migrate/ }).check();
  await page.getByLabel('VM VCPUs_params').fill('weight=512\ncap=75');
  await page.getByLabel('VM other_config').fill('owner=storage-team\npatchWindow=sun-0200');
  await page.getByLabel('VM xenstore_data').fill('vm-data/cloud-init=enabled\nguest/channel=ops');
  await page.getByLabel('VM NVRAM').fill('EFI/BootOrder=0003,0004\nEFI/SecureBootMode=user');
  await page.getByLabel('VM platform').fill('firmware=bios');
  await page.getByRole('button', { name: 'Save VM Config' }).click();
  await expect.poll(() => configSaved).toBe(true);
  await expect.poll(() => vmRecord.NVRAM || {}).toEqual({
    'EFI/BootOrder': '0003,0004',
    'EFI/SecureBootMode': 'user',
  });
  await expect(page.getByRole('heading', { name: 'app-01-renamed' })).toBeVisible();
  await expect(page.getByText('4/6 vCPU')).toBeVisible();
  await expect(page.getByText('4 startup vCPU · 6 max vCPU · static max 8 GiB')).toBeVisible();
  await expect(page.getByText('Balloon 6-7 GiB inside static 4-8 GiB.')).toBeVisible();
  await expect(page.getByText('Sequence 3 in pool-managed startup and shutdown ordering.')).toBeVisible();
  await expect(page.getByText('Pinned to virtual hardware platform version 4 for host compatibility checks.')).toBeVisible();
  await expect(page.getByText('PVH takes effect on the next VM boot and supersedes legacy HVM boot-policy tuning.')).toBeVisible();
  await expect(page.getByText('Secure Boot is disabled for this workload platform profile.')).toBeVisible();
  await expect(page.getByText('Pinned to 32 MiB of virtual display memory for the guest graphics adapter on the next VM boot.')).toBeVisible();
  await expect(page.getByText('The Intel integrated graphics passthrough hint is enabled for the next VM boot and requires compatible host GPU support.')).toBeVisible();
  await expect(page.getByText('The HVM vendor-device PCI hint is disabled for this workload profile.')).toBeVisible();
  await expect(page.getByText('Database Stack coordinates grouped startup and shutdown sequencing across 1 VM in this appliance.')).toBeVisible();
  await expect(page.getByText('Weekly Database Checkpoint is enabled on a weekly cadence, retains 4 snapshots, and currently covers 1 VM. Window 03:15 local · days 0.')).toBeVisible();
  await expect(page.getByText('OpaqueRef:vmpp-legacy-1 is a legacy VMPP reference. Upstream XAPI deprecated VMPP in XenServer 6.2 and marked the class removed in XenServer 6.2, so XenMange surfaces this field as read-only guidance instead of an editable policy assignment.')).toBeVisible();
  await expect(page.getByText('EFI/BootOrder=0003,0004 · EFI/SecureBootMode=user Xen only applies NVRAM updates while the VM is halted.')).toBeVisible();
  await expect(page.getByText('start=OPERATION_NOT_ALLOWED · pool_migrate=OPERATION_NOT_ALLOWED')).toBeVisible();
  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Overview' }).click();
  const vmOverviewGrid = page.locator('.floating-window .property-grid').first();
  await expect(vmOverviewGrid.getByText('Updated operator-facing VM description.')).toBeVisible();
  await expect(vmOverviewGrid.getByText('8', { exact: true })).toBeVisible();
  await expect(vmOverviewGrid.getByText('45s')).toBeVisible();
  await expect(vmOverviewGrid.getByText('90s')).toBeVisible();
  await expect(vmOverviewGrid.getByText('3', { exact: true })).toBeVisible();
  await expect(vmOverviewGrid.getByText('v4')).toBeVisible();
  await expect(vmOverviewGrid.getByText('PVH')).toBeVisible();
  await expect(vmOverviewGrid).toContainText('Secure Boot');
  await expect(vmOverviewGrid).toContainText('Video RAM');
  await expect(vmOverviewGrid.getByText('32 MiB')).toBeVisible();
  await expect(vmOverviewGrid).toContainText('IGD Passthrough');
  await expect(vmOverviewGrid.getByText('Enabled', { exact: true })).toBeVisible();
  await expect(vmOverviewGrid.getByText('Weekly Database Checkpoint')).toBeVisible();
  await expect(vmOverviewGrid.getByText('OpaqueRef:vmpp-legacy-1')).toBeVisible();
  await expect(vmOverviewGrid.getByText('XML recommendations available')).toBeVisible();
  await expect(vmOverviewGrid.getByText(/Guest heartbeat detected/)).toBeVisible();
  await expect(vmOverviewGrid).toContainText('Vendor Device');
  await expect(vmOverviewGrid.getByText('beta-xen (OpaqueRef:host2)')).toBeVisible();
  await expect(vmOverviewGrid.getByText('Database Stack')).toBeVisible();
  await expect(vmOverviewGrid.getByText('prod, linux, tier-1')).toBeVisible();
  await expect(vmOverviewGrid.getByText('weight=512 · cap=75')).toBeVisible();
  await expect(vmOverviewGrid.getByText('owner=storage-team · patchWindow=sun-0200')).toBeVisible();
  await expect(vmOverviewGrid.getByText('vm-data/cloud-init=enabled · guest/channel=ops')).toBeVisible();
  await expect(vmOverviewGrid.getByText('EFI/BootOrder=0003,0004 · EFI/SecureBootMode=user')).toBeVisible();
  await expect(vmOverviewGrid.getByText('firmware=bios · secureboot=disabled')).toBeVisible();

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

  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Compatibility' }).click();
  await expect(page.getByText('Host Compatibility Matrix')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('AMD EPYC').first()).toBeVisible();

  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Console' }).click();
  await expect(page.getByText('Console Access')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Launch' })).toBeVisible();

  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Migration' }).click();
  await expect(page.getByLabel('Compress the migration stream')).not.toBeChecked();
  await expect(page.getByText("Pool default migration compression is disabled for this workload's current pool.", { exact: true })).toBeVisible();
  await page.getByLabel('Destination Host', { exact: true }).selectOption('OpaqueRef:host2');
  await page.getByRole('button', { name: 'Migrate VM' }).click();
  await expect.poll(() => migrationSubmitted).toBe(true);
  await expect(page.locator('.vm-stat-chips').getByText('beta-xen', { exact: true })).toBeVisible();

  await page.getByLabel('Migration Scope').selectOption('cross-pool');
  await page.getByLabel('Destination Live Target').selectOption('host:10.0.1.1|user:root|port:443');
  await expect(page.getByLabel('Transfer Network')).toBeVisible();
  await page.getByLabel('Transfer Network').selectOption('OpaqueRef:net9');
  await page.getByLabel('Destination Storage').selectOption('OpaqueRef:sr9');
  await page.getByRole('button', { name: 'Migrate Across Pools' }).click();
  await expect.poll(() => crossPoolMigrationSubmitted).toBe(true);
  await expect(page.getByText('vm-uuid-9', { exact: true })).toBeVisible();

  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Import / Export' }).click();
  await page.getByRole('button', { name: 'Export Full XVA' }).click();
  await expect.poll(() => exportCompleted).toBe(true);

  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Protection' }).click();
  await page.getByLabel('Snapshot Name').fill('pre-upgrade-checkpoint');
  await page.getByLabel('Protection Mode').selectOption('checkpoint');
  await page.getByLabel('Notes').fill('Checkpoint captured before the Monday, August 24, 2026 release cutover.');
  await page.getByRole('button', { name: 'Create Restore Point' }).click();
  await expect.poll(() => snapshotCreated).toBe(true);
  await expect(page.getByText('pre-upgrade-checkpoint')).toBeVisible();

  await page.getByRole('button', { name: 'Revert' }).first().click();
  await expect.poll(() => snapshotReverted).toBe(true);

  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expect.poll(() => snapshotDeleted).toBe(true);

  await page.getByRole('button', { name: 'Shutdown' }).click();

  await expect.poll(() => shutdownCalled).toBe(true);
  await page.locator('.vm-tab-strip').getByRole('button', { name: 'Clone / Copy' }).click();
  await page.getByLabel('New VM Name').fill('app-01-copy');
  await page.getByLabel('Copy Mode').selectOption('copy');
  await page.getByLabel('Start the duplicated VM after provisioning completes').evaluate((element) => { element.click(); });
  await page.getByRole('button', { name: 'Create VM Copy' }).click();
  await expect.poll(() => duplicateCreated).toBe(true);
  await expect(page.getByRole('heading', { name: 'app-01-copy' })).toBeVisible();
});

test('hosts workspace supports selected-row maintenance batching', async ({ page }) => {
  const fixtures = await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Hosts').first().click();
  await expect(page).toHaveURL(/\/hosts$/);
  await page.getByLabel('Select alpha-xen').click();
  await expect(page.getByText('1 hosts selected')).toBeVisible();
  await expect(page.getByText('1 ready for maintenance')).toBeVisible();
  await page.getByRole('button', { name: 'Enter Maintenance Selected (1)' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.maintenance_mode || false).toBe(true);
  await expect.poll(() => (fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.resident_VMs || []).length).toBe(0);
  await expect(page.getByText('1 already in maintenance')).toBeVisible();
  await page.getByRole('button', { name: 'Exit Maintenance Selected (1)' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.maintenance_mode || false).toBe(false);
});

test('storage workspace supports selected-row rescans', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await page.getByLabel('Select Primary SR').click();
  await expect(page.getByText('1 repositories selected')).toBeVisible();
  await expect(page.getByText(/across 1 repository/)).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  const [rescanResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/rescan')
    ),
    page.getByRole('button', { name: 'Rescan Selected (1)' }).click(),
  ]);
  expect(rescanResponse.ok()).toBe(true);
  await expect.poll(async () => (await rescanResponse.json())?.other_config?.last_rescan_at || '').toBe('2026-08-26T18:45:00.000Z');
});

test('storage workspace supports selected-row forget and empty-repository destroy actions', async ({ page }) => {
  await stubAuthenticatedRoutes(page, {
    storageInventory: [
      {
        ref: 'OpaqueRef:sr1',
        name_label: 'Primary SR',
        type: 'lvm',
        physical_size: 32212254720,
        virtual_allocation: 21474836480,
        uuid: 'sr-uuid-1',
        PBDs: ['OpaqueRef:pbd1'],
      },
      {
        ref: 'OpaqueRef:sr2',
        name_label: 'Archive SR',
        type: 'nfs',
        physical_size: 21474836480,
        virtual_allocation: 0,
        uuid: 'sr-uuid-2',
        PBDs: [],
      },
    ],
    vdiInventory: [
      { ref: 'OpaqueRef:vdi1', SR: 'OpaqueRef:sr1', name_label: 'disk-01', virtual_size: 10737418240, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd1'] },
    ],
  });

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);

  await page.getByLabel('Select Primary SR').check();
  await page.getByLabel('Select Archive SR').check();
  await expect(page.getByText('2 repositories selected')).toBeVisible();
  await expect(page.getByText('1 destroy-ready')).toBeVisible();
  await expect(page.getByText('1 non-empty')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const [destroyResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr2/destroy')
    ),
    page.getByRole('button', { name: 'Destroy Selected (1)' }).click(),
  ]);
  expect(destroyResponse.ok()).toBe(true);
  await expect(page.getByText('Archive SR was destroyed and removed from the current storage inventory view.')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Archive SR', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear Selection' }).click();
  await page.getByLabel('Select Primary SR').check();
  page.once('dialog', (dialog) => dialog.accept());
  const [forgetResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/forget')
    ),
    page.getByRole('button', { name: 'Forget Selected (1)' }).click(),
  ]);
  expect(forgetResponse.ok()).toBe(true);
  await expect(page.getByText('Primary SR was forgotten and removed from the current storage inventory view.')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Primary SR', { exact: true })).toHaveCount(0);
});

test('storage workspace can create a new nfs storage repository from the top-level form', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);

  await page.locator('.section-head').getByRole('button', { name: 'Create Storage Repository' }).click();
  const createStorageWindow = page.locator('.floating-window').filter({ hasText: 'Create Storage Repository' }).last();
  await createStorageWindow.getByLabel('Placement Host').selectOption('OpaqueRef:host1');
  await createStorageWindow.getByLabel('Repository Type').selectOption('nfs');
  await createStorageWindow.getByLabel('Repository Name').fill('Tier 2 NFS');
  await createStorageWindow.getByLabel('Description').fill('Archive-capacity NFS storage');
  await createStorageWindow.getByLabel('NFS Server').fill('10.42.0.25');
  await createStorageWindow.getByLabel('NFS Export Path').fill('/exports/xen/tier2');

  const [createResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/storage')
    ),
    createStorageWindow.getByRole('button', { name: 'Create Storage Repository' }).click(),
  ]);
  expect(createResponse.status()).toBe(201);
  await expect.poll(async () => (await createResponse.json())?.name_label || '').toBe('Tier 2 NFS');

  await expect(page.getByText('Workspace updated')).toBeVisible();
  await expect(page.getByText('Tier 2 NFS was created on alpha-xen.')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Tier 2 NFS', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Tier 2 NFS', { exact: true }).first()).toBeVisible();
});

test('storage workspace can probe an existing repository target before create', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);

  await page.locator('.section-head').getByRole('button', { name: 'Create Storage Repository' }).click();
  const createStorageWindow = page.locator('.floating-window').filter({ hasText: 'Create Storage Repository' }).last();
  await createStorageWindow.getByLabel('Placement Host').selectOption('OpaqueRef:host1');
  await createStorageWindow.getByLabel('Repository Type').selectOption('nfs');
  await createStorageWindow.getByLabel('NFS Server').fill('10.42.0.25');
  await createStorageWindow.getByLabel('NFS Export Path').fill('/exports/xen/imported');

  const [probeResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/storage/probe')
    ),
    createStorageWindow.getByRole('button', { name: 'Probe Existing SRs' }).click(),
  ]);
  expect(probeResponse.status()).toBe(200);
  await expect.poll(async () => (await probeResponse.json())?.results?.[0]?.sr?.name_label || '').toBe('Imported Archive SR');

  await expect(createStorageWindow.getByText('Probe Discovery')).toBeVisible();
  await expect(createStorageWindow.getByText('Imported Archive SR')).toBeVisible();
  await expect(createStorageWindow.getByText('1 candidate · 1 existing SR · 1 complete configuration')).toBeVisible();
  await expect(createStorageWindow.getByText('server=10.42.0.25 · serverpath=/exports/xen/imported')).toBeVisible();
});

test('storage workspace can introduce a probed repository into inventory and attach it to the selected host', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);

  await page.locator('.section-head').getByRole('button', { name: 'Create Storage Repository' }).click();
  const createStorageWindow = page.locator('.floating-window').filter({ hasText: 'Create Storage Repository' }).last();
  await createStorageWindow.getByLabel('Placement Host').selectOption('OpaqueRef:host1');
  await createStorageWindow.getByLabel('Repository Type').selectOption('nfs');
  await createStorageWindow.getByLabel('NFS Server').fill('10.42.0.25');
  await createStorageWindow.getByLabel('NFS Export Path').fill('/exports/xen/imported');

  await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/storage/probe')
    ),
    createStorageWindow.getByRole('button', { name: 'Probe Existing SRs' }).click(),
  ]);

  const [importResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/storage/import')
    ),
    createStorageWindow.getByRole('button', { name: 'Introduce Or Attach' }).click(),
  ]);
  expect(importResponse.status()).toBe(201);
  await expect.poll(async () => (await importResponse.json())?.name_label || '').toBe('Imported Archive SR');

  await expect(page.getByText('Workspace updated')).toBeVisible();
  await expect(page.getByText('Imported Archive SR was introduced from imported-nfs-uuid and attached to alpha-xen.')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Imported Archive SR', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Imported Archive SR', { exact: true }).first()).toBeVisible();
});

test('storage detail operations create detached vdis, resize them, delete them, and rescan the repository', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await openDataTableRecord(page, 'Primary SR');
  const storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(storageDetailWindow.getByText('Storage Operations')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Create Or Attach VDI' }).click();
  const createVdiWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Create Or Attach VDI' }),
  }).last();
  await createVdiWindow.getByLabel('VDI Name').fill('logs-archive-01');
  await createVdiWindow.getByLabel('VDI Type').selectOption('metadata');
  await createVdiWindow.getByLabel('Capacity (GiB)', { exact: true }).fill('12');
  const [createResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/vdis')
    ),
    createVdiWindow.getByRole('button', { name: 'Create VDI' }).click(),
  ]);
  expect(createResponse.status()).toBe(201);
  await expect.poll(async () => (await createResponse.json())?.name_label || '').toBe('logs-archive-01');
  const attachedVdisSection = storageDetailWindow.locator('.detail-section').filter({
    has: page.locator('.detail-section-title').filter({ hasText: 'Attached VDIs' }),
  });
  await expect(attachedVdisSection.getByText('logs-archive-01').first()).toBeVisible();
  await expect(createVdiWindow).not.toBeVisible();

  const refreshedStorageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await refreshedStorageDetailWindow.getByRole('button', { name: 'Resize Existing VDI' }).click();
  const resizeVdiWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Resize Existing VDI' }),
  }).last();
  await resizeVdiWindow.getByLabel('Target VDI').selectOption('OpaqueRef:vdi2');
  await resizeVdiWindow.getByLabel('New Capacity (GiB)', { exact: true }).fill('24');
  const [resizeResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/vdis/OpaqueRef%3Avdi2/resize')
    ),
    resizeVdiWindow.getByRole('button', { name: 'Resize VDI' }).click(),
  ]);
  expect(resizeResponse.ok()).toBe(true);
  await expect.poll(async () => (await resizeResponse.json())?.virtual_size || 0).toBe(25769803776);
  await expect(attachedVdisSection.getByText('24 GiB').first()).toBeVisible();
  await expect(resizeVdiWindow).not.toBeVisible();

  const createdVdiRow = attachedVdisSection.locator('.stack-item').filter({
    hasText: 'logs-archive-01',
  }).first();
  const [deleteResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'DELETE'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/vdis/OpaqueRef%3Avdi2')
    ),
    createdVdiRow.getByRole('button', { name: 'Delete' }).click(),
  ]);
  expect(deleteResponse.ok()).toBe(true);
  await expect(attachedVdisSection.getByText('logs-archive-01')).toHaveCount(0);

  await refreshedStorageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  const repositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();
  const [rescanResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/rescan')
    ),
    repositoryActionsWindow.getByRole('button', { name: 'Rescan Repository' }).click(),
  ]);
  expect(rescanResponse.ok()).toBe(true);
  await expect.poll(async () => (await rescanResponse.json())?.other_config?.last_rescan_at || '').toBe('2026-08-26T18:45:00.000Z');
});

test('storage detail operations can create and attach a new vdi directly to a workload', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await openDataTableRecord(page, 'Primary SR');
  const storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(storageDetailWindow.getByText('Storage Operations')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Create Or Attach VDI' }).click();
  const createVdiWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Create Or Attach VDI' }),
  }).last();

  await createVdiWindow.getByLabel('VDI Name').fill('analytics-cache-01');
  await createVdiWindow.getByLabel('Provisioning Mode').selectOption('attach');
  await createVdiWindow.getByLabel('Target VM').selectOption('OpaqueRef:vm1');
  await createVdiWindow.getByLabel('Capacity (GiB)').fill('18');

  const [attachResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/vms/OpaqueRef%3Avm1/disks')
    ),
    createVdiWindow.getByRole('button', { name: 'Create VDI' }).click(),
  ]);
  expect(attachResponse.status()).toBe(201);
  await expect(page.getByText('analytics-cache-01 was created on Primary SR and attached to app-01.')).toBeVisible();
  await expect(storageDetailWindow.locator('.detail-section').filter({
    has: page.locator('.detail-section-title').filter({ hasText: 'Attached VDIs' }),
  }).getByText('analytics-cache-01')).toBeVisible();
});

test('storage detail operations can repair the selected repository', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await openDataTableRecord(page, 'Primary SR');
  const storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(storageDetailWindow.getByText('Storage Operations')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  const repositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();

  const [repairResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/repair')
    ),
    repositoryActionsWindow.getByRole('button', { name: 'Repair Repository' }).click(),
  ]);
  expect(repairResponse.ok()).toBe(true);
  await expect.poll(async () => (await repairResponse.json())?.reattachedCount || 0).toBe(1);
  await expect(page.getByText('Storage operation completed')).toBeVisible();
  await expect(page.getByText('Primary SR repair refreshed storage metadata and reattached 1 path.')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  const refreshedRepositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();
  await expect(refreshedRepositoryActionsWindow.getByText('2026-08-26T19:10:00.000Z')).toBeVisible();
});

test('storage detail operations can update the selected repository metadata', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await openDataTableRecord(page, 'Primary SR');
  const storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(storageDetailWindow.getByText('Storage Operations')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Repository Identity' }).click();
  const repositoryIdentityWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Identity' }),
  }).last();

  await repositoryIdentityWindow.getByLabel('Repository Display Name').fill('Primary SR Renamed');
  await repositoryIdentityWindow.getByLabel('Repository Description').fill('Updated operator-facing description for the primary repository.');
  await repositoryIdentityWindow.getByLabel('Repository Tags').fill('flash, tier-2, archive');
  await repositoryIdentityWindow.getByLabel('Repository other_config').fill('owner=storage-team\ntier=gold');

  const [configResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'PUT'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/config')
    ),
    repositoryIdentityWindow.getByRole('button', { name: 'Save Repository Metadata' }).click(),
  ]);
  expect(configResponse.ok()).toBe(true);
  await expect(page.getByText('Primary SR Renamed repository metadata was updated.')).toBeVisible();
  await expect(repositoryIdentityWindow).not.toBeVisible();
  const refreshedStorageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(refreshedStorageDetailWindow.getByText('Primary SR Renamed').first()).toBeVisible();
  await expect(refreshedStorageDetailWindow.getByText('Updated operator-facing description for the primary repository.')).toBeVisible();
  await expect(refreshedStorageDetailWindow.getByText('flash, tier-2, archive')).toBeVisible();
  await expect(refreshedStorageDetailWindow.getByText('owner=storage-team · tier=gold')).toBeVisible();
});

test('storage detail operations can enable and disable local cache on an attached host path', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await openDataTableRecord(page, 'Primary SR');
  const storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(storageDetailWindow.getByText('Storage Operations')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  const repositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();
  const localCacheButton = repositoryActionsWindow.getByRole('button', { name: 'Enable Local Cache' });
  await expect(localCacheButton).toBeEnabled();

  const [enableResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/local-cache')
    ),
    localCacheButton.click(),
  ]);
  expect(enableResponse.ok()).toBe(true);
  await expect(page.getByText('Primary SR is now the local cache SR for alpha-xen.')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  const refreshedRepositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();
  const disableButton = refreshedRepositoryActionsWindow.getByRole('button', { name: 'Disable Local Cache' });
  await expect(disableButton).toBeEnabled();

  const [disableResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/local-cache')
    ),
    disableButton.click(),
  ]);
  expect(disableResponse.ok()).toBe(true);
  await expect(page.getByText('Primary SR local cache assignment was cleared for alpha-xen.')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  const finalRepositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();
  await expect(finalRepositoryActionsWindow.getByRole('button', { name: 'Enable Local Cache' })).toBeVisible();
});

test('networking workspace can create a managed network', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await page.locator('.section-head').getByRole('button', { name: 'Create Network' }).click();
  const createNetworkWindow = page.locator('.floating-window').filter({ hasText: 'Create Network' }).last();
  await createNetworkWindow.getByLabel('Network Name').fill('Replication Transit');
  await createNetworkWindow.getByLabel('Bridge Name').fill('xenbr10');
  await createNetworkWindow.getByLabel('Description').fill('Dedicated replication bridge for backup copy traffic.');
  await createNetworkWindow.getByLabel('MTU').fill('1600');
  await createNetworkWindow.getByLabel('Tags').fill('replication, backup');
  await createNetworkWindow.getByLabel('Network other_config').fill('vlan=330\ndomain=replication');

  const [createResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/networks')
    ),
    createNetworkWindow.getByRole('button', { name: 'Create Network' }).click(),
  ]);
  expect(createResponse.status()).toBe(201);
  await expect(page.getByText('Replication Transit was created on xenbr10.')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Replication Transit', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.floating-window').getByText('1600', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('replication, backup', { exact: true })).toBeVisible();
});

test('networking workspace can create a vlan mapping on an existing uplink path', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await page.locator('.section-head').getByRole('button', { name: 'Create VLAN' }).click();
  const createVlanWindow = page.locator('.floating-window').filter({ hasText: 'Create VLAN' }).last();
  await createVlanWindow.getByLabel('Target Network').selectOption('OpaqueRef:net2');
  await createVlanWindow.getByLabel('Tagged Host Uplink').selectOption('OpaqueRef:pif2');
  await createVlanWindow.getByLabel('VLAN ID').fill('330');

  const [createResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/networks/vlans')
    ),
    createVlanWindow.getByRole('button', { name: 'Create VLAN' }).click(),
  ]);
  expect(createResponse.status()).toBe(201);
  await expect(page.getByText('VLAN 330 was created on alpha-xen · uplink 2 · OpaqueRef:pif2 for Backup Network.')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Focused VLAN Handoff')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('VLAN 330').first()).toBeVisible();
});

test('networking workspace can create a bond mapping on selected uplinks', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await page.locator('.section-head').getByRole('button', { name: 'Create Bond' }).click();
  const createBondWindow = page.locator('.floating-window').filter({ hasText: 'Create Bond' }).last();
  await createBondWindow.getByLabel('Target Network').selectOption('OpaqueRef:net2');
  await createBondWindow.getByLabel('Bond Mode').selectOption('lacp');
  await createBondWindow.getByLabel('Bond Members').selectOption(['OpaqueRef:pif2', 'OpaqueRef:pif4']);

  const [createResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/networks/bonds')
    ),
    createBondWindow.getByRole('button', { name: 'Create Bond' }).click(),
  ]);
  expect(createResponse.status()).toBe(201);
  await expect(page.getByText('Bond lacp was created across 2 uplinks for Backup Network.')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Focused Bond Handoff')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Backup Network', { exact: true }).first()).toBeVisible();
});

test('networking detail operations can attach a workload interface to the selected network', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await openDataTableRecord(page, 'Backup Network');
  await expect(page.getByText('Network Operations')).toBeVisible();

  const detailWindow = getFloatingWindowByTitle(page, 'Network Properties');
  await detailWindow.getByRole('button', { name: 'Attach Workload Interface' }).click();
  const attachWindow = getFloatingWindowByTitle(page, 'Attach Workload Interface');
  await attachWindow.getByLabel('Target VM').selectOption('OpaqueRef:vm1');
  await attachWindow.getByLabel('Device Slot').fill('2');

  const [attachResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/vms/OpaqueRef%3Avm1/nics')
    ),
    attachWindow.getByRole('button', { name: 'Attach VIF' }).click(),
  ]);
  expect(attachResponse.status()).toBe(201);
  await expect(page.getByText('app-01 was connected to Backup Network.')).toBeVisible();
  await expect(detailWindow.getByText('Focused Interface Handoff')).toBeVisible();
  await expect(detailWindow.getByText('app-01', { exact: true }).first()).toBeVisible();
});

test('networking detail operations can hot-unplug a workload interface from the selected network', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await openDataTableRecord(page, 'VM Network');
  const detailWindow = getFloatingWindowByTitle(page, 'Network Properties');
  const workloadRow = detailWindow.locator('.stack-item').filter({ hasText: 'OpaqueRef:vif1' }).first();
  await expect(workloadRow).toContainText('attached');

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  const [disconnectResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/vms/OpaqueRef%3Avm1/nics/OpaqueRef%3Avif1/disconnect')
    ),
    workloadRow.getByRole('button', { name: 'Disconnect VIF' }).click(),
  ]);
  expect(disconnectResponse.status()).toBe(200);
  await expect(page.getByText('app-01 interface OpaqueRef:vif1 was hot-unplugged from VM Network.')).toBeVisible();
  await expect(detailWindow.locator('.stack-item').filter({ hasText: 'OpaqueRef:vif1' }).first()).toContainText('hot-unplugged');
});

test('networking detail operations can remove a workload interface from the selected network', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await openDataTableRecord(page, 'VM Network');
  const detailWindow = getFloatingWindowByTitle(page, 'Network Properties');
  await expect(detailWindow.getByText('Connected Workloads')).toBeVisible();
  const workloadRow = detailWindow.locator('.stack-item').filter({ hasText: 'OpaqueRef:vif1' }).first();

  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  const [removeResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'DELETE'
      && response.url().includes('/api/vms/OpaqueRef%3Avm1/nics/OpaqueRef%3Avif1')
    ),
    workloadRow.getByRole('button', { name: 'Remove VIF' }).click(),
  ]);
  expect(removeResponse.status()).toBe(200);
  await expect(page.getByText('app-01 interface OpaqueRef:vif1 was removed from VM Network.')).toBeVisible();
  await expect(detailWindow.getByText('No VM interfaces currently reference this network.')).toBeVisible();
});

test('networking detail operations can update the selected network metadata', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await openDataTableRecord(page, 'VM Network');
  await expect(page.getByText('Network Operations')).toBeVisible();

  const detailWindow = getFloatingWindowByTitle(page, 'Network Properties');
  await detailWindow.getByRole('button', { name: 'Network Metadata' }).click();
  const metadataWindow = getFloatingWindowByTitle(page, 'Network Metadata');
  await metadataWindow.getByLabel('Network Name').fill('Production VM Network');
  await metadataWindow.getByLabel('MTU').fill('1600');
  await metadataWindow.getByLabel('Description').fill('Updated east-west traffic segment.');
  await metadataWindow.getByLabel('Tags').fill('prod, east-west');
  await metadataWindow.getByLabel('Default Locking Mode').selectOption('disabled');
  await metadataWindow.getByText('NBD', { exact: true }).click();
  await metadataWindow.getByLabel('Network other_config').fill('vlan=130\nowner=platform-ops');

  const [updateResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'PUT'
      && response.url().includes('/api/networks/OpaqueRef%3Anet1/config')
    ),
    metadataWindow.getByRole('button', { name: 'Save Network Metadata' }).click(),
  ]);
  expect(updateResponse.status()).toBe(200);
  await expect(page.getByText('Production VM Network network metadata was updated.')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Production VM Network', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.floating-window').getByText('1600', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('disabled', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.floating-window').getByText('nbd', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.floating-window').getByText('prod, east-west', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('{\"vlan\":\"130\",\"owner\":\"platform-ops\"}', { exact: true })).toBeVisible();
});

test('networking detail operations can update attached VIF QoS shaping', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await openDataTableRecord(page, 'VM Network');

  const detailWindow = getFloatingWindowByTitle(page, 'Network Properties');
  await detailWindow.getByRole('button', { name: 'Interface QoS' }).click();
  const qosWindow = getFloatingWindowByTitle(page, 'Interface QoS');
  await expect(qosWindow.getByRole('button', { name: 'Save Interface QoS' })).toBeVisible();
  await qosWindow.getByLabel('Attached Interface').selectOption('OpaqueRef:vif1');
  await qosWindow.getByLabel('QoS Algorithm').fill('ratelimit');
  await qosWindow.getByLabel('QoS Parameters').fill('kbps=75000\ntimeslice_us=50000');

  const [updateResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'PUT'
      && response.url().includes('/api/networks/interfaces/OpaqueRef%3Avif1/config')
    ),
    qosWindow.getByRole('button', { name: 'Save Interface QoS' }).click(),
  ]);
  expect(updateResponse.status()).toBe(200);
  await expect(page.getByText('app-01 interface OpaqueRef:vif1 QoS policy was updated on VM Network.')).toBeVisible();
  const connectedWorkloadsCard = detailWindow.locator('.dash-card').filter({ hasText: 'Connected Workloads' }).first();
  await expect(connectedWorkloadsCard.locator('.stack-item').filter({ hasText: 'OpaqueRef:vif1' }).first()).toContainText('ratelimit · kbps=75000, timeslice_us=50000');
});

test('networking detail operations gate attached network destroy and can destroy a detached network', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);

  await openDataTableRecord(page, 'VM Network');
  await expect(page.getByText('Network Operations')).toBeVisible();
  let detailWindow = getFloatingWindowByTitle(page, 'Network Properties');
  await detailWindow.getByRole('button', { name: 'Network Identity' }).click();
  let identityWindow = getFloatingWindowByTitle(page, 'Network Identity');
  await expect(identityWindow.getByRole('button', { name: 'Destroy Network' })).toBeDisabled();
  await expect(identityWindow.getByText('Destroy requires a detached managed network. 2 host uplinks and 1 workload interface still map to this network.')).toBeVisible();

  await detailWindow.locator('.fw-close').click();
  await openDataTableRecord(page, 'Archive Transit');
  await expect(page.getByText('Network Operations')).toBeVisible();
  detailWindow = getFloatingWindowByTitle(page, 'Network Properties');
  await detailWindow.getByRole('button', { name: 'Network Identity' }).click();
  identityWindow = getFloatingWindowByTitle(page, 'Network Identity');
  await expect(identityWindow.getByRole('button', { name: 'Destroy Network' })).toBeEnabled();

  page.once('dialog', (dialog) => dialog.accept());
  const [destroyResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/networks/OpaqueRef%3Anet3/destroy')
    ),
    identityWindow.getByRole('button', { name: 'Destroy Network' }).click(),
  ]);
  expect(destroyResponse.ok()).toBe(true);

  await expect(page.getByText('Workspace updated')).toBeVisible();
  await expect(page.getByText('Archive Transit was destroyed and removed from the current network inventory view.')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Archive Transit', { exact: true })).toHaveCount(0);
});

test('networking workspace supports selected-row destroy batching for detached networks', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);

  await page.locator('.section-head').getByRole('button', { name: 'Create Network' }).click();
  const createNetworkWindow = page.locator('.floating-window').filter({ hasText: 'Create Network' }).last();
  await createNetworkWindow.getByLabel('Network Name').fill('Replication Transit');
  await createNetworkWindow.getByLabel('Bridge Name').fill('xenbr10');
  await createNetworkWindow.getByLabel('Description').fill('Dedicated replication bridge for backup copy traffic.');
  await createNetworkWindow.getByLabel('MTU').fill('1600');
  const [createResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().endsWith('/api/networks')
    ),
    createNetworkWindow.getByRole('button', { name: 'Create Network' }).click(),
  ]);
  expect(createResponse.status()).toBe(201);

  await getFloatingWindowByTitle(page, 'Network Properties').locator('.fw-close').click();
  await page.getByLabel('Select Archive Transit').check();
  await page.getByLabel('Select Replication Transit').check();
  await expect(page.getByText('2 networks selected')).toBeVisible();
  await expect(page.getByText('2 destroy-ready')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const [destroyArchiveResponse, destroyReplicationResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/networks/OpaqueRef%3Anet3/destroy')
    ),
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/networks/OpaqueRef%3Anet4/destroy')
    ),
    page.getByRole('button', { name: 'Destroy Selected (2)' }).click(),
  ]);
  expect(destroyArchiveResponse.ok()).toBe(true);
  expect(destroyReplicationResponse.ok()).toBe(true);

  await expect(page.getByText('Workspace updated')).toBeVisible();
  await expect(page.getByText('2 selected networks were destroyed and removed from the current network inventory view.')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Archive Transit', { exact: true })).toHaveCount(0);
  await expect(page.locator('.data-table').getByText('Replication Transit', { exact: true })).toHaveCount(0);
});

test('storage detail operations block attached vdi deletion with attachment-aware guidance', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await openDataTableRecord(page, 'Primary SR');
  const storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(storageDetailWindow.getByText('Storage Operations')).toBeVisible();

  const attachedVdiRow = storageDetailWindow.locator('.detail-section').filter({
    has: page.locator('.detail-section-title').filter({ hasText: 'Attached VDIs' }),
  }).locator('.stack-item').filter({ hasText: 'disk-01' }).first();
  await storageDetailWindow.getByRole('button', { name: 'Resize Existing VDI' }).click();
  const resizeVdiWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Resize Existing VDI' }),
  }).last();

  await expect(attachedVdiRow.getByText('attached')).toBeVisible();
  await expect(attachedVdiRow.getByText('Delete is limited to detached VDIs. 1 workload attachment still map to this disk.')).toBeVisible();
  await expect(attachedVdiRow.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await expect(resizeVdiWindow.getByText('Resize Guidance')).toBeVisible();
  await expect(resizeVdiWindow.getByText('This VDI is attached to 1 workload. Resize grows the virtual disk, but guest partition and filesystem expansion still need follow-through inside the workload.')).toBeVisible();
});

test('storage detail operations can forget a repository from the current workspace inventory', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await openDataTableRecord(page, 'Primary SR');
  const storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(storageDetailWindow.getByText('Storage Operations')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  const repositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();

  page.once('dialog', (dialog) => dialog.accept());
  const [forgetResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr1/forget')
    ),
    repositoryActionsWindow.getByRole('button', { name: 'Forget Repository' }).click(),
  ]);
  expect(forgetResponse.ok()).toBe(true);

  await expect(page.getByText('Workspace updated')).toBeVisible();
  await expect(page.getByText('Primary SR was forgotten and removed from the current storage inventory view.')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Primary SR', { exact: true })).toHaveCount(0);
});

test('storage detail operations gate destroy for non-empty repositories and can destroy an empty repository', async ({ page }) => {
  await stubAuthenticatedRoutes(page, {
    storageInventory: [
      {
        ref: 'OpaqueRef:sr1',
        name_label: 'Primary SR',
        type: 'lvm',
        physical_size: 32212254720,
        virtual_allocation: 21474836480,
        uuid: 'sr-uuid-1',
        PBDs: ['OpaqueRef:pbd1'],
      },
      {
        ref: 'OpaqueRef:sr2',
        name_label: 'Archive SR',
        type: 'nfs',
        physical_size: 21474836480,
        virtual_allocation: 0,
        uuid: 'sr-uuid-2',
        PBDs: [],
      },
    ],
    vdiInventory: [
      { ref: 'OpaqueRef:vdi1', SR: 'OpaqueRef:sr1', name_label: 'disk-01', virtual_size: 10737418240, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd1'] },
    ],
  });

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Storage').first().click();
  await expect(page).toHaveURL(/\/storage$/);
  await openDataTableRecord(page, 'Primary SR');
  let storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await storageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  let repositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();
  await expect(repositoryActionsWindow.getByRole('button', { name: 'Destroy Repository' })).toBeDisabled();
  await expect(repositoryActionsWindow.getByText('Destroy requires an empty repository. 1 disk still map to this storage repository.')).toBeVisible();

  await repositoryActionsWindow.locator('.fw-close').click();
  await storageDetailWindow.locator('.fw-close').click();
  await openDataTableRecord(page, 'Archive SR');
  storageDetailWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Storage Repository' }),
  }).last();
  await expect(storageDetailWindow.getByText('Storage Operations')).toBeVisible();
  await storageDetailWindow.getByRole('button', { name: 'Repository Actions' }).click();
  repositoryActionsWindow = page.locator('.floating-window').filter({
    has: page.locator('.fw-title', { hasText: 'Repository Actions' }),
  }).last();
  await expect(repositoryActionsWindow.getByRole('button', { name: 'Destroy Repository' })).toBeEnabled();
  page.once('dialog', (dialog) => dialog.accept());
  const [destroyResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes('/api/storage/OpaqueRef%3Asr2/destroy')
    ),
    repositoryActionsWindow.getByRole('button', { name: 'Destroy Repository' }).click(),
  ]);
  expect(destroyResponse.ok()).toBe(true);

  await expect(page.getByText('Workspace updated')).toBeVisible();
  await expect(page.getByText('Archive SR was destroyed and removed from the current storage inventory view.')).toBeVisible();
  await expect(page.locator('.data-table').getByText('Archive SR', { exact: true })).toHaveCount(0);
});

test('pool and host registration flows live alongside the broader operator workbenches', async ({ page }) => {
  const fixtures = await stubAuthenticatedRoutes(page);
  let seededVmMigrationSubmitted = false;

  await page.route('**/api/vms/OpaqueRef%3Avm1/migrate', async (route) => {
    const payload = route.request().postDataJSON();
    seededVmMigrationSubmitted = true;
    const vm = fixtures.vmInventory.find((entry) => entry.ref === 'OpaqueRef:vm1');
    if (vm) {
      vm.resident_on = payload.hostRef;
      if (payload.setAsHomeServer) {
        vm.affinity = payload.hostRef;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...(vm || {}),
        migration_mode: payload.live ? 'live' : 'relocate',
        migrated_to: payload.hostRef,
        homeServerUpdated: Boolean(payload.setAsHomeServer),
        homeServerUpdateError: '',
      }),
    });
  });

  await page.route('**/api/vms/OpaqueRef%3Avm1/snapshots', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 0,
        data: [],
      }),
    });
  });

  await page.route('**/api/vms/OpaqueRef%3Avm1', async (route) => {
    const vm = fixtures.vmInventory.find((entry) => entry.ref === 'OpaqueRef:vm1') || {};
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(vm),
    });
  });

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Pools').first().click();
  await expect(page).toHaveURL(/\/pools$/);
  await page.getByRole('button', { name: 'Register Pool' }).click();
  await page.getByLabel('Profile Name').fill('DR Pool');
  await page.getByLabel('Pool Address').fill('10.0.0.55');
  await page.getByRole('button', { name: 'Save Pool Target' }).click();
  await page.locator('.section-head').getByRole('button', { name: /Registered Pool Targets/ }).click();
  const operatorRegisteredTargetsWindow = page.locator('.floating-window').filter({ hasText: 'Registered Pool Targets' }).last();
  await expect(operatorRegisteredTargetsWindow.getByText('DR Pool')).toBeVisible();
  await operatorRegisteredTargetsWindow.locator('.fw-close').click();
  await openDataTableRecord(page, 'Production Pool');
  const poolDetailWindow = page.locator('.floating-window').filter({ hasText: 'Pool Properties' }).last();
  await poolDetailWindow.getByRole('button', { name: 'Pool Identity' }).click();
  const poolIdentityWindow = page.locator('.floating-window').filter({ hasText: 'Pool Identity' }).last();
  await poolIdentityWindow.getByLabel('Pool Name').fill('Production Pool West');
  await poolIdentityWindow.getByLabel('Description').fill('Updated operator-facing pool summary for the west cluster.');
  await poolIdentityWindow.getByLabel('Default Storage Repository').selectOption('OpaqueRef:sr2');
  await poolIdentityWindow.getByLabel('Legacy vSwitch Controller').fill('10.0.0.81');
  await poolIdentityWindow.getByLabel('Enable pool-wide migration compression by default').check();
  await poolIdentityWindow.getByLabel('Enable workload balancing for this pool').check();
  await poolIdentityWindow.getByLabel('Enable IGMP snooping for multicast-sensitive pool networks').check();
  await poolIdentityWindow.getByLabel('Pool Tags').fill('prod, west, governed');
  await poolIdentityWindow.getByLabel('Pool other_config').fill('owner=platform-ops\ngovernance_tier=gold');
  await poolIdentityWindow.getByRole('button', { name: 'Save Pool Metadata' }).click();
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.name_label || '').toBe('Production Pool West');
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.default_SR || '').toBe('OpaqueRef:sr2');
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.vswitch_controller || '').toBe('10.0.0.81');
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.migration_compression || false).toBe(true);
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.wlb_enabled || false).toBe(true);
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.IGMP_snooping_enabled || false).toBe(true);
  await expect.poll(() => (fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.tags || []).join(',')).toBe('prod,west,governed');
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.other_config?.owner || '').toBe('platform-ops');
  await poolIdentityWindow.locator('.fw-close').click();
  await poolDetailWindow.getByRole('button', { name: 'Pool Context' }).click();
  const poolContextWindow = page.locator('.floating-window').filter({ hasText: 'Pool Context' }).last();
  await expect(page.getByText('Associated Hosts')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Production Pool West', { exact: true }).first()).toBeVisible();
  await expect(poolContextWindow.getByText('Operations Archive SR', { exact: true })).toBeVisible();
  await expect(poolContextWindow.getByText('Same-pool migration workflows default to a compressed transfer stream for this pool.', { exact: true })).toBeVisible();
  await expect(poolContextWindow.getByText('Workload balancing is enabled via https://wlb-west.example.internal', { exact: true })).toBeVisible();
  await expect(poolContextWindow.getByText('Legacy pool-level controller 10.0.0.81 is still configured here. Upstream deprecated this field in XenServer 7.2 in favor of SDN_controller workflows.', { exact: true })).toBeVisible();
  await expect(poolContextWindow.getByText('Multicast membership tracking is enforced for pool networking.', { exact: true })).toBeVisible();
  await expect(poolContextWindow.getByText('owner=platform-ops · governance_tier=gold', { exact: true })).toBeVisible();
  await poolContextWindow.locator('.fw-close').click();
  await poolDetailWindow.getByRole('button', { name: /High Availability/ }).click();
  const poolHaWindow = page.locator('.floating-window').filter({ hasText: 'High Availability' }).last();
  await poolHaWindow.getByLabel('Heartbeat Storage Repository').selectOption('OpaqueRef:sr2');
  await poolHaWindow.getByLabel('Host Failures To Tolerate').fill('2');
  await poolHaWindow.getByRole('button', { name: 'Enable HA' }).click();
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.ha_enabled || false).toBe(true);
  await expect.poll(() => fixtures.poolInventory.find((entry) => entry.ref === 'OpaqueRef:pool1')?.ha_host_failures_to_tolerate || 0).toBe(2);
  await expect(poolHaWindow.getByText('Enabled', { exact: true })).toBeVisible();
  await expect(page.getByText('Production Pool West high availability is now enabled with a 2 host-failure target.')).toBeVisible();
  await expect(poolDetailWindow.getByText('2 host failure(s)', { exact: true })).toBeVisible();
  await expect(page.getByText('Associated Hosts')).toBeVisible();
  await expect(page.getByText('alpha-xen')).toBeVisible();
  await poolDetailWindow.locator('.fw-close').click();

  await page.getByText('Hosts').first().click();
  await expect(page).toHaveURL(/\/hosts$/);
  await page.getByRole('button', { name: 'Register Host' }).click();
  await page.getByLabel('Host Name').fill('delta-edge');
  await page.getByLabel('Host Address').fill('10.0.0.35');
  await page.getByLabel('Saved Vault Credential').selectOption('2');
  await page.getByLabel('Attach this standalone host to the current session after save').check();
  await page.getByRole('button', { name: 'Save Host Target' }).click();
  await page.locator('.section-head').getByRole('button', { name: /Registered Host Targets/ }).click();
  const registeredHostTargetsWindow = page.locator('.floating-window').filter({ hasText: 'Registered Host Targets' }).last();
  await expect(registeredHostTargetsWindow.getByText('delta-edge', { exact: true })).toBeVisible();
  await expect(page.getByText('connected now')).toBeVisible();

  await page.getByRole('button', { name: 'Register Host' }).click();
  await page.getByLabel('Host Name').fill('gamma-xen');
  await page.getByLabel('Host Address').fill('10.0.0.13');
  await page.getByLabel('Registration Mode').selectOption('pool-member');
  await page.getByLabel('Target Pool').selectOption('1');
  await page.getByRole('button', { name: 'Save Host Target' }).click();
  await expect(registeredHostTargetsWindow.getByText('gamma-xen', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Pool' }).click();
  await expect(page).toHaveURL(/\/pools/);
  await page.getByText('Hosts').first().click();
  await expect(page).toHaveURL(/\/hosts$/);
  await openDataTableRecord(page, 'alpha-xen');
  const hostDetailWindow = page.locator('.floating-window').filter({ hasText: 'Host Properties' }).last();
  await expect(hostDetailWindow.getByText('Pool Membership').first()).toBeVisible();
  await expect(hostDetailWindow.getByText('Operations', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Related Host Inventory')).toBeVisible();
  await expect(page.getByText('Primary SR')).toBeVisible();
  await expect(hostDetailWindow.getByText('app-01', { exact: true }).first()).toBeVisible();
  await hostDetailWindow.getByRole('button', { name: 'Host Context' }).click();
  const hostContextWindow = page.locator('.floating-window').filter({ hasText: 'Host Context' }).last();
  await expect(hostContextWindow.getByText('Production Pool West', { exact: true })).toBeVisible();
  await hostContextWindow.locator('.fw-close').click();
  await hostDetailWindow.getByRole('button', { name: 'Platform and Licensing' }).click();
  const hostPlatformWindow = page.locator('.floating-window').filter({ hasText: 'Platform and Licensing' }).last();
  await expect(hostPlatformWindow.getByText('Enterprise', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('24 CPUs · 2 sockets · 6 cores/socket · 2 threads/core · AMD EPYC', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('product_version=8.4.0 · product_brand=XenServer · platform_name=west-cluster-master', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('address=10.0.0.90 · port=27000', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('1, 2, 3, 4', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('AD · corp.example.internal', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('domain=corp.example.internal · server=ldap01.corp.example.internal', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('weight=256 · cap=0', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('CPU scheduling', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('Disabled', { exact: true })).toBeVisible();
  await expect(hostPlatformWindow.getByText('system-manufacturer=Dell Inc. · system-product-name=PowerEdge R750 · bios-version=1.12.2', { exact: true })).toBeVisible();
  await hostPlatformWindow.locator('.fw-close').click();
  await hostDetailWindow.getByRole('button', { name: 'Host Identity' }).click();
  const hostIdentityWindow = page.locator('.floating-window').filter({ hasText: 'Host Identity' }).last();
  await hostIdentityWindow.getByLabel('Host Name').fill('alpha-xen-west');
  await hostIdentityWindow.getByLabel('Description').fill('Updated operator-facing description for the west production host.');
  await hostIdentityWindow.getByLabel('Host Tags').fill('prod, west, governed');
  await hostIdentityWindow.getByRole('button', { name: 'Save Host Metadata' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.name_label || '').toBe('alpha-xen-west');
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.name_description || '').toBe('Updated operator-facing description for the west production host.');
  await expect.poll(() => (fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.tags || []).join(',')).toBe('prod,west,governed');
  await expect(page.getByText('alpha-xen-west metadata was updated.')).toBeVisible();
  await hostIdentityWindow.locator('.fw-close').click();
  await hostDetailWindow.getByRole('button', { name: 'Host Context' }).click();
  const updatedHostContextWindow = page.locator('.floating-window').filter({ hasText: 'Host Context' }).last();
  await expect(updatedHostContextWindow.getByText('Updated operator-facing description for the west production host.', { exact: true })).toBeVisible();
  await updatedHostContextWindow.locator('.fw-close').click();
  await expect(hostDetailWindow.getByText('prod, west, governed', { exact: true }).first()).toBeVisible();
  await hostDetailWindow.getByRole('button', { name: 'Guest CPU Policy' }).click();
  const hostGuestCpuWindow = page.locator('.floating-window').filter({ hasText: 'Guest CPU Policy' }).last();
  await hostGuestCpuWindow.getByLabel('Guest VCPU Parameters').fill('weight=384\ncap=0');
  await hostGuestCpuWindow.getByRole('button', { name: 'Save Guest VCPU Policy' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.guest_VCPUs_params?.weight || '').toBe('384');
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.guest_VCPUs_params?.cap || '').toBe('0');
  await expect(page.getByText('alpha-xen-west guest VCPU policy was updated.')).toBeVisible();
  await expect(hostDetailWindow.getByText('weight=384 · cap=0', { exact: true }).first()).toBeVisible();
  await hostGuestCpuWindow.locator('.fw-close').click();
  await hostDetailWindow.getByRole('button', { name: 'Scheduler Policy' }).click();
  const hostSchedulerWindow = page.locator('.floating-window').filter({ hasText: 'Scheduler Policy' }).last();
  await hostSchedulerWindow.getByLabel('Scheduler Granularity').selectOption('core');
  await hostSchedulerWindow.getByRole('button', { name: 'Save Scheduler Policy' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.sched_gran || '').toBe('core');
  await expect(page.getByText('alpha-xen-west scheduler policy was updated.')).toBeVisible();
  await expect(hostDetailWindow.getByText('Core scheduling', { exact: true }).first()).toBeVisible();
  await hostSchedulerWindow.locator('.fw-close').click();
  await hostDetailWindow.getByRole('button', { name: 'Host Logging' }).click();
  const hostLoggingWindow = page.locator('.floating-window').filter({ hasText: 'Host Logging' }).last();
  await hostLoggingWindow.getByLabel('Host Logging').fill('syslog_destination=10.0.0.51\nsyslog_level=warning');
  await hostLoggingWindow.getByRole('button', { name: 'Save Host Logging' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.logging?.syslog_destination || '').toBe('10.0.0.51');
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.logging?.syslog_level || '').toBe('warning');
  await expect(page.getByText('alpha-xen-west logging configuration was updated.')).toBeVisible();
  await expect(hostDetailWindow.getByText('syslog_destination=10.0.0.51 · syslog_level=warning', { exact: true }).first()).toBeVisible();
  await hostLoggingWindow.locator('.fw-close').click();
  await page.getByLabel('Migration Network').selectOption('OpaqueRef:net1');
  await page.getByLabel('Evacuation Batch Size').fill('2');
  await page.getByRole('button', { name: 'Enter Maintenance Mode' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.maintenance_mode || false).toBe(true);
  await expect.poll(() => (fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.resident_VMs || []).length).toBe(0);
  await expect(page.getByRole('button', { name: 'Exit Maintenance Mode' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit Maintenance Mode' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.maintenance_mode || false).toBe(false);
  await page.locator('.floating-window .fw-close').first().click();

  await page.getByText('Networking').first().click();
  await expect(page).toHaveURL(/\/networking$/);
  await expect(page.getByRole('heading', { name: 'Networks' })).toBeVisible();
  await page.locator('.section-head').getByRole('button', { name: 'Create Network' }).click();
  const operatorCreateNetworkWindow = page.locator('.floating-window').filter({ hasText: 'Create Network' }).last();
  await operatorCreateNetworkWindow.getByLabel('Network Name').fill('Replication Transit');
  await operatorCreateNetworkWindow.getByLabel('Bridge Name').fill('xenbr10');
  await operatorCreateNetworkWindow.getByLabel('Description').fill('Dedicated replication bridge for backup copy traffic.');
  await operatorCreateNetworkWindow.getByLabel('MTU').fill('1600');
  await operatorCreateNetworkWindow.getByLabel('Tags').fill('replication, backup');
  await operatorCreateNetworkWindow.getByLabel('Network other_config').fill('vlan=330\ndomain=replication');
  await operatorCreateNetworkWindow.getByRole('button', { name: 'Create Network' }).click();
  await expect(page.getByText('Replication Transit was created on xenbr10.')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Replication Transit', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.floating-window').getByText('1600', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('replication, backup', { exact: true })).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();
  await openDataTableRecord(page, 'VM Network');
  await expect(getFloatingWindowByTitle(page, 'Network Properties').getByText('Host Uplinks', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Connected Workloads', { exact: true })).toBeVisible();
  await expect(page.locator('.floating-window').getByText('alpha-xen-west', { exact: true })).toBeVisible();
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
  await page.locator('.detail-section').filter({ hasText: 'Governance History' }).locator('.stack-item').nth(1).getByRole('button', { name: 'Restore Snapshot' }).click();
  await expect.poll(() => fixtures.templateGovernance.find((entry) => entry.templateRef === 'OpaqueRef:template1')?.owner || '').toBe('Platform Ops');
  await expect(page.getByText('History Restored')).toBeVisible();
  await page.getByRole('button', { name: 'Deploy Template' }).click();
  await page.getByLabel('VM Name').fill('ubuntu-prod-01');
  await page.getByRole('button', { name: 'Deploy VM' }).click();
  await expect(page.getByText('Deployment Submitted')).toBeVisible();
  await expect(page.getByText(/ubuntu-prod-01 prepared on alpha-xen-west and started\./)).toBeVisible();
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
  await expect(page.locator('.floating-window').getByText('Primary SR', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Attached VDIs')).toBeVisible();
  await expect(page.locator('.floating-window').getByText('Attachment Topology', { exact: true })).toBeVisible();
  await expect(page.getByText('2 disks · 2 attachment paths · 2 workloads · 2 hosts')).toBeVisible();
  await expect(page.locator('.floating-window').getByText(/OpaqueRef:vbd1 · app-01/)).toBeVisible();
  await page.locator('.floating-window').getByRole('button', { name: 'Open VM' }).first().click();
  await expect(page).toHaveURL(/\/vms\?/);
  await expect(page.getByText('VM Details')).toBeVisible();
  await expect(page.locator('.floating-window').getByRole('heading', { name: 'app-01' })).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();
  await page.getByText('Alerts').first().click();
  await expect(page).toHaveURL(/\/alerts$/);
  await page.locator('.data-table').getByText('VM interface flapping', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Network View' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Network View' }).click();
  await expect(page).toHaveURL(/\/networking\?/);
  await expect(page.locator('.floating-window').getByText('Network Properties', { exact: true })).toBeVisible();
  await expect(page.getByText('focused interface', { exact: true })).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();
  await page.getByText('Alerts').first().click();
  await expect(page).toHaveURL(/\/alerts$/);
  await page.locator('.data-table').getByText('Recovery VLAN drift detected', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Network View' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Network View' }).click();
  await expect(page).toHaveURL(/\/networking\?/);
  await expect(page.locator('.floating-window').getByText('Network Properties', { exact: true })).toBeVisible();
  await expect(page.getByText('Focused VLAN Handoff')).toBeVisible();
  await expect(page.getByText('VLAN 220 · 2 uplinks · 0 interfaces · 2 hosts').first()).toBeVisible();
  await expect(page.getByText('focused uplink', { exact: true })).toBeVisible();
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
  await page.getByLabel('Launch Behavior').selectOption('resilience-drill');
  await page.getByLabel('Recurrence Guard').selectOption('daily');
  await page.getByLabel('Task Name Template').fill('Template Capacity Review: {summary}');
  await page.getByLabel('Default Assignee').fill('Template Ops');
  await page.getByLabel('Default Due In (days)').fill('2');
  await page.getByLabel('Default Target Workspace').selectOption('/capacity');
  await page.getByLabel('Default Task Notes').fill('Standardize the datastore review before Monday, August 24, 2026.');
  await page.getByLabel('Workspace Brief Template').fill('Validate datastore pressure, confirm the follow-through owner, and capture supporting evidence for {summary}.');
  await page.getByLabel('Evidence Checklist').fill('Capture current latency evidence for {summary}.\nReview affected workloads on {object}.');
  await page.getByLabel('Completion Criteria').fill('Named owner accepts the remediation task.\nClosure note is recorded in Activity after validation.');
  await page.getByLabel('Seed a resilience runbook when this template is queued').evaluate((element) => { element.click(); });
  await page.getByLabel('Recovery Tier').selectOption('tier-1');
  await page.getByLabel('HA Policy').selectOption('priority-restart');
  await page.getByLabel('Restart Priority').selectOption('high');
  await page.getByLabel('Runbook Owner').fill('Template Ops');
  await page.getByLabel('Backup Window (hours)').fill('12');
  await page.getByLabel('Restore-Point Status').selectOption('review');
  await page.getByLabel('RPO (minutes)').fill('30');
  await page.getByLabel('RTO (minutes)').fill('90');
  await page.getByLabel('Standby Host Ref').fill('OpaqueRef:host2');
  await page.getByLabel('Failover Network Ref').fill('OpaqueRef:net2');
  await page.getByLabel('Runbook Steps').fill('Validate datastore safety for {summary}.\nExecute a scoped recovery drill.');
  await page.getByLabel('Runbook Notes').fill('Use the seeded storage alert follow-through to rehearse recovery evidence on Tuesday, August 25, 2026.');
  await page.getByRole('button', { name: 'Create Remediation Template' }).click();
  await expect.poll(() => fixtures.remediationTemplates[0]?.name || '').toBe('Storage Capacity Review Template');
  await expect(page.getByText('Launch: launch recovery drill handoff · Guard: daily per object')).toBeVisible();
  await page.locator('.data-table').getByText('Storage nearing threshold', { exact: true }).click();
  await expect(page.getByText('Recommended Templates')).toBeVisible();
  await page.locator('.stack-item').filter({ hasText: 'Storage Capacity Review Template' }).getByRole('button', { name: 'Launch Recovery Drill' }).click();
  await expect.poll(() => fixtures.tasks[0]?.name_label || '').toBe('Template Capacity Review: Storage nearing threshold');
  await expect.poll(() => fixtures.tasks[0]?.template_launch_mode || '').toBe('resilience-drill');
  await expect(page).toHaveURL(/\/resilience\?/);
  const alertSeededRunbookWindow = page.locator('.floating-window').last();
  await expect(alertSeededRunbookWindow.locator('.fw-title')).toHaveText('Recovery Drill Handoff');
  await expect(alertSeededRunbookWindow.getByText('Execution-first handoff active')).toBeVisible();
  await expect(alertSeededRunbookWindow.getByText('Seeded from remediation task')).toBeVisible();
  await expect(alertSeededRunbookWindow.getByText('Log Recovery Drill')).toBeVisible();
  await page.locator('.floating-window .fw-close').last().click();
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
  await expect(page).toHaveURL(/\/activity/);
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await page.getByRole('button', { name: 'Tasks' }).click();
  await expect(page.getByText('Patch compliance scan')).toBeVisible();
  await expect.poll(() => fixtures.templateDeploymentRuns.find((entry) => entry.vm_name === 'ubuntu-prod-01')?.status || '').toBe('success');
  await expect(page.locator('.data-table').getByText('ubuntu-prod-01', { exact: true })).toBeVisible();
  await page.locator('.data-table').getByText('ubuntu-prod-01', { exact: true }).click();
  await expect(page.getByText('Deployment Context')).toBeVisible();
  await expect(page.getByText('Deployment Steps')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Deployed VM' })).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();
  await page.getByRole('button', { name: 'Recent Changes' }).click();
  await expect(page.getByRole('button', { name: 'Restored template governance' }).first()).toBeVisible();
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
  await expect(page.getByText('Focused VBD Handoff')).toBeVisible();
  await expect(page.getByText('OpaqueRef:vbd1 · 2 disks · 2 attachment paths · 2 workloads · 2 hosts')).toBeVisible();
  await expect(page.getByText('focused attachment')).toBeVisible();
  await page.locator('.stack-item').filter({ hasText: 'focused attachment' }).getByRole('button', { name: 'Open Host' }).click();
  await expect(page).toHaveURL(/\/hosts\?/);
  await expect(page.getByText('Related Host Inventory')).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.locator('.tree-item').filter({ hasText: 'Inventory' }).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await page.getByRole('button', { name: 'VDIs' }).click();
  await page.getByPlaceholder('Search live inventory, alerts, tasks, UUIDs, and tags...').fill('disk-01');
  await expect(page.getByText('disk-01')).toBeVisible();
  await page.locator('.data-table').getByText('disk-01', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Workspace' }).click();
  await expect(page).toHaveURL(/\/storage\?/);
  await expect(page.locator('.floating-window').getByText('Attachment Topology', { exact: true })).toBeVisible();
  await expect(page.getByText('Focused VDI Handoff')).toBeVisible();
  await expect(page.getByText('OpaqueRef:vdi1 · 2 disks · 2 attachment paths · 2 workloads · 2 hosts')).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.locator('.tree-item').filter({ hasText: 'Inventory' }).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await page.getByRole('button', { name: 'VIFs' }).click();
  await page.getByPlaceholder('Search live inventory, alerts, tasks, UUIDs, and tags...').fill('OpaqueRef:vif1');
  await expect(page.getByText('VIF app-01')).toBeVisible();
  await page.locator('.data-table').getByText('VIF app-01', { exact: true }).click();
  await page.getByRole('button', { name: 'Open Workspace' }).click();
  await expect(page).toHaveURL(/\/networking\?/);
  await expect(page.getByText('focused interface', { exact: true })).toBeVisible();
  await page.locator('.stack-item').filter({ hasText: 'focused interface' }).getByRole('button', { name: 'Open VM' }).click();
  await expect(page).toHaveURL(/\/vms\?/);
  await expect(page.getByText('VM Details')).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();

  await page.locator('.tree-item').filter({ hasText: 'Inventory' }).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await page.getByRole('button', { name: 'All' }).click();
  await page.getByPlaceholder('Search live inventory, alerts, tasks, UUIDs, and tags...').fill('alpha');
  await page.locator('.section-head').getByRole('button', { name: /Saved Workspaces/ }).click();
  const savedWorkspacesWindow = page.locator('.floating-window').filter({ hasText: 'Saved Workspaces' }).last();
  await savedWorkspacesWindow.getByPlaceholder('Name this search preset...').fill('Host Alpha');
  await savedWorkspacesWindow.locator('select.form-input').first().selectOption('1');
  await savedWorkspacesWindow.getByRole('button', { name: 'Save Workspace' }).click();
  await expect(savedWorkspacesWindow.getByText('Host Alpha')).toBeVisible();
  await expect(savedWorkspacesWindow.getByText('Target Production Pool')).toBeVisible();
  await savedWorkspacesWindow.getByRole('button', { name: 'Open Target' }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await savedWorkspacesWindow.locator('.stack-item').filter({ hasText: 'Host Alpha' }).getByRole('button', { name: 'Apply' }).click();
  await savedWorkspacesWindow.locator('.fw-close').click();
  await expect(page.locator('.data-table').getByText('alpha-xen-west', { exact: true })).toBeVisible();
  await page.locator('.data-table').getByText('alpha-xen-west', { exact: true }).click();
  await expect(page.getByText('Inventory Result Detail')).toBeVisible();
  await page.getByRole('button', { name: 'Open Workspace' }).click();
  await expect(page).toHaveURL(/\/hosts\?/);
  await expect(page.locator('.floating-window .fw-title').first()).toHaveText('Host Properties');
  await expect(page.locator('.floating-window .property-grid').getByText('10.0.0.11').first()).toBeVisible();
  await page.locator('.floating-window .fw-close').first().click();
  await page.locator('.tree-item').filter({ hasText: 'Inventory' }).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await page.locator('.section-head').getByRole('button', { name: /Connection Atlas/ }).click();
  const connectionAtlasWindow = page.locator('.floating-window').filter({ hasText: 'Connection Atlas' }).last();
  await expect(connectionAtlasWindow.getByText('Saved Targets')).toBeVisible();
  await expect(connectionAtlasWindow.getByText('Top Tags')).toBeVisible();
  await connectionAtlasWindow.locator('.fw-close').click();

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
  await expect(getFloatingWindowByTitle(page, 'Governance Control Panel')).toHaveCount(0);
  await page.locator('.dash-card').filter({ hasText: 'Session Role' }).getByRole('button', { name: /Admin/ }).click();
  await page.locator('.dash-card').filter({ hasText: 'Governance Policy' }).getByRole('button', { name: 'Manage Policy' }).click();
  const governancePolicyWindow = getFloatingWindowByTitle(page, 'Governance Control Panel');
  await governancePolicyWindow.getByLabel('Default Role').selectOption('operator');
  await governancePolicyWindow.getByLabel('Approval Window (minutes)').fill('180');
  await governancePolicyWindow.getByRole('button', { name: 'Save Governance Policy' }).click();
  await governancePolicyWindow.locator('.fw-close').click();
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
  await page.locator('.dash-card').filter({ hasText: 'Compliance Queue' }).getByText('alpha-xen-west', { exact: true }).click();
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
  await expect(page).toHaveURL(/\/capacity/);
  await expect(page.getByRole('heading', { name: 'Capacity' })).toBeVisible();
  await expect(page.getByText('Headroom, saturation, and imbalance before they become incidents.')).toBeVisible();
  await expect(page.getByRole('button', { name: /alpha-xen-west 10\.0\.0\.11/ })).toBeVisible();
  await expect(page.getByText('Top VM Consumers')).toBeVisible();
  await expect(page.getByText('Noisy-Neighbor Candidates')).toBeVisible();
  await expect(page.getByText(/pressure leader/i)).toBeVisible();
  await page.getByRole('button', { name: 'Create Follow-through' }).click();
  await expect(page.getByText('Forecast Follow-through')).toBeVisible();
  await page.locator('.floating-window').last().getByRole('button', { name: 'Create Follow-through' }).click();
  await expect.poll(() => fixtures.tasks[0]?.name_label || '').toContain('Capacity Follow-through');
  await expect(page).toHaveURL(/\/activity/);
  await expect(page.getByRole('button', { name: 'Open Target Workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Launch Maintenance Handoff' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft Lifecycle Plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Target Workspace' }).click();
  await expect(page).toHaveURL(/\/capacity/);
  await expect(page.getByText('Capacity Host Detail')).toBeVisible();
  await expect(page.getByText('Telemetry Guidance')).toBeVisible();
  await page.locator('.floating-window .fw-close').last().click();
  await page.getByRole('button', { name: 'Launch Maintenance Handoff' }).click();
  await expect(page).toHaveURL(/\/lifecycle/);
  const maintenanceHandoffWindow = page.locator('.floating-window').last();
  await expect(maintenanceHandoffWindow.locator('.fw-title')).toHaveText('Maintenance Handoff');
  await expect(maintenanceHandoffWindow.getByText('Execution-first handoff active')).toBeVisible();
  await expect(maintenanceHandoffWindow.getByText('Seeded from remediation task')).toBeVisible();
  await expect(maintenanceHandoffWindow.getByRole('button', { name: 'Save Lifecycle Plan Before Maintenance' })).toBeVisible();
  await maintenanceHandoffWindow.getByRole('button', { name: 'Enter Maintenance Mode' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.maintenance_mode || false).toBe(true);
  await expect.poll(() => fixtures.tasks[0]?.status || '').toBe('in_progress');
  await expect(maintenanceHandoffWindow.getByText('Host is already in maintenance mode')).toBeVisible();
  await maintenanceHandoffWindow.getByRole('button', { name: 'Exit Maintenance Mode' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.maintenance_mode || false).toBe(false);
  await page.locator('.floating-window .fw-close').last().click();
  await page.getByText('Capacity').first().click();
  await expect(page).toHaveURL(/\/capacity/);
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

  fixtures.tasks.unshift({
    ref: 'OpaqueRef:remediation-seed-resilience',
    uuid: 'remediation-task-seed-resilience',
    name_label: 'Capacity Recovery Drill: Production Pool',
    name_description: 'Execute a targeted recovery drill for the primary production pool.',
    status: 'pending',
    progress: 0,
    created: '2026-08-25T13:05:00.000Z',
    finished: '',
    result: 'Queued for operator follow-through.',
    error_info: [],
    resident_on: 'OpaqueRef:pool1',
    task_kind: 'remediation',
    source: 'remediation',
    action_type: 'resilience',
    assignee: 'Recovery Ops',
    due_date: '2026-08-26',
    related_alert_ref: '',
    related_alert_uuid: '',
    related_alert_summary: 'Recovery drill follow-through',
    related_class: 'pool',
    related_object: 'OpaqueRef:pool1',
    target_route: '/resilience',
    workspace_summary: 'Open Resilience and execute a recovery drill for Production Pool.',
    evidence_checklist: ['Validate failover sequencing.', 'Capture drill findings.'],
    completion_criteria: ['Drill outcome is recorded.', 'Next step is documented.'],
    resilience_runbook_seed: {
      enabled: true,
      recoveryTier: 'tier-1',
      haPolicy: 'priority-restart',
      restartPriority: 'high',
      backupWindowHours: 8,
      rpoMinutes: 20,
      rtoMinutes: 60,
      restorePointStatus: 'current',
      owner: 'Recovery Ops',
      standbyHostRef: 'OpaqueRef:host2',
      failoverNetworkRef: 'OpaqueRef:net2',
      runbookSteps: [
        'Confirm backup readiness for Production Pool.',
        'Execute a scoped failover drill and record findings.',
      ],
      notes: 'Seeded from the Tuesday, August 25, 2026 resilience execution handoff test.',
    },
    template_id: '',
    template_name: '',
    template_launch_mode: 'draft',
    recurrence_mode: 'manual',
    recurrence_scope: 'object',
    recurrence_cooldown_days: 0,
    recurrence_window_key: 'opaqueref:pool1',
    created_by: 'root',
    updated_at: '2026-08-25T13:05:00.000Z',
  });

  await page.getByText('Activity').first().click();
  await expect(page).toHaveURL(/\/activity/);
  await page.getByRole('button', { name: 'Tasks' }).click();
  await page.locator('.data-table').getByText('Capacity Recovery Drill: Production Pool', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Launch Recovery Drill Handoff' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Draft Recovery Runbook' })).toBeVisible();
  await page.getByRole('button', { name: 'Launch Recovery Drill Handoff' }).click();
  await expect(page).toHaveURL(/\/resilience/);
  const seededRunbookWindow = page.locator('.floating-window').last();
  await expect(seededRunbookWindow.locator('.fw-title')).toHaveText('Recovery Drill Handoff');
  await expect(seededRunbookWindow.getByText('Execution-first handoff active')).toBeVisible();
  await expect(seededRunbookWindow.getByText('Seeded from remediation task')).toBeVisible();
  await seededRunbookWindow.getByLabel('Drill Type').selectOption('failover');
  await seededRunbookWindow.getByLabel('Outcome').selectOption('success');
  await seededRunbookWindow.getByLabel('Scope').fill('Seeded recovery execution rehearsal');
  await seededRunbookWindow.getByLabel('Executed At').fill('2026-08-25T13:15');
  await seededRunbookWindow.getByLabel('Duration (minutes)').fill('28');
  await seededRunbookWindow.getByLabel('Summary').fill('Seeded recovery drill completed cleanly.');
  await seededRunbookWindow.getByLabel('Findings').fill('Runbook sequencing covered the standby path without operator drift.');
  await seededRunbookWindow.getByLabel('Next Step').fill('Use the same path for the next quarterly validation.');
  await seededRunbookWindow.getByRole('button', { name: 'Log Recovery Drill' }).click();
  await expect.poll(() => fixtures.resilienceDrills[0]?.summary || '').toBe('Seeded recovery drill completed cleanly.');
  await expect.poll(() => fixtures.tasks.find((task) => task.ref === 'OpaqueRef:remediation-seed-resilience')?.status || '').toBe('success');

  fixtures.tasks.unshift({
    ref: 'OpaqueRef:remediation-seed-vm-migration',
    uuid: 'remediation-task-seed-vm-migration',
    name_label: 'Pressure Relief Migration: app-01',
    name_description: 'Move app-01 back onto alpha-xen-west to relieve forecast pressure after the evacuation drill.',
    status: 'pending',
    progress: 0,
    created: '2026-08-25T13:20:00.000Z',
    finished: '',
    result: 'Queued for operator follow-through.',
    error_info: [],
    resident_on: 'OpaqueRef:vm1',
    task_kind: 'remediation',
    source: 'remediation',
    action_type: 'capacity',
    assignee: 'Capacity Ops',
    due_date: '2026-08-26',
    related_alert_ref: '',
    related_alert_uuid: '',
    related_alert_summary: 'VM-attributed forecast pressure',
    related_class: 'vm',
    related_object: 'OpaqueRef:vm1',
    target_route: '/vms',
    workspace_summary: 'Draft a VM migration for app-01 and move it back to alpha-xen-west.',
    evidence_checklist: ['Confirm destination host readiness.', 'Record the placement change.'],
    completion_criteria: ['Migration completes successfully.', 'Task result captures the destination host.'],
    vm_migration_seed: {
      enabled: true,
      mode: 'same-pool',
      hostRef: 'OpaqueRef:host1',
      destinationTargetKey: '',
      transferNetworkRef: '',
      srRef: '',
      vifNetworkMap: [],
      live: true,
      copy: false,
      force: false,
      compress: true,
      setAsHomeServer: true,
      notes: 'Seeded from the Tuesday, August 25, 2026 capacity handoff test.',
    },
    template_id: '',
    template_name: '',
    template_launch_mode: 'draft',
    recurrence_mode: 'manual',
    recurrence_scope: 'object',
    recurrence_cooldown_days: 0,
    recurrence_window_key: 'opaqueref:vm1',
    created_by: 'root',
    updated_at: '2026-08-25T13:20:00.000Z',
  });

  await page.getByText('Activity').first().click();
  await expect(page).toHaveURL(/\/activity/);
  await page.getByRole('button', { name: 'Tasks' }).click();
  await page.locator('.data-table').getByText('Pressure Relief Migration: app-01', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Draft VM Migration' })).toBeVisible();
  await page.getByRole('button', { name: 'Draft VM Migration' }).click();
  await expect(page).toHaveURL(/\/vms/);
  await expect(page.locator('.floating-window .fw-title').first()).toHaveText('VM Details');
  await expect(page.locator('.vm-tab-button.active')).toContainText('Migration');
  await expect(page.getByLabel('Destination Host', { exact: true })).toHaveValue('OpaqueRef:host1');
  await page.getByRole('button', { name: 'Migrate VM' }).click();
  await expect.poll(() => seededVmMigrationSubmitted).toBe(true);
  await expect.poll(() => fixtures.tasks.find((task) => task.ref === 'OpaqueRef:remediation-seed-vm-migration')?.status || '').toBe('success');
  await expect(page.locator('.vm-stat-chips').getByText('alpha-xen-west', { exact: true })).toBeVisible();
});

test('lifecycle workspace supports selected-row maintenance and plan-clear batching', async ({ page }) => {
  const fixtures = await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Lifecycle').first().click();
  await expect(page).toHaveURL(/\/lifecycle$/);

  await page.locator('.dash-card').filter({ hasText: 'Compliance Queue' }).locator('.data-table').getByText('alpha-xen', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Lifecycle Plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Lifecycle Plan' }).click();
  const lifecyclePlanWindow = getFloatingWindowByTitle(page, 'Lifecycle Plan');
  await lifecyclePlanWindow.getByLabel('Target Stage').selectOption('maintenance');
  await lifecyclePlanWindow.getByLabel('Next Action').selectOption('reboot');
  await lifecyclePlanWindow.getByLabel('Maintenance Window').fill('Sun 02:00');
  await lifecyclePlanWindow.getByLabel('Owner').fill('Platform Ops');
  await lifecyclePlanWindow.getByLabel('Evacuate workloads before work begins').evaluate((element) => { element.click(); });
  await lifecyclePlanWindow.getByRole('button', { name: 'Save Lifecycle Plan' }).click();
  await expect.poll(() => fixtures.lifecyclePlans.find((plan) => plan.hostRef === 'OpaqueRef:host1')?.targetStage || '').toBe('maintenance');
  await lifecyclePlanWindow.locator('.fw-close').click();
  await getFloatingWindowByTitle(page, 'Lifecycle Detail').locator('.fw-close').click();

  await page.getByLabel('Select alpha-xen').check();
  await expect(page.getByText('1 lifecycle targets selected')).toBeVisible();
  await expect(page.getByText('1 saved plan · 1 ready for maintenance')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Enter Maintenance Selected (1)' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.maintenance_mode || false).toBe(true);
  await expect(page.getByText('1 selected host entered maintenance mode from the lifecycle queue.')).toBeVisible();
  await expect(page.getByText('1 already in maintenance')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Exit Maintenance Selected (1)' }).click();
  await expect.poll(() => fixtures.hostInventory.find((host) => host.ref === 'OpaqueRef:host1')?.maintenance_mode || false).toBe(false);
  await expect(page.getByText('1 selected host exited maintenance mode from the lifecycle queue.')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Clear Selected Plans (1)' }).click();
  await expect.poll(() => fixtures.lifecyclePlans.find((plan) => plan.hostRef === 'OpaqueRef:host1') || null).toBeNull();
  await expect(page.getByText('1 selected lifecycle plan was cleared from the maintenance planner queue.')).toBeVisible();
});

test('settings workspace saves runtime configuration and previews retention', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Settings').first().click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText('Configuration Plane')).toBeVisible();
  await expect(page.getByText('Production Pool Root')).toBeVisible();
  await expect(page.getByText('Environment Variable')).toBeVisible();
  await expect(page.getByText('1 stale wrap(s)')).toBeVisible();
  await expect(page.locator('.dash-card-label').filter({ hasText: 'Telemetry Collection' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Re-wrap Legacy Keys' }).first().click();
  await expect(page.getByText('1 stale credential wrap(s) were re-wrapped under the current master key. 1 credential(s) were already current.')).toBeVisible();

  await page.getByLabel('Application Name').fill('XenMange Ops');
  await page.getByRole('button', { name: 'Save General Settings' }).click();
  await expect(page.getByText('XenMange Ops')).toBeVisible();

  await page.getByLabel('Collection Interval (seconds)').fill('180');
  await page.getByRole('button', { name: 'Save Telemetry Settings' }).click();
  await expect(page.getByText('Polling every 180 second(s) across live Xen targets while the server is running.')).toBeVisible();

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

test('settings credential table keeps first and trailing action columns sticky', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await signInAndConnectDefaultTarget(page);

  await page.getByText('Settings').first().click();
  await expect(page).toHaveURL(/\/settings$/);

  const credentialTable = page.locator('.dash-card').filter({ hasText: 'Saved Credentials' }).locator('.data-table').first();
  const firstHeader = credentialTable.locator('thead th').nth(0);
  const actionHeader = credentialTable.locator('thead th').last();
  const firstCell = credentialTable.locator('tbody tr').first().locator('td').nth(0);
  const actionCell = credentialTable.locator('tbody tr').first().locator('td').last();

  await expect(firstHeader).toHaveClass(/data-table-sticky-start/);
  await expect(actionHeader).toHaveClass(/data-table-sticky-end/);
  await expect(firstCell).toHaveClass(/data-table-sticky-start/);
  await expect(actionCell).toHaveClass(/data-table-sticky-end/);

  await expect(firstHeader.evaluate((element) => window.getComputedStyle(element).position)).resolves.toBe('sticky');
  await expect(actionHeader.evaluate((element) => window.getComputedStyle(element).position)).resolves.toBe('sticky');
});
