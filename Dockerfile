# syntax=docker/dockerfile:1

# ---- Base -------------------------------------------------------------
# Debian slim (glibc) instead of alpine: better-sqlite3 compiles its native
# addon against glibc and this avoids musl-related build/runtime issues.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ---- Dependencies (with dev deps, for the client build step) ----------
FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build the Vue client bundle --------------------------------------
FROM deps AS build
COPY . .
RUN npm run build:client

# ---- Prune to production-only node_modules -----------------------------
FROM deps AS prod-deps
RUN npm prune --omit=dev

# ---- Runtime ------------------------------------------------------------
FROM base AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 xenmange \
  && useradd --system --uid 1001 --gid xenmange --home-dir /app --shell /usr/sbin/nologin xenmange

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./package.json
COPY server ./server
COPY client ./client
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/data && chown -R xenmange:xenmange /app

USER xenmange

ENV PORT=3000 \
    DB_PATH=/app/data/xenmange.db \
    SECURITY_DB_PATH=/app/data/security.db \
    VAULT_DB_PATH=/app/data/vault.db \
    PERF_DB_PATH=/app/data/perf.db

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- --spider "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["node", "server/index.js"]
