"use client";
/* ================================================================
   Settings Page — System configuration & info panels
   ================================================================ */
import { useState, useEffect } from "react";
import { fetchHealthCheck } from "@/services/dashboardService";
import { withPermission } from "@/lib/rbac/withPermission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { HealthCheck } from "@/types";

function SettingsPage() {
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = () => {
    setHealthLoading(true);
    fetchHealthCheck()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => { setHealthLoading(false); setRefreshing(false); });
  };

  useEffect(() => { loadHealth(); }, []);

  const handleRefresh = () => { setRefreshing(true); loadHealth(); };

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>System configuration, health monitoring, and application info</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* System Health */}
        <div className="gum-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
              <i className="fa-solid fa-heart-pulse" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
              System Health
            </h3>
            <button onClick={handleRefresh} disabled={refreshing}
              style={{ height: 32, padding: "0 14px", background: "var(--gum-surface)", color: "var(--gum-primary)", border: "1px solid var(--gum-border)", borderRadius: 6, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <i className={`fa-solid fa-arrows-rotate ${refreshing ? "fa-spin" : ""}`} /> Refresh
            </button>
          </div>
          <div style={{ padding: 20 }}>
            {healthLoading ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--gum-text-muted)" }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }} />Checking system health...
              </div>
            ) : health ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <HealthCard name="API Server" status="healthy" detail={`v${health.version} — ${health.environment}`} />
                {health.services?.database && (
                  <HealthCard name="Database" status={health.services.database.status === "connected" ? "healthy" : "degraded"} detail={`Latency: ${health.services.database.latency}`} />
                )}
                {health.services?.redis && (
                  <HealthCard name="Redis Cache" status={health.services.redis.status === "connected" ? "healthy" : "degraded"} detail={`Latency: ${health.services.redis.latency}`} />
                )}
                <HealthCard name="Uptime" status="healthy" detail={formatUptime(health.uptime)} />
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 20 }}>
                <i className="fa-solid fa-circle-xmark" style={{ fontSize: 24, color: "#DC3545", marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: "#DC3545" }}>Unable to reach API server</p>
              </div>
            )}
          </div>
        </div>

        {/* General Settings */}
        <div className="gum-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
              <i className="fa-solid fa-gear" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
              General
            </h3>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <SettingRow label="Application" value="GrowUpMore Admin Portal" />
            <SettingRow label="Environment" value={health?.environment || "—"} />
            <SettingRow label="API Version" value={health?.version || "—"} />
            <SettingRow label="Timezone" value="Asia/Kolkata" />
            <SettingRow label="Framework" value="Next.js 16.2.3 + React 19" />
            <SettingRow label="UI Components" value="Kendo UI (jQuery) + Bootstrap 5.3.8" />
            <SettingRow label="State Management" value="Zustand 5" />
          </div>
        </div>

        {/* Security */}
        <div className="gum-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
              <i className="fa-solid fa-shield-halved" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
              Security
            </h3>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <SettingRow label="Authentication" value="JWT (Access + Refresh)" />
            <SettingRow label="Access Token" value="In-memory (Zustand)" />
            <SettingRow label="Refresh Token" value="localStorage" />
            <SettingRow label="RBAC" value="4-level guard system" />
            <SettingRow label="Auto-refresh" value="401 interceptor with queue" />
            <SettingRow label="Password Policy" value="Min 8 chars, uppercase, number, special" />
          </div>
        </div>

        {/* API Configuration */}
        <div className="gum-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
              <i className="fa-solid fa-code" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
              API Configuration
            </h3>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <SettingRow label="Base URL" value={process.env.NEXT_PUBLIC_API_URL || "https://api.growupmore.com/api/v1"} />
            <SettingRow label="Timeout" value="30 seconds" />
            <SettingRow label="Total Endpoints" value="73" />
            <SettingRow label="Auth Endpoints" value="/auth/login, /auth/refresh, /auth/logout" />
            <SettingRow label="Roles" value="8 system roles" />
            <SettingRow label="Permission Codes" value="100+" />
          </div>
        </div>

        {/* Theme & UI */}
        <div className="gum-card">
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--gum-border)" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
              <i className="fa-solid fa-palette" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
              Theme & UI
            </h3>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            <SettingRow label="Theme Engine" value="next-themes (data-theme)" />
            <SettingRow label="Modes" value="Light + Dark" />
            <SettingRow label="Primary Color" value="#4A90D9" />
            <SettingRow label="Kendo Theme" value="Bootstrap (auto-switch)" />
            <SettingRow label="Icons" value="FontAwesome 6" />
            <SettingRow label="Font" value="Inter (Google Fonts)" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function HealthCard({ name, status, detail }: { name: string; status: string; detail: string }) {
  const isHealthy = status === "healthy" || status === "connected";
  const color = isHealthy ? "#198754" : "#F59E0B";

  return (
    <div style={{ padding: "16px", background: "var(--gum-bg)", borderRadius: 10, border: `1px solid ${color}20` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--gum-text)" }}>{name}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}60` }} />
          <span style={{ fontSize: 11, fontWeight: 500, color, textTransform: "capitalize" }}>
            {isHealthy ? "Healthy" : status}
          </span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--gum-text-muted)" }}>{detail}</p>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
      <span style={{ fontSize: 13, color: "var(--gum-text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)", textAlign: "right", maxWidth: "60%" }}>
        {value}
      </span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} day${d > 1 ? "s" : ""}, ${h}h ${m}m`;
  if (h > 0) return `${h} hour${h > 1 ? "s" : ""}, ${m}m`;
  return `${m} minute${m !== 1 ? "s" : ""}`;
}

export default withPermission(SettingsPage, PERMISSIONS.PERMISSION_MANAGE);
