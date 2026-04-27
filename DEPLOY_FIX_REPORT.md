# Deploy fix report

The deploy succeeded, but the browser showed ERR_CONNECTION_REFUSED. The likely cause is nginx being rewritten by deploy_remote.sh with an HTTP-only template after HTTPS had already been enabled. That removes the `listen 443 ssl` server block, so HTTPS connections are refused even though the GitHub job can still pass HTTP smoke checks.

Fixes included:
- detect existing Lets Encrypt certificate
- render HTTPS nginx config when certificate exists
- keep HTTP-only config only before HTTPS is enabled
- correctly replace __RUNTIME_ENV_FILE__ in systemd service
- add nginx/service/port/firewall diagnostics
- add a manual server_diagnostics.sh script
- provide a workflow smoke-test snippet that checks HTTPS when HTTPS is expected

Validation done here:
- generated the patch archive
- checked Python packaging completed successfully
- shell content was reviewed for syntax-sensitive heredocs and escaped nginx variables

Full npm build was not rerun in this sandbox because dependency installation is not needed for these deploy-shell changes and may exceed the interactive execution window.
