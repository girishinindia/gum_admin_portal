"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
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
import { ImageUpload } from '@/components/ui/ImageUpload';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle,
  Loader2, X, FolderTree, FileText, MessageSquare, Star,
  Send, Archive, RefreshCw,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ───────────────────────────────────────────────────────
type MainTab = 'categories' | 'posts' | 'reviews';

type CatSortField = 'id' | 'name' | 'is_active';
type PostSortField = 'id' | 'title' | 'status' | 'view_count' | 'rating_average' | 'published_at';
type ReviewSortField = 'id' | 'rating' | 'status' | 'helpful_count' | 'reported_count';

// ─── Constants ───────────────────────────────────────────────────
const POST_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const POST_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-amber-50 text-amber-700',
};

const AUTHOR_TYPE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'instructor', label: 'Instructor' },
];

const AUTHOR_TYPE_COLORS: Record<string, string> = {
  system: 'bg-blue-50 text-blue-700',
  instructor: 'bg-violet-50 text-violet-700',
};

const REVIEW_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'hidden', label: 'Hidden' },
];

const REVIEW_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
  flagged: 'bg-red-50 text-red-700',
  hidden: 'bg-slate-100 text-slate-600',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

// ─── Helpers ─────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '--';
}

function truncate(s: string | null | undefined, max = 60) {
  if (!s) return '--';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function renderStars(rating: number) {
  const filled = Math.round(rating);
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += i <= filled ? '★' : '☆';
  }
  return stars;
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function BlogPage() {
  const [mainTab, setMainTab] = useState<MainTab>('categories');

  return (
    <div className="animate-fade-in">
      <PageHeader title="Blog Management" />

      {/* ── Main Tabs ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'categories' as MainTab, label: 'Categories', icon: FolderTree },
          { id: 'posts' as MainTab, label: 'Posts', icon: FileText },
          { id: 'reviews' as MainTab, label: 'Reviews', icon: MessageSquare },
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
      {mainTab === 'categories' && <CategoriesTab />}
      {mainTab === 'posts' && <PostsTab />}
      {mainTab === 'reviews' && <ReviewsTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: BLOG CATEGORIES
// ══════════════════════════════════════════════════════════════════
function CategoriesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<CatSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterParent, setFilterParent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [allCategories, setAllCategories] = useState<any[]>([]);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
  ]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('blog_categories').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadAllCategories();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterParent, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterParent, filterStatus, showTrash]);

  async function loadAllCategories() {
    const res = await api.getBlogCategories({ limit: 500 });
    if (res.success) setAllCategories(res.data || []);
  }

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterParent) params.parent_id = filterParent;
    }
    const res = await api.getBlogCategories(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('blog_categories');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: CatSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: CatSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({ name: '', slug: '', description: '', parent_id: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      name: c.name || '', slug: c.slug || '', description: c.description || '',
      parent_id: c.parent_id ?? '', is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['parent_id'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateBlogCategory(editing.id, payload)
      : await api.createBlogCategory(payload);
    if (res.success) {
      toast.success(editing ? 'Category updated' : 'Category created');
      setDialogOpen(false); load(); refreshSummary(); loadAllCategories();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.name}" to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteBlogCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category moved to trash'); load(); refreshSummary(); loadAllCategories(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreBlogCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category restored'); load(); refreshSummary(); loadAllCategories(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.name}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteBlogCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category permanently deleted'); load(); refreshSummary(); loadAllCategories(); }
    else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteBlogCategory(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadAllCategories();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreBlogCategory(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadAllCategories();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteBlogCategory(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadAllCategories();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  function getParentName(parentId: number | null) {
    if (!parentId) return '--';
    const parent = allCategories.find(c => c.id === parentId);
    return parent ? parent.name : `#${parentId}`;
  }

  return (
    <>
      {/* Summary Stats */}
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

      {/* Trash toggle */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Categories
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Category</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterParent} onChange={e => setFilterParent(e.target.value)}>
              <option value="">All Parents</option>
              {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : FolderTree}
          title={showTrash ? 'Trash is empty' : 'No categories yet'}
          description={showTrash ? 'No deleted categories' : (searchDebounce || filterParent || filterStatus ? 'No categories match your filters' : 'Create your first blog category')}
          action={!showTrash && !searchDebounce && !filterParent && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Category</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected</Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently</Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="w-3.5 h-3.5" /> Clear</Button>
              </div>
            </div>
          )}

          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="sticky top-0 z-10 w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="sticky top-0 z-10 w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
                <TH className="sticky top-0 z-10">Slug</TH>
                <TH className="sticky top-0 z-10">Parent</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="text-sm font-medium text-slate-900">{c.name}</div>
                  </TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-400">{c.slug || '--'}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{getParentName(c.parent_id)}</span></TD>
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewing(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
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

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Category Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <FolderTree className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Name" value={viewing.name} />
              <DetailRow label="Slug" value={viewing.slug} />
              <DetailRow label="Parent" value={getParentName(viewing.parent_id)} />
              <DetailRow label="Description" value={viewing.description} />
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Category' : 'Create Category'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
              <Input {...register('name', { required: true })} placeholder="Category name" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Slug</label>
              <Input {...register('slug')} placeholder="auto-generated-slug" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Category description" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Parent Category</label>
              <select {...register('parent_id')} className={selectClass + ' w-full'}>
                <option value="">None (Top Level)</option>
                {allCategories.filter(c => !editing || c.id !== editing.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: BLOG POSTS
// ══════════════════════════════════════════════════════════════════
function PostsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<PostSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAuthorType, setFilterAuthorType] = useState('');
  const [filterFeatured, setFilterFeatured] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [categories, setCategories] = useState<any[]>([]);
  const [featuredImageFile, setFeaturedImageFile] = useState<File | null>(null);
  const [featuredImagePreview, setFeaturedImagePreview] = useState<string | null>(null);
  // Phase 15.2 — OG image upload
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
  const [ogImagePreview, setOgImagePreview] = useState<string | null>(null);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
  ]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('blog_posts').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCategories();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterCategory, filterStatus, filterAuthorType, filterFeatured, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterCategory, filterStatus, filterAuthorType, filterFeatured, showTrash]);

  async function loadCategories() {
    const res = await api.getBlogCategories({ limit: 500 });
    if (res.success) setCategories(res.data || []);
  }

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterCategory) params.category_id = filterCategory;
      if (filterStatus) params.status = filterStatus;
      if (filterAuthorType) params.author_type = filterAuthorType;
      if (filterFeatured) params.is_featured = filterFeatured;
    }
    const res = await api.getBlogPosts(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('blog_posts');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: PostSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: PostSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1); setFeaturedImageFile(null); setFeaturedImagePreview(null); setOgImageFile(null); setOgImagePreview(null);
    reset({
      title: '', slug: '', excerpt: '', content: '', category_id: '', author_id: '', author_type: 'system',
      status: 'draft', tags: '', meta_title: '', meta_description: '', meta_keywords: '', og_image_url: '',
      is_featured: false, is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(p: any) {
    setEditing(p); setDialogKey(k => k + 1); setFeaturedImageFile(null); setFeaturedImagePreview(null); setOgImageFile(null); setOgImagePreview(null);
    const tagsStr = Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || '');
    reset({
      title: p.title || '', slug: p.slug || '', excerpt: p.excerpt || '', content: p.content || '',
      category_id: p.category_id ?? '', author_id: p.author_id ?? '', author_type: p.author_type || 'system',
      status: p.status || 'draft', tags: tagsStr, meta_title: p.meta_title || '',
      meta_description: p.meta_description || '', meta_keywords: p.meta_keywords || '',
      og_image_url: p.og_image_url || '', is_featured: p.is_featured ?? false, is_active: p.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    if (data.title) fd.append('title', data.title);
    if (data.slug) fd.append('slug', data.slug);
    if (data.excerpt) fd.append('excerpt', data.excerpt);
    if (data.content) fd.append('content', data.content);
    if (data.category_id) fd.append('category_id', String(data.category_id));
    if (data.author_id) fd.append('author_id', String(data.author_id));
    if (data.author_type) fd.append('author_type', data.author_type);
    if (data.status) fd.append('status', data.status);
    if (data.meta_title) fd.append('meta_title', data.meta_title);
    if (data.meta_description) fd.append('meta_description', data.meta_description);
    if (data.meta_keywords) fd.append('meta_keywords', data.meta_keywords);
    // Phase 15.2 — only forward the URL if no new upload (lets users keep an external URL)
    if (data.og_image_url && !ogImageFile) fd.append('og_image_url', data.og_image_url);
    fd.append('is_featured', String(!!data.is_featured));
    fd.append('is_active', String(!!data.is_active));

    // Tags: split comma-separated string into JSON array
    if (data.tags) {
      const tagsArr = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      fd.append('tags', JSON.stringify(tagsArr));
    }

    if (ogImageFile) fd.append('og_image', ogImageFile, ogImageFile.name);
    if (featuredImageFile) {
      fd.append('featured_image', featuredImageFile);
    }

    const res = editing
      ? await api.updateBlogPost(editing.id, fd)
      : await api.createBlogPost(fd);
    if (res.success) {
      toast.success(editing ? 'Post updated' : 'Post created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onPublish(p: any) {
    if (!confirm(`Publish "${p.title}"?`)) return;
    setActionLoadingId(p.id);
    const res = await api.publishBlogPost(p.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Post published'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onArchive(p: any) {
    if (!confirm(`Archive "${p.title}"?`)) return;
    setActionLoadingId(p.id);
    const res = await api.archiveBlogPost(p.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Post archived'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(p: any) {
    if (!confirm(`Move "${p.title}" to trash?`)) return;
    setActionLoadingId(p.id);
    const res = await api.softDeleteBlogPost(p.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Post moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(p: any) {
    setActionLoadingId(p.id);
    const res = await api.restoreBlogPost(p.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Post restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(p: any) {
    if (!confirm(`PERMANENTLY delete "${p.title}"? This cannot be undone.`)) return;
    setActionLoadingId(p.id);
    const res = await api.permanentDeleteBlogPost(p.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Post permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteBlogPost(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreBlogPost(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteBlogPost(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  function getCategoryName(catId: number | null) {
    if (!catId) return '--';
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : `#${catId}`;
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Posts', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      {/* Trash toggle */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Posts
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Post</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by title...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              {POST_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterAuthorType} onChange={e => setFilterAuthorType(e.target.value)}>
              <option value="">All Author Types</option>
              {AUTHOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterFeatured} onChange={e => setFilterFeatured(e.target.value)}>
              <option value="">All Featured</option>
              <option value="true">Featured</option>
              <option value="false">Not Featured</option>
            </select>
          </>
        )}
      </DataToolbar>

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
          icon={showTrash ? Trash2 : FileText}
          title={showTrash ? 'Trash is empty' : 'No posts yet'}
          description={showTrash ? 'No deleted posts' : (searchDebounce || filterCategory || filterStatus || filterAuthorType || filterFeatured ? 'No posts match your filters' : 'Create your first blog post')}
          action={!showTrash && !searchDebounce && !filterCategory && !filterStatus && !filterAuthorType && !filterFeatured ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Post</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected</Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently</Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="w-3.5 h-3.5" /> Clear</Button>
              </div>
            </div>
          )}

          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="sticky top-0 z-10 w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="sticky top-0 z-10 w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Title <SortIcon field="title" /></button></TH>
                <TH className="sticky top-0 z-10">Category</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="status" /></button></TH>
                <TH className="sticky top-0 z-10">Featured</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('view_count')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Views <SortIcon field="view_count" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('rating_average')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Rating <SortIcon field="rating_average" /></button></TH>
                <TH className="sticky top-0 z-10">Author</TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(p => (
                <TR key={p.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(p.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{p.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="text-sm font-medium text-slate-900">{truncate(p.title, 50)}</div>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{getCategoryName(p.category_id)}</span></TD>
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : (
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', POST_STATUS_COLORS[p.status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(p.status || '')}
                      </span>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    {p.is_featured ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <Star className="w-4 h-4 text-slate-200" />}
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{p.view_count ?? 0}</span></TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-700">
                      {p.rating_average != null ? `${Number(p.rating_average).toFixed(1)} (${p.rating_count || 0})` : '--'}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', AUTHOR_TYPE_COLORS[p.author_type] || 'bg-slate-100 text-slate-600')}>
                      {capitalize(p.author_type || '')}
                    </span>
                  </TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{p.deleted_at ? fromNow(p.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(p)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(p)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewing(p)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          {p.status === 'draft' && (
                            <button onClick={() => onPublish(p)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Publish">
                              {actionLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {p.status === 'published' && (
                            <button onClick={() => onArchive(p)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="Archive">
                              {actionLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => onSoftDelete(p)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
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

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Post Details" size="xl">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <FileText className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', POST_STATUS_COLORS[viewing.status] || 'bg-slate-100 text-slate-600')}>{capitalize(viewing.status || '')}</span>
                  {viewing.is_featured && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', AUTHOR_TYPE_COLORS[viewing.author_type] || 'bg-slate-100 text-slate-600')}>{capitalize(viewing.author_type || '')}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Title" value={viewing.title} />
              <DetailRow label="Slug" value={viewing.slug} />
              <DetailRow label="Category" value={getCategoryName(viewing.category_id)} />
              <DetailRow label="Author ID" value={viewing.author_id != null ? String(viewing.author_id) : undefined} />
              <DetailRow label="Author Type" value={capitalize(viewing.author_type || '')} />
              <DetailRow label="Status" value={capitalize(viewing.status || '')} />
              <DetailRow label="Views" value={String(viewing.view_count ?? 0)} />
              <DetailRow label="Rating" value={viewing.rating_average != null ? `${Number(viewing.rating_average).toFixed(1)} (${viewing.rating_count || 0} reviews)` : undefined} />
              <DetailRow label="Featured" value={viewing.is_featured ? 'Yes' : 'No'} />
            </div>
            {viewing.excerpt && (
              <div className="mt-4">
                <DetailRow label="Excerpt" value={viewing.excerpt} />
              </div>
            )}
            {viewing.content && (
              <div className="mt-4">
                <DetailRow label="Content" value={truncate(viewing.content, 500)} />
              </div>
            )}
            {viewing.featured_image_url && (
              <div className="mt-4">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Featured Image</dt>
                <dd className="mt-1"><img src={viewing.featured_image_url} alt="Featured" className="max-h-40 rounded-lg border border-slate-200" /></dd>
              </div>
            )}
            {viewing.tags && Array.isArray(viewing.tags) && viewing.tags.length > 0 && (
              <div className="mt-4">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                  {viewing.tags.map((tag: string, i: number) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </dd>
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                <DetailRow label="Meta Title" value={viewing.meta_title} />
                <DetailRow label="Meta Description" value={viewing.meta_description} />
                <DetailRow label="Meta Keywords" value={viewing.meta_keywords} />
                <DetailRow label="OG Image URL" value={viewing.og_image_url} />
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                <DetailRow label="Published At" value={viewing.published_at ? new Date(viewing.published_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Post' : 'Create Post'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Title <span className="text-red-500">*</span></label>
              <Input {...register('title', { required: true })} placeholder="Post title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Slug</label>
              <Input {...register('slug')} placeholder="auto-generated-slug" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Excerpt</label>
            <textarea {...register('excerpt')} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Short excerpt" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Content</label>
            <textarea {...register('content')} rows={6} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Post content" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Category</label>
              <select {...register('category_id')} className={selectClass + ' w-full'}>
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Status</label>
              <select {...register('status')} className={selectClass + ' w-full'}>
                {POST_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Author ID</label>
              <Input {...register('author_id')} type="number" placeholder="Author user ID" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Author Type</label>
              <select {...register('author_type')} className={selectClass + ' w-full'}>
                {AUTHOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <ImageUpload key={`feat-${dialogKey}`} label="Featured Image" hint="Recommended: 1200×630px · drag &amp; drop, crop, then save"
            value={editing?.featured_image_url} aspectRatio={1200 / 630} maxWidth={1200} maxHeight={630} shape="rounded"
            onChange={(file, preview) => { setFeaturedImageFile(file); setFeaturedImagePreview(preview); }} />
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Tags (comma-separated)</label>
            <Input {...register('tags')} placeholder="tag1, tag2, tag3" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Title</label>
              <Input {...register('meta_title')} placeholder="SEO title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Keywords</label>
              <Input {...register('meta_keywords')} placeholder="keyword1, keyword2" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Description</label>
            <textarea {...register('meta_description')} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="SEO description" />
          </div>
          <ImageUpload key={`og-${dialogKey}`} label="OG Image" hint="Recommended: 1200×630px · or paste a URL in the URL field below"
            value={editing?.og_image_url} aspectRatio={1200 / 630} maxWidth={1200} maxHeight={630} shape="rounded"
            onChange={(file, preview) => { setOgImageFile(file); setOgImagePreview(preview); }} />
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">OG Image URL (manual fallback)</label>
            <Input {...register('og_image_url')} placeholder="https://… (only used when no file is uploaded)" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="flex items-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_featured')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Featured</span>
              </label>
            </div>
            <div className="flex items-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 3: BLOG REVIEWS
// ══════════════════════════════════════════════════════════════════
function ReviewsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<ReviewSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBlogPost, setFilterBlogPost] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterMinRating, setFilterMinRating] = useState('');
  const [filterMaxRating, setFilterMaxRating] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<any | null>(null);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
  ]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('blog_reviews').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadBlogPosts();
    loadStats();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterBlogPost, filterStatus, filterRating, filterMinRating, filterMaxRating, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterBlogPost, filterStatus, filterRating, filterMinRating, filterMaxRating, showTrash]);

  async function loadBlogPosts() {
    const res = await api.getBlogPosts({ limit: 500 });
    if (res.success) setBlogPosts(res.data || []);
  }

  async function loadStats() {
    const res = await api.getBlogReviewStats({});
    if (res.success) setReviewStats(res.data);
  }

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterBlogPost) params.blog_post_id = filterBlogPost;
      if (filterStatus) params.status = filterStatus;
      if (filterRating) params.rating = filterRating;
      if (filterMinRating) params.min_rating = filterMinRating;
      if (filterMaxRating) params.max_rating = filterMaxRating;
    }
    const res = await api.getBlogReviews(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('blog_reviews');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: ReviewSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: ReviewSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({ blog_post_id: '', user_id: '', rating: '5', title: '', review_text: '', status: 'pending', admin_notes: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(r: any) {
    setEditing(r); setDialogKey(k => k + 1);
    reset({
      blog_post_id: r.blog_post_id ?? '', user_id: r.user_id ?? '', rating: r.rating ?? '5',
      title: r.title || '', review_text: r.review_text || '', status: r.status || 'pending',
      admin_notes: r.admin_notes || '', is_active: r.is_active ?? true,
    });
    setDialogOpen(true);
  }

  function openStatusDialog(r: any) {
    setStatusTarget(r);
    setNewStatus(r.status || 'pending');
    setStatusDialogOpen(true);
  }

  async function onChangeStatus() {
    if (!statusTarget) return;
    setActionLoadingId(statusTarget.id);
    const res = await api.changeBlogReviewStatus(statusTarget.id, newStatus);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Status changed to ${newStatus}`); setStatusDialogOpen(false); load(); loadStats(); }
    else toast.error(res.error || 'Failed');
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['blog_post_id', 'user_id', 'rating'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateBlogReview(editing.id, payload)
      : await api.createBlogReview(payload);
    if (res.success) {
      toast.success(editing ? 'Review updated' : 'Review created');
      setDialogOpen(false); load(); refreshSummary(); loadStats();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(r: any) {
    if (!confirm(`Move review #${r.id} to trash?`)) return;
    setActionLoadingId(r.id);
    const res = await api.softDeleteBlogReview(r.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Review moved to trash'); load(); refreshSummary(); loadStats(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(r: any) {
    setActionLoadingId(r.id);
    const res = await api.restoreBlogReview(r.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Review restored'); load(); refreshSummary(); loadStats(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(r: any) {
    if (!confirm(`PERMANENTLY delete review #${r.id}? This cannot be undone.`)) return;
    setActionLoadingId(r.id);
    const res = await api.permanentDeleteBlogReview(r.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Review permanently deleted'); load(); refreshSummary(); loadStats(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRecalculate(blogPostId: number) {
    const res = await api.recalculateBlogReviewRatings(blogPostId);
    if (res.success) toast.success('Ratings recalculated');
    else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteBlogReview(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadStats();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreBlogReview(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadStats();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteBlogReview(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadStats();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  function getBlogPostTitle(postId: number | null) {
    if (!postId) return '--';
    const post = blogPosts.find(p => p.id === postId);
    return post ? post.title : `#${postId}`;
  }

  return (
    <>
      {/* Review Stats */}
      {reviewStats && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Reviews', value: reviewStats.total ?? (summary?.total || 0), icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Avg Rating', value: reviewStats.average_rating != null ? Number(reviewStats.average_rating).toFixed(1) : '--', icon: Star, color: 'bg-amber-50 text-amber-600' },
            { label: 'Published', value: reviewStats.by_status?.published ?? (summary?.is_active || 0), icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Pending', value: reviewStats.by_status?.pending ?? 0, icon: AlertTriangle, color: 'bg-amber-50 text-amber-600' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', card.color)}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-medium">{card.label}</div>
                  <div className="text-xl font-bold text-slate-900 leading-tight">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!reviewStats && summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Reviews', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      {/* Rating breakdown */}
      {reviewStats?.by_rating && (
        <div className="mb-5 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className="text-xs font-medium text-slate-500 mb-2">Rating Breakdown</div>
          <div className="flex items-center gap-4">
            {[5, 4, 3, 2, 1].map(r => (
              <div key={r} className="flex items-center gap-1.5 text-sm">
                <span className="text-amber-500">{renderStars(r)}</span>
                <span className="text-slate-600 font-medium">{reviewStats.by_rating[r] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trash toggle */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Reviews
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1 flex items-center gap-2">
            <Button variant="outline" onClick={() => loadStats()}><RefreshCw className="w-4 h-4" /> Refresh Stats</Button>
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Review</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search reviews...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterBlogPost} onChange={e => setFilterBlogPost(e.target.value)}>
              <option value="">All Posts</option>
              {blogPosts.map(p => <option key={p.id} value={p.id}>{truncate(p.title, 40)}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              {REVIEW_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterRating} onChange={e => setFilterRating(e.target.value)}>
              <option value="">All Ratings</option>
              {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
            </select>
            <Input
              type="number" min={1} max={5} placeholder="Min"
              value={filterMinRating} onChange={e => setFilterMinRating(e.target.value)}
              className="w-20"
            />
            <Input
              type="number" min={1} max={5} placeholder="Max"
              value={filterMaxRating} onChange={e => setFilterMaxRating(e.target.value)}
              className="w-20"
            />
          </>
        )}
      </DataToolbar>

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
          icon={showTrash ? Trash2 : MessageSquare}
          title={showTrash ? 'Trash is empty' : 'No reviews yet'}
          description={showTrash ? 'No deleted reviews' : (searchDebounce || filterBlogPost || filterStatus || filterRating || filterMinRating || filterMaxRating ? 'No reviews match your filters' : 'Create your first blog review')}
          action={!showTrash && !searchDebounce && !filterBlogPost && !filterStatus && !filterRating && !filterMinRating && !filterMaxRating ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Review</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected</Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently</Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="w-3.5 h-3.5" /> Clear</Button>
              </div>
            </div>
          )}

          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="sticky top-0 z-10 w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="sticky top-0 z-10 w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="sticky top-0 z-10">Post</TH>
                <TH className="sticky top-0 z-10">User</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('rating')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Rating <SortIcon field="rating" /></button></TH>
                <TH className="sticky top-0 z-10">Title</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="status" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('helpful_count')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Helpful <SortIcon field="helpful_count" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('reported_count')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Reported <SortIcon field="reported_count" /></button></TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(r => (
                <TR key={r.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(r.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{r.id}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(r.blog_post_title || getBlogPostTitle(r.blog_post_id), 30)}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{r.user_name || (r.user_id ? `User #${r.user_id}` : '--')}</span></TD>
                  <TD className="py-2.5"><span className="text-amber-500 text-sm">{renderStars(r.rating || 0)}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(r.title, 30)}</span></TD>
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : (
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REVIEW_STATUS_COLORS[r.status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(r.status || '')}
                      </span>
                    )}
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{r.helpful_count ?? 0}</span></TD>
                  <TD className="py-2.5"><span className={cn('text-sm', (r.reported_count || 0) > 0 ? 'text-red-600 font-medium' : 'text-slate-700')}>{r.reported_count ?? 0}</span></TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{r.deleted_at ? fromNow(r.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(r)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(r)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewing(r)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(r)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openStatusDialog(r)} className="p-1.5 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Change Status"><RefreshCw className="w-3.5 h-3.5" /></button>
                          {r.blog_post_id && (
                            <button onClick={() => onRecalculate(r.blog_post_id)} className="p-1.5 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Recalculate Ratings"><BarChart3 className="w-3.5 h-3.5" /></button>
                          )}
                          <button onClick={() => onSoftDelete(r)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
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

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Review Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <MessageSquare className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.title || 'Review'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-amber-500">{renderStars(viewing.rating || 0)}</span>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REVIEW_STATUS_COLORS[viewing.status] || 'bg-slate-100 text-slate-600')}>{capitalize(viewing.status || '')}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Blog Post" value={viewing.blog_post_title || getBlogPostTitle(viewing.blog_post_id)} />
              <DetailRow label="User" value={viewing.user_name || (viewing.user_id ? `User #${viewing.user_id}` : undefined)} />
              <DetailRow label="Rating" value={viewing.rating ? `${viewing.rating}/5` : undefined} />
              <DetailRow label="Title" value={viewing.title} />
              <DetailRow label="Helpful Count" value={String(viewing.helpful_count ?? 0)} />
              <DetailRow label="Reported Count" value={String(viewing.reported_count ?? 0)} />
            </div>
            {viewing.review_text && (
              <div className="mt-4">
                <DetailRow label="Review Text" value={viewing.review_text} />
              </div>
            )}
            {viewing.admin_notes && (
              <div className="mt-4">
                <DetailRow label="Admin Notes" value={viewing.admin_notes} />
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Review' : 'Create Review'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Blog Post <span className="text-red-500">*</span></label>
              <select {...register('blog_post_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select Post</option>
                {blogPosts.map(p => <option key={p.id} value={p.id}>{truncate(p.title, 50)}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">User ID <span className="text-red-500">*</span></label>
              <Input {...register('user_id', { required: true })} type="number" placeholder="User ID" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Rating <span className="text-red-500">*</span></label>
              <select {...register('rating', { required: true })} className={selectClass + ' w-full'}>
                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''} {renderStars(r)}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Status</label>
              <select {...register('status')} className={selectClass + ' w-full'}>
                {REVIEW_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Title</label>
            <Input {...register('title')} placeholder="Review title" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Review Text</label>
            <textarea {...register('review_text')} rows={4} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Review text" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Admin Notes</label>
            <textarea {...register('admin_notes')} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Internal notes" />
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Change Status Dialog ── */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} title="Change Review Status" size="sm">
        {statusTarget && (
          <div className="p-6 space-y-5">
            <div>
              <div className="text-sm text-slate-600 mb-3">Change status for review <span className="font-semibold">#{statusTarget.id}</span></div>
              <div className="text-sm text-slate-500 mb-4">Current: <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REVIEW_STATUS_COLORS[statusTarget.status] || 'bg-slate-100 text-slate-600')}>{capitalize(statusTarget.status || '')}</span></div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">New Status</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className={selectClass + ' w-full'}>
                {REVIEW_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
              <Button onClick={onChangeStatus} disabled={actionLoadingId === statusTarget.id}>
                {actionLoadingId === statusTarget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Update Status
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
