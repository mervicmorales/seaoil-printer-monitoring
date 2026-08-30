import { asc } from "drizzle-orm";
import { db } from "@/db";
import { departments, locations } from "@/db/schema";
import RegisterForm, { ResendVerificationForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [locationRows, departmentRows] = await Promise.all([
    db.select().from(locations).orderBy(asc(locations.name)),
    db.select().from(departments).orderBy(asc(departments.name)),
  ]);
  return <main className="min-h-screen bg-[#f4f6f9] px-4 py-10"><div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"><h1 className="text-2xl font-bold text-[#014171]">Employee Registration</h1><p className="mb-6 mt-1 text-sm text-slate-500">Verify your SEAOIL email before an administrator reviews your request.</p><RegisterForm locations={locationRows} departments={departmentRows} /><ResendVerificationForm /></div></main>;
}
