# XenMange

A modern, futuristic web interface for administering XenServer pools, hosts, VMs, storage, and networking, with a CSP-safe local Vue runtime, server-rendered app bootstrap, and automated UI coverage.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
The default control-plane sign-in is `admin / admin123!` unless you override the bootstrap user in `.env`.

## Architecture

```
Browser (Vue 3 SPA) ←→ Express Server (port 3000) ←→ XenServer (JSON-RPC v2.0)
                                ↕
                          SQLite (local config DB)
```

- **Frontend**: Vue 3 runtime bundle + Vue Router 4 served locally from `client/dist`
- **Backend**: Express 5, better-sqlite3, Joi validation, Helmet security
- **Session durability**: SQLite-backed Express sessions with Xen session rehydration after process restarts
- **Runtime settings**: Dedicated `/settings` workspace with live trust-proxy/session controls and retention operations
- **Central log center**: Federated Activity log view spanning audit, auth, alerts, remediation work, and Xen task history with export support
- **Performance history**: Persisted host, VM, and storage telemetry in `perf.db` with trend cards across Capacity, Host, and VM detail panes
- **Theme**: Post-modern futuristic dark glassmorphic "Matrix meets Hackers" — scanlines, neon green accents, floating windows, dense tree navigation
- **Visual Assets**: Project-owned AI-generated login and dashboard backgrounds stored in-repo
- **Bootstrap**: Express renders the SPA shell with initial session state so the client can restore authenticated sessions without an extra fetch

## Stack

| Layer | Technology |
|-------|-----------|
| SPA | Vue.js 3, Vue Router 4, local client bundle |
| Icons | Material Design Icons (@mdi/font) |
| Fonts | Share Tech Mono, Rajdhani, Exo 2 (Google Fonts) |
| Server | Express 5, helmet, cors, express-session |
| Security | CSP headers, rate limiting (20 attempts / 15 min), Joi validation |
| DB | SQLite via better-sqlite3 (connections + settings + retention policies) |
| Security DB | Separate SQLite file for durable sessions and auth-event groundwork |
| Vault DB | Separate SQLite file for encrypted credential metadata and ciphertext |
| Perf DB | Separate SQLite file for persisted performance history and trend lookups |
| API | XenServer JSON-RPC v2.0 over HTTPS |
| Reporting | `pdfkit` for centralized log PDF exports |

## Project Structure

```
XenMange/
├── server/
│   ├── index.js                  # Express server entry
│   ├── config.js                 # Environment config
│   ├── middleware/
│   │   ├── security.js           # Helmet + CSP
│   │   ├── session.js            # Express session
│   │   ├── session-store.js      # SQLite-backed session persistence
│   │   └── validate.js           # Joi schemas
│   ├── models/
│   │   └── connection.js         # SQLite connections + settings
│   │   └── perf-db.js            # Performance history database handle
│   │   └── security-db.js        # Security/session database handle + models
│   ├── routes/
│   │   ├── auth.js               # Login/logout/session
│   │   ├── dashboard.js          # Aggregate summary
│   │   ├── logs.js               # Centralized log center + export
│   │   ├── metrics.js            # Persisted telemetry history routes
│   │   ├── system-config.js      # Runtime settings + retention routes
│   │   ├── tasks.js              # Task/activity history
│   │   ├── resilience.js         # HA/DR/protection synthesis
│   │   ├── vms.js                # VM CRUD + lifecycle
│   │   ├── hosts.js              # Host list + metrics
│   │   ├── storage.js            # SR + VDI routes
│   │   ├── networks.js           # Network routes
│   │   ├── pools.js              # Pool routes
│   │   └── api.js                # Connection CRUD (SQLite)
│   ├── services/
│   │   ├── log-center.js         # Federated audit/auth/alert/task log aggregation
│   │   ├── metrics-history.js    # perf.db snapshot capture + history aggregation
│   │   ├── retention.js          # Retention scheduler + sweep engine
│   │   ├── system-config.js      # Settings facade + live runtime application
│   │   └── xenapi.js             # XenServer JSON-RPC client
│   └── views/
│       ├── app.ejs               # SSR app shell + initial bootstrap payload
│       ├── log-export.ejs        # Printable centralized log export template
│       ├── 404.ejs               # 404 error page
│       └── 500.ejs               # 500 error page
├── client/
│   ├── index.html                # Vue SPA entry
│   ├── dist/                     # Generated Vue runtime bundle + local vendor assets
│   └── assets/
│       ├── css/
│       │   ├── main.css          # Core theme variables + glassmorphic
│       │   ├── animations.css    # Scanlines, matrix, keyframes
│       │   └── components.css    # All component styles
│       ├── js/
│       │   ├── app.js            # Router/bootstrap entry (compiled into dist/app.js)
│       │   ├── core/             # Demo data, API wrapper, shared state, helpers
│       │   ├── components/
│       │   │   ├── common/       # Shared badges, trend cards, and display primitives
│       │   │   ├── controls/     # Tables and operator controls
│       │   │   ├── dialogs/      # Floating window/dialog primitives
│       │   │   ├── forms/        # Connection, settings, and operator forms
│       │   │   └── layout/       # Top nav, side nav, status bar
│       │   └── views/            # One file per route-level workspace
│       └── images/
│           ├── logo.svg
│           ├── favicon.svg
│           └── generated/
│               ├── dashboard-background.png
│               └── login-background.png
├── tests/unit/server/            # Jest unit tests
├── data/                         # SQLite database (auto-created)
├── .env.example                  # Environment template
├── plan.md                       # Development plan
├── PROJECT.md                    # Project requirements
└── package.json
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build:client` | Compile Vue templates into CSP-safe runtime JS and refresh local vendor assets |
| `npm run dev` | Start dev server with nodemon |
| `npm start` | Production server |
| `npm test` | Run Jest unit tests |
| `npm run lint` | ESLint |

## API Endpoints

All `/api/*` routes require a valid session cookie except the sign-in endpoints.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Sign into the XenMange control plane (`{username, password}`) |
| POST | `/api/auth/xen-login` | Attach a live Xen target to the current session or create a legacy direct Xen session (`{host, username, password}`) |
| POST | `/api/auth/logout` | Disconnect and destroy session |
| GET | `/api/auth/status` | Current control-plane and Xen-target session status |

### Resources (all require auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Aggregate pool/host/VM/summary |
| GET | `/api/dashboard/messages` | Recent XenServer message/event stream |
| GET | `/api/tasks` | Recent XenServer task/activity history |
| GET | `/api/logs` | Federated centralized logs across audit/auth/alerts/tasks |
| GET | `/api/metrics/cluster` | Persisted cluster telemetry history for the selected range |
| GET | `/api/metrics/hosts/:ref` | Persisted host telemetry history |
| GET | `/api/metrics/vms/:ref` | Persisted VM telemetry history |
| GET | `/api/metrics/storage/:ref` | Persisted storage telemetry history |
| GET | `/api/resilience` | Derived HA/DR, protection, and recovery overview |
| GET | `/api/vms` | All VMs with records |
| GET | `/api/vms/templates` | Template inventory |
| GET | `/api/hosts` | All hosts with records |
| GET | `/api/hosts/:ref/metrics` | Live host metrics record |
| GET | `/api/storage` | All SRs with records |
| GET | `/api/networks` | All networks with records |
| GET | `/api/pools` | All pools with records |
| GET | `/api/settings` | Runtime configuration + retention policy state |
| GET | `/api/credentials` | List visible vault credentials (metadata only) |
| GET | `/api/settings/retention/preview` | Dry-run retention preview |
| POST | `/api/credentials` | Save an encrypted pool/host credential in `vault.db` |
| POST | `/api/settings/retention/run` | Run manual retention sweep |
| PUT | `/api/credentials/:id` | Update credential metadata and optionally rotate the secret |
| DELETE | `/api/credentials/:id` | Remove a vault credential |
| POST | `/api/logs/export` | Export filtered or selected log entries as JSON, HTML, or PDF |
| POST | `/api/metrics/collect` | Force a fresh telemetry snapshot into `perf.db` |
| POST | `/api/vms/start` | Start VM (`{ref, paused?, force?}`) |
| POST | `/api/vms/shutdown` | Shutdown VM (`{ref, force?}`) |
| POST | `/api/vms/reboot` | Reboot VM (`{ref, force?}`) |
| POST | `/api/vms/suspend` | Suspend VM (`{ref}`) |
| POST | `/api/vms/resume` | Resume VM (`{ref, paused?}`) |

### Connections (SQLite — local only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/connections` | List saved connections |
| POST | `/api/connections` | Save connection |
| DELETE | `/api/connections/:id` | Remove connection |
| POST | `/api/connections/:id/default` | Set as default |

## Security

- **Helmet.js** with Content Security Policy using local script assets and self-only `connect-src`
- **Rate limiting**: 20 auth attempts per 15 minutes per IP
- **Joi validation** on all input
- **Session-based auth** with `xenmange.sid` cookie and session regeneration on login
- **Durable sessions** with a SQLite-backed session store and Xen session ref rehydration after process restarts
- **Governed cleanup** with auditable retention previews/runs across audit history, remediation tasks, and auth events
- **SQLite** parameterized queries (no SQL injection)
- **HTTPS**: All XenServer API calls use TLS with self-signed cert support

## Configuration

Copy `.env.example` to `.env` and adjust:

```bash
XEN_HOST=192.168.1.100      # XenServer host IP
XEN_USER=root               # Default username
XEN_PASS=                   # Default password (optional)
SESSION_SECRET=change-me    # Session signing secret
XENMANGE_BOOTSTRAP_USERNAME=admin
XENMANGE_BOOTSTRAP_PASSWORD=admin123!
XENMANGE_BOOTSTRAP_DISPLAY_NAME="Platform Administrator"
NODE_ENV=development
PORT=3000
DB_PATH=./data/xenmange.db
SECURITY_DB_PATH=./data/security.db
VAULT_DB_PATH=./data/vault.db
PERF_DB_PATH=./data/perf.db
VAULT_ENCRYPTION_KEY=        # Recommended in production (32-byte base64)
VAULT_ENCRYPTION_KEY_PREVIOUS=
```

## Current Highlights

- Local vendor bundling removes the browser CSP violations from CDN source maps and runtime template compilation.
- The app shell is server-rendered with initial auth bootstrap data, reducing startup round-trips and improving session restore behavior.
- As of Monday, August 24, 2026, XenMange now has a first-party control-plane login backed by `security.db`, seeded with a bootstrap administrator and split from the live Xen-target attach flow.
- As of Monday, August 24, 2026, Express sessions persist in `security.db`, and protected routes can rehydrate a live `XenAPI` client from the saved Xen session ref after a process restart instead of dropping every authenticated Xen session on boot.
- As of Monday, August 24, 2026, a first server-side credential vault foundation now exists: `vault.db` stores encrypted pool/host secrets, `security.db` stores wrapped DEKs, and authenticated local XenMange users can CRUD private or shared credential metadata without those plaintext passwords ever being returned to the browser.
- As of Monday, August 24, 2026, the Pools workspace can attach a saved Xen target directly from an already-authenticated control-plane session, giving the local-first login path a complete operator workflow without bouncing back through the login route.
- As of Monday, August 24, 2026, a dedicated Settings workspace now manages app identity, timezone, public URL/proxy behavior, session timeout, logging posture, retention scheduler options, and per-domain retention policies with audit coverage and manual preview/run controls.
- As of Monday, August 24, 2026, the Activity workspace now includes a centralized Log Center that federates audit history, auth events, alert records, remediation tasks, and Xen background tasks into one searchable table with JSON, HTML, and PDF export paths.
- As of Monday, August 24, 2026, `perf.db` now captures persisted host-memory, VM-memory, and SR-utilization history, and the Capacity, Host, and VM workspaces now surface those trends through local metric cards instead of relying only on one-off live snapshots.
- The login and authenticated shell now use project-owned AI-generated background art instead of external visual dependencies.
- The dashboard supports draggable summary cards with persisted order in `localStorage`, plus alert triage and direct action rails into templates, alerts, activity history, and the new capacity workspace.
- Pools, hosts, storage, networking, and VM detail views now open in custom floating windows instead of browser alerts.
- A dedicated inventory workbench now exposes universal search across live infrastructure objects, saved connection targets, top tags, and browser-local workspace presets for repeatable operator navigation.
- Template inventory and alerts history are now exposed as dedicated routes for repeatable provisioning and operator triage workflows.
- A dedicated activity workbench now exposes recent XenServer task history, searchable federated log records, exportable audit/log detail, progress, completion states, and error details.
- A dedicated lifecycle workbench now exposes maintenance posture, lifecycle-oriented task tracking, heuristic compliance/drift signals, and remediation guidance inspired by vCenter and SCVMM.
- A dedicated capacity workbench now exposes live host memory pressure, storage commitment, active maintenance tasks, and operator guidance for rebalance/expansion decisions.
- The Capacity workspace, Host properties, and VM details now also expose persisted telemetry trends for the current time window via the new `/api/metrics/*` history routes.
- A dedicated resilience workbench now exposes derived protection coverage, failover readiness, evacuation targets, recovery-plan guidance, and recent resilience events.
- Host property windows now pull live metric records so operators can inspect memory state without leaving the app.
- The login surface can reuse locally saved connection targets from the SQLite-backed connection store, and the Pools workspace can now attach those saved targets in-place after a control-plane sign-in.
- Jest coverage now includes 149 passing tests, and Playwright E2E coverage includes 7 passing browser flows spanning control-plane sign-in, target attachment, dashboard hydration, VM lifecycle actions, and the inventory/activity/settings workbenches with mocked API responses.
