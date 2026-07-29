FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN npm run build -w @mag/shared \
    && npm run build -w @mag/api \
    && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PYTHONNOUSERSITE=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=build --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=10001:10001 /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=10001:10001 /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=10001:10001 /app/packages/shared/dist ./packages/shared/dist
COPY --chown=10001:10001 config ./config
COPY --chown=10001:10001 services/generator-python ./services/generator-python
COPY --chown=10001:10001 scripts/container-healthcheck.mjs ./scripts/container-healthcheck.mjs
COPY --chown=10001:10001 scripts/deploy/backup-sqlite.mjs ./scripts/deploy/backup-sqlite.mjs

USER 10001:10001
EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
