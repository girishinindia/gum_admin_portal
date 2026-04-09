"use client";
/* ================================================================
   Register Page — Phase 1 Shell (wired in Phase 2)
   ================================================================ */
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
      <div
        style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "var(--gum-primary)", opacity: 0.15,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}
      >
        <i className="fa-solid fa-user-plus" style={{ fontSize: 28, color: "var(--gum-primary)" }} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 8 }}>
        Request Access
      </h2>
      <p style={{ fontSize: 14, color: "var(--gum-text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
        Account registration requires administrator approval. Please contact your system administrator to request access.
      </p>
      <Link
        href="/login"
        style={{
          color: "var(--gum-primary)", fontWeight: 500, fontSize: 14,
        }}
      >
        <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
        Back to Sign In
      </Link>
    </div>
  );
}
