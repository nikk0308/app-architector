#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIAG_DIR="${DIAGNOSTICS_DIR:-${ROOT_DIR}/deploy-diagnostics}"
mkdir -p "$DIAG_DIR"
cd "$ROOT_DIR"

mapfile -t stale < <(find apps packages -type f \
  \( -path '*/src/*.js' \
  -o -path '*/src/*.js.map' \
  -o -path '*/src/*.d.ts' \
  -o -path '*/src/**/*.js' \
  -o -path '*/src/**/*.js.map' \
  -o -path '*/src/**/*.d.ts' \
  -o -name 'vite.config.js' \
  -o -name 'vite.config.js.map' \
  -o -name 'vite.config.d.ts' \) \
  -print | sort)

printf '%s\n' "${stale[@]}" > "$DIAG_DIR/source-stale-artifacts.txt"

{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "stale_count=${#stale[@]}"
  echo "checked_roots=apps packages"
} > "$DIAG_DIR/source-verify-summary.env"

if [ "${#stale[@]}" -gt 0 ]; then
  echo "Stale generated files were found inside source directories:"
  printf ' - %s\n' "${stale[@]}"
  echo "Remove them before building. Source folders must contain TS/TSX sources only."
  echo "Tip: run npm run clean:source-artifacts locally, then commit the deletions."
  exit 1
fi

echo "Source tree is clean: no generated JS/d.ts/map artifacts inside source directories."
