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
  Eye, ArrowUpDown, ArrowUp, ArrowDown, Loader2, X, MoreVertical,
  FileText, RotateCcw, Trash2, AlertTriangle, CheckCircle2, XCircle,
  Ban, Send, RefreshCw,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type MainTab = 'invoices' | 'refunds';

type InvoiceSortField = 'id' | 'invoice_number' | 'total_amount' | 'invoice_status' | 'created_at';
type RefundSortField = 'id' | 'refund_number' | 'refund_amount' | 'refund_type' | 'refund_status' | 'created_at';

// ─── Constants ────────────────────────────────────────────────────
const INVOICE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'issued', label: 'Issued' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

const INVOICE_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
  refunded: 'bg-purple-50 text-purple-700',
};

const REFUND_STATUS_OPTIONS = [
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
];

const REFUND_STATUS_COLORS: Record<string, string> = {
  requested: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  processing: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  failed: 'bg-slate-100 text-slate-600',
};

const REFUND_TYPE_COLORS: Record<string, string> = {
  full: 'bg-emerald-50 text-emerald-700',
  partial: 'bg-amber-50 text-amber-700',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

// ─── Helpers ──────────────────────────────────────────────────────
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
export default function InvoiceManagementPage() {
  const [mainTab, setMainTab] = useState<MainTab>('invoices');

  return (
    <div className="animate-fade-in">
      <PageHeader title="Invoice & Refund Management" />

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'invoices' as MainTab, label: 'Invoices', icon: FileText },
          { id: 'refunds' as MainTab, label: 'Refunds', icon: RefreshCw },
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
      {mainTab === 'invoices' && <InvoicesTab />}
      {mainTab === 'refunds' && <RefundsTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: INVOICES
// ══════════════════════════════════════════════════════════════════
function InvoicesTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [sort, setSort] = useState<InvoiceSortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // ── Confirm dialogs ──
  const [issueConfirmId, setIssueConfirmId] = useState<number | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&sort=${sort}&ascending=${asc}`;
      if (showTrash) qs += '&show_deleted=true';
      if (search) qs += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) qs += `&invoice_status=${statusFilter}`;
      const res = await api.listInvoices(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load invoices'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, statusFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.listInvoices('?show_deleted=true&limit=1');
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  // ── Sort helper ──
  function toggleSort(field: InvoiceSortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: InvoiceSortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ── Actions ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteInvoice(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreInvoice(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this invoice? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.deleteInvoice(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleIssueInvoice(id: number) {
    setIssueConfirmId(null);
    setActionLoaders(p => ({ ...p, [id]: 'issuing' }));
    try { await api.issueInvoice(id); toast.success('Invoice issued'); fetchData(); }
    catch (e: any) { toast.error(e.message || 'Failed to issue invoice'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleCancelInvoice(id: number) {
    setCancelConfirmId(null);
    setActionLoaders(p => ({ ...p, [id]: 'cancelling' }));
    try { await api.cancelInvoice(id); toast.success('Invoice cancelled'); fetchData(); }
    catch (e: any) { toast.error(e.message || 'Failed to cancel invoice'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getInvoice(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load invoice'); }
    setViewLoading(false);
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search invoices..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {INVOICE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          icon={FileText}
          title={showTrash ? 'Trash is empty' : 'No invoices yet'}
          description={showTrash ? 'No deleted invoices found' : 'Invoices will appear here when orders are placed'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="cursor-pointer" onClick={() => toggleSort('invoice_number')}>
                  <div className="flex items-center gap-1">INVOICE # <SortIcon field="invoice_number" /></div>
                </TH>
                <TH>ORDER</TH>
                <TH>USER</TH>
                <TH>SUBTOTAL</TH>
                <TH>DISCOUNT</TH>
                <TH>TAX</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('total_amount')}>
                  <div className="flex items-center gap-1">TOTAL <SortIcon field="total_amount" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('invoice_status')}>
                  <div className="flex items-center gap-1">STATUS <SortIcon field="invoice_status" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}>
                  <div className="flex items-center gap-1">ISSUED <SortIcon field="created_at" /></div>
                </TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item) => {
                const actionState = actionLoaders[item.id];
                return (
                  <TR key={item.id}>
                    <TD>
                      <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        {item.invoice_number || `INV-${item.id}`}
                      </code>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-700">
                        {item.order?.order_number || item.order_id || '--'}
                      </span>
                    </TD>
                    <TD>
                      {item.user ? (
                        <div>
                          <div className="text-sm font-medium text-slate-900">{item.user.full_name || '--'}</div>
                          {item.user.email && <div className="text-xs text-slate-500">{item.user.email}</div>}
                        </div>
                      ) : <span className="text-sm text-slate-400">--</span>}
                    </TD>
                    <TD><span className="text-sm text-slate-700">{`₹${item.subtotal?.toFixed(2) ?? '0.00'}`}</span></TD>
                    <TD><span className="text-sm text-slate-700">{`₹${item.discount_amount?.toFixed(2) ?? '0.00'}`}</span></TD>
                    <TD><span className="text-sm text-slate-700">{`₹${item.tax_amount?.toFixed(2) ?? '0.00'}`}</span></TD>
                    <TD><span className="text-sm font-semibold text-slate-900">{`₹${item.total_amount?.toFixed(2) ?? '0.00'}`}</span></TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', INVOICE_STATUS_COLORS[item.invoice_status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.invoice_status)}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-500">{fromNow(item.created_at)}</span></TD>
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
                          {item.invoice_status === 'draft' && (
                            <DropdownItem icon={Send} onClick={() => setIssueConfirmId(item.id)}>Issue Invoice</DropdownItem>
                          )}
                          {(item.invoice_status === 'draft' || item.invoice_status === 'issued') && (
                            <DropdownItem icon={Ban} onClick={() => setCancelConfirmId(item.id)}>Cancel Invoice</DropdownItem>
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
      <Dialog open={viewOpen} onClose={() => { setViewOpen(false); setViewItem(null); }} title="Invoice Details" size="lg">
        {viewLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 rounded" />)}
          </div>
        ) : viewItem ? (
          <div className="p-6 space-y-6">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Invoice Number" value={viewItem.invoice_number || `INV-${viewItem.id}`} />
              <DetailRow label="Status" value={capitalize(viewItem.invoice_status)} />
              <DetailRow label="Order Number" value={viewItem.order?.order_number || viewItem.order_id?.toString()} />
              <DetailRow label="User" value={viewItem.user?.full_name} />
              <DetailRow label="Subtotal" value={`₹${viewItem.subtotal?.toFixed(2) ?? '0.00'}`} />
              <DetailRow label="Discount" value={`₹${viewItem.discount_amount?.toFixed(2) ?? '0.00'}`} />
              <DetailRow label="Tax Amount" value={`₹${viewItem.tax_amount?.toFixed(2) ?? '0.00'}`} />
              <DetailRow label="Total Amount" value={`₹${viewItem.total_amount?.toFixed(2) ?? '0.00'}`} />
              <DetailRow label="Payment Method" value={capitalize(viewItem.payment_method || '')} />
              <DetailRow label="Transaction ID" value={viewItem.transaction_id} />
              <DetailRow label="Issued At" value={viewItem.issued_at ? fromNow(viewItem.issued_at) : '--'} />
              <DetailRow label="Created At" value={fromNow(viewItem.created_at)} />
            </dl>

            {/* Billing Info */}
            {(viewItem.billing_name || viewItem.billing_email || viewItem.billing_address) && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Billing Information</h4>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <DetailRow label="Billing Name" value={viewItem.billing_name} />
                  <DetailRow label="Billing Email" value={viewItem.billing_email} />
                  <DetailRow label="Billing Phone" value={viewItem.billing_phone} />
                  <DetailRow label="Billing Address" value={viewItem.billing_address} />
                  <DetailRow label="GSTIN" value={viewItem.billing_gstin} />
                  <DetailRow label="PAN" value={viewItem.billing_pan} />
                </dl>
              </div>
            )}

            {viewItem.notes && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Notes</h4>
                <p className="text-sm text-slate-600">{viewItem.notes}</p>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ ISSUE CONFIRM DIALOG ═══ */}
      <Dialog open={issueConfirmId !== null} onClose={() => setIssueConfirmId(null)} title="Issue Invoice" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-700">Are you sure you want to issue this invoice? This will mark it as officially issued.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setIssueConfirmId(null)}>Cancel</Button>
            <Button size="sm" onClick={() => issueConfirmId && handleIssueInvoice(issueConfirmId)}>
              <Send className="w-4 h-4" /> Issue Invoice
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ═══ CANCEL CONFIRM DIALOG ═══ */}
      <Dialog open={cancelConfirmId !== null} onClose={() => setCancelConfirmId(null)} title="Cancel Invoice" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-700">Are you sure you want to cancel this invoice? This action cannot be easily undone.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCancelConfirmId(null)}>Go Back</Button>
            <Button variant="danger" size="sm" onClick={() => cancelConfirmId && handleCancelInvoice(cancelConfirmId)}>
              <Ban className="w-4 h-4" /> Cancel Invoice
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: REFUNDS
// ══════════════════════════════════════════════════════════════════
function RefundsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [sort, setSort] = useState<RefundSortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // ── Reject dialog ──
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // ── Approve confirm ──
  const [approveConfirmId, setApproveConfirmId] = useState<number | null>(null);

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&sort=${sort}&ascending=${asc}`;
      if (showTrash) qs += '&show_deleted=true';
      if (search) qs += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) qs += `&refund_status=${statusFilter}`;
      const res = await api.listRefunds(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load refunds'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, statusFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.listRefunds('?show_deleted=true&limit=1');
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  // ── Sort helper ──
  function toggleSort(field: RefundSortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: RefundSortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ── Actions ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteRefund(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreRefund(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this refund? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.deleteRefund(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleApproveRefund(id: number) {
    setApproveConfirmId(null);
    setActionLoaders(p => ({ ...p, [id]: 'approving' }));
    try { await api.approveRefund(id); toast.success('Refund approved'); fetchData(); }
    catch (e: any) { toast.error(e.message || 'Failed to approve refund'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRejectRefund() {
    if (!rejectId) return;
    setRejecting(true);
    try {
      await api.rejectRefund(rejectId, { rejection_reason: rejectionReason });
      toast.success('Refund rejected');
      setRejectId(null);
      setRejectionReason('');
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Failed to reject refund'); }
    setRejecting(false);
  }

  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getRefund(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load refund'); }
    setViewLoading(false);
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search refunds..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {REFUND_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          icon={RefreshCw}
          title={showTrash ? 'Trash is empty' : 'No refunds yet'}
          description={showTrash ? 'No deleted refunds found' : 'Refund requests will appear here'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="cursor-pointer" onClick={() => toggleSort('refund_number')}>
                  <div className="flex items-center gap-1">REFUND # <SortIcon field="refund_number" /></div>
                </TH>
                <TH>ORDER</TH>
                <TH>USER</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('refund_amount')}>
                  <div className="flex items-center gap-1">AMOUNT <SortIcon field="refund_amount" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('refund_type')}>
                  <div className="flex items-center gap-1">TYPE <SortIcon field="refund_type" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('refund_status')}>
                  <div className="flex items-center gap-1">STATUS <SortIcon field="refund_status" /></div>
                </TH>
                <TH>RAZORPAY ID</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}>
                  <div className="flex items-center gap-1">REQUESTED <SortIcon field="created_at" /></div>
                </TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item) => {
                const actionState = actionLoaders[item.id];
                return (
                  <TR key={item.id}>
                    <TD>
                      <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        {item.refund_number || `REF-${item.id}`}
                      </code>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-700">
                        {item.order?.order_number || item.order_id || '--'}
                      </span>
                    </TD>
                    <TD>
                      {item.user ? (
                        <div>
                          <div className="text-sm font-medium text-slate-900">{item.user.full_name || '--'}</div>
                          {item.user.email && <div className="text-xs text-slate-500">{item.user.email}</div>}
                        </div>
                      ) : <span className="text-sm text-slate-400">--</span>}
                    </TD>
                    <TD><span className="text-sm font-semibold text-slate-900">{`₹${item.refund_amount?.toFixed(2) ?? '0.00'}`}</span></TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', REFUND_TYPE_COLORS[item.refund_type] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.refund_type)}
                      </span>
                    </TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', REFUND_STATUS_COLORS[item.refund_status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.refund_status)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-xs text-slate-500 font-mono">
                        {item.razorpay_refund_id || '--'}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-500">{fromNow(item.created_at)}</span></TD>
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
                          {item.refund_status === 'requested' && (
                            <>
                              <DropdownItem icon={CheckCircle2} onClick={() => setApproveConfirmId(item.id)}>Approve</DropdownItem>
                              <DropdownItem icon={XCircle} onClick={() => { setRejectId(item.id); setRejectionReason(''); }}>Reject</DropdownItem>
                            </>
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
      <Dialog open={viewOpen} onClose={() => { setViewOpen(false); setViewItem(null); }} title="Refund Details" size="lg">
        {viewLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 rounded" />)}
          </div>
        ) : viewItem ? (
          <div className="p-6 space-y-6">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Refund Number" value={viewItem.refund_number || `REF-${viewItem.id}`} />
              <DetailRow label="Status" value={capitalize(viewItem.refund_status)} />
              <DetailRow label="Order Number" value={viewItem.order?.order_number || viewItem.order_id?.toString()} />
              <DetailRow label="User" value={viewItem.user?.full_name} />
              <DetailRow label="Refund Amount" value={`₹${viewItem.refund_amount?.toFixed(2) ?? '0.00'}`} />
              <DetailRow label="Refund Type" value={capitalize(viewItem.refund_type)} />
              <DetailRow label="Reason" value={viewItem.reason} />
              <DetailRow label="Razorpay Refund ID" value={viewItem.razorpay_refund_id} />
              <DetailRow label="Requested At" value={fromNow(viewItem.created_at)} />
              <DetailRow label="Processed At" value={viewItem.processed_at ? fromNow(viewItem.processed_at) : '--'} />
            </dl>

            {/* Approval / Rejection info */}
            {(viewItem.approved_by || viewItem.rejected_by || viewItem.rejection_reason) && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Approval / Rejection</h4>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                  {viewItem.approved_by && (
                    <DetailRow label="Approved By" value={viewItem.approved_by_user?.full_name || viewItem.approved_by?.toString()} />
                  )}
                  {viewItem.approved_at && (
                    <DetailRow label="Approved At" value={fromNow(viewItem.approved_at)} />
                  )}
                  {viewItem.rejected_by && (
                    <DetailRow label="Rejected By" value={viewItem.rejected_by_user?.full_name || viewItem.rejected_by?.toString()} />
                  )}
                  {viewItem.rejected_at && (
                    <DetailRow label="Rejected At" value={fromNow(viewItem.rejected_at)} />
                  )}
                  {viewItem.rejection_reason && (
                    <div className="col-span-2">
                      <DetailRow label="Rejection Reason" value={viewItem.rejection_reason} />
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Admin notes */}
            {viewItem.admin_notes && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-1">Admin Notes</h4>
                <p className="text-sm text-slate-600">{viewItem.admin_notes}</p>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ APPROVE CONFIRM DIALOG ═══ */}
      <Dialog open={approveConfirmId !== null} onClose={() => setApproveConfirmId(null)} title="Approve Refund" size="sm">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-700">Are you sure you want to approve this refund request? The refund will be processed.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setApproveConfirmId(null)}>Cancel</Button>
            <Button size="sm" onClick={() => approveConfirmId && handleApproveRefund(approveConfirmId)}>
              <CheckCircle2 className="w-4 h-4" /> Approve Refund
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ═══ REJECT DIALOG ═══ */}
      <Dialog open={rejectId !== null} onClose={() => { setRejectId(null); setRejectionReason(''); }} title="Reject Refund" size="md">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-700">Please provide a reason for rejecting this refund request.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Rejection Reason</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Explain why this refund is being rejected..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setRejectId(null); setRejectionReason(''); }}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={handleRejectRefund} disabled={!rejectionReason.trim() || rejecting}>
              {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Reject Refund
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
