# SEAOIL Printer Monitoring Dashboard

## Local PostgreSQL with Docker

The dashboard uses PostgreSQL 17 in Docker on local port 5433. Credentials are
stored in the gitignored `.env.docker` file. Copy `.env.docker.example` when
setting up another machine and replace its placeholder password.

On the first run, initialize the database with:

```bash
npm run db:setup:docker
```

This starts PostgreSQL, waits until it is healthy, applies the Drizzle schema,
and inserts the initial users and lookup data. It is safe to run again: schema
sync and seeding are idempotent.

For later runs, start the existing database with `npm run db:docker:up`. This
command waits for PostgreSQL to be healthy before returning, so the dashboard
does not issue queries while the database is still starting.

Stop the database without deleting its persistent data with
`npm run db:docker:down`.

The named Docker volume `seaoil_postgres_data` persists the database when the
container is recreated. Do not use `docker compose down --volumes` unless the
database has been backed up and permanent deletion is intended.

The dashboard reads its connection from `.env.local`. After changing
`src/db/schema.ts`, apply those changes to the Docker database with
`npm run db:push:docker` before starting the dashboard.

Before deployment, replace local credentials with server-managed secrets and
configure regular off-server PostgreSQL backups.

The `/printdash` workspace treats the latest printer reading and reporting
agent as stale after `MONITORING_STALE_SECONDS`. The safe default is 180
seconds (three 60-second polling cycles); accepted values are 60-86400.

## Monitoring agent credentials

Monitoring agents authenticate with independent bearer tokens. The stable
agent key in each payload selects the registered agent, but it does not
authenticate by itself. Only a bcrypt hash is stored in PostgreSQL.

Create an agent and copy the token shown once into that office's `.env`:

```bash
npm run monitoring:agent:create -- --key cebu-agent --name "Cebu Agent" --location "Cebu Depot"
```

Rotate or revoke credentials without deleting the agent or its history:

```bash
npm run monitoring:agent:rotate -- --key cebu-agent
npm run monitoring:agent:revoke -- --key cebu-agent
```

For the one-time migration from the former global credential, run this after
the schema push. It hashes the existing environment token without displaying
it:

```bash
npm run monitoring:agent:migrate-global -- --key default-agent
```

After testing the migrated agent, remove `MONITORING_AGENT_TOKEN` and
`MONITORING_AGENT_KEY` from the dashboard environment. Runtime ingest no longer
reads either variable.

## Mailpit Email Testing

Start Mailpit on the development host:

```bash
mailpit
```

Mailpit accepts SMTP on `localhost:1025`, and its inbox is available at
[http://localhost:8025](http://localhost:8025). The checked-in
`.env.example` contains safe SMTP placeholders; keep real SMTP credentials only
in a gitignored local environment file.

Start the dashboard from this directory:

```bash
npm run dev
```

The SMTP test endpoint requires an authenticated admin session. After signing
in as an administrator, copy the `seaoil_session` cookie from the browser's
developer tools and run:

```bash
curl -X POST http://localhost:3000/api/email/test \
  -H "Content-Type: application/json" \
  -b "seaoil_session=<admin-session-cookie>" \
  -d '{"to":"test@example.com"}'
```

Alternatively, while signed in as an administrator, run this from the browser
console on the dashboard origin:

```js
fetch("/api/email/test", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ to: "test@example.com" }),
}).then((response) => response.json()).then(console.log);
```

Open [http://localhost:8025](http://localhost:8025); the test message should
appear with sender `SEAOIL Printer <printer@seaoil.com.ph>`.

The current dashboard Compose file runs only PostgreSQL, while Next.js runs on
the host via `npm run dev`, so `SMTP_HOST=localhost` is correct. If the Next.js
dashboard is later containerized while Mailpit remains on the host, set
`SMTP_HOST=host.docker.internal` in that container's environment.

Administrators can optionally save SMTP settings under **System → Email / SMTP**.
When saved settings are enabled they take priority; otherwise the existing
environment/Mailpit configuration remains the fallback. Saved SMTP passwords
use AES-256-GCM authenticated encryption and require an environment-held
`SETTINGS_ENCRYPTION_KEY`. Set `APP_BASE_URL` to the public dashboard origin so
employee verification emails contain the correct link.

## Feature migration

After backing up PostgreSQL, apply the additive registration, notification, and
SMTP migration once:

```bash
npm run db:migrate:features
```

For this repository's local Docker PostgreSQL configuration, use
`npm run db:migrate:features:docker` instead.

The migration keeps existing users active and backfills each existing toner
inventory row's durable alert state without sending historical warnings.

For offline alerts even when no administrator has the dashboard open, schedule
a POST to `/api/monitoring/agent-status` at least once per minute with the
`x-seaoil-cron-token` header matching `AGENT_STATUS_CRON_SECRET`. The existing
signed-in dashboard polling remains supported.

## Printer MAC addresses

Before running this version against an existing database, run `npm run db:migrate:mac`
from `dashboard/` (or `npm run db:migrate:mac:docker` for `.env.docker`). The additive,
repeatable Drizzle migration creates the nullable `printers.mac_address` column and
preserves existing printer records and monitoring history.

MAC Address is optional in Add/Edit Printer and appears beside IP Address in the
Assignment panel. Addresses are normalized to uppercase colon-separated notation.
Updated office agents include MAC addresses in discovery and monitoring uploads.
Discovery pre-fills Add Printer; authenticated, assigned agents fill missing MAC
addresses on online readings without overwriting a saved value. Replacing a printer
clears its old MAC address so the replacement can be detected.

Restart the office agent after updating its files, or rebuild its Docker image.
Automatic lookup uses the IP-associated SNMP interface where available, otherwise
an unambiguous interface address. Unsupported, offline, or ambiguous devices can
be entered manually; detection is not guaranteed for every printer.
