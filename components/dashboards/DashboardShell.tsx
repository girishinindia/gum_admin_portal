'use client';

/**
 * DashboardShell — Phase 14
 * ─────────────────────────
 * Shared layout component for every management dashboard.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Title + subtitle                        [refresh] [actions] │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ KPI 1   │ KPI 2   │ KPI 3   │ KPI 4   │ KPI 5   │ KPI 6     │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ TrendChart  (optional)                                       │
 *   ├──────────────────────────┬──────────────────────────────────┤
 *   │ Attention table A        │ Attention table B                │
 *   └──────────────────────────┴──────────────────────────────────┘
 *
 * Pass it KPIs + a trend dataset + a list of tables and it renders.
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// ── Types ──────────────────────────────────────────────────────
export interface KpiCard {
  label:     string;
  value:     string | number;          // already formatted (e.g. "₹1,200" or "12.4%")
  hint?:     string;                   // secondary line ("MTD", "30d window")
  tone?:     'default' | 'good' | 'warn' | 'danger';
  href?:     string;                   // optional click-through
}

export interface QuickAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface TablePanel<Row = any> {
  title:    string;
  rows:     Row[];
  empty:    string;
  columns:  { key: keyof Row | string; label: string; render?: (row: Row) => ReactNode; width?: string }[];
  href?:    string;                    // click-through (e.g. /orders) when user wants the full list
}

export interface DashboardShellProps {
  title:        string;
  subtitle?:    string;
  loading?:     boolean;
  error?:       string | null;
  generatedAt?: string;
  onRefresh?:   () => void;
  quickActions?: QuickAction[];
  kpis:         KpiCard[];
  trend?:       ReactNode;             // any chart component the caller renders
  tables?:      TablePanel[];
}

// ── KPI tile ────────────────────────────────────────────────────
function toneClass(t: KpiCard['tone']): string {
  if (t === 'good')   return 'text-emerald-600';
  if (t === 'warn')   return 'text-amber-600';
  if (t === 'danger') return 'text-rose-600';
  return 'text-slate-900';
}

function KpiTile({ k }: { k: KpiCard }) {
  const body = (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{k.label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClass(k.tone)}`}>{k.value}</div>
      {k.hint && <div className="mt-1 text-xs text-slate-500">{k.hint}</div>}
      {k.href && <ArrowUpRight className="absolute top-3 right-3 w-4 h-4 text-slate-400" />}
    </Card>
  );
  return k.href ? <Link href={k.href} className="block relative">{body}</Link> : <div className="relative">{body}</div>;
}

// ── Table panel ─────────────────────────────────────────────────
function TablePanelView<Row>({ panel }: { panel: TablePanel<Row> }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="font-semibold text-slate-900">{panel.title}</div>
        {panel.href && (
          <Link href={panel.href} className="text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-1">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {panel.rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">{panel.empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>{panel.columns.map((c) => <th key={String(c.key)} className="px-4 py-2 text-left" style={c.width ? { width: c.width } : undefined}>{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {panel.rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {panel.columns.map((c) => (
                    <td key={String(c.key)} className="px-4 py-2.5 text-slate-700">
                      {c.render ? c.render(row) : String((row as any)[c.key as any] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Main shell ──────────────────────────────────────────────────
export function DashboardShell({
  title, subtitle, loading, error, generatedAt,
  onRefresh, quickActions = [],
  kpis, trend, tables = [],
}: DashboardShellProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-600 mt-1">{subtitle}</p>}
          {generatedAt && (
            <p className="text-xs text-slate-400 mt-1">
              Last refreshed: {new Date(generatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quickActions.map((a, i) =>
            a.href ? (
              <Link key={i} href={a.href}>
                <Button variant="outline" size="sm">{a.label}</Button>
              </Link>
            ) : (
              <Button key={i} variant="outline" size="sm" onClick={a.onClick}>{a.label}</Button>
            ),
          )}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4">
                <div className="h-3 bg-slate-200 rounded animate-pulse mb-3 w-2/3" />
                <div className="h-6 bg-slate-200 rounded animate-pulse w-1/2" />
              </Card>
            ))
          : kpis.map((k, i) => <KpiTile key={i} k={k} />)}
      </div>

      {/* Trend */}
      {trend && (
        <Card className="p-4">
          {trend}
        </Card>
      )}

      {/* Tables grid */}
      {tables.length > 0 && (
        <div className={`grid gap-4 ${tables.length === 1 ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
          {tables.map((t, i) => <TablePanelView key={i} panel={t} />)}
        </div>
      )}
    </div>
  );
}

// ── Helpers shared across dashboards ────────────────────────────
export function formatInr(n: number): string {
  return `₹${(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function formatPct(n: number): string {
  return `${(n ?? 0).toFixed(2)}%`;
}

export function formatNum(n: number): string {
  return (n ?? 0).toLocaleString('en-IN');
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
