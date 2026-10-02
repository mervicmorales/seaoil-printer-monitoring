import "server-only";

import { db } from "@/db";
import {
  costCenters,
  departments,
  locations,
  organizationMappings,
  subunits,
} from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";

export type OrganizationSelection = {
  locationId: number | null;
  departmentId: number | null;
  subunitId: number | null;
  costCenterId: number | null;
};

export async function getOrganizationOptions({ activeOnly = true } = {}) {
  const active = "active";
  const [locationRows, departmentRows, subunitRows, costCenterRows, mappingRows] = await Promise.all([
    db
      .select({ id: locations.id, name: locations.name, address: locations.address, status: locations.status })
      .from(locations)
      .where(activeOnly ? eq(locations.status, active) : undefined)
      .orderBy(asc(locations.name)),
    db
      .select({ id: departments.id, name: departments.name, status: departments.status })
      .from(departments)
      .where(activeOnly ? eq(departments.status, active) : undefined)
      .orderBy(asc(departments.name)),
    db
      .select({
        id: subunits.id,
        name: subunits.name,
        departmentId: subunits.departmentId,
        status: subunits.status,
      })
      .from(subunits)
      .where(activeOnly ? eq(subunits.status, active) : undefined)
      .orderBy(asc(subunits.name)),
    db
      .select({ id: costCenters.id, code: costCenters.code, status: costCenters.status })
      .from(costCenters)
      .where(activeOnly ? eq(costCenters.status, active) : undefined)
      .orderBy(asc(costCenters.code)),
    db
      .select({
        id: organizationMappings.id,
        locationId: organizationMappings.locationId,
        subunitId: organizationMappings.subunitId,
        costCenterId: organizationMappings.costCenterId,
        status: organizationMappings.status,
      })
      .from(organizationMappings)
      .where(activeOnly ? eq(organizationMappings.status, active) : undefined),
  ]);

  return {
    locations: locationRows,
    departments: departmentRows,
    subunits: subunitRows,
    costCenters: costCenterRows,
    mappings: mappingRows,
  };
}

export async function validateOrganizationSelection(
  selection: OrganizationSelection,
  options: {
    requireLocation?: boolean;
    requireDepartment?: boolean;
    requireSubunitWhenAvailable?: boolean;
    requireActive?: boolean;
  } = {},
) {
  const errors: Record<string, string> = {};
  const requireActive = options.requireActive !== false;

  const [location, department, subunit, costCenter] = await Promise.all([
    selection.locationId
      ? db.select({ id: locations.id, status: locations.status }).from(locations).where(eq(locations.id, selection.locationId)).limit(1)
      : Promise.resolve([]),
    selection.departmentId
      ? db.select({ id: departments.id, status: departments.status }).from(departments).where(eq(departments.id, selection.departmentId)).limit(1)
      : Promise.resolve([]),
    selection.subunitId
      ? db.select({ id: subunits.id, departmentId: subunits.departmentId, status: subunits.status }).from(subunits).where(eq(subunits.id, selection.subunitId)).limit(1)
      : Promise.resolve([]),
    selection.costCenterId
      ? db.select({ id: costCenters.id, status: costCenters.status }).from(costCenters).where(eq(costCenters.id, selection.costCenterId)).limit(1)
      : Promise.resolve([]),
  ]);

  if (options.requireLocation && !selection.locationId) errors.locationId = "Office is required.";
  if (selection.locationId && (!location[0] || (requireActive && location[0].status !== "active"))) {
    errors.locationId = "Select a valid active office.";
  }

  if (options.requireDepartment && !selection.departmentId) errors.departmentId = "Department is required.";
  if (selection.departmentId && (!department[0] || (requireActive && department[0].status !== "active"))) {
    errors.departmentId = "Select a valid active department.";
  } else if (selection.departmentId && !selection.locationId) {
    errors.departmentId = "Select an office before choosing a department.";
  } else if (selection.locationId && selection.departmentId) {
    const availableDepartment = await db
      .select({ id: organizationMappings.id })
      .from(organizationMappings)
      .innerJoin(subunits, eq(subunits.id, organizationMappings.subunitId))
      .where(and(
        eq(organizationMappings.locationId, selection.locationId),
        eq(subunits.departmentId, selection.departmentId),
        requireActive ? eq(organizationMappings.status, "active") : undefined,
        requireActive ? eq(subunits.status, "active") : undefined,
      ))
      .limit(1);
    if (!availableDepartment[0]) {
      errors.departmentId = "The selected department is not available for this office.";
    }
  }

  if (selection.subunitId) {
    if (!subunit[0] || (requireActive && subunit[0].status !== "active")) {
      errors.subunitId = "Select a valid active sub-unit.";
    } else if (!selection.departmentId || subunit[0].departmentId !== selection.departmentId) {
      errors.subunitId = "The selected sub-unit does not belong to this department.";
    } else if (!selection.locationId) {
      errors.subunitId = "Select an office before choosing a sub-unit.";
    } else {
      const availableSubunit = await db
        .select({ id: organizationMappings.id })
        .from(organizationMappings)
        .where(and(
          eq(organizationMappings.locationId, selection.locationId),
          eq(organizationMappings.subunitId, selection.subunitId),
          requireActive ? eq(organizationMappings.status, "active") : undefined,
        ))
        .limit(1);
      if (!availableSubunit[0]) {
        errors.subunitId = "The selected sub-unit is not available for this office.";
      }
    }
  } else if (selection.locationId && selection.departmentId && options.requireSubunitWhenAvailable) {
    const available = await db
      .select({ id: subunits.id })
      .from(organizationMappings)
      .innerJoin(subunits, eq(subunits.id, organizationMappings.subunitId))
      .where(and(
        eq(organizationMappings.locationId, selection.locationId),
        eq(subunits.departmentId, selection.departmentId),
        requireActive ? eq(organizationMappings.status, "active") : undefined,
        requireActive ? eq(subunits.status, "active") : undefined,
      ))
      .limit(1);
    if (available[0]) errors.subunitId = "Select a sub-unit for this office and department.";
  }

  if (selection.costCenterId) {
    if (!costCenter[0] || (requireActive && costCenter[0].status !== "active")) {
      errors.costCenterId = "Select a valid active cost center.";
    } else if (!selection.locationId || !selection.subunitId) {
      errors.costCenterId = "Select an office, department, and subunit first.";
    } else {
      const mapping = await db
        .select({ id: organizationMappings.id, status: organizationMappings.status })
        .from(organizationMappings)
        .where(and(
          eq(organizationMappings.locationId, selection.locationId),
          eq(organizationMappings.subunitId, selection.subunitId),
          eq(organizationMappings.costCenterId, selection.costCenterId),
        ))
        .limit(1);
      if (!mapping[0] || (requireActive && mapping[0].status !== "active")) {
        errors.costCenterId = "The selected cost center is not valid for this office and subunit.";
      }
    }
  }

  return errors;
}
