import nodemailer from "nodemailer";

// Best-effort email sender. If SMTP env vars are not configured, this
// silently logs to the console instead of throwing, so the rest of the
// application keeps working in environments without outbound mail access.
export async function sendEmail(to: string, subject: string, text: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass || !to) {
    console.log(`[email:skipped] to=${to} subject="${subject}" body="${text}"`);
    return { sent: false };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    console.error("[email:error]", err);
    return { sent: false };
  }
}
