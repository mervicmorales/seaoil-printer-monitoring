"use client";

import {
  createContext,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const PageHeaderPlacementContext = createContext(true);
const subscribeToHeaderTarget = () => () => {};
const getHeaderTarget = () => document.getElementById("app-page-header-slot");
const getServerHeaderTarget = () => null;

export function PageHeaderPlacement({
  inAppHeader,
  children,
}: {
  inAppHeader: boolean;
  children: ReactNode;
}) {
  return (
    <PageHeaderPlacementContext.Provider value={inAppHeader}>
      {children}
    </PageHeaderPlacementContext.Provider>
  );
}

export function PageHeaderPortal({ children }: { children: ReactNode }) {
  const inAppHeader = useContext(PageHeaderPlacementContext);
  const target = useSyncExternalStore(
    subscribeToHeaderTarget,
    getHeaderTarget,
    getServerHeaderTarget,
  );

  if (!inAppHeader) {
    return <div className="mb-6">{children}</div>;
  }

  if (!target) return null;

  return createPortal(children, target);
}
