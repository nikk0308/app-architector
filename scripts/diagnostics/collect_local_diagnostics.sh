#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIAG_DIR="${1:-${DIAGNOSTICS_DIR:-${ROOT_DIR}/deploy-diagnostics}}"
mkdir -p "$DIAG_DIR"
cd "$ROOT_DIR"

safe_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
  else
    "$@"
  fi
}

write_cmd() {
  local file="$1"
  shift
  {
    echo "# $*"
    safe_timeout 20 "$@" 2>&1 || true
  } > "$DIAG_DIR/$file"
}

{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "pwd=$(pwd)"
  echo "node=$(safe_timeout 5 node -v 2>/dev/null || true)"
  echo "os=$(uname -a 2>/dev/null || true)"
  echo "github_sha=${GITHUB_SHA:-}"
  echo "github_ref=${GITHUB_REF:-}"
  echo "github_run_id=${GITHUB_RUN_ID:-}"
  echo "github_workspace=${GITHUB_WORKSPACE:-}"
} > "$DIAG_DIR/local-runtime.env"

write_cmd repo-root-files.txt find . -maxdepth 2 -mindepth 1 -not -path './.git/*' -printf '%y %p\n'
write_cmd source-tree-files.txt find apps packages services config scripts infra .github -type f -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.git/*' -printf '%p\n'
write_cmd generated-output-tree.txt find apps packages services -type f \( -path '*/dist/*' -o -path '*/__pycache__/*' -o -name '*.pyc' \) -printf '%p\n'
write_cmd source-stale-artifacts.txt bash -lc "find apps packages -type f \\( -path '*/src/*.js' -o -path '*/src/*.js.map' -o -path '*/src/*.d.ts' -o -path '*/src/**/*.js' -o -path '*/src/**/*.js.map' -o -path '*/src/**/*.d.ts' -o -name 'vite.config.js' -o -name 'vite.config.js.map' -o -name 'vite.config.d.ts' \\) -print | sort"
write_cmd package-json-summary.txt bash -lc "for f in package.json apps/*/package.json packages/*/package.json; do [ -f \"\$f\" ] || continue; echo --- \"\$f\"; sed -n '1,180p' \"\$f\"; done"
write_cmd deploy-workflow.txt sed -n '1,320p' .github/workflows/03_deploy.yml
write_cmd deploy-scripts.txt bash -lc "for f in scripts/deploy/*.sh scripts/deploy/*.py; do [ -f \"\$f\" ] || continue; echo === \"\$f\"; sed -n '1,280p' \"\$f\"; done"
write_cmd env-name-scan.txt bash -lc "grep -RInE 'localhost:4000|127\\.0\\.0\\.1:3000|VITE_API|API_PORT|APP_RUNTIME_ENV|DATABASE_PATH|OUTPUT_ROOT' apps packages services config scripts infra .github 2>/dev/null || true"
write_cmd disk-usage.txt bash -lc "du -ah . --exclude=.git --exclude=node_modules --exclude=deploy-diagnostics 2>/dev/null | sort -h | tail -n 120"

if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  write_cmd git-status.txt git status --short
fi

{
  echo "Deploy diagnostics index"
  echo "========================"
  echo
  echo "Most useful files:"
  echo "- workflow-context.env: resolved domain/server/app paths from the workflow"
  echo "- local-runtime.env: runner/runtime versions"
  echo "- clean-source-artifacts.log and cleaned-stale-source-artifacts.txt: source cleanup details"
  echo "- verify-source.log: source verification output"
  echo "- source-stale-artifacts.txt: JS/d.ts/map files left inside TS source folders"
  echo "- build.log and test.log: build/test output"
  echo "- build-output-summary.env and dist-files.txt: generated release inventory"
  echo "- remote-health.txt, systemctl-status.txt, journal.txt: remote service diagnostics when SSH is available"
} > "$DIAG_DIR/README.txt"
