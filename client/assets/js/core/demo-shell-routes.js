function handleDemoShellRoutes(method, path, body, range) {
  if (method === 'POST' && path === '/api/auth/logout') {
    return { success: true };
  }

  if (method === 'GET' && path === '/api/auth/targets') {
    return clone(Array.isArray(store.connectedTargets) ? store.connectedTargets : []);
  }

  if (method === 'POST' && path === '/api/auth/targets/activate') {
    const requestedTargetKey = String(body?.targetKey || '').trim();
    const connectedTargets = (Array.isArray(store.connectedTargets) ? store.connectedTargets : []).map((target) => ({
      ...target,
      active: String(target?.targetKey || '').trim() === requestedTargetKey,
    }));
    const activeTarget = connectedTargets.find((target) => target.active) || connectedTargets[0] || null;

    store.connectedTargets = connectedTargets;
    store.currentTargetKey = activeTarget?.targetKey || '';
    store.host = activeTarget?.connectionName || activeTarget?.host || 'Demo Fabric';

    return {
      authenticated: true,
      connected: Boolean(connectedTargets.length),
      host: store.host,
      username: store.username || 'demo',
      authMode: 'demo',
      demoMode: true,
      currentTargetKey: store.currentTargetKey,
      connectedTargets: clone(connectedTargets),
      user: clone(store.user || {
        id: 'demo',
        username: 'demo',
        displayName: 'Demo Operator',
        role: 'admin',
      }),
      governance: getDemoGovernanceState(),
    };
  }

  if (method === 'GET' && path === '/api/auth/status') {
    const connectedTargets = Array.isArray(store.connectedTargets) ? store.connectedTargets : [];
    const activeTarget = connectedTargets.find((target) => target.active) || connectedTargets[0] || null;
    return {
      authenticated: true,
      connected: Boolean(connectedTargets.length),
      host: store.host || activeTarget?.connectionName || activeTarget?.host || 'Demo Fabric',
      username: store.username || 'demo',
      authMode: 'demo',
      demoMode: true,
      currentTargetKey: store.currentTargetKey || activeTarget?.targetKey || 'demo-fabric',
      connectedTargets: clone(connectedTargets),
      user: clone(store.user || {
        id: 'demo',
        username: 'demo',
        displayName: 'Demo Operator',
        role: 'admin',
      }),
      governance: getDemoGovernanceState(),
    };
  }

  if (method === 'GET' && path === '/api/dashboard') {
    return buildDemoDashboard();
  }

  if (method === 'GET' && path === '/api/metrics/cluster') {
    return clone(buildDemoClusterMetrics(range));
  }

  if (method === 'GET' && path === '/api/metrics/capacity-baseline') {
    return clone(buildDemoCapacityBaseline());
  }

  if (method === 'POST' && path === '/api/metrics/collect') {
    const activeVmCount = demoDb.vms.filter((vm) => !vm.is_a_template).length;
    return {
      captured: true,
      ts: Date.now(),
      sampleCount: (demoDb.hosts.length * 6) + (activeVmCount * 9) + (demoDb.srs.length * 3),
      hostCount: demoDb.hosts.length,
      vmCount: activeVmCount,
      srCount: demoDb.srs.length,
    };
  }

  if (method === 'GET' && path.startsWith('/api/metrics/hosts/')) {
    const ref = decodeURIComponent(path.split('/')[4] || '');
    return clone(buildDemoHostMetricHistory(ref, range));
  }

  if (method === 'GET' && path.startsWith('/api/metrics/vms/')) {
    const ref = decodeURIComponent(path.split('/')[4] || '');
    return clone(buildDemoVmMetricHistory(ref, range));
  }

  if (method === 'GET' && path.startsWith('/api/metrics/storage/')) {
    const ref = decodeURIComponent(path.split('/')[4] || '');
    return clone(buildDemoStorageMetricHistory(ref, range));
  }

  return undefined;
}
