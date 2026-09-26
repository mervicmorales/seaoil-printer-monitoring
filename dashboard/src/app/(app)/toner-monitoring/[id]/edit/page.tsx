import { EditTransactionPage } from "./content";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EditTransactionPage params={params} />;
}
