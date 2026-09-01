"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, Select, PrimaryButton, SecondaryButton } from "@/components/ui";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";
import SearchableSelect from "@/components/SearchableSelect";
import type { UserFormState } from "./actions";
import Link from "next/link";

type Lookup = { id: number; name: string };
type UserRecord = {
  id: number;
  fullName: string;
  email: string;
  username: string;
  role: string;
  employeeId: string | null;
  primaryLocationId: number | null;
  departmentId: number | null;
};

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
  locations,
  departments,
  returnTo = "/manage",
}: {
  mode: "create" | "edit";
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  user?: UserRecord;
  locations: Lookup[];
  departments: Lookup[];
  returnTo?: "/manage" | "/manage/registrations";
}) {
  const [state, formAction] = useActionState(action, {});
  const [role, setRole] = useState(user?.role === "user" ? "support" : (user?.role ?? "support"));
  const [showPassword, setShowPassword] = useState(false);
  const employeeRequired = role === "employee";

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" && user && <input type="hidden" name="id" value={user.id} />}
      {mode === "create" && <input type="hidden" name="returnTo" value={returnTo} />}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Full Name" name="fullName" required defaultValue={user?.fullName ?? ""} error={state.fieldErrors?.fullName} />
        <Input label="Email Address" name="email" type="email" required defaultValue={user?.email ?? ""} error={state.fieldErrors?.email} />
        <Input label="Username" name="username" required defaultValue={user?.username ?? ""} error={state.fieldErrors?.username} />
        <Select label="Role" name="role" value={role} onChange={(event) => setRole(event.target.value)} required>
          <option value="employee">Employee</option>
          <option value="support">Support</option>
          <option value="admin">Admin</option>
        </Select>
        <Input
          label="Employee ID"
          name="employeeId"
          placeholder="SPI00001"
          required={employeeRequired}
          defaultValue={user?.employeeId ?? ""}
          error={state.fieldErrors?.employeeId}
        />
        <SearchableSelect
          label="Location"
          name="primaryLocationId"
          options={locations}
          placeholder="Search location..."
          required={employeeRequired}
          defaultValue={user?.primaryLocationId}
          error={state.fieldErrors?.primaryLocationId}
        />
        <SearchableSelect
          label="Department"
          name="departmentId"
          options={departments}
          placeholder="Search department..."
          required={employeeRequired}
          defaultValue={user?.departmentId}
          error={state.fieldErrors?.departmentId}
        />
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs text-sky-800">
          {role === "employee"
            ? "Employees only see active printers assigned to their selected location and department."
            : role === "support"
              ? "Support access is controlled through module permissions in User Management."
              : "Administrators always have full system access."}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="user-password" className="mb-1.5 block text-sm font-medium text-slate-700">
            {mode === "create" ? "Password" : "New Password (leave blank to keep current)"}
            {mode === "create" && <span className="text-red-500"> *</span>}
          </label>
          <div className="relative">
            <input
              id="user-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required={mode === "create"}
              aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
              aria-describedby={state.fieldErrors?.password ? "user-password-error" : undefined}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-11 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
            >
              <MorphIcon
                icon={showPassword ? EyeOff : Eye}
                size={18}
                strokeWidth={2}
                reducedMotion="user"
              />
            </button>
          </div>
          {state.fieldErrors?.password && (
            <p id="user-password-error" className="mt-1 text-xs text-red-600">
              {state.fieldErrors.password}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">{PASSWORD_RULE_TEXT}</p>
        </div>
      </div>
      {mode === "create" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The account will remain inactive until the user verifies the email link sent after creation. No administrator approval is required afterward.
        </p>
      )}
      <div className="flex gap-3">
        <SubmitButton label={mode === "create" ? "Create Account" : "Save Changes"} />
        <Link href={returnTo}><SecondaryButton type="button">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}
