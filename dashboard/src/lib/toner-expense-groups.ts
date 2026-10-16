import type { TonerExpenseRecord } from "@/lib/toner-expenses";

export type TonerExpenseViewRecord = TonerExpenseRecord & {
  id: number;
  itsNameId: number | null;
  subunitId?: number | null;
  subunitName?: string | null;
  costCenterId?: number | null;
  costCenterCode?: string | null;
};

export type TonerRequestGroup = {
  key: string;
  name: string;
  requestLines: number;
  units: number;
  expenseCents: number;
  tonerTypes: TonerRequestGroup[];
};

export type CostCenterRequestGroup = TonerRequestGroup & {
  offices: TonerRequestGroup[];
};

export type DepartmentRequestGroup = TonerRequestGroup & {
  costCenters: CostCenterRequestGroup[];
};

type MutableGroup = Omit<TonerRequestGroup, "tonerTypes"> & {
  tonerTypes: Map<string, MutableGroup>;
  costCenters?: Map<string, MutableGroup>;
  offices?: Map<string, MutableGroup>;
};

export function groupTonerRequests(records: readonly TonerExpenseViewRecord[]): DepartmentRequestGroup[] {
  const departments = new Map<string, MutableGroup>();

  for (const record of records) {
    const departmentKey = record.departmentId === null ? "unassigned" : String(record.departmentId);
    const costCenterKey = record.costCenterId == null ? "unassigned" : String(record.costCenterId);
    const officeKey = record.locationId === null ? "unassigned" : String(record.locationId);
    const tonerKey = String(record.tonerTypeId);
    const department = getGroup(departments, departmentKey, record.departmentName?.trim() || "Unassigned department", { withCostCenters: true });
    const costCenter = getGroup(department.costCenters!, costCenterKey, record.costCenterCode?.trim() || "Unassigned cost center", { withOffices: true });
    const office = getGroup(costCenter.offices!, officeKey, record.locationName?.trim() || "Unassigned office");

    addRecord(department, record);
    addRecord(costCenter, record);
    addRecord(office, record);
    addRecord(getGroup(department.tonerTypes, tonerKey, record.tonerTypeName), record);
    addRecord(getGroup(costCenter.tonerTypes, tonerKey, record.tonerTypeName), record);
    addRecord(getGroup(office.tonerTypes, tonerKey, record.tonerTypeName), record);
  }

  return [...departments.values()].map((department) => ({
    ...withoutMaps(department),
    tonerTypes: finishGroups(department.tonerTypes),
    costCenters: finishCostCenterGroups(department.costCenters!),
  })).sort(compareGroups);
}

function getGroup(
  map: Map<string, MutableGroup>,
  key: string,
  name: string,
  options: { withCostCenters?: boolean; withOffices?: boolean } = {},
) {
  const existing = map.get(key);
  if (existing) return existing;
  const group: MutableGroup = {
    key,
    name,
    requestLines: 0,
    units: 0,
    expenseCents: 0,
    tonerTypes: new Map(),
    costCenters: options.withCostCenters ? new Map() : undefined,
    offices: options.withOffices ? new Map() : undefined,
  };
  map.set(key, group);
  return group;
}

function addRecord(group: MutableGroup, record: TonerExpenseViewRecord) {
  group.requestLines += 1;
  group.units += record.quantity;
  group.expenseCents += record.quantity * record.unitCostCents;
}

function finishGroups(groups: Map<string, MutableGroup>): TonerRequestGroup[] {
  return [...groups.values()].map((group) => ({
    ...withoutMaps(group),
    tonerTypes: finishGroups(group.tonerTypes),
  })).sort(compareGroups);
}

function finishCostCenterGroups(groups: Map<string, MutableGroup>): CostCenterRequestGroup[] {
  return [...groups.values()].map((group) => ({
    ...withoutMaps(group),
    tonerTypes: finishGroups(group.tonerTypes),
    offices: finishGroups(group.offices!),
  })).sort(compareGroups);
}

function withoutMaps(group: MutableGroup) {
  return {
    key: group.key,
    name: group.name,
    requestLines: group.requestLines,
    units: group.units,
    expenseCents: group.expenseCents,
  };
}

function compareGroups(left: TonerRequestGroup, right: TonerRequestGroup) {
  return right.expenseCents - left.expenseCents || right.units - left.units || left.name.localeCompare(right.name);
}
