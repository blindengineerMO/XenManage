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
  As of Tuesday, August 25, 2026, the Alerts Center also ingests threshold-derived telemetry signals from persisted host-memory and SR-utilization metrics, so capacity pressure raised by the metrics collector now appears in the same triage queue, dashboard message rail, and log-center feed as native Xen messages.
  As of Tuesday, August 25, 2026, remediation templates and seeded follow-through tasks can also carry downstream VM migration drafts in the same way they already carry lifecycle and resilience intent, so Activity can now launch operators directly into a prefilled VM migration handoff without retyping host/target placement notes.
  As of Tuesday, August 25, 2026, alert handoffs now resolve deeper storage and network sub-objects instead of stopping at raw UUID text: VDI/VBD/VIF/PIF-class alerts can carry a resolved object ref through `/api/alerts`, open the focused attachment/uplink view in Storage or Networking, and seed Activity follow-through tasks with the same ref-aware routing context.
  As of Tuesday, August 25, 2026, alert remediation templates no longer stop at `draft` versus `queue` launch behavior alone: template-driven follow-through can now route directly into seeded Lifecycle draft, Lifecycle maintenance, Resilience runbook, Resilience drill, or VM migration handoffs from the Alerts workspace itself, with the created remediation task preserved underneath that immediate launch.
  As of Tuesday, August 25, 2026, that same deeper alert routing now also covers remaining network-adjacent Xen subobjects that can map cleanly onto uplinks: `Bond` and `VLAN` alerts resolve through representative `PIF` refs, open the focused uplink relationship row in Networking, and can be matched by alert policies or remediation templates without degrading back to raw class/UUID text.
- Next:
  Broaden the same relationship-aware alert routing to any remaining lower-level Xen objects that still surface as raw identifiers after the shipped `VDI`/`VBD`/`VIF`/`PIF`/`Bond`/`VLAN` slices, plus deeper automated execution beyond the currently shipped direct handoffs for lifecycle drafts, maintenance entry, resilience runbooks, resilience drills, and VM migration once those seeded plans need to chain into further operator action.
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
  As of Monday, August 24, 2026, that governance history is also now actionable: operators can restore a prior template-governance snapshot directly from the Templates workspace, with audit-trail coverage and the same behavior in both live API mode and the built-in demo environment.
- Next:
  True storage-placement orchestration against deeper Xen template copy semantics and richer guest-customization execution against live Xen guest tooling.
- Why it matters:
  SCVMM explicitly treats library resources and templates as repeatability infrastructure.

### 3. Host Lifecycle / Compliance Management
- Status: Partially shipped
- Shipped in app:
  A new `/lifecycle` workbench now derives lifecycle posture from hosts, lifecycle-oriented tasks, and related alerts to surface maintenance windows, baseline hints, drift review queues, and remediation guidance.
  API-backed lifecycle plan persistence now supports per-host desired-state planning, maintenance-stage tracking, reboot and evacuation flags, owner and patch-wave assignment, and richer lifecycle detail/readiness views.
  As of Sunday, August 23, 2026, lifecycle planning can also be launched directly from seeded remediation tasks in Activity, carrying template-derived defaults and source-task provenance into the planner while resolving host context from direct refs, UUIDs, and host-name matches.
  As of Sunday, August 23, 2026, lifecycle draft routing now also infers host context from related VMs, storage repositories, pool membership, and network uplinks instead of relying only on direct host identifiers.
  As of Tuesday, August 25, 2026, the lifecycle planner also no longer stops at saved intent when a host is ready for execution: operators can enter or exit host maintenance directly from the planner using the same evacuation controls as the Hosts workspace, and seeded remediation tasks are automatically advanced to `in_progress` when that maintenance handoff actually starts.
- Required capabilities:
  Host patch baseline visibility from deeper Xen data, broader remediation execution beyond maintenance-mode handoff alone, richer cluster-wide drift reporting, and broader desired-state policy controls beyond per-host planning.
- Inspiration:
  VMware `vLCM` image compliance plus Microsoft baseline remediation flows.

### 4. Capacity & Performance Analytics
- Status: Partially shipped
- Shipped in app:
  Host property windows now fetch live host metrics, and a dedicated `/capacity` workspace now consolidates host memory pressure, storage commitment, active background tasks, operator guidance, top VM consumers, placement-imbalance analysis, noisy-neighbor detection, and inferred forecast thresholds into a single operational surface.
  The dashboard now surfaces a shared capacity-watch panel plus hotspot summaries so headroom drift is visible before operators drill into the dedicated workspace.
  As of Sunday, August 23, 2026, the capacity workbench also surfaces remediation-task SLA labels and queue-age badges inside staged automation items so capacity follow-through urgency is visible without bouncing back to Activity first.
  As of Monday, August 24, 2026, persisted telemetry collection is no longer purely request-driven: an in-process metrics collector can now poll attached Xen targets on a configurable schedule, the Settings workspace exposes those controls plus collector runtime state, and manual metrics collection routes now reuse the same runtime collector metadata.
  As of Tuesday, August 25, 2026, the capacity forecast callout now consumes persisted cluster telemetry history instead of relying only on current-state inference: the workbench derives trend-backed memory/storage/CPU slope signals from the selected telemetry window, projects approaching warning/critical thresholds when recent utilization is climbing, and labels forecast confidence based on persisted telemetry coverage instead of static inventory alone.
  As of Tuesday, August 25, 2026, the capacity workbench also enriches host, VM, and SR inventory with the latest persisted telemetry baseline via `/api/metrics/capacity-baseline`, so top-consumer and placement-imbalance analysis now prefer observed VM memory and CPU pressure instead of relying only on configured memory envelopes.
  As of Tuesday, August 25, 2026, persisted Xen RRD telemetry now also captures broader host and workload throughput counters beyond CPU and memory alone: host/VM network ingress-egress plus VM disk read-write throughput are stored in `perf.db`, exposed through the metrics history APIs, and surfaced in the Capacity, Hosts, and VM detail trend cards.
  As of Tuesday, August 25, 2026, the capacity forecast no longer stops at cluster-only trend projection: it now blends persisted telemetry trends with current host-balance, storage-pressure, and dominant-workload attribution so the callout can identify the likely pressure leader behind rising risk instead of only reporting aggregate drift.
  As of Tuesday, August 25, 2026, forecast attribution in Capacity can now launch direct operational follow-through instead of stopping at diagnosis: operators can inspect the attributed driver in place, create a prefilled remediation task from the forecast callout, reopen the exact host/storage/workload back inside `/capacity` from Activity, and carry downstream Lifecycle or Resilience draft seeds when the pressure signature warrants those deeper handoffs.
  As of Tuesday, August 25, 2026, that forecast handoff also supports one-click automation beyond the manual composer: the same callout can now queue the follow-through task immediately or launch a seeded Lifecycle maintenance draft / Resilience recovery-runbook draft by creating the remediation task in the background and route-focusing the downstream workspace on that task.
  As of Tuesday, August 25, 2026, those seeded forecast handoffs can also enter execution-first modes instead of looking like generic drafts: Capacity can now launch straight into a maintenance handoff for host-driven pressure, while Activity can relaunch the same remediation tasks directly into Lifecycle maintenance or Resilience drill execution with the source-task context preserved.
  As of Tuesday, August 25, 2026, VM-attributed forecast pressure no longer dead-ends at task creation: Capacity and Activity can now launch a seeded VM migration draft into `/vms`, the migration workspace preloads the sourced host/target handoff, and executing that migration automatically advances the originating remediation task to `success` instead of leaving closure as a manual bookkeeping step.
- Next:
  Expand the same no-retyping automation pattern to the remaining forecast execution paths and richer run-time actions beyond the slices already shipped for maintenance entry, recovery-drill logging, and VM migration, especially where operators need downstream plans to chain into deeper lifecycle/protection execution instead of stopping at a single launched action or a single seeded editor.
- Inspiration:
  Nutanix resource-consumption dashboards and Prism health telemetry.

### 5. Governance, RBAC, and Self-Service
- Status: Partially shipped
- Shipped in app:
  A new `/governance` workspace now provides session role switching, persisted governance policy editing, pool quota management, and approval-queue review in a dedicated operator surface.
  Session state now carries read-only, operator, and admin role modes, and destructive VM actions can require explicit approved tokens before execution when policy gating is enabled.
  Pool quotas now persist server-side, feed governance posture summaries, and block template deployments that would exceed the configured VM-count, running-VM, or aggregate-memory envelope.
  Governance actions now flow into the shared audit trail, and the browser regression suite covers policy edits, role changes, quota updates, approval requests, and approval decisions.
  As of Monday, August 24, 2026, the governance stack also now includes persisted local user and local group administration backed by `security.db`, with `/api/users` CRUD/password-rotation endpoints, `/api/groups` CRUD membership endpoints, active/disabled account posture, last-admin safety checks, and session-role switching capped by each local account’s stored role instead of allowing ad hoc privilege escalation.
  As of Monday, August 24, 2026, broader destructive-action approval coverage now spans VM power actions, saved pool and host target removal, inventory workspace cleanup, retention sweeps, vault credential deletion, alert policy/template cleanup, lifecycle plan deletion, and resilience runbook deletion, with direct handoff into the Governance approval composer whenever operators lack an approved token.
- Required capabilities:
  Finer-grained per-domain permissions beyond the current global roles, identity-provider integration, and scoped self-service experiences for future tenant or delegated-operator models.
- Inspiration:
  SCVMM user roles and Arc-backed self-service; Prism fine-grained RBAC.

### 6. HA / DR / Backup Visibility
- Status: Partially shipped
- Shipped in app:
  A new `/resilience` workbench now surfaces protection-policy inventory, backup/recovery event visibility, host evacuation targets, and pool-level recovery plan guidance derived from live Xen inventory, tasks, and alerts.
  As of Friday, August 21, 2026, the resilience workspace now also persists pool-level recovery runbooks, exposes explicit HA policy and restart-priority intent, derives backup age and restore-point drift against runbook targets, and logs recovery drills with audit-trail coverage.
  As of Sunday, August 23, 2026, resilience runbooks can also be drafted directly from seeded remediation tasks in Activity, carrying template-derived defaults and source-task provenance while resolving recovery-plan context from direct pool matches or related host membership.
  As of Sunday, August 23, 2026, resilience draft routing now also resolves recovery-plan context from VM placement, SR attachment, and network-to-pool relationships, while fixing network option hydration in the runbook editor itself.
  As of Tuesday, August 25, 2026, the runbook editor also no longer stops at saved intent when a seeded resilience task is ready for execution: operators can log recovery-drill evidence directly inside the runbook workflow, and sourced remediation tasks are automatically advanced to a matching completion state when the drill outcome is recorded.
  As of Tuesday, August 25, 2026, seeded resilience execution can now open in an explicit drill-first handoff mode from Activity and Capacity follow-through launches, with the runbook editor retitled and messaged around immediate execution while still preserving editable runbook defaults in the same workspace.
- Required capabilities:
  Deeper live Xen-backed HA policy orchestration, richer restore-point truth from backup platform integrations instead of inference alone, broader recovery-plan execution beyond drill-evidence handoff alone, and broader failover drill analytics across more infrastructure domains.
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
  As of Tuesday, August 25, 2026, those remediation task follow-through actions now also expose direct execution-first handoffs for seeded lifecycle maintenance and resilience drills, so operators can jump from Activity into the actual execution surface instead of always landing on a generic draft editor first.
  As of Tuesday, August 25, 2026, alert-created remediation tasks now also preserve richer template launch intent than before, including direct lifecycle-plan, lifecycle-maintenance, resilience-runbook, resilience-drill, and VM-migration handoffs, instead of flattening every alert template back into a draft-or-queue-only workflow.
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
  As of Tuesday, August 25, 2026, focused alert and Activity handoffs can now also reach the same networking uplink view from `Bond` and `VLAN` Xen alerts by resolving those subobjects onto representative `PIF` refs instead of dropping operators back to generic inventory navigation.
  As of Tuesday, August 25, 2026, the networking detail pane now also exposes clearer topology context for those focused arrivals instead of treating them as generic bridge opens: operators can see the VLAN tag directly in the property grid, a compact topology summary across uplinks/interfaces/hosts, and an explicit focused handoff banner that distinguishes `VIF`, `PIF`, `Bond`, and `VLAN` entry paths.
- Required capabilities:
  Live Xen-backed per-interface telemetry, bond/VLAN topology modeling, IP/MAC-level interface truth, and broader UUID-aware interface resolution instead of ref-based correlation alone.
- Inspiration:
  Enterprise fabric views in vCenter, SCVMM, Prism, and similar control planes where operators need to see the bridge plus every host and workload attached to it.

### 10. Storage Attachment Topology
- Status: Partially shipped
- Shipped in app:
  As of Saturday, August 22, 2026, the `/storage` workspace now expands each repository into an operator pane that shows VDI inventory, inferred VBD-to-VM attachment topology, resident host context, focus-aware attachment highlighting, and direct VM jump-offs from storage relationships.
  As of Saturday, August 22, 2026, focused `VDI` and `VBD` arrivals from Inventory can now land on the exact storage relationship row and jump directly into the mapped host as well as the mapped VM when topology context is available.
  As of Wednesday, August 26, 2026, the storage detail pane now also exposes clearer arrival context for those focused subobject routes instead of treating them like generic repository opens: operators can see attachment-path counts and a compact topology summary in the property grid, plus an explicit focused handoff banner that distinguishes `VDI` and `VBD` entry paths.
- Required capabilities:
  Live Xen-backed VBD metadata instead of inferred attachment matching, richer SR health and path telemetry, snapshot/clone lineage visibility, and broader UUID-aware storage-subobject resolution beyond the refs currently surfaced in the client.
- Inspiration:
  Enterprise virtualization consoles where storage investigation has to answer not just "which SR is hot?" but also "which exact workloads, hosts, and attachment paths are behind it?"

---

## Planned Major Initiatives — Research & Design (Not Yet Implemented)

These ten items are researched and designed below, and several now have partial implementation status. As of Monday, August 24, 2026, the app now has a real XenMange-level identity layer: `POST /api/auth/login` ([server/routes/auth.js](server/routes/auth.js)) authenticates against `security.db`, seeds a bootstrap administrator, creates a control-plane session that is separate from `POST /api/auth/xen-login`, the governance layer now exposes local user CRUD/password rotation through `/api/users` plus local group/membership CRUD through `/api/groups`, saved targets/workspaces now enforce per-user ownership plus `private`/`shared` visibility, and a single XenMange session can now retain multiple attached live Xen targets with active-target switching and per-target detach flows. The old hard coupling between "sign into the app" and "log directly into one Xen target" has now been broken for real operator workflows.

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

**Expanded foundation shipped on Monday, August 24, 2026:** `security.db` now exists with the initial security/session schema, Express no longer depends on the default in-memory `MemoryStore`, Xen-target sessions can be rehydrated from a persisted Xen session ref after a Node process restart, and the control plane now has its own bootstrap-backed local login separate from Xen target attachment. The Pools workspace can also attach a saved pool target into an already-authenticated XenMange session, the same authenticated XenMange session can now retain multiple attached live Xen targets with in-session activation/detach flows, the Governance workspace now exposes local user creation, editing, password rotation, role assignment, local group creation/editing/removal, reusable user-group membership management, disable/enable posture, and last-admin safeguards, and saved pool targets, host targets, plus inventory workspaces now persist owner identity and `private`/`shared` visibility with owner/admin mutation enforcement and UI cues. Initiative 1 is no longer blocked on multi-target live concurrency.

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
- **Connection registry now supports per-session, multi-target live attachment:** the old `setConnection(sessionId, xenApi)` single-slot model has now been replaced with a per-session target map keyed by saved-connection identity or direct host identity, allowing one XenMange login to keep several pool/host sessions live at once. The auth layer now persists attached-target descriptors in the session, rehydrates them after process restarts, and supports `/api/auth/targets` list/activate/detach flows that the Pools and Inventory workbenches consume.
- **RBAC:** promote the existing session-scoped `governanceRole` (currently switchable ad hoc in `governance.js`/`GovernanceView.js`) to a persisted `users.role`, with group-based scoping added as a later phase (e.g. a group can be restricted to a subset of pools). Existing `ensureMutationAllowed()` middleware needs almost no change — swap its `req.session.governanceRole` read for a `req.session.userId` → `security.db` lookup.
- **Password hashing:** `bcryptjs` (pure JS, no native build step — avoids stacking a second native addon on top of `better-sqlite3`, which already needs `allowScripts` in `package.json`).
- **Login flow change:** `POST /api/auth/login` now issues the XenMange app session, and `POST /api/auth/xen-login` attaches a live Xen target to that session (or creates a legacy direct-Xen session when no control-plane login exists yet). The remaining planned evolution is to let `POST /api/pools`/`POST /api/host-targets` complete that attach flow via credential references from the Vault (Initiative 2) instead of raw passwords.

---

### 2. Credential Vault

**Design:** Envelope encryption, split across `vault.db` (ciphertext) and `security.db` (key material) so neither file alone is decryptable — this is what "private keys are stored in security.db, not the vault" means in practice: the vault never holds anything that alone unlocks its own contents.

**Expanded foundation shipped on Monday, August 24, 2026:** `vault.db` now exists with encrypted credential storage, `security.db` now stores wrapped DEKs in `vault_key_material`, authenticated local XenMange users can CRUD private/shared credential metadata through `/api/credentials` without plaintext passwords being returned to the browser, and the pool/host registration flows now support linking saved vault credentials so later Xen target attachment can resolve those secrets server-side.

**Settings-integrated credential management shipped on Monday, August 24, 2026:** the `/settings` workspace now exposes a dedicated vault-management surface with searchable saved-credential inventory, floating-window create/edit flows, deletion, runtime key-source posture, previous-key rotation visibility, explicit legacy-key re-wrap tooling, and last-used tracking when a saved credential is actually used to attach a live Xen target. The remaining work for Initiative 2 is deeper integration into additional attach/provisioning workflows.

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

**Incremental foundation shipped on Monday, August 24, 2026:** the existing single-template deployment flow now also persists `deployment_runs` and `deployment_run_steps` records in `xenmange.db`, merges those runs into the shared Activity task feed alongside Xen background tasks and remediation work, and keeps the run state in sync with post-deploy validation updates so operators can track "provisioned, awaiting validation" work instead of losing it in audit history alone.

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
  6. Persist a `deployment_runs` + `deployment_run_steps` pair in `xenmange.db` (one row per VM, status/error/ref), surfaced through the existing Activity workbench pattern (async `Task`-style polling, matching how Xen background tasks are already merged with remediation tasks there). A single-template subset of this is now shipped for the current deploy-from-template flow; the remaining gap is extending the same run/step orchestration to future multi-VM compose-style plans and richer per-step failure recovery.
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

**Shipped on Monday, August 24, 2026:** `xenmange.db` now includes a real `retention_policies` table, `server/services/retention.js` now seeds and manages persisted policy rows, and the Settings workspace can preview and run retention sweeps manually. The first retention domains are `audit-log`, `remediation-tasks`, `auth-events`, `template-deployment-runs`, and `metric-samples`; terminal remediation tasks are purged safely, open tasks are retained, completed template deployment runs are swept without touching warning/review-needed follow-through, raw telemetry snapshots in `perf.db` now honor a dedicated short-window policy, `security.db` auth events are swept from their own database handle, and each completed sweep writes an audit summary entry. The executor also runs `VACUUM` across the affected SQLite stores when configured so disk usage does not silently drift upward after purges.

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

**VM protection slice shipped on Monday, August 24, 2026:** VM details now expose a dedicated Protection tab that can create Xen-backed snapshots and checkpoints, list restore points, and execute revert/delete operations through new `/api/vms/:ref/snapshots` routes, audit entries, demo-mode handlers, and governance-aware destructive approvals. This closes the snapshot/checkpoint create+revert+delete gap called out below, but export/import, advanced migration/storage-remap parity, CPU masking, and in-browser console proxying are still open.

**VM duplication slice shipped on Monday, August 24, 2026:** VM details now expose a Clone / Copy tab backed by a dedicated form component and `/api/vms/:ref/duplicate`, allowing fast Copy-on-Write clones via `VM.clone` and full copies via `VM.copy` with explicit SR placement and optional post-provision power-on. Demo-mode resource duplication, audit logging, and focused Jest/Playwright coverage are all included. This closes the clone-vs-copy control gap called out below, but export/import, advanced migration/storage-remap parity, CPU masking, and in-browser console proxying are still open.

**VM migration slice expanded on Monday, August 24, 2026:** VM details now expose a dedicated Migration tab backed by `/api/vms/:ref/migrate`, XenServer's `VM.pool_migrate`, and cross-target `host.migrate_receive` / `VM.migrate_send` orchestration. Operators can live-migrate running or suspended workloads, relocate halted workloads within the current pool, or remap a VM across an attached destination fabric with destination-target selection, transfer-network choice, explicit SR placement, and per-VIF destination network mapping from the same floating operator window. Demo-mode multi-target behavior, audit entries, stricter route validation, and focused Jest/Playwright coverage are all included. This closes the same-pool plus cross-pool/storage-target mapping slice of the XenMotion gap called out below, but CPU masking and in-browser console proxying are still open.

**VM portability slice shipped on Monday, August 24, 2026:** The VMs workspace now exposes a top-level XVA import flow plus a dedicated Import / Export tab inside VM details, backed by `/api/vms/import`, `/api/vms/:ref/export`, and XenServer's documented HTTP import/export handlers (`/import`, `/import_metadata`, `/export`, `/export_metadata`). Operators can stream full XVA packages or metadata-only archives, target a specific SR for full imports, and test the entire upload/download workflow in demo mode as well as the live browser suite. This closes the export/import gap called out below, but CPU masking and in-browser console proxying are still open.

**VM compatibility slice shipped on Monday, August 24, 2026:** VM details now expose a dedicated Compatibility tab backed by `/api/vms/:ref/compatibility`, `VM.get_possible_hosts`, and `VM.assert_can_boot_here`, giving operators a per-host placement matrix, current-host CPU family alignment, and last-boot CPU flag review from the same floating workspace used for migration and device work. The current official XAPI reference marks `host.set_cpu_features` and `host.reset_cpu_features` as removed, so XenMange intentionally closes this gap with a stronger preflight compatibility workflow instead of shipping stale CPU-masking controls that no longer map to the live API.

**VM console slice shipped on Monday, August 24, 2026:** VM details now expose a dedicated Console tab backed by `/api/vms/:ref/consoles`, `VM.get_consoles`, and the `console` class record, with a guarded browser launch view that resolves the current session-authenticated console endpoint for the selected workload. Demo-mode console launch surfaces, audit-safe server mediation, and focused Jest/Playwright coverage are all included. This closes the console discovery and operator launch gap called out below.

**Host maintenance slice shipped on Monday, August 24, 2026:** Host details now expose a dedicated operations section backed by `/api/hosts/:ref/maintenance/enter`, `/api/hosts/:ref/maintenance/exit`, `/api/hosts/:ref/reboot`, and `/api/hosts/:ref/shutdown`, allowing operators to disable placement, evacuate running VMs over a selected migration network, and then either return the host to service or execute guarded power actions. Demo-mode evacuation behavior, audit entries, governance-aware destructive approvals for reboot/shutdown, and focused Jest/Playwright coverage are all included. This closes the maintenance entry/exit and reboot/shutdown gap called out below, but deeper host networking/storage config parity is still open.

**Storage operations slice expanded on Wednesday, August 26, 2026:** Storage details now expose a dedicated operations section backed by `/api/storage/:ref/rescan`, `/api/storage/:ref/forget`, `/api/storage/:ref/destroy`, `/api/storage/:ref/vdis`, `/api/storage/:ref/vdis/:vdiRef/resize`, and `/api/storage/:ref/vdis/:vdiRef`, allowing operators to rescan the selected SR in-place, forget an unused repository from XenManage inventory through the same governance-aware approval flow used elsewhere in the product, destroy an empty repository once its mapped VDIs have been cleared, create detached VDIs with explicit name/type/capacity controls, resize existing VDIs from the same floating workspace, and delete detached VDIs without leaving the detail pane. Demo-mode storage mutations, audit entries, focused Jest coverage, and isolated Playwright coverage are all included. This closes the detail-level rescan gap plus the first detached VDI create/resize/delete slices and the SR forget/destroy lifecycle slices called out below, but SR creation and the remaining SR lifecycle actions are still open.

**Storage repository creation slice shipped on Wednesday, August 26, 2026:** The Storage workspace now also exposes a top-level create form backed by `POST /api/storage` and XenServer's `SR.create`, allowing operators to provision new `nfs`, `lvmoiscsi`, `ext`, and `lvm` repositories with type-specific device-config inputs, optional SM config overrides, and explicit host placement without leaving the browser. Demo-mode SR creation, route validation, audit logging, focused Jest coverage, and isolated Playwright coverage are all included. This closes the SR creation gap called out below, leaving SR repair and broader attachment-aware VDI lifecycle parity as the primary remaining storage follow-on work.

**Storage repository repair slice shipped on Wednesday, August 26, 2026:** Storage details now also expose a dedicated repair action backed by `/api/storage/:ref/repair`, XenServer's `SR.update`, and `PBD.plug` for any detached paths discovered on the selected repository. The delivered flow refreshes repository metadata, attempts to reattach detached host-to-SR paths without forcing destructive detach cycles, records repair telemetry in the workspace, and ships with demo-mode behavior plus focused Jest and Playwright coverage. This closes the SR repair gap called out below, leaving broader attachment-aware VDI lifecycle parity and richer attach/probe workflows as the main remaining storage follow-on work.

**Attachment-aware VDI safety slice shipped on Wednesday, August 26, 2026:** Storage details now also gate VDI deletion behind an explicit detached-disk check, returning `VDI_DELETE_REQUIRES_DETACHED_DISK` from `/api/storage/:ref/vdis/:vdiRef` whenever workload attachments still exist and surfacing the same guidance directly in the floating workspace. Operators now see attached-disk badges, per-VDI delete blocking reasons, and disabled destructive controls before they can attempt a remove action against an in-use disk. This closes the first attachment-aware VDI safety gap, leaving richer attachment-aware create/resize flows and broader SR attach/probe workflows as the main remaining storage follow-on work.

**Attachment-aware VDI resize guidance slice shipped on Wednesday, August 26, 2026:** The Storage detail resize form now also detects when the selected VDI is still attached to a workload and surfaces explicit operator guidance before the resize runs. Attached disks are labeled in the resize form, and the workspace now calls out that growing the Xen virtual disk still requires guest partition/filesystem follow-through inside the workload. This closes the first attachment-aware resize guidance gap, leaving richer attachment-aware create flows and broader SR attach/probe workflows as the main remaining storage follow-on work.

- **VM:** snapshot/checkpoint create+revert+delete, `VM.clone` vs `VM.copy` (CoW vs full cross-SR copy), same-pool host migration/relocation, cross-pool or storage-remapped live migration parity, CPU compatibility preflight for mixed-hardware placement, and console discovery/launch access.
  Status update on Monday, August 24, 2026: snapshot/checkpoint, clone/copy, same-pool migration, cross-pool/storage-remapped migration, import/export, CPU compatibility preflight, and console discovery/launch are now shipped. The older host CPU feature mutation calls are removed in the current XAPI docs, so compatibility evidence replaced direct masking controls in the delivered plan.
- **Host:** PIF/bond/VLAN creation (today's `/networking` relationship pane is read-only per roadmap item 9), multipathing config.
- **Pool:** HA enable/configure (heartbeat SR, restart priorities — today only intent is displayed, per roadmap item 6), pool join/eject, patch/update management.
- **Storage:** richer attachment-aware VDI create workflows beyond the shipped detached create flows plus attached-delete safeguards and resize guidance, and broader attach/probe/imported-SR workflows beyond the shipped create/repair/rescan/forget/destroy set.
- **Network:** create/destroy networks, VLAN/bond creation, MTU config, per-VIF QoS.

---

### 10. Resource Performance Monitoring (`perf.db`)

**Design:** poll XenServer's existing RRD endpoints (`/host_rrd`, `/vm_rrd`, `/rrd_updates`, already noted at the top of this plan as available but currently unused for history — this is exactly the gap the Capacity roadmap item already calls out as "Next") and persist normalized samples.

**Foundation shipped on Monday, August 24, 2026:** `perf.db` now exists with a dedicated `metric_samples` table plus lookup indexes, `server/services/metrics-history.js` now captures persisted host-memory, VM-memory, and SR-utilization snapshots from the live Xen session into that store, and the new `server/services/metrics-collector.js` can now poll attached Xen targets on a configurable in-process interval sourced from System Configuration. The `/api/metrics/cluster`, `/api/metrics/hosts/:ref`, `/api/metrics/vms/:ref`, `/api/metrics/storage/:ref`, and `/api/metrics/collect` routes expose that history, while the Capacity workspace and Host/VM detail panes now render persisted trend cards over selectable time windows instead of relying only on one-off live metrics calls.

**Rollup extension shipped on Tuesday, August 25, 2026:** `perf.db` now also persists `metric_hourly_rollups`, the metrics history service transparently serves `7d` and `30d` windows from those hourly aggregates, and Initiative 7 retention now manages both short-lived raw samples and longer-lived rollup history independently.

**Telemetry-alert integration shipped on Tuesday, August 25, 2026:** persisted host-memory pressure and SR-utilization thresholds now synthesize queue entries inside the existing Alerts Center, including normal alert-state persistence, dashboard-message visibility, policy matching, and centralized log-center federation.

**Raw RRD proxy slice shipped on Tuesday, August 25, 2026:** `server/services/xenapi.js` now exposes the XenServer `rrd_updates` HTTP endpoint through a dedicated `/api/metrics/rrd-updates` route with validated `start` / `cf` / `interval` query support, and now also supports the documented `host=true` toggle required when callers want host metrics included alongside VM metrics. This closes the “proxy RRD updates from XenServer” API foundation item; the remaining gap is teaching the persisted collector and Capacity forecasting flows to ingest a broader normalized set of RRD counters beyond the current snapshot-derived metrics.

**Host CPU telemetry slice shipped on Tuesday, August 25, 2026:** the persisted metrics collector now ingests host CPU pressure from XenServer `rrd_updates`, normalizes the latest `cpu_avg` samples into stored `cpu_usage_percent` points, and exposes that history through the existing host and cluster metrics APIs. Capacity and Host detail workbenches now render CPU trend cards alongside the earlier memory/storage history, so the first broader RRD-backed counter is wired end-to-end rather than remaining a raw passthrough.

**VM CPU telemetry slice shipped on Tuesday, August 25, 2026:** the same persisted RRD ingest path now understands XenServer’s documented `AVERAGE:vm:<uuid>:cpuN` legend format, averages the latest per-vCPU samples into normalized VM `cpu_usage_percent` history, and surfaces that trend inside both the VM detail workspace and the Capacity VM inspector. The collector now stores the first cross-entity RRD-backed CPU history set instead of limiting richer telemetry to hosts alone.

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
- **Collector (`server/services/metrics-collector.js`):** the raw `rrd_updates` proxy surface is now shipped through `/api/metrics/rrd-updates`, and both host and VM CPU history are now ingested end-to-end as the first broader RRD-backed counters. The remaining work is expanding that collector path to additional normalized host / VM / network / storage counters and eventually switching to true delta polling per connected pool/host on an interval (default 60s, configurable in Initiative 6's System Configuration) so each pass only pulls newly published RRD points. WAL plus `PRAGMA synchronous = NORMAL` are now enabled on `perf.db` for write throughput.
- **Retention/rollup:** raw samples kept short (e.g. 7 days) with hourly-rollup aggregates kept longer (e.g. 90 days) — a dedicated domain in Initiative 7's `retention_policies`, not a separate mechanism. Both halves are now shipped through the `metric-samples` and `metric-hourly-rollups` retention domains.
- **Client:** extends `CapacityView.js` and the existing host/VM property floating windows with real Chart.js time-series graphs (CPU%, memory, network tx/rx/errors, storage IOPS/latency) and a time-range picker (1h/6h/24h/7d/30d) against a new `server/routes/metrics.js`.
- **Alerting tie-in:** threshold breaches on stored samples feed the existing `alerts.js` service directly — reuses the shipped Alerts Center instead of building a second notification path. The first host-memory and SR-utilization thresholds are now shipped; broader metric coverage still belongs to the deeper RRD expansion.

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

## Competitive Analysis & Feature Gap Assessment (August 2026)

### VMware Cloud Automation (Aria Automation / VCF Automation)

**What it is:** VMware's cloud automation platform (formerly vRealize Automation), now rebranded as VCF Automation within VMware Cloud Foundation. It provides self-service provisioning, policy-based governance, IaC, and multi-cloud orchestration. Bundled into VCF at ~$350/core/yr — NOT available standalone.

**Licensing context:** Aria Automation is only sold as part of VCF (~$350/core/yr). It is NOT included in vSphere Foundation (~$135/core), vSphere Standard, or Enterprise Plus. XenMange can compete on licensing flexibility for organizations not invested in the full VMware SDDC stack.

#### Features Where Aria Automation Leads

| Category | Aria Automation Feature | XenMange Current State | Gap |
|----------|------------------------|----------------------|-----|
| **Self-Service Portal** | Service Broker catalog with drag-and-drop custom forms, content sources, project-based entitlements, email notifications, dark mode branding | No self-service catalog yet | HIGH — build a self-service VM deployment portal with catalog, quotas, and custom forms |
| **IaC — Blueprints** | YAML cloud templates with visual drag-and-drop designer, conditional logic, multi-cloud resource types, inputs/outputs | JSON compose templates designed but not built | HIGH — accelerate Initiative 3 (VM Deployment System) and Initiative 4 (Template Library) |
| **Terraform Integration** | Native: embed .tf in blueprints, multiple TF versions, Git-backed state, Terraform Service Broker | No Terraform support | HIGH — see Terraform Integration section below |
| **Ansible Integration** | Native integration with Ansible Tower/AAP and open-source; job templates, host variable injection, post-provision execution | No Ansible support | MEDIUM — add Ansible webhook/playbook execution for post-provision configuration |
| **SaltStack Config** | Built-in config management: state enforcement, drift remediation, event-driven automation, minion deployment at VM provision time | No config management integration | MEDIUM — add config management plugin architecture |
| **Approval Workflows** | Multi-level approval chains, user/role-based approvers, all-must-approve vs any-one, auto-expiry with auto-approve/reject, email notifications, approval inbox | Single-level approval with token lifecycle | MEDIUM — extend to multi-level chains with auto-expiry and email notifications |
| **Cost Management** | Showback/chargeback dashboards, pricing cards, cost drivers, VM cost distribution, rightsizing recommendations, FinOps dashboards, anomaly detection | No cost visibility | MEDIUM — add basic cost estimation based on allocated resources and configurable rates |
| **Multi-Tenancy** | Organization-level tenancy via vIDM, project-based isolation, branded tenant portals, resource isolation, federated multi-instance | Local users/groups only, no project/tenant model | LOW — the current RBAC model is sufficient for most XenServer deployments |
| **Policy Engine** | Approval policies, lease policies (auto-expiry/reclaim), resource quotas, infrastructure placement policies (affinity/anti-affinity), tag-based placement | Pool quotas and destructive-action approval | MEDIUM — add lease policies for auto-reclamation and VM affinity/anti-affinity rules |
| **Compliance/Guardrails** | Aria Guardrails: CIS/DISA/PCI/HIPAA/SOX templates (1200+ rules), continuous drift detection, auto-remediation, CSPM | Lifecycle compliance workbench (shipped) | LOW — our lifecycle workbench covers the core need; formal compliance templates are enterprise-only |
| **AI/ML Operations** | Aria Ops: predictive analytics, intent-based placement, smart alerts, what-if capacity, anomaly prediction | Capacity workspace with trend analysis | LOW — our telemetry collector and capacity workspace provide the foundation |
| **Network Automation** | Deep NSX integration: on-demand networks, security groups, distributed firewall, load balancer provisioning, Day 2 network actions | Read-only network topology views | MEDIUM — add network create/destroy, VLAN creation, bond management |
| **ABX (Serverless FaaS)** | Action-Based Extensibility: Python/Node/PowerShell functions triggered by lifecycle events | No extensibility framework | LOW — webhook-based extensibility is more practical for our scale |
| **XoS (Anything as a Service)** | Expose any vRO workflow as a catalog item with custom forms | Not applicable | LOW — XenServer doesn't have vRO-equivalent workflows |

#### Features Where XenMange Already Leads or Is Competitive

| Category | XenMange Advantage |
|----------|-------------------|
| **XenServer Native Support** | Aria Automation does NOT support XenServer/XCP-ng at all. Zero overlap. This is our strongest differentiator for any XenServer shop. |
| **Integrated Monitoring** | Our telemetry collector, metrics history, and capacity workspace are built-in. Aria requires a separate Aria Operations deployment. |
| **Governance & Audit** | Our lifecycle compliance workbench, remediation templates, and audit trail are genuinely unique in the XenServer ecosystem. No equivalent exists in XO or native tools. |
| **Modern UI** | Dark glassmorphic theme with dense information density. Aria's UI is functional but enterprise-generic. |
| **Credential Vault** | Envelope encryption with key rotation. Aria relies on vIDM/vSphere SSO. |
| **Simplicity** | Single-process Node.js app vs Aria's multi-appliance deployment (vIDM, vRA, vRO, Aria Ops). |

---

### XenOrchestra (XO) by Vates

**What it is:** The primary open-source web management platform for XenServer/XCP-ng. AGPL v3 licensed, with commercial support bundles from Vates (€2,000-1,800/host/yr). GitHub: 984 stars, 318 forks, 17,577 commits. Ships three UIs: XO 6 (modern), XO 5 (legacy), XO Lite (browser-based for small pools).

**Licensing context:** AGPL v3 open source core with no feature gating on source installs. Commercial bundles (Essential €2,000/yr max 3 hosts → Enterprise €1,800/host/yr min 4 hosts) add professional support, not features. Essential tier is limited (no warm migration, no S3 backup, no SDN controller, no self-service).

#### Features Where XenOrchestra Leads

| Category | XO Feature | XenMange Current State | Gap |
|----------|-----------|----------------------|-----|
| **Backup & DR** | 5+ backup strategies (rolling snapshots, full, delta/incremental, full replication, incremental replication, continuous replication, mirror), CBT+NBD acceleration, S3/NFS/SMB/Azure targets, ChaCha20-Poly1305 encryption, file-level restore, backup proxy, backup verification, chained jobs, smart backup (tag-based selection), GFS retention, backup reports to Slack/email | No backup management | HIGH — this is XO's strongest differentiator. Build backup job management, scheduling, and monitoring. Even without implementing the backup engine itself, exposing XAPI's VMPP/VMSS snapshot schedules and backup status would close a significant gap. |
| **RBAC (ACL v2)** | Fine-grained: per-object, per-action, with selectors (VMs tagged `qa`, VMs by power state, VMs by creator), custom roles with copy-from-template, built-in template roles (Pool Admin, Network Admin, VM Admin), delegate RBAC management to trusted operators | Three roles (read-only/operator/admin) with no object-level scoping | MEDIUM — extend to object-level ACLs with selector-based permissions |
| **Load Balancing** | XO load balancer plugin: Performance/Density/Mixed modes, anti-affinity rules, threshold-based triggering, scheduled mode changes, migration cooldown, max concurrent migrations | No load balancing | MEDIUM — surface XAPI's host stats for manual placement decisions; WLB integration later |
| **SDN Controller** | Built-in: GRE/VXLAN tunnels, OpenFlow rules, cross-pool private networks, automated VLAN management | Read-only network topology | LOW — requires dedicated SDN controller infrastructure |
| **Multi-Pool Management** | Single XO instance manages unlimited pools across sites (LAN/WAN), cross-pool warm migration, centralized backup orchestration, XO Proxy for remote sites | Multi-target attachment per session (shipped) | LOW — already shipped; XO Proxy equivalent is not needed for our use case |
| **Self-Service** | Resource sets with CPU/memory/storage/network quotas, delegated VM creation, usage tracking, Cloud-Init integration | Pool quotas in governance | MEDIUM — build a self-service portal with resource-set-style delegation |
| **Automation/DevOps** | Terraform provider (843K+ downloads), Ansible dynamic inventory, Pulumi provider, Packer plugin, PowerShell module, Kubernetes recipes, MCP server | No Terraform/Ansible/Pulumi integration | HIGH — see Terraform Integration section below |
| **REST API** | Full REST at `/rest/v0/`, OpenAPI/Swagger docs, SSE event streaming, NDJSON streaming, AI-friendly Markdown output, RBAC integration for API users | REST API exists but no OpenAPI docs, no SSE, no NDJSON | MEDIUM — add OpenAPI spec generation and SSE for real-time updates |
| **XO Hub** | Browse/download pre-packaged VM templates, community-contributed images | Template governance (shipped) but no template marketplace | LOW — our governance model is more enterprise-appropriate |
| **V2V Migration** | Import from VMware ESXi directly into XCP-ng pools | XVA import only | LOW — V2V is a niche need |
| **CBT Management** | Change Block Tracking management UI, VDI coalescing, orphaned VDI detection, VHD chain optimization | No CBT UI | MEDIUM — expose CBT status and optimization in the Storage workspace |
| **Rolling Pool Update** | Automated host-by-host upgrade with VM evacuation, pre-checks, rollback | Host maintenance mode (shipped) but no automated RPU | MEDIUM — build rolling update orchestration using existing maintenance mode |
| **Reporting** | OpenMetrics export for Prometheus/Grafana, infrastructure reports, scheduled report delivery, backup reports | Log export (JSON/HTML/PDF) | LOW — our log export covers audit needs; Prometheus integration is a nice-to-have |

#### Features Where XenMange Leads or Is Competitive

| Category | XenMange Advantage |
|----------|-------------------|
| **Governance & Compliance** | Our lifecycle compliance workbench, remediation templates bridging alerts→tasks→lifecycle/resilience, and approval workflows have no equivalent in XO. XO has basic ACLs but no compliance scanning or remediation orchestration. |
| **Modern UI/UX** | Dark glassmorphic theme with dense information density. XO 6 is functional but utilitarian. Our UI is designed for operators who live in the tool all day. |
| **Telemetry & Capacity** | Built-in metrics collector with hourly rollups, capacity workspace with noisy-neighbor detection and trend analysis. XO relies on third-party tools (DC Scope from EasyVirt) for deeper analytics. |
| **Credential Vault** | AES-256-GCM envelope encryption with key rotation. XO stores credentials differently depending on deployment. |
| **Alert Intelligence** | Our alert center with policy matching, remediation templates, and deep-linking into affected objects is more sophisticated than XO's basic perf-alert plugin. |
| **Audit Trail** | Comprehensive audit logging across all operations with federated log center and PDF export. XO has an audit plugin but it's less integrated. |

---

### XenServer/XCP-ng Native Capabilities

**Key native capabilities relevant to competitive positioning:**

| Capability | Details | XenMange Implication |
|-----------|---------|---------------------|
| **XenAPI (JSON-RPC v2.0)** | 60+ object classes, full CRUD + lifecycle, event subscription, async task tracking | XenMange already speaks this natively via xenapi.js |
| **xe CLI** | Full API coverage, scriptable, `--minimal` for machine output | XenMange provides the GUI abstraction layer for these operations |
| **cloud-init** | First-boot guest customization (hostname, SSH keys, packages, network) | Surface cloud-init parameters in VM creation forms |
| **HA** | Pool-level automatic VM restart on host failure, restart priority settings | Already displayed in Resilience workspace; add configuration controls |
| **Live Patching** | Kernel/Xen hypervisor updates without host reboot (XenServer 8+) | Surface live-patch status in host details |
| **Rolling Pool Upgrade** | Automated host-by-host upgrade with evacuation, pre-checks, rollback | Build orchestration on top of existing maintenance mode |
| **VMPP/VMSS** | Automated snapshot creation/deletion policies per VM | Expose and manage snapshot schedules from the UI |
| **Event System** | Real-time object change notifications via `event.from()` | Use for live dashboard updates instead of polling |
| **Terraform Provider** | Official `xenserver/xenserver` provider (65K+ downloads, v0.2.2) | See Terraform Integration section below |
| **Ansible Modules** | `community.general.xenserver_guest`, `_powerstate`, `_info` | Limited: VM-only, no host/storage/network modules |
| **SMAPIv3** | Next-gen storage stack: split volume/datapath plugins, NBD, raw/qcow2/VHD | Plan for future storage backend compatibility |

---

## Terraform Integration Plan

### Research Summary

Two Terraform providers exist for XenServer/XCP-ng:

#### 1. Official XenServer Provider (`xenserver/xenserver`)
- **Status:** Official, maintained by Citrix/Vates, v0.2.2 (March 2025)
- **Downloads:** 65K+
- **Resources:** `xenserver_vm`, `xenserver_vdi`, `xenserver_sr`, `xenserver_sr_nfs`, `xenserver_network`, `xenserver_network_vlan`, `xenserver_snapshot`
- **Data Sources:** `xenserver_vm`, `xenserver_sr`, `xenserver_network`, `xenserver_nic`, `xenserver_pif`
- **Capabilities:** VM creation from templates, disk/network attachment, snapshot management, NFS/SMB/iSCSI SR creation, host pool management, UEFI/secure boot
- **Limitations:** Young provider (v0.2.2), limited resource coverage, no load balancer or HA resources

#### 2. Xen Orchestra Provider (`vatesfr/xenorchestra`)
- **Status:** Official, maintained by Vates, v0.40+, WebSocket-based
- **Resources:** `xenorchestra_vm`, `xenorchestra_cloud_config`, pool/network/SR/ACL/resource-set data sources
- **Advantages:** Cloud-init built-in, resource sets for quota enforcement, ACL management, works through XO's abstraction
- **Limitations:** Requires XO as intermediary, WebSocket transport (less standard than HTTPS)

### Recommended Integration Approach

**Phase 1: Terraform Provider Exposure (MEDIUM priority)**

Expose XenMange's REST API as a Terraform-compatible endpoint. This allows users to write `.tf` files that target XenMange instead of directly targeting XAPI, gaining XenMange's governance, audit, and credential vault benefits.

- **New route:** `POST /api/terraform` implementing the Terraform HTTP Backend protocol
- **State management:** Store Terraform state in `xenmange.db` (new `terraform_states` table)
- **Provider registration:** Document XenMange as a Terraform-compatible endpoint using the `http` or `rest` provider
- **Benefits over direct XAPI:** Governance approval gating, audit trail, credential vault integration, pool quota enforcement

```sql
-- xenmange.db
CREATE TABLE terraform_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  state_json TEXT NOT NULL,
  lock_id TEXT,
  lock_expires_at DATETIME,
  owner_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Phase 2: Terraform Module Library (LOW priority)**

Provide pre-built Terraform modules for common XenServer patterns:

- `modules/xenmange-vm` — VM creation with governance-aware placement
- `modules/xenmange-pool` — Pool configuration with HA and quota enforcement
- `modules/xenmange-network` — Network/VLAN creation with approval gating
- `modules/xenmange-storage` — SR creation with credential vault integration

**Phase 3: Terraform Plan/Apply Visibility (MEDIUM priority)**

Surface Terraform operations in the Activity workspace:

- Log Terraform plan/apply/destroy operations in the audit trail
- Show pending changes in the dashboard
- Surface Terraform state drift as alerts
- Integration with the governance approval workflow for destructive Terraform operations

### Why Not Just Use the Official Provider Directly?

The official `xenserver/xenserver` provider talks directly to XAPI, bypassing XenMange entirely. This means:
- No governance approval gating
- No audit trail in XenMange
- No credential vault integration (must store XenServer credentials in Terraform state or env vars)
- No pool quota enforcement
- No visibility into Terraform-managed resources in the XenMange UI

By providing a Terraform-compatible API layer, XenMange becomes the control plane through which all XenServer operations flow, whether initiated from the GUI, the REST API, or Terraform.

---

## Full Resource Configuration Parity

### Objective

Ensure that pools, hosts, virtual machines, networks, and storage repositories have ALL of their XenServer/XAPI configuration options available for modification through the XenMange GUI. Every field exposed by XenAPI records should be editable where it is safe and meaningful to do so.

### UI Control Requirements

- **No checkboxes.** All boolean toggle controls must use dense iOS-style switches (compact, track-aligned, with labeled on/off states).
- **Dropdowns where applicable.** All enumeration fields, select-from-list options, and multi-choice controls must use styled dropdown selects with search/filter capability for long lists.
- **Consistent glassmorphic styling.** All controls must match the existing dark glassmorphic theme with neon green accents, backdrop blur, and the established component patterns.
- **Dense layout.** Forms should minimize whitespace, use compact field spacing, and present related fields in logical groups/tabs to avoid excessive scrolling.

### Per-Resource Configuration Coverage

#### Pool Configuration (Currently: minimal)

| XenAPI Field | Current State | Required Action |
|-------------|---------------|----------------|
| `name_label` | Not editable | Add pool name edit |
| `name_description` | Not editable | Add pool description edit |
| `default_SR` | Displayed only | Add SR picker for default SR assignment |
| `other_config` | Not exposed | Add key-value editor for custom metadata |
| `ha_enabled` | Displayed only | Add HA enable/disable toggle switch |
| `ha_host_failures_to_tolerate` | Not exposed | Add numeric input for failure tolerance |
| `ha_restart_priority` | Not exposed | Add dropdown for restart priority per-VM |
| `wlb_enabled` | Not exposed | Add WLB enable/disable switch (if WLB appliance present) |
| `wlb_url` | Not exposed | Add WLB URL configuration field |
| `vswitch_controller` | Not exposed | Add vSwitch controller URL field |
| `IGMP_snooping_enabled` | Not exposed | Add IGMP snooping toggle switch |
| `cross_pool_migrate_enabled` | Not exposed | Add cross-pool migration toggle |
| `cpu_count` / `vCPU_count` | Read-only | Display only (pool-level CPU count is informational) |
| `memory_total` | Read-only | Display only |
| `tags` | Not exposed | Add tag editor (comma-separated or chip input) |

#### Host Configuration (Currently: basic)

| XenAPI Field | Current State | Required Action |
|-------------|---------------|----------------|
| `name_label` | Editable | Verify working |
| `name_description` | Not editable | Add description edit |
| `enabled` | Maintenance mode toggle | Verify working |
| `ha_host_failures_to_tolerate` | Not exposed | Add numeric input |
| `elite_fencing` | Not exposed | Add advanced HA fencing toggle |
| `external_auth_type` | Not exposed | Add auth type display/config |
| `external_auth_service_name` | Not exposed | Add auth service configuration |
| `license_server` | Not exposed | Add license server display |
| `edition` | Read-only | Display license edition |
| `cpu_info` | Read-only | Display CPU info (sockets, cores, features) |
| `software_version` | Read-only | Display version info |
| `logging` | Not exposed | Add logging level configuration |
| `ssl_legacy` | Not exposed | Add SSL legacy mode toggle (with warning) |
| `guest_vcpus_params` | Not exposed | Add vCPU parameter configuration |
| `sched_granularity` | Not exposed | Add scheduler granularity dropdown |
| `virtual_hardware_platform_versions` | Not-only | Display supported HW versions |
| `bios_strings` | Not exposed | Add BIOS string editor |
| `tags` | Not exposed | Add tag editor |

#### VM Configuration (Currently: good coverage, gaps remain)

| XenAPI Field | Current State | Required Action |
|-------------|---------------|----------------|
| `name_label` | Editable | Verify working |
| `name_description` | Editable | Verify working |
| `user_version` | Not exposed | Add version tag field |
| `is_a_template` | Not editable (by design) | N/A |
| `affinity` | Migration tab only | Add persistent affinity host selector in VM config |
| `memory_static_max` | Editable | Verify working |
| `memory_dynamic_max` | Editable | Verify working |
| `memory_dynamic_min` | Editable | Verify working |
| `memory_static_min` | Not exposed | Add static min memory field |
| `vcpus_at_startup` | Editable | Verify working |
| `vcpus_max` | Editable | Verify working |
| `vcpus_params` | Not exposed | Add per-vCPU weight/cap configuration |
| `platform` | Not exposed | Add platform options (nx, acpi, apic, pae, viridian, etc.) as iOS-style switch grid |
| `other_config` | Not exposed | Add key-value metadata editor |
| `xenstore_data` | Not exposed | Add XenStore key-value editor (advanced) |
| `recommendations` | Read-only | Display only |
| `tags` | Not exposed | Add tag editor (chip input) |
| `guest_metrics` | Read-only | Display only (guest OS, tools version, IP, etc.) |
| `protection_policy` | Not exposed | Add VMPP/VMSS assignment dropdown |
| `snapshot_schedule` | Not exposed | Add snapshot schedule picker |
| `appliance` | Not exposed | Add VM appliance (group) assignment |
| `start_delay` | Not exposed | Add start delay (seconds) numeric input |
| `shutdown_delay` | Not exposed | Add shutdown delay (seconds) numeric input |
| `order` | Not exposed | Add boot order numeric input |
| `blocked_operations` | Not exposed | Add blocked operations multi-select (start, shutdown, migrate, etc.) |
| `video_ram` | Not exposed | Add video RAM allocation field |
| `igd_passthru` | Not exposed | Add IGD passthrough toggle switch |
| `has_vendor_device` | Not exposed | Add vendor device toggle switch |
| `hardware_platform_version` | Not exposed | Add HW platform version dropdown |
| `nvram` | Not exposed | Add NVRAM/UEFI variable editor |
| `secure_boot` | Not exposed | Add Secure Boot toggle switch |
| `domains_type` | Not exposed | Add domain type dropdown (HVM, PV, PVH) |

#### Network Configuration (Currently: read-only)

| XenAPI Field | Current State | Required Action |
|-------------|---------------|----------------|
| `name_label` | Read-only | Add network name edit |
| `name_description` | Read-only | Add description edit |
| `bridge` | Read-only | Display only (system-managed) |
| `MTU` | Not exposed | Add MTU numeric input |
| `other_config` | Not exposed | Add key-value editor |
| `tags` | Not exposed | Add tag editor |
| `default_locking_mode` | Not exposed | Add locking mode dropdown (unlocked, disabled, locked) |
| `purpose` | Not exposed | Add purpose display/editor |

**Plus write operations:**

| Operation | Current State | Required Action |
|-----------|---------------|----------------|
| Create network | Not supported | Add network creation form (name, description, MTU, bridge) |
| Create VLAN | Not supported | Add VLAN creation form (PIF selector, VLAN ID, network) |
| Create bond | Not supported | Add bond creation form (PIF multi-select, mode dropdown: balance-slb, active-backup, lacp) |
| Destroy network | Not supported | Add network deletion with governance approval |
| Manage VIFs | Read-only | Add VIF create/disconnect/delete operations |

#### Storage Configuration (Currently: read-only display)

| XenAPI Field | Current State | Required Action |
|-------------|---------------|----------------|
| `name_label` | Read-only | Add SR name edit |
| `name_description` | Read-only | Add description edit |
| `type` | Read-only | Display only |
| `content_type` | Read-only | Display only |
| `physical_size` | Read-only | Display only |
| `virtual_allocation` | Read-only | Display only |
| `tags` | Not exposed | Add tag editor |
| `other_config` | Not exposed | Add key-value editor |
| `shared` | Read-only | Display only |
| `local_cache_enabled` | Not exposed | Add local cache toggle switch |

**Plus write operations:**

| Operation | Current State | Required Action |
|-----------|---------------|----------------|
| Create SR | Top-level SR creation shipped with host placement plus `nfs` / `lvmoiscsi` / `ext` / `lvm` device-config forms | Broaden into richer attach/probe parity and any remaining SR lifecycle follow-ons |
| Destroy SR | Detail-level SR destruction with governance approval and an empty-repository safety check shipped in Storage details | Broaden into broader SR creation/lifecycle parity |
| Rescan SR | Selected-row and detail-level rescans shipped | Broaden into the remaining SR lifecycle actions |
| Forget SR | Detail-level SR forget with confirmation and governance approval shipped in Storage details | Broaden into the remaining SR lifecycle actions |
| Repair SR | Detail-level SR repair shipped with `SR.update` plus detached-`PBD` replugging in Storage details | Broaden into richer attach/probe parity and any remaining SR lifecycle follow-ons |
| VDI create | Detached VDI creation shipped in Storage details | Broaden into attachment-aware create flows and the remaining VDI lifecycle actions |
| VDI resize | Detail-level VDI resize plus attachment-aware in-workspace guidance shipped in Storage details | Broaden into richer attachment-aware lifecycle parity beyond the initial resize guidance |
| VDI delete | Detail-level VDI deletion with governance approval plus attached-disk safety gating shipped in Storage details | Broaden into richer attachment-aware lifecycle parity beyond the initial delete safeguards |

### Implementation Approach

1. **Server layer:** Extend existing route modules (`pools.js`, `hosts.js`, `vms.js`, `networks.js`, `storage.js`) with PUT/PATCH endpoints for each resource type. Each endpoint validates input with Joi schemas matching XenAPI field types and constraints.

2. **Service layer:** Extend `xenapi.js` with typed wrapper methods for each XenAPI field update (e.g., `pool.set_name_label()`, `VM.set_platform()`, `network.set_MTU()`).

3. **Client layer:** Create tabbed detail panels for each resource type with sections for general info, hardware config, advanced options, metadata, and operations. Use the existing FloatingWindow component with iOS-style switches for booleans, styled dropdowns for enumerations, and chip inputs for tags.

4. **Governance:** All write operations pass through `ensureMutationAllowed()`. Destructive operations (SR destroy, VDI delete, network destroy) require approval tokens.

---

## UI/UX Optimization Plan

### Objective

Audit the entire XenMange UI for wasted space, inconsistent styling, redundant forms, and interaction inefficiencies. Apply optimizations systematically across all workspaces and components.

### Audit Areas

#### 1. Form Consolidation & Density

| Area | Current State | Optimization |
|------|--------------|--------------|
| **VM Detail Tabs** | Protection, Migration, Clone/Copy, Import/Export, Compatibility, Console — each in separate FloatingWindows | Combine related operations into tabbed panels within a single FloatingWindow: "Operations" tab (Migration + Clone/Copy + Import/Export), "Protection" tab (Snapshots + Checkpoints), "Compatibility" tab (host matrix + console) |
| **Host Detail** | Separate maintenance/power controls | Consolidate into a single "Operations" panel with maintenance mode section, power actions section, and live metrics section |
| **Connection Forms** | Pool registration, host registration, credential forms are separate | Consolidate into a single "Add Target" form with mode selector (Pool vs Standalone Host) and optional saved credential picker |
| **Settings Sections** | Collapsible sections but each saves independently | Keep section saves but add a "Save All" option and visual indicator of unsaved changes per section |
| **Governance Forms** | Policy, quotas, approval queue, user management, group management in separate floating windows | Organize into a tabbed governance panel: Policy tab, Quotas tab, Users tab, Groups tab, Approvals tab |
| **Alert Forms** | State form, policy form, remediation task form, remediation template form are separate | Consolidate into a single alert detail panel with tabbed sections: State, Policy, Remediation |
| **Login Flow** | Separate connection login and Xen login | Single unified login with "Connect to XenServer" as a secondary step after control-plane auth |

#### 2. Navigation Optimization

| Area | Current State | Optimization |
|------|--------------|--------------|
| **SideNav Tree** | Collapsible sections but deep nesting | Flatten to 2 levels max; use icon badges for counts (VMs: 42, Hosts: 8) |
| **TopNav** | Target selector, role indicator, user menu | Add quick-action buttons: "New VM", "Add Connection", "Search" directly in TopNav |
| **Breadcrumbs** | Not present | Add breadcrumb trail below TopNav for context: Home > Pool A > Host 1 > VM web-01 |
| **Keyboard Shortcuts** | Not implemented | Add Cmd/Ctrl+K for global search, Cmd/Ctrl+N for new resource, Escape to close dialogs |
| **Workspace Tabs** | Clicking a nav item replaces the main view | Support multiple open workspaces as tabs (like browser tabs) for operators who need to cross-reference |

#### 3. Data Presentation

| Area | Current State | Optimization |
|------|--------------|--------------|
| **DataTable Width** | Full-width tables | Use compact mode with truncated columns and hover-expand for long values |
| **Status Badges** | Color-coded text badges | Add animated pulse for critical states (host down, VM crashed) |
| **Metric Cards** | Static trend cards | Add sparkline mini-charts inline in DataTable rows for at-a-glance trends |
| **Empty States** | Generic "No data" | Add contextual illustrations and action buttons ("No VMs connected. Connect to a XenServer pool to get started.") |
| **Error Messages** | Toast notifications | Add inline error states within forms with specific recovery suggestions |
| **Loading States** | Spinner | Add skeleton placeholders matching the glassmorphic theme |
| **Confirmation Dialogs** | Browser `confirm()` | Replace with styled FloatingWindow confirmations matching the glassmorphic theme |

#### 4. Styling Consistency

| Area | Current State | Optimization |
|------|--------------|--------------|
| **Font Sizes** | Mix of px, rem, and pt units | Standardize on rem units with a base 16px root |
| **Spacing** | Variable padding/margin | Define a spacing scale (4px, 8px, 12px, 16px, 24px, 32px) and use consistently |
| **Border Radius** | Mix of values | Standardize: 4px for inputs, 8px for cards, 12px for dialogs, 16px for panels |
| **Box Shadows** | Variable glow effects | Define shadow tokens: sm (subtle), md (default), lg (elevated), glow-green (accent) |
| **Color Usage** | Green for primary, variable for others | Define semantic color tokens: --color-success (#0a0), --color-warning (#f9a825), --color-error (#e53935), --color-info (#1565c0) |
| **Transitions** | Variable durations | Standardize: 150ms for micro-interactions, 250ms for page transitions, 350ms for dialog open/close |
| **Dark Mode** | Built-in (dark is default) | Verify all new components match the dark theme; add a light mode toggle as a future enhancement |

#### 5. Responsive Design

| Area | Current State | Optimization |
|------|--------------|--------------|
| **Mobile** | Not optimized | Add responsive breakpoints: mobile (<768px) collapses SideNav to icons, tablet (768-1024px) shows SideNav overlay, desktop (>1024px) full layout |
| **Dialog Sizing** | Fixed pixel sizes | Use responsive sizing: max-width with percentage fallbacks |
| **Table Scroll** | Horizontal scroll on overflow | Add sticky first column (resource name) and sticky action column on horizontal scroll |
| **Keyboard Navigation** | Not implemented | Add tab order, focus traps in dialogs, arrow key navigation in DataTables |

#### 6. Interaction Patterns

| Area | Current State | Optimization |
|------|--------------|--------------|
| **Batch Operations** | Bulk alert triage, selected VM power actions, selected host maintenance, and selected storage rescans shipped | Extend the same selection rails into the remaining lifecycle, storage, and networking actions |
| **Drag & Drop** | Dashboard cards only | Add drag-to-reorder in SideNav favorites, drag VM to host for migration, drag VDI to VM for attachment |
| **Inline Editing** | Not implemented | Enable inline editing of name/description fields in DataTables (click to edit, not a separate form) |
| **Undo** | Not implemented | Add client-side undo for recent operations (5-second undo window before server-side execution) |
| **Context Menus** | Not implemented | Add right-click context menus on DataTable rows with common operations |
| **Quick Actions** | Power buttons only | Add hover-reveal action bar on each DataTable row: Power, Migrate, Snapshot, Console, Delete |

### Implementation Priority

1. **HIGH:** Form consolidation (reduces click depth for common operations), iOS-style switches replacing checkboxes, styled dropdown replacements, confirmation dialog styling
2. **MEDIUM:** Inline editing, batch operations extension, context menus, quick action bars, skeleton loading states, empty state illustrations
3. **LOW:** Keyboard shortcuts, workspace tabs, light mode toggle, responsive breakpoints, drag-and-drop extensions

---

## Progress Log

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation | 🟨 In Progress | Local build pipeline, CSP-safe asset delivery, generated project-owned background art, and SQLite-backed durable session storage added |
| Phase 2: API Integration | 🟨 In Progress | Core auth/resource routes implemented; connection validation/defaulting, template inventory access, task/activity data, centralized log aggregation/export, persisted metrics history APIs, alert/lifecycle/governance state persistence, remediation task and remediation template creation/listing/updating, alert policy and bulk-triage endpoints, quota enforcement, approval gating, resilience synthesis, audited system-settings/retention endpoints, VM snapshot/checkpoint lifecycle routes, VM clone/full-copy duplication routes, VM import/export routes, VM migration routes, host maintenance/power-operation routes, SR create/repair/rescan/forget/destroy routes, detached storage VDI create routes, storage VDI resize routes, and storage VDI delete routes added |
| Phase 3: UI Core | 🟨 In Progress | Floating windows, saved targets, live inventory tree, SSR auth bootstrap, stronger visual shell layering, modular client source extraction into core/components/views/forms, a dedicated Settings workspace, the Activity log-center mode, and reusable telemetry trend cards added |
| Phase 4: Dashboard | 🟨 In Progress | Summary drag/reorder support, operational panels, alert triage, recent task visibility, governance role surfacing, and dashboard action rails into capacity/activity/templates/alerts added |
| Phase 5: Resource Views | 🟨 In Progress | Pools view, templates view, inventory/alerts/activity/governance/lifecycle/capacity/resilience workbenches, API-backed governance/alert policy/lifecycle planning, centralized log exports, persisted capacity/history views for cluster-host-vm-storage telemetry, bulk alert triage, remediation task creation/management plus reusable templates, task-level automation staging for evidence/completion criteria, exact-record deep linking, inventory subobject indexing for VDI/VBD/VIF/PIF, richer host/storage/network floating windows, a VM Protection tab for snapshot/checkpoint recovery points, a VM Migration tab for same-pool plus cross-pool/storage-remapped moves, a VM Clone / Copy tab for fast clones plus full copies, a VM Import / Export tab plus top-level XVA import flow, host maintenance/power controls in the Host details workspace, shared dense switch styling across those new host/VM operation forms, an initial batch VM power-action rail driven by table selection, selected-row host maintenance entry/exit controls in the Hosts workspace, selected-row storage rescan controls in the Storage workspace, a top-level storage SR creation rail, and Storage detail operations for in-place repair/rescans, SR forget/destroy, plus detached VDI create/resize/delete flows with attached-delete safeguards added |
| Phase 6: Polish & Testing | 🟨 In Progress | Client bundle, focused Jest coverage for migration validation/XenAPI/route orchestration, and the Playwright coverage now includes same-pool plus cross-pool VM migration paths alongside import/export, snapshot/clone coverage, the host maintenance workflow, the newly normalized dense-switch operator controls, the first selected-row batch VM action path, isolated selected-row host maintenance batching, isolated selected-row storage rescans, isolated storage SR creation, and isolated storage detail operations for SR repair/forget/destroy plus detached VDI creation, VDI resize, attached-VDI delete safeguards, detached VDI deletion, and in-place rescans; full-suite verification should still be rerun after each remaining parity slice because client component unit depth and broader operational route coverage still remain |
