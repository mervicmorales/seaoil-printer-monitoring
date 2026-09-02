"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type PageHeaderPlacementValue = "app" | "inline" | "modal";

const PageHeaderPlacementContext = createContext<PageHeaderPlacementValue>("app");
const subscribeToHeaderTarget = () => () => {};
const getAppHeaderTarget = () => document.getElementById("app-page-header-slot");
const getModalHeaderTarget = () => document.getElementById("modal-page-header-slot");
const getServerHeaderTarget = () => null;

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
  const target = useSyncExternalStore(
    subscribeToHeaderTarget,
    placement === "modal" ? getModalHeaderTarget : getAppHeaderTarget,
    getServerHeaderTarget,
  );

  if (placement === "inline") {
    return <div className="mb-6">{children}</div>;
  }

  if (!target) return null;

  return createPortal(children, target);
}
