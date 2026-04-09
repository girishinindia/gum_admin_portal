"use client";
/* ================================================================
   User Profile Page — View & edit own profile
   Uses /users/me endpoints (no special permission needed)
   ================================================================ */
import { useState, useEffect } from "react";
import { fetchMyProfile, updateMyProfile } from "@/services/userService";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import StatusBadge from "@/components/ui/StatusBadge";
import type { User } from "@/types";

interface ProfileForm {
  firstName: string;
  lastName: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileForm>({ firstName: "", lastName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Load Profile ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const response = await fetchMyProfile();
        const u = response.data;
        setUser(u);
        setForm({ firstName: u.firstName, lastName: u.lastName });
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Validation ───────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (form.firstName.trim().length < 2) errs.firstName = "First name must be at least 2 characters";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ─── Submit ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await updateMyProfile({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
      });

      // Update local state
      setUser((prev) => prev ? { ...prev, firstName: form.firstName.trim(), lastName: form.lastName.trim() } : prev);

      // Update authStore user so topbar/sidebar reflect the new name
      const state = useAuthStore.getState();
      if (state.user) {
        useAuthStore.setState({
          user: { ...state.user, firstName: form.firstName.trim(), lastName: form.lastName.trim() },
        });
      }

      toast.success("Profile updated", "Your profile has been updated successfully.");
      setEditing(false);
    } catch (err: unknown) {
      const msg = extractError(err);
      toast.error("Failed to update profile", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (user) setForm({ firstName: user.firstName, lastName: user.lastName });
    setErrors({});
    setEditing(false);
  };

  // ─── Loading State ────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 24, color: "var(--gum-primary)" }} />
        <p style={{ marginTop: 12, color: "var(--gum-text-muted)", fontSize: 14 }}>Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <i className="fa-solid fa-circle-exclamation" style={{ fontSize: 28, color: "#DC3545" }} />
        <p style={{ marginTop: 12, color: "var(--gum-text-muted)", fontSize: 14 }}>Could not load your profile.</p>
      </div>
    );
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>My Profile</h1>
        <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>View and update your account information</p>
      </div>

      {/* Profile Header Card */}
      <div className="gum-card" style={{ marginBottom: 20 }}>
        <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 20 }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--gum-primary), #6BB5FF)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 24, fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>
              {user.firstName} {user.lastName}
            </h2>
            <p style={{ fontSize: 13, color: "var(--gum-text-muted)", marginBottom: 8 }}>
              User #{user.id}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge
                variant={user.isActive ? "active" : "inactive"}
                label={user.isActive ? "Active" : "Inactive"}
                icon={user.isActive ? "fa-check-circle" : "fa-times-circle"}
              />
              {user.isEmailVerified && (
                <StatusBadge variant="verified" label="Email Verified" icon="fa-envelope" />
              )}
              {user.isMobileVerified && (
                <StatusBadge variant="verified" label="Mobile Verified" icon="fa-phone" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Personal Information */}
        <div className="gum-card">
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid var(--gum-border)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
              <i className="fa-solid fa-user" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
              Personal Information
            </h3>
            {!editing && (
              <button onClick={() => setEditing(true)} style={{
                height: 32, padding: "0 14px", background: "var(--gum-surface)",
                color: "var(--gum-primary)", border: "1px solid var(--gum-border)",
                borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <i className="fa-solid fa-pen" /> Edit
              </button>
            )}
          </div>

          <div style={{ padding: 20 }}>
            {editing ? (
              /* ─── Edit Mode ────────────────────────────────────── */
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    type="text" value={form.firstName}
                    onChange={(e) => { setForm((f) => ({ ...f, firstName: e.target.value })); if (errors.firstName) setErrors((e2) => { const n = { ...e2 }; delete n.firstName; return n; }); }}
                    style={inputStyle(!!errors.firstName)}
                  />
                  {errors.firstName && <p style={errorStyle}><i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />{errors.firstName}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input
                    type="text" value={form.lastName}
                    onChange={(e) => { setForm((f) => ({ ...f, lastName: e.target.value })); if (errors.lastName) setErrors((e2) => { const n = { ...e2 }; delete n.lastName; return n; }); }}
                    style={inputStyle(!!errors.lastName)}
                  />
                  {errors.lastName && <p style={errorStyle}><i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }} />{errors.lastName}</p>}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={handleCancel} style={{
                    height: 36, padding: "0 18px", background: "var(--gum-surface)", color: "var(--gum-text)",
                    border: "1px solid var(--gum-border)", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
                  }}>
                    Cancel
                  </button>
                  <button type="button" onClick={handleSave} disabled={isSubmitting} style={{
                    height: 36, padding: "0 18px", background: "var(--gum-primary)", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: isSubmitting ? "not-allowed" : "pointer", opacity: isSubmitting ? 0.7 : 1,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    {isSubmitting ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-floppy-disk" />}
                    {isSubmitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              /* ─── View Mode ────────────────────────────────────── */
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <InfoRow icon="fa-user" label="First Name" value={user.firstName} />
                <InfoRow icon="fa-user" label="Last Name" value={user.lastName} />
                <InfoRow icon="fa-envelope" label="Email" value={user.email || "—"} />
                <InfoRow icon="fa-phone" label="Mobile" value={user.mobile || "—"} />
                {user.country && (
                  <InfoRow icon="fa-globe" label="Country" value={user.country.name} />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Account Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Verification Status */}
          <div className="gum-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-shield-halved" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Verification Status
              </h3>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <VerificationRow
                label="Email Verification"
                verified={user.isEmailVerified}
                verifiedAt={user.emailVerifiedAt}
                value={user.email}
              />
              <VerificationRow
                label="Mobile Verification"
                verified={user.isMobileVerified}
                verifiedAt={user.mobileVerifiedAt}
                value={user.mobile}
              />
            </div>
          </div>

          {/* Account Meta */}
          <div className="gum-card">
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Account Activity
              </h3>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <InfoRow icon="fa-calendar-plus" label="Account Created" value={new Date(user.createdAt).toLocaleString("en-IN")} />
              <InfoRow icon="fa-calendar-check" label="Last Updated" value={new Date(user.updatedAt).toLocaleString("en-IN")} />
              <InfoRow
                icon="fa-right-to-bracket"
                label="Last Login"
                value={user.lastLogin ? new Date(user.lastLogin).toLocaleString("en-IN") : "Never"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <i className={`fa-solid ${icon}`} style={{ width: 16, fontSize: 13, color: "var(--gum-text-muted)", textAlign: "center" }} />
      <div>
        <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)" }}>{value}</p>
      </div>
    </div>
  );
}

function VerificationRow({ label, verified, verifiedAt, value }: {
  label: string;
  verified: boolean;
  verifiedAt: string | null;
  value: string | null;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 14px", background: "var(--gum-bg)", borderRadius: 8,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)", marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>
          {value || "Not set"}
          {verified && verifiedAt && ` — Verified ${new Date(verifiedAt).toLocaleDateString("en-IN")}`}
        </p>
      </div>
      <StatusBadge
        variant={verified ? "verified" : "pending"}
        label={verified ? "Verified" : "Pending"}
        icon={verified ? "fa-check" : "fa-clock"}
      />
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 500,
  color: "var(--gum-text)", marginBottom: 6,
};

const inputStyle = (hasError: boolean): React.CSSProperties => ({
  width: "100%", height: 40, padding: "0 12px",
  background: "var(--gum-input-bg)",
  border: `1px solid ${hasError ? "#DC3545" : "var(--gum-border)"}`,
  borderRadius: 8, fontSize: 13, color: "var(--gum-text)",
});

const errorStyle: React.CSSProperties = {
  fontSize: 12, color: "#DC3545", marginTop: 4,
};

function extractError(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    return axiosErr.response?.data?.message || "An error occurred";
  }
  return "Network error";
}
