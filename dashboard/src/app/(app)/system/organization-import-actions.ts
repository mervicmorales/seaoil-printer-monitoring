"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  costCenters,
  departments,
  locations,
  organizationImports,
  organizationMappings,
  subunits,
} from "@/db/schema";
import { requireAdmin } from "@/lib/server-utils";
import {
  organizationValueKey as key,
  parseOrganizationWorkbook,
  uniqueOrganizationValues as uniqueByKey,
  type OrganizationImportIssue as ImportIssue,
  type OrganizationStagedRow as StagedRow,
} from "@/lib/organization-import";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
export type OrganizationImportSummary = {
  totalRows: number;
  validRows: number;
  newLocations: number;
  newDepartments: number;
  newSubunits: number;
  newCostCenters: number;
  newMappings: number;
  recordsToUpdate: number;
  unchanged: number;
  duplicateRows: number;
  invalidRows: number;
  conflicts: number;
  issues: ImportIssue[];
};

export type OrganizationImportState = {
  error?: string;
  success?: string;
  importId?: number;
  filename?: string;
  summary?: OrganizationImportSummary;
};

export async function previewOrganizationImportAction(
  _previous: OrganizationImportState,
  formData: FormData,
): Promise<OrganizationImportState> {
  const actor = await requireAdmin("system");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel workbook." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx workbooks are supported." };
  if (file.size > MAX_FILE_BYTES) return { error: "The workbook must not exceed 10 MB." };

  let parsed: Awaited<ReturnType<typeof parseOrganizationWorkbook>>;
  try {
    parsed = await parseOrganizationWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The selected file is not a valid Excel workbook." };
  }
  const validRows = parsed.rows;
  const issues = parsed.issues;
  const duplicateRows = parsed.duplicateRows;
  const populatedRows = parsed.totalRows;

  const [existingLocations, existingDepartments, existingSubunits, existingCostCenters, existingMappings] = await Promise.all([
    db.select().from(locations),
    db.select().from(departments),
    db.select().from(subunits),
    db.select().from(costCenters),
    db.select().from(organizationMappings),
  ]);
  const locationByKey = new Map(existingLocations.map((item) => [key(item.name), item]));
  const departmentByKey = new Map(existingDepartments.map((item) => [key(item.name), item]));
  const costCenterByKey = new Map(existingCostCenters.map((item) => [key(item.code), item]));
  const subunitByKey = new Map(existingSubunits.map((item) => [`${item.departmentId}\u001f${key(item.name)}`, item]));

  const uniqueLocations = uniqueByKey(validRows.map((row) => row.office));
  const uniqueDepartments = uniqueByKey(validRows.map((row) => row.department));
  const uniqueCostCenters = uniqueByKey(validRows.map((row) => row.costCenter));
  let newSubunits = 0;
  let newMappings = 0;
  let recordsToUpdate = 0;
  let unchanged = 0;
  const sourceSubunits = new Set<string>();

  for (const row of validRows) {
    const department = departmentByKey.get(key(row.department));
    const subunitKey = `${department?.id ?? `new:${key(row.department)}`}\u001f${key(row.subunit)}`;
    sourceSubunits.add(subunitKey);
  }
  for (const subunitKey of sourceSubunits) {
    if (subunitKey.startsWith("new:") || !subunitByKey.has(subunitKey)) newSubunits += 1;
  }

  for (const item of [...uniqueLocations].map(([itemKey]) => locationByKey.get(itemKey)).filter(Boolean)) {
    if (item!.status !== "active") recordsToUpdate += 1;
  }
  for (const item of [...uniqueDepartments].map(([itemKey]) => departmentByKey.get(itemKey)).filter(Boolean)) {
    if (item!.status !== "active") recordsToUpdate += 1;
  }
  for (const item of [...uniqueCostCenters].map(([itemKey]) => costCenterByKey.get(itemKey)).filter(Boolean)) {
    if (item!.status !== "active") recordsToUpdate += 1;
  }

  for (const row of validRows) {
    const location = locationByKey.get(key(row.office));
    const department = departmentByKey.get(key(row.department));
    const costCenter = costCenterByKey.get(key(row.costCenter));
    const subunit = department ? subunitByKey.get(`${department.id}\u001f${key(row.subunit)}`) : undefined;
    if (location && subunit && costCenter) {
      const existing = existingMappings.find((mapping) => (
        mapping.locationId === location.id
        && mapping.subunitId === subunit.id
        && mapping.costCenterId === costCenter.id
      ));
      if (existing) {
        if (existing.status === "active") unchanged += 1;
        else recordsToUpdate += 1;
      } else {
        newMappings += 1;
      }
    } else {
      newMappings += 1;
    }
  }

  const summary: OrganizationImportSummary = {
    totalRows: populatedRows,
    validRows: validRows.length,
    newLocations: [...uniqueLocations.keys()].filter((itemKey) => !locationByKey.has(itemKey)).length,
    newDepartments: [...uniqueDepartments.keys()].filter((itemKey) => !departmentByKey.has(itemKey)).length,
    newSubunits,
    newCostCenters: [...uniqueCostCenters.keys()].filter((itemKey) => !costCenterByKey.has(itemKey)).length,
    newMappings,
    recordsToUpdate,
    unchanged,
    duplicateRows,
    invalidRows: parsed.invalidRows,
    conflicts: 0,
    issues: issues.slice(0, 200),
  };

  const [history] = await db.insert(organizationImports).values({
    filename: file.name.slice(0, 255),
    importedBy: actor.id,
    status: validRows.length ? "pending" : "validation_failed",
    totalRows: populatedRows,
    skippedCount: duplicateRows,
    failedCount: summary.invalidRows,
    summary,
    stagedRows: validRows.length ? validRows : null,
  }).returning({ id: organizationImports.id });

  return {
    ...(validRows.length ? {} : { error: "The workbook contains no valid rows to import." }),
    importId: validRows.length ? history.id : undefined,
    filename: file.name,
    summary,
  };
}

export async function confirmOrganizationImportAction(formData: FormData) {
  await requireAdmin("system");
  const importId = Number(formData.get("importId"));
  if (!Number.isSafeInteger(importId) || importId < 1) {
    redirect("/system/organization?tab=import&error=Invalid import preview.");
  }

  const [pending] = await db
    .update(organizationImports)
    .set({ status: "processing" })
    .where(and(
      eq(organizationImports.id, importId),
      eq(organizationImports.status, "pending"),
    ))
    .returning();
  const rows = pending?.stagedRows as StagedRow[] | null;
  if (!pending || !rows?.length) {
    redirect("/system/organization?tab=import&error=This import preview is no longer available or is already being processed.");
  }

  try {
    await db.transaction(async (tx) => {
      const departmentNames = uniqueByKey(rows.map((row) => row.department));
      const locationNames = uniqueByKey(rows.map((row) => row.office));
      const costCenterCodes = uniqueByKey(rows.map((row) => row.costCenter));

      let departmentRows = await tx.select().from(departments);
      let locationRows = await tx.select().from(locations);
      let costCenterRows = await tx.select().from(costCenters);
      const existingDepartmentKeys = new Set(departmentRows.map((item) => key(item.name)));
      const existingLocationKeys = new Set(locationRows.map((item) => key(item.name)));
      const existingCostCenterKeys = new Set(costCenterRows.map((item) => key(item.code)));

      const newDepartmentValues = [...departmentNames].filter(([itemKey]) => !existingDepartmentKeys.has(itemKey)).map(([, name]) => ({ name }));
      const newLocationValues = [...locationNames].filter(([itemKey]) => !existingLocationKeys.has(itemKey)).map(([, name]) => ({ name }));
      const newCostCenterValues = [...costCenterCodes].filter(([itemKey]) => !existingCostCenterKeys.has(itemKey)).map(([, code]) => ({ code }));
      if (newDepartmentValues.length) await tx.insert(departments).values(newDepartmentValues);
      if (newLocationValues.length) await tx.insert(locations).values(newLocationValues);
      if (newCostCenterValues.length) await tx.insert(costCenters).values(newCostCenterValues);

      departmentRows = await tx.select().from(departments);
      locationRows = await tx.select().from(locations);
      costCenterRows = await tx.select().from(costCenters);
      const departmentMap = new Map(departmentRows.map((item) => [key(item.name), item]));
      const locationMap = new Map(locationRows.map((item) => [key(item.name), item]));
      const costCenterMap = new Map(costCenterRows.map((item) => [key(item.code), item]));

      const reactivateDepartmentIds = departmentRows.filter((item) => departmentNames.has(key(item.name)) && item.status !== "active").map((item) => item.id);
      const reactivateLocationIds = locationRows.filter((item) => locationNames.has(key(item.name)) && item.status !== "active").map((item) => item.id);
      const reactivateCostCenterIds = costCenterRows.filter((item) => costCenterCodes.has(key(item.code)) && item.status !== "active").map((item) => item.id);
      if (reactivateDepartmentIds.length) await tx.update(departments).set({ status: "active", updatedAt: new Date() }).where(inArray(departments.id, reactivateDepartmentIds));
      if (reactivateLocationIds.length) await tx.update(locations).set({ status: "active", updatedAt: new Date() }).where(inArray(locations.id, reactivateLocationIds));
      if (reactivateCostCenterIds.length) await tx.update(costCenters).set({ status: "active", updatedAt: new Date() }).where(inArray(costCenters.id, reactivateCostCenterIds));

      let subunitRows = await tx.select().from(subunits);
      const subunitMap = new Map(subunitRows.map((item) => [`${item.departmentId}\u001f${key(item.name)}`, item]));
      const newSubunitValues = new Map<string, { departmentId: number; name: string }>();
      for (const row of rows) {
        const department = departmentMap.get(key(row.department))!;
        const itemKey = `${department.id}\u001f${key(row.subunit)}`;
        if (!subunitMap.has(itemKey) && !newSubunitValues.has(itemKey)) {
          newSubunitValues.set(itemKey, { departmentId: department.id, name: row.subunit });
        }
      }
      if (newSubunitValues.size) await tx.insert(subunits).values([...newSubunitValues.values()]);
      subunitRows = await tx.select().from(subunits);
      const finalSubunitMap = new Map(subunitRows.map((item) => [`${item.departmentId}\u001f${key(item.name)}`, item]));
      const sourceSubunitIds = new Set<number>();
      for (const row of rows) {
        const department = departmentMap.get(key(row.department))!;
        sourceSubunitIds.add(finalSubunitMap.get(`${department.id}\u001f${key(row.subunit)}`)!.id);
      }
      const reactivateSubunitIds = subunitRows.filter((item) => sourceSubunitIds.has(item.id) && item.status !== "active").map((item) => item.id);
      if (reactivateSubunitIds.length) await tx.update(subunits).set({ status: "active", updatedAt: new Date() }).where(inArray(subunits.id, reactivateSubunitIds));

      const existingMappings = await tx.select().from(organizationMappings);
      const existingMappingMap = new Map(existingMappings.map((item) => [`${item.locationId}\u001f${item.subunitId}\u001f${item.costCenterId}`, item]));
      const newMappingValues = new Map<string, { locationId: number; subunitId: number; costCenterId: number }>();
      const reactivateMappingIds: number[] = [];
      for (const row of rows) {
        const department = departmentMap.get(key(row.department))!;
        const location = locationMap.get(key(row.office))!;
        const costCenter = costCenterMap.get(key(row.costCenter))!;
        const subunit = finalSubunitMap.get(`${department.id}\u001f${key(row.subunit)}`)!;
        const itemKey = `${location.id}\u001f${subunit.id}\u001f${costCenter.id}`;
        const existing = existingMappingMap.get(itemKey);
        if (!existing) newMappingValues.set(itemKey, { locationId: location.id, subunitId: subunit.id, costCenterId: costCenter.id });
        else if (existing.status !== "active") reactivateMappingIds.push(existing.id);
      }
      if (newMappingValues.size) await tx.insert(organizationMappings).values([...newMappingValues.values()]);
      if (reactivateMappingIds.length) await tx.update(organizationMappings).set({ status: "active", updatedAt: new Date() }).where(inArray(organizationMappings.id, reactivateMappingIds));

      const summary = pending.summary as OrganizationImportSummary;
      const createdCount = summary.newLocations + summary.newDepartments + summary.newSubunits + summary.newCostCenters + summary.newMappings;
      await tx.update(organizationImports).set({
        status: "completed",
        createdCount,
        updatedCount: summary.recordsToUpdate,
        skippedCount: summary.unchanged + summary.duplicateRows,
        failedCount: summary.invalidRows,
        stagedRows: null,
        completedAt: new Date(),
      }).where(eq(organizationImports.id, importId));
    });
  } catch (error) {
    console.error("Organization import failed:", error);
    await db.update(organizationImports).set({ status: "failed", completedAt: new Date() }).where(eq(organizationImports.id, importId));
    redirect("/system/organization?tab=import&error=Import failed and all database changes were rolled back.");
  }

  for (const path of ["/system", "/system/organization", "/register", "/manage", "/printers", "/toner-monitoring", "/repair-history", "/toner-expenses"]) {
    revalidatePath(path);
  }
  redirect(`/system/organization?tab=import&success=${encodeURIComponent(`Import ${importId} completed successfully.`)}`);
}
