# SEAOIL Printer Monitoring Dashboard

## Local PostgreSQL with Docker

The dashboard uses PostgreSQL 17 in Docker on local port 5433. Credentials are
stored in the gitignored `.env.docker` file. Copy `.env.docker.example` when
setting up another machine and replace its placeholder passwords. The
`SEED_SUPER_ADMIN_PASSWORD` value is required when seeding and must be kept in
the local environment only.

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

## Performance and deployment

Production Next.js compresses responses and minifies JavaScript/CSS. The
dashboard uses a bounded PostgreSQL connection pool (`DB_POOL_MAX`, default
10 per application process). Size it against PostgreSQL's connection limit
before running multiple instances.

The optimized branding logo is served as WebP. Public `/branding/` assets have
a one-day browser/CDN TTL; authenticated API responses are not publicly cached.
The organization-wide Overview expense summary uses a 15-second in-process
cache and a private 15-second browser cache, so recent toner changes may take
up to 15 seconds to appear there.

To use a CDN, publish the exact build's `/_next/static/` directory to it and
set `NEXT_ASSET_PREFIX` to the CDN origin **at build time**. Do not set this
variable before the CDN contains those files. Do not cache `/api/`, HTML,
`/uploads/`, or user-specific documents at the CDN. A load balancer requires
shared uploaded-file storage (or an object store) and shared session/database
configuration; the current local `public/uploads/` directory is not safe for
multiple dashboard replicas.

For the Docker image, pass the same public CDN origin with
`docker build --build-arg NEXT_ASSET_PREFIX=https://cdn.example.com ...`.

The additive indexes for repair tickets and toner transactions in
`src/db/schema.ts` must be applied with Drizzle (`npm run db:push:docker` for
the local Docker database). Back up PostgreSQL first in other environments.

The `/printdash` workspace treats the latest printer reading and reporting
agent as stale after `MONITORING_STALE_SECONDS`. The safe default is 180
seconds (three 60-second polling cycles); accepted values are 60-86400.

## Agent Management architecture

The admin-only **Printers → Monitoring Agents** page reports connectivity and
runtime information for each registered office agent. Access requires an Admin
or Super Admin account with the existing Monitoring Alerts permission. The
page and its `/api/admin/monitoring/agents` endpoints enforce the same policy
server-side and refresh every 45 seconds.

The agent version is read from `printdash-agent/package.json`. Authenticated
monitoring uploads may also report the host platform, CPU architecture,
hostname, Node.js version, process uptime, and an optional non-secret build
identifier. Successful uploads update these nullable fields plus the latest
matched/unmatched printer counts and `last_successful_upload_at`. Older agents
without metadata remain accepted and display **Unknown version**.

Configure the centrally recommended release with a semantic version:

```bash
LATEST_AGENT_VERSION=4.0.0
```

Connectivity and release state are deliberately separate:

- **Online** means the existing agent status is online and its latest
  authenticated communication is within the configured stale interval.
- **Offline** means that heartbeat is stale, absent, inactive, or revoked.
- **Up to date** means the installed semantic version is equal to or newer than
  `LATEST_AGENT_VERSION`.
- **Update available** means the installed semantic version is older.
- **Unknown version** means the installed value is missing or invalid.

Before running this version against an existing database, apply the additive,
repeatable migration. It preserves credentials, assignments, printers,
readings, alerts, and monitoring history:

```bash
npm run db:migrate:agent-management
```

Use `npm run db:migrate:agent-management:docker` with `.env.docker`.

This milestone reports metadata only. Future milestones may add Windows
Service hosting, an installer, one-time provisioning, and a controlled updater
with rollback. No remote command execution, installer download, package
execution, or automatic update capability exists in this milestone.

## Monitoring agent credentials

Monitoring agents authenticate with independent bearer tokens. The stable
agent key in each payload selects the registered agent, but it does not
authenticate by itself. Only a bcrypt hash is stored in PostgreSQL.

Create an agent and copy the token shown once into that office's `.env`:

```bash
npm run monitoring:agent:create -- --key cebu-agent --name "Cebu Agent" --office "Cebu Depot"
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

## Organizational data migration and import

Before deploying the Office terminology and centralized Office / Department /
Subunit / Cost Center workflow to an existing database, back up PostgreSQL and
run the additive, repeatable migrations from `dashboard/` in this order:

```bash
npm run db:migrate:office-naming
npm run db:migrate:organization
```

Use the corresponding `:docker` scripts with `.env.docker`. The first migration
renames the existing `locations` table and related foreign-key columns to
`offices` / `office_id` without copying or deleting records. The Coolify
`db-init` service runs both migrations automatically before the dashboard is
started. The migrations do not reset tables or backfill guessed assignments;
existing users, printers, repair tickets, and toner transactions retain their
Office and Department values while the new Subunit and Cost Center foreign keys
remain nullable.

Authorized administrators can then open **System → Import Data**, upload an
`.xlsx` workbook containing the `Collated data` sheet, review row-numbered
validation and create/update/skip counts, and explicitly confirm the import.
Confirmation claims the preview once and performs all organization upserts in a
database transaction. Re-imports are idempotent, invalid/duplicate rows are
skipped and reported, and records missing from a later workbook are never
deleted or deactivated automatically. Import history is available under
**System → Import History**.

## Security rollout: sessions, ticket numbers, and uploaded documents

Before deploying this release, back up PostgreSQL and all existing
`dashboard/public/uploads` files. Configure a unique `AUTH_SECRET` of at least 32
characters; the dashboard health check now fails if it is missing or still an
example value. Restart the dashboard after changing it (existing sessions will
need to sign in again).

For an existing database, run the additive migrations before starting the new
dashboard code:

```bash
node --env-file=.env.local scripts/migrate-auth-security.mjs
node --env-file=.env.local scripts/migrate-repair-ticket-sequence.mjs
```

The main and Coolify Compose `db-init` services run these automatically. Do not
run the ticket-number migration while old and new dashboard instances are
accepting repair reports at the same time; cut over after the migration.

New contract documents and repair-resolution attachments are stored under
`storage/uploads` (or `PRIVATE_UPLOAD_DIR`), not `public/uploads`. Give the
dashboard process write access to this directory and keep it on persistent,
private storage. The Compose deployments now mount a named `private-uploads`
volume. Before replacing an old container, export its `public/uploads` files;
otherwise files that only exist in that container will be lost. Stage those files
under the new dashboard's `public/uploads` and run:

```bash
npm run uploads:migrate:private
```

Use `npm run uploads:migrate:private -- --copy` when the source is a read-only
backup; verify every expected file exists in private storage before removing the
public copy or retiring the old container. The old `/uploads/...` URLs now return
404, while authorized users retrieve the same records through protected API
routes. Keep the backup until those downloads have been verified. Do not point
a CDN directly at `public/uploads`.
