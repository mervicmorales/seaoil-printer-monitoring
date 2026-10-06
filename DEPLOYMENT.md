# Coolify deployment

`_deployment/compose.coolify.yml` is the Coolify production deployment
definition. The root `docker-compose.yml` remains the local/direct Compose
definition. The production definition runs:

- PostgreSQL with a persistent volume;
- a one-shot, idempotent database initializer;
- the Next.js dashboard on internal port 3000;
- the PrintDash agent on internal port 3003 with persistent data and scan volumes.

The three repository-built services use explicit local image names ending in
`:coolify`. Coolify builds and tags these images from the temporary Git checkout.
Its later `docker compose up -d` step reuses the tagged images and does not need
the `dashboard/` or `printdash-agent/` source directories in Coolify's persistent
application directory. `pull_policy: never` also prevents Compose from trying to
pull these private, host-local images from a registry.

The production volumes are external and must retain these names:

- `openship-seaoil-printer-monitoring-postgres-data`
- `openship-seaoil-printer-monitoring-printdash-data`
- `openship-seaoil-printer-monitoring-printdash-scans`

Do not delete, recreate, or rename these volumes during deployment.

## Coolify setup

1. In **New Project**, select this repository.
2. Select the **Docker Compose** build pack, use `/` as the base directory, and
   use `/_deployment/compose.coolify.yml` as the Compose location.
3. Expose only `dashboard` publicly. Keep `db`, `db-init`, and `printdash-agent` internal.
4. Add the variables from `.env.production.example` in Coolify. Replace every
   `CHANGE_ME` value with a unique secret. Keep `MFA_ENCRYPTION_KEY` separate
   from `AUTH_SECRET` and `SETTINGS_ENCRYPTION_KEY`; losing it requires enrolled
   users to reset authenticator access. Do not commit the resulting values.
5. Set `APP_BASE_URL` to the exact public address employees use to open the
   dashboard. For the current deployment, use
   `http://seaprint.seaoil.com.ph:3000`. Confirm its DNS record, port access,
   and firewall route before sending production email. If HTTPS is configured
   later, update this value to the HTTPS URL and remove `:3000` when the reverse
   proxy serves the standard HTTPS port.
6. If **System → Notifications → Email** has **Use saved SMTP settings** enabled,
   set **From Email** to `noreply.printerservices@seaoil.com.ph` and **From Name**
   to `SEA Print`. Saved database settings take priority over Coolify variables.
7. Deploy and wait for `db-init` to finish successfully and both health checks
   to become healthy.

## Connect the agent after first deployment

The agent deliberately starts without central uploads when `SEAOIL_AGENT_TOKEN`
is empty. Once the dashboard is live, open a terminal for the `db-init` image or
run the following with the dashboard deployment environment available:

```bash
npm run monitoring:agent:create -- --key head-office-agent --name "Head Office Agent" --location "Head Office"
```

Copy the one-time token into the `printdash-agent` service as
`SEAOIL_AGENT_TOKEN`, then restart that service. Never commit the token or SNMP
community string.

## Local verification

Validate interpolation, image names, and build targets without starting containers:

```bash
docker compose --project-directory . --env-file .env.production.example \
  -f _deployment/compose.coolify.yml config --quiet
docker compose --project-directory . --env-file .env.production.example \
  -f _deployment/compose.coolify.yml config --images
docker compose --project-directory . --env-file .env.production.example \
  -f _deployment/compose.coolify.yml build --print
```

Do not run `docker compose up` against the external production volumes as a local
test. During an approved deployment, the dashboard health endpoint is
`/api/health`; the agent health check uses `/login`. Back up the `postgres-data`,
`printdash-data`, and `printdash-scans` volumes before destructive maintenance.
