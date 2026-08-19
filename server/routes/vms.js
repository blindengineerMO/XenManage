const express = require('express');
const router = express.Router();
const { validate, schemas } = require('../middleware/validate');

router.get('/', validate(schemas.paginate, 'query'), async (req, res) => {
  try {
    const { search } = req.query;
    const result = await req.xenApi.getVMs();
    let vms = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }));

    // Filter out templates by default
    vms = vms.filter(vm => !vm.is_a_template);

    if (search) {
      const q = search.toLowerCase();
      vms = vms.filter(vm =>
        (vm.name_label || '').toLowerCase().includes(q) ||
        (vm.name_description || '').toLowerCase().includes(q)
      );
    }

    res.json({
      total: vms.length,
      data: vms,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates', async (req, res) => {
  try {
    const result = await req.xenApi.getVMs();
    const templates = Object.entries(result.records)
      .map(([ref, r]) => ({ ref, ...r }))
      .filter(vm => vm.is_a_template);
    res.json({ total: templates.length, data: templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ref', async (req, res) => {
  try {
    const record = await req.xenApi.getRecord('VM', req.params.ref);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:ref/config', validate(schemas.vmConfigUpdate), async (req, res) => {
  try {
    const record = await req.xenApi.updateVMConfig(req.params.ref, req.body);
    res.json({ ref: req.params.ref, ...record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ref/disks', validate(schemas.vmDiskCreate), async (req, res) => {
  try {
    const result = await req.xenApi.addVMDisk(req.params.ref, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ref/nics', validate(schemas.vmNicCreate), async (req, res) => {
  try {
    const result = await req.xenApi.addVMNic(req.params.ref, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', validate(schemas.vmLifecycle), async (req, res) => {
  try {
    await req.xenApi.startVM(req.body.ref, req.body.paused, req.body.force);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/shutdown', validate(schemas.vmLifecycle), async (req, res) => {
  try {
    await req.xenApi.shutdownVM(req.body.ref, req.body.force);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reboot', validate(schemas.vmLifecycle), async (req, res) => {
  try {
    await req.xenApi.rebootVM(req.body.ref, req.body.force);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/suspend', validate(schemas.vmAction), async (req, res) => {
  try {
    await req.xenApi.suspendVM(req.body.ref);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resume', validate(schemas.vmLifecycle), async (req, res) => {
  try {
    await req.xenApi.resumeVM(req.body.ref, req.body.paused);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
