/* ================================================================
   Role Service — API calls for Roles CRUD
   ================================================================ */
import api from "@/lib/axios";
import { normalizePaginatedResponse } from "@/lib/apiNormalizer";
import type {
  ApiResponse,
  PaginatedResponse,
  Role,
  RoleFilters,
} from "@/types";

// ─── List Roles (paginated + filters) ────────────────────────
export async function fetchRoles(
  filters: RoleFilters = {}
): Promise<PaginatedResponse<Role>> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.isActive !== undefined) params.set("isActive", String(filters.isActive));
  if (filters.level !== undefined) params.set("level", String(filters.level));
  if (filters.parentRoleId !== undefined) params.set("parentRoleId", String(filters.parentRoleId));
  if (filters.isSystem !== undefined) params.set("isSystemRole", String(filters.isSystem));

  const { data } = await api.get(`/roles?${params.toString()}`);
  return normalizePaginatedResponse<Role>(data as Record<string, unknown>, "roles");
}

// ─── Get Role by ID ──────────────────────────────────────────
export async function fetchRoleById(id: number): Promise<ApiResponse<Role>> {
  const { data } = await api.get<ApiResponse<Role>>(`/roles/${id}`);
  return data;
}

// ─── Create Role ─────────────────────────────────────────────
export interface CreateRoleRequest {
  name: string;
  code: string;
  description?: string;
  parentRoleId?: number;
  level?: number;
  isSystemRole?: boolean;
  displayOrder?: number;
  icon?: string;
  color?: string;
  isActive?: boolean;
}

export async function createRole(
  payload: CreateRoleRequest
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post<ApiResponse<{ id: number }>>(
    "/roles",
    payload
  );
  return data;
}

// ─── Update Role ─────────────────────────────────────────────
export async function updateRole(
  id: number,
  payload: Partial<Omit<CreateRoleRequest, "isSystemRole">>
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/roles/${id}`,
    payload
  );
  return data;
}

// ─── Delete Role (soft-delete) ───────────────────────────────
export async function deleteRole(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.delete<ApiResponse<null>>(`/roles/${id}`);
  return data;
}

// ─── Restore Role ────────────────────────────────────────────
export async function restoreRole(
  id: number,
  restorePermissions?: boolean
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/roles/${id}/restore`,
    restorePermissions !== undefined ? { restorePermissions } : undefined
  );
  return data;
}
