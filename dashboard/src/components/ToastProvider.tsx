"use client";

import { GooeyToaster } from "goey-toast";

export default function ToastProvider() {
  return (
    <GooeyToaster
      position="bottom-right"
      theme="light"
      preset="subtle"
      spring={false}
      closeButton="top-right"
      showProgress
      maxQueue={3}
      queueOverflow="drop-oldest"
    />
  );
}
