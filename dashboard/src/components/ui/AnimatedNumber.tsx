"use client";

import { useEffect, useRef, useState } from "react";

type NumberFormat = "integer" | "currency" | "percent";

const integer = new Intl.NumberFormat("en-PH");
const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function AnimatedNumber({
  value,
  format = "integer",
  prefix = "",
  suffix = "",
  duration = 600,
  animateOnChange = true,
  className = "",
}: {
  value: number;
  format?: NumberFormat;
  prefix?: string;
  suffix?: string;
  duration?: number;
  animateOnChange?: boolean;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const currentValue = useRef(0);
  const mounted = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const start = mounted.current ? currentValue.current : 0;
    const shouldAnimate = !reducedMotion && duration > 0 && (!mounted.current || animateOnChange) && start !== value;
    mounted.current = true;

    if (!shouldAnimate) {
      currentValue.current = value;
      setDisplayValue(value);
      return;
    }

    const startedAt = performance.now();
    let animationFrame = 0;
    const update = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + (value - start) * eased;
      currentValue.current = next;
      setDisplayValue(next);
      if (progress < 1) animationFrame = window.requestAnimationFrame(update);
      else currentValue.current = value;
    };

    animationFrame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [animateOnChange, duration, reducedMotion, value]);

  const displayed = formatNumber(displayValue, format, prefix, suffix);
  const finalValue = formatNumber(value, format, prefix, suffix);

  return (
    <span className={`inline-grid tabular-nums ${className}`}>
      <span aria-hidden="true" className="col-start-1 row-start-1">{displayed}</span>
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">{finalValue}</span>
      <span className="sr-only">{finalValue}</span>
    </span>
  );
}

function formatNumber(value: number, format: NumberFormat, prefix: string, suffix: string) {
  const rounded = Math.round(value);
  const formatted = format === "currency" ? currency.format(rounded) : integer.format(rounded);
  return `${prefix}${formatted}${format === "percent" ? "%" : suffix}`;
}
