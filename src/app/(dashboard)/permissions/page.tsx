"use client";
/* ================================================================
   Permissions List Page — Grouped by module with search & filters
   ================================================================ */
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchPermissions, deletePermission, restorePermission } from "@/services/permissionService";
import { fetchModules } from "@/services/moduleService";
import { toast } from "@/store/toastStore";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Permission, Module } from "@/types";

type SortDir = "ASC" | "DESC";

function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState<SortDir>("ASC");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;

  const [deleteTarget, setDeleteTarget] = useState<Permission | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Permission | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load modules for filter dropdown
  useEffect(() => {
    fetchModules({ limit: 100, sortBy: "name", sortDir: "ASC" })
      .then((res) => setModules(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const loadPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = { page, limit, search, sortBy, sortDir };
      if (moduleFilter !== "all") filters.moduleId = Number(moduleFilter);
      if (scopeFilter !== "all") filters.scope = scopeFilter;

      const res = await fetchPermissions(filters as Parameters<typeof fetchPermissions>[0]);
      setPermissions(Array.isArray(res?.data) ? res.data : []);
      setTotalCount(res?.pagination?.totalCount ?? 0);
    } catch {
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortDir, moduleFilter, scopeFilter]);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  // Module lookup
  const moduleMap = useMemo(() => {
    const m: Record<number, Module> = {};
    modules.forEach((mod) => { m[mod.id] = mod; });
    return m;
  }, [modules]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    else { setSortBy(col); setSortDir("ASC"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => (
    <i className={`fa-solid ${sortBy === col ? (sortDir === "ASC" ? "fa-sort-up" : "fa-sort-down") : "fa-sort"}`}
      style={{ marginLeft: 4, fontSize: 10, opacity: sortBy === col ? 1 : 0.3 }} />
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deletePermission(deleteTarget.id);
      toast.success("Permission deleted");
      setDeleteTarget(null);
      loadPermissions();
    } catch { toast.error("Failed to delete permission"); }
    finally { setActionLoading(false); }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await restorePermission(restoreTarget.id);
      toast.success("Permission restored");
      setRestoreTarget(null);
      loadPermissions();
    } catch { toast.error("Failed to restore permission"); }
    finally { setActionLoading(false); }
  };

  const totalPages = Math.ceil(totalCount / limit);

  const scopeColors: Record<string, { bg: string; text: string }> = {
    global: { bg: "#4A90D915", text: "#4A90D9" },
    own: { bg: "#F59E0B15", text: "#D97706" },
    assigned: { bg: "#8B5CF615", text: "#7C3AED" },
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Permissions</h1>
        <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>View and manage all system permissions grouped by module</p>
      </div>

      {/* Filters */}
      <div className="gum-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <i className="fa-solid fa-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--gum-text-muted)" }} />
            <input type="text" placeholder="Search permissions..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: "100%", height: 38, padding: "0 12px 0 36px", background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, color: "var(--gum-text)" }} />
          </div>
          <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
            style={{ height: 38, padding: "0 12px", background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, color: "var(--gum-text)" }}>
            <option value="all">All Modules</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={scopeFilter} onChange={(e) => { setScopeFilter(e.target.value); setPage(1); }}
            style={{ height: 38, padding: "0 12px", background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, color: "var(--gum-text)" }}>
            <option value="all">All Scopes</option>
            <option value="global">Global</option>
            <option value="own">Own</option>
            <option value="assigned">Assigned</option>
          </select>
          <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>{totalCount} permission{totalCount !== 1 ? "s" : ""}</span>
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
                  { key: "name", label: "Permission" },
                  { key: "code", label: "Code" },
                  { key: "moduleId", label: "Module" },
                  { key: "resource", label: "Resource" },
                  { key: "action", label: "Action", w: 100 },
                  { key: "scope", label: "Scope", w: 100 },
                  { key: "isActive", label: "Status", w: 90 },
                ].map(({ key, label, w }) => (
                  <th key={key} onClick={() => handleSort(key)}
                    style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--gum-text-muted)", cursor: "pointer", width: w, whiteSpace: "nowrap" }}>
                    {label}<SortIcon col={key} />
                  </th>
                ))}
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "var(--gum-text-muted)", width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading...
                </td></tr>
              ) : permissions.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>No permissions found</td></tr>
              ) : permissions.map((perm) => {
                const mod = moduleMap[perm.moduleId];
                const sc = scopeColors[perm.scope] || scopeColors.global;
                return (
                  <tr key={perm.id} style={{ borderBottom: "1px solid var(--gum-border)" }}>
                    <td style={cellStyle}>{perm.id}</td>
                    <td style={cellStyle}>
                      <span style={{ fontWeight: 500, color: "var(--gum-text)" }}>{perm.name}</span>
                      {perm.description && <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 2 }}>{perm.description}</p>}
                    </td>
                    <td style={cellStyle}>
                      <code style={{ fontSize: 11, background: "var(--gum-bg)", padding: "2px 8px", borderRadius: 4, color: "var(--gum-text-muted)" }}>{perm.code}</code>
                    </td>
                    <td style={cellStyle}>
                      {mod ? (
                        <span style={{ fontSize: 12, background: "var(--gum-bg)", padding: "3px 8px", borderRadius: 6, fontWeight: 500 }}>
                          {mod.name}
                        </span>
                      ) : <span style={{ color: "var(--gum-text-muted)", fontSize: 12 }}>#{perm.moduleId}</span>}
                    </td>
                    <td style={cellStyle}>
                      <code style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>{perm.resource}</code>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ fontSize: 11, fontWeight: 500, textTransform: "capitalize" }}>{perm.action}</span>
                    </td>
                    <td style={cellStyle}>
                      <span style={{ fontSize: 11, background: sc.bg, color: sc.text, padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>
                        {perm.scope}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <StatusBadge
                        variant={perm.isDeleted ? "deleted" : perm.isActive ? "active" : "inactive"}
                        label={perm.isDeleted ? "Deleted" : perm.isActive ? "Active" : "Inactive"}
                        icon={perm.isDeleted ? "fa-trash" : perm.isActive ? "fa-check-circle" : "fa-times-circle"}
                      />
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {perm.isDeleted ? (
                          <button onClick={() => setRestoreTarget(perm)}
                            style={actionBtnStyle("#198754")} title="Restore">
                            <i className="fa-solid fa-rotate-left" />
                          </button>
                        ) : (
                          <button onClick={() => setDeleteTarget(perm)}
                            style={actionBtnStyle("#DC3545")} title="Delete">
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--gum-border)" }}>
            <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>Page {page} of {totalPages} ({totalCount} total)</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtn(page === 1)}>
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={paginationBtn(page === totalPages)}>
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog open={!!deleteTarget} title="Delete Permission"
        message={`Delete permission "${deleteTarget?.name}" (${deleteTarget?.code})?`}
        confirmLabel="Delete" variant="danger" isLoading={actionLoading}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!restoreTarget} title="Restore Permission"
        message={`Restore permission "${restoreTarget?.name}"?`}
        confirmLabel="Restore" variant="primary" isLoading={actionLoading}
        onConfirm={handleRestore} onCancel={() => setRestoreTarget(null)} />
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: "10px 16px", color: "var(--gum-text)" };

const actionBtnStyle = (color: string): React.CSSProperties => ({
  width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 6, border: "1px solid var(--gum-border)", color, background: "transparent",
  cursor: "pointer", fontSize: 12,
});

const paginationBtn = (disabled: boolean): React.CSSProperties => ({
  width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 6, border: "1px solid var(--gum-border)", background: "var(--gum-surface)",
  color: disabled ? "var(--gum-text-muted)" : "var(--gum-text)", cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1, fontSize: 12,
});

export default withPermission(PermissionsPage, PERMISSIONS.PERMISSION_MANAGE);
