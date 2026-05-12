'use client';
import { useState, useEffect, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  DollarSign, ShoppingCart, GraduationCap, RefreshCw,
  TrendingUp, Target, Loader2, AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────
interface KPI {
  total_revenue: number;
  total_orders: number;
  total_enrollments: number;
  total_refunds: number;
  refund_count: number;
  avg_order_value: number;
  conversion_rate: number;
  all_time_revenue: number;
  all_time_enrollments: number;
}

interface RevenueByMonth {
  month: string;
  revenue: number;
  orders: number;
}

interface OrdersByStatus {
  status: string;
  count: number;
}

interface EnrollmentsByType {
  item_type: string;
  count: number;
}

interface TopCourse {
  item_type: string;
  item_id: number;
  item_name: string;
  revenue: number;
  quantity: number;
}

interface PaymentMethod {
  method: string;
  count: number;
  total: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface DashboardData {
  period_days: number;
  kpi: KPI;
  revenue_by_month: RevenueByMonth[];
  orders_by_status: OrdersByStatus[];
  enrollments_by_type: EnrollmentsByType[];
  recent_orders: any[];
  top_courses: TopCourse[];
  payment_methods: PaymentMethod[];
  daily_revenue: DailyRevenue[];
}

// ─── Helpers ────────────────────────────────────────────────────
const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const INR_FULL = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatINR(amount: number | null | undefined): string {
  if (amount == null) return '₹0';
  return INR.format(amount);
}

function formatINRFull(amount: number | null | undefined): string {
  if (amount == null) return '₹0.00';
  return INR_FULL.format(amount);
}

function capitalize(s: string): string {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '--';
}

function formatDate(d: string): string {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function shortMonth(m: string): string {
  if (!m) return '';
  const parts = m.split('-');
  if (parts.length === 2) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1);
    return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
  }
  return m;
}

const ORDER_STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'muted' | 'info' | 'default'> = {
  pending: 'warning',
  confirmed: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'muted',
  refunded: 'default',
};

const ORDER_STATUS_BAR_COLORS: Record<string, string> = {
  pending: 'bg-amber-400',
  completed: 'bg-emerald-500',
  failed: 'bg-red-500',
  cancelled: 'bg-slate-400',
  refunded: 'bg-purple-500',
  confirmed: 'bg-blue-500',
};

const ENROLLMENT_TYPE_BAR_COLORS: Record<string, string> = {
  course: 'bg-blue-500',
  bundle: 'bg-indigo-500',
  batch: 'bg-amber-500',
  webinar: 'bg-emerald-500',
};

const ENROLLMENT_TYPE_VARIANTS: Record<string, 'info' | 'default' | 'warning' | 'success'> = {
  course: 'info',
  bundle: 'default',
  batch: 'warning',
  webinar: 'success',
};

const PAYMENT_STATUS_VARIANTS: Record<string, 'warning' | 'success' | 'danger' | 'muted' | 'info' | 'default'> = {
  unpaid: 'muted',
  paid: 'success',
  refunded: 'default',
  partially_refunded: 'warning',
  failed: 'danger',
};

const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: '365', label: 'Last 365 Days' },
];

// ─── KPI Card ────────────────────────────────────────────────────
function KPICard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 truncate">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        <div className={cn('flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Chart ────────────────────────────────────────────────
function RevenueChart({ data }: { data: RevenueByMonth[] }) {
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Revenue by Month</h3>
      {data.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No revenue data available</p>
      ) : (
        <div className="flex items-end gap-2 h-56 overflow-x-auto pb-2">
          {data.slice(-12).map((item, idx) => {
            const heightPct = Math.max((item.revenue / maxRevenue) * 100, 2);
            return (
              <div key={idx} className="flex flex-col items-center flex-1 min-w-[48px]">
                <span className="text-[10px] text-slate-500 mb-1 whitespace-nowrap">
                  {formatINR(item.revenue)}
                </span>
                <div className="w-full flex justify-center flex-1 items-end">
                  <div
                    className="w-8 rounded-t-md bg-emerald-500 hover:bg-emerald-600 transition-colors cursor-default"
                    style={{ height: `${heightPct}%` }}
                    title={`${shortMonth(item.month)}: ${formatINRFull(item.revenue)} (${item.orders} orders)`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-2 whitespace-nowrap">
                  {shortMonth(item.month)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Horizontal Bar Section ────────────────────────────────────
function HorizontalBarSection({
  title,
  items,
  colorMap,
  variantMap,
  labelKey,
  valueKey,
}: {
  title: string;
  items: any[];
  colorMap: Record<string, string>;
  variantMap: Record<string, string>;
  labelKey: string;
  valueKey: string;
}) {
  const maxVal = Math.max(...items.map(i => i[valueKey] ?? 0), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No data available</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const label = item[labelKey] || 'unknown';
            const val = item[valueKey] ?? 0;
            const pct = Math.max((val / maxVal) * 100, 2);
            const barColor = colorMap[label.toLowerCase()] || 'bg-slate-400';
            const variant = (variantMap[label.toLowerCase()] || 'muted') as any;
            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant={variant}>{capitalize(label)}</Badge>
                  <span className="text-sm font-medium text-slate-700">{val}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════
export default function RevenueDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getRevenueDashboard(Number(period));
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load revenue dashboard:', err);
      setError(err?.message || 'Failed to load revenue dashboard');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Revenue Dashboard" />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <span className="ml-3 text-sm text-slate-500">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error || !data) {
    return (
      <div className="p-6">
        <PageHeader title="Revenue Dashboard" />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
          <p className="text-sm text-slate-600 mb-1">Failed to load dashboard</p>
          <p className="text-xs text-slate-400">{error || 'No data returned'}</p>
          <button
            onClick={fetchDashboard}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { kpi } = data;

  // ── Render ──
  return (
    <div className="p-6 space-y-6">
      {/* ── Header ── */}
      <PageHeader
        title="Revenue Dashboard"
        actions={
          <Select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            options={PERIOD_OPTIONS}
            className="w-44"
          />
        }
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatINR(kpi.total_revenue)}
          icon={DollarSign}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          subtitle={`All-time: ${formatINR(kpi.all_time_revenue)}`}
        />
        <KPICard
          title="Total Orders"
          value={kpi.total_orders.toLocaleString('en-IN')}
          icon={ShoppingCart}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <KPICard
          title="Total Enrollments"
          value={kpi.total_enrollments.toLocaleString('en-IN')}
          icon={GraduationCap}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          subtitle={`All-time: ${kpi.all_time_enrollments.toLocaleString('en-IN')}`}
        />
        <KPICard
          title="Total Refunds"
          value={formatINR(kpi.total_refunds)}
          icon={RefreshCw}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          subtitle={`${kpi.refund_count} refund${kpi.refund_count !== 1 ? 's' : ''}`}
        />
        <KPICard
          title="Avg Order Value"
          value={formatINRFull(kpi.avg_order_value)}
          icon={TrendingUp}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <KPICard
          title="Conversion Rate"
          value={`${kpi.conversion_rate.toFixed(1)}%`}
          icon={Target}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* ── Revenue Chart ── */}
      <RevenueChart data={data.revenue_by_month} />

      {/* ── Orders by Status / Enrollments by Type ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HorizontalBarSection
          title="Orders by Status"
          items={data.orders_by_status}
          colorMap={ORDER_STATUS_BAR_COLORS}
          variantMap={ORDER_STATUS_VARIANTS}
          labelKey="status"
          valueKey="count"
        />
        <HorizontalBarSection
          title="Enrollments by Type"
          items={data.enrollments_by_type}
          colorMap={ENROLLMENT_TYPE_BAR_COLORS}
          variantMap={ENROLLMENT_TYPE_VARIANTS}
          labelKey="item_type"
          valueKey="count"
        />
      </div>

      {/* ── Top Courses / Payment Methods ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Courses by Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Courses by Revenue</h3>
          {data.top_courses.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No course data available</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Revenue</TH>
                </TR>
              </THead>
              <TBody>
                {data.top_courses.map((course, idx) => (
                  <TR key={idx}>
                    <TD className="max-w-[200px] truncate font-medium">{course.item_name}</TD>
                    <TD>
                      <Badge variant={ENROLLMENT_TYPE_VARIANTS[course.item_type] || 'muted'}>
                        {capitalize(course.item_type)}
                      </Badge>
                    </TD>
                    <TD className="text-right tabular-nums">{course.quantity}</TD>
                    <TD className="text-right tabular-nums font-medium">{formatINR(course.revenue)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Payment Methods</h3>
          {data.payment_methods.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No payment data available</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Method</TH>
                  <TH className="text-right">Count</TH>
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {data.payment_methods.map((pm, idx) => (
                  <TR key={idx}>
                    <TD className="font-medium">{capitalize(pm.method)}</TD>
                    <TD className="text-right tabular-nums">{pm.count}</TD>
                    <TD className="text-right tabular-nums font-medium">{formatINR(pm.total)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </div>

      {/* ── Daily Revenue Chart ── */}
      {data.daily_revenue.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Daily Revenue Trend</h3>
          <div className="flex items-end gap-1 h-40 overflow-x-auto pb-2">
            {data.daily_revenue.map((day, idx) => {
              const maxDailyRevenue = Math.max(...data.daily_revenue.map(d => d.revenue), 1);
              const heightPct = Math.max((day.revenue / maxDailyRevenue) * 100, 1);
              return (
                <div key={idx} className="flex flex-col items-center flex-1 min-w-[20px]">
                  <div className="w-full flex justify-center flex-1 items-end">
                    <div
                      className="w-full max-w-[12px] rounded-t bg-blue-500 hover:bg-blue-600 transition-colors cursor-default"
                      style={{ height: `${heightPct}%` }}
                      title={`${formatDate(day.date)}: ${formatINRFull(day.revenue)} (${day.orders} orders)`}
                    />
                  </div>
                  {idx % Math.max(Math.floor(data.daily_revenue.length / 8), 1) === 0 && (
                    <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">
                      {new Date(day.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent Orders ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Recent Orders</h3>
        {data.recent_orders.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No recent orders</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Order #</TH>
                <TH>Customer</TH>
                <TH className="text-right">Amount</TH>
                <TH>Status</TH>
                <TH>Payment</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {data.recent_orders.map((order: any, idx: number) => {
                const orderStatus = (order.order_status || order.status || '').toLowerCase();
                const paymentStatus = (order.payment_status || '').toLowerCase();
                return (
                  <TR key={order.id || idx}>
                    <TD className="font-mono text-xs font-medium">
                      {order.order_number || `#${order.id}`}
                    </TD>
                    <TD>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[180px]">
                          {order.customer_name || order.user_name || order.email || '--'}
                        </span>
                        {order.email && order.customer_name && (
                          <span className="text-xs text-slate-400 truncate max-w-[180px]">{order.email}</span>
                        )}
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums font-medium">
                      {formatINRFull(order.total_amount ?? order.amount)}
                    </TD>
                    <TD>
                      <Badge variant={ORDER_STATUS_VARIANTS[orderStatus] || 'muted'}>
                        {capitalize(orderStatus || 'unknown')}
                      </Badge>
                    </TD>
                    <TD>
                      <Badge variant={PAYMENT_STATUS_VARIANTS[paymentStatus] || 'muted'}>
                        {capitalize(paymentStatus || 'unknown')}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(order.created_at || order.order_date || '')}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="text-center pb-4">
        <p className="text-xs text-slate-400">
          Showing data for the last {data.period_days} days. All amounts in INR.
        </p>
      </div>
    </div>
  );
}
