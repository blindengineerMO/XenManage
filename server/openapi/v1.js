// OpenAPI 3.0 document for the public, token-authenticated /api/v1 surface
// (server/routes/public-api.js). This is the "API versioning foundation"
// item from plan.md's P0 list: a stable, published contract for the surface
// that a future XenManage CLI / Terraform provider / Ansible collection
// would build on, kept in sync with the actual routes by
// tests/unit/server/openapi-v1.test.js.
//
// Only /api/v1 is documented here — the much larger internal /api surface
// (session-authenticated, used by the SPA) is intentionally out of scope;
// plan.md item 7 describes it as a later, larger initiative.

const managedTarget = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    targetKey: { type: 'string' },
    connectionId: { type: 'integer' },
    name: { type: 'string' },
    host: { type: 'string' },
    username: { type: 'string' },
    port: { type: 'integer' },
    enabled: { type: 'boolean' },
    state: { type: 'string', enum: ['Unknown', 'Connecting', 'Healthy', 'Degraded', 'Unreachable', 'Disabled'] },
    lastError: { type: 'string' },
    lastCheckedAt: { type: 'string', format: 'date-time' },
    lastConnectedAt: { type: 'string', format: 'date-time' },
    nextRetryAt: { type: 'string', format: 'date-time' },
    retryCount: { type: 'integer' },
    certificateFingerprint: { type: 'string' },
  },
};

const workflow = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: { type: 'string', example: 'managed-target.check' },
    target_id: { type: 'integer', nullable: true },
    status: { type: 'string', enum: ['pending', 'running', 'awaiting-approval', 'succeeded', 'failed', 'canceled'] },
    idempotency_key: { type: 'string' },
    input: { type: 'object' },
    result: { type: 'object' },
    progress: { type: 'number' },
    attempt_count: { type: 'integer' },
    max_attempts: { type: 'integer' },
    scheduled_for: { type: 'string', format: 'date-time', nullable: true },
    started_at: { type: 'string', format: 'date-time', nullable: true },
    finished_at: { type: 'string', format: 'date-time', nullable: true },
    lock_key: { type: 'string' },
    requested_by: { type: 'string' },
    approval_id: { type: 'string' },
    error_text: { type: 'string' },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
    idempotent: { type: 'boolean', description: 'Only present on POST /workflows: true if an existing workflow matched the idempotency key instead of a new one being created.' },
  },
};

const errorResponse = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    message: { type: 'string' },
  },
  required: ['error'],
};

const errorResponses = {
  401: {
    description: 'Missing or invalid API token.',
    content: { 'application/json': { schema: errorResponse, example: { error: 'API_TOKEN_INVALID' } } },
  },
  403: {
    description: 'Token is valid but lacks the required permission.',
    content: { 'application/json': { schema: errorResponse, example: { error: 'PERMISSION_DENIED', permission: 'workflow.create' } } },
  },
};

const document = {
  openapi: '3.0.3',
  info: {
    title: 'XenManage Public API',
    version: 'v1',
    description: 'Token-authenticated automation surface for XenManage managed targets and workflows. Intended as the stable base for external tooling (CLI, Terraform, Ansible). Every route requires `Authorization: Bearer <api-token>`; tokens and their permissions are issued from Settings > Governance > API Tokens.',
    'x-compatibility-policy': {
      stability: 'Nothing already published under /api/v1 is changed in a breaking way: no route removed or renamed, no field removed/renamed/retyped, no change to authentication or error semantics. Any change of that kind ships as /api/v2, introduced alongside v1 rather than replacing it, so existing v1 integrations keep working with no flag day.',
      additiveChanges: 'New routes, new optional request fields, and new optional response fields may be added to v1 at any time without advance notice, the same way a semver minor release would.',
      deprecationNoticeMinDays: 90,
      deprecationSignal: 'A route or field being retired from v1 is first marked "deprecated": true at this same location in this document, and responses from it start carrying a Deprecation: true header plus a Sunset header (RFC 8594) naming the removal date, simultaneously, for at least deprecationNoticeMinDays before it is actually removed.',
      changelogPolicy: 'Every deprecation and every eventual removal is recorded in CHANGELOG.md under the release it shipped in, in addition to the signals above.',
    },
  },
  servers: [{ url: '/api/v1' }],
  security: [{ bearerApiToken: [] }],
  paths: {
    '/': {
      get: {
        operationId: 'getApiInfo',
        summary: 'Describe this API version',
        security: [{ bearerApiToken: [] }],
        responses: {
          200: {
            description: 'API metadata.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    version: { type: 'string', example: 'v1' },
                    resources: { type: 'array', items: { type: 'string' } },
                    authentication: { type: 'string' },
                  },
                },
              },
            },
          },
          ...errorResponses,
        },
      },
    },
    '/managed-targets': {
      get: {
        operationId: 'listManagedTargets',
        summary: 'List managed targets visible to this token',
        'x-required-permission': 'managed.target.read',
        responses: {
          200: {
            description: 'Managed targets.',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: managedTarget } } } } },
          },
          ...errorResponses,
        },
      },
    },
    '/managed-targets/{id}/check': {
      post: {
        operationId: 'checkManagedTarget',
        summary: 'Run a live health check against a managed target',
        'x-required-permission': 'managed.target.check',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          200: {
            description: 'Updated target state after the check.',
            content: { 'application/json': { schema: managedTarget } },
          },
          404: {
            description: 'No managed target with that id is visible to this token.',
            content: { 'application/json': { schema: errorResponse, example: { error: 'MANAGED_TARGET_NOT_FOUND' } } },
          },
          ...errorResponses,
        },
      },
    },
    '/workflows': {
      get: {
        operationId: 'listWorkflows',
        summary: 'List workflows',
        'x-required-permission': 'workflow.read',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filter by workflow status.' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        ],
        responses: {
          200: {
            description: 'Workflows.',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: workflow } } } } },
          },
          ...errorResponses,
        },
      },
      post: {
        operationId: 'createWorkflow',
        summary: 'Create (or idempotently reuse) a workflow, optionally running it immediately',
        'x-required-permission': 'workflow.create',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['type', 'targetId'],
                properties: {
                  type: { type: 'string', enum: ['managed-target.check'] },
                  targetId: { type: 'integer', minimum: 1 },
                  input: { type: 'object', default: {} },
                  idempotencyKey: { type: 'string', maxLength: 180 },
                  maxAttempts: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
                  scheduledFor: { type: 'string', format: 'date-time' },
                  lockKey: { type: 'string', maxLength: 180 },
                  runNow: { type: 'boolean', default: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'An existing workflow matched idempotencyKey; returned as-is.', content: { 'application/json': { schema: workflow } } },
          201: { description: 'A new workflow was created.', content: { 'application/json': { schema: workflow } } },
          400: {
            description: 'Validation or workflow-creation error.',
            content: { 'application/json': { schema: errorResponse } },
          },
          ...errorResponses,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerApiToken: { type: 'http', scheme: 'bearer', description: 'API token issued from Settings > Governance > API Tokens.' },
    },
    schemas: { managedTarget, workflow, error: errorResponse },
  },
};

module.exports = document;
