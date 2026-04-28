#!/usr/bin/env bash
set +e
DIAGNOSTICS_DIR="${DIAGNOSTICS_DIR:-deploy-diagnostics}"
mkdir -p "$DIAGNOSTICS_DIR/remote"
if [ -z "${SERVER_IP:-}" ] || [ -z "${SSH_USER:-}" ] || [ ! -f ~/.ssh/deploy_key ]; then
  echo "Remote diagnostics skipped: SSH context is not available." > "$DIAGNOSTICS_DIR/remote/remote-diagnostics-skipped.txt"
  exit 0
fi
ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes "$SSH_USER@$SERVER_IP" "set +e; OUT=/tmp/mag-deploy-diagnostics; rm -rf \$OUT; mkdir -p \$OUT; SRC=\"$APP_ROOT/shared/logs/deploy-$RELEASE_NAME\"; if [ -d \"\$SRC\" ]; then cp -a \"\$SRC\"/. \"\$OUT\"/; fi; systemctl status \"$SERVICE_NAME\" --no-pager > \"\$OUT/systemctl-status-live.txt\" 2>&1 || true; journalctl -u \"$SERVICE_NAME\" --no-pager -n 300 > \"\$OUT/journal-live.txt\" 2>&1 || true; systemctl status nginx --no-pager > \"\$OUT/nginx-status-live.txt\" 2>&1 || true; journalctl -u nginx --no-pager -n 120 > \"\$OUT/nginx-journal-live.txt\" 2>&1 || true; nginx -t > \"\$OUT/nginx-test-live.txt\" 2>&1 || true; nginx -T > \"\$OUT/nginx-full-config-live.txt\" 2>&1 || true; ss -ltnp > \"\$OUT/ports-live.txt\" 2>&1 || true; ufw status verbose > \"\$OUT/ufw-status-live.txt\" 2>&1 || true; ls -la /etc/nginx/sites-available /etc/nginx/sites-enabled > \"\$OUT/nginx-sites-live.txt\" 2>&1 || true; ls -la \"/etc/letsencrypt/live/$DOMAIN\" > \"\$OUT/letsencrypt-live.txt\" 2>&1 || true; curl -v --max-time 5 \"http://127.0.0.1:$API_PORT/api/health\" > \"\$OUT/api-health-localhost.txt\" 2>&1 || true; curl -v --max-time 5 --resolve \"$DOMAIN:80:127.0.0.1\" \"http://$DOMAIN/api/health\" > \"\$OUT/api-health-http-vhost.txt\" 2>&1 || true; curl -k -v --max-time 5 --resolve \"$DOMAIN:443:127.0.0.1\" \"https://$DOMAIN/api/health\" > \"\$OUT/api-health-https-vhost.txt\" 2>&1 || true; find \"$APP_ROOT\" -maxdepth 4 -type f -printf '%p %s bytes\\n' > \"\$OUT/app-tree-live.txt\" 2>&1 || true" || true
rsync -az -e "ssh -i ~/.ssh/deploy_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes" "$SSH_USER@$SERVER_IP:/tmp/mag-deploy-diagnostics/" "$DIAGNOSTICS_DIR/remote/" || true
exit 0
