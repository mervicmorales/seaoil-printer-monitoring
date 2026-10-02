"use client";

/*
 * Adapted from Amicro's DitherDonutChart by Syed Subhan Uddin.
 * The original work is MIT licensed. See THIRD_PARTY_NOTICES.md.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useCanvasSetup } from "@/hooks/useCanvasSetup";

export type DitherDonutDatum = {
  key: string;
  label: string;
  value: number;
};

const SEGMENT_COLORS = [
  "#014171",
  "#0b70a8",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#64748b",
];

export default function DitherDonutChart({
  data,
  formatValue,
}: {
  data: DitherDonutDatum[];
  formatValue: (value: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { canvasRef, rect, isVisible, reducedMotion } = useCanvasSetup();
  const total = useMemo(() => data.reduce((sum, item) => sum + Math.max(0, item.value), 0), [data]);
  const shares = useMemo(() => data.map((item) => total > 0 ? Math.max(0, item.value) / total : 0), [data, total]);
  const requestRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const morphStartRef = useRef(0);
  const fromSharesRef = useRef<number[]>([]);
  const targetSharesRef = useRef<number[]>([]);
  const displayedSharesRef = useRef<number[]>([]);
  const hoverRef = useRef<number | null>(null);

  useEffect(() => {
    hoverRef.current = hoverIndex;
  }, [hoverIndex]);

  useEffect(() => {
    if (displayedSharesRef.current.length !== shares.length) {
      displayedSharesRef.current = [...shares];
      fromSharesRef.current = [...shares];
      targetSharesRef.current = [...shares];
      morphStartRef.current = 0;
      return;
    }
    fromSharesRef.current = [...displayedSharesRef.current];
    targetSharesRef.current = [...shares];
    morphStartRef.current = performance.now();
  }, [shares]);

  useEffect(() => {
    function draw() {
      if (!isVisible.current) {
        requestRef.current = window.requestAnimationFrame(draw);
        return;
      }
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      const { width, height } = rect.current;
      if (!canvas || !context || width === 0 || height === 0) {
        requestRef.current = window.requestAnimationFrame(draw);
        return;
      }

      timeRef.current += reducedMotion ? 0 : 0.018;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const logicalSize = 200;
      context.save();
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale((width * dpr) / logicalSize, (height * dpr) / logicalSize);

      const elapsed = morphStartRef.current ? (performance.now() - morphStartRef.current) / 450 : 1;
      const progress = reducedMotion ? 1 : Math.min(1, elapsed);
      const eased = 1 - Math.pow(2, -10 * progress);
      for (let index = 0; index < targetSharesRef.current.length; index += 1) {
        displayedSharesRef.current[index] = fromSharesRef.current[index]
          + (targetSharesRef.current[index] - fromSharesRef.current[index]) * eased;
      }

      let startAngle = -Math.PI / 2;
      const activeIndex = hoverRef.current;
      displayedSharesRef.current.forEach((share, index) => {
        if (share <= 0) return;
        const sweep = share * Math.PI * 2;
        const gap = Math.min(0.065, sweep * 0.25);
        const segmentStart = startAngle + gap / 2;
        const segmentEnd = Math.max(segmentStart, startAngle + sweep - gap / 2);
        const hovered = activeIndex === index;
        const dimmed = activeIndex !== null && !hovered;

        context.save();
        if (hovered) {
          const middle = (segmentStart + segmentEnd) / 2;
          context.translate(Math.cos(middle) * 5, Math.sin(middle) * 5);
        }
        context.beginPath();
        drawRoundedWedge(context, 100, 100, 55, 87, segmentStart, segmentEnd, 6);
        context.clip();
        context.globalAlpha = dimmed ? 0.24 : 0.9;
        context.fillStyle = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

        const cell = 4.5;
        for (let x = 12; x <= 188; x += cell) {
          for (let y = 12; y <= 188; y += cell) {
            const dx = x - 100;
            const dy = y - 100;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 51 || distance > 91) continue;
            let angle = Math.atan2(dy, dx) - segmentStart;
            while (angle < 0) angle += Math.PI * 2;
            if (angle > segmentEnd - segmentStart) continue;
            const fullness = smoothstep(0.62, 1, (distance - 55) / 32);
            const wave = reducedMotion ? 0.5 : smoothstep(-1.5, 1.5,
              Math.sin(distance * 0.1 - timeRef.current)
              + Math.sin(Math.atan2(dy, dx) * 3 + timeRef.current * 1.5)
              + Math.sin(dx * 0.05 + dy * 0.05 + timeRef.current * 2));
            const jitter = hash(x, y);
            const size = cell * ((hovered ? 0.46 : 0.34) + 0.36 * fullness + 0.26 * wave) * (0.78 + 0.42 * jitter);
            context.fillRect(x - size / 2, y - size / 2, size, size);
          }
        }
        context.restore();
        startAngle += sweep;
      });
      context.restore();
      requestRef.current = window.requestAnimationFrame(draw);
    }

    requestRef.current = window.requestAnimationFrame(draw);
    return () => {
      if (requestRef.current !== null) window.cancelAnimationFrame(requestRef.current);
    };
  }, [canvasRef, isVisible, rect, reducedMotion]);

  if (!data.length || total <= 0) return null;

  return (
    <div className="mt-5 grid items-center gap-5 sm:grid-cols-[15rem_minmax(0,1fr)] lg:gap-7">
      <div className="relative mx-auto size-56 shrink-0 lg:size-60">
        <canvas ref={canvasRef} role="img" aria-label="Toner expense distribution donut chart" className="block size-full" />
        <div className="pointer-events-none absolute inset-[28%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-sm ring-1 ring-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Total</span>
          <strong className="mt-1 max-w-32 truncate text-sm font-bold tabular-nums text-[#014171] lg:text-base" title={formatValue(total)}>{formatValue(total)}</strong>
        </div>
      </div>
      <div className="min-w-0 space-y-2">
        {data.map((item, index) => {
          const percent = Math.round((item.value / total) * 100);
          const active = hoverIndex === index;
          return (
            <div
              key={item.key}
              tabIndex={0}
              onFocus={() => setHoverIndex(index)}
              onBlur={() => setHoverIndex(null)}
              onMouseEnter={() => setHoverIndex(index)}
              onMouseLeave={() => setHoverIndex(null)}
              className={`flex items-center justify-between gap-4 rounded-lg border px-3 py-2 outline-none transition ${active ? "border-slate-300 bg-slate-50 shadow-sm" : "border-transparent hover:bg-slate-50"}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }} />
                <span className="truncate text-xs font-semibold text-slate-700" title={item.label}>{item.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-right">
                <strong className="text-xs tabular-nums text-[#014171]">{formatValue(item.value)}</strong>
                <span className="w-8 text-[10px] tabular-nums text-slate-400">{percent}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function smoothstep(min: number, max: number, value: number) {
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return normalized * normalized * (3 - 2 * normalized);
}

function hash(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function drawRoundedWedge(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number,
) {
  const sweep = endAngle - startAngle;
  if (sweep <= 0.001) return;
  const radius = Math.min(cornerRadius, (outerRadius - innerRadius) / 2, (sweep * innerRadius) / 2);
  const startInner = startAngle + radius / innerRadius;
  const endInner = endAngle - radius / innerRadius;
  const startOuter = startAngle + radius / outerRadius;
  const endOuter = endAngle - radius / outerRadius;
  context.moveTo(centerX + innerRadius * Math.cos(startInner), centerY + innerRadius * Math.sin(startInner));
  context.arc(centerX, centerY, innerRadius, startInner, endInner);
  context.arcTo(centerX + innerRadius * Math.cos(endAngle), centerY + innerRadius * Math.sin(endAngle), centerX + outerRadius * Math.cos(endAngle), centerY + outerRadius * Math.sin(endAngle), radius);
  context.arcTo(centerX + outerRadius * Math.cos(endAngle), centerY + outerRadius * Math.sin(endAngle), centerX + outerRadius * Math.cos(endOuter), centerY + outerRadius * Math.sin(endOuter), radius);
  context.arc(centerX, centerY, outerRadius, endOuter, startOuter, true);
  context.arcTo(centerX + outerRadius * Math.cos(startAngle), centerY + outerRadius * Math.sin(startAngle), centerX + innerRadius * Math.cos(startAngle), centerY + innerRadius * Math.sin(startAngle), radius);
  context.arcTo(centerX + innerRadius * Math.cos(startAngle), centerY + innerRadius * Math.sin(startAngle), centerX + innerRadius * Math.cos(startInner), centerY + innerRadius * Math.sin(startInner), radius);
}
