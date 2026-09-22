"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Filter, Search } from "lucide";
import { IconGlyph } from "@/components/ui";

export type PrinterColumnFilterOption = {
  value: string;
  label: string;
};

export default function PrinterColumnFilter({
  label,
  paramName,
  options,
  selectedValues,
  currentSort = "",
  sortAscValue,
  sortDescValue,
  sortAscLabel = "Sort A to Z",
  sortDescLabel = "Sort Z to A",
}: {
  label: string;
  paramName: string;
  options: PrinterColumnFilterOption[];
  selectedValues: string[];
  currentSort?: string;
  sortAscValue?: string;
  sortDescValue?: string;
  sortAscLabel?: string;
  sortDescLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(() => new Set(selectedValues));
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const active = selectedValues.length > 0
    || Boolean(sortAscValue && currentSort === sortAscValue)
    || Boolean(sortDescValue && currentSort === sortDescValue);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalized));
  }, [options, query]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function openMenu() {
    setDraft(new Set(selectedValues));
    setQuery("");
    setOpen(true);
  }

  function navigate(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    update(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    close();
  }

  function applySelection() {
    navigate((params) => {
      params.delete(paramName);
      options.forEach((option) => {
        if (draft.has(option.value)) params.append(paramName, option.value);
      });
    });
  }

  function applySort(sort: string) {
    navigate((params) => {
      if (currentSort === sort) params.delete("sort");
      else params.set("sort", sort);
    });
  }

  function clearColumn() {
    navigate((params) => {
      params.delete(paramName);
      if ((sortAscValue && currentSort === sortAscValue) || (sortDescValue && currentSort === sortDescValue)) {
        params.delete("sort");
      }
    });
  }

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    function placeMenu() {
      const bounds = buttonRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const menuWidth = Math.min(320, window.innerWidth - 24);
      const left = Math.max(12, Math.min(bounds.right - menuWidth, window.innerWidth - menuWidth - 12));
      const preferredTop = bounds.bottom + 8;
      setPosition({ left, top: Math.min(preferredTop, Math.max(12, window.innerHeight - 480)) });
    }

    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => open ? close() : openMenu()}
        aria-label={`Filter ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative inline-flex size-7 shrink-0 items-center justify-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#014171]/30 ${
          active
            ? "bg-[#014171] text-white hover:bg-[#00365f]"
            : "text-slate-400 hover:bg-slate-200/70 hover:text-[#014171]"
        }`}
      >
        <IconGlyph icon={Filter} size={13} />
        {selectedValues.length > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-slate-900">
            {selectedValues.length}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label={`${label} column options`}
          className="fixed z-[80] flex max-h-[min(29rem,calc(100dvh-1.5rem))] w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left normal-case tracking-normal text-slate-700 shadow-[0_18px_50px_rgba(15,23,42,0.2)]"
          style={position}
        >
          {sortAscValue && sortDescValue && <div className="border-b border-slate-200 p-2">
            <button
              type="button"
              onClick={() => applySort(sortAscValue)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition hover:bg-slate-50 ${currentSort === sortAscValue ? "text-[#014171]" : "text-slate-700"}`}
            >
              {sortAscLabel}
              {currentSort === sortAscValue && <IconGlyph icon={Check} size={15} />}
            </button>
            <button
              type="button"
              onClick={() => applySort(sortDescValue)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition hover:bg-slate-50 ${currentSort === sortDescValue ? "text-[#014171]" : "text-slate-700"}`}
            >
              {sortDescLabel}
              {currentSort === sortDescValue && <IconGlyph icon={Check} size={15} />}
            </button>
          </div>}

          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="font-semibold text-[#0b70a8] hover:underline"
                onClick={() => setDraft(new Set(filteredOptions.map((option) => option.value)))}
              >
                Select all
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                className="font-semibold text-[#0b70a8] hover:underline"
                onClick={clearColumn}
              >
                Clear
              </button>
            </div>
            <span className="whitespace-nowrap text-slate-500">Displaying {filteredOptions.length}</span>
          </div>

          <label className="relative mx-3 mb-2 block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <IconGlyph icon={Search} size={15} />
            </span>
            <span className="sr-only">Search {label} values</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-normal outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/10"
            />
          </label>

          <div className="min-h-0 flex-1 overflow-y-auto border-y border-slate-100 px-2 py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs font-normal text-slate-400">No matching values</p>
            ) : filteredOptions.map((option) => {
              const checked = draft.has(option.value);
              return (
                <label key={option.value} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm font-normal hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => setDraft((current) => {
                      const next = new Set(current);
                      if (next.has(option.value)) next.delete(option.value);
                      else next.add(option.value);
                      return next;
                    })}
                  />
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded border ${checked ? "border-[#014171] bg-[#014171] text-white" : "border-slate-300 bg-white text-transparent"}`}>
                    <IconGlyph icon={Check} size={13} />
                  </span>
                  <span className="min-w-0 truncate">{option.label}</span>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-2 p-3">
            <button type="button" onClick={close} className="h-9 rounded-md px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100">
              Cancel
            </button>
            <button type="button" onClick={applySelection} className="h-9 rounded-md bg-[#014171] px-4 text-xs font-semibold text-white transition hover:bg-[#00365f]">
              Apply
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
