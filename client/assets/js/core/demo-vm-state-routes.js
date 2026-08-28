function handleDemoVmStateRoutes(method, path, body, parsedUrl, targetKey) {
  if (method === 'GET' && path.startsWith('/api/vms/') && path.endsWith('/snapshots')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const snapshots = demoDb.vmSnapshots[ref] || [];
    return { total: snapshots.length, data: clone(snapshots) };
  }

  if (method === 'POST' && path.startsWith('/api/vms/') && path.endsWith('/snapshots')) {
    ensureDemoMutationAllowed({ actionKey: 'vm_snapshot_create', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[3] || '') });
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    const snapshotRef = nextDemoOpaqueRef('snapshot');
    const snapshot = {
      ref: snapshotRef,
      uuid: snapshotRef.replace('OpaqueRef:', '') + '-uuid',
      name_label: body.nameLabel,
      name_description: body.nameDescription || '',
      snapshot_time: new Date().toISOString(),
      snapshot_of: ref,
      is_a_snapshot: true,
      snapshot_mode: body.mode === 'checkpoint' ? 'checkpoint' : 'snapshot',
      power_state: vm.power_state || 'Halted',
    };

    if (!demoDb.vmSnapshots[ref]) {
      demoDb.vmSnapshots[ref] = [];
    }

    demoDb.vmSnapshots[ref].unshift(snapshot);
    return clone(snapshot);
  }

  if (method === 'POST' && /\/api\/vms\/.+\/snapshots\/.+\/revert$/.test(path)) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const snapshotRef = decodeURIComponent(path.split('/')[5] || '');
    ensureDemoMutationAllowed({
      actionKey: 'vm_snapshot_revert',
      entityType: 'vm-snapshot',
      entityRef: snapshotRef,
      destructive: true,
      approvalId: body.approvalId || '',
    });

    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    const snapshot = (demoDb.vmSnapshots[ref] || []).find((entry) => entry.ref === snapshotRef);
    if (!vm) throw new Error('VM_NOT_FOUND');
    if (!snapshot) throw new Error('VM_SNAPSHOT_NOT_FOUND');

    vm.last_reverted_snapshot = snapshot.ref;
    vm.last_reverted_at = new Date().toISOString();
    return { success: true, snapshotRef };
  }

  if (method === 'DELETE' && /\/api\/vms\/.+\/snapshots\/.+$/.test(path)) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const snapshotRef = decodeURIComponent(path.split('/')[5] || '');
    ensureDemoMutationAllowed({
      actionKey: 'vm_snapshot_delete',
      entityType: 'vm-snapshot',
      entityRef: snapshotRef,
      destructive: true,
      approvalId: body.approvalId || '',
    });

    const snapshots = demoDb.vmSnapshots[ref] || [];
    const nextSnapshots = snapshots.filter((entry) => entry.ref !== snapshotRef);
    if (nextSnapshots.length === snapshots.length) throw new Error('VM_SNAPSHOT_NOT_FOUND');
    demoDb.vmSnapshots[ref] = nextSnapshots;
    return { success: true, snapshotRef };
  }

  if (method === 'GET' && path.startsWith('/api/vms/') && path.endsWith('/export')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const metadataOnly = parsedUrl.searchParams.get('metadataOnly') === 'true';
    const vm = demoDb.vms.find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');

    const vbdRefs = new Set(Array.isArray(vm.VBDs) ? vm.VBDs : []);
    const vifRefs = new Set(Array.isArray(vm.VIFs) ? vm.VIFs : []);
    const disks = Object.values(demoDb.vdis)
      .flat()
      .filter((entry) => Array.isArray(entry.VBDs) && entry.VBDs.some((vbdRef) => vbdRefs.has(vbdRef)));
    const networks = demoDb.networks
      .filter((entry) => Array.isArray(entry.VIFs) && entry.VIFs.some((vifRef) => vifRefs.has(vifRef)));
    const targetVm = demoDb.vms.find((entry) => entry.ref === ref);
    if (targetVm) {
      targetVm.last_export_at = new Date().toISOString();
      targetVm.last_export_mode = metadataOnly ? 'metadata' : 'xva';
    }

    recordDemoAudit({
      category: 'vms',
      action: metadataOnly ? 'vm_metadata_exported' : 'vm_xva_exported',
      actionLabel: metadataOnly ? 'Exported VM metadata for' : 'Exported VM package for',
      entityType: 'vm',
      entityRef: ref,
      entityName: vm.name_label || ref,
      route: '/vms',
      after: targetVm || vm,
      detail: `${vm.name_label || ref} exported as ${metadataOnly ? 'metadata-only archive' : 'full XVA package'}.`,
    });

    return {
      filename: `${String(vm.name_label || 'vm').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'vm'}${metadataOnly ? '-metadata' : ''}.xva`,
      contentType: 'application/octet-stream',
      content: JSON.stringify({
        exportedAt: new Date().toISOString(),
        metadataOnly,
        vm: clone(vm),
        disks: metadataOnly ? [] : clone(disks),
        networks: clone(networks),
      }, null, 2),
    };
  }

  if (method === 'GET' && path.startsWith('/api/vms/') && path.endsWith('/compatibility')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = buildDemoVmInventory(targetKey).find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');
    return clone(buildDemoVmCompatibility(vm, targetKey));
  }

  if (method === 'GET' && path.startsWith('/api/vms/') && path.endsWith('/consoles')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    const vm = buildDemoVmInventory(targetKey).find((entry) => entry.ref === ref);
    if (!vm) throw new Error('VM_NOT_FOUND');
    const consoles = buildDemoVmConsoles(vm, targetKey);
    return { total: consoles.length, data: clone(consoles) };
  }

  if (method === 'GET' && path.startsWith('/api/vms/')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    return clone(buildDemoVmInventory(targetKey).find((vm) => vm.ref === ref) || {});
  }

  return undefined;
}
