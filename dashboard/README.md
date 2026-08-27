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
