"use client";
/* ================================================================
   Create User Page — Form with Zod-style validation
   Protected by user.create permission
   ================================================================ */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createUser } from "@/services/userService";
import { toast } from "@/store/toastStore";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  countryId: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
}

interface FormErrors {
  [key: string]: string;
}

function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    countryId: "",
    isActive: true,
    isEmailVerified: false,
    isMobileVerified: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ─── Validation ─────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (form.firstName.trim().length < 2) errs.firstName = "First name must be at least 2 characters";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (!form.email.trim() && !form.mobile.trim()) errs.email = "Either email or mobile is required";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email format";
    if (form.mobile && !/^\+?\d{7,20}$/.test(form.mobile.replace(/\s/g, ""))) errs.mobile = "Invalid mobile number";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
    if (!/[A-Z]/.test(form.password)) errs.password = "Must contain an uppercase letter";
    if (!/[a-z]/.test(form.password)) errs.password = "Must contain a lowercase letter";
    if (!/[0-9]/.test(form.password)) errs.password = "Must contain a number";
    if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords do not match";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Submit ─────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        password: form.password,
        countryId: form.countryId ? Number(form.countryId) : undefined,
        isActive: form.isActive,
        isEmailVerified: form.isEmailVerified,
        isMobileVerified: form.isMobileVerified,
      };

      const response = await createUser(payload);
      toast.success("User created", `User #${response.data.id} has been created successfully.`);
      router.push("/users");
    } catch (err: unknown) {
      const message = extractError(err);
      setApiError(message);
      toast.error("Failed to create user", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
    setApiError(null);
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Create User</h1>
          <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>Add a new user to the system</p>
        </div>
        <Link
          href="/users"
          style={{
            height: 38, padding: "0 16px", background: "var(--gum-surface)", color: "var(--gum-text)",
            border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, fontWeight: 500,
            display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
          }}
        >
          <i className="fa-solid fa-arrow-left" /> Back
        </Link>
      </div>

      {/* API Error */}
      {apiError && (
        <div style={{
          padding: "12px 16px", marginBottom: 20, borderRadius: 8,
          background: "rgba(220,53,69,0.1)", border: "1px solid rgba(220,53,69,0.3)",
          color: "#DC3545", fontSize: 13, display: "flex", alignItems: "center", gap: 10,
        }}>
          <i className="fa-solid fa-circle-exclamation" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Left Column — Personal Info */}
          <div className="gum-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-user" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Personal Information
              </h3>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <FormField label="First Name *" error={errors.firstName}>
                <input
                  type="text" placeholder="e.g. Rajesh" value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  style={inputStyle(!!errors.firstName)}
                />
              </FormField>
              <FormField label="Last Name *" error={errors.lastName}>
                <input
                  type="text" placeholder="e.g. Kumar" value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  style={inputStyle(!!errors.lastName)}
                />
              </FormField>
              <FormField label="Email" error={errors.email}>
                <input
                  type="email" placeholder="user@company.com" value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  style={inputStyle(!!errors.email)}
                />
              </FormField>
              <FormField label="Mobile" error={errors.mobile}>
                <input
                  type="text" placeholder="+919876543210" value={form.mobile}
                  onChange={(e) => updateField("mobile", e.target.value)}
                  style={inputStyle(!!errors.mobile)}
                />
              </FormField>
            </div>
          </div>

          {/* Right Column — Security & Settings */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="gum-card">
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                  <i className="fa-solid fa-lock" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                  Security
                </h3>
              </div>
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                <FormField label="Password *" error={errors.password}>
                  <input
                    type="password" placeholder="Min 8 chars, upper + lower + number" value={form.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    style={inputStyle(!!errors.password)}
                  />
                </FormField>
                <FormField label="Confirm Password *" error={errors.confirmPassword}>
                  <input
                    type="password" placeholder="Re-enter password" value={form.confirmPassword}
                    onChange={(e) => updateField("confirmPassword", e.target.value)}
                    style={inputStyle(!!errors.confirmPassword)}
                  />
                </FormField>
              </div>
            </div>

            <div className="gum-card">
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                  <i className="fa-solid fa-gear" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                  Settings
                </h3>
              </div>
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <ToggleField
                  label="Active Account" checked={form.isActive}
                  onChange={(v) => updateField("isActive", v)}
                />
                <ToggleField
                  label="Email Verified" checked={form.isEmailVerified}
                  onChange={(v) => updateField("isEmailVerified", v)}
                />
                <ToggleField
                  label="Mobile Verified" checked={form.isMobileVerified}
                  onChange={(v) => updateField("isMobileVerified", v)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <Link
            href="/users"
            style={{
              height: 42, padding: "0 24px", background: "var(--gum-surface)", color: "var(--gum-text)",
              border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 14, fontWeight: 500,
              display: "flex", alignItems: "center", textDecoration: "none",
            }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              height: 42, padding: "0 28px", background: "var(--gum-primary)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            {isSubmitting ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-user-plus" />}
            {isSubmitting ? "Creating..." : "Create User"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--gum-text)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {error && (
        <p style={{ fontSize: 12, color: "#DC3545", marginTop: 4 }}>
          <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />
          {error}
        </p>
      )}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      <input
        type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: "var(--gum-primary)" }}
      />
      <span style={{ fontSize: 13, color: "var(--gum-text)" }}>{label}</span>
    </label>
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
    const axiosErr = err as { response?: { data?: { message?: string; errors?: { field: string; message: string }[] } } };
    if (axiosErr.response?.data?.errors?.length) {
      return axiosErr.response.data.errors.map((e) => `${e.field}: ${e.message}`).join(". ");
    }
    return axiosErr.response?.data?.message || "An error occurred";
  }
  return "Network error. Please try again.";
}

export default withPermission(CreateUserPage, PERMISSIONS.USER_CREATE);
