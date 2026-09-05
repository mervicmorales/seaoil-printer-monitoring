# OpenShip deployment

The root `docker-compose.yml` is the production deployment definition. It runs:

- PostgreSQL with a persistent volume;
- a one-shot, idempotent database initializer;
- the Next.js dashboard on internal port 3000;
- the PrintDash agent on internal port 3003 with persistent data and scan volumes.

## OpenShip setup

1. In **New Project**, select this repository.
2. Under **Compose file**, enter `docker-compose.yml` and select **Scan**.
3. Expose only `dashboard` publicly. Keep `db`, `db-init`, and `printdash-agent` internal.
4. Add the variables from `.env.production.example` in OpenShip. Replace every
   `CHANGE_ME` value with a unique secret. Do not commit the resulting values.
5. Use `pms.seaoil.com.ph` as `APP_BASE_URL` only after its DNS and HTTPS route
   are configured. Until then, use the actual dashboard URL supplied by OpenShip.
6. Deploy and wait for `db-init` to finish successfully and both health checks
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

Copy `.env.production.example` to `.env`, replace all required values, then run:

```bash
docker compose up -d --build --wait
docker compose ps
```

The dashboard health endpoint is `/api/health`; the agent health check uses
`/login`. Back up the `postgres-data`, `printdash-data`, and `printdash-scans`
volumes before destructive maintenance.
