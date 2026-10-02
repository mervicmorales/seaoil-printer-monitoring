"use client";

import { useEffect, useRef, useState } from "react";

export function useCanvasSetup() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rect = useRef({ width: 0, height: 0 });
  const isVisible = useRef(true);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [reducedMotion] = useState(() => typeof window !== "undefined" && (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || window.innerWidth < 768
  ));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        rect.current = { width, height };
        setSize((current) => current.width === width && current.height === height ? current : { width, height });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible.current = entry.isIntersecting;
    }, { rootMargin: "100px" });
    intersectionObserver.observe(canvas);

    const handleVisibility = () => {
      isVisible.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return { canvasRef, rect, isVisible, reducedMotion, size };
}
