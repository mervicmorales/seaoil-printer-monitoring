"use client";

import { useMemo, useState } from "react";

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
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Scanner</span>
        <select
          name="target"
          required
          value={selectedTarget}
          onChange={(event) => {
            const nextTarget = targets.find((target) => target.value === event.target.value);
            const nextSources = nextTarget?.sources.length
              ? nextTarget.sources
              : ["Flatbed", "ADF", "ADF Duplex"];
            setSelectedTarget(event.target.value);
            if (!nextSources.includes(source)) setSource(nextSources[0] ?? "Flatbed");
          }}
          className={selectClassName}
        >
          {targets.map((target) => (
            <option key={target.value} value={target.value}>{target.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Document source</span>
        <select
          name="source"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          className={selectClassName}
        >
          {availableSources.map((availableSource) => (
            <option key={availableSource} value={availableSource}>
              {SOURCE_LABELS[availableSource] || availableSource}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
