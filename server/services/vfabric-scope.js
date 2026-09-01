const { vFabricModel } = require('../models/connection');
const { getConnection, rehydrateConnection } = require('./xenapi');
const { isVisibleToActor, resolveActor } = require('./resource-ownership');

function visibleMembers(record, actor) {
  return (record?.members || []).filter((member) => isVisibleToActor(member, actor));
}

function memberMatchesTarget(member, target) {
  if (!member || !target) return false;

  if (member.kind === 'pool') {
    return Number(member.target_id || 0) === Number(target.connectionId || 0);
  }

  return Number(member.target_id || 0) === Number(target.hostTargetId || 0);
}

function describeTarget(target, member, connected) {
  return {
    targetKey: target.targetKey,
    connectionId: target.connectionId || null,
    hostTargetId: target.hostTargetId || null,
    connectionName: target.connectionName || member.name || '',
    host: target.host || member.host || '',
    username: target.username || '',
    port: target.port || 443,
    kind: member.kind,
    memberId: member.id,
    connected,
  };
}

function notFoundError() {
  const error = new Error('VFABRIC_NOT_FOUND');
  error.code = 'VFABRIC_NOT_FOUND';
  error.status = 404;
  return error;
}

function getVFabricScope(req, vFabricId) {
  const actor = resolveActor(req);
  const record = vFabricModel.getById(vFabricId);
  if (!record || !isVisibleToActor(record, actor)) throw notFoundError();

  const members = visibleMembers(record, actor);
  const sessionTargets = Array.isArray(req.session?.xenTargets) ? req.session.xenTargets : [];
  const sessionId = req.session?.id || req.sessionID;
  const attachedTargetKeys = new Set();
  const attachedTargets = [];

  for (const member of members) {
    const target = sessionTargets.find((candidate) => memberMatchesTarget(member, candidate));
    if (!target || attachedTargetKeys.has(target.targetKey)) continue;
    const api = getConnection(sessionId, target.targetKey) || rehydrateConnection(sessionId, target);
    if (!api) continue;
    attachedTargetKeys.add(target.targetKey);
    attachedTargets.push(describeTarget(target, member, true));
  }

  const unavailableMembers = members
    .filter((member) => !sessionTargets.some((target) => memberMatchesTarget(member, target)))
    .map((member) => ({
      id: member.id,
      kind: member.kind,
      targetId: member.target_id,
      name: member.name || '',
      host: member.host || '',
    }));

  return {
    scope: {
      id: record.id,
      name: record.name,
      description: record.description || '',
      colorTag: record.color_tag || 'green',
      memberCount: members.length,
      attachedTargetCount: attachedTargets.length,
      unavailableMemberCount: unavailableMembers.length,
    },
    attachedTargets,
    unavailableMembers,
  };
}

function resolveVFabricScopeTargets(req, vFabricId) {
  const scope = getVFabricScope(req, vFabricId);
  const sessionId = req.session?.id || req.sessionID;
  return {
    ...scope,
    targets: scope.attachedTargets.map((target) => ({
      ...target,
      xenApi: getConnection(sessionId, target.targetKey),
    })).filter((target) => target.xenApi),
  };
}

module.exports = { getVFabricScope, resolveVFabricScopeTargets };
