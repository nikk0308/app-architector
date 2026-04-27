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
NGINX_TEMPLATE="$RELEASE_DIR/infra/deploy/templates/nginx.http.template"
RUNTIME_ENV_FILE="$SHARED_DIR/runtime.env"
DIAGNOSTICS_DIR="$SHARED_DIR/logs/deploy-$RELEASE_NAME"

redact_file() {
  local source_file="$1"
  if [ -f "$source_file" ]; then
    sed -E 's/^([^#=]*(TOKEN|SECRET|PASSWORD|PRIVATE|KEY|OPENAI|GEMINI|ANTHROPIC)[^#=]*)=.*/\1=***REDACTED***/I' "$source_file"
  else
    echo "missing: $source_file"
  fi
}

collect_diagnostics() {
  local rc="${1:-0}"
  local failed_line="${2:-unknown}"
  mkdir -p "$DIAGNOSTICS_DIR"

  {
    echo "deploy_status=failed"
    echo "exit_code=$rc"
    echo "failed_line=$failed_line"
    echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "domain=$DOMAIN"
    echo "app_root=$APP_ROOT"
    echo "web_root=$WEB_ROOT"
    echo "api_port=$API_PORT"
    echo "release_name=$RELEASE_NAME"
    echo "release_dir=$RELEASE_DIR"
    echo "service_name=$SERVICE_NAME"
    echo "runtime_env_file=$RUNTIME_ENV_FILE"
  } > "$DIAGNOSTICS_DIR/summary.env" || true

  {
    echo "### systemctl status"
    systemctl status "$SERVICE_NAME" --no-pager || true
    echo
    echo "### recent journal"
    journalctl -u "$SERVICE_NAME" --no-pager -n 250 || true
  } > "$DIAGNOSTICS_DIR/service.log" 2>&1 || true

  {
    echo "### direct health check"
    curl -v --max-time 5 "http://127.0.0.1:$API_PORT/api/health" || true
    echo
    echo "### listening TCP ports"
    ss -ltnp || true
  } > "$DIAGNOSTICS_DIR/network.log" 2>&1 || true

  {
    echo "### nginx -t"
    nginx -t || true
    echo
    echo "### rendered nginx config"
    if [ -f "/etc/nginx/sites-available/$DOMAIN" ]; then
      cat "/etc/nginx/sites-available/$DOMAIN"
    else
      echo "missing /etc/nginx/sites-available/$DOMAIN"
    fi
  } > "$DIAGNOSTICS_DIR/nginx.log" 2>&1 || true

  {
    echo "### redacted runtime env"
    redact_file "$RUNTIME_ENV_FILE"
    echo
    echo "### release package files"
    ls -la "$RELEASE_DIR" || true
    echo
    echo "### built API entry"
    ls -la "$RELEASE_DIR/apps/api/dist" || true
    echo
    echo "### built web dist"
    ls -la "$RELEASE_DIR/apps/web/dist" || true
    echo
    echo "### shallow release tree"
    find "$RELEASE_DIR" -maxdepth 3 -type f | sort | sed "s#$RELEASE_DIR/##" || true
  } > "$DIAGNOSTICS_DIR/files.log" 2>&1 || true

  echo "Deploy diagnostics saved to $DIAGNOSTICS_DIR" >&2
}

trap 'rc=$?; line=$LINENO; if [ "$rc" -ne 0 ]; then collect_diagnostics "$rc" "$line"; fi; exit "$rc"' EXIT

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
  printf '%s' "$RUNTIME_ENV_B64" | base64 -d > "$RUNTIME_ENV_FILE"
else
  cat > "$RUNTIME_ENV_FILE" <<EOF
HOST=127.0.0.1
PORT=$API_PORT
CORS_ORIGIN=*
DATABASE_PATH=$SHARED_DIR/data/app.db
OUTPUT_ROOT=$SHARED_DIR/storage/generations
PYTHON_BIN=python3
LLM_PROVIDER=disabled
LOG_LEVEL=error
EOF
fi
chmod 600 "$RUNTIME_ENV_FILE"

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

if [ ! -f "$SERVICE_TEMPLATE" ]; then
  echo "service template not found: $SERVICE_TEMPLATE" >&2
  exit 1
fi

python3 - "$SERVICE_TEMPLATE" "$APP_ROOT" "$SERVICE_NAME" "$RUNTIME_ENV_FILE" <<'PY'
from pathlib import Path
import sys

template_path = Path(sys.argv[1])
app_root = sys.argv[2]
service_name = sys.argv[3]
runtime_env_file = sys.argv[4]

content = template_path.read_text(encoding="utf-8")
content = (
    content
    .replace("__APP_ROOT__", app_root)
    .replace("__SERVICE_NAME__", service_name)
    .replace("__RUNTIME_ENV_FILE__", runtime_env_file)
)
Path("/tmp/mobile-architecture-generator.service").write_text(content, encoding="utf-8")
PY

cp /tmp/mobile-architecture-generator.service "/etc/systemd/system/$SERVICE_NAME"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"
rsync -az --delete "$CURRENT_LINK/apps/web/dist/" "$WEB_ROOT/"

if [ ! -f "$NGINX_TEMPLATE" ]; then
  echo "nginx template not found: $NGINX_TEMPLATE" >&2
  exit 1
fi

NGINX_SITE_CONFIG="/etc/nginx/sites-available/$DOMAIN"
if [ -f "$NGINX_SITE_CONFIG" ] && grep -q "ssl_certificate" "$NGINX_SITE_CONFIG"; then
  echo "Existing HTTPS nginx config detected; preserving certbot-managed config."
else
  python3 - "$NGINX_TEMPLATE" "$DOMAIN" "$WEB_ROOT" "$API_PORT" <<'PY'
from pathlib import Path
import sys

template_path = Path(sys.argv[1])
domain = sys.argv[2]
web_root = sys.argv[3]
api_port = sys.argv[4]

content = template_path.read_text(encoding="utf-8")
content = (
    content
    .replace("__DOMAIN__", domain)
    .replace("__WEB_ROOT__", web_root)
    .replace("__API_PORT__", api_port)
)
Path(f"/etc/nginx/sites-available/{domain}").write_text(content, encoding="utf-8")
PY
fi

ln -sfn "$NGINX_SITE_CONFIG" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

health_ok=0
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null; then
    health_ok=1
    break
  fi
  sleep 1
done

if [ "$health_ok" -ne 1 ]; then
  echo "API health check failed on http://127.0.0.1:$API_PORT/api/health" >&2
  systemctl status "$SERVICE_NAME" --no-pager || true
  journalctl -u "$SERVICE_NAME" --no-pager -n 120 || true
  exit 1
fi

{
  echo "deploy_status=ok"
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "domain=$DOMAIN"
  echo "release_name=$RELEASE_NAME"
  echo "service_name=$SERVICE_NAME"
  echo "api_port=$API_PORT"
  echo "web_root=$WEB_ROOT"
} > "$SHARED_DIR/logs/deploy-$RELEASE_NAME-success.env"
