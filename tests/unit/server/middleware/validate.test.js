const { validate, schemas } = require('../../../../server/middleware/validate');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('login schema', () => {
    it('should pass with valid login data', () => {
      req.body = { host: '192.168.1.100', username: 'root', password: 'pass' };
      validate(schemas.login)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject missing host', () => {
      req.body = { username: 'root', password: 'pass' };
      validate(schemas.login)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'VALIDATION_ERROR' })
      );
    });

    it('should reject empty username', () => {
      req.body = { host: '192.168.1.100', username: '', password: 'pass' };
      validate(schemas.login)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should strip unknown fields', () => {
      req.body = { host: '192.168.1.100', username: 'root', password: 'pass', extra: 'data' };
      validate(schemas.login)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body).not.toHaveProperty('extra');
    });
  });

  describe('vmLifecycle schema', () => {
    it('should pass with valid ref', () => {
      req.body = { ref: 'OpaqueRef:12345678-1234-1234-1234-123456789abc' };
      validate(schemas.vmLifecycle)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid ref format', () => {
      req.body = { ref: 'invalid-ref' };
      validate(schemas.vmLifecycle)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should default paused and force to false', () => {
      req.body = { ref: 'OpaqueRef:12345678-1234-1234-1234-123456789abc' };
      validate(schemas.vmLifecycle)(req, res, next);
      expect(req.body.paused).toBe(false);
      expect(req.body.force).toBe(false);
    });
  });

  describe('connection schemas', () => {
    it('should pass valid saved connection payloads', () => {
      req.body = { name: 'Production', host: '10.0.0.1', username: 'root', port: 443, isDefault: true };
      validate(schemas.connectionCreate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.port).toBe(443);
    });

    it('should reject invalid connection ports', () => {
      req.body = { name: 'Production', host: '10.0.0.1', username: 'root', port: 70000 };
      validate(schemas.connectionCreate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate numeric connection ids from route params', () => {
      req.params = { id: '42' };
      validate(schemas.connectionId, 'params')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.params.id).toBe(42);
    });

    it('should validate opaque refs from route params', () => {
      req.params = { ref: 'OpaqueRef:host1' };
      validate(schemas.opaqueRefParam, 'params')(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('paginate schema', () => {
    it('should apply defaults', () => {
      req.body = {};
      validate(schemas.paginate, 'body')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.page).toBe(1);
      expect(req.body.pageSize).toBe(50);
    });

    it('should reject pageSize > 500', () => {
      req.body = { pageSize: 600 };
      validate(schemas.paginate, 'body')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('templateDeploy schema', () => {
    it('should pass valid template deployment payloads', () => {
      req.body = {
        nameLabel: 'ubuntu-prod-01',
        nameDescription: 'Primary application deployment',
        hostRef: 'OpaqueRef:host1',
        storageRef: 'OpaqueRef:sr1',
        networkRef: 'OpaqueRef:net1',
        vcpus: 4,
        memoryStaticMax: 8589934592,
        tags: ['prod', 'linux'],
        startAfter: true,
      };
      validate(schemas.templateDeploy)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.startAfter).toBe(true);
    });

    it('should default optional placement values and startAfter', () => {
      req.body = {
        nameLabel: 'ubuntu-prod-02',
        vcpus: 2,
        memoryStaticMax: 4294967296,
      };
      validate(schemas.templateDeploy)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.hostRef).toBeNull();
      expect(req.body.storageRef).toBeNull();
      expect(req.body.networkRef).toBeNull();
      expect(req.body.startAfter).toBe(false);
      expect(req.body.tags).toEqual([]);
    });

    it('should reject invalid placement references', () => {
      req.body = {
        nameLabel: 'ubuntu-prod-03',
        hostRef: 'host-1',
        vcpus: 2,
        memoryStaticMax: 4294967296,
      };
      validate(schemas.templateDeploy)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('templateGovernanceUpdate schema', () => {
    it('should pass valid template governance payloads', () => {
      req.body = {
        versionLabel: '2026.08-lts',
        profileLabel: 'Secure Linux',
        lifecycleStage: 'stable',
        goldenImage: true,
        guestCustomization: 'cloud-init baseline',
        validationStatus: 'validated',
        lastValidatedAt: '2026-08-19T00:00:00.000Z',
        owner: 'Platform Ops',
        notes: 'Approved for production rollout.',
      };
      validate(schemas.templateGovernanceUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.goldenImage).toBe(true);
    });

    it('should default template governance values', () => {
      req.body = {};
      validate(schemas.templateGovernanceUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.lifecycleStage).toBe('draft');
      expect(req.body.validationStatus).toBe('untested');
      expect(req.body.goldenImage).toBe(false);
    });

    it('should reject invalid validation dates', () => {
      req.body = { lastValidatedAt: 'August 19' };
      validate(schemas.templateGovernanceUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('templateDeploymentValidationUpdate schema', () => {
    it('should pass valid deployment validation payloads', () => {
      req.body = {
        validationStatus: 'validated',
        validationNotes: 'Boot and network checks passed.',
        guestCustomization: 'cloud-init baseline',
        bootVerified: true,
        networkVerified: true,
        storageVerified: true,
        policyTagged: true,
      };
      validate(schemas.templateDeploymentValidationUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.bootVerified).toBe(true);
    });

    it('should default deployment validation values', () => {
      req.body = {};
      validate(schemas.templateDeploymentValidationUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.validationStatus).toBe('pending');
      expect(req.body.policyTagged).toBe(false);
    });
  });

  describe('lifecyclePlanUpdate schema', () => {
    it('should pass valid lifecycle plan payloads', () => {
      req.body = {
        baselineStatus: 'drifted',
        targetStage: 'remediate',
        maintenanceWindow: 'Sat 01:00',
        patchGroup: 'Production Ring A',
        owner: 'Platform Ops',
        nextAction: 'patch',
        rebootRequired: true,
        evacuationRequired: true,
        dueDate: '2026-08-22',
        notes: 'Apply the August host baseline.',
        sourceTaskRef: 'OpaqueRef:remediation-1',
        sourceTemplateId: 'template-1',
        sourceTemplateName: 'Host Maintenance Review',
      };
      validate(schemas.lifecyclePlanUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.targetStage).toBe('remediate');
    });

    it('should default lifecycle plan values', () => {
      req.body = {};
      validate(schemas.lifecyclePlanUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.baselineStatus).toBe('unknown');
      expect(req.body.nextAction).toBe('scan');
      expect(req.body.rebootRequired).toBe(false);
    });

    it('should reject invalid due dates', () => {
      req.body = { dueDate: '08/22/2026' };
      validate(schemas.lifecyclePlanUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('alertStateUpdate schema', () => {
    it('should pass valid alert state payloads', () => {
      req.body = {
        acknowledged: true,
        suppressionUntil: '2026-08-20T15:00:00.000Z',
        severityOverride: 'warning',
        healthAction: 'review',
        notes: 'Track during the current change window.',
      };
      validate(schemas.alertStateUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.healthAction).toBe('review');
    });

    it('should default alert state values', () => {
      req.body = {};
      validate(schemas.alertStateUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.acknowledged).toBe(false);
      expect(req.body.severityOverride).toBe('');
      expect(req.body.healthAction).toBe('none');
    });

    it('should reject invalid suppression dates', () => {
      req.body = { suppressionUntil: 'tomorrow morning' };
      validate(schemas.alertStateUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should accept workflow-oriented health actions', () => {
      req.body = { healthAction: 'capacity' };
      validate(schemas.alertStateUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.healthAction).toBe('capacity');
    });
  });

  describe('alertBulkStateUpdate schema', () => {
    it('should validate bulk alert triage payloads', () => {
      req.body = {
        refs: ['OpaqueRef:msg1', 'OpaqueRef:msg2'],
        state: {
          acknowledged: true,
          suppressionUntil: '2026-08-22T18:00:00.000Z',
          severityOverride: '',
          healthAction: 'resilience',
          notes: 'Bulk triage for Saturday, August 22, 2026.',
        },
      };
      validate(schemas.alertBulkStateUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid bulk refs', () => {
      req.body = {
        refs: ['msg1'],
        state: { acknowledged: true },
      };
      validate(schemas.alertBulkStateUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('alertPolicyUpdate schema', () => {
    it('should validate alert policy payloads', () => {
      req.body = {
        enabled: true,
        name: 'Storage Warning Review',
        matchClass: 'sr',
        matchTargetRoute: '/storage',
        matchObject: 'sr-uuid-1',
        matchSeverity: 'warning',
        matchText: 'storage',
        textMatchMode: 'all',
        autoAcknowledge: false,
        suppressionHours: 12,
        severityOverride: '',
        healthAction: 'capacity',
        notes: 'Apply this policy during the Saturday, August 22, 2026 maintenance cycle.',
      };
      validate(schemas.alertPolicyUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.healthAction).toBe('capacity');
      expect(req.body.textMatchMode).toBe('all');
    });

    it('should reject unnamed alert policies', () => {
      req.body = {
        matchClass: 'host',
      };
      validate(schemas.alertPolicyUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('remediationTaskCreate schema', () => {
    it('should validate remediation task payloads', () => {
      req.body = {
        nameLabel: 'Capacity Review: Storage nearing threshold',
        nameDescription: 'Review the affected datastore and capture follow-through notes.',
        actionType: 'capacity',
        assignee: 'Platform Ops',
        dueDate: '2026-08-23',
        alertRef: 'OpaqueRef:msg1',
        alertUuid: 'msg-uuid-1',
        alertSummary: 'Storage nearing threshold',
        targetRoute: '/capacity',
        relatedObject: 'sr-uuid-1',
        relatedClass: 'sr',
        lifecyclePlanSeed: {
          enabled: true,
          baselineStatus: 'drifted',
          targetStage: 'maintenance',
          dueDays: 3,
          notes: 'Prepare {summary}',
        },
        resilienceRunbookSeed: {
          enabled: true,
          recoveryTier: 'tier-1',
          haPolicy: 'priority-restart',
          restartPriority: 'high',
          backupWindowHours: 12,
          rpoMinutes: 30,
          rtoMinutes: 90,
          restorePointStatus: 'review',
          runbookSteps: ['Validate backup currency'],
        },
      };
      validate(schemas.remediationTaskCreate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.actionType).toBe('capacity');
      expect(req.body.lifecyclePlanSeed.enabled).toBe(true);
      expect(req.body.resilienceRunbookSeed.recoveryTier).toBe('tier-1');
    });

    it('should reject remediation task payloads without opaque alert refs', () => {
      req.body = {
        nameLabel: 'Capacity Review: Storage nearing threshold',
        alertRef: 'msg1',
        alertSummary: 'Storage nearing threshold',
      };
      validate(schemas.remediationTaskCreate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('remediationTaskUpdate schema', () => {
    it('should validate remediation task updates', () => {
      req.body = {
        status: 'in_progress',
        assignee: 'Cloud Operations',
        dueDate: '2026-08-24',
        result: 'Work started on Saturday, August 22, 2026.',
        nameDescription: 'Track remediation progress in Activity.',
      };
      validate(schemas.remediationTaskUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.status).toBe('in_progress');
    });

    it('should reject unsupported remediation task statuses', () => {
      req.body = { status: 'done-ish' };
      validate(schemas.remediationTaskUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('remediationTaskTemplateUpdate schema', () => {
    it('should validate remediation task templates', () => {
      req.body = {
        enabled: true,
        name: 'Storage Capacity Review',
        matchClass: 'sr',
        matchTargetRoute: '/storage',
        matchObject: 'sr-uuid-1',
        matchSeverity: 'warning',
        matchText: 'storage threshold',
        textMatchMode: 'all',
        actionType: 'capacity',
        taskNameTemplate: 'Capacity Review: {summary}',
        defaultAssignee: 'Platform Ops',
        defaultDueDays: 2,
        defaultTargetRoute: '/capacity',
        defaultNotes: 'Prepare a mitigation summary before Monday, August 24, 2026.',
        workspaceSummaryTemplate: 'Validate datastore pressure and capture evidence for {summary}.',
        evidenceChecklist: ['Capture current latency evidence.', 'Review affected workloads.'],
        completionCriteria: ['Owner confirmed.', 'Closure note recorded.'],
        launchMode: 'queue',
        recurrenceMode: 'daily',
        recurrenceScope: 'object',
        cooldownDays: 0,
        lifecyclePlanSeed: {
          enabled: true,
          baselineStatus: 'drifted',
          targetStage: 'maintenance',
          maintenanceWindow: 'Sun 02:00',
          patchGroup: 'Production Ring A',
          owner: 'Platform Ops',
          nextAction: 'patch',
          rebootRequired: true,
          evacuationRequired: true,
          dueDays: 2,
          notes: 'Patch {summary}',
        },
        resilienceRunbookSeed: {
          enabled: true,
          recoveryTier: 'tier-1',
          haPolicy: 'priority-restart',
          restartPriority: 'high',
          backupWindowHours: 12,
          rpoMinutes: 30,
          rtoMinutes: 90,
          restorePointStatus: 'review',
          standbyHostRef: 'OpaqueRef:host1',
          failoverNetworkRef: 'OpaqueRef:net1',
          runbookSteps: ['Validate backups', 'Confirm standby host'],
          notes: 'Protect {summary}',
        },
      };
      validate(schemas.remediationTaskTemplateUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.defaultDueDays).toBe(2);
      expect(req.body.launchMode).toBe('queue');
      expect(req.body.recurrenceMode).toBe('daily');
      expect(req.body.evidenceChecklist).toHaveLength(2);
      expect(req.body.lifecyclePlanSeed.patchGroup).toBe('Production Ring A');
      expect(req.body.resilienceRunbookSeed.runbookSteps).toHaveLength(2);
    });

    it('should reject remediation templates without a name', () => {
      req.body = {
        taskNameTemplate: 'Review: {summary}',
      };
      validate(schemas.remediationTaskTemplateUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should require cooldownDays when the recurrence guard uses a cooldown window', () => {
      req.body = {
        name: 'Storage Capacity Review',
        taskNameTemplate: 'Review: {summary}',
        recurrenceMode: 'cooldown',
      };
      validate(schemas.remediationTaskTemplateUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('governance schemas', () => {
    it('should default governance policy values', () => {
      req.body = {};
      validate(schemas.governancePolicyUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.defaultRole).toBe('admin');
      expect(req.body.requireDestructiveApproval).toBe(true);
      expect(req.body.approvalTtlMinutes).toBe(240);
    });

    it('should validate governance role changes', () => {
      req.body = { role: 'operator' };
      validate(schemas.governanceRoleUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid governance roles', () => {
      req.body = { role: 'super-admin' };
      validate(schemas.governanceRoleUpdate)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate governance quota payloads', () => {
      req.body = {
        enabled: true,
        owner: 'Platform Ops',
        maxVmCount: 12,
        maxRunningVmCount: 10,
        maxTotalMemoryGiB: 128,
        notes: 'Production pool quota.',
      };
      validate(schemas.governanceQuotaUpdate)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body.maxVmCount).toBe(12);
    });

    it('should validate governance approval requests', () => {
      req.body = {
        actionKey: 'vm_shutdown',
        entityType: 'vm',
        entityRef: 'OpaqueRef:vm1',
        entityName: 'app-01',
        justification: 'Controlled shutdown during the Friday, August 21, 2026 maintenance window.',
        route: '/vms',
      };
      validate(schemas.governanceApprovalRequest)(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should reject missing governance approval justification', () => {
      req.body = {
        actionKey: 'vm_shutdown',
        entityType: 'vm',
        entityRef: 'OpaqueRef:vm1',
      };
      validate(schemas.governanceApprovalRequest)(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
