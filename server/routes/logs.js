const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { ensureMutationAllowed } = require('../middleware/governance');
const logCenterService = require('../services/log-center');
const auditLogService = require('../services/audit-log');

const router = express.Router();

router.get('/', validate(schemas.logsListQuery, 'query'), async (req, res) => {
  try {
    const result = await logCenterService.listPage({
      xenApi: req.xenApi,
      page: req.query.page,
      pageSize: req.query.pageSize,
      search: req.query.search,
      source: req.query.source,
      severity: req.query.severity,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/export', validate(schemas.logsExport), async (req, res) => {
  try {
    if (!ensureMutationAllowed(req, res, {
      actionKey: 'log_export',
      entityType: 'log-export',
      entityRef: String((req.body.ids || []).length || 'all'),
    })) return;

    const entries = await logCenterService.getEntriesForExport({
      xenApi: req.xenApi,
      ids: req.body.ids,
      search: req.body.search,
      source: req.body.source,
      severity: req.body.severity,
    });
    const generatedAt = new Date().toISOString();

    auditLogService.record({
      category: 'activity',
      action: 'log_export_requested',
      actionLabel: 'Exported centralized logs for',
      entityType: 'log-export',
      entityRef: String(entries.length),
      entityName: `${entries.length} log entries`,
      operator: req.session?.xenUser || 'system',
      route: '/activity',
      status: 'success',
      before: null,
      after: {
        format: req.body.format,
        count: entries.length,
        source: req.body.source,
        severity: req.body.severity,
        selected: (req.body.ids || []).length,
      },
      detail: `${req.body.format.toUpperCase()} export generated for ${entries.length} log record${entries.length === 1 ? '' : 's'}.`,
    });

    if (req.body.format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="xenmange-log-export.json"');
      res.send(JSON.stringify({ generatedAt, total: entries.length, data: entries }, null, 2));
      return;
    }

    if (req.body.format === 'html') {
      const html = await logCenterService.renderHtmlReport(entries, {
        title: 'XenMange Log Export',
        generatedAt,
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="xenmange-log-export.html"');
      res.send(html);
      return;
    }

    const doc = logCenterService.buildPdf(entries, {
      title: 'XenMange Log Export',
      generatedAt,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="xenmange-log-export.pdf"');
    doc.pipe(res);
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
