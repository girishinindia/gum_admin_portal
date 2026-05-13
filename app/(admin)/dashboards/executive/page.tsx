'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { DashboardShell, formatInr, formatNum, formatDateTime } from '@/components/dashboards/DashboardShell';
import { TrendChart } from '@/components/dashboards/TrendChart';

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

export default function ExecutiveDashboardPage() {
  const { data, loading, error, refresh } = useDashboard<ExecData>('executive');

  const kpis = [
    { label: 'Revenue today',     value: formatInr(data?.kpis.revenue_today ?? 0),         hint: 'Paid orders, today',         tone: 'good' as const, href: '/dashboards/sales' },
    { label: 'Revenue MTD',       value: formatInr(data?.kpis.revenue_mtd ?? 0),           hint: 'Month to date',              href: '/dashboards/sales' },
    { label: 'Orders today',      value: formatNum(data?.kpis.orders_today ?? 0),          href: '/orders' },
    { label: 'New enrollments',   value: formatNum(data?.kpis.enrollments_today ?? 0),     hint: 'Today',                       href: '/enrollments' },
    { label: 'Active users',      value: formatNum(data?.kpis.active_users_30d ?? 0),      hint: 'Logged in last 30d',          href: '/users' },
    { label: 'Pending payouts',   value: `${data?.kpis.pending_payouts_count ?? 0} · ${formatInr(data?.kpis.pending_payouts_inr ?? 0)}`, hint: 'Approval needed', tone: (data?.kpis.pending_payouts_count ?? 0) > 0 ? ('warn' as const) : undefined, href: '/dashboards/finance' },
    { label: 'Open support',      value: formatNum(data?.kpis.open_tickets ?? 0),          tone: (data?.kpis.open_tickets ?? 0) > 5 ? ('warn' as const) : undefined, href: '/dashboards/operations' },
  ];

  const trendData = (data?.trend.revenue_daily ?? []).map((r) => ({ x: r.day, y: Number(r.gross_revenue ?? 0) }));

  return (
    <DashboardShell
      title="Executive Overview"
      subtitle="Your morning view of the platform. Numbers refresh on click."
      loading={loading}
      error={error}
      generatedAt={data?.meta?.generated_at}
      onRefresh={refresh}
      quickActions={[
        { label: 'Approve payouts',  href: '/instructor-payouts' },
        { label: 'View orders',      href: '/orders' },
        { label: 'Revenue dashboard', href: '/revenue-dashboard' },
      ]}
      kpis={kpis}
      trend={<TrendChart title="Daily revenue · last 30 days" data={trendData} yFormat={(v) => formatInr(v)} />}
      tables={[
        {
          title: 'Top 5 courses · last 7 days',
          rows: data?.tables.top_courses_7d ?? [],
          empty: 'No paid orders in the last 7 days.',
          columns: [
            { key: 'name', label: 'Course' },
            { key: 'orders_count', label: 'Orders', render: (r: any) => formatNum(r.orders_count) },
            { key: 'gross_revenue', label: 'Revenue', render: (r: any) => formatInr(r.gross_revenue) },
          ],
          href: '/courses',
        },
        {
          title: 'Recent webhook / cron errors',
          rows: data?.tables.recent_webhook_errors ?? [],
          empty: '✓ No webhook errors in the last 24h.',
          columns: [
            { key: 'provider', label: 'Provider' },
            { key: 'event_type', label: 'Event' },
            { key: 'occurred_at', label: 'When', render: (r: any) => formatDateTime(r.occurred_at) },
            { key: 'error', label: 'Error', render: (r: any) => <span className="text-rose-600 text-xs">{r.error?.slice(0, 60) ?? '—'}</span> },
          ],
          href: '/dashboards/operations',
        },
      ]}
    />
  );
}
