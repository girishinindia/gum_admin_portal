"use client";
/* ================================================================
   Create Role Page
   ================================================================ */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRole } from "@/services/roleService";
import { fetchRoles } from "@/services/roleService";
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

const defaultForm: RoleForm = {
  name: "", code: "", description: "", parentRoleId: "",
  level: "0", displayOrder: "0", icon: "", color: "", isActive: true,
};

function CreateRolePage() {
  const router = useRouter();
  const [form, setForm] = useState<RoleForm>(defaultForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentRoles, setParentRoles] = useState<Role[]>([]);

  useEffect(() => {
    fetchRoles({ limit: 100, sortBy: "name", sortDir: "ASC" })
      .then((res) => setParentRoles(res.data))
      .catch(() => {});
  }, []);

  const set = (field: keyof RoleForm, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  // Auto-generate code from name
  const handleNameChange = (name: string) => {
    set("name", name);
    if (!form.code || form.code === slugify(form.name)) {
      setForm((f) => ({ ...f, code: slugify(name) }));
    }
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
      await createRole({
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
      toast.success("Role created", `Role "${form.name}" has been created.`);
      router.push("/roles");
    } catch (err: unknown) {
      const msg = extractError(err);
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Create Role</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>Define a new role in the RBAC system</p>
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
                <input type="text" value={form.name} onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Content Manager" style={inputStyle(!!errors.name)} />
              </Field>
              <Field label="Code *" error={errors.code}>
                <input type="text" value={form.code} onChange={(e) => set("code", e.target.value)}
                  placeholder="e.g. content_manager" style={inputStyle(!!errors.code)} />
              </Field>
              <Field label="Description">
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                  placeholder="Brief description of this role's purpose" rows={3}
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
                  <input type="text" value={form.icon} onChange={(e) => set("icon", e.target.value)}
                    placeholder="fa-user-shield" style={inputStyle(false)} />
                </Field>
                <Field label="Color">
                  <input type="text" value={form.color} onChange={(e) => set("color", e.target.value)}
                    placeholder="#4A90D9" style={inputStyle(false)} />
                </Field>
              </div>
              <ToggleRow label="Active" description="Role can be assigned to users" checked={form.isActive} onChange={(v) => set("isActive", v)} />
            </div>
          </div>
        </div>

        {/* Submit */}
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
            {isSubmitting ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plus" />}
            {isSubmitting ? "Creating..." : "Create Role"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Sub-components / Helpers ────────────────────────────────

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

export default withPermission(CreateRolePage, PERMISSIONS.ROLE_CREATE);
