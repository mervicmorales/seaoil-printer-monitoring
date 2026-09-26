import type { TonerExpenseRecord } from "@/lib/toner-expenses";

export type TonerExpenseViewRecord = TonerExpenseRecord & {
  id: number;
  itsNameId: number | null;
};

export type TonerRequestGroup = {
  key: string;
  name: string;
  requestLines: number;
  units: number;
  expenseCents: number;
  tonerTypes: TonerRequestGroup[];
};

export type DepartmentRequestGroup = TonerRequestGroup & {
  locations: TonerRequestGroup[];
};

type MutableGroup = Omit<TonerRequestGroup, "tonerTypes"> & {
  tonerTypes: Map<string, MutableGroup>;
  locations?: Map<string, MutableGroup>;
};

export function groupTonerRequests(records: readonly TonerExpenseViewRecord[]): DepartmentRequestGroup[] {
  const departments = new Map<string, MutableGroup>();

  for (const record of records) {
    const departmentKey = record.departmentId === null ? "unassigned" : String(record.departmentId);
    const locationKey = record.locationId === null ? "unassigned" : String(record.locationId);
    const tonerKey = String(record.tonerTypeId);
    const department = getGroup(departments, departmentKey, record.departmentName?.trim() || "Unassigned department", true);
    const location = getGroup(department.locations!, locationKey, record.locationName?.trim() || "Unassigned location");

    addRecord(department, record);
    addRecord(location, record);
    addRecord(getGroup(department.tonerTypes, tonerKey, record.tonerTypeName), record);
    addRecord(getGroup(location.tonerTypes, tonerKey, record.tonerTypeName), record);
  }

  return [...departments.values()].map((department) => ({
    ...withoutMaps(department),
    tonerTypes: finishGroups(department.tonerTypes),
    locations: finishGroups(department.locations!),
  })).sort(compareGroups);
}

function getGroup(map: Map<string, MutableGroup>, key: string, name: string, withLocations = false) {
  const existing = map.get(key);
  if (existing) return existing;
  const group: MutableGroup = {
    key,
    name,
    requestLines: 0,
    units: 0,
    expenseCents: 0,
    tonerTypes: new Map(),
    locations: withLocations ? new Map() : undefined,
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
