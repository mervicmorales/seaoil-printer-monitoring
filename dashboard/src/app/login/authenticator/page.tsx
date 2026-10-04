import { redirect } from "next/navigation";
import { getMfaChallenge } from "@/lib/auth";
import AuthenticatorFrame from "./AuthenticatorFrame";
import AuthenticatorForm from "./AuthenticatorForm";

export const dynamic = "force-dynamic";

export default async function AuthenticatorPage() {
  const challenge = await getMfaChallenge();
  if (!challenge) redirect("/login");
  if (challenge.purpose === "enroll") redirect("/login/authenticator/setup");

  return (
    <AuthenticatorFrame
      eyebrow="Two-step verification"
      title="Enter your security code"
      description="Open Google Authenticator or another compatible authenticator app and enter the current code."
    >
      <AuthenticatorForm />
    </AuthenticatorFrame>
  );
}
