"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  MapPin,
  Save,
  UserPlus,
  UserRound,
  type IconNode,
} from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, Select, PrimaryButton, SecondaryButton } from "@/components/ui";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";
import SearchableSelect from "@/components/SearchableSelect";
import type { UserFormState } from "./actions";
import Link from "next/link";
import { isSuperAdmin, type UserRole } from "@/lib/roles";

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
    <PrimaryButton type="submit" disabled={pending} className="w-full px-5 sm:w-auto">
      <MorphIcon
        icon={pending ? LoaderCircle : label === "Create Account" ? UserPlus : Save}
        size={15}
        strokeWidth={2}
        reducedMotion="user"
        className={pending ? "animate-spin" : ""}
      />
      {pending ? "Saving…" : label}
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
  employeeOnly = false,
  showActions = true,
  actorRole,
}: {
  mode: "create" | "edit";
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  user?: UserRecord;
  locations: Lookup[];
  departments: Lookup[];
  returnTo?: "/manage" | "/manage/registrations";
  employeeOnly?: boolean;
  showActions?: boolean;
  actorRole: UserRole;
}) {
  const [state, formAction] = useActionState(action, {});
  const [role, setRole] = useState(employeeOnly ? "employee" : (user?.role === "user" ? "support" : (user?.role ?? "support")));
  const [showPassword, setShowPassword] = useState(false);
  const employeeRequired = role === "employee";
  const assignmentRequired = employeeRequired || role === "support";

  return (
    <form
      id={mode === "create" ? "user-create-form" : "user-edit-form"}
      action={formAction}
      className="space-y-5"
    >
      {mode === "edit" && user && <input type="hidden" name="id" value={user.id} />}
      {mode === "create" && <input type="hidden" name="returnTo" value={returnTo} />}
      {state.error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">
          <MorphIcon icon={AlertCircle} size={18} strokeWidth={2} reducedMotion="user" className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <div className="space-y-5">
        <section>
          <FormSectionHeader
            icon={UserRound}
            title="Account details"
            description="Identity, sign-in information, and system role"
          />
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:grid-cols-2 sm:p-5">
            <Input label="Full Name" name="fullName" autoComplete="name" required defaultValue={user?.fullName ?? ""} error={state.fieldErrors?.fullName} />
            <Input label="Email Address" name="email" type="email" autoComplete="email" required defaultValue={user?.email ?? ""} error={state.fieldErrors?.email} />
            <Input label="Username" name="username" autoComplete="username" required defaultValue={user?.username ?? ""} error={state.fieldErrors?.username} />
            <Select label="Role" name="role" value={role} onChange={(event) => setRole(event.target.value)} required>
              <option value="employee">Employee</option>
              {!employeeOnly && <option value="support">Support</option>}
              {!employeeOnly && isSuperAdmin(actorRole) && <option value="admin">Admin</option>}
              {!employeeOnly && isSuperAdmin(actorRole) && <option value="super_admin">Super Admin</option>}
            </Select>
          </div>
          {state.fieldErrors?.role && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.role}</p>}
        </section>

        <section>
          <FormSectionHeader
            icon={MapPin}
            title="Assignment details"
            description="Employee record and primary organizational assignment"
          />
          <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            <Input
              label="Employee ID"
              name="employeeId"
              required={employeeRequired}
              defaultValue={user?.employeeId ?? ""}
              error={state.fieldErrors?.employeeId}
            />
            <SearchableSelect
              label="Location"
              name="primaryLocationId"
              options={locations}
              placeholder="Search location..."
              required={assignmentRequired}
              defaultValue={user?.primaryLocationId}
              error={state.fieldErrors?.primaryLocationId}
            />
            <SearchableSelect
              label="Department"
              name="departmentId"
              options={departments}
              placeholder="Search department..."
              required={assignmentRequired}
              defaultValue={user?.departmentId}
              error={state.fieldErrors?.departmentId}
            />
          </div>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-xs leading-5 text-sky-800">
            <span className="mt-0.5 shrink-0 text-[#014171]"><MorphIcon icon={KeyRound} size={14} strokeWidth={2} reducedMotion="user" /></span>
            <span>
              {role === "employee"
                ? "Employees automatically receive printers for their location and department; additional printer grants are saved on their profile."
                : role === "support"
                  ? "Support users automatically receive printers for their location and department; additional printer grants are saved on their profile."
                  : role === "admin"
                    ? "Admin module access is configured by a Super Admin."
                    : "Super Admins have full system access and authority over all roles."}
            </span>
          </div>
        </section>

        {mode === "create" && <section>
          <FormSectionHeader
            icon={LockKeyhole}
            title="Account security"
            description="Set the initial password for the new account"
          />
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5">
            <label htmlFor="user-password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password<span className="text-red-500"> *</span>
            </label>
            <div className="relative">
              <input
                id="user-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
                aria-describedby={state.fieldErrors?.password ? "user-password-error" : undefined}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#014171]/20"
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
            <p className="mt-1.5 text-xs text-slate-500">{PASSWORD_RULE_TEXT}</p>
          </div>
        </section>}
      </div>
      {mode === "create" && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          <span className="mt-1 shrink-0"><MorphIcon icon={KeyRound} size={15} strokeWidth={2} reducedMotion="user" /></span>
          <p>The account will remain inactive until the user verifies the email link sent after creation. No administrator approval is required afterward.</p>
        </div>
      )}
      <div className={showActions ? "flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end" : "hidden"}>
        <SubmitButton label={mode === "create" ? "Create Account" : "Save Changes"} />
        <Link href={returnTo} className="w-full sm:w-auto"><SecondaryButton type="button" className="w-full sm:w-auto">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}

function FormSectionHeader({
  icon,
  title,
  description,
}: {
  icon: IconNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
        <MorphIcon icon={icon} size={17} strokeWidth={2} reducedMotion="user" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-[#014171]">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}
