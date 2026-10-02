import "server-only";
import { db } from "@/db";
import {
  contracts,
  departments,
  itsNames,
  locations,
  monitoringAgents,
  tonerInventory,
  tonerTypes,
  vendors,
} from "@/db/schema";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

export async function getLocations() {
  return db.select().from(locations).where(eq(locations.status, "active")).orderBy(asc(locations.name));
}

export async function getDepartments() {
  return db.select().from(departments).where(eq(departments.status, "active")).orderBy(asc(departments.name));
}

export async function getVendors() {
  return db.select().from(vendors).orderBy(asc(vendors.name));
}

export async function getTonerTypes() {
  return db.select().from(tonerTypes).orderBy(asc(tonerTypes.name));
}

export async function getVisibleTonerTypes() {
  return db
    .select()
    .from(tonerTypes)
    .where(eq(tonerTypes.showAlertCard, true))
    .orderBy(asc(tonerTypes.name));
}

export async function getTonerTypesWithInventory() {
  const rows = await db
    .select({ id: tonerTypes.id, name: tonerTypes.name, stock: tonerInventory.stock })
    .from(tonerTypes)
    .leftJoin(tonerInventory, eq(tonerInventory.tonerTypeId, tonerTypes.id))
    .orderBy(asc(tonerTypes.name));
  return rows.map((row) => ({ ...row, stock: row.stock ?? 0 }));
}

export async function getVisibleTonerTypesWithInventory() {
  const rows = await db
    .select({ id: tonerTypes.id, name: tonerTypes.name, stock: tonerInventory.stock })
    .from(tonerTypes)
    .leftJoin(tonerInventory, eq(tonerInventory.tonerTypeId, tonerTypes.id))
    .where(eq(tonerTypes.showAlertCard, true))
    .orderBy(asc(tonerTypes.name));
  return rows.map((row) => ({ ...row, stock: row.stock ?? 0 }));
}

export async function getContracts() {
  return db.select().from(contracts).orderBy(asc(contracts.contractNumber));
}

export async function getItsNames() {
  return db.select().from(itsNames).orderBy(asc(itsNames.name));
}

export async function getProvisionedMonitoringAgents() {
  return db
    .select({
      id: monitoringAgents.id,
      key: monitoringAgents.agentKey,
      name: monitoringAgents.name,
    })
    .from(monitoringAgents)
    .where(
      and(
        isNotNull(monitoringAgents.tokenHash),
        isNull(monitoringAgents.tokenRevokedAt),
      ),
    )
    .orderBy(asc(monitoringAgents.name));
}
