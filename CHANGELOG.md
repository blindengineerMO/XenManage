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
- Client-side API token management (issue, list, revoke) in the Governance Control Panel.
- A published `/api/v1` compatibility and deprecation policy, embedded in the OpenAPI document at `GET /api/v1/openapi.json`.

### Security

- Replaced inline-script CSP allowance with per-response nonces.
