const {
  renderGeneratedName,
  validateNamingPattern,
  normalizeSubscriberFields,
  validateRequestParameters,
  normalizeApprovalPolicy,
  normalizeLeaseDuration,
  normalizeCostRates,
  estimateCatalogCost,
} = require('../../../server/services/catalog');
const {
  buildCatalogComposeDeployment,
  buildCatalogGuestScriptDeployment,
} = require('../../../server/services/catalog-deployment');
const { enforcePoolQuota } = require('../../../server/services/pool-quota');
const governanceService = require('../../../server/services/governance');

describe('Catalog naming', () => {
  it('validates one placeholder run and renders zero-padded names', () => {
    expect(validateNamingPattern('WEB-XXXX')).toBe('WEB-XXXX');
    expect(renderGeneratedName('WEB-XXXX', 7)).toBe('WEB-0007');
    expect(renderGeneratedName('DB-XX-prod', 12)).toBe('DB-12-prod');
  });

  it('rejects missing or multiple placeholder runs', () => {
    expect(() => validateNamingPattern('WEB-01')).toThrow('exactly one contiguous run');
    expect(() => validateNamingPattern('WEB-XX-DB-XX')).toThrow('exactly one contiguous run');
  });

  it('normalizes field definitions and resolves defaults', () => {
    const fields = normalizeSubscriberFields([{ key: 'size', type: 'select', options: ['small', 'large'], default: 'small' }]);
    expect(validateRequestParameters(fields, {})).toEqual({ size: 'small' });
    expect(() => validateRequestParameters(fields, { pool: 'unexpected' })).toThrow('not available');
  });

  it('normalizes named multi-step approval chains and rejects invalid chains', () => {
    expect(normalizeApprovalPolicy({
      mode: 'multi-step',
      steps: ['Infrastructure review', 'Security review'],
    })).toEqual({ mode: 'multi-step', steps: ['Infrastructure review', 'Security review'] });
    expect(() => normalizeApprovalPolicy({ mode: 'multi-step', steps: ['Only one'] })).toThrow('CATALOG_APPROVAL_POLICY_INVALID');
    expect(() => normalizeApprovalPolicy({ mode: 'multi-step', steps: ['Review', 'review'] })).toThrow('CATALOG_APPROVAL_POLICY_INVALID');
  });

  it('normalizes optional lease durations and rejects unsafe ranges', () => {
    expect(normalizeLeaseDuration('168')).toBe(168);
    expect(normalizeLeaseDuration('')).toBeNull();
    expect(() => normalizeLeaseDuration(0)).toThrow('whole number');
    expect(() => normalizeLeaseDuration(1.5)).toThrow('whole number');
    expect(() => normalizeLeaseDuration(87601)).toThrow('whole number');
  });

  it('estimates monthly catalog cost from protected and subscriber resources', () => {
    const costRates = normalizeCostRates({ perVcpu: '12', perGiBRam: 4, perGiBDisk: 0.15 });
    expect(estimateCatalogCost({
      costRates,
      fixedVariables: { vcpus: 2, memoryStaticMax: 4 * 1024 ** 3 },
    }, { diskSizeGb: 40 })).toEqual({
      monthlyCost: 46,
      currency: 'USD',
      resources: { vcpus: 2, memoryGiB: 4, diskGiB: 40 },
    });
    expect(() => normalizeCostRates({ perVcpu: -1 })).toThrow('CATALOG_COST_RATES_INVALID');
  });

  it('builds a compose deployment with protected generated naming', () => {
    const spec = buildCatalogComposeDeployment(
      { title: 'Web tier', fixedVariables: { network: 'Production' } },
      { generated_name: 'WEB-0007', parameters_json: JSON.stringify({ environment: 'prod' }) },
      { kind: 'snippet', content: JSON.stringify({ name: 'web', variables: {}, vms: { app: { nameLabel: '${catalogName}', template: 'golden' } } }) }
    );

    expect(spec.name).toBe('Web tier WEB-0007');
    expect(spec.variables).toEqual({ network: 'Production', environment: 'prod', catalogName: 'WEB-0007' });
    expect(() => buildCatalogComposeDeployment(
      { title: 'Web tier' },
      { generated_name: 'WEB-0007', parameters_json: '{}' },
      { kind: 'snippet', content: JSON.stringify({ vms: { app: { nameLabel: 'web-01' } } }) }
    )).toThrow('must use the ${catalogName} variable');
  });

  it('builds cloud-init guest-script metadata before template deployment', () => {
    const deployment = buildCatalogGuestScriptDeployment(
      { fixedVariables: { templateRef: 'OpaqueRef:template1', vcpus: 2, memoryStaticMax: 4294967296 } },
      { generated_name: 'WEB-0008', parameters_json: JSON.stringify({ environment: 'production' }) },
      { kind: 'guest-script', content: '#cloud-config\nruncmd:\n  - echo ${catalogName}-${environment}\n' }
    );

    expect(deployment.templateRef).toBe('OpaqueRef:template1');
    expect(deployment.payload).toEqual(expect.objectContaining({
      nameLabel: 'WEB-0008',
      xenstoreData: { 'vm-data': '#cloud-config\nruncmd:\n  - echo WEB-0008-production\n' },
    }));
    expect(() => buildCatalogGuestScriptDeployment(
      { fixedVariables: { templateRef: 'OpaqueRef:template1', vcpus: 2, memoryStaticMax: 4294967296 } },
      { generated_name: 'WEB-0008', parameters_json: '{}' },
      { kind: 'guest-script', content: '#cloud-config\nruncmd:\n  - echo ${missing}\n' }
    )).toThrow('unknown variable');
  });

  it('routes an unpinned catalog deployment to an eligible pool with quota capacity', async () => {
    jest.spyOn(governanceService, 'getQuota').mockImplementation((poolRef) => ({
      enabled: true,
      maxVmCount: poolRef === 'OpaqueRef:pool-a' ? 1 : 10,
      maxRunningVmCount: 0,
      maxTotalMemoryGiB: 0,
    }));
    const xenApi = {
      getPools: jest.fn().mockResolvedValue({ records: { 'OpaqueRef:pool-a': {}, 'OpaqueRef:pool-b': {} } }),
      getHosts: jest.fn().mockResolvedValue({ records: { 'OpaqueRef:host-a': { pool: 'OpaqueRef:pool-a' }, 'OpaqueRef:host-b': { pool: 'OpaqueRef:pool-b' } } }),
      getVMs: jest.fn().mockResolvedValue({ records: { 'OpaqueRef:vm-a': { resident_on: 'OpaqueRef:host-a' } } }),
    };
    const requestedVm = { startAfter: true, memoryStaticMax: 1024 ** 3 };

    const result = await enforcePoolQuota(xenApi, requestedVm, { requireResolvedTarget: true, autoSelect: true });

    expect(result).toEqual(expect.objectContaining({ selectedPoolRef: 'OpaqueRef:pool-b', selectedHostRef: 'OpaqueRef:host-b' }));
    expect(requestedVm.hostRef).toBe('OpaqueRef:host-b');
    governanceService.getQuota.mockRestore();
  });

  it('fails closed when no eligible pool can accept an unpinned deployment', async () => {
    jest.spyOn(governanceService, 'getQuota').mockReturnValue({ enabled: true, maxVmCount: 1, maxRunningVmCount: 0, maxTotalMemoryGiB: 0 });
    const xenApi = {
      getPools: jest.fn().mockResolvedValue({ records: { 'OpaqueRef:pool-a': {} } }),
      getHosts: jest.fn().mockResolvedValue({ records: { 'OpaqueRef:host-a': { pool: 'OpaqueRef:pool-a' } } }),
      getVMs: jest.fn().mockResolvedValue({ records: { 'OpaqueRef:vm-a': { resident_on: 'OpaqueRef:host-a' } } }),
    };

    await expect(enforcePoolQuota(xenApi, {}, { requireResolvedTarget: true, autoSelect: true }))
      .rejects.toMatchObject({ code: 'POOL_QUOTA_NO_ELIGIBLE_TARGET', status: 409 });
    governanceService.getQuota.mockRestore();
  });
});
