const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');
const auditLogService = require('../services/audit-log');
const { ensureMutationAllowed } = require('../middleware/governance');

async function safeGetNetworkRecord(xenApi, ref) {
  try {
    return await xenApi.getRecord('network', ref);
  } catch (error) {
    return null;
  }
}

function createRouteError(code, message = code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

router.get('/', async (req, res) => {
  try {
    const result = await req.xenApi.getNetworks();
    const networks = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));
    res.json({ total: networks.length, data: networks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/interfaces', async (req, res) => {
  try {
    const result = await req.xenApi.getVIFs();
    const vifs = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));
    res.json({ total: vifs.length, data: vifs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/',
  validate(schemas.networkCreate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'network_create', entityType: 'network', entityRef: req.body.bridge })) return;
      const record = await req.xenApi.createNetwork(req.body);
      auditLogService.record({
        category: 'networking',
        action: 'network_created',
        actionLabel: 'Created network',
        entityType: 'network',
        entityRef: record.ref,
        entityName: record.name_label || req.body.nameLabel || record.ref,
        operator: req.session?.xenUser || 'system',
        route: '/networking',
        status: 'success',
        before: null,
        after: record,
        detail: `${record.name_label || req.body.nameLabel || record.ref} was created on bridge ${record.bridge || req.body.bridge} with MTU ${record.MTU || req.body.mtu}.`,
      });
      res.status(201).json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/vlans',
  validate(schemas.networkVlanCreate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'network_vlan_create', entityType: 'network', entityRef: req.body.networkRef })) return;
      const networkRecord = await safeGetNetworkRecord(req.xenApi, req.body.networkRef);
      const record = await req.xenApi.createVlan(req.body);
      auditLogService.record({
        category: 'networking',
        action: 'network_vlan_created',
        actionLabel: 'Created VLAN mapping',
        entityType: 'vlan',
        entityRef: record.ref,
        entityName: `${record.tag || req.body.tag}`,
        operator: req.session?.xenUser || 'system',
        route: '/networking',
        status: 'success',
        before: null,
        after: record,
        detail: `VLAN ${record.tag || req.body.tag} was created on ${req.body.pifRef} for ${record.network?.name_label || networkRecord?.name_label || req.body.networkRef}.`,
      });
      res.status(201).json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/bonds',
  validate(schemas.networkBondCreate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'network_bond_create', entityType: 'network', entityRef: req.body.networkRef })) return;
      const networkRecord = await safeGetNetworkRecord(req.xenApi, req.body.networkRef);
      const record = await req.xenApi.createBond(req.body);
      auditLogService.record({
        category: 'networking',
        action: 'network_bond_created',
        actionLabel: 'Created bond mapping',
        entityType: 'bond',
        entityRef: record.ref,
        entityName: record.mode || req.body.mode || record.ref,
        operator: req.session?.xenUser || 'system',
        route: '/networking',
        status: 'success',
        before: null,
        after: record,
        detail: `Bond ${record.mode || req.body.mode} was created across ${(record.memberPifRefs || req.body.pifRefs || []).length} uplinks for ${record.network?.name_label || networkRecord?.name_label || req.body.networkRef}.`,
      });
      res.status(201).json(record);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.put('/:ref/config',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.networkConfigUpdate),
  async (req, res) => {
    try {
      if (!ensureMutationAllowed(req, res, { actionKey: 'network_config_update', entityType: 'network', entityRef: req.params.ref })) return;
      const previousRecord = await safeGetNetworkRecord(req.xenApi, req.params.ref);
      const record = await req.xenApi.updateNetworkConfig(req.params.ref, req.body);
      auditLogService.record({
        category: 'networking',
        action: 'network_config_updated',
        actionLabel: 'Updated network configuration',
        entityType: 'network',
        entityRef: req.params.ref,
        entityName: record.name_label || previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/networking',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.ref, ...record },
        detail: `Network metadata saved as ${record.name_label || req.body.nameLabel || req.params.ref}.`,
      });
      res.json({ ref: req.params.ref, ...record });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.post('/:ref/destroy',
  validate(schemas.opaqueRefParam, 'params'),
  validate(schemas.networkMutation),
  async (req, res) => {
    try {
      const previousRecord = await safeGetNetworkRecord(req.xenApi, req.params.ref);
      const pifCount = Array.isArray(previousRecord?.PIFs) ? previousRecord.PIFs.length : 0;
      const vifCount = Array.isArray(previousRecord?.VIFs) ? previousRecord.VIFs.length : 0;

      if (pifCount || vifCount) {
        const segments = [];
        if (pifCount) segments.push(`${pifCount} host uplink${pifCount === 1 ? '' : 's'}`);
        if (vifCount) segments.push(`${vifCount} workload interface${vifCount === 1 ? '' : 's'}`);
        throw createRouteError(
          'NETWORK_DESTROY_REQUIRES_DETACHED_ATTACHMENTS',
          `Destroy requires a detached managed network. ${segments.join(' and ')} still map to this network.`,
          409
        );
      }

      if (!ensureMutationAllowed(req, res, { actionKey: 'network_destroy', entityType: 'network', entityRef: req.params.ref, destructive: true })) return;
      await req.xenApi.destroyNetwork(req.params.ref);
      auditLogService.record({
        category: 'networking',
        action: 'network_destroyed',
        actionLabel: 'Destroyed network',
        entityType: 'network',
        entityRef: req.params.ref,
        entityName: previousRecord?.name_label || req.params.ref,
        operator: req.session?.xenUser || 'system',
        route: '/networking',
        status: 'success',
        before: previousRecord,
        after: { ref: req.params.ref, destroyed: true },
        detail: `${previousRecord?.name_label || req.params.ref} was removed from inventory and its network record was destroyed.`,
      });
      res.json({
        success: true,
        ref: req.params.ref,
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.code || err.message, message: err.message });
    }
  });

router.get('/:ref', validate(schemas.opaqueRefParam, 'params'), async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('network', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
