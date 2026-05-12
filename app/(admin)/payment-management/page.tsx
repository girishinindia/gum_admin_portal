'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
  Eye, ArrowUpDown, ArrowUp, ArrowDown, Loader2, X, MoreVertical,
  CreditCard, ArrowLeftRight, Trash2, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type MainTab = 'payments' | 'transactions';
type PaymentSortField = 'id' | 'amount' | 'payment_method' | 'payment_status' | 'captured_at' | 'created_at';
type TransactionSortField = 'id' | 'transaction_type' | 'amount' | 'status' | 'created_at';

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  initiated: 'bg-slate-50 text-slate-700',
  authorized: 'bg-blue-50 text-blue-700',
  captured: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  refunded: 'bg-purple-50 text-purple-700',
  partially_refunded: 'bg-amber-50 text-amber-700',
};

const TXN_TYPE_COLORS: Record<string, string> = {
  payment: 'bg-emerald-50 text-emerald-700',
  refund: 'bg-red-50 text-red-700',
  partial_refund: 'bg-amber-50 text-amber-700',
  credit: 'bg-blue-50 text-blue-700',
  debit: 'bg-orange-50 text-orange-700',
  adjustment: 'bg-slate-50 text-slate-700',
};

const TXN_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  reversed: 'bg-purple-50 text-purple-700',
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

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE — 2-TAB LAYOUT
// ══════════════════════════════════════════════════════════════════
export default function PaymentManagementPage() {
  const [mainTab, setMainTab] = useState<MainTab>('payments');

  return (
    <div className="animate-fade-in">
      <PageHeader title="Payment Management" />

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'payments' as MainTab, label: 'Payments', icon: CreditCard },
          { id: 'transactions' as MainTab, label: 'Transactions', icon: ArrowLeftRight },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
                mainTab === tab.id ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {mainTab === 'payments' && <PaymentsTab />}
      {mainTab === 'transactions' && <TransactionsTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: PAYMENTS
// ══════════════════════════════════════════════════════════════════
function PaymentsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [sort, setSort] = useState<PaymentSortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&sort=${sort}&ascending=${asc}`;
      if (showTrash) qs += '&show_deleted=true';
      if (statusFilter) qs += `&payment_status=${statusFilter}`;
      if (methodFilter) qs += `&payment_method=${methodFilter}`;
      const res = await api.listPayments(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load payments'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, statusFilter, methodFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.listPayments('?show_deleted=true&limit=1');
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  // ── Sort helper ──
  function toggleSort(field: PaymentSortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: PaymentSortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ── View ──
  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getPayment(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load payment'); }
    setViewLoading(false);
  }

  // ── Actions ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeletePayment(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restorePayment(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this payment? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.deletePayment(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search payments..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="initiated">Initiated</option>
            <option value="authorized">Authorized</option>
            <option value="captured">Captured</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
          </select>
          <select className={selectClass} value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1); }}>
            <option value="">All Methods</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="netbanking">Net Banking</option>
            <option value="wallet">Wallet</option>
            <option value="emi">EMI</option>
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
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={showTrash ? 'Trash is empty' : 'No payments yet'}
          description={showTrash ? 'No deleted payments found' : 'Payments will appear here once orders are placed'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12">#</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('id')}>
                  <div className="flex items-center gap-1">ID <SortIcon field="id" /></div>
                </TH>
                <TH>ORDER</TH>
                <TH>RAZORPAY ID</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('amount')}>
                  <div className="flex items-center gap-1">AMOUNT <SortIcon field="amount" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('payment_method')}>
                  <div className="flex items-center gap-1">METHOD <SortIcon field="payment_method" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('payment_status')}>
                  <div className="flex items-center gap-1">STATUS <SortIcon field="payment_status" /></div>
                </TH>
                <TH>CARD</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('captured_at')}>
                  <div className="flex items-center gap-1">CAPTURED AT <SortIcon field="captured_at" /></div>
                </TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item, idx) => {
                const actionState = actionLoaders[item.id];
                return (
                  <TR key={item.id}>
                    <TD className="text-slate-400 text-xs">{(page - 1) * pageSize + idx + 1}</TD>
                    <TD><span className="text-sm font-medium text-slate-900">{item.id}</span></TD>
                    <TD><span className="text-sm text-slate-700">#{item.order_id || '--'}</span></TD>
                    <TD>
                      <code className="text-xs text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                        {item.razorpay_payment_id || '--'}
                      </code>
                    </TD>
                    <TD><span className="text-sm font-semibold text-slate-900">{`₹${item.amount?.toFixed(2)}`}</span></TD>
                    <TD><span className="text-sm text-slate-700">{capitalize(item.payment_method || '')}</span></TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', PAYMENT_STATUS_COLORS[item.payment_status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.payment_status || '')}
                      </span>
                    </TD>
                    <TD>
                      {item.card_last4 ? (
                        <span className="text-xs text-slate-600">
                          ****{item.card_last4} {item.card_network ? `(${item.card_network})` : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">--</span>
                      )}
                    </TD>
                    <TD><span className="text-sm text-slate-500">{item.captured_at ? fromNow(item.captured_at) : '--'}</span></TD>
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
                        <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-44">
                          <DropdownItem icon={Eye} onClick={() => openView(item.id)}>View</DropdownItem>
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
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Payment Details" size="lg">
        {viewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : viewItem ? (
          <div className="p-6 space-y-5">
            {/* Status + Amount header */}
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">{`₹${viewItem.amount?.toFixed(2)}`}</span>
              <span className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium', PAYMENT_STATUS_COLORS[viewItem.payment_status] || 'bg-slate-100 text-slate-600')}>
                {capitalize(viewItem.payment_status || '')}
              </span>
            </div>

            {/* Grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Payment ID" value={viewItem.id?.toString()} />
              <DetailRow label="Order ID" value={viewItem.order_id ? `#${viewItem.order_id}` : null} />
              <DetailRow label="Razorpay Payment ID" value={viewItem.razorpay_payment_id} />
              <DetailRow label="Razorpay Order ID" value={viewItem.razorpay_order_id} />
              <DetailRow label="Amount" value={`₹${viewItem.amount?.toFixed(2)}`} />
              <DetailRow label="Currency" value={viewItem.currency || 'INR'} />
              <DetailRow label="Payment Method" value={capitalize(viewItem.payment_method || '')} />
              <DetailRow label="Payment Status" value={capitalize(viewItem.payment_status || '')} />
              <DetailRow label="Card Last 4" value={viewItem.card_last4 ? `****${viewItem.card_last4}` : null} />
              <DetailRow label="Card Network" value={viewItem.card_network} />
              <DetailRow label="Bank" value={viewItem.bank} />
              <DetailRow label="Wallet" value={viewItem.wallet} />
              <DetailRow label="VPA" value={viewItem.vpa} />
              <DetailRow label="International" value={viewItem.international ? 'Yes' : 'No'} />
              <DetailRow label="Captured At" value={viewItem.captured_at ? fromNow(viewItem.captured_at) : null} />
              <DetailRow label="Fee" value={viewItem.fee ? `₹${viewItem.fee?.toFixed(2)}` : null} />
              <DetailRow label="Tax" value={viewItem.tax ? `₹${viewItem.tax?.toFixed(2)}` : null} />
              <DetailRow label="Created" value={viewItem.created_at ? fromNow(viewItem.created_at) : null} />
              <DetailRow label="Updated" value={viewItem.updated_at ? fromNow(viewItem.updated_at) : null} />
            </dl>

            {/* Error details */}
            {viewItem.payment_status === 'failed' && (viewItem.error_code || viewItem.error_description) && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">Error Details</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <DetailRow label="Error Code" value={viewItem.error_code} />
                  <DetailRow label="Error Source" value={viewItem.error_source} />
                  <DetailRow label="Error Step" value={viewItem.error_step} />
                  <DetailRow label="Error Reason" value={viewItem.error_reason} />
                </dl>
                {viewItem.error_description && (
                  <div className="mt-3">
                    <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Description</dt>
                    <dd className="mt-0.5 text-sm text-red-800">{viewItem.error_description}</dd>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: TRANSACTIONS
// ══════════════════════════════════════════════════════════════════
function TransactionsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [sort, setSort] = useState<TransactionSortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&sort=${sort}&ascending=${asc}`;
      if (showTrash) qs += '&show_deleted=true';
      if (typeFilter) qs += `&transaction_type=${typeFilter}`;
      if (statusFilter) qs += `&status=${statusFilter}`;
      const res = await api.listTransactions(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load transactions'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, typeFilter, statusFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.listTransactions('?show_deleted=true&limit=1');
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  // ── Sort helper ──
  function toggleSort(field: TransactionSortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: TransactionSortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ── View ──
  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getTransaction(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load transaction'); }
    setViewLoading(false);
  }

  // ── Actions ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteTransaction(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreTransaction(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this transaction? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.deleteTransaction(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search transactions..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            <option value="payment">Payment</option>
            <option value="refund">Refund</option>
            <option value="partial_refund">Partial Refund</option>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
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
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title={showTrash ? 'Trash is empty' : 'No transactions yet'}
          description={showTrash ? 'No deleted transactions found' : 'Transactions will appear here as payments are processed'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12">#</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('id')}>
                  <div className="flex items-center gap-1">TXN # <SortIcon field="id" /></div>
                </TH>
                <TH>ORDER</TH>
                <TH>USER</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('transaction_type')}>
                  <div className="flex items-center gap-1">TYPE <SortIcon field="transaction_type" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('amount')}>
                  <div className="flex items-center gap-1">AMOUNT <SortIcon field="amount" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('status')}>
                  <div className="flex items-center gap-1">STATUS <SortIcon field="status" /></div>
                </TH>
                <TH>DESCRIPTION</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}>
                  <div className="flex items-center gap-1">CREATED <SortIcon field="created_at" /></div>
                </TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item, idx) => {
                const actionState = actionLoaders[item.id];
                return (
                  <TR key={item.id}>
                    <TD className="text-slate-400 text-xs">{(page - 1) * pageSize + idx + 1}</TD>
                    <TD><span className="text-sm font-medium text-slate-900">{item.id}</span></TD>
                    <TD><span className="text-sm text-slate-700">#{item.order_id || '--'}</span></TD>
                    <TD>
                      <span className="text-sm text-slate-700">
                        {item.users?.full_name || item.users?.email || (item.user_id ? `#${item.user_id}` : '--')}
                      </span>
                    </TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', TXN_TYPE_COLORS[item.transaction_type] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.transaction_type || '')}
                      </span>
                    </TD>
                    <TD><span className="text-sm font-semibold text-slate-900">{`₹${item.amount?.toFixed(2)}`}</span></TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', TXN_STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.status || '')}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-600 truncate max-w-[180px] block">
                        {item.description || '--'}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-500">{item.created_at ? fromNow(item.created_at) : '--'}</span></TD>
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
                        <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-44">
                          <DropdownItem icon={Eye} onClick={() => openView(item.id)}>View</DropdownItem>
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
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Transaction Details" size="lg">
        {viewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : viewItem ? (
          <div className="p-6 space-y-5">
            {/* Amount + Status header */}
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">{`₹${viewItem.amount?.toFixed(2)}`}</span>
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium', TXN_TYPE_COLORS[viewItem.transaction_type] || 'bg-slate-100 text-slate-600')}>
                  {capitalize(viewItem.transaction_type || '')}
                </span>
                <span className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium', TXN_STATUS_COLORS[viewItem.status] || 'bg-slate-100 text-slate-600')}>
                  {capitalize(viewItem.status || '')}
                </span>
              </div>
            </div>

            {/* Grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Transaction ID" value={viewItem.id?.toString()} />
              <DetailRow label="Order ID" value={viewItem.order_id ? `#${viewItem.order_id}` : null} />
              <DetailRow label="User" value={viewItem.users?.full_name || viewItem.users?.email || (viewItem.user_id ? `#${viewItem.user_id}` : null)} />
              <DetailRow label="Payment ID" value={viewItem.payment_id ? `#${viewItem.payment_id}` : null} />
              <DetailRow label="Transaction Type" value={capitalize(viewItem.transaction_type || '')} />
              <DetailRow label="Amount" value={`₹${viewItem.amount?.toFixed(2)}`} />
              <DetailRow label="Status" value={capitalize(viewItem.status || '')} />
              <DetailRow label="Reference ID" value={viewItem.reference_id} />
              <DetailRow label="Description" value={viewItem.description} />
              <DetailRow label="Notes" value={viewItem.notes} />
              <DetailRow label="Created" value={viewItem.created_at ? fromNow(viewItem.created_at) : null} />
              <DetailRow label="Updated" value={viewItem.updated_at ? fromNow(viewItem.updated_at) : null} />
            </dl>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
