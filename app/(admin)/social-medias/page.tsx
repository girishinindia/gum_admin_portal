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
import { Plus, Share2, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
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
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    api.getTableSummary('social_medias').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterType, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterType, filterStatus, sortField, sortOrder, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField); qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterType) qs.set('platform_type', filterType);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
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

  async function onSoftDelete(s: SocialMedia) {
    if (!confirm(`Move "${s.name}" to trash? You can restore it later.`)) return;
    const res = await api.deleteSocialMedia(s.id);
    if (res.success) { toast.success('Social media moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(s: SocialMedia) {
    const res = await api.restoreSocialMedia(s.id);
    if (res.success) { toast.success(`"${s.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(s: SocialMedia) {
    if (!confirm(`PERMANENTLY delete "${s.name}"? This cannot be undone.`)) return;
    const res = await api.permanentDeleteSocialMedia(s.id);
    if (res.success) { toast.success('Social media permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(s: SocialMedia) {
    const fd = new FormData();
    fd.append('is_active', String(!s.is_active));
    const res = await api.updateSocialMedia(s.id, fd, true);
    if (res.success) { toast.success(`${!s.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(s => s.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Move ${selectedIds.size} item(s) to trash? You can restore them later.`)) return;
    setBulkActionLoading(true);
    let successCount = 0;
    for (const id of selectedIds) {
      const res = await api.deleteSocialMedia(id);
      if (res.success) successCount++;
    }
    setBulkActionLoading(false);
    toast.success(`${successCount} item(s) moved to trash`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    let successCount = 0;
    for (const id of selectedIds) {
      const res = await api.restoreSocialMedia(id);
      if (res.success) successCount++;
    }
    setBulkActionLoading(false);
    toast.success(`${successCount} item(s) restored`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  async function handleBulkPermanentDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    let successCount = 0;
    for (const id of selectedIds) {
      const res = await api.permanentDeleteSocialMedia(id);
      if (res.success) successCount++;
    }
    setBulkActionLoading(false);
    toast.success(`${successCount} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Social Media Platforms"
        description="Manage social media and professional platforms"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add platform</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Social Media', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
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

      {/* Trash toggle tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setShowTrash(false)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          Social Media
        </button>
        <button
          onClick={() => setShowTrash(true)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn(
              'ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            )}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      {/* Toolbar: search + type/status filters (only in normal view) */}
      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search social medias...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {PLATFORM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </>
        )}
      </DataToolbar>

      {/* Trash banner */}
      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Share2}
          title={showTrash ? 'Trash is empty' : 'No social medias yet'}
          description={showTrash ? 'No deleted social medias' : (searchDebounce || filterType || filterStatus ? 'No platforms match your filters' : 'Add your first platform')}
          action={!showTrash && !searchDebounce && !filterType && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add platform</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-900">{selectedIds.size} item(s) selected</span>
              </div>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore</Button>
                    <Button size="sm" variant="outline" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading} className="text-red-600 hover:text-red-700">Delete Permanently</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleBulkSoftDelete} disabled={bulkActionLoading} className="text-red-600 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /> Move to Trash</Button>
                )}
                <button onClick={() => setSelectedIds(new Set())} className="p-1 text-blue-600 hover:text-blue-800" title="Clear selection"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="w-12">Icon</TH>
                <TH><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
                <TH><button onClick={() => handleSort('code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Code <SortIcon field="code" /></button></TH>
                <TH><button onClick={() => handleSort('platform_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Type <SortIcon field="platform_type" /></button></TH>
                {!showTrash && <TH>Base URL</TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(s => (
                <TR key={s.id} className={cn(selectedIds.has(s.id) ? 'bg-brand-50/40' : (showTrash ? 'bg-amber-50/30' : undefined))}>
                  <TD className="py-2.5 pl-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </TD>
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
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{s.name}</span>
                  </TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-600">{s.code}</span></TD>
                  <TD className="py-2.5"><Badge variant={(typeColors[s.platform_type] || 'muted') as any}>{PLATFORM_TYPES.find(t => t.value === s.platform_type)?.label || s.platform_type}</Badge></TD>
                  {!showTrash && (
                    <TD className="py-2.5"><span className="text-slate-600 text-sm line-clamp-1">{s.base_url || '—'}</span></TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{s.deleted_at ? fromNow(s.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={s.is_active ? 'success' : 'danger'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(s)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onPermanentDelete(s)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Permanent Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(s)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(s)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(s)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Move to Trash"><Trash2 className="w-3.5 h-3.5" /></button>
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
