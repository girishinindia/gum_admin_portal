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
  Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  RotateCcw, Loader2, MoreVertical, Wallet,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type SortField = 'id' | 'earning_amount' | 'earning_status' | 'item_type' | 'created_at';

const EARNING_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'paid', label: 'Paid' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ITEM_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'course', label: 'Course' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'batch', label: 'Batch' },
  { value: 'webinar', label: 'Webinar' },
];

const EARNING_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  reversed: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  course: 'bg-blue-50 text-blue-700',
  bundle: 'bg-purple-50 text-purple-700',
  batch: 'bg-amber-50 text-amber-700',
  webinar: 'bg-rose-50 text-rose-700',
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
export default function InstructorEarningsPage() {
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
  const [statusFilter, setStatusFilter] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── Stats state ──
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, paid: 0 });

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // ── Edit state ──
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  // ── Action loaders ──
  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: pageSize,
        sort,
        ascending: asc,
      };
      if (showTrash) params.show_deleted = true;
      if (search) params.search = search;
      if (statusFilter) params.earning_status = statusFilter;
      if (itemTypeFilter) params.item_type = itemTypeFilter;
      const res = await api.getInstructorEarnings(params);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load earnings'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, statusFilter, itemTypeFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.getInstructorEarnings({ show_deleted: true, limit: 1 });
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [all, pending, confirmed, paid] = await Promise.all([
        api.getInstructorEarnings({ limit: 1 }),
        api.getInstructorEarnings({ limit: 1, earning_status: 'pending' }),
        api.getInstructorEarnings({ limit: 1, earning_status: 'confirmed' }),
        api.getInstructorEarnings({ limit: 1, earning_status: 'paid' }),
      ]);
      setStats({
        total: all.pagination?.total || 0,
        pending: pending.pagination?.total || 0,
        confirmed: confirmed.pagination?.total || 0,
        paid: paid.pagination?.total || 0,
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

  // ── View earning ──
  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getInstructorEarning(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load earning details'); }
    setViewLoading(false);
  }

  // ── Edit earning ──
  function openEdit(item: any) {
    setEditItem(item);
    reset({
      earning_status: item.earning_status || 'pending',
      notes: item.notes || '',
    });
    setEditOpen(true);
  }

  async function onSaveEdit(formData: any) {
    if (!editItem) return;
    setSaving(true);
    try {
      await api.updateInstructorEarning(editItem.id, formData);
      toast.success('Earning updated');
      setEditOpen(false);
      fetchData();
      fetchStats();
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
    setSaving(false);
  }

  // ── Soft delete ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteInstructorEarning(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Restore ──
  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreInstructorEarning(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Permanent delete ──
  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this earning? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeleteInstructorEarning(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); fetchStats(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Instructor / Student name helpers ──
  function instructorName(item: any) {
    const u = item.instructor || item.users;
    if (u?.first_name || u?.last_name) return `${u.first_name || ''} ${u.last_name || ''}`.trim();
    if (u?.full_name) return u.full_name;
    if (u?.email) return u.email;
    return `#${item.instructor_id}`;
  }

  function studentName(item: any) {
    const u = item.student;
    if (u?.first_name || u?.last_name) return `${u.first_name || ''} ${u.last_name || ''}`.trim();
    if (u?.full_name) return u.full_name;
    if (u?.email) return u.email;
    return `#${item.student_id}`;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Instructor Earnings" />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Earnings', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Confirmed', value: stats.confirmed, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Paid', value: stats.paid, color: 'text-emerald-700', bg: 'bg-emerald-50' },
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
        searchPlaceholder="Search by earning number..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            {EARNING_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={selectClass} value={itemTypeFilter} onChange={e => { setItemTypeFilter(e.target.value); setPage(1); }}>
            {ITEM_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          icon={Wallet}
          title={showTrash ? 'Trash is empty' : 'No earnings found'}
          description={showTrash ? 'No deleted earnings found' : 'Instructor earnings will appear here when orders are placed'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="cursor-pointer" onClick={() => toggleSort('id')}>
                  <div className="flex items-center gap-1">EARNING # <SortIcon field="id" /></div>
                </TH>
                <TH>INSTRUCTOR</TH>
                <TH>STUDENT</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('item_type')}>
                  <div className="flex items-center gap-1">ITEM TYPE <SortIcon field="item_type" /></div>
                </TH>
                <TH>ORDER AMOUNT</TH>
                <TH>INSTRUCTOR SHARE</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('earning_amount')}>
                  <div className="flex items-center gap-1">EARNING AMOUNT <SortIcon field="earning_amount" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('earning_status')}>
                  <div className="flex items-center gap-1">STATUS <SortIcon field="earning_status" /></div>
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
                return (
                  <TR key={item.id}>
                    <TD>
                      <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        {item.earning_number || `#${item.id}`}
                      </code>
                    </TD>
                    <TD>
                      <div className="text-sm font-medium text-slate-900 truncate max-w-[160px]">{instructorName(item)}</div>
                    </TD>
                    <TD>
                      <div className="text-sm text-slate-700 truncate max-w-[160px]">{studentName(item)}</div>
                    </TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        ITEM_TYPE_COLORS[item.item_type] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.item_type)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-700">{formatCurrency(item.order_amount)}</span>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-700">{item.instructor_share_percentage != null ? `${item.instructor_share_percentage}%` : '--'}</span>
                    </TD>
                    <TD>
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.earning_amount)}</span>
                    </TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        EARNING_STATUS_COLORS[item.earning_status] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.earning_status)}
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
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Earning Details" size="lg">
        {viewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : viewItem ? (
          <div className="p-6 space-y-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <code className="text-lg font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded">
                {viewItem.earning_number || `#${viewItem.id}`}
              </code>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  EARNING_STATUS_COLORS[viewItem.earning_status] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(viewItem.earning_status)}
                </span>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  ITEM_TYPE_COLORS[viewItem.item_type] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(viewItem.item_type)}
                </span>
              </div>
            </div>

            {/* Details grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Earning Number" value={viewItem.earning_number} />
              <DetailRow label="Instructor" value={instructorName(viewItem)} />
              <DetailRow label="Student" value={studentName(viewItem)} />
              <DetailRow label="Order ID" value={viewItem.order_id ? `#${viewItem.order_id}` : null} />
              <DetailRow label="Item Type" value={capitalize(viewItem.item_type || '')} />
              <DetailRow label="Item ID" value={viewItem.item_id ? `#${viewItem.item_id}` : null} />
              <DetailRow label="Item Name" value={viewItem.item_name} />
              <DetailRow label="Order Amount" value={formatCurrency(viewItem.order_amount)} />
              <DetailRow label="GST Amount" value={formatCurrency(viewItem.gst_amount)} />
              <DetailRow label="Net Amount" value={formatCurrency(viewItem.net_amount)} />
              <DetailRow label="Instructor Share %" value={viewItem.instructor_share_percentage != null ? `${viewItem.instructor_share_percentage}%` : null} />
              <DetailRow label="Earning Amount" value={formatCurrency(viewItem.earning_amount)} />
              <DetailRow label="Platform Fee" value={formatCurrency(viewItem.platform_fee)} />
              <DetailRow label="Status" value={capitalize(viewItem.earning_status || '')} />
              <DetailRow label="Payout Request ID" value={viewItem.payout_request_id ? `#${viewItem.payout_request_id}` : null} />
              <DetailRow label="Confirmed At" value={viewItem.confirmed_at ? fromNow(viewItem.confirmed_at) : null} />
              <DetailRow label="Paid At" value={viewItem.paid_at ? fromNow(viewItem.paid_at) : null} />
              <DetailRow label="Reversed At" value={viewItem.reversed_at ? fromNow(viewItem.reversed_at) : null} />
              <DetailRow label="Notes" value={viewItem.notes} />
              <DetailRow label="Created" value={viewItem.created_at ? fromNow(viewItem.created_at) : null} />
              <DetailRow label="Updated" value={viewItem.updated_at ? fromNow(viewItem.updated_at) : null} />
            </dl>

            {/* Metadata JSON */}
            {viewItem.metadata && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Metadata</h4>
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto max-h-48 text-slate-700">
                  {typeof viewItem.metadata === 'string' ? viewItem.metadata : JSON.stringify(viewItem.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ EDIT DIALOG ═══ */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit Earning" size="md">
        <form onSubmit={handleSubmit(onSaveEdit)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select className={cn(selectClass, 'w-full')} {...register('earning_status')}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="paid">Paid</option>
              <option value="reversed">Reversed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Admin notes..."
              {...register('notes')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Update Earning</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
