#!/usr/bin/env bash
set -euo pipefail

# Vite and Node module resolution can prefer a stale .js file over the intended
# .ts/.tsx source when both share the same basename. That is exactly how an old
# frontend bundle can keep calling localhost:4000 even after api.ts is fixed.
mapfile -t stale_files < <(
  find apps packages -type f \
    \( -path '*/src/*.js' -o -path '*/src/*.js.map' -o -path '*/src/*.d.ts' -o -path '*/src/**/*.js' -o -path '*/src/**/*.js.map' -o -path '*/src/**/*.d.ts' \) \
    ! -path '*/node_modules/*' \
    | sort
)

if (( ${#stale_files[@]} > 0 )); then
  echo "Stale generated files were found inside source directories:" >&2
  printf ' - %s\n' "${stale_files[@]}" >&2
  echo "Remove them before building. Source folders must contain TS/TSX sources only." >&2
  exit 1
fi
