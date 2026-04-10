# Intelligent Mobile Architecture Generator

A diploma-grade MVP that generates a starter mobile application architecture from a questionnaire.
The system is built as one deterministic generation platform with four profile adapters:

- Unity
- native iOS
- Flutter
- React Native

## Core idea

The generator builds a structured starter architecture instead of four separate full applications.

It generates:

- folder tree
- entry point
- navigation scaffold
- auth scaffold
- analytics hooks
- localization scaffold
- push placeholders
- network layer scaffold
- config and environment files
- state and service layer
- README
- zip archive

## Repository structure

- `apps/web` — React + Vite UI
- `apps/api` — Fastify API, SQLite metadata, orchestration layer
- `packages/shared` — questionnaire schema, profile builder, rule engine
- `services/generator-python` — deterministic file generator
- `config/artifact-registry.json` — universal-to-platform mapping
- `infra/deploy` — narrowed deployment layer for one Droplet and one domain
- `docs/deployment-digitalocean.md` — end-to-end deployment notes

## End-to-end pipeline

1. Frontend loads questionnaire schema from API.
2. User fills the multi-step questionnaire.
3. API builds a normalized configuration profile.
4. Rule engine converts it into an artifact plan.
5. Preview tree is resolved from the artifact registry.
6. API invokes the Python generator.
7. Python renders templates and creates the project tree.
8. Python builds a zip archive.
9. API stores metadata in SQLite and returns a download URL.

## Deterministic core

The deterministic core lives in `packages/shared` and `config/artifact-registry.json`.

- `buildConfigProfile()` normalizes questionnaire answers.
- `buildGenerationPlan()` creates the artifact list.
- registry mappings convert universal modules into platform-specific files.
- Python materializes files from the plan and templates.

## Local run

### Install

```bash
npm install
```

### Start API

```bash
cp .env.example .env
npm run dev:api
```

### Start web

```bash
npm run dev:web
```

### Endpoints

- web: `http://localhost:5173`
- api: `http://localhost:3000/api/health`

## Tests

```bash
npm test
```

Covered checks:

- config builder
- rule engine
- API smoke
- integration pipeline
- zip generation
- generated tree for all profiles

## Docker

```bash
cp .env.example .env
docker compose up --build
```

## DigitalOcean deployment

The repository includes a narrowed deployment layer extracted from the multi-site uploader and adapted for one app, one server and one domain.

Workflows:

- `01_bootstrap_server.yml`
- `02_enable_https.yml`
- `03_deploy.yml`

The deployment flow uses:

- one Droplet IP from GitHub Variables
- one domain from GitHub Variables
- one SSH private key from GitHub Secrets
- nginx for frontend hosting and `/api` reverse proxy
- systemd for the Node API
- persistent `shared/` storage for SQLite and generated archives

Full setup notes are in `docs/deployment-digitalocean.md`.

## Notes

Generated outputs are starter architecture scaffolds, not production-complete applications.
The goal of the project is to demonstrate a reusable generation platform and a clean cross-profile mapping model.
