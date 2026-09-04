const fs = require('fs');
const path = require('path');

// This is the "Action Catalog" enforcement test called for in plan.md's
// governance-inconsistency finding: every mutating (non-GET) route must
// resolve to a recognizable governance/auth gate, so a route can no longer
// silently ship without one (as PUT /api/vms/import and POST
// /api/workflows/:id/approve both once did). It statically scans each
// server/routes/*.js file for top-level `router.<verb>(` declarations and
// checks the declaration line plus its handler body for a known gate
// marker, or a `router.use(requireXxx)` applied earlier in the same file.

const ROUTES_DIR = path.join(__dirname, '..', '..', '..', 'server', 'routes');

const GATE_MARKERS = [
  'ensureMutationAllowed',
  'requireAdminSession',
  'requireAdmin',
  'requireApiPermission',
  'requireCatalogAdmin',
  'requireCatalogSubscriber',
  'requireCatalogViewer',
  'requireOwnerOrAdmin',
  'requireAuth',
  'requireLocalAdmin',
  'requireLocalUser',
  'requireOwner',
];

// Routes that intentionally have no governance-role gate, with the reason
// each is safe. Anything mutating that is NOT in this list and has no gate
// marker fails the test below — the allowlist is the only way to mark a
// route as a deliberate exception, so adding to it is a reviewable diff.
const ALLOWLIST = new Set([
  // Pre-session auth bootstrapping: no governance role exists yet to gate against.
  'auth.js:POST /login',
  'auth.js:POST /mfa/verify',
  'auth.js:POST /xen-login',
  'auth.js:POST /logout',
  // Session role switching is the mechanism governance itself is built on; it
  // has its own escalation guard (governanceService.hasRole) instead of ensureMutationAllowed.
  'governance.js:PUT /role',
  // Break-glass elevation is intentionally reachable by any authenticated,
  // non-admin session (that's the point of an emergency escalation); it has
  // its own guards (a justification requirement, optional MFA verification,
  // a 30 minute auto-expiry, and distinct audit logging) instead of requireAdminSession.
  'governance.js:POST /break-glass/activate',
  'governance.js:POST /break-glass/deactivate',
  // Requesting an approval is intentionally open to every authenticated role
  // (including read-only) so operators can ask for elevated permission; the
  // actual decision endpoint (POST /approvals/:id/decision) is admin-gated.
  'governance.js:POST /approvals',
  // Re-runs a live health probe against an already-registered target; it does
  // not change the target's definition or any governed resource.
  'managed-targets.js:POST /:id/check',
  // Triggers telemetry collection into perf.db; does not touch governed
  // infrastructure state.
  'metrics.js:POST /collect',
  // Read-only SR discovery probe (queries Xen, creates nothing).
  'storage.js:POST /probe',
  // Pure plan simulation - explicitly a dry-run, executes no changes.
  'vms.js:POST /compose/dry-run',
]);

function scanFile(file) {
  const text = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
  const lines = text.split('\n');

  let blanketLine = -1;
  lines.forEach((line, idx) => {
    if (/^router\.use\(require\w+/.test(line)) blanketLine = idx;
  });

  const startIdxs = [];
  lines.forEach((line, idx) => {
    if (/^router\.(get|post|put|patch|delete)\(/.test(line)) startIdxs.push(idx);
  });
  startIdxs.push(lines.length);

  const uncovered = [];
  for (let i = 0; i < startIdxs.length - 1; i++) {
    const start = startIdxs[i];
    const end = startIdxs[i + 1];
    const block = lines.slice(start, end).join('\n');
    const method = lines[start].match(/^router\.(\w+)\(/)[1];
    if (method === 'get') continue;

    const pathMatch = block.match(/^router\.\w+\(\s*['"]([^'"]*)['"]/);
    const routePath = pathMatch ? pathMatch[1] : '?';
    const hasGate = GATE_MARKERS.some((marker) => block.includes(marker))
      || (blanketLine >= 0 && blanketLine < start);

    if (!hasGate) {
      uncovered.push({
        key: `${file}:${method.toUpperCase()} ${routePath}`,
        line: start + 1,
      });
    }
  }
  return uncovered;
}

describe('governance action-catalog coverage', () => {
  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.js'));

  it('gates every mutating route with a known governance/auth check or an explicit, reasoned allowlist entry', () => {
    const gaps = [];
    for (const file of files) {
      for (const finding of scanFile(file)) {
        if (!ALLOWLIST.has(finding.key)) {
          gaps.push(`${finding.key} (${file}:${finding.line})`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it('does not carry stale allowlist entries for routes that no longer exist', () => {
    const found = new Set();
    for (const file of files) {
      for (const finding of scanFile(file)) found.add(finding.key);
    }
    const stale = [...ALLOWLIST].filter((key) => !found.has(key));
    expect(stale).toEqual([]);
  });
});
