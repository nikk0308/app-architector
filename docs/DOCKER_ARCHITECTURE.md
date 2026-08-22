# App Architector Docker architecture

## Runtime boundary

The production stack has two long-running containers:

- `web`: immutable React build served by Nginx on `127.0.0.1:3100`;
- `api`: Fastify, the Python generator, SQLite and generated ZIP handling.

Only `web` publishes a host port. It proxies `/api/*` to `api` over the private
Docker network. The host Nginx terminates TLS and proxies the public domain to
`127.0.0.1:3100`.

Persistent state is not stored in an image or release directory:

```text
/opt/docker-data/apparchitector/
├── app.db
├── app.db-shm
├── app.db-wal
└── generated/
```

Releases and backups are independent:

```text
/opt/docker-stacks/apparchitector.dev/
├── .runtime.env
├── current -> releases/sha-...
├── previous -> releases/sha-...
└── releases/

/opt/docker-backups/apparchitector/
└── app-YYYYMMDDTHHMMSSZ.db.gz
```

## Security choices

- application ports bind to loopback only;
- the API container has a read-only root filesystem;
- both containers drop Linux capabilities and enable `no-new-privileges`;
- application secrets live only in the server-owned `.runtime.env`;
- images are deployed by immutable digest;
- generated projects and SQLite are owned by UID/GID `10001`;
- Docker and Nginx logs go to standard output/error.

## Update and rollback

The workflow builds and tests source code, pushes two private GHCR images, then
uploads only the Compose manifest and deployment helpers. The remote script:

1. creates a consistent SQLite backup through `better-sqlite3`;
2. validates and pulls the candidate images;
3. starts the candidate under the existing Compose project;
4. checks container health, the web endpoint and API readiness;
5. records `current` and `previous` only after success;
6. restores the previous images automatically if smoke tests fail.

Rollback changes application images and configuration. It does not overwrite
the data directory. Restoring a SQLite backup is a separate, deliberate
operation.
