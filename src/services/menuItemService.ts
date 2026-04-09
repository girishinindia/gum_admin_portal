/* ================================================================
   Menu Item Service — API calls for Menu Items CRUD
   ================================================================ */
import api from "@/lib/axios";
import { normalizePaginatedResponse } from "@/lib/apiNormalizer";
import type {
  ApiResponse,
  PaginatedResponse,
  MenuItem,
} from "@/types";

// ─── Extended response row (list endpoint returns extra fields) ─
export interface MenuItemRow {
  id: number;
  name: string;
  code: string;
  description: string | null;
  route: string | null;
  icon: string | null;
  parentId: number | null;
  parentName: string | null;
  permissionId: number | null;
  permissionCode: string | null;
  displayOrder: number;
  isVisible: boolean;
  isActive: boolean;
  isDeleted?: boolean;
  createdAt?: string;
}

export interface MenuItemFilters {
  page?: number;
  limit?: number;
  id?: number;
  code?: string;
  parentId?: number;
  topLevelOnly?: boolean;
  isActive?: boolean;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
}

// ─── List Menu Items (paginated + filters) ───────────────────
export async function fetchMenuItems(
  filters: MenuItemFilters = {}
): Promise<PaginatedResponse<MenuItemRow>> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.id !== undefined) params.set("id", String(filters.id));
  if (filters.code) params.set("code", filters.code);
  if (filters.parentId !== undefined) params.set("parentId", String(filters.parentId));
  if (filters.topLevelOnly !== undefined) params.set("topLevelOnly", String(filters.topLevelOnly));
  if (filters.isActive !== undefined) params.set("isActive", String(filters.isActive));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);

  const { data } = await api.get(`/menu-items?${params.toString()}`);
  return normalizePaginatedResponse<MenuItemRow>(data as Record<string, unknown>, "menuItems");
}

// ─── Get Menu Item by ID ─────────────────────────────────────
export async function fetchMenuItemById(
  id: number
): Promise<ApiResponse<MenuItemRow>> {
  const { data } = await api.get<ApiResponse<MenuItemRow>>(
    `/menu-items/${id}`
  );
  return data;
}

// ─── Get Current User Menu ───────────────────────────────────
export async function fetchMyMenu(): Promise<ApiResponse<MenuItem[]>> {
  const { data } = await api.get<ApiResponse<MenuItem[]>>("/menu-items/me");
  return data;
}

// ─── Create Menu Item ────────────────────────────────────────
export interface CreateMenuItemRequest {
  name: string;
  code: string;
  route?: string;
  icon?: string;
  description?: string;
  parentMenuId?: number;
  permissionId?: number;
  displayOrder?: number;
  isVisible?: boolean;
  isActive?: boolean;
}

export async function createMenuItem(
  payload: CreateMenuItemRequest
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post<ApiResponse<{ id: number }>>(
    "/menu-items",
    payload
  );
  return data;
}

// ─── Update Menu Item ────────────────────────────────────────
export async function updateMenuItem(
  id: number,
  payload: Partial<CreateMenuItemRequest>
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/menu-items/${id}`,
    payload
  );
  return data;
}

// ─── Delete Menu Item (soft-delete, cascades to children) ────
export async function deleteMenuItem(
  id: number
): Promise<ApiResponse<null>> {
  const { data } = await api.delete<ApiResponse<null>>(
    `/menu-items/${id}`
  );
  return data;
}

// ─── Restore Menu Item ───────────────────────────────────────
export async function restoreMenuItem(
  id: number,
  restoreChildren?: boolean
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.patch<ApiResponse<{ id: number }>>(
    `/menu-items/${id}/restore`,
    restoreChildren !== undefined ? { restoreChildren } : undefined
  );
  return data;
}
