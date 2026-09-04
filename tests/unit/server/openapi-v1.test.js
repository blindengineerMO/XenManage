const fs = require('fs');
const path = require('path');
const openApiDoc = require('../../../server/openapi/v1');

// Keeps server/openapi/v1.js (the "API versioning foundation" / published
// OpenAPI document for /api/v1 from plan.md item 7) honest against the
// actual routes in server/routes/public-api.js, the same way
// governance-coverage.test.js keeps the Action Catalog scan honest — a
// route added to public-api.js with no matching doc entry (or vice versa)
// fails here instead of the document silently going stale.

const PUBLIC_API_FILE = path.join(__dirname, '..', '..', '..', 'server', 'routes', 'public-api.js');

function actualRoutes() {
  const text = fs.readFileSync(PUBLIC_API_FILE, 'utf8');
  const lines = text.split('\n');
  const routes = [];
  for (const line of lines) {
    const match = line.match(/^router\.(get|post|put|patch|delete)\(\s*['"]([^'"]*)['"]/);
    if (match) routes.push({ method: match[1], expressPath: match[2] });
  }
  return routes;
}

// Express `:id` params become OpenAPI `{id}` placeholders.
function toOpenApiPath(expressPath) {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

describe('OpenAPI v1 document', () => {
  it('is valid JSON with the expected top-level shape', () => {
    expect(openApiDoc.openapi).toBe('3.0.3');
    expect(openApiDoc.paths).toBeInstanceOf(Object);
    expect(JSON.stringify(openApiDoc)).toEqual(expect.any(String));
  });

  it('documents every mutating/list route actually registered in public-api.js (excluding the doc endpoint itself)', () => {
    const routes = actualRoutes().filter((r) => r.expressPath !== '/openapi.json');
    const missing = [];
    for (const route of routes) {
      const openApiPath = toOpenApiPath(route.expressPath);
      const pathEntry = openApiDoc.paths[openApiPath];
      if (!pathEntry || !pathEntry[route.method]) {
        missing.push(`${route.method.toUpperCase()} ${route.expressPath}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('does not document routes that no longer exist in public-api.js', () => {
    const registered = new Set(
      actualRoutes()
        .filter((r) => r.expressPath !== '/openapi.json')
        .map((r) => `${r.method} ${toOpenApiPath(r.expressPath)}`)
    );
    const stale = [];
    for (const [openApiPath, methods] of Object.entries(openApiDoc.paths)) {
      for (const method of Object.keys(methods)) {
        const key = `${method} ${openApiPath}`;
        if (!registered.has(key)) stale.push(key.toUpperCase());
      }
    }
    expect(stale).toEqual([]);
  });

  it('publishes the compatibility/deprecation policy referenced by plan.md item 7', () => {
    const policy = openApiDoc.info['x-compatibility-policy'];
    expect(policy).toBeTruthy();
    expect(typeof policy.stability).toBe('string');
    expect(policy.stability.length).toBeGreaterThan(0);
    expect(typeof policy.additiveChanges).toBe('string');
    expect(Number.isInteger(policy.deprecationNoticeMinDays)).toBe(true);
    expect(policy.deprecationNoticeMinDays).toBeGreaterThan(0);
    expect(typeof policy.deprecationSignal).toBe('string');
    expect(policy.deprecationSignal).toMatch(/Deprecation/);
    expect(policy.deprecationSignal).toMatch(/Sunset/);
    expect(typeof policy.changelogPolicy).toBe('string');
  });

  it('gives every documented operation a 2xx response, a summary, and an operationId', () => {
    const problems = [];
    for (const [openApiPath, methods] of Object.entries(openApiDoc.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const label = `${method.toUpperCase()} ${openApiPath}`;
        if (!operation.summary) problems.push(`${label}: missing summary`);
        if (!operation.operationId) problems.push(`${label}: missing operationId`);
        const has2xx = Object.keys(operation.responses || {}).some((code) => /^2\d\d$/.test(code));
        if (!has2xx) problems.push(`${label}: no 2xx response documented`);
      }
    }
    expect(problems).toEqual([]);
  });
});
