#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-${1:-}}"
APP_ROOT="${APP_ROOT:-${2:-/opt/mobile-architecture-generator}}"
API_PORT="${API_PORT:-${3:-3000}}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: DOMAIN=example.com APP_ROOT=/opt/mobile-architecture-generator API_PORT=3000 bash scripts/deploy/server_diagnostics.sh"
  echo "   or: bash scripts/deploy/server_diagnostics.sh example.com /opt/mobile-architecture-generator 3000"
  exit 2
fi

SERVICE_NAME="${SERVICE_NAME:-$(printf '%s' "$DOMAIN" | tr -cs '[:alnum:]' '-' | tr '[:upper:]' '[:lower:]' | sed 's/^-//;s/-$//').service}"
WEB_ROOT="${WEB_ROOT:-/var/www/$DOMAIN}"
OUT_DIR="${OUT_DIR:-/tmp/mag-server-diagnostics-$DOMAIN-$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$OUT_DIR"

run() {
  local name="$1"
  shift
  echo ">>> $*" | tee "$OUT_DIR/$name.txt"
  { "$@"; } >> "$OUT_DIR/$name.txt" 2>&1 || true
}

{
  echo "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "domain=$DOMAIN"
  echo "app_root=$APP_ROOT"
  echo "web_root=$WEB_ROOT"
  echo "api_port=$API_PORT"
  echo "service_name=$SERVICE_NAME"
  echo "current_link=$(readlink -f "$APP_ROOT/current" 2>/dev/null || true)"
  echo "has_https_certificate=$(test -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" && echo yes || echo no)"
} > "$OUT_DIR/summary.env"

run systemctl-service systemctl status "$SERVICE_NAME" --no-pager
run journal-service journalctl -u "$SERVICE_NAME" --no-pager -n 250
run systemctl-nginx systemctl status nginx --no-pager
run journal-nginx journalctl -u nginx --no-pager -n 120
run nginx-test nginx -t
run nginx-sites ls -la /etc/nginx/sites-available /etc/nginx/sites-enabled
run nginx-config nginx -T
run ports ss -ltnp
run firewall-ufw ufw status verbose
run letsencrypt ls -la "/etc/letsencrypt/live/$DOMAIN"
run app-tree find "$APP_ROOT" -maxdepth 4 -type f -printf '%p %s bytes\n'
run web-tree find "$WEB_ROOT" -maxdepth 2 -type f -printf '%p %s bytes\n'
run api-local-health curl -v --max-time 5 "http://127.0.0.1:$API_PORT/api/health"
run http-vhost-health curl -v --max-time 5 --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/api/health"
run http-vhost-index curl -I -v --max-time 5 --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/"
run https-vhost-health curl -k -v --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health"
run https-vhost-index curl -k -I -v --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/"
run external-http curl -I -v --max-time 8 "http://$DOMAIN/"
run external-https curl -I -v -k --max-time 8 "https://$DOMAIN/"

tar -czf "$OUT_DIR.tar.gz" -C "$(dirname "$OUT_DIR")" "$(basename "$OUT_DIR")"
echo
echo "Diagnostics saved to: $OUT_DIR"
echo "Archive: $OUT_DIR.tar.gz"
