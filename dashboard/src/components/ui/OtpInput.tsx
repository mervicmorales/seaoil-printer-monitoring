"use client";

import { useEffect, useRef, useState } from "react";

export type OtpInputStatus = "idle" | "success" | "error";

export default function OtpInput({
  value,
  onChange,
  name,
  disabled = false,
  autoFocus = false,
  status = "idle",
}: {
  value: string;
  onChange: (value: string) => void;
  name: string;
  disabled?: boolean;
  autoFocus?: boolean;
  status?: OtpInputStatus;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const popTimer = useRef<number | null>(null);
  const [poppingIndex, setPoppingIndex] = useState<number | null>(null);
  const slots = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  useEffect(() => {
    if (!autoFocus || disabled) return;
    const target = value.length < 6 ? value.length : 0;
    const frame = window.requestAnimationFrame(() => {
      inputs.current[target]?.focus();
      inputs.current[target]?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, disabled, status, value.length]);

  useEffect(() => () => {
    if (popTimer.current) window.clearTimeout(popTimer.current);
  }, []);

  function focusAt(index: number) {
    const next = Math.max(0, Math.min(index, 5));
    inputs.current[next]?.focus();
    inputs.current[next]?.select();
  }

  function animateEntry(index: number) {
    if (popTimer.current) window.clearTimeout(popTimer.current);
    setPoppingIndex(index);
    popTimer.current = window.setTimeout(() => setPoppingIndex(null), 350);
  }

  function commit(next: string[], animateIndex?: number) {
    onChange(next.join("").slice(0, 6));
    if (animateIndex !== undefined) animateEntry(animateIndex);
  }

  function fillFrom(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "").split("");
    if (!digits.length) return;
    const next = [...slots];
    const accepted = digits.slice(0, 6 - index);
    accepted.forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    const lastIndex = Math.min(index + accepted.length - 1, 5);
    commit(next, lastIndex);
    focusAt(Math.min(index + accepted.length, 5));
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div role="group" aria-label="Six-digit authenticator code" className="flex items-center justify-center gap-1.5 sm:gap-2">
        {slots.map((slot, index) => (
          <input
            key={index}
            ref={(element) => { inputs.current[index] = element; }}
            value={slot}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            disabled={disabled}
            aria-label={`Digit ${index + 1} of 6`}
            maxLength={6}
            onFocus={(event) => event.currentTarget.select()}
            onPointerDown={(event) => {
              const firstEmpty = slots.findIndex((item) => !item);
              const target = firstEmpty < 0 ? index : Math.min(index, firstEmpty);
              if (target !== index) {
                event.preventDefault();
                focusAt(target);
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              fillFrom(index, event.clipboardData.getData("text"));
            }}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              const next = [...slots];
              if (!digits) {
                next[index] = "";
                commit(next);
                return;
              }
              if (digits.length > 1) {
                fillFrom(index, digits);
                return;
              }
              next[index] = digits;
              commit(next, index);
              if (index < 5) focusAt(index + 1);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusAt(index - 1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                focusAt(index + 1);
              } else if (event.key === "Backspace") {
                event.preventDefault();
                const next = [...slots];
                if (next[index]) {
                  next[index] = "";
                  commit(next);
                } else if (index > 0) {
                  next[index - 1] = "";
                  commit(next);
                  focusAt(index - 1);
                }
              }
            }}
            className={`pin-box ${slot ? "filled" : ""} ${poppingIndex === index ? "pop" : ""} ${status === "error" ? "pin-error" : ""} ${status === "success" ? "pin-success" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
