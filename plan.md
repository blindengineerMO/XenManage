# XenMange - Development Plan

## Project Overview
A modern, futuristic web interface for administering XenServer pools, hosts, VMs, storage, and networking. API-first architecture with Vue.js frontend served via Express on port 3000.

---

## Research Summary

### XenServer Management API
- **Wire Protocol**: JSON-RPC v2.0 (preferred) and XML-RPC, over HTTPS on port 443
- **Endpoint**: `https://<xenserver-host>/jsonrpc`
- **Authentication**: `session.login_with_password(uname, pwd, version, originator)` returns an opaque `session ref`
- **All calls**: First param is always the session ref (opaque string `OpaqueRef:...`)
- **Key classes** (for our UI): pool, host, VM, SR, VDI, VBD, network, VIF, PIF, Bond, VLAN, task, event
- **VM lifecycle**: halted -> running (start), running -> halted (clean shutdown/hard shutdown), suspended, paused
- **Metrics**: RRDs available via HTTP (`/host_rrd`, `/vm_rrd`, `/rrd_updates`) in JSON format
- **Async operations**: All methods have async counterparts in `Async.*` namespace returning task refs
- **Records**: `get_all_records()` returns all objects of a class in one call (efficient for dashboard)

### Tech Stack Decisions
- **Server**: Node.js + Express, JSON-RPC v2.0 client to XenServer
- **Database**: SQLite3 via `better-sqlite3` for local config/connection storage
- **Frontend**: Vue.js 3 (SPA served by Express), Tailwind CSS, Chart.js
- **Icons**: Material Design Icons (`@mdi/font`)
- **Fonts**: Google Fonts - "Share Tech Mono" (monospace/terminal feel) + "Rajdhani" (futuristic headers)
- **Security**: Helmet.js, CSP headers, input validation with `joi`

---

## Architecture

```
Port 3000 (Express)
├── /api/*          → REST API routes (proxies to XenServer JSON-RPC)
├── /assets/*       → Static assets (CSS, images, fonts)
├── /               → Vue.js SPA (index.html)
└── /views/*.html   → SSR templates (EJS for error pages)
```

### Server-Side Rendering
- Error pages (404, 500) rendered server-side via EJS
- App shell rendered server-side via EJS with bootstrap session/auth payload
- Vue SPA handles all client-side routing after initial shell delivery

---

## Directory Structure

```
XenMange/
├── package.json
├── PROJECT.md
├── plan.md
├── README.md
├── .env.example
├── .gitignore
├── server/
│   ├── index.js                    # Express entry point
│   ├── config.js                   # Server configuration
│   ├── middleware/
│   │   ├── security.js             # Helmet + CSP
│   │   ├── session.js              # Session management
│   │   └── validate.js             # Request validation
│   ├── services/
│   │   ├── xenapi.js               # XenServer JSON-RPC client
│   │   ├── pool.js                 # Pool operations
│   │   ├── vm.js                   # VM lifecycle operations
│   │   ├── host.js                 # Host operations
│   │   ├── storage.js              # SR/VDI operations
│   │   ├── network.js              # Network/VIF/PIF operations
│   │   └── metrics.js              # RRD metrics fetching
│   ├── routes/
│   │   ├── api.js                  # API router mount
│   │   ├── auth.js                 # Login/logout/session routes
│   │   ├── pools.js                # Pool CRUD
│   │   ├── vms.js                  # VM operations
│   │   ├── hosts.js                # Host operations
│   │   ├── storage.js              # SR/VDI operations
│   │   ├── networks.js             # Network operations
│   │   └── dashboard.js            # Dashboard aggregate data
│   ├── models/
│   │   ├── connection.js           # SQLite connection store
│   │   └── settings.js             # App settings
│   └── views/
│       ├── 404.ejs
│       └── 500.ejs
├── client/
│   ├── index.html                  # Vue SPA entry
│   ├── app.js                      # Vue router/bootstrap entry
│   ├── core/                       # Demo data, API wrapper, shared state, helpers
│   ├── assets/
│   │   ├── css/
│   │   │   ├── main.css            # Global styles + glassmorphic theme
│   │   │   ├── components.css      # Component-specific styles
│   │   │   └── animations.css      # Matrix/scan-line effects
│   │   ├── fonts/                  # Self-hosted if needed
│   │   └── images/
│   │       ├── logo.svg
│   │       └── favicon.ico
│   ├── components/
│   │   ├── common/
│   │   │   └── StatusBadge.js      # Colored status indicator
│   │   ├── controls/
│   │   │   └── DataTable.js        # Search/sort/filter/pagination table
│   │   ├── dialogs/
│   │   │   └── FloatingWindow.js   # Draggable/resizable dialog system
│   │   ├── forms/
│   │   │   └── ConnectionLoginForm.js # Login/connection form
│   │   └── layout/
│   │       ├── TopNav.js           # Floating top navigation bar
│   │       ├── SideNav.js          # Floating collapsible tree nav
│   │       └── StatusBar.js        # Bottom status bar (connection info)
│   └── views/
│       ├── DashboardView.js        # Main dashboard
│       ├── LoginView.js            # Connection screen
│       ├── VMsView.js              # VM list + operations
│       ├── HostsView.js            # Host list + operations
│       ├── StorageView.js          # SR list + VDI browsing
│       ├── NetworkingView.js       # Network topology
│       ├── TemplatesView.js        # Template inventory
│       ├── AlertsView.js           # Alert triage workbench
│       ├── ActivityView.js         # Task history workbench
│       ├── LifecycleView.js        # Lifecycle/compliance workbench
│       ├── CapacityView.js         # Capacity/performance workbench
│       └── ResilienceView.js       # HA/DR/protection workbench
└── tests/
    ├── unit/
    │   ├── server/
    │   │   ├── xenapi.test.js
    │   │   ├── routes/
    │   │   │   ├── auth.test.js
    │   │   │   ├── vms.test.js
    │   │   │   └── dashboard.test.js
    │   │   └── middleware/
    │   │       └── validate.test.js
    │   └── client/
    │       └── components/
    │           ├── DataTable.test.js
    │           └── FloatingWindow.test.js
    └── e2e/
        ├── dashboard.spec.js
        ├── login.spec.js
        └── vm-operations.spec.js
```

---

## Implementation Phases

### Phase 1: Foundation (Priority: HIGH)
1. Initialize npm project with all dependencies
2. Create Express server with security middleware (Helmet, CORS, CSP)
3. Create XenServer JSON-RPC client service (`xenapi.js`)
4. Create SQLite database for connection storage
5. Create EJS error page templates
6. Set up Vue.js SPA with Tailwind CSS, MDI icons, Google Fonts
7. Create main layout shell (AppShell, TopNav, SideNav, StatusBar)

### Phase 2: XenServer API Integration (Priority: HIGH)
1. Auth routes: login/logout with session management
2. Pool routes: get all pools, get pool record
3. Host routes: list hosts, host metrics, host operations (enable/disable)
4. VM routes: list VMs, VM lifecycle (start/stop/reboot/suspend), VM record
5. Storage routes: list SRs, list VDIs per SR
6. Network routes: list networks, VIFs, PIFs
7. Dashboard route: aggregate summary data (counts, states, alerts)
8. Metrics route: proxy RRD updates from XenServer

### Phase 3: UI Core (Priority: HIGH)
1. Login/connection screen with floating window
2. SideNav tree view (Pools -> Hosts -> VMs, Storage, Networks)
3. TopNav with connection toggle, breadcrumbs, status
4. DataTable component with search, sort, filter, pagination
5. FloatingWindow component (draggable, resizable, z-index stacking)
6. GlassCard, GlowButton, StatusBadge base components

### Phase 4: Dashboard (Priority: MEDIUM)
1. Gridstack.js integration for drag-drop dashboard grid
2. Resource summary cards (VM/Host/SR/Network counts with radial gauges)
3. Host health overview (CPU, memory, network per host)
4. VM state distribution chart (pie/donut)
5. Storage capacity bars
6. Active alerts/messages panel

### Phase 5: Resource Views (Priority: MEDIUM)
1. VMs view: DataTable with power state, resource usage, quick actions
2. Hosts view: DataTable with status, CPU/memory, VM count
3. Storage view: SR list with capacity, VDI sub-table
4. Networking view: Network list with VIF/PIF associations
5. Properties dialogs: Floating windows for VM/Host/SR details

### Phase 6: Polish & Testing (Priority: MEDIUM)
1. Unit tests (Jest) for server routes, services, middleware
2. Unit tests for Vue components
3. E2E tests (Playwright) for login, dashboard, VM operations
4. Custom 404/500 error pages with glassmorphic styling
5. Logo/favicon generation (SVG)
6. README documentation
7. Responsive design pass

---

## Competitive Benchmarking (Updated August 19, 2026)

### VMware vCenter / vSphere
- Official positioning centers on `vCenter Server` as the administrator for multiple `ESXi` hosts, resource pooling, infrastructure monitoring, and extensibility via plug-ins.
- The vSphere Lifecycle Manager (`vLCM`) roadmap is especially relevant: declarative desired-state cluster images, firmware and driver remediation, vendor add-ons, compatibility checks, and image-based compliance.
- Product implication for XenMange:
  Build cluster-wide lifecycle compliance, maintenance planning, and remediation workflows instead of stopping at inventory-only host views.

### Microsoft SCVMM
- Official VMM guidance emphasizes single-fabric management across compute, networking, and storage, plus library resources, VM templates, service templates, and private-cloud style scoping.
- Current Microsoft documentation also highlights update remediation baselines, Dynamic Optimization / Power Optimization, Azure Arc-backed self-service, and role-scoped permissions with quotas.
- Product implication for XenMange:
  We should treat templates, quotas, remediation, and scoped access as first-class management primitives rather than optional polish.

### Nutanix Prism Central
- Nutanix positions Prism as a multi-cluster control plane with proactive health monitoring, intelligent alerts, lifecycle management, templates/images, integrated protection plans, and fine-grained RBAC.
- Prism Central 7.5 adds notable UX patterns worth emulating: health checks launched directly from alerts, resource-consumption dashboards, IAM lifecycle controls, and stronger activity/navigation consolidation.
- Product implication for XenMange:
  Alerts should become actionable, telemetry should support capacity planning, and navigation should unify operational workflows instead of scattering them.

### Proxmox VE
- Proxmox emphasizes a single web UI for virtualization, clustering, HA, storage, networking, authentication, firewalling, backup, and disaster recovery.
- HA manager documentation reinforces the value of visible failover states, resource policies, migration vs relocate choices, and operator-readable cluster behavior.
- Product implication for XenMange:
  HA/DR, failover visibility, and backup state should be surfaced as management domains, not hidden behind raw API data.

### Official Sources Used
- Broadcom vSphere concepts: `https://techdocs.broadcom.com/us/en/vmware-cis/vsphere/vsphere/8-0/vcenter-and-host-management/vsphere-concepts-and-features-host-management.html`
- VMware vLCM overview: `https://www.vmware.com/docs/introducing-vsphere-lifecycle-management-vlcm`
- Microsoft VMM overview: `https://learn.microsoft.com/en-us/system-center/vmm/overview?view=sc-vmm-2025`
- Microsoft VMM updates: `https://learn.microsoft.com/en-us/system-center/vmm/whats-new-in-vmm?view=sc-vmm-2025`
- Microsoft VM templates: `https://learn.microsoft.com/en-us/system-center/vmm/library-vm-templates?view=sc-vmm-2025`
- Microsoft dynamic/power optimization: `https://learn.microsoft.com/en-us/system-center/vmm/vm-optimization?view=sc-vmm-2025#dynamic-optimization`
- Microsoft user roles: `https://learn.microsoft.com/en-us/system-center/vmm/account-user-role?view=sc-vmm-2025`
- Microsoft host remediation: `https://learn.microsoft.com/en-us/system-center/vmm/hyper-v-update?view=sc-vmm-2025`
- Nutanix Prism: `https://www.nutanix.com/products/prism`
- Nutanix Prism Central 7.5: `https://www.nutanix.com/blog/what-is-new-in-nutanix-prism-7-5`
- Proxmox VE features: `https://www.proxmox.com/en/products/proxmox-virtual-environment/features`
- Proxmox HA manager: `https://pve.proxmox.com/pve-docs-8/chapter-ha-manager.html`

---

## Enhancement Roadmap From Research

### 1. Alerts & Health Operations Center
- Status: Partially shipped
- Shipped in app:
  Dashboard alert triage summary, severity-aware recent alerts, and a dedicated `/alerts` view with searchable event history.
  API-backed alert state persistence now supports acknowledgement, suppression windows, severity overrides, operator notes, health-action tagging, and related-view jump-offs from the alert detail workspace.
  As of Saturday, August 22, 2026, the alerts workspace now supports bulk triage across selected alerts, persisted alert suppression policies, policy-aware queue context, workflow-oriented health actions, and clearer follow-through routing into lifecycle, capacity, resilience, and governance workbenches.
  As of Saturday, August 22, 2026, alert detail actions now deep-link into exact host, storage, VM, pool, network, task, and alert records where the current client workspaces can resolve them, rather than only dropping operators into adjacent top-level sections.
  As of Saturday, August 22, 2026, storage-targeted alert routing now lands in a richer storage detail pane that maps each surfaced VDI to its attached workloads and resident hosts, with direct follow-through into the affected VM workspace.
  As of Saturday, August 22, 2026, persisted alert policies now support more expressive matching criteria including target workspace scoping, object/UUID-aware matching, and phrase-versus-all-terms text matching so operators can shape queue behavior more precisely than class-plus-severity alone.
  As of Saturday, August 22, 2026, alert detail actions can also create persisted remediation tasks that carry assignee, due-date, related-alert, related-object, and target-workspace context into the shared Activity queue instead of relying on ad hoc operator memory.
  As of Saturday, August 22, 2026, those remediation tasks can also be progressed and closed from the Activity workspace with status changes, operator outcome notes, due-date updates, and audit-trail coverage instead of remaining write-only queue entries.
  As of Saturday, August 22, 2026, the alerts workspace also supports persisted remediation templates with matching criteria, reusable task-name/default-note patterns, default assignees, due-day offsets, and one-click application from matching alert detail records.
  As of Sunday, August 23, 2026, remediation templates also carry launch behavior and recurrence guards so operators can queue standardized follow-through directly from matching alerts without flooding Activity with duplicate daily or scope-equivalent tasks.
  As of Sunday, August 23, 2026, remediation templates can also pre-stage a downstream workbench brief, evidence checklist, and completion criteria that persist onto the follow-through task and surface inside the Lifecycle, Capacity, and Resilience operator queues instead of living only in free-form notes.
  As of Sunday, August 23, 2026, remediation templates can also seed downstream lifecycle-plan and recovery-runbook drafts, with seeded context carried onto the remediation task and launched from Activity into the target workbench instead of forcing operators to re-enter the same intent twice.
  As of Sunday, August 23, 2026, those seeded lifecycle and resilience drafts now resolve through broader inventory relationships including VM placement, SR attachment, pool membership, and network uplinks, and the resilience runbook editor now consumes the correct network record list instead of the raw API envelope.
- Next:
  Deeper VDI, VBD, VIF, and other sub-object resolution beyond the refs currently surfaced in the client, plus more automated execution handoff from seeded drafts into concrete operator runbooks and lifecycle remediation actions once the plan is approved.
- Why it matters:
  Nutanix and enterprise control planes treat alerts as the operator entry point, not just a passive event list.

### 2. Template & Library Governance
- Status: Partially shipped
- Shipped in app:
  New `/templates` inventory view backed by Xen template records and surfaced in the nav/dashboard.
  Guided deploy-from-template workflow with host, storage, and network placement defaults plus governance-derived profile and lifecycle badges.
  Persisted template governance now supports version labels, golden-image baselines, catalog ownership, guest customization profiles, validation posture, and operator notes beyond raw template tags.
  Template deployments now create validation-aware audit records, and the UI supports post-deploy checklist tracking for boot, network, storage, and policy-tag verification.
  As of Monday, August 24, 2026, template governance also now persists a per-template change history, exposes staged-and-validated promotion candidates in the Templates workspace, and supports compare-and-promote workflows that can retire an older stable baseline while promoting a newer validated generation.
- Next:
  True storage-placement orchestration against deeper Xen template copy semantics, richer guest-customization execution against live Xen guest tooling, and deeper template-library authoring/version-management beyond the current governance history and promotion workflow.
- Why it matters:
  SCVMM explicitly treats library resources and templates as repeatability infrastructure.

### 3. Host Lifecycle / Compliance Management
- Status: Partially shipped
- Shipped in app:
  A new `/lifecycle` workbench now derives lifecycle posture from hosts, lifecycle-oriented tasks, and related alerts to surface maintenance windows, baseline hints, drift review queues, and remediation guidance.
  API-backed lifecycle plan persistence now supports per-host desired-state planning, maintenance-stage tracking, reboot and evacuation flags, owner and patch-wave assignment, and richer lifecycle detail/readiness views.
  As of Sunday, August 23, 2026, lifecycle planning can also be launched directly from seeded remediation tasks in Activity, carrying template-derived defaults and source-task provenance into the planner while resolving host context from direct refs, UUIDs, and host-name matches.
  As of Sunday, August 23, 2026, lifecycle draft routing now also infers host context from related VMs, storage repositories, pool membership, and network uplinks instead of relying only on direct host identifiers.
- Required capabilities:
  Host patch baseline visibility from deeper Xen data, true maintenance mode orchestration against live hosts, staged remediation execution, richer cluster-wide drift reporting, and broader desired-state policy controls beyond per-host planning.
- Inspiration:
  VMware `vLCM` image compliance plus Microsoft baseline remediation flows.

### 4. Capacity & Performance Analytics
- Status: Partially shipped
- Shipped in app:
  Host property windows now fetch live host metrics, and a dedicated `/capacity` workspace now consolidates host memory pressure, storage commitment, active background tasks, operator guidance, top VM consumers, placement-imbalance analysis, noisy-neighbor detection, and inferred forecast thresholds into a single operational surface.
  The dashboard now surfaces a shared capacity-watch panel plus hotspot summaries so headroom drift is visible before operators drill into the dedicated workspace.
  As of Sunday, August 23, 2026, the capacity workbench also surfaces remediation-task SLA labels and queue-age badges inside staged automation items so capacity follow-through urgency is visible without bouncing back to Activity first.
- Next:
  Pooled CPU/memory/storage trend cards backed by RRD or equivalent historical telemetry, true history-aware forecasts, and deeper host-to-VM consumption baselines rather than current-state inference alone.
- Inspiration:
  Nutanix resource-consumption dashboards and Prism health telemetry.

### 5. Governance, RBAC, and Self-Service
- Status: Partially shipped
- Shipped in app:
  A new `/governance` workspace now provides session role switching, persisted governance policy editing, pool quota management, and approval-queue review in a dedicated operator surface.
  Session state now carries read-only, operator, and admin role modes, and destructive VM actions can require explicit approved tokens before execution when policy gating is enabled.
  Pool quotas now persist server-side, feed governance posture summaries, and block template deployments that would exceed the configured VM-count, running-VM, or aggregate-memory envelope.
  Governance actions now flow into the shared audit trail, and the browser regression suite covers policy edits, role changes, quota updates, approval requests, and approval decisions.
  As of Monday, August 24, 2026, the governance stack also now includes persisted local user administration backed by `security.db`, with `/api/users` CRUD/password-rotation endpoints, active/disabled account posture, last-admin safety checks, and session-role switching capped by each local account’s stored role instead of allowing ad hoc privilege escalation.
- Required capabilities:
  Group membership management, per-user ownership/visibility for saved targets and workspaces, true multi-target live connection concurrency, broader destructive-action approval coverage across more infrastructure domains, finer-grained per-domain permissions beyond the current global roles, identity-provider integration, and scoped self-service experiences for future tenant or delegated-operator models.
- Inspiration:
  SCVMM user roles and Arc-backed self-service; Prism fine-grained RBAC.

### 6. HA / DR / Backup Visibility
- Status: Partially shipped
- Shipped in app:
  A new `/resilience` workbench now surfaces protection-policy inventory, backup/recovery event visibility, host evacuation targets, and pool-level recovery plan guidance derived from live Xen inventory, tasks, and alerts.
  As of Friday, August 21, 2026, the resilience workspace now also persists pool-level recovery runbooks, exposes explicit HA policy and restart-priority intent, derives backup age and restore-point drift against runbook targets, and logs recovery drills with audit-trail coverage.
  As of Sunday, August 23, 2026, resilience runbooks can also be drafted directly from seeded remediation tasks in Activity, carrying template-derived defaults and source-task provenance while resolving recovery-plan context from direct pool matches or related host membership.
  As of Sunday, August 23, 2026, resilience draft routing now also resolves recovery-plan context from VM placement, SR attachment, and network-to-pool relationships, while fixing network option hydration in the runbook editor itself.
- Required capabilities:
  Deeper live Xen-backed HA policy orchestration, richer restore-point truth from backup platform integrations instead of inference alone, recovery-plan execution automation, and broader failover drill analytics across more infrastructure domains.
- Inspiration:
  Proxmox HA manager and Nutanix integrated protection plans.

### 7. Activity, Tasks, and Audit Trail
- Status: Partially shipped
- Shipped in app:
  New task API route, dashboard recent-task visibility, and a dedicated `/activity` workbench with status, progress, timestamps, and error detail inspection.
  A new persisted audit log now tracks operator actions across alerts, lifecycle planning, template governance, template deployment validation, VM operations, saved pool targets, host targets, and session events.
  The `/activity` workspace now supports recent-change drill-downs, operator identity visibility, before/after state summaries, and exportable audit-log JSON alongside raw Xen task history.
  As of Saturday, August 22, 2026, audit detail records can now jump directly into the affected VM, host, pool, storage, network, alert, task, and template workspaces instead of only exposing the originating workflow context.
  As of Saturday, August 22, 2026, the task history feed now merges persisted remediation follow-through work with Xen background tasks, and remediation task detail panels expose source-alert context plus direct jump-offs back into the originating alert or target workspace.
  As of Saturday, August 22, 2026, remediation task detail panels also support in-place task management for status transitions, assignee changes, due-date updates, and operator closure notes with shared audit visibility.
  As of Sunday, August 23, 2026, remediation task detail panels can also launch seeded lifecycle-plan and recovery-runbook drafting flows directly into their target workbenches without losing task, template, or source-alert context.
  As of Sunday, August 23, 2026, the Activity task view also adds remediation-task SLA and queue-aging semantics including overdue, due-soon, and aging-without-due-date labeling in both the task table and task detail workspace instead of treating due dates as passive metadata.
- Required capabilities:
  Deeper long-running async progress correlation, richer per-action result semantics from Xen task objects, and broader audit coverage for additional infrastructure domains such as resilience runbooks and future RBAC/governance actions.
- Inspiration:
  Prism activity consolidation and the broader enterprise console expectation for operational traceability.

### 8. Global Inventory & Multi-Cluster Navigation
- Status: Partially shipped
- Shipped in app:
  A new `/inventory` workbench now provides universal search across live pools/templates/VMs/hosts/storage/networks/alerts/tasks, exposes saved connection targets from SQLite, and supports saved operator workspaces via local presets.
  Inventory result drill-downs now carry exact record focus into the downstream host, VM, pool, storage, network, alert, task, and template workspaces when those views support direct record resolution.
  As of Saturday, August 22, 2026, the inventory index now also includes VDI, VBD, VIF, and PIF subobjects so operators can search and open exact storage attachments and network interfaces instead of stopping at top-level SR and bridge records.
  As of Sunday, August 23, 2026, inventory workspaces now persist through the server with audit coverage instead of living only in browser-local storage, and those saved workspaces can optionally bind to a saved connection target for more deliberate connection switching from the connection atlas and login flow.
- Required capabilities:
  True multi-connection live federation and cross-cluster health rollups, plus deeper connection-context switching that can actually retain and compare concurrent live sessions instead of only handing off through saved targets.
- Inspiration:
  Prism multi-cluster management and vCenter-style central administration.

### 9. Network Fabric Relationship Visibility
- Status: Partially shipped
- Shipped in app:
  As of Saturday, August 22, 2026, the `/networking` workspace now expands each network into a relationship pane that shows mapped host uplinks, attached VM interfaces, bridge metadata, and focus-aware highlighting when operators arrive on a specific network, `PIF`, or `VIF` path by reference.
  As of Saturday, August 22, 2026, focused `PIF` and `VIF` arrivals from Inventory can now jump directly onward into the mapped host or VM workspace from the relationship pane instead of leaving the operator at the bridge-only view.
- Required capabilities:
  Live Xen-backed per-interface telemetry, bond/VLAN topology modeling, IP/MAC-level interface truth, and broader UUID-aware interface resolution instead of ref-based correlation alone.
- Inspiration:
  Enterprise fabric views in vCenter, SCVMM, Prism, and similar control planes where operators need to see the bridge plus every host and workload attached to it.

### 10. Storage Attachment Topology
- Status: Partially shipped
- Shipped in app:
  As of Saturday, August 22, 2026, the `/storage` workspace now expands each repository into an operator pane that shows VDI inventory, inferred VBD-to-VM attachment topology, resident host context, focus-aware attachment highlighting, and direct VM jump-offs from storage relationships.
  As of Saturday, August 22, 2026, focused `VDI` and `VBD` arrivals from Inventory can now land on the exact storage relationship row and jump directly into the mapped host as well as the mapped VM when topology context is available.
- Required capabilities:
  Live Xen-backed VBD metadata instead of inferred attachment matching, richer SR health and path telemetry, snapshot/clone lineage visibility, and broader UUID-aware storage-subobject resolution beyond the refs currently surfaced in the client.
- Inspiration:
  Enterprise virtualization consoles where storage investigation has to answer not just "which SR is hot?" but also "which exact workloads, hosts, and attachment paths are behind it?"

---

## Planned Major Initiatives — Research & Design (Not Yet Implemented)

These ten items are researched and designed below, and several now have partial implementation status. As of Monday, August 24, 2026, the app now has a real XenMange-level identity layer: `POST /api/auth/login` ([server/routes/auth.js](server/routes/auth.js)) authenticates against `security.db`, seeds a bootstrap administrator, creates a control-plane session that is separate from `POST /api/auth/xen-login`, and the governance layer now exposes local user CRUD/password rotation through `/api/users`. Initiative 1 is still incomplete because group membership, per-user target ownership/visibility, and a true multi-target live connection registry are not finished yet, but the old hard coupling between "sign into the app" and "log directly into one Xen target" has now been broken.

**Suggested build order:** 1 (Multi-User Access) → 6 (System Configuration) → 2 (Credential Vault) → 4 (Template Library) → 3 (VM Deployment System) → 7 (Retention) → 8 (Centralized Logs) → 10 (Performance Monitoring) → 5 (Storage Browser) → 9 (XenCenter parity, ongoing/parallel). 6 can also run in parallel with 1 since it touches unrelated config surface.

### New Database Topology

Four separate SQLite files, each opened by its own `better-sqlite3` handle following the exact `getDb()`/`initializeSchema()` pattern already used in [server/models/connection.js](server/models/connection.js). `better-sqlite3` handles multiple simultaneous file connections in one process natively, so no new dependency is required — just three new model modules (`server/models/security-db.js`, `server/models/vault-db.js`, `server/models/perf-db.js`) and three new `config.db.*Path` entries (env-overridable, same as the existing `DB_PATH`).

| File | Owner module | Contents |
|---|---|---|
| `data/xenmange.db` (existing) | `connection.js` | Pools/hosts, templates, alerts, tasks, audit log, governance, lifecycle, resilience, template library, deployment runs, system settings, retention policies |
| `data/security.db` (new) | `security-db.js` | Users, groups, group membership, roles/permissions, persistent session store, auth events, vault key-wrapping material |
| `data/vault.db` (new) | `vault-db.js` | Encrypted credential blobs only (ciphertext, IV, auth tag) |
| `data/perf.db` (new) | `perf-db.js` | Time-series metric samples + rollups |

SQLite files are independent — there is no cross-file `FOREIGN KEY` enforcement, so every cross-database reference (e.g. a `vault.db` row's `owner_user_id` pointing at a `security.db` user) is an application-level soft reference, resolved in JS, not in SQL. `ATTACH DATABASE` could technically join across files but is deliberately avoided: it couples file lifecycles together and undermines the point of separating `security.db`/`vault.db` for blast-radius reduction. The one place this matters most is `security.db` and `vault.db` staying split for the Credential Vault (Initiative 2) — see below for why.

---

### 1. Multi-User Access

**Design:** XenManage gets its own login (username/password against `security.db`), independent of any XenServer credential. Once authenticated, a user's dashboard is empty until they register pools/hosts (reusing/extending the existing `connections`/`host_targets` tables in `xenmange.db`, now with `owner_user_id` and `visibility` ('private'|'shared') columns); registering one triggers an inventory pass (existing `getAllRecords()` calls) exactly as today, just credential-driven instead of session-driven.

**Expanded foundation shipped on Monday, August 24, 2026:** `security.db` now exists with the initial security/session schema, Express no longer depends on the default in-memory `MemoryStore`, Xen-target sessions can be rehydrated from a persisted Xen session ref after a Node process restart, and the control plane now has its own bootstrap-backed local login separate from Xen target attachment. The Pools workspace can also attach a saved pool target into an already-authenticated XenMange session, and the Governance workspace now exposes local user creation, editing, password rotation, role assignment, disable/enable posture, and last-admin safeguards. This still does **not** complete the multi-user initiative because groups, per-user ownership/visibility, and multi-target live concurrency are not implemented yet, but Initiative 1 is no longer just design work.

- **`security.db` schema:**
  ```sql
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'operator', -- read-only | operator | admin (extends governance.js roles)
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
  );
  CREATE TABLE groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE group_members (group_id INTEGER, user_id INTEGER, PRIMARY KEY (group_id, user_id));
  CREATE TABLE sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE auth_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, username TEXT, event TEXT, ip TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  ```
- **Session store:** replace the default Express `MemoryStore` with a small custom `express-session` `Store` subclass backed by the `sessions` table above (`server/middleware/session-store.js`). This is the pragmatic choice over pulling in `connect-sqlite3` — the project already prefers hand-rolled `better-sqlite3` models over ORMs/wrappers, and a ~40-line store is easy to audit. This also fixes a real latent bug: today all sessions vanish on process restart.
- **Connection registry becomes per-user, multi-target:** `setConnection(sessionId, xenApi)` is a single slot today. It needs to become a map keyed by `(userId, connectionId)` so a user can have several pools/hosts live at once (the existing Inventory workbench already federates across saved targets — this closes the gap called out in roadmap item 8, "true multi-connection live federation").
- **RBAC:** promote the existing session-scoped `governanceRole` (currently switchable ad hoc in `governance.js`/`GovernanceView.js`) to a persisted `users.role`, with group-based scoping added as a later phase (e.g. a group can be restricted to a subset of pools). Existing `ensureMutationAllowed()` middleware needs almost no change — swap its `req.session.governanceRole` read for a `req.session.userId` → `security.db` lookup.
- **Password hashing:** `bcryptjs` (pure JS, no native build step — avoids stacking a second native addon on top of `better-sqlite3`, which already needs `allowScripts` in `package.json`).
- **Login flow change:** `POST /api/auth/login` now issues the XenMange app session, and `POST /api/auth/xen-login` attaches a live Xen target to that session (or creates a legacy direct-Xen session when no control-plane login exists yet). The remaining planned evolution is to let `POST /api/pools`/`POST /api/host-targets` complete that attach flow via credential references from the Vault (Initiative 2) instead of raw passwords.

---

### 2. Credential Vault

**Design:** Envelope encryption, split across `vault.db` (ciphertext) and `security.db` (key material) so neither file alone is decryptable — this is what "private keys are stored in security.db, not the vault" means in practice: the vault never holds anything that alone unlocks its own contents.

**Expanded foundation shipped on Monday, August 24, 2026:** `vault.db` now exists with encrypted credential storage, `security.db` now stores wrapped DEKs in `vault_key_material`, authenticated local XenMange users can CRUD private/shared credential metadata through `/api/credentials` without plaintext passwords being returned to the browser, and the pool/host registration flows now support linking saved vault credentials so later Xen target attachment can resolve those secrets server-side.

**Settings-integrated credential management shipped on Monday, August 24, 2026:** the `/settings` workspace now exposes a dedicated vault-management surface with searchable saved-credential inventory, floating-window create/edit flows, deletion, runtime key-source posture, previous-key rotation visibility, and last-used tracking when a saved credential is actually used to attach a live Xen target. The remaining work for Initiative 2 is deeper integration into additional attach/provisioning workflows plus more opinionated key-rotation ergonomics such as explicit re-wrap tooling.

- **Flow:** a master key comes from `VAULT_ENCRYPTION_KEY` (32-byte, base64, required env var — fail fast at boot once this feature ships, no default). Each credential gets its own random Data Encryption Key (DEK). The DEK is wrapped (AES-256-GCM) with the master key and stored in `security.db`; the credential's username/password is encrypted (AES-256-GCM) with the unwrapped DEK and stored in `vault.db`. Node's built-in `crypto` module covers this — no new dependency.
  ```sql
  -- security.db
  CREATE TABLE vault_key_material (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wrapped_dek BLOB NOT NULL,
    wrap_iv BLOB NOT NULL,
    wrap_auth_tag BLOB NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- vault.db
  CREATE TABLE credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,       -- soft ref -> security.db users.id
    scope TEXT NOT NULL DEFAULT 'private', -- private | shared (everyone, per spec)
    target_type TEXT NOT NULL,             -- pool | host
    target_hint TEXT,                      -- optional label, e.g. hostname
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    encrypted_password BLOB NOT NULL,
    enc_iv BLOB NOT NULL,
    enc_auth_tag BLOB NOT NULL,
    dek_key_id INTEGER NOT NULL,           -- soft ref -> security.db vault_key_material.id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    last_used_at DATETIME,
    last_used_by INTEGER
  );
  ```
- **Key rotation:** support an optional `VAULT_ENCRYPTION_KEY_PREVIOUS` env var. On decrypt, try the current key, fall back to the previous one; on any successful decrypt-with-previous, opportunistically re-wrap the DEK under the current key and bump `key_version`. This gives a rotation window without a bulk offline migration step.
- **Access rules:** `private` credentials are visible only to `owner_user_id`; `shared` credentials are visible to every authenticated user (per spec — literally "everyone", not group-scoped; group-scoped sharing is a reasonable "Next" once Initiative 1's groups exist). Plaintext passwords are only ever decrypted server-side at the moment of establishing a pool/host connection and are never sent to the client, logged, or written into the audit trail (audit entries reference the credential by id/name only).
- **Integration point:** the "add pool/host" flow from Initiative 1 gains a "use saved credential" option that passes a `vaultCredentialId` instead of a raw password; `server/services/xenapi.js`'s `login()` resolves it server-side.

---

### 3. Virtual Machine Deployment System (JSON "Compose" Templates)

**Design:** a JSON schema that mirrors `docker-compose.yml`'s shape (top-level metadata, a map of named resources, cross-references, dependency ordering) but whose fields map directly onto XenAPI's actual create calls (`VM.create`, `VIF.create`, `VBD.create`+`VDI.create`, confirmed against current XenServer 8.4 API docs) rather than container concepts. Executed by a new orchestration service, not the client — the client only authors/validates the JSON (via Initiative 4's editor) and triggers a run.

- **Schema sketch:**
  ```json
  {
    "version": "1",
    "name": "three-tier-app",
    "variables": { "hostnamePrefix": "app01", "diskSizeGb": 40 },
    "networks": { "front": { "ref": "network-uuid-or-name" } },
    "storageRepositories": { "primary": { "ref": "sr-uuid-or-name" } },
    "vms": {
      "db": {
        "template": "Ubuntu 22.04",
        "nameLabel": "${hostnamePrefix}-db",
        "memoryStaticMax": 4294967296,
        "memoryDynamicMin": 2147483648,
        "memoryDynamicMax": 4294967296,
        "vcpusAtStartup": 2,
        "vcpusMax": 4,
        "affinity": "host-uuid",
        "disks": [{ "sr": "primary", "sizeGb": "${diskSizeGb}", "bootable": true, "mode": "RW" }],
        "networkInterfaces": [{ "network": "front", "device": "0" }],
        "otherConfig": { "gov.golden-image": "true" },
        "xenstoreData": { "vm-data/cloud-init": "..." },
        "tags": ["tier:db"]
      },
      "app": {
        "template": "Ubuntu 22.04",
        "nameLabel": "${hostnamePrefix}-app",
        "dependsOn": ["db"],
        "...": "same field surface as above"
      }
    }
  }
  ```
- **Execution engine (`server/services/deployment-engine.js`):**
  1. Validate against a Joi schema (matches existing `middleware/validate.js` convention).
  2. Resolve `${variable}` interpolation.
  3. Resolve named refs (`network`/`sr`/`template` names → live XenAPI refs against the *target* pool — the same template name can resolve differently per pool, which is why resolution happens at run time, not authoring time).
  4. Topologically sort `vms` by `dependsOn`, reject cycles.
  5. Per VM: clone from template (`VM.clone` for CoW speed, or `VM.create` from scratch if `template` is omitted) → set memory/VCPU fields → `VIF.create` per interface → `VDI.create`+`VBD.create` per disk → set `other_config`/`xenstore_data` → `VM.provision` → `VM.start`.
  6. Persist a `deployment_runs` + `deployment_run_steps` pair in `xenmange.db` (one row per VM, status/error/ref), surfaced through the existing Activity workbench pattern (async `Task`-style polling, matching how Xen background tasks are already merged with remediation tasks there).
- **Dry-run mode:** resolve refs and print the execution plan without calling any `create`/`start` method — mirrors `docker compose config`, catches bad refs/quota violations (existing `governance.js` quota checks apply here too) before anything is provisioned.
- **Governance tie-in:** deployment runs go through `ensureMutationAllowed()` like every other mutation, and pool quota enforcement (already shipped in Governance) applies per VM in the plan, not just at submission.

---

### 4. Template Library (Monaco-Based Editor + Explorer)

**Design:** a self-hosted Monaco Editor (no CDN — the app's CSP is `script-src 'self'` with no external script hosts, so `monaco-editor` ships as a vendor asset copied by [scripts/build-client.js](scripts/build-client.js), the same way `vue`/`vue-router`/`@mdi` are copied today) plus a VS Code-style explorer panel for organizing both deployment templates (Initiative 3) and free-form guest-customization scripts.

- **CSP change required:** Monaco's language workers load via `blob:` Web Workers, which isn't covered by the current [server/middleware/security.js](server/middleware/security.js) directive set (no `worker-src` is declared, and browsers do **not** fall back to `script-src` for workers in all cases). Add `worker-src: ["'self'", "blob:"]` explicitly. Use Monaco's ESM build (not the classic AMD loader) to avoid needing `'unsafe-eval'` in `script-src`.
- **Explorer UI:** a floating window (reuses [FloatingWindow.js](client/assets/js/components/dialogs/FloatingWindow.js)), toggled by a toolbar icon in the editor, with an expandable folder tree. New `client/assets/js/components/controls/ContextMenu.js` (no such component exists yet — `DataTable.js`/`FloatingWindow.js` are the closest existing patterns to follow) supplies the right-click menu for New Folder / New Script / Rename / Move / Delete.
- **`xenmange.db` schema:**
  ```sql
  CREATE TABLE template_library_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER REFERENCES template_library_folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    owner_user_id INTEGER,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE template_library_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER REFERENCES template_library_folders(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,          -- deployment-template | guest-script | snippet
    name TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'json',
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    owner_user_id INTEGER,
    visibility TEXT NOT NULL DEFAULT 'private',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  );
  CREATE TABLE template_library_item_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES template_library_items(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    saved_by INTEGER,
    saved_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
- **Server:** `server/routes/template-library.js` + `server/services/template-library.js` — CRUD, `POST /:id/move`, tree-fetch endpoint, all wired through the existing `ensureMutationAllowed()`/`auditLogService.record()` pattern seen in [server/routes/api.js](server/routes/api.js).
- **JSON schema validation in-editor:** register the Initiative 3 deployment-template JSON schema with Monaco's built-in `jsonDefaults.setDiagnosticsOptions` for live inline validation/autocomplete while authoring — a natural fit given Monaco already ships this feature.

---

### 5. Storage Browser

**Research finding (important scope constraint):** XenServer's storage model is not file-oriented the way VMware VMFS/NFS datastores are. Most SR types (LVM, ext, block-backed) store VDIs as opaque VHD-chain or raw block objects — there is no arbitrary filesystem inside them to browse. The one SR type that genuinely is a file share is `content_type: 'iso'` (typically NFS/SMB/CIFS-backed ISO libraries), because XAPI just mounts the export as a filesystem. A true "Datastore Browser" can only be built honestly for that SR type; for everything else, the right analog is a VDI-object browser, not a file browser.

- **ISO/file SRs:** read the SR's `device_config` (`server`/`serverpath` for NFS, or SMB equivalent) to learn the export, and have the XenManage server mount/access that same share directly (it must already be network-reachable, since it's the same export XenServer uses) rather than proxying file operations through host shell access — avoids needing SSH/shell trust on the XenServer host. Endpoints: list, `mkdir`, upload (`multer`, streamed to the mount), download (streamed response), move/rename, delete. All path operations must resolve within the SR's mount root and reject `..`/absolute-path escapes (classic path-traversal guard) before touching the filesystem.
- **Block/VDI SRs:** an object browser instead — list VDIs with size/utilization/snapshot lineage (this already has a head start: the existing `/storage` workspace's VDI-to-VBD-to-VM relationship pane from roadmap item 10), plus VDI-level operations: create, resize, delete, clone/snapshot, and "attach as CD" for ISOs pulled from an ISO SR.
- **Config surface:** upload size/type limits belong in System Configuration (Initiative 6); destructive delete goes through the same `ensureMutationAllowed({ destructive: true })` approval gate already used elsewhere.

---

### 6. System Configuration View

**Design:** mostly a UI layer over infrastructure that already exists — the generic `settingsModel` key/value table in [server/models/connection.js](server/models/connection.js) — rather than a new table. A new `/settings` view with collapsible sections (reusing the existing GlassCard styling), each section backed by a namespaced key convention (`system.timezone`, `net.publicBaseUrl`, `net.trustProxy`, `security.sessionMaxAgeMs`, `logging.level`, plus a `retention.*` namespace feeding Initiative 7).

**Shipped on Monday, August 24, 2026:** a dedicated `/settings` workspace now exists with persisted General, Network, Security, Logging, and Retention Runtime sections backed by `settingsModel`, plus live runtime application for `net.trustProxy` and `security.sessionMaxAgeMs`. The UI also now surfaces which settings apply live versus which remain restart-sensitive (`server.port`, current auth throttle settings), includes a first-class credential-vault management panel with key-status guidance and saved-secret CRUD, and all section saves are validated and audited through `server/routes/system-config.js`.

- **Sections:** General (app name, timezone — used for consistent timestamp rendering app-wide), Network/URL (public base URL, Trust Proxy toggle wired to Express's `app.set('trust proxy', ...)`, notes for Traefik/reverse-proxy headers), Security (session timeout, password/lockout policy, vault key-rotation status readout from Initiative 2), Logging (level, structured/JSON toggle), Retention (delegates to Initiative 7's policy table).
- **Runtime vs. restart-required:** values like log level or trust-proxy can apply live via an in-memory config-override layer read per-request; `PORT` cannot change without a process restart (it's read once at boot in [server/config.js](server/config.js)) — the UI must flag that explicitly rather than silently no-op.
- **Server:** `server/routes/system-config.js` + `server/services/system-config.js` wrapping `settingsModel` with per-key Joi validation and change auditing (same pattern as every other settings-touching route today).

---

### 7. Log & Data Retention / Automatic Cleanup

**Design:** a generic sweep mechanism, not one bespoke cleanup routine per data type. A `retention_policies` table (`xenmange.db`) defines a retention window per domain; a single scheduler runs all enabled policies on an interval.

**Shipped on Monday, August 24, 2026:** `xenmange.db` now includes a real `retention_policies` table, `server/services/retention.js` now seeds and manages persisted policy rows, and the Settings workspace can preview and run retention sweeps manually. The first retention domains are `audit-log`, `remediation-tasks`, and `auth-events`; terminal remediation tasks are purged safely, open tasks are retained, `security.db` auth events are swept from their own database handle, and each completed sweep writes an audit summary entry. The executor also runs `VACUUM` when configured so disk usage does not silently drift upward after purges.

  ```sql
  CREATE TABLE retention_policies (
    domain TEXT PRIMARY KEY,   -- audit_log | alerts | remediation_tasks | perf_samples | vault_access_log | ...
    retention_days INTEGER NOT NULL,
    enabled INTEGER DEFAULT 1,
    last_run_at DATETIME,
    last_purged_count INTEGER
  );
  ```
- **Executor (`server/services/retention.js`):** `runRetentionSweep()` iterates enabled policies, runs a parameterized `DELETE ... WHERE created_at < ?` against an indexed timestamp column per domain, and — critically — only targets **closed/terminal-state** rows (e.g. a remediation task must be `closed`, not merely old, before it's purged; an open lifecycle plan is never swept regardless of age). Scheduling uses a plain `setInterval` at startup (no new dependency needed for a daily sweep — matches the project's minimal-dependency posture) plus a manual "Run Now" with a dry-run row-count preview in the System Configuration Retention section.
- **Housekeeping detail worth flagging now:** none of the `better-sqlite3` databases currently enable `PRAGMA auto_vacuum`, so `DELETE`s don't shrink the file on disk. The sweep should periodically `VACUUM` (or `PRAGMA incremental_vacuum` if `auto_vacuum` is set at db-creation time for the new databases) or file growth will silently continue despite the sweep "working."
- Every sweep writes one audit-log summary entry (domain, cutoff date, rows purged) for traceability.

---

### 8. Centralized Searchable Logs + Export

**Design:** a federated read layer over existing sources rather than a duplicate log table — the codebase already has this exact pattern in `InventoryView.js`/its server-side aggregation across pools/templates/VMs/hosts/etc., so `server/services/log-center.js` follows suit: query `audit_log` (`xenmange.db`), the new `auth_events` (`security.db`, Initiative 1), Xen task history (existing `tasks.js`), and alert history (existing `alerts.js`), normalize each into `{ id, source, category, timestamp, actor, entityType, entityRef, message, severity, raw }`, then merge/filter/sort/paginate in JS.

**Shipped on Monday, August 24, 2026:** `server/services/log-center.js` now federates audit-log entries, `security.db` auth events, Xen task history, remediation tasks, and derived alert records into a single normalized `/api/logs` feed. The `/activity` workspace now exposes that feed through a dedicated Log Center mode with source filters, table selection, and drill-down detail, while `POST /api/logs/export` supports audited JSON, HTML, and `pdfkit`-backed PDF exports through a printable EJS report template.

- **Why not `ATTACH DATABASE` for a single SQL query:** it would couple `xenmange.db` and `security.db`'s lifecycles and file-permission models together, undermining the isolation Initiative 1/2 are deliberately introducing. An application-level merge keeps `security.db` readable only by the process, on its own connection, with its own file permissions.
- **Selection + export:** client-side multi-select (extends `DataTable.js`'s existing selection affordances) → `POST /api/logs/export { ids, format }`. JSON is a direct serialize. HTML reuses the existing EJS rendering path ([server/views](server/views)) with a printable report template. PDF needs one new dependency: `pdfkit` (pure JS, no native binary/browser dependency, unlike Puppeteer) is the pragmatic choice for a tabular report; if richer HTML-fidelity PDF rendering is wanted later, headless-Chromium-based rendering is the documented upgrade path, not the default.
- Exporting logs is itself gated to operator/admin and is itself an audited action.

---

### 9. Tighter XenServer Functionality (XenCenter Parity)

**Design note:** this is a coverage initiative, not a single subsystem — track it as a living parity matrix (class × operation × status) appended to this plan, updated as each gap closes, rather than one monolithic deliverable. Concrete gaps identified against the current API surface (confirmed current as of XenServer 8.4 docs) and today's forms (`VMConfigForm.js`, `VMDeviceForm.js`, `HostRegistrationForm.js`, `PoolRegistrationForm.js`):

- **VM:** snapshot/checkpoint create+revert+delete, export/import (`.xva`), `VM.clone` vs `VM.copy` (CoW vs full cross-SR copy), cross-host/pool live migration (XenMotion) with explicit storage-target mapping, CPU feature-masking for mixed-hardware pool compatibility, and **console access** — XAPI exposes a `console` record with a session-authenticated proxy URL; a server-side WebSocket/HTTP proxy to that URL would be a genuinely high-value, currently-missing capability (real in-browser VNC/RDP-equivalent console).
- **Host:** maintenance-mode entry/exit that actually executes VM evacuation (today's Lifecycle workbench only plans/derives it), reboot/shutdown, PIF/bond/VLAN creation (today's `/networking` relationship pane is read-only per roadmap item 9), multipathing config.
- **Pool:** HA enable/configure (heartbeat SR, restart priorities — today only intent is displayed, per roadmap item 6), pool join/eject, patch/update management.
- **Storage:** SR create/destroy across all supported types, resize/rescan.
- **Network:** create/destroy networks, VLAN/bond creation, MTU config, per-VIF QoS.

---

### 10. Resource Performance Monitoring (`perf.db`)

**Design:** poll XenServer's existing RRD endpoints (`/host_rrd`, `/vm_rrd`, `/rrd_updates`, already noted at the top of this plan as available but currently unused for history — this is exactly the gap the Capacity roadmap item already calls out as "Next") and persist normalized samples.

**Foundation shipped on Monday, August 24, 2026:** `perf.db` now exists with a dedicated `metric_samples` table plus lookup indexes, and `server/services/metrics-history.js` now captures persisted host-memory, VM-memory, and SR-utilization snapshots from the live Xen session into that store. The new `/api/metrics/cluster`, `/api/metrics/hosts/:ref`, `/api/metrics/vms/:ref`, `/api/metrics/storage/:ref`, and `/api/metrics/collect` routes expose that history, while the Capacity workspace and Host/VM detail panes now render persisted trend cards over selectable time windows instead of relying only on one-off live metrics calls. This does **not** complete the full roadmap item yet because the background RRD collector, long-term rollups, and alert-threshold integration are still outstanding.

  ```sql
  -- perf.db
  CREATE TABLE metric_samples (
    entity_type TEXT NOT NULL,   -- host | vm | sr | pif | vbd
    entity_ref TEXT NOT NULL,
    metric_name TEXT NOT NULL,   -- cpu_usage, memory_free, network_tx, disk_iops, ...
    ts INTEGER NOT NULL,
    value REAL NOT NULL
  );
  CREATE INDEX idx_metric_lookup ON metric_samples (entity_type, entity_ref, metric_name, ts);
  ```
- **Collector (`server/services/metrics-collector.js`):** polls `rrd_updates` per connected pool/host on an interval (default 60s, configurable in Initiative 6's System Configuration), using the delta `start` param so each poll only pulls new points. Enable WAL + `PRAGMA synchronous = NORMAL` on `perf.db` for write throughput given the insert volume.
- **Retention/rollup:** raw samples kept short (e.g. 7 days) with hourly-rollup aggregates kept longer (e.g. 90 days) — a dedicated domain in Initiative 7's `retention_policies`, not a separate mechanism.
- **Client:** extends `CapacityView.js` and the existing host/VM property floating windows with real Chart.js time-series graphs (CPU%, memory, network tx/rx/errors, storage IOPS/latency) and a time-range picker (1h/6h/24h/7d/30d) against a new `server/routes/metrics.js`.
- **Alerting tie-in:** threshold breaches on stored samples feed the existing `alerts.js` service directly — reuses the shipped Alerts Center instead of building a second notification path.

---

### Planned New Dependencies & Config

| Type | Name | Used by |
|---|---|---|
| dependency | `bcryptjs` | Initiative 1 (password hashing, pure JS to avoid a second native addon) |
| dependency | `multer` | Initiative 5 (file upload streaming) |
| dependency | `pdfkit` | Initiative 8 (PDF export) |
| devDependency (vendor asset) | `monaco-editor` | Initiative 4 (self-hosted, copied by `build-client.js`) |
| env var | `SECURITY_DB_PATH`, `VAULT_DB_PATH`, `PERF_DB_PATH` | New database file locations |
| env var | `VAULT_ENCRYPTION_KEY` (required once shipped), `VAULT_ENCRYPTION_KEY_PREVIOUS` (optional, rotation window) | Initiative 2 |
| CSP change | `worker-src: ["'self'", "blob:"]` | Initiative 4 (Monaco workers) — [server/middleware/security.js](server/middleware/security.js) |

---

## Key Design Decisions

### API-First Architecture
- All XenServer operations go through `/api/*` REST endpoints
- Server translates REST ↔ JSON-RPC v2.0
- Session refs stored server-side, never exposed to client
- Client receives sanitized JSON responses

### Security
- Helmet.js for HTTP headers
- CSP with nonce-based script loading
- Input validation with Joi on all API routes
- SQLite with parameterized queries (no SQL injection)
- Session timeout handling
- Rate limiting on auth endpoints

### Glassmorphic Theme
- `backdrop-filter: blur()` for glass panels
- Semi-transparent backgrounds (`rgba(10, 15, 20, 0.7)`)
- Neon green/cyan accent colors on dark (#0a0f14) base
- Scan-line CSS animation overlay
- Matrix-rain canvas background (subtle)
- Custom box-shadows with colored glow

### Fonts
- "Share Tech Mono" for data/code/terminal elements
- "Rajdhani" for headings and navigation
- "Exo 2" for body text (futuristic but readable)

---

## NPM Dependencies

### Server
- `express` - Web framework
- `helmet` - Security headers
- `better-sqlite3` - SQLite driver
- `joi` - Input validation
- `ejs` - Server-side templates
- `cors` - CORS handling
- `express-rate-limit` - Rate limiting
- `dotenv` - Environment config
- `axios` - HTTP client for XenServer API
- `uuid` - UUID generation

### Client (via CDN or build)
- `vue` 3 - Frontend framework
- `vue-router` 4 - Client routing
- `pinia` - State management
- `chart.js` - Charts/graphs
- `gridstack` - Drag-drop dashboard grid
- `@mdi/font` - Material Design Icons
- `tailwindcss` - Utility CSS

### Dev/Testing
- `jest` - Unit testing
- `@vue/test-utils` - Vue component testing
- `playwright` - E2E testing
- `nodemon` - Dev server auto-reload
- `concurrently` - Run server + build in parallel
- `tailwindcss` (CLI) - CSS build

---

## Progress Log

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation | 🟨 In Progress | Local build pipeline, CSP-safe asset delivery, generated project-owned background art, and SQLite-backed durable session storage added |
| Phase 2: API Integration | 🟨 In Progress | Core auth/resource routes implemented; connection validation/defaulting, template inventory access, task/activity data, centralized log aggregation/export, persisted metrics history APIs, alert/lifecycle/governance state persistence, remediation task and remediation template creation/listing/updating, alert policy and bulk-triage endpoints, quota enforcement, approval gating, resilience synthesis, and audited system-settings/retention endpoints added |
| Phase 3: UI Core | 🟨 In Progress | Floating windows, saved targets, live inventory tree, SSR auth bootstrap, stronger visual shell layering, modular client source extraction into core/components/views/forms, a dedicated Settings workspace, the Activity log-center mode, and reusable telemetry trend cards added |
| Phase 4: Dashboard | 🟨 In Progress | Summary drag/reorder support, operational panels, alert triage, recent task visibility, governance role surfacing, and dashboard action rails into capacity/activity/templates/alerts added |
| Phase 5: Resource Views | 🟨 In Progress | Pools view, templates view, inventory/alerts/activity/governance/lifecycle/capacity/resilience workbenches, API-backed governance/alert policy/lifecycle planning, centralized log exports, persisted capacity/history views for cluster-host-vm-storage telemetry, bulk alert triage, remediation task creation/management plus reusable templates, task-level automation staging for evidence/completion criteria, exact-record deep linking, inventory subobject indexing for VDI/VBD/VIF/PIF, and richer host/storage/network floating windows added |
| Phase 6: Polish & Testing | 🟨 In Progress | Client bundle, 156 Jest tests, and all 8 Playwright end-to-end operator flows pass; client component unit depth and broader operational route coverage still remain |
