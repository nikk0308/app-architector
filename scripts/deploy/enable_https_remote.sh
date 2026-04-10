#!/usr/bin/env bash
set -euo pipefail

: "${DOMAIN:?}"
: "${LETSENCRYPT_EMAIL:?}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y certbot python3-certbot-nginx

certbot --nginx -n --agree-tos --redirect \
  -m "$LETSENCRYPT_EMAIL" \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

nginx -t
systemctl reload nginx
