#!/usr/bin/env bash
set -euo pipefail

: "${DOMAIN:?DOMAIN is required}"
: "${APP_ROOT:?APP_ROOT is required}"
: "${WEB_ROOT:?WEB_ROOT is required}"
: "${API_PORT:?API_PORT is required}"
: "${SERVICE_NAME:?SERVICE_NAME is required}"
: "${RELEASE_NAME:?RELEASE_NAME is required}"

RELEASE_DIR="$APP_ROOT/releases/$RELEASE_NAME"
CURRENT_LINK="$APP_ROOT/current"
SHARED_DIR="$APP_ROOT/shared"
RUNTIME_ENV_FILE="$SHARED_DIR/.env"
DIAG_DIR="$SHARED_DIR/logs/deploy-$RELEASE_NAME"
PREVIOUS_CURRENT_TARGET=""
DIAGNOSTICS_COLLECTED=0
ROLLBACK_DONE=0
NGINX_CONFIG="/etc/nginx/sites-available/$DOMAIN"
NGINX_ENABLED="/etc/nginx/sites-enabled/$DOMAIN"
NGINX_BACKUP="$DIAG_DIR/nginx-before.conf"
NGINX_COMMITTED=0
NGINX_MODE="unknown"

mkdir -p "$SHARED_DIR/uploads" "$SHARED_DIR/generated" "$SHARED_DIR/db" "$SHARED_DIR/logs" "$WEB_ROOT" "$DIAG_DIR"

has_https_certificate() {
  [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]
}

public_scheme() {
  if has_https_certificate; then
    printf 'https'
  else
    printf 'http'
  fi
}

collect_remote_diagnostics() {
  local exit_code="${1:-0}"
  local reason="${2:-unknown}"
  if [ "$DIAGNOSTICS_COLLECTED" -eq 1 ]; then
    return 0
  fi
  DIAGNOSTICS_COLLECTED=1
  set +e
  {
    echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "exit_code=$exit_code"
    echo "reason=$reason"
    echo "domain=$DOMAIN"
    echo "app_root=$APP_ROOT"
    echo "web_root=$WEB_ROOT"
    echo "api_port=$API_PORT"
    echo "service_name=$SERVICE_NAME"
    echo "release_name=$RELEASE_NAME"
    echo "release_dir=$RELEASE_DIR"
    echo "runtime_env_file=$RUNTIME_ENV_FILE"
    echo "public_scheme=$(public_scheme)"
    echo "nginx_mode=$NGINX_MODE"
    echo "nginx_config=$NGINX_CONFIG"
    echo "nginx_committed=$NGINX_COMMITTED"
    echo "current_link_target=$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
    echo "previous_current_target=$PREVIOUS_CURRENT_TARGET"
    echo "rollback_done=$ROLLBACK_DONE"
    echo "has_https_certificate=$(has_https_certificate && echo yes || echo no)"
  } > "$DIAG_DIR/remote-deploy-summary.env"

  systemctl status "$SERVICE_NAME" --no-pager > "$DIAG_DIR/systemctl-status.txt" 2>&1 || true
  journalctl -u "$SERVICE_NAME" --no-pager -n 300 > "$DIAG_DIR/journal.txt" 2>&1 || true
  systemctl status nginx --no-pager > "$DIAG_DIR/nginx-status.txt" 2>&1 || true
  journalctl -u nginx --no-pager -n 120 > "$DIAG_DIR/nginx-journal.txt" 2>&1 || true
  nginx -t > "$DIAG_DIR/nginx-test.txt" 2>&1 || true
  nginx -T > "$DIAG_DIR/nginx-full-config.txt" 2>&1 || true
  ss -ltnp > "$DIAG_DIR/ports.txt" 2>&1 || true
  ufw status verbose > "$DIAG_DIR/ufw-status.txt" 2>&1 || true
  ip -br addr > "$DIAG_DIR/ip-addr.txt" 2>&1 || true
  ls -la /etc/nginx/sites-available /etc/nginx/sites-enabled > "$DIAG_DIR/nginx-sites.txt" 2>&1 || true
  ls -la "/etc/letsencrypt/live/$DOMAIN" > "$DIAG_DIR/letsencrypt-live.txt" 2>&1 || true
  find "$APP_ROOT" -maxdepth 4 -type f -printf '%p %s bytes\n' > "$DIAG_DIR/remote-app-tree.txt" 2>&1 || true
  [ -f "$RUNTIME_ENV_FILE" ] && sed -E 's/(PASSWORD|TOKEN|SECRET|KEY)=.*/\1=<redacted>/g' "$RUNTIME_ENV_FILE" > "$DIAG_DIR/runtime-env-redacted.txt" 2>&1 || true
  curl -v --max-time 5 "http://127.0.0.1:$API_PORT/api/health" > "$DIAG_DIR/remote-api-health-localhost.txt" 2>&1 || true
  curl -v --max-time 5 --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/api/health" > "$DIAG_DIR/remote-http-health-vhost.txt" 2>&1 || true
  curl -v -k --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" > "$DIAG_DIR/remote-https-health-vhost.txt" 2>&1 || true
  curl -I -v --max-time 5 --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/" > "$DIAG_DIR/remote-http-index-headers.txt" 2>&1 || true
  curl -I -v -k --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" > "$DIAG_DIR/remote-https-index-headers.txt" 2>&1 || true
  set -e
}

rollback_to_previous_release() {
  if [ -n "$PREVIOUS_CURRENT_TARGET" ] && [ -d "$PREVIOUS_CURRENT_TARGET" ]; then
    ln -sfn "$PREVIOUS_CURRENT_TARGET" "$CURRENT_LINK"
    systemctl daemon-reload || true
    systemctl restart "$SERVICE_NAME" || true
    ROLLBACK_DONE=1
    echo "Rolled back current symlink to $PREVIOUS_CURRENT_TARGET"
  else
    echo "No previous current release is available; rollback skipped."
  fi
}

restore_previous_nginx_config() {
  if [ "$NGINX_COMMITTED" -eq 0 ] && [ -f "$NGINX_BACKUP" ]; then
    cp -f "$NGINX_BACKUP" "$NGINX_CONFIG"
    nginx -t >/tmp/mag-nginx-restore-test.log 2>&1 && systemctl reload nginx || cat /tmp/mag-nginx-restore-test.log || true
    echo "Restored previous nginx config from $NGINX_BACKUP"
  fi
}

on_error() {
  local exit_code=$?
  set +e
  if [ "$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)" = "$RELEASE_DIR" ]; then
    rollback_to_previous_release
  fi
  restore_previous_nginx_config
  collect_remote_diagnostics "$exit_code" "deploy_remote_error"
  exit "$exit_code"
}
trap on_error ERR

[ -d "$RELEASE_DIR" ] || { echo "Release directory is missing: $RELEASE_DIR"; exit 1; }
[ -f "$RELEASE_DIR/apps/api/dist/index.js" ] || { echo "API dist is missing in release"; exit 1; }
[ -f "$RELEASE_DIR/apps/web/dist/index.html" ] || { echo "Web dist is missing in release"; exit 1; }
[ -f "$RELEASE_DIR/packages/shared/dist/index.js" ] || { echo "Shared dist is missing in release"; exit 1; }

cd "$RELEASE_DIR"
npm install --omit=dev --no-fund --no-audit 2>&1 | tee "$DIAG_DIR/npm-install-runtime.log"

PUBLIC_SCHEME="$(public_scheme)"
cat > "$RUNTIME_ENV_FILE" <<ENVEOF
NODE_ENV=production
HOST=127.0.0.1
PORT=$API_PORT
PUBLIC_BASE_URL=$PUBLIC_SCHEME://$DOMAIN
DATABASE_PATH=$SHARED_DIR/db/app.sqlite
OUTPUT_ROOT=$SHARED_DIR/generated
GENERATOR_CLI=$RELEASE_DIR/services/generator-python/main.py
ENVEOF

if [ -n "${RUNTIME_ENV_B64:-}" ]; then
  printf '%s' "$RUNTIME_ENV_B64" | base64 -d >> "$RUNTIME_ENV_FILE"
  printf '\n' >> "$RUNTIME_ENV_FILE"
fi
chmod 600 "$RUNTIME_ENV_FILE"

SERVICE_TEMPLATE="$RELEASE_DIR/infra/deploy/templates/app.service.template"
NGINX_TEMPLATE="$RELEASE_DIR/infra/deploy/templates/nginx.http.template"
[ -f "$SERVICE_TEMPLATE" ] || { echo "Missing service template: $SERVICE_TEMPLATE"; exit 1; }
[ -f "$NGINX_TEMPLATE" ] || { echo "Missing nginx template: $NGINX_TEMPLATE"; exit 1; }

sed \
  -e "s|__APP_ROOT__|$APP_ROOT|g" \
  -e "s|__SERVICE_NAME__|$SERVICE_NAME|g" \
  -e "s|__API_PORT__|$API_PORT|g" \
  -e "s|__RUNTIME_ENV_FILE__|$RUNTIME_ENV_FILE|g" \
  "$SERVICE_TEMPLATE" > "/etc/systemd/system/$SERVICE_NAME"

render_nginx_config() {
  mkdir -p "$(dirname "$NGINX_CONFIG")" /etc/nginx/sites-enabled
  if [ -f "$NGINX_CONFIG" ]; then
    cp -f "$NGINX_CONFIG" "$NGINX_BACKUP"
  fi

  if has_https_certificate; then
    NGINX_MODE="https"
    local cert_fullchain="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    local cert_privkey="/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    cat > "$NGINX_CONFIG" <<NGINXEOF
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN www.$DOMAIN;

  location /.well-known/acme-challenge/ {
    root $WEB_ROOT;
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

server {
  listen 443 ssl;
  listen [::]:443 ssl;
  server_name $DOMAIN www.$DOMAIN;

  ssl_certificate $cert_fullchain;
  ssl_certificate_key $cert_privkey;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_prefer_server_ciphers off;

  root $WEB_ROOT;
  index index.html;
  client_max_body_size 50m;

  location /api/ {
    proxy_pass http://127.0.0.1:$API_PORT;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
NGINXEOF
  else
    NGINX_MODE="http"
    sed \
      -e "s|__DOMAIN__|$DOMAIN|g" \
      -e "s|__WEB_ROOT__|$WEB_ROOT|g" \
      -e "s|__API_PORT__|$API_PORT|g" \
      "$NGINX_TEMPLATE" > "$NGINX_CONFIG"
  fi

  ln -sfn "$NGINX_CONFIG" "$NGINX_ENABLED"
  rm -f /etc/nginx/sites-enabled/default
}

render_nginx_config
nginx -t
systemctl reload nginx

PREVIOUS_CURRENT_TARGET="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

health_ok=0
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -fsS --max-time 5 "http://127.0.0.1:$API_PORT/api/health" > "$DIAG_DIR/health-success.json" 2> "$DIAG_DIR/health-attempt-$attempt.err"; then
    health_ok=1
    break
  fi
  sleep 2
done

if [ "$health_ok" -ne 1 ]; then
  collect_remote_diagnostics 70 "api_health_check_failed_before_web_publish"
  rollback_to_previous_release
  restore_previous_nginx_config
  echo "API health check failed. Web publish was intentionally skipped to avoid a half-deployed site."
  exit 70
fi

rsync -a --delete "$RELEASE_DIR/apps/web/dist/" "$WEB_ROOT/" 2>&1 | tee "$DIAG_DIR/web-publish.log"
chown -R www-data:www-data "$WEB_ROOT" || true

systemctl is-active --quiet "$SERVICE_NAME"
curl -fsS --max-time 5 "http://127.0.0.1:$API_PORT/api/health" > "$DIAG_DIR/final-health.json"

if [ "$NGINX_MODE" = "https" ]; then
  curl -kfsS --max-time 8 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" > "$DIAG_DIR/final-https-health.json"
  curl -kfsS --max-time 8 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" > "$DIAG_DIR/final-https-index.html"
else
  curl -fsS --max-time 8 --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/api/health" > "$DIAG_DIR/final-http-health.json"
  curl -fsS --max-time 8 --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/" > "$DIAG_DIR/final-http-index.html"
fi

NGINX_COMMITTED=1
collect_remote_diagnostics 0 "success"

find "$APP_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn \
  | awk 'NR>5 {print $2}' \
  | xargs -r rm -rf
