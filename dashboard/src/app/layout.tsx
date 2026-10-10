import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import "goey-toast/styles.css";
import "feral-blob/blob.css";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import ToastProvider from "@/components/ToastProvider";
import ThemeProvider from "@/components/ThemeProvider";
import { isThemePreference } from "@/lib/theme";

export const metadata: Metadata = {
  title: "SEAOIL Printer Monitoring System",
  description:
    "SEAOIL Philippines Inc. internal printer, toner, contract and repair monitoring system.",
};

const themeBootstrapScript = `
(() => {
  try {
    const stored = localStorage.getItem("seaoil-theme");
    const fallback = document.documentElement.dataset.themePreference || "system";
    const preference = ["light", "dark", "system"].includes(stored) ? stored : fallback;
    const resolved = preference === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    const root = document.documentElement;
    root.dataset.themePreference = preference;
    root.dataset.theme = resolved;
    root.classList.toggle("dark", resolved === "dark");
    root.style.colorScheme = resolved;
  } catch {}
})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("seaoil-theme")?.value;
  const initialPreference = isThemePreference(cookieTheme) ? cookieTheme : "system";

  return (
    <html lang="en" data-theme-preference={initialPreference} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider initialPreference={initialPreference}>
          {children}
          <ToastProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
