"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
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
}: {
  mode: "create" | "edit";
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  user?: UserRecord;
  locations: Lookup[];
  departments: Lookup[];
}) {
  const [state, formAction] = useActionState(action, {});
  const [role, setRole] = useState(user?.role === "user" ? "support" : (user?.role ?? "support"));
  const employeeRequired = role === "employee";

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
