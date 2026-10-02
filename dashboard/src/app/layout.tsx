import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "goey-toast/styles.css";
import "feral-blob/blob.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import ToastProvider from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "SEAOIL Printer Monitoring System",
  description:
    "SEAOIL Philippines Inc. internal printer, toner, contract and repair monitoring system.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
