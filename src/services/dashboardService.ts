/* ================================================================
   Dashboard Service — Aggregates KPI data from existing endpoints
   No dedicated analytics endpoint exists; we compose from CRUD APIs
   ================================================================ */
import api from "@/lib/axios";
import { fetchUsers } from "@/services/userService";
import { fetchRoles } from "@/services/roleService";
import { fetchPermissions } from "@/services/permissionService";
import { fetchAuditLogs } from "@/services/auditLogService";
import { fetchModules } from "@/services/moduleService";
import { fetchUserRoleAssignments } from "@/services/userRoleAssignmentService";
import type { HealthCheck, RoleChangeLog } from "@/types";

// ─── KPI Stats ───────────────────────────────────────────────
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalRoles: number;
  activeRoles: number;
  totalPermissions: number;
  totalModules: number;
  auditEventsToday: number;
  totalAssignments: number;
}

// Small delay helper to avoid rate-limiting
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchDashboardStats(): Promise<DashboardStats> {
  // Sequential requests with delays to stay within API rate limits
  // Each call is made one at a time to avoid triggering 429s

  const usersRes = await fetchUsers({ page: 1, limit: 1 }).catch(() => null);
  await delay(500);

  const activeUsersRes = await fetchUsers({ page: 1, limit: 1, isActive: true }).catch(() => null);
  await delay(500);

  const rolesRes = await fetchRoles({ page: 1, limit: 1 }).catch(() => null);
  await delay(500);

  const permsRes = await fetchPermissions({ page: 1, limit: 1 }).catch(() => null);
  await delay(500);

  const modulesRes = await fetchModules({ page: 1, limit: 1 }).catch(() => null);
  await delay(500);

  const auditRes = await fetchAuditLogs({
    page: 1, limit: 1,
    dateFrom: todayISO(),
  }).catch(() => null);
  await delay(500);

  const assignmentsRes = await fetchUserRoleAssignments({ page: 1, limit: 1 }).catch(() => null);

  return {
    totalUsers: usersRes?.pagination?.totalCount ?? 0,
    activeUsers: activeUsersRes?.pagination?.totalCount ?? 0,
    totalRoles: rolesRes?.pagination?.totalCount ?? 0,
    activeRoles: rolesRes?.pagination?.totalCount ?? 0,
    totalPermissions: permsRes?.pagination?.totalCount ?? 0,
    totalModules: modulesRes?.pagination?.totalCount ?? 0,
    auditEventsToday: auditRes?.pagination?.totalCount ?? 0,
    totalAssignments: assignmentsRes?.pagination?.totalCount ?? 0,
  };
}

// ─── Recent Activity ─────────────────────────────────────────
export async function fetchRecentActivity(count = 10): Promise<RoleChangeLog[]> {
  try {
    const res = await fetchAuditLogs({
      page: 1,
      limit: count,
      sortBy: "created_at",
      sortDir: "DESC",
    });
    return Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
}

// ─── Health Check ────────────────────────────────────────────
export async function fetchHealthCheck(): Promise<HealthCheck> {
  const { data } = await api.get("/health");
  const raw = data as Record<string, unknown>;
  // Health endpoint may return { success, data: { ... } } or flat health object
  if (raw.data && typeof raw.data === "object") {
    return raw.data as HealthCheck;
  }
  return raw as unknown as HealthCheck;
}

// ─── Helper ──────────────────────────────────────────────────
function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  // Include timezone offset (e.g. +05:30) — API requires ISO with TZ
  const tzOffset = -d.getTimezoneOffset();
  const tzSign = tzOffset >= 0 ? "+" : "-";
  const tzH = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0");
  const tzM = String(Math.abs(tzOffset) % 60).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}T00:00:00${tzSign}${tzH}:${tzM}`;
}
