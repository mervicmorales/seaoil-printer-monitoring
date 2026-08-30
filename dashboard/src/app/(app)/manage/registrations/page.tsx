import Link from "next/link";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { departments, locations, userRegistrationRequests } from "@/db/schema";
import { Badge, PageHeader, TableCard } from "@/components/ui";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { expireRegistrationRequests } from "@/lib/registration-requests";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; location?: string; department?: string }> }) {
  await requireModuleFullAccess("registrations");
  await expireRegistrationRequests();
  const params = await searchParams;
  const conditions = [];
  if (params.q?.trim()) conditions.push(or(ilike(userRegistrationRequests.fullName, `%${params.q.trim()}%`), ilike(userRegistrationRequests.employeeId, `%${params.q.trim()}%`), ilike(userRegistrationRequests.email, `%${params.q.trim()}%`))!);
  if (params.status) conditions.push(eq(userRegistrationRequests.status, params.status));
  if (Number(params.location)) conditions.push(eq(userRegistrationRequests.primaryLocationId, Number(params.location)));
  if (Number(params.department)) conditions.push(eq(userRegistrationRequests.departmentId, Number(params.department)));
  const [rows, locationRows, departmentRows] = await Promise.all([
    db.select({ id: userRegistrationRequests.id, fullName: userRegistrationRequests.fullName, employeeId: userRegistrationRequests.employeeId, email: userRegistrationRequests.email, status: userRegistrationRequests.status, createdAt: userRegistrationRequests.createdAt, location: locations.name, department: departments.name }).from(userRegistrationRequests).leftJoin(locations, eq(locations.id, userRegistrationRequests.primaryLocationId)).leftJoin(departments, eq(departments.id, userRegistrationRequests.departmentId)).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(userRegistrationRequests.createdAt)),
    db.select().from(locations).orderBy(asc(locations.name)),
    db.select().from(departments).orderBy(asc(departments.name)),
  ]);
  return <div><PageHeader title="Employee Registrations" subtitle="Review verified SEAOIL employee access requests." /><form className="mb-4 grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-4"><input name="q" defaultValue={params.q} placeholder="Name, employee ID, email" className="rounded-lg border px-3 py-2 text-sm" /><select name="status" defaultValue={params.status} className="rounded-lg border px-3 py-2 text-sm"><option value="">All statuses</option>{["pending_email", "pending_admin", "approved", "rejected", "expired", "account_deleted"].map((status) => <option key={status}>{status}</option>)}</select><select name="location" defaultValue={params.location} className="rounded-lg border px-3 py-2 text-sm"><option value="">All locations</option>{locationRows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select name="department" defaultValue={params.department} className="rounded-lg border px-3 py-2 text-sm"><option value="">All departments</option>{departmentRows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="rounded-lg bg-[#014171] px-4 py-2 text-sm font-semibold text-white">Apply filters</button></form><TableCard><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50"><tr>{["Employee", "ID", "Email", "Location / Department", "Status", "Created", ""].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id}><td className="px-4 py-3 font-medium">{row.fullName}</td><td className="px-4 py-3">{row.employeeId}</td><td className="px-4 py-3">{row.email}</td><td className="px-4 py-3">{row.location} / {row.department}</td><td className="px-4 py-3"><Badge color={row.status === "approved" ? "green" : row.status === "rejected" || row.status === "expired" || row.status === "account_deleted" ? "red" : "yellow"}>{row.status}</Badge></td><td className="px-4 py-3">{row.createdAt.toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</td><td className="px-4 py-3"><Link href={`/manage/registrations/${row.id}`} className="text-[#014171] hover:underline">Review</Link></td></tr>)}</tbody></table></TableCard></div>;
}
