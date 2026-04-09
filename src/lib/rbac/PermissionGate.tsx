"use client";
/* ================================================================
   PermissionGate — Conditionally render children based on permissions
   Usage: <PermissionGate permission="user.delete"><DeleteButton /></PermissionGate>
   ================================================================ */
import type { ReactNode } from "react";
import { useAuthStore } from "@/store/authStore";

interface PermissionGateProps {
  /** Single permission code to check */
  permission?: string;
  /** Multiple permission codes — user needs ANY of these */
  anyOf?: string[];
  /** Multiple permission codes — user needs ALL of these */
  allOf?: string[];
  /** What to render if permission is denied */
  fallback?: ReactNode;
  /** Children to render if permission is granted */
  children: ReactNode;
}

export default function PermissionGate({
  permission,
  anyOf,
  allOf,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = useAuthStore();

  let allowed = false;

  if (permission) {
    allowed = hasPermission(permission);
  } else if (anyOf && anyOf.length > 0) {
    allowed = hasAnyPermission(anyOf);
  } else if (allOf && allOf.length > 0) {
    allowed = hasAllPermissions(allOf);
  } else {
    // No permission specified — always show
    allowed = true;
  }

  return allowed ? <>{children}</> : <>{fallback}</>;
}
