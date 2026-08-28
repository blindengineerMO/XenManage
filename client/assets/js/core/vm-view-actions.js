function findVmRecordByRef(vms = [], ref = '') {
  const normalizedRef = String(ref || '').trim();
  if (!normalizedRef) return null;
  return (Array.isArray(vms) ? vms : []).find((entry) => entry.ref === normalizedRef) || null;
}

async function resolveVmActionApprovalId(action, ref, target = null, vms = [], selectedVM = null, resolveApproval = resolveGovernanceApproval) {
  const vm = findVmRecordByRef(vms, ref) || selectedVM;
  const approvalRequest = buildVmGovernanceApprovalRequest(action, ref, vm, target);
  if (!approvalRequest) return '';
  return resolveApproval(approvalRequest);
}

async function executeVmPowerAction(api, action, ref, options = {}, approvalId = '') {
  return api.vmAction(action, ref, approvalId ? { ...options, approvalId } : options);
}

async function executeBulkVmPowerAction(targets = [], runAction) {
  let completed = 0;
  for (const vm of (Array.isArray(targets) ? targets : [])) {
    try {
      await runAction(vm);
      completed += 1;
    } catch (error) {
      error.completed = completed;
      throw error;
    }
  }
  return completed;
}

function refreshSelectedVmAfterBulkAction(vms = [], selectedVM = null) {
  if (!selectedVM?.ref) return selectedVM;
  return findVmRecordByRef(vms, selectedVM.ref) || selectedVM;
}

async function saveVmConfigRecord(api, vmRef, payload) {
  return api.updateVMConfig(vmRef, payload);
}

async function attachVmDiskDevice(api, vmRef, payload) {
  return api.addVMDisk(vmRef, payload);
}

function applyVmDiskAttachmentResult(selectedVM, relatedVdis = [], payload = {}, result = {}, now = Date.now) {
  const nextVbdRef = result?.vbdRef || `generated-vbd-${now()}`;
  const nextVdiRef = result?.vdiRef || `generated-vdi-${now()}`;

  return {
    selectedVM: {
      ...(selectedVM || {}),
      VBDs: [...(selectedVM?.VBDs || []), nextVbdRef],
    },
    relatedVdis: [
      ...(Array.isArray(relatedVdis) ? relatedVdis : []),
      {
        ref: nextVdiRef,
        SR: payload.srRef,
        name_label: payload.nameLabel,
        virtual_size: payload.sizeBytes,
        type: 'user',
        managed: true,
        VBDs: [nextVbdRef],
      },
    ],
  };
}

async function attachVmNicDevice(api, vmRef, payload) {
  return api.addVMNic(vmRef, payload);
}

function applyVmNicAttachmentResult(selectedVM, relatedNetworks = [], payload = {}, result = {}, now = Date.now) {
  const nextVifRef = result?.vifRef || `generated-vif-${now()}`;

  return {
    selectedVM: {
      ...(selectedVM || {}),
      VIFs: [...(selectedVM?.VIFs || []), nextVifRef],
    },
    relatedNetworks: (Array.isArray(relatedNetworks) ? relatedNetworks : []).map((network) => (
      network.ref === payload.networkRef
        ? { ...network, VIFs: [...(network.VIFs || []), nextVifRef] }
        : network
    )),
  };
}

async function duplicateVmRecord(api, vmRef, payload) {
  return api.duplicateVM(vmRef, payload);
}

async function exportVmArchive(api, vmRef, metadataOnly = false) {
  return api.exportVM(vmRef, { metadataOnly });
}

function buildVmExportFilename(result = {}, metadataOnly = false) {
  return result.filename || (metadataOnly ? 'vm-metadata.xva' : 'vm-export.xva');
}

async function migrateVmRecord(api, vmRef, payload) {
  return api.migrateVM(vmRef, payload);
}

function buildVmMigrationCompletionMessage(selectedVM, payload = {}, record = {}) {
  const vmLabel = selectedVM?.name_label || selectedVM?.uuid || selectedVM?.ref || 'VM';
  return payload.mode === 'cross-pool'
    ? `VM migration completed for ${vmLabel} onto ${record?.destinationTargetKey || payload.destinationTargetKey || 'the selected target fabric'}.`
    : `VM migration completed for ${vmLabel} onto ${payload.hostRef || 'the selected host'}.`;
}

function findMigratedVmRecord(vms = [], record = {}) {
  return (Array.isArray(vms) ? vms : []).find((entry) => entry.ref === record.destinationVmRef)
    || (Array.isArray(vms) ? vms : []).find((entry) => record.destinationVmUuid && entry.uuid === record.destinationVmUuid)
    || (Array.isArray(vms) ? vms : []).find((entry) => entry.name_label && entry.name_label === record.name_label)
    || null;
}

function buildVmMigrationTaskSyncErrorMessage() {
  return 'The VM migration completed, but the source remediation task could not be updated automatically.';
}

async function importVmArchive(api, payload) {
  return api.importVM(payload);
}

function buildVmImportCompletionMessage(result = {}, payload = {}) {
  const archiveLabel = result.fileName || payload.fileName || 'Archive';
  return result?.metadataOnly
    ? `${archiveLabel} metadata imported successfully.`
    : `${archiveLabel} imported successfully.`;
}

async function createVmSnapshotRecord(api, vmRef, payload) {
  return api.createVMSnapshot(vmRef, payload);
}

async function executeVmSnapshotRecordAction(api, action, vmRef, snapshotRef, approvalId = '') {
  const payload = approvalId ? { approvalId } : {};
  if (action === 'revert') {
    return api.revertVMSnapshot(vmRef, snapshotRef, payload);
  }
  return api.deleteVMSnapshot(vmRef, snapshotRef, payload);
}
