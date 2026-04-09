"use client";
/* ================================================================
   Audit Log Page — Role Change Log with filters & timeline
   Read-only view (append-only audit trail)
   ================================================================ */
import { useState, useEffect, useCallback } from "react";
import { fetchAuditLogs } from "@/services/auditLogService";
import { fetchRoles } from "@/services/roleService";
import { toast } from "@/store/toastStore";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { RoleChangeLog, Role } from "@/types";

type SortDir = "ASC" | "DESC";

const ACTIONS = ["assigned", "revoked", "expired", "modified", "restored"] as const;
const CONTEXT_TYPES = ["course", "batch", "department", "branch", "internship"] as const;

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  assigned:  { icon: "fa-user-plus",     color: "#198754", bg: "#19875415" },
  revoked:   { icon: "fa-user-minus",    color: "#DC3545", bg: "#DC354515" },
  expired:   { icon: "fa-clock",         color: "#F59E0B", bg: "#F59E0B15" },
  modified:  { icon: "fa-pen",           color: "#4A90D9", bg: "#4A90D915" },
  restored:  { icon: "fa-rotate-left",   color: "#6366F1", bg: "#6366F115" },
};

function AuditLogPage() {
  const [logs, setLogs] = useState<RoleChangeLog[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Sort & pagination
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("DESC");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 30;

  // Detail panel
  const [selectedLog, setSelectedLog] = useState<RoleChangeLog | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");

  // Load roles for filter
  useEffect(() => {
    fetchRoles({ limit: 100, sortBy: "name", sortDir: "ASC" })
      .then((res) => setRoles(Array.isArray(res?.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, unknown> = { page, limit, search, sortBy, sortDir };
      if (actionFilter !== "all") filters.action = actionFilter;
      if (roleFilter !== "all") filters.roleId = Number(roleFilter);
      if (contextFilter !== "all") filters.contextType = contextFilter;
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const res = await fetchAuditLogs(filters as Parameters<typeof fetchAuditLogs>[0]);
      setLogs(Array.isArray(res?.data) ? res.data : []);
      setTotalCount(res?.pagination?.totalCount ?? 0);
    } catch {
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, search, sortBy, sortDir, actionFilter, roleFilter, contextFilter, dateFrom, dateTo]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
    else { setSortBy(col); setSortDir("DESC"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: string }) => (
    <i className={`fa-solid ${sortBy === col ? (sortDir === "ASC" ? "fa-sort-up" : "fa-sort-down") : "fa-sort"}`}
      style={{ marginLeft: 4, fontSize: 10, opacity: sortBy === col ? 1 : 0.3 }} />
  );

  const clearFilters = () => {
    setSearch(""); setActionFilter("all"); setRoleFilter("all");
    setContextFilter("all"); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const hasActiveFilters = search || actionFilter !== "all" || roleFilter !== "all" || contextFilter !== "all" || dateFrom || dateTo;
  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Audit Log</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>Track all role changes and access control events</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setViewMode("table")}
            style={{ ...viewBtn, background: viewMode === "table" ? "var(--gum-primary)" : "var(--gum-surface)", color: viewMode === "table" ? "#fff" : "var(--gum-text)" }}>
            <i className="fa-solid fa-table-list" />
          </button>
          <button onClick={() => setViewMode("timeline")}
            style={{ ...viewBtn, background: viewMode === "timeline" ? "var(--gum-primary)" : "var(--gum-surface)", color: viewMode === "timeline" ? "#fff" : "var(--gum-text)" }}>
            <i className="fa-solid fa-timeline" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="gum-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <i className="fa-solid fa-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--gum-text-muted)" }} />
            <input type="text" placeholder="Search by user email or role..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ width: "100%", height: 36, padding: "0 12px 0 36px", background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, color: "var(--gum-text)" }} />
          </div>
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} style={filterSelect}>
            <option value="all">All Actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
          </select>
          <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} style={filterSelect}>
            <option value="all">All Roles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={contextFilter} onChange={(e) => { setContextFilter(e.target.value); setPage(1); }} style={filterSelect}>
            <option value="all">All Contexts</option>
            {CONTEXT_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>From:</label>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            style={{ ...filterSelect, width: 150 }} />
          <label style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>To:</label>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            style={{ ...filterSelect, width: 150 }} />
          {hasActiveFilters && (
            <button onClick={clearFilters}
              style={{ height: 36, padding: "0 12px", background: "none", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 12, color: "#DC3545", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <i className="fa-solid fa-xmark" /> Clear
            </button>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--gum-text-muted)" }}>
            {totalCount} entr{totalCount !== 1 ? "ies" : "y"}
          </span>
        </div>
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        /* ─── Table View ────────────────────────────────────── */
        <div className="gum-card">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--gum-border)" }}>
                  {[
                    { key: "created_at", label: "Date", w: 160 },
                    { key: "action", label: "Action", w: 110 },
                    { key: "user_email", label: "User" },
                    { key: "role_name", label: "Role" },
                  ].map(({ key, label, w }) => (
                    <th key={key} onClick={() => handleSort(key)}
                      style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--gum-text-muted)", cursor: "pointer", width: w, whiteSpace: "nowrap" }}>
                      {label}<SortIcon col={key} />
                    </th>
                  ))}
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--gum-text-muted)", width: 120 }}>Context</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--gum-text-muted)" }}>Changed By</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600, color: "var(--gum-text-muted)", width: 50 }}>
                    <i className="fa-solid fa-eye" style={{ fontSize: 11 }} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading...
                  </td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>No audit log entries found</td></tr>
                ) : logs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.modified;
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--gum-border)" }}>
                      <td style={cellStyle}>
                        <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>
                          {new Date(log.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, background: cfg.bg, color: cfg.color, padding: "3px 10px", borderRadius: 10 }}>
                          <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: 10 }} />
                          {log.action}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        <div>
                          <span style={{ fontWeight: 500, color: "var(--gum-text)" }}>{log.userFirstName} {log.userLastName}</span>
                          <p style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>{log.userEmail}</p>
                        </div>
                      </td>
                      <td style={cellStyle}>
                        <span style={{ fontSize: 12, background: "var(--gum-bg)", padding: "3px 8px", borderRadius: 6, fontWeight: 500 }}>
                          {log.roleName}
                        </span>
                        <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 2 }}>
                          <code>{log.roleCode}</code>
                        </p>
                      </td>
                      <td style={cellStyle}>
                        {log.contextType ? (
                          <span style={{ fontSize: 12 }}>
                            <code>{log.contextType}</code>
                            {log.contextId && <span style={{ color: "var(--gum-text-muted)" }}> #{log.contextId}</span>}
                          </span>
                        ) : <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>—</span>}
                      </td>
                      <td style={cellStyle}>
                        <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>{log.changedByEmail}</span>
                      </td>
                      <td style={{ ...cellStyle, textAlign: "center" }}>
                        <button onClick={() => setSelectedLog(log)}
                          style={{ width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 6, border: "1px solid var(--gum-border)", background: "transparent", color: "var(--gum-primary)", cursor: "pointer", fontSize: 11 }}>
                          <i className="fa-solid fa-expand" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
      ) : (
        /* ─── Timeline View ─────────────────────────────────── */
        <div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading...
            </div>
          ) : logs.length === 0 ? (
            <div className="gum-card" style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
              No audit log entries found
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 32 }}>
              {/* Timeline line */}
              <div style={{ position: "absolute", left: 15, top: 0, bottom: 0, width: 2, background: "var(--gum-border)" }} />

              {logs.map((log, idx) => {
                const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.modified;
                return (
                  <div key={log.id} style={{ position: "relative", marginBottom: idx < logs.length - 1 ? 16 : 0 }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: "absolute", left: -25, top: 16,
                      width: 22, height: 22, borderRadius: "50%",
                      background: cfg.bg, border: `2px solid ${cfg.color}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: 9, color: cfg.color }} />
                    </div>

                    <div className="gum-card" onClick={() => setSelectedLog(log)}
                      style={{ cursor: "pointer", transition: "box-shadow 0.2s" }}>
                      <div style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color, padding: "2px 8px", borderRadius: 8 }}>
                              <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: 9 }} />
                              {log.action.toUpperCase()}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)" }}>
                              {log.userFirstName} {log.userLastName}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--gum-text-muted)", whiteSpace: "nowrap" }}>
                            {formatTimeAgo(log.createdAt)}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: "var(--gum-text)" }}>
                          Role <strong style={{ color: cfg.color }}>{log.roleName}</strong> was {log.action} for{" "}
                          <span style={{ fontWeight: 500 }}>{log.userEmail}</span>
                          {log.contextType && (
                            <span style={{ color: "var(--gum-text-muted)" }}>
                              {" "}in <code>{log.contextType}</code>
                              {log.contextId && ` #${log.contextId}`}
                            </span>
                          )}
                        </p>
                        {log.reason && (
                          <p style={{ fontSize: 12, color: "var(--gum-text-muted)", marginTop: 6, fontStyle: "italic" }}>
                            <i className="fa-solid fa-quote-left" style={{ fontSize: 9, marginRight: 4 }} />
                            {log.reason}
                          </p>
                        )}
                        <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 6 }}>
                          by {log.changedByEmail} — {new Date(log.createdAt).toLocaleString("en-IN")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Timeline Pagination */}
          {totalPages > 1 && (
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 8 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtn(page === 1)}>
                <i className="fa-solid fa-chevron-left" /> Newer
              </button>
              <span style={{ fontSize: 12, color: "var(--gum-text-muted)", padding: "8px 12px" }}>
                Page {page} of {totalPages}
              </span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={paginationBtn(page === totalPages)}>
                Older <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Detail Panel ───────────────────────────────────── */}
      {selectedLog && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        }} onClick={() => setSelectedLog(null)}>
          <div className="gum-card" style={{ width: 500, maxHeight: "80vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-file-lines" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Log Entry #{selectedLog.id}
              </h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: "none", border: "none", fontSize: 16, color: "var(--gum-text-muted)", cursor: "pointer" }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ padding: 20 }}>
              {(() => {
                const cfg = ACTION_CONFIG[selectedLog.action] || ACTION_CONFIG.modified;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Action badge */}
                    <div style={{ textAlign: "center", padding: 16, background: cfg.bg, borderRadius: 10 }}>
                      <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: 24, color: cfg.color, marginBottom: 8, display: "block" }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: cfg.color, textTransform: "uppercase" }}>
                        {selectedLog.action}
                      </span>
                    </div>

                    {/* Details */}
                    <DetailRow label="User" value={`${selectedLog.userFirstName} ${selectedLog.userLastName}`} sub={selectedLog.userEmail} />
                    <DetailRow label="Role" value={selectedLog.roleName} sub={selectedLog.roleCode} />
                    {selectedLog.contextType && (
                      <DetailRow label="Context" value={selectedLog.contextType} sub={selectedLog.contextId ? `ID: ${selectedLog.contextId}` : undefined} />
                    )}
                    {selectedLog.reason && <DetailRow label="Reason" value={selectedLog.reason} />}
                    <DetailRow label="Changed By" value={selectedLog.changedByEmail} />
                    <DetailRow label="Date & Time" value={new Date(selectedLog.createdAt).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" })} />
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--gum-border)" }}>
      <span style={{ fontSize: 12, color: "var(--gum-text-muted)", fontWeight: 500, minWidth: 100 }}>{label}</span>
      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)" }}>{value}</span>
        {sub && <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const cellStyle: React.CSSProperties = { padding: "10px 16px", color: "var(--gum-text)" };

const filterSelect: React.CSSProperties = {
  height: 36, padding: "0 10px", background: "var(--gum-input-bg)",
  border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 12, color: "var(--gum-text)",
};

const viewBtn: React.CSSProperties = {
  width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 8, border: "1px solid var(--gum-border)", cursor: "pointer", fontSize: 13,
};

const paginationBtn = (disabled: boolean): React.CSSProperties => ({
  height: 32, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6,
  borderRadius: 6, border: "1px solid var(--gum-border)", background: "var(--gum-surface)",
  color: disabled ? "var(--gum-text-muted)" : "var(--gum-text)", cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1, fontSize: 12,
});

// ─── Helpers ────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default withPermission(AuditLogPage, PERMISSIONS.AUDIT_LOG_READ);
