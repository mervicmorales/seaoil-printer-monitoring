"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { OverviewPeriod } from "@/lib/overview-analytics";

export const overviewTonerPeriods = ["7d", "30d", "90d", "12m"] as const;
export type OverviewTonerPeriod = (typeof overviewTonerPeriods)[number];

export type HighlightedExpenseScope = {
  dimension: "department" | "office" | "toner";
  key: string;
  label: string;
};

type OverviewTonerAnalyticsContextValue = {
  period: OverviewTonerPeriod;
  setPeriod: (period: OverviewTonerPeriod) => void;
  highlightedExpenseScope: HighlightedExpenseScope | null;
  setHighlightedExpenseScope: (scope: HighlightedExpenseScope | null) => void;
};

const OverviewTonerAnalyticsContext = createContext<OverviewTonerAnalyticsContextValue | null>(null);

export function OverviewTonerAnalyticsProvider({
  children,
  initialPeriod,
}: {
  children: ReactNode;
  initialPeriod: OverviewPeriod;
}) {
  const [period, setPeriodState] = useState<OverviewTonerPeriod>(() => normalizePeriod(initialPeriod));
  const [highlightedExpenseScope, setHighlightedExpenseScopeState] = useState<HighlightedExpenseScope | null>(null);

  const setPeriod = useCallback((nextPeriod: OverviewTonerPeriod) => {
    setPeriodState(nextPeriod);
    const url = new URL(window.location.href);
    url.searchParams.set("period", nextPeriod);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const setHighlightedExpenseScope = useCallback((scope: HighlightedExpenseScope | null) => {
    setHighlightedExpenseScopeState((current) => {
      if (current?.dimension === scope?.dimension && current?.key === scope?.key && current?.label === scope?.label) return current;
      return scope;
    });
  }, []);

  const value = useMemo(() => ({
    period,
    setPeriod,
    highlightedExpenseScope,
    setHighlightedExpenseScope,
  }), [highlightedExpenseScope, period, setHighlightedExpenseScope, setPeriod]);

  return <OverviewTonerAnalyticsContext.Provider value={value}>{children}</OverviewTonerAnalyticsContext.Provider>;
}

export function useOverviewTonerAnalytics() {
  const value = useContext(OverviewTonerAnalyticsContext);
  if (!value) throw new Error("Overview toner analytics must be used inside its provider.");
  return value;
}

function normalizePeriod(period: OverviewPeriod): OverviewTonerPeriod {
  return overviewTonerPeriods.includes(period as OverviewTonerPeriod) ? period as OverviewTonerPeriod : "30d";
}
