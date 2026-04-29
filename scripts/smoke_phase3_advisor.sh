#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mag_phase3_smoke.XXXXXX")"
PAYLOAD_FILE="$WORK_DIR/payload.json"
OUT_DIR="$WORK_DIR/out"
ZIP_PATH="$WORK_DIR/generated.zip"

rm -rf "$WORK_DIR"
mkdir -p "$OUT_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

jq empty "$ROOT_DIR/config/artifact-registry.json"

cat > "$PAYLOAD_FILE" <<'JSON'
{
  "generationId": "phase3-smoke",
  "profile": {
    "profile": "utility",
    "projectName": "Phase Three",
    "appDisplayName": "Phase Three",
    "generationMode": "hybrid",
    "includeLLMNotes": true
  },
  "spec": {
    "profileId": "utility",
    "generationMode": "hybrid",
    "appDisplayName": "Phase Three",
    "projectName": "Phase Three",
    "naming": {
      "projectSlug": "phase-three",
      "projectPascal": "PhaseThree",
      "packageId": "com.example.phasethree"
    },
    "architecture": {
      "style": "feature-first",
      "entryPoint": "PhaseThreeApp",
      "stateManagement": "local-state",
      "navigationStyle": "tabs",
      "environmentMode": "mock-first"
    },
    "features": {
      "auth": false,
      "analytics": false,
      "localization": false,
      "push": false,
      "networking": true,
      "persistence": true,
      "exampleScreen": true,
      "llmNotes": true
    },
    "modules": [{ "featureId": "home", "enabled": true, "required": true }],
    "dependencyPlan": { "required": [], "optional": [], "warnings": [] }
  },
  "manifest": {
    "version": "1.0",
    "rootFolderName": "phase-three",
    "artifacts": [
      {
        "id": "meta.advisor",
        "title": "Architecture advisor report",
        "reason": "Advisor smoke test",
        "required": false,
        "category": "metadata",
        "source": "advisor"
      }
    ],
    "summary": { "totalArtifacts": 1, "requiredArtifacts": 0, "featureArtifacts": 0 },
    "notes": []
  },
  "validation": { "status": "passed", "issues": [], "checkedAt": "2026-04-28T00:00:00.000Z" },
  "advisorReport": {
    "version": "1.0",
    "status": "fallback",
    "provider": "deterministic",
    "summary": "Smoke-test architecture plan.",
    "decisions": [
      {
        "id": "smoke-decision",
        "title": "Smoke decision",
        "recommendation": "Keep generated modules separated.",
        "rationale": "The starter project remains easier to extend.",
        "impact": "medium",
        "files": ["meta.advisor"]
      }
    ],
    "nextSteps": ["Add project-specific screens"],
    "risks": [],
    "warnings": [],
    "createdAt": "2026-04-28T00:00:00.000Z"
  },
  "templateContext": {
    "advisor_json": "{\"smoke\":true}",
    "advisor_markdown": "# Architecture decisions\n\nSmoke-test architecture plan.\n"
  },
  "outputDir": "__OUT_DIR__",
  "zipPath": "__ZIP_PATH__"
}
JSON

sed -i "s#__OUT_DIR__#$OUT_DIR#g; s#__ZIP_PATH__#$ZIP_PATH#g" "$PAYLOAD_FILE"
/usr/bin/python3 "$ROOT_DIR/services/generator-python/generator_cli.py" < "$PAYLOAD_FILE" >/dev/null

test -f "$OUT_DIR/phase-three/docs/architecture-decisions.md"
test -f "$OUT_DIR/phase-three/.mag/architecture-advisor.json"
test -f "$ZIP_PATH"

echo "phase3 advisor smoke ok"
