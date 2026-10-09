import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, Database, Droplets, Mail, Truck, UserRound } from "lucide";
import { MorphIcon } from "morphicons/react";
import { PageHeader } from "@/components/ui";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { hasAdminPrivileges } from "@/lib/roles";

export const dynamic = "force-dynamic";

const legacyRoutes: Record<string, string> = {
  email: "/system/notifications?tab=email",
  reminders: "/system/notifications?tab=reminders",
  locations: "/system/organization?tab=offices",
  offices: "/system/organization?tab=offices",
  departments: "/system/organization?tab=departments",
  subunits: "/system/organization?tab=subunits",
  "cost-centers": "/system/organization?tab=cost-centers",
  "organization-import": "/system/organization?tab=import",
  "organization-history": "/system/organization?tab=history",
  toner: "/system/toner-types",
  its: "/system/its-names",
  vendors: "/system/vendors",
};

const sections = [
  {
    href: "/system/notifications",
    title: "Email and notifications",
    description: "SMTP delivery, toner reminders, and system alert preferences.",
    icon: Mail,
    meta: "Email / SMTP · Toner reminders",
  },
  {
    href: "/system/organization",
    title: "Organization data",
    description: "Offices, departments, subunits, cost centers, and Excel imports.",
    icon: Building2,
    meta: "Reference data · Import history",
  },
  {
    href: "/system/toner-types",
    title: "Toner types",
    description: "Inventory labels, unit costs, thresholds, and alert visibility.",
    icon: Droplets,
    meta: "Inventory configuration",
  },
  {
    href: "/system/its-names",
    title: "ITS names",
    description: "Support names available in printer and service records.",
    icon: UserRound,
    meta: "Support reference data",
  },
  {
    href: "/system/vendors",
    title: "Vendors and suppliers",
    description: "Service-provider contacts and account-management records.",
    icon: Truck,
    meta: "Supplier directory",
  },
];

const retentionSection = {
  href: "/system/retention",
  title: "Data retention",
  description: "Monitoring summaries, cleanup health, database size, and retention history.",
  icon: Database,
  meta: "Admin only · Automatic cleanup",
};

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; success?: string; error?: string }>;
}) {
  const session = await requireModuleFullAccess("system");
  const sp = await searchParams;
  if (sp.tab && legacyRoutes[sp.tab]) {
    const params = new URLSearchParams();
    if (sp.success) params.set("success", sp.success);
    if (sp.error) params.set("error", sp.error);
    const suffix = params.size ? `${legacyRoutes[sp.tab].includes("?") ? "&" : "?"}${params}` : "";
    redirect(`${legacyRoutes[sp.tab]}${suffix}`);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="System Settings" parentTitle="Administration" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(hasAdminPrivileges(session.role) ? [...sections, retentionSection] : sections).map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex min-h-40 flex-col justify-between rounded-lg border border-[#dfe6ee] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#9bb9d2] hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                <MorphIcon icon={section.icon} size={20} strokeWidth={2} reducedMotion="user" />
              </span>
              <MorphIcon icon={ChevronRight} size={18} strokeWidth={2} reducedMotion="user" className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#014171]" />
            </div>
            <div className="mt-5">
              <h2 className="text-base font-bold text-slate-800">{section.title}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">{section.description}</p>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#014171]">{section.meta}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
