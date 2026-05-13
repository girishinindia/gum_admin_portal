'use client';

import { useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { DashboardShell, formatInr, formatNum, formatPct, formatDateTime } from '@/components/dashboards/DashboardShell';
import { TrendChart } from '@/components/dashboards/TrendChart';

interface SalesData {
  kpis: {
    revenue_today_gross: number; revenue_today_net: number; revenue_today_tax: number;
    orders_today: number;
    refunds_today_inr: number;
    aov_30d: number;
    refund_rate_30d_pct: number;
  };
  trend: { daily: Array<{ day: string; gross_revenue: number; net_revenue: number; tax_collected: number; orders_count: number }> };
  tables: { todays_orders: any[]; failed_payments: any[]; recent_refunds: any[]; top_courses_7d: any[] };
  meta: { window_days: number; generated_at: string };
}

export default function SalesDashboardPage() {
  const [days, setDays] = useState(30);
  const { data, loading, error, refresh } = useDashboard<SalesData>('sales', { days });

  const kpis = [
    { label: 'Gross today',  value: formatInr(data?.kpis.revenue_today_gross ?? 0), hint: 'Includes GST', tone: 'good' as const },
    { label: 'Net today',    value: formatInr(data?.kpis.revenue_today_net ?? 0),   hint: 'Excluding GST' },
    { label: 'GST today',    value: formatInr(data?.kpis.revenue_today_tax ?? 0) },
    { label: 'Orders today', value: formatNum(data?.kpis.orders_today ?? 0),         href: '/orders' },
    { label: 'AOV (30d)',    value: formatInr(data?.kpis.aov_30d ?? 0),              hint: 'Avg order value' },
    { label: 'Refund rate',  value: formatPct(data?.kpis.refund_rate_30d_pct ?? 0),  hint: 'Last 30 days', tone: (data?.kpis.refund_rate_30d_pct ?? 0) > 5 ? ('warn' as const) : undefined },
  ];

  const trendData = (data?.trend.daily ?? []).map((r) => ({ x: r.day, y: Number(r.gross_revenue ?? 0) }));

  return (
    <DashboardShell
      title="Sales & Revenue"
      subtitle={`Orders, GST, refunds, AOV. Window: last ${days} days.`}
      loading={loading}
      error={error}
      generatedAt={data?.meta?.generated_at}
      onRefresh={refresh}
      quickActions={[
        { label: '7d',  onClick: () => setDays(7) },
        { label: '30d', onClick: () => setDays(30) },
        { label: '90d', onClick: () => setDays(90) },
        { label: 'Orders →', href: '/orders' },
      ]}
      kpis={kpis}
      trend={<TrendChart title={`Revenue · last ${days} days`} data={trendData} yFormat={(v) => formatInr(v)} />}
      tables={[
        {
          title: "Today's orders",
          rows: data?.tables.todays_orders ?? [],
          empty: 'No orders today.',
          columns: [
            { key: 'id', label: 'ID' },
            { key: 'payment_status', label: 'Status', render: (r: any) => <span className={`text-xs px-2 py-0.5 rounded ${r.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{r.payment_status}</span> },
          ],
          href: '/orders',
        },
        {
          title: 'Failed payments · last 48h',
          rows: data?.tables.failed_payments ?? [],
          empty: '✓ No payment failures.',
          columns: [
            { key: 'order_id', label: 'Order' },
            { key: 'amount', label: 'Amount', render: (r: any) => formatInr(r.amount) },
            { key: 'error_description', label: 'Error', render: (r: any) => <span className="text-xs text-rose-600">{r.error_description?.slice(0, 40) ?? '—'}</span> },
            { key: 'created_at', label: 'When', render: (r: any) => formatDateTime(r.created_at) },
          ],
          href: '/payment-management',
        },
        {
          title: 'Recent refunds',
          rows: data?.tables.recent_refunds ?? [],
          empty: 'No refunds yet.',
          columns: [
            { key: 'order_id', label: 'Order' },
            { key: 'refund_amount', label: 'Amount', render: (r: any) => formatInr(r.refund_amount) },
            { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'When', render: (r: any) => formatDateTime(r.created_at) },
          ],
        },
        {
          title: 'Top selling courses · 7 days',
          rows: data?.tables.top_courses_7d ?? [],
          empty: 'No paid orders this week.',
          columns: [
            { key: 'name', label: 'Course' },
            { key: 'orders_count', label: 'Orders', render: (r: any) => formatNum(r.orders_count) },
            { key: 'gross_revenue', label: 'Revenue', render: (r: any) => formatInr(r.gross_revenue) },
          ],
          href: '/courses',
        },
      ]}
    />
  );
}
