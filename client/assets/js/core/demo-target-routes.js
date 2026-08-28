function handleDemoTargetRoutes(method, path, body) {
  if (method === 'GET' && path === '/api/connections') {
    return listDemoConnections();
  }

  if (method === 'POST' && path === '/api/connections') {
    ensureDemoMutationAllowed({ actionKey: 'connection_create', entityType: 'connection', entityRef: 'new' });
    const actor = getDemoActor();
    const nextRecord = {
      id: nextDemoId(demoDb.connections),
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      owner_user_id: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      is_default: body.isDefault ? 1 : 0,
      last_connected_at: '',
    };

    if (nextRecord.is_default) {
      demoDb.connections.forEach((connection) => {
        if (Number(connection.owner_user_id || 0) === Number(nextRecord.owner_user_id || 0)) {
          connection.is_default = 0;
        }
      });
    }

    demoDb.connections.push(nextRecord);
    return enrichDemoOwnedRecord(nextRecord, actor);
  }

  if (method === 'PUT' && path.startsWith('/api/connections/')) {
    ensureDemoMutationAllowed({ actionKey: 'connection_update', entityType: 'connection', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const record = demoDb.connections.find((connection) => connection.id === id);
    if (!record) throw new Error('CONNECTION_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('CONNECTION_FORBIDDEN');
      error.code = 'CONNECTION_FORBIDDEN';
      throw error;
    }

    Object.assign(record, {
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, record.visibility || 'private') : 'shared',
      owner_user_id: record.owner_user_id || actor.userId || null,
      is_default: body.isDefault ? 1 : 0,
    });

    if (record.is_default) {
      demoDb.connections.forEach((connection) => {
        if (connection.id !== id && Number(connection.owner_user_id || 0) === Number(record.owner_user_id || 0)) {
          connection.is_default = 0;
        }
      });
    }

    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'POST' && path.startsWith('/api/connections/') && path.endsWith('/default')) {
    ensureDemoMutationAllowed({ actionKey: 'connection_default', entityType: 'connection', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const record = demoDb.connections.find((connection) => connection.id === id);
    if (!record) throw new Error('CONNECTION_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('CONNECTION_FORBIDDEN');
      error.code = 'CONNECTION_FORBIDDEN';
      throw error;
    }

    demoDb.connections.forEach((connection) => {
      if (Number(connection.owner_user_id || 0) === Number(record.owner_user_id || 0)) {
        connection.is_default = connection.id === id ? 1 : 0;
      }
    });
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'DELETE' && path.startsWith('/api/connections/')) {
    ensureDemoMutationAllowed({ actionKey: 'connection_delete', entityType: 'connection', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const index = demoDb.connections.findIndex((connection) => connection.id === id);
    if (index === -1) throw new Error('CONNECTION_NOT_FOUND');
    if (!demoCanManageRecord(demoDb.connections[index], actor)) {
      const error = new Error('CONNECTION_FORBIDDEN');
      error.code = 'CONNECTION_FORBIDDEN';
      throw error;
    }
    demoDb.connections.splice(index, 1);
    return { success: true };
  }

  if (method === 'GET' && path === '/api/host-targets') {
    return listDemoHostTargets();
  }

  if (method === 'POST' && path === '/api/host-targets') {
    ensureDemoMutationAllowed({ actionKey: 'host_target_create', entityType: 'host-target', entityRef: 'new' });
    const actor = getDemoActor();
    const pool = demoDb.connections.find((connection) => connection.id === Number(body.poolConnectionId || 0));
    const record = {
      id: nextDemoId(demoDb.hostTargets),
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      owner_user_id: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      mode: body.mode || 'standalone',
      pool_connection_id: body.mode === 'pool-member' ? Number(body.poolConnectionId || 0) || null : null,
      pool_name: body.mode === 'pool-member' ? (pool?.name || null) : null,
      notes: body.notes || '',
    };
    demoDb.hostTargets.push(record);
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'PUT' && path.startsWith('/api/host-targets/')) {
    ensureDemoMutationAllowed({ actionKey: 'host_target_update', entityType: 'host-target', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const record = demoDb.hostTargets.find((target) => target.id === id);
    const pool = demoDb.connections.find((connection) => connection.id === Number(body.poolConnectionId || 0));
    if (!record) throw new Error('HOST_TARGET_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('HOST_TARGET_FORBIDDEN');
      error.code = 'HOST_TARGET_FORBIDDEN';
      throw error;
    }

    Object.assign(record, {
      name: body.name,
      host: body.host,
      username: body.username,
      port: body.port || 443,
      owner_user_id: record.owner_user_id || actor.userId || null,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, record.visibility || 'private') : 'shared',
      mode: body.mode || 'standalone',
      pool_connection_id: body.mode === 'pool-member' ? Number(body.poolConnectionId || 0) || null : null,
      pool_name: body.mode === 'pool-member' ? (pool?.name || null) : null,
      notes: body.notes || '',
    });
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'DELETE' && path.startsWith('/api/host-targets/')) {
    ensureDemoMutationAllowed({ actionKey: 'host_target_delete', entityType: 'host-target', entityRef: String(path.split('/')[3]) });
    const actor = getDemoActor();
    const id = Number(path.split('/')[3]);
    const index = demoDb.hostTargets.findIndex((target) => target.id === id);
    if (index === -1) throw new Error('HOST_TARGET_NOT_FOUND');
    if (!demoCanManageRecord(demoDb.hostTargets[index], actor)) {
      const error = new Error('HOST_TARGET_FORBIDDEN');
      error.code = 'HOST_TARGET_FORBIDDEN';
      throw error;
    }
    demoDb.hostTargets.splice(index, 1);
    return { success: true };
  }

  if (method === 'GET' && path === '/api/workspaces/inventory') {
    const workspaces = listDemoInventoryWorkspaces();
    return { total: workspaces.length, data: clone(workspaces) };
  }

  if (method === 'POST' && path === '/api/workspaces/inventory') {
    ensureDemoMutationAllowed({ actionKey: 'inventory_workspace_save', entityType: 'workspace', entityRef: 'new' });
    const actor = getDemoActor();
    const record = {
      id: `workspace-${demoDb.inventoryWorkspaces.length + 1}`,
      name: body.name,
      scope: body.scope || 'all',
      query: body.query || '',
      targetConnectionId: body.targetConnectionId ?? null,
      notes: body.notes || '',
      ownerUserId: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: store.username || 'demo',
    };
    demoDb.inventoryWorkspaces.unshift(record);
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'PUT' && path.startsWith('/api/workspaces/inventory/')) {
    ensureDemoMutationAllowed({ actionKey: 'inventory_workspace_save', entityType: 'workspace', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const actor = getDemoActor();
    const id = decodeURIComponent(path.split('/')[4] || '');
    const record = demoDb.inventoryWorkspaces.find((workspace) => workspace.id === id);
    if (!record) throw new Error('INVENTORY_WORKSPACE_NOT_FOUND');
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('INVENTORY_WORKSPACE_FORBIDDEN');
      error.code = 'INVENTORY_WORKSPACE_FORBIDDEN';
      throw error;
    }

    Object.assign(record, {
      name: body.name,
      scope: body.scope || 'all',
      query: body.query || '',
      targetConnectionId: body.targetConnectionId ?? null,
      notes: body.notes || '',
      ownerUserId: record.ownerUserId || actor.userId || null,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, record.visibility || 'private') : 'shared',
      updatedAt: new Date().toISOString(),
    });
    return enrichDemoOwnedRecord(record, actor);
  }

  if (method === 'DELETE' && path.startsWith('/api/workspaces/inventory/')) {
    ensureDemoMutationAllowed({ actionKey: 'inventory_workspace_delete', entityType: 'workspace', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const actor = getDemoActor();
    const id = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.inventoryWorkspaces.findIndex((workspace) => workspace.id === id);
    if (index === -1) throw new Error('INVENTORY_WORKSPACE_NOT_FOUND');
    if (!demoCanManageRecord(demoDb.inventoryWorkspaces[index], actor)) {
      const error = new Error('INVENTORY_WORKSPACE_FORBIDDEN');
      error.code = 'INVENTORY_WORKSPACE_FORBIDDEN';
      throw error;
    }
    demoDb.inventoryWorkspaces.splice(index, 1);
    return { success: true };
  }

  return undefined;
}
