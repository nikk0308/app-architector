#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 5 ]; then
  echo "Usage: deploy-release.sh RELEASE_ID BUNDLE API_IMAGE WEB_IMAGE GHCR_USER"
  exit 2
fi

RELEASE_ID="$1"
BUNDLE_PATH="$2"
APP_API_IMAGE="$3"
APP_WEB_IMAGE="$4"
GHCR_USER="$5"

REMOTE_ROOT="/opt/docker-stacks/apparchitector.dev"
RELEASES_DIR="$REMOTE_ROOT/releases"
RELEASE_PATH="$RELEASES_DIR/$RELEASE_ID"
RUNTIME_ENV="$REMOTE_ROOT/.runtime.env"
DATA_DIR="/opt/docker-data/apparchitector"
BACKUP_DIR="/opt/docker-backups/apparchitector"
PROJECT="apparchitector"

case "$RELEASE_ID" in
  *[!a-zA-Z0-9._-]*|"")
    echo "Unsafe release id: $RELEASE_ID"
    exit 2
    ;;
esac

case "$APP_API_IMAGE $APP_WEB_IMAGE" in
  *$'\n'*|*$'\r'*)
    echo "Image references must be single-line values"
    exit 2
    ;;
esac

test -f "$BUNDLE_PATH" || { echo "Bundle not found: $BUNDLE_PATH"; exit 1; }
test -f "$RUNTIME_ENV" || { echo "Missing server-owned runtime env: $RUNTIME_ENV"; exit 1; }

read -r GHCR_TOKEN
test -n "${GHCR_TOKEN:-}" || { echo "GHCR token is empty"; exit 1; }

install -d -m 755 "$RELEASES_DIR" "$DATA_DIR" "$BACKUP_DIR"
chown 10001:10001 "$DATA_DIR"
chmod 750 "$DATA_DIR" "$BACKUP_DIR"

if [ -e "$RELEASE_PATH" ]; then
  rm -rf -- "$RELEASE_PATH"
fi
install -d -m 755 "$RELEASE_PATH"
tar -xzf "$BUNDLE_PATH" -C "$RELEASE_PATH"

cat > "$RELEASE_PATH/.deploy.env" <<EOF
APP_API_IMAGE=$APP_API_IMAGE
APP_WEB_IMAGE=$APP_WEB_IMAGE
RUNTIME_ENV_PATH=$RUNTIME_ENV
EOF
chmod 600 "$RELEASE_PATH/.deploy.env" "$RUNTIME_ENV"

DOCKER_CONFIG_DIR="$(mktemp -d)"
cleanup() {
  rm -rf -- "$DOCKER_CONFIG_DIR"
}
trap cleanup EXIT

printf '%s\n' "$GHCR_TOKEN" |
  docker --config "$DOCKER_CONFIG_DIR" login ghcr.io --username "$GHCR_USER" --password-stdin
unset GHCR_TOKEN

compose_for() {
  local release="$1"
  shift
  docker --config "$DOCKER_CONFIG_DIR" compose \
    -p "$PROJECT" \
    --env-file "$RUNTIME_ENV" \
    --env-file "$release/.deploy.env" \
    -f "$release/compose.yaml" \
    "$@"
}

PREVIOUS_RELEASE=""
if [ -L "$REMOTE_ROOT/current" ]; then
  PREVIOUS_RELEASE="$(readlink -f "$REMOTE_ROOT/current")"
fi

if [ -n "$PREVIOUS_RELEASE" ] && [ -f "$PREVIOUS_RELEASE/compose.yaml" ]; then
  CURRENT_API_ID="$(compose_for "$PREVIOUS_RELEASE" ps -q api || true)"
  if [ -n "$CURRENT_API_ID" ]; then
    TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
    compose_for "$PREVIOUS_RELEASE" exec -T api \
      node scripts/deploy/backup-sqlite.mjs /app/storage/app.db /tmp/app.db
    docker cp "$CURRENT_API_ID:/tmp/app.db" "$BACKUP_DIR/app-$TIMESTAMP.db"
    compose_for "$PREVIOUS_RELEASE" exec -T api rm -f /tmp/app.db
    gzip "$BACKUP_DIR/app-$TIMESTAMP.db"
  fi
fi

compose_for "$RELEASE_PATH" config --quiet
compose_for "$RELEASE_PATH" pull
compose_for "$RELEASE_PATH" up -d --remove-orphans

if ! python3 "$RELEASE_PATH/scripts/deploy/smoke.py" \
  --compose-file "$RELEASE_PATH/compose.yaml" \
  --runtime-env "$RUNTIME_ENV" \
  --deploy-env "$RELEASE_PATH/.deploy.env" \
  --project "$PROJECT"; then
  echo "Candidate failed smoke tests. Rolling back."
  if [ -n "$PREVIOUS_RELEASE" ] && [ -f "$PREVIOUS_RELEASE/compose.yaml" ]; then
    compose_for "$PREVIOUS_RELEASE" up -d --remove-orphans
    python3 "$PREVIOUS_RELEASE/scripts/deploy/smoke.py" \
      --compose-file "$PREVIOUS_RELEASE/compose.yaml" \
      --runtime-env "$RUNTIME_ENV" \
      --deploy-env "$PREVIOUS_RELEASE/.deploy.env" \
      --project "$PROJECT"
  else
    compose_for "$RELEASE_PATH" down
  fi
  exit 1
fi

if [ -n "$PREVIOUS_RELEASE" ]; then
  ln -sfn "$PREVIOUS_RELEASE" "$REMOTE_ROOT/previous"
fi
ln -sfn "$RELEASE_PATH" "$REMOTE_ROOT/current"

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'app-*.db.gz' -mtime +30 -delete

mapfile -t RELEASES < <(
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
    sort -nr |
    awk '{print $2}'
)
for index in "${!RELEASES[@]}"; do
  candidate="${RELEASES[$index]}"
  if [ "$index" -lt 5 ] || [ "$candidate" = "$RELEASE_PATH" ] || [ "$candidate" = "$PREVIOUS_RELEASE" ]; then
    continue
  fi
  rm -rf -- "$candidate"
done

echo "Deployed App Architector release $RELEASE_ID"
