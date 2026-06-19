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
  Loader2, X, Ticket, MoreVertical, Copy,
  BookOpen, Package, Calendar, Video, Link2, Unlink,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type MainTab = 'coupons' | 'courses' | 'bundles' | 'batches' | 'webinars';
type SortField = 'id' | 'coupon_code' | 'discount_value' | 'used_count' | 'valid_until' | 'is_active' | 'created_at';

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed_amount', label: 'Fixed Amount (₹)' },
];

const APPLICABLE_TO_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'course', label: 'Course' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'batch', label: 'Batch' },
  { value: 'webinar', label: 'Webinar' },
];

const APPLICABLE_COLORS: Record<string, string> = {
  all: 'bg-blue-50 text-blue-700',
  course: 'bg-emerald-50 text-emerald-700',
  bundle: 'bg-violet-50 text-violet-700',
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

function formatDate(d: string | null) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// BUG-67 — convert a stored UTC ISO timestamp to a LOCAL wall-clock string for
// a datetime-local input. The old `item.valid_from.slice(0, 16)` echoed the UTC
// wall-clock verbatim, so editing an existing coupon showed the wrong time and
// re-saving (local→UTC again via toISOString()) shifted it by the local offset
// (~5.5h in IST). Local getters round-trip correctly with the save side.
function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function capitalize(s: string) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '--';
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE — 5-TAB LAYOUT
// ══════════════════════════════════════════════════════════════════
export default function CouponManagementPage() {
  const [mainTab, setMainTab] = useState<MainTab>('coupons');

  return (
    <div className="animate-fade-in">
      <PageHeader title="Coupon Management" />

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'coupons' as MainTab, label: 'Coupons', icon: Ticket },
          { id: 'courses' as MainTab, label: 'Coupon Courses', icon: BookOpen },
          { id: 'bundles' as MainTab, label: 'Coupon Bundles', icon: Package },
          { id: 'batches' as MainTab, label: 'Coupon Batches', icon: Calendar },
          { id: 'webinars' as MainTab, label: 'Coupon Webinars', icon: Video },
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
      {mainTab === 'coupons' && <CouponsTab />}
      {mainTab === 'courses' && <CouponLinksTab kind="course" />}
      {mainTab === 'bundles' && <CouponLinksTab kind="bundle" />}
      {mainTab === 'batches' && <CouponLinksTab kind="batch" />}
      {mainTab === 'webinars' && <CouponLinksTab kind="webinar" />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: COUPONS (main CRUD)
// ══════════════════════════════════════════════════════════════════
function CouponsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [sort, setSort] = useState<SortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [discountFilter, setDiscountFilter] = useState('');
  const [applicableFilter, setApplicableFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── Form state ──
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [linkedCourses, setLinkedCourses] = useState<any[]>([]);
  const [linkedBundles, setLinkedBundles] = useState<any[]>([]);
  const [linkedBatches, setLinkedBatches] = useState<any[]>([]);
  const [linkedWebinars, setLinkedWebinars] = useState<any[]>([]);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&sort=${sort}&order=${asc ? 'asc' : 'desc'}`;
      if (showTrash) qs += '&show_deleted=true';
      if (search) qs += `&search=${encodeURIComponent(search)}`;
      if (discountFilter) qs += `&discount_type=${discountFilter}`;
      if (applicableFilter) qs += `&applicable_to=${applicableFilter}`;
      const res = await api.listCoupons(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load coupons'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, discountFilter, applicableFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.listCoupons('?show_deleted=true&limit=1');
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  // ── Sort helper ──
  function toggleSort(field: SortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ── Open form ──
  function openForm(item?: any) {
    if (item) {
      setEditing(item);
      reset({
        coupon_code: item.coupon_code || '',
        title: item.title || '',
        description: item.description || '',
        discount_type: item.discount_type || 'percentage',
        discount_value: item.discount_value || 0,
        applicable_to: item.applicable_to || 'all',
        max_uses: item.usage_limit ?? '',
        min_order_value: item.min_purchase_amount ?? '',
        // BUG-67: show stored UTC as local wall-clock (was .slice(0,16))
        valid_from: toLocalInput(item.valid_from),
        valid_until: toLocalInput(item.valid_until),
        is_active: item.is_active ?? true,
      });
    } else {
      setEditing(null);
      reset({
        coupon_code: '', title: '', description: '', discount_type: 'percentage',
        discount_value: 0, applicable_to: 'all', max_uses: '', min_order_value: '',
        valid_from: '', valid_until: '', is_active: true,
      });
    }
    setFormOpen(true);
  }

  // ── Save ──
  async function onSave(formData: any) {
    setSaving(true);
    try {
      const body = { ...formData };
      if (body.valid_from) body.valid_from = new Date(body.valid_from).toISOString();
      else body.valid_from = null;
      if (body.valid_until) body.valid_until = new Date(body.valid_until).toISOString();
      else body.valid_until = null;
      // Map UI field names → real DB columns (usage_limit / min_purchase_amount)
      body.usage_limit = body.max_uses ? Number(body.max_uses) : null;
      body.min_purchase_amount = body.min_order_value ? Number(body.min_order_value) : null;
      delete body.max_uses;
      delete body.min_order_value;

      if (editing) {
        await api.updateCoupon(editing.id, body);
        toast.success('Coupon updated');
      } else {
        await api.createCoupon(body);
        toast.success('Coupon created');
      }

      setFormOpen(false);
      fetchData();
      fetchTrashCount();
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  }

  // ── Actions ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteCoupon(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreCoupon(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this coupon? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.deleteCoupon(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getCoupon(id);
      setViewItem(res.data);
      const [lc, lb, lbt, lw] = await Promise.all([
        api.listCouponCourses(`?coupon_id=${id}&limit=100`),
        api.listCouponBundles(`?coupon_id=${id}&limit=100`),
        api.listCouponBatches(`?coupon_id=${id}&limit=100`),
        api.listCouponWebinars(`?coupon_id=${id}&limit=100`),
      ]);
      setLinkedCourses(lc.data || []);
      setLinkedBundles(lb.data || []);
      setLinkedBatches(lbt.data || []);
      setLinkedWebinars(lw.data || []);
    } catch { toast.error('Failed to load coupon'); }
    setViewLoading(false);
  }

  useKeyboardShortcuts([
    { key: 'ctrl+n', action: () => openForm() },
  ]);

  return (
    <>
      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search coupons..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={discountFilter} onChange={e => { setDiscountFilter(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {DISCOUNT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={selectClass} value={applicableFilter} onChange={e => { setApplicableFilter(e.target.value); setPage(1); }}>
            <option value="">All Targets</option>
            {APPLICABLE_TO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button variant={showTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
            <Trash2 className="w-4 h-4" />
            Trash
            {trashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </Button>
          {!showTrash && (
            <Button size="sm" onClick={() => openForm()}>
              <Plus className="w-4 h-4" />
              Add Coupon
            </Button>
          )}
        </div>
      </DataToolbar>

      {/* ── Table ── */}
      {loading ? (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title={showTrash ? 'Trash is empty' : 'No coupons yet'}
          description={showTrash ? 'No deleted coupons found' : 'Create your first coupon to get started'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12">#</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('coupon_code')}>
                  <div className="flex items-center gap-1">CODE <SortIcon field="coupon_code" /></div>
                </TH>
                <TH>TITLE</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('discount_value')}>
                  <div className="flex items-center gap-1">DISCOUNT <SortIcon field="discount_value" /></div>
                </TH>
                <TH>APPLIES TO</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('used_count')}>
                  <div className="flex items-center gap-1">USED <SortIcon field="used_count" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('valid_until')}>
                  <div className="flex items-center gap-1">VALID UNTIL <SortIcon field="valid_until" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('is_active')}>
                  <div className="flex items-center gap-1">STATUS <SortIcon field="is_active" /></div>
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
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">{item.coupon_code}</code>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(item.coupon_code); toast.success('Copied!'); }} className="text-slate-400 hover:text-slate-600">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TD>
                    <TD><div className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{item.title}</div></TD>
                    <TD>
                      <Badge variant={item.discount_type === 'percentage' ? 'info' : 'success'}>
                        {item.discount_type === 'percentage' ? `${item.discount_value}%` : `₹${item.discount_value}`}
                      </Badge>
                    </TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', APPLICABLE_COLORS[item.applicable_to] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.applicable_to)}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-700">{item.used_count}{item.usage_limit ? `/${item.usage_limit}` : ''}</span></TD>
                    <TD><span className="text-sm text-slate-600">{formatDate(item.valid_until)}</span></TD>
                    <TD>
                      {item.is_active ? (
                        <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
                      ) : (
                        <Badge variant="muted"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>
                      )}
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
                        <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-44">
                          <DropdownItem icon={Eye} onClick={() => openView(item.id)}>View</DropdownItem>
                          <DropdownItem icon={Edit2} onClick={() => openForm(item)}>Edit</DropdownItem>
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

      {/* ═══ ADD / EDIT DIALOG ═══ */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Coupon' : 'Add Coupon'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-5">
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-5">
            <Input label="Coupon Code" placeholder="Auto-generated if empty" {...register('coupon_code')} />
            <Input label="Title" placeholder="e.g. Summer Sale 20%" {...register('title', { required: true })} />
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Discount Type</label>
              <select className={cn(selectClass, 'w-full')} {...register('discount_type')}>
                {DISCOUNT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Input label="Discount Value" type="number" step="0.01" {...register('discount_value', { required: true })} />
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Applicable To</label>
              <select className={cn(selectClass, 'w-full')} {...register('applicable_to')}>
                {APPLICABLE_TO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Input label="Max Uses" type="number" placeholder="Unlimited if empty" {...register('max_uses')} />
          </div>

          {/* Row 4 */}
          <div className="grid grid-cols-2 gap-5">
            <Input label="Valid From" type="datetime-local" {...register('valid_from')} />
            <Input label="Valid Until" type="datetime-local" {...register('valid_until')} />
          </div>

          {/* Row 5 */}
          <div className="grid grid-cols-2 gap-5">
            <Input label="Min Order Value" type="number" step="0.01" placeholder="No minimum" {...register('min_order_value')} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select className={cn(selectClass, 'w-full')} {...register('is_active')}>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Optional description..."
              {...register('description')}
            />
          </div>

          {/* Hint */}
          <p className="text-xs text-slate-400">
            To link courses, bundles, batches, or webinars — use the dedicated tabs after creating the coupon.
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>
              {editing ? 'Update Coupon' : 'Create Coupon'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ VIEW DIALOG ═══ */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Coupon Details" size="lg">
        {viewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : viewItem ? (
          <div className="p-6 space-y-5">
            {/* Code + Status */}
            <div className="flex items-center justify-between">
              <code className="text-lg font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded">{viewItem.coupon_code}</code>
              {viewItem.is_active ? (
                <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
              ) : (
                <Badge variant="muted"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>
              )}
            </div>

            {/* Grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Title" value={viewItem.title} />
              <DetailRow label="Description" value={viewItem.description} />
              <DetailRow label="Discount Type" value={capitalize(viewItem.discount_type)} />
              <DetailRow label="Discount Value" value={viewItem.discount_type === 'percentage' ? `${viewItem.discount_value}%` : `₹${viewItem.discount_value}`} />
              <DetailRow label="Applicable To" value={capitalize(viewItem.applicable_to)} />
              <DetailRow label="Max Uses" value={viewItem.usage_limit?.toString() || 'Unlimited'} />
              <DetailRow label="Used Count" value={viewItem.used_count?.toString()} />
              <DetailRow label="Min Order Value" value={viewItem.min_purchase_amount ? `₹${viewItem.min_purchase_amount}` : '--'} />
              <DetailRow label="Valid From" value={formatDate(viewItem.valid_from)} />
              <DetailRow label="Valid Until" value={formatDate(viewItem.valid_until)} />
              <DetailRow label="Created" value={viewItem.created_at ? fromNow(viewItem.created_at) : '--'} />
              <DetailRow label="Updated" value={viewItem.updated_at ? fromNow(viewItem.updated_at) : '--'} />
            </dl>

            {/* Linked items */}
            {linkedCourses.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Linked Courses</h4>
                <div className="flex flex-wrap gap-1.5">
                  {linkedCourses.map((lc: any) => (
                    <Badge key={lc.id} variant="default">{lc.courses?.name || `#${lc.course_id}`}</Badge>
                  ))}
                </div>
              </div>
            )}
            {linkedBundles.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Linked Bundles</h4>
                <div className="flex flex-wrap gap-1.5">
                  {linkedBundles.map((lb: any) => (
                    <Badge key={lb.id} variant="default">{lb.bundles?.name || `#${lb.bundle_id}`}</Badge>
                  ))}
                </div>
              </div>
            )}
            {linkedBatches.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Linked Batches</h4>
                <div className="flex flex-wrap gap-1.5">
                  {linkedBatches.map((lb: any) => (
                    <Badge key={lb.id} variant="default">{lb.course_batches?.title || `#${lb.batch_id}`}</Badge>
                  ))}
                </div>
              </div>
            )}
            {linkedWebinars.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Linked Webinars</h4>
                <div className="flex flex-wrap gap-1.5">
                  {linkedWebinars.map((lw: any) => (
                    <Badge key={lw.id} variant="default">{lw.webinars?.title || `#${lw.webinar_id}`}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TABS 2-5: COUPON LINKS (generic for course/bundle/batch/webinar)
// ══════════════════════════════════════════════════════════════════
type LinkKind = 'course' | 'bundle' | 'batch' | 'webinar';

const LINK_CONFIG: Record<LinkKind, {
  label: string;
  icon: any;
  itemLabel: string;
  itemKey: string;
  fkName: string;
  fkTable: string;
  listApi: (qs: string) => Promise<any>;
  createApi: (data: any) => Promise<any>;
  softDeleteApi: (id: number) => Promise<any>;
  restoreApi: (id: number) => Promise<any>;
  deleteApi: (id: number) => Promise<any>;
  listItemsApi: (qs: string) => Promise<any>;
}> = {
  course: {
    label: 'Coupon Courses',
    icon: BookOpen,
    itemLabel: 'Course',
    itemKey: 'name',
    fkName: 'course_id',
    fkTable: 'courses',
    listApi: (qs) => api.listCouponCourses(qs),
    createApi: (data) => api.createCouponCourse(data),
    softDeleteApi: (id) => api.softDeleteCouponCourse(id),
    restoreApi: (id) => api.restoreCouponCourse(id),
    deleteApi: (id) => api.deleteCouponCourse(id),
    listItemsApi: (qs) => api.listCourses(qs),
  },
  bundle: {
    label: 'Coupon Bundles',
    icon: Package,
    itemLabel: 'Bundle',
    itemKey: 'name',
    fkName: 'bundle_id',
    fkTable: 'bundles',
    listApi: (qs) => api.listCouponBundles(qs),
    createApi: (data) => api.createCouponBundle(data),
    softDeleteApi: (id) => api.softDeleteCouponBundle(id),
    restoreApi: (id) => api.restoreCouponBundle(id),
    deleteApi: (id) => api.deleteCouponBundle(id),
    listItemsApi: (qs) => api.listBundles(qs),
  },
  batch: {
    label: 'Coupon Batches',
    icon: Calendar,
    itemLabel: 'Batch',
    itemKey: 'title',
    fkName: 'batch_id',
    fkTable: 'course_batches',
    listApi: (qs) => api.listCouponBatches(qs),
    createApi: (data) => api.createCouponBatch(data),
    softDeleteApi: (id) => api.softDeleteCouponBatch(id),
    restoreApi: (id) => api.restoreCouponBatch(id),
    deleteApi: (id) => api.deleteCouponBatch(id),
    listItemsApi: (qs) => api.listCourseBatches(qs),
  },
  webinar: {
    label: 'Coupon Webinars',
    icon: Video,
    itemLabel: 'Webinar',
    itemKey: 'title',
    fkName: 'webinar_id',
    fkTable: 'webinars',
    listApi: (qs) => api.listCouponWebinars(qs),
    createApi: (data) => api.createCouponWebinar(data),
    softDeleteApi: (id) => api.softDeleteCouponWebinar(id),
    restoreApi: (id) => api.restoreCouponWebinar(id),
    deleteApi: (id) => api.deleteCouponWebinar(id),
    listItemsApi: (qs) => api.listWebinars(qs),
  },
};

function CouponLinksTab({ kind }: { kind: LinkKind }) {
  const cfg = LINK_CONFIG[kind];
  const Icon = cfg.icon;

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [couponFilter, setCouponFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── Add dialog ──
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(new Set());
  const [itemSearch, setItemSearch] = useState('');

  // ── Dropdown options ──
  const [coupons, setCoupons] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── Fetch links ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&sort=created_at&order=desc`;
      if (showTrash) qs += '&show_deleted=true';
      if (couponFilter) qs += `&coupon_id=${couponFilter}`;
      const res = await cfg.listApi(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error(`Failed to load ${cfg.label.toLowerCase()}`); }
    setLoading(false);
  }, [page, pageSize, showTrash, couponFilter, cfg]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await cfg.listApi('?show_deleted=true&limit=1');
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, [cfg]);

  // ── Fetch coupon dropdown ──
  const fetchCoupons = useCallback(async () => {
    try {
      const res = await api.listCoupons('?limit=500&sort=coupon_code&order=asc');
      setCoupons(res.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); fetchCoupons(); }, [fetchData, fetchTrashCount, fetchCoupons]);

  // ── Open add dialog ──
  async function openAddDialog() {
    setSelectedCouponId('');
    setSelectedItemIds(new Set());
    setItemSearch('');
    setLoadingItems(true);
    setAddOpen(true);
    try {
      const res = await cfg.listItemsApi('?limit=500&sort=id&order=asc');
      setItems(res.data || []);
    } catch { toast.error(`Failed to load ${cfg.itemLabel.toLowerCase()}s`); }
    setLoadingItems(false);
  }

  // ── Save links ──
  async function handleAddLinks() {
    if (!selectedCouponId) { toast.error('Please select a coupon'); return; }
    if (selectedItemIds.size === 0) { toast.error(`Please select at least one ${cfg.itemLabel.toLowerCase()}`); return; }
    setSaving(true);
    try {
      const couponId = parseInt(selectedCouponId);
      // Get existing links for this coupon to avoid duplicates
      const existing = await cfg.listApi(`?coupon_id=${couponId}&limit=500`);
      const existingFkIds = new Set((existing.data || []).map((r: any) => r[cfg.fkName]));

      const toAdd = [...selectedItemIds].filter(id => !existingFkIds.has(id));
      if (toAdd.length === 0) {
        toast.error('All selected items are already linked');
        setSaving(false);
        return;
      }

      await Promise.all(toAdd.map(id => cfg.createApi({ coupon_id: couponId, [cfg.fkName]: id })));
      toast.success(`${toAdd.length} ${cfg.itemLabel.toLowerCase()}${toAdd.length > 1 ? 's' : ''} linked`);
      setAddOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Failed to create links'); }
    setSaving(false);
  }

  // ── Actions ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await cfg.softDeleteApi(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await cfg.restoreApi(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this link? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await cfg.deleteApi(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Filter items by search ──
  const filteredItems = items.filter(item => {
    if (!itemSearch) return true;
    const name = (item[cfg.itemKey] || item.name || item.title || '').toLowerCase();
    return name.includes(itemSearch.toLowerCase());
  });

  function toggleItem(id: number) {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder={`Search ${cfg.label.toLowerCase()}...`}
      >
        <div className="flex items-center gap-2">
          {/* Coupon filter */}
          <select className={selectClass} value={couponFilter} onChange={e => { setCouponFilter(e.target.value); setPage(1); }}>
            <option value="">All Coupons</option>
            {coupons.map(c => <option key={c.id} value={c.id}>{c.coupon_code} — {c.title}</option>)}
          </select>

          {/* Trash toggle */}
          <Button variant={showTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
            <Trash2 className="w-4 h-4" />
            Trash
            {trashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </Button>

          {/* Add button */}
          {!showTrash && (
            <Button size="sm" onClick={openAddDialog}>
              <Link2 className="w-4 h-4" />
              Add Link
            </Button>
          )}
        </div>
      </DataToolbar>

      {/* ── Table ── */}
      {loading ? (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={showTrash ? 'Trash is empty' : `No ${cfg.label.toLowerCase()} yet`}
          description={showTrash ? 'No deleted links found' : `Link ${cfg.itemLabel.toLowerCase()}s to coupons using the Add Link button`}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12">#</TH>
                <TH>COUPON CODE</TH>
                <TH>COUPON TITLE</TH>
                <TH>{cfg.itemLabel.toUpperCase()}</TH>
                <TH>STATUS</TH>
                <TH>CREATED</TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item, idx) => {
                const actionState = actionLoaders[item.id];
                const couponData = item.coupons;
                const itemData = item[cfg.fkTable];
                const itemName = itemData ? (itemData[cfg.itemKey] || itemData.name || itemData.title) : `#${item[cfg.fkName]}`;

                return (
                  <TR key={item.id}>
                    <TD className="text-slate-400 text-xs">{(page - 1) * pageSize + idx + 1}</TD>
                    <TD>
                      <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        {couponData?.coupon_code || '--'}
                      </code>
                    </TD>
                    <TD><span className="text-sm text-slate-700">{couponData?.title || '--'}</span></TD>
                    <TD><span className="text-sm font-medium text-slate-900">{itemName}</span></TD>
                    <TD>
                      {item.is_active ? (
                        <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />Active</Badge>
                      ) : (
                        <Badge variant="muted"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>
                      )}
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
                        <Button variant="ghost" size="sm" onClick={() => handleSoftDelete(item.id)}>
                          <Unlink className="w-4 h-4 text-red-500" />
                        </Button>
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

      {/* ═══ ADD LINK DIALOG ═══ */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title={`Link ${cfg.itemLabel}s to Coupon`} size="lg">
        <div className="p-6 space-y-5">
          {/* Coupon selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Coupon</label>
            <select className={cn(selectClass, 'w-full')} value={selectedCouponId} onChange={e => setSelectedCouponId(e.target.value)}>
              <option value="">-- Choose a coupon --</option>
              {coupons.filter((c: any) => c.applicable_to === kind || c.applicable_to === 'all').map(c => <option key={c.id} value={c.id}>{c.coupon_code} — {c.title}</option>)}
            </select>
          </div>

          {/* Item selector with search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Select {cfg.itemLabel}s
              {selectedItemIds.size > 0 && (
                <span className="ml-2 text-xs text-brand-600 font-normal">({selectedItemIds.size} selected)</span>
              )}
            </label>

            {/* Search bar */}
            <div className="relative mb-2">
              <input
                type="text"
                placeholder={`Search ${cfg.itemLabel.toLowerCase()}s...`}
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Checkbox list */}
            {loadingItems ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
            ) : filteredItems.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No {cfg.itemLabel.toLowerCase()}s found</p>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {filteredItems.map(item => {
                  const name = item[cfg.itemKey] || item.name || item.title || `#${item.id}`;
                  const checked = selectedItemIds.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                        checked ? 'bg-brand-50' : 'hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(item.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-700 truncate">{name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLinks} loading={saving}>
              <Link2 className="w-4 h-4" />
              Link {selectedItemIds.size > 0 ? `${selectedItemIds.size} ${cfg.itemLabel}${selectedItemIds.size > 1 ? 's' : ''}` : cfg.itemLabel + 's'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
