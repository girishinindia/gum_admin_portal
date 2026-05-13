'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { DashboardShell, formatInr, formatNum, formatDate, formatDateTime } from '@/components/dashboards/DashboardShell';
import { TrendChart } from '@/components/dashboards/TrendChart';

interface FinanceData {
  kpis: {
    pending_payout_requests: number; settled_mtd_inr: number;
    tds_mtd_inr: number; tds_fy_inr: number;
    system_wallet_balance: number; wallets_with_balance: number;
  };
  trend: { payouts_daily: Array<{ settled_at: string; gross_amount: number; tds_amount: number }> };
  tables: { pending_approvals: any[]; recent_settlements: any[]; frozen_wallets: any[]; top_earners: any[] };
  meta: { generated_at: string };
}

export default function FinanceDashboardPage() {
  const { data, loading, error, refresh } = useDashboard<FinanceData>('finance');

  const kpis = [
    { label: 'Pending requests', value: formatNum(data?.kpis.pending_payout_requests ?? 0), tone: (data?.kpis.pending_payout_requests ?? 0) > 0 ? ('warn' as const) : undefined, hint: 'Need approval' },
    { label: 'Settled MTD',      value: formatInr(data?.kpis.settled_mtd_inr ?? 0),        hint: 'Month to date', tone: 'good' as const },
    { label: 'TDS MTD',          value: formatInr(data?.kpis.tds_mtd_inr ?? 0),            hint: 'Section 194-O' },
    { label: 'TDS this FY',      value: formatInr(data?.kpis.tds_fy_inr ?? 0),             hint: 'FY 25-26' },
    { label: 'Wallet balance',   value: formatInr(data?.kpis.system_wallet_balance ?? 0),  hint: 'System-wide' },
    { label: 'Wallets w/ ₹',     value: formatNum(data?.kpis.wallets_with_balance ?? 0) },
  ];

  // Aggregate payout trend by day
  const trendMap = new Map<string, number>();
  for (const r of data?.trend.payouts_daily ?? []) {
    const day = String(r.settled_at).slice(0, 10);
    trendMap.set(day, (trendMap.get(day) ?? 0) + Number(r.gross_amount ?? 0));
  }
  const trendData = Array.from(trendMap.entries()).sort().map(([day, amt]) => ({ x: day, y: amt }));

  return (
    <DashboardShell
      title="Instructor Payouts & Finance"
      subtitle="Money out — pending approvals, TDS, wallets."
      loading={loading}
      error={error}
      generatedAt={data?.meta?.generated_at}
      onRefresh={refresh}
      quickActions={[
        { label: 'Approve payouts', href: '/instructor-payouts' },
        { label: 'Wallets',         href: '/wallet-management' },
      ]}
      kpis={kpis}
      trend={<TrendChart title="Payouts settled · 30 days" data={trendData} yFormat={(v) => formatInr(v)} />}
      tables={[
        {
          title: 'Pending payout approvals',
          rows: data?.tables.pending_approvals ?? [],
          empty: '✓ No pending approvals.',
          columns: [
            { key: 'id', label: 'Request' },
            { key: 'instructor_id', label: 'Instructor' },
            { key: 'requested_amount', label: 'Amount', render: (r: any) => formatInr(r.requested_amount) },
            { key: 'requested_at', label: 'Requested', render: (r: any) => formatDate(r.requested_at) },
          ],
          href: '/instructor-payouts',
        },
        {
          title: 'Recent settlements',
          rows: data?.tables.recent_settlements ?? [],
          empty: 'No settlements yet.',
          columns: [
            { key: 'id', label: 'Settlement' },
            { key: 'gross_amount', label: 'Gross', render: (r: any) => formatInr(r.gross_amount) },
            { key: 'tds_amount', label: 'TDS', render: (r: any) => formatInr(r.tds_amount) },
            { key: 'status', label: 'Status' },
            { key: 'settled_at', label: 'When', render: (r: any) => formatDateTime(r.settled_at) },
          ],
        },
        {
          title: 'Top earning instructors',
          rows: data?.tables.top_earners ?? [],
          empty: 'No instructor earnings yet.',
          columns: [
            { key: 'instructor_id', label: 'Instructor' },
            { key: 'total_earnings', label: 'Total', render: (r: any) => formatInr(r.total_earnings) },
            { key: 'pending_earnings', label: 'Pending', render: (r: any) => formatInr(r.pending_earnings) },
          ],
        },
        {
          title: 'Frozen wallets',
          rows: data?.tables.frozen_wallets ?? [],
          empty: '✓ No frozen wallets.',
          columns: [
            { key: 'user_id', label: 'User' },
            { key: 'balance', label: 'Balance', render: (r: any) => formatInr(r.balance) },
          ],
          href: '/wallet-management',
        },
      ]}
    />
  );
}
