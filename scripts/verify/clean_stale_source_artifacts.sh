#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIAG_DIR="${DIAGNOSTICS_DIR:-${ROOT_DIR}/deploy-diagnostics}"
mkdir -p "$DIAG_DIR"

cd "$ROOT_DIR"

patterns=(
  "apps/*/src/**/*.js"
  "apps/*/src/**/*.js.map"
  "apps/*/src/**/*.d.ts"
  "packages/*/src/**/*.js"
  "packages/*/src/**/*.js.map"
  "packages/*/src/**/*.d.ts"
  "apps/*/vite.config.js"
  "apps/*/vite.config.js.map"
  "apps/*/vite.config.d.ts"
  "packages/*/vite.config.js"
  "packages/*/vite.config.js.map"
  "packages/*/vite.config.d.ts"
)

shopt -s globstar nullglob

removed_file="$DIAG_DIR/cleaned-stale-source-artifacts.txt"
: > "$removed_file"

for pattern in "${patterns[@]}"; do
  for file in $pattern; do
    if [ -f "$file" ]; then
      printf '%s\n' "$file" >> "$removed_file"
      rm -f "$file"
    fi
  done
done

if [ -s "$removed_file" ]; then
  echo "Removed stale generated source artifacts:"
  sed 's/^/ - /' "$removed_file"
else
  echo "No stale generated source artifacts found."
  echo "none" > "$removed_file"
fi
