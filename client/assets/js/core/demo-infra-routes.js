function handleDemoInfraRoutes(method, path, body, scope) {
  if (method === 'GET' && path === '/api/pools') {
    return { total: scope.pools.length, data: clone(scope.pools) };
  }

  if (method === 'PUT' && path.startsWith('/api/pools/') && path.endsWith('/config')) {
    const poolRef = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({ actionKey: 'pool_config_update', entityType: 'pool', entityRef: poolRef });
    const pool = demoDb.pools.find((entry) => entry.ref === poolRef);
    if (!pool) throw new Error('POOL_NOT_FOUND');

    Object.assign(pool, {
      name_label: body.nameLabel,
      name_description: body.nameDescription || '',
      default_SR: String(body.defaultSrRef || '').trim() || pool.default_SR || '',
      vswitch_controller: String(body.vswitchController || '').trim(),
      tags: Array.isArray(body.tags) ? clone(body.tags) : [],
      other_config: clone(body.otherConfig || {}),
    });
    if (typeof body.migrationCompressionEnabled === 'boolean') {
      pool.migration_compression = body.migrationCompressionEnabled;
    }
    if (typeof body.wlbEnabled === 'boolean') {
      pool.wlb_enabled = body.wlbEnabled;
    }
    if (typeof body.igmpSnoopingEnabled === 'boolean') {
      pool.IGMP_snooping_enabled = body.igmpSnoopingEnabled;
    }

    return clone(pool);
  }

  if (method === 'POST' && path.startsWith('/api/pools/') && path.endsWith('/ha')) {
    const poolRef = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({ actionKey: 'pool_ha_update', entityType: 'pool', entityRef: poolRef });
    const pool = demoDb.pools.find((entry) => entry.ref === poolRef);
    if (!pool) throw new Error('POOL_NOT_FOUND');

    const enabled = Boolean(body?.enabled);
    const heartbeatSrRefs = Array.isArray(body?.heartbeatSrRefs) ? clone(body.heartbeatSrRefs).filter(Boolean) : [];
    const requestedTolerance = Math.max(0, Number(body?.haHostFailuresToTolerate || 0));
    if (enabled && !pool.ha_enabled && !heartbeatSrRefs.length) throw new Error('VALIDATION_ERROR');

    if (enabled) {
      pool.ha_enabled = true;
      pool.ha_configuration = clone(body?.configuration || pool.ha_configuration || {});
    } else {
      pool.ha_enabled = false;
    }
    pool.ha_cluster_stack = enabled ? 'xhad' : '';
    pool.ha_overcommitted = false;
    pool.ha_host_failures_to_tolerate = enabled ? requestedTolerance : 0;
    pool.ha_plan_exists_for = enabled ? requestedTolerance : 0;
    pool.ha_statefiles = enabled
      ? heartbeatSrRefs.map((srRef, index) => `OpaqueRef:ha-statefile-demo-${index + 1}`)
      : [];

    return clone({
      ...pool,
      requestedEnabled: enabled,
      requestedTolerance,
      heartbeatSrRefs,
    });
  }

  if (method === 'GET' && path === '/api/hosts') {
    return { total: scope.hosts.length, data: clone(scope.hosts) };
  }

  if (method === 'PUT' && path.startsWith('/api/hosts/') && path.endsWith('/config')) {
    const hostRef = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({ actionKey: 'host_config_update', entityType: 'host', entityRef: hostRef });
    const host = demoDb.hosts.find((entry) => entry.ref === hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');

    const previous = clone(host);
    host.name_label = body.nameLabel;
    host.name_description = body.nameDescription || '';
    if (Array.isArray(body.tags)) {
      host.tags = [...body.tags];
    }
    if (body.guestVcpusParams && typeof body.guestVcpusParams === 'object') {
      host.guest_VCPUs_params = clone(body.guestVcpusParams);
    }
    if (String(body.schedGran || '').trim()) {
      host.sched_gran = String(body.schedGran).trim();
    }
    if (body.logging && typeof body.logging === 'object') {
      host.logging = clone(body.logging);
    }

    recordDemoAudit({
      category: 'hosts',
      action: 'host_config_updated',
      actionLabel: 'Updated host configuration',
      entityType: 'host',
      entityRef: hostRef,
      entityName: host.name_label || hostRef,
      route: '/hosts',
      before: previous,
      after: clone(host),
      detail: `Host configuration saved as ${host.name_label || hostRef}.`,
    });

    return clone(host);
  }

  if (method === 'GET' && path.startsWith('/api/hosts/') && path.endsWith('/metrics')) {
    const ref = decodeURIComponent(path.split('/')[3] || '');
    return clone(demoDb.hostMetrics[ref] || { live: false, memory_total: 0, memory_free: 0 });
  }

  if (method === 'POST' && path.startsWith('/api/hosts/') && path.endsWith('/maintenance/enter')) {
    const hostRef = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({ actionKey: 'host_maintenance_enter', entityType: 'host', entityRef: hostRef });
    const host = demoDb.hosts.find((entry) => entry.ref === hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');

    const previous = clone(host);
    const evacuateRunningVms = body?.evacuateRunningVms !== false;
    const networkRef = String(body?.networkRef || '').trim();
    const poolHosts = demoDb.hosts.filter((entry) => entry.pool === host.pool && entry.ref !== host.ref);

    if (evacuateRunningVms) {
      if (!networkRef) throw new Error('VALIDATION_ERROR');
      if (!poolHosts.length && (host.resident_VMs || []).length) {
        const error = new Error('DEMO_CANNOT_EVACUATE_HOST');
        error.code = 'DEMO_CANNOT_EVACUATE_HOST';
        throw error;
      }

      const destination = poolHosts[0] || null;
      const residentVmRefs = [...(host.resident_VMs || [])];
      residentVmRefs.forEach((vmRef) => {
        const vm = demoDb.vms.find((entry) => entry.ref === vmRef);
        if (vm && destination) {
          vm.resident_on = destination.ref;
          vm.affinity = destination.ref;
        }
      });
      if (destination) {
        destination.resident_VMs = [...new Set([...(destination.resident_VMs || []), ...(host.resident_VMs || [])])];
        host.resident_VMs = [];
      }
    }

    host.enabled = false;
    host.maintenance_mode = true;
    host.last_maintenance_started_at = new Date().toISOString();
    host.other_config = {
      ...(host.other_config || {}),
      maintenance_network: networkRef,
      maintenance_mode: 'true',
    };

    recordDemoAudit({
      category: 'hosts',
      action: 'host_maintenance_entered',
      actionLabel: 'Entered maintenance mode for',
      entityType: 'host',
      entityRef: hostRef,
      entityName: host.name_label || hostRef,
      route: '/hosts',
      before: previous,
      after: clone(host),
      detail: evacuateRunningVms
        ? `${host.name_label || hostRef} entered maintenance mode and evacuated resident workloads over ${networkRef}.`
        : `${host.name_label || hostRef} entered maintenance mode without workload evacuation.`,
    });

    return clone(host);
  }

  if (method === 'POST' && path.startsWith('/api/hosts/') && path.endsWith('/maintenance/exit')) {
    const hostRef = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({ actionKey: 'host_maintenance_exit', entityType: 'host', entityRef: hostRef });
    const host = demoDb.hosts.find((entry) => entry.ref === hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');

    const previous = clone(host);
    host.enabled = true;
    host.maintenance_mode = false;
    host.last_maintenance_ended_at = new Date().toISOString();
    host.other_config = {
      ...(host.other_config || {}),
      maintenance_mode: 'false',
    };

    recordDemoAudit({
      category: 'hosts',
      action: 'host_maintenance_exited',
      actionLabel: 'Exited maintenance mode for',
      entityType: 'host',
      entityRef: hostRef,
      entityName: host.name_label || hostRef,
      route: '/hosts',
      before: previous,
      after: clone(host),
      detail: `${host.name_label || hostRef} was returned to the workload placement pool.`,
    });

    return clone(host);
  }

  if (method === 'POST' && path.startsWith('/api/hosts/') && path.endsWith('/reboot')) {
    const hostRef = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({
      actionKey: 'host_reboot',
      entityType: 'host',
      entityRef: hostRef,
      destructive: true,
      approvalId: body?.approvalId || '',
    });
    const host = demoDb.hosts.find((entry) => entry.ref === hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');
    host.last_power_operation = 'reboot';
    host.last_power_operation_at = new Date().toISOString();
    recordDemoAudit({
      category: 'hosts',
      action: 'host_reboot_requested',
      actionLabel: 'Requested host reboot for',
      entityType: 'host',
      entityRef: hostRef,
      entityName: host.name_label || hostRef,
      route: '/hosts',
      before: null,
      after: { ref: hostRef, success: true },
      detail: `${host.name_label || hostRef} received a reboot request from the demo control plane.`,
    });
    return { success: true, ref: hostRef };
  }

  if (method === 'POST' && path.startsWith('/api/hosts/') && path.endsWith('/shutdown')) {
    const hostRef = decodeURIComponent(path.split('/')[3] || '');
    ensureDemoMutationAllowed({
      actionKey: 'host_shutdown',
      entityType: 'host',
      entityRef: hostRef,
      destructive: true,
      approvalId: body?.approvalId || '',
    });
    const host = demoDb.hosts.find((entry) => entry.ref === hostRef);
    if (!host) throw new Error('HOST_NOT_FOUND');
    host.last_power_operation = 'shutdown';
    host.last_power_operation_at = new Date().toISOString();
    host.enabled = false;
    recordDemoAudit({
      category: 'hosts',
      action: 'host_shutdown_requested',
      actionLabel: 'Requested host shutdown for',
      entityType: 'host',
      entityRef: hostRef,
      entityName: host.name_label || hostRef,
      route: '/hosts',
      before: null,
      after: { ref: hostRef, success: true },
      detail: `${host.name_label || hostRef} received a shutdown request from the demo control plane.`,
    });
    return { success: true, ref: hostRef };
  }

  return undefined;
}
