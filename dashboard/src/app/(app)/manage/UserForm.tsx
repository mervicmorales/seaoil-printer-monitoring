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
import { Input, PrimaryButton, SecondaryButton } from "@/components/ui";
import SearchableDropdown from "@/components/SearchableDropdown";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";
import OrganizationFields, { type OrganizationFieldOptions } from "@/components/OrganizationFields";
import type { UserFormState } from "./actions";
import Link from "next/link";
import { isSuperAdmin, type UserRole } from "@/lib/roles";

type UserRecord = {
  id: number;
  fullName: string;
  email: string;
  username: string;
  role: string;
  employeeId: string | null;
  primaryLocationId: number | null;
  departmentId: number | null;
  subunitId: number | null;
  costCenterId: number | null;
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
  organizationOptions,
  returnTo = "/manage",
  employeeOnly = false,
  showActions = true,
  fitPanel = false,
  actorRole,
}: {
  mode: "create" | "edit";
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  user?: UserRecord;
  organizationOptions: OrganizationFieldOptions;
  returnTo?: "/manage" | "/manage/registrations";
  employeeOnly?: boolean;
  showActions?: boolean;
  fitPanel?: boolean;
  actorRole: UserRole;
}) {
  const [state, formAction] = useActionState(action, {});
  const [role, setRole] = useState(employeeOnly ? "employee" : (user?.role === "user" ? "support" : (user?.role ?? "support")));
  const [showPassword, setShowPassword] = useState(false);
  const employeeRequired = role === "employee";
  const assignmentRequired = employeeRequired || role === "support";
  const insetEditStyle = fitPanel && mode === "edit";

  return (
    <form
      id={mode === "create" ? "user-create-form" : "user-edit-form"}
      action={formAction}
      className={insetEditStyle ? "space-y-4" : fitPanel ? "flex h-full min-h-0 flex-col" : "space-y-5"}
    >
      {mode === "edit" && user && <input type="hidden" name="id" value={user.id} />}
      {mode === "create" && <input type="hidden" name="returnTo" value={returnTo} />}
      {state.error && (
        <div role="alert" className={`flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700 ${fitPanel ? "mb-3" : ""}`}>
          <MorphIcon icon={AlertCircle} size={18} strokeWidth={2} reducedMotion="user" className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      <div className={insetEditStyle ? "space-y-4" : fitPanel ? "grid min-h-0 flex-1 grid-rows-2 gap-3" : "space-y-5"}>
        <section className={fitPanel && !insetEditStyle ? "flex min-h-0 flex-col" : ""}>
          <FormSectionHeader
            icon={UserRound}
            title="Account details"
            description="Identity, sign-in information, and system role"
            insetStyle={insetEditStyle}
          />
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${insetEditStyle ? "gap-3 px-3 py-3" : fitPanel ? "mt-3 min-h-0 flex-1 content-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/35 p-3.5" : "mt-4 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5"}`}>
            <Input label="Full Name" floatingLabel name="fullName" autoComplete="name" required defaultValue={user?.fullName ?? ""} error={state.fieldErrors?.fullName} />
            <Input label="Email Address" floatingLabel name="email" type="email" autoComplete="email" required defaultValue={user?.email ?? ""} error={state.fieldErrors?.email} />
            <Input label="Username" floatingLabel name="username" autoComplete="username" required defaultValue={user?.username ?? ""} error={state.fieldErrors?.username} />
            <SearchableDropdown
              label="Role"
              name="role"
              value={role}
              onValueChange={setRole}
              required
              floatingLabel
              placeholder="Search roles..."
              options={[
                { value: "employee", label: "Employee" },
                ...(!employeeOnly ? [{ value: "support", label: "Support" }] : []),
                ...(!employeeOnly && isSuperAdmin(actorRole) ? [{ value: "admin", label: "Admin" }, { value: "super_admin", label: "Super Admin" }] : []),
              ]}
            />
          </div>
          {state.fieldErrors?.role && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.role}</p>}
        </section>

        <section className={fitPanel && !insetEditStyle ? "flex min-h-0 flex-col" : ""}>
          <FormSectionHeader
            icon={MapPin}
            title="Assignment details"
            description="Employee record and primary organizational assignment"
            insetStyle={insetEditStyle}
          />
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${insetEditStyle ? "gap-3 px-3 py-3" : fitPanel ? "mt-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50/35 p-3.5" : "mt-4 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5"}`}>
            <Input
              label="Employee ID"
              floatingLabel
              name="employeeId"
              required={employeeRequired}
              defaultValue={user?.employeeId ?? ""}
              error={state.fieldErrors?.employeeId}
            />
            <OrganizationFields
              options={organizationOptions}
              locationFieldName="primaryLocationId"
              initialLocationId={user?.primaryLocationId}
              initialDepartmentId={user?.departmentId}
              initialSubunitId={user?.subunitId}
              initialCostCenterId={user?.costCenterId}
              requiredLocation={assignmentRequired}
              requiredDepartment={assignmentRequired}
              requiredSubunit={assignmentRequired}
              floatingLabel
              errors={state.fieldErrors}
              className="contents"
            />
          </div>
          <div className={`mt-3 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 text-xs text-sky-800 ${fitPanel ? "px-3 py-2 leading-4" : "px-3.5 py-3 leading-5"}`}>
            <span className="mt-0.5 shrink-0 text-[#014171]"><MorphIcon icon={KeyRound} size={14} strokeWidth={2} reducedMotion="user" /></span>
            <span>
              {role === "employee"
                ? "Employees automatically receive printers for their organizational assignment; additional printer grants are saved on their profile."
                : role === "support"
                  ? "Support users automatically receive printers for their organizational assignment; additional printer grants are saved on their profile."
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
            <div className="add-printer-floating-field relative">
              <input
                id="user-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder=" "
                autoComplete="new-password"
                required
                aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
                aria-describedby={state.fieldErrors?.password ? "user-password-error" : undefined}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 pb-1 pt-4 pr-11 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#040273] focus:ring-2 focus:ring-[#040273]/15"
              />
              <label htmlFor="user-password">Password <span className="text-red-500">*</span></label>
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
      <div className={showActions ? "sticky bottom-4 z-10 -mx-2 flex flex-col-reverse gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_12px_36px_rgba(15,23,42,0.14)] backdrop-blur sm:flex-row sm:items-center sm:justify-end" : "hidden"}>
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
  insetStyle = false,
}: {
  icon: IconNode;
  title: string;
  description: string;
  insetStyle?: boolean;
}) {
  if (insetStyle) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg bg-slate-100 px-3.5 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm">
          <MorphIcon icon={icon} size={15} strokeWidth={2} reducedMotion="user" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
      </div>
    );
  }

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
