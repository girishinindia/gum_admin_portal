"use client";
/* ================================================================
   Global Error Boundary — Catches unhandled errors
   ================================================================ */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--gum-bg)", padding: 20,
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%", margin: "0 auto 24px",
          background: "#DC354515",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 32, color: "#DC3545" }} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--gum-text)", marginBottom: 8 }}>
          Something Went Wrong
        </h1>
        <p style={{ fontSize: 15, color: "var(--gum-text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p style={{ fontSize: 12, color: "var(--gum-text-muted)", marginBottom: 24 }}>
            Error ID: <code style={{ background: "var(--gum-bg)", padding: "2px 6px", borderRadius: 4 }}>{error.digest}</code>
          </p>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button onClick={reset} style={{
            height: 42, padding: "0 24px", background: "var(--gum-primary)", color: "#fff",
            border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
          }}>
            <i className="fa-solid fa-rotate-right" /> Try Again
          </button>
          <a href="/dashboard" style={{
            height: 42, padding: "0 24px", background: "var(--gum-surface)", color: "var(--gum-text)",
            border: "1px solid var(--gum-border)", borderRadius: 10, fontSize: 14, fontWeight: 500,
            display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none",
          }}>
            <i className="fa-solid fa-gauge-high" /> Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
