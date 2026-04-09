"use client";
/* ================================================================
   User-Role Assignments Page — List, create, delete assignments
   ================================================================ */
import { useState, useEffect, useCallback } from "react";
import {
  fetchUserRoleAssignments,
  createAssignment,
  deleteAssignment,
  restoreAssignment,
  type UserRoleAssignmentRow,
  type CreateAssignmentRequest,
} from "@/services/userRoleAssignmentService";
import { fetchRoles } from "@/services/roleService";
import { toast } from "@/store/toastStore";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Role } from "@/types";

type SortDir = "ASC" | "DESC";

const CONTEXT_TYPES = ["course", "batch", "department", "branch", "internship"] as const;

function UserRoleAssignmentsPage() {
  const [assignments, setAssignments] = useState<UserRoleAssignmentRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState("id");
  const [sortDir, setSortDir] = useState<SortDir>("DESC");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const [deleteTarget, setDeleteTarget] = useState<UserRoleAssignmentRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<UserRoleAssignmentRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAssignmentRequest>({ userId: 0, roleId: 0 });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Load roles for filter and create form
  useEffect(() => {
    fetchRoles({ limit: 100, sortBy: "name", sortDir: "ASC" })
      .then((res) => {
        const rolesData = Array.isArray(res?.data) ? res.data : [];
        setRoles(rolesData.filter((r) => !r.isDeleted && r.isActive));
      })
      .catch(() => {});
  }, []);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = { page, limit, search, sortBy, sortDir };
      if (roleFilter !== "all") filters.roleId = Number(roleFilter);

      const res = await fetchUserRoleAssignments(filters as Parameters<typeof fetchUserRoleAssignments>[0]);
      setAssignments(Array.isArray(res?.data) ? res.data : []);
      setTotalCount(res?.pagination?.totalCount ?? 0);
    } catch {
      toast.error("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortDir, roleFilter]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    else { setSortBy(col); setSortDir("DESC"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => (
    <i className={`fa-solid ${sortBy === col ? (sortDir === "ASC" ? "fa-sort-up" : "fa-sort-down") : "fa-sort"}`}
      style={{ marginLeft: 4, fontSize: 10, opacity: sortBy === col ? 1 : 0.3 }} />
  );

  // ─── Create ───────────────────────────────────────────────
  const handleCreate = async () => {
    const errs: Record<string, string> = {};
    if (!createForm.userId || createForm.userId <= 0) errs.userId = "User ID is required";
    if (!createForm.roleId) errs.roleId = "Role is required";
    if (Object.keys(errs).length > 0) { setCreateErrors(errs); return; }

    setCreating(true);
    try {
      const payload: CreateAssignmentRequest = {
        userId: createForm.userId,
        roleId: createForm.roleId,
      };
      if (createForm.contextType) payload.contextType = createForm.contextType;
      if (createForm.contextId) payload.contextId = createForm.contextId;
      if (createForm.expiresAt) payload.expiresAt = createForm.expiresAt;
      if (createForm.reason) payload.reason = createForm.reason;

      await createAssignment(payload);
      toast.success("Role assigned", "User role assignment created successfully.");
      setShowCreateModal(false);
      setCreateForm({ userId: 0, roleId: 0 });
      setCreateErrors({});
      loadAssignments();
    } catch (err: unknown) {
      const msg = extractError(err);
      toast.error("Failed to create assignment", msg);
    } finally {
      setCreating(false);
    }
  };

  // ─── Delete / Restore ─────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteAssignment(deleteTarget.id);
      toast.success("Assignment deleted");
      setDeleteTarget(null);
      loadAssignments();
    } catch { toast.error("Failed to delete assignment"); }
    finally { setActionLoading(false); }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await restoreAssignment(restoreTarget.id);
      toast.success("Assignment restored");
      setRestoreTarget(null);
      loadAssignments();
    } catch { toast.error("Failed to restore assignment"); }
    finally { setActionLoading(false); }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>User Role Assignments</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>Manage which roles are assigned to users</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={{
          height: 38, padding: "0 18px", background: "var(--gum-primary)", color: "#fff",
          border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
        }}>
          <i className="fa-solid fa-plus" /> Assign Role
        </button>
      </div>

      {/* Filters */}
      <div className="gum-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <i className="fa-solid fa-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--gum-text-muted)" }} />
            <input type="text" placeholder="Search by user name or email..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: "100%", height: 38, padding: "0 12px 0 36px", background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, color: "var(--gum-text)" }} />
          </div>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            style={{ height: 38, padding: "0 12px", background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, color: "var(--gum-text)" }}>
            <option value="all">All Roles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>{totalCount} assignment{totalCount !== 1 ? "s" : ""}</span>
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
                  { key: "userId", label: "User" },
                  { key: "roleId", label: "Role" },
                  { key: "contextType", label: "Context" },
                  { key: "assignedAt", label: "Assigned", w: 130 },
                  { key: "expiresAt", label: "Expires", w: 130 },
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
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading...
                </td></tr>
              ) : assignments.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>No assignments found</td></tr>
              ) : assignments.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--gum-border)" }}>
                  <td style={cellStyle}>{a.id}</td>
                  <td style={cellStyle}>
                    <div>
                      <span style={{ fontWeight: 500, color: "var(--gum-text)" }}>{a.userFirstName} {a.userLastName}</span>
                      <p style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>{a.userEmail}</p>
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontSize: 12, background: "var(--gum-bg)", padding: "3px 8px", borderRadius: 6, fontWeight: 500 }}>
                      {a.roleName}
                    </span>
                    <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 2 }}>Level {a.roleLevel}</p>
                  </td>
                  <td style={cellStyle}>
                    {a.contextType ? (
                      <span style={{ fontSize: 12 }}>
                        <code>{a.contextType}</code>
                        {a.contextId && <span style={{ color: "var(--gum-text-muted)" }}> #{a.contextId}</span>}
                      </span>
                    ) : <span style={{ color: "var(--gum-text-muted)", fontSize: 12 }}>Global</span>}
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontSize: 12 }}>{new Date(a.assignedAt).toLocaleDateString("en-IN")}</span>
                  </td>
                  <td style={cellStyle}>
                    {a.expiresAt ? (
                      <span style={{ fontSize: 12, color: new Date(a.expiresAt) < new Date() ? "#DC3545" : "var(--gum-text)" }}>
                        {new Date(a.expiresAt).toLocaleDateString("en-IN")}
                      </span>
                    ) : <span style={{ color: "var(--gum-text-muted)", fontSize: 12 }}>Never</span>}
                  </td>
                  <td style={cellStyle}>
                    <StatusBadge
                      variant={a.isDeleted ? "deleted" : a.isCurrentlyValid ? "active" : "inactive"}
                      label={a.isDeleted ? "Deleted" : a.isCurrentlyValid ? "Active" : "Expired"}
                      icon={a.isDeleted ? "fa-trash" : a.isCurrentlyValid ? "fa-check-circle" : "fa-clock"}
                    />
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {a.isDeleted ? (
                        <button onClick={() => setRestoreTarget(a)}
                          style={actionBtnStyle("#198754")} title="Restore">
                          <i className="fa-solid fa-rotate-left" />
                        </button>
                      ) : (
                        <button onClick={() => setDeleteTarget(a)}
                          style={actionBtnStyle("#DC3545")} title="Delete">
                          <i className="fa-solid fa-trash" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* ─── Create Modal ────────────────────────────────────── */}
      {showCreateModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        }}>
          <div className="gum-card" style={{ width: 480, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-user-tag" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Assign Role to User
              </h3>
              <button onClick={() => { setShowCreateModal(false); setCreateErrors({}); }}
                style={{ background: "none", border: "none", fontSize: 16, color: "var(--gum-text-muted)", cursor: "pointer" }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>User ID *</label>
                <input type="number" min={1} value={createForm.userId || ""} placeholder="Enter user ID"
                  onChange={(e) => { setCreateForm((f) => ({ ...f, userId: Number(e.target.value) })); if (createErrors.userId) setCreateErrors((e2) => { const n = { ...e2 }; delete n.userId; return n; }); }}
                  style={inputStyle(!!createErrors.userId)} />
                {createErrors.userId && <p style={errorStyle}>{createErrors.userId}</p>}
              </div>
              <div>
                <label style={labelStyle}>Role *</label>
                <select value={createForm.roleId || ""}
                  onChange={(e) => { setCreateForm((f) => ({ ...f, roleId: Number(e.target.value) })); if (createErrors.roleId) setCreateErrors((e2) => { const n = { ...e2 }; delete n.roleId; return n; }); }}
                  style={inputStyle(!!createErrors.roleId)}>
                  <option value="">Select a role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                </select>
                {createErrors.roleId && <p style={errorStyle}>{createErrors.roleId}</p>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Context Type</label>
                  <select value={createForm.contextType || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, contextType: (e.target.value || undefined) as CreateAssignmentRequest["contextType"] }))}
                    style={inputStyle(false)}>
                    <option value="">None</option>
                    {CONTEXT_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Context ID</label>
                  <input type="number" min={1} value={createForm.contextId || ""}
                    onChange={(e) => setCreateForm((f) => ({ ...f, contextId: Number(e.target.value) || undefined }))}
                    placeholder="Optional" style={inputStyle(false)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Expires At</label>
                <input type="datetime-local" value={createForm.expiresAt || ""}
                  onChange={(e) => setCreateForm((f) => ({ ...f, expiresAt: e.target.value || undefined }))}
                  style={inputStyle(false)} />
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <input type="text" value={createForm.reason || ""} placeholder="Optional reason for assignment"
                  onChange={(e) => setCreateForm((f) => ({ ...f, reason: e.target.value || undefined }))}
                  style={inputStyle(false)} />
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--gum-border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { setShowCreateModal(false); setCreateErrors({}); }}
                style={{ height: 36, padding: "0 16px", background: "var(--gum-surface)", color: "var(--gum-text)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={handleCreate} disabled={creating}
                style={{
                  height: 36, padding: "0 20px", background: "var(--gum-primary)", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer", opacity: creating ? 0.7 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                {creating ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />}
                {creating ? "Assigning..." : "Assign Role"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Delete Assignment"
        message={`Remove ${deleteTarget?.roleName} role from ${deleteTarget?.userFirstName} ${deleteTarget?.userLastName}?`}
        confirmLabel="Delete" variant="danger" isLoading={actionLoading}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!restoreTarget} title="Restore Assignment"
        message={`Restore ${restoreTarget?.roleName} role for ${restoreTarget?.userFirstName} ${restoreTarget?.userLastName}?`}
        confirmLabel="Restore" variant="primary" isLoading={actionLoading}
        onConfirm={handleRestore} onCancel={() => setRestoreTarget(null)} />
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: "10px 16px", color: "var(--gum-text)" };

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 500, color: "var(--gum-text)", marginBottom: 6,
};

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%", height: 40, padding: "0 12px",
  background: "var(--gum-input-bg)",
  border: `1px solid ${hasError ? "#DC3545" : "var(--gum-border)"}`,
  borderRadius: 8, fontSize: 13, color: "var(--gum-text)",
});

const errorStyle: React.CSSProperties = { fontSize: 12, color: "#DC3545", marginTop: 4 };

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

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    return axiosErr.response?.data?.message || "An error occurred";
  }
  return "Network error";
}

export default withPermission(UserRoleAssignmentsPage, PERMISSIONS.ROLE_ASSIGN);
