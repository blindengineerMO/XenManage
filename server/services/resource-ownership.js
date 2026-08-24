const governanceService = require('./governance');
const { userModel } = require('../models/security-db');

const VALID_VISIBILITIES = new Set(['private', 'shared']);

function normalizeVisibility(value, fallback = 'private') {
  return VALID_VISIBILITIES.has(value) ? value : fallback;
}

function normalizeOwnerUserId(value) {
  const normalized = Number(value || 0);
  return normalized > 0 ? normalized : null;
}

function isAdminRole(role = 'operator') {
  return governanceService.hasRole(role, 'admin');
}

function resolveActor(input = {}) {
  const session = input.session || input;
  return {
    userId: normalizeOwnerUserId(session.userId),
    role: governanceService.getSessionRole(session),
    username: session.appUsername || session.xenUser || 'system',
  };
}

function getRecordVisibility(record = {}) {
  return normalizeVisibility(record.visibility, record.owner_user_id ? 'private' : 'shared');
}

function isVisibleToActor(record, actor = {}) {
  if (!record) return false;
  if (isAdminRole(actor.role)) return true;

  const visibility = getRecordVisibility(record);
  const ownerUserId = normalizeOwnerUserId(record.owner_user_id);

  if (visibility === 'shared' || ownerUserId === null) {
    return true;
  }

  return ownerUserId !== null && ownerUserId === normalizeOwnerUserId(actor.userId);
}

function canManageRecord(record, actor = {}) {
  if (!record) return false;
  if (isAdminRole(actor.role)) return true;

  const visibility = getRecordVisibility(record);
  const ownerUserId = normalizeOwnerUserId(record.owner_user_id);
  const actorUserId = normalizeOwnerUserId(actor.userId);

  if (ownerUserId !== null) {
    return actorUserId !== null && ownerUserId === actorUserId;
  }

  return visibility === 'shared';
}

function resolveCreateOwnership(payload = {}, actor = {}) {
  let visibility = normalizeVisibility(payload.visibility, actor.userId ? 'private' : 'shared');
  if (!actor.userId) {
    visibility = 'shared';
  }

  return {
    visibility,
    ownerUserId: normalizeOwnerUserId(actor.userId),
  };
}

function resolveUpdateOwnership(existing = {}, payload = {}, actor = {}) {
  let visibility = normalizeVisibility(payload.visibility, getRecordVisibility(existing));
  let ownerUserId = normalizeOwnerUserId(existing.owner_user_id);
  const actorUserId = normalizeOwnerUserId(actor.userId);

  if (!actorUserId && visibility === 'private') {
    visibility = 'shared';
  }

  if (!ownerUserId && actorUserId) {
    ownerUserId = actorUserId;
  }

  return { visibility, ownerUserId };
}

function buildOwnerProfileMap(records = []) {
  const ownerIds = [...new Set(records.map((record) => normalizeOwnerUserId(record.owner_user_id)).filter(Boolean))];
  return ownerIds.reduce((accumulator, ownerId) => {
    const owner = userModel.getById(ownerId);
    if (owner) {
      accumulator.set(ownerId, owner);
    }
    return accumulator;
  }, new Map());
}

function enrichOwnedRecord(record, actor = {}, ownerProfiles = new Map()) {
  if (!record) return null;

  const ownerUserId = normalizeOwnerUserId(record.owner_user_id);
  const owner = ownerProfiles.get(ownerUserId) || null;
  const visibility = getRecordVisibility(record);

  return {
    ...record,
    owner_user_id: ownerUserId,
    visibility,
    owner_username: owner?.username || '',
    owner_display_name: owner?.display_name || owner?.username || '',
    is_owner: ownerUserId !== null && ownerUserId === normalizeOwnerUserId(actor.userId),
    can_manage: canManageRecord(record, actor),
  };
}

function enrichOwnedRecords(records = [], actor = {}) {
  const ownerProfiles = buildOwnerProfileMap(records);
  return records.map((record) => enrichOwnedRecord(record, actor, ownerProfiles));
}

module.exports = {
  normalizeVisibility,
  normalizeOwnerUserId,
  resolveActor,
  isVisibleToActor,
  canManageRecord,
  resolveCreateOwnership,
  resolveUpdateOwnership,
  enrichOwnedRecord,
  enrichOwnedRecords,
};
