import { EditUserPage } from "./content";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EditUserPage params={params} />;
}
