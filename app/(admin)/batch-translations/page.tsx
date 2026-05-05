"use client";
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Globe, Trash2, Edit2, CheckCircle2, XCircle, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Eye, Loader2, X, Sparkles } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Language } from '@/lib/types';

/* ── Local types ── */
interface CourseBatch {
  id: number;
  title?: string;
  code?: string;
  slug?: string;
  course_id?: number;
  is_active: boolean;
  [key: string]: any;
}

interface BatchTranslation {
  id: number;
  batch_id: number;
  language_id: number;
  title: string;
  short_description?: string | null;
  description?: string | null;
  tags?: any;
  thumbnail_url?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  focus_keyword?: string | null;
  structured_data?: any;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  course_batches?: { title?: string; code?: string; slug?: string; course_id?: number } | null;
  languages?: { name: string; iso_code?: string; native_name?: string } | null;
}

const TABS = ['Basic', 'Content', 'Thumbnail', 'SEO', 'Open Graph', 'Twitter', 'Schema'] as const;

type SortField = 'id' | 'title' | 'is_active';

function ViewField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs font-medium text-slate-500 mb-0.5">{label}</span>
      {value ? (
        <p className={cn('text-sm text-slate-900 whitespace-pre-wrap', mono && 'font-mono text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 max-h-48 overflow-auto')}>{value}</p>
      ) : (
        <p className="text-sm text-slate-300 italic">Not set</p>
      )}
    </div>
  );
}

function jsonPretty(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val, null, 2); } catch { return String(val); }
}

export default function BatchTranslationsPage() {
  const [items, setItems] = useState<BatchTranslation[]>([]);
  const [batches, setBatches] = useState<CourseBatch[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BatchTranslation | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterBatch, setFilterBatch] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Basic');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Image files
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset, setValue, getValues, watch } = useForm();
  const [formLoading, setFormLoading] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<BatchTranslation | null>(null);
  const [viewTab, setViewTab] = useState<typeof TABS[number]>('Basic');

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  // ─── Auto-fetch translation when batch or language changes ───
  const watchedBatchId = watch('batch_id');
  const watchedLangId = watch('language_id');
  const skipAutoFetchRef = useRef(false);

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
  ]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false;
      return;
    }
    if (!watchedBatchId || !watchedLangId) return;

    let cancelled = false;
    const fetchTranslation = async () => {
      setFormLoading(true);
      const qs = `?batch_id=${watchedBatchId}&language_id=${watchedLangId}&limit=1`;
      const res = await api.listBatchTranslations(qs);
      if (cancelled) return;

      if (res.success && res.data && res.data.length > 0) {
        const item = res.data[0] as BatchTranslation;
        setEditing(item);
        setFormMode('existing');
        populateForm(item);
        toast.info(`Loaded existing ${languages.find(l => String(l.id) === String(watchedLangId))?.name || ''} translation`);
      } else {
        setEditing(null);
        setFormMode('new');
        clearFormFields();
      }
      setFormLoading(false);
    };

    const timer = setTimeout(fetchTranslation, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [watchedBatchId, watchedLangId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.listCourseBatches('?limit=500&sort=title&order=asc').then(res => { if (res.success) setBatches((res.data || []).filter((b: CourseBatch) => !b.deleted_at)); });
    api.listLanguages('?for_material=true&limit=100').then(res => { if (res.success) setLanguages((res.data || []).filter((l: Language) => l.is_active)); });
    refreshSummary();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterBatch, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterBatch, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSummary() {
    const res = await api.getTableSummary('batch_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterBatch) qs.set('batch_id', filterBatch);
      if (filterLanguage) qs.set('language_id', filterLanguage);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listBatchTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  function resetImageState() {
    setThumbnailFile(null); setThumbnailPreview(null);
  }

  const defaultFormValues = {
    batch_id: '', language_id: '',
    title: '', short_description: '', description: '',
    tags: '[]',
    is_active: true,
    // SEO
    meta_title: '', meta_description: '', meta_keywords: '',
    focus_keyword: '',
    structured_data: '{}',
    // OG
    og_title: '', og_description: '',
    // Twitter
    twitter_title: '', twitter_description: '',
    // Thumbnail URL
    thumbnail_url: '',
  };

  function clearFormFields() {
    const bid = getValues('batch_id');
    const lid = getValues('language_id');
    Object.entries(defaultFormValues).forEach(([k, v]) => setValue(k, v));
    setValue('batch_id', bid);
    setValue('language_id', lid);
    resetImageState();
  }

  function populateForm(item: BatchTranslation) {
    setValue('title', item.title || '');
    setValue('short_description', item.short_description || '');
    setValue('description', item.description || '');
    setValue('tags', jsonPretty(item.tags) || '[]');
    setValue('is_active', item.is_active ?? true);
    // SEO
    setValue('meta_title', item.meta_title || '');
    setValue('meta_description', item.meta_description || '');
    setValue('meta_keywords', item.meta_keywords || '');
    setValue('focus_keyword', item.focus_keyword || '');
    setValue('structured_data', jsonPretty(item.structured_data) || '{}');
    // OG
    setValue('og_title', item.og_title || '');
    setValue('og_description', item.og_description || '');
    // Twitter
    setValue('twitter_title', item.twitter_title || '');
    setValue('twitter_description', item.twitter_description || '');
    // Thumbnail
    setValue('thumbnail_url', item.thumbnail_url || '');
    resetImageState();
  }

  function openCreate() {
    skipAutoFetchRef.current = true;
    setEditing(null); setFormMode('new'); resetImageState(); setDialogKey(k => k + 1); setActiveTab('Basic');
    reset({ ...defaultFormValues, batch_id: batches[0]?.id || '', language_id: languages[0]?.id || '' });
    setDialogOpen(true);
  }

  function openEdit(item: BatchTranslation) {
    skipAutoFetchRef.current = true;
    setEditing(item); setFormMode('existing'); resetImageState(); setDialogKey(k => k + 1); setActiveTab('Basic');
    reset({
      batch_id: item.batch_id, language_id: item.language_id,
      title: item.title || '', short_description: item.short_description || '', description: item.description || '',
      tags: jsonPretty(item.tags) || '[]',
      is_active: item.is_active ?? true,
      meta_title: item.meta_title || '', meta_description: item.meta_description || '', meta_keywords: item.meta_keywords || '',
      focus_keyword: item.focus_keyword || '',
      structured_data: jsonPretty(item.structured_data) || '{}',
      og_title: item.og_title || '', og_description: item.og_description || '',
      twitter_title: item.twitter_title || '', twitter_description: item.twitter_description || '',
      thumbnail_url: item.thumbnail_url || '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();

    // Scalar text fields
    const scalarFields = [
      'batch_id', 'language_id', 'title', 'short_description', 'description',
      'meta_title', 'meta_description', 'meta_keywords', 'focus_keyword',
      'og_title', 'og_description',
      'twitter_title', 'twitter_description',
    ];
    scalarFields.forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });

    // Boolean
    fd.append('is_active', String(data.is_active === true || data.is_active === 'true'));

    // JSONB fields
    const jsonbFields = ['tags', 'structured_data'];
    jsonbFields.forEach(k => {
      if (data[k]) fd.append(k, data[k]);
    });

    // Image file (thumbnail)
    if (thumbnailFile) fd.append('thumbnail', thumbnailFile, thumbnailFile.name);

    const res = editing
      ? await api.updateBatchTranslation(editing.id, fd, true)
      : await api.createBatchTranslation(fd, true);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: BatchTranslation) {
    if (!confirm(`Move "${item.title}" to trash?`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteBatchTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: BatchTranslation) {
    setActionLoadingId(item.id);
    const res = await api.restoreBatchTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${item.title}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: BatchTranslation) {
    if (!confirm(`PERMANENTLY delete "${item.title}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteBatchTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: BatchTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateBatchTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: BatchTranslation) {
    setViewItem(item);
    setViewTab('Basic');
    setViewOpen(true);
  }

  // Bulk selection helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} translation(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteBatchTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} translation(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreBatchTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} translation(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteBatchTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleFillAllMissing() {
    if (!confirm('Generate AI content for ALL batches with missing translations? This may take several minutes.')) return;
    setBulkActionLoading(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'course_batch', generate_all: true, provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s } = res.data;
        toast.success(`Generated ${s.success} item(s), ${s.skipped} complete, ${s.errors} error(s)`);
        load(); refreshSummary();
      } else toast.error(res.error || 'Bulk generation failed');
    } catch { toast.error('Bulk generation failed'); }
    setBulkActionLoading(false);
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Batch Translations"
        description="Manage multilingual translations for course batches"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={handleFillAllMissing} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Fill All Missing</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button>}
          </div>
        }
      />

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Translations
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search translations...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterBatch} onChange={e => setFilterBatch(e.target.value)}>
              <option value="">All Batches</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.title || b.code || `Batch #${b.id}`}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All Languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
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
          <span>Items in trash can be restored or permanently deleted.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Globe}
          title={showTrash ? 'Trash is empty' : 'No translations yet'}
          description={showTrash ? 'No deleted translations' : (searchDebounce || filterBatch || filterLanguage || filterStatus ? 'No translations match your filters' : 'Add your first batch translation')}
          action={!showTrash && !searchDebounce ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore</Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="w-3.5 h-3.5" /> Clear</Button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH><button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Title <SortIcon field="title" /></button></TH>
                <TH>Batch</TH>
                <TH>Language</TH>
                <TH>Thumb</TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(item => (
                <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                  <TD className="py-2.5">
                    <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.title || '--'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-600">{item.course_batches?.title || item.course_batches?.code || `#${item.batch_id}`}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-xs font-medium text-slate-600">
                      {item.languages?.name || '--'}
                      {item.languages?.iso_code && <span className="text-slate-400 ml-1">({item.languages.iso_code})</span>}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="w-10 h-7 rounded object-cover border border-slate-200" />
                    ) : (
                      <span className="text-slate-300 text-xs">--</span>
                    )}
                  </TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-slate-400">{item.deleted_at ? fromNow(item.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                          <button onClick={() => onPermanentDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(item)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onToggleActive(item)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title={item.is_active ? 'Deactivate' : 'Activate'}>{item.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}</button>
                          <button onClick={() => onSoftDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
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
      {viewOpen && viewItem && (
        <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title={viewItem.title || 'Translation'} size="lg">
          <div className="p-6 space-y-4">
          <div className="flex gap-1 border-b border-slate-200 mb-4">
            {TABS.map(tab => (
              <button key={tab} type="button" onClick={() => setViewTab(tab)} className={cn('px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px', viewTab === tab ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
                {tab}
              </button>
            ))}
          </div>
          {viewTab === 'Basic' && (
            <div className="space-y-3">
              <ViewField label="Title" value={viewItem.title} />
              <ViewField label="Batch" value={viewItem.course_batches?.title || viewItem.course_batches?.code || `#${viewItem.batch_id}`} />
              <ViewField label="Language" value={viewItem.languages?.name} />
              <ViewField label="Active" value={viewItem.is_active ? 'Yes' : 'No'} />
            </div>
          )}
          {viewTab === 'Content' && (
            <div className="space-y-3">
              <ViewField label="Short Description" value={viewItem.short_description} />
              <ViewField label="Description" value={viewItem.description} />
              <ViewField label="Tags" value={jsonPretty(viewItem.tags)} mono />
            </div>
          )}
          {viewTab === 'Thumbnail' && (
            <div className="space-y-3">
              {viewItem.thumbnail_url ? (
                <img src={viewItem.thumbnail_url} alt="Thumbnail" className="max-w-full rounded-lg border border-slate-200" />
              ) : (
                <p className="text-sm text-slate-400 italic">No thumbnail uploaded</p>
              )}
            </div>
          )}
          {viewTab === 'SEO' && (
            <div className="space-y-3">
              <ViewField label="Meta Title" value={viewItem.meta_title} />
              <ViewField label="Meta Description" value={viewItem.meta_description} />
              <ViewField label="Meta Keywords" value={viewItem.meta_keywords} />
              <ViewField label="Focus Keyword" value={viewItem.focus_keyword} />
            </div>
          )}
          {viewTab === 'Open Graph' && (
            <div className="space-y-3">
              <ViewField label="OG Title" value={viewItem.og_title} />
              <ViewField label="OG Description" value={viewItem.og_description} />
            </div>
          )}
          {viewTab === 'Twitter' && (
            <div className="space-y-3">
              <ViewField label="Twitter Title" value={viewItem.twitter_title} />
              <ViewField label="Twitter Description" value={viewItem.twitter_description} />
            </div>
          )}
          {viewTab === 'Schema' && (
            <div className="space-y-3">
              <ViewField label="Structured Data (JSON-LD)" value={jsonPretty(viewItem.structured_data)} mono />
            </div>
          )}
          </div>
        </Dialog>
      )}

      {/* Create/Edit Dialog */}
      <Dialog key={dialogKey} open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Batch Translation' : 'Create Batch Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn('px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap', activeTab === tab ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
                {tab}
              </button>
            ))}
          </div>

          {formLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading translation...
            </div>
          )}

          {/* Basic Tab */}
          {activeTab === 'Basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch *</label>
                  <select className={cn(selectClass, 'w-full')} {...register('batch_id', { required: true })}>
                    <option value="">Select batch...</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.title || b.code || `Batch #${b.id}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Language *</label>
                  <select className={cn(selectClass, 'w-full')} {...register('language_id', { required: true })}>
                    <option value="">Select language...</option>
                    {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
                  </select>
                </div>
              </div>
              {formMode === 'existing' && editing && (
                <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  Editing existing translation (ID: {editing.id})
                </div>
              )}
              <Input label="Title" {...register('title')} placeholder="Translation title" />
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-slate-700">Active</span>
                </label>
              </div>
            </div>
          )}

          {/* Content Tab */}
          {activeTab === 'Content' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Short Description</label>
                <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" rows={3} placeholder="Brief description..." {...register('short_description')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" rows={6} placeholder="Full description..." {...register('description')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags (JSON array)</label>
                <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono" rows={3} placeholder='["tag1", "tag2"]' {...register('tags')} />
              </div>
            </div>
          )}

          {/* Thumbnail Tab */}
          {activeTab === 'Thumbnail' && (
            <div className="space-y-4">
              <ImageUpload
                key={`thumb-${dialogKey}`}
                label="Batch Thumbnail"
                hint="Recommended: 800x450px. Drag & drop or click to upload."
                value={editing?.thumbnail_url}
                aspectRatio={800 / 450}
                maxWidth={800}
                maxHeight={450}
                shape="rounded"
                onChange={(file, preview) => { setThumbnailFile(file); setThumbnailPreview(preview); }}
              />
            </div>
          )}

          {/* SEO Tab */}
          {activeTab === 'SEO' && (
            <div className="space-y-4">
              <Input label="Meta Title" placeholder="SEO title" {...register('meta_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Meta Description</label>
                <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" rows={3} placeholder="SEO description..." {...register('meta_description')} />
              </div>
              <Input label="Meta Keywords" placeholder="keyword1, keyword2" {...register('meta_keywords')} />
              <Input label="Focus Keyword" placeholder="Primary keyword" {...register('focus_keyword')} />
            </div>
          )}

          {/* Open Graph Tab */}
          {activeTab === 'Open Graph' && (
            <div className="space-y-4">
              <Input label="OG Title" placeholder="Open Graph title" {...register('og_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">OG Description</label>
                <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" rows={3} placeholder="OG description..." {...register('og_description')} />
              </div>
            </div>
          )}

          {/* Twitter Tab */}
          {activeTab === 'Twitter' && (
            <div className="space-y-4">
              <Input label="Twitter Title" placeholder="Twitter card title" {...register('twitter_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Twitter Description</label>
                <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" rows={3} placeholder="Twitter description..." {...register('twitter_description')} />
              </div>
            </div>
          )}

          {/* Schema Tab */}
          {activeTab === 'Schema' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Structured Data (JSON-LD)</label>
                <textarea className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono" rows={10} placeholder='{}' {...register('structured_data')} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
