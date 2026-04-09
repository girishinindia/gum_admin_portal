"use client";
/* ================================================================
   Dashboard Layout — Sidebar + Topbar + Content + Footer
   All authenticated pages use this layout
   ================================================================ */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import Footer from "@/components/layout/Footer";
import { useAuthStore } from "@/store/authStore";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  // ─── Redirect to login if not authenticated ────────────────
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  // ─── Loading state ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="gum-app">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            width: "100%",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <i
              className="fa-solid fa-spinner fa-spin"
              style={{ fontSize: 32, color: "var(--gum-primary)" }}
            />
            <p
              style={{
                marginTop: 16,
                color: "var(--gum-text-muted)",
                fontSize: 14,
              }}
            >
              Loading...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Not authenticated — will redirect ──────────────────────
  if (!isAuthenticated) return null;

  return (
    <div className="gum-app">
      <Sidebar />
      <div className="gum-main">
        <Topbar />
        <main className="gum-content fade-in">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
