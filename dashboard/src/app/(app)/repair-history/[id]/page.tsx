import { ViewTicketPage } from "./content";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ViewTicketPage params={params} />;
}
