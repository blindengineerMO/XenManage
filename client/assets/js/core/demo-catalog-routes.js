function findDemoCatalogEntry(slug) {
  return demoDb.catalogEntries.find((entry) => entry.slug === String(slug || '').trim()) || null;
}

function handleDemoCatalogRoutes(method, path, body = {}) {
  if (method === 'GET' && path === '/api/catalog') {
    return { entries: demoDb.catalogEntries.filter((entry) => entry.visibility === 'published') };
  }
  if (method === 'GET' && path === '/api/catalog/admin/entries') return { entries: demoDb.catalogEntries };
  const versionsMatch = path.match(/^\/api\/catalog\/admin\/entries\/(\d+)\/versions(?:\/(\d+)\/validation)?$/);
  if (versionsMatch) {
    const entry = demoDb.catalogEntries.find((candidate) => candidate.id === Number(versionsMatch[1]));
    if (!entry) throw new Error('CATALOG_ENTRY_NOT_FOUND');
    entry.versions ||= [{ id: entry.id, version_number: 1, lifecycle_stage: entry.visibility === 'published' ? 'stable' : 'draft', validation_status: entry.visibility === 'published' ? 'validated' : 'untested', validation_notes: '', created_at: new Date().toISOString() }];
    entry.currentVersion ||= entry.versions[0];
    if (method === 'GET' && !versionsMatch[2]) return { versions: clone(entry.versions) };
    if (method === 'PUT' && versionsMatch[2]) {
      entry.currentVersion.validation_status = body.validationStatus;
      entry.currentVersion.lifecycle_stage = body.validationStatus === 'validated' ? 'staged' : 'draft';
      entry.currentVersion.validation_notes = body.notes || '';
      return { version: clone(entry.currentVersion) };
    }
  }
  const publishMatch = path.match(/^\/api\/catalog\/admin\/entries\/(\d+)\/publish$/);
  if (method === 'POST' && publishMatch) {
    const entry = demoDb.catalogEntries.find((candidate) => candidate.id === Number(publishMatch[1]));
    if (!entry?.currentVersion || entry.currentVersion.validation_status !== 'validated') throw new Error('CATALOG_VERSION_VALIDATION_REQUIRED');
    entry.visibility = 'published';
    entry.currentVersion.lifecycle_stage = 'stable';
    return { entry: clone(entry) };
  }
  if (method === 'GET' && path === '/api/catalog/admin/requests') return { requests: demoDb.catalogRequests };
  if (method === 'GET' && path === '/api/catalog/admin/analytics') {
    const entries = demoDb.catalogEntries.map((entry) => {
      const requests = demoDb.catalogRequests.filter((request) => request.catalog_entry_id === entry.id);
      return { id: entry.id, slug: entry.slug, title: entry.title, request_volume: requests.length, avg_approval_minutes: requests.length ? 18 : null, active_count: requests.filter((request) => request.status === 'complete').length, reclaimed_count: requests.filter((request) => ['reclaimed', 'expired'].includes(request.status)).length, pending_count: requests.filter((request) => request.status === 'pending').length };
    });
    return { entries, totals: { requestVolume: demoDb.catalogRequests.length, activeCount: entries.reduce((sum, entry) => sum + entry.active_count, 0), reclaimedCount: entries.reduce((sum, entry) => sum + entry.reclaimed_count, 0), pendingCount: entries.reduce((sum, entry) => sum + entry.pending_count, 0) } };
  }
  if (method === 'GET' && path === '/api/catalog/requests/mine') {
    return { requests: demoDb.catalogRequests.filter((entry) => entry.requested_by === getDemoActor().userId) };
  }
  if (method === 'POST' && path === '/api/catalog') {
    const source = demoDb.templateLibraryItems.find((item) => item.id === Number(body.sourceItemId));
    if (!source) throw new Error('CATALOG_SOURCE_INVALID');
    const entry = {
      id: nextDemoId(demoDb.catalogEntries), slug: String(body.slug || '').trim(), title: String(body.title || '').trim(),
      description: String(body.description || ''), source_item_id: source.id, source_kind: source.kind, category: String(body.category || ''),
      tags: [], image_url: String(body.imageUrl || ''), visibility: body.visibility || 'draft',
      naming_pattern: body.namingPattern || 'NODE-XXXX', next_sequence: 1, fixedVariables: body.fixedVariables || {},
      subscriberFields: body.subscriberFields || [], maxActivePerSubscriber: body.maxActivePerSubscriber || null,
      leaseDurationHours: body.leaseDurationHours || null,
      costRates: body.costRates || {},
      targetPoolRefs: body.targetPoolRefs || [],
      requiresApproval: body.approvalPolicy?.mode !== 'auto', approvalPolicy: body.approvalPolicy || { mode: 'manual' },
    };
    demoDb.catalogEntries.push(entry);
    return { entry };
  }

  const entryMatch = path.match(/^\/api\/catalog\/(\d+)$/);
  if (entryMatch) {
    const index = demoDb.catalogEntries.findIndex((entry) => entry.id === Number(entryMatch[1]));
    if (index < 0) throw new Error('CATALOG_ENTRY_NOT_FOUND');
    if (method === 'PUT') {
      const current = demoDb.catalogEntries[index];
      Object.assign(current, {
        title: String(body.title || current.title), slug: String(body.slug || current.slug), description: String(body.description || ''),
        source_item_id: Number(body.sourceItemId || current.source_item_id), category: String(body.category || ''), image_url: String(body.imageUrl || ''),
        visibility: body.visibility || current.visibility, naming_pattern: body.namingPattern || current.naming_pattern,
        subscriberFields: body.subscriberFields || [], fixedVariables: body.fixedVariables || {}, maxActivePerSubscriber: body.maxActivePerSubscriber || null,
        leaseDurationHours: body.leaseDurationHours || null,
        costRates: body.costRates || {},
        targetPoolRefs: body.targetPoolRefs || [],
        requiresApproval: body.approvalPolicy?.mode !== 'auto', approvalPolicy: body.approvalPolicy || current.approvalPolicy,
      });
      return { entry: current };
    }
    if (method === 'DELETE') { demoDb.catalogEntries.splice(index, 1); return { success: true }; }
  }

  const requestMatch = path.match(/^\/api\/catalog\/([^/]+)\/requests$/);
  if (method === 'POST' && requestMatch) {
    const entry = findDemoCatalogEntry(decodeURIComponent(requestMatch[1]));
    if (!entry || entry.visibility !== 'published') throw new Error('CATALOG_ENTRY_NOT_FOUND');
    const request = {
      id: nextDemoId(demoDb.catalogRequests), catalog_entry_id: entry.id, slug: entry.slug, title: entry.title,
      requested_by: getDemoActor().userId, requested_by_name: getDemoActor().username || 'demo-user',
      parameters: body.parameters || {}, parameters_json: JSON.stringify(body.parameters || {}),
      generated_name: '', status: entry.requiresApproval === false ? 'approved' : 'pending', created_at: new Date().toISOString(),
      estimated_monthly_cost: Object.keys(entry.costRates || {}).length ? 46 : null, actual_monthly_cost: null, cost_currency: 'USD',
      approvalSteps: entry.approvalPolicy?.mode === 'multi-step'
        ? entry.approvalPolicy.steps.map((label, index) => ({ id: index + 1, step_order: index + 1, label, status: 'pending', decided_by_user_id: null }))
        : [],
    };
    if (request.status === 'approved') request.generated_name = (entry.naming_pattern || 'NODE-XXXX').replace(/X+/, (xs) => String(entry.next_sequence++).padStart(xs.length, '0'));
    demoDb.catalogRequests.push(request);
    return { request };
  }

  const reviewMatch = path.match(/^\/api\/catalog\/admin\/requests\/(\d+)(\/deploy)?$/);
  if (reviewMatch) {
    const request = demoDb.catalogRequests.find((entry) => entry.id === Number(reviewMatch[1]));
    if (!request) throw new Error('CATALOG_REQUEST_NOT_FOUND');
    if (method === 'PUT' && !reviewMatch[2]) {
      const currentStep = request.approvalSteps?.find((step) => step.status === 'pending');
      if (currentStep && body.status === 'approved') {
        currentStep.status = 'approved';
        currentStep.decided_by_user_id = getDemoActor().userId;
        request.status = request.approvalSteps.some((step) => step.status === 'pending') ? 'pending' : 'approved';
      } else if (currentStep && body.status === 'rejected') {
        currentStep.status = 'rejected';
        currentStep.decided_by_user_id = getDemoActor().userId;
        request.status = 'rejected';
      } else {
        request.status = body.status || request.status;
      }
      if (request.status === 'approved' && !request.generated_name) {
        const entry = demoDb.catalogEntries.find((candidate) => candidate.id === request.catalog_entry_id);
        request.generated_name = (entry?.naming_pattern || 'NODE-XXXX').replace(/X+/, (xs) => String(entry.next_sequence++).padStart(xs.length, '0'));
      }
      return { request };
    }
    if (method === 'POST' && reviewMatch[2]) {
      request.status = 'complete';
      request.deployment_run_id = `demo-catalog-run-${request.id}`;
      const entry = demoDb.catalogEntries.find((candidate) => candidate.id === request.catalog_entry_id);
      request.lease_duration_hours = entry?.leaseDurationHours || null;
      request.lease_expires_at = entry?.leaseDurationHours ? new Date(Date.now() + entry.leaseDurationHours * 3600000).toISOString() : null;
      request.actual_monthly_cost = request.estimated_monthly_cost;
      return { request, deployment: { id: request.deployment_run_id } };
    }
  }
  const actionMatch = path.match(/^\/api\/catalog\/requests\/(\d+)\/actions$/);
  if (method === 'POST' && actionMatch) {
    const request = demoDb.catalogRequests.find((entry) => entry.id === Number(actionMatch[1]));
    if (!request) throw new Error('CATALOG_REQUEST_NOT_FOUND');
    if (body.action === 'decommission') request.status = 'reclaimed';
    return { action: body.action, vmRef: `OpaqueRef:demo-catalog-${request.id}`, result: { success: true }, request: clone(request) };
  }
  return undefined;
}
