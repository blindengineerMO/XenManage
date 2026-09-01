function handleDemoTemplateRoutes(method, path, body, parsedUrl, search, targetKey) {
  if (method === 'GET' && path === '/api/vms/templates') {
    const templates = buildDemoVmInventory(targetKey).filter((vm) => vm.is_a_template);
    return { total: templates.length, data: clone(templates) };
  }

  if (method === 'GET' && path === '/api/vms/appliances') {
    return {
      total: demoDb.vmAppliances.length,
      data: clone(demoDb.vmAppliances),
    };
  }

  if (method === 'GET' && path === '/api/vms/snapshot-schedules') {
    return {
      total: demoDb.vmSnapshotSchedules.length,
      data: clone(demoDb.vmSnapshotSchedules),
    };
  }

  if (method === 'GET' && path === '/api/vms/templates/governance') {
    return { total: demoDb.templateGovernance.length, data: clone(demoDb.templateGovernance) };
  }

  if (method === 'PUT' && path.startsWith('/api/vms/templates/') && path.endsWith('/governance')) {
    ensureDemoMutationAllowed({ actionKey: 'template_governance_save', entityType: 'template', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const previous = demoDb.templateGovernance.find((entry) => entry.templateRef === templateRef) || null;
    const record = {
      templateRef,
      versionLabel: body.versionLabel || '',
      profileLabel: body.profileLabel || '',
      lifecycleStage: body.lifecycleStage || 'draft',
      goldenImage: Boolean(body.goldenImage),
      guestCustomization: body.guestCustomization || '',
      validationStatus: body.validationStatus || 'untested',
      lastValidatedAt: body.lastValidatedAt || '',
      owner: body.owner || '',
      notes: body.notes || '',
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.templateGovernance.findIndex((entry) => entry.templateRef === templateRef);
    if (index === -1) {
      demoDb.templateGovernance.push(record);
    } else {
      demoDb.templateGovernance[index] = record;
    }
    demoDb.templateGovernanceHistory.unshift({
      id: `tmplhist-${Date.now()}`,
      templateRef,
      templateName: demoDb.vms.find((entry) => entry.ref === templateRef)?.name_label || templateRef,
      eventType: 'saved',
      actor: store.username || 'demo',
      happenedAt: record.updatedAt,
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: `${record.versionLabel || templateRef} governance saved from the template library workbench.`,
      snapshot: clone(record),
    });
    recordDemoAudit({
      category: 'templates',
      action: 'template_governance_saved',
      actionLabel: 'Saved template governance for',
      entityType: 'template',
      entityRef: templateRef,
      entityName: record.versionLabel || templateRef,
      route: '/templates',
      before: previous,
      after: record,
      detail: `${record.lifecycleStage} stage with ${record.validationStatus} validation status.`,
    });
    return clone(record);
  }

  if (method === 'GET' && path.startsWith('/api/vms/templates/') && path.endsWith('/history')) {
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const records = demoDb.templateGovernanceHistory.filter((entry) => entry.templateRef === templateRef);
    return { total: records.length, data: clone(records) };
  }

  if (method === 'POST' && path.startsWith('/api/vms/templates/') && path.includes('/history/') && path.endsWith('/restore')) {
    ensureDemoMutationAllowed({ actionKey: 'template_governance_restore', entityType: 'template', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const historyId = decodeURIComponent(path.split('/')[6] || '');
    const template = demoDb.vms.find((entry) => entry.ref === templateRef);
    const sourceEntry = demoDb.templateGovernanceHistory.find((entry) => entry.templateRef === templateRef && entry.id === historyId);
    if (!sourceEntry) throw new Error('TEMPLATE_GOVERNANCE_HISTORY_NOT_FOUND');

    const previous = clone(demoDb.templateGovernance.find((entry) => entry.templateRef === templateRef) || null);
    const record = {
      ...clone(sourceEntry.snapshot || {}),
      templateRef,
      updatedAt: new Date().toISOString(),
    };
    const index = demoDb.templateGovernance.findIndex((entry) => entry.templateRef === templateRef);
    if (index === -1) {
      demoDb.templateGovernance.push(record);
    } else {
      demoDb.templateGovernance[index] = record;
    }

    demoDb.templateGovernanceHistory.unshift({
      id: `tmplhist-${Date.now()}-restore`,
      templateRef,
      templateName: template?.name_label || templateRef,
      eventType: 'restored',
      actor: store.username || 'demo',
      happenedAt: record.updatedAt,
      baselineTemplateRef: '',
      baselineTemplateName: '',
      baselineVersionLabel: '',
      promotionNotes: '',
      detail: `Restored governance snapshot from ${sourceEntry.eventType || 'history'} recorded on ${sourceEntry.happenedAt || 'an earlier revision'}.`,
      snapshot: clone(record),
    });

    recordDemoAudit({
      category: 'templates',
      action: 'template_governance_restored',
      actionLabel: 'Restored template governance for',
      entityType: 'template',
      entityRef: templateRef,
      entityName: template?.name_label || templateRef,
      route: '/templates',
      before: previous,
      after: clone(record),
      detail: `Restored governance from ${sourceEntry.eventType || 'history'} snapshot ${sourceEntry.id}.`,
    });

    return {
      record: clone(record),
      sourceEntry: clone(sourceEntry),
      history: clone(demoDb.templateGovernanceHistory.filter((entry) => entry.templateRef === templateRef)),
    };
  }

  if (method === 'POST' && path.startsWith('/api/vms/templates/') && path.endsWith('/promote')) {
    ensureDemoMutationAllowed({ actionKey: 'template_promote', entityType: 'template', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const template = demoDb.vms.find((entry) => entry.ref === templateRef);
    const index = demoDb.templateGovernance.findIndex((entry) => entry.templateRef === templateRef);
    if (!template || index === -1) throw new Error('TEMPLATE_GOVERNANCE_NOT_FOUND');

    const current = demoDb.templateGovernance[index];
    if (current.validationStatus !== 'validated') throw new Error('PROMOTION_REQUIRES_VALIDATED_TEMPLATE');

    const previous = clone(current);
    const profileLabel = String(current.profileLabel || '').trim().toLowerCase();
    const baseline = demoDb.templateGovernance.find((entry) =>
      entry.templateRef !== templateRef
      && entry.lifecycleStage === 'stable'
      && String(entry.profileLabel || '').trim().toLowerCase() === profileLabel
    ) || null;
    const deprecated = [];

    if (baseline && body.retireExistingStable !== false) {
      baseline.lifecycleStage = 'deprecated';
      baseline.goldenImage = false;
      baseline.updatedAt = new Date().toISOString();
      deprecated.push(clone(baseline));
      demoDb.templateGovernanceHistory.unshift({
        id: `tmplhist-${Date.now()}-retire`,
        templateRef: baseline.templateRef,
        templateName: demoDb.vms.find((entry) => entry.ref === baseline.templateRef)?.name_label || baseline.templateRef,
        eventType: 'retired',
        actor: store.username || 'demo',
        happenedAt: baseline.updatedAt,
        baselineTemplateRef: templateRef,
        baselineTemplateName: template.name_label || templateRef,
        baselineVersionLabel: current.versionLabel || '',
        promotionNotes: body.promotionNotes || '',
        detail: `${current.versionLabel || templateRef} replaced this stable baseline during promotion.`,
        snapshot: clone(baseline),
      });
    }

    Object.assign(current, {
      lifecycleStage: 'stable',
      goldenImage: true,
      updatedAt: new Date().toISOString(),
      notes: [current.notes, body.promotionNotes || ''].filter(Boolean).join(' '),
    });

    demoDb.templateGovernanceHistory.unshift({
      id: `tmplhist-${Date.now()}-promote`,
      templateRef,
      templateName: template.name_label || templateRef,
      eventType: 'promoted',
      actor: store.username || 'demo',
      happenedAt: current.updatedAt,
      baselineTemplateRef: baseline?.templateRef || '',
      baselineTemplateName: baseline ? (demoDb.vms.find((entry) => entry.ref === baseline.templateRef)?.name_label || baseline.templateRef) : '',
      baselineVersionLabel: baseline?.versionLabel || '',
      promotionNotes: body.promotionNotes || '',
      detail: `${current.versionLabel || templateRef} promoted to stable lifecycle stage.`,
      snapshot: clone(current),
    });

    recordDemoAudit({
      category: 'templates',
      action: 'template_promoted',
      actionLabel: 'Promoted template',
      entityType: 'template',
      entityRef: templateRef,
      entityName: template.name_label || templateRef,
      route: '/templates',
      before: previous,
      after: clone(current),
      detail: `${current.versionLabel || templateRef} promoted to stable${deprecated.length ? ' and retired the previous stable baseline' : ''}.`,
    });

    return {
      promoted: clone(current),
      deprecated: clone(deprecated),
      history: clone(demoDb.templateGovernanceHistory.filter((entry) => entry.templateRef === templateRef)),
    };
  }

  if (method === 'GET' && path === '/api/vms/templates/deployments') {
    const records = [...demoDb.templateDeployments].sort((left, right) => new Date(right.updatedAt || right.submittedAt || 0) - new Date(left.updatedAt || left.submittedAt || 0));
    return { total: records.length, data: clone(records) };
  }

  if (method === 'PUT' && path.startsWith('/api/vms/templates/deployments/') && path.endsWith('/validation')) {
    ensureDemoMutationAllowed({ actionKey: 'template_deployment_validate', entityType: 'vm', entityRef: decodeURIComponent(path.split('/')[5] || '') });
    const deploymentId = decodeURIComponent(path.split('/')[5] || '');
    const index = demoDb.templateDeployments.findIndex((entry) => entry.id === deploymentId);
    if (index === -1) throw new Error('TEMPLATE_DEPLOYMENT_NOT_FOUND');

    const previous = demoDb.templateDeployments[index];
    const nextRecord = {
      ...demoDb.templateDeployments[index],
      validationStatus: body.validationStatus || 'pending',
      validationNotes: body.validationNotes || '',
      guestCustomization: body.guestCustomization || '',
      bootVerified: Boolean(body.bootVerified),
      networkVerified: Boolean(body.networkVerified),
      storageVerified: Boolean(body.storageVerified),
      policyTagged: Boolean(body.policyTagged),
      updatedAt: new Date().toISOString(),
    };
    demoDb.templateDeployments[index] = nextRecord;
    const runIndex = demoDb.templateDeploymentRuns.findIndex((entry) => entry.vm_ref === nextRecord.vmRef);
    let deploymentRun = null;
    if (runIndex !== -1) {
      const status = String(nextRecord.validationStatus || '').toLowerCase();
      deploymentRun = {
        ...demoDb.templateDeploymentRuns[runIndex],
        status: status === 'validated' ? 'success' : (status === 'failed' ? 'failure' : (status === 'warning' ? 'warning' : 'pending')),
        progress: status === 'validated' || status === 'failed' ? 1 : (status === 'warning' ? 0.9 : 0.8),
        finished: status === 'validated' || status === 'failed' ? new Date().toISOString() : '',
        result: nextRecord.validationNotes
          || (status === 'validated'
            ? `${nextRecord.vmName} provisioning and post-deploy validation completed successfully.`
            : (status === 'failed'
              ? `${nextRecord.vmName} was provisioned, but post-deploy validation failed and needs operator follow-through.`
              : `${nextRecord.vmName} was provisioned and is waiting for operator review.`)),
        validation_status: nextRecord.validationStatus,
        validation_notes: nextRecord.validationNotes,
        guest_customization: nextRecord.guestCustomization,
        boot_verified: Boolean(nextRecord.bootVerified),
        network_verified: Boolean(nextRecord.networkVerified),
        storage_verified: Boolean(nextRecord.storageVerified),
        policy_tagged: Boolean(nextRecord.policyTagged),
        steps: (demoDb.templateDeploymentRuns[runIndex].steps || []).map((step) =>
          step.key === 'validation'
            ? {
              ...step,
              status: status === 'validated' ? 'success' : (status === 'failed' ? 'failure' : (status === 'warning' ? 'warning' : 'pending')),
              detail: nextRecord.validationNotes || step.detail,
            }
            : step),
      };
      demoDb.templateDeploymentRuns[runIndex] = deploymentRun;
    }
    recordDemoAudit({
      category: 'templates',
      action: 'template_deployment_validated',
      actionLabel: 'Updated deployment validation for',
      entityType: 'vm',
      entityRef: nextRecord.vmRef || nextRecord.id,
      entityName: nextRecord.vmName || nextRecord.id,
      route: '/templates',
      before: previous,
      after: nextRecord,
      detail: `${nextRecord.validationStatus} validation with guest customization ${nextRecord.guestCustomization || 'unset'}.`,
    });
    return clone({ ...nextRecord, deploymentRun });
  }

  if (method === 'POST' && path.includes('/api/vms/templates/') && path.endsWith('/deploy')) {
    ensureDemoMutationAllowed({ actionKey: 'template_deploy', entityType: 'template', entityRef: decodeURIComponent(path.split('/')[4] || '') });
    const templateRef = decodeURIComponent(path.split('/')[4] || '');
    const template = demoDb.vms.find((vm) => vm.ref === templateRef && vm.is_a_template);
    if (!template) throw new Error('TEMPLATE_NOT_FOUND');
    if (body.hostRef) {
      const host = demoDb.hosts.find((entry) => entry.ref === body.hostRef);
      const quota = demoDb.governanceQuotas.find((entry) => entry.poolRef === host?.pool) || null;
      if (quota?.enabled && host?.pool) {
        const row = buildDemoQuotaRows().find((entry) => entry.poolRef === host.pool);
        const nextVmCount = (row?.currentVmCount || 0) + 1;
        const nextRunningVmCount = (row?.currentRunningVmCount || 0) + (body.startAfter ? 1 : 0);
        const nextTotalMemoryGiB = (row?.currentTotalMemoryGiB || 0) + (Number(body.memoryStaticMax || 0) / (1024 ** 3));
        const breaches = [];
        if (quota.maxVmCount > 0 && nextVmCount > quota.maxVmCount) breaches.push('VM count');
        if (quota.maxRunningVmCount > 0 && nextRunningVmCount > quota.maxRunningVmCount) breaches.push('running VM count');
        if (quota.maxTotalMemoryGiB > 0 && nextTotalMemoryGiB > quota.maxTotalMemoryGiB) breaches.push('memory allocation');
        if (breaches.length) {
          const error = new Error(`The deployment would exceed the configured pool quota for ${breaches.join(', ')}.`);
          error.code = 'QUOTA_EXCEEDED';
          throw error;
        }
      }
    }

    const vmRef = nextDemoOpaqueRef('vm');
    const vbdRef = nextDemoOpaqueRef('vbd');
    const vdiRef = nextDemoOpaqueRef('vdi');
    const vifRef = body.networkRef ? nextDemoOpaqueRef('vif') : null;
    const hostRef = body.hostRef || '';
    const host = demoDb.hosts.find((entry) => entry.ref === hostRef);
    const srRef = body.storageRef || demoDb.srs[0]?.ref || '';
    const network = demoDb.networks.find((entry) => entry.ref === body.networkRef);

    const vmRecord = {
      ref: vmRef,
      name_label: body.nameLabel,
      name_description: body.nameDescription || '',
      power_state: body.startAfter ? 'Running' : 'Halted',
      VCPUs_at_startup: Number(body.vcpusAtStartup || body.vcpus || template.VCPUs_at_startup || 1),
      VCPUs_max: Number(body.vcpusMax || body.vcpusAtStartup || body.vcpus || template.VCPUs_max || template.VCPUs_at_startup || 1),
      memory_static_max: Number(body.memoryStaticMax || template.memory_static_max || 0),
      memory_dynamic_max: Number(body.memoryStaticMax || template.memory_static_max || 0),
      uuid: `${vmRef.replace('OpaqueRef:', '')}-uuid`,
      is_a_template: false,
      resident_on: hostRef || '',
      affinity: hostRef || '',
      VBDs: [vbdRef],
      VIFs: vifRef ? [vifRef] : [],
      HVM_boot_policy: template.HVM_boot_policy || 'UEFI',
      platform: clone(template.platform || {}),
      tags: Array.isArray(body.tags) ? body.tags : clone(template.tags || []),
    };

    demoDb.vms.push(vmRecord);

    if (host) {
      host.resident_VMs = [...(host.resident_VMs || []), vmRef];
    }

    if (srRef) {
      if (!demoDb.vdis[srRef]) demoDb.vdis[srRef] = [];
      demoDb.vdis[srRef].push({
        ref: vdiRef,
        uuid: `${vdiRef.replace('OpaqueRef:', '')}-uuid`,
        SR: srRef,
        name_label: `${body.nameLabel}-root`,
        virtual_size: 42949672960,
        type: 'user',
        managed: true,
        VBDs: [vbdRef],
      });
    }

    if (network && vifRef) {
      network.VIFs = [...(network.VIFs || []), vifRef];
      registerDemoVifState(vifRef, {
        device: '0',
        MAC: '',
        currently_attached: body.startAfter !== false,
      });
    }
    const governance = demoDb.templateGovernance.find((entry) => entry.templateRef === templateRef);
    const deploymentAudit = {
      id: `tmpldep-${Date.now()}`,
      templateRef,
      templateName: template.name_label || templateRef,
      templateVersion: governance?.versionLabel || '',
      vmRef,
      vmName: vmRecord.name_label,
      hostRef,
      hostLabel: resolveDemoInventoryLabel(demoDb.hosts, hostRef, ''),
      storageRef: srRef,
      storageLabel: resolveDemoInventoryLabel(demoDb.srs, srRef, ''),
      networkRef: body.networkRef || '',
      networkLabel: resolveDemoInventoryLabel(demoDb.networks, body.networkRef, ''),
      startAfter: Boolean(body.startAfter),
      submittedBy: store.username || 'demo',
      submittedAt: new Date().toISOString(),
      validationStatus: governance?.validationStatus === 'validated' ? 'pending' : 'warning',
      validationNotes: governance?.validationStatus === 'validated'
        ? 'Validate guest boot, networking, storage mapping, and policy tags after first start.'
        : 'Template governance is not fully validated yet. Review this deployment before promotion.',
      guestCustomization: governance?.guestCustomization || '',
      bootVerified: false,
      networkVerified: false,
      storageVerified: false,
      policyTagged: Array.isArray(body.tags) && body.tags.length > 0,
      updatedAt: new Date().toISOString(),
    };
    demoDb.templateDeployments.unshift(deploymentAudit);
    const deploymentRun = {
      ref: `tmplrun-${Date.now()}`,
      uuid: `template-deployment-${Date.now()}`,
      name_label: vmRecord.name_label,
      name_description: deploymentAudit.validationNotes,
      status: deploymentAudit.validationStatus === 'warning' ? 'warning' : 'pending',
      progress: deploymentAudit.validationStatus === 'warning' ? 0.9 : 0.8,
      created: deploymentAudit.submittedAt,
      finished: '',
      result: deploymentAudit.validationStatus === 'warning'
        ? `${vmRecord.name_label} was provisioned and is waiting for operator review before it can be treated as a validated baseline deployment.`
        : `${vmRecord.name_label} was provisioned and is waiting for post-deploy validation checks.`,
      error_info: [],
      resident_on: hostRef,
      task_kind: 'template_deployment',
      source: 'template_deployment',
      template_ref: templateRef,
      template_name: template.name_label || templateRef,
      template_version: governance?.versionLabel || '',
      vm_ref: vmRef,
      vm_name: vmRecord.name_label,
      host_ref: hostRef,
      host_label: resolveDemoInventoryLabel(demoDb.hosts, hostRef, ''),
      storage_ref: srRef,
      storage_label: resolveDemoInventoryLabel(demoDb.srs, srRef, ''),
      network_ref: body.networkRef || '',
      network_label: resolveDemoInventoryLabel(demoDb.networks, body.networkRef, ''),
      submitted_by: store.username || 'demo',
      validation_status: deploymentAudit.validationStatus,
      validation_notes: deploymentAudit.validationNotes,
      guest_customization: governance?.guestCustomization || '',
      boot_verified: false,
      network_verified: false,
      storage_verified: false,
      policy_tagged: Array.isArray(body.tags) && body.tags.length > 0,
      target_route: '/vms',
      related_class: 'vm',
      related_object: vmRef,
      steps: [
        { key: 'clone', label: 'Clone Template', status: 'success', detail: `${template.name_label || templateRef} was cloned into ${vmRecord.name_label}.` },
        { key: 'config', label: 'Apply VM Configuration', status: 'success', detail: 'Compute, naming, and metadata settings were applied to the deployed VM.' },
        { key: 'affinity', label: 'Place on Target Host', status: hostRef ? 'success' : 'info', detail: hostRef ? `Initial placement was directed to ${hostRef}.` : 'No explicit host placement was requested for this deployment.' },
        { key: 'network', label: 'Attach Primary Network', status: body.networkRef ? 'success' : 'info', detail: body.networkRef ? `Primary network attachment was requested for ${body.networkRef}.` : 'No explicit primary network attachment was requested at deploy time.' },
        { key: 'power', label: 'Initial Power Action', status: body.startAfter ? 'success' : 'info', detail: body.startAfter ? 'The deployed VM was started after provisioning completed.' : 'The deployed VM was left halted for operator-led validation.' },
        { key: 'validation', label: 'Post-Deploy Validation', status: deploymentAudit.validationStatus === 'warning' ? 'warning' : 'pending', detail: deploymentAudit.validationNotes },
      ],
    };
    demoDb.templateDeploymentRuns.unshift(deploymentRun);
    recordDemoAudit({
      category: 'templates',
      action: 'template_deployed',
      actionLabel: 'Deployed template to',
      entityType: 'vm',
      entityRef: vmRef,
      entityName: vmRecord.name_label,
      route: '/templates',
      before: template,
      after: { ...vmRecord, deploymentAudit, deploymentRun },
      detail: `${template.name_label || templateRef} deployed with ${deploymentAudit.validationStatus} validation status.`,
    });

    return clone({ ...vmRecord, deploymentAudit, deploymentRun });
  }

  if (method === 'POST' && (path === '/api/vms/compose/dry-run' || path === '/api/vms/compose/deploy')) {
    if (path === '/api/vms/compose/deploy') {
      ensureDemoMutationAllowed({ actionKey: 'compose_deploy', entityType: 'compose', entityRef: body.name || '' });
    }
    const plan = buildDemoComposePlan(body);

    if (path === '/api/vms/compose/dry-run') {
      return clone(plan);
    }

    const steps = [];
    let failed = false;

    for (const vmPlan of plan.plans) {
      const step = {
        key: vmPlan.key,
        label: vmPlan.nameLabel,
        status: 'pending',
        detail: '',
        started_at: new Date().toISOString(),
        finished_at: null,
        error_text: '',
      };
      steps.push(step);

      if (failed) {
        step.status = 'skipped';
        step.detail = 'Skipped because an earlier VM in the plan failed.';
        step.finished_at = new Date().toISOString();
        continue;
      }

      try {
        const template = demoDb.vms.find((vm) => vm.ref === vmPlan.templateRef);
        if (!template) throw new Error(`Template "${vmPlan.template}" could not be resolved.`);

        const vmRef = nextDemoOpaqueRef('vm');
        const vbdRef = nextDemoOpaqueRef('vbd');
        const hostRef = vmPlan.affinityRef || '';
        const host = demoDb.hosts.find((entry) => entry.ref === hostRef);

        const vmRecord = {
          ref: vmRef,
          name_label: vmPlan.nameLabel,
          name_description: vmPlan.nameDescription || '',
          power_state: vmPlan.startAfter ? 'Running' : 'Halted',
          VCPUs_at_startup: vmPlan.vcpusAtStartup,
          VCPUs_max: vmPlan.vcpusMax,
          memory_static_max: vmPlan.memoryStaticMax,
          memory_dynamic_max: vmPlan.memoryDynamicMax,
          uuid: `${vmRef.replace('OpaqueRef:', '')}-uuid`,
          is_a_template: false,
          resident_on: hostRef,
          affinity: hostRef,
          VBDs: [vbdRef],
          VIFs: [],
          HVM_boot_policy: template.HVM_boot_policy || 'UEFI',
          platform: clone(template.platform || {}),
          tags: vmPlan.tags || [],
        };
        demoDb.vms.push(vmRecord);

        if (host) {
          host.resident_VMs = [...(host.resident_VMs || []), vmRef];
        }

        for (const disk of vmPlan.disks) {
          const vdiRef = nextDemoOpaqueRef('vdi');
          const diskVbdRef = nextDemoOpaqueRef('vbd');
          if (!demoDb.vdis[disk.srRef]) demoDb.vdis[disk.srRef] = [];
          demoDb.vdis[disk.srRef].push({
            ref: vdiRef,
            uuid: `${vdiRef.replace('OpaqueRef:', '')}-uuid`,
            SR: disk.srRef,
            name_label: `${vmPlan.nameLabel} disk`,
            virtual_size: disk.sizeBytes,
            type: 'user',
            managed: true,
            VBDs: [diskVbdRef],
          });
          vmRecord.VBDs.push(diskVbdRef);
        }

        for (const nic of vmPlan.networkInterfaces) {
          const vifRef = nextDemoOpaqueRef('vif');
          const network = demoDb.networks.find((entry) => entry.ref === nic.networkRef);
          if (network) {
            network.VIFs = [...(network.VIFs || []), vifRef];
            registerDemoVifState(vifRef, { device: nic.device || '0', MAC: '', currently_attached: vmPlan.startAfter });
          }
          vmRecord.VIFs.push(vifRef);
        }

        step.status = 'success';
        step.detail = `Provisioned from "${vmPlan.template}" as ${vmPlan.nameLabel} (${vmRef}).`;
        step.finished_at = new Date().toISOString();
        step.ref = vmRef;
      } catch (error) {
        failed = true;
        step.status = 'failure';
        step.error_text = error.message || String(error);
        step.detail = `Deployment of "${vmPlan.nameLabel}" failed: ${step.error_text}`;
        step.finished_at = new Date().toISOString();
      }
    }

    const successCount = steps.filter((step) => step.status === 'success').length;
    const overallStatus = failed ? (successCount > 0 ? 'warning' : 'failure') : 'success';
    const result = failed
      ? `${successCount} of ${plan.plans.length} VM(s) deployed before this compose run stopped on a failure.`
      : `All ${plan.plans.length} VM(s) in "${body.name}" deployed successfully.`;

    const deploymentRun = {
      ref: `tmplrun-${Date.now()}`,
      uuid: `compose-deployment-${Date.now()}`,
      name_label: body.name,
      name_description: result,
      status: overallStatus,
      progress: plan.plans.length ? successCount / plan.plans.length : 1,
      created: new Date().toISOString(),
      finished: new Date().toISOString(),
      result,
      error_info: steps.filter((step) => step.status === 'failure').map((step) => step.detail),
      resident_on: '',
      task_kind: 'compose_deployment',
      source: 'compose_deployment',
      run_kind: 'compose',
      template_ref: body.name,
      template_name: body.name,
      template_version: body.version || '1',
      vm_ref: '',
      vm_name: body.name,
      host_ref: '',
      host_label: '',
      storage_ref: '',
      storage_label: '',
      network_ref: '',
      network_label: '',
      submitted_by: store.username || 'demo',
      validation_status: 'pending',
      validation_notes: '',
      guest_customization: '',
      boot_verified: false,
      network_verified: false,
      storage_verified: false,
      policy_tagged: false,
      target_route: '/vms',
      related_class: 'vm',
      related_object: '',
      steps,
    };
    demoDb.templateDeploymentRuns.unshift(deploymentRun);

    recordDemoAudit({
      category: 'templates',
      action: 'compose_deployed',
      actionLabel: 'Deployed compose spec',
      entityType: 'compose',
      entityRef: body.name,
      entityName: body.name,
      route: '/vms',
      before: null,
      after: deploymentRun,
      detail: result,
    });

    return clone(deploymentRun);
  }

  return undefined;
}

function buildDemoComposeInterpolate(value, variables) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (match, name) => {
      if (!Object.prototype.hasOwnProperty.call(variables, name)) {
        throw new Error(`Unknown variable "${name}" referenced in the compose spec.`);
      }
      return String(variables[name]);
    });
  }
  if (Array.isArray(value)) {
    return value.map((entry) => buildDemoComposeInterpolate(entry, variables));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, buildDemoComposeInterpolate(entry, variables)]));
  }
  return value;
}

function buildDemoComposeTopoSort(vmsMap) {
  const visited = new Set();
  const visiting = new Set();
  const order = [];

  function visit(key) {
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error(`Dependency cycle detected at VM "${key}".`);
    if (!vmsMap[key]) throw new Error(`VM "${key}" depends on an undefined VM.`);
    visiting.add(key);
    for (const dep of vmsMap[key].dependsOn || []) {
      if (!vmsMap[dep]) throw new Error(`VM "${key}" depends on undefined VM "${dep}".`);
      visit(dep);
    }
    visiting.delete(key);
    visited.add(key);
    order.push(key);
  }

  Object.keys(vmsMap).forEach(visit);
  return order;
}

function buildDemoComposeResolveRef(collection, nameOrRef, label) {
  const value = String(nameOrRef || '').trim();
  if (!value) throw new Error(`A ${label} reference is required.`);
  if (value.startsWith('OpaqueRef:')) return value;
  const match = collection.find((entry) => entry.uuid === value || entry.name_label === value);
  if (!match) throw new Error(`Could not resolve ${label} "${value}" on the target pool.`);
  return match.ref;
}

function buildDemoComposePlan(spec) {
  const variables = spec.variables || {};
  const resolvedVms = buildDemoComposeInterpolate(spec.vms || {}, variables);
  const resolvedNetworks = buildDemoComposeInterpolate(spec.networks || {}, variables);
  const resolvedStorageRepositories = buildDemoComposeInterpolate(spec.storageRepositories || {}, variables);
  const order = buildDemoComposeTopoSort(resolvedVms);
  const templates = demoDb.vms.filter((vm) => vm.is_a_template);

  const plans = order.map((key) => {
    const vmSpec = resolvedVms[key];
    const template = buildDemoComposeResolveRef(templates, vmSpec.template, `template "${vmSpec.template}"`);
    const memoryStaticMax = Number(vmSpec.memoryStaticMax);
    const memoryDynamicMax = vmSpec.memoryDynamicMax ? Number(vmSpec.memoryDynamicMax) : memoryStaticMax;
    const memoryDynamicMin = vmSpec.memoryDynamicMin ? Number(vmSpec.memoryDynamicMin) : memoryDynamicMax;
    const vcpusAtStartup = Math.round(Number(vmSpec.vcpusAtStartup || 1));
    const vcpusMax = Math.round(Number(vmSpec.vcpusMax || vcpusAtStartup));

    const disks = (vmSpec.disks || []).map((disk) => {
      const alias = disk.sr;
      const entry = resolvedStorageRepositories[alias];
      const srRef = entry
        ? buildDemoComposeResolveRef(demoDb.srs, entry.ref, `storage repository "${alias}"`)
        : buildDemoComposeResolveRef(demoDb.srs, alias, 'storage repository');
      return {
        srRef,
        srAlias: alias,
        sizeBytes: Math.round(Number(disk.sizeGb) * (1024 ** 3)),
        bootable: Boolean(disk.bootable),
        mode: disk.mode || 'RW',
      };
    });

    const networkInterfaces = (vmSpec.networkInterfaces || []).map((nic) => {
      const alias = nic.network;
      const entry = resolvedNetworks[alias];
      const networkRef = entry
        ? buildDemoComposeResolveRef(demoDb.networks, entry.ref, `network "${alias}"`)
        : buildDemoComposeResolveRef(demoDb.networks, alias, 'network');
      return { networkRef, networkAlias: alias, device: nic.device || '' };
    });

    return {
      key,
      template: vmSpec.template,
      templateRef: template,
      nameLabel: vmSpec.nameLabel,
      nameDescription: vmSpec.nameDescription || '',
      memoryStaticMax,
      memoryDynamicMax,
      memoryDynamicMin,
      vcpusAtStartup,
      vcpusMax,
      affinityRef: vmSpec.affinity ? buildDemoComposeResolveRef(demoDb.hosts, vmSpec.affinity, `host "${vmSpec.affinity}"`) : '',
      disks,
      networkInterfaces,
      tags: vmSpec.tags || [],
      dependsOn: vmSpec.dependsOn || [],
      startAfter: typeof vmSpec.startAfter === 'boolean' ? vmSpec.startAfter : Boolean(spec.startAfter),
    };
  });

  return { order, plans, variables };
}
