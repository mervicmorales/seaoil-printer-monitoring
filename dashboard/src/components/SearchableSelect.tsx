"use client";

import SearchableDropdown from "@/components/SearchableDropdown";

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
  floatingLabel = false,
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
  floatingLabel?: boolean;
}) {
  return <SearchableDropdown
    label={label}
    name={name}
    options={options.map((option) => ({ value: String(option.id), label: option.name }))}
    placeholder={placeholder}
    required={required}
    error={error}
    defaultValue={defaultValue == null ? "" : String(defaultValue)}
    onValueChange={(value) => onValueChange?.(value ? Number(value) : null)}
    disabled={disabled}
    floatingLabel={floatingLabel}
    inputClassName={floatingLabel ? "focus:border-[#040273] focus:ring-[#040273]/15" : ""}
  />;
}
