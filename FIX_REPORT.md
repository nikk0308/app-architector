# Fix report: deploy source verification and diagnostics

## Problem reproduced from GitHub logs

The deploy workflow failed in the `Verify source tree` step because generated TypeScript outputs were present inside `apps/web/src`:

- `apps/web/src/App.d.ts`
- `apps/web/src/App.js`
- `apps/web/src/App.js.map`
- `apps/web/src/api.d.ts`
- `apps/web/src/api.js`
- `apps/web/src/api.js.map`
- `apps/web/src/main.d.ts`
- `apps/web/src/main.js`
- `apps/web/src/main.js.map`

These files are build artifacts, not source files. Keeping them inside `src` can make Vite/TypeScript pick stale JavaScript instead of the real `.tsx/.ts` source and can create confusing deploy behavior.

## Main changes

1. Removed stale generated files from `apps/web/src`.
2. Added `noEmit: true` to `apps/web/tsconfig.json` so web typechecking cannot emit `.js`, `.d.ts`, or `.map` files into the source tree even if `tsc -p apps/web/tsconfig.json` is run directly.
3. Expanded `.gitignore` to prevent stale emitted source artifacts from being committed again.
4. Added `scripts/verify/clean_stale_source_artifacts.sh` to clean known generated artifacts from source folders.
5. Improved `scripts/verify/no_stale_source_artifacts.sh` so it also writes diagnostics files and gives a direct local fix command.
6. Added local/build diagnostics collectors under `scripts/diagnostics/`.
7. Updated `.github/workflows/03_deploy.yml` so it:
   - creates a non-empty diagnostics artifact even for early failures;
   - captures source tree state before and after cleanup;
   - cleans stale source artifacts before verification;
   - writes build/test logs into diagnostics;
   - uploads diagnostics with `if: always()`;
   - uses `actions/checkout@v5` and `actions/setup-node@v5`.
8. Hardened `scripts/deploy/deploy_remote.sh` so the frontend is published only after backend health succeeds, and so remote diagnostics are saved on deploy failures.

## Local validation performed

- Confirmed the uploaded diagnostics archive contained only three tiny files: `npm-install.log`, `verify-source.log`, and `workflow-context.env`.
- Confirmed the exact stale files from the GitHub log existed in the uploaded source archive.
- Removed stale generated artifacts from `apps/web/src`.
- Ran `scripts/verify/no_stale_source_artifacts.sh` successfully after cleanup.
- Created a temporary stale file inside `apps/web/src`, confirmed verification fails, then confirmed `scripts/verify/clean_stale_source_artifacts.sh` removes it and verification passes.
- Ran `bash scripts/diagnostics/collect_local_diagnostics.sh deploy-diagnostics` and confirmed it produces a useful multi-file diagnostics bundle.
- Ran `bash -n` syntax validation for the modified shell scripts.

## Not fully validated locally

A full `npm install && npm run build && npm test` was not completed in this sandbox environment because dependency installation is not reliably available here. The GitHub workflow still performs the full install/build/test path on the runner.
