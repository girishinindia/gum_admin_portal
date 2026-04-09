"use client";
/* ================================================================
   Forgot Password Page — Phase 1 Shell
   ================================================================ */
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO Phase 2: Wire up password reset API
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  if (submitted) {
    return (
      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "var(--gum-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <i className="fa-solid fa-envelope-circle-check" style={{ fontSize: 28, color: "#fff" }} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 8 }}>
          Check your email
        </h2>
        <p style={{ fontSize: 14, color: "var(--gum-text-muted)", marginBottom: 24 }}>
          If an account with that email exists, we&apos;ve sent a password reset link.
        </p>
        <Link
          href="/login"
          style={{
            color: "var(--gum-primary)",
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: "var(--gum-text)", marginBottom: 8 }}>
          Reset your password
        </h2>
        <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="email"
            style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--gum-text)", marginBottom: 6 }}
          >
            Email Address
          </label>
          <div style={{ position: "relative" }}>
            <i
              className="fa-solid fa-envelope"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "var(--gum-text-muted)" }}
            />
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                paddingLeft: 40, height: 44, background: "var(--gum-input-bg)",
                border: "1px solid var(--gum-border)", color: "var(--gum-text)", borderRadius: 8,
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%", height: 44, background: "var(--gum-primary)", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.7 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          {isSubmitting ? (
            <><i className="fa-solid fa-spinner fa-spin" /> Sending...</>
          ) : (
            <><i className="fa-solid fa-paper-plane" /> Send Reset Link</>
          )}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--gum-text-muted)" }}>
        <Link href="/login" style={{ color: "var(--gum-primary)", fontWeight: 500 }}>
          <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }} />
          Back to Sign In
        </Link>
      </p>
    </div>
  );
}
