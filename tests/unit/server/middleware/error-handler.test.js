const express = require('express');
const http = require('http');
const { createErrorHandler, normalizeStatus, apiErrorCode } = require('../../../../server/middleware/error-handler');

function request(server, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: server.address().port,
      path: options.path || '/api/test',
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

describe('request error handler', () => {
  let server;
  let log;
  let tracker;

  beforeEach(() => {
    log = { error: jest.fn() };
    tracker = { captureException: jest.fn() };
  });

  afterEach((done) => {
    if (!server) return done();
    server.close(() => {
      server = null;
      done();
    });
  });

  function listen(configure) {
    const app = express();
    configure(app);
    app.use(createErrorHandler({ logger: log, errorTracking: tracker, environment: 'test' }));
    server = app.listen(0);
  }

  it('catches synchronous route errors through the Express boundary', async () => {
    listen((app) => app.get('/api/test', () => { throw new Error('sync failure'); }));

    const response = await request(server);

    expect(response).toEqual({ status: 500, body: '{"error":"INTERNAL_SERVER_ERROR"}' });
    expect(log.error).toHaveBeenCalledWith('request_failed', expect.objectContaining({ status: 500 }));
    expect(tracker.captureException).toHaveBeenCalledTimes(1);
  });

  it('catches rejected async route handlers through the Express 5 boundary', async () => {
    listen((app) => app.get('/api/test', async () => { throw new Error('async failure'); }));

    await expect(request(server)).resolves.toEqual({
      status: 500,
      body: '{"error":"INTERNAL_SERVER_ERROR"}',
    });
  });

  it('returns a safe 400 response for malformed JSON instead of a 500', async () => {
    listen((app) => {
      app.use(express.json());
      app.post('/api/test', (_req, res) => res.json({ ok: true }));
    });

    const response = await request(server, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken',
    });

    expect(response).toEqual({ status: 400, body: '{"error":"INVALID_JSON"}' });
    expect(tracker.captureException).not.toHaveBeenCalled();
  });

  it('normalizes only safe client statuses', () => {
    expect(normalizeStatus({ status: 413 })).toBe(413);
    expect(normalizeStatus({ status: 302 })).toBe(500);
    expect(apiErrorCode({ type: 'entity.parse.failed' }, 400)).toBe('INVALID_JSON');
  });
});
