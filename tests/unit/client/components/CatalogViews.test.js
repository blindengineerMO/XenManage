const applicationsPath = '../../../../client/assets/js/views/ApplicationsView';
const catalogPath = '../../../../client/assets/js/views/CatalogView';

describe('catalog client views', () => {
  let api;
  let ApplicationsView;
  let CatalogView;

  beforeEach(() => {
    jest.resetModules();
    api = {
      createCatalogEntry: jest.fn().mockResolvedValue({}),
      submitCatalogRequest: jest.fn().mockResolvedValue({}),
      getMyCatalogRequests: jest.fn().mockResolvedValue({ requests: [] }),
      deleteCatalogEntry: jest.fn().mockResolvedValue({}),
    };
    global.FloatingWindow = {};
    global.ConfirmWindow = {};
    global.store = { authenticated: true };
    global.api = api;
    ApplicationsView = require(applicationsPath);
    CatalogView = require(catalogPath);
  });

  afterEach(() => {
    delete global.FloatingWindow;
    delete global.ConfirmWindow;
    delete global.store;
    delete global.api;
  });

  it('prepares subscriber defaults and estimates monthly catalog cost', () => {
    const vm = {
      selectedEntry: null,
      requestParameters: {},
      successMessage: 'old',
    };
    const entry = {
      subscriberFields: [
        { key: 'environment', type: 'select', default: 'dev' },
        { key: 'backup', type: 'boolean' },
        { key: 'owner', type: 'text' },
      ],
      costBasis: { vcpus: 2, memoryGiB: 4, diskGiB: 20 },
      costRates: { perVcpu: 5, perGiBRam: 2, perGiBDisk: 0.1 },
    };

    CatalogView.methods.selectEntry.call(vm, entry);

    expect(vm.requestParameters).toEqual({ environment: 'dev', backup: false, owner: '' });
    expect(CatalogView.computed.selectedEstimate.call(vm)).toBe(20);
  });

  it('redirects anonymous requests and submits authenticated requests', async () => {
    const router = { push: jest.fn() };
    const anonymousVm = { $router: router };
    global.store.authenticated = false;

    await CatalogView.methods.submitRequest.call(anonymousVm);
    expect(router.push).toHaveBeenCalledWith('/login');
    expect(api.submitCatalogRequest).not.toHaveBeenCalled();

    global.store.authenticated = true;
    const vm = {
      $router: router,
      selectedEntry: { slug: 'linux-builder', title: 'Linux Builder' },
      requestParameters: { environment: 'prod' },
      submitting: false,
      errorMessage: '',
      successMessage: '',
      loadRequests: jest.fn().mockResolvedValue(),
    };
    await CatalogView.methods.submitRequest.call(vm);

    expect(api.submitCatalogRequest).toHaveBeenCalledWith('linux-builder', { environment: 'prod' });
    expect(vm.successMessage).toBe('Linux Builder request submitted.');
    expect(vm.selectedEntry).toBeNull();
    expect(vm.submitting).toBe(false);
  });

  it('filters webhook credentials and counts only pending review requests', () => {
    const vm = {
      requests: [{ status: 'pending' }, { status: 'approved' }, { status: 'pending' }],
      credentials: [
        { id: 1, targetType: 'webhook', scope: 'shared' },
        { id: 2, targetType: 'pool', scope: 'shared' },
        { id: 3, targetType: 'webhook', scope: 'private' },
      ],
    };

    expect(ApplicationsView.computed.pendingRequestCount.call(vm)).toBe(2);
    expect(ApplicationsView.computed.webhookCredentials.call(vm).map(item => item.id)).toEqual([1]);
  });

  it('builds the webhook approval payload from curator form values', async () => {
    const vm = {
      draft: {
        ...ApplicationsView.methods.emptyDraft(),
        title: 'Linux Builder',
        slug: 'linux-builder',
        sourceItemId: 7,
        approvalMode: 'webhook',
        approvalWebhookUrl: 'https://approvals.example.test/review',
        approvalCredentialId: 9,
        costPerVcpu: 4,
        fixedVariablesJson: '{"templateRef":"OpaqueRef:template"}',
        subscriberFieldsJson: '[{"key":"environment","type":"select"}]',
        targetPoolRefsJson: '["OpaqueRef:pool"]',
      },
      editingId: null,
      saving: false,
      errorMessage: '',
      successMessage: '',
      closeEditor: jest.fn(),
      load: jest.fn().mockResolvedValue(),
    };

    await ApplicationsView.methods.saveEntry.call(vm);

    expect(api.createCatalogEntry).toHaveBeenCalledWith(expect.objectContaining({
      approvalPolicy: {
        mode: 'webhook',
        url: 'https://approvals.example.test/review',
        credentialId: 9,
      },
      costRates: { perVcpu: 4 },
      fixedVariables: { templateRef: 'OpaqueRef:template' },
      subscriberFields: [{ key: 'environment', type: 'select' }],
      targetPoolRefs: ['OpaqueRef:pool'],
    }));
    expect(vm.successMessage).toBe('Linux Builder was added to the catalog.');
    expect(vm.saving).toBe(false);
  });

  it('keeps a manually edited slug while continuing to update generated slugs', () => {
    const vm = { draft: { title: 'Linux Builder', slug: '' }, lastGeneratedSlug: '' };
    ApplicationsView.methods.syncSlug.call(vm);
    expect(vm.draft.slug).toBe('linux-builder');

    vm.draft.title = 'Linux Builder Pro';
    ApplicationsView.methods.syncSlug.call(vm);
    expect(vm.draft.slug).toBe('linux-builder-pro');

    vm.draft.slug = 'custom-slug';
    vm.draft.title = 'Ignored Title';
    ApplicationsView.methods.syncSlug.call(vm);
    expect(vm.draft.slug).toBe('custom-slug');
  });

  it('retires an application only after the confirmation dialog is confirmed, not on the initial click', async () => {
    const vm = {
      entryPendingRetire: null,
      successMessage: '',
      errorMessage: '',
      load: jest.fn().mockResolvedValue(undefined),
    };
    const entry = { id: 42, title: 'Linux Builder' };

    ApplicationsView.methods.deleteEntry.call(vm, entry);
    expect(vm.entryPendingRetire).toBe(entry);
    expect(api.deleteCatalogEntry).not.toHaveBeenCalled();

    await ApplicationsView.methods.confirmDeleteEntry.call(vm);
    expect(api.deleteCatalogEntry).toHaveBeenCalledWith(42);
    expect(vm.entryPendingRetire).toBeNull();
    expect(vm.successMessage).toBe('Linux Builder was retired.');
    expect(vm.load).toHaveBeenCalled();
  });
});
