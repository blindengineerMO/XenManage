const { buildDemoRemediationTask, buildDemoRemediationTemplate, normalizeDemoVmMigrationSeed } = require('../../../../client/assets/js/core/demo-remediation.js');

beforeAll(() => {
  global.store = { username: 'demo-operator' };
  global.nextDemoOpaqueRef = (prefix) => `OpaqueRef:${prefix}-demo-1`;
});

afterAll(() => {
  delete global.store;
  delete global.nextDemoOpaqueRef;
});

describe('normalizeDemoVmMigrationSeed', () => {
  it('returns null when disabled and no prior seed exists', () => {
    expect(normalizeDemoVmMigrationSeed({}, null)).toBeNull();
  });

  it('normalizes an enabled seed with defaults filled in', () => {
    const seed = normalizeDemoVmMigrationSeed({ enabled: true, hostRef: 'OpaqueRef:host-1' }, null);
    expect(seed.enabled).toBe(true);
    expect(seed.mode).toBe('same-pool');
    expect(seed.hostRef).toBe('OpaqueRef:host-1');
    expect(seed.live).toBe(true);
    expect(seed.compress).toBe(true);
    expect(seed.copy).toBe(false);
  });

  it('falls back to prior seed values when the incoming source omits them', () => {
    const current = { enabled: true, mode: 'cross-pool', srRef: 'OpaqueRef:sr-1' };
    const seed = normalizeDemoVmMigrationSeed({}, current);
    expect(seed.mode).toBe('cross-pool');
    expect(seed.srRef).toBe('OpaqueRef:sr-1');
  });
});

describe('buildDemoRemediationTask vm migration seed', () => {
  it('carries a normalized vm_migration_seed through onto the demo task', () => {
    const task = buildDemoRemediationTask({
      nameLabel: 'Migrate billing-api-01',
      vmMigrationSeed: { enabled: true, mode: 'cross-pool', destinationTargetKey: 'pool-b' },
    });
    expect(task.vm_migration_seed).toEqual(expect.objectContaining({
      enabled: true,
      mode: 'cross-pool',
      destinationTargetKey: 'pool-b',
    }));
  });

  it('leaves vm_migration_seed null when no seed is provided', () => {
    const task = buildDemoRemediationTask({ nameLabel: 'Review alert' });
    expect(task.vm_migration_seed).toBeNull();
  });
});

describe('buildDemoRemediationTemplate vm migration seed', () => {
  it('carries a normalized vmMigrationSeed through onto the demo template', () => {
    const template = buildDemoRemediationTemplate({
      name: 'Migrate on capacity alert',
      vmMigrationSeed: { enabled: true, hostRef: 'OpaqueRef:host-2' },
    }, {});
    expect(template.vmMigrationSeed).toEqual(expect.objectContaining({
      enabled: true,
      hostRef: 'OpaqueRef:host-2',
    }));
  });

  it('preserves an existing vmMigrationSeed across an update that omits it', () => {
    const current = { vmMigrationSeed: { enabled: true, mode: 'cross-pool' } };
    const template = buildDemoRemediationTemplate({ name: 'Updated name' }, current);
    expect(template.vmMigrationSeed.mode).toBe('cross-pool');
  });
});
