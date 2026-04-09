"use client";
/* ================================================================
   Role-Permissions Matrix — Assign/remove permissions for roles
   Uses replace API for bulk operations
   ================================================================ */
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchRoles } from "@/services/roleService";
import { fetchPermissions } from "@/services/permissionService";
import { fetchModules } from "@/services/moduleService";
import {
  fetchRolePermissions,
  replaceRolePermissions,
} from "@/services/rolePermissionService";
import { toast } from "@/store/toastStore";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { Role, Permission, Module, RolePermission } from "@/types";

function RolePermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [, setRolePermissions] = useState<RolePermission[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Track which permission IDs are checked for the selected role
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [originalIds, setOriginalIds] = useState<Set<number>>(new Set());

  // ─── Load initial data ────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetchRoles({ limit: 100, sortBy: "name", sortDir: "ASC" }),
      fetchPermissions({ limit: 200, sortBy: "displayOrder", sortDir: "ASC" }),
      fetchModules({ limit: 100, sortBy: "displayOrder", sortDir: "ASC" }),
    ]).then(([rolesRes, permsRes, modsRes]) => {
      const rolesData = Array.isArray(rolesRes?.data) ? rolesRes.data : [];
      const permsData = Array.isArray(permsRes?.data) ? permsRes.data : [];
      const modsData = Array.isArray(modsRes?.data) ? modsRes.data : [];
      setRoles(rolesData.filter((r) => !r.isDeleted));
      setPermissions(permsData.filter((p) => !p.isDeleted && p.isActive));
      setModules(modsData.filter((m) => !m.isDeleted && m.isActive));
      if (rolesData.length > 0) setSelectedRoleId(rolesData[0].id);
    }).catch(() => toast.error("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  // ─── Load role permissions when role changes ──────────────
  const loadRolePerms = useCallback(async () => {
    if (!selectedRoleId) return;
    try {
      const res = await fetchRolePermissions({ roleId: selectedRoleId, limit: 200 });
      const rolePermsData = Array.isArray(res?.data) ? res.data : [];
      setRolePermissions(rolePermsData);
      const ids = new Set(rolePermsData.map((rp) => rp.permissionId));
      setCheckedIds(ids);
      setOriginalIds(new Set(ids));
    } catch {
      toast.error("Failed to load role permissions");
    }
  }, [selectedRoleId]);

  useEffect(() => { loadRolePerms(); }, [loadRolePerms]);

  // ─── Group permissions by module ──────────────────────────
  const groupedPermissions = useMemo(() => {
    const groups: { module: Module; perms: Permission[] }[] = [];
    const modMap = new Map<number, Permission[]>();

    permissions.forEach((p) => {
      if (!modMap.has(p.moduleId)) modMap.set(p.moduleId, []);
      modMap.get(p.moduleId)!.push(p);
    });

    modules.forEach((m) => {
      const perms = modMap.get(m.id);
      if (perms && perms.length > 0) groups.push({ module: m, perms });
    });

    return groups;
  }, [permissions, modules]);

  // ─── Toggle handlers ──────────────────────────────────────
  const togglePermission = (permId: number) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const toggleModule = (modulePerms: Permission[]) => {
    const allChecked = modulePerms.every((p) => checkedIds.has(p.id));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      modulePerms.forEach((p) => {
        if (allChecked) next.delete(p.id);
        else next.add(p.id);
      });
      return next;
    });
  };

  const hasChanges = useMemo(() => {
    if (checkedIds.size !== originalIds.size) return true;
    for (const id of checkedIds) if (!originalIds.has(id)) return true;
    return false;
  }, [checkedIds, originalIds]);

  // ─── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      await replaceRolePermissions(selectedRoleId, Array.from(checkedIds));
      toast.success("Permissions updated", "Role permissions have been saved.");
      setOriginalIds(new Set(checkedIds));
    } catch {
      toast.error("Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: "var(--gum-primary)" }} />
        <p style={{ marginTop: 12, color: "var(--gum-text-muted)", fontSize: 14 }}>Loading data...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Role Permissions</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>Assign permissions to roles using the matrix below</p>
        </div>
        {hasChanges && (
          <button onClick={handleSave} disabled={saving} style={{
            height: 38, padding: "0 20px", background: "var(--gum-primary)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-floppy-disk" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </div>

      {/* Role Selector */}
      <div className="gum-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)" }}>Select Role:</label>
          <select value={selectedRoleId ?? ""} onChange={(e) => setSelectedRoleId(Number(e.target.value))}
            style={{ height: 38, padding: "0 12px", background: "var(--gum-input-bg)", border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, color: "var(--gum-text)", minWidth: 240 }}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
          </select>
          {selectedRole && (
            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--gum-text-muted)" }}>
              <span>Level: {selectedRole.level}</span>
              <span>|</span>
              <span>{checkedIds.size} permission{checkedIds.size !== 1 ? "s" : ""} assigned</span>
              {hasChanges && <span style={{ color: "#F59E0B", fontWeight: 600 }}>• Unsaved changes</span>}
            </div>
          )}
        </div>
      </div>

      {/* Permission Groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groupedPermissions.map(({ module: mod, perms }) => {
          const allChecked = perms.every((p) => checkedIds.has(p.id));
          const someChecked = perms.some((p) => checkedIds.has(p.id));

          return (
            <div key={mod.id} className="gum-card">
              {/* Module Header */}
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid var(--gum-border)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "var(--gum-bg)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                    onChange={() => toggleModule(perms)}
                    style={{ width: 16, height: 16, accentColor: "var(--gum-primary)", cursor: "pointer" }}
                  />
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--gum-text)" }}>
                    {mod.icon && <i className={`fa-solid ${mod.icon}`} style={{ marginRight: 8, color: mod.color || "var(--gum-primary)" }} />}
                    {mod.name}
                  </h3>
                  <code style={{ fontSize: 11, color: "var(--gum-text-muted)", background: "var(--gum-surface)", padding: "1px 6px", borderRadius: 4 }}>
                    {mod.code}
                  </code>
                </div>
                <span style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>
                  {perms.filter((p) => checkedIds.has(p.id)).length}/{perms.length}
                </span>
              </div>

              {/* Permission Checkboxes */}
              <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 8 }}>
                {perms.map((perm) => (
                  <label key={perm.id}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px",
                      borderRadius: 6, cursor: "pointer",
                      background: checkedIds.has(perm.id) ? "var(--gum-primary-bg, #4A90D908)" : "transparent",
                      border: `1px solid ${checkedIds.has(perm.id) ? "var(--gum-primary)20" : "transparent"}`,
                      transition: "background 0.15s",
                    }}>
                    <input type="checkbox"
                      checked={checkedIds.has(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      style={{ width: 16, height: 16, marginTop: 1, accentColor: "var(--gum-primary)", cursor: "pointer", flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)" }}>{perm.name}</p>
                      <p style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>
                        <code>{perm.code}</code> — {perm.resource}.{perm.action}
                        <span style={{ marginLeft: 6, fontSize: 10, background: "#4A90D910", color: "#4A90D9", padding: "1px 5px", borderRadius: 6 }}>{perm.scope}</span>
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {groupedPermissions.length === 0 && !loading && (
        <div className="gum-card" style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)" }}>
          No permissions found. Create modules and permissions first.
        </div>
      )}
    </div>
  );
}

export default withPermission(RolePermissionsPage, PERMISSIONS.PERMISSION_MANAGE);
