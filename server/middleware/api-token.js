const identityService = require('../services/identity');

function requireApiToken(req, res, next) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const principal = identityService.authenticateApiToken(token, req.ip);
  if (!principal) return res.status(401).json({ error: 'API_TOKEN_INVALID' });
  req.principal = principal;
  next();
}

function requireApiPermission(permission) {
  return (req, res, next) => {
    if (!identityService.hasPermission({ principal: req.principal }, permission, {
      target: req.params.targetId || req.body?.targetId || '',
      resource: req.params.id || '',
    })) {
      return res.status(403).json({ error: 'PERMISSION_DENIED', permission });
    }
    next();
  };
}

module.exports = { requireApiToken, requireApiPermission };
