function buildGovernanceRoles() {
  return [
    { value: 'read-only', label: 'Read Only', detail: 'Browse inventory and reports without changing infrastructure state.' },
    { value: 'operator', label: 'Operator', detail: 'Perform standard changes, with destructive actions gated by approval when policy requires it.' },
    { value: 'admin', label: 'Admin', detail: 'Full access to policy, approval, quota, and user-administration workflows.' },
  ];
}

function formatGovernanceRole(value) {
  if (value === 'read-only') return 'Read Only';
  if (value === 'operator') return 'Operator';
  return 'Admin';
}

function getGovernanceRoleBadgeClass(value) {
  if (value === 'admin') return 'badge-info';
  if (value === 'operator') return 'badge-success';
  return 'badge-warning';
}

function canManageGovernanceUsers(authMode = '', currentRole = '') {
  return authMode === 'local' && currentRole === 'admin';
}

function buildGovernanceSummaryCards({
  summary = {},
  policy = {},
  userSummary = {},
  groups = [],
  currentRole = '',
} = {}) {
  const groupList = Array.isArray(groups) ? groups : [];
  return [
    {
      key: 'role',
      label: 'Current Role',
      value: formatGovernanceRole(currentRole),
      detail: `Default role is ${formatGovernanceRole(policy.defaultRole)}`,
      icon: 'mdi-shield-account-outline',
      valueClass: currentRole === 'read-only' ? 'text-amber' : 'text-green',
    },
    {
      key: 'approvals',
      label: 'Pending Approvals',
      value: String(summary.pendingApprovalCount || 0),
      detail: `${summary.approvedApprovalCount || 0} approved requests remain in the current queue`,
      icon: 'mdi-clipboard-check-outline',
      valueClass: (summary.pendingApprovalCount || 0) ? 'text-amber' : 'text-green',
    },
    {
      key: 'quotas',
      label: 'Enforced Quotas',
      value: String(summary.enforcedQuotaCount || 0),
      detail: `${summary.poolCount || 0} pools currently inspected for quota posture`,
      icon: 'mdi-gauge',
      valueClass: (summary.enforcedQuotaCount || 0) ? 'text-cyan' : 'text-amber',
    },
    {
      key: 'policy',
      label: 'Destructive Gate',
      value: policy.requireDestructiveApproval ? 'Approval Required' : 'Direct Operator Access',
      detail: `Approval tokens expire after ${policy.approvalTtlMinutes || 240} minutes`,
      icon: 'mdi-shield-lock-outline',
      valueClass: policy.requireDestructiveApproval ? 'text-green' : 'text-amber',
    },
    {
      key: 'users',
      label: 'Active Users',
      value: String(userSummary.activeUsers || 0),
      detail: `${userSummary.activeAdmins || 0} active administrators across ${userSummary.totalUsers || 0} local accounts`,
      icon: 'mdi-account-multiple-outline',
      valueClass: (userSummary.activeUsers || 0) > 1 ? 'text-cyan' : 'text-amber',
    },
    {
      key: 'groups',
      label: 'Access Groups',
      value: String(userSummary.totalGroups || groupList.length || 0),
      detail: `${groupList.filter((group) => (group.member_count || 0) > 0).length} groups currently have assigned members`,
      icon: 'mdi-account-group-outline',
      valueClass: (userSummary.totalGroups || groupList.length || 0) ? 'text-green' : 'text-amber',
    },
  ];
}

function buildGovernanceAccessCoverageRows(users = [], groups = [], userSummary = {}) {
  const userList = Array.isArray(users) ? users : [];
  const groupList = Array.isArray(groups) ? groups : [];
  const operatorCount = userList.filter((user) => user.role === 'operator').length;
  const readOnlyCount = userList.filter((user) => user.role === 'read-only').length;
  const activeOperatorCount = userList.filter((user) => user.role === 'operator' && user.active).length;
  const activeReadOnlyCount = userList.filter((user) => user.role === 'read-only' && user.active).length;

  return [
    {
      title: 'Administrator Coverage',
      detail: userSummary.activeAdmins
        ? 'At least one active admin account can recover policy, approvals, and access-control settings.'
        : 'No active admin coverage remains. Recover control before continuing operations.',
      value: `${userSummary.activeAdmins || 0} admin${(userSummary.activeAdmins || 0) === 1 ? '' : 's'}`,
      badgeClass: userSummary.activeAdmins ? 'badge-success' : 'badge-error',
    },
    {
      title: 'Operator Footprint',
      detail: `${activeOperatorCount} active operators can run day-to-day infrastructure changes without full policy ownership.`,
      value: `${operatorCount} operators`,
      badgeClass: 'badge-info',
    },
    {
      title: 'Read-Only Access',
      detail: `${activeReadOnlyCount} viewers can inspect dashboards, inventory, and audit data without mutation rights.`,
      value: `${readOnlyCount} viewers`,
      badgeClass: 'badge-warning',
    },
    {
      title: 'Group Catalog',
      detail: `${groupList.length} local group${groupList.length === 1 ? '' : 's'} organize operator membership across the control plane.`,
      value: `${groupList.reduce((sum, group) => sum + Number(group.member_count || 0), 0)} memberships`,
      badgeClass: groupList.length ? 'badge-info' : 'badge-warning',
    },
  ];
}

function buildGovernanceRoleGuidance(currentRole = '', policy = {}, summary = {}) {
  return [
    {
      title: 'Read Only Sessions',
      detail: 'Use read-only mode for dashboard, audit, and inventory walkthroughs where infrastructure state should stay untouched.',
      status: currentRole === 'read-only' ? 'info' : 'success',
    },
    {
      title: 'Operator Sessions',
      detail: policy.requireDestructiveApproval
        ? 'Operators can work normally, but shutdown, reboot, and suspend flows require approved governance tokens first.'
        : 'Operators currently have direct access to destructive actions because approval gating is disabled.',
      status: policy.requireDestructiveApproval ? 'warning' : 'info',
    },
    {
      title: 'Quota Guardrails',
      detail: summary.enforcedQuotaCount
        ? 'Pool quota enforcement is active and will block template deployments that exceed configured envelopes.'
        : 'No pool quotas are currently enforced; deployments only depend on live infrastructure state.',
      status: summary.enforcedQuotaCount ? 'success' : 'warning',
    },
  ];
}

function isCurrentGovernanceSessionUser(user = null, currentUser = null) {
  return String(user?.id || '') === String(currentUser?.id || '');
}

function mapGovernanceApprovalStatus(value) {
  if (value === 'approved' || value === 'used') return 'success';
  if (value === 'rejected' || value === 'expired') return 'warning';
  return 'pending';
}

function formatGovernanceApprovalAction(value) {
  return String(value || 'approval')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
