import { asc } from "drizzle-orm";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { hasAdminPrivileges } from "@/lib/roles";
import VendorManager from "../VendorManager";
import { addVendorAction, deleteVendorAction, updateVendorAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireModuleFullAccess("system");
  const [sp, items] = await Promise.all([
    searchParams,
    db.select().from(vendors).orderBy(asc(vendors.name)),
  ]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader title="Vendor / Supplier" parentTitle="System" />
      <SuccessBanner message={sp.success} errorMessage={sp.error} showInline={false} />
      <Card className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
        <VendorManager
          vendors={items}
          addAction={addVendorAction}
          updateAction={updateVendorAction}
          deleteAction={deleteVendorAction}
          readOnly={!hasAdminPrivileges(session.role)}
        />
      </Card>
    </div>
  );
}
