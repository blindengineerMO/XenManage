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

### Security

- Replaced inline-script CSP allowance with per-response nonces.
