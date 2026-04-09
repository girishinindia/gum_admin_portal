/* ================================================================
   Audit Log Service — API calls for Role Change Log (read-only)
   The audit log is append-only; no update/delete/restore.
   ================================================================ */
import api from "@/lib/axios";
import { normalizePaginatedResponse } from "@/lib/apiNormalizer";
import type {
  ApiResponse,
  PaginatedResponse,
  RoleChangeLog,
} from "@/types";

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  id?: number;
  userId?: number;
  roleId?: number;
  action?: string;
  contextType?: string;
  changedBy?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
}

// ─── List Audit Log Entries (paginated + filters) ────────────
export async function fetchAuditLogs(
  filters: AuditLogFilters = {}
): Promise<PaginatedResponse<RoleChangeLog>> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.id !== undefined) params.set("id", String(filters.id));
  if (filters.userId !== undefined) params.set("userId", String(filters.userId));
  if (filters.roleId !== undefined) params.set("roleId", String(filters.roleId));
  if (filters.action) params.set("action", filters.action);
  if (filters.contextType) params.set("contextType", filters.contextType);
  if (filters.changedBy !== undefined) params.set("changedBy", String(filters.changedBy));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.search) params.set("search", filters.search);
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortDir) params.set("sortDir", filters.sortDir);

  const { data } = await api.get(`/role-change-log?${params.toString()}`);
  return normalizePaginatedResponse<RoleChangeLog>(data as Record<string, unknown>, "roleChangeLogs");
}

// ─── Get Single Entry by ID ──────────────────────────────────
export async function fetchAuditLogById(
  id: number
): Promise<ApiResponse<RoleChangeLog>> {
  const { data } = await api.get<ApiResponse<RoleChangeLog>>(
    `/role-change-log/${id}`
  );
  return data;
}
