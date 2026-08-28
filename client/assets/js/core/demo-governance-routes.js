function handleDemoGovernanceRoutes(method, path, body) {
  if (method === 'GET' && path === '/api/governance') {
    const approvals = listDemoGovernanceApprovals();
    const quotaRows = buildDemoQuotaRows();
    return {
      generatedAt: '2026-08-21T15:20:00.000Z',
      policy: clone(demoDb.governancePolicy),
      currentRole: getDemoGovernanceState().currentRole,
      quotas: clone(demoDb.governanceQuotas),
      approvals,
      quotaRows,
      userSummary: getDemoUserSummary(),
      summary: {
        pendingApprovalCount: approvals.filter((entry) => entry.status === 'pending').length,
        approvedApprovalCount: approvals.filter((entry) => entry.status === 'approved').length,
        enforcedQuotaCount: demoDb.governanceQuotas.filter((entry) => entry.enabled).length,
        poolCount: demoDb.pools.length,
      },
    };
  }

  if (method === 'PUT' && path === '/api/governance/policy') {
    ensureDemoMutationAllowed({ actionKey: 'governance_policy_save', entityType: 'policy', entityRef: 'governance.policy' });
    const previous = clone(demoDb.governancePolicy);
    demoDb.governancePolicy = {
      defaultRole: body.defaultRole || 'admin',
      requireDestructiveApproval: body.requireDestructiveApproval !== false,
      approvalTtlMinutes: Number(body.approvalTtlMinutes || 240),
    };
    recordDemoAudit({
      category: 'governance',
      action: 'governance_policy_saved',
      actionLabel: 'Saved governance policy for',
      entityType: 'policy',
      entityRef: 'governance.policy',
      entityName: 'Governance Policy',
      route: '/governance',
      before: previous,
      after: demoDb.governancePolicy,
      detail: `${demoDb.governancePolicy.defaultRole} default role with ${demoDb.governancePolicy.requireDestructiveApproval ? 'approval-gated' : 'direct'} destructive actions.`,
    });
    return clone(demoDb.governancePolicy);
  }

  if (method === 'PUT' && path === '/api/governance/role') {
    const previousRole = store.governance?.currentRole || demoDb.governancePolicy.defaultRole || 'admin';
    const desiredRole = body.role || previousRole;
    const currentUserRole = store.user?.role || 'admin';
    const roleOrder = { 'read-only': 0, operator: 1, admin: 2 };
    if ((roleOrder[desiredRole] ?? 0) > (roleOrder[currentUserRole] ?? 0)) {
      const error = new Error('ROLE_ESCALATION_NOT_ALLOWED');
      error.code = 'ROLE_ESCALATION_NOT_ALLOWED';
      throw error;
    }
    store.governance = {
      ...store.governance,
      currentRole: desiredRole,
      policy: clone(demoDb.governancePolicy),
    };
    recordDemoAudit({
      category: 'governance',
      action: 'governance_role_switched',
      actionLabel: 'Switched governance role for',
      entityType: 'session',
      entityRef: 'demo-session',
      entityName: store.username || 'demo',
      route: '/governance',
      before: { role: previousRole },
      after: { role: store.governance.currentRole },
      detail: `Session role changed from ${previousRole} to ${store.governance.currentRole}.`,
    });
    return { role: store.governance.currentRole };
  }

  if (method === 'GET' && path === '/api/users') {
    const data = listDemoUsers();
    return {
      total: data.length,
      data,
      summary: getDemoUserSummary(),
    };
  }

  if (method === 'POST' && path === '/api/users') {
    const duplicate = demoDb.users.find((entry) => String(entry.username || '').toLowerCase() === String(body.username || '').toLowerCase());
    if (duplicate) {
      const error = new Error('USERNAME_ALREADY_EXISTS');
      error.code = 'USERNAME_ALREADY_EXISTS';
      throw error;
    }
    const record = {
      id: nextDemoId(demoDb.users),
      username: body.username || '',
      display_name: body.displayName || '',
      email: body.email || '',
      role: body.role || 'operator',
      active: body.active !== false,
      created_at: new Date().toISOString(),
      last_login_at: '',
    };
    demoDb.users.push(record);
    applyDemoUserGroupMembership(record.id, body.groupIds || []);
    const responseRecord = listDemoUsers().find((entry) => Number(entry.id) === Number(record.id)) || record;
    recordDemoAudit({
      category: 'governance',
      action: 'user_created',
      actionLabel: 'Created local user',
      entityType: 'user',
      entityRef: String(record.id),
      entityName: record.username,
      route: '/governance',
      before: null,
      after: responseRecord,
      detail: `Created local ${record.role} account ${record.username}${record.active ? '' : ' in a disabled state'}.`,
    });
    return clone(responseRecord);
  }

  if (method === 'PUT' && path.startsWith('/api/users/')) {
    const userId = Number(path.split('/')[3] || 0);
    const roleOrder = { 'read-only': 0, operator: 1, admin: 2 };
    const index = demoDb.users.findIndex((entry) => Number(entry.id) === userId);
    if (index === -1) {
      const error = new Error('USER_NOT_FOUND');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    const previous = clone(demoDb.users[index]);
    const duplicate = demoDb.users.find((entry) =>
      Number(entry.id) !== userId
      && String(entry.username || '').toLowerCase() === String(body.username || previous.username || '').toLowerCase()
    );
    if (duplicate) {
      const error = new Error('USERNAME_ALREADY_EXISTS');
      error.code = 'USERNAME_ALREADY_EXISTS';
      throw error;
    }
    const activeAdminsExcludingCurrent = demoDb.users.filter((entry) =>
      Number(entry.id) !== userId && entry.active !== false && entry.role === 'admin'
    ).length;
    const nextRole = body.role || previous.role || 'operator';
    const nextActive = body.active !== false;
    if (previous.role === 'admin' && previous.active !== false && (nextRole !== 'admin' || !nextActive) && !activeAdminsExcludingCurrent) {
      const error = new Error('LAST_ACTIVE_ADMIN_REQUIRED');
      error.code = 'LAST_ACTIVE_ADMIN_REQUIRED';
      throw error;
    }
    demoDb.users[index] = {
      ...demoDb.users[index],
      username: body.username || previous.username,
      display_name: body.displayName || '',
      email: body.email || '',
      role: nextRole,
      active: nextActive,
    };
    applyDemoUserGroupMembership(userId, body.groupIds || []);
    const responseRecord = listDemoUsers().find((entry) => Number(entry.id) === Number(userId)) || demoDb.users[index];
    if (String(store.user?.id || '') === String(userId)) {
      store.user = {
        ...store.user,
        username: responseRecord.username,
        displayName: responseRecord.display_name || responseRecord.username,
        role: responseRecord.role,
      };
      if ((roleOrder[store.governance.currentRole] ?? 0) > (roleOrder[responseRecord.role] ?? 0)) {
        store.governance.currentRole = responseRecord.role;
      }
    }
    recordDemoAudit({
      category: 'governance',
      action: 'user_updated',
      actionLabel: 'Updated local user',
      entityType: 'user',
      entityRef: String(userId),
      entityName: responseRecord.username,
      route: '/governance',
      before: previous,
      after: responseRecord,
      detail: `Updated local account ${responseRecord.username} (${responseRecord.role}, ${responseRecord.active ? 'active' : 'disabled'}).`,
    });
    return clone(responseRecord);
  }

  if (method === 'POST' && path.startsWith('/api/users/') && path.endsWith('/password')) {
    const userId = Number(path.split('/')[3] || 0);
    const index = demoDb.users.findIndex((entry) => Number(entry.id) === userId);
    if (index === -1) {
      const error = new Error('USER_NOT_FOUND');
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    recordDemoAudit({
      category: 'governance',
      action: 'user_password_reset',
      actionLabel: 'Reset password for',
      entityType: 'user',
      entityRef: String(userId),
      entityName: demoDb.users[index].username,
      route: '/governance',
      before: clone(demoDb.users[index]),
      after: { ...clone(demoDb.users[index]), password: 'rotated' },
      detail: `Rotated the local password for ${demoDb.users[index].username}.`,
    });
    return { success: true, user: clone(demoDb.users[index]) };
  }

  if (method === 'GET' && path === '/api/groups') {
    const data = listDemoGroups();
    return {
      total: data.length,
      data,
    };
  }

  if (method === 'POST' && path === '/api/groups') {
    const duplicate = demoDb.groups.find((entry) => String(entry.name || '').toLowerCase() === String(body.name || '').toLowerCase());
    if (duplicate) {
      const error = new Error('GROUP_NAME_ALREADY_EXISTS');
      error.code = 'GROUP_NAME_ALREADY_EXISTS';
      throw error;
    }

    const record = {
      id: nextDemoId(demoDb.groups),
      name: body.name || '',
      created_at: new Date().toISOString(),
      memberUserIds: [...new Set((body.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean))],
    };
    demoDb.groups.push(record);
    const responseRecord = listDemoGroups().find((entry) => Number(entry.id) === Number(record.id)) || record;
    recordDemoAudit({
      category: 'governance',
      action: 'group_created',
      actionLabel: 'Created local group',
      entityType: 'group',
      entityRef: String(record.id),
      entityName: record.name,
      route: '/governance',
      before: null,
      after: responseRecord,
      detail: `Created local group ${record.name} with ${responseRecord.member_count || 0} assigned member${(responseRecord.member_count || 0) === 1 ? '' : 's'}.`,
    });
    return clone(responseRecord);
  }

  if (method === 'PUT' && path.startsWith('/api/groups/')) {
    const groupId = Number(path.split('/')[3] || 0);
    const index = demoDb.groups.findIndex((entry) => Number(entry.id) === groupId);
    if (index === -1) {
      const error = new Error('GROUP_NOT_FOUND');
      error.code = 'GROUP_NOT_FOUND';
      throw error;
    }

    const duplicate = demoDb.groups.find((entry) =>
      Number(entry.id) !== groupId
      && String(entry.name || '').toLowerCase() === String(body.name || '').toLowerCase()
    );
    if (duplicate) {
      const error = new Error('GROUP_NAME_ALREADY_EXISTS');
      error.code = 'GROUP_NAME_ALREADY_EXISTS';
      throw error;
    }

    const previous = listDemoGroups().find((entry) => Number(entry.id) === Number(groupId)) || clone(demoDb.groups[index]);
    demoDb.groups[index] = {
      ...demoDb.groups[index],
      name: body.name || demoDb.groups[index].name || '',
      memberUserIds: [...new Set((body.memberUserIds || []).map((value) => Number(value || 0)).filter(Boolean))],
    };
    const responseRecord = listDemoGroups().find((entry) => Number(entry.id) === Number(groupId)) || demoDb.groups[index];
    recordDemoAudit({
      category: 'governance',
      action: 'group_updated',
      actionLabel: 'Updated local group',
      entityType: 'group',
      entityRef: String(groupId),
      entityName: responseRecord.name,
      route: '/governance',
      before: previous,
      after: responseRecord,
      detail: `Updated local group ${responseRecord.name} and synchronized ${responseRecord.member_count || 0} member assignment${(responseRecord.member_count || 0) === 1 ? '' : 's'}.`,
    });
    return clone(responseRecord);
  }

  if (method === 'DELETE' && path.startsWith('/api/groups/')) {
    const groupId = Number(path.split('/')[3] || 0);
    const index = demoDb.groups.findIndex((entry) => Number(entry.id) === groupId);
    if (index === -1) {
      const error = new Error('GROUP_NOT_FOUND');
      error.code = 'GROUP_NOT_FOUND';
      throw error;
    }

    const previous = listDemoGroups().find((entry) => Number(entry.id) === Number(groupId)) || clone(demoDb.groups[index]);
    demoDb.groups.splice(index, 1);
    recordDemoAudit({
      category: 'governance',
      action: 'group_deleted',
      actionLabel: 'Removed local group',
      entityType: 'group',
      entityRef: String(groupId),
      entityName: previous.name,
      route: '/governance',
      before: previous,
      after: { success: true },
      detail: `Removed local group ${previous.name} from the control-plane access catalog.`,
    });
    return { success: true };
  }

  if (method === 'PUT' && path.startsWith('/api/governance/quotas/')) {
    ensureDemoMutationAllowed({ actionKey: 'governance_quota_save', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.governanceQuotas.find((entry) => entry.poolRef === poolRef) || null;
    const record = {
      poolRef,
      enabled: body.enabled !== false,
      owner: body.owner || '',
      maxVmCount: Number(body.maxVmCount || 0),
      maxRunningVmCount: Number(body.maxRunningVmCount || 0),
      maxTotalMemoryGiB: Number(body.maxTotalMemoryGiB || 0),
      notes: body.notes || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.governanceQuotas.findIndex((entry) => entry.poolRef === poolRef);
    if (index === -1) demoDb.governanceQuotas.push(record);
    else demoDb.governanceQuotas[index] = record;
    recordDemoAudit({
      category: 'governance',
      action: 'governance_quota_saved',
      actionLabel: 'Saved governance quota for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/governance',
      before: previous,
      after: record,
      detail: `${record.maxVmCount || 0} VM cap and ${record.maxTotalMemoryGiB || 0} GiB cap configured.`,
    });
    return clone(record);
  }

  if (method === 'DELETE' && path.startsWith('/api/governance/quotas/')) {
    ensureDemoMutationAllowed({ actionKey: 'governance_quota_delete', entityType: 'pool', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const poolRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.governanceQuotas.find((entry) => entry.poolRef === poolRef) || null;
    demoDb.governanceQuotas = demoDb.governanceQuotas.filter((entry) => entry.poolRef !== poolRef);
    recordDemoAudit({
      category: 'governance',
      action: 'governance_quota_removed',
      actionLabel: 'Removed governance quota for',
      entityType: 'pool',
      entityRef: poolRef,
      entityName: poolRef,
      route: '/governance',
      before: previous,
      after: { success: true },
      detail: 'Pool quota record removed from the governance policy store.',
    });
    return { success: true };
  }

  if (method === 'POST' && path === '/api/governance/approvals') {
    const record = {
      id: `approval-${Date.now()}`,
      actionKey: body.actionKey || '',
      entityType: body.entityType || 'resource',
      entityRef: body.entityRef || '',
      entityName: body.entityName || '',
      requestedBy: store.username || 'demo',
      justification: body.justification || '',
      route: body.route || '',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + Number(demoDb.governancePolicy.approvalTtlMinutes || 240) * 60000).toISOString(),
      decidedBy: '',
      decidedAt: '',
      decisionNotes: '',
      usedBy: '',
      usedAt: '',
    };
    demoDb.governanceApprovals.unshift(record);
    recordDemoAudit({
      category: 'governance',
      action: 'governance_approval_requested',
      actionLabel: 'Requested governance approval for',
      entityType: record.entityType,
      entityRef: record.entityRef,
      entityName: record.entityName || record.entityRef,
      route: '/governance',
      status: 'pending',
      before: null,
      after: record,
      detail: `${record.actionKey} requested with a pending approval window until ${record.expiresAt}.`,
    });
    return clone(record);
  }

  if (method === 'POST' && path.startsWith('/api/governance/approvals/') && path.endsWith('/decision')) {
    const approvalId = decodeURIComponent(path.split('/')[4] || '');
    const index = demoDb.governanceApprovals.findIndex((entry) => entry.id === approvalId);
    if (index === -1) throw new Error('APPROVAL_NOT_FOUND');
    const previous = clone(demoDb.governanceApprovals[index]);
    demoDb.governanceApprovals[index] = {
      ...demoDb.governanceApprovals[index],
      status: body.decision === 'rejected' ? 'rejected' : 'approved',
      decidedBy: store.username || 'demo',
      decidedAt: new Date().toISOString(),
      decisionNotes: body.notes || '',
    };
    recordDemoAudit({
      category: 'governance',
      action: body.decision === 'rejected' ? 'governance_approval_rejected' : 'governance_approval_approved',
      actionLabel: body.decision === 'rejected' ? 'Rejected governance approval for' : 'Approved governance approval for',
      entityType: demoDb.governanceApprovals[index].entityType,
      entityRef: demoDb.governanceApprovals[index].entityRef,
      entityName: demoDb.governanceApprovals[index].entityName || demoDb.governanceApprovals[index].entityRef,
      route: '/governance',
      status: body.decision === 'rejected' ? 'warning' : 'success',
      before: previous,
      after: demoDb.governanceApprovals[index],
      detail: `${demoDb.governanceApprovals[index].actionKey} request is now ${demoDb.governanceApprovals[index].status}.`,
    });
    return clone(demoDb.governanceApprovals[index]);
  }

  return undefined;
}
