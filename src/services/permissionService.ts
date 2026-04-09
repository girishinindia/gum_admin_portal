/* ================================================================
   Permission Service — API calls for Permissions CRUD
   ================================================================ */
import api from "@/lib/axios";
import { normalizePaginatedResponse } from "@/lib/apiNormalizer";
import type {
  ApiResponse,
  PaginatedResponse,
  Permission,
  PermissionFilters,
} from "@/types";

// ─── List Permissions (paginated + filters) ──────────────────
export async function fetchPermissions(
  filters: PermissionFilters = {}
): Promise<PaginatedResponse<Permission>> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.isActive !== undefined) params.set("isActive", String(filters.isActive));
  if (filters.moduleId !== undefined) params.set("moduleId", String(filters.moduleId));
  if (filters.moduleCode) params.set("moduleCode", filters.moduleCode);
  if (filters.resource) params.set("resource", filters.resource);
  if (filters.action) params.set("action", filters.action);
  if (filters.scope) params.set("scope", filters.scope);

  const { data } = await api.get(`/permissions?${params.toString()}`);
  return normalizePaginatedResponse<Permission>(data as Record<string, unknown>, "permissions");
}

// ─── Get Permission by ID ────────────────────────────────────
export async function fetchPermissionById(id: number): Promise<ApiResponse<Permission>> {
  const { data } = await api.get<ApiResponse<Permission>>(`/permissions/${id}`);
  return data;
}

// ─── Create Permission ──────────────────────────────────────
export interface CreatePermissionRequest {
  moduleId: number;
  name: string;
  code: string;
  resource: string;
  action: string;
  scope?: "global" | "own" | "assigned";
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export async function createPermission(
  payload: CreatePermissionRequest
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post<ApiResponse<{ id: number }>>(
    "/permissions",
    payload
  );
  return data;
}

// ─── Update Permission ──────────────────────────────────────
export async function updatePermission(
  id: number,
  payload: Partial<Omit<CreatePermissionRequest, "moduleId">>
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/permissions/${id}`,
    payload
  );
  return data;
}

// ─── Delete Permission (soft-delete) ─────────────────────────
export async function deletePermission(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.delete<ApiResponse<null>>(`/permissions/${id}`);
  return data;
}

// ─── Restore Permission ──────────────────────────────────────
export async function restorePermission(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/permissions/${id}/restore`
  );
  return data;
}
