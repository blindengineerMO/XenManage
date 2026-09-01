require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const securityMiddleware = require('./middleware/security');
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
const governanceService = require('./services/governance');
const metricsCollector = require('./services/metrics-collector');
const systemConfigService = require('./services/system-config');
const retentionService = require('./services/retention');

const app = express();
systemConfigService.applyExpressSettings(app);

// Security
securityMiddleware(app);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => config.env === 'test',
  message: { error: 'Too many login attempts, please try again later' },
});

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
  console.error('Server Error:', err);
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

// Start server only when run directly
if (require.main === module) {
  retentionService.startScheduler();
  metricsCollector.start();
  const server = app.listen(config.port, () => {
    console.log(`XenMange server running on port ${config.port} [${config.env}]`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    retentionService.stopScheduler();
    metricsCollector.stop();
    server.close(() => process.exit(0));
  });
}

module.exports = app;
