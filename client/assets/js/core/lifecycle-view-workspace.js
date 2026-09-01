/* ============================================
   Lifecycle View Workspace Helpers
   ============================================ */

function createLifecycleViewState() {
  return {
    loading: true,
    hosts: [],
    tasks: [],
    messages: [],
    lifecyclePlans: [],
    relatedPools: [],
    relatedVMs: [],
    relatedStorage: [],
    relatedNetworks: [],
    selectedHostRef: null,
    plannerHostRef: null,
    showInspector: false,
    showPlanner: false,
    planSaving: false,
    planError: null,
    plannerActionBusy: '',
    plannerActionError: null,
    plannerSeed: null,
    plannerLaunchMode: 'plan',
    plannerSourceTask: null,
    workspaceMessage: '',
    selectedLifecycleRefs: [],
    bulkActionBusy: '',
    bulkError: null,
    lastAppliedFocusKey: '',
    columns: [
      { key: 'name_label', label: 'Host' },
      { key: 'lifecycleStatus', label: 'Status' },
      { key: 'maintenanceWindow', label: 'Maintenance Window' },
      { key: 'planLabel', label: 'Lifecycle Plan' },
      { key: 'nextAction', label: 'Next Action' },
    ],
  };
}

function buildLifecycleInspectorOpenState(row = null) {
  return {
    selectedHostRef: row?.ref || null,
    showInspector: Boolean(row?.ref),
  };
}

function buildLifecycleInspectorClosedState() {
  return {
    showInspector: false,
    selectedHostRef: null,
  };
}

function buildLifecyclePlannerOpenState(row = null, seed = null, sourceTask = null, launchMode = 'plan') {
  return {
    plannerHostRef: row?.ref || null,
    plannerSeed: seed ? { ...seed } : null,
    plannerLaunchMode: launchMode === 'maintenance' ? 'maintenance' : 'plan',
    plannerSourceTask: sourceTask || null,
    planError: null,
    plannerActionError: null,
    showPlanner: Boolean(row?.ref),
  };
}

function buildLifecyclePlannerClosedState() {
  return {
    showPlanner: false,
    plannerHostRef: null,
    plannerSeed: null,
    plannerLaunchMode: 'plan',
    plannerSourceTask: null,
    planError: null,
    plannerActionBusy: '',
    plannerActionError: null,
  };
}

function buildLifecycleFocusResetState() {
  return { lastAppliedFocusKey: '' };
}
