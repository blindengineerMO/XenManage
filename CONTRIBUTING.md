# Contributing to XenManage

## Local Setup

Use Node.js 22, then install dependencies with `npm ci`. Copy `.env.example` to `.env` for local development. Do not use production credentials or vault keys in a development environment.

Run `npm run dev` for iterative work. Before opening a pull request, run:

```bash
npm run lint
npm test -- --runInBand
npm run test:e2e
```

## Changes

Keep API changes validated with Joi and covered by a focused Jest test. Preserve the browser's ordered global-script build model unless a change also updates `scripts/build-client.js`. Mutations using session cookies must continue to use the shared API client so CSRF headers are sent.

Do not commit `.env`, SQLite databases, control-plane backup snapshots, or decrypted credential material. Treat changes to governance, authentication, vault, workflow, and destructive Xen operations as security-sensitive and include regression coverage.

## Pull Requests

Describe the operator-facing behavior, any API/configuration change, and how it was verified. Keep generated `client/dist` output out of manual edits; regenerate it through `npm run build:client`.
