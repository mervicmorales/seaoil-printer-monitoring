import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{32,256}$/;
const AGENT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const BCRYPT_COST = 12;

function usage() {
  console.error(`Usage:
  npm run monitoring:agent -- create --key <key> --name <name> [--location <existing location>]
  npm run monitoring:agent -- rotate --key <key> [--name <name>] [--location <existing location>]
  npm run monitoring:agent -- revoke --key <key>
  npm run monitoring:agent -- migrate-global --key <existing key>`);
}

function parseArguments(values) {
  const options = {};
  for (let index = 0; index < values.length; index += 2) {
    const flag = values[index];
    const value = values[index + 1];
    if (!flag?.startsWith("--") || !value || value.startsWith("--")) {
      throw new Error("Every option must use --name value syntax");
    }
    const name = flag.slice(2);
    if (!["key", "name", "location"].includes(name)) {
      throw new Error(`Unknown option: ${flag}`);
    }
    options[name] = value.trim();
  }
  return options;
}

function validateKey(value) {
  if (!value || !AGENT_KEY_PATTERN.test(value)) {
    throw new Error(
      "--key must be 1-100 letters, numbers, dots, underscores, colons, or hyphens",
    );
  }
}

function generateToken() {
  return `sea_${crypto.randomBytes(32).toString("base64url")}`;
}

async function resolveLocationId(client, locationName) {
  if (!locationName) return null;
  const result = await client.query(
    "select id from locations where name = $1 limit 1",
    [locationName],
  );
  if (result.rowCount !== 1) {
    throw new Error(`Location '${locationName}' does not exist`);
  }
  return result.rows[0].id;
}

async function provision(client, command, options) {
  validateKey(options.key);
  const existingResult = await client.query(
    "select id, name, token_hash, token_revoked_at from monitoring_agents where agent_key = $1 for update",
    [options.key],
  );
  const existing = existingResult.rows[0] ?? null;

  if (command === "create" && existing?.token_hash) {
    throw new Error(
      `Agent '${options.key}' already has credentials; use monitoring:agent:rotate`,
    );
  }
  if (command === "rotate" && !existing) {
    throw new Error(
      `Agent '${options.key}' does not exist; use monitoring:agent:create first`,
    );
  }
  if (!existing && !options.name) {
    throw new Error("--name is required when creating a new agent");
  }

  const locationId = await resolveLocationId(client, options.location);
  const token = generateToken();
  const tokenHash = await bcrypt.hash(token, BCRYPT_COST);

  if (existing) {
    await client.query(
      `update monitoring_agents
       set name = coalesce($2, name),
           location_id = case when $3::boolean then $4 else location_id end,
           token_hash = $5,
           token_created_at = now(),
           token_revoked_at = null,
           status = case when status = 'revoked' then 'inactive' else status end,
           updated_at = now()
       where id = $1`,
      [existing.id, options.name || null, Boolean(options.location), locationId, tokenHash],
    );
  } else {
    await client.query(
      `insert into monitoring_agents
        (agent_key, name, location_id, status, token_hash, token_created_at, last_seen)
       values ($1, $2, $3, 'inactive', $4, now(), null)`,
      [options.key, options.name, locationId, tokenHash],
    );
  }

  return token;
}

async function migrateGlobalToken(client, options) {
  const key = options.key || process.env.MONITORING_AGENT_KEY?.trim() || "default-agent";
  validateKey(key);
  const token = process.env.MONITORING_AGENT_TOKEN?.trim() ?? "";
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error(
      "MONITORING_AGENT_TOKEN must be configured and contain 32-256 safe token characters",
    );
  }
  const tokenHash = await bcrypt.hash(token, BCRYPT_COST);
  const result = await client.query(
    `update monitoring_agents
     set token_hash = $2,
         token_created_at = now(),
         token_revoked_at = null,
         updated_at = now()
     where agent_key = $1`,
    [key, tokenHash],
  );
  if (result.rowCount !== 1) {
    throw new Error(`Existing agent '${key}' was not found`);
  }
  return key;
}

async function main() {
  const command = process.argv[2];
  if (!["create", "rotate", "revoke", "migrate-global"].includes(command)) {
    usage();
    process.exitCode = 1;
    return;
  }

  let options;
  try {
    options = parseArguments(process.argv.slice(3));
  } catch (error) {
    usage();
    throw error;
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("begin");

    if (command === "revoke") {
      validateKey(options.key);
      const result = await client.query(
        `update monitoring_agents
         set token_revoked_at = now(), status = 'revoked', updated_at = now()
         where agent_key = $1 and token_hash is not null`,
        [options.key],
      );
      if (result.rowCount !== 1) {
        throw new Error(`Active credentials for agent '${options.key}' were not found`);
      }
      await client.query("commit");
      console.log(`Revoked credentials for '${options.key}'.`);
      return;
    }

    if (command === "migrate-global") {
      const key = await migrateGlobalToken(client, options);
      await client.query("commit");
      console.log(`Migrated the legacy global credential to agent '${key}'.`);
      console.log("Remove MONITORING_AGENT_TOKEN and MONITORING_AGENT_KEY from the dashboard environment after verification.");
      return;
    }

    const token = await provision(client, command, options);
    await client.query("commit");
    console.log(`${command === "create" ? "Created" : "Rotated"} credentials for '${options.key}'.`);
    console.log(`SEAOIL_AGENT_TOKEN=${token}`);
    console.log("Copy this token to the remote agent .env now. It will not be shown again.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Monitoring agent credential command failed: ${error.message}`);
  process.exitCode = 1;
});
