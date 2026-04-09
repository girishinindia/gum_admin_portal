"use client";
/* ================================================================
   Auth Layout — Split-screen design for login / register / forgot
   Left: Brand panel  |  Right: Form
   Uses class names from _components.scss (.gum-auth__left / __right)
   ================================================================ */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // ─── Redirect to dashboard if already logged in ─────────────
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // ─── Still initializing auth ────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="gum-auth"
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i
          className="fa-solid fa-spinner fa-spin"
          style={{ fontSize: 32, color: "var(--gum-primary)" }}
        />
      </div>
    );
  }

  // ─── Authenticated — redirect will happen ───────────────────
  if (isAuthenticated) return null;

  return (
    <div className="gum-auth">
      {/* ─── Left Brand Panel ─────────────────────────────── */}
      <div className="gum-auth__left">
        <div className="gum-auth__left-content">
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 24,
            }}
          >
            G
          </div>
          <h1 className="gum-auth__left-title">GrowUpMore</h1>
          <p className="gum-auth__left-desc">
            Enterprise Administration Portal — Manage users, roles, permissions,
            and system configuration.
          </p>
        </div>
      </div>

      {/* ─── Right Form Panel ─────────────────────────────── */}
      <div className="gum-auth__right">
        <div className="gum-auth__form-container">{children}</div>
      </div>
    </div>
  );
}
