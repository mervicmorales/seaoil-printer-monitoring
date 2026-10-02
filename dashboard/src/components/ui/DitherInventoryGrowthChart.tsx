"use client";

/*
 * Adapted from Amicro's DitherGrowthChart by Syed Subhan Uddin.
 * The original work is MIT licensed. See THIRD_PARTY_NOTICES.md.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useCanvasSetup } from "@/hooks/useCanvasSetup";

export type DitherInventoryPoint = {
  key: string;
  label: string;
  balance: number;
  delivered: number;
  requested: number;
};

const integer = new Intl.NumberFormat("en-PH");

export default function DitherInventoryGrowthChart({ points }: { points: DitherInventoryPoint[] }) {
  const { canvasRef, rect, isVisible, reducedMotion, size } = useCanvasSetup();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const maximum = useMemo(() => Math.max(1, ...points.map((point) => point.balance)), [points]);
  const chartMaximum = Math.max(1, Math.ceil(maximum * 1.12));
  const ticks = [chartMaximum, Math.round(chartMaximum * 0.66), Math.round(chartMaximum * 0.33), 0];
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const activeX = pointX(activeIndex ?? 0, points.length);
  const activeY = balanceY(activePoint?.balance ?? 0, chartMaximum, size.height);
  const labelIndexes = useMemo(() => [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].filter((index) => index >= 0), [points.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const { width, height } = rect.current;
    if (!canvas || !context || !points.length || width === 0 || height === 0) return;

    const startedAt = performance.now();
    const duration = reducedMotion ? 0 : 420;

    const draw = (timestamp: number) => {
      if (!isVisible.current) {
        animationRef.current = window.requestAnimationFrame(draw);
        return;
      }
      const progress = duration === 0 ? 1 : Math.min(1, (timestamp - startedAt) / duration);
      renderChart(context, canvas, width, height, points, chartMaximum, easeOut(progress));
      if (progress < 1) animationRef.current = window.requestAnimationFrame(draw);
    };

    animationRef.current = window.requestAnimationFrame(draw);
    return () => {
      if (animationRef.current !== null) window.cancelAnimationFrame(animationRef.current);
    };
  }, [canvasRef, chartMaximum, isVisible, points, rect, reducedMotion, size.height, size.width]);

  const selectFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds || !points.length) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    setActiveIndex(Math.round(ratio * Math.max(0, points.length - 1)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!points.length) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      setActiveIndex((current) => Math.max(0, Math.min(points.length - 1, (current ?? points.length - 1) + direction)));
    }
    if (event.key === "Escape") setActiveIndex(null);
  };

  if (!points.length) return <div className="flex flex-1 items-center justify-center px-4 text-xs text-slate-500">No inventory movement is available.</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-3 @min-[28rem]:px-4">
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="relative w-7 shrink-0 text-[8px] font-semibold tabular-nums text-slate-400" aria-hidden="true">
          {ticks.map((tick, index) => (
            <span key={`${tick}-${index}`} className="absolute right-0 -translate-y-1/2" style={{ top: `${8 + index * 28}%` }}>{integer.format(tick)}</span>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={wrapperRef}
            tabIndex={0}
            role="group"
            aria-label="Interactive inventory balance chart. Use the left and right arrow keys to review each period."
            onPointerMove={selectFromPointer}
            onPointerLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex((current) => current ?? points.length - 1)}
            onBlur={() => setActiveIndex(null)}
            onKeyDown={handleKeyDown}
            className="relative min-h-36 flex-1 cursor-crosshair touch-none overflow-hidden rounded-md outline-none ring-[#014171] focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Inventory balance changed from ${points[0]?.balance ?? 0} to ${points.at(-1)?.balance ?? 0} units.`}
              className="block size-full"
            />
            {activePoint && (
              <>
                <span className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[#014171]/45" style={{ left: `${activeX}%` }} />
                <span className="pointer-events-none absolute inset-x-0 z-10 h-px border-t border-dashed border-[#014171]/30" style={{ top: `${activeY}%` }} />
                <span className="pointer-events-none absolute z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#014171] shadow" style={{ left: `${activeX}%`, top: `${activeY}%` }} />
                <div
                  className={`pointer-events-none absolute z-30 min-w-32 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[9px] leading-4 text-slate-600 shadow-lg ${tooltipXClass(activeIndex, points.length)} ${activeY < 35 ? "translate-y-3" : "-translate-y-[calc(100%+0.75rem)]"}`}
                  style={{ left: `${activeX}%`, top: `${activeY}%` }}
                  aria-live="polite"
                >
                  <p className="font-bold text-slate-800">{activePoint.label}</p>
                  <p className="flex justify-between gap-4"><span>Balance</span><strong className="tabular-nums text-[#014171]">{integer.format(activePoint.balance)}</strong></p>
                  <p className="flex justify-between gap-4"><span>Delivered</span><strong className="tabular-nums text-emerald-700">+{integer.format(activePoint.delivered)}</strong></p>
                  <p className="flex justify-between gap-4"><span>Requested</span><strong className="tabular-nums text-rose-700">−{integer.format(activePoint.requested)}</strong></p>
                </div>
              </>
            )}
          </div>
          <div className="relative mt-1.5 h-4 text-[8px] font-semibold text-slate-400" aria-hidden="true">
            {labelIndexes.map((index) => (
              <span key={points[index]!.key} className={`absolute whitespace-nowrap ${tooltipXClass(index, points.length)}`} style={{ left: `${pointX(index, points.length)}%` }}>{points[index]!.label}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[8px] font-semibold text-slate-500">
        <Legend color="bg-[#014171]" label="Stock balance" />
        <Legend color="bg-emerald-500" label="Delivery" />
        <Legend color="bg-rose-500" label="Request" />
      </div>
      <p className="sr-only">{points.map((point) => `${point.label}: ${point.balance} units, ${point.delivered} delivered, ${point.requested} requested`).join(". ")}</p>
    </div>
  );
}

function renderChart(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  points: DitherInventoryPoint[],
  maximum: number,
  progress: number,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const plotTop = height * 0.08;
  const plotBottom = height * 0.92;
  const plotHeight = plotBottom - plotTop;
  const revealX = width * progress;
  const x = (index: number) => points.length > 1 ? (index / (points.length - 1)) * width : width / 2;
  const y = (value: number) => plotBottom - (Math.max(0, value) / maximum) * plotHeight;

  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(dpr, dpr);

  context.strokeStyle = "rgba(148, 163, 184, 0.22)";
  context.setLineDash([3, 4]);
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const gridY = plotTop + (index / 3) * plotHeight;
    context.beginPath();
    context.moveTo(0, gridY);
    context.lineTo(width, gridY);
    context.stroke();
  }
  context.setLineDash([]);

  context.save();
  context.beginPath();
  context.rect(0, 0, revealX, height);
  context.clip();

  const cell = Math.max(4, Math.round(width / 120));
  context.fillStyle = "#0b70a8";
  for (let cellX = 0; cellX <= width; cellX += cell) {
    const ratio = width > 0 ? cellX / width : 0;
    const pointIndex = Math.min(points.length - 1, Math.floor(ratio * Math.max(1, points.length - 1)));
    const curveY = y(points[pointIndex]?.balance ?? 0);
    for (let cellY = curveY + cell; cellY <= plotBottom; cellY += cell) {
      const depth = (cellY - curveY) / Math.max(1, plotBottom - curveY);
      const noise = hash(cellX, cellY);
      if (noise < 0.22 + depth * 0.42) continue;
      const size = cell * (0.24 + depth * 0.3 + noise * 0.16);
      context.globalAlpha = 0.2 + depth * 0.22;
      context.fillRect(cellX - size / 2, cellY - size / 2, size, size);
    }
  }
  context.globalAlpha = 1;

  context.beginPath();
  context.strokeStyle = "#014171";
  context.lineWidth = 2.25;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.moveTo(x(0), y(points[0]?.balance ?? 0));
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(x(index), y(points[index - 1]!.balance));
    context.lineTo(x(index), y(points[index]!.balance));
  }
  context.stroke();

  points.forEach((point, index) => {
    const pointXValue = x(index);
    const pointYValue = y(point.balance);
    context.beginPath();
    context.arc(pointXValue, pointYValue, point.delivered > 0 || point.requested > 0 ? 3.5 : 2.25, 0, Math.PI * 2);
    context.fillStyle = point.delivered > point.requested ? "#10b981" : point.requested > point.delivered ? "#e11d48" : "#014171";
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = "#ffffff";
    context.stroke();
  });
  context.restore();
  context.restore();
}

function pointX(index: number, count: number) {
  return count > 1 ? (index / (count - 1)) * 100 : 50;
}

function balanceY(value: number, maximum: number, height: number) {
  if (height <= 0) return 50;
  const plotTop = height * 0.08;
  const plotBottom = height * 0.92;
  return ((plotBottom - (Math.max(0, value) / maximum) * (plotBottom - plotTop)) / height) * 100;
}

function tooltipXClass(index: number | null, count: number) {
  if (index === null || index <= 0) return "translate-x-0";
  if (index >= count - 1) return "-translate-x-full";
  return "-translate-x-1/2";
}

function easeOut(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function hash(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`size-2 rounded-sm ${color}`} />{label}</span>;
}
