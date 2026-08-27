"use client";

import type { ChangeEvent, ComponentProps } from "react";

export default function AutoSubmitFilterForm({
  children,
  onChange,
  resetKey,
  ...props
}: ComponentProps<"form"> & { resetKey?: string }) {
  function handleChange(event: ChangeEvent<HTMLFormElement>) {
    onChange?.(event);
    if (event.defaultPrevented) return;

    const target = event.target;
    const shouldSubmit =
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLInputElement &&
        ["checkbox", "radio", "date"].includes(target.type));

    if (shouldSubmit) event.currentTarget.requestSubmit();
  }

  return (
    <form key={resetKey} {...props} onChange={handleChange}>
      {children}
    </form>
  );
}
