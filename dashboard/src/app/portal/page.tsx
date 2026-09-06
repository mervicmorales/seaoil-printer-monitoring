import { and, asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  departments,
  locations,
  printers,
  userPrinterPermissions,
  users,
} from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const session = await requireSession();
  if (session.role !== "employee") redirect("/dashboard");

  const [employee] = await db.select({
    fullName: users.fullName,
    employeeId: users.employeeId,
    accountStatus: users.accountStatus,
    primaryLocationId: users.primaryLocationId,
    departmentId: users.departmentId,
    location: locations.name,
    department: departments.name,
  }).from(users)
    .leftJoin(locations, eq(locations.id, users.primaryLocationId))
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(eq(users.id, session.id))
    .limit(1);

  if (!employee) redirect("/login");

  const availablePrinters = employee.primaryLocationId
    ? await db.select({
        id: printers.id,
        assetTag: printers.assetTag,
        serialNumber: printers.serialNumber,
        model: printers.model,
        assignedUser: printers.assignedUser,
        status: printers.status,
      }).from(printers)
        .innerJoin(
          userPrinterPermissions,
          and(
            eq(userPrinterPermissions.printerId, printers.id),
            eq(userPrinterPermissions.userId, session.id),
          ),
        )
        .where(and(
        eq(printers.locationId, employee.primaryLocationId),
        eq(printers.status, "Active"),
      )).orderBy(asc(printers.model), asc(printers.serialNumber))
    : [];

  const profileRows = [
    ["Employee Name", employee.fullName],
    ["Employee ID", employee.employeeId || "—"],
    ["Primary Location", employee.location || "—"],
    ["Department", employee.department || "—"],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Employee Portal" subtitle="Available printers for your assigned workplace" />

      <Card className="p-6">
          <dl className="grid gap-5 sm:grid-cols-2">
            {profileRows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase text-slate-500">{label}</dt>
                <dd className="mt-1 font-medium text-slate-800">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Account Status</dt>
              <dd className="mt-1"><Badge color="green">{employee.accountStatus}</Badge></dd>
            </div>
          </dl>
      </Card>

      <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-semibold text-[#014171]">Available Printers</h2>
            <p className="mt-1 text-sm text-slate-500">
              Printers granted to your account at {employee.location || "your assigned location"}.
            </p>
          </div>
          {availablePrinters.length === 0 ? (
            <div className="p-6">
              <EmptyState message="No printers have been granted to your account yet." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Asset Tag</th>
                    <th className="px-5 py-3">Printer</th>
                    <th className="px-5 py-3">Serial Number</th>
                    <th className="px-5 py-3">Assigned User</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {availablePrinters.map((printer) => (
                    <tr key={printer.id}>
                      <td className="px-5 py-3 font-medium">{printer.assetTag || "—"}</td>
                      <td className="px-5 py-3">{printer.model || "—"}</td>
                      <td className="px-5 py-3">{printer.serialNumber}</td>
                      <td className="px-5 py-3">{printer.assignedUser || "Shared"}</td>
                      <td className="px-5 py-3"><Badge color="green">{printer.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}
