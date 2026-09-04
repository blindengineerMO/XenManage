const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { ensureMutationAllowed } = require('../middleware/governance');
const auditLogService = require('../services/audit-log');
const systemConfigService = require('../services/system-config');
const metricsCollector = require('../services/metrics-collector');
const retentionService = require('../services/retention');
const credentialVaultService = require('../services/credential-vault');
const backupService = require('../services/control-plane-backup');

const router = express.Router();

function getSectionSchema(section) {
  if (section === 'general') return schemas.systemConfigGeneralUpdate;
  if (section === 'network') return schemas.systemConfigNetworkUpdate;
  if (section === 'security') return schemas.systemConfigSecurityUpdate;
  if (section === 'logging') return schemas.systemConfigLoggingUpdate;
  if (section === 'performance') return schemas.systemConfigPerformanceUpdate;
  if (section === 'interaction') return schemas.systemConfigInteractionUpdate;
  if (section === 'retention') return schemas.systemConfigRetentionUpdate;
  if (section === 'controlPlaneBackup') return schemas.systemConfigControlPlaneBackupUpdate;
  return null;
}

router.get('/', (_req, res) => {
  try {
    res.json({
      ...systemConfigService.getAll(),
      retentionPolicies: retentionService.listPolicies(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/retention/preview', validate(schemas.retentionRun, 'query'), (req, res) => {
  try {
    const result = retentionService.runSweep({
      domain: req.query.domain,
      dryRun: true,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/vault/rewrap', (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, {
      actionKey: 'vault_rewrap',
      entityType: 'vault',
      entityRef: 'credentials',
    })) return;

    const previous = systemConfigService.getAll().vault;
    const result = credentialVaultService.rewrapAll(
      req.session?.userId || null,
      req.session?.governanceRole || req.session?.user?.role || 'admin'
    );
    const vault = systemConfigService.getAll().vault;

    auditLogService.record({
      category: 'system',
      action: 'vault_rewrapped',
      actionLabel: 'Re-wrapped vault credentials under',
      entityType: 'vault',
      entityRef: 'credentials',
      entityName: 'Credential Vault',
      operator: req.session?.appUsername || req.session?.xenUser || 'system',
      route: '/settings',
      status: result.failed ? 'warning' : 'success',
      before: previous,
      after: { result, vault },
      detail: `${result.rewrapped} credential wrap(s) were refreshed under the current master key with ${result.failed} failure(s).`,
    });

    res.json({ result, vault });
  } catch (err) {
    const code = err.code || err.message || 'VAULT_REWRAP_FAILED';
    const status = code === 'VAULT_PREVIOUS_KEY_NOT_CONFIGURED' ? 409 : 500;
    res.status(status).json({ error: code });
  }
});

router.post('/retention/run', validate(schemas.retentionRun), (req, res) => {
  try {
    if (!req.body.dryRun) {
      if (!ensureMutationAllowed(req, res, {
        actionKey: 'retention_sweep_run',
        entityType: 'retention-domain',
        entityRef: req.body.domain || 'all',
        destructive: true,
      })) return;
    } else if (!ensureMutationAllowed(req, res, {
      actionKey: 'retention_sweep_preview',
      entityType: 'retention-domain',
      entityRef: req.body.domain || 'all',
    })) {
      return;
    }

    const result = retentionService.runSweep({
      domain: req.body.domain,
      dryRun: Boolean(req.body.dryRun),
      actor: req.session?.xenUser || 'system',
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/retention/policies/:domain',
  validate(schemas.retentionDomainParam, 'params'),
  validate(schemas.retentionPolicyUpdate),
  (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, {
        actionKey: 'retention_policy_save',
        entityType: 'retention-domain',
        entityRef: req.params.domain,
      })) return;

      const previous = retentionService.getPolicy(req.params.domain);
      const policy = retentionService.upsertPolicy(req.params.domain, req.body);

      auditLogService.record({
        category: 'system',
        action: 'retention_policy_saved',
        actionLabel: 'Saved retention policy for',
        entityType: 'retention-domain',
        entityRef: req.params.domain,
        entityName: policy.label,
        operator: req.session?.xenUser || 'system',
        route: '/settings',
        status: 'success',
        before: previous,
        after: policy,
        detail: `${policy.retentionDays} day retention with ${policy.enabled ? 'enabled' : 'disabled'} execution state.`,
      });

      res.json(policy);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

router.put('/:section',
  validate(schemas.systemConfigSectionParam, 'params'),
  (req, res, next) => {
    const schema = getSectionSchema(req.params.section);
    if (!schema) {
      return res.status(404).json({ error: 'UNKNOWN_SETTINGS_SECTION' });
    }
    return validate(schema)(req, res, next);
  },
  (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, {
        actionKey: 'system_config_save',
        entityType: 'settings-section',
        entityRef: req.params.section,
      })) return;

      const previous = systemConfigService.getSection(req.params.section);
      const section = systemConfigService.updateSection(req.params.section, req.body);

      if (req.params.section === 'network') {
        systemConfigService.applyExpressSettings(req.app);
      }

      if (req.params.section === 'retention') {
        retentionService.refreshScheduler();
      }

      if (req.params.section === 'controlPlaneBackup') {
        backupService.refreshScheduler();
      }

      if (req.params.section === 'performance') {
        metricsCollector.refreshScheduler();
      }

      auditLogService.record({
        category: 'system',
        action: 'system_config_saved',
        actionLabel: 'Saved system configuration for',
        entityType: 'settings-section',
        entityRef: req.params.section,
        entityName: req.params.section,
        operator: req.session?.xenUser || 'system',
        route: '/settings',
        status: 'success',
        before: previous,
        after: section,
        detail: `${req.params.section} settings were updated from the Settings workspace.`,
      });

      res.json({
        section,
        retentionPolicies: retentionService.listPolicies(),
        runtime: systemConfigService.getAll().runtime,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

module.exports = router;
