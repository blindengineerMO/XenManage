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
- Next:
  True storage-placement orchestration against deeper Xen template copy semantics, richer guest-customization execution against live Xen guest tooling, and promotion workflows that compare staged vs stable template generations over time.
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
- Required capabilities:
  True multi-user auth and identity-provider integration, finer-grained per-domain permissions beyond session-wide roles, broader destructive-action approval coverage across more infrastructure domains, and scoped self-service experiences for future tenant or delegated-operator models.
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
| Phase 1: Foundation | 🟨 In Progress | Local build pipeline, CSP-safe asset delivery, and generated project-owned background art added |
| Phase 2: API Integration | 🟨 In Progress | Core auth/resource routes implemented; connection validation/defaulting, template inventory access, task/activity data, alert/lifecycle/governance state persistence, remediation task and remediation template creation/listing/updating, alert policy and bulk-triage endpoints, quota enforcement, approval gating, and resilience synthesis endpoint added |
| Phase 3: UI Core | 🟨 In Progress | Floating windows, saved targets, live inventory tree, SSR auth bootstrap, stronger visual shell layering, and modular client source extraction into core/components/views/forms added |
| Phase 4: Dashboard | 🟨 In Progress | Summary drag/reorder support, operational panels, alert triage, recent task visibility, governance role surfacing, and dashboard action rails into capacity/activity/templates/alerts added |
| Phase 5: Resource Views | 🟨 In Progress | Pools view, templates view, inventory/alerts/activity/governance/lifecycle/capacity/resilience workbenches, API-backed governance/alert policy/lifecycle planning, bulk alert triage, remediation task creation/management plus reusable templates, task-level automation staging for evidence/completion criteria, exact-record deep linking, inventory subobject indexing for VDI/VBD/VIF/PIF, and richer host/storage/network floating windows added |
| Phase 6: Polish & Testing | 🟨 In Progress | Client bundle, 107 unit tests, and the end-to-end operator workbench flow all pass; client component unit depth and broader operational route coverage still remain |
