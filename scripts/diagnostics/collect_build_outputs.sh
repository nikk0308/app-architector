#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIAG_DIR="${1:-${DIAGNOSTICS_DIR:-${ROOT_DIR}/deploy-diagnostics}}"
mkdir -p "$DIAG_DIR"
cd "$ROOT_DIR"

{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "apps/api/dist/index.js=$(test -f apps/api/dist/index.js && echo present || echo missing)"
  echo "apps/web/dist/index.html=$(test -f apps/web/dist/index.html && echo present || echo missing)"
  echo "packages/shared/dist/index.js=$(test -f packages/shared/dist/index.js && echo present || echo missing)"
} > "$DIAG_DIR/build-output-summary.env"

find apps packages -type f -path '*/dist/*' -printf '%p %s bytes\n' | sort > "$DIAG_DIR/dist-files.txt" || true
find apps/web/dist -maxdepth 3 -type f -printf '%p %s bytes\n' | sort > "$DIAG_DIR/web-dist-files.txt" 2>/dev/null || true
find apps/api/dist -maxdepth 3 -type f -printf '%p %s bytes\n' | sort > "$DIAG_DIR/api-dist-files.txt" 2>/dev/null || true
find packages/shared/dist -maxdepth 3 -type f -printf '%p %s bytes\n' | sort > "$DIAG_DIR/shared-dist-files.txt" 2>/dev/null || true

grep -RInE 'localhost:4000|127\.0\.0\.1:4000|127\.0\.0\.1:3000' apps/web/dist apps/api/dist packages/shared/dist > "$DIAG_DIR/build-host-leaks.txt" 2>/dev/null || true
