import { NewPrinterPage } from "./content";

export default function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  return <NewPrinterPage searchParams={searchParams} />;
}
