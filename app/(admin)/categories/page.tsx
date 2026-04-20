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
import { AiMasterDialog } from '@/components/ui/AiMasterDialog';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, LayoutGrid, Trash2, Edit2, Eye, Star, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Zap, Loader2, Check, X, Sparkles } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Category } from '@/lib/types';

type SortField = 'id' | 'code' | 'slug' | 'display_order' | 'is_active';

interface CoverageItem {
  category_id: number;
  total_languages: number;
  translated_count: number;
  missing_count: number;
  is_complete: boolean;
  translated_languages: { id: number; name: string; iso_code: string }[];
  missing_languages: { id: number; name: string; iso_code: string }[];
}

interface BulkResult { iso_code: string; language: string; status: 'success' | 'error'; error?: string; id?: number }

type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
];

const DEFAULT_BULK_PROMPT = `Create content in English language for selected category with human way writing style and convert exact English content with same meaning for other languages which are listed for translations.\n\nTranslate exactly with the same meaning. Keep technical or brand words in English that sound strange or unnatural when translated.`;

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [viewing, setViewing] = useState<Category | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  // Pagination, search, sort, filter
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Table summary stats
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  // Trash mode
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Coverage + Bulk Generate
  const [coverage, setCoverage] = useState<Record<number, CoverageItem>>({});
  const [aiOpen, setAiOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<Category | null>(null);
  const [bulkPrompt, setBulkPrompt] = useState(DEFAULT_BULK_PROMPT);
  const [bulkProvider, setBulkProvider] = useState<AIProvider>('gemini');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkDone, setBulkDone] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary + coverage once on mount
  useEffect(() => {
    api.getTableSummary('categories').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listCategories('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('categories');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getCategoryTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: CoverageItem) => { map[c.category_id] = c; });
      setCoverage(map);
    }
  }

  function openBulkGenerate(c: Category) {
    setBulkCategory(c);
    setBulkPrompt(DEFAULT_BULK_PROMPT);
    setBulkProvider('gemini');
    setBulkResults([]);
    setBulkDone(false);
    setBulkLoading(false);
    setBulkOpen(true);
  }

  async function handleBulkGenerate() {
    if (!bulkCategory) return;
    setBulkLoading(true);
    setBulkResults([]);
    setBulkDone(false);
    try {
      const res = await api.bulkGenerateTranslations({
        category_id: bulkCategory.id,
        prompt: bulkPrompt,
        provider: bulkProvider,
      });
      if (res.success && res.data) {
        setBulkResults(res.data.results || []);
        toast.success(`Generated translations using ${AI_PROVIDERS.find(p => p.value === bulkProvider)?.label}`);
        loadCoverage();
      } else {
        toast.error(res.error || 'Bulk generation failed');
      }
    } catch {
      toast.error('Bulk generation failed');
    }
    setBulkLoading(false);
    setBulkDone(true);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
  }

  function openCreate() {
    setEditing(null); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ code: '', slug: '', display_order: 0, is_new: false, new_until: '', og_site_name: '', og_type: '', twitter_site: '', twitter_card: '', robots_directive: '' });
    setDialogOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ code: c.code, slug: c.slug, display_order: c.display_order, is_new: c.is_new, new_until: c.new_until || '', og_site_name: c.og_site_name || '', og_type: c.og_type || '', twitter_site: c.twitter_site || '', twitter_card: c.twitter_card || '', robots_directive: c.robots_directive || '' });
    setDialogOpen(true);
  }

  function openView(c: Category) {
    setViewing(c);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) fd.append('image', imageFile, imageFile.name);

    const res = editing
      ? await api.updateCategory(editing.id, fd, true)
      : await api.createCategory(fd, true);
    if (res.success) {
      toast.success(editing ? 'Category updated' : 'Category created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: Category) {
    if (!confirm(`Move "${c.code}" to trash? You can restore it later.`)) return;
    const res = await api.deleteCategory(c.id);
    if (res.success) { toast.success('Category moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: Category) {
    const res = await api.restoreCategory(c.id);
    if (res.success) { toast.success(`"${c.code}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: Category) {
    if (!confirm(`PERMANENTLY delete "${c.code}"? This cannot be undone.`)) return;
    const res = await api.permanentDeleteCategory(c.id);
    if (res.success) { toast.success('Category permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: Category) {
    const fd = new FormData();
    fd.append('is_active', String(!c.is_active));
    const res = await api.updateCategory(c.id, fd, true);
    if (res.success) { toast.success(`${!c.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  // Bulk selection helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      const res = await api.deleteCategory(id);
      if (res.success) ok++;
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      const res = await api.restoreCategory(id);
      if (res.success) ok++;
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      const res = await api.permanentDeleteCategory(id);
      if (res.success) ok++;
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Categories"
        description="Manage course and content categories"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add category</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Categories', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Categories
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

      {/* Toolbar: search + status filter (only in normal view) */}
      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search categories...'}
      >
        {!showTrash && (
          <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
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
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : LayoutGrid}
          title={showTrash ? 'Trash is empty' : 'No categories yet'}
          description={showTrash ? 'No deleted categories' : (searchDebounce || filterStatus ? 'No categories match your filters' : 'Add your first category')}
          action={!showTrash && !searchDebounce && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add category</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>
                      <RotateCcw className="w-3.5 h-3.5" /> Restore Selected
                    </Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  <X className="w-3.5 h-3.5" /> Clear
                </Button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                {!showTrash && <TH className="w-14">Image</TH>}
                <TH>
                  <button onClick={() => handleSort('code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Code <SortIcon field="code" />
                  </button>
                </TH>
                {!showTrash && <TH>Slug</TH>}
                <TH>
                  <button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Order <SortIcon field="display_order" />
                  </button>
                </TH>
                {!showTrash && <TH>New</TH>}
                {!showTrash && <TH>Translations</TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH>
                  <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Status <SortIcon field="is_active" />
                  </button>
                </TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                        {c.image ? (
                          <img src={c.image} alt={c.code} className="w-full h-full object-cover" />
                        ) : (
                          <LayoutGrid className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    <span className={cn('font-mono text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{c.code}</span>
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-slate-500">/{c.slug}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    <span className="text-slate-600">{c.display_order}</span>
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      {c.is_new ? (
                        <Badge variant="success"><Star className="w-3 h-3 mr-1" />New</Badge>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TD>
                  )}
                  {!showTrash && (
                    <TD className="py-2.5">
                      {(() => {
                        const cov = coverage[c.id];
                        if (!cov) return <span className="text-slate-300 text-xs">—</span>;
                        const complete = cov.is_complete;
                        return (
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                              complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            )}>
                              {complete ? <Check className="w-3 h-3" /> : null}
                              {cov.translated_count}/{cov.total_languages}
                            </span>
                            {!complete && (
                              <button
                                onClick={() => openBulkGenerate(c)}
                                className="p-1 rounded-md text-violet-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                                title="Generate missing translations"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={c.is_active ? 'success' : 'danger'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(c)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onPermanentDelete(c)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onSoftDelete(c)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Move to Trash">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {/* Pagination inside table card */}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            total={total}
            showingCount={items.length}
          />
        </div>
      )}

      {/* ── View Category Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Category Details" size="md">
        {viewing && (
          <div className="p-6">
            {/* Header: image + code */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                {viewing.image ? (
                  <img src={viewing.image} alt={viewing.code} className="w-full h-full object-cover" />
                ) : (
                  <LayoutGrid className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 font-mono">{viewing.code}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {viewing.is_new && <Badge variant="success"><Star className="w-3 h-3 mr-1" />New</Badge>}
                </div>
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Slug" value={`/${viewing.slug}`} />
              <DetailRow label="Display Order" value={String(viewing.display_order)} />
              <DetailRow label="New Until" value={viewing.new_until ? new Date(viewing.new_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
              <DetailRow label="OG Site Name" value={viewing.og_site_name} />
              <DetailRow label="OG Type" value={viewing.og_type} />
              <DetailRow label="Twitter Site" value={viewing.twitter_site} />
              <DetailRow label="Twitter Card" value={viewing.twitter_card} />
              <DetailRow label="Robots Directive" value={viewing.robots_directive} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              <DetailRow label="Updated" value={fromNow(viewing.updated_at)} />
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Bulk Generate Translations Dialog ── */}
      <Dialog open={bulkOpen} onClose={() => !bulkLoading && setBulkOpen(false)} title="AI Generate Translations" size="lg">
        {bulkCategory && (
          <div className="p-6 space-y-5">
            {/* Category info */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center border border-slate-200 flex-shrink-0">
                {bulkCategory.image ? (
                  <img src={bulkCategory.image} alt={bulkCategory.code} className="w-full h-full object-cover" />
                ) : (
                  <LayoutGrid className="w-5 h-5 text-slate-300" />
                )}
              </div>
              <div>
                <div className="font-semibold text-slate-900 font-mono text-sm">{bulkCategory.code}</div>
                <div className="text-xs text-slate-500">/{bulkCategory.slug}</div>
              </div>
            </div>

            {/* Missing languages */}
            {coverage[bulkCategory.id] && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Missing Translations ({coverage[bulkCategory.id].missing_count} of {coverage[bulkCategory.id].total_languages} languages)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {coverage[bulkCategory.id].missing_languages.map(lang => (
                    <span key={lang.id} className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
                      {lang.name} ({lang.iso_code})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Provider selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {AI_PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    disabled={bulkLoading}
                    onClick={() => setBulkProvider(p.value)}
                    className={cn(
                      'px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left',
                      bulkProvider === p.value
                        ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{p.model}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Prompt</label>
              <textarea
                value={bulkPrompt}
                onChange={e => setBulkPrompt(e.target.value)}
                disabled={bulkLoading}
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 disabled:opacity-50 resize-none"
              />
            </div>

            {/* Results */}
            {bulkResults.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Results</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {bulkResults.map((r, i) => (
                    <div key={i} className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                      r.status === 'success' ? 'bg-emerald-50' : 'bg-red-50'
                    )}>
                      <span className="font-medium text-slate-700">{r.language} ({r.iso_code})</span>
                      <span className={cn('flex items-center gap-1 text-xs font-medium', r.status === 'success' ? 'text-emerald-600' : 'text-red-600')}>
                        {r.status === 'success' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        {r.status === 'success' ? 'Saved' : r.error || 'Error'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkLoading}>
                {bulkDone ? 'Close' : 'Cancel'}
              </Button>
              {!bulkDone && (
                <Button onClick={handleBulkGenerate} disabled={bulkLoading || !bulkPrompt.trim()}>
                  {bulkLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Generate All</>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Category' : 'Add Category'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This category is currently active' : 'This category is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getCategory(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                    editing.is_active ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          )}

          <ImageUpload key={dialogKey} label="Category Image" hint="Resized to 400x400px WebP"
            value={editing?.image} aspectRatio={1} maxWidth={400} maxHeight={400} shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code" placeholder="programming" {...register('code', { required: true })} />
            <Input label="Slug" placeholder="programming" {...register('slug', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Display Order" type="number" {...register('display_order')} />
            <Input label="New Until (date)" type="date" {...register('new_until')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_new')} />
            <span className="text-sm font-medium text-slate-700">Mark as New</span>
          </label>

          {/* Language-neutral SEO defaults */}
          <div className="border-t border-slate-100 pt-4 mt-2">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">SEO Defaults</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="OG Site Name" placeholder="GrowUpMore" {...register('og_site_name')} />
              <Input label="OG Type" placeholder="website" {...register('og_type')} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input label="Twitter Site" placeholder="@growupmore" {...register('twitter_site')} />
              <Input label="Twitter Card" placeholder="summary_large_image" {...register('twitter_card')} />
            </div>
            <Input label="Robots Directive" placeholder="index, follow" className="mt-3" {...register('robots_directive')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
      <AiMasterDialog module="categories" moduleLabel="Categories" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createCategory(item)} updateFn={(id, item) => api.updateCategory(id, item)} onSaved={() => { load(); refreshSummary(); }} />
    </div>
  );
}

/* ── Small helper for the view dialog ── */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
