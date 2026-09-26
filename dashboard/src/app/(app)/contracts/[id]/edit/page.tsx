import { EditContractPage } from "./content";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EditContractPage params={params} />;
}
