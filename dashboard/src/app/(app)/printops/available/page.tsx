import { AvailablePrintersPageContent } from "@/app/portal/page";

export const dynamic = "force-dynamic";

export default function SupportAvailablePrintersPage() {
  return <AvailablePrintersPageContent accountRole="support" />;
}
