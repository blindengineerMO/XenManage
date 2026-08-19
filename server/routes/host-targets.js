const express = require('express');
const router = express.Router();
const { hostTargetModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');

router.get('/', (req, res) => {
  res.json(hostTargetModel.getAll());
});

router.post('/', validate(schemas.hostTargetCreate), (req, res) => {
  try {
    const target = hostTargetModel.create(req.body);
    res.status(201).json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', validate(schemas.connectionId, 'params'), validate(schemas.hostTargetUpdate), (req, res) => {
  try {
    const target = hostTargetModel.update(req.params.id, req.body);
    res.json(target);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    hostTargetModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
