function handleDemoResourceRoutes(method, path, body, scope) {
  if (method === 'GET' && path === '/api/storage') {
    return { total: scope.srs.length, data: clone(scope.srs) };
  }

  if (method === 'GET' && path === '/api/networks/interfaces') {
    const vifs = buildDemoVifInventory();
    return { total: vifs.length, data: clone(vifs) };
  }

  if (method === 'PUT' && /\/api\/networks\/interfaces\/.+\/config$/.test(path)) {
    const vifRef = decodeURIComponent(path.split('/')[4] || '');
    ensureDemoMutationAllowed({ actionKey: 'network_vif_config_update', entityType: 'vif', entityRef: vifRef });
    const current = demoDb.vifStates[vifRef];
    if (!current) throw new Error('VIF_NOT_FOUND');

    registerDemoVifState(vifRef, {
      ...current,
      qos_algorithm_type: String(body?.qosAlgorithmType || '').trim(),
      qos_algorithm_params: clone(body?.qosAlgorithmParams || {}),
    });

    const vifRecord = buildDemoVifInventory().find((entry) => entry.ref === vifRef);
    return clone(vifRecord || { ref: vifRef });
  }

  if (method === 'POST' && path === '/api/storage') {
    ensureDemoMutationAllowed({ actionKey: 'sr_create', entityType: 'host', entityRef: body?.hostRef || '' });
    const host = demoDb.hosts.find((entry) => entry.ref === body?.hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');

    const srRef = nextDemoOpaqueRef('sr');
    const record = {
      ref: srRef,
      uuid: `${srRef.replace('OpaqueRef:', '')}-uuid`,
      name_label: body?.nameLabel,
      name_description: body?.nameDescription || '',
      type: body?.type || 'nfs',
      content_type: body?.contentType || 'user',
      shared: Boolean(body?.shared),
      physical_size: 0,
      physical_utilisation: 0,
      virtual_allocation: 0,
      tags: [],
      sm_config: clone(body?.smConfig || {}),
      other_config: {},
      PBDs: [],
      VDIs: [],
      resident_on: body?.hostRef || '',
      device_config: clone(body?.deviceConfig || {}),
    };

    demoDb.srs.push(record);
    if (!demoDb.vdis[srRef]) {
      demoDb.vdis[srRef] = [];
    }

    return clone(record);
  }

  if (method === 'POST' && path === '/api/storage/probe') {
    const requiredByType = {
      nfs: ['server', 'serverpath'],
      lvmoiscsi: ['target', 'targetIQN', 'SCSIid'],
      ext: ['device'],
      lvm: ['device'],
    };
    const requestedConfiguration = clone(body?.deviceConfig || {});
    const requiredKeys = requiredByType[body?.type] || [];
    const missingKeys = requiredKeys.filter((key) => !String(requestedConfiguration[key] || '').trim());

    if (missingKeys.length) {
      return {
        mode: 'probe_ext',
        requestedConfiguration,
        rawXml: '',
        results: [
          {
            complete: false,
            configuration: requestedConfiguration,
            extraInfo: {
              hint: `Provide ${missingKeys.join(', ')} to complete discovery for this ${body?.type || 'storage'} target.`,
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
      };
    }

    const nameByType = {
      nfs: 'Imported Archive SR',
      lvmoiscsi: 'Imported iSCSI SR',
      ext: 'Imported Local EXT SR',
      lvm: 'Imported Local LVM SR',
    };

    return {
      mode: 'probe_ext',
      requestedConfiguration,
      rawXml: '',
      results: [
        {
          complete: true,
          configuration: requestedConfiguration,
          extraInfo: {
            transport: body?.type || 'storage',
            discovery: 'existing-sr',
          },
          sr: {
            uuid: `imported-${body?.type || 'sr'}-uuid`,
            name_label: nameByType[body?.type] || 'Imported Storage Repository',
            name_description: 'Existing storage repository discovered during probe.',
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
    };
  }

  if (method === 'POST' && path === '/api/storage/import') {
    ensureDemoMutationAllowed({ actionKey: 'sr_import', entityType: 'host', entityRef: body?.hostRef || '' });
    const host = demoDb.hosts.find((entry) => entry.ref === body?.hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');

    let sr = demoDb.srs.find((entry) => entry.uuid === body?.uuid) || null;
    let introduced = false;
    if (!sr) {
      const srRef = nextDemoOpaqueRef('sr');
      sr = {
        ref: srRef,
        uuid: body?.uuid || `${srRef.replace('OpaqueRef:', '')}-uuid`,
        name_label: body?.nameLabel,
        name_description: body?.nameDescription || '',
        type: body?.type || 'nfs',
        content_type: body?.contentType || 'user',
        shared: Boolean(body?.shared),
        physical_size: 21474836480,
        physical_utilisation: 0,
        virtual_allocation: 0,
        tags: [],
        sm_config: clone(body?.smConfig || {}),
        other_config: {},
        PBDs: [],
        VDIs: [],
        resident_on: body?.hostRef || '',
        device_config: clone(body?.deviceConfig || {}),
      };
      demoDb.srs.push(sr);
      if (!demoDb.vdis[sr.ref]) {
        demoDb.vdis[sr.ref] = [];
      }
      introduced = true;
    }

    const existingPbdRef = Array.isArray(sr.PBDs)
      ? sr.PBDs.find((pbdRef) => Array.isArray(host.PBDs) && host.PBDs.includes(pbdRef))
      : '';
    const alreadyAttached = Boolean(existingPbdRef);
    let pbdRef = existingPbdRef || '';
    let createdPbd = false;

    if (!pbdRef) {
      pbdRef = nextDemoOpaqueRef('pbd');
      sr.PBDs = [...(sr.PBDs || []), pbdRef];
      host.PBDs = [...(host.PBDs || []), pbdRef];
      createdPbd = true;
    }

    sr.device_config = clone(body?.deviceConfig || sr.device_config || {});
    sr.sm_config = clone(body?.smConfig || sr.sm_config || {});

    return clone({
      ...sr,
      pbdRef,
      introduced,
      createdPbd,
      updatedPbdConfig: !alreadyAttached && !createdPbd,
      pluggedPbd: !alreadyAttached,
      alreadyAttached,
      attachedHostRef: body?.hostRef || '',
    });
  }

  if (method === 'POST' && path.startsWith('/api/storage/') && path.endsWith('/local-cache')) {
    ensureDemoMutationAllowed({ actionKey: 'sr_local_cache_update', entityType: 'sr', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const sr = demoDb.srs.find((entry) => entry.ref === ref);
    const host = demoDb.hosts.find((entry) => entry.ref === body?.hostRef);
    if (!sr) throw new Error('SR_NOT_FOUND');
    if (!host) throw new Error('HOST_NOT_FOUND');
    if (sr.shared) {
      const error = new Error('Local storage caching only applies to non-shared storage repositories attached to a specific host.');
      error.code = 'LOCAL_CACHE_REQUIRES_LOCAL_SR';
      throw error;
    }

    const hasPath = Array.isArray(sr.PBDs) && Array.isArray(host.PBDs) && sr.PBDs.some((pbdRef) => host.PBDs.includes(pbdRef));
    if (!hasPath) {
      const error = new Error('The selected host does not currently expose an attached path to this storage repository.');
      error.code = 'LOCAL_CACHE_REQUIRES_ATTACHED_HOST_PATH';
      throw error;
    }

    sr.local_cache_enabled = Boolean(body?.enabled);
    return clone({
      ...sr,
      hostRef: body?.hostRef || '',
      requestedEnabled: Boolean(body?.enabled),
    });
  }

  if (method === 'PUT' && path.startsWith('/api/storage/') && path.endsWith('/config')) {
    ensureDemoMutationAllowed({ actionKey: 'sr_config_update', entityType: 'sr', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const sr = demoDb.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');

    const preservedOtherConfig = Object.fromEntries(
      Object.entries(sr.other_config || {})
        .filter(([key]) => ['last_rescan_at', 'last_repair_at'].includes(String(key || '').trim()))
    );

    sr.name_label = String(body?.nameLabel || sr.name_label || '').trim();
    sr.name_description = String(body?.nameDescription || '').trim();
    sr.tags = Array.isArray(body?.tags) ? clone(body.tags) : [];
    sr.other_config = {
      ...preservedOtherConfig,
      ...clone(body?.otherConfig || {}),
    };

    return clone(sr);
  }

  if (method === 'POST' && path.startsWith('/api/storage/') && path.endsWith('/repair')) {
    ensureDemoMutationAllowed({ actionKey: 'sr_repair', entityType: 'sr', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const sr = demoDb.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');

    const repairedPbdRefs = Array.isArray(sr.PBDs) ? [...sr.PBDs] : [];
    sr.other_config = {
      ...(sr.other_config || {}),
      last_repair_at: '2026-08-26T19:10:00.000Z',
    };

    return clone({
      ...sr,
      checkedPbdRefs: Array.isArray(sr.PBDs) ? [...sr.PBDs] : [],
      repairedPbdRefs,
      reattachedCount: repairedPbdRefs.length,
    });
  }

  if (method === 'POST' && path.startsWith('/api/storage/') && path.endsWith('/rescan')) {
    ensureDemoMutationAllowed({ actionKey: 'sr_rescan', entityType: 'sr', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const sr = demoDb.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');
    sr.other_config = {
      ...(sr.other_config || {}),
      last_rescan_at: new Date().toISOString(),
    };
    return clone(sr);
  }

  if (method === 'POST' && path.startsWith('/api/storage/') && path.endsWith('/forget')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({
      actionKey: 'sr_forget',
      entityType: 'sr',
      entityRef: ref,
      destructive: true,
      approvalId: body?.approvalId || '',
    });
    const index = demoDb.srs.findIndex((entry) => entry.ref === ref);
    if (index === -1) throw new Error('SR_NOT_FOUND');

    demoDb.srs.splice(index, 1);
    delete demoDb.vdis[ref];

    return { success: true, ref };
  }

  if (method === 'POST' && path.startsWith('/api/storage/') && path.endsWith('/destroy')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vdis = demoDb.vdis[ref] || [];
    if (vdis.length) {
      const error = new Error(`Destroy requires an empty repository. ${vdis.length} VDI${vdis.length === 1 ? '' : 's'} still map to this storage repository.`);
      error.code = 'SR_DESTROY_REQUIRES_EMPTY_REPOSITORY';
      throw error;
    }

    ensureDemoMutationAllowed({
      actionKey: 'sr_destroy',
      entityType: 'sr',
      entityRef: ref,
      destructive: true,
      approvalId: body?.approvalId || '',
    });
    const index = demoDb.srs.findIndex((entry) => entry.ref === ref);
    if (index === -1) throw new Error('SR_NOT_FOUND');

    demoDb.srs.splice(index, 1);
    delete demoDb.vdis[ref];

    return { success: true, ref };
  }

  if (method === 'POST' && path.startsWith('/api/storage/') && path.endsWith('/vdis')) {
    ensureDemoMutationAllowed({ actionKey: 'sr_vdi_create', entityType: 'sr', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const sr = demoDb.srs.find((entry) => entry.ref === ref);
    if (!sr) throw new Error('SR_NOT_FOUND');

    const vdiRef = nextDemoOpaqueRef('vdi');
    const vdi = {
      ref: vdiRef,
      uuid: `${vdiRef.replace('OpaqueRef:', '')}-uuid`,
      SR: ref,
      name_label: body.nameLabel,
      virtual_size: Number(body.sizeBytes || 0),
      type: String(body.type || 'user'),
      managed: true,
      VBDs: [],
    };

    if (!demoDb.vdis[ref]) {
      demoDb.vdis[ref] = [];
    }

    demoDb.vdis[ref].push(vdi);
    sr.virtual_allocation = Number(sr.virtual_allocation || 0) + Number(body.sizeBytes || 0);
    return clone(vdi);
  }

  if (method === 'POST' && path.startsWith('/api/storage/') && path.includes('/vdis/') && path.endsWith('/resize')) {
    ensureDemoMutationAllowed({ actionKey: 'vdi_resize', entityType: 'vdi', entityRef: decodeURIComponent(path.split('/')[5] || '') });
    const srRef = decodeURIComponent(path.split('/')[3] || '');
    const vdiRef = decodeURIComponent(path.split('/')[5] || '');
    const sr = demoDb.srs.find((entry) => entry.ref === srRef);
    const vdi = Object.values(demoDb.vdis).flat().find((entry) => entry.ref === vdiRef);
    if (!sr) throw new Error('SR_NOT_FOUND');
    if (!vdi) throw new Error('VDI_NOT_FOUND');
    if (vdi.SR !== srRef) throw new Error('VDI_SR_MISMATCH');

    const previousSize = Number(vdi.virtual_size || 0);
    const nextSize = Number(body.sizeBytes || previousSize);
    vdi.virtual_size = nextSize;
    sr.virtual_allocation = Math.max(0, Number(sr.virtual_allocation || 0) + (nextSize - previousSize));
    return clone(vdi);
  }

  if (method === 'DELETE' && path.startsWith('/api/storage/') && path.includes('/vdis/')) {
    const srRef = decodeURIComponent(path.split('/')[3] || '');
    const vdiRef = decodeURIComponent(path.split('/')[5] || '');
    const sr = demoDb.srs.find((entry) => entry.ref === srRef);
    const vdis = demoDb.vdis[srRef] || [];
    const index = vdis.findIndex((entry) => entry.ref === vdiRef);
    if (!sr) throw new Error('SR_NOT_FOUND');
    if (index === -1) throw new Error('VDI_NOT_FOUND');
    if (Array.isArray(vdis[index]?.VBDs) && vdis[index].VBDs.length) {
      const error = new Error(`Delete only supports detached VDIs. ${vdis[index].VBDs.length} attachment path${vdis[index].VBDs.length === 1 ? '' : 's'} still map to this disk.`);
      error.code = 'VDI_DELETE_REQUIRES_DETACHED_DISK';
      throw error;
    }

    ensureDemoMutationAllowed({
      actionKey: 'vdi_delete',
      entityType: 'vdi',
      entityRef: vdiRef,
      destructive: true,
      approvalId: body?.approvalId || '',
    });

    const [removed] = vdis.splice(index, 1);
    sr.virtual_allocation = Math.max(0, Number(sr.virtual_allocation || 0) - Number(removed?.virtual_size || 0));
    return { success: true, vdiRef };
  }

  if (method === 'GET' && path.startsWith('/api/storage/') && path.endsWith('/vdis')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vdis = demoDb.vdis[ref] || [];
    return { total: vdis.length, data: clone(vdis) };
  }

  if (method === 'POST' && path === '/api/networks') {
    ensureDemoMutationAllowed({ actionKey: 'network_create', entityType: 'network', entityRef: body?.bridge || '' });
    const networkRef = nextDemoOpaqueRef('net');
    const record = {
      ref: networkRef,
      uuid: `${networkRef.replace('OpaqueRef:', '')}-uuid`,
      name_label: body?.nameLabel,
      name_description: body?.nameDescription || '',
      bridge: body?.bridge || '',
      MTU: Number(body?.mtu || 1500),
      managed: true,
      VIFs: [],
      PIFs: [],
      tags: Array.isArray(body?.tags) ? clone(body.tags) : [],
      other_config: clone(body?.otherConfig || {}),
      default_locking_mode: 'unlocked',
      purpose: [],
    };
    demoDb.networks.push(record);
    return clone(record);
  }

  if (method === 'POST' && path === '/api/networks/vlans') {
    ensureDemoMutationAllowed({ actionKey: 'network_vlan_create', entityType: 'network', entityRef: body?.networkRef || '' });
    const network = demoDb.networks.find((entry) => entry.ref === body?.networkRef);
    if (!network) throw new Error('NETWORK_NOT_FOUND');

    const vlanRef = nextDemoOpaqueRef('vlan');
    const record = {
      ref: vlanRef,
      uuid: `${vlanRef.replace('OpaqueRef:', '')}-uuid`,
      tagged_PIF: body?.pifRef || '',
      untagged_PIF: `OpaqueRef:generated-pif-${String(body?.tag || '0')}`,
      tag: Number(body?.tag || 0),
      other_config: {},
      networkRef: body?.networkRef || '',
    };

    network.other_config = {
      ...(network.other_config || {}),
      vlan: String(body?.tag || ''),
    };

    return {
      ...clone(record),
      network: clone(network),
      taggedPifRef: body?.pifRef || '',
    };
  }

  if (method === 'POST' && path === '/api/networks/bonds') {
    ensureDemoMutationAllowed({ actionKey: 'network_bond_create', entityType: 'network', entityRef: body?.networkRef || '' });
    const network = demoDb.networks.find((entry) => entry.ref === body?.networkRef);
    if (!network) throw new Error('NETWORK_NOT_FOUND');

    const members = Array.isArray(body?.pifRefs) ? body.pifRefs.map((ref) => String(ref || '').trim()).filter(Boolean) : [];
    network.PIFs = Array.from(new Set([...(Array.isArray(network.PIFs) ? network.PIFs : []), ...members]));
    network.other_config = {
      ...(network.other_config || {}),
      bond_mode: String(body?.mode || 'balance-slb'),
    };

    const bondRef = nextDemoOpaqueRef('bond');
    return {
      ref: bondRef,
      uuid: `${bondRef.replace('OpaqueRef:', '')}-uuid`,
      master: members[0] || '',
      slaves: clone(members),
      primary_slave: members[0] || '',
      links_up: members.length,
      mode: String(body?.mode || 'balance-slb'),
      other_config: {},
      properties: {},
      auto_update_mac: true,
      networkRef: body?.networkRef || '',
      memberPifRefs: clone(members),
      network: clone(network),
    };
  }

  if (method === 'PUT' && path.startsWith('/api/networks/') && path.endsWith('/config')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({ actionKey: 'network_config_update', entityType: 'network', entityRef: ref });
    const network = demoDb.networks.find((entry) => entry.ref === ref);
    if (!network) throw new Error('NETWORK_NOT_FOUND');

    network.name_label = body?.nameLabel || network.name_label;
    network.name_description = body?.nameDescription || '';
    network.MTU = Number(body?.mtu || network.MTU || 1500);
    network.default_locking_mode = String(body?.defaultLockingMode || network.default_locking_mode || 'unlocked');
    network.purpose = Array.isArray(body?.purpose) ? clone(body.purpose) : [];
    network.tags = Array.isArray(body?.tags) ? clone(body.tags) : [];
    network.other_config = clone(body?.otherConfig || {});
    return clone(network);
  }

  if (method === 'POST' && path.startsWith('/api/networks/') && path.endsWith('/destroy')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const network = demoDb.networks.find((entry) => entry.ref === ref);
    if (!network) throw new Error('NETWORK_NOT_FOUND');

    const pifCount = Array.isArray(network.PIFs) ? network.PIFs.length : 0;
    const vifCount = Array.isArray(network.VIFs) ? network.VIFs.length : 0;
    if (pifCount || vifCount) {
      const segments = [];
      if (pifCount) segments.push(`${pifCount} host uplink${pifCount === 1 ? '' : 's'}`);
      if (vifCount) segments.push(`${vifCount} workload interface${vifCount === 1 ? '' : 's'}`);
      const error = new Error(`Destroy requires a detached managed network. ${segments.join(' and ')} still map to this network.`);
      error.code = 'NETWORK_DESTROY_REQUIRES_DETACHED_ATTACHMENTS';
      throw error;
    }

    ensureDemoMutationAllowed({
      actionKey: 'network_destroy',
      entityType: 'network',
      entityRef: ref,
      destructive: true,
      approvalId: body?.approvalId || '',
    });

    const index = demoDb.networks.findIndex((entry) => entry.ref === ref);
    if (index === -1) throw new Error('NETWORK_NOT_FOUND');
    demoDb.networks.splice(index, 1);
    return { success: true, ref };
  }

  if (method === 'GET' && path === '/api/networks') {
    return { total: scope.networks.length, data: clone(scope.networks) };
  }

  return undefined;
}
