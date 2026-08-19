const { test, expect } = require('@playwright/test');

async function stubAuthenticatedRoutes(page) {
  await page.route('**/api/connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Production Pool', host: '10.0.0.1', username: 'root', port: 443, is_default: 1 },
      ]),
    });
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
            enabled: true,
            resident_VMs: ['OpaqueRef:vm1'],
          },
          {
            ref: 'OpaqueRef:host2',
            name_label: 'beta-xen',
            address: '10.0.0.12',
            uuid: 'host-uuid-2',
            enabled: true,
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
          { ref: 'OpaqueRef:vdi1', name_label: 'disk-01', virtual_size: 10737418240, type: 'user', managed: true },
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
  await stubAuthenticatedRoutes(page);

  await page.route('**/api/vms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        total: 1,
        data: [
          {
            ref: 'OpaqueRef:vm1',
            name_label: 'app-01',
            power_state: 'Running',
            VCPUs_at_startup: 4,
            memory_static_max: 8589934592,
            uuid: 'vm-uuid-1',
            tags: ['prod'],
          },
        ],
      }),
    });
  });

  await page.route('**/api/vms/shutdown', async (route) => {
    shutdownCalled = true;
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

  await expect(page.getByText('VM Properties')).toBeVisible();
  await page.getByRole('button', { name: 'Shutdown' }).click();

  await expect.poll(() => shutdownCalled).toBe(true);
});

test('templates, alerts, lifecycle, capacity, and resilience workbenches render after login', async ({ page }) => {
  await stubAuthenticatedRoutes(page);

  await page.goto('/');
  await page.getByLabel('Host Address').fill('10.0.0.1');
  await page.getByLabel('Username').fill('root');
  await page.getByLabel('Password').fill('secret');
  await page.getByRole('button', { name: 'Initialize Connection' }).click();

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
