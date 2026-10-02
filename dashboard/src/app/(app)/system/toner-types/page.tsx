import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tonerInventory, tonerTypes } from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { hasAdminPrivileges } from "@/lib/roles";
import TonerTypeManager from "../TonerTypeManager";
import {
  addTonerTypeAction,
  deleteTonerTypeAction,
  updateAlertCardVisibilityAction,
  updateThresholdAction,
  updateTonerTypeAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function TonerTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireModuleFullAccess("system");
  const [sp, tonerRows] = await Promise.all([
    searchParams,
    db.select({
      id: tonerTypes.id,
      name: tonerTypes.name,
      unitCost: tonerTypes.unitCost,
      stock: tonerInventory.stock,
      threshold: tonerInventory.lowStockThreshold,
      criticalThreshold: tonerInventory.criticalStockThreshold,
      showAlertCard: tonerTypes.showAlertCard,
    }).from(tonerTypes).leftJoin(tonerInventory, eq(tonerInventory.tonerTypeId, tonerTypes.id)).orderBy(asc(tonerTypes.name)),
  ]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader title="Toner Types" parentTitle="System" />
      <SuccessBanner message={sp.success} errorMessage={sp.error} showInline={false} />
      <Card className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
        <TonerTypeManager
          items={tonerRows.map((item) => ({
            id: item.id,
            name: item.name,
            unitCost: Number(item.unitCost ?? 0),
            stock: item.stock ?? 0,
            threshold: item.threshold ?? 5,
            criticalThreshold: item.criticalThreshold ?? 2,
            showAlertCard: item.showAlertCard,
          }))}
          addAction={addTonerTypeAction}
          updateAction={updateTonerTypeAction}
          deleteAction={deleteTonerTypeAction}
          thresholdAction={updateThresholdAction}
          visibilityAction={updateAlertCardVisibilityAction}
          isAdmin={hasAdminPrivileges(session.role)}
        />
      </Card>
    </div>
  );
}
