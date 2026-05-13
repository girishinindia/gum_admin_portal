'use client';

/**
 * Main Dashboard / Command Center  (Phase 14.10 redesign)
 * ───────────────────────────────────────────────────────
 * The landing page for any admin. Combines:
 *   • The executive-overview KPIs (revenue, orders, pending payouts, etc.)
 *   • A 30-day revenue trend chart
 *   • An "Needs attention" panel (pending payouts, webhook errors, breached SLAs)
 *   • A 5-card quick-nav grid to the detailed dashboards
 *   • A live "Recent activity" feed (auth logs + recent orders + enrollments)
 *
 * Uses GET /admin/dashboards/executive as its primary data source.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, Banknote, Activity, BookOpen, Star, ArrowRight,
  LayoutDashboard, Users, ShoppingCart, GraduationCap, AlertTriangle,
  RefreshCw, Eye, LogIn, BarChart3,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { TrendChart } from '@/components/dashboards/TrendChart';
import { api } from '@/lib/api';
import { formatDate, fromNow } from '@/lib/utils';
import { formatInr, formatNum, formatDateTime } from '@/components/dashboards/DashboardShell';

// ── Types ──────────────────────────────────────────────────────
interface ExecData {
  kpis: {
    revenue_today: number; revenue_mtd: number;
    orders_today: number; enrollments_today: number;
    active_users_30d: number;
    pending_payouts_count: number; pending_payouts_inr: number;
    open_tickets: number;
  };
  trend: { revenue_daily: Array<{ day: string; gross_revenue: number; net_revenue: number; orders_count: number }> };
  tables: {
    top_courses_7d: any[];
    recent_failed_crons: any[];
    recent_webhook_errors: any[];
  };
  meta: { generated_at: string };
}

// ── Sub-dashboard nav cards ────────────────────────────────────
const SUB_DASHBOARDS = [
  { href: '/dashboards/sales',      label: 'Sales & Revenue',   description: 'Orders, GST, refunds, AOV',         icon: TrendingUp, accent: 'from-emerald-50  to-emerald-100  text-emerald-700  ring-emerald-200' },
  { href: '/dashboards/finance',    label: 'Payouts & Finance', description: 'Pending approvals, TDS, wallets',    icon: Banknote,   accent: 'from-amber-50    to-amber-100    text-amber-700    ring-amber-200' },
  { href: '/dashboards/operations', label: 'Operations',         description: 'Tickets, errors, system health',     icon: Activity,   accent: 'from-rose-50     to-rose-100     text-rose-700     ring-rose-200' },
  { href: '/dashboards/catalog',    label: 'Catalog & Content',  description: 'Courses, instructors, webinars',     icon: BookOpen,   accent: 'from-indigo-50   to-indigo-100   text-indigo-700   ring-indigo-200' },
  { href: '/dashboards/engagement', label: 'Student Engagement', description: 'Completion, ratings, certificates',  icon: Star,       accent: 'from-violet-50   to-violet-100   text-violet-700   ring-violet-200' },
  { href: '/revenue-dashboard',     label: 'Revenue (live MV)',  description: 'Daily aggregates from Postgres',      icon: BarChart3,  accent: 'from-sky-50      to-sky-100      text-sky-700      ring-sky-200' },
];

// ── Page ───────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, loading, error, refresh } = useDashboard<ExecData>('executive');

  // Recent auth-log feed (kept from old dashboard, condensed)
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [viewing, setViewing] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      setLogsLoading(true);
      const res = await api.authLogs('?page=1&limit=8');
      if (res.success) setLogs(res.data || []);
      setLogsLoading(false);
    })();
  }, [data?.meta?.generated_at]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── Hero: greeting + today's revenue ── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-7 text-white shadow-lg">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-slate-400">
              {greeting}
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {user?.first_name ? `${user.first_name}` : 'Admin'}
              <span className="text-slate-300 font-normal"> · </span>
              <span className="text-slate-300 font-normal">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Your command center. Today's top numbers, things needing your attention, and shortcuts to every operational view.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch">
            <div className="rounded-xl bg-white/5 backdrop-blur ring-1 ring-white/10 px-5 py-3 min-w-[180px]">
              <div className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">Revenue today</div>
              <div className="mt-1 text-2xl font-bold text-emerald-300">
                {loading ? <Skeleton className="h-7 w-20 bg-slate-700" /> : formatInr(data?.kpis.revenue_today ?? 0)}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur ring-1 ring-white/10 px-5 py-3 min-w-[180px]">
              <div className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">Revenue MTD</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {loading ? <Skeleton className="h-7 w-24 bg-slate-700" /> : formatInr(data?.kpis.revenue_mtd ?? 0)}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* decorative gradient blob */}
        <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />
      </section>

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* ── KPI strip (6 cards) ── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Orders today"     value={data?.kpis.orders_today}      icon={ShoppingCart}   tone="brand"    href="/orders"               loading={loading} />
        <KpiCard label="Enrollments"      value={data?.kpis.enrollments_today} icon={GraduationCap}  tone="indigo"   href="/enrollments"          hint="today" loading={loading} />
        <KpiCard label="Active users"     value={data?.kpis.active_users_30d}  icon={Users}          tone="emerald"  href="/users"                hint="30-day" loading={loading} />
        <KpiCard label="Pending payouts"  value={data?.kpis.pending_payouts_count} icon={Banknote}    tone={(data?.kpis.pending_payouts_count ?? 0) > 0 ? 'warn' : 'default'} href="/dashboards/finance" hint={data ? formatInr(data.kpis.pending_payouts_inr) : '—'} loading={loading} />
        <KpiCard label="Open tickets"     value={data?.kpis.open_tickets}      icon={AlertTriangle}  tone={(data?.kpis.open_tickets ?? 0) > 5 ? 'warn' : 'default'} href="/support-tickets" loading={loading} />
        <KpiCard label="Auth logs"        value={logs.length > 0 ? '8+' : 0}   icon={Activity}       tone="purple"   href="/activity-logs" loading={logsLoading} hint="recent" />
      </section>

      {/* ── 2-col: revenue trend + attention panel ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <TrendChart
            title="Daily revenue · last 30 days"
            data={(data?.trend.revenue_daily ?? []).map((r) => ({ x: r.day, y: Number(r.gross_revenue ?? 0) }))}
            yFormat={(v) => formatInr(v)}
            height={200}
          />
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="font-semibold text-slate-900">Needs your attention</div>
            <div className="text-xs text-slate-500 mt-0.5">Things flagged across the platform</div>
          </div>
          <div className="divide-y divide-slate-100">
            <AttentionRow
              label="Pending payout approvals"
              value={data?.kpis.pending_payouts_count ?? 0}
              href="/instructor-payouts"
              warn={(data?.kpis.pending_payouts_count ?? 0) > 0}
            />
            <AttentionRow
              label="Open support tickets"
              value={data?.kpis.open_tickets ?? 0}
              href="/support-tickets"
              warn={(data?.kpis.open_tickets ?? 0) > 5}
            />
            <AttentionRow
              label="Webhook errors · 24h"
              value={(data?.tables.recent_webhook_errors ?? []).length}
              href="/dashboards/operations"
              warn={(data?.tables.recent_webhook_errors ?? []).length > 0}
            />
            <AttentionRow
              label="Failed cron jobs"
              value={(data?.tables.recent_failed_crons ?? []).length}
              href="/scheduled-jobs"
              warn={(data?.tables.recent_failed_crons ?? []).length > 0}
            />
          </div>
        </Card>
      </section>

      {/* ── Quick navigation to detail dashboards ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">Drill in</h2>
            <p className="text-sm text-slate-500 mt-0.5">Jump to the focused dashboards.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUB_DASHBOARDS.map((d) => {
            const Icon = d.icon;
            return (
              <Link key={d.href} href={d.href}>
                <Card className="hover:shadow-card-hover transition-all group cursor-pointer h-full">
                  <CardContent className="flex items-start gap-3 py-5">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${d.accent}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                        {d.label}
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{d.description}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Top courses (last 7 days) ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <div className="font-semibold text-slate-900">Top courses · last 7 days</div>
              <div className="text-xs text-slate-500 mt-0.5">By gross revenue</div>
            </div>
            <Link href="/courses" className="text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
              All courses <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {(data?.tables.top_courses_7d ?? []).length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">No paid orders in the last 7 days.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(data?.tables.top_courses_7d ?? []).slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-bold text-slate-400 w-5">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{c.name ?? c.course_name ?? `Course #${c.course_id ?? '?'}`}</div>
                      <div className="text-xs text-slate-500">{formatNum(c.orders_count ?? 0)} orders</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-700">{formatInr(c.gross_revenue ?? 0)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <div className="font-semibold text-slate-900">Recent auth activity</div>
              <div className="text-xs text-slate-500 mt-0.5">Logins, OTPs, refreshes</div>
            </div>
            <Link href="/activity-logs" className="text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {logsLoading ? (
            <div className="px-5 py-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : logs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">No recent auth activity.</div>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="text-xs">User</TH>
                  <TH className="text-xs">Action</TH>
                  <TH className="text-xs">When</TH>
                  <TH className="w-10 text-right text-xs"></TH>
                </TR>
              </THead>
              <TBody>
                {logs.slice(0, 6).map((log: any) => (
                  <TR key={log.id}>
                    <TD className="py-2">
                      <MiniUser actor={log.actor} fallbackIdentifier={log.identifier} fallbackId={log.user_id} />
                    </TD>
                    <TD className="py-2">
                      <Badge variant={getActionVariant(log) as any}>{formatActionLabel(log.action || 'Unknown')}</Badge>
                    </TD>
                    <TD className="py-2 text-xs text-slate-600">{fromNow(log.created_at)}</TD>
                    <TD className="py-2 text-right">
                      <button onClick={() => setViewing(log)} className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-sky-50" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </section>

      {data?.meta?.generated_at && (
        <div className="text-xs text-slate-400 text-right">
          Last refreshed {formatDateTime(data.meta.generated_at)}
        </div>
      )}

      {/* Auth log detail dialog (preserved from previous design) */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Auth Log Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0"><LogIn className="w-5 h-5 text-brand-600" /></div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{formatActionLabel(viewing.action || 'Log Entry')}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getActionVariant(viewing) as any}>{formatActionLabel(viewing.action || 'Unknown')}</Badge>
                </div>
              </div>
            </div>
            {/* Actor card (Phase 14.11) */}
            {viewing.actor && (
              <div className="mb-5 -mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                {viewing.actor.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewing.actor.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                    {(viewing.actor.full_name || viewing.actor.email || '?').trim().split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{viewing.actor.full_name || viewing.actor.email}</div>
                  <div className="text-xs text-slate-500 truncate">{viewing.actor.email}{viewing.actor.mobile ? ` · ${viewing.actor.mobile}` : ''} · ID {viewing.actor.id}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="ID" value={String(viewing.id)} />
              <DetailRow label="Action" value={formatActionLabel(viewing.action)} />
              {viewing.identifier && <DetailRow label="Identifier (entered)" value={viewing.identifier} />}
              {viewing.user_id && !viewing.actor && <DetailRow label="User ID" value={String(viewing.user_id)} />}
              {viewing.ip_address && <DetailRow label="IP Address" value={viewing.ip_address} />}
              {viewing.device_type && <DetailRow label="Device" value={viewing.device_type} />}
              {viewing.user_agent && <DetailRow label="User Agent" value={viewing.user_agent} />}
              <DetailRow label="Created" value={formatDate(viewing.created_at, 'MMM D, YYYY h:mm:ss A')} />
            </div>
            {viewing.metadata && Object.keys(viewing.metadata).length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Metadata</h4>
                <pre className="p-3 bg-slate-50 border border-slate-100 rounded-md text-xs text-slate-700 overflow-x-auto font-mono">{JSON.stringify(viewing.metadata, null, 2)}</pre>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────
function KpiCard(props: {
  label: string;
  value?: number | string;
  hint?: string;
  icon: any;
  tone: 'default' | 'brand' | 'emerald' | 'amber' | 'indigo' | 'purple' | 'warn' | 'danger';
  href?: string;
  loading?: boolean;
}) {
  const { label, value, hint, icon: Icon, tone, href, loading } = props;
  const toneMap: Record<string, string> = {
    default: 'bg-slate-50 text-slate-700 ring-slate-200',
    brand:   'bg-brand-50 text-brand-700 ring-brand-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber:   'bg-amber-50 text-amber-700 ring-amber-200',
    indigo:  'bg-indigo-50 text-indigo-700 ring-indigo-200',
    purple:  'bg-purple-50 text-purple-700 ring-purple-200',
    warn:    'bg-amber-50 text-amber-700 ring-amber-300',
    danger:  'bg-rose-50 text-rose-700 ring-rose-300',
  };
  const card = (
    <Card className="hover:shadow-card-hover transition-all group cursor-pointer h-full">
      <CardContent className="flex items-start gap-3 py-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${toneMap[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">
            {loading ? <Skeleton className="h-6 w-12" /> : (typeof value === 'number' ? value.toLocaleString('en-IN') : (value ?? '0'))}
          </div>
          {hint && !loading && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function AttentionRow({ label, value, href, warn }: { label: string; value: number; href: string; warn: boolean }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
    >
      <span className="text-sm text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-bold tabular-nums ${warn ? 'text-amber-600' : 'text-slate-400'}`}>{value}</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
      </div>
    </Link>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 break-all">{value || '—'}</dd>
    </div>
  );
}

/**
 * Compact "who did this" cell for the dashboard auth-feed table.
 *   actor              — enriched by /activity-logs API (Phase 14.11)
 *   fallbackIdentifier — email/mobile entered at login (pre-auth events)
 *   fallbackId         — numeric user_id with no matching users row (deleted)
 */
function MiniUser({ actor, fallbackIdentifier, fallbackId }: { actor: any; fallbackIdentifier?: string | null; fallbackId?: number | string | null }) {
  if (actor) {
    const initials = (actor.full_name ?? `${actor.first_name ?? ''} ${actor.last_name ?? ''}`)
      .trim().split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || '?';
    return (
      <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
        {actor.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={actor.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-semibold text-slate-600">{initials}</div>
        )}
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-900 truncate">{actor.full_name || actor.email || `#${actor.id}`}</div>
          {actor.email && <div className="text-[10px] text-slate-500 truncate">{actor.email}</div>}
        </div>
      </div>
    );
  }
  if (fallbackIdentifier) {
    return (
      <div className="max-w-[220px]">
        <div className="text-xs text-slate-700 truncate">{fallbackIdentifier}</div>
        <div className="text-[10px] text-slate-400">unauthenticated</div>
      </div>
    );
  }
  if (fallbackId != null) {
    return <span className="text-xs text-slate-500">User #{fallbackId} <span className="text-slate-400">· deleted</span></span>;
  }
  return <span className="text-xs text-slate-400">system</span>;
}

function getActionVariant(log: any): string {
  if (log.action?.includes('failed') || log.action?.includes('denied')) return 'danger';
  if (log.action?.includes('success') || log.action?.includes('verified')) return 'success';
  return 'default';
}

function formatActionLabel(action: string): string {
  return action?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '';
}
