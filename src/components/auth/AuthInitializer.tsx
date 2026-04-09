"use client";
/* ================================================================
   AuthInitializer — Client component that initializes auth state
   Placed inside root layout, runs useAuthInit on app mount
   ================================================================ */
import { useAuthInit } from "@/hooks/useAuthInit";

export default function AuthInitializer() {
  useAuthInit();
  return null; // Renders nothing — side-effect only
}
