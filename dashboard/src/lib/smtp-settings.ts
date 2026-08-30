import "server-only";

import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/secret-encryption";

export type EmailConfiguration = {
  source: "database" | "environment";
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  user?: string;
  pass?: string;
  fromAddress: string;
  fromName: string;
};

function validPort(value: unknown) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null;
}

export async function readEmailConfiguration(): Promise<EmailConfiguration> {
  const [saved] = await db.select().from(systemSettings).limit(1);
  if (saved?.smtpEnabled) {
    const port = validPort(saved.smtpPort);
    if (!saved.smtpHost || !port || !saved.smtpFrom || !saved.smtpFromName) {
      throw new Error("Saved SMTP settings are enabled but incomplete");
    }
    const pass = saved.smtpPasswordEncrypted
      ? decryptSecret(saved.smtpPasswordEncrypted)
      : undefined;
    if (Boolean(saved.smtpUsername) !== Boolean(pass)) {
      throw new Error("Saved SMTP username and password must both be configured");
    }
    return {
      source: "database",
      host: saved.smtpHost,
      port,
      secure: saved.smtpSecurity === "tls",
      requireTLS: saved.smtpSecurity === "starttls",
      user: saved.smtpUsername || undefined,
      pass,
      fromAddress: saved.smtpFrom,
      fromName: saved.smtpFromName,
    };
  }

  const host = process.env.SMTP_HOST?.trim();
  const port = validPort(process.env.SMTP_PORT?.trim());
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromAddress = process.env.SMTP_FROM?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim();
  if (!host || !port || !fromAddress || !fromName) {
    throw new Error("Environment SMTP configuration is incomplete");
  }
  if (Boolean(user) !== Boolean(pass)) {
    throw new Error("SMTP_USER and SMTP_PASS must both be configured or both be empty");
  }
  return {
    source: "environment",
    host,
    port,
    secure: process.env.SMTP_SECURE?.trim().toLowerCase() === "true",
    requireTLS: process.env.SMTP_REQUIRE_TLS?.trim().toLowerCase() === "true",
    user: user || undefined,
    pass: pass || undefined,
    fromAddress,
    fromName,
  };
}
