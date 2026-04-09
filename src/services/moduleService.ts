/* ================================================================
   Module Service — API calls for Modules CRUD
   ================================================================ */
import api from "@/lib/axios";
import { normalizePaginatedResponse } from "@/lib/apiNormalizer";
import type {
  ApiResponse,
  PaginatedResponse,
  Module,
} from "@/types";

export interface ModuleFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
  isActive?: boolean;
}

// ─── List Modules (paginated + filters) ──────────────────────
export async function fetchModules(
  filters: ModuleFilters = {}
): Promise<PaginatedResponse<Module>> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.isActive !== undefined) params.set("isActive", String(filters.isActive));

  const { data } = await api.get(`/modules?${params.toString()}`);
  return normalizePaginatedResponse<Module>(data as Record<string, unknown>, "modules");
}

// ─── Get Module by ID ────────────────────────────────────────
export async function fetchModuleById(id: number): Promise<ApiResponse<Module>> {
  const { data } = await api.get<ApiResponse<Module>>(`/modules/${id}`);
  return data;
}

// ─── Create Module ───────────────────────────────────────────
export interface CreateModuleRequest {
  name: string;
  code: string;
  description?: string;
  displayOrder?: number;
  icon?: string;
  color?: string;
  isActive?: boolean;
}

export async function createModule(
  payload: CreateModuleRequest
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post<ApiResponse<{ id: number }>>(
    "/modules",
    payload
  );
  return data;
}

// ─── Update Module ───────────────────────────────────────────
export async function updateModule(
  id: number,
  payload: Partial<CreateModuleRequest>
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/modules/${id}`,
    payload
  );
  return data;
}

// ─── Delete Module (soft-delete) ─────────────────────────────
export async function deleteModule(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.delete<ApiResponse<null>>(`/modules/${id}`);
  return data;
}

// ─── Restore Module ──────────────────────────────────────────
export async function restoreModule(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/modules/${id}/restore`
  );
  return data;
}
