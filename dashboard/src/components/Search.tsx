"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./Search.module.css";

type SearchProps = {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  width?: number;
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  debounceMs?: number;
};

export default function Search({
  name = "q",
  defaultValue = "",
  placeholder = "Search",
  ariaLabel = "Search",
  className = "",
  value,
  onValueChange,
  debounceMs = 300,
}: SearchProps) {
  const controlled = value !== undefined;
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [internalValue, setInternalValue] = useState(defaultValue);

  useEffect(() => () => {
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
  }, []);

  useEffect(() => {
    if (!controlled && document.activeElement !== inputRef.current) {
      setInternalValue(defaultValue);
    }
  }, [controlled, defaultValue]);

  function applySearch(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue) params.set(name, nextValue);
    else params.delete(name);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  function scheduleSearch(nextValue: string, delay = debounceMs) {
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    submitTimerRef.current = setTimeout(() => applySearch(nextValue), delay);
  }

  return (
    <label className={`${styles.search} ${className}`}>
      <span className="sr-only">{ariaLabel}</span>
      <svg className={styles.lens} viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="8.25" cy="8.25" r="5.75" />
        <path d="m12.5 12.5 4.25 4.25" />
      </svg>
      <input
        ref={inputRef}
        className={styles.field}
        type="search"
        name={name}
        value={controlled ? value : internalValue}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          onValueChange?.(nextValue);
          if (!controlled) {
            setInternalValue(nextValue);
            scheduleSearch(nextValue, nextValue ? debounceMs : 0);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && submitTimerRef.current) {
            clearTimeout(submitTimerRef.current);
            submitTimerRef.current = null;
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            if (controlled) onValueChange?.("");
            else {
              setInternalValue("");
              scheduleSearch("", 0);
            }
          }
        }}
      />
    </label>
  );
}
