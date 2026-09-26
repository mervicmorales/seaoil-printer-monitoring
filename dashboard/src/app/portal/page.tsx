import { AvailablePrintersPageContent } from "./content";

export const dynamic = "force-dynamic";

export default function PortalPage() {
  return <AvailablePrintersPageContent accountRole="employee" />;
}
