import Image from "next/image";
import Link from "next/link";
import { AUTH_LOGO_URL } from "@/lib/branding";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <div className="mb-6 size-12 overflow-hidden">
          <Image
            src={AUTH_LOGO_URL}
            alt="SEAOIL logo"
            width={512}
            height={512}
            priority
            className="size-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-[#014171]">Forgot your password?</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter the email address connected to your account. We’ll send you a secure link to create a new password.
        </p>

        <ForgotPasswordForm />

        <p className="mt-6 text-center text-sm text-slate-500">
          Remembered your password?{" "}
          <Link href="/login" className="font-medium text-[#014171] hover:underline">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
