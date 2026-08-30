import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { EmailConfigurationError, sendEmail } from "@/lib/email";
import { isValidEmail } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProviderLabel() {
  const host = process.env.SMTP_HOST?.trim().toLowerCase();
  const port = process.env.SMTP_PORT?.trim();
  const mailpitHosts = new Set(["localhost", "127.0.0.1", "host.docker.internal"]);
  return port === "1025" && host && mailpitHosts.has(host)
    ? "Mailpit development SMTP"
    : "Configured SMTP server";
}

function logEmailError(error: unknown) {
  const details = error as { name?: unknown; message?: unknown; code?: unknown };
  const message =
    typeof details?.message === "string" ? details.message : "Unknown email error";
  const password = process.env.SMTP_PASS;
  console.error("SMTP test email failed:", {
    name: typeof details?.name === "string" ? details.name : "UnknownError",
    message: password ? message.replaceAll(password, "[redacted]") : message,
    code: typeof details?.code === "string" ? details.code : undefined,
  });
}

export async function POST(request: Request) {
  let session;
  try {
    session = await getSession();
  } catch (error) {
    console.error(
      "SMTP test authorization failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { ok: false, error: "Unable to authorize SMTP test" },
      { status: 500 },
    );
  }

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  let body: unknown = {};
  const rawBody = await request.text();
  if (rawBody.trim()) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "Request body must be a JSON object" },
      { status: 400 },
    );
  }

  const suppliedRecipient = (body as { to?: unknown }).to;
  if (suppliedRecipient !== undefined && typeof suppliedRecipient !== "string") {
    return NextResponse.json(
      { ok: false, error: "Recipient must be a valid email address" },
      { status: 400 },
    );
  }

  const recipient = suppliedRecipient?.trim() || process.env.ALERT_EMAIL_TO?.trim();
  if (!recipient) {
    return NextResponse.json(
      { ok: false, error: "Recipient is required; provide to or configure ALERT_EMAIL_TO" },
      { status: 400 },
    );
  }
  if (!isValidEmail(recipient)) {
    return NextResponse.json(
      { ok: false, error: "Recipient must be a valid email address" },
      { status: 400 },
    );
  }

  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || "development";
  const provider = getProviderLabel();
  const senderName = process.env.SMTP_FROM_NAME?.trim() || "SEAOIL Printer";
  const subject = "SEAOIL Printer Monitoring - SMTP Test";
  const text = [
    "SEAOIL Printer Monitoring",
    "",
    "Email Notification Test",
    "",
    "Status: SMTP connection successful",
    "",
    "This test confirms that the SEAOIL Printer Monitoring System can send email notifications through the configured SMTP server.",
    "",
    `Timestamp: ${timestamp}`,
    `Environment: ${environment}`,
    `SMTP mode: ${provider}`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f2937">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
          <tr><td style="background:#f58220;padding:20px 28px;color:#ffffff;font-size:22px;font-weight:bold">SEAOIL Printer</td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 16px;font-size:24px;color:#111827">Email Notification Test</h1>
            <p style="margin:0 0 24px"><span style="display:inline-block;padding:8px 12px;border-radius:4px;background:#dcfce7;color:#166534;font-weight:bold">SMTP Connection Successful</span></p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.6">
              <tr><td style="padding:6px 0;color:#6b7280">Timestamp</td><td style="padding:6px 0">${escapeHtml(timestamp)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Environment</td><td style="padding:6px 0">${escapeHtml(environment)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Notification type</td><td style="padding:6px 0">SMTP Test</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">SMTP mode</td><td style="padding:6px 0">${escapeHtml(provider)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">Sender</td><td style="padding:6px 0">${escapeHtml(senderName)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280">System</td><td style="padding:6px 0">SEAOIL Printer Monitoring</td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px">This is an automated notification from the SEAOIL Printer Monitoring System.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    await sendEmail({ to: recipient, subject, text, html });
    return NextResponse.json({ ok: true, message: "Test email sent successfully" });
  } catch (error) {
    logEmailError(error);
    const status = error instanceof EmailConfigurationError ? 503 : 502;
    return NextResponse.json(
      { ok: false, error: "Unable to send test email" },
      { status },
    );
  }
}
