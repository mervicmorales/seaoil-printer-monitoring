"use client";

import { useId, useMemo, useState } from "react";

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
}: {
  label: string;
  name: string;
  options: Option[];
  placeholder: string;
  required?: boolean;
  error?: string;
  defaultValue?: number | null;
  onValueChange?: (value: number | null) => void;
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
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-9 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40"
        />
        <button
          type="button"
          aria-label={`Open ${label} options`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setOpen((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-500"
        >
          ▾
        </button>
      </div>
      {open && (
        <div id={listboxId} role="listbox" className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
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
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
              >
                {option.name}
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
