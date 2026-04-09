"use client";
/* ================================================================
   Global 404 Page — Branded "Page Not Found"
   ================================================================ */
import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--gum-bg)", padding: 20,
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", margin: "0 auto 24px",
          background: "linear-gradient(135deg, var(--gum-primary), #6BB5FF)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#fff" }}>404</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--gum-text)", marginBottom: 8 }}>
          Page Not Found
        </h1>
        <p style={{ fontSize: 15, color: "var(--gum-text-muted)", marginBottom: 32, lineHeight: 1.6 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/dashboard" style={{
            height: 42, padding: "0 24px", background: "var(--gum-primary)", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
          }}>
            <i className="fa-solid fa-gauge-high" /> Dashboard
          </Link>
          <button onClick={() => window.history.back()} style={{
            height: 42, padding: "0 24px", background: "var(--gum-surface)", color: "var(--gum-text)",
            border: "1px solid var(--gum-border)", borderRadius: 10, fontSize: 14, fontWeight: 500,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <i className="fa-solid fa-arrow-left" /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
