const express = require('express');
const { buildResilienceOverview } = require('../services/resilience');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [poolsResult, hostsResult, vmsResult, tasksResult, messagesResult] = await Promise.all([
      req.xenApi.getPools(),
      req.xenApi.getHosts(),
      req.xenApi.getVMs(),
      req.xenApi.getTasks(),
      req.xenApi.getMessages(),
    ]);

    const payload = buildResilienceOverview({
      pools: Object.entries(poolsResult.records || {}).map(([ref, record]) => ({ ref, ...record })),
      hosts: Object.entries(hostsResult.records || {}).map(([ref, record]) => ({ ref, ...record })),
      vms: Object.entries(vmsResult.records || {}).map(([ref, record]) => ({ ref, ...record })),
      tasks: Object.entries(tasksResult || {}).map(([ref, record]) => ({ ref, ...record })),
      messages: Object.entries(messagesResult || {}).map(([ref, record]) => ({ ref, ...record })),
    });

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
