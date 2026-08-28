# XenMange

![XenManage Image](client/assets/images/XenManageGitImage.png)

A self-hosted, governance-first web console for administering XenServer/XCP-ng pools, hosts, VMs, storage, and networking. Vue 3 SPA + Express API talking to XenServer's JSON-RPC v2.0 XAPI, with a CSP-safe local runtime, a SQLite-backed control plane, and automated unit + browser test coverage.

## Why XenMange Exists

Most XenServer tooling (XenCenter, the raw `xe` CLI) assumes a single trusted operator with root credentials talking straight to a host. That model breaks down the moment more than one person touches the infrastructure: there's no record of who did what, nothing stops someone from fat-fingering a delete on a production VM, there's no shared view of which pool is about to run out of memory, and there's no durable answer to "what's the recovery plan for this workload?" XenMange puts a governed control plane in front of XenServer without giving up direct XAPI access underneath it:

- **Governance & compliance** exist because destructive hypervisor operations — VM delete, snapshot revert, host reboot/shutdown, credential rotation — are effectively irreversible, and "I have root, so I can" is not an audit trail. XenMange enforces role ceilings (`read-only` / `operator` / `admin`), per-pool resource quotas, and an approval-request/decision workflow so that a destructive action either requires a sufficiently privileged role or a recorded, scoped approval — and every action lands in a searchable, exportable log.
- **Disaster Recovery / Resilience tooling** exists because "we have snapshots somewhere" is not a recovery plan. XenMange derives a protection posture per workload — recovery tier, HA restart priority, backup freshness — from VM tags and XenServer's own task/message history, then lets operators author and drill actual recovery runbooks against that posture. Failover readiness becomes something you can see and rehearse instead of something you assume.
- **Capacity / balancing tooling** exists because host memory pressure and storage over-commitment creep up silently between the moments someone happens to open a monitoring dashboard. XenMange persists telemetry history and continuously surfaces skew, saturation, and headroom so a hot host or an over-committed SR gets caught before it becomes an incident.

None of this replaces XenServer's own mechanisms — HA, live migration, snapshots, XAPI itself. XenMange orchestrates them and adds accountability and visibility around them. See [Governance & Compliance](#governance--compliance) and [Disaster Recovery & Resilience](#disaster-recovery--resilience) below for exactly what is and isn't automated today.

## Quick Start

### Local (Node.js)

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `admin` / the `XENMANGE_BOOTSTRAP_PASSWORD` value from your `.env`.

### Docker

```bash
cp .env.example .env
# at minimum, set SESSION_SECRET and XENMANGE_BOOTSTRAP_PASSWORD in .env
# (VAULT_ENCRYPTION_KEY is recommended for production — see Configuration below)
docker compose up -d --build
```

This builds the Vue client bundle into the image and runs the server as a non-root user against a named `xenmange-data` volume, so the four SQLite databases survive container rebuilds/restarts. See `Dockerfile` and `docker-compose.yml` in the repo root.

## How XenMange Is Organized

Signing in to XenMange is a login to the **application**, not to a XenServer host. Local credentials (the bootstrap `admin` account, or any user created under Governance → Users) authenticate against `security.db`. XenServer pools and standalone hosts are registered *afterward*, as saved **targets**:

- **Pools workspace → Registered Pool Targets** — saved pool connections (host, username, optional vault credential).
- **Hosts workspace → Registered Host Targets** — saved standalone-host connections, independent of any pool membership.

A target can be bound to a credential stored in the encrypted vault (`vault.db`) instead of a plaintext password, and an authenticated control-plane session can attach, switch between, and detach **multiple live Xen targets at once** without ever logging out of XenMange itself. A legacy "Direct Xen Login" path exists for connecting straight to a host at sign-in time, but the intended flow — and the one the app defaults to — is control-plane login first, targets second.

## Usage Guide

1. **Sign in** to the XenMange control plane.
2. **Register a target** from Pools or Hosts — host/username/password, or a saved vault credential — then attach it to bring it live.
3. **Inventory** gives you a searchable cross-object view (VMs, hosts, SRs, networks, saved targets) plus server-persisted workspace presets, so repeat navigation doesn't mean rebuilding the same filtered view every session.
4. **VMs** — power operations, snapshots/checkpoints, fast clone / full copy, same-pool and cross-pool/storage-remapped live migration, a compatibility matrix (`VM.get_possible_hosts` + `VM.assert_can_boot_here`) for mixed-hardware placement, console access, and XVA/metadata import-export — all from the VM details workspace.
5. **Storage & Networking** — create and manage SRs (NFS, iSCSI, EXT, LVM, or probe/import an existing repository) and networks/VLANs/bonds directly from their workspaces, plus per-VDI resize/delete and per-VIF config/disconnect.
6. **Templates** — governance metadata (version label, golden-image baseline, validation posture, catalog ownership) per template, plus a compare-and-promote workflow for staged/validated generations and a deployment-validation queue.
7. **Lifecycle** — maintenance posture, lifecycle-oriented task tracking, heuristic compliance/drift signals, and remediation tasks backed by reusable templates.
8. **Capacity** — live and persisted trend telemetry, host skew/imbalance detection, storage commitment, and rebalancing guidance (details in [Capacity & Workload Balancing](#capacity--workload-balancing)).
9. **Resilience** — derived DR/HA readiness, recovery runbooks, and DR drill tracking (details in [Disaster Recovery & Resilience](#disaster-recovery--resilience)).
10. **Alerts** — a policy-driven triage queue fed by XenServer messages, task failures, and persisted metric thresholds, with bulk acknowledge/state changes.
11. **Activity** is the federated Log Center — audit history, auth events, alerts, remediation tasks, and XenServer task history in one searchable table, exportable as JSON, HTML, or PDF.
12. **Governance** — role, quota, and approval administration, plus local user/group management (details below).
13. **Settings** — runtime configuration (session timeout, trust-proxy behavior, telemetry collector controls), retention policy preview/run, and vault credential management.

## Governance & Compliance

Governance is XenMange's answer to "who is allowed to do what, and can we prove it happened." It's implemented as its own service (`server/services/governance.js`) rather than bolted onto individual routes, so the same rules apply everywhere:

- **Roles** are a strict ceiling: `read-only` (0) < `operator` (1) < `admin` (2). A session's effective role is either explicitly set or falls back to the org-wide default role from policy. Server-side checks (`hasRole`) prevent a session from escalating its own role past what its account was actually granted.
- **Policy** (`PUT /api/governance/policy`, admin-only) controls the default role, whether destructive actions require approval at all, and the approval TTL (5 minutes–7 days).
- **Quotas** are per-pool (`maxVmCount`, `maxRunningVmCount`, `maxTotalMemoryGiB`), so a team or environment can be capped without touching XenServer-side resource pools.
- **Approvals** are a scoped, single-use workflow: a request (`actionKey` + `entityType` + `entityRef` + justification) moves `pending → approved/rejected → used`, expiring automatically past its TTL. Consuming an approval re-validates that it matches the exact action/entity it was granted for — an approval to delete VM A can't be replayed against VM B. Every destructive route across VM power/snapshot/migration, host maintenance/reboot/shutdown, saved targets, retention sweeps, vault credentials, alert policies, lifecycle plans, and resilience runbooks routes through this same gate, and drops the operator straight into the approval composer when a valid token is missing instead of just failing.
- **Audit trail**: every governed action, auth event, and admin change is recorded and surfaces in the Activity → Log Center, exportable for compliance review.
- **Local users & groups** (`security.db`) give you real accounts instead of one shared admin login — active/disabled posture, per-account role ceiling, group membership, and last-admin protection (you cannot disable/demote the only remaining admin).

## Disaster Recovery & Resilience

Resilience in XenMange is a **readiness and orchestration layer**, not a black-box backup engine — worth being precise about, because "we have a resilience tab" and "we run your backups" are very different claims.

**What is derived automatically** (`server/services/resilience.js`), per VM:

- **Recovery tier** — `Tier-1` / `Edge` / `Non-Prod` / `Standard`, read from an explicit `other_config.recovery_tier` override, a runbook's declared tier, or inferred from VM tags (`prod`/`production`/`critical` → Tier-1, `edge`/`branch` → Edge, `staging`/`dev`/`test` → Non-Prod).
- **HA restart priority** — similarly resolved from an explicit override, the runbook, or the inferred tier.
- **Backup freshness** — a target backup window (12h for Tier-1, 24h otherwise, unless overridden) compared against the most recent resilience-flagged XenServer task or message matched to that VM, using pattern matching against task/message text (`snapshot|backup|protect|replicat|failover|recover|restore|drill|migrat|evacuat`) and severity keywords, to flag workloads that are overdue.

**What operators actually author and run:**

- **Recovery runbooks** — per-pool, operator-written plans (steps, recovery tier, restart priority, backup window) that the derived posture above falls back to when a VM doesn't declare its own overrides.
- **DR drills** — logged, trackable exercises against a pool's runbook, so "when did we last actually test failover for this pool" has a real answer instead of an assumption.

**What is real, executable action** (not just inference): VM snapshot/checkpoint create/revert/delete (VM Protection tab), same-pool live migration and cross-pool/storage-remapped migration with transfer-network and per-VIF remapping (VM Migration tab), and host maintenance mode with evacuation-network selection and live workload draining. These are the actual mechanisms an operator uses to protect a workload or fail it over — Resilience's job is to tell you *whether that's been done recently enough and for the right workloads*, and Capacity/Alerts tell you when a host needs evacuating in the first place.

What XenMange does **not** yet do: run its own backup/replication engine (incremental or otherwise), or automatically trigger failover. Today that stays a human-in-the-loop decision informed by the derived posture above.

## Capacity & Workload Balancing

Capacity telemetry is persisted, not just sampled live: a configurable background collector (Settings → Telemetry) polls attached targets and writes host-memory, VM-memory, and SR-utilization samples into `perf.db`, which is what powers the trend cards across Capacity, Host, and VM detail panes and the two threshold-derived alert rules (host memory ≥85%/95% warning/critical, SR utilization ≥80%/92% warning/critical — `server/services/telemetry-alerts.js`).

"Workload balancing" today means **skew detection and operator guidance, not automated placement**: for each pool, XenMange compares each host's memory usage against the pool average and surfaces the resulting deviation as an imbalance/skew percentage, alongside headroom, saturation, and per-workload risk sizing (how large a VM is relative to its current host). That analytics feed drives the Capacity workspace's rebalance guidance and can seed a Lifecycle remediation task — but XenMange does not move VMs on its own. The operator acts on that guidance using the real migration tooling in the VM Migration tab (live migration within a pool, or cross-pool/storage-remapped migration). There's no equivalent yet to an automated DRS/WLB-style engine that relocates workloads without a human triggering it.

## Architecture

```
Browser (Vue 3 SPA) ←→ Express Server (port 3000) ←→ XenServer (JSON-RPC v2.0 XAPI)
                                ↕
                  SQLite (xenmange.db / security.db / vault.db / perf.db)
```

- **Frontend**: Vue 3 runtime bundle + Vue Router 4, compiled by `scripts/build-client.js` into `client/dist` and served locally (no CDN dependency, CSP-safe).
- **Backend**: Express 5, `better-sqlite3`, Joi validation, Helmet security headers.
- **Session durability**: SQLite-backed Express sessions with live XenAPI session rehydration after process restarts, so protected routes don't drop every attached Xen target on a redeploy.
- **Four separate SQLite databases**: `xenmange.db` (connections, settings, retention policies, deployment runs), `security.db` (users, groups, durable sessions, auth events, wrapped vault key material), `vault.db` (encrypted credential ciphertext), `perf.db` (persisted telemetry history).
- **Server-rendered bootstrap**: Express renders the SPA shell with the current session's auth/connection state embedded, so the client can restore an authenticated session without an extra round-trip.
- **Theme**: dark glassmorphic "Matrix meets Hackers" — scanlines, neon green/cyan accents, floating draggable windows, dense tree navigation. New controls follow the same conventions (see `client/assets/css/components.css`): dense switches instead of checkboxes, styled dropdowns, `.dash-card` panels.

## Stack

| Layer | Technology |
|-------|-----------|
| SPA | Vue.js 3, Vue Router 4, local client bundle |
| Icons | Material Design Icons (`@mdi/font`) |
| Fonts | Share Tech Mono, Rajdhani, Exo 2 (Google Fonts) |
| Server | Express 5, Helmet, CORS, `express-session` |
| Security | CSP headers, rate limiting (20 attempts / 15 min on auth routes), Joi validation on all input |
| DB | SQLite via `better-sqlite3` — `xenmange.db` (connections, settings, retention), `security.db` (users/groups/sessions/auth events), `vault.db` (encrypted credentials), `perf.db` (telemetry history) |
| API | XenServer JSON-RPC v2.0 over HTTPS |
| Reporting | `pdfkit` for centralized log PDF exports |
| Testing | Jest (unit), Playwright (E2E) |
| Container | Docker (multi-stage `node:22-bookworm-slim` build, non-root runtime) |

## Project Structure

```
XenMange/
├── server/
│   ├── index.js                    # Express server entry
│   ├── config.js                   # Environment config
│   ├── middleware/                 # security (Helmet/CSP), session, session-store, Joi validate
│   ├── models/                     # connection.js, security-db.js, vault-db.js, perf-db.js
│   ├── routes/                     # auth, dashboard, vms, hosts, storage, networks, pools, tasks,
│   │                                #   resilience, lifecycle, alerts, audit, governance, users,
│   │                                #   groups, credentials, host-targets, workspaces, system-config,
│   │                                #   logs, metrics, api (saved connections)
│   ├── services/                   # governance, resilience(+runbooks), template-governance,
│   │                                #   remediation-tasks(+templates), lifecycle-plans, alerts,
│   │                                #   telemetry-alerts, metrics-collector, metrics-history,
│   │                                #   credential-vault, retention, log-center, audit-log,
│   │                                #   resource-ownership, system-config, xenapi
│   └── views/                      # app.ejs (SSR shell), log-export.ejs, 404.ejs, 500.ejs
├── client/
│   ├── index.html                  # Vue SPA entry
│   ├── dist/                       # Generated runtime bundle + local vendor assets
│   └── assets/
│       ├── css/                    # main.css, animations.css, components.css
│       ├── js/
│       │   ├── app.js              # Router/bootstrap entry
│       │   ├── core/                # State, view-models per domain, router, session bootstrap
│       │   ├── components/
│       │   │   ├── common/          # StatusBadge, MetricTrendCard
│       │   │   ├── controls/        # DataTable
│       │   │   ├── dialogs/         # FloatingWindow
│       │   │   ├── forms/           # ~45 domain forms (VM/host/storage/network/governance/...)
│       │   │   └── layout/          # AppShell, SideNav, StatusBar, TopNav
│       │   └── views/               # One file per route-level workspace (16 workspaces)
│       └── images/
├── tests/
│   ├── unit/server/                # Jest: routes, middleware, services
│   ├── unit/client/                # Jest: components, core view-models
│   └── e2e/                        # Playwright browser flows
├── data/                            # SQLite databases (auto-created, git-ignored)
├── Dockerfile                       # Multi-stage build → non-root runtime image
├── docker-compose.yml                # Single-service compose template
├── .env.example                      # Environment template
└── package.json
```

## API Reference

All `/api/*` routes require a valid session cookie except the sign-in endpoints. Routes marked "requires target" additionally require an attached, live XenServer session.

### Auth

| Method | Path | Description |
|--------|------|--------------|
| POST | `/api/auth/login` | Sign into the XenMange control plane |
| POST | `/api/auth/xen-login` | Legacy direct Xen session (see [How XenMange Is Organized](#how-xenmange-is-organized)) |
| POST | `/api/auth/logout` | Disconnect and destroy session |
| GET | `/api/auth/status` | Current control-plane + attached-target session status |

### VMs *(requires target)*

`GET /api/vms`, `GET /api/vms/:ref`, `PUT /api/vms/:ref/config`, `POST /api/vms/{start,shutdown,reboot,suspend,resume}`, `GET/POST /api/vms/:ref/snapshots`, `POST /api/vms/:ref/snapshots/:snapshotRef/revert`, `DELETE /api/vms/:ref/snapshots/:snapshotRef`, `POST /api/vms/:ref/duplicate`, `GET /api/vms/:ref/export`, `PUT /api/vms/import`, `POST /api/vms/:ref/migrate`, `GET /api/vms/:ref/compatibility`, `GET /api/vms/:ref/consoles`, `GET /api/vms/:ref/consoles/:consoleRef/launch`, `POST /api/vms/:ref/disks`, `POST /api/vms/:ref/nics`, `POST/DELETE /api/vms/:ref/nics/:vifRef`, `GET /api/vms/{templates,appliances,snapshot-schedules}`, `GET/PUT /api/vms/templates/governance`, `GET /api/vms/templates/:ref/history`, `POST /api/vms/templates/:ref/{promote,deploy}`, `GET/PUT /api/vms/templates/deployments*`

### Hosts *(requires target)*

`GET /api/hosts`, `GET /api/hosts/:ref`, `GET /api/hosts/:ref/metrics`, `PUT /api/hosts/:ref/config`, `POST /api/hosts/:ref/maintenance/{enter,exit}`, `POST /api/hosts/:ref/{reboot,shutdown}`

### Storage & Networking *(require target)*

`GET/POST /api/storage`, `POST /api/storage/{probe,import}`, `GET /api/storage/:ref`, `PUT /api/storage/:ref/config`, `GET /api/storage/:ref/vdis`, `POST /api/storage/:ref/{rescan,repair,local-cache,forget,destroy}`, `POST /api/storage/:ref/vdis`, `POST /api/storage/:ref/vdis/:vdiRef/resize`, `DELETE /api/storage/:ref/vdis/:vdiRef`
`GET /api/networks`, `GET/PUT /api/networks/interfaces*`, `POST /api/networks`, `POST /api/networks/{vlans,bonds}`, `GET /api/networks/:ref`, `PUT /api/networks/:ref/config`, `POST /api/networks/:ref/destroy`

### Pools *(requires target)*

`GET /api/pools`, `GET /api/pools/:ref`, `PUT /api/pools/:ref/config`, `POST /api/pools/:ref/ha`

### Dashboard, Tasks & Metrics *(require target)*

`GET /api/dashboard`, `GET /api/dashboard/messages`, `GET /api/tasks`, `GET /api/metrics/{cluster,capacity-baseline,rrd-updates}`, `GET /api/metrics/hosts/:ref`, `GET /api/metrics/vms/:ref`, `GET /api/metrics/storage/:ref`, `POST /api/metrics/collect`

### Alerts, Lifecycle & Resilience *(require target)*

`GET /api/alerts`, `GET/POST/PUT/DELETE /api/alerts/policies`, `PUT /api/alerts/:ref/state`, `PUT /api/alerts/bulk-state`
`GET/PUT/DELETE /api/lifecycle/plans`
`GET /api/resilience`, `GET/PUT/DELETE /api/resilience/plans`, `GET /api/resilience/drills`, `POST /api/resilience/drills/:ref`
`POST /api/tasks/remediation`, `GET/POST/PUT/DELETE /api/tasks/remediation/templates`, `PUT /api/tasks/remediation/:ref`

### Governance & Audit *(control-plane auth only)*

`GET /api/governance`, `PUT /api/governance/{policy,role}`, `PUT/DELETE /api/governance/quotas/:ref`, `POST /api/governance/approvals`, `POST /api/governance/approvals/:id/decision`, `GET /api/audit`

### Settings, Users, Groups, Credentials, Targets *(control-plane auth only)*

`GET/PUT /api/settings`, `GET /api/settings/retention/preview`, `POST /api/settings/retention/run`, `PUT /api/settings/retention/policies/:domain`, `POST /api/settings/vault/rewrap`
`GET/POST/PUT /api/users`, `POST /api/users/:id/password`, `GET/POST/PUT/DELETE /api/groups`, `GET/POST/PUT/DELETE /api/credentials`
`GET/POST/PUT/DELETE /api/connections` (saved pool targets), `GET/POST/PUT/DELETE /api/host-targets` (saved standalone-host targets), `GET/POST/PUT/DELETE /api/workspaces/inventory` (saved Inventory presets)

### Logs

`GET /api/logs` (federated audit/auth/alerts/tasks), `POST /api/logs/export` (JSON, HTML, or PDF)

## Security

- **Helmet.js** with a Content Security Policy scoped to local script assets and self-only `connect-src` — no CDN script dependency to violate CSP.
- **Rate limiting**: 20 auth attempts per 15 minutes per IP.
- **Joi validation** on all request input.
- **Session-based auth** with an `xenmange.sid` cookie and session regeneration on login.
- **Durable sessions**: SQLite-backed session store with live Xen session rehydration after process restarts.
- **Encrypted credential vault**: `vault.db` stores encrypted pool/host secrets; `security.db` stores the wrapped data-encryption keys. Plaintext secrets are never returned to the browser after creation.
- **Governed, auditable cleanup**: retention sweeps and destructive operations route through governance approvals and are logged (see [Governance & Compliance](#governance--compliance)).
- **Parameterized SQL** via `better-sqlite3` — no string-built queries.
- **HTTPS to XenServer**: all XAPI calls use TLS, with self-signed certificate support for lab/on-prem hosts.

## Configuration

Copy `.env.example` to `.env` and adjust. Note that XenServer host/credentials are **not** environment variables — they're registered as saved targets from inside the app (Pools/Hosts) and can be stored encrypted in the vault instead of plaintext.

```bash
NODE_ENV=development
PORT=3000

# Session
SESSION_SECRET=change-this-to-a-random-string
SESSION_MAX_AGE=86400000

# XenMange control-plane bootstrap user (created on first run)
XENMANGE_BOOTSTRAP_USERNAME=admin
XENMANGE_BOOTSTRAP_PASSWORD=change-this-bootstrap-password
XENMANGE_BOOTSTRAP_DISPLAY_NAME=Platform Administrator

# Database (four separate SQLite files)
DB_PATH=./data/xenmange.db
SECURITY_DB_PATH=./data/security.db
VAULT_DB_PATH=./data/vault.db
PERF_DB_PATH=./data/perf.db

# Credential Vault — a 32-byte base64 key is recommended in production.
# In development/test, XenMange derives a local fallback key from SESSION_SECRET.
# VAULT_ENCRYPTION_KEY=
# VAULT_ENCRYPTION_KEY_PREVIOUS=   # set when rotating VAULT_ENCRYPTION_KEY, then re-wrap and clear
```

## Development & Testing

| Script | Description |
|--------|--------------|
| `npm run dev` | Dev server with `nodemon`, rebuilding the client bundle on change |
| `npm run build:client` | Compile Vue templates into the CSP-safe runtime bundle in `client/dist` |
| `npm start` | Production server (expects `client/dist` already built) |
| `npm test` | Full Jest suite with coverage |
| `npm run test:unit` | Jest, `tests/unit` only |
| `npm run test:e2e` | Build the client, then run the Playwright suite |

## Feature Highlights

- **Multi-target sessions**: attach, switch, and detach multiple live pools/hosts from a single control-plane login.
- **VM lifecycle**: power controls, snapshot/checkpoint protection, fast clone / full copy, same-pool and cross-pool migration with transfer-network/SR/VIF remapping, a host-compatibility matrix, console access, and XVA/metadata import-export.
- **Host operations**: maintenance mode with evacuation-network selection and live workload draining, guarded reboot/shutdown.
- **Storage & networking**: SR create/probe/import across NFS/iSCSI/EXT/LVM with rescan/repair/local-cache/forget/destroy, VDI create/resize/delete, network/VLAN/bond creation and per-VIF configuration.
- **Governance**: role ceilings, per-pool quotas, scoped single-use approvals in front of every destructive route, local user/group administration.
- **Resilience**: derived recovery-tier/restart-priority/backup-freshness posture, operator-authored recovery runbooks, and DR drill tracking.
- **Capacity**: persisted host/VM/storage telemetry history, host skew/imbalance detection, saturation and headroom guidance.
- **Alerts**: policy-driven triage fed by XenServer messages, task failures, and persisted metric thresholds, with bulk state changes.
- **Templates**: governance metadata, version history, compare-and-promote workflow, and deployment validation.
- **Centralized Log Center**: federated, exportable (JSON/HTML/PDF) view across audit, auth, alerts, remediation, and Xen task history.
- **UI**: floating draggable windows instead of browser alerts/modals, project-owned generated background art, no external CDN script dependency.

## Created By

Matthew Puckett - Puckett Software Group LLC

![Matthews Image](client/assets/images/head_small.png)
