"use client";

import { useEffect } from "react";

let activeLocks = 0;
let originalOverflow = "";

function acquireBodyScrollLock() {
  if (activeLocks === 0) {
    originalOverflow = document.documentElement.style.overflow;
  }

  activeLocks += 1;
  // `overflow: hidden` on the body turns it into a scroll container in Chromium.
  // That breaks desktop `position: sticky` elements while a modal is open,
  // making the sidebar scroll out of view and exposing the light page canvas.
  // Lock the document viewport with `clip` instead, which blocks background
  // scrolling without changing the body's layout or sticky positioning.
  document.documentElement.style.overflow = "clip";
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeLocks = Math.max(0, activeLocks - 1);
    if (activeLocks === 0) {
      document.documentElement.style.overflow = originalOverflow;
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
