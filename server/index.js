require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const securityMiddleware = require('./middleware/security');
const sessionMiddleware = require('./middleware/session');
const { router: authRouter, requireAuth } = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const vmRoutes = require('./routes/vms');
const hostRoutes = require('./routes/hosts');
const storageRoutes = require('./routes/storage');
const networkRoutes = require('./routes/networks');
const poolRoutes = require('./routes/pools');
const taskRoutes = require('./routes/tasks');
const resilienceRoutes = require('./routes/resilience');
const apiRoutes = require('./routes/api');

const app = express();

// Security
securityMiddleware(app);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/vms', requireAuth, vmRoutes);
app.use('/api/hosts', requireAuth, hostRoutes);
app.use('/api/storage', requireAuth, storageRoutes);
app.use('/api/networks', requireAuth, networkRoutes);
app.use('/api/pools', requireAuth, poolRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/resilience', requireAuth, resilienceRoutes);
app.use('/api/connections', apiRoutes);

// Vue SPA - serve index.html for all non-API routes
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'NOT_FOUND' });
  }
  const bootstrap = JSON.stringify({
    authenticated: Boolean(req.session.authenticated),
    host: req.session.xenHost || '',
    username: req.session.xenUser || '',
  }).replace(/</g, '\\u003c');

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
  const server = app.listen(config.port, () => {
    console.log(`XenMange server running on port ${config.port} [${config.env}]`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => process.exit(0));
  });
}

module.exports = app;
