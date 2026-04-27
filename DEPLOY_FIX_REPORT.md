# Deploy fix report

## Що виправлено

1. API тепер за замовчуванням слухає порт 3000, а не 4000.
2. systemd-сервіс читає runtime env-файл через EnvironmentFile та MAG_ENV_FILE.
3. Frontend більше не ходить на localhost:4000 у production. За замовчуванням API викликається відносно поточного домену: /api/...
4. Deploy-скрипт тепер чекає API health-check у циклі до 30 секунд, а не робить один curl одразу після restart.
5. Deploy-скрипт генерує діагностику при падінні: systemctl, journalctl, nginx -t, відкриті порти, direct health-check, redacted runtime.env і дерево релізу.
6. Workflow 03_deploy.yml тепер збирає deploy-diagnostics artifact при падінні.
7. Deploy не перетирає certbot HTTPS-конфіг, якщо в nginx-конфігу вже є ssl_certificate.
8. API preview/generation тепер використовують generation plan з manifest, щоб preview і реальна генерація не розʼїжджалися логічно.

## Локальна валідація

Виконано:
- bash -n scripts/deploy/deploy_remote.sh
- bash -n scripts/deploy/bootstrap_remote.sh
- bash -n scripts/deploy/enable_https_remote.sh
- python3 -m py_compile services/generator-python/generator_cli.py
- YAML parse для workflow-файлів
- static check, що production web source більше не містить hardcoded localhost:4000

Повний npm build у цьому середовищі не був завершений через обмеження середовища виконання, але GitHub workflow збирає проект перед upload release.
