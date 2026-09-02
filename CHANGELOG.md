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

### Security

- Replaced inline-script CSP allowance with per-response nonces.
