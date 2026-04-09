"use client";
/* ================================================================
   usePermission Hook — Check permissions in any component
   Usage: const canDelete = usePermission('user.delete');
   ================================================================ */
import { useAuthStore } from "@/store/authStore";

/**
 * Check if the current user has a specific permission
 */
export function usePermission(code: string): boolean {
  return useAuthStore((s) => s.hasPermission(code));
}

/**
 * Check if the current user has any of the specified permissions
 */
export function useAnyPermission(codes: string[]): boolean {
  return useAuthStore((s) => s.hasAnyPermission(codes));
}

/**
 * Check if the current user has all of the specified permissions
 */
export function useAllPermissions(codes: string[]): boolean {
  return useAuthStore((s) => s.hasAllPermissions(codes));
}

/**
 * Get the current user's role codes
 */
export function useUserRoles(): string[] {
  return useAuthStore((s) => {
    const uniqueRoles = new Set(s.permissions.map((p) => p.roleCode));
    return Array.from(uniqueRoles);
  });
}
