#!/usr/bin/env bash
set -euo pipefail

: "${DOMAIN:?}"
: "${APP_ROOT:?}"
: "${WEB_ROOT:?}"
: "${API_PORT:?}"
: "${SERVICE_NAME:?}"
: "${RELEASE_NAME:?}"

export DEBIAN_FRONTEND=noninteractive

RELEASE_DIR="$APP_ROOT/releases/$RELEASE_NAME"
SHARED_DIR="$APP_ROOT/shared"
CURRENT_LINK="$APP_ROOT/current"
SERVICE_TEMPLATE="$RELEASE_DIR/infra/deploy/templates/app.service.template"

apt-get update
apt-get install -y nginx rsync curl ca-certificates python3 python3-venv python3-pip build-essential unzip

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

mkdir -p "$WEB_ROOT" "$SHARED_DIR/data" "$SHARED_DIR/storage" "$SHARED_DIR/logs"
chmod -R 755 "$WEB_ROOT"
chmod -R 755 "$APP_ROOT"

if [ -n "${RUNTIME_ENV_B64:-}" ]; then
  printf '%s' "$RUNTIME_ENV_B64" | base64 -d > "$SHARED_DIR/runtime.env"
  chmod 600 "$SHARED_DIR/runtime.env"
elif [ ! -f "$SHARED_DIR/runtime.env" ]; then
  cat > "$SHARED_DIR/runtime.env" <<EOF
HOST=127.0.0.1
PORT=$API_PORT
CORS_ORIGIN=*
DATABASE_PATH=$SHARED_DIR/data/app.db
OUTPUT_ROOT=$SHARED_DIR/storage/generations
PYTHON_BIN=python3
LLM_PROVIDER=disabled
LOG_LEVEL=error
EOF
  chmod 600 "$SHARED_DIR/runtime.env"
fi

cd "$RELEASE_DIR"
npm install --omit=dev --no-audit --no-fund

if [ ! -d "$RELEASE_DIR/apps/web/dist" ]; then
  echo "apps/web/dist not found" >&2
  exit 1
fi

if [ ! -f "$RELEASE_DIR/apps/api/dist/index.js" ]; then
  echo "apps/api/dist/index.js not found" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

app_root = Path('/tmp/app_root.txt').read_text(encoding='utf-8').strip()
service_name = Path('/tmp/service_name.txt').read_text(encoding='utf-8').strip()
service_template = Path('/tmp/service_template.txt').read_text(encoding='utf-8').strip()
content = Path(service_template).read_text(encoding='utf-8')
content = content.replace('__APP_ROOT__', app_root).replace('__SERVICE_NAME__', service_name)
Path('/tmp/mobile-architecture-generator.service').write_text(content, encoding='utf-8')
PY

cp /tmp/mobile-architecture-generator.service "/etc/systemd/system/$SERVICE_NAME"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
rsync -az --delete "$CURRENT_LINK/apps/web/dist/" "$WEB_ROOT/"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
sleep 2
curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null
nginx -t
systemctl reload nginx
