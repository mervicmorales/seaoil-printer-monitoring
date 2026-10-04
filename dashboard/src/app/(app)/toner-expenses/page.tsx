import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  subunits,
  costCenters,
  itsNames,
  locations,
  tonerTransactions,
  tonerTypes,
} from "@/db/schema";
import TonerExpenseExplorer from "./TonerExpenseExplorer";
import { amountToCents } from "@/lib/toner-expenses";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | undefined>;

export default async function TonerExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireModuleFullAccess("toner_expenses");
  const access = await getModuleAccessMap(session.id, session.role);
  const sp = await searchParams;
  const today = manilaDate();
  const allTime = sp.allTime === "1";

  const [rows, allDepartments, allSubunits, allCostCenters, allLocations, allTonerTypes, allItsNames] = await Promise.all([
    db
      .select({
        id: tonerTransactions.id,
        type: tonerTransactions.type,
        date: tonerTransactions.date,
        departmentId: tonerTransactions.departmentId,
        departmentName: departments.name,
        subunitId: tonerTransactions.subunitId,
        subunitName: subunits.name,
        costCenterId: tonerTransactions.costCenterId,
        costCenterCode: costCenters.code,
        locationId: tonerTransactions.locationId,
        locationName: locations.name,
        tonerTypeId: tonerTransactions.tonerTypeId,
        tonerTypeName: tonerTypes.name,
        itsNameId: tonerTransactions.itsNameId,
        unitCost: tonerTypes.unitCost,
        quantity: tonerTransactions.quantity,
      })
      .from(tonerTransactions)
      .innerJoin(tonerTypes, eq(tonerTransactions.tonerTypeId, tonerTypes.id))
      .leftJoin(departments, eq(tonerTransactions.departmentId, departments.id))
      .leftJoin(subunits, eq(tonerTransactions.subunitId, subunits.id))
      .leftJoin(costCenters, eq(tonerTransactions.costCenterId, costCenters.id))
      .leftJoin(locations, eq(tonerTransactions.locationId, locations.id))
      .orderBy(desc(tonerTransactions.date), desc(tonerTransactions.id)),
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.name)),
    db.select({ id: subunits.id, name: subunits.name, departmentId: subunits.departmentId }).from(subunits).orderBy(asc(subunits.name)),
    db.select({ id: costCenters.id, name: costCenters.code }).from(costCenters).orderBy(asc(costCenters.code)),
    db.select({ id: locations.id, name: locations.name }).from(locations).orderBy(asc(locations.name)),
    db.select({ id: tonerTypes.id, name: tonerTypes.name }).from(tonerTypes).orderBy(asc(tonerTypes.name)),
    db.select({ id: itsNames.id, name: itsNames.name }).from(itsNames).orderBy(asc(itsNames.name)),
  ]);

  const toExpenseRecord = (row: typeof rows[number]) => ({
    id: row.id,
    date: row.date,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    subunitId: row.subunitId,
    subunitName: row.subunitName,
    costCenterId: row.costCenterId,
    costCenterCode: row.costCenterCode,
    locationId: row.locationId,
    locationName: row.locationName,
    tonerTypeId: row.tonerTypeId,
    tonerTypeName: row.tonerTypeName,
    itsNameId: row.itsNameId,
    quantity: row.quantity,
    unitCostCents: amountToCents(row.unitCost),
  });

  return (
    <TonerExpenseExplorer
      records={rows.filter((row) => row.type === "Request").map(toExpenseRecord)}
      deliveryRecords={rows.filter((row) => row.type === "Delivery").map(toExpenseRecord)}
      initialFilters={{
        allTime,
        dateFrom: allTime ? "" : (sp.dateFrom ?? `${today.slice(0, 4)}-01-01`),
        dateTo: allTime ? "" : (sp.dateTo ?? today),
        department: parseLookupValue(sp.department),
        subunit: parseLookupValue(sp.subunit),
        costCenter: parseLookupValue(sp.costCenter),
        location: parseLookupValue(sp.location),
        tonerType: parseLookupValue(sp.tonerType),
        itsName: parseLookupValue(sp.itsName),
      }}
      departments={allDepartments}
      subunits={allSubunits}
      costCenters={allCostCenters}
      locations={allLocations}
      tonerTypes={allTonerTypes}
      itsNames={allItsNames}
      canManageCosts={access.system}
    />
  );
}

function parseLookupValue(value: string | undefined) {
  if (value === "unassigned") return value;
  return /^\d+$/.test(value ?? "") && Number(value) > 0 ? value! : "";
}

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date());
}
