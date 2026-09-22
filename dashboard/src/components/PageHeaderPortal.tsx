"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type PageHeaderPlacementValue = "app" | "inline" | "modal";

const PageHeaderPlacementContext = createContext<PageHeaderPlacementValue>("app");
const getAppHeaderTarget = () => document.getElementById("app-page-header-slot");
const getModalHeaderTarget = () => document.getElementById("modal-page-header-slot");

export function PageHeaderPlacement({
  inAppHeader,
  inModalHeader = false,
  children,
}: {
  inAppHeader: boolean;
  inModalHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <PageHeaderPlacementContext.Provider
      value={inModalHeader ? "modal" : inAppHeader ? "app" : "inline"}
    >
      {children}
    </PageHeaderPlacementContext.Provider>
  );
}

export function PageHeaderPortal({ children }: { children: ReactNode }) {
  const placement = useContext(PageHeaderPlacementContext);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (placement === "inline") return;

    let frame = 0;
    const resolveTarget = () => {
      const nextTarget = placement === "modal" ? getModalHeaderTarget() : getAppHeaderTarget();
      if (nextTarget) setTarget(nextTarget);
      else frame = window.requestAnimationFrame(resolveTarget);
    };
    frame = window.requestAnimationFrame(resolveTarget);
    return () => window.cancelAnimationFrame(frame);
  }, [placement]);

  if (placement === "inline") {
    return <div className="mb-6">{children}</div>;
  }

  if (!target) return null;

  return createPortal(children, target);
}
