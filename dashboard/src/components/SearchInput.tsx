"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { LoaderCircle, Search, X } from "lucide";
import { MorphIcon } from "morphicons/react";

type SearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "type" | "value"
> & {
  value?: string;
  defaultValue?: string;
  label?: string;
  loading?: boolean;
  error?: string | null;
  containerClassName?: string;
  submitOnClear?: boolean;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
};

export default function SearchInput({
  value,
  defaultValue = "",
  label,
  loading = false,
  error,
  containerClassName = "",
  submitOnClear = true,
  onValueChange,
  onClear,
  onChange,
  onKeyDown,
  id,
  className = "",
  disabled,
  ...inputProps
}: SearchInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const query = value ?? internalValue;

  function updateValue(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  }

  function clearSearch() {
    updateValue("");
    onClear?.();
    inputRef.current?.focus();

    if (submitOnClear) {
      const form = inputRef.current?.form;
      requestAnimationFrame(() => form?.requestSubmit());
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    updateValue(event.target.value);
    onChange?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key === "Escape" && query) {
      event.preventDefault();
      clearSearch();
    }
  }

  return (
    <div className={`min-w-0 ${containerClassName}`}>
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-700">
          {label}
        </label>
      ) : null}

      <div
        className={`group flex h-10 min-w-0 items-center gap-2 overflow-hidden rounded-xl border bg-white px-3 shadow-sm transition-[border-color,background-color,box-shadow] duration-150 hover:bg-slate-50 focus-within:border-[#0b4f7c] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0b4f7c]/15 ${
          error ? "border-red-400" : "border-slate-300"
        } ${disabled ? "cursor-not-allowed bg-slate-100 opacity-70" : ""}`}
      >
        <span className="flex size-4 shrink-0 items-center justify-center text-slate-400" aria-hidden="true">
          <MorphIcon
            icon={loading ? LoaderCircle : Search}
            size={16}
            strokeWidth={2}
            reducedMotion="user"
            className={loading ? "animate-spin" : ""}
          />
        </span>

        <input
          {...inputProps}
          ref={inputRef}
          id={inputId}
          type="search"
          value={query}
          disabled={disabled}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          aria-busy={loading || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : inputProps["aria-describedby"]}
          className={`min-w-0 flex-1 appearance-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:appearance-none ${className}`}
        />

        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            disabled={disabled}
            aria-label="Clear search"
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors duration-150 hover:bg-slate-200 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4f7c] disabled:pointer-events-none"
          >
            <MorphIcon icon={X} size={13} strokeWidth={2.2} reducedMotion="user" />
          </button>
        ) : null}
      </div>

      <span className="sr-only" aria-live="polite">
        {loading ? "Searching" : ""}
      </span>
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
