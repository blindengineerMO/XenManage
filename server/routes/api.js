const express = require('express');
const router = express.Router();
const { connectionModel } = require('../models/connection');
const { validate, schemas } = require('../middleware/validate');

router.get('/', (req, res) => {
  const connections = connectionModel.getAll();
  res.json(connections);
});

router.post('/', validate(schemas.connectionCreate), (req, res) => {
  try {
    const conn = connectionModel.create(req.body);
    res.status(201).json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', validate(schemas.connectionId, 'params'), validate(schemas.connectionUpdate), (req, res) => {
  try {
    const conn = connectionModel.update(req.params.id, req.body);
    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/default', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    const conn = connectionModel.setDefault(req.params.id);
    res.json(conn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', validate(schemas.connectionId, 'params'), (req, res) => {
  try {
    connectionModel.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
