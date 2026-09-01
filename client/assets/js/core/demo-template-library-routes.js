function buildDemoTemplateLibraryTree() {
  const actor = getDemoActor();
  const folders = demoDb.templateLibraryFolders.filter((record) => demoRecordIsVisible(record, actor));
  const items = demoDb.templateLibraryItems.filter((record) => demoRecordIsVisible(record, actor));

  const folderNodes = new Map(folders.map((folder) => [folder.id, {
    id: folder.id,
    type: 'folder',
    name: folder.name,
    parentId: folder.parent_id,
    ownerUserId: folder.owner_user_id,
    visibility: folder.visibility,
    createdAt: folder.created_at,
    canManage: demoCanManageRecord(folder, actor),
    children: [],
  }]));

  const itemNodes = items.map((item) => ({
    id: item.id,
    type: 'item',
    kind: item.kind,
    name: item.name,
    language: item.language,
    version: item.version,
    folderId: item.folder_id,
    ownerUserId: item.owner_user_id,
    visibility: item.visibility,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    canManage: demoCanManageRecord(item, actor),
  }));

  const roots = [];
  for (const folder of folderNodes.values()) {
    if (folder.parentId && folderNodes.has(folder.parentId)) {
      folderNodes.get(folder.parentId).children.push(folder);
    } else {
      roots.push(folder);
    }
  }
  for (const item of itemNodes) {
    if (item.folderId && folderNodes.has(item.folderId)) {
      folderNodes.get(item.folderId).children.push(item);
    } else {
      roots.push(item);
    }
  }

  const sortNode = (node) => {
    if (node.type !== 'folder') return;
    node.children.sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : String(a.name).localeCompare(String(b.name))));
    node.children.forEach(sortNode);
  };
  roots.sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : String(a.name).localeCompare(String(b.name))));
  roots.forEach(sortNode);

  return roots;
}

function handleDemoTemplateLibraryRoutes(method, path, body) {
  if (method === 'GET' && path === '/api/template-library/tree') {
    return { data: buildDemoTemplateLibraryTree() };
  }

  if (method === 'POST' && path === '/api/template-library/folders') {
    ensureDemoMutationAllowed({ actionKey: 'template_library_folder_create', entityType: 'template-library-folder', entityRef: 'new' });
    const actor = getDemoActor();
    const record = {
      id: nextDemoId(demoDb.templateLibraryFolders),
      parent_id: body.parentId || null,
      name: body.name,
      owner_user_id: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      created_at: new Date().toISOString(),
    };
    demoDb.templateLibraryFolders.push(record);
    return enrichDemoOwnedRecord(record, actor);
  }

  const folderMatch = path.match(/^\/api\/template-library\/folders\/(\d+)(\/move)?$/);
  if (folderMatch) {
    const id = Number(folderMatch[1]);
    const isMove = Boolean(folderMatch[2]);
    const record = demoDb.templateLibraryFolders.find((entry) => entry.id === id);
    if (!record) throw new Error('TEMPLATE_LIBRARY_FOLDER_NOT_FOUND');
    const actor = getDemoActor();
    if (!demoCanManageRecord(record, actor)) {
      const error = new Error('TEMPLATE_LIBRARY_FOLDER_FORBIDDEN');
      error.code = 'TEMPLATE_LIBRARY_FOLDER_FORBIDDEN';
      throw error;
    }

    if (method === 'PUT' && !isMove) {
      ensureDemoMutationAllowed({ actionKey: 'template_library_folder_rename', entityType: 'template-library-folder', entityRef: String(id) });
      record.name = body.name;
      return enrichDemoOwnedRecord(record, actor);
    }

    if (method === 'POST' && isMove) {
      ensureDemoMutationAllowed({ actionKey: 'template_library_folder_move', entityType: 'template-library-folder', entityRef: String(id) });
      record.parent_id = body.parentId || null;
      return enrichDemoOwnedRecord(record, actor);
    }

    if (method === 'DELETE') {
      ensureDemoMutationAllowed({ actionKey: 'template_library_folder_delete', entityType: 'template-library-folder', entityRef: String(id), destructive: true });
      const removeIds = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        demoDb.templateLibraryFolders.forEach((entry) => {
          if (entry.parent_id && removeIds.has(entry.parent_id) && !removeIds.has(entry.id)) {
            removeIds.add(entry.id);
            grew = true;
          }
        });
      }
      demoDb.templateLibraryFolders = demoDb.templateLibraryFolders.filter((entry) => !removeIds.has(entry.id));
      demoDb.templateLibraryItems = demoDb.templateLibraryItems.filter((entry) => !removeIds.has(entry.folder_id));
      return { success: true };
    }
  }

  if (method === 'POST' && path === '/api/template-library/items') {
    ensureDemoMutationAllowed({ actionKey: 'template_library_item_create', entityType: 'template-library-item', entityRef: 'new' });
    const actor = getDemoActor();
    const now = new Date().toISOString();
    const record = {
      id: nextDemoId(demoDb.templateLibraryItems),
      folder_id: body.folderId || null,
      kind: body.kind || 'snippet',
      name: body.name,
      language: body.language || 'json',
      content: body.content || '',
      version: 1,
      owner_user_id: actor.userId,
      visibility: actor.userId ? normalizeDemoVisibility(body.visibility, 'private') : 'shared',
      created_at: now,
      updated_at: now,
    };
    demoDb.templateLibraryItems.push(record);
    return enrichDemoOwnedRecord(record, actor);
  }

  const itemMatch = path.match(/^\/api\/template-library\/items\/(\d+)(\/move|\/rename|\/versions)?$/);
  if (itemMatch) {
    const id = Number(itemMatch[1]);
    const suffix = itemMatch[2] || '';
    const record = demoDb.templateLibraryItems.find((entry) => entry.id === id);
    if (!record) throw new Error('TEMPLATE_LIBRARY_ITEM_NOT_FOUND');
    const actor = getDemoActor();
    if (!demoCanManageRecord(record, actor) && method !== 'GET') {
      const error = new Error('TEMPLATE_LIBRARY_ITEM_FORBIDDEN');
      error.code = 'TEMPLATE_LIBRARY_ITEM_FORBIDDEN';
      throw error;
    }

    if (method === 'GET' && suffix === '') {
      return enrichDemoOwnedRecord(record, actor);
    }

    if (method === 'GET' && suffix === '/versions') {
      return { data: [{ id: 1, item_id: id, version: record.version, saved_by: record.owner_user_id, saved_at: record.updated_at || record.created_at }] };
    }

    if (method === 'PUT' && suffix === '/rename') {
      ensureDemoMutationAllowed({ actionKey: 'template_library_item_rename', entityType: 'template-library-item', entityRef: String(id) });
      record.name = body.name;
      return enrichDemoOwnedRecord(record, actor);
    }

    if (method === 'POST' && suffix === '/move') {
      ensureDemoMutationAllowed({ actionKey: 'template_library_item_move', entityType: 'template-library-item', entityRef: String(id) });
      record.folder_id = body.folderId || null;
      return enrichDemoOwnedRecord(record, actor);
    }

    if (method === 'PUT' && suffix === '') {
      ensureDemoMutationAllowed({ actionKey: 'template_library_item_save', entityType: 'template-library-item', entityRef: String(id) });
      record.content = body.content || '';
      record.version = Number(record.version || 1) + 1;
      record.updated_at = new Date().toISOString();
      return enrichDemoOwnedRecord(record, actor);
    }

    if (method === 'DELETE' && suffix === '') {
      ensureDemoMutationAllowed({ actionKey: 'template_library_item_delete', entityType: 'template-library-item', entityRef: String(id), destructive: true });
      demoDb.templateLibraryItems = demoDb.templateLibraryItems.filter((entry) => entry.id !== id);
      return { success: true };
    }
  }

  return undefined;
}
