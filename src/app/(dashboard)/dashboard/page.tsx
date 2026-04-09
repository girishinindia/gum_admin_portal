"use client";
/* ================================================================
   Dashboard Page — Live KPIs, Recent Activity, System Health
   Phase 8: Real data from aggregated API calls
   ================================================================ */
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  fetchDashboardStats,
  fetchRecentActivity,
  fetchHealthCheck,
  type DashboardStats,
} from "@/services/dashboardService";
import { useAuthStore } from "@/store/authStore";
import type { RoleChangeLog, HealthCheck } from "@/types";

const ACTION_CONFIG: Record<string, { icon: string; color: string; bg: string; verb: string }> = {
  assigned: { icon: "fa-user-plus", color: "#198754", bg: "#19875412", verb: "assigned to" },
  revoked: { icon: "fa-user-minus", color: "#DC3545", bg: "#DC354512", verb: "revoked from" },
  expired: { icon: "fa-clock", color: "#F59E0B", bg: "#F59E0B12", verb: "expired for" },
  modified: { icon: "fa-pen", color: "#4A90D9", bg: "#4A90D912", verb: "modified for" },
  restored: { icon: "fa-rotate-left", color: "#6366F1", bg: "#6366F112", verb: "restored for" },
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RoleChangeLog[]>([]);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    // Load stats first (internally batched), then activity after a gap
    fetchDashboardStats()
      .then((s) => { if (s) setStats(s); })
      .catch(() => {})
      .then(() => fetchRecentActivity(8))
      .then((a) => { if (Array.isArray(a)) setActivity(a); })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Health check runs independently with a small delay
    const healthTimer = setTimeout(() => {
      fetchHealthCheck()
        .then(setHealth)
        .catch(() => {})
        .finally(() => setHealthLoading(false));
    }, 800);
    return () => clearTimeout(healthTimer);
  }, []);

  const greeting = getGreeting();

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--gum-text)", marginBottom: 4 }}>
          {greeting}, {user?.firstName || "Admin"}
        </h1>
        <p style={{ fontSize: 14, color: "var(--gum-text-muted)" }}>
          Here&apos;s an overview of your GrowUpMore system.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <KpiCard icon="fa-users" color="#4A90D9" label="Total Users" value={stats?.totalUsers} sub={stats ? `${stats.activeUsers} active` : undefined} loading={loading} href="/users" />
        <KpiCard icon="fa-shield-halved" color="#48BB78" label="Roles" value={stats?.totalRoles} sub={stats ? `${stats.totalAssignments} assignments` : undefined} loading={loading} href="/roles" />
        <KpiCard icon="fa-key" color="#ED8936" label="Permissions" value={stats?.totalPermissions} sub={stats ? `${stats.totalModules} modules` : undefined} loading={loading} href="/permissions" />
        <KpiCard icon="fa-clock-rotate-left" color="#9F7AEA" label="Audit Events Today" value={stats?.auditEventsToday} loading={loading} href="/audit-log" />
      </div>

      {/* Main content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* Left — Recent Activity */}
        <div className="gum-card">
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--gum-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
              Recent Activity
            </h3>
            <Link href="/audit-log" style={{ fontSize: 12, color: "var(--gum-primary)", textDecoration: "none" }}>
              View All <i className="fa-solid fa-arrow-right" style={{ marginLeft: 4, fontSize: 10 }} />
            </Link>
          </div>
          <div style={{ padding: loading ? 40 : 0 }}>
            {loading ? (
              <div style={{ textAlign: "center", color: "var(--gum-text-muted)" }}>
                <i className="fa-solid fa-spinner fa-spin" /> Loading...
              </div>
            ) : activity.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "var(--gum-text-muted)", fontSize: 13 }}>
                No recent activity
              </div>
            ) : activity.map((log, i) => {
              const cfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.modified;
              return (
                <div key={log.id} style={{ padding: "12px 20px", borderBottom: i < activity.length - 1 ? "1px solid var(--gum-border)" : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: 12, color: cfg.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: "var(--gum-text)", lineHeight: 1.4 }}>
                      <strong>{log.roleName}</strong>{" "}
                      <span style={{ color: cfg.color, fontWeight: 500 }}>{cfg.verb}</span>{" "}
                      <strong>{log.userFirstName} {log.userLastName}</strong>
                    </p>
                    {log.reason && (
                      <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 2, fontStyle: "italic" }}>
                        {log.reason}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 3 }}>
                      {formatTimeAgo(log.createdAt)} · by {log.changedByEmail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* System Health */}
          <div className="gum-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-heart-pulse" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                System Health
              </h3>
            </div>
            <div style={{ padding: 16 }}>
              {healthLoading ? (
                <div style={{ textAlign: "center", padding: 20, color: "var(--gum-text-muted)" }}>
                  <i className="fa-solid fa-spinner fa-spin" /> Checking...
                </div>
              ) : health ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--gum-bg)", borderRadius: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gum-text)" }}>API Server</span>
                    <HealthDot status="healthy" />
                  </div>
                  {health.services && (
                    <>
                      <ServiceRow name="Database" service={health.services.database} />
                      <ServiceRow name="Redis" service={health.services.redis} />
                    </>
                  )}
                  <div style={{ fontSize: 11, color: "var(--gum-text-muted)", padding: "4px 12px" }}>
                    <span>Version: {health.version}</span>
                    <span style={{ marginLeft: 12 }}>Env: {health.environment}</span>
                    <br />
                    <span>Uptime: {formatUptime(health.uptime)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <HealthDot status="down" />
                  <p style={{ fontSize: 12, color: "#DC3545", marginTop: 8 }}>Unable to reach API server</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="gum-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-bolt" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                Quick Actions
              </h3>
            </div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <QuickAction href="/users/create" icon="fa-user-plus" label="Create User" color="#4A90D9" />
              <QuickAction href="/roles/create" icon="fa-shield-halved" label="Create Role" color="#48BB78" />
              <QuickAction href="/role-permissions" icon="fa-user-lock" label="Manage Role Permissions" color="#ED8936" />
              <QuickAction href="/user-role-assignments" icon="fa-user-tag" label="Assign Roles to Users" color="#9F7AEA" />
              <QuickAction href="/audit-log" icon="fa-clock-rotate-left" label="View Audit Log" color="#6366F1" />
            </div>
          </div>

          {/* System Info */}
          <div className="gum-card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--gum-border)" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--gum-text)" }}>
                <i className="fa-solid fa-info-circle" style={{ marginRight: 8, color: "var(--gum-primary)" }} />
                System Info
              </h3>
            </div>
            <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              <InfoLine label="Platform" value="GrowUpMore Admin" />
              <InfoLine label="Framework" value="Next.js 16 + React 19" />
              <InfoLine label="UI Kit" value="Kendo UI + Bootstrap 5" />
              <InfoLine label="API" value="api.growupmore.com" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function KpiCard({ icon, color, label, value, sub, loading, href }: {
  icon: string; color: string; label: string; value?: number; sub?: string; loading: boolean; href: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className="gum-kpi-card" style={{ cursor: "pointer", transition: "transform 0.15s" }}>
        <div className="gum-kpi-card__icon" style={{ background: color }}>
          <i className={`fa-solid ${icon}`} />
        </div>
        <div className="gum-kpi-card__content">
          <div className="gum-kpi-card__label">{label}</div>
          <div className="gum-kpi-card__value">
            {loading ? <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 16, color: "var(--gum-text-muted)" }} /> : formatNumber(value ?? 0)}
          </div>
          {sub && <div style={{ fontSize: 11, color: "var(--gum-text-muted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </Link>
  );
}

function ServiceRow({ name, service }: { name: string; service: { status: string; latency: string } }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--gum-bg)", borderRadius: 8 }}>
      <span style={{ fontSize: 13, color: "var(--gum-text)" }}>{name}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--gum-text-muted)" }}>{service.latency}</span>
        <HealthDot status={service.status === "connected" || service.status === "healthy" ? "healthy" : "degraded"} />
      </div>
    </div>
  );
}

function HealthDot({ status }: { status: "healthy" | "degraded" | "down" }) {
  const colors = { healthy: "#198754", degraded: "#F59E0B", down: "#DC3545" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%", background: colors[status],
        boxShadow: `0 0 6px ${colors[status]}60`,
      }} />
      <span style={{ fontSize: 11, fontWeight: 500, color: colors[status], textTransform: "capitalize" }}>
        {status}
      </span>
    </div>
  );
}

function QuickAction({ href, icon, label, color }: { href: string; icon: string; label: string; color: string }) {
  return (
    <Link href={href} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: 8, textDecoration: "none", color: "var(--gum-text)",
      transition: "background 0.15s",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 13, color }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      <i className="fa-solid fa-chevron-right" style={{ marginLeft: "auto", fontSize: 10, color: "var(--gum-text-muted)" }} />
    </Link>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ color: "var(--gum-text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "var(--gum-text)" }}>{value}</span>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
