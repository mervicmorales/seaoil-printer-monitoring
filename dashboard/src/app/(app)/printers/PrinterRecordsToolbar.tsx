import Link from "next/link";
import { Plus } from "lucide";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import Search from "@/components/Search";
import { IconGlyph } from "@/components/ui";

export type PrinterRecordSort =
  | "newest"
  | "oldest"
  | "model_asc"
  | "model_desc"
  | "location_asc"
  | "location_desc"
  | "monitoring_asc"
  | "monitoring_desc"
  | "toner_asc"
  | "toner_desc"
  | "status_asc"
  | "status_desc";

type PrinterRecordsToolbarProps = {
  query: string;
  sort: PrinterRecordSort;
  resultCount: number;
  totalCount: number;
  selectedLocations: string[];
  selectedModels: string[];
  selectedMonitoringStatuses: string[];
  selectedTonerTypes: string[];
  selectedStatuses: string[];
  canAddPrinter: boolean;
};

export default function PrinterRecordsToolbar({
  query,
  sort,
  resultCount,
  totalCount,
  selectedLocations,
  selectedModels,
  selectedMonitoringStatuses,
  selectedTonerTypes,
  selectedStatuses,
  canAddPrinter,
}: PrinterRecordsToolbarProps) {
  const resultLabel = resultCount === totalCount
    ? `${totalCount} printer${totalCount === 1 ? "" : "s"}`
    : `${resultCount} of ${totalCount} printers`;

  return (
    <AutoSubmitFilterForm
      method="get"
      resetKey={[
        sort,
        selectedLocations.join(","),
        selectedModels.join(","),
        selectedMonitoringStatuses.join(","),
        selectedTonerTypes.join(","),
        selectedStatuses.join(","),
      ].join("|")}
      className="shrink-0 border-b border-slate-200 bg-white"
    >
      <input type="hidden" name="sort" value={sort} />
      {selectedLocations.map((value) => <input key={`location-${value}`} type="hidden" name="location" value={value} />)}
      {selectedModels.map((value) => <input key={`model-${value}`} type="hidden" name="model" value={value} />)}
      {selectedMonitoringStatuses.map((value) => <input key={`monitoring-${value}`} type="hidden" name="monitoring" value={value} />)}
      {selectedTonerTypes.map((value) => <input key={`toner-${value}`} type="hidden" name="toner" value={value} />)}
      {selectedStatuses.map((value) => <input key={`status-${value}`} type="hidden" name="status" value={value} />)}

      <div className="flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-10 shrink-0 items-center px-1 text-xs font-semibold text-slate-500">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="ml-2 whitespace-nowrap">{resultLabel}</span>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <Search
            name="q"
            defaultValue={query}
            placeholder="Search serial, model, IP, office or department"
            ariaLabel="Search printer records"
            className="shrink-0"
          />
          {canAddPrinter && (
            <Link
              href="/printers/new"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#00365f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#014171]/35"
            >
              <IconGlyph icon={Plus} size={15} />
              Add Printer
            </Link>
          )}
        </div>
      </div>
    </AutoSubmitFilterForm>
  );
}
