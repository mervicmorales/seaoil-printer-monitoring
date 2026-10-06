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
  officeNames: string[];
  requestLines: number;
  units: number;
  expenseCents: number;
  tonerTypes: TonerRequestGroup[];
};

export type DepartmentRequestGroup = TonerRequestGroup & {
  costCenters: TonerRequestGroup[];
};

type MutableGroup = Omit<TonerRequestGroup, "tonerTypes" | "officeNames"> & {
  offices: Map<string, string>;
  tonerTypes: Map<string, MutableGroup>;
  costCenters?: Map<string, MutableGroup>;
};

export function groupTonerRequests(records: readonly TonerExpenseViewRecord[]): DepartmentRequestGroup[] {
  const departments = new Map<string, MutableGroup>();

  for (const record of records) {
    const departmentKey = record.departmentId === null ? "unassigned" : String(record.departmentId);
    const costCenterKey = record.costCenterId == null ? "unassigned" : String(record.costCenterId);
    const tonerKey = String(record.tonerTypeId);
    const department = getGroup(departments, departmentKey, record.departmentName?.trim() || "Unassigned department", true);
    const costCenter = getGroup(department.costCenters!, costCenterKey, record.costCenterCode?.trim() || "Unassigned cost center");

    addRecord(department, record);
    addRecord(costCenter, record);
    addRecord(getGroup(department.tonerTypes, tonerKey, record.tonerTypeName), record);
    addRecord(getGroup(costCenter.tonerTypes, tonerKey, record.tonerTypeName), record);
  }

  return [...departments.values()].map((department) => ({
    ...withoutMaps(department),
    tonerTypes: finishGroups(department.tonerTypes),
    costCenters: finishGroups(department.costCenters!),
  })).sort(compareGroups);
}

function getGroup(map: Map<string, MutableGroup>, key: string, name: string, withCostCenters = false) {
  const existing = map.get(key);
  if (existing) return existing;
  const group: MutableGroup = {
    key,
    name,
    requestLines: 0,
    units: 0,
    expenseCents: 0,
    offices: new Map(),
    tonerTypes: new Map(),
    costCenters: withCostCenters ? new Map() : undefined,
  };
  map.set(key, group);
  return group;
}

function addRecord(group: MutableGroup, record: TonerExpenseViewRecord) {
  const officeKey = record.locationId === null ? "unassigned" : String(record.locationId);
  group.offices.set(officeKey, record.locationName?.trim() || "Unassigned office");
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

function withoutMaps(group: MutableGroup) {
  return {
    key: group.key,
    name: group.name,
    officeNames: [...group.offices.values()].sort((left, right) => left.localeCompare(right)),
    requestLines: group.requestLines,
    units: group.units,
    expenseCents: group.expenseCents,
  };
}

function compareGroups(left: TonerRequestGroup, right: TonerRequestGroup) {
  return right.expenseCents - left.expenseCents || right.units - left.units || left.name.localeCompare(right.name);
}
