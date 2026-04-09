"use client";
/* ================================================================
   withPermission — Higher-Order Component for page-level protection

   Usage:
     function UsersPage() { return <div>Users</div>; }
     export default withPermission(UsersPage, "user.read");

     // With multiple permissions (any):
     export default withPermission(UsersPage, ["user.read", "user.create"]);
   ================================================================ */
import { type ComponentType } from "react";
import { useAuthStore } from "@/store/authStore";
import type { PermissionCode } from "./permissions";
import Forbidden from "@/components/ui/Forbidden";

interface WithPermissionOptions {
  /** Require ALL permissions instead of ANY (default: false = any) */
  requireAll?: boolean;
}

export function withPermission<P extends object>(
  WrappedComponent: ComponentType<P>,
  required: PermissionCode | PermissionCode[],
  options?: WithPermissionOptions
) {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  function PermissionWrapper(props: P) {
    const { hasPermission, hasAnyPermission, hasAllPermissions, isAuthenticated } =
      useAuthStore();

    // Not authenticated — the dashboard layout will redirect
    if (!isAuthenticated) return null;

    // Check permissions
    let allowed = false;

    if (Array.isArray(required)) {
      if (required.length === 0) {
        allowed = true; // No permissions required
      } else if (options?.requireAll) {
        allowed = hasAllPermissions(required);
      } else {
        allowed = hasAnyPermission(required);
      }
    } else {
      allowed = hasPermission(required);
    }

    if (!allowed) {
      return <Forbidden />;
    }

    return <WrappedComponent {...props} />;
  }

  PermissionWrapper.displayName = `withPermission(${displayName})`;

  return PermissionWrapper;
}
