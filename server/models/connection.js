const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { runMigrations } = require('../migrations/runner');

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
  runMigrations(db, [{
    version: 1,
    name: 'control-plane-baseline',
    checksum: 'control-plane-baseline-2026-09-02',
    adoptLegacySchema: true,
    up: initializeSchema,
  }]);
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

    CREATE TABLE IF NOT EXISTS terraform_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      state_json TEXT NOT NULL DEFAULT '{}',
      lock_id TEXT NOT NULL DEFAULT '',
      lock_json TEXT NOT NULL DEFAULT '{}',
      lock_expires_at DATETIME,
      owner_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
      catalog_request_id INTEGER REFERENCES catalog_requests(id) ON DELETE SET NULL,
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

    CREATE TABLE IF NOT EXISTS catalog_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      source_item_id INTEGER REFERENCES template_library_items(id) ON DELETE SET NULL,
      source_kind TEXT NOT NULL DEFAULT 'deployment-template',
      category TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      image_url TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'draft',
      naming_pattern TEXT NOT NULL DEFAULT 'NODE-XXXX',
      next_sequence INTEGER NOT NULL DEFAULT 1,
      fixed_variables_json TEXT NOT NULL DEFAULT '{}',
      subscriber_fields_json TEXT NOT NULL DEFAULT '[]',
      max_active_per_subscriber INTEGER,
      requires_approval INTEGER NOT NULL DEFAULT 1,
      approval_policy_json TEXT NOT NULL DEFAULT '{"mode":"manual"}',
      cost_rates_json TEXT NOT NULL DEFAULT '{}',
      target_pool_refs_json TEXT NOT NULL DEFAULT '[]',
      lease_duration_hours INTEGER,
      current_version_id INTEGER,
      owner_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_entry_id INTEGER NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
      requested_by INTEGER,
      requested_by_name TEXT NOT NULL DEFAULT '',
      parameters_json TEXT NOT NULL DEFAULT '{}',
      generated_name TEXT NOT NULL DEFAULT '',
      deployment_run_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      decided_at DATETIME,
      decided_by_user_id INTEGER,
      lease_duration_hours INTEGER,
      lease_expires_at DATETIME,
      expired_at DATETIME,
      estimated_monthly_cost REAL,
      actual_monthly_cost REAL,
      cost_currency TEXT NOT NULL DEFAULT 'USD',
      actual_cost_updated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_entry_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_entry_id INTEGER NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL,
      lifecycle_stage TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_stage IN ('draft', 'staged', 'stable', 'deprecated')),
      validation_status TEXT NOT NULL DEFAULT 'untested' CHECK (validation_status IN ('untested', 'validated', 'failed')),
      validation_notes TEXT NOT NULL DEFAULT '',
      created_by_user_id INTEGER,
      validated_by_user_id INTEGER,
      validated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(catalog_entry_id, version_number)
    );

    CREATE TABLE IF NOT EXISTS catalog_request_approval_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_request_id INTEGER NOT NULL REFERENCES catalog_requests(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      decided_by_user_id INTEGER,
      decided_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(catalog_request_id, step_order)
    );

    CREATE TABLE IF NOT EXISTS catalog_approval_hook_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_request_id INTEGER NOT NULL REFERENCES catalog_requests(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      response_code INTEGER,
      response_body TEXT NOT NULL DEFAULT '',
      last_error TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_catalog_hook_attempts_due ON catalog_approval_hook_attempts(status, next_attempt_at);

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
  if (!deploymentRunColumns.has('catalog_request_id')) {
    db.exec('ALTER TABLE deployment_runs ADD COLUMN catalog_request_id INTEGER REFERENCES catalog_requests(id) ON DELETE SET NULL');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_deployment_runs_catalog_request ON deployment_runs(catalog_request_id)');

  const catalogEntryColumns = new Set(
    db.prepare('PRAGMA table_info(catalog_entries)').all().map((column) => column.name)
  );
  if (!catalogEntryColumns.has('naming_pattern')) {
    db.exec(`ALTER TABLE catalog_entries ADD COLUMN naming_pattern TEXT NOT NULL DEFAULT 'NODE-XXXX'`);
  }
  if (!catalogEntryColumns.has('next_sequence')) {
    db.exec('ALTER TABLE catalog_entries ADD COLUMN next_sequence INTEGER NOT NULL DEFAULT 1');
  }
  if (!catalogEntryColumns.has('fixed_variables_json')) {
    db.exec(`ALTER TABLE catalog_entries ADD COLUMN fixed_variables_json TEXT NOT NULL DEFAULT '{}'`);
  }
  if (!catalogEntryColumns.has('subscriber_fields_json')) {
    db.exec(`ALTER TABLE catalog_entries ADD COLUMN subscriber_fields_json TEXT NOT NULL DEFAULT '[]'`);
  }
  if (!catalogEntryColumns.has('max_active_per_subscriber')) {
    db.exec('ALTER TABLE catalog_entries ADD COLUMN max_active_per_subscriber INTEGER');
  }
  if (!catalogEntryColumns.has('requires_approval')) {
    db.exec('ALTER TABLE catalog_entries ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 1');
  }
  if (!catalogEntryColumns.has('approval_policy_json')) {
    db.exec("ALTER TABLE catalog_entries ADD COLUMN approval_policy_json TEXT NOT NULL DEFAULT '{\"mode\":\"manual\"}'");
  }
  if (!catalogEntryColumns.has('current_version_id')) {
    db.exec('ALTER TABLE catalog_entries ADD COLUMN current_version_id INTEGER');
  }
  if (!catalogEntryColumns.has('lease_duration_hours')) {
    db.exec('ALTER TABLE catalog_entries ADD COLUMN lease_duration_hours INTEGER');
  }
  if (!catalogEntryColumns.has('cost_rates_json')) {
    db.exec("ALTER TABLE catalog_entries ADD COLUMN cost_rates_json TEXT NOT NULL DEFAULT '{}'");
  }
  if (!catalogEntryColumns.has('target_pool_refs_json')) {
    db.exec("ALTER TABLE catalog_entries ADD COLUMN target_pool_refs_json TEXT NOT NULL DEFAULT '[]'");
  }
  const catalogRequestColumns = new Set(
    db.prepare('PRAGMA table_info(catalog_requests)').all().map((column) => column.name)
  );
  if (!catalogRequestColumns.has('generated_name')) {
    db.exec(`ALTER TABLE catalog_requests ADD COLUMN generated_name TEXT NOT NULL DEFAULT ''`);
  }
  if (!catalogRequestColumns.has('deployment_run_id')) {
    db.exec(`ALTER TABLE catalog_requests ADD COLUMN deployment_run_id TEXT NOT NULL DEFAULT ''`);
  }
  if (!catalogRequestColumns.has('decided_at')) {
    db.exec('ALTER TABLE catalog_requests ADD COLUMN decided_at DATETIME');
  }
  if (!catalogRequestColumns.has('decided_by_user_id')) {
    db.exec('ALTER TABLE catalog_requests ADD COLUMN decided_by_user_id INTEGER');
  }
  if (!catalogRequestColumns.has('lease_duration_hours')) {
    db.exec('ALTER TABLE catalog_requests ADD COLUMN lease_duration_hours INTEGER');
  }
  if (!catalogRequestColumns.has('lease_expires_at')) {
    db.exec('ALTER TABLE catalog_requests ADD COLUMN lease_expires_at DATETIME');
  }
  if (!catalogRequestColumns.has('expired_at')) {
    db.exec('ALTER TABLE catalog_requests ADD COLUMN expired_at DATETIME');
  }
  if (!catalogRequestColumns.has('estimated_monthly_cost')) {
    db.exec('ALTER TABLE catalog_requests ADD COLUMN estimated_monthly_cost REAL');
  }
  if (!catalogRequestColumns.has('actual_monthly_cost')) {
    db.exec('ALTER TABLE catalog_requests ADD COLUMN actual_monthly_cost REAL');
  }
  if (!catalogRequestColumns.has('cost_currency')) {
    db.exec("ALTER TABLE catalog_requests ADD COLUMN cost_currency TEXT NOT NULL DEFAULT 'USD'");
  }
  if (!catalogRequestColumns.has('actual_cost_updated_at')) {
    db.exec('ALTER TABLE catalog_requests ADD COLUMN actual_cost_updated_at DATETIME');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_catalog_requests_lease_due ON catalog_requests(status, lease_expires_at)');
  db.exec(`CREATE TABLE IF NOT EXISTS catalog_approval_hook_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_request_id INTEGER NOT NULL REFERENCES catalog_requests(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', attempt_count INTEGER NOT NULL DEFAULT 0,
    next_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP, response_code INTEGER,
    response_body TEXT NOT NULL DEFAULT '', last_error TEXT NOT NULL DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ); CREATE INDEX IF NOT EXISTS idx_catalog_hook_attempts_due ON catalog_approval_hook_attempts(status, next_attempt_at);
  `);
  db.exec(`CREATE TABLE IF NOT EXISTS catalog_request_approval_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_request_id INTEGER NOT NULL REFERENCES catalog_requests(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL, label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    decided_by_user_id INTEGER, decided_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(catalog_request_id, step_order)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS catalog_entry_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_entry_id INTEGER NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
    lifecycle_stage TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_stage IN ('draft', 'staged', 'stable', 'deprecated')),
    validation_status TEXT NOT NULL DEFAULT 'untested' CHECK (validation_status IN ('untested', 'validated', 'failed')),
    validation_notes TEXT NOT NULL DEFAULT '', created_by_user_id INTEGER, validated_by_user_id INTEGER,
    validated_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(catalog_entry_id, version_number)
  )`);
  const unversionedEntries = db.prepare(`SELECT * FROM catalog_entries
    WHERE current_version_id IS NULL OR NOT EXISTS (SELECT 1 FROM catalog_entry_versions WHERE id = catalog_entries.current_version_id)`).all();
  const insertCatalogVersion = db.prepare(`INSERT INTO catalog_entry_versions
    (catalog_entry_id, version_number, snapshot_json, lifecycle_stage, validation_status, validated_at)
    VALUES (?, 1, ?, ?, ?, ?)`);
  unversionedEntries.forEach((entry) => {
    const trustedPublished = entry.visibility === 'published';
    const result = insertCatalogVersion.run(entry.id, JSON.stringify(entry), trustedPublished ? 'stable' : 'draft', trustedPublished ? 'validated' : 'untested', trustedPublished ? new Date().toISOString() : null);
    db.prepare('UPDATE catalog_entries SET current_version_id = ? WHERE id = ?').run(result.lastInsertRowid, entry.id);
  });
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
  getByCatalogRequestId(catalogRequestId) {
    const row = getDb().prepare(`SELECT id FROM deployment_runs WHERE catalog_request_id = ?
      ORDER BY submitted_at DESC LIMIT 1`).get(Number(catalogRequestId));
    return row ? this.getById(row.id) : null;
  },
  linkCatalogRequest(id, catalogRequestId) {
    const result = getDb().prepare('UPDATE deployment_runs SET catalog_request_id = ? WHERE id = ?')
      .run(Number(catalogRequestId), String(id));
    return result.changes ? this.getById(id) : null;
  },
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

function parseCatalogJson(value, fallback) {
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch (_error) { return fallback; }
}

function normalizeCatalogEntry(entry, { includeFixedVariables = false, includeApprovalPolicy = includeFixedVariables } = {}) {
  const { tags_json, subscriber_fields_json, fixed_variables_json, approval_policy_json, cost_rates_json, target_pool_refs_json, ...record } = entry;
  const fixedVariables = parseCatalogJson(fixed_variables_json, {});
  const normalized = {
    ...record,
    tags: parseCatalogJson(tags_json, []),
    subscriberFields: parseCatalogJson(subscriber_fields_json, []),
    maxActivePerSubscriber: entry.max_active_per_subscriber == null ? null : Number(entry.max_active_per_subscriber),
    requiresApproval: Boolean(entry.requires_approval),
    leaseDurationHours: entry.lease_duration_hours == null ? null : Number(entry.lease_duration_hours),
    costRates: parseCatalogJson(cost_rates_json, {}),
    targetPoolRefs: parseCatalogJson(target_pool_refs_json, []),
    costBasis: {
      vcpus: Number(fixedVariables.vcpus || fixedVariables.VCPUs || 0),
      memoryGiB: Number(fixedVariables.memoryGiB ?? (Number(fixedVariables.memoryStaticMax || 0) / (1024 ** 3))),
      diskGiB: Number(fixedVariables.diskGiB ?? fixedVariables.diskSizeGiB ?? fixedVariables.diskSizeGb ?? fixedVariables.storageGiB ?? 0),
    },
  };
  if (includeApprovalPolicy) normalized.approvalPolicy = parseCatalogJson(approval_policy_json, entry.requires_approval ? { mode: 'manual' } : { mode: 'auto' });
  if (includeFixedVariables) normalized.fixedVariables = fixedVariables;
  return normalized;
}

const catalogModel = {
  createVersion(entryId, createdByUserId = null, { trustedPublished = false } = {}) {
    const db = getDb();
    const entry = db.prepare('SELECT * FROM catalog_entries WHERE id = ?').get(entryId);
    if (!entry) return null;
    const next = db.prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS version FROM catalog_entry_versions WHERE catalog_entry_id = ?').get(entryId);
    const result = db.prepare(`INSERT INTO catalog_entry_versions
      (catalog_entry_id, version_number, snapshot_json, lifecycle_stage, validation_status, created_by_user_id, validated_by_user_id, validated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(entryId, Number(next.version), JSON.stringify(entry), trustedPublished ? 'stable' : 'draft', trustedPublished ? 'validated' : 'untested', createdByUserId || null, trustedPublished ? createdByUserId || null : null, trustedPublished ? new Date().toISOString() : null);
    db.prepare('UPDATE catalog_entries SET current_version_id = ? WHERE id = ?').run(result.lastInsertRowid, entryId);
    return this.getVersion(result.lastInsertRowid);
  },
  getVersion(versionId) {
    const record = getDb().prepare('SELECT * FROM catalog_entry_versions WHERE id = ?').get(versionId);
    return record ? { ...record, snapshot: parseCatalogJson(record.snapshot_json, {}) } : null;
  },
  listVersions(entryId) {
    return getDb().prepare(`SELECT * FROM catalog_entry_versions WHERE catalog_entry_id = ? ORDER BY version_number DESC`).all(entryId)
      .map((record) => ({ ...record, snapshot: parseCatalogJson(record.snapshot_json, {}) }));
  },
  validateVersion(entryId, versionId, validationStatus, notes, userId) {
    const stage = validationStatus === 'validated' ? 'staged' : 'draft';
    const result = getDb().prepare(`UPDATE catalog_entry_versions SET validation_status = ?, validation_notes = ?,
      lifecycle_stage = ?, validated_by_user_id = ?, validated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND catalog_entry_id = ? AND id = (SELECT current_version_id FROM catalog_entries WHERE id = ?)`)
      .run(validationStatus, notes || '', stage, userId || null, versionId, entryId, entryId);
    return result.changes ? this.getVersion(versionId) : null;
  },
  publishVersion(entryId, userId) {
    const db = getDb();
    return db.transaction(() => {
      const entry = db.prepare('SELECT * FROM catalog_entries WHERE id = ?').get(entryId);
      const version = entry?.current_version_id ? db.prepare('SELECT * FROM catalog_entry_versions WHERE id = ?').get(entry.current_version_id) : null;
      if (!entry || !version) return null;
      if (version.validation_status !== 'validated') {
        const error = new Error('CATALOG_VERSION_VALIDATION_REQUIRED');
        error.code = 'CATALOG_VERSION_VALIDATION_REQUIRED';
        throw error;
      }
      db.prepare(`UPDATE catalog_entry_versions SET lifecycle_stage = 'deprecated'
        WHERE catalog_entry_id = ? AND lifecycle_stage = 'stable' AND id != ?`).run(entryId, version.id);
      db.prepare(`UPDATE catalog_entry_versions SET lifecycle_stage = 'stable', validated_by_user_id = COALESCE(validated_by_user_id, ?),
        validated_at = COALESCE(validated_at, CURRENT_TIMESTAMP) WHERE id = ?`).run(userId || null, version.id);
      db.prepare("UPDATE catalog_entries SET visibility = 'published', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(entryId);
      return this.getById(entryId);
    })();
  },
  createHookAttempt(requestId) {
    const db = getDb();
    return db.transaction(() => {
      const existing = db.prepare('SELECT * FROM catalog_approval_hook_attempts WHERE catalog_request_id = ?').get(requestId);
      if (existing) return existing;
      const result = db.prepare('INSERT INTO catalog_approval_hook_attempts (catalog_request_id) VALUES (?)').run(requestId);
      return db.prepare('SELECT * FROM catalog_approval_hook_attempts WHERE id = ?').get(result.lastInsertRowid);
    })();
  },
  listDueHookAttempts() {
    return getDb().prepare(`SELECT a.*, r.parameters_json, r.catalog_entry_id, r.status AS request_status,
        r.requested_by, r.requested_by_name, e.slug, e.title, e.approval_policy_json
      FROM catalog_approval_hook_attempts a JOIN catalog_requests r ON r.id = a.catalog_request_id
      JOIN catalog_entries e ON e.id = r.catalog_entry_id
      WHERE a.status = 'pending' AND a.next_attempt_at <= CURRENT_TIMESTAMP`).all();
  },
  claimHookAttempt(id) {
    const result = getDb().prepare(`UPDATE catalog_approval_hook_attempts
      SET status = 'processing', attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP`).run(id);
    return result.changes
      ? getDb().prepare('SELECT * FROM catalog_approval_hook_attempts WHERE id = ?').get(id)
      : null;
  },
  finishHookAttempt(id, { status, responseCode = null, responseBody = '', error = '', retryDelaySeconds = 0 }) {
    getDb().prepare(`UPDATE catalog_approval_hook_attempts SET status = ?, response_code = ?, response_body = ?,
      last_error = ?, next_attempt_at = datetime('now', ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(status, responseCode, responseBody, error, `+${Math.max(0, retryDelaySeconds)} seconds`, id);
    return getDb().prepare('SELECT * FROM catalog_approval_hook_attempts WHERE id = ?').get(id) || null;
  },
  recoverProcessingHookAttempts() {
    return getDb().prepare(`UPDATE catalog_approval_hook_attempts SET status = 'pending',
      next_attempt_at = CURRENT_TIMESTAMP, last_error = 'CATALOG_APPROVAL_HOOK_PROCESS_RESTARTED',
      updated_at = CURRENT_TIMESTAMP WHERE status = 'processing'`).run().changes;
  },
  listHookAttempts(requestId) {
    return getDb().prepare('SELECT * FROM catalog_approval_hook_attempts WHERE catalog_request_id = ? ORDER BY id').all(requestId);
  },
  listAll() {
    return getDb().prepare('SELECT * FROM catalog_entries ORDER BY lower(title)').all()
      .map((entry) => ({ ...normalizeCatalogEntry(entry, { includeFixedVariables: true }), currentVersion: this.getVersion(entry.current_version_id) }));
  },
  listPublished() {
    return getDb().prepare("SELECT * FROM catalog_entries WHERE visibility = 'published' ORDER BY lower(title)").all()
      .map(normalizeCatalogEntry);
  },
  getPublishedBySlug(slug) {
    const entry = getDb().prepare("SELECT * FROM catalog_entries WHERE visibility = 'published' AND slug = ?").get(slug);
    return entry ? normalizeCatalogEntry(entry, { includeApprovalPolicy: true }) : null;
  },
  getById(id) {
    const entry = getDb().prepare('SELECT * FROM catalog_entries WHERE id = ?').get(id);
    return entry ? { ...normalizeCatalogEntry(entry, { includeFixedVariables: true }), currentVersion: this.getVersion(entry.current_version_id) } : null;
  },
  createRequest(entryId, requestedBy, requestedByName, parameters = {}, approvalPolicy = null, estimate = null) {
    const db = getDb();
    return db.transaction(() => {
      const result = db.prepare(`INSERT INTO catalog_requests (catalog_entry_id, requested_by, requested_by_name, parameters_json, estimated_monthly_cost, cost_currency)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .run(entryId, requestedBy || null, requestedByName || '', JSON.stringify(parameters || {}), estimate?.monthlyCost ?? null, estimate?.currency || 'USD');
      const requestId = Number(result.lastInsertRowid);
      if (approvalPolicy?.mode === 'multi-step') {
        const insertStep = db.prepare(`INSERT INTO catalog_request_approval_steps
          (catalog_request_id, step_order, label) VALUES (?, ?, ?)`);
        approvalPolicy.steps.forEach((label, index) => insertStep.run(requestId, index + 1, label));
      }
      return db.prepare('SELECT * FROM catalog_requests WHERE id = ?').get(requestId);
    })();
  },
  listApprovalSteps(requestId) {
    return getDb().prepare(`SELECT * FROM catalog_request_approval_steps
      WHERE catalog_request_id = ? ORDER BY step_order`).all(requestId);
  },
  reviewRequest(id, status, decidedByUserId, renderName) {
    const db = getDb();
    return db.transaction(() => {
      const request = db.prepare('SELECT * FROM catalog_requests WHERE id = ? AND status = \'pending\'').get(id);
      if (!request) return null;
      const steps = db.prepare(`SELECT * FROM catalog_request_approval_steps
        WHERE catalog_request_id = ? ORDER BY step_order`).all(id);
      if (!steps.length) {
        const decided = status === 'approved'
          ? this.approveRequestWithNextName(id, renderName, decidedByUserId)
          : this.decideRequest(id, status, decidedByUserId);
        return decided ? { request: decided, approvalStep: null, chainComplete: true } : null;
      }
      const current = steps.find((step) => step.status === 'pending');
      if (!current) return null;
      if (status === 'approved' && steps.some((step) => step.status === 'approved' && Number(step.decided_by_user_id) === Number(decidedByUserId))) {
        const error = new Error('CATALOG_APPROVER_SEPARATION_REQUIRED');
        error.code = 'CATALOG_APPROVER_SEPARATION_REQUIRED';
        throw error;
      }
      db.prepare(`UPDATE catalog_request_approval_steps SET status = ?, decided_by_user_id = ?, decided_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'`).run(status, decidedByUserId || null, current.id);
      if (status === 'rejected') {
        const rejected = this.decideRequest(id, 'rejected', decidedByUserId);
        return rejected ? { request: rejected, approvalStep: { ...current, status }, chainComplete: true } : null;
      }
      const remaining = db.prepare(`SELECT COUNT(*) AS count FROM catalog_request_approval_steps
        WHERE catalog_request_id = ? AND status = 'pending'`).get(id);
      if (Number(remaining.count) > 0) {
        return {
          request: db.prepare('SELECT * FROM catalog_requests WHERE id = ?').get(id),
          approvalStep: { ...current, status },
          chainComplete: false,
        };
      }
      const approved = this.approveRequestWithNextName(id, renderName, decidedByUserId);
      return approved ? { request: approved, approvalStep: { ...current, status }, chainComplete: true } : null;
    })();
  },
  listRequests() {
    return getDb().prepare(`SELECT catalog_requests.*, catalog_entries.slug, catalog_entries.title,
        hook.status AS hook_status, hook.attempt_count AS hook_attempt_count,
        hook.last_error AS hook_last_error, hook.next_attempt_at AS hook_next_attempt_at
      FROM catalog_requests JOIN catalog_entries ON catalog_entries.id = catalog_requests.catalog_entry_id
      LEFT JOIN catalog_approval_hook_attempts hook ON hook.id = (
        SELECT latest_hook.id FROM catalog_approval_hook_attempts latest_hook
        WHERE latest_hook.catalog_request_id = catalog_requests.id
        ORDER BY latest_hook.id DESC LIMIT 1
      )
      ORDER BY catalog_requests.created_at DESC`).all().map((entry) => ({ ...entry, parameters: JSON.parse(entry.parameters_json || '{}'), approvalSteps: this.listApprovalSteps(entry.id) }));
  },
  listRequestsForUser(userId) {
    return getDb().prepare(`SELECT catalog_requests.*, catalog_entries.slug, catalog_entries.title,
        hook.status AS hook_status, hook.attempt_count AS hook_attempt_count,
        hook.last_error AS hook_last_error, hook.next_attempt_at AS hook_next_attempt_at
      FROM catalog_requests JOIN catalog_entries ON catalog_entries.id = catalog_requests.catalog_entry_id
      LEFT JOIN catalog_approval_hook_attempts hook ON hook.id = (
        SELECT latest_hook.id FROM catalog_approval_hook_attempts latest_hook
        WHERE latest_hook.catalog_request_id = catalog_requests.id
        ORDER BY latest_hook.id DESC LIMIT 1
      )
      WHERE catalog_requests.requested_by = ?
      ORDER BY catalog_requests.created_at DESC`).all(userId)
      .map((entry) => ({ ...entry, parameters: JSON.parse(entry.parameters_json || '{}'), approvalSteps: this.listApprovalSteps(entry.id) }));
  },
  getAnalytics() {
    const entries = getDb().prepare(`SELECT catalog_entries.id, catalog_entries.slug, catalog_entries.title,
        COUNT(catalog_requests.id) AS request_volume,
        ROUND(AVG(CASE WHEN catalog_requests.decided_at IS NOT NULL THEN
          (julianday(catalog_requests.decided_at) - julianday(catalog_requests.created_at)) * 1440 END), 1) AS avg_approval_minutes,
        SUM(CASE WHEN catalog_requests.status = 'complete' THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN catalog_requests.status IN ('reclaimed', 'expired') THEN 1 ELSE 0 END) AS reclaimed_count,
        SUM(CASE WHEN catalog_requests.status = 'pending' THEN 1 ELSE 0 END) AS pending_count
      FROM catalog_entries LEFT JOIN catalog_requests ON catalog_requests.catalog_entry_id = catalog_entries.id
      GROUP BY catalog_entries.id ORDER BY request_volume DESC, lower(catalog_entries.title)`).all();
    return {
      entries,
      totals: entries.reduce((totals, entry) => ({
        requestVolume: totals.requestVolume + Number(entry.request_volume || 0),
        activeCount: totals.activeCount + Number(entry.active_count || 0),
        reclaimedCount: totals.reclaimedCount + Number(entry.reclaimed_count || 0),
        pendingCount: totals.pendingCount + Number(entry.pending_count || 0),
      }), { requestVolume: 0, activeCount: 0, reclaimedCount: 0, pendingCount: 0 }),
    };
  },
  countActiveRequestsForUser(entryId, userId) {
    const row = getDb().prepare(`SELECT COUNT(*) AS count FROM catalog_requests
      WHERE catalog_entry_id = ? AND requested_by = ?
        AND status IN ('pending', 'approved', 'deploying')`).get(entryId, userId);
    return Number(row?.count || 0);
  },
  updateRequestStatus(id, status) {
    getDb().prepare('UPDATE catalog_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
    return getDb().prepare('SELECT * FROM catalog_requests WHERE id = ?').get(id) || null;
  },
  decideRequest(id, status, decidedByUserId) {
    const result = getDb().prepare(`UPDATE catalog_requests
      SET status = ?, decided_at = CURRENT_TIMESTAMP, decided_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'`).run(status, decidedByUserId || null, id);
    return result.changes ? getDb().prepare('SELECT * FROM catalog_requests WHERE id = ?').get(id) : null;
  },
  approveRequestWithNextName(id, renderName, decidedByUserId = null) {
    const db = getDb();
    const approve = db.transaction(() => {
      const request = db.prepare('SELECT * FROM catalog_requests WHERE id = ?').get(id);
      if (!request || request.status !== 'pending') return null;
      const entry = db.prepare('SELECT * FROM catalog_entries WHERE id = ?').get(request.catalog_entry_id);
      if (!entry) return null;
      const sequence = Number(entry.next_sequence || 1);
      const generatedName = renderName(entry.naming_pattern, sequence);
      db.prepare('UPDATE catalog_entries SET next_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(sequence + 1, entry.id);
      db.prepare(`UPDATE catalog_requests
        SET status = 'approved', generated_name = ?, decided_at = CURRENT_TIMESTAMP,
          decided_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`).run(generatedName, decidedByUserId || null, id);
      return db.prepare('SELECT * FROM catalog_requests WHERE id = ?').get(id);
    });
    return approve();
  },
  beginDeployment(id) {
    const db = getDb();
    const begin = db.transaction(() => {
      const request = db.prepare('SELECT * FROM catalog_requests WHERE id = ?').get(id);
      if (!request || request.status !== 'approved') return null;
      db.prepare(`UPDATE catalog_requests SET status = 'deploying', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
      return db.prepare('SELECT * FROM catalog_requests WHERE id = ?').get(id);
    });
    return begin();
  },
  finishDeployment(id, status, deploymentRunId = '') {
    getDb().prepare(`UPDATE catalog_requests SET status = ?, deployment_run_id = ?,
      lease_duration_hours = CASE WHEN ? = 'complete' THEN (SELECT lease_duration_hours FROM catalog_entries WHERE id = catalog_requests.catalog_entry_id) ELSE NULL END,
      lease_expires_at = CASE WHEN ? = 'complete' THEN datetime('now', '+' || (SELECT lease_duration_hours FROM catalog_entries WHERE id = catalog_requests.catalog_entry_id) || ' hours') ELSE NULL END,
      expired_at = NULL,
      actual_monthly_cost = CASE WHEN ? = 'complete' THEN estimated_monthly_cost ELSE NULL END,
      actual_cost_updated_at = CASE WHEN ? = 'complete' THEN CURRENT_TIMESTAMP ELSE NULL END,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(status, deploymentRunId, status, status, status, status, id);
    return getDb().prepare('SELECT * FROM catalog_requests WHERE id = ?').get(id) || null;
  },
  expireDueLeases() {
    const db = getDb();
    return db.transaction(() => {
      const due = db.prepare(`SELECT catalog_requests.id, catalog_requests.generated_name, catalog_requests.requested_by, catalog_entries.title
        FROM catalog_requests JOIN catalog_entries ON catalog_entries.id = catalog_requests.catalog_entry_id
        WHERE catalog_requests.status = 'complete' AND catalog_requests.lease_expires_at IS NOT NULL
          AND catalog_requests.lease_expires_at <= CURRENT_TIMESTAMP`).all();
      const expire = db.prepare(`UPDATE catalog_requests SET status = 'expired', expired_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'complete' AND lease_expires_at <= CURRENT_TIMESTAMP`);
      return due.filter((request) => expire.run(request.id).changes > 0);
    })();
  },
  create(entry) {
    const result = getDb().prepare(`INSERT INTO catalog_entries (slug, title, description, source_item_id, source_kind, category, tags_json, image_url, visibility, naming_pattern, next_sequence, fixed_variables_json, subscriber_fields_json, max_active_per_subscriber, requires_approval, approval_policy_json, cost_rates_json, target_pool_refs_json, lease_duration_hours, owner_user_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`).run(entry.slug, entry.title, entry.description || '', entry.sourceItemId || null, entry.sourceKind || 'deployment-template', entry.category || '', JSON.stringify(entry.tags || []), entry.imageUrl || '', entry.visibility || 'draft', entry.namingPattern || 'NODE-XXXX', Number(entry.nextSequence || 1), JSON.stringify(entry.fixedVariables || {}), JSON.stringify(entry.subscriberFields || []), entry.maxActivePerSubscriber || null, entry.requiresApproval === false ? 0 : 1, JSON.stringify(entry.approvalPolicy || (entry.requiresApproval === false ? { mode: 'auto' } : { mode: 'manual' })), JSON.stringify(entry.costRates || {}), JSON.stringify(entry.targetPoolRefs || []), entry.leaseDurationHours || null, entry.ownerUserId || null);
    this.createVersion(result.lastInsertRowid, entry.ownerUserId, { trustedPublished: entry.visibility === 'published' });
    return this.getById(result.lastInsertRowid);
  },
  update(id, entry) {
    getDb().prepare(`UPDATE catalog_entries SET slug = ?, title = ?, description = ?, source_item_id = ?, source_kind = ?, category = ?, tags_json = ?, image_url = ?, visibility = ?, naming_pattern = ?, fixed_variables_json = ?, subscriber_fields_json = ?, max_active_per_subscriber = ?, requires_approval = ?, approval_policy_json = ?, cost_rates_json = ?, target_pool_refs_json = ?, lease_duration_hours = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(entry.slug, entry.title, entry.description || '', entry.sourceItemId || null, entry.sourceKind || 'deployment-template', entry.category || '', JSON.stringify(entry.tags || []), entry.imageUrl || '', entry.visibility || 'draft', entry.namingPattern || 'NODE-XXXX', JSON.stringify(entry.fixedVariables || {}), JSON.stringify(entry.subscriberFields || []), entry.maxActivePerSubscriber || null, entry.requiresApproval === false ? 0 : 1, JSON.stringify(entry.approvalPolicy || (entry.requiresApproval === false ? { mode: 'auto' } : { mode: 'manual' })), JSON.stringify(entry.costRates || {}), JSON.stringify(entry.targetPoolRefs || []), entry.leaseDurationHours || null, id);
    const updated = getDb().prepare('SELECT * FROM catalog_entries WHERE id = ?').get(id);
    if (!updated) return null;
    this.createVersion(id, entry.ownerUserId || null);
    return this.getById(id);
  },
  delete(id) { return getDb().prepare('DELETE FROM catalog_entries WHERE id = ?').run(id).changes > 0; },
};

const terraformStateModel = {
  get(name) {
    return getDb().prepare('SELECT * FROM terraform_states WHERE name = ?').get(name) || null;
  },
  save(name, stateJson, ownerUserId = null) {
    getDb().prepare(`INSERT INTO terraform_states (name, state_json, owner_user_id, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(name) DO UPDATE SET state_json = excluded.state_json, owner_user_id = excluded.owner_user_id, updated_at = CURRENT_TIMESTAMP`)
      .run(name, stateJson, ownerUserId);
    return this.get(name);
  },
  lock(name, lockId, lockJson, ownerUserId = null) {
    const db = getDb();
    const acquire = db.transaction(() => {
      const existing = this.get(name);
      if (existing?.lock_id && existing.lock_id !== lockId) return null;
      if (!existing) db.prepare('INSERT INTO terraform_states (name, owner_user_id) VALUES (?, ?)').run(name, ownerUserId);
      db.prepare(`UPDATE terraform_states SET lock_id = ?, lock_json = ?, owner_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE name = ?`)
        .run(lockId, lockJson, ownerUserId, name);
      return this.get(name);
    });
    return acquire();
  },
  unlock(name, lockId) {
    const state = this.get(name);
    if (!state || !state.lock_id || state.lock_id !== lockId) return false;
    return getDb().prepare(`UPDATE terraform_states SET lock_id = '', lock_json = '{}', lock_expires_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE name = ?`).run(name).changes > 0;
  },
};

module.exports = { getDb, connectionModel, hostTargetModel, managedTargetModel, projectModel, vFabricModel, settingsModel, retentionPolicyModel, deploymentRunModel, templateLibraryModel, catalogModel, terraformStateModel };
