"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input, Select, PrimaryButton, SecondaryButton } from "@/components/ui";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";
import type { UserFormState } from "./actions";
import Link from "next/link";

type UserRecord = { id: number; fullName: string; email: string; username: string; role: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </PrimaryButton>
  );
}

export default function UserForm({
  mode,
  action,
  user,
}: {
  mode: "create" | "edit";
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  user?: UserRecord;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" && user && <input type="hidden" name="id" value={user.id} />}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Full Name" name="fullName" required defaultValue={user?.fullName ?? ""} error={state.fieldErrors?.fullName} />
        <Input label="Email Address" name="email" type="email" required defaultValue={user?.email ?? ""} error={state.fieldErrors?.email} />
        <Input label="Username" name="username" required defaultValue={user?.username ?? ""} error={state.fieldErrors?.username} />
        <Select label="Role" name="role" defaultValue={user?.role ?? "user"} required>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </Select>
        <div className="sm:col-span-2">
          <Input
            label={mode === "create" ? "Password" : "New Password (leave blank to keep current)"}
            name="password"
            type="password"
            required={mode === "create"}
            error={state.fieldErrors?.password}
          />
          <p className="mt-1 text-xs text-slate-400">{PASSWORD_RULE_TEXT}</p>
        </div>
      </div>
      <div className="flex gap-3">
        <SubmitButton label={mode === "create" ? "Create User" : "Save Changes"} />
        <Link href="/manage"><SecondaryButton type="button">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}
