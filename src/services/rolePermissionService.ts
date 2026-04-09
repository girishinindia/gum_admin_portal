/* ================================================================
   Role-Permission Service — API calls for role↔permission mapping
   ================================================================ */
import api from "@/lib/axios";
import { normalizePaginatedResponse } from "@/lib/apiNormalizer";
import type {
  ApiResponse,
  PaginatedResponse,
  RolePermission,
  UserPermission,
} from "@/types";

export interface RolePermissionFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
  roleId?: number;
  roleCode?: string;
  permissionId?: number;
  moduleCode?: string;
  action?: string;
  scope?: string;
}

// ─── List Role Permissions ───────────────────────────────────
export async function fetchRolePermissions(
  filters: RolePermissionFilters = {}
): Promise<PaginatedResponse<RolePermission>> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.roleId !== undefined) params.set("roleId", String(filters.roleId));
  if (filters.roleCode) params.set("roleCode", filters.roleCode);
  if (filters.permissionId !== undefined) params.set("permissionId", String(filters.permissionId));
  if (filters.moduleCode) params.set("moduleCode", filters.moduleCode);
  if (filters.action) params.set("action", filters.action);
  if (filters.scope) params.set("scope", filters.scope);

  const { data } = await api.get(`/role-permissions?${params.toString()}`);
  return normalizePaginatedResponse<RolePermission>(data as Record<string, unknown>, "rolePermissions");
}

// ─── Get User's Permissions ──────────────────────────────────
export async function fetchUserPermissions(
  userId: number
): Promise<ApiResponse<UserPermission[]>> {
  const { data } = await api.get<ApiResponse<UserPermission[]>>(
    `/role-permissions/user/${userId}`
  );
  return data;
}

// ─── Assign Permission to Role ───────────────────────────────
export async function assignPermissionToRole(
  roleId: number,
  permissionId: number
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post<ApiResponse<{ id: number }>>(
    "/role-permissions/assign",
    { roleId, permissionId }
  );
  return data;
}

// ─── Bulk Assign Permissions to Role ─────────────────────────
export async function bulkAssignPermissions(
  roleId: number,
  permissionIds: number[]
): Promise<ApiResponse<null>> {
  const { data } = await api.post<ApiResponse<null>>(
    "/role-permissions/bulk-assign",
    { roleId, permissionIds }
  );
  return data;
}

// ─── Remove Permission from Role ─────────────────────────────
export async function removePermissionFromRole(
  roleId: number,
  permissionId: number
): Promise<ApiResponse<null>> {
  const { data } = await api.post<ApiResponse<null>>(
    "/role-permissions/remove",
    { roleId, permissionId }
  );
  return data;
}

// ─── Remove All Permissions from Role ────────────────────────
export async function removeAllPermissionsFromRole(
  roleId: number
): Promise<ApiResponse<null>> {
  const { data } = await api.delete<ApiResponse<null>>(
    `/role-permissions/role/${roleId}`
  );
  return data;
}

// ─── Replace All Permissions for Role ────────────────────────
export async function replaceRolePermissions(
  roleId: number,
  permissionIds: number[]
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    "/role-permissions/replace",
    { roleId, permissionIds }
  );
  return data;
}
