"use client";
/* ================================================================
   Edit Role Page
   ================================================================ */
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { fetchRoleById, updateRole, fetchRoles } from "@/services/roleService";
import { toast } from "@/store/toastStore";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { Role } from "@/types";

interface RoleForm {
  name: string;
  code: string;
  description: string;
  parentRoleId: string;
  level: string;
  displayOrder: string;
  icon: string;
  color: string;
  isActive: boolean;
}

function EditRolePage() {
  const router = useRouter();
  const params = useParams();
  const roleId = Number(params.id);

  const [form, setForm] = useState<RoleForm>({
    name: "", code: "", description: "", parentRoleId: "",
    level: "0", displayOrder: "0", icon: "", color: "", isActive: true,
  });
  const [original, setOriginal] = useState<Role | null>(null);
  const [parentRoles, setParentRoles] = useState<Role[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchRoleById(roleId),
      fetchRoles({ limit: 100, sortBy: "name", sortDir: "ASC" }),
    ]).then(([roleRes, rolesRes]) => {
      const r = roleRes.data;
      setOriginal(r);
      setForm({
        name: r.name, code: r.code,
        description: r.description || "",
        parentRoleId: r.parentRoleId ? String(r.parentRoleId) : "",
        level: String(r.level),
        displayOrder: String(r.displayOrder),
        icon: r.icon || "", color: r.color || "",
        isActive: r.isActive,
      });
      // Exclude self from parent options
      setParentRoles(rolesRes.data.filter((pr) => pr.id !== roleId));
    }).catch(() => {
      toast.error("Failed to load role");
    }).finally(() => setLoading(false));
  }, [roleId]);

  const set = (field: keyof RoleForm, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 2) errs.name = "Name must be at least 2 characters";
    if (!/^[a-z0-9_]+$/.test(form.code)) errs.code = "Code must be lowercase alphanumeric with underscores only";
    if (form.code.length < 2) errs.code = "Code must be at least 2 characters";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setApiError("");
    try {
      await updateRole(roleId, {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || undefined,
        parentRoleId: form.parentRoleId ? Number(form.parentRoleId) : undefined,
        level: Number(form.level),
        displayOrder: Number(form.displayOrder),
        icon: form.icon.trim() || undefined,
        color: form.color.trim() || undefined,
        isActive: form.isActive,
      });
      toast.success("Role updated", `Role "${form.name}" has been updated.`);
      router.push("/roles");
    } catch (err: unknown) {
      const msg = extractError(err);
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: "var(--gum-primary)" }} />
        <p style={{ marginTop: 12, color: "var(--gum-text-muted)", fontSize: 14 }}>Loading role...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Edit Role</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>
            Editing: {original?.name} <code style={{ fontSize: 12, background: "var(--gum-bg)", padding: "2px 6px", borderRadius: 4 }}>{original?.code}</code>
          </p>
        </div>
        <Link href="/roles" style={{
          height: 36, padding: "0 16px", background: "var(--gum-surface)", color: "var(--gum-text)",
          border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, fontWeight: 500,
          display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
        }}>
          <i className="fa-solid fa-arrow-left" /> Back
        </Link>
      </div>

      {apiError && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#DC354510", border: "1px solid #DC354530", borderRadius: 8 }}>
          <p style={{ fontSize: 13, color: "#DC3545" }}><i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }} />{apiError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left — Core Info */}
          <div className="gum-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-shield-halved" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Role Information
              </h3>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Role Name *" error={errors.name}>
                <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} style={inputStyle(!!errors.name)} />
              </Field>
              <Field label="Code *" error={errors.code}>
                <input type="text" value={form.code} onChange={(e) => set("code", e.target.value)} style={inputStyle(!!errors.code)} />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3}
                  style={{ ...inputStyle(false), height: "auto", padding: "10px 12px", resize: "vertical" }} />
              </Field>
              <Field label="Parent Role">
                <select value={form.parentRoleId} onChange={(e) => set("parentRoleId", e.target.value)} style={inputStyle(false)}>
                  <option value="">None (top-level)</option>
                  {parentRoles.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Right — Settings */}
          <div className="gum-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-sliders" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Settings
              </h3>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Level (0–99)">
                  <input type="number" min={0} max={99} value={form.level} onChange={(e) => set("level", e.target.value)} style={inputStyle(false)} />
                </Field>
                <Field label="Display Order">
                  <input type="number" min={0} value={form.displayOrder} onChange={(e) => set("displayOrder", e.target.value)} style={inputStyle(false)} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Icon (FontAwesome)">
                  <input type="text" value={form.icon} onChange={(e) => set("icon", e.target.value)} placeholder="fa-user-shield" style={inputStyle(false)} />
                </Field>
                <Field label="Color">
                  <input type="text" value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="#4A90D9" style={inputStyle(false)} />
                </Field>
              </div>
              <ToggleRow label="Active" description="Role can be assigned to users" checked={form.isActive} onChange={(v) => set("isActive", v)} />

              {/* Meta info */}
              {original && (
                <div style={{ marginTop: 8, padding: "12px 14px", background: "var(--gum-bg)", borderRadius: 8 }}>
                  <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginBottom: 6, fontWeight: 600 }}>Meta</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--gum-text-muted)" }}>
                    <span>Created: {new Date(original.createdAt).toLocaleString("en-IN")}</span>
                    <span>Updated: {new Date(original.updatedAt).toLocaleString("en-IN")}</span>
                    <span>System Role: {original.isSystemRole ? "Yes" : "No"}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <Link href="/roles" style={{
            height: 40, padding: "0 20px", background: "var(--gum-surface)", color: "var(--gum-text)",
            border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, fontWeight: 500,
            display: "inline-flex", alignItems: "center", textDecoration: "none",
          }}>Cancel</Link>
          <button type="submit" disabled={isSubmitting} style={{
            height: 40, padding: "0 24px", background: "var(--gum-primary)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            {isSubmitting ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-floppy-disk" />}
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--gum-text)", marginBottom: 6 }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 12, color: "#DC3545", marginTop: 4 }}><i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />{error}</p>}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--gum-bg)", borderRadius: 8 }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)" }}>{label}</p>
        <p style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>{description}</p>
      </div>
      <button type="button" onClick={() => onChange(!checked)} style={{
        width: 42, height: 24, borderRadius: 12, border: "none",
        background: checked ? "var(--gum-primary)" : "var(--gum-border)",
        position: "relative", cursor: "pointer", transition: "background 0.2s",
      }}>
        <span style={{
          position: "absolute", top: 2, left: checked ? 20 : 2,
          width: 20, height: 20, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%", height: 40, padding: "0 12px",
  background: "var(--gum-input-bg)",
  border: `1px solid ${hasError ? "#DC3545" : "var(--gum-border)"}`,
  borderRadius: 8, fontSize: 13, color: "var(--gum-text)",
});

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    return axiosErr.response?.data?.message || "An error occurred";
  }
  return "Network error";
}

export default withPermission(EditRolePage, PERMISSIONS.ROLE_UPDATE);
