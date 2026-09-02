const TemplateCreateForm = require('../../../../client/assets/js/components/forms/TemplateCreateForm');

describe('TemplateCreateForm operating-system sources', () => {
  const sharedSourceRef = 'OpaqueRef:other-install-media';
  const operatingSystems = [
    { profileId: 'windows-server-2003', sourceRef: sharedSourceRef, name_label: 'Windows Server 2003' },
    { profileId: 'debian-12', sourceRef: sharedSourceRef, name_label: 'Debian 12' },
  ];

  function createVm(selectedProfileId) {
    const emitted = [];
    const vm = {
      kind: 'operating-system',
      operatingSystems,
      virtualMachines: [],
      tagsInput: 'custom, approved',
      draft: {
        sourceRef: selectedProfileId,
        nameLabel: 'custom-os-profile',
        nameDescription: 'Custom installation baseline',
      },
      $emit: (...args) => emitted.push(args),
    };
    vm.isOperatingSystem = TemplateCreateForm.computed.isOperatingSystem.call(vm);
    vm.sources = TemplateCreateForm.computed.sources.call(vm);
    vm.selectedSource = TemplateCreateForm.computed.selectedSource.call(vm);
    vm.canSubmit = TemplateCreateForm.computed.canSubmit.call(vm);
    return { vm, emitted };
  }

  it('keeps bundled choices distinct while resolving the clone to its Xen source', () => {
    const { vm, emitted } = createVm('debian-12');

    expect(vm.selectedSource.name_label).toBe('Debian 12');
    TemplateCreateForm.methods.submit.call(vm);

    expect(emitted).toEqual([['submit', expect.objectContaining({
      kind: 'operating-system',
      sourceRef: sharedSourceRef,
      operatingSystemProfileId: 'debian-12',
      nameLabel: 'custom-os-profile',
      tags: ['custom', 'approved'],
    })]]);
  });
});
