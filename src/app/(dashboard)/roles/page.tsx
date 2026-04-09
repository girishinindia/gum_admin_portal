"use client";
/* ================================================================
   Roles List Page — Paginated table with search, filters, CRUD
   ================================================================ */
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { fetchRoles, deleteRole, restoreRole } from "@/services/roleService";
import { toast } from "@/store/toastStore";
import { withPermission } from "@/lib/rbac/withPermission";
import PermissionGate from "@/lib/rbac/PermissionGate";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Role } from "@/types";

type SortDir = "ASC" | "DESC";

function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState<SortDir>("ASC");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Confirm dialogs
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Role | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = { page, limit, search, sortBy, sortDir };
      if (statusFilter === "active") filters.isActive = true;
      else if (statusFilter === "inactive") filters.isActive = false;
      else if (statusFilter === "system") filters.isSystem = true;

      const res = await fetchRoles(filters as Parameters<typeof fetchRoles>[0]);
      setRoles(Array.isArray(res?.data) ? res.data : []);
      setTotalCount(res?.pagination?.totalCount ?? 0);
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortDir, statusFilter]);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  // ─── Sort handler ─────────────────────────────────────────
  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    else { setSortBy(col); setSortDir("ASC"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => (
    <i className={`fa-solid ${sortBy === col ? (sortDir === "ASC" ? "fa-sort-up" : "fa-sort-down") : "fa-sort"}`}
      style={{ marginLeft: 4, fontSize: 10, opacity: sortBy === col ? 1 : 0.3 }} />
  );

  // ─── Delete / Restore ─────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteRole(deleteTarget.id);
      toast.success("Role deleted");
      setDeleteTarget(null);
      loadRoles();
    } catch {
      toast.error("Failed to delete role");
    } finally { setActionLoading(false); }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await restoreRole(restoreTarget.id, true);
      toast.success("Role restored");
      setRestoreTarget(null);
      loadRoles();
    } catch {
      toast.error("Failed to restore role");
    } finally { setActionLoading(false); }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Roles</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>Manage system roles and access levels</p>
        </div>
        <PermissionGate permission={PERMISSIONS.ROLE_CREATE}>
          <Link href="/roles/create" style={{
            height: 38, padding: "0 18px", background: "var(--gum-primary)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
          }}>
            <i className="fa-solid fa-plus" /> Add Role
          </Link>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="gum-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <i className="fa-solid fa-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--gum-text-muted)" }} />
            <input
              type="text" placeholder="Search roles..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: "100%", height: 38, padding: "0 12px 0 36px",
                background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)",
                borderRadius: 8, fontSize: 13, color: "var(--gum-text)",
              }}
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              height: 38, padding: "0 12px", background: "var(--gum-input-bg)",
              border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, color: "var(--gum-text)",
            }}>
            <option value="all">All Roles</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="system">System Roles</option>
          </select>
          <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>
            {totalCount} role{totalCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="gum-card">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--gum-border)" }}>
                {[
                  { key: "id", label: "ID", w: 60 },
                  { key: "name", label: "Name" },
                  { key: "code", label: "Code" },
                  { key: "level", label: "Level", w: 80 },
                  { key: "isSystemRole", label: "System", w: 90 },
                  { key: "isActive", label: "Status", w: 100 },
                  { key: "displayOrder", label: "Order", w: 80 },
                ].map(({ key, label, w }) => (
                  <th key={key} onClick={() => handleSort(key)}
                    style={{
                      padding: "12px 16px", textAlign: "left", fontWeight: 600,
                      color: "var(--gum-text-muted)", cursor: "pointer",
                      width: w, whiteSpace: "nowrap",
                    }}>
                    {label}<SortIcon col={key} />
                  </th>
                ))}
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--gum-text-muted)", width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading...
                </td></tr>
              ) : roles.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>No roles found</td></tr>
              ) : roles.map((role) => (
                <tr key={role.id} style={{ borderBottom: "1px solid var(--gum-border)" }}>
                  <td style={cellStyle}>{role.id}</td>
                  <td style={cellStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {role.icon && <i className={`fa-solid ${role.icon}`} style={{ color: role.color || "var(--gum-primary)", fontSize: 14 }} />}
                      <span style={{ fontWeight: 500, color: "var(--gum-text)" }}>{role.name}</span>
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <code style={{ fontSize: 12, background: "var(--gum-bg)", padding: "2px 8px", borderRadius: 4, color: "var(--gum-text-muted)" }}>
                      {role.code}
                    </code>
                  </td>
                  <td style={cellStyle}>{role.level}</td>
                  <td style={cellStyle}>
                    {role.isSystemRole
                      ? <span style={{ fontSize: 11, background: "#6366F115", color: "#6366F1", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>System</span>
                      : <span style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>Custom</span>}
                  </td>
                  <td style={cellStyle}>
                    <StatusBadge
                      variant={role.isDeleted ? "deleted" : role.isActive ? "active" : "inactive"}
                      label={role.isDeleted ? "Deleted" : role.isActive ? "Active" : "Inactive"}
                      icon={role.isDeleted ? "fa-trash" : role.isActive ? "fa-check-circle" : "fa-times-circle"}
                    />
                  </td>
                  <td style={cellStyle}>{role.displayOrder}</td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <PermissionGate permission={PERMISSIONS.ROLE_UPDATE}>
                        <Link href={`/roles/${role.id}/edit`}
                          style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--gum-border)", color: "var(--gum-primary)", background: "transparent", textDecoration: "none", fontSize: 12 }}>
                          <i className="fa-solid fa-pen" />
                        </Link>
                      </PermissionGate>
                      {role.isDeleted ? (
                        <PermissionGate permission={PERMISSIONS.ROLE_RESTORE}>
                          <button onClick={() => setRestoreTarget(role)}
                            style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--gum-border)", color: "#198754", background: "transparent", cursor: "pointer", fontSize: 12 }}>
                            <i className="fa-solid fa-rotate-left" />
                          </button>
                        </PermissionGate>
                      ) : (
                        <PermissionGate permission={PERMISSIONS.ROLE_DELETE}>
                          <button onClick={() => setDeleteTarget(role)}
                            style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--gum-border)", color: "#DC3545", background: "transparent", cursor: "pointer", fontSize: 12 }}>
                            <i className="fa-solid fa-trash" />
                          </button>
                        </PermissionGate>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--gum-border)" }}>
            <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>
              Page {page} of {totalPages} ({totalCount} total)
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                style={paginationBtn(page === 1)}>
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={paginationBtn(page === totalPages)}>
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog open={!!deleteTarget} title="Delete Role"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This is a soft-delete and can be restored.`}
        confirmLabel="Delete" variant="danger" isLoading={actionLoading}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!restoreTarget} title="Restore Role"
        message={`Restore "${restoreTarget?.name}" and its associated permissions?`}
        confirmLabel="Restore" variant="primary" isLoading={actionLoading}
        onConfirm={handleRestore} onCancel={() => setRestoreTarget(null)} />
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: "10px 16px", color: "var(--gum-text)" };

const paginationBtn = (disabled: boolean): React.CSSProperties => ({
  width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 6, border: "1px solid var(--gum-border)", background: "var(--gum-surface)",
  color: disabled ? "var(--gum-text-muted)" : "var(--gum-text)", cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1, fontSize: 12,
});

export default withPermission(RolesPage, PERMISSIONS.ROLE_READ);
