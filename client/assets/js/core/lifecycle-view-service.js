/* ============================================
   Lifecycle View Service Helpers
   ============================================ */

async function loadLifecycleContext(apiClient) {
  const [hostsResult, tasksResult, messagesResult, plansResult, poolsResult, vmsResult, storageResult, networksResult] = await Promise.all([
    apiClient.getHosts(),
    apiClient.getTasks(),
    apiClient.dashboardMessages(),
    apiClient.getLifecyclePlans().catch(() => ({ data: [] })),
    apiClient.getPools().catch(() => ({ data: [] })),
    apiClient.getVMs().catch(() => ({ data: [] })),
    apiClient.getSRs().catch(() => ({ data: [] })),
    apiClient.getNetworks().catch(() => ({ data: [] })),
  ]);

  return {
    hosts: hostsResult.data || [],
    tasks: tasksResult.data || [],
    messages: messagesResult || [],
    lifecyclePlans: plansResult.data || [],
    relatedPools: poolsResult.data || [],
    relatedVMs: vmsResult.data || [],
    relatedStorage: storageResult.data || [],
    relatedNetworks: networksResult.data || [],
  };
}

async function syncLifecyclePlannerSourceTaskWorkflow({
  api,
  plannerSourceTask = null,
  tasks = [],
  status = '',
  result = '',
  username = '',
} = {}) {
  if (!plannerSourceTask?.ref || !isRemediationLifecycleTask(plannerSourceTask)) {
    return {
      tasks,
      plannerSourceTask,
      updated: false,
    };
  }

  const currentStatus = String(plannerSourceTask.status || '').trim().toLowerCase();
  if (['success', 'warning', 'failure', 'cancelled'].includes(currentStatus)) {
    return {
      tasks,
      plannerSourceTask,
      updated: false,
    };
  }

  const updatedTask = await api.updateRemediationTask(plannerSourceTask.ref, {
    status,
    assignee: plannerSourceTask.assignee || username || '',
    dueDate: plannerSourceTask.due_date || plannerSourceTask.dueDate || '',
    result,
    nameDescription: plannerSourceTask.name_description || plannerSourceTask.nameDescription || '',
  });

  return {
    tasks: (Array.isArray(tasks) ? tasks : []).map((task) => task.ref === updatedTask.ref ? updatedTask : task),
    plannerSourceTask: updatedTask,
    updated: true,
  };
}
