const DEMO_BUNDLED_OS_PROFILES = [
  ['windows-server-2003', 'Windows Server 2003', 'bios', 32, 2, 1],
  ['windows-server-2008-r2', 'Windows Server 2008 R2', 'bios', 40, 2, 2],
  ['windows-server-2012-r2', 'Windows Server 2012 R2', 'bios', 60, 4, 2],
  ['windows-server-2016', 'Windows Server 2016', 'bios', 60, 4, 2],
  ['windows-server-2019', 'Windows Server 2019', 'bios', 60, 4, 2],
  ['windows-server-2022', 'Windows Server 2022', 'uefi', 64, 4, 2],
  ['windows-server-2025', 'Windows Server 2025', 'uefi', 64, 4, 2],
  ['windows-10', 'Windows 10', 'uefi', 64, 4, 2],
  ['windows-11', 'Windows 11', 'uefi-secure', 64, 4, 2],
  ['ubuntu-server-24-04', 'Ubuntu Server 24.04 LTS', 'uefi', 32, 2, 2],
  ['ubuntu-server-22-04', 'Ubuntu Server 22.04 LTS', 'uefi', 32, 2, 2],
  ['debian-12', 'Debian 12', 'uefi', 24, 2, 2],
  ['rocky-linux-9', 'Rocky Linux 9', 'uefi', 40, 2, 2],
  ['other-linux', 'Other Linux (ISO or PXE)', 'bios', 32, 2, 2],
].map(([profileId, name_label, bootMode, diskGiB, memoryGiB, vcpus]) => ({
  profileId,
  sourceRef: `OpaqueRef:os-profile-${profileId}`,
  name_label,
  name_description: 'Bundled diskless installation profile for ISO or PXE installation.',
  disks: [],
  defaults: { bootMode, diskGiB, memoryGiB, vcpus },
}));

function handleDemoVmTransferRoutes(method, path, body, parsedUrl, search, targetKey) {
  if (method === 'GET' && path === '/api/vms') {
    let vms = buildDemoVmInventory(targetKey).filter((vm) => !vm.is_a_template);
    if (search) {
      const query = search.toLowerCase();
      vms = vms.filter((vm) =>
        (vm.name_label || '').toLowerCase().includes(query) ||
        (vm.name_description || '').toLowerCase().includes(query)
      );
    }
    return { total: vms.length, data: clone(vms) };
  }

  if (method === 'GET' && path === '/api/vms/groups') {
    return { total: 2, data: clone([
      { ref: 'OpaqueRef:vm-group-demo-1', uuid: 'vm-group-demo-1', name_label: 'Production anti-affinity', name_description: 'Keep production workloads on separate hosts.', placement: 'anti_affinity', VMs: [] },
      { ref: 'OpaqueRef:vm-group-demo-2', uuid: 'vm-group-demo-2', name_label: 'Analytics placement', name_description: 'Analytics workload placement group.', placement: 'normal', VMs: [] },
    ]) };
  }

  if (method === 'GET' && path === '/api/vms/creation-sources') {
    const templates = buildDemoVmInventory(targetKey).filter((vm) => vm.is_a_template);
    return clone({
      operatingSystems: [
        { ref: 'OpaqueRef:os-profile-ubuntu-24', name_label: 'Ubuntu Server 24.04 LTS', name_description: 'Empty HVM installation profile for ISO or PXE installation.', disks: [] },
        { ref: 'OpaqueRef:os-profile-windows-2025', name_label: 'Windows Server 2025', name_description: 'Empty UEFI installation profile for ISO installation.', disks: [] },
        ...templates.filter((template) => template.templateKind === 'operating-system').map((template) => ({ ...template, disks: [] })),
      ],
      bundledOperatingSystems: DEMO_BUNDLED_OS_PROFILES,
      deployableTemplates: templates.filter((template) => template.templateKind !== 'operating-system').map((template, index) => ({
        ...template,
        disks: [{ sourceDevice: '0', bootable: true, nameLabel: `${template.name_label}-root`, nameDescription: 'Template system disk', sizeGiB: index ? 80 : 32, srRef: 'OpaqueRef:sr-demo-1' }],
      })),
    });
  }

  if (method === 'GET' && path === '/api/vms/gpu-profiles') {
    return { total: 0, data: [] };
  }

  if (method === 'POST' && path === '/api/vms') {
    ensureDemoMutationAllowed({ actionKey: 'vm_create', entityType: 'vm', entityRef: 'new' });

    const nameLabel = String(body?.nameLabel || '').trim();
    if (!nameLabel) throw new Error('VM_NAME_REQUIRED');
    const creationMode = body?.creationMode;
    const operatingSystems = DEMO_BUNDLED_OS_PROFILES.map((profile) => profile.sourceRef).concat(['OpaqueRef:os-profile-ubuntu-24', 'OpaqueRef:os-profile-windows-2025']);
    const sourceTemplate = demoDb.vms.find((vm) => vm.ref === body?.sourceRef && vm.is_a_template);
    if (!['operating-system', 'template'].includes(creationMode)) throw new Error('VM_CREATION_MODE_INVALID');
    if (creationMode === 'operating-system' && !operatingSystems.includes(body?.sourceRef)) throw new Error('VM_OPERATING_SYSTEM_NOT_FOUND');
    if (creationMode === 'template' && !sourceTemplate) throw new Error('VM_TEMPLATE_NOT_FOUND');

    const vcpus = Math.min(64, Math.max(1, Number(body?.vcpus) || 2));
    const memoryGiB = Math.min(1024, Math.max(1, Number(body?.memoryGiB) || 4));
    const memoryBytes = memoryGiB * 1024 * 1024 * 1024;
    const targetHost = demoDb.hosts.find((host) => host.ref === body?.hostRef)
      || demoDb.hosts.find((host) => host.enabled && !host.maintenance_mode) || demoDb.hosts[0] || null;
    const targetPool = demoDb.pools.find((pool) => pool.ref === targetHost?.pool) || demoDb.pools[0] || null;
    const nextVmRef = nextDemoOpaqueRef('vm');
    const nextVm = {
      ref: nextVmRef,
      uuid: `${nextVmRef.replace('OpaqueRef:', '')}-uuid`,
      name_label: nameLabel,
      name_description: String(body?.nameDescription || '').trim(),
      power_state: body?.startAfter ? 'Running' : 'Halted',
      VCPUs_at_startup: vcpus,
      VCPUs_max: vcpus,
      memory_static_max: memoryBytes,
      memory_dynamic_max: memoryBytes,
      is_a_template: false,
      resident_on: targetHost?.ref || '',
      affinity: targetHost?.ref || '',
      VBDs: [],
      VIFs: [],
      HVM_boot_policy: 'BIOS order',
      HVM_boot_params: { order: body?.installMedia === 'pxe' ? 'ncd' : 'dc', firmware: body?.bootMode === 'bios' ? 'bios' : 'uefi' },
      VCPUs_params: { 'cores-per-socket': String(body?.coresPerSocket || 1) },
      platform: body?.bootMode === 'uefi-secure' ? { 'device-model': 'qemu-upstream-uefi', secureboot: 'true' } : {},
      groups: body?.vmGroupRef ? [body.vmGroupRef] : [],
      VTPMs: body?.addVtpm ? [nextDemoOpaqueRef('vtpm')] : [],
      VGPUs: body?.vgpuTypeRef ? [nextDemoOpaqueRef('vgpu')] : [],
      tags: ['created', ...(Array.isArray(body?.tags) ? body.tags : [])],
      pool: targetPool?.ref || '',
      created_at: new Date().toISOString(),
    };

    for (const [index, disk] of (Array.isArray(body?.diskPlan) ? body.diskPlan : []).entries()) {
      const vbdRef = nextDemoOpaqueRef('vbd');
      const vdiRef = nextDemoOpaqueRef('vdi');
      nextVm.VBDs.push(vbdRef);
      const srRef = disk.srRef;
      demoDb.vdis[srRef] = demoDb.vdis[srRef] || [];
      demoDb.vdis[srRef].push({ ref: vdiRef, uuid: `${vdiRef.replace('OpaqueRef:', '')}-uuid`, SR: srRef, name_label: disk.nameLabel || `${nameLabel}-${index === 0 ? 'root' : `disk-${index}`}`, virtual_size: Math.max(1, Number(disk.sizeGiB) || 32) * 1024 * 1024 * 1024, type: 'user', managed: true, VBDs: [vbdRef] });
    }
    for (const [index, nic] of (Array.isArray(body?.networkInterfaces) ? body.networkInterfaces : []).slice(0, 4).entries()) {
      const network = demoDb.networks.find((entry) => entry.ref === nic?.networkRef);
      if (network) {
        const vifRef = nextDemoOpaqueRef('vif');
        nextVm.VIFs.push(vifRef);
        network.VIFs = [...(network.VIFs || []), vifRef];
        registerDemoVifState(vifRef, { device: String(index), MAC: nic?.mac || '', currently_attached: Boolean(body?.startAfter) });
      }
    }

    demoDb.vms.push(nextVm);
    if (targetHost) {
      targetHost.resident_VMs = [...(targetHost.resident_VMs || []), nextVmRef];
    }

    recordDemoAudit({
      category: 'vms',
      action: 'vm_created',
      actionLabel: 'Created VM',
      entityType: 'vm',
      entityRef: nextVmRef,
      entityName: nextVm.name_label,
      route: '/vms',
      after: nextVm,
      detail: `Provisioned from ${sourceTemplate?.name_label || 'an operating system profile'} with ${vcpus} vCPUs and ${memoryGiB} GiB of memory.`,
    });

    return clone(nextVm);
  }

  if (method === 'PUT' && path === '/api/vms/import') {
    ensureDemoMutationAllowed({ actionKey: 'vm_duplicate_create', entityType: 'vm', entityRef: 'import' });

    const metadataOnly = parsedUrl.searchParams.get('metadataOnly') === 'true';
    const restore = parsedUrl.searchParams.get('restore') === 'true';
    const force = parsedUrl.searchParams.get('force') === 'true';
    const requestedSrRef = decodeURIComponent(parsedUrl.searchParams.get('srRef') || '');
    const fileName = body?.fileName || body?.file?.name || 'package.xva';
    const normalizedName = String(fileName)
      .replace(/\.[^.]+$/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'imported-vm';

    const targetSr = demoDb.srs.find((entry) => entry.ref === requestedSrRef)
      || demoDb.srs.find((entry) => entry.ref === demoDb.pools[0]?.default_SR)
      || demoDb.srs[0]
      || null;

    const targetHost = demoDb.hosts.find((host) =>
      host.enabled && !host.maintenance_mode && (
        (targetSr && Array.isArray(host.PBDs) && Array.isArray(targetSr.PBDs) && host.PBDs.some((pbdRef) => targetSr.PBDs.includes(pbdRef)))
        || host.pool === demoDb.pools.find((pool) => pool.default_SR === targetSr?.ref)?.ref
      )
    ) || demoDb.hosts.find((host) => host.enabled && !host.maintenance_mode) || demoDb.hosts[0] || null;

    const targetPool = demoDb.pools.find((pool) => pool.ref === targetHost?.pool)
      || demoDb.pools.find((pool) => pool.default_SR === targetSr?.ref)
      || demoDb.pools[0]
      || null;

    const targetNetwork = demoDb.networks.find((network) =>
      Array.isArray(network.PIFs) && network.PIFs.some((pifRef) => Array.isArray(targetHost?.PIFs) && targetHost.PIFs.includes(pifRef))
    ) || demoDb.networks[0] || null;

    const nextVmRef = nextDemoOpaqueRef('vm');
    const nextVm = {
      ref: nextVmRef,
      uuid: `${nextVmRef.replace('OpaqueRef:', '')}-uuid`,
      name_label: restore ? normalizedName : `${normalizedName}-import`,
      name_description: metadataOnly
        ? 'Imported from a metadata-only XenServer archive.'
        : 'Imported from a XenServer XVA package.',
      power_state: 'Halted',
      VCPUs_at_startup: 2,
      VCPUs_max: 2,
      memory_static_max: 4294967296,
      memory_dynamic_max: 4294967296,
      is_a_template: false,
      resident_on: targetHost?.ref || '',
      affinity: targetHost?.ref || '',
      VBDs: [],
      VIFs: [],
      HVM_boot_policy: 'UEFI',
      platform: { secureboot: 'enabled' },
      tags: ['imported', metadataOnly ? 'metadata' : 'xva'],
      pool: targetPool?.ref || '',
      last_import_at: new Date().toISOString(),
      last_import_file: fileName,
      import_restore_identity: restore,
      import_force_requested: force,
    };

    if (!metadataOnly && targetSr) {
      const vbdRef = nextDemoOpaqueRef('vbd');
      const vdiRef = nextDemoOpaqueRef('vdi');
      nextVm.VBDs = [vbdRef];
      if (!demoDb.vdis[targetSr.ref]) {
        demoDb.vdis[targetSr.ref] = [];
      }
      demoDb.vdis[targetSr.ref].push({
        ref: vdiRef,
        uuid: `${vdiRef.replace('OpaqueRef:', '')}-uuid`,
        SR: targetSr.ref,
        name_label: `${nextVm.name_label}-root`,
        virtual_size: 42949672960,
        type: 'user',
        managed: true,
        VBDs: [vbdRef],
      });
    }

    if (targetNetwork) {
      const vifRef = nextDemoOpaqueRef('vif');
      nextVm.VIFs = [vifRef];
      targetNetwork.VIFs = [...(targetNetwork.VIFs || []), vifRef];
      registerDemoVifState(vifRef, {
        device: '0',
        MAC: '',
        currently_attached: false,
      });
    }

    demoDb.vms.push(nextVm);

    if (targetHost) {
      targetHost.resident_VMs = [...(targetHost.resident_VMs || []), nextVmRef];
    }

    recordDemoAudit({
      category: 'vms',
      action: metadataOnly ? 'vm_metadata_imported' : 'vm_xva_imported',
      actionLabel: metadataOnly ? 'Imported VM metadata for' : 'Imported VM package for',
      entityType: 'vm',
      entityRef: nextVmRef,
      entityName: nextVm.name_label,
      route: '/vms',
      after: nextVm,
      detail: `${fileName} imported into ${targetSr?.name_label || 'default storage'}${metadataOnly ? ' as metadata only' : ''}.`,
    });

    return {
      success: true,
      fileName,
      metadataOnly,
      importedVm: clone(nextVm),
    };
  }

  if (method === 'POST' && path.startsWith('/api/vms/') && path.endsWith('/duplicate')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_duplicate_create', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    const nextVmRef = nextDemoOpaqueRef('vm');
    const nextVm = {
      ...clone(vm),
      ref: nextVmRef,
      uuid: nextVmRef.replace('OpaqueRef:', '') + '-uuid',
      name_label: body.nameLabel,
      name_description: body.nameDescription || vm.name_description || '',
      power_state: body.startAfter ? 'Running' : 'Halted',
      VBDs: [],
      VIFs: [],
      duplication_mode: body.mode === 'copy' ? 'copy' : 'clone',
      targetSrRef: body.mode === 'copy' ? (body.srRef || '') : '',
    };

    for (const sourceVbdRef of vm.VBDs || []) {
      const sourceVdi = Object.values(demoDb.vdis)
        .flat()
        .find((entry) => Array.isArray(entry.VBDs) && entry.VBDs.includes(sourceVbdRef));
      if (!sourceVdi) continue;

      const nextVbdRef = nextDemoOpaqueRef('vbd');
      const nextVdiRef = nextDemoOpaqueRef('vdi');
      const targetSrRef = body.mode === 'copy' ? (body.srRef || sourceVdi.SR) : sourceVdi.SR;
      const nextVdi = {
        ...clone(sourceVdi),
        ref: nextVdiRef,
        uuid: nextVdiRef.replace('OpaqueRef:', '') + '-uuid',
        SR: targetSrRef,
        name_label: `${body.nameLabel}-${sourceVdi.name_label || 'disk'}`,
        VBDs: [nextVbdRef],
      };

      if (!demoDb.vdis[targetSrRef]) {
        demoDb.vdis[targetSrRef] = [];
      }
      demoDb.vdis[targetSrRef].push(nextVdi);
      nextVm.VBDs.push(nextVbdRef);
    }

    for (const sourceVifRef of vm.VIFs || []) {
      const targetNetwork = demoDb.networks.find((entry) => Array.isArray(entry.VIFs) && entry.VIFs.includes(sourceVifRef));
      if (!targetNetwork) continue;

      const nextVifRef = nextDemoOpaqueRef('vif');
      nextVm.VIFs.push(nextVifRef);
      targetNetwork.VIFs = [...(targetNetwork.VIFs || []), nextVifRef];
      registerDemoVifState(nextVifRef, {
        device: String(nextVm.VIFs.length - 1),
        MAC: '',
        currently_attached: body.startAfter === true,
      });
    }

    demoDb.vms.push(nextVm);
    return clone(nextVm);
  }

  if (method === 'POST' && path.startsWith('/api/vms/') && path.endsWith('/migrate')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_migrate', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');
    const previous = clone(vm);
    const powerState = String(vm.power_state || '').toLowerCase();
    const liveEligible = powerState === 'running' || powerState === 'suspended';

    if (body.mode === 'cross-pool') {
      const destinationScope = getDemoTargetScope(body.destinationTargetKey);
      const destinationHost = destinationScope.hosts[0];
      if (!destinationHost) throw new Error('HOST_NOT_FOUND');

      const migrationMode = body.copy ? 'cross-pool-copy' : (liveEligible && body.live !== false ? 'cross-pool-live' : 'cross-pool-relocate');
      const destinationNetworkMap = Object.fromEntries((body.vifNetworkMap || []).map((entry) => [entry.vifRef, entry.networkRef]));

      if (body.copy) {
        const nextVmRef = nextDemoOpaqueRef('vm');
        const nextVm = {
          ...clone(vm),
          ref: nextVmRef,
          uuid: `${nextVmRef.replace('OpaqueRef:', '')}-uuid`,
          resident_on: destinationHost.ref,
          affinity: destinationHost.ref,
          VBDs: [],
          VIFs: [],
          last_migration_at: new Date().toISOString(),
          last_migration_mode: migrationMode,
          last_migration_target_key: body.destinationTargetKey,
        };

        for (const sourceVbdRef of vm.VBDs || []) {
          const sourceVdi = Object.values(demoDb.vdis)
            .flat()
            .find((entry) => Array.isArray(entry.VBDs) && entry.VBDs.includes(sourceVbdRef));
          if (!sourceVdi) continue;

          const nextVbdRef = nextDemoOpaqueRef('vbd');
          const nextVdiRef = nextDemoOpaqueRef('vdi');
          const nextVdi = {
            ...clone(sourceVdi),
            ref: nextVdiRef,
            uuid: `${nextVdiRef.replace('OpaqueRef:', '')}-uuid`,
            SR: body.srRef || sourceVdi.SR,
            VBDs: [nextVbdRef],
          };

          if (!demoDb.vdis[nextVdi.SR]) {
            demoDb.vdis[nextVdi.SR] = [];
          }
          demoDb.vdis[nextVdi.SR].push(nextVdi);
          nextVm.VBDs.push(nextVbdRef);
        }

        for (const sourceVifRef of vm.VIFs || []) {
          const nextVifRef = nextDemoOpaqueRef('vif');
          const destinationNetwork = demoDb.networks.find((network) => network.ref === destinationNetworkMap[sourceVifRef]);
          if (!destinationNetwork) continue;
          nextVm.VIFs.push(nextVifRef);
          destinationNetwork.VIFs = [...(destinationNetwork.VIFs || []), nextVifRef];
          registerDemoVifState(nextVifRef, {
            device: String(nextVm.VIFs.length - 1),
            MAC: '',
            currently_attached: false,
          });
        }

        demoDb.vms.push(nextVm);
        const persistentDestinationHost = demoDb.hosts.find((entry) => entry.ref === destinationHost.ref);
        if (persistentDestinationHost) {
          persistentDestinationHost.resident_VMs = [...new Set([...(persistentDestinationHost.resident_VMs || []), nextVmRef])];
        }

        const record = {
          ...clone(nextVm),
          migration_mode: migrationMode,
          destinationTargetKey: body.destinationTargetKey,
          destinationVmRef: nextVmRef,
          destinationVmUuid: nextVm.uuid,
          targetSrRef: body.srRef || '',
          transferNetworkRef: body.transferNetworkRef || '',
          homeServerUpdated: false,
          homeServerUpdateError: '',
        };

        recordDemoAudit({
          category: 'vms',
          action: 'vm_cross_pool_copied',
          actionLabel: 'Copied VM to target fabric',
          entityType: 'vm',
          entityRef: nextVmRef,
          entityName: nextVm.name_label || nextVmRef,
          route: '/vms',
          before: previous,
          after: record,
          detail: `${vm.name_label || ref} was copied into ${body.destinationTargetKey} on ${destinationHost.name_label || destinationHost.ref}.`,
        });

        return record;
      }

      const previousHost = demoDb.hosts.find((entry) => entry.ref === vm.resident_on);
      if (previousHost) {
        previousHost.resident_VMs = (previousHost.resident_VMs || []).filter((vmRef) => vmRef !== vm.ref);
      }

      vm.resident_on = destinationHost.ref;
      vm.affinity = destinationHost.ref;
      vm.last_migration_at = new Date().toISOString();
      vm.last_migration_mode = migrationMode;
      vm.last_migration_target_key = body.destinationTargetKey;
      vm.last_migration_target = destinationHost.ref;

      Object.values(demoDb.vdis)
        .flat()
        .filter((entry) => Array.isArray(entry.VBDs) && entry.VBDs.some((vbdRef) => (vm.VBDs || []).includes(vbdRef)))
        .forEach((entry) => {
          entry.SR = body.srRef || entry.SR;
        });

      demoDb.networks.forEach((network) => {
        network.VIFs = (network.VIFs || []).filter((vifRef) => !(vm.VIFs || []).includes(vifRef));
      });
      (vm.VIFs || []).forEach((vifRef) => {
        const destinationNetwork = demoDb.networks.find((network) => network.ref === destinationNetworkMap[vifRef]);
        if (destinationNetwork) {
          destinationNetwork.VIFs = [...new Set([...(destinationNetwork.VIFs || []), vifRef])];
        }
      });

      const persistentDestinationHost = demoDb.hosts.find((entry) => entry.ref === destinationHost.ref);
      if (persistentDestinationHost) {
        persistentDestinationHost.resident_VMs = [...new Set([...(persistentDestinationHost.resident_VMs || []), vm.ref])];
      }

      const record = {
        ...clone(vm),
        migration_mode: migrationMode,
        destinationTargetKey: body.destinationTargetKey,
        destinationVmRef: vm.ref,
        destinationVmUuid: vm.uuid,
        migrated_to: destinationHost.ref,
        targetSrRef: body.srRef || '',
        transferNetworkRef: body.transferNetworkRef || '',
        homeServerUpdated: false,
        homeServerUpdateError: '',
      };

      recordDemoAudit({
        category: 'vms',
        action: 'vm_cross_pool_migrated',
        actionLabel: 'Migrated VM to target fabric',
        entityType: 'vm',
        entityRef: vm.ref,
        entityName: vm.name_label || vm.ref,
        route: '/vms',
        before: previous,
        after: record,
        detail: `${vm.name_label || ref} moved into ${body.destinationTargetKey} on ${destinationHost.name_label || destinationHost.ref}.`,
      });

      return record;
    }

    const targetHost = demoDb.hosts.find((entry) => entry.ref === body.hostRef);
    if (!targetHost) throw new Error('HOST_NOT_FOUND');

    const migrationMode = liveEligible && body.live !== false ? 'live' : 'relocate';
    vm.resident_on = body.hostRef;
    if (body.setAsHomeServer) {
      vm.affinity = body.hostRef;
    }
    vm.last_migration_at = new Date().toISOString();
    vm.last_migration_mode = migrationMode;
    vm.last_migration_target = body.hostRef;

    const record = {
      ...clone(vm),
      migration_mode: migrationMode,
      migrated_to: body.hostRef,
      homeServerUpdated: Boolean(body.setAsHomeServer),
      homeServerUpdateError: '',
    };

    recordDemoAudit({
      category: 'vms',
      action: migrationMode === 'live' ? 'vm_live_migrated' : 'vm_relocated',
      actionLabel: migrationMode === 'live' ? 'Live migrated VM' : 'Relocated VM',
      entityType: 'vm',
      entityRef: ref,
      entityName: vm.name_label || ref,
      route: '/vms',
      before: previous,
      after: record,
      detail: `${vm.name_label || ref} moved to ${targetHost.name_label || body.hostRef} via ${migrationMode === 'live' ? 'live migration' : 'relocation'}.`,
    });

    return record;
  }

  return undefined;
}
