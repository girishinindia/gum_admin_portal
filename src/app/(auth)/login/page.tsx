"use client";
/* ================================================================
   Login Page — Wired to GrowUpMore Auth API
   ================================================================ */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { login, authError, clearError, isLoading } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    // ─── Client-side validation ───────────────────────────
    if (!email.trim()) {
      setLocalError("Please enter your email address.");
      return;
    }
    if (!password) {
      setLocalError("Please enter your password.");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email: email.trim(), password });
      router.push("/dashboard");
    } catch {
      // Error is already set in authStore
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
      {/* ─── Header ──────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "var(--gum-text)",
            marginBottom: 8,
          }}
        >
          Welcome back
        </h2>
        <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>
          Sign in to your admin account to continue
        </p>
      </div>

      {/* ─── Error Alert ─────────────────────────────────── */}
      {displayError && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 20,
            borderRadius: 8,
            background: "var(--gum-danger-bg, rgba(220, 53, 69, 0.1))",
            border: "1px solid var(--gum-danger-border, rgba(220, 53, 69, 0.3))",
            color: "var(--gum-danger, #DC3545)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <i className="fa-solid fa-circle-exclamation" />
          <span>{displayError}</span>
        </div>
      )}

      {/* ─── Login Form ──────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="email"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--gum-text)",
              marginBottom: 6,
            }}
          >
            Email Address
          </label>
          <div style={{ position: "relative" }}>
            <i
              className="fa-solid fa-envelope"
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 14,
                color: "var(--gum-text-muted)",
              }}
            />
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setLocalError(null);
                clearError();
              }}
              required
              autoComplete="email"
              autoFocus
              disabled={isSubmitting}
              style={{
                paddingLeft: 40,
                height: 44,
                background: "var(--gum-input-bg)",
                border: `1px solid ${displayError ? "var(--gum-danger, #DC3545)" : "var(--gum-border)"}`,
                color: "var(--gum-text)",
                borderRadius: 8,
                width: "100%",
              }}
            />
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <label
              htmlFor="password"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "var(--gum-text)",
              }}
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              style={{
                fontSize: 12,
                color: "var(--gum-primary)",
                fontWeight: 500,
              }}
            >
              Forgot password?
            </Link>
          </div>
          <div style={{ position: "relative" }}>
            <i
              className="fa-solid fa-lock"
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 14,
                color: "var(--gum-text-muted)",
              }}
            />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setLocalError(null);
                clearError();
              }}
              required
              autoComplete="current-password"
              disabled={isSubmitting}
              style={{
                paddingLeft: 40,
                paddingRight: 44,
                height: 44,
                background: "var(--gum-input-bg)",
                border: `1px solid ${displayError ? "var(--gum-danger, #DC3545)" : "var(--gum-border)"}`,
                color: "var(--gum-text)",
                borderRadius: 8,
                width: "100%",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--gum-text-muted)",
                padding: 4,
              }}
              tabIndex={-1}
            >
              <i
                className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                style={{ fontSize: 14 }}
              />
            </button>
          </div>
        </div>

        {/* Remember Me */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          <input
            type="checkbox"
            id="remember"
            style={{
              width: 16,
              height: 16,
              accentColor: "var(--gum-primary)",
            }}
          />
          <label
            htmlFor="remember"
            style={{ fontSize: 13, color: "var(--gum-text-muted)" }}
          >
            Remember me for 30 days
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || isLoading}
          style={{
            width: "100%",
            height: 44,
            background: "var(--gum-primary)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: isSubmitting ? "not-allowed" : "pointer",
            opacity: isSubmitting ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.2s ease",
          }}
        >
          {isSubmitting ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" />
              Signing in...
            </>
          ) : (
            <>
              <i className="fa-solid fa-right-to-bracket" />
              Sign In
            </>
          )}
        </button>
      </form>

      {/* ─── Footer ──────────────────────────────────────── */}
      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 13,
          color: "var(--gum-text-muted)",
        }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          style={{ color: "var(--gum-primary)", fontWeight: 500 }}
        >
          Request Access
        </Link>
      </p>
    </div>
  );
}
