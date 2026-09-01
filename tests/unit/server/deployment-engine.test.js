const { planCompose, executeCompose } = require('../../../server/services/deployment-engine');
const { schemas } = require('../../../server/middleware/validate');
const { deploymentRunModel } = require('../../../server/models/connection');

function buildXenApi() {
  return {
    getVmCreationSources: jest.fn().mockResolvedValue({
      operatingSystems: [{ ref: 'OpaqueRef:os-profile', name_label: 'Ubuntu Server 24.04 LTS' }],
      deployableTemplates: [{ ref: 'OpaqueRef:golden', uuid: 'golden-uuid', name_label: 'ubuntu-24-golden' }],
    }),
    getAllRecords: jest.fn(async (className) => ({
      network: {
        'OpaqueRef:network': { uuid: 'network-uuid', name_label: 'VMLAN Production' },
      },
      SR: {
        'OpaqueRef:sr': { uuid: 'sr-uuid', name_label: 'Tier-1 SSD SR' },
      },
      host: {
        'OpaqueRef:host': { uuid: 'host-uuid', name_label: 'xen-host-a01' },
      },
    }[className] || {})),
    getHosts: jest.fn().mockResolvedValue({
      records: { 'OpaqueRef:host': { name_label: 'xen-host-a01', pool: 'OpaqueRef:pool' } },
    }),
    getVMs: jest.fn().mockResolvedValue({ records: {} }),
  };
}

function buildSpec(overrides = {}) {
  return {
    name: 'web-tier',
    startAfter: true,
    vms: {
      app: {
        template: 'ubuntu-24-golden',
        nameLabel: 'web-01',
        memoryStaticMax: 4294967296,
        memoryDynamicMin: 2147483648,
        memoryDynamicMax: 4294967296,
        vcpusAtStartup: 2,
        vcpusMax: 4,
        affinity: 'xen-host-a01',
        disks: [{ sr: 'Tier-1 SSD SR', sizeGb: 40, nameLabel: 'web-01-data' }],
        networkInterfaces: [{ network: 'VMLAN Production', mac: '02:16:3e:10:00:01' }],
      },
    },
    ...overrides,
  };
}

describe('Compose deployment planning', () => {
  it('accepts only deployable templates and builds data disk and automatic VIF plans', async () => {
    const plan = await planCompose(buildXenApi(), buildSpec());

    expect(plan.plans).toEqual([expect.objectContaining({
      templateRef: 'OpaqueRef:golden',
      affinityRef: 'OpaqueRef:host',
      disks: [expect.objectContaining({ srRef: 'OpaqueRef:sr', nameLabel: 'web-01-data' })],
      networkInterfaces: [expect.objectContaining({ networkRef: 'OpaqueRef:network', mac: '02:16:3e:10:00:01' })],
    })]);
  });

  it('rejects an operating-system profile before any deployment mutation', async () => {
    await expect(planCompose(buildXenApi(), buildSpec({
      vms: { app: { ...buildSpec().vms.app, template: 'Ubuntu Server 24.04 LTS' } },
    }))).rejects.toMatchObject({ code: 'COMPOSE_TEMPLATE_NOT_DEPLOYABLE' });
  });

  it('rejects invalid compute topology', async () => {
    await expect(planCompose(buildXenApi(), buildSpec({
      vms: { app: { ...buildSpec().vms.app, memoryDynamicMax: 8589934592 } },
    }))).rejects.toMatchObject({ code: 'COMPOSE_INVALID_MEMORY_TOPOLOGY' });
  });

  it('rejects legacy disk and manually assigned VIF device fields', () => {
    const { error } = schemas.composeDeploy.validate(buildSpec({
      vms: {
        app: {
          ...buildSpec().vms.app,
          disks: [{ sr: 'Tier-1 SSD SR', sizeGb: 40, bootable: true }],
          networkInterfaces: [{ network: 'VMLAN Production', device: '0' }],
        },
      },
    }), { abortEarly: false, stripUnknown: true });

    expect(error).toBeDefined();
    expect(error.details.map((detail) => detail.path.join('.'))).toEqual(expect.arrayContaining([
      'vms.app.disks.0.bootable',
      'vms.app.networkInterfaces.0.device',
    ]));
  });

  it('executes through the safe golden-template deployment primitive', async () => {
    const xenApi = {
      ...buildXenApi(),
      deployComposeVM: jest.fn().mockResolvedValue({ ref: 'OpaqueRef:web-01', name_label: 'web-01' }),
    };
    const createSpy = jest.spyOn(deploymentRunModel, 'create').mockReturnValue({ id: 'compose-run-1' });

    const result = await executeCompose(xenApi, buildSpec(), { submittedBy: 'operator@example.test' });

    expect(xenApi.deployComposeVM).toHaveBeenCalledWith('OpaqueRef:golden', expect.objectContaining({
      nameLabel: 'web-01',
      affinity: 'OpaqueRef:host',
      disks: [expect.objectContaining({ srRef: 'OpaqueRef:sr', nameLabel: 'web-01-data' })],
      networkInterfaces: [expect.objectContaining({ networkRef: 'OpaqueRef:network', mac: '02:16:3e:10:00:01' })],
    }));
    expect(createSpy).toHaveBeenCalled();
    expect(result.failed).toBe(false);
    expect(result.steps).toEqual([expect.objectContaining({ status: 'success', ref: 'OpaqueRef:web-01' })]);
  });
});
