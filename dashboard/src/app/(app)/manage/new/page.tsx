import { NewUserPage } from "./content";

export default function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <NewUserPage searchParams={searchParams} />;
}
