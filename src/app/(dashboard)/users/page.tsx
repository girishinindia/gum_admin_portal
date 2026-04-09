"use client";
/* ================================================================
   Users List Page — Full CRUD with data table
   Protected by user.read permission
   ================================================================ */
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import PermissionGate from "@/lib/rbac/PermissionGate";
import StatusBadge from "@/components/ui/StatusBadge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { fetchUsers, deleteUser, restoreUser } from "@/services/userService";
import { toast } from "@/store/toastStore";
import type { User, UserFilters } from "@/types";

function UsersPage() {
  // ─── State ──────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 15,
    sortBy: "id",
    sortDir: "DESC",
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Delete/Restore dialog state
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Fetch Data ─────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const appliedFilters: UserFilters = { ...filters };
      if (search.trim()) appliedFilters.search = search.trim();
      if (statusFilter === "active") {
        appliedFilters.isActive = true;
        appliedFilters.isDeleted = false;
      } else if (statusFilter === "inactive") {
        appliedFilters.isActive = false;
      } else if (statusFilter === "deleted") {
        appliedFilters.isDeleted = true;
      }

      const response = await fetchUsers(appliedFilters);
      setUsers(Array.isArray(response?.data) ? response.data : []);
      setTotalCount(response?.pagination?.totalCount ?? 0);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [filters, search, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // ─── Actions ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteUser(deleteTarget.id);
      toast.success("User deleted", `${deleteTarget.firstName} ${deleteTarget.lastName} has been deleted.`);
      setDeleteTarget(null);
      loadUsers();
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await restoreUser(restoreTarget.id);
      toast.success("User restored", `${restoreTarget.firstName} ${restoreTarget.lastName} has been restored.`);
      setRestoreTarget(null);
      loadUsers();
    } catch {
      toast.error("Failed to restore user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, page: 1 }));
  };

  const totalPages = Math.ceil(totalCount / (filters.limit || 15));

  // ─── Sort handler ───────────────────────────────────────────
  const handleSort = (column: string) => {
    setFilters((f) => ({
      ...f,
      sortBy: column,
      sortDir: f.sortBy === column && f.sortDir === "ASC" ? "DESC" : "ASC",
    }));
  };

  const SortIcon = ({ column }: { column: string }) => (
    <i
      className={`fa-solid ${
        filters.sortBy === column
          ? filters.sortDir === "ASC"
            ? "fa-sort-up"
            : "fa-sort-down"
          : "fa-sort"
      }`}
      style={{ fontSize: 10, marginLeft: 4, opacity: filters.sortBy === column ? 1 : 0.3 }}
    />
  );

  return (
    <div className="fade-in">
      {/* ─── Page Header ────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Users</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>
            {totalCount} user{totalCount !== 1 ? "s" : ""} found
          </p>
        </div>
        <PermissionGate permission={PERMISSIONS.USER_CREATE}>
          <Link
            href="/users/create"
            style={{
              height: 40, padding: "0 20px", background: "var(--gum-primary)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
            }}
          >
            <i className="fa-solid fa-user-plus" /> Add User
          </Link>
        </PermissionGate>
      </div>

      {/* ─── Filters Bar ───────────────────────────────────── */}
      <div className="gum-card" style={{ marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search */}
          <form onSubmit={handleSearch} style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <i
              className="fa-solid fa-magnifying-glass"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--gum-text-muted)" }}
            />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", height: 36, paddingLeft: 36, paddingRight: 12,
                background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)",
                borderRadius: 8, fontSize: 13, color: "var(--gum-text)",
              }}
            />
          </form>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setFilters((f) => ({ ...f, page: 1 }));
            }}
            style={{
              height: 36, padding: "0 12px", background: "var(--gum-input-bg)",
              border: "1px solid var(--gum-border)", borderRadius: 8,
              fontSize: 13, color: "var(--gum-text)", cursor: "pointer",
            }}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deleted">Deleted</option>
          </select>

          {/* Refresh */}
          <button
            onClick={loadUsers}
            style={{
              height: 36, width: 36, background: "var(--gum-input-bg)",
              border: "1px solid var(--gum-border)", borderRadius: 8,
              cursor: "pointer", color: "var(--gum-text-muted)", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
            title="Refresh"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? "fa-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─── Data Table ────────────────────────────────────── */}
      <div className="gum-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--gum-bg)", borderBottom: "1px solid var(--gum-border)" }}>
                <th onClick={() => handleSort("id")} style={thStyle}>
                  ID <SortIcon column="id" />
                </th>
                <th onClick={() => handleSort("firstName")} style={thStyle}>
                  Name <SortIcon column="firstName" />
                </th>
                <th onClick={() => handleSort("email")} style={thStyle}>
                  Email <SortIcon column="email" />
                </th>
                <th style={thStyle}>Mobile</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Verified</th>
                <th onClick={() => handleSort("createdAt")} style={thStyle}>
                  Created <SortIcon column="createdAt" />
                </th>
                <th style={{ ...thStyle, textAlign: "center", width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: "center", color: "var(--gum-text-muted)" }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 20, marginBottom: 8 }} />
                    <p style={{ fontSize: 13 }}>Loading users...</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: "center", color: "var(--gum-text-muted)" }}>
                    <i className="fa-solid fa-users-slash" style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }} />
                    <p style={{ fontSize: 13 }}>No users found</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: "1px solid var(--gum-border)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gum-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "var(--gum-primary)" }}>#{user.id}</span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: "var(--gum-primary)", color: "#fff",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 12, fontWeight: 600, flexShrink: 0,
                          }}
                        >
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: "var(--gum-text)" }}>
                            {user.firstName} {user.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--gum-text-muted)" }}>{user.email || "—"}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--gum-text-muted)" }}>{user.mobile || "—"}</span>
                    </td>
                    <td style={tdStyle}>
                      {user.isDeleted ? (
                        <StatusBadge variant="deleted" label="Deleted" icon="fa-trash" />
                      ) : user.isActive ? (
                        <StatusBadge variant="active" label="Active" icon="fa-circle" />
                      ) : (
                        <StatusBadge variant="inactive" label="Inactive" icon="fa-circle" />
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {user.isEmailVerified && (
                          <StatusBadge variant="verified" label="Email" icon="fa-envelope" />
                        )}
                        {user.isMobileVerified && (
                          <StatusBadge variant="verified" label="Mobile" icon="fa-phone" />
                        )}
                        {!user.isEmailVerified && !user.isMobileVerified && (
                          <StatusBadge variant="pending" label="Unverified" icon="fa-clock" />
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--gum-text-muted)", fontSize: 12 }}>
                        {new Date(user.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
                        <PermissionGate permission={PERMISSIONS.USER_UPDATE}>
                          <Link
                            href={`/users/${user.id}/edit`}
                            title="Edit"
                            style={{
                              width: 30, height: 30, borderRadius: 6,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: "var(--gum-primary)", background: "rgba(74,144,217,0.1)",
                              textDecoration: "none",
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square" style={{ fontSize: 12 }} />
                          </Link>
                        </PermissionGate>

                        {user.isDeleted ? (
                          <PermissionGate permission={PERMISSIONS.USER_RESTORE}>
                            <button
                              onClick={() => setRestoreTarget(user)}
                              title="Restore"
                              style={{
                                width: 30, height: 30, borderRadius: 6, border: "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#48BB78", background: "rgba(72,187,120,0.1)",
                                cursor: "pointer",
                              }}
                            >
                              <i className="fa-solid fa-trash-arrow-up" style={{ fontSize: 12 }} />
                            </button>
                          </PermissionGate>
                        ) : (
                          <PermissionGate permission={PERMISSIONS.USER_DELETE}>
                            <button
                              onClick={() => setDeleteTarget(user)}
                              title="Delete"
                              style={{
                                width: 30, height: 30, borderRadius: 6, border: "none",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#DC3545", background: "rgba(220,53,69,0.1)",
                                cursor: "pointer",
                              }}
                            >
                              <i className="fa-solid fa-trash" style={{ fontSize: 12 }} />
                            </button>
                          </PermissionGate>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination ──────────────────────────────────── */}
        {totalPages > 1 && (
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--gum-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--gum-text-muted)" }}>
              Page {filters.page} of {totalPages} ({totalCount} total)
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                disabled={filters.page === 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) - 1 }))}
                style={paginationBtnStyle(filters.page === 1)}
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              <button
                disabled={filters.page === totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page || 1) + 1 }))}
                style={paginationBtnStyle(filters.page === totalPages)}
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Delete Confirmation ───────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete User"
        message={`Are you sure you want to delete ${deleteTarget?.firstName} ${deleteTarget?.lastName}? This action can be reversed by a Super Admin.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ─── Restore Confirmation ──────────────────────────── */}
      <ConfirmDialog
        open={!!restoreTarget}
        title="Restore User"
        message={`Are you sure you want to restore ${restoreTarget?.firstName} ${restoreTarget?.lastName}?`}
        confirmLabel="Restore"
        variant="primary"
        isLoading={actionLoading}
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </div>
  );
}

// ─── Table Styles ────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  color: "var(--gum-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  verticalAlign: "middle",
};

const paginationBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid var(--gum-border)",
  background: "var(--gum-surface)",
  color: disabled ? "var(--gum-border)" : "var(--gum-text)",
  cursor: disabled ? "not-allowed" : "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
});

export default withPermission(UsersPage, PERMISSIONS.USER_READ);
