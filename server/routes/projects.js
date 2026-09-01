const express = require('express');
const { validate, schemas } = require('../middleware/validate');
const { projectModel } = require('../models/connection');
const { ensureMutationAllowed } = require('../middleware/governance');
const { resolveActor } = require('../services/resource-ownership');
const projectsService = require('../services/projects');

const router = express.Router();

router.get('/organizations', (_req, res) => res.json({ data: projectModel.listOrganizations() }));
router.post('/organizations', validate(schemas.organizationCreate), (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'organization_create', entityType: 'organization', entityRef: 'new' })) return;
  try { res.status(201).json(projectModel.createOrganization(req.body)); } catch (error) { res.status(409).json({ error: error.code || error.message }); }
});
router.get('/', (req, res) => {
  const actor = resolveActor(req);
  res.json({ data: projectModel.listProjects().filter((project) => projectsService.canAccessProject(project, actor)) });
});
router.post('/', validate(schemas.projectCreate), (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'project_create', entityType: 'project', entityRef: 'new' })) return;
  try { res.status(201).json(projectModel.createProject({ ...req.body, ownerUserId: req.body.ownerUserId || req.session.userId })); } catch (error) { res.status(409).json({ error: error.code || error.message }); }
});
router.get('/:id', validate(schemas.projectId, 'params'), (req, res) => {
  const project = projectModel.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
  if (!projectsService.canAccessProject(project, resolveActor(req))) return res.status(403).json({ error: 'PROJECT_FORBIDDEN' });
  res.json({ ...project, assignments: projectModel.listAssignments(project.id) });
});
router.put('/:id', validate(schemas.projectId, 'params'), validate(schemas.projectUpdate), (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'project_update', entityType: 'project', entityRef: req.params.id })) return;
  const project = projectModel.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
  if (resolveActor(req).role !== 'admin' && Number(project.owner_user_id) !== Number(req.session.userId)) return res.status(403).json({ error: 'PROJECT_FORBIDDEN' });
  res.json(projectModel.updateProject(req.params.id, req.body));
});
router.put('/:id/quotas', validate(schemas.projectId, 'params'), validate(schemas.projectQuotaUpdate), (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'project_quota_save', entityType: 'project', entityRef: req.params.id })) return;
  const project = projectModel.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
  if (resolveActor(req).role !== 'admin' && Number(project.owner_user_id) !== Number(req.session.userId)) return res.status(403).json({ error: 'PROJECT_FORBIDDEN' });
  res.json(projectModel.upsertQuota(req.params.id, req.body));
});
router.put('/:id/members/:userId', validate(schemas.projectMemberParams, 'params'), validate(schemas.projectMemberUpdate), (req, res) => {
  if (!ensureMutationAllowed(req, res, { actionKey: 'project_member_save', entityType: 'project', entityRef: req.params.id })) return;
  const project = projectModel.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
  if (resolveActor(req).role !== 'admin' && Number(project.owner_user_id) !== Number(req.session.userId)) return res.status(403).json({ error: 'PROJECT_FORBIDDEN' });
  res.json({ data: projectModel.setMember(req.params.id, req.params.userId, req.body.role) });
});
router.get('/:id/quota-evaluation', validate(schemas.projectId, 'params'), async (req, res) => {
  try { res.json(await projectsService.evaluateProjectQuota({ projectId: req.params.id, actor: resolveActor(req), xenApi: req.xenApi, targetKey: req.xenTarget?.targetKey || '' })); }
  catch (error) { res.status(error.status || 500).json({ error: error.code || error.message }); }
});

module.exports = router;
