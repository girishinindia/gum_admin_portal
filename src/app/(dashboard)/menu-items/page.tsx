"use client";
/* ================================================================
   Menu Items Page — Hierarchical tree view with CRUD modals
   ================================================================ */
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  restoreMenuItem,
  type MenuItemRow,
  type CreateMenuItemRequest,
} from "@/services/menuItemService";
import { fetchPermissions } from "@/services/permissionService";
import { toast } from "@/store/toastStore";
import { withPermission } from "@/lib/rbac/withPermission";
import PermissionGate from "@/lib/rbac/PermissionGate";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Permission } from "@/types";

// ─── Tree node type ─────────────────────────────────────────
interface TreeNode extends MenuItemRow {
  children: TreeNode[];
  depth: number;
}

function MenuItemsPage() {
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Modal state
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItemRow | null>(null);
  const [form, setForm] = useState<CreateMenuItemRequest>(defaultForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Delete/Restore
  const [deleteTarget, setDeleteTarget] = useState<MenuItemRow | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<MenuItemRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ─── Load Data ────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMenuItems({ limit: 200, sortBy: "display_order", sortDir: "ASC" });
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch {
      toast.error("Failed to load menu items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
    fetchPermissions({ limit: 200, sortBy: "name", sortDir: "ASC" })
      .then((res) => {
        const permsData = Array.isArray(res?.data) ? res.data : [];
        setAllPermissions(permsData.filter((p) => !p.isDeleted && p.isActive));
      })
      .catch(() => {});
  }, [loadItems]);

  // ─── Build tree from flat list ────────────────────────────
  const tree = useMemo(() => {
    const map = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    // First pass: create nodes
    items.forEach((item) => {
      map.set(item.id, { ...item, children: [], depth: 0 });
    });

    // Second pass: link children
    items.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId)!;
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [items]);

  // ─── Flatten tree for table rendering ─────────────────────
  const flatRows = useMemo(() => {
    const rows: TreeNode[] = [];
    const walk = (nodes: TreeNode[], depth: number) => {
      nodes.forEach((node) => {
        rows.push({ ...node, depth });
        if (expandedIds.has(node.id) && node.children.length > 0) {
          walk(node.children, depth + 1);
        }
      });
    };
    walk(tree, 0);
    return rows;
  }, [tree, expandedIds]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<number>();
    items.forEach((i) => { if (items.some((c) => c.parentId === i.id)) allIds.add(i.id); });
    setExpandedIds(allIds);
  };

  const collapseAll = () => setExpandedIds(new Set());

  // ─── Create / Edit Modal ──────────────────────────────────
  const openCreate = (parentId?: number) => {
    setForm({ ...defaultForm(), parentMenuId: parentId });
    setEditingItem(null);
    setFormErrors({});
    setModalMode("create");
  };

  const openEdit = (item: MenuItemRow) => {
    setForm({
      name: item.name,
      code: item.code,
      route: item.route || undefined,
      icon: item.icon || undefined,
      description: item.description || undefined,
      parentMenuId: item.parentId || undefined,
      permissionId: item.permissionId || undefined,
      displayOrder: item.displayOrder,
      isVisible: item.isVisible,
      isActive: item.isActive,
    });
    setEditingItem(item);
    setFormErrors({});
    setModalMode("edit");
  };

  const setField = (field: keyof CreateMenuItemRequest, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (formErrors[field]) setFormErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.name || form.name.trim().length < 1) errs.name = "Name is required";
    if (!form.code || !/^[a-z0-9_]+$/.test(form.code)) errs.code = "Code must be lowercase alphanumeric with underscores";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: CreateMenuItemRequest = {
        name: form.name!.trim(),
        code: form.code!.trim(),
        route: form.route?.trim() || undefined,
        icon: form.icon?.trim() || undefined,
        description: form.description?.trim() || undefined,
        parentMenuId: form.parentMenuId || undefined,
        permissionId: form.permissionId || undefined,
        displayOrder: form.displayOrder ?? 0,
        isVisible: form.isVisible ?? true,
        isActive: form.isActive ?? true,
      };

      if (modalMode === "create") {
        await createMenuItem(payload);
        toast.success("Menu item created");
      } else if (editingItem) {
        await updateMenuItem(editingItem.id, payload);
        toast.success("Menu item updated");
      }
      setModalMode(null);
      loadItems();
    } catch (err: unknown) {
      toast.error(modalMode === "create" ? "Failed to create" : "Failed to update", extractError(err));
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete / Restore ─────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteMenuItem(deleteTarget.id);
      toast.success("Menu item deleted", "Child items have also been soft-deleted.");
      setDeleteTarget(null);
      loadItems();
    } catch { toast.error("Failed to delete menu item"); }
    finally { setActionLoading(false); }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await restoreMenuItem(restoreTarget.id, true);
      toast.success("Menu item restored", "Child items have also been restored.");
      setRestoreTarget(null);
      loadItems();
    } catch { toast.error("Failed to restore menu item"); }
    finally { setActionLoading(false); }
  };

  // ─── Permission lookup ────────────────────────────────────
  const permMap = useMemo(() => {
    const m = new Map<number, Permission>();
    allPermissions.forEach((p) => m.set(p.id, p));
    return m;
  }, [allPermissions]);

  // Parent items for dropdown
  const parentOptions = useMemo(() =>
    items.filter((i) => !i.isDeleted && (!editingItem || i.id !== editingItem.id)),
    [items, editingItem]
  );

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Menu Items</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>Configure navigation menu structure and ordering</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={expandAll} style={toolbarBtn}>
            <i className="fa-solid fa-expand" /> Expand All
          </button>
          <button onClick={collapseAll} style={toolbarBtn}>
            <i className="fa-solid fa-compress" /> Collapse
          </button>
          <PermissionGate permission={PERMISSIONS.MENU_CREATE}>
            <button onClick={() => openCreate()} style={{
              height: 38, padding: "0 18px", background: "var(--gum-primary)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
            }}>
              <i className="fa-solid fa-plus" /> Add Item
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--gum-text-muted)" }}>
        {items.length} menu item{items.length !== 1 ? "s" : ""} — {tree.length} top-level
      </div>

      {/* Tree Table */}
      <div className="gum-card">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--gum-border)" }}>
                <th style={thStyle}>Menu Item</th>
                <th style={{ ...thStyle, width: 120 }}>Code</th>
                <th style={{ ...thStyle, width: 140 }}>Route</th>
                <th style={{ ...thStyle, width: 140 }}>Permission</th>
                <th style={{ ...thStyle, width: 70 }}>Order</th>
                <th style={{ ...thStyle, width: 90 }}>Status</th>
                <th style={{ ...thStyle, width: 140, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading...
                </td></tr>
              ) : flatRows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>No menu items found</td></tr>
              ) : flatRows.map((row) => {
                const hasChildren = items.some((i) => i.parentId === row.id);
                const isExpanded = expandedIds.has(row.id);
                const perm = row.permissionId ? permMap.get(row.permissionId) : null;

                return (
                  <tr key={row.id} style={{ borderBottom: "1px solid var(--gum-border)", opacity: row.isDeleted ? 0.5 : 1 }}>
                    <td style={cellStyle}>
                      <div style={{ display: "flex", alignItems: "center", paddingLeft: row.depth * 28 }}>
                        {/* Expand/Collapse toggle */}
                        {hasChildren ? (
                          <button onClick={() => toggleExpand(row.id)}
                            style={{ width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "var(--gum-text-muted)", fontSize: 10, marginRight: 6, flexShrink: 0 }}>
                            <i className={`fa-solid ${isExpanded ? "fa-chevron-down" : "fa-chevron-right"}`} />
                          </button>
                        ) : (
                          <span style={{ width: 28, flexShrink: 0 }} />
                        )}

                        {row.icon && (
                          <i className={`fa-solid ${row.icon}`} style={{ width: 18, fontSize: 13, color: "var(--gum-primary)", textAlign: "center", marginRight: 8, flexShrink: 0 }} />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 500, color: "var(--gum-text)" }}>{row.name}</span>
                          {row.description && <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 1 }}>{row.description}</p>}
                        </div>
                        {!row.isVisible && (
                          <i className="fa-solid fa-eye-slash" style={{ marginLeft: 8, fontSize: 11, color: "var(--gum-text-muted)" }} title="Hidden" />
                        )}
                      </div>
                    </td>
                    <td style={cellStyle}>
                      <code style={{ fontSize: 11, background: "var(--gum-bg)", padding: "2px 6px", borderRadius: 4, color: "var(--gum-text-muted)" }}>{row.code}</code>
                    </td>
                    <td style={cellStyle}>
                      {row.route ? (
                        <code style={{ fontSize: 11, color: "var(--gum-primary)" }}>{row.route}</code>
                      ) : <span style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>—</span>}
                    </td>
                    <td style={cellStyle}>
                      {perm ? (
                        <span style={{ fontSize: 11, background: "#4A90D910", color: "#4A90D9", padding: "2px 6px", borderRadius: 6 }}>
                          {perm.code}
                        </span>
                      ) : row.permissionCode ? (
                        <span style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>{row.permissionCode}</span>
                      ) : <span style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>—</span>}
                    </td>
                    <td style={cellStyle}>{row.displayOrder}</td>
                    <td style={cellStyle}>
                      <StatusBadge
                        variant={row.isDeleted ? "deleted" : row.isActive ? "active" : "inactive"}
                        label={row.isDeleted ? "Deleted" : row.isActive ? "Active" : "Inactive"}
                        icon={row.isDeleted ? "fa-trash" : row.isActive ? "fa-check-circle" : "fa-times-circle"}
                      />
                    </td>
                    <td style={{ ...cellStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <PermissionGate permission={PERMISSIONS.MENU_CREATE}>
                          <button onClick={() => openCreate(row.id)} title="Add child"
                            style={actionBtn("var(--gum-primary)")}>
                            <i className="fa-solid fa-plus" />
                          </button>
                        </PermissionGate>
                        <PermissionGate permission={PERMISSIONS.MENU_UPDATE}>
                          <button onClick={() => openEdit(row)} title="Edit"
                            style={actionBtn("var(--gum-primary)")}>
                            <i className="fa-solid fa-pen" />
                          </button>
                        </PermissionGate>
                        {row.isDeleted ? (
                          <PermissionGate permission={PERMISSIONS.MENU_RESTORE}>
                            <button onClick={() => setRestoreTarget(row)} title="Restore"
                              style={actionBtn("#198754")}>
                              <i className="fa-solid fa-rotate-left" />
                            </button>
                          </PermissionGate>
                        ) : (
                          <PermissionGate permission={PERMISSIONS.MENU_DELETE}>
                            <button onClick={() => setDeleteTarget(row)} title="Delete"
                              style={actionBtn("#DC3545")}>
                              <i className="fa-solid fa-trash" />
                            </button>
                          </PermissionGate>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create / Edit Modal ────────────────────────────── */}
      {modalMode && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
        }}>
          <div className="gum-card" style={{ width: 520, maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-bars" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                {modalMode === "create" ? "Create Menu Item" : `Edit: ${editingItem?.name}`}
              </h3>
              <button onClick={() => setModalMode(null)} style={{ background: "none", border: "none", fontSize: 16, color: "var(--gum-text-muted)", cursor: "pointer" }}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Name *" error={formErrors.name}>
                  <input type="text" value={form.name || ""} onChange={(e) => {
                    setField("name", e.target.value);
                    // Auto-gen code on create
                    if (modalMode === "create" && (!form.code || form.code === slugify(form.name || ""))) {
                      setField("code", slugify(e.target.value));
                    }
                  }} placeholder="Dashboard" style={inputStyle(!!formErrors.name)} />
                </Field>
                <Field label="Code *" error={formErrors.code}>
                  <input type="text" value={form.code || ""} onChange={(e) => setField("code", e.target.value)}
                    placeholder="dashboard" style={inputStyle(!!formErrors.code)} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Route">
                  <input type="text" value={form.route || ""} onChange={(e) => setField("route", e.target.value || undefined)}
                    placeholder="/dashboard" style={inputStyle(false)} />
                </Field>
                <Field label="Icon (FontAwesome)">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="text" value={form.icon || ""} onChange={(e) => setField("icon", e.target.value || undefined)}
                      placeholder="fa-gauge-high" style={{ ...inputStyle(false), flex: 1 }} />
                    {form.icon && <i className={`fa-solid ${form.icon}`} style={{ fontSize: 16, color: "var(--gum-primary)", width: 20 }} />}
                  </div>
                </Field>
              </div>
              <Field label="Description">
                <input type="text" value={form.description || ""} onChange={(e) => setField("description", e.target.value || undefined)}
                  placeholder="Optional description" style={inputStyle(false)} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Parent">
                  <select value={form.parentMenuId || ""} onChange={(e) => setField("parentMenuId", Number(e.target.value) || undefined)}
                    style={inputStyle(false)}>
                    <option value="">None (top-level)</option>
                    {parentOptions.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.code})</option>)}
                  </select>
                </Field>
                <Field label="Permission Guard">
                  <select value={form.permissionId || ""} onChange={(e) => setField("permissionId", Number(e.target.value) || undefined)}
                    style={inputStyle(false)}>
                    <option value="">None (public)</option>
                    {allPermissions.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Display Order">
                <input type="number" min={0} value={form.displayOrder ?? 0} onChange={(e) => setField("displayOrder", Number(e.target.value))}
                  style={{ ...inputStyle(false), width: 120 }} />
              </Field>
              <div style={{ display: "flex", gap: 16 }}>
                <ToggleRow label="Visible" checked={form.isVisible ?? true} onChange={(v) => setField("isVisible", v)} />
                <ToggleRow label="Active" checked={form.isActive ?? true} onChange={(v) => setField("isActive", v)} />
              </div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--gum-border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setModalMode(null)}
                style={{ height: 36, padding: "0 16px", background: "var(--gum-surface)", color: "var(--gum-text)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={saving}
                style={{
                  height: 36, padding: "0 20px", background: "var(--gum-primary)", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-floppy-disk" />}
                {saving ? "Saving..." : modalMode === "create" ? "Create" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      <ConfirmDialog open={!!deleteTarget} title="Delete Menu Item"
        message={`Delete "${deleteTarget?.name}"? All child items will also be soft-deleted.`}
        confirmLabel="Delete" variant="danger" isLoading={actionLoading}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!restoreTarget} title="Restore Menu Item"
        message={`Restore "${restoreTarget?.name}" and all its child items?`}
        confirmLabel="Restore" variant="primary" isLoading={actionLoading}
        onConfirm={handleRestore} onCancel={() => setRestoreTarget(null)} />
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--gum-text)", marginBottom: 6 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 12, color: "#DC3545", marginTop: 4 }}><i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />{error}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--gum-text)" }}>
      <button type="button" onClick={() => onChange(!checked)} style={{
        width: 36, height: 20, borderRadius: 10, border: "none",
        background: checked ? "var(--gum-primary)" : "var(--gum-border)",
        position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
      }}>
        <span style={{
          position: "absolute", top: 2, left: checked ? 18 : 2,
          width: 16, height: 16, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        }} />
      </button>
      {label}
    </label>
  );
}

// ─── Styles & Helpers ───────────────────────────────────────────

const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontWeight: 600, color: "var(--gum-text-muted)", whiteSpace: "nowrap" };
const cellStyle: React.CSSProperties = { padding: "10px 16px", color: "var(--gum-text)" };

const toolbarBtn: React.CSSProperties = {
  height: 38, padding: "0 14px", background: "var(--gum-surface)", color: "var(--gum-text)",
  border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 12, fontWeight: 500,
  display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
};

const actionBtn = (color: string): React.CSSProperties => ({
  width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 6, border: "1px solid var(--gum-border)", color, background: "transparent",
  cursor: "pointer", fontSize: 11,
});

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%", height: 38, padding: "0 12px",
  background: "var(--gum-input-bg)",
  border: `1px solid ${hasError ? "#DC3545" : "var(--gum-border)"}`,
  borderRadius: 8, fontSize: 13, color: "var(--gum-text)",
});

function defaultForm(): CreateMenuItemRequest {
  return { name: "", code: "", displayOrder: 0, isVisible: true, isActive: true };
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    return axiosErr.response?.data?.message || "An error occurred";
  }
  return "Network error";
}

export default withPermission(MenuItemsPage, PERMISSIONS.MENU_READ);
