import { asc, desc, eq, ne } from "drizzle-orm";
import { Building2, History, MapPin, Network, TableProperties, Upload } from "lucide";
import { db } from "@/db";
import {
  costCenters,
  departments,
  locations,
  organizationImports,
  organizationMappings,
  subunits,
} from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import Tabs from "@/components/Tabs";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { hasAdminPrivileges } from "@/lib/roles";
import OrganizationImportManager from "../OrganizationImportManager";
import { DepartmentsManager, LocationsManager, MappingsManager, SubunitsManager } from "../OrganizationManagers";
import {
  addDepartmentAction,
  addLocationAction,
  addOrganizationMappingAction,
  addSubunitAction,
  deleteCostCenterAction,
  deleteDepartmentAction,
  deleteLocationAction,
  deleteOrganizationMappingAction,
  deleteSubunitAction,
  updateCostCenterAction,
  updateDepartmentAction,
  updateLocationAction,
  updateOrganizationMappingAction,
  updateSubunitAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; success?: string; error?: string }>;
}) {
  const session = await requireModuleFullAccess("system");
  const [sp, allLocations, allDepartments, allSubunits, allCostCenters, allMappings, importHistory] = await Promise.all([
    searchParams,
    db.select().from(locations).orderBy(asc(locations.name)),
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select({
      id: subunits.id,
      name: subunits.name,
      departmentId: subunits.departmentId,
      departmentName: departments.name,
      status: subunits.status,
    }).from(subunits).innerJoin(departments, eq(subunits.departmentId, departments.id)).orderBy(asc(departments.name), asc(subunits.name)),
    db.select().from(costCenters).orderBy(asc(costCenters.code)),
    db.select({
      id: organizationMappings.id,
      locationId: organizationMappings.locationId,
      locationName: locations.name,
      departmentName: departments.name,
      subunitId: organizationMappings.subunitId,
      subunitName: subunits.name,
      costCenterId: organizationMappings.costCenterId,
      costCenterCode: costCenters.code,
      status: organizationMappings.status,
    }).from(organizationMappings)
      .innerJoin(locations, eq(organizationMappings.locationId, locations.id))
      .innerJoin(subunits, eq(organizationMappings.subunitId, subunits.id))
      .innerJoin(departments, eq(subunits.departmentId, departments.id))
      .innerJoin(costCenters, eq(organizationMappings.costCenterId, costCenters.id))
      .orderBy(asc(locations.name), asc(departments.name), asc(subunits.name), asc(costCenters.code)),
    db.select({
      id: organizationImports.id,
      filename: organizationImports.filename,
      status: organizationImports.status,
      totalRows: organizationImports.totalRows,
      createdCount: organizationImports.createdCount,
      updatedCount: organizationImports.updatedCount,
      skippedCount: organizationImports.skippedCount,
      failedCount: organizationImports.failedCount,
      createdAt: organizationImports.createdAt,
      completedAt: organizationImports.completedAt,
    }).from(organizationImports)
      .where(ne(organizationImports.status, "pending"))
      .orderBy(desc(organizationImports.createdAt))
      .limit(50),
  ]);
  const readOnly = !hasAdminPrivileges(session.role);
  const contentClass = "h-full min-h-0 overflow-hidden p-4 sm:p-5";

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader title="Organization Data" parentTitle="System" />
      <SuccessBanner message={sp.success} errorMessage={sp.error} showInline={false} />
      <Tabs
        fillHeight
        defaultKey={sp.tab === "locations" ? "offices" : sp.tab}
        tabs={[
          {
            key: "offices",
            label: "Offices",
            icon: MapPin,
            content: <Card className={contentClass}><LocationsManager items={allLocations} addAction={addLocationAction} updateAction={updateLocationAction} deleteAction={deleteLocationAction} readOnly={readOnly} /></Card>,
          },
          {
            key: "departments",
            label: "Departments",
            icon: Building2,
            content: <Card className={contentClass}><DepartmentsManager items={allDepartments} addAction={addDepartmentAction} updateAction={updateDepartmentAction} deleteAction={deleteDepartmentAction} readOnly={readOnly} /></Card>,
          },
          {
            key: "subunits",
            label: "Sub-units",
            icon: Network,
            content: <Card className={contentClass}><SubunitsManager items={allSubunits} departments={allDepartments} addAction={addSubunitAction} updateAction={updateSubunitAction} deleteAction={deleteSubunitAction} readOnly={readOnly} /></Card>,
          },
          {
            key: "cost-centers",
            label: "Cost Centers",
            icon: TableProperties,
            content: <Card className={contentClass}><MappingsManager items={allMappings} costCenters={allCostCenters} locations={allLocations} subunits={allSubunits} addAction={addOrganizationMappingAction} updateAction={updateOrganizationMappingAction} deleteAction={deleteOrganizationMappingAction} updateCostCenterAction={updateCostCenterAction} deleteCostCenterAction={deleteCostCenterAction} readOnly={readOnly} /></Card>,
          },
          {
            key: "import",
            label: "Import Data",
            icon: Upload,
            content: <Card className={contentClass}>{readOnly ? <AccessDenied /> : <OrganizationImportManager />}</Card>,
          },
          {
            key: "history",
            label: "Import History",
            icon: History,
            content: (
              <Card className="h-full min-h-0 overflow-hidden">
                <div className="h-full overflow-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.08em] text-slate-500">
                      <tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Rows</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3">Skipped</th><th className="px-4 py-3">Failed</th><th className="px-4 py-3">Imported</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importHistory.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3 font-medium text-slate-700">{item.filename}</td><td className="px-4 py-3 capitalize text-slate-600">{item.status.replaceAll("_", " ")}</td><td className="px-4 py-3 tabular-nums text-slate-600">{item.totalRows}</td><td className="px-4 py-3 tabular-nums text-slate-600">{item.createdCount}</td><td className="px-4 py-3 tabular-nums text-slate-600">{item.updatedCount}</td><td className="px-4 py-3 tabular-nums text-slate-600">{item.skippedCount}</td><td className="px-4 py-3 tabular-nums text-slate-600">{item.failedCount}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{item.createdAt.toLocaleString()}</td></tr>)}
                      {!importHistory.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">No organization imports yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function AccessDenied() {
  return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Administrator access is required.</p>;
}
