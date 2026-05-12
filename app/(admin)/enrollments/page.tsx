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
  Loader2, X, MoreVertical, GraduationCap, BookOpen, BarChart3,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type SortField = 'id' | 'created_at' | 'enrollment_status' | 'progress_pct' | 'last_accessed_at';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const ITEM_TYPE_OPTIONS = [
  { value: '', label: 'All Item Types' },
  { value: 'course', label: 'Course' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'batch', label: 'Batch' },
  { value: 'webinar', label: 'Webinar' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-blue-50 text-blue-700',
  expired: 'bg-slate-100 text-slate-600',
  suspended: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-700',
};

const ITEM_TYPE_COLORS: Record<string, string> = {
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

function capitalize(s: string) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '--';
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-slate-500">{pct}%</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════
export default function EnrollmentsPage() {
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

  // ── Create form state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const createForm = useForm();

  // ── Edit form state ──
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const editForm = useForm();

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // ── Progress dialog state ──
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressEnrollmentId, setProgressEnrollmentId] = useState<number | null>(null);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&sort=${sort}&ascending=${asc}`;
      if (showTrash) qs += '&show_deleted=true';
      if (search) qs += `&search=${encodeURIComponent(search)}`;
      if (statusFilter) qs += `&enrollment_status=${statusFilter}`;
      if (itemTypeFilter) qs += `&item_type=${itemTypeFilter}`;
      const res = await api.listEnrollments(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load enrollments'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, statusFilter, itemTypeFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.listEnrollments('?show_deleted=true&limit=1');
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

  // ── Open create form ──
  function openCreate() {
    createForm.reset({ user_id: '', item_type: 'course', item_id: '', notes: '' });
    setCreateOpen(true);
  }

  // ── Save create ──
  async function onCreateSave(formData: any) {
    setCreateSaving(true);
    try {
      const body = {
        user_id: Number(formData.user_id),
        item_type: formData.item_type,
        item_id: Number(formData.item_id),
        notes: formData.notes || null,
      };
      await api.createEnrollment(body);
      toast.success('Enrollment created');
      setCreateOpen(false);
      fetchData();
      fetchTrashCount();
    } catch (e: any) { toast.error(e.message || 'Failed to create enrollment'); }
    setCreateSaving(false);
  }

  // ── Open edit form ──
  function openEdit(item: any) {
    setEditItem(item);
    editForm.reset({
      enrollment_status: item.enrollment_status || 'active',
      notes: item.notes || '',
      expires_at: item.expires_at ? item.expires_at.slice(0, 16) : '',
      certificate_url: item.certificate_url || '',
    });
    setEditOpen(true);
  }

  // ── Save edit ──
  async function onEditSave(formData: any) {
    if (!editItem) return;
    setEditSaving(true);
    try {
      const body = {
        enrollment_status: formData.enrollment_status,
        notes: formData.notes || null,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        certificate_url: formData.certificate_url || null,
      };
      await api.updateEnrollment(editItem.id, body);
      toast.success('Enrollment updated');
      setEditOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Failed to update enrollment'); }
    setEditSaving(false);
  }

  // ── View enrollment ──
  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getEnrollment(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load enrollment'); }
    setViewLoading(false);
  }

  // ── View progress ──
  async function openProgress(id: number) {
    setProgressLoading(true);
    setProgressEnrollmentId(id);
    setProgressOpen(true);
    try {
      const res = await api.getEnrollmentProgress(id);
      setProgressData(res.data || res || []);
    } catch { toast.error('Failed to load progress'); }
    setProgressLoading(false);
  }

  // ── Actions ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteEnrollment(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreEnrollment(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this enrollment? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.deleteEnrollment(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <PageHeader title="Enrollments" actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          New Enrollment
        </Button>
      } />

      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search enrollments..."
      >
        <div className="flex items-center gap-2">
          <select
            className={selectClass}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            className={selectClass}
            value={itemTypeFilter}
            onChange={e => { setItemTypeFilter(e.target.value); setPage(1); }}
          >
            {ITEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button
            variant={showTrash ? 'danger' : 'outline'}
            size="sm"
            onClick={() => { setShowTrash(!showTrash); setPage(1); }}
          >
            <Trash2 className="w-4 h-4" />
            Trash
            {trashCount > 0 && (
              <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>
            )}
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
          icon={GraduationCap}
          title={showTrash ? 'Trash is empty' : 'No enrollments yet'}
          description={showTrash ? 'No deleted enrollments found' : 'Create your first enrollment to get started'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12 cursor-pointer" onClick={() => toggleSort('id')}>
                  <div className="flex items-center gap-1">ID <SortIcon field="id" /></div>
                </TH>
                <TH>USER</TH>
                <TH>ITEM TYPE</TH>
                <TH>ITEM ID</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('enrollment_status')}>
                  <div className="flex items-center gap-1">STATUS <SortIcon field="enrollment_status" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('progress_pct')}>
                  <div className="flex items-center gap-1">PROGRESS <SortIcon field="progress_pct" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}>
                  <div className="flex items-center gap-1">ENROLLED AT <SortIcon field="created_at" /></div>
                </TH>
                <TH>LAST ACCESSED</TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item) => {
                const actionState = actionLoaders[item.id];
                return (
                  <TR key={item.id}>
                    <TD className="text-slate-400 text-xs font-mono">{item.id}</TD>
                    <TD>
                      <div className="text-sm font-medium text-slate-900">
                        {item.users?.full_name || item.users?.email || `User #${item.user_id}`}
                      </div>
                      {item.users?.email && item.users?.full_name && (
                        <div className="text-xs text-slate-400">{item.users.email}</div>
                      )}
                    </TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        ITEM_TYPE_COLORS[item.item_type] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.item_type)}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-700 font-mono">{item.item_id}</span></TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        STATUS_COLORS[item.enrollment_status] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.enrollment_status)}
                      </span>
                    </TD>
                    <TD>
                      <ProgressBar pct={item.progress_pct ?? 0} />
                    </TD>
                    <TD><span className="text-sm text-slate-600">{item.created_at ? fromNow(item.created_at) : '--'}</span></TD>
                    <TD><span className="text-sm text-slate-600">{item.last_accessed_at ? fromNow(item.last_accessed_at) : '--'}</span></TD>
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
                        <Dropdown
                          trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />}
                          align="right"
                          width="w-48"
                        >
                          <DropdownItem icon={Eye} onClick={() => openView(item.id)}>View</DropdownItem>
                          <DropdownItem icon={Edit2} onClick={() => openEdit(item)}>Edit</DropdownItem>
                          <DropdownItem icon={BarChart3} onClick={() => openProgress(item.id)}>View Progress</DropdownItem>
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

      {/* ═══ CREATE DIALOG ═══ */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="New Enrollment" size="md">
        <form onSubmit={createForm.handleSubmit(onCreateSave)} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <Input
              label="User ID"
              type="number"
              placeholder="Enter user ID"
              {...createForm.register('user_id', { required: true })}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Item Type</label>
              <select className={cn(selectClass, 'w-full')} {...createForm.register('item_type', { required: true })}>
                <option value="course">Course</option>
                <option value="bundle">Bundle</option>
                <option value="batch">Batch</option>
                <option value="webinar">Webinar</option>
              </select>
            </div>
          </div>

          <Input
            label="Item ID"
            type="number"
            placeholder="Enter item ID"
            {...createForm.register('item_id', { required: true })}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Optional notes..."
              {...createForm.register('notes')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={createSaving}>
              Create Enrollment
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ EDIT DIALOG ═══ */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit Enrollment" size="md">
        <form onSubmit={editForm.handleSubmit(onEditSave)} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select className={cn(selectClass, 'w-full')} {...editForm.register('enrollment_status')}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <Input
              label="Expires At"
              type="datetime-local"
              {...editForm.register('expires_at')}
            />
          </div>

          <Input
            label="Certificate URL"
            placeholder="https://..."
            {...editForm.register('certificate_url')}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Optional notes..."
              {...editForm.register('notes')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={editSaving}>
              Update Enrollment
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ VIEW DIALOG ═══ */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Enrollment Details" size="lg">
        {viewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : viewItem ? (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-brand-500" />
                <span className="text-lg font-semibold text-slate-900">Enrollment #{viewItem.id}</span>
              </div>
              <span className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                STATUS_COLORS[viewItem.enrollment_status] || 'bg-slate-100 text-slate-600'
              )}>
                {capitalize(viewItem.enrollment_status)}
              </span>
            </div>

            {/* Progress */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Progress</span>
                <span className="text-sm font-semibold text-slate-900">{viewItem.progress_pct ?? 0}%</span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    (viewItem.progress_pct ?? 0) >= 100 ? 'bg-emerald-500' :
                    (viewItem.progress_pct ?? 0) >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                  )}
                  style={{ width: `${Math.min(viewItem.progress_pct ?? 0, 100)}%` }}
                />
              </div>
            </div>

            {/* Grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="User ID" value={viewItem.user_id?.toString()} />
              <DetailRow label="User" value={viewItem.users?.full_name || viewItem.users?.email || '--'} />
              <DetailRow label="Item Type" value={capitalize(viewItem.item_type)} />
              <DetailRow label="Item ID" value={viewItem.item_id?.toString()} />
              <DetailRow label="Enrollment Status" value={capitalize(viewItem.enrollment_status)} />
              <DetailRow label="Progress" value={`${viewItem.progress_pct ?? 0}%`} />
              <DetailRow label="Enrolled At" value={formatDate(viewItem.created_at)} />
              <DetailRow label="Last Accessed" value={viewItem.last_accessed_at ? fromNow(viewItem.last_accessed_at) : '--'} />
              <DetailRow label="Expires At" value={formatDate(viewItem.expires_at)} />
              <DetailRow label="Completed At" value={formatDate(viewItem.completed_at)} />
              <DetailRow label="Certificate URL" value={viewItem.certificate_url} />
              <DetailRow label="Notes" value={viewItem.notes} />
              <DetailRow label="Created" value={viewItem.created_at ? fromNow(viewItem.created_at) : '--'} />
              <DetailRow label="Updated" value={viewItem.updated_at ? fromNow(viewItem.updated_at) : '--'} />
            </dl>

            {viewItem.deleted_at && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4" />
                Deleted {fromNow(viewItem.deleted_at)}
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ PROGRESS DIALOG ═══ */}
      <Dialog
        open={progressOpen}
        onClose={() => setProgressOpen(false)}
        title={`Enrollment Progress #${progressEnrollmentId}`}
        size="xl"
      >
        {progressLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : progressData.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={BarChart3}
              title="No progress records"
              description="No progress data found for this enrollment"
            />
          </div>
        ) : (
          <div className="p-6 overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>CONTENT TYPE</TH>
                  <TH>CONTENT ID</TH>
                  <TH>STATUS</TH>
                  <TH>SCORE</TH>
                  <TH>TIME SPENT</TH>
                  <TH>STARTED</TH>
                  <TH>COMPLETED</TH>
                </TR>
              </THead>
              <TBody>
                {progressData.map((prog: any, idx: number) => (
                  <TR key={prog.id || idx}>
                    <TD>
                      <span className="text-sm font-medium text-slate-700">{capitalize(prog.content_type)}</span>
                    </TD>
                    <TD><span className="text-sm text-slate-700 font-mono">{prog.content_id}</span></TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        prog.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                        prog.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(prog.status)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-700">
                        {prog.score != null ? `${prog.score}%` : '--'}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-600">
                        {prog.time_spent_seconds != null
                          ? `${Math.floor(prog.time_spent_seconds / 60)}m ${prog.time_spent_seconds % 60}s`
                          : '--'}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-600">{formatDate(prog.started_at)}</span></TD>
                    <TD><span className="text-sm text-slate-600">{formatDate(prog.completed_at)}</span></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </Dialog>
    </div>
  );
}
