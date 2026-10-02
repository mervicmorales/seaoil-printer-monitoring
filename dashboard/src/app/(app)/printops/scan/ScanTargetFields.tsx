"use client";

import { useMemo, useState } from "react";
import SearchableDropdown from "@/components/SearchableDropdown";

type ScanTarget = {
  value: string;
  label: string;
  sources: string[];
};

const SOURCE_LABELS: Record<string, string> = {
  Flatbed: "Flatbed · glass",
  ADF: "ADF · simplex",
  "ADF Duplex": "ADF · duplex",
};

const selectClassName = "h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15";

export default function ScanTargetFields({ targets }: { targets: ScanTarget[] }) {
  const [selectedTarget, setSelectedTarget] = useState(targets[0]?.value ?? "");
  const selected = useMemo(
    () => targets.find((target) => target.value === selectedTarget) ?? targets[0],
    [selectedTarget, targets],
  );
  const availableSources = selected?.sources.length
    ? selected.sources
    : ["Flatbed", "ADF", "ADF Duplex"];
  const [source, setSource] = useState(availableSources[0] ?? "Flatbed");

  return (
    <>
      <SearchableDropdown
          label="Scanner"
          name="target"
          required
          value={selectedTarget}
          onValueChange={(value) => {
            const nextTarget = targets.find((target) => target.value === value);
            const nextSources = nextTarget?.sources.length
              ? nextTarget.sources
              : ["Flatbed", "ADF", "ADF Duplex"];
            setSelectedTarget(value);
            if (!nextSources.includes(source)) setSource(nextSources[0] ?? "Flatbed");
          }}
          placeholder="Search scanners..."
          options={targets.map((target) => ({ value: target.value, label: target.label }))}
          inputClassName={selectClassName}
          labelClassName="!font-semibold"
        />
      <SearchableDropdown
          label="Document source"
          name="source"
          value={source}
          onValueChange={setSource}
          placeholder="Search document sources..."
          options={availableSources.map((availableSource) => ({ value: availableSource, label: SOURCE_LABELS[availableSource] || availableSource }))}
          inputClassName={selectClassName}
          labelClassName="!font-semibold"
        />
    </>
  );
}
