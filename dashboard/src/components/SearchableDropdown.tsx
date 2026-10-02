"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide";
import { MorphIcon } from "morphicons/react";

export type SearchableDropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export default function SearchableDropdown({
  label,
  name,
  form,
  options,
  placeholder = "Search options...",
  value,
  defaultValue = "",
  onValueChange,
  required = false,
  disabled = false,
  error,
  className = "",
  inputClassName = "",
  menuClassName = "",
  labelClassName = "",
  floatingLabel = false,
  autoSubmit = false,
  ariaLabel,
}: {
  label?: string;
  name?: string;
  form?: string;
  options: SearchableDropdownOption[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  inputClassName?: string;
  menuClassName?: string;
  labelClassName?: string;
  floatingLabel?: boolean;
  autoSubmit?: boolean;
  ariaLabel?: string;
}) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? (value ?? "") : internalValue;
  const [query, setQuery] = useState<string | null>(null);
  const editingQuery = query !== null;
  const effectiveValue = editingQuery ? "" : selectedValue;
  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? "";
  const selectedOption = editingQuery ? undefined : options.find((option) => option.value === selectedValue);
  const displayedQuery = query ?? selectedLabel;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const visibleInputRef = useRef<HTMLInputElement>(null);
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 224,
    openAbove: false,
  });

  const filteredOptions = useMemo(() => {
    const search = displayedQuery.trim().toLowerCase();
    if (!search || selectedOption) return options;
    return options.filter((option) => option.label.toLowerCase().includes(search));
  }, [displayedQuery, options, selectedOption]);

  const updateMenuPosition = useCallback(() => {
    const input = visibleInputRef.current;
    if (!input) return;

    const rect = input.getBoundingClientRect();
    const viewportPadding = 8;
    const menuGap = 6;
    const preferredHeight = 224;
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding - menuGap;
    const roomAbove = rect.top - viewportPadding - menuGap;
    const openAbove = roomBelow < 160 && roomAbove > roomBelow;
    const availableHeight = openAbove ? roomAbove : roomBelow;
    const maxHeight = Math.max(96, Math.min(preferredHeight, availableHeight));
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.max(
      viewportPadding,
      Math.min(rect.left, window.innerWidth - width - viewportPadding),
    );

    setMenuPosition({
      top: openAbove ? rect.top - menuGap : rect.bottom + menuGap,
      left,
      width,
      maxHeight,
      openAbove,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const reposition = () => updateMenuPosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updateMenuPosition]);

  function commit(nextValue: string) {
    const option = options.find((item) => item.value === nextValue);
    if (!option || option.disabled) return;
    if (!controlled) setInternalValue(nextValue);
    setQuery(null);
    setOpen(false);
    setActiveIndex(0);
    onValueChange?.(nextValue);
    if (autoSubmit) window.setTimeout(() => hiddenInputRef.current?.form?.requestSubmit(), 0);
  }

  function clearSelection(nextQuery: string) {
    if (!controlled) setInternalValue("");
    setQuery(nextQuery);
    setOpen(true);
    setActiveIndex(0);
  }

  return (
    <div className={`relative ${className}`}>
      {label && !floatingLabel && (
        <label htmlFor={inputId} className={`mb-1.5 block text-sm font-medium text-slate-700 ${labelClassName}`}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {name && <input ref={hiddenInputRef} type="hidden" name={name} form={form} value={effectiveValue} />}
      <div className={floatingLabel ? "add-printer-floating-field" : "relative"}>
        <input
          ref={visibleInputRef}
          id={inputId}
          type="text"
          form={form}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          aria-invalid={Boolean(error)}
          aria-label={ariaLabel}
          autoComplete="off"
          required={required}
          disabled={disabled}
          value={displayedQuery}
          placeholder={floatingLabel ? " " : placeholder}
          onFocus={(event) => {
            updateMenuPosition();
            setOpen(true);
            setActiveIndex(0);
            event.currentTarget.select();
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => clearSelection(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery(null);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, Math.max(filteredOptions.length - 1, 0)));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.max(index - 1, 0));
              return;
            }
            if (event.key === "Enter" && open && filteredOptions[activeIndex]) {
              event.preventDefault();
              commit(filteredOptions[activeIndex].value);
            }
          }}
          className={`${floatingLabel ? "h-12 pb-1 pt-4" : "h-11"} w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${inputClassName}`}
        />
        {label && floatingLabel && (
          <label htmlFor={inputId}>
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={label ? `Open ${label} options` : "Open options"}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            updateMenuPosition();
            setOpen((current) => !current);
          }}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-current opacity-60 transition hover:bg-black/5 hover:opacity-90 disabled:cursor-not-allowed"
        >
          <MorphIcon icon={ChevronDown} size={16} strokeWidth={2} reducedMotion="user" className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && !disabled && typeof document !== "undefined"
        ? createPortal(
            <div
              id={listboxId}
              role="listbox"
              className={`fixed z-[200] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_16px_40px_rgba(15,23,42,0.18)] ${menuClassName}`}
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
                transform: menuPosition.openAbove ? "translateY(-100%)" : undefined,
              }}
            >
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-400">No matches found.</p>
              ) : filteredOptions.map((option, index) => (
                <button
                  id={`${listboxId}-${index}`}
                  key={`${option.value}-${option.label}`}
                  type="button"
                  role="option"
                  aria-selected={effectiveValue === option.value}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(option.value)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${effectiveValue === option.value ? "bg-sky-50 font-medium text-[#014171]" : index === activeIndex ? "bg-slate-50 text-slate-800" : "hover:bg-slate-50"}`}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {effectiveValue === option.value && <MorphIcon icon={Check} size={15} strokeWidth={2.2} reducedMotion="user" />}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
