"use client";

import { useEffect } from "react";

let activeLocks = 0;
let originalOverflow = "";

function acquireBodyScrollLock() {
  if (activeLocks === 0) {
    originalOverflow = document.body.style.overflow === "hidden"
      ? ""
      : document.body.style.overflow;
  }

  activeLocks += 1;
  document.body.style.overflow = "hidden";
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks === 0) {
      document.body.style.overflow = originalOverflow;
      originalOverflow = "";
    }
  };
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return acquireBodyScrollLock();
  }, [active]);
}
