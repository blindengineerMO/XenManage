const DEMO_MANAGED_TARGET_SCOPES = ['demo-fabric', 'demo-edge'];

function demoManagedTargetEligibility(connection) {
  if (!connection || connection.visibility !== 'shared' || connection.owner_user_id) {
    return { ok: false, code: 'MANAGED_TARGET_REQUIRES_SHARED_CONNECTION' };
  }
  if (!connection.vault_credential_id) {
    return { ok: false, code: 'MANAGED_TARGET_CREDENTIAL_REQUIRED' };
  }
  return { ok: true };
}

function getDemoManagedTargets() {
  return Object.entries(demoDb.managedTargetOverrides)
    .map(([connectionId, override]) => {
      const connection = demoDb.connections.find((entry) => entry.id === Number(connectionId));
      if (!connection) return null;
      const index = demoDb.connections.indexOf(connection);
      return {
        id: connection.id,
        targetKey: DEMO_MANAGED_TARGET_SCOPES[index] || DEMO_MANAGED_TARGET_SCOPES[0],
        connectionId: connection.id,
        name: connection.name,
        host: connection.host,
        enabled: Boolean(override.enabled),
        state: override.state || 'Offline',
        lastError: override.lastError || '',
        lastCheckedAt: override.lastCheckedAt || '',
      };
    })
    .filter(Boolean);
}

function getDemoManagedTargetIdForTargetKey(targetKey) {
  const normalized = String(targetKey || '').trim() || 'demo-fabric';
  const target = getDemoManagedTargets().find((entry) => entry.targetKey === normalized);
  return target ? target.id : getDemoManagedTargets()[0]?.id || null;
}

function enrichDemoOrganization(record) {
  return clone(record);
}

function enrichDemoProject(record) {
  const organization = demoDb.organizations.find((entry) => entry.id === record.organization_id);
  return {
    ...clone(record),
    organization_name: organization?.name || '',
    quota: getDemoProjectQuota(record.id),
    members: demoDb.projectMembers.filter((member) => member.project_id === record.id),
  };
}

function getDemoProjectQuota(projectId) {
  return demoDb.projectQuotas.find((quota) => Number(quota.project_id) === Number(projectId)) || null;
}

function getDemoProjectById(id) {
  const record = demoDb.projects.find((entry) => entry.id === Number(id));
  return record ? enrichDemoProject(record) : null;
}

function canAccessDemoProject(project, actor) {
  if (!project.enabled) return false;
  if (actor.role === 'admin') return true;
  if (Number(project.owner_user_id || 0) === Number(actor.userId || 0)) return true;
  return project.members.some((member) => Number(member.user_id) === Number(actor.userId || 0));
}

function requireDemoProjectOwnerOrAdmin(project, actor) {
  if (actor.role === 'admin') return;
  if (Number(project.owner_user_id || 0) === Number(actor.userId || 0)) return;
  const error = new Error('PROJECT_FORBIDDEN');
  error.code = 'PROJECT_FORBIDDEN';
  throw error;
}

const DEMO_BYTES_PER_GIB = 1024 ** 3;

function getDemoProjectUsage(project) {
  const refs = new Set(demoDb.projectResourceAssignments
    .filter((assignment) => assignment.project_id === project.id && assignment.resource_type === 'vm')
    .map((assignment) => assignment.resource_ref));
  const vms = demoDb.vms.filter((vm) => refs.has(vm.ref) && !vm.is_a_template);
  return vms.reduce((usage, vm) => ({
    vmCount: usage.vmCount + 1,
    vcpus: usage.vcpus + Number(vm.VCPUs_at_startup || vm.VCPUs_max || 0),
    memoryGiB: usage.memoryGiB + Number(vm.memory_static_max || vm.memory_dynamic_max || 0) / DEMO_BYTES_PER_GIB,
    storageGiB: usage.storageGiB,
    gpuCount: usage.gpuCount + (vm.VGPUs?.length ? 1 : 0),
    networkCount: usage.networkCount + Number(vm.VIFs?.length || 0),
  }), { vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, gpuCount: 0, networkCount: 0 });
}

function toDemoRequestedVm(input = {}) {
  const diskPlan = input.diskPlan || [];
  return {
    vmCount: 1,
    vcpus: Number(input.vcpus || 0),
    memoryGiB: Number(input.memoryGiB || 0),
    storageGiB: diskPlan.reduce((sum, disk) => sum + Number(disk.sizeGiB || 0), 0),
    gpuCount: input.vgpuTypeRef || input.gpuGroupRef ? 1 : 0,
    networkCount: (input.networkInterfaces || []).length,
  };
}

function evaluateDemoProjectQuota(project, requestedVm = null) {
  const usage = getDemoProjectUsage(project);
  const requested = requestedVm ? toDemoRequestedVm(requestedVm) : { vmCount: 0, vcpus: 0, memoryGiB: 0, storageGiB: 0, gpuCount: 0, networkCount: 0 };
  const quota = project.quota;
  const projected = {
    vmCount: usage.vmCount + requested.vmCount,
    vcpus: usage.vcpus + requested.vcpus,
    memoryGiB: usage.memoryGiB + requested.memoryGiB,
    storageGiB: usage.storageGiB + requested.storageGiB,
    gpuCount: usage.gpuCount + requested.gpuCount,
    networkCount: usage.networkCount + requested.networkCount,
  };
  const limits = [
    ['VM count', 'max_vm_count', 'vmCount'], ['vCPU', 'max_vcpus', 'vcpus'], ['memory', 'max_memory_gib', 'memoryGiB'],
    ['storage', 'max_storage_gib', 'storageGiB'], ['GPU', 'max_gpu_count', 'gpuCount'], ['network', 'max_network_count', 'networkCount'],
  ];
  const breaches = quota?.enabled
    ? limits.filter(([, limit, metric]) => Number(quota[limit] || 0) > 0 && projected[metric] > Number(quota[limit])).map(([label]) => label)
    : [];
  return { usage, requested, evaluation: { projected, breaches } };
}

function enforceDemoProjectQuota(projectId, targetKey, requestedVm) {
  const project = getDemoProjectById(projectId);
  if (!project) throw new Error('PROJECT_NOT_FOUND');
  const managedTargetId = getDemoManagedTargetIdForTargetKey(targetKey);
  if (project.target_ids.length && (!managedTargetId || !project.target_ids.includes(managedTargetId))) {
    const error = new Error('PROJECT_TARGET_FORBIDDEN');
    error.code = 'PROJECT_TARGET_FORBIDDEN';
    throw error;
  }
  const { evaluation } = evaluateDemoProjectQuota(project, requestedVm);
  if (evaluation.breaches.length) {
    const error = new Error(`The requested VM would exceed project quota for ${evaluation.breaches.join(', ')}.`);
    error.code = 'PROJECT_QUOTA_EXCEEDED';
    throw error;
  }
  return { project, managedTargetId };
}

function assignDemoProjectResource(projectId, managedTargetId, resourceType, resourceRef) {
  demoDb.projectResourceAssignments.push({
    project_id: Number(projectId), managed_target_id: managedTargetId, resource_type: resourceType, resource_ref: resourceRef, assigned_at: new Date().toISOString(),
  });
}

function handleDemoProjectsRoutes(method, path, body = {}) {
  if (method === 'GET' && path === '/api/managed-targets') {
    const data = getDemoManagedTargets();
    return { total: data.length, data };
  }

  if (method === 'POST' && path === '/api/managed-targets') {
    ensureDemoMutationAllowed({ actionKey: 'managed_target_register', entityType: 'managed-target', entityRef: String(body.connectionId) });
    const connection = demoDb.connections.find((entry) => entry.id === Number(body.connectionId));
    if (!connection) throw new Error('CONNECTION_NOT_FOUND');
    const eligibility = demoManagedTargetEligibility(connection);
    if (!eligibility.ok) {
      const error = new Error(eligibility.code);
      error.code = eligibility.code;
      throw error;
    }
    demoDb.managedTargetOverrides[connection.id] = {
      enabled: body.enabled !== false,
      state: 'Healthy',
      lastError: '',
      lastCheckedAt: new Date().toISOString(),
    };
    return getDemoManagedTargets().find((entry) => entry.connectionId === connection.id);
  }

  if (method === 'PUT' && /^\/api\/managed-targets\/\d+$/.test(path)) {
    const connectionId = Number(path.split('/')[3]);
    ensureDemoMutationAllowed({ actionKey: 'managed_target_update', entityType: 'managed-target', entityRef: String(connectionId) });
    const existing = demoDb.managedTargetOverrides[connectionId];
    if (!existing) throw new Error('MANAGED_TARGET_NOT_FOUND');
    existing.enabled = Boolean(body.enabled);
    existing.state = existing.enabled ? 'Healthy' : 'Maintenance';
    existing.lastError = '';
    existing.lastCheckedAt = new Date().toISOString();
    return getDemoManagedTargets().find((entry) => entry.connectionId === connectionId);
  }

  if (method === 'POST' && /^\/api\/managed-targets\/\d+\/check$/.test(path)) {
    const connectionId = Number(path.split('/')[3]);
    const existing = demoDb.managedTargetOverrides[connectionId];
    if (!existing) throw new Error('MANAGED_TARGET_NOT_FOUND');
    existing.lastCheckedAt = new Date().toISOString();
    if (existing.enabled) existing.state = 'Healthy';
    return getDemoManagedTargets().find((entry) => entry.connectionId === connectionId);
  }

  if (method === 'GET' && path === '/api/projects/organizations') {
    return { data: demoDb.organizations.map(enrichDemoOrganization) };
  }

  if (method === 'POST' && path === '/api/projects/organizations') {
    ensureDemoMutationAllowed({ actionKey: 'organization_create', entityType: 'organization', entityRef: 'new' });
    const now = new Date().toISOString();
    const record = { id: nextDemoId(demoDb.organizations), name: String(body.name || '').trim(), description: String(body.description || ''), created_at: now, updated_at: now };
    demoDb.organizations.push(record);
    return enrichDemoOrganization(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/projects/organizations/')) {
    const id = Number(path.split('/')[4]);
    ensureDemoMutationAllowed({ actionKey: 'organization_delete', entityType: 'organization', entityRef: String(id), destructive: true });
    demoDb.organizations = demoDb.organizations.filter((entry) => entry.id !== id);
    return { success: true };
  }

  if (method === 'GET' && path === '/api/projects') {
    const actor = getDemoActor();
    const data = demoDb.projects.map(enrichDemoProject).filter((project) => canAccessDemoProject(project, actor));
    return { data };
  }

  if (method === 'POST' && path === '/api/projects') {
    ensureDemoMutationAllowed({ actionKey: 'project_create', entityType: 'project', entityRef: 'new' });
    const actor = getDemoActor();
    const now = new Date().toISOString();
    const record = {
      id: nextDemoId(demoDb.projects),
      organization_id: Number(body.organizationId),
      name: String(body.name || '').trim(),
      description: String(body.description || ''),
      cost_center: String(body.costCenter || ''),
      default_recovery_tier: String(body.defaultRecoveryTier || ''),
      owner_user_id: body.ownerUserId || actor.userId || null,
      enabled: true,
      target_ids: Array.isArray(body.targetIds) ? [...new Set(body.targetIds.map(Number))] : [],
      created_at: now,
      updated_at: now,
    };
    demoDb.projects.push(record);
    return enrichDemoProject(record);
  }

  if (method === 'GET' && /^\/api\/projects\/\d+$/.test(path)) {
    const id = Number(path.split('/')[3]);
    const actor = getDemoActor();
    const project = getDemoProjectById(id);
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    if (!canAccessDemoProject(project, actor)) { const error = new Error('PROJECT_FORBIDDEN'); error.code = 'PROJECT_FORBIDDEN'; throw error; }
    return { ...project, assignments: demoDb.projectResourceAssignments.filter((assignment) => assignment.project_id === id) };
  }

  if (method === 'PUT' && /^\/api\/projects\/\d+$/.test(path)) {
    const id = Number(path.split('/')[3]);
    ensureDemoMutationAllowed({ actionKey: 'project_update', entityType: 'project', entityRef: String(id) });
    const actor = getDemoActor();
    const record = demoDb.projects.find((entry) => entry.id === id);
    if (!record) throw new Error('PROJECT_NOT_FOUND');
    requireDemoProjectOwnerOrAdmin(record, actor);
    Object.assign(record, {
      name: String(body.name || '').trim(),
      description: String(body.description || ''),
      cost_center: String(body.costCenter || ''),
      default_recovery_tier: String(body.defaultRecoveryTier || ''),
      owner_user_id: body.ownerUserId || null,
      enabled: body.enabled !== false,
      target_ids: Array.isArray(body.targetIds) ? [...new Set(body.targetIds.map(Number))] : [],
      updated_at: new Date().toISOString(),
    });
    return enrichDemoProject(record);
  }

  if (method === 'DELETE' && /^\/api\/projects\/\d+$/.test(path)) {
    const id = Number(path.split('/')[3]);
    ensureDemoMutationAllowed({ actionKey: 'project_delete', entityType: 'project', entityRef: String(id), destructive: true });
    const actor = getDemoActor();
    const record = demoDb.projects.find((entry) => entry.id === id);
    if (!record) throw new Error('PROJECT_NOT_FOUND');
    requireDemoProjectOwnerOrAdmin(record, actor);
    demoDb.projects = demoDb.projects.filter((entry) => entry.id !== id);
    demoDb.projectQuotas = demoDb.projectQuotas.filter((entry) => entry.project_id !== id);
    demoDb.projectMembers = demoDb.projectMembers.filter((entry) => entry.project_id !== id);
    demoDb.projectResourceAssignments = demoDb.projectResourceAssignments.filter((entry) => entry.project_id !== id);
    return { success: true };
  }

  if (method === 'PUT' && /^\/api\/projects\/\d+\/quotas$/.test(path)) {
    const id = Number(path.split('/')[3]);
    ensureDemoMutationAllowed({ actionKey: 'project_quota_save', entityType: 'project', entityRef: String(id) });
    const actor = getDemoActor();
    const record = demoDb.projects.find((entry) => entry.id === id);
    if (!record) throw new Error('PROJECT_NOT_FOUND');
    requireDemoProjectOwnerOrAdmin(record, actor);
    const quota = {
      project_id: id,
      enabled: body.enabled !== false,
      max_vm_count: Number(body.maxVmCount || 0),
      max_vcpus: Number(body.maxVcpus || 0),
      max_memory_gib: Number(body.maxMemoryGiB || 0),
      max_storage_gib: Number(body.maxStorageGiB || 0),
      max_gpu_count: Number(body.maxGpuCount || 0),
      max_network_count: Number(body.maxNetworkCount || 0),
    };
    const index = demoDb.projectQuotas.findIndex((entry) => entry.project_id === id);
    if (index === -1) demoDb.projectQuotas.push(quota);
    else demoDb.projectQuotas[index] = quota;
    return clone(quota);
  }

  if (method === 'PUT' && /^\/api\/projects\/\d+\/members\/\d+$/.test(path)) {
    const segments = path.split('/');
    const id = Number(segments[3]);
    const userId = Number(segments[5]);
    ensureDemoMutationAllowed({ actionKey: 'project_member_save', entityType: 'project', entityRef: String(id) });
    const actor = getDemoActor();
    const record = demoDb.projects.find((entry) => entry.id === id);
    if (!record) throw new Error('PROJECT_NOT_FOUND');
    requireDemoProjectOwnerOrAdmin(record, actor);
    const role = ['owner', 'member', 'viewer'].includes(body.role) ? body.role : 'member';
    const existing = demoDb.projectMembers.find((entry) => entry.project_id === id && entry.user_id === userId);
    if (existing) existing.role = role;
    else demoDb.projectMembers.push({ project_id: id, user_id: userId, role });
    return { data: demoDb.projectMembers.filter((entry) => entry.project_id === id) };
  }

  if (method === 'GET' && /^\/api\/projects\/\d+\/quota-evaluation$/.test(path)) {
    const id = Number(path.split('/')[3]);
    const actor = getDemoActor();
    const project = getDemoProjectById(id);
    if (!project) throw new Error('PROJECT_NOT_FOUND');
    if (!canAccessDemoProject(project, actor)) { const error = new Error('PROJECT_FORBIDDEN'); error.code = 'PROJECT_FORBIDDEN'; throw error; }
    const { usage, requested, evaluation } = evaluateDemoProjectQuota(project, null);
    return { project, usage, requested, evaluation, managedTargetId: null };
  }

  return undefined;
}
