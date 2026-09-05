# Changelog

All notable changes to XenManage are documented here.

## Unreleased

### Added

- Configurable undo delay for queued VM power operations.
- Global API rate limiting and session-bound CSRF protection.
- Health, readiness, and Prometheus metrics endpoints.
- Structured JSON logging, request IDs, optional Sentry error tracking, and graceful `SIGINT` shutdown.
- Admin-only control-plane SQLite snapshots and a systemd deployment template.
- GitHub Actions CI, Dependabot, ESLint, and expanded client API/undo unit coverage.
- Control-plane backup verification, restore preview, and scheduled snapshots.
- AES-256-GCM encryption at rest for control-plane backup snapshots, under a recovery key separate from the credential vault's key.
- Client-side API token management (issue, list, revoke) in the Governance Control Panel.
- A published `/api/v1` compatibility and deprecation policy, embedded in the OpenAPI document at `GET /api/v1/openapi.json`.
- Audit log entries created while a session is break-glass elevated are now tagged `breakGlassElevated: true`, with a matching badge in the Activity view.
- Replaced the last remaining browser `confirm()` dialog (retiring a catalog application) with the app's shared styled `ConfirmWindow` component.
- Inline editing now covers the description field (not just the name) on the Networks, Hosts, Pools, and Storage Repositories views.
- The shared `DataTable` loading state now shows shimmering skeleton placeholder rows instead of a centered spinner.
- `DataTable` columns can opt into truncation with a hover tooltip for the full value (`column.truncate: true`), now applied to UUID and Description columns across Networks, Hosts, Pools, Storage Repositories, and VMs.
- `DataTable`'s no-data row supports a contextual icon, message, and action button; VMs, Hosts, Networks, and Storage Repositories now show a resource-specific "Connect to a XenServer pool to get started." message with a "Go to Pools" button instead of a generic "No data available".
- The VMs table now has a hover-reveal per-row quick action bar (Start/Shutdown/Reboot/Suspend/Resume, plus Console/Migrate/Snapshot shortcuts that jump straight to the matching VM Properties tab), instead of requiring the full Properties dialog or a bulk selection for single-VM actions.
- The Networking workspace's Host Uplinks relationship pane now shows each PIF's device name, MAC address, and IP configuration (DHCP/static/none), not just the host it belongs to.
- Focused PIF/VIF/Bond/VLAN arrivals from Activity/Alerts can now resolve by UUID as well as by opaque reference.
- Host Uplinks rows in the Networking workspace now annotate bonded PIFs with their bond mode and live member count, and tagged VLAN sub-interfaces with their VLAN tag, instead of showing an unlabeled physical port.
- Host Uplinks rows now also show each PIF's live link state (up/down), negotiated speed/duplex, and current throughput (io_read_kbs/io_write_kbs), sourced from a single batched PIF_metrics read alongside the existing uplinks fetch.
- The Inventory workspace's Connection Atlas now shows a live pool/host/VM/alert count rollup for every currently-connected saved target, so operators can compare cluster health at a glance without switching the active connection.
- The Connection Atlas now also shows managed-target poller connectivity status (Healthy/Offline/Authentication Failed/etc.) for saved-but-not-connected targets that are registered as managed targets, instead of a generic "connect to view live status" prompt.
- Storage attachment rows now show each VBD's real device name, mode, bootable/plug state instead of inferring attachment from VM/VDI ref-list overlap, and correctly flag VDIs with no VBD attachment record at all rather than guessing a match. Focused VBD arrivals from Inventory now resolve by UUID as well as by opaque reference.
- Storage Repository properties now show a "Path Health" summary derived from each repository's real PBD attachment records, naming any host where the storage path is currently unplugged, instead of a bare attachment-path count with no health signal.
- The Attached VDIs list now resolves snapshot/clone lineage: a snapshot disk shows "Snapshot of <parent disk name>" (resolved from the real parent VDI record instead of a raw opaque ref), and a parent disk with existing snapshots shows how many. The per-disk attachment-count badge and delete-blocked reason also now read from the same real VBD-backed attachment data as the Attachment Topology section below them, instead of an inconsistent ref-list guess.
- Storage Attachment Topology rows now show each attached VBD's live read/write throughput, sourced from a batched VBD_metrics read, the same pattern already used for Host Uplink PIF throughput in Networking.
- Fixed the VDI delete safety check to use real VBD attachment records instead of an inferred ref-list guess, so a disk that appears attached in the UI can no longer be deleted through a stale enforcement path that disagreed with the display.
- The Activity task detail panel now resolves parent/subtask lineage from real Xen task records: a subtask shows "Subtask of <parent task name>" and a parent task shows how many subtasks exist under it, instead of leaving those relationships entirely unsurfaced.

### Security

- Replaced inline-script CSP allowance with per-response nonces.
