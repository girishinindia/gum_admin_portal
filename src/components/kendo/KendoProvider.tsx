"use client";
/* ================================================================
   Kendo UI Provider — Loads jQuery + Kendo JS + Theme CSS
   Wraps the app to ensure Kendo is available in all child components
   ================================================================ */
import { useEffect, useState, type ReactNode } from "react";
import Script from "next/script";
import { useTheme } from "next-themes";

interface KendoProviderProps {
  children: ReactNode;
}

export default function KendoProvider({ children }: KendoProviderProps) {
  const [_isReady, setIsReady] = useState(false);
  const { resolvedTheme } = useTheme();

  const kendoTheme =
    resolvedTheme === "dark"
      ? "/kendo/styles/bootstrap-main-dark.css"
      : "/kendo/styles/bootstrap-main.css";

  useEffect(() => {
    // Check if jQuery and kendo are already loaded
    if (typeof window !== "undefined" && window.jQuery && window.kendo) {
      setIsReady(true);
    }
  }, []);

  return (
    <>
      {/* Kendo Theme CSS — swaps based on dark/light mode */}
      <link rel="stylesheet" href={kendoTheme} id="kendo-theme" />

      {/* jQuery (required by Kendo UI) */}
      <Script
        src="https://code.jquery.com/jquery-3.7.1.min.js"
        strategy="beforeInteractive"
        onLoad={() => {
          // jQuery loaded, now check if Kendo is also ready
          if (typeof window !== "undefined" && window.kendo) {
            setIsReady(true);
          }
        }}
      />

      {/* Kendo UI All-in-One */}
      <Script
        src="/kendo/js/kendo.all.min.js"
        strategy="afterInteractive"
        onLoad={() => setIsReady(true)}
      />

      {children}
    </>
  );
}

// ─── Type augmentation for window ────────────────────────────
declare global {
  interface Window {
    jQuery: typeof import("jquery");
    $: typeof import("jquery");
    kendo: Record<string, unknown>;
  }
}
