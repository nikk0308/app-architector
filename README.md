# App Architector

App Architector converts questionnaire parameters into a validated starter
mobile-application architecture and downloadable ZIP. This repository contains
the original diploma application plus an isolated Docker production runtime.

## Local source verification

Requirements: Node.js 22 and Python 3.

```bash
npm ci
npm run verify:release
```

## Local Docker run

Copy `.runtime.env.example` to `.runtime.env`, create the storage directory and
run:

```bash
mkdir -p storage
LOCAL_UID="$(id -u)" LOCAL_GID="$(id -g)" \
  docker compose \
  --env-file .runtime.env \
  -f compose.yaml \
  -f compose.local.yaml \
  up --build
```

Open `http://127.0.0.1:3100`.

## Production layout

- public domain: `apparchitector.dev`;
- host entry point: Nginx with TLS;
- Docker entry point: `127.0.0.1:3100`;
- Compose project: `apparchitector`;
- persistent data: `/opt/docker-data/apparchitector`;
- releases: `/opt/docker-stacks/apparchitector.dev/releases`;
- backups: `/opt/docker-backups/apparchitector`.

See:

- `docs/DOCKER_ARCHITECTURE.md`;
- `docs/MIGRATION_TO_DOCKER.md`;
- `infra/nginx/apparchitector.dev.conf.example`.

## Repository settings for deployment

Create a GitHub `production` environment.

Variables:

- `DEPLOY_HOST`;
- `DEPLOY_USER`;
- `DEPLOY_PORT` (optional, defaults to `22`).

Secrets:

- `DEPLOY_SSH_PRIVATE_KEY`;
- `DEPLOY_KNOWN_HOSTS`.

The server must already have Docker Compose, host Nginx, Python 3, the runtime
environment file and the persistent directories. Server provisioning is kept
separate from application delivery on purpose.
