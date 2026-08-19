const express = require('express');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const tasks = await req.xenApi.getTasks();
    const list = Object.entries(tasks)
      .map(([ref, record]) => ({ ref, ...record }))
      .sort((left, right) => {
        const rightDate = new Date(right.finished || right.created || 0).getTime();
        const leftDate = new Date(left.finished || left.created || 0).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 200);

    res.json({ total: list.length, data: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
