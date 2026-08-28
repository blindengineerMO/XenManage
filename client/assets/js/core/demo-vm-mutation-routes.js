function handleDemoVmMutationRoutes(method, path, body) {
  if (method === 'PUT' && path.startsWith('/api/vms/') && path.endsWith('/config')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_config_update', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    Object.assign(vm, {
      name_label: body.nameLabel,
      name_description: body.nameDescription || '',
      user_version: Number(body.userVersion || 0),
      start_delay: Number(body.startDelay || 0),
      shutdown_delay: Number(body.shutdownDelay || 0),
      order: Number(body.order || 0),
      VCPUs_at_startup: Number(body.vcpusAtStartup || 1),
      VCPUs_max: Number(body.vcpusMax || body.vcpusAtStartup || 1),
      memory_static_min: Number(body.memoryStaticMin || body.memoryStaticMax || 0),
      memory_dynamic_min: Number(body.memoryDynamicMin || body.memoryDynamicMax || body.memoryStaticMin || body.memoryStaticMax || 0),
      memory_static_max: Number(body.memoryStaticMax || 0),
      memory_dynamic_max: Number(body.memoryDynamicMax || body.memoryStaticMax || 0),
      hardware_platform_version: Number(body.hardwarePlatformVersion || 0),
      domain_type: String(body.domainType || 'unspecified').trim() || 'unspecified',
      has_vendor_device: Boolean(body.hasVendorDevice),
      affinity: String(body.affinity || '').trim(),
      appliance: String(body.applianceRef || '').trim(),
      snapshot_schedule: String(body.snapshotScheduleRef || '').trim(),
      tags: Array.isArray(body.tags) ? body.tags : [],
      blocked_operations: clone(body.blockedOperations || {}),
      VCPUs_params: clone(body.vcpusParams || {}),
      other_config: clone(body.otherConfig || {}),
      xenstore_data: clone(body.xenstoreData || {}),
      NVRAM: clone(body.nvram || {}),
      platform: clone(body.platform || {}),
    });

    demoDb.vmAppliances.forEach((appliance) => {
      appliance.VMs = (appliance.VMs || []).filter((vmRef) => vmRef !== ref);
    });
    if (vm.appliance) {
      const applianceRecord = demoDb.vmAppliances.find((entry) => entry.ref === vm.appliance);
      if (applianceRecord) {
        applianceRecord.VMs = [...new Set([...(applianceRecord.VMs || []), ref])];
      }
    }

    demoDb.vmSnapshotSchedules.forEach((schedule) => {
      schedule.VMs = (schedule.VMs || []).filter((vmRef) => vmRef !== ref);
    });
    if (vm.snapshot_schedule) {
      const snapshotScheduleRecord = demoDb.vmSnapshotSchedules.find((entry) => entry.ref === vm.snapshot_schedule);
      if (snapshotScheduleRecord) {
        snapshotScheduleRecord.VMs = [...new Set([...(snapshotScheduleRecord.VMs || []), ref])];
      }
    }

    return clone(vm);
  }

  if (method === 'POST' && path.startsWith('/api/vms/') && path.endsWith('/disks')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_disk_add', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    const vbdRef = nextDemoOpaqueRef('vbd');
    const vdiRef = nextDemoOpaqueRef('vdi');
    const srRef = body.srRef;
    const vdi = {
      ref: vdiRef,
      uuid: vdiRef.replace('OpaqueRef:', '') + '-uuid',
      SR: srRef,
      name_label: body.nameLabel,
      virtual_size: Number(body.sizeBytes || 0),
      type: 'user',
      managed: true,
      VBDs: [vbdRef],
    };

    if (!demoDb.vdis[srRef]) {
      demoDb.vdis[srRef] = [];
    }

    demoDb.vdis[srRef].push(vdi);
    vm.VBDs = [...(vm.VBDs || []), vbdRef];
    return { success: true, vdiRef, vbdRef };
  }

  if (method === 'POST' && path.startsWith('/api/vms/') && path.endsWith('/nics')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_nic_add', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    const network = demoDb.networks.find((entry) => entry.ref === body.networkRef);
    if (!vm) throw new Error('VM_NOT_FOUND');
    if (!network) throw new Error('NETWORK_NOT_FOUND');

    const vifRef = nextDemoOpaqueRef('vif');
    vm.VIFs = [...(vm.VIFs || []), vifRef];
    network.VIFs = [...(network.VIFs || []), vifRef];
    registerDemoVifState(vifRef, {
      device: body.deviceLabel || String(Math.max(0, (vm.VIFs || []).length - 1)),
      MAC: body.mac || '',
      currently_attached: String(vm.power_state || '').toLowerCase() === 'running',
      qos_algorithm_type: '',
      qos_algorithm_params: {},
      qos_supported_algorithms: ['ratelimit'],
    });
    return { success: true, vifRef };
  }

  if (method === 'POST' && /\/api\/vms\/.+\/nics\/.+\/disconnect$/.test(path)) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vifRef = decodeURIComponent(path.split('/')[5] || '');
    ensureDemoMutationAllowed({ actionKey: 'vm_nic_disconnect', entityType: 'vm', entityRef: ref });
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');
    if (!(vm.VIFs || []).includes(vifRef)) throw new Error('VM_NIC_NOT_FOUND');

    const current = demoDb.vifStates[vifRef] || {};
    const alreadyDisconnected = !Boolean(current.currently_attached);
    registerDemoVifState(vifRef, {
      ...current,
      currently_attached: false,
    });

    const network = demoDb.networks.find((entry) => Array.isArray(entry.VIFs) && entry.VIFs.includes(vifRef));
    return {
      success: true,
      vmRef: ref,
      vifRef,
      networkRef: network?.ref || '',
      alreadyDisconnected,
      currentlyAttached: false,
      device: String((demoDb.vifStates[vifRef] || {}).device || ''),
      mac: String((demoDb.vifStates[vifRef] || {}).MAC || ''),
    };
  }

  if (method === 'DELETE' && /\/api\/vms\/.+\/nics\/.+$/.test(path)) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vifRef = decodeURIComponent(path.split('/')[5] || '');
    ensureDemoMutationAllowed({ actionKey: 'vm_nic_remove', entityType: 'vm', entityRef: ref });
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');
    if (!(vm.VIFs || []).includes(vifRef)) throw new Error('VM_NIC_NOT_FOUND');

    vm.VIFs = (vm.VIFs || []).filter((entry) => entry !== vifRef);
    demoDb.networks.forEach((network) => {
      network.VIFs = (network.VIFs || []).filter((entry) => entry !== vifRef);
    });
    unregisterDemoVifState(vifRef);

    return { success: true, vmRef: ref, vifRef };
  }

  if (method === 'POST' && path.startsWith('/api/vms/')) {
    const action = path.split('/')[3];
    const actionKey = action === 'shutdown' ? 'vm_shutdown' : action === 'reboot' ? 'vm_reboot' : action === 'suspend' ? 'vm_suspend' : action === 'resume' ? 'vm_resume' : 'vm_start';
    ensureDemoMutationAllowed({
      actionKey,
      entityType: 'vm',
      entityRef: body.ref,
      destructive: ['shutdown', 'reboot', 'suspend'].includes(action),
      approvalId: body.approvalId || '',
    });
    const vm = demoDb.vms.find((entry) => entry.ref === body.ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    if (action === 'start' || action === 'resume') vm.power_state = 'Running';
    if (action === 'shutdown') vm.power_state = 'Halted';
    if (action === 'suspend') vm.power_state = 'Suspended';
    if (action === 'reboot') vm.power_state = 'Running';

    return { success: true };
  }

  return undefined;
}
