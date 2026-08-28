function getDemoChangedFields(before = null, after = null) {
  const left = before && typeof before === 'object' ? before : {};
  const right = after && typeof after === 'object' ? after : {};
  const fields = new Set([...Object.keys(left), ...Object.keys(right)]);

  return [...fields]
    .filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]))
    .slice(0, 12)
    .map((field) => ({
      field,
      before: left[field] === undefined || left[field] === null || left[field] === '' ? '-' : String(left[field]),
      after: right[field] === undefined || right[field] === null || right[field] === '' ? '-' : String(right[field]),
    }));
}

function recordDemoAudit(entry = {}) {
  const before = entry.before ? clone(entry.before) : null;
  const after = entry.after ? clone(entry.after) : null;
  const changedFields = Array.isArray(entry.changedFields) ? clone(entry.changedFields) : getDemoChangedFields(before, after);
  const record = {
    id: entry.id || `audit-${Date.now()}`,
    category: entry.category || 'operations',
    action: entry.action || 'update',
    actionLabel: entry.actionLabel || '',
    entityType: entry.entityType || 'record',
    entityRef: entry.entityRef || '',
    entityName: entry.entityName || '',
    operator: entry.operator || store.username || 'demo',
    route: entry.route || '',
    status: entry.status || 'success',
    before,
    after,
    changedFields,
    summary: entry.summary || `${entry.actionLabel || entry.action || 'Updated'} ${entry.entityName || entry.entityRef || ''}`.trim(),
    detail: entry.detail || '',
    happenedAt: entry.happenedAt || new Date().toISOString(),
  };

  demoDb.auditLog.unshift(record);
  demoDb.auditLog = demoDb.auditLog.slice(0, 200);
  return record;
}

function buildDemoLogEntries() {
  const auditEntries = demoDb.auditLog.map((entry) => ({
    id: `audit:${entry.id}`,
    source: 'audit',
    category: entry.category || 'operations',
    timestamp: entry.happenedAt || '',
    actor: entry.operator || 'demo',
    operator: entry.operator || 'demo',
    entityType: entry.entityType || 'record',
    entityRef: entry.entityRef || '',
    entityName: entry.entityName || '',
    message: entry.summary || entry.detail || entry.actionLabel || entry.action || 'Audit entry',
    detail: entry.detail || '',
    severity: String(entry.status || 'success').toLowerCase(),
    route: entry.route || '',
    status: entry.status || 'success',
    action: entry.action || '',
    raw: clone(entry),
  }));

  const alertEntries = listDemoAlerts().map((entry) => ({
    id: `alert:${entry.ref}`,
    source: 'alert',
    category: 'alerts',
    timestamp: entry.timestamp || '',
    actor: entry.acknowledgedBy || entry.policyName || 'demo',
    operator: entry.acknowledgedBy || entry.policyName || 'demo',
    entityType: 'alert',
    entityRef: entry.ref || '',
    entityName: entry.summary || entry.ref || '',
    message: entry.summary || entry.name || entry.body || 'Alert',
    detail: entry.body || entry.notes || '',
    severity: String(entry.effectiveSeverity || entry.baseSeverity || 'notice').toLowerCase(),
    route: entry.targetRoute || '/alerts',
    status: entry.stateLabel || 'open',
    action: entry.healthAction || '',
    raw: clone(entry),
  }));

  const remediationEntries = demoDb.remediationTasks.map((entry) => ({
    id: `remediation-task:${entry.ref}`,
    source: 'remediation-task',
    category: 'tasks',
    timestamp: entry.finished || entry.updated_at || entry.created || '',
    actor: entry.created_by || entry.assignee || 'demo',
    operator: entry.created_by || entry.assignee || 'demo',
    entityType: 'task',
    entityRef: entry.ref || '',
    entityName: entry.name_label || '',
    message: entry.name_label || 'Remediation task',
    detail: entry.result || entry.name_description || '',
    severity: String(entry.status || 'pending').toLowerCase(),
    route: '/activity',
    status: entry.status || 'pending',
    action: entry.action_type || '',
    raw: clone(entry),
  }));

  const xenTaskEntries = demoDb.tasks.map((entry) => ({
    id: `xen-task:${entry.ref}`,
    source: 'xen-task',
    category: 'tasks',
    timestamp: entry.finished || entry.created || '',
    actor: 'xenserver',
    operator: 'xenserver',
    entityType: 'task',
    entityRef: entry.ref || '',
    entityName: entry.name_label || '',
    message: entry.name_label || 'Xen task',
    detail: entry.result || (Array.isArray(entry.error_info) ? entry.error_info.join(' | ') : ''),
    severity: String(entry.status || 'pending').toLowerCase(),
    route: '/activity',
    status: entry.status || 'pending',
    action: entry.name_label || '',
    raw: clone(entry),
  }));

  return [...auditEntries, ...alertEntries, ...remediationEntries, ...xenTaskEntries]
    .sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

function getDemoGovernanceState() {
  return {
    currentRole: store.governance?.currentRole || demoDb.governancePolicy.defaultRole || 'admin',
    policy: clone(demoDb.governancePolicy),
  };
}

function listDemoGovernanceApprovals() {
  return clone([...demoDb.governanceApprovals].sort((left, right) => new Date(right.requestedAt || 0) - new Date(left.requestedAt || 0)));
}

function listDemoGroups() {
  return clone(
    [...demoDb.groups]
      .map((group) => {
        const memberUserIds = [...new Set((group.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean))];
        const members = memberUserIds
          .map((userId) => demoDb.users.find((user) => Number(user.id) === Number(userId)))
          .filter(Boolean);

        return {
          id: Number(group.id),
          name: group.name || '',
          created_at: group.created_at || '',
          member_count: members.length,
          member_ids: members.map((user) => user.id),
          members: members.map((user) => user.display_name || user.username),
        };
      })
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')))
  );
}

function applyDemoUserGroupMembership(userId, groupIds = []) {
  const normalizedUserId = Number(userId || 0);
  const normalizedGroupIds = [...new Set((Array.isArray(groupIds) ? groupIds : []).map((value) => Number(value || 0)).filter(Boolean))];
  demoDb.groups.forEach((group) => {
    const memberUserIds = new Set((group.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean));
    memberUserIds.delete(normalizedUserId);
    if (normalizedGroupIds.includes(Number(group.id))) {
      memberUserIds.add(normalizedUserId);
    }
    group.memberUserIds = [...memberUserIds];
  });
}

function listDemoUsers() {
  const groups = listDemoGroups();
  return clone(
    [...demoDb.users]
      .map((user) => {
        const memberships = groups.filter((group) => group.member_ids.includes(Number(user.id)));
        return {
          ...user,
          groups: memberships.map((group) => group.name),
          groupsDetailed: memberships.map((group) => ({ id: group.id, name: group.name })),
          group_ids: memberships.map((group) => group.id),
          group_count: memberships.length,
        };
      })
      .sort((left, right) => String(left.username || '').localeCompare(String(right.username || '')))
  );
}

function getDemoUserSummary() {
  return {
    totalUsers: demoDb.users.length,
    activeUsers: demoDb.users.filter((user) => user.active !== false).length,
    activeAdmins: demoDb.users.filter((user) => user.active !== false && user.role === 'admin').length,
    totalGroups: demoDb.groups.length,
  };
}

function getDemoActor() {
  return {
    userId: Number(store.user?.id || 0) || null,
    role: store.user?.role || store.governance?.currentRole || 'admin',
  };
}

function normalizeDemoVisibility(value, fallback = 'private') {
  return value === 'shared' || value === 'private' ? value : fallback;
}

function demoActorIsAdmin(actor = getDemoActor()) {
  return actor.role === 'admin';
}

function demoRecordIsVisible(record, actor = getDemoActor()) {
  if (!record) return false;
  if (demoActorIsAdmin(actor)) return true;

  const ownerUserId = Number(record.owner_user_id || record.ownerUserId || 0) || null;
  const visibility = normalizeDemoVisibility(record.visibility, ownerUserId ? 'private' : 'shared');

  if (visibility === 'shared' || ownerUserId === null) {
    return true;
  }

  return ownerUserId === actor.userId;
}

function demoCanManageRecord(record, actor = getDemoActor()) {
  if (!record) return false;
  if (demoActorIsAdmin(actor)) return true;

  const ownerUserId = Number(record.owner_user_id || record.ownerUserId || 0) || null;
  const visibility = normalizeDemoVisibility(record.visibility, ownerUserId ? 'private' : 'shared');

  if (ownerUserId !== null) {
    return ownerUserId === actor.userId;
  }

  return visibility === 'shared';
}

function enrichDemoOwnedRecord(record, actor = getDemoActor()) {
  if (!record) return null;
  const ownerUserId = Number(record.owner_user_id || record.ownerUserId || 0) || null;
  const owner = demoDb.users.find((entry) => Number(entry.id) === ownerUserId) || null;
  const visibility = normalizeDemoVisibility(record.visibility, ownerUserId ? 'private' : 'shared');

  return {
    ...clone(record),
    owner_user_id: ownerUserId,
    ownerUserId,
    visibility,
    owner_username: owner?.username || '',
    owner_display_name: owner?.display_name || owner?.username || '',
    is_owner: ownerUserId !== null && ownerUserId === actor.userId,
    can_manage: demoCanManageRecord(record, actor),
  };
}

function listDemoConnections() {
  const actor = getDemoActor();
  return demoDb.connections
    .filter((record) => demoRecordIsVisible(record, actor))
    .map((record) => enrichDemoOwnedRecord(record, actor))
    .sort((left, right) => Number(right.is_default || 0) - Number(left.is_default || 0) || String(left.name || '').localeCompare(String(right.name || '')));
}

function listDemoHostTargets() {
  const actor = getDemoActor();
  return demoDb.hostTargets
    .filter((record) => demoRecordIsVisible(record, actor))
    .map((record) => enrichDemoOwnedRecord(record, actor))
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
}

function listDemoInventoryWorkspaces() {
  const actor = getDemoActor();
  return demoDb.inventoryWorkspaces
    .filter((record) => demoRecordIsVisible(record, actor))
    .map((record) => enrichDemoOwnedRecord(record, actor))
    .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
}

function buildDemoQuotaRows() {
  return demoDb.pools.map((pool) => {
    const quota = demoDb.governanceQuotas.find((record) => record.poolRef === pool.ref) || null;
    const poolHosts = demoDb.hosts.filter((host) => host.pool === pool.ref);
    const hostRefs = new Set(poolHosts.map((host) => host.ref));
    const poolVms = demoDb.vms.filter((vm) => !vm.is_a_template && (hostRefs.has(vm.resident_on) || hostRefs.has(vm.affinity)));
    const currentRunningVmCount = poolVms.filter((vm) => String(vm.power_state || '').toLowerCase() === 'running').length;
    const currentTotalMemoryGiB = Math.round((poolVms.reduce((sum, vm) => sum + Number(vm.memory_static_max || vm.memory_dynamic_max || 0), 0) / (1024 ** 3)) * 10) / 10;
    const breaches = [];

    if (quota?.enabled) {
      if (quota.maxVmCount > 0 && poolVms.length > quota.maxVmCount) breaches.push('VM count');
      if (quota.maxRunningVmCount > 0 && currentRunningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
      if (quota.maxTotalMemoryGiB > 0 && currentTotalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');
    }

    return {
      poolRef: pool.ref,
      poolName: pool.name_label || pool.ref,
      status: breaches.length ? 'critical' : quota?.enabled ? 'info' : 'success',
      currentVmCount: poolVms.length,
      currentRunningVmCount,
      currentTotalMemoryGiB,
      quota: quota ? clone(quota) : null,
      detail: breaches.length
        ? `Quota pressure is present for ${breaches.join(', ')}.`
        : quota?.enabled
          ? 'Quota is configured and current usage remains within the allowed envelope.'
          : 'No pool quota is currently enforced for this pool.',
    };
  });
}

function ensureDemoMutationAllowed(options = {}) {
  const governance = getDemoGovernanceState();

  if (governance.currentRole === 'read-only') {
    const error = new Error('The current governance role is read-only. Switch to operator or admin mode before making changes.');
    error.code = 'READ_ONLY_MODE';
    throw error;
  }

  if (options.destructive && governance.currentRole !== 'admin' && governance.policy.requireDestructiveApproval) {
    const approvalId = options.approvalId || '';
    if (!approvalId) {
      const error = new Error('A governance approval is required before this destructive action can run in operator mode.');
      error.code = 'APPROVAL_REQUIRED';
      throw error;
    }

    const index = demoDb.governanceApprovals.findIndex((approval) => approval.id === approvalId);
    const approval = index === -1 ? null : demoDb.governanceApprovals[index];
    if (!approval || approval.status !== 'approved' || approval.actionKey !== options.actionKey || approval.entityRef !== options.entityRef || approval.entityType !== options.entityType) {
      const error = new Error('The provided governance approval is missing, expired, already used, or scoped to a different action.');
      error.code = 'APPROVAL_SCOPE_MISMATCH';
      throw error;
    }

    demoDb.governanceApprovals[index] = {
      ...approval,
      status: 'used',
      usedBy: store.username || 'demo',
      usedAt: new Date().toISOString(),
    };
  }
}
