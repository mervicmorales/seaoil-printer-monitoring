import "server-only";

import nodemailer, { type Transporter } from "nodemailer";
import { readEmailConfiguration, type EmailConfiguration } from "@/lib/smtp-settings";

export type SendEmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

export type SendEmailResult = {
  messageId: string;
  accepted: Array<string | Buffer>;
  rejected: Array<string | Buffer>;
};

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = "";

function getTransporter(configuration: EmailConfiguration) {
  const transporterKey = JSON.stringify({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    requireTLS: configuration.requireTLS,
    user: configuration.user,
    pass: configuration.pass,
  });

  if (!cachedTransporter || cachedTransporterKey !== transporterKey) {
    cachedTransporter = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
      requireTLS: configuration.requireTLS,
      ...(configuration.user && configuration.pass
        ? { auth: { user: configuration.user, pass: configuration.pass } }
        : {}),
    });
    cachedTransporterKey = transporterKey;
  }

  return cachedTransporter;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: SendEmailOptions): Promise<SendEmailResult> {
  if (!to.trim()) throw new Error("Email recipient is required");
  if (!subject.trim()) throw new Error("Email subject is required");
  if (!text && !html) throw new Error("Email text or HTML content is required");

  let configuration: EmailConfiguration;
  try {
    configuration = await readEmailConfiguration();
  } catch (error) {
    throw new EmailConfigurationError(error instanceof Error ? error.message : "SMTP is not configured");
  }
  const info = await getTransporter(configuration).sendMail({
    from: {
      name: configuration.fromName,
      address: configuration.fromAddress,
    },
    to,
    subject,
    text,
    html,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}

export async function verifyEmailConnection() {
  let configuration: EmailConfiguration;
  try {
    configuration = await readEmailConfiguration();
  } catch (error) {
    throw new EmailConfigurationError(error instanceof Error ? error.message : "SMTP is not configured");
  }
  await getTransporter(configuration).verify();
  return { source: configuration.source, fromName: configuration.fromName };
}
