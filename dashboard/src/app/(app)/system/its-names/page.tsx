import { asc } from "drizzle-orm";
import { db } from "@/db";
import { itsNames } from "@/db/schema";
import { Card, PageHeader } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import LookupTable from "@/components/LookupTable";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { hasAdminPrivileges } from "@/lib/roles";
import { addItsNameAction, deleteItsNameAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ItsNamesPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireModuleFullAccess("system");
  const [sp, items] = await Promise.all([
    searchParams,
    db.select().from(itsNames).orderBy(asc(itsNames.name)),
  ]);

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader title="ITS Names" parentTitle="System" />
      <SuccessBanner message={sp.success} errorMessage={sp.error} showInline={false} />
      <Card className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
        <LookupTable
          items={items}
          addAction={addItsNameAction}
          deleteAction={deleteItsNameAction}
          editable={false}
          readOnly={!hasAdminPrivileges(session.role)}
          placeholder="e.g. Patrick"
          fillHeight
          title="ITS names"
          description="Support names available in printer and service records."
        />
      </Card>
    </div>
  );
}
