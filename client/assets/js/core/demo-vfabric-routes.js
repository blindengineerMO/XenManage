function getDemoVFabricMembers(record, actor = getDemoActor()) {
  const connectionIds = Array.isArray(record.connection_ids) ? record.connection_ids : [];
  const hostTargetIds = Array.isArray(record.host_target_ids) ? record.host_target_ids : [];
  const pools = demoDb.connections
    .filter((connection) => connectionIds.includes(connection.id) && demoRecordIsVisible(connection, actor))
    .map((connection) => ({
      kind: 'pool',
      target_id: connection.id,
      name: connection.name,
      host: connection.host,
      visibility: connection.visibility,
      owner_user_id: connection.owner_user_id,
    }));
  const hosts = demoDb.hostTargets
    .filter((target) => hostTargetIds.includes(target.id) && demoRecordIsVisible(target, actor))
    .map((target) => ({
      kind: 'host',
      target_id: target.id,
      name: target.name,
      host: target.host,
      visibility: target.visibility,
      owner_user_id: target.owner_user_id,
    }));

  return [...pools, ...hosts];
}

function enrichDemoVFabric(record, actor = getDemoActor()) {
  return {
    ...enrichDemoOwnedRecord(record, actor),
    members: getDemoVFabricMembers(record, actor),
  };
}

function getDemoVFabricScope(record, actor = getDemoActor()) {
  const members = getDemoVFabricMembers(record, actor);
  const attached = Array.isArray(store.connectedTargets) ? store.connectedTargets : [];
  const attachedTargets = members.map((member) => {
    const target = attached.find((candidate) => (
      member.kind === 'pool'
        ? Number(candidate.connectionId || 0) === Number(member.target_id)
        : Number(candidate.hostTargetId || 0) === Number(member.target_id)
    ));
    return target ? {
      targetKey: target.targetKey,
      connectionId: target.connectionId || null,
      hostTargetId: target.hostTargetId || null,
      connectionName: target.connectionName || member.name,
      host: target.host || member.host,
      username: target.username || '',
      port: target.port || 443,
      kind: member.kind,
      connected: true,
    } : null;
  }).filter(Boolean);
  return {
    scope: {
      id: record.id,
      name: record.name,
      description: record.description || '',
      colorTag: record.color_tag || 'green',
      memberCount: members.length,
      attachedTargetCount: attachedTargets.length,
      unavailableMemberCount: members.length - attachedTargets.length,
    },
    attachedTargets,
    unavailableMembers: members.filter((member) => !attachedTargets.some((target) => (
      member.kind === 'pool'
        ? Number(target.connectionId || 0) === Number(member.target_id)
        : Number(target.hostTargetId || 0) === Number(member.target_id)
    ))).map((member) => ({
      kind: member.kind,
      targetId: member.target_id,
      name: member.name,
      host: member.host,
    })),
  };
}

function validateDemoVFabricMembers(body, actor) {
  const connectionIds = Array.isArray(body.connectionIds) ? body.connectionIds.map(Number) : [];
  const hostTargetIds = Array.isArray(body.hostTargetIds) ? body.hostTargetIds.map(Number) : [];
  const allowed = (record) => record && demoRecordIsVisible(record, actor);
  if (connectionIds.some((id) => !allowed(demoDb.connections.find((record) => record.id === id)))
    || hostTargetIds.some((id) => !allowed(demoDb.hostTargets.find((record) => record.id === id)))) {
    const error = new Error('VFABRIC_MEMBER_FORBIDDEN');
    error.code = 'VFABRIC_MEMBER_FORBIDDEN';
    throw error;
  }
  return { connectionIds: [...new Set(connectionIds)], hostTargetIds: [...new Set(hostTargetIds)] };
}

function requireDemoVFabricQuotaAdmin() {
  if (getDemoGovernanceState().currentRole === 'admin') return;
  const error = new Error('An administrator role is required to manage vFabric quotas.');
  error.code = 'ADMIN_ROLE_REQUIRED';
  throw error;
}

function getDemoVFabricQuota(vFabricId) {
  return demoDb.vfabricQuotas.find((quota) => Number(quota.vFabricId) === Number(vFabricId)) || null;
}

function getDemoMemberHostRefs(member) {
  if (member.kind === 'pool') {
    const pool = demoDb.pools.find((entry) => entry.name_label === member.name);
    return demoDb.hosts.filter((host) => host.pool === pool?.ref).map((host) => host.ref);
  }
  return demoDb.hosts
    .filter((host) => host.address === member.host || host.name_label === member.name)
    .map((host) => host.ref);
}

function evaluateDemoVFabricQuota(record, actor = getDemoActor(), requestedVm = null) {
  const quota = getDemoVFabricQuota(record.id);
  const scope = getDemoVFabricScope(record, actor);
  const attachedMembers = getDemoVFabricMembers(record, actor).filter((member) => scope.attachedTargets.some((target) => (
    member.kind === 'pool'
      ? Number(target.connectionId || 0) === Number(member.target_id)
      : Number(target.hostTargetId || 0) === Number(member.target_id)
  )));
  const hostRefs = new Set(attachedMembers.flatMap(getDemoMemberHostRefs));
  const vms = demoDb.vms.filter((vm) => !vm.is_a_template && (hostRefs.has(vm.resident_on) || hostRefs.has(vm.affinity)));
  const usage = {
    vmCount: vms.length,
    runningVmCount: vms.filter((vm) => String(vm.power_state || '').toLowerCase() === 'running').length,
    totalMemoryGiB: Math.round((vms.reduce((sum, vm) => sum + Number(vm.memory_static_max || vm.memory_dynamic_max || 0), 0) / (1024 ** 3)) * 10) / 10,
  };
  const evaluation = quota?.enabled ? {
    projected: {
      vmCount: usage.vmCount + (requestedVm ? 1 : 0),
      runningVmCount: usage.runningVmCount + (requestedVm?.startAfter ? 1 : 0),
      totalMemoryGiB: Math.round((usage.totalMemoryGiB + (requestedVm ? Number(requestedVm.memoryStaticMax || 0) / (1024 ** 3) : 0)) * 10) / 10,
    },
    breaches: [],
  } : null;
  if (evaluation) {
    if (quota.maxVmCount > 0 && evaluation.projected.vmCount > quota.maxVmCount) evaluation.breaches.push('VM count');
    if (quota.maxRunningVmCount > 0 && evaluation.projected.runningVmCount > quota.maxRunningVmCount) evaluation.breaches.push('running VM count');
    if (quota.maxTotalMemoryGiB > 0 && evaluation.projected.totalMemoryGiB > quota.maxTotalMemoryGiB) evaluation.breaches.push('memory allocation');
  }
  const coverageComplete = scope.scope.memberCount > 0 && scope.unavailableMembers.length === 0;
  const status = !quota?.enabled ? 'success' : !coverageComplete ? 'warning' : evaluation.breaches.length ? 'critical' : 'info';
  const detail = !quota?.enabled
    ? 'No vFabric quota is currently enforced for this scope.'
    : !coverageComplete
      ? `Quota coverage is incomplete: ${scope.unavailableMembers.length} member target${scope.unavailableMembers.length === 1 ? '' : 's'} must be attached before this aggregate can be enforced.`
      : evaluation.breaches.length
        ? `vFabric quota pressure is present for ${evaluation.breaches.join(', ')}.`
        : 'vFabric quota is configured and aggregate usage remains within the allowed envelope.';
  return {
    vFabricId: record.id,
    vFabricName: record.name,
    quota: quota ? clone(quota) : null,
    status,
    detail,
    coverageComplete,
    usage,
    evaluation,
    targetUsage: scope.attachedTargets.map((target) => ({ targetKey: target.targetKey })),
    attachedTargetCount: scope.attachedTargets.length,
    memberCount: scope.scope.memberCount,
    unavailableMembers: scope.unavailableMembers,
  };
}

function enforceDemoVFabricQuotas(targetKey, requestedVm = {}) {
  const target = (store.connectedTargets || []).find((entry) => entry.targetKey === targetKey);
  if (!target) return;
  const actor = getDemoActor();
  demoDb.vfabricQuotas.filter((quota) => quota.enabled).forEach((quota) => {
    const record = demoDb.vfabrics.find((entry) => entry.id === quota.vFabricId);
    const applies = record?.connection_ids?.includes(Number(target.connectionId))
      || record?.host_target_ids?.includes(Number(target.hostTargetId));
    if (!applies) return;
    const evaluation = evaluateDemoVFabricQuota(record, actor, requestedVm);
    if (!evaluation.coverageComplete) {
      const error = new Error(`Cannot verify vFabric quota for "${record.name}" because not all member targets are attached.`);
      error.code = 'VFABRIC_QUOTA_SCOPE_INCOMPLETE';
      throw error;
    }
    if (evaluation.evaluation?.breaches.length) {
      const error = new Error(`The deployment would exceed vFabric quota "${record.name}" for ${evaluation.evaluation.breaches.join(', ')}.`);
      error.code = 'VFABRIC_QUOTA_EXCEEDED';
      throw error;
    }
  });
}

function handleDemoVFabricRoutes(method, path, body = {}) {
  if (method === 'GET' && path === '/api/vfabrics') {
    const actor = getDemoActor();
    const records = demoDb.vfabrics
      .filter((record) => demoRecordIsVisible(record, actor))
      .map((record) => enrichDemoVFabric(record, actor));
    return { total: records.length, data: records };
  }

  if (method === 'GET' && path.startsWith('/api/vfabrics/')) {
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const record = demoDb.vfabrics.find((entry) => entry.id === id);
    if (!record || !demoRecordIsVisible(record, actor)) throw new Error('VFABRIC_NOT_FOUND');
    if (path.endsWith('/scope')) return getDemoVFabricScope(record, actor);
    if (path.endsWith('/quota')) return evaluateDemoVFabricQuota(record, actor);
    return enrichDemoVFabric(record, actor);
  }

  if (method === 'PUT' && path.startsWith('/api/vfabrics/') && path.endsWith('/quota')) {
    const id = Number(path.split('/')[3]);
    ensureDemoMutationAllowed({ actionKey: 'vfabric_quota_save', entityType: 'vfabric', entityRef: String(id) });
    requireDemoVFabricQuotaAdmin();
    const actor = getDemoActor();
    const fabric = demoDb.vfabrics.find((entry) => entry.id === id);
    if (!fabric) throw new Error('VFABRIC_NOT_FOUND');
    if (!demoCanManageRecord(fabric, actor)) throw new Error('VFABRIC_FORBIDDEN');
    const previous = getDemoVFabricQuota(id);
    const quota = {
      vFabricId: id,
      enabled: body.enabled !== false,
      owner: body.owner || '',
      maxVmCount: Number(body.maxVmCount || 0),
      maxRunningVmCount: Number(body.maxRunningVmCount || 0),
      maxTotalMemoryGiB: Number(body.maxTotalMemoryGiB || 0),
      notes: body.notes || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.vfabricQuotas.findIndex((entry) => entry.vFabricId === id);
    if (index === -1) demoDb.vfabricQuotas.push(quota);
    else demoDb.vfabricQuotas[index] = quota;
    recordDemoAudit({ category: 'governance', action: 'vfabric_quota_saved', actionLabel: 'Saved vFabric quota for', entityType: 'vfabric', entityRef: String(id), entityName: fabric.name, route: '/vfabrics', before: previous, after: quota, detail: `${quota.maxVmCount || 0} VM cap and ${quota.maxTotalMemoryGiB || 0} GiB cap configured across the vFabric.` });
    return clone(quota);
  }

  if (method === 'DELETE' && path.startsWith('/api/vfabrics/') && path.endsWith('/quota')) {
    const id = Number(path.split('/')[3]);
    ensureDemoMutationAllowed({ actionKey: 'vfabric_quota_delete', entityType: 'vfabric', entityRef: String(id), destructive: true });
    requireDemoVFabricQuotaAdmin();
    const actor = getDemoActor();
    const fabric = demoDb.vfabrics.find((entry) => entry.id === id);
    if (!fabric) throw new Error('VFABRIC_NOT_FOUND');
    if (!demoCanManageRecord(fabric, actor)) throw new Error('VFABRIC_FORBIDDEN');
    const previous = getDemoVFabricQuota(id);
    demoDb.vfabricQuotas = demoDb.vfabricQuotas.filter((entry) => entry.vFabricId !== id);
    recordDemoAudit({ category: 'governance', action: 'vfabric_quota_removed', actionLabel: 'Removed vFabric quota for', entityType: 'vfabric', entityRef: String(id), entityName: fabric.name, route: '/vfabrics', before: previous, after: { success: true }, detail: 'Aggregate vFabric quota removed from the governance policy store.' });
    return { success: true };
  }

  if (method === 'POST' && path === '/api/vfabrics') {
    ensureDemoMutationAllowed({ actionKey: 'vfabric_create', entityType: 'vfabric', entityRef: 'new' });
    const actor = getDemoActor();
    const members = validateDemoVFabricMembers(body, actor);
    const now = new Date().toISOString();
    const record = {
      id: nextDemoId(demoDb.vfabrics),
      name: String(body.name || '').trim(),
      description: String(body.description || ''),
      color_tag: ['green', 'cyan', 'amber', 'red'].includes(body.colorTag) ? body.colorTag : 'green',
      owner_user_id: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      connection_ids: members.connectionIds,
      host_target_ids: members.hostTargetIds,
      created_at: now,
      updated_at: now,
    };
    demoDb.vfabrics.push(record);
    return enrichDemoVFabric(record, actor);
  }

  if (method === 'PUT' && path.startsWith('/api/vfabrics/')) {
    const id = Number(path.split('/')[3]);
    ensureDemoMutationAllowed({ actionKey: 'vfabric_update', entityType: 'vfabric', entityRef: String(id) });
    const actor = getDemoActor();
    const record = demoDb.vfabrics.find((entry) => entry.id === id);
    if (!record) throw new Error('VFABRIC_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('VFABRIC_FORBIDDEN');
      error.code = 'VFABRIC_FORBIDDEN';
      throw error;
    }
    const members = validateDemoVFabricMembers(body, actor);
    Object.assign(record, {
      name: String(body.name || '').trim(),
      description: String(body.description || ''),
      color_tag: ['green', 'cyan', 'amber', 'red'].includes(body.colorTag) ? body.colorTag : 'green',
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, record.visibility || 'private') : 'shared',
      connection_ids: members.connectionIds,
      host_target_ids: members.hostTargetIds,
      updated_at: new Date().toISOString(),
    });
    return enrichDemoVFabric(record, actor);
  }

  if (method === 'DELETE' && path.startsWith('/api/vfabrics/')) {
    const id = Number(path.split('/')[3]);
    ensureDemoMutationAllowed({ actionKey: 'vfabric_delete', entityType: 'vfabric', entityRef: String(id), destructive: true });
    const actor = getDemoActor();
    const index = demoDb.vfabrics.findIndex((entry) => entry.id === id);
    if (index === -1) throw new Error('VFABRIC_NOT_FOUND');
    if (!demoCanManageRecord(demoDb.vfabrics[index], actor)) {
      const error = new Error('VFABRIC_FORBIDDEN');
      error.code = 'VFABRIC_FORBIDDEN';
      throw error;
    }
    demoDb.vfabrics.splice(index, 1);
    demoDb.vfabricQuotas = demoDb.vfabricQuotas.filter((entry) => entry.vFabricId !== id);
    return { success: true };
  }

  return undefined;
}
