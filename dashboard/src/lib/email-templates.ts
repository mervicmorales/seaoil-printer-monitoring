export type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

export const EMAIL_ADVISORY = "The information transmitted is the property of SEAOIL and intended only for the addressee and may contain confidential, proprietary and/or privileged material. Any unauthorized review, distribution or other use of or the taking of any action in reliance upon this information is prohibited. If you received this in error, please contact the sender and delete or destroy this message and any copies.";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function detailTable(rows: Array<{ label: string; value: string; emphasis?: boolean }>) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:14px">
    ${rows.map((row, index) => `<tr>
      <td style="padding:13px 16px;${index < rows.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}color:#64748b;width:42%">${escapeHtml(row.label)}</td>
      <td style="padding:13px 16px;${index < rows.length - 1 ? "border-bottom:1px solid #e2e8f0;" : ""}${row.emphasis ? "font-weight:700;color:#0f172a" : "color:#334155"}">${escapeHtml(row.value)}</td>
    </tr>`).join("")}
  </table>`;
}

function brandedEmail({
  subject,
  title,
  preheader,
  greeting,
  body,
  action,
  details,
  notice,
  status,
}: {
  subject: string;
  title: string;
  preheader: string;
  greeting?: string;
  body: string[];
  action?: { label: string; url: string };
  details?: Array<{ label: string; value: string; emphasis?: boolean }>;
  notice?: string;
  status?: { label: string; value: string; tone: "success" | "danger" | "info" };
}) {
  const tones = {
    success: { background: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
    danger: { background: "#fef2f2", border: "#fecaca", color: "#991b1b" },
    info: { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  } as const;
  const statusColors = status ? tones[status.tone] : null;
  const statusBlock = status && statusColors
    ? `<tr>
        <td style="padding:0 32px 24px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${statusColors.background};border:1px solid ${statusColors.border};border-radius:8px">
            <tr>
              <td style="padding:14px 16px;color:#6b7280;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${escapeHtml(status.label)}</td>
              <td align="right" style="padding:14px 16px;color:${statusColors.color};font-size:14px;font-weight:800">${escapeHtml(status.value)}</td>
            </tr>
          </table>
        </td>
      </tr>`
    : "";
  const actionBlock = action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0">
        <tr>
          <td style="border-radius:7px;background:#f58220">
            <a href="${escapeHtml(action.url)}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">${escapeHtml(action.label)}</a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 22px;color:#64748b;font-size:12px;line-height:1.6">If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtml(action.url)}" style="color:#014171;word-break:break-all">${escapeHtml(action.url)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f5f7;color:#1f2937;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f5f7">
      <tr>
        <td align="center" style="padding:32px 12px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dde3ea;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,.06)">
            <tr><td style="height:6px;background:#f58220;font-size:0;line-height:0">&nbsp;</td></tr>
            <tr>
              <td style="padding:26px 32px 18px">
                <p style="margin:0 0 8px;color:#014171;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">SEAOIL Printer Management</p>
                <h1 style="margin:0;color:#111827;font-size:25px;line-height:1.25">${escapeHtml(title)}</h1>
              </td>
            </tr>
            ${statusBlock}
            <tr>
              <td style="padding:0 32px 28px;font-size:15px;line-height:1.7">
                ${greeting ? `<p style="margin:0 0 16px;font-weight:700;color:#111827">Hello ${escapeHtml(greeting)},</p>` : ""}
                ${body.map((paragraph) => `<p style="margin:0 0 16px">${escapeHtml(paragraph)}</p>`).join("")}
                ${actionBlock}
                ${details?.length ? detailTable(details) : ""}
                ${notice ? `<p style="margin:20px 0 0;padding:14px 16px;background:#fffbeb;border-left:4px solid #f59e0b;color:#78350f;font-size:13px;line-height:1.6">${escapeHtml(notice)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.6">
                <p style="margin:0"><strong style="color:#475569">ADVISORY:</strong> ${escapeHtml(EMAIL_ADVISORY)}</p>
              </td>
            </tr>
            <tr><td align="center" style="padding:14px 24px;background:#014171;color:#dbeafe;font-size:11px">This is an automated notification from the SEAOIL Printer Management System.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function textEmail(lines: string[]) {
  return [...lines, "", `ADVISORY: ${EMAIL_ADVISORY}`].join("\n");
}

export function buildEmailVerificationEmail({
  fullName,
  employeeId,
  verificationUrl,
}: {
  fullName: string;
  employeeId: string;
  verificationUrl: string;
}): EmailTemplate {
  const subject = "SEAOIL Printer - Verify Your Email";
  const nextStep = "After verification, your registration will be submitted for administrator approval.";
  return {
    subject,
    text: textEmail([
      `Hello ${fullName},`,
      "Thank you for registering with SEAOIL Printer Monitoring.",
      `Employee ID: ${employeeId}`,
      "Verify your email using the link below:",
      verificationUrl,
      `This single-use link expires in 24 hours. ${nextStep}`,
    ]),
    html: brandedEmail({
      subject,
      title: "Email Verification",
      preheader: "Verify your email address to continue your registration.",
      greeting: fullName,
      body: ["Thank you for registering with SEAOIL Printer Monitoring. Please confirm your email address to continue."],
      action: { label: "Verify Email Address", url: verificationUrl },
      details: [
        { label: "Employee ID", value: employeeId, emphasis: true },
        { label: "Link Validity", value: "24 hours" },
      ],
      notice: nextStep,
    }),
  };
}

export function buildUserAccountVerificationEmail({
  fullName,
  employeeId,
  verificationUrl,
}: {
  fullName: string;
  employeeId?: string | null;
  verificationUrl: string;
}): EmailTemplate {
  const subject = "SEAOIL Printer - Verify Your User Account";
  const expiry = "This single-use link expires in 24 hours. No additional administrator approval is required after verification.";
  return {
    subject,
    text: textEmail([
      `Hello ${fullName},`,
      "A user account was created for you in SEAOIL Printer Monitoring.",
      ...(employeeId ? [`Employee ID: ${employeeId}`] : []),
      "Verify your email using the link below to activate your account:",
      verificationUrl,
      expiry,
    ]),
    html: brandedEmail({
      subject,
      title: "Verify User Account",
      preheader: "Verify your email address to activate your user account.",
      greeting: fullName,
      body: ["A user account was created for you in SEAOIL Printer Monitoring. Verify your email address to activate it."],
      action: { label: "Verify and Activate Account", url: verificationUrl },
      details: [
        ...(employeeId ? [{ label: "Employee ID", value: employeeId, emphasis: true }] : []),
        { label: "Link Validity", value: "24 hours" },
      ],
      notice: "No additional administrator approval is required after verification.",
    }),
  };
}

export function buildPasswordResetEmail({
  fullName,
  resetUrl,
  requestedByIt = false,
}: {
  fullName: string;
  resetUrl: string;
  requestedByIt?: boolean;
}): EmailTemplate {
  const subject = "SEAOIL Printer - Reset Your Password";
  const opening = requestedByIt
    ? "SEAOIL IT requested a password reset for your account."
    : "We received a request to reset the password for your account.";
  const safetyNotice = requestedByIt
    ? "If you were not expecting this email, please contact IT Support."
    : "If you did not request this change, you can safely ignore this email.";
  return {
    subject,
    text: textEmail([
      `Hello ${fullName},`,
      opening,
      "Use the link below to set a new password:",
      resetUrl,
      "This single-use link expires in 1 hour.",
      safetyNotice,
    ]),
    html: brandedEmail({
      subject,
      title: "Reset Password",
      preheader: "Use this secure, single-use link to reset your password.",
      greeting: fullName,
      body: [opening, "Use the secure link below to set a new password for your account."],
      action: { label: "Reset Password", url: resetUrl },
      details: [{ label: "Link Validity", value: "1 hour", emphasis: true }],
      notice: safetyNotice,
    }),
  };
}

export function buildAgentStatusEmail({
  transition,
  agentName,
  agentKey,
  location,
  previousLastSeen,
  occurredAt,
}: {
  transition: "offline" | "recovered";
  agentName: string;
  agentKey: string;
  location: string;
  previousLastSeen: string;
  occurredAt: string;
}): EmailTemplate {
  const offline = transition === "offline";
  const subject = offline
    ? "SEAOIL Printer - Monitoring Agent Offline"
    : "SEAOIL Printer - Monitoring Agent Recovered";
  const title = offline ? "Monitoring Agent Offline" : "Monitoring Agent Recovered";
  const eventLabel = offline ? "Detected At" : "Recovered At";
  const body = offline
    ? "The monitoring agent is no longer reporting to the SEAOIL Printer Management System. Printer readings from this office may be unavailable until connectivity is restored."
    : "The monitoring agent has resumed reporting to the SEAOIL Printer Management System. Printer monitoring for this office is operational again.";
  return {
    subject,
    text: textEmail([
      title.toUpperCase(),
      "",
      body,
      "",
      `Agent Name: ${agentName}`,
      `Agent Key: ${agentKey}`,
      `Office: ${location}`,
      `${offline ? "Last Seen" : "Previous Last Seen"}: ${previousLastSeen}`,
      `${eventLabel}: ${occurredAt}`,
    ]),
    html: brandedEmail({
      subject,
      title,
      preheader: offline
        ? `Monitoring agent ${agentName} is offline.`
        : `Monitoring agent ${agentName} has recovered.`,
      body: [body],
      status: {
        label: "Agent Status",
        value: offline ? "OFFLINE" : "RECOVERED",
        tone: offline ? "danger" : "success",
      },
      details: [
        { label: "Agent Name", value: agentName, emphasis: true },
        { label: "Agent Key", value: agentKey },
        { label: "Office", value: location },
        { label: offline ? "Last Seen" : "Previous Last Seen", value: previousLastSeen },
        { label: eventLabel, value: occurredAt },
      ],
      notice: offline ? "Please check the agent host, network connection, and service status." : undefined,
    }),
  };
}

export function buildPrinterAccessRequestEmail({
  employeeName,
  employeeEmail,
  printerSerialNumber,
  printerModel,
  location,
  department,
  ipAddress,
  agentName,
  requestedAt,
  reviewUrl,
}: {
  employeeName: string;
  employeeEmail: string;
  printerSerialNumber: string;
  printerModel?: string | null;
  location?: string | null;
  department?: string | null;
  ipAddress?: string | null;
  agentName: string;
  requestedAt: string;
  reviewUrl: string;
}): EmailTemplate {
  const subject = `SEAOIL Printer - Access Request from ${employeeName}`;
  const requestSummary = `${employeeName} requested access to an additional printer.`;
  return {
    subject,
    text: textEmail([
      "ADDITIONAL PRINTER ACCESS REQUEST",
      "",
      requestSummary,
      "Review the request using the link below:",
      reviewUrl,
      "",
      `Employee Name: ${employeeName}`,
      `Employee Email: ${employeeEmail}`,
      `Printer Serial Number: ${printerSerialNumber}`,
      `Printer Model: ${printerModel || "Not provided"}`,
      `Office: ${location || "Not provided"}`,
      `Department: ${department || "Not provided"}`,
      `IP Address: ${ipAddress || "Not provided"}`,
      `Monitoring Agent: ${agentName}`,
      `Requested At: ${requestedAt}`,
      "Request Status: Pending review",
    ]),
    html: brandedEmail({
      subject,
      title: "Additional Printer Access Request",
      preheader: `${employeeName} requested access to printer ${printerSerialNumber}.`,
      body: [
        requestSummary,
        "Please review the employee's printer permissions and approve the requested printer when appropriate.",
      ],
      action: { label: "Review Printer Request", url: reviewUrl },
      status: { label: "Request Status", value: "PENDING REVIEW", tone: "info" },
      details: [
        { label: "Employee Name", value: employeeName, emphasis: true },
        { label: "Employee Email", value: employeeEmail },
        { label: "Printer Serial Number", value: printerSerialNumber, emphasis: true },
        { label: "Printer Model", value: printerModel || "Not provided" },
        { label: "Office", value: location || "Not provided" },
        { label: "Department", value: department || "Not provided" },
        { label: "IP Address", value: ipAddress || "Not provided" },
        { label: "Monitoring Agent", value: agentName },
        { label: "Requested At", value: requestedAt },
      ],
      notice: "Grant access only after confirming that the employee is authorized to use this printer.",
    }),
  };
}

export function buildPrinterAccessRequestCompose({
  employeeName,
  employeeEmail,
  printerSerialNumber,
  printerModel,
  location,
  department,
  ipAddress,
  agentName,
  requestedAt,
  reviewUrl,
}: {
  employeeName: string;
  employeeEmail: string;
  printerSerialNumber: string;
  printerModel?: string | null;
  location?: string | null;
  department?: string | null;
  ipAddress?: string | null;
  agentName: string;
  requestedAt: string;
  reviewUrl: string;
}) {
  const subject = `Printer Access Request - ${employeeName} - ${printerSerialNumber}`;
  const body = [
    "Hello IT Service Desk,",
    "",
    "I would like to request access to the additional printer listed below.",
    "",
    "EMPLOYEE INFORMATION",
    "──────────────────────────────",
    `Name: ${employeeName}`,
    `Email: ${employeeEmail}`,
    "",
    "PRINTER INFORMATION",
    "──────────────────────────────",
    `Serial Number: ${printerSerialNumber}`,
    `Model: ${printerModel || "Not provided"}`,
    `Office: ${location || "Not provided"}`,
    `Department: ${department || "Not provided"}`,
    `IP Address: ${ipAddress || "Not provided"}`,
    `Monitoring Agent: ${agentName}`,
    "",
    "REQUEST INFORMATION",
    "──────────────────────────────",
    `Submitted: ${requestedAt}`,
    "Status: Pending IT approval",
    `Review request: ${reviewUrl}`,
    "",
    "Thank you,",
    employeeName,
  ].join("\n");
  return { subject, body };
}

export function buildRegistrationApprovedEmail({
  fullName,
  loginUrl,
}: {
  fullName: string;
  loginUrl: string;
}): EmailTemplate {
  const subject = "SEAOIL Printer - Registration Approved";
  return {
    subject,
    text: textEmail([
      `Hello ${fullName},`,
      "Your registration has been approved successfully.",
      "You can now sign in using the link below:",
      loginUrl,
    ]),
    html: brandedEmail({
      subject,
      title: "Registration Approved",
      preheader: "Your SEAOIL Printer Monitoring registration has been approved.",
      greeting: fullName,
      body: ["Your registration has been approved successfully. Your SEAOIL Printer Monitoring account is now ready to use."],
      action: { label: "Sign In to Your Account", url: loginUrl },
      status: { label: "Registration Status", value: "APPROVED", tone: "success" },
    }),
  };
}
