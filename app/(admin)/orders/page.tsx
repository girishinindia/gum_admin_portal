'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  Loader2, X, MoreVertical, ShoppingCart, Package, Ban, Check,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type SortField = 'id' | 'order_number' | 'total_amount' | 'order_status' | 'payment_status' | 'created_at';

const ORDER_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

const PAYMENT_STATUSES = [
  { value: '', label: 'All Payments' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially Refunded' },
  { value: 'failed', label: 'Failed' },
];

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-50 text-red-700',
  refunded: 'bg-purple-50 text-purple-700',
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-slate-100 text-slate-600',
  paid: 'bg-emerald-50 text-emerald-700',
  refunded: 'bg-purple-50 text-purple-700',
  partially_refunded: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

// ─── Helpers ────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '--';
}

function formatCurrency(amount: number | null | undefined) {
  return `₹${amount?.toFixed(2) || '0.00'}`;
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════
export default function OrdersPage() {
  // ── List state ──
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [sort, setSort] = useState<SortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── Stats state ──
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, cancelled: 0, failed: 0 });

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);

  // ── Edit state ──
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  // ── Cancel state ──
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelItem, setCancelItem] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // ── Action loaders ──
  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&sort=${sort}&ascending=${asc}`;
      if (showTrash) qs += '&show_deleted=true';
      if (search) qs += `&search=${encodeURIComponent(search)}`;
      if (orderStatusFilter) qs += `&order_status=${orderStatusFilter}`;
      if (paymentStatusFilter) qs += `&payment_status=${paymentStatusFilter}`;
      const res = await api.listOrders(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load orders'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, orderStatusFilter, paymentStatusFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.listOrders('?show_deleted=true&limit=1');
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [all, pending, completed, cancelled, failed] = await Promise.all([
        api.listOrders('?limit=1'),
        api.listOrders('?limit=1&order_status=pending'),
        api.listOrders('?limit=1&order_status=completed'),
        api.listOrders('?limit=1&order_status=cancelled'),
        api.listOrders('?limit=1&order_status=failed'),
      ]);
      setStats({
        total: all.pagination?.total || 0,
        pending: pending.pagination?.total || 0,
        completed: completed.pagination?.total || 0,
        cancelled: cancelled.pagination?.total || 0,
        failed: failed.pagination?.total || 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); fetchStats(); }, [fetchData, fetchTrashCount, fetchStats]);

  // ── Sort helper ──
  function toggleSort(field: SortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ── View order ──
  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    setOrderItems([]);
    try {
      const [orderRes, itemsRes] = await Promise.all([
        api.getOrder(id),
        api.getOrderItems(id),
      ]);
      setViewItem(orderRes.data);
      setOrderItems(itemsRes.data || itemsRes || []);
    } catch { toast.error('Failed to load order details'); }
    setViewLoading(false);
  }

  // ── Edit order ──
  function openEdit(item: any) {
    setEditItem(item);
    reset({
      notes: item.notes || '',
      admin_notes: item.admin_notes || '',
    });
    setEditOpen(true);
  }

  async function onSaveEdit(formData: any) {
    if (!editItem) return;
    setSaving(true);
    try {
      await api.updateOrder(editItem.id, formData);
      toast.success('Order updated');
      setEditOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
    setSaving(false);
  }

  // ── Cancel order ──
  function openCancel(item: any) {
    setCancelItem(item);
    setCancelReason('');
    setCancelOpen(true);
  }

  async function handleCancel() {
    if (!cancelItem) return;
    if (!cancelReason.trim()) { toast.error('Please provide a cancellation reason'); return; }
    setCancelling(true);
    try {
      await api.cancelOrder(cancelItem.id, { cancellation_reason: cancelReason });
      toast.success('Order cancelled');
      setCancelOpen(false);
      fetchData();
      fetchStats();
    } catch (e: any) { toast.error(e.message || 'Cancel failed'); }
    setCancelling(false);
  }

  // ── Confirm order ──
  async function handleConfirm(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'confirming' }));
    try {
      await api.confirmOrder(id);
      toast.success('Order confirmed');
      fetchData();
      fetchStats();
    } catch { toast.error('Failed to confirm order'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Soft delete ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteOrder(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Restore ──
  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreOrder(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Permanent delete ──
  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this order? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.deleteOrder(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); fetchStats(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Orders" />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-5 gap-4 mb-5">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-slate-600', bg: 'bg-slate-100' },
          { label: 'Failed', value: stats.failed, color: 'text-red-700', bg: 'bg-red-50' },
        ].map(stat => (
          <div key={stat.label} className={cn('rounded-xl px-4 py-3', stat.bg)}>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search orders..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={orderStatusFilter} onChange={e => { setOrderStatusFilter(e.target.value); setPage(1); }}>
            {ORDER_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={selectClass} value={paymentStatusFilter} onChange={e => { setPaymentStatusFilter(e.target.value); setPage(1); }}>
            {PAYMENT_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button variant={showTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
            <Trash2 className="w-4 h-4" />
            Trash
            {trashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </Button>
        </div>
      </DataToolbar>

      {/* ── Table ── */}
      {loading ? (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title={showTrash ? 'Trash is empty' : 'No orders found'}
          description={showTrash ? 'No deleted orders found' : 'Orders will appear here once customers place them'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="cursor-pointer" onClick={() => toggleSort('order_number')}>
                  <div className="flex items-center gap-1">ORDER # <SortIcon field="order_number" /></div>
                </TH>
                <TH>USER</TH>
                <TH>ITEMS</TH>
                <TH>SUBTOTAL</TH>
                <TH>DISCOUNT</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('total_amount')}>
                  <div className="flex items-center gap-1">TOTAL <SortIcon field="total_amount" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('order_status')}>
                  <div className="flex items-center gap-1">STATUS <SortIcon field="order_status" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('payment_status')}>
                  <div className="flex items-center gap-1">PAYMENT <SortIcon field="payment_status" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}>
                  <div className="flex items-center gap-1">CREATED <SortIcon field="created_at" /></div>
                </TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item) => {
                const actionState = actionLoaders[item.id];
                const userName = item.users?.full_name || item.users?.email || `User #${item.user_id}`;
                return (
                  <TR key={item.id}>
                    <TD>
                      <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        {item.order_number || `#${item.id}`}
                      </code>
                    </TD>
                    <TD>
                      <div className="text-sm font-medium text-slate-900 truncate max-w-[160px]">{userName}</div>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-700">{item.item_count ?? '--'}</span>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-700">{formatCurrency(item.subtotal)}</span>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-700">{formatCurrency(item.discount_amount)}</span>
                    </TD>
                    <TD>
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.total_amount)}</span>
                    </TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        ORDER_STATUS_COLORS[item.order_status] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.order_status)}
                      </span>
                    </TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        PAYMENT_STATUS_COLORS[item.payment_status] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.payment_status)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-500">{item.created_at ? fromNow(item.created_at) : '--'}</span>
                    </TD>
                    <TD className="text-right">
                      {actionState ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                      ) : showTrash ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleRestore(item.id)}>
                            <RotateCcw className="w-4 h-4" /> Restore
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handlePermanentDelete(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-48">
                          <DropdownItem icon={Eye} onClick={() => openView(item.id)}>View</DropdownItem>
                          <DropdownItem icon={Edit2} onClick={() => openEdit(item)}>Edit</DropdownItem>
                          <DropdownDivider />
                          {item.order_status === 'pending' && (
                            <DropdownItem icon={Check} onClick={() => handleConfirm(item.id)}>Confirm Order</DropdownItem>
                          )}
                          {!['cancelled', 'failed'].includes(item.order_status) && (
                            <DropdownItem icon={Ban} onClick={() => openCancel(item)}>Cancel Order</DropdownItem>
                          )}
                          <DropdownDivider />
                          <DropdownItem icon={Trash2} danger onClick={() => handleSoftDelete(item.id)}>Delete</DropdownItem>
                        </Dropdown>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ── */}
      {total > pageSize && (
        <div className="mt-4">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / pageSize)}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}

      {/* ═══ VIEW DIALOG ═══ */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Order Details" size="lg">
        {viewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : viewItem ? (
          <div className="p-6 space-y-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <code className="text-lg font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded">
                {viewItem.order_number || `#${viewItem.id}`}
              </code>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  ORDER_STATUS_COLORS[viewItem.order_status] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(viewItem.order_status)}
                </span>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  PAYMENT_STATUS_COLORS[viewItem.payment_status] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(viewItem.payment_status)}
                </span>
              </div>
            </div>

            {/* Details grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="User" value={viewItem.users?.full_name || viewItem.users?.email || `User #${viewItem.user_id}`} />
              <DetailRow label="Email" value={viewItem.users?.email} />
              <DetailRow label="Subtotal" value={formatCurrency(viewItem.subtotal)} />
              <DetailRow label="Discount" value={formatCurrency(viewItem.discount_amount)} />
              <DetailRow label="Tax" value={formatCurrency(viewItem.tax_amount)} />
              <DetailRow label="Total" value={formatCurrency(viewItem.total_amount)} />
              <DetailRow label="Coupon Code" value={viewItem.coupon_code} />
              <DetailRow label="Payment Method" value={capitalize(viewItem.payment_method || '')} />
              <DetailRow label="Transaction ID" value={viewItem.transaction_id} />
              <DetailRow label="Notes" value={viewItem.notes} />
              <DetailRow label="Admin Notes" value={viewItem.admin_notes} />
              <DetailRow label="Cancellation Reason" value={viewItem.cancellation_reason} />
              <DetailRow label="Created" value={viewItem.created_at ? fromNow(viewItem.created_at) : '--'} />
              <DetailRow label="Updated" value={viewItem.updated_at ? fromNow(viewItem.updated_at) : '--'} />
            </dl>

            {/* Order Items */}
            {orderItems.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Order Items</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">#</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Item</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500 uppercase">Type</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase">Price</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase">Qty</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orderItems.map((oi: any, idx: number) => (
                        <tr key={oi.id || idx}>
                          <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">
                            {oi.item_name || oi.courses?.name || oi.bundles?.name || `Item #${oi.item_id || oi.id}`}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{capitalize(oi.item_type || '')}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(oi.unit_price)}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{oi.quantity || 1}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(oi.total_price || oi.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ EDIT DIALOG ═══ */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit Order" size="md">
        <form onSubmit={handleSubmit(onSaveEdit)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Customer-facing notes..."
              {...register('notes')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Admin Notes</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Internal admin notes..."
              {...register('admin_notes')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Update Order</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ CANCEL DIALOG ═══ */}
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Order" size="md">
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Are you sure you want to cancel this order?</p>
              <p className="text-xs text-amber-600 mt-1">
                Order {cancelItem?.order_number || `#${cancelItem?.id}`} — {formatCurrency(cancelItem?.total_amount)}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cancellation Reason *</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Please provide a reason for cancellation..."
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Go Back</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
              <Ban className="w-4 h-4" />
              Cancel Order
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
