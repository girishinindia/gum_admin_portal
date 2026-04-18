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
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Share2, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SocialMedia } from '@/lib/types';

const PLATFORM_TYPES = [
  { value: 'social',       label: 'Social' },
  { value: 'professional', label: 'Professional' },
  { value: 'code',         label: 'Code' },
  { value: 'video',        label: 'Video' },
  { value: 'blog',         label: 'Blog' },
  { value: 'portfolio',    label: 'Portfolio' },
  { value: 'messaging',    label: 'Messaging' },
  { value: 'website',      label: 'Website' },
  { value: 'other',        label: 'Other' },
];

const typeColors: Record<string, string> = {
  social: 'info', professional: 'success', code: 'muted', video: 'danger',
  blog: 'warning', portfolio: 'success', messaging: 'info', website: 'muted', other: 'muted',
};

type SortField = 'id' | 'name' | 'code' | 'platform_type' | 'is_active';

export default function SocialMediasPage() {
  const [items, setItems] = useState<SocialMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SocialMedia | null>(null);
  const [viewing, setViewing] = useState<SocialMedia | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; total: number; updated_at: string } | null>(null);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    api.getTableSummary('social_medias').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);
  useEffect(() => { setPage(1); }, [searchDebounce, filterType, filterStatus, pageSize]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterType, filterStatus, sortField, sortOrder]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterType) qs.set('platform_type', filterType);
    if (filterStatus) qs.set('is_active', filterStatus);
    qs.set('sort', sortField); qs.set('order', sortOrder);
    const res = await api.listSocialMedias('?' + qs.toString());
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('social_medias');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
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
    setEditing(null); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ name: '', code: '', base_url: '', placeholder: '', platform_type: 'social' });
    setDialogOpen(true);
  }

  function openEdit(s: SocialMedia) {
    setEditing(s); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ name: s.name, code: s.code, base_url: s.base_url || '', placeholder: s.placeholder || '', platform_type: s.platform_type });
    setDialogOpen(true);
  }

  function openView(s: SocialMedia) { setViewing(s); }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) fd.append('icon', imageFile, imageFile.name);

    const res = editing
      ? await api.updateSocialMedia(editing.id, fd, true)
      : await api.createSocialMedia(fd, true);
    if (res.success) { toast.success(editing ? 'Social media updated' : 'Social media created'); setDialogOpen(false); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onDelete(s: SocialMedia) {
    if (!confirm(`Delete "${s.name}"?`)) return;
    const res = await api.deleteSocialMedia(s.id);
    if (res.success) { toast.success('Deleted'); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(s: SocialMedia) {
    const fd = new FormData();
    fd.append('is_active', String(!s.is_active));
    const res = await api.updateSocialMedia(s.id, fd, true);
    if (res.success) { toast.success(`${!s.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Social Media Platforms" description="Manage social media and professional platforms"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add platform</Button>} />

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Social Media', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', card.color)}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-medium">{card.label}</div>
                  <div className="text-xl font-bold text-slate-900 leading-tight">{card.value.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search social medias...">
        <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {PLATFORM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </DataToolbar>

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Share2} title="No social medias yet"
          description={searchDebounce || filterType || filterStatus ? 'No platforms match your filters' : 'Add your first platform'}
          action={!searchDebounce && !filterType && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add platform</Button> : undefined} />
      ) : (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="w-12">Icon</TH>
                <TH><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
                <TH><button onClick={() => handleSort('code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Code <SortIcon field="code" /></button></TH>
                <TH><button onClick={() => handleSort('platform_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Type <SortIcon field="platform_type" /></button></TH>
                <TH>Base URL</TH>
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(s => (
                <TR key={s.id}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{s.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                      {s.icon ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.icon} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <Share2 className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </TD>
                  <TD className="py-2.5"><span className="font-medium text-slate-900">{s.name}</span></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-600">{s.code}</span></TD>
                  <TD className="py-2.5"><Badge variant={(typeColors[s.platform_type] || 'muted') as any}>{PLATFORM_TYPES.find(t => t.value === s.platform_type)?.label || s.platform_type}</Badge></TD>
                  <TD className="py-2.5"><span className="text-slate-600 text-sm line-clamp-1">{s.base_url || '—'}</span></TD>
                  <TD className="py-2.5"><Badge variant={s.is_active ? 'success' : 'danger'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(s)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onDelete(s)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Social Media Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                {viewing.icon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={viewing.icon} alt={viewing.name} className="w-full h-full object-cover" />
                ) : (
                  <Share2 className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="muted" className="font-mono">{viewing.code}</Badge>
                  <Badge variant={(typeColors[viewing.platform_type] || 'muted') as any}>{PLATFORM_TYPES.find(t => t.value === viewing.platform_type)?.label || viewing.platform_type}</Badge>
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Code" value={viewing.code} />
              <DetailRow label="Platform Type" value={PLATFORM_TYPES.find(t => t.value === viewing.platform_type)?.label || viewing.platform_type} />
              <DetailRow label="Base URL" value={viewing.base_url} />
              <DetailRow label="Placeholder" value={viewing.placeholder} />
              <DetailRow label="Display Order" value={String(viewing.display_order)} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Social Media' : 'Add Social Media'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">{editing.is_active ? 'This platform is currently active' : 'This platform is currently inactive'}</p>
              </div>
              <button type="button" onClick={async () => { await onToggleActive(editing); const r = await api.getSocialMedia(editing.id); if (r.success && r.data) setEditing(r.data); }}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer', editing.is_active ? 'bg-emerald-500' : 'bg-slate-300')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}

          <ImageUpload key={dialogKey} label="Platform Icon" hint="Square icon, resized to 200x200px WebP"
            value={editing?.icon} aspectRatio={1} maxWidth={400} maxHeight={400} shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="LinkedIn" {...register('name', { required: true })} />
            <Input label="Code" placeholder="linkedin" {...register('code', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Platform Type</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('platform_type', { required: true })}>
              {PLATFORM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Input label="Base URL" placeholder="https://linkedin.com/" {...register('base_url')} />
          <Input label="Placeholder" placeholder="https://linkedin.com/in/your-profile" {...register('placeholder')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
