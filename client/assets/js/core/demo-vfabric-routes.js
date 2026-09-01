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
    return enrichDemoVFabric(record, actor);
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
    return { success: true };
  }

  return undefined;
}
