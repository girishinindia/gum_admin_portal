"use client";
/* ================================================================
   useKendoWidget — Generic hook for initializing any Kendo widget
   Handles lifecycle: init on mount, destroy on unmount
   ================================================================ */
import { useEffect, useRef, useCallback } from "react";

interface UseKendoWidgetOptions {
  /** Kendo widget name, e.g., "kendoGrid", "kendoTreeView" */
  widgetName: string;
  /** Widget configuration options */
  options: Record<string, unknown>;
  /** Dependencies that trigger re-initialization */
  deps?: unknown[];
}

export function useKendoWidget<T = unknown>({
  widgetName,
  options,
  deps = [],
}: UseKendoWidgetOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<T | null>(null);

  const destroy = useCallback(() => {
    if (ref.current && typeof window !== "undefined" && window.jQuery) {
      const $el = (window.jQuery as unknown as JQueryStatic)(ref.current);
      const widget = $el.data(widgetName.replace("kendo", "kendo"));
      if (widget && typeof widget.destroy === "function") {
        widget.destroy();
      }
      $el.empty();
      widgetRef.current = null;
    }
  }, [widgetName]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.jQuery ||
      !window.kendo ||
      !ref.current
    ) {
      return;
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (!ref.current) return;

      const $el = (window.jQuery as unknown as JQueryStatic)(ref.current);
      const initFn = ($el as unknown as Record<string, unknown>)[widgetName];

      if (typeof initFn === "function") {
        initFn.call($el, options);
        widgetRef.current = $el.data(
          widgetName.replace("kendo", "kendo")
        ) as T;
      }
    }, 50);

    return () => {
      clearTimeout(timer);
      destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetName, ...deps]);

  return { ref, widget: widgetRef, destroy };
}
