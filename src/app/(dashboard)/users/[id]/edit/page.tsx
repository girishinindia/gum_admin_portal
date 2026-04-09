"use client";
/* ================================================================
   Edit User Page — Pre-populated form with PATCH update
   Protected by user.update permission
   ================================================================ */
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { fetchUserById, updateUser } from "@/services/userService";
import { toast } from "@/store/toastStore";
import type { User } from "@/types";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
}

function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = Number(params.id);

  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", email: "", mobile: "",
    isActive: true, isEmailVerified: false, isMobileVerified: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ─── Load User ──────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const response = await fetchUserById(userId);
        const u = response.data;
        setUser(u);
        setForm({
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email || "",
          mobile: u.mobile || "",
          isActive: u.isActive,
          isEmailVerified: u.isEmailVerified,
          isMobileVerified: u.isMobileVerified,
        });
      } catch {
        toast.error("User not found");
        router.push("/users");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, router]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.firstName.trim().length < 2) errs.firstName = "First name must be at least 2 characters";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email format";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await updateUser(userId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        isActive: form.isActive,
        isEmailVerified: form.isEmailVerified,
        isMobileVerified: form.isMobileVerified,
      });
      toast.success("User updated", `${form.firstName} ${form.lastName} has been updated.`);
      router.push("/users");
    } catch (err: unknown) {
      const msg = extractError(err);
      setApiError(msg);
      toast.error("Failed to update user", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  };

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: "var(--gum-primary)" }} />
        <p style={{ marginTop: 12, color: "var(--gum-text-muted)", fontSize: 14 }}>Loading user...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>
            Edit User #{user.id}
          </h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>
            Update details for {user.firstName} {user.lastName}
          </p>
        </div>
        <Link href="/users" style={{
          height: 38, padding: "0 16px", background: "var(--gum-surface)", color: "var(--gum-text)",
          border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
        }}>
          <i className="fa-solid fa-arrow-left" /> Back
        </Link>
      </div>

      {apiError && (
        <div style={{
          padding: "12px 16px", marginBottom: 20, borderRadius: 8,
          background: "rgba(220,53,69,0.1)", border: "1px solid rgba(220,53,69,0.3)",
          color: "#DC3545", fontSize: 13, display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="fa-solid fa-circle-exclamation" /><span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Personal Info */}
          <div className="gum-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-user" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Personal Information
              </h3>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="First Name *" error={errors.firstName}>
                <input type="text" value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} style={inputStyle(!!errors.firstName)} />
              </Field>
              <Field label="Last Name *" error={errors.lastName}>
                <input type="text" value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} style={inputStyle(!!errors.lastName)} />
              </Field>
              <Field label="Email" error={errors.email}>
                <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} style={inputStyle(!!errors.email)} />
              </Field>
              <Field label="Mobile">
                <input type="text" value={form.mobile} onChange={(e) => updateField("mobile", e.target.value)} style={inputStyle(false)} />
              </Field>
            </div>
          </div>

          {/* Settings */}
          <div className="gum-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-gear" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Account Settings
              </h3>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <Toggle label="Active Account" checked={form.isActive} onChange={(v) => updateField("isActive", v)} />
              <Toggle label="Email Verified" checked={form.isEmailVerified} onChange={(v) => updateField("isEmailVerified", v)} />
              <Toggle label="Mobile Verified" checked={form.isMobileVerified} onChange={(v) => updateField("isMobileVerified", v)} />

              {/* Meta Info */}
              <div style={{ marginTop: 16, padding: 16, background: "var(--gum-bg)", borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: "var(--gum-text-muted)", marginBottom: 6 }}>
                  <strong>Created:</strong> {new Date(user.createdAt).toLocaleString("en-IN")}
                </p>
                <p style={{ fontSize: 12, color: "var(--gum-text-muted)", marginBottom: 6 }}>
                  <strong>Updated:</strong> {new Date(user.updatedAt).toLocaleString("en-IN")}
                </p>
                {user.lastLogin && (
                  <p style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>
                    <strong>Last Login:</strong> {new Date(user.lastLogin).toLocaleString("en-IN")}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Link href="/users" style={{
            height: 42, padding: "0 24px", background: "var(--gum-surface)", color: "var(--gum-text)",
            border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 14, fontWeight: 500,
            display: "flex", alignItems: "center", textDecoration: "none",
          }}>
            Cancel
          </Link>
          <button type="submit" disabled={isSubmitting} style={{
            height: 42, padding: "0 28px", background: "var(--gum-primary)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
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

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--gum-primary)" }} />
      <span style={{ fontSize: 13, color: "var(--gum-text)" }}>{label}</span>
    </label>
  );
}

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%", height: 40, padding: "0 12px",
  background: "var(--gum-input-bg)", border: `1px solid ${hasError ? "#DC3545" : "var(--gum-border)"}`,
  borderRadius: 8, fontSize: 13, color: "var(--gum-text)",
});

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    return axiosErr.response?.data?.message || "An error occurred";
  }
  return "Network error";
}

export default withPermission(EditUserPage, PERMISSIONS.USER_UPDATE);
