// Catalog-specific RBAC on top of governance roles. Assignments live in
// security.db (catalogRoleModel). Rank is viewer < subscriber < admin.
// routes/catalog.js mounts requireCatalogRole('subscriber'|'admin') as Express
// middleware. Inactive users fail the check even if an assignment exists.
// This is not a substitute for action-catalog / identity.hasPermission.
const { catalogRoleModel, userModel } = require('../models/security-db');

const ROLE_ORDER = { viewer: 0, subscriber: 1, admin: 2 };

function hasCatalogRole(userId, minimumRole) {
  const account = userModel.getById(userId);
  const assignment = catalogRoleModel.getByUserId(userId);
  return Boolean(account?.active && assignment && ROLE_ORDER[assignment.role] >= ROLE_ORDER[minimumRole]);
}

/**
 * Express middleware: 401 if unauthenticated, 403 CATALOG_ROLE_REQUIRED if the
 * session user is below minimumRole (viewer < subscriber < admin).
 */
function requireCatalogRole(minimumRole) {
  return (req, res, next) => {
    if (!req.session?.authenticated || !req.session?.userId) {
      return res.status(401).json({ error: 'AUTH_REQUIRED' });
    }
    if (!hasCatalogRole(req.session.userId, minimumRole)) {
      return res.status(403).json({ error: 'CATALOG_ROLE_REQUIRED' });
    }
    next();
  };
}

module.exports = { hasCatalogRole, requireCatalogRole };
