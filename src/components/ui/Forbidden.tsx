"use client";
/* ================================================================
   Forbidden — 403 Access Denied component
   Shown when a user lacks the required permission for a page
   ================================================================ */
import Link from "next/link";

export default function Forbidden() {
  return (
    <div
      className="fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        textAlign: "center",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "rgba(220, 53, 69, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <i
          className="fa-solid fa-shield-halved"
          style={{ fontSize: 36, color: "#DC3545" }}
        />
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "var(--gum-text)",
          marginBottom: 8,
        }}
      >
        Access Denied
      </h1>

      {/* Description */}
      <p
        style={{
          fontSize: 15,
          color: "var(--gum-text-muted)",
          maxWidth: 440,
          lineHeight: 1.6,
          marginBottom: 28,
        }}
      >
        You don&apos;t have permission to access this page. If you believe this
        is an error, contact your system administrator.
      </p>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12 }}>
        <Link
          href="/dashboard"
          style={{
            height: 40,
            padding: "0 24px",
            background: "var(--gum-primary)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
          }}
        >
          <i className="fa-solid fa-house" />
          Go to Dashboard
        </Link>
        <button
          onClick={() => window.history.back()}
          style={{
            height: 40,
            padding: "0 24px",
            background: "var(--gum-surface)",
            color: "var(--gum-text)",
            border: "1px solid var(--gum-border)",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="fa-solid fa-arrow-left" />
          Go Back
        </button>
      </div>

      {/* Error code */}
      <p
        style={{
          marginTop: 32,
          fontSize: 12,
          color: "var(--gum-text-muted)",
          opacity: 0.6,
        }}
      >
        Error 403 — Forbidden
      </p>
    </div>
  );
}
