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
    timeout --kill-after=2s "$seconds" "$@" || true
  else
    "$@" || true
  fi
}

write_cmd() {
  local file="$1"
  shift
  {
    echo "$ $*"
    safe_timeout 30 "$@"
    echo
    echo "status=$?"
  } > "$DIAG_DIR/$file" 2>&1 || true
}

{
  echo "generated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "repo_root=$ROOT_DIR"
  echo "os=$(safe_timeout 5 uname -a 2>/dev/null || true)"
  echo "git_branch=$(safe_timeout 5 git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  echo "git_sha=$(safe_timeout 5 git rev-parse HEAD 2>/dev/null || true)"
} > "$DIAG_DIR/local-runtime.env"

write_cmd node-version.txt node --version
write_cmd npm-version.txt npm --version
write_cmd npm-scripts.json node -e "const fs=require('fs'); for (const p of ['package.json','apps/api/package.json','apps/web/package.json','packages/shared/package.json']) { if (fs.existsSync(p)) { const j=JSON.parse(fs.readFileSync(p,'utf8')); console.log('\\n## '+p); console.log(JSON.stringify(j.scripts||{},null,2)); } }"
write_cmd git-status.txt git status --short
write_cmd source-file-list.txt bash -lc "find apps packages services config scripts infra .github -maxdepth 8 -type f 2>/dev/null | sort"
write_cmd env-name-scan.txt bash -lc "grep -RInE 'localhost:4000|127\\.0\\.0\\.1:3000|VITE_API|API_PORT|APP_RUNTIME_ENV|DATABASE_PATH|OUTPUT_ROOT' apps packages services config scripts infra .github 2>/dev/null || true"
write_cmd shared-import-scan.txt bash -lc "grep -RIn '@mag/shared' apps packages 2>/dev/null | grep -v '/dist/\\|/node_modules/' || true"
write_cmd shared-export-scan.txt bash -lc "grep -RInE '^export ' packages/shared/src 2>/dev/null || true"
write_cmd source-stale-artifacts.txt bash -lc "find apps packages -type f \\( -path '*/src/*.js' -o -path '*/src/*.js.map' -o -path '*/src/*.d.ts' -o -path '*/src/**/*.js' -o -path '*/src/**/*.js.map' -o -path '*/src/**/*.d.ts' -o -name 'vite.config.js' -o -name 'vite.config.js.map' -o -name 'vite.config.d.ts' \\) -print 2>/dev/null | sort"
write_cmd disk-usage.txt bash -lc "du -ah --exclude=.git --exclude=node_modules --exclude=dist --exclude=deploy-diagnostics . 2>/dev/null | sort -h | tail -120"

{
  echo "# Diagnostics bundle"
  echo
  echo "Generated at $(date -u +%Y-%m-%dT%H:%M:%SZ)."
  echo
  echo "Most useful files:"
  echo "- workflow-context.env: resolved domain/server/app paths from the workflow"
  echo "- local-runtime.env: runner/runtime versions"
  echo "- clean-source-artifacts.log and cleaned-stale-source-artifacts.txt: source cleanup details"
  echo "- verify-source.log: source verification output"
  echo "- source-stale-artifacts.txt: JS/d.ts/map files left inside TS source folders"
  echo "- build.log and test.log: build/test output"
  echo "- failure-summary.md: first TypeScript/npm errors plus import/export hints"
  echo "- shared-import-scan.txt and shared-export-scan.txt: @mag/shared API mismatch hints"
  echo "- build-output-summary.env and dist-files.txt: generated release inventory"
  echo "- remote-health.txt, systemctl-status.txt, journal.txt: remote service diagnostics when SSH is available"
} > "$DIAG_DIR/README.txt"
