import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

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

type EmailConfiguration = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromAddress: string;
  fromName: string;
};

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = "";

function readEmailConfiguration(): EmailConfiguration {
  const host = process.env.SMTP_HOST?.trim();
  const rawPort = process.env.SMTP_PORT?.trim();
  const rawSecure = process.env.SMTP_SECURE?.trim().toLowerCase();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const fromAddress = process.env.SMTP_FROM?.trim();
  const fromName = process.env.SMTP_FROM_NAME?.trim();

  if (!host) throw new EmailConfigurationError("SMTP_HOST is not configured");
  if (!rawPort) throw new EmailConfigurationError("SMTP_PORT is not configured");

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new EmailConfigurationError("SMTP_PORT must be an integer between 1 and 65535");
  }

  if (rawSecure && rawSecure !== "true" && rawSecure !== "false") {
    throw new EmailConfigurationError("SMTP_SECURE must be true or false");
  }
  if (!fromAddress) throw new EmailConfigurationError("SMTP_FROM is not configured");
  if (!fromName) throw new EmailConfigurationError("SMTP_FROM_NAME is not configured");
  if (Boolean(user) !== Boolean(pass)) {
    throw new EmailConfigurationError(
      "SMTP_USER and SMTP_PASS must either both be configured or both be empty",
    );
  }

  return {
    host,
    port,
    secure: rawSecure === "true",
    user: user || undefined,
    pass: pass || undefined,
    fromAddress,
    fromName,
  };
}

function getTransporter(configuration: EmailConfiguration) {
  const transporterKey = JSON.stringify({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    user: configuration.user,
  });

  if (!cachedTransporter || cachedTransporterKey !== transporterKey) {
    cachedTransporter = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.secure,
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

  const configuration = readEmailConfiguration();
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
