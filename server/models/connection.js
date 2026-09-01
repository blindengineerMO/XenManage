const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db;

function normalizeVisibility(value, fallback = 'private') {
  return value === 'shared' || value === 'private' ? value : fallback;
}

function normalizeOwnerUserId(value) {
  const normalized = Number(value || 0);
  return normalized > 0 ? normalized : null;
}

function normalizeConnectionRecord(record) {
  if (!record) return null;
  return {
    ...record,
    owner_user_id: normalizeOwnerUserId(record.owner_user_id),
    visibility: normalizeVisibility(record.visibility, record.owner_user_id ? 'private' : 'shared'),
  };
}

function normalizeHostTargetRecord(record) {
  if (!record) return null;
  return {
    ...record,
    owner_user_id: normalizeOwnerUserId(record.owner_user_id),
    visibility: normalizeVisibility(record.visibility, record.owner_user_id ? 'private' : 'shared'),
  };
}

function normalizeVFabricRecord(record) {
  if (!record) return null;
  return {
    ...record,
    id: Number(record.id),
    owner_user_id: normalizeOwnerUserId(record.owner_user_id),
    visibility: normalizeVisibility(record.visibility, record.owner_user_id ? 'private' : 'shared'),
    members: Array.isArray(record.members) ? record.members : [],
  };
}

function normalizeDeploymentRunRecord(record) {
  if (!record) return null;
  return {
    ...record,
    progress: Number(record.progress || 0),
    start_after: Boolean(Number(record.start_after || 0)),
    boot_verified: Boolean(Number(record.boot_verified || 0)),
    network_verified: Boolean(Number(record.network_verified || 0)),
    storage_verified: Boolean(Number(record.storage_verified || 0)),
    policy_tagged: Boolean(Number(record.policy_tagged || 0)),
    steps: Array.isArray(record.steps) ? record.steps : [],
  };
}

function normalizeDeploymentStepRecord(record) {
  if (!record) return null;
  return {
    ...record,
    sort_order: Number(record.sort_order || 0),
  };
}

function buildTextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildVisibilityFilter(actor = {}, tableAlias = '') {
  const role = String(actor.role || '');
  const userId = normalizeOwnerUserId(actor.userId);
  const prefix = tableAlias ? `${tableAlias}.` : '';

  if (role === 'admin') {
    return { clause: '1 = 1', params: [] };
  }

  if (userId) {
    return {
      clause: `(${prefix}visibility = 'shared' OR ${prefix}owner_user_id IS NULL OR ${prefix}owner_user_id = ?)`,
      params: [userId],
    };
  }

  return {
    clause: `(${prefix}visibility = 'shared' OR ${prefix}owner_user_id IS NULL)`,
    params: [],
  };
}

function clearConnectionDefaultsForOwner(database, ownerUserId) {
  if (ownerUserId) {
    database.prepare('UPDATE connections SET is_default = 0 WHERE owner_user_id = ?').run(ownerUserId);
    return;
  }

  database.prepare('UPDATE connections SET is_default = 0 WHERE owner_user_id IS NULL').run();
}

function getDb() {
  if (db) return db;

  const dbDir = path.dirname(config.db.path);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(config.db.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema();
  return db;
}

function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      username TEXT NOT NULL,
      vault_credential_id INTEGER,
      port INTEGER DEFAULT 443,
      owner_user_id INTEGER,
      visibility TEXT NOT NULL DEFAULT 'private',
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_connected_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS host_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      username TEXT NOT NULL,
      vault_credential_id INTEGER,
      port INTEGER DEFAULT 443,
      owner_user_id INTEGER,
      visibility TEXT NOT NULL DEFAULT 'private',
      mode TEXT NOT NULL DEFAULT 'standalone',
      pool_connection_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_connected_at DATETIME,
      FOREIGN KEY (pool_connection_id) REFERENCES connections(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS managed_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      connection_id INTEGER NOT NULL UNIQUE REFERENCES connections(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1,
      state TEXT NOT NULL DEFAULT 'Offline',
      last_error TEXT NOT NULL DEFAULT '',
      last_checked_at DATETIME,
      last_connected_at DATETIME,
      next_retry_at DATETIME,
      retry_count INTEGER NOT NULL DEFAULT 0,
      certificate_fingerprint TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_managed_targets_enabled ON managed_targets(enabled, state);

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      target_id INTEGER REFERENCES managed_targets(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      idempotency_key TEXT,
      input_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '{}',
      progress REAL NOT NULL DEFAULT 0,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      scheduled_for DATETIME,
      started_at DATETIME,
      finished_at DATETIME,
      timeout_at DATETIME,
      lock_key TEXT NOT NULL DEFAULT '',
      requested_by TEXT NOT NULL DEFAULT 'system',
      approval_id TEXT NOT NULL DEFAULT '',
      error_text TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_idempotency
      ON workflows(type, idempotency_key)
      WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
    CREATE INDEX IF NOT EXISTS idx_workflows_status_schedule ON workflows(status, scheduled_for);

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      step_key TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sort_order INTEGER NOT NULL DEFAULT 0,
      started_at DATETIME,
      finished_at DATETIME,
      error_text TEXT NOT NULL DEFAULT '',
      UNIQUE(workflow_id, step_key)
    );

    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_events_workflow ON workflow_events(workflow_id, created_at);

    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cost_center TEXT NOT NULL DEFAULT '',
      default_recovery_tier TEXT NOT NULL DEFAULT '',
      owner_user_id INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, name)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      PRIMARY KEY(project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS project_targets (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      managed_target_id INTEGER NOT NULL REFERENCES managed_targets(id) ON DELETE CASCADE,
      PRIMARY KEY(project_id, managed_target_id)
    );

    CREATE TABLE IF NOT EXISTS project_quotas (
      project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 1,
      max_vm_count INTEGER NOT NULL DEFAULT 0,
      max_vcpus INTEGER NOT NULL DEFAULT 0,
      max_memory_gib REAL NOT NULL DEFAULT 0,
      max_storage_gib REAL NOT NULL DEFAULT 0,
      max_gpu_count INTEGER NOT NULL DEFAULT 0,
      max_network_count INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_resource_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      managed_target_id INTEGER REFERENCES managed_targets(id) ON DELETE SET NULL,
      resource_type TEXT NOT NULL,
      resource_ref TEXT NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id, resource_type, resource_ref)
    );
    CREATE INDEX IF NOT EXISTS idx_project_resource_assignments_project ON project_resource_assignments(project_id, resource_type);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS retention_policies (
      domain TEXT PRIMARY KEY,
      retention_days INTEGER NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run_at DATETIME,
      last_purged_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS deployment_runs (
      id TEXT PRIMARY KEY,
      deployment_audit_id TEXT NOT NULL DEFAULT '',
      template_ref TEXT NOT NULL,
      template_name TEXT NOT NULL DEFAULT '',
      template_version TEXT NOT NULL DEFAULT '',
      vm_ref TEXT NOT NULL DEFAULT '',
      vm_name TEXT NOT NULL DEFAULT '',
      host_ref TEXT NOT NULL DEFAULT '',
      host_label TEXT NOT NULL DEFAULT '',
      storage_ref TEXT NOT NULL DEFAULT '',
      storage_label TEXT NOT NULL DEFAULT '',
      network_ref TEXT NOT NULL DEFAULT '',
      network_label TEXT NOT NULL DEFAULT '',
      submitted_by TEXT NOT NULL DEFAULT '',
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL NOT NULL DEFAULT 0,
      start_after INTEGER DEFAULT 0,
      validation_status TEXT NOT NULL DEFAULT 'pending',
      validation_notes TEXT NOT NULL DEFAULT '',
      guest_customization TEXT NOT NULL DEFAULT '',
      boot_verified INTEGER DEFAULT 0,
      network_verified INTEGER DEFAULT 0,
      storage_verified INTEGER DEFAULT 0,
      policy_tagged INTEGER DEFAULT 0,
      result TEXT NOT NULL DEFAULT '',
      target_route TEXT NOT NULL DEFAULT '/vms'
    );

    CREATE TABLE IF NOT EXISTS deployment_run_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      step_key TEXT NOT NULL,
      step_label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      detail TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      started_at DATETIME,
      finished_at DATETIME,
      error_text TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS template_library_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES template_library_folders(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      owner_user_id INTEGER,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS template_library_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER REFERENCES template_library_folders(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'snippet',
      name TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'json',
      content TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      owner_user_id INTEGER,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS template_library_item_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES template_library_items(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      saved_by INTEGER,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vfabrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color_tag TEXT NOT NULL DEFAULT 'green',
      owner_user_id INTEGER,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vfabric_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vfabric_id INTEGER NOT NULL REFERENCES vfabrics(id) ON DELETE CASCADE,
      connection_id INTEGER REFERENCES connections(id) ON DELETE CASCADE,
      host_target_id INTEGER REFERENCES host_targets(id) ON DELETE CASCADE,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK ((connection_id IS NOT NULL AND host_target_id IS NULL) OR (connection_id IS NULL AND host_target_id IS NOT NULL)),
      UNIQUE(vfabric_id, connection_id),
      UNIQUE(vfabric_id, host_target_id)
    );
  `);

  const connectionColumns = new Set(
    db.prepare('PRAGMA table_info(connections)').all().map((column) => column.name)
  );
  if (!connectionColumns.has('vault_credential_id')) {
    db.exec('ALTER TABLE connections ADD COLUMN vault_credential_id INTEGER');
  }
  if (!connectionColumns.has('owner_user_id')) {
    db.exec('ALTER TABLE connections ADD COLUMN owner_user_id INTEGER');
  }
  if (!connectionColumns.has('visibility')) {
    db.exec(`ALTER TABLE connections ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`);
  }
  db.exec(`
    UPDATE connections
    SET visibility = CASE
      WHEN visibility IS NULL OR visibility = '' THEN 'shared'
      ELSE visibility
    END
  `);

  const hostTargetColumns = new Set(
    db.prepare('PRAGMA table_info(host_targets)').all().map((column) => column.name)
  );
  if (!hostTargetColumns.has('vault_credential_id')) {
    db.exec('ALTER TABLE host_targets ADD COLUMN vault_credential_id INTEGER');
  }
  if (!hostTargetColumns.has('owner_user_id')) {
    db.exec('ALTER TABLE host_targets ADD COLUMN owner_user_id INTEGER');
  }
  if (!hostTargetColumns.has('visibility')) {
    db.exec(`ALTER TABLE host_targets ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`);
  }
  db.exec(`
    UPDATE host_targets
    SET visibility = CASE
      WHEN visibility IS NULL OR visibility = '' THEN 'shared'
      ELSE visibility
    END
  `);

  const deploymentRunColumns = new Set(
    db.prepare('PRAGMA table_info(deployment_runs)').all().map((column) => column.name)
  );
  if (!deploymentRunColumns.has('run_kind')) {
    db.exec(`ALTER TABLE deployment_runs ADD COLUMN run_kind TEXT NOT NULL DEFAULT 'template'`);
  }
  if (!deploymentRunColumns.has('spec_json')) {
    db.exec(`ALTER TABLE deployment_runs ADD COLUMN spec_json TEXT NOT NULL DEFAULT ''`);
  }
}

// Connection CRUD
const connectionModel = {
  getAll() {
    return getDb().prepare('SELECT * FROM connections ORDER BY is_default DESC, name').all().map(normalizeConnectionRecord);
  },

  listVisible(actor = {}) {
    const { clause, params } = buildVisibilityFilter(actor);
    return getDb().prepare(`
      SELECT *
      FROM connections
      WHERE ${clause}
      ORDER BY is_default DESC, name
    `).all(...params).map(normalizeConnectionRecord);
  },

  getById(id) {
    return normalizeConnectionRecord(getDb().prepare('SELECT * FROM connections WHERE id = ?').get(id));
  },

  getVisibleById(id, actor = {}) {
    const { clause, params } = buildVisibilityFilter(actor);
    return normalizeConnectionRecord(getDb().prepare(`
      SELECT *
      FROM connections
      WHERE id = ? AND ${clause}
    `).get(id, ...params));
  },

  findByFingerprint(host, username, port = 443, options = {}) {
    const ownerUserId = normalizeOwnerUserId(options.ownerUserId);
    const visibility = ownerUserId
      ? normalizeVisibility(options.visibility, 'private')
      : 'shared';

    if (visibility === 'shared') {
      return normalizeConnectionRecord(getDb().prepare(`
        SELECT *
        FROM connections
        WHERE host = ? AND username = ? AND port = ? AND visibility = 'shared'
        ORDER BY CASE WHEN owner_user_id IS NULL THEN 0 ELSE 1 END, id
        LIMIT 1
      `).get(host, username, port));
    }

    if (ownerUserId) {
      return normalizeConnectionRecord(getDb().prepare(`
        SELECT *
        FROM connections
        WHERE host = ? AND username = ? AND port = ? AND owner_user_id = ? AND visibility = 'private'
        LIMIT 1
      `).get(host, username, port, ownerUserId));
    }

    return normalizeConnectionRecord(getDb().prepare(`
      SELECT *
      FROM connections
      WHERE host = ? AND username = ? AND port = ? AND owner_user_id IS NULL AND visibility = 'shared'
      LIMIT 1
    `).get(host, username, port));
  },

  create({ name, host, username, vaultCredentialId = null, port = 443, isDefault = false, ownerUserId = null, visibility = 'private' }) {
    const db = getDb();
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    const normalizedVisibility = normalizedOwnerUserId
      ? normalizeVisibility(visibility, 'private')
      : 'shared';
    const existing = this.findByFingerprint(host, username, port, {
      ownerUserId: normalizedOwnerUserId,
      visibility: normalizedVisibility,
    });

    if (existing) {
      return this.update(existing.id, {
        name,
        host,
        username,
        vaultCredentialId,
        port,
        isDefault: isDefault || Boolean(existing.is_default),
        ownerUserId: existing.owner_user_id ?? normalizedOwnerUserId,
        visibility: normalizedVisibility,
      });
    }

    if (isDefault) {
      clearConnectionDefaultsForOwner(db, normalizedOwnerUserId);
    }
    const result = db.prepare(
      'INSERT INTO connections (name, host, username, vault_credential_id, port, owner_user_id, visibility, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(name, host, username, vaultCredentialId, port, normalizedOwnerUserId, normalizedVisibility, isDefault ? 1 : 0);
    return this.getById(result.lastInsertRowid);
  },

  update(id, { name, host, username, vaultCredentialId = null, port, isDefault, ownerUserId, visibility }) {
    const db = getDb();
    const existing = this.getById(id);
    const nextOwnerUserId = ownerUserId === undefined ? existing?.owner_user_id ?? null : normalizeOwnerUserId(ownerUserId);
    const nextVisibility = nextOwnerUserId
      ? normalizeVisibility(visibility, existing?.visibility || 'private')
      : 'shared';

    if (isDefault) {
      clearConnectionDefaultsForOwner(db, nextOwnerUserId);
    }
    db.prepare(
      'UPDATE connections SET name = ?, host = ?, username = ?, vault_credential_id = ?, port = ?, owner_user_id = ?, visibility = ?, is_default = ? WHERE id = ?'
    ).run(name, host, username, vaultCredentialId, port, nextOwnerUserId, nextVisibility, isDefault ? 1 : 0, id);
    return this.getById(id);
  },

  updateLastConnected(id) {
    getDb().prepare('UPDATE connections SET last_connected_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  touchByFingerprint(host, username, port = 443, actor = {}) {
    const { clause, params } = buildVisibilityFilter(actor);
    const candidate = normalizeConnectionRecord(getDb().prepare(`
      SELECT *
      FROM connections
      WHERE host = ? AND username = ? AND port = ? AND ${clause}
      ORDER BY
        CASE
          WHEN owner_user_id = ? THEN 0
          WHEN owner_user_id IS NULL THEN 1
          ELSE 2
        END,
        is_default DESC,
        id
      LIMIT 1
    `).get(host, username, port, ...params, normalizeOwnerUserId(actor.userId)));

    const existing = candidate || this.findByFingerprint(host, username, port);
    if (!existing) return null;
    this.updateLastConnected(existing.id);
    return this.getById(existing.id);
  },

  setDefault(id) {
    const db = getDb();
    const existing = this.getById(id);
    if (!existing) return null;
    clearConnectionDefaultsForOwner(db, existing.owner_user_id);
    db.prepare('UPDATE connections SET is_default = 1 WHERE id = ?').run(id);
    return this.getById(id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM connections WHERE id = ?').run(id);
  },
};

const hostTargetModel = {
  getAll() {
    return getDb().prepare(`
      SELECT host_targets.*, connections.name AS pool_name
      FROM host_targets
      LEFT JOIN connections ON connections.id = host_targets.pool_connection_id
      ORDER BY host_targets.name
    `).all().map(normalizeHostTargetRecord);
  },

  listVisible(actor = {}) {
    const { clause, params } = buildVisibilityFilter(actor, 'host_targets');
    return getDb().prepare(`
      SELECT host_targets.*, connections.name AS pool_name
      FROM host_targets
      LEFT JOIN connections ON connections.id = host_targets.pool_connection_id
      WHERE ${clause}
      ORDER BY host_targets.name
    `).all(...params).map(normalizeHostTargetRecord);
  },

  getById(id) {
    return normalizeHostTargetRecord(getDb().prepare(`
      SELECT host_targets.*, connections.name AS pool_name
      FROM host_targets
      LEFT JOIN connections ON connections.id = host_targets.pool_connection_id
      WHERE host_targets.id = ?
    `).get(id));
  },

  getVisibleById(id, actor = {}) {
    const { clause, params } = buildVisibilityFilter(actor, 'host_targets');
    return normalizeHostTargetRecord(getDb().prepare(`
      SELECT host_targets.*, connections.name AS pool_name
      FROM host_targets
      LEFT JOIN connections ON connections.id = host_targets.pool_connection_id
      WHERE host_targets.id = ? AND ${clause}
    `).get(id, ...params));
  },

  findByFingerprint(host, username, port = 443, options = {}) {
    const ownerUserId = normalizeOwnerUserId(options.ownerUserId);
    const visibility = ownerUserId
      ? normalizeVisibility(options.visibility, 'private')
      : 'shared';

    if (visibility === 'shared') {
      return normalizeHostTargetRecord(getDb().prepare(`
        SELECT *
        FROM host_targets
        WHERE host = ? AND username = ? AND port = ? AND visibility = 'shared'
        ORDER BY CASE WHEN owner_user_id IS NULL THEN 0 ELSE 1 END, id
        LIMIT 1
      `).get(host, username, port));
    }

    if (ownerUserId) {
      return normalizeHostTargetRecord(getDb().prepare(`
        SELECT *
        FROM host_targets
        WHERE host = ? AND username = ? AND port = ? AND owner_user_id = ? AND visibility = 'private'
        LIMIT 1
      `).get(host, username, port, ownerUserId));
    }

    return normalizeHostTargetRecord(getDb().prepare(`
      SELECT *
      FROM host_targets
      WHERE host = ? AND username = ? AND port = ? AND owner_user_id IS NULL AND visibility = 'shared'
      LIMIT 1
    `).get(host, username, port));
  },

  create({ name, host, username, vaultCredentialId = null, port = 443, mode = 'standalone', poolConnectionId = null, notes = '', ownerUserId = null, visibility = 'private' }) {
    const db = getDb();
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    const normalizedVisibility = normalizedOwnerUserId
      ? normalizeVisibility(visibility, 'private')
      : 'shared';
    const existing = this.findByFingerprint(host, username, port, {
      ownerUserId: normalizedOwnerUserId,
      visibility: normalizedVisibility,
    });

    if (existing) {
      return this.update(existing.id, {
        name,
        host,
        username,
        vaultCredentialId,
        port,
        mode,
        poolConnectionId,
        notes,
        ownerUserId: existing.owner_user_id ?? normalizedOwnerUserId,
        visibility: normalizedVisibility,
      });
    }

    const result = db.prepare(`
      INSERT INTO host_targets (name, host, username, vault_credential_id, port, owner_user_id, visibility, mode, pool_connection_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      host,
      username,
      vaultCredentialId,
      port,
      normalizedOwnerUserId,
      normalizedVisibility,
      mode,
      mode === 'pool-member' ? poolConnectionId : null,
      notes || ''
    );

    return this.getById(result.lastInsertRowid);
  },

  update(id, { name, host, username, vaultCredentialId = null, port, mode, poolConnectionId = null, notes = '', ownerUserId, visibility }) {
    const existing = this.getById(id);
    const nextOwnerUserId = ownerUserId === undefined ? existing?.owner_user_id ?? null : normalizeOwnerUserId(ownerUserId);
    const nextVisibility = nextOwnerUserId
      ? normalizeVisibility(visibility, existing?.visibility || 'private')
      : 'shared';

    getDb().prepare(`
      UPDATE host_targets
      SET name = ?, host = ?, username = ?, vault_credential_id = ?, port = ?, owner_user_id = ?, visibility = ?, mode = ?, pool_connection_id = ?, notes = ?
      WHERE id = ?
    `).run(
      name,
      host,
      username,
      vaultCredentialId,
      port,
      nextOwnerUserId,
      nextVisibility,
      mode,
      mode === 'pool-member' ? poolConnectionId : null,
      notes || '',
      id
    );

    return this.getById(id);
  },

  delete(id) {
    getDb().prepare('DELETE FROM host_targets WHERE id = ?').run(id);
  },
};

function normalizeManagedTargetRecord(record) {
  if (!record) return null;
  return {
    ...record,
    id: Number(record.id),
    connection_id: Number(record.connection_id),
    enabled: Boolean(Number(record.enabled)),
    retry_count: Number(record.retry_count || 0),
  };
}

const managedTargetModel = {
  list() {
    return getDb().prepare(`
      SELECT managed_targets.*, connections.name AS connection_name, connections.host, connections.username,
        connections.port, connections.vault_credential_id, connections.owner_user_id, connections.visibility
      FROM managed_targets
      JOIN connections ON connections.id = managed_targets.connection_id
      ORDER BY connections.name COLLATE NOCASE, managed_targets.id
    `).all().map(normalizeManagedTargetRecord);
  },

  getById(id) {
    return normalizeManagedTargetRecord(getDb().prepare(`
      SELECT managed_targets.*, connections.name AS connection_name, connections.host, connections.username,
        connections.port, connections.vault_credential_id, connections.owner_user_id, connections.visibility
      FROM managed_targets
      JOIN connections ON connections.id = managed_targets.connection_id
      WHERE managed_targets.id = ?
    `).get(id));
  },

  getByConnectionId(connectionId) {
    return normalizeManagedTargetRecord(getDb().prepare(`
      SELECT managed_targets.*, connections.name AS connection_name, connections.host, connections.username,
        connections.port, connections.vault_credential_id, connections.owner_user_id, connections.visibility
      FROM managed_targets
      JOIN connections ON connections.id = managed_targets.connection_id
      WHERE managed_targets.connection_id = ?
    `).get(connectionId));
  },

  upsert(connectionId, { enabled = true } = {}) {
    const database = getDb();
    database.prepare(`
      INSERT INTO managed_targets (connection_id, enabled, state)
      VALUES (?, ?, 'Offline')
      ON CONFLICT(connection_id) DO UPDATE SET enabled = excluded.enabled, updated_at = CURRENT_TIMESTAMP
    `).run(connectionId, enabled ? 1 : 0);
    return this.getByConnectionId(connectionId);
  },

  updateStatus(id, {
    state,
    lastError = '',
    lastCheckedAt = new Date().toISOString(),
    lastConnectedAt,
    nextRetryAt = '',
    retryCount = 0,
    certificateFingerprint,
  } = {}) {
    const current = this.getById(id);
    if (!current) return null;
    getDb().prepare(`
      UPDATE managed_targets
      SET state = ?, last_error = ?, last_checked_at = ?,
        last_connected_at = COALESCE(?, last_connected_at), next_retry_at = ?, retry_count = ?,
        certificate_fingerprint = COALESCE(?, certificate_fingerprint), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      state || current.state,
      lastError,
      lastCheckedAt,
      lastConnectedAt || null,
      nextRetryAt || null,
      Math.max(0, Number(retryCount || 0)),
      certificateFingerprint || null,
      id
    );
    return this.getById(id);
  },

  setEnabled(id, enabled) {
    getDb().prepare(`
      UPDATE managed_targets
      SET enabled = ?, state = CASE WHEN ? THEN state ELSE 'Maintenance' END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(enabled ? 1 : 0, enabled ? 1 : 0, id);
    return this.getById(id);
  },

  remove(id) {
    getDb().prepare('DELETE FROM managed_targets WHERE id = ?').run(id);
  },
};

const projectModel = {
  listOrganizations() {
    return getDb().prepare('SELECT * FROM organizations ORDER BY lower(name)').all();
  },
  createOrganization({ name, description = '' }) {
    const result = getDb().prepare('INSERT INTO organizations (name, description) VALUES (?, ?)').run(name, description);
    return this.getOrganization(result.lastInsertRowid);
  },
  getOrganization(id) {
    return getDb().prepare('SELECT * FROM organizations WHERE id = ?').get(id) || null;
  },
  listProjects() {
    return getDb().prepare(`
      SELECT projects.*, organizations.name AS organization_name,
        GROUP_CONCAT(DISTINCT project_targets.managed_target_id) AS target_ids
      FROM projects JOIN organizations ON organizations.id = projects.organization_id
      LEFT JOIN project_targets ON project_targets.project_id = projects.id
      GROUP BY projects.id ORDER BY lower(organizations.name), lower(projects.name)
    `).all().map((project) => ({
      ...project, id: Number(project.id), organization_id: Number(project.organization_id), owner_user_id: normalizeOwnerUserId(project.owner_user_id),
      enabled: Boolean(Number(project.enabled)), target_ids: String(project.target_ids || '').split(',').map(Number).filter(Boolean),
      quota: this.getQuota(project.id), members: this.listMembers(project.id),
    }));
  },
  getProject(id) {
    return this.listProjects().find((project) => project.id === Number(id)) || null;
  },
  createProject({ organizationId, name, description = '', costCenter = '', defaultRecoveryTier = '', ownerUserId = null, targetIds = [] }) {
    const database = getDb();
    const transaction = database.transaction(() => {
      const result = database.prepare(`
        INSERT INTO projects (organization_id, name, description, cost_center, default_recovery_tier, owner_user_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(organizationId, name, description, costCenter, defaultRecoveryTier, normalizeOwnerUserId(ownerUserId));
      const projectId = Number(result.lastInsertRowid);
      const targetInsert = database.prepare('INSERT OR IGNORE INTO project_targets (project_id, managed_target_id) VALUES (?, ?)');
      (targetIds || []).forEach((targetId) => targetInsert.run(projectId, Number(targetId)));
      return projectId;
    });
    return this.getProject(transaction());
  },
  updateProject(id, { name, description = '', costCenter = '', defaultRecoveryTier = '', ownerUserId = null, enabled = true, targetIds = [] }) {
    const database = getDb();
    const transaction = database.transaction(() => {
      database.prepare(`
        UPDATE projects SET name = ?, description = ?, cost_center = ?, default_recovery_tier = ?, owner_user_id = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, description, costCenter, defaultRecoveryTier, normalizeOwnerUserId(ownerUserId), enabled ? 1 : 0, id);
      database.prepare('DELETE FROM project_targets WHERE project_id = ?').run(id);
      const targetInsert = database.prepare('INSERT OR IGNORE INTO project_targets (project_id, managed_target_id) VALUES (?, ?)');
      (targetIds || []).forEach((targetId) => targetInsert.run(Number(id), Number(targetId)));
    });
    transaction();
    return this.getProject(id);
  },
  deleteProject(id) { return getDb().prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0; },
  listMembers(projectId) { return getDb().prepare('SELECT project_id, user_id, role FROM project_members WHERE project_id = ? ORDER BY user_id').all(projectId); },
  setMember(projectId, userId, role = 'member') {
    getDb().prepare(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
      ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`).run(projectId, userId, role);
    return this.listMembers(projectId);
  },
  getQuota(projectId) {
    const record = getDb().prepare('SELECT * FROM project_quotas WHERE project_id = ?').get(projectId);
    return record ? { ...record, enabled: Boolean(Number(record.enabled)) } : null;
  },
  upsertQuota(projectId, quota = {}) {
    getDb().prepare(`
      INSERT INTO project_quotas (project_id, enabled, max_vm_count, max_vcpus, max_memory_gib, max_storage_gib, max_gpu_count, max_network_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET enabled = excluded.enabled, max_vm_count = excluded.max_vm_count,
        max_vcpus = excluded.max_vcpus, max_memory_gib = excluded.max_memory_gib, max_storage_gib = excluded.max_storage_gib,
        max_gpu_count = excluded.max_gpu_count, max_network_count = excluded.max_network_count, updated_at = CURRENT_TIMESTAMP
    `).run(projectId, quota.enabled !== false ? 1 : 0, Number(quota.maxVmCount || 0), Number(quota.maxVcpus || 0), Number(quota.maxMemoryGiB || 0), Number(quota.maxStorageGiB || 0), Number(quota.maxGpuCount || 0), Number(quota.maxNetworkCount || 0));
    return this.getQuota(projectId);
  },
  listAssignments(projectId) { return getDb().prepare('SELECT * FROM project_resource_assignments WHERE project_id = ? ORDER BY assigned_at DESC').all(projectId); },
  assignResource({ projectId, managedTargetId = null, resourceType, resourceRef }) {
    getDb().prepare(`INSERT INTO project_resource_assignments (project_id, managed_target_id, resource_type, resource_ref)
      VALUES (?, ?, ?, ?) ON CONFLICT(project_id, resource_type, resource_ref) DO UPDATE SET managed_target_id = excluded.managed_target_id`).run(projectId, managedTargetId || null, resourceType, resourceRef);
    return this.listAssignments(projectId);
  },
};

const vFabricModel = {
  listVisible(actor = {}) {
    const { clause, params } = buildVisibilityFilter(actor, 'vfabrics');
    return getDb().prepare(`SELECT * FROM vfabrics WHERE ${clause} ORDER BY name`).all(...params)
      .map((record) => this.getById(record.id))
      .map(normalizeVFabricRecord);
  },

  getById(id) {
    const record = getDb().prepare('SELECT * FROM vfabrics WHERE id = ?').get(id);
    if (!record) return null;
    const members = getDb().prepare(`
      SELECT members.id, members.connection_id, members.host_target_id, members.added_at,
        connections.name AS connection_name, connections.host AS connection_host, connections.visibility AS connection_visibility, connections.owner_user_id AS connection_owner_user_id,
        host_targets.name AS host_target_name, host_targets.host AS host_target_host, host_targets.visibility AS host_target_visibility, host_targets.owner_user_id AS host_target_owner_user_id
      FROM vfabric_members AS members
      LEFT JOIN connections ON connections.id = members.connection_id
      LEFT JOIN host_targets ON host_targets.id = members.host_target_id
      WHERE members.vfabric_id = ?
      ORDER BY members.id
    `).all(id).map((member) => ({
      ...member,
      kind: member.connection_id ? 'pool' : 'host',
      target_id: member.connection_id || member.host_target_id,
      name: member.connection_id ? member.connection_name : member.host_target_name,
      host: member.connection_id ? member.connection_host : member.host_target_host,
      visibility: member.connection_id ? member.connection_visibility : member.host_target_visibility,
      owner_user_id: normalizeOwnerUserId(member.connection_id ? member.connection_owner_user_id : member.host_target_owner_user_id),
    }));
    return normalizeVFabricRecord({ ...record, members });
  },

  create({ name, description = '', colorTag = 'green', ownerUserId = null, visibility = 'private', connectionIds = [], hostTargetIds = [] }) {
    const database = getDb();
    const normalizedOwner = normalizeOwnerUserId(ownerUserId);
    const normalizedVisibility = normalizedOwner ? normalizeVisibility(visibility, 'private') : 'shared';
    const result = database.prepare(`
      INSERT INTO vfabrics (name, description, color_tag, owner_user_id, visibility)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, description, colorTag, normalizedOwner, normalizedVisibility);
    this.replaceMembers(result.lastInsertRowid, { connectionIds, hostTargetIds });
    return this.getById(result.lastInsertRowid);
  },

  update(id, { name, description = '', colorTag = 'green', ownerUserId, visibility, connectionIds = [], hostTargetIds = [] }) {
    const existing = this.getById(id);
    const nextOwner = ownerUserId === undefined ? existing?.owner_user_id : normalizeOwnerUserId(ownerUserId);
    const nextVisibility = nextOwner ? normalizeVisibility(visibility, existing?.visibility || 'private') : 'shared';
    getDb().prepare(`
      UPDATE vfabrics
      SET name = ?, description = ?, color_tag = ?, owner_user_id = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description, colorTag, nextOwner, nextVisibility, id);
    this.replaceMembers(id, { connectionIds, hostTargetIds });
    return this.getById(id);
  },

  replaceMembers(id, { connectionIds = [], hostTargetIds = [] }) {
    const database = getDb();
    const uniqueConnections = [...new Set(connectionIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
    const uniqueHosts = [...new Set(hostTargetIds.map(Number).filter((value) => Number.isInteger(value) && value > 0))];
    const replace = database.transaction(() => {
      database.prepare('DELETE FROM vfabric_members WHERE vfabric_id = ?').run(id);
      const addConnection = database.prepare('INSERT INTO vfabric_members (vfabric_id, connection_id) VALUES (?, ?)');
      const addHost = database.prepare('INSERT INTO vfabric_members (vfabric_id, host_target_id) VALUES (?, ?)');
      uniqueConnections.forEach((memberId) => addConnection.run(id, memberId));
      uniqueHosts.forEach((memberId) => addHost.run(id, memberId));
    });
    replace();
  },

  delete(id) {
    getDb().prepare('DELETE FROM vfabrics WHERE id = ?').run(id);
  },
};

// Settings CRUD
const settingsModel = {
  get(key) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },

  set(key, value) {
    getDb().prepare(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)'
    ).run(key, value);
  },

  getAll() {
    const rows = getDb().prepare('SELECT * FROM settings').all();
    return rows.reduce((acc, row) => { acc[row.key] = row.value; return acc; }, {});
  },
};

const retentionPolicyModel = {
  getAll() {
    return getDb().prepare(`
      SELECT domain, retention_days, enabled, last_run_at, last_purged_count
      FROM retention_policies
      ORDER BY domain
    `).all();
  },

  get(domain) {
    return getDb().prepare(`
      SELECT domain, retention_days, enabled, last_run_at, last_purged_count
      FROM retention_policies
      WHERE domain = ?
    `).get(domain) || null;
  },

  upsert({ domain, retentionDays, enabled = true, lastRunAt = null, lastPurgedCount = 0 }) {
    getDb().prepare(`
      INSERT INTO retention_policies (domain, retention_days, enabled, last_run_at, last_purged_count)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET
        retention_days = excluded.retention_days,
        enabled = excluded.enabled,
        last_run_at = excluded.last_run_at,
        last_purged_count = excluded.last_purged_count
    `).run(
      domain,
      retentionDays,
      enabled ? 1 : 0,
      lastRunAt,
      lastPurgedCount
    );

    return this.get(domain);
  },
};

const deploymentRunModel = {
  list() {
    const rows = getDb().prepare(`
      SELECT *
      FROM deployment_runs
      ORDER BY COALESCE(finished_at, submitted_at) DESC
    `).all();
    const stepRows = getDb().prepare(`
      SELECT *
      FROM deployment_run_steps
      ORDER BY sort_order ASC, started_at ASC, id ASC
    `).all().map(normalizeDeploymentStepRecord);
    const stepsByRunId = stepRows.reduce((acc, row) => {
      acc[row.run_id] = acc[row.run_id] || [];
      acc[row.run_id].push(row);
      return acc;
    }, {});

    return rows.map((row) => normalizeDeploymentRunRecord({
      ...row,
      steps: stepsByRunId[row.id] || [],
    }));
  },

  getById(id) {
    const row = getDb().prepare('SELECT * FROM deployment_runs WHERE id = ?').get(id);
    if (!row) return null;
    const steps = getDb().prepare(`
      SELECT *
      FROM deployment_run_steps
      WHERE run_id = ?
      ORDER BY sort_order ASC, started_at ASC, id ASC
    `).all(id).map(normalizeDeploymentStepRecord);
    return normalizeDeploymentRunRecord({ ...row, steps });
  },

  getByDeploymentAuditId(deploymentAuditId) {
    const row = getDb().prepare(`
      SELECT *
      FROM deployment_runs
      WHERE deployment_audit_id = ?
      ORDER BY submitted_at DESC, id DESC
      LIMIT 1
    `).get(deploymentAuditId);
    if (!row) return null;
    return this.getById(row.id);
  },

  replaceSteps(runId, steps = []) {
    const db = getDb();
    db.prepare('DELETE FROM deployment_run_steps WHERE run_id = ?').run(runId);
    const insert = db.prepare(`
      INSERT INTO deployment_run_steps (
        id,
        run_id,
        step_key,
        step_label,
        status,
        detail,
        sort_order,
        started_at,
        finished_at,
        error_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    steps.forEach((step, index) => {
      insert.run(
        step.id || buildTextId('tmplstep'),
        runId,
        String(step.step_key || step.key || '').trim(),
        String(step.step_label || step.label || '').trim(),
        String(step.status || 'pending').trim().toLowerCase(),
        String(step.detail || '').trim(),
        Number(step.sort_order ?? index),
        step.started_at || step.startedAt || null,
        step.finished_at || step.finishedAt || null,
        String(step.error_text || step.errorText || '').trim()
      );
    });
  },

  create(record = {}, steps = []) {
    const id = String(record.id || buildTextId('tmplrun')).trim();
    getDb().prepare(`
      INSERT INTO deployment_runs (
        id,
        deployment_audit_id,
        template_ref,
        template_name,
        template_version,
        vm_ref,
        vm_name,
        host_ref,
        host_label,
        storage_ref,
        storage_label,
        network_ref,
        network_label,
        submitted_by,
        submitted_at,
        finished_at,
        status,
        progress,
        start_after,
        validation_status,
        validation_notes,
        guest_customization,
        boot_verified,
        network_verified,
        storage_verified,
        policy_tagged,
        result,
        target_route,
        run_kind,
        spec_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      String(record.deployment_audit_id || record.deploymentAuditId || '').trim(),
      String(record.template_ref || record.templateRef || '').trim(),
      String(record.template_name || record.templateName || '').trim(),
      String(record.template_version || record.templateVersion || '').trim(),
      String(record.vm_ref || record.vmRef || '').trim(),
      String(record.vm_name || record.vmName || '').trim(),
      String(record.host_ref || record.hostRef || '').trim(),
      String(record.host_label || record.hostLabel || '').trim(),
      String(record.storage_ref || record.storageRef || '').trim(),
      String(record.storage_label || record.storageLabel || '').trim(),
      String(record.network_ref || record.networkRef || '').trim(),
      String(record.network_label || record.networkLabel || '').trim(),
      String(record.submitted_by || record.submittedBy || '').trim(),
      record.submitted_at || record.submittedAt || new Date().toISOString(),
      record.finished_at || record.finishedAt || null,
      String(record.status || 'pending').trim().toLowerCase(),
      Number(record.progress || 0),
      record.start_after || record.startAfter ? 1 : 0,
      String(record.validation_status || record.validationStatus || 'pending').trim().toLowerCase(),
      String(record.validation_notes || record.validationNotes || '').trim(),
      String(record.guest_customization || record.guestCustomization || '').trim(),
      record.boot_verified || record.bootVerified ? 1 : 0,
      record.network_verified || record.networkVerified ? 1 : 0,
      record.storage_verified || record.storageVerified ? 1 : 0,
      record.policy_tagged || record.policyTagged ? 1 : 0,
      String(record.result || '').trim(),
      String(record.target_route || record.targetRoute || '/vms').trim(),
      String(record.run_kind || record.runKind || 'template').trim().toLowerCase(),
      String(record.spec_json || record.specJson || '').trim()
    );
    this.replaceSteps(id, steps);
    return this.getById(id);
  },

  update(id, record = {}, steps) {
    const existing = this.getById(id);
    if (!existing) return null;
    const next = {
      ...existing,
      ...record,
    };

    getDb().prepare(`
      UPDATE deployment_runs
      SET deployment_audit_id = ?,
          template_ref = ?,
          template_name = ?,
          template_version = ?,
          vm_ref = ?,
          vm_name = ?,
          host_ref = ?,
          host_label = ?,
          storage_ref = ?,
          storage_label = ?,
          network_ref = ?,
          network_label = ?,
          submitted_by = ?,
          submitted_at = ?,
          finished_at = ?,
          status = ?,
          progress = ?,
          start_after = ?,
          validation_status = ?,
          validation_notes = ?,
          guest_customization = ?,
          boot_verified = ?,
          network_verified = ?,
          storage_verified = ?,
          policy_tagged = ?,
          result = ?,
          target_route = ?,
          run_kind = ?,
          spec_json = ?
      WHERE id = ?
    `).run(
      String(next.deployment_audit_id || next.deploymentAuditId || '').trim(),
      String(next.template_ref || next.templateRef || '').trim(),
      String(next.template_name || next.templateName || '').trim(),
      String(next.template_version || next.templateVersion || '').trim(),
      String(next.vm_ref || next.vmRef || '').trim(),
      String(next.vm_name || next.vmName || '').trim(),
      String(next.host_ref || next.hostRef || '').trim(),
      String(next.host_label || next.hostLabel || '').trim(),
      String(next.storage_ref || next.storageRef || '').trim(),
      String(next.storage_label || next.storageLabel || '').trim(),
      String(next.network_ref || next.networkRef || '').trim(),
      String(next.network_label || next.networkLabel || '').trim(),
      String(next.submitted_by || next.submittedBy || '').trim(),
      next.submitted_at || next.submittedAt || existing.submitted_at,
      next.finished_at || next.finishedAt || null,
      String(next.status || 'pending').trim().toLowerCase(),
      Number(next.progress || 0),
      next.start_after || next.startAfter ? 1 : 0,
      String(next.validation_status || next.validationStatus || 'pending').trim().toLowerCase(),
      String(next.validation_notes || next.validationNotes || '').trim(),
      String(next.guest_customization || next.guestCustomization || '').trim(),
      next.boot_verified || next.bootVerified ? 1 : 0,
      next.network_verified || next.networkVerified ? 1 : 0,
      next.storage_verified || next.storageVerified ? 1 : 0,
      next.policy_tagged || next.policyTagged ? 1 : 0,
      String(next.result || '').trim(),
      String(next.target_route || next.targetRoute || '/vms').trim(),
      String(next.run_kind || next.runKind || 'template').trim().toLowerCase(),
      String(next.spec_json || next.specJson || '').trim(),
      id
    );

    if (steps !== undefined) {
      this.replaceSteps(id, steps);
    }

    return this.getById(id);
  },
};

function normalizeTemplateLibraryFolderRecord(record) {
  if (!record) return null;
  return {
    ...record,
    parent_id: record.parent_id === null || record.parent_id === undefined ? null : Number(record.parent_id),
    owner_user_id: normalizeOwnerUserId(record.owner_user_id),
    visibility: normalizeVisibility(record.visibility, record.owner_user_id ? 'private' : 'shared'),
  };
}

function normalizeTemplateLibraryItemRecord(record) {
  if (!record) return null;
  return {
    ...record,
    folder_id: record.folder_id === null || record.folder_id === undefined ? null : Number(record.folder_id),
    version: Number(record.version || 1),
    owner_user_id: normalizeOwnerUserId(record.owner_user_id),
    visibility: normalizeVisibility(record.visibility, record.owner_user_id ? 'private' : 'shared'),
  };
}

const templateLibraryModel = {
  // Folders
  listFolders(actor = {}) {
    const { clause, params } = buildVisibilityFilter(actor);
    return getDb().prepare(`
      SELECT * FROM template_library_folders WHERE ${clause} ORDER BY name
    `).all(...params).map(normalizeTemplateLibraryFolderRecord);
  },

  getFolderById(id) {
    return normalizeTemplateLibraryFolderRecord(
      getDb().prepare('SELECT * FROM template_library_folders WHERE id = ?').get(id)
    );
  },

  createFolder({ name, parentId = null, ownerUserId = null, visibility = 'private' }) {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    const normalizedVisibility = normalizedOwnerUserId
      ? normalizeVisibility(visibility, 'private')
      : 'shared';
    const result = getDb().prepare(`
      INSERT INTO template_library_folders (parent_id, name, owner_user_id, visibility)
      VALUES (?, ?, ?, ?)
    `).run(parentId || null, name, normalizedOwnerUserId, normalizedVisibility);
    return this.getFolderById(result.lastInsertRowid);
  },

  renameFolder(id, name) {
    getDb().prepare('UPDATE template_library_folders SET name = ? WHERE id = ?').run(name, id);
    return this.getFolderById(id);
  },

  moveFolder(id, parentId = null) {
    getDb().prepare('UPDATE template_library_folders SET parent_id = ? WHERE id = ?').run(parentId || null, id);
    return this.getFolderById(id);
  },

  deleteFolder(id) {
    getDb().prepare('DELETE FROM template_library_folders WHERE id = ?').run(id);
  },

  // Items
  listItems(actor = {}) {
    const { clause, params } = buildVisibilityFilter(actor);
    return getDb().prepare(`
      SELECT id, folder_id, kind, name, language, version, owner_user_id, visibility, created_at, updated_at
      FROM template_library_items WHERE ${clause} ORDER BY name
    `).all(...params).map(normalizeTemplateLibraryItemRecord);
  },

  getItemById(id) {
    return normalizeTemplateLibraryItemRecord(
      getDb().prepare('SELECT * FROM template_library_items WHERE id = ?').get(id)
    );
  },

  createItem({ folderId = null, kind = 'snippet', name, language = 'json', content = '', ownerUserId = null, visibility = 'private' }) {
    const normalizedOwnerUserId = normalizeOwnerUserId(ownerUserId);
    const normalizedVisibility = normalizedOwnerUserId
      ? normalizeVisibility(visibility, 'private')
      : 'shared';
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO template_library_items (folder_id, kind, name, language, content, version, owner_user_id, visibility, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
    `).run(folderId || null, kind, name, language, content || '', normalizedOwnerUserId, normalizedVisibility);
    const item = this.getItemById(result.lastInsertRowid);
    db.prepare(`
      INSERT INTO template_library_item_versions (item_id, version, content, saved_by)
      VALUES (?, 1, ?, ?)
    `).run(item.id, item.content, normalizedOwnerUserId);
    return item;
  },

  renameItem(id, name) {
    getDb().prepare('UPDATE template_library_items SET name = ? WHERE id = ?').run(name, id);
    return this.getItemById(id);
  },

  moveItem(id, folderId = null) {
    getDb().prepare('UPDATE template_library_items SET folder_id = ? WHERE id = ?').run(folderId || null, id);
    return this.getItemById(id);
  },

  saveItemContent(id, content, savedByUserId = null) {
    const db = getDb();
    const existing = this.getItemById(id);
    if (!existing) return null;
    const nextVersion = Number(existing.version || 1) + 1;
    db.prepare(`
      UPDATE template_library_items
      SET content = ?, version = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(content || '', nextVersion, id);
    db.prepare(`
      INSERT INTO template_library_item_versions (item_id, version, content, saved_by)
      VALUES (?, ?, ?, ?)
    `).run(id, nextVersion, content || '', normalizeOwnerUserId(savedByUserId));
    return this.getItemById(id);
  },

  listItemVersions(itemId) {
    return getDb().prepare(`
      SELECT id, item_id, version, saved_by, saved_at
      FROM template_library_item_versions
      WHERE item_id = ?
      ORDER BY version DESC
    `).all(itemId);
  },

  getItemVersion(itemId, version) {
    return getDb().prepare(`
      SELECT * FROM template_library_item_versions WHERE item_id = ? AND version = ?
    `).get(itemId, version);
  },

  deleteItem(id) {
    getDb().prepare('DELETE FROM template_library_items WHERE id = ?').run(id);
  },
};

module.exports = { getDb, connectionModel, hostTargetModel, managedTargetModel, projectModel, vFabricModel, settingsModel, retentionPolicyModel, deploymentRunModel, templateLibraryModel };
