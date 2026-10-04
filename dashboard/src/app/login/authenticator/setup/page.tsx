import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getMfaChallenge, getSession } from "@/lib/auth";
import { decryptMfaSecret } from "@/lib/mfa-secrets";
import { buildTotpUri } from "@/lib/totp";
import AuthenticatorFrame from "../AuthenticatorFrame";
import RequiredSetupForm from "./RequiredSetupForm";

export const dynamic = "force-dynamic";

export default async function RequiredAuthenticatorSetupPage() {
  const challenge = await getMfaChallenge();
  if (!challenge) redirect("/login");
  if (challenge.purpose === "verify") redirect("/login/authenticator");
  const [account, session] = await Promise.all([db
    .select({
      id: users.id,
      email: users.email,
      pendingSecret: users.totpPendingSecretEncrypted,
      enabledAt: users.totpEnabledAt,
      sessionVersion: users.sessionVersion,
    })
    .from(users)
    .where(eq(users.id, challenge.userId))
    .limit(1).then((rows) => rows[0]), getSession()]);
  const challengeIsCurrent = account?.sessionVersion === challenge.sessionVersion;
  const enrollmentJustCompleted = Boolean(account?.enabledAt && session?.id === account.id);
  if (!account || (!challengeIsCurrent && !enrollmentJustCompleted)) redirect("/login");

  let secret: string | null = null;
  let qrDataUrl: string | null = null;
  if (account.pendingSecret) {
    try {
      secret = decryptMfaSecret(account.pendingSecret);
    } catch {
      redirect("/login?mfa=config");
    }
    qrDataUrl = await QRCode.toDataURL(buildTotpUri(secret, account.email), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#014171", light: "#ffffff" },
    });
  }

  return (
    <AuthenticatorFrame
      eyebrow="Required account protection"
      title="Set up an authenticator"
      description="Administrator accounts require two-step verification. Use Google Authenticator or any compatible TOTP app."
    >
      <RequiredSetupForm qrDataUrl={qrDataUrl} manualSecret={secret} />
    </AuthenticatorFrame>
  );
}
