"use client";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Briefcase, Trash2, Edit2, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

interface JobPosition {
  id: number;
  title: string;
  slug: string;
  department: string | null;
  location: string | null;
  employment_type: string;
  experience: string | null;
  description: string | null;
  requirements: string | null;
  skills: string | null;
  salary_range: string | null;
  expires_at: string | null;
  is_active: boolean;
  display_order: number;
  deleted_at: string | null;
  created_at: string;
}

const TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
];

type SortField = 'id' | 'title' | 'employment_type' | 'expires_at' | 'display_order' | 'is_active';

function isExpired(p: JobPosition) {
  return !!p.expires_at && new Date(p.expires_at).getTime() < Date.now();
}

export default function JobPositionsPage() {
  const [items, setItems] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosition | null>(null);
  const [saving, setSaving] = useState(false);

  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterExpiry, setFilterExpiry] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTrash, setShowTrash] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, filterType, filterStatus, filterExpiry, pageSize, showTrash]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterType, filterStatus, filterExpiry, sortField, sortOrder, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField); qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterType) qs.set('employment_type', filterType);
      if (filterStatus) qs.set('is_active', filterStatus);
      if (filterExpiry) qs.set('expiry', filterExpiry);
    }
    const res = await api.listJobPositions('?' + qs.toString());
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    api.listJobPositions('?show_deleted=true&limit=1').then(r => { if (r.success) setTrashCount(r.pagination?.total || 0); }).catch(() => {});
    setLoading(false);
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null);
    reset({ title: '', slug: '', department: '', location: '', employment_type: 'full-time', experience: '', description: '', requirements: '', skills: '', salary_range: '', expires_at: '', display_order: 0 });
    setDialogOpen(true);
  }

  function openEdit(p: JobPosition) {
    setEditing(p);
    reset({
      title: p.title, slug: p.slug, department: p.department || '', location: p.location || '',
      employment_type: p.employment_type || 'full-time', experience: p.experience || '',
      description: p.description || '', requirements: p.requirements || '', skills: p.skills || '',
      salary_range: p.salary_range || '', expires_at: p.expires_at ? p.expires_at.slice(0, 10) : '',
      display_order: p.display_order ?? 0,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    if (data.display_order != null && data.display_order !== '' && Number(data.display_order) < 0) { toast.error('Display order cannot be negative'); return; }
    setSaving(true);
    try {
      const res = editing ? await api.updateJobPosition(editing.id, data) : await api.createJobPosition(data);
      if (res.success) { toast.success(editing ? 'Position updated' : 'Position created'); setDialogOpen(false); load(); }
      else toast.error(res.error || 'Failed');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    setSaving(false);
  }

  async function onToggleActive(p: JobPosition) {
    try {
      const res = await api.updateJobPosition(p.id, { is_active: !p.is_active });
      if (res.success) { toast.success(!p.is_active ? 'Activated' : 'Deactivated'); load(); } else toast.error(res.error || 'Failed');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
  }

  async function onSoftDelete(p: JobPosition) {
    if (!confirm(`Move "${p.title}" to trash?`)) return;
    setActionLoadingId(p.id);
    const res = await api.deleteJobPosition(p.id).catch((e: any) => ({ success: false, error: e.message }));
    setActionLoadingId(null);
    if (res.success) { toast.success('Moved to trash'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onRestore(p: JobPosition) {
    setActionLoadingId(p.id);
    const res = await api.restoreJobPosition(p.id).catch((e: any) => ({ success: false, error: e.message }));
    setActionLoadingId(null);
    if (res.success) { toast.success('Restored'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(p: JobPosition) {
    if (!confirm(`PERMANENTLY delete "${p.title}"? This cannot be undone.`)) return;
    setActionLoadingId(p.id);
    const res = await api.permanentDeleteJobPosition(p.id).catch((e: any) => ({ success: false, error: e.message }));
    setActionLoadingId(null);
    if (res.success) { toast.success('Permanently deleted'); load(); } else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Job Positions" description="Career openings shown on the public Careers page" actions={!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add position</Button>} />

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Positions</button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}><Trash2 className="w-3.5 h-3.5" /> Trash{trashCount > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{trashCount}</span>}</button>
      </div>

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by title, department, location...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className={selectClass} value={filterExpiry} onChange={e => setFilterExpiry(e.target.value)}>
              <option value="">All (current + expired)</option>
              <option value="active">Currently open</option>
              <option value="expired">Expired</option>
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : Briefcase} title={showTrash ? 'Trash is empty' : 'No positions yet'} description={showTrash ? 'No deleted positions' : 'Add your first job opening'} action={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add position</Button> : undefined} />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH><button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">Title <SortIcon field="title" /></button></TH>
                <TH>Department</TH>
                <TH><button onClick={() => handleSort('employment_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">Type <SortIcon field="employment_type" /></button></TH>
                <TH><button onClick={() => handleSort('expires_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">Expires <SortIcon field="expires_at" /></button></TH>
                {showTrash ? <TH>Deleted</TH> : <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">Status <SortIcon field="is_active" /></button></TH>}
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(p => (
                <TR key={p.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined)}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{p.id}</span></TD>
                  <TD className="py-2.5"><span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{p.title}</span></TD>
                  <TD className="py-2.5"><span className="text-slate-600 text-sm">{p.department || '—'}</span></TD>
                  <TD className="py-2.5"><Badge variant="muted">{TYPES.find(t => t.value === p.employment_type)?.label || p.employment_type}</Badge></TD>
                  <TD className="py-2.5">
                    {p.expires_at ? (
                      isExpired(p)
                        ? <Badge variant="danger">Expired</Badge>
                        : <span className="text-slate-600 text-sm">{new Date(p.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    ) : <span className="text-slate-300">No expiry</span>}
                  </TD>
                  {showTrash ? (
                    <TD className="py-2.5"><span className="text-xs text-amber-600">{p.deleted_at ? fromNow(p.deleted_at) : '—'}</span></TD>
                  ) : (
                    <TD className="py-2.5"><Badge variant={p.is_active ? 'success' : 'danger'}>{p.is_active ? 'Active' : 'Inactive'}</Badge></TD>
                  )}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(p)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" title="Restore">{actionLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                          <button onClick={() => onPermanentDelete(p)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete permanently">{actionLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(p)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50" title="Move to Trash">{actionLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Position' : 'Add Position'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">{editing.is_active ? 'Visible on the website (if not expired)' : 'Hidden from the website'}</p>
              </div>
              <button type="button" onClick={async () => { await onToggleActive(editing); const r = await api.getJobPosition(editing.id); if (r.success && r.data) setEditing(r.data); }}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer', editing.is_active ? 'bg-emerald-500' : 'bg-slate-300')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Title" placeholder="e.g. Full Stack Developer" error={errors.title ? 'Title is required' : undefined} {...register('title', { required: true })} />
            <Input label="Slug (optional)" placeholder="auto-generated from title" {...register('slug')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" placeholder="Engineering" {...register('department')} />
            <Input label="Location" placeholder="Surat, India / Remote" {...register('location')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('employment_type', { required: true })}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <Input label="Experience" placeholder="2-4 years" {...register('experience')} />
            <Input label="Salary range" placeholder="e.g. 6-9 LPA" {...register('salary_range')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Expires on (auto-hide after)" type="date" min={new Date().toISOString().slice(0, 10)} {...register('expires_at')} />
            <Input label="Display order" type="number" min={0} {...register('display_order')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Role summary shown on the listing and detail page" {...register('description', { required: true })} />
            {errors.description && <p className="text-xs text-red-600 mt-1">Description is required</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Requirements (optional)</label>
            <textarea rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Responsibilities / requirements" {...register('requirements')} />
          </div>
          <Input label="Skills (comma-separated)" placeholder="React, Node.js, TypeScript" {...register('skills')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Save changes' : 'Create')}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
