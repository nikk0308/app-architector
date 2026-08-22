# Migration from the current systemd deployment

Do not copy the committed `.env` from the old archive into Git. Recreate the
production values in the new server-owned `.runtime.env`.

## Data that must be migrated

From the old project root, preserve:

- `storage/app.db`;
- `storage/app.db-wal` and `storage/app.db-shm` when present;
- the complete `storage/generated/` directory;
- the old runtime environment file for manual secret transfer.

For a consistent final copy:

1. keep the old public application online while testing a copy on the new VPS;
2. before the final sync, stop the old systemd service;
3. copy the entire `storage/` directory as one unit;
4. place its contents in `/opt/docker-data/apparchitector/`;
5. set ownership to `10001:10001`;
6. start the Docker stack and run all smoke checks;
7. switch DNS only after generation, download and history have been verified.

Never run the old and new APIs against the same SQLite files.

## Functional acceptance checklist

- `/api/health/ready` reports `ready`;
- the questionnaire loads;
- Baseline preview and generation complete;
- the generated ZIP downloads and opens;
- old history items are visible;
- run details, comparison and graph views open;
- configured GPT/Qwen/Hybrid modes behave as expected;
- a container restart preserves history and ZIP files;
- a server restart brings the stack back automatically.

Keep the previous Droplet intact until the new deployment has been stable for
at least several days.
