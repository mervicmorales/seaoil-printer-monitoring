import "server-only";
import { db } from "@/db";
import {
  contracts,
  departments,
  itsNames,
  locations,
  monitoringAgents,
  tonerTypes,
  vendors,
} from "@/db/schema";
import { and, asc, isNotNull, isNull } from "drizzle-orm";

export async function getLocations() {
  return db.select().from(locations).orderBy(asc(locations.name));
}

export async function getDepartments() {
  return db.select().from(departments).orderBy(asc(departments.name));
}

export async function getVendors() {
  return db.select().from(vendors).orderBy(asc(vendors.name));
}

export async function getTonerTypes() {
  return db.select().from(tonerTypes).orderBy(asc(tonerTypes.name));
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
