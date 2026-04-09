"use client";
/* ================================================================
   useAuthInit — Initializes auth state on app load
   Runs once in the root layout, tries to restore an existing
   session from the stored refresh token.
   ================================================================ */
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";

export function useAuthInit() {
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Run exactly once per app mount
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    initializeAuth();
  }, [initializeAuth]);
}
