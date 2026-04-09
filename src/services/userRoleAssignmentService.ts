/* ================================================================
   User-Role Assignment Service — API calls for user↔role mapping
   ================================================================ */
import api from "@/lib/axios";
import { normalizePaginatedResponse } from "@/lib/apiNormalizer";
import type {
  ApiResponse,
  PaginatedResponse,
} from "@/types";

// ─── Extended Assignment Type (matches API response) ─────────
export interface UserRoleAssignmentRow {
  id: number;
  userId: number;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  roleId: number;
  roleName: string;
  roleCode: string;
  roleLevel: number;
  contextType: string | null;
  contextId: number | null;
  assignedAt: string;
  expiresAt: string | null;
  reason: string | null;
  assignedBy: number | null;
  isActive: boolean;
  isCurrentlyValid: boolean;
  isDeleted?: boolean;
  createdAt: string;
}

export interface UserRoleAssignmentFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
  userId?: number;
  roleId?: number;
  roleCode?: string;
  contextType?: string;
  contextId?: number;
  isValid?: boolean;
}

// ─── List Assignments (paginated + filters) ──────────────────
export async function fetchUserRoleAssignments(
  filters: UserRoleAssignmentFilters = {}
): Promise<PaginatedResponse<UserRoleAssignmentRow>> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);
  if (filters.userId !== undefined) params.set("userId", String(filters.userId));
  if (filters.roleId !== undefined) params.set("roleId", String(filters.roleId));
  if (filters.roleCode) params.set("roleCode", filters.roleCode);
  if (filters.contextType) params.set("contextType", filters.contextType);
  if (filters.contextId !== undefined) params.set("contextId", String(filters.contextId));
  if (filters.isValid !== undefined) params.set("isValid", String(filters.isValid));

  const { data } = await api.get(`/user-role-assignments?${params.toString()}`);
  return normalizePaginatedResponse<UserRoleAssignmentRow>(data as Record<string, unknown>, "userRoleAssignments");
}

// ─── Get Assignment by ID ────────────────────────────────────
export async function fetchAssignmentById(
  id: number
): Promise<ApiResponse<UserRoleAssignmentRow>> {
  const { data } = await api.get<ApiResponse<UserRoleAssignmentRow>>(
    `/user-role-assignments/${id}`
  );
  return data;
}

// ─── Create Assignment ───────────────────────────────────────
export interface CreateAssignmentRequest {
  userId: number;
  roleId: number;
  contextType?: "course" | "batch" | "department" | "branch" | "internship";
  contextId?: number;
  expiresAt?: string;
  reason?: string;
}

export async function createAssignment(
  payload: CreateAssignmentRequest
): Promise<ApiResponse<{ id: number }>> {
  const { data } = await api.post<ApiResponse<{ id: number }>>(
    "/user-role-assignments",
    payload
  );
  return data;
}

// ─── Update Assignment ───────────────────────────────────────
export async function updateAssignment(
  id: number,
  payload: { expiresAt?: string | null; reason?: string | null; isActive?: boolean }
): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/user-role-assignments/${id}`,
    payload
  );
  return data;
}

// ─── Delete Assignment ───────────────────────────────────────
export async function deleteAssignment(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.delete<ApiResponse<null>>(
    `/user-role-assignments/${id}`
  );
  return data;
}

// ─── Restore Assignment ──────────────────────────────────────
export async function restoreAssignment(id: number): Promise<ApiResponse<null>> {
  const { data } = await api.patch<ApiResponse<null>>(
    `/user-role-assignments/${id}/restore`
  );
  return data;
}
