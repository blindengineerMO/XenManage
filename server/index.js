require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const securityMiddleware = require('./middleware/security');
const { createApiRateLimiter } = require('./middleware/rate-limit');
const { csrfProtection } = require('./middleware/csrf');
const requestLogging = require('./middleware/request-logging');
const logger = require('./services/logger');
const sessionMiddleware = require('./middleware/session');
const { router: authRouter, requireAuth, requireXenConnection, buildStatusPayload } = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const vmRoutes = require('./routes/vms');
const hostRoutes = require('./routes/hosts');
const storageRoutes = require('./routes/storage');
const networkRoutes = require('./routes/networks');
const poolRoutes = require('./routes/pools');
const taskRoutes = require('./routes/tasks');
const resilienceRoutes = require('./routes/resilience');
const lifecycleRoutes = require('./routes/lifecycle');
const alertRoutes = require('./routes/alerts');
const auditRoutes = require('./routes/audit');
const governanceRoutes = require('./routes/governance');
const systemConfigRoutes = require('./routes/system-config');
const logRoutes = require('./routes/logs');
const metricsRoutes = require('./routes/metrics');
const credentialRoutes = require('./routes/credentials');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const apiRoutes = require('./routes/api');
const hostTargetRoutes = require('./routes/host-targets');
const workspaceRoutes = require('./routes/workspaces');
const templateLibraryRoutes = require('./routes/template-library');
const vFabricRoutes = require('./routes/vfabrics');
const managedTargetRoutes = require('./routes/managed-targets');
const workflowRoutes = require('./routes/workflows');
const publicApiRoutes = require('./routes/public-api');
const projectRoutes = require('./routes/projects');
const healthRoutes = require('./routes/health');
const metricsExportRoutes = require('./routes/metrics-export');
const controlPlaneBackupRoutes = require('./routes/control-plane-backups');
const governanceService = require('./services/governance');
const metricsCollector = require('./services/metrics-collector');
const managedTargetService = require('./services/managed-targets');
const workflowEngine = require('./services/workflow-engine');
const systemConfigService = require('./services/system-config');
const retentionService = require('./services/retention');

const app = express();
systemConfigService.applyExpressSettings(app);

// Security
securityMiddleware(app);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogging);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => config.env === 'test',
  message: { error: 'Too many login attempts, please try again later' },
});
const apiLimiter = createApiRateLimiter({
  windowMs: config.rateLimit.apiWindowMs,
  max: config.rateLimit.apiMax,
  skip: () => config.env === 'test',
});
const apiCsrfProtection = csrfProtection({ skip: () => config.env === 'test' });

// Session
sessionMiddleware(app);

// View engine for error pages
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/assets', express.static(path.join(__dirname, '..', 'client', 'assets'), {
  maxAge: config.env === 'production' ? '1d' : 0,
}));

// CDN assets directory (for vue, tailwind output, etc.)
app.use('/dist', express.static(path.join(__dirname, '..', 'client', 'dist'), {
  maxAge: config.env === 'production' ? '1d' : 0,
}));

// API Routes
app.use(healthRoutes);
app.use(metricsExportRoutes);
app.use('/api', apiLimiter);
app.use('/api', apiCsrfProtection);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/xen-login', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/dashboard', requireXenConnection, dashboardRoutes);
app.use('/api/vms', requireXenConnection, vmRoutes);
app.use('/api/hosts', requireXenConnection, hostRoutes);
app.use('/api/storage', requireXenConnection, storageRoutes);
app.use('/api/networks', requireXenConnection, networkRoutes);
app.use('/api/pools', requireXenConnection, poolRoutes);
app.use('/api/tasks', requireXenConnection, taskRoutes);
app.use('/api/resilience', requireXenConnection, resilienceRoutes);
app.use('/api/lifecycle', requireXenConnection, lifecycleRoutes);
app.use('/api/alerts', requireXenConnection, alertRoutes);
app.use('/api/audit', requireAuth, auditRoutes);
app.use('/api/governance', requireAuth, governanceRoutes);
app.use('/api/settings', requireAuth, systemConfigRoutes);
app.use('/api/logs', requireAuth, logRoutes);
app.use('/api/metrics', requireXenConnection, metricsRoutes);
app.use('/api/credentials', requireAuth, credentialRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/groups', requireAuth, groupRoutes);
app.use('/api/connections', requireAuth, apiRoutes);
app.use('/api/host-targets', requireAuth, hostTargetRoutes);
app.use('/api/workspaces', requireAuth, workspaceRoutes);
app.use('/api/template-library', requireAuth, templateLibraryRoutes);
app.use('/api/vfabrics', requireAuth, vFabricRoutes);
app.use('/api/managed-targets', requireAuth, managedTargetRoutes);
app.use('/api/workflows', requireAuth, workflowRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/control-plane-backups', requireAuth, controlPlaneBackupRoutes);
app.use('/api/v1', publicApiRoutes);

// Vue SPA - serve index.html for all non-API routes
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  const bootstrap = JSON.stringify(
    req.session?.authenticated
      ? buildStatusPayload(req)
      : {
          authenticated: false,
          connected: false,
          authMode: 'local',
          host: '',
          username: '',
          currentTargetKey: '',
          connectedTargets: [],
          user: null,
          governance: {
            currentRole: governanceService.getSessionRole(req.session),
            policy: governanceService.getPolicy(),
          },
        }
  ).replace(/</g, '\\u003c');

  res.render('app', { bootstrap });
});

// Error handler
app.use((err, req, res, _next) => {
  logger.error('request_failed', { requestId: req.requestId, method: req.method, path: req.originalUrl, error: err });
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
  res.status(500).render('500', { error: config.env === 'development' ? err.message : '' });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  res.status(404).render('404');
});

function stopRuntimeServices() {
  retentionService.stopScheduler();
  workflowEngine.stop();
  metricsCollector.stop();
  return managedTargetService.stop();
}

function startServer({ port = config.port, exit = process.exit } = {}) {
  retentionService.startScheduler();
  managedTargetService.start();
  workflowEngine.start();
  metricsCollector.start();
  const server = app.listen(port, () => {
    logger.info('server_started', { port, environment: config.env });
  });
  let shuttingDown = false;

  const shutdown = async (signal, error = null) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger[error ? 'error' : 'info']('shutdown_requested', { signal, error });
    await Promise.allSettled([stopRuntimeServices()]);
    server.close(() => exit(error ? 1 : 0));
  };

  process.once('SIGTERM', () => { shutdown('SIGTERM'); });
  process.once('SIGINT', () => { shutdown('SIGINT'); });
  process.once('uncaughtException', (error) => { shutdown('uncaughtException', error); });
  process.once('unhandledRejection', (reason) => {
    shutdown('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
  });

  return { server, shutdown };
}

// Start server only when run directly
if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.stopRuntimeServices = stopRuntimeServices;
