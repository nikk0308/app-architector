#!/usr/bin/env bash
set -euo pipefail

REMOTE_ROOT="/opt/docker-stacks/apparchitector.dev"
RUNTIME_ENV="$REMOTE_ROOT/.runtime.env"
PROJECT="apparchitector"

test -L "$REMOTE_ROOT/previous" || { echo "No previous release is recorded"; exit 1; }
TARGET="$(readlink -f "$REMOTE_ROOT/previous")"
test -f "$TARGET/compose.yaml" || { echo "Previous release is incomplete: $TARGET"; exit 1; }

docker compose \
  -p "$PROJECT" \
  --env-file "$RUNTIME_ENV" \
  --env-file "$TARGET/.deploy.env" \
  -f "$TARGET/compose.yaml" \
  up -d --remove-orphans

python3 "$TARGET/scripts/deploy/smoke.py" \
  --compose-file "$TARGET/compose.yaml" \
  --runtime-env "$RUNTIME_ENV" \
  --deploy-env "$TARGET/.deploy.env" \
  --project "$PROJECT"

CURRENT=""
if [ -L "$REMOTE_ROOT/current" ]; then
  CURRENT="$(readlink -f "$REMOTE_ROOT/current")"
fi
ln -sfn "$TARGET" "$REMOTE_ROOT/current"
if [ -n "$CURRENT" ]; then
  ln -sfn "$CURRENT" "$REMOTE_ROOT/previous"
fi

echo "Rolled back App Architector to $(basename "$TARGET")"
