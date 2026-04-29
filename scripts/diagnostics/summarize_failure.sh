#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIAG_DIR="${1:-${DIAGNOSTICS_DIR:-${ROOT_DIR}/deploy-diagnostics}}"
mkdir -p "$DIAG_DIR"
cd "$ROOT_DIR"

SUMMARY="$DIAG_DIR/failure-summary.md"
ERRORS="$DIAG_DIR/typescript-errors.txt"
WARNINGS="$DIAG_DIR/workflow-warnings.txt"
IMPORT_SCAN="$DIAG_DIR/shared-import-scan.txt"
EXPORT_SCAN="$DIAG_DIR/shared-export-scan.txt"

: > "$ERRORS"
: > "$WARNINGS"
: > "$IMPORT_SCAN"
: > "$EXPORT_SCAN"

for log in "$DIAG_DIR"/*.log; do
  [ -f "$log" ] || continue
  grep -nE '(^Error:|error TS[0-9]+:|npm ERR!|npm error|Process completed with exit code|failed|FAILED)' "$log" >> "$ERRORS" || true
  grep -nEi '(warning|deprecated|deprecation)' "$log" >> "$WARNINGS" || true
done

grep -RInE 'from "@mag/shared"|from '\''@mag/shared'\''' apps packages 2>/dev/null \
  | grep -v '/dist/' \
  | grep -v '/node_modules/' \
  > "$IMPORT_SCAN" || true

grep -RInE '^export ' packages/shared/src 2>/dev/null > "$EXPORT_SCAN" || true

{
  echo '# Failure summary'
  echo
  echo "Generated at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "GitHub run: ${GITHUB_RUN_ID:-local}"
  echo
  echo '## First TypeScript/npm errors'
  if [ -s "$ERRORS" ]; then
    sed -n '1,120p' "$ERRORS" | sed 's/^/- /'
  else
    echo '- No TypeScript/npm errors were found in collected *.log files.'
  fi
  echo
  echo '## First warnings/deprecations'
  if [ -s "$WARNINGS" ]; then
    sed -n '1,80p' "$WARNINGS" | sed 's/^/- /'
  else
    echo '- No warnings were found in collected *.log files.'
  fi
  echo
  echo '## Shared package import/export hints'
  echo '- shared-import-scan.txt shows every source import from @mag/shared.'
  echo '- shared-export-scan.txt shows current exports from packages/shared/src.'
  echo '- If an import name is missing from shared-export-scan.txt, fix the import or export before touching deploy logic.'
  echo
  echo '## Suggested local command order'
  echo '```bash'
  echo 'npm run verify:source'
  echo 'npm run build -w @mag/shared'
  echo 'npm run build -w @mag/api'
  echo 'npm run build -w @mag/web'
  echo 'npm run test -w @mag/api'
  echo '```'
} > "$SUMMARY"

echo "Wrote $SUMMARY"
