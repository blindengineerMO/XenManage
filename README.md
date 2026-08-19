# XenMange

A modern, futuristic web interface for administering XenServer pools, hosts, VMs, storage, and networking, with a CSP-safe local Vue runtime, server-rendered app bootstrap, and automated UI coverage.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
Browser (Vue 3 SPA) ←→ Express Server (port 3000) ←→ XenServer (JSON-RPC v2.0)
                                ↕
                          SQLite (local config DB)
```

- **Frontend**: Vue 3 runtime bundle + Vue Router 4 served locally from `client/dist`
- **Backend**: Express 5, better-sqlite3, Joi validation, Helmet security
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
| DB | SQLite via better-sqlite3 (connections + settings) |
| API | XenServer JSON-RPC v2.0 over HTTPS |

## Project Structure

```
XenMange/
├── server/
│   ├── index.js                  # Express server entry
│   ├── config.js                 # Environment config
│   ├── middleware/
│   │   ├── security.js           # Helmet + CSP
│   │   ├── session.js            # Express session
│   │   └── validate.js           # Joi schemas
│   ├── models/
│   │   └── connection.js         # SQLite connections + settings
│   ├── routes/
│   │   ├── auth.js               # Login/logout/session
│   │   ├── dashboard.js          # Aggregate summary
│   │   ├── tasks.js              # Task/activity history
│   │   ├── resilience.js         # HA/DR/protection synthesis
│   │   ├── vms.js                # VM CRUD + lifecycle
│   │   ├── hosts.js              # Host list + metrics
│   │   ├── storage.js            # SR + VDI routes
│   │   ├── networks.js           # Network routes
│   │   ├── pools.js              # Pool routes
│   │   └── api.js                # Connection CRUD (SQLite)
│   ├── services/
│   │   └── xenapi.js             # XenServer JSON-RPC client
│   └── views/
│       ├── app.ejs               # SSR app shell + initial bootstrap payload
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
│       │   │   ├── common/       # Shared badges and display primitives
│       │   │   ├── controls/     # Tables and operator controls
│       │   │   ├── dialogs/      # Floating window/dialog primitives
│       │   │   ├── forms/        # Connection and future operator forms
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

All `/api/*` routes (except `/api/auth/login`) require a valid session cookie.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Connect to XenServer (`{host, username, password}`) |
| POST | `/api/auth/logout` | Disconnect and destroy session |
| GET | `/api/auth/status` | Current connection status |

### Resources (all require auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Aggregate pool/host/VM/summary |
| GET | `/api/dashboard/messages` | Recent XenServer message/event stream |
| GET | `/api/tasks` | Recent XenServer task/activity history |
| GET | `/api/resilience` | Derived HA/DR, protection, and recovery overview |
| GET | `/api/vms` | All VMs with records |
| GET | `/api/vms/templates` | Template inventory |
| GET | `/api/hosts` | All hosts with records |
| GET | `/api/hosts/:ref/metrics` | Live host metrics record |
| GET | `/api/storage` | All SRs with records |
| GET | `/api/networks` | All networks with records |
| GET | `/api/pools` | All pools with records |
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
- **SQLite** parameterized queries (no SQL injection)
- **HTTPS**: All XenServer API calls use TLS with self-signed cert support

## Configuration

Copy `.env.example` to `.env` and adjust:

```bash
XEN_HOST=192.168.1.100      # XenServer host IP
XEN_USER=root               # Default username
XEN_PASS=                   # Default password (optional)
SESSION_SECRET=change-me    # Session signing secret
NODE_ENV=development
PORT=3000
DB_PATH=./data/xenmange.db
```

## Current Highlights

- Local vendor bundling removes the browser CSP violations from CDN source maps and runtime template compilation.
- The app shell is server-rendered with initial auth bootstrap data, reducing startup round-trips and improving session restore behavior.
- The login and authenticated shell now use project-owned AI-generated background art instead of external visual dependencies.
- The dashboard supports draggable summary cards with persisted order in `localStorage`, plus alert triage and direct action rails into templates, alerts, activity history, and the new capacity workspace.
- Pools, hosts, storage, networking, and VM detail views now open in custom floating windows instead of browser alerts.
- Template inventory and alerts history are now exposed as dedicated routes for repeatable provisioning and operator triage workflows.
- A dedicated activity workbench now exposes recent XenServer task history, progress, completion states, and error details.
- A dedicated lifecycle workbench now exposes maintenance posture, lifecycle-oriented task tracking, heuristic compliance/drift signals, and remediation guidance inspired by vCenter and SCVMM.
- A dedicated capacity workbench now exposes live host memory pressure, storage commitment, active maintenance tasks, and operator guidance for rebalance/expansion decisions.
- A dedicated resilience workbench now exposes derived protection coverage, failover readiness, evacuation targets, recovery-plan guidance, and recent resilience events.
- Host property windows now pull live metric records so operators can inspect memory state without leaving the app.
- The login surface can reuse locally saved connection targets from the SQLite-backed connection store, with dedupe/default support on the backend.
- Playwright E2E coverage now exercises login rendering, dashboard hydration, VM lifecycle actions, and the templates/alerts/activity/lifecycle/capacity/resilience workbenches with mocked API responses.
