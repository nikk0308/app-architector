#!/usr/bin/env bash
set -euo pipefail

: "${DOMAIN:?}"
: "${APP_ROOT:?}"
: "${WEB_ROOT:?}"
: "${API_PORT:?}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y nginx rsync curl ca-certificates python3 python3-venv python3-pip build-essential unzip

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

mkdir -p "$WEB_ROOT" "$APP_ROOT/releases" "$APP_ROOT/shared/data" "$APP_ROOT/shared/storage" "$APP_ROOT/shared/logs"
chmod -R 755 "$WEB_ROOT"
chmod -R 755 "$APP_ROOT"

python3 - <<'PY'
from pathlib import Path

domain = Path('/tmp/domain.txt').read_text(encoding='utf-8').strip()
web_root = Path('/tmp/web_root.txt').read_text(encoding='utf-8').strip()
template = Path('/tmp/bootstrap.index.template').read_text(encoding='utf-8')
content = template.replace('__DOMAIN__', domain).replace('__WEB_ROOT__', web_root)
Path('/tmp/bootstrap.index.html').write_text(content, encoding='utf-8')
PY

cp /tmp/bootstrap.index.html "$WEB_ROOT/index.html"

python3 - <<'PY'
from pathlib import Path

domain = Path('/tmp/domain.txt').read_text(encoding='utf-8').strip()
web_root = Path('/tmp/web_root.txt').read_text(encoding='utf-8').strip()
api_port = Path('/tmp/api_port.txt').read_text(encoding='utf-8').strip()
template = Path('/tmp/nginx.http.template').read_text(encoding='utf-8')
content = template.replace('__DOMAIN__', domain).replace('__WEB_ROOT__', web_root).replace('__API_PORT__', api_port)
Path('/tmp/mobile-architecture-generator.nginx').write_text(content, encoding='utf-8')
PY

cp /tmp/mobile-architecture-generator.nginx "/etc/nginx/sites-available/$DOMAIN"
ln -sfn "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
rm -f /etc/nginx/sites-enabled/default || true

nginx -t
systemctl enable nginx
systemctl restart nginx
