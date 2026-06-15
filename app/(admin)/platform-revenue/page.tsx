'use client';
import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { apiRequest } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Loader2, TrendingUp, Wallet, Banknote, Tag, RefreshCw } from 'lucide-react';

const inr = (n: number) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;

interface Totals { gross: number; instructor_payout: number; platform_revenue: number; gst: number; discounts: number; count: number }
interface InstructorRow { instructor_id: number; instructor_name: string; gross: number; instructor_payout: number; platform_revenue: number; count: number }

const PERIODS = [
  { v: 7, label: 'Last 7 days' },
  { v: 30, label: 'Last 30 days' },
  { v: 90, label: 'Last 90 days' },
  { v: 365, label: 'Last 12 months' },
];

const STATUS_ORDER = ['pending', 'confirmed', 'paid', 'reversed'];

export default function PlatformRevenuePage() {
  const [days, setDays] = useState(30);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [byInstructor, setByInstructor] = useState<InstructorRow[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, { platform_revenue: number; count: number }>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any>(`/admin/revenue/platform?days=${days}`);
      const d = (res as any)?.data ?? res;
      setTotals(d?.totals || null);
      setByInstructor(d?.byInstructor || []);
      setByStatus(d?.byStatus || {});
    } catch (e: any) { toast.error(e?.message || 'Failed to load platform revenue'); }
    setLoading(false);
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: 'Gross sales', value: totals?.gross, Icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Instructor payout', value: totals?.instructor_payout, Icon: Wallet, color: 'text-amber-600 bg-amber-50' },
    { label: 'Platform revenue', value: totals?.platform_revenue, Icon: Banknote, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Discounts given', value: totals?.discounts, Icon: Tag, color: 'text-rose-600 bg-rose-50' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Platform Revenue"
        description="The system's own earnings — after the instructor share and after promo/coupon discounts."
        actions={
          <div className="flex items-center gap-2">
            <select value={days} onChange={e => setDays(Number(e.target.value))} className="text-sm border rounded-md px-2 py-1.5 bg-white">
              {PERIODS.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
            <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white border rounded-lg p-4">
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${c.color}`}><c.Icon className="w-5 h-5" /></div>
            <div className="mt-2 text-2xl font-bold text-slate-800">{loading ? '—' : inr(c.value || 0)}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Platform revenue = the system&apos;s share of each sale that remains after the instructor&apos;s payout and after any promo/coupon discount.
        {totals ? ` Based on ${totals.count} earning record${totals.count === 1 ? '' : 's'}.` : ''}
      </p>

      {/* Status breakdown */}
      <div className="bg-white border rounded-lg p-4">
        <div className="text-sm font-semibold text-slate-700 mb-2">Platform revenue by status</div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {STATUS_ORDER.map(s => (
            <div key={s} className="text-sm">
              <span className="capitalize text-slate-500">{s}: </span>
              <span className="font-semibold text-slate-800">{inr(byStatus[s]?.platform_revenue || 0)}</span>
              <span className="text-xs text-slate-400"> ({byStatus[s]?.count || 0})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-instructor table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-semibold text-slate-700">By instructor</div>
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Instructor</TH>
                <TH className="text-right">Gross</TH>
                <TH className="text-right">Instructor payout</TH>
                <TH className="text-right">Platform revenue</TH>
                <TH className="text-right">Orders</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                <TR><td colSpan={5} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline" /> Loading…</td></TR>
              ) : byInstructor.length === 0 ? (
                <TR><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No earnings in this period</td></TR>
              ) : byInstructor.map(r => (
                <TR key={r.instructor_id}>
                  <TD className="font-medium text-slate-800">{r.instructor_name}</TD>
                  <TD className="text-right">{inr(r.gross)}</TD>
                  <TD className="text-right text-amber-700">{inr(r.instructor_payout)}</TD>
                  <TD className="text-right font-semibold text-emerald-700">{inr(r.platform_revenue)}</TD>
                  <TD className="text-right text-slate-500">{r.count}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
