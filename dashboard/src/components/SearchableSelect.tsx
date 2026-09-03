"use client";

import { useId, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide";
import { MorphIcon } from "morphicons/react";

type Option = { id: number; name: string };

export default function SearchableSelect({
  label,
  name,
  options,
  placeholder,
  required = false,
  error,
  defaultValue,
  onValueChange,
  disabled = false,
}: {
  label: string;
  name: string;
  options: Option[];
  placeholder: string;
  required?: boolean;
  error?: string;
  defaultValue?: number | null;
  onValueChange?: (value: number | null) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const initialOption = options.find((option) => option.id === defaultValue);
  const [query, setQuery] = useState(initialOption?.name ?? "");
  const [selectedId, setSelectedId] = useState<number | null>(initialOption?.id ?? null);
  const [open, setOpen] = useState(false);
  const filteredOptions = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search || selectedId !== null) return options;
    return options.filter((option) => option.name.toLowerCase().includes(search));
  }, [options, query, selectedId]);

  function select(option: Option) {
    setSelectedId(option.id);
    setQuery(option.name);
    setOpen(false);
    onValueChange?.(option.id);
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input type="hidden" name={name} value={selectedId ?? ""} />
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          required={required}
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 100)}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedId(null);
            onValueChange?.(null);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && open && filteredOptions.length > 0) {
              event.preventDefault();
              select(filteredOptions[0]);
            }
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={`Open ${label} options`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <MorphIcon
            icon={ChevronDown}
            size={16}
            strokeWidth={2}
            reducedMotion="user"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {open && !disabled && (
        <div id={listboxId} role="listbox" className="absolute z-30 mt-1.5 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No matches found.</p>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selectedId === option.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition focus:outline-none ${selectedId === option.id ? "bg-sky-50 font-medium text-[#014171]" : "text-slate-700 hover:bg-slate-50 focus:bg-slate-50"}`}
              >
                <span className="min-w-0 truncate">{option.name}</span>
                {selectedId === option.id && <MorphIcon icon={Check} size={15} strokeWidth={2.2} reducedMotion="user" />}
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
