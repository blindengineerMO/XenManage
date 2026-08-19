const { test, expect } = require('@playwright/test');

async function stubAuthenticatedRoutes(page) {
  const connections = [
    { id: 1, name: 'Production Pool', host: '10.0.0.1', username: 'root', port: 443, is_default: 1 },
  ];
  const hostTargets = [
    { id: 1, name: 'branch-host-r4', host: '10.0.0.25', username: 'root', port: 443, mode: 'standalone', pool_connection_id: null, pool_name: null, notes: '' },
  ];

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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    if (method === 'DELETE') {
      const index = connections.findIndex((connection) => connection.id === id);
      if (index !== -1) connections.splice(index, 1);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (method === 'POST' && url.pathname.endsWith('/default')) {
      connections.forEach((connection) => { connection.is_default = connection.id === id ? 1 : 0; });
      const record = connections.find((connection) => connection.id === id);
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(record),
      });
      return;
    }

    if (method === 'DELETE') {
      const index = hostTargets.findIndex((target) => target.id === id);
      if (index !== -1) hostTargets.splice(index, 1);
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, host: '10.0.0.1', username: 'root' }),
    });
  });

  await page.route('**/api/dashboard/messages', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { ref: 'OpaqueRef:msg1', name: 'Storage nearing threshold', timestamp: '2026-08-19T12:00:00.000Z' },
      ]),
    });
  });

  await page.route('**/api/tasks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 2,
        data: [
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
        ],
      }),
    });
  });

  await page.route('**/api/resilience', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-08-19T12:15:00.000Z',
        summary: {
          protectedVmCount: 1,
          atRiskVmCount: 1,
          maintenanceHostCount: 0,
          recoveryPlanCount: 1,
          recentEventCount: 3,
        },
        protectionPolicies: [
          {
            ref: 'OpaqueRef:vm1',
            name_label: 'app-01',
            power_state: 'Running',
            policy: 'Tier-1',
            status: 'warning',
            lastProtectedAt: '2026-08-19T10:15:00.000Z',
            lastTaskLabel: 'Backup verify app-01',
            lastAlertLabel: 'Replication lag warning',
            recommendation: 'Confirm backup freshness before the next change window.',
            tags: ['prod'],
            uuid: 'vm-uuid-1',
          },
        ],
        hostPlans: [
          {
            ref: 'OpaqueRef:host1',
            name_label: 'alpha-xen',
            address: '10.0.0.11',
            status: 'success',
            evacuationTarget: 'beta-xen',
            residentVmCount: 1,
            recentTask: 'Recovery drill Production Pool',
            recentAlert: 'No recent host alert',
            summary: 'Failover posture looks healthy.',
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
            nextAction: 'Prioritize backup verification and restore testing.',
            uuid: 'pool-uuid-1',
          },
        ],
        recentEvents: [
          {
            type: 'alert',
            ref: 'OpaqueRef:msg-r1',
            label: 'Replication lag warning',
            status: 'critical',
            timestamp: '2026-08-19T12:12:00.000Z',
            detail: 'app-01 missed its last protection target.',
          },
        ],
      }),
    });
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 2,
        data: [
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
        ],
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

  await page.route('**/api/vms/templates', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        data: [
          {
            ref: 'OpaqueRef:template1',
            name_label: 'ubuntu-golden',
            VCPUs_at_startup: 2,
            memory_static_max: 4294967296,
            uuid: 'template-uuid-1',
            is_a_template: true,
            tags: ['golden'],
          },
        ],
      }),
    });
  });

  await page.route('**/api/storage', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        data: [
          {
            ref: 'OpaqueRef:sr1',
            name_label: 'Primary SR',
            type: 'lvm',
            physical_size: 32212254720,
            virtual_allocation: 21474836480,
            uuid: 'sr-uuid-1',
            PBDs: ['OpaqueRef:pbd1'],
          },
        ],
      }),
    });
  });

  await page.route('**/api/storage/OpaqueRef%3Asr1/vdis', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        data: [
          { ref: 'OpaqueRef:vdi1', SR: 'OpaqueRef:sr1', name_label: 'disk-01', virtual_size: 10737418240, type: 'user', managed: true, VBDs: ['OpaqueRef:vbd1'] },
        ],
      }),
    });
  });

  await page.route('**/api/networks', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        data: [
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
        ],
      }),
    });
  });
}

test('login shell renders saved targets from the local API', async ({ page }) => {
  await page.route('**/api/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Production Pool', host: '10.0.0.1', username: 'root', port: 443, is_default: 1 },
      ]),
    });
  });

  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'XenMange' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Production Pool/ })).toBeVisible();
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

  await page.getByLabel('Host Address').fill('10.0.0.1');
  await page.getByLabel('Username').fill('root');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Initialize Connection' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('.dash-card-label').filter({ hasText: 'Virtual Machines' })).toBeVisible();
  await expect(page.getByText('Storage nearing threshold')).toBeVisible();
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
  await stubAuthenticatedRoutes(page);

  await page.goto('/');
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

  await page.getByText('Templates').first().click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
  await expect(page.getByText('ubuntu-golden')).toBeVisible();

  await page.getByText('Alerts').first().click();
  await expect(page).toHaveURL(/\/alerts$/);
  await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();
  await expect(page.getByText('Storage nearing threshold')).toBeVisible();

  await page.getByText('Activity').first().click();
  await expect(page).toHaveURL(/\/activity$/);
  await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
  await expect(page.getByText('Patch compliance scan')).toBeVisible();

  await page.locator('.tree-item').filter({ hasText: 'Inventory' }).first().click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await page.getByPlaceholder('Search live inventory, alerts, tasks, UUIDs, and tags...').fill('alpha');
  await page.getByPlaceholder('Name this search preset...').fill('Host Alpha');
  await page.getByRole('button', { name: 'Save Workspace' }).click();
  await expect(page.getByText('Host Alpha')).toBeVisible();

  await page.getByText('Lifecycle').first().click();
  await expect(page).toHaveURL(/\/lifecycle$/);
  await expect(page.getByRole('heading', { name: 'Lifecycle' })).toBeVisible();
  await expect(page.getByText('Compliance posture, maintenance prep, and drift review in one queue.')).toBeVisible();

  await page.getByText('Capacity').first().click();
  await expect(page).toHaveURL(/\/capacity$/);
  await expect(page.getByRole('heading', { name: 'Capacity' })).toBeVisible();
  await expect(page.getByText('Headroom, saturation, and imbalance before they become incidents.')).toBeVisible();
  await expect(page.getByText('alpha-xen')).toBeVisible();

  await page.getByText('Resilience').first().click();
  await expect(page).toHaveURL(/\/resilience$/);
  await expect(page.getByRole('heading', { name: 'Resilience' })).toBeVisible();
  await expect(page.getByText('Protection coverage, failover posture, and recovery-planning visibility inspired by Prism and Proxmox-style operator workflows.')).toBeVisible();
  await expect(page.getByRole('button', { name: /app-01/ })).toBeVisible();
});
