"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
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
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Package, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, Check, X } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'code' | 'name' | 'slug' | 'price' | 'is_active' | 'bundle_owner' | 'is_featured';

interface CoverageItem {
  bundle_id: number;
  total_languages: number;
  translated_count: number;
  missing_count: number;
  is_complete: boolean;
  translated_languages: { id: number; name: string; iso_code: string }[];
  missing_languages: { id: number; name: string; iso_code: string }[];
}

const OWNER_OPTIONS = [
  { value: 'gum_admin', label: 'GUM Admin' },
  { value: 'instructor', label: 'Instructor' },
];

const OWNER_COLORS: Record<string, string> = {
  gum_admin: 'bg-blue-50 text-blue-700',
  instructor: 'bg-violet-50 text-violet-700',
};

export default function BundlesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [activeTab, setActiveTab] = useState('basic');

  // Pagination, search, sort, filter
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [filterIsFeatured, setFilterIsFeatured] = useState<string>('');

  // Table summary stats
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  // Trash mode
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Coverage
  const [coverage, setCoverage] = useState<Record<number, CoverageItem>>({});

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const [slugManual, setSlugManual] = useState(false);
  const watchedCode = watch('code');

  // Auto-generate slug from code
  useEffect(() => {
    if (!slugManual && watchedCode !== undefined) {
      const slug = (watchedCode || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setValue('slug', slug);
    }
  }, [watchedCode, slugManual, setValue]);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g u', action: () => router.push('/users') },
    { key: 'g c', action: () => router.push('/categories') },
    { key: 'g o', action: () => router.push('/courses') },
    { key: 'g s', action: () => router.push('/subjects') },
    { key: 'g m', action: () => router.push('/material-tree') },
  ]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary + coverage once on mount
  useEffect(() => {
    api.getTableSummary('bundles').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, filterOwner, filterIsFeatured, pageSize, showTrash]);
  useEffect(() => { load(); loadCoverage(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, filterOwner, filterIsFeatured, showTrash]);

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
      if (filterOwner) qs.set('bundle_owner', filterOwner);
      if (filterIsFeatured) qs.set('is_featured', filterIsFeatured);
    }
    const res = await api.listBundles('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('bundles');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getBundleTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: CoverageItem) => { map[c.bundle_id] = c; });
      setCoverage(map);
    }
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
    setEditing(null); setDialogKey(k => k + 1); setSlugManual(false); setActiveTab('basic');
    reset({
      code: '', name: '', slug: '', is_active: true,
      price: '', original_price: '', discount_percentage: '', validity_days: '',
      bundle_owner: 'gum_admin', instructor_id: '', max_courses: '',
      starts_at: '', expires_at: '',
      is_featured: false,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1); setSlugManual(true); setActiveTab('basic');
    reset({
      code: c.code || '', name: c.name || '', slug: c.slug || '',
      is_active: c.is_active ?? true,
      price: c.price ?? '', original_price: c.original_price ?? '', discount_percentage: c.discount_percentage ?? '',
      validity_days: c.validity_days ?? '',
      bundle_owner: c.bundle_owner || 'gum_admin', instructor_id: c.instructor_id ?? '',
      max_courses: c.max_courses ?? '',
      starts_at: c.starts_at ? c.starts_at.substring(0, 10) : '',
      expires_at: c.expires_at ? c.expires_at.substring(0, 10) : '',
      is_featured: c.is_featured ?? false,
    });
    setDialogOpen(true);
  }

  function openView(c: any) {
    setViewing(c);
  }

  async function onSubmit(data: any) {
    // Clean up empty strings to not send them as values
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      // Convert booleans properly
      if (typeof v === 'boolean') { payload[k] = v; return; }
      // Convert numeric fields
      const numericFields = ['price', 'original_price', 'discount_percentage', 'validity_days', 'instructor_id', 'max_courses'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateBundle(editing.id, payload)
      : await api.createBundle(payload);
    if (res.success) {
      toast.success(editing ? 'Bundle updated' : 'Bundle created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.code}" to trash? You can restore it later.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteBundle(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Bundle moved to trash'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreBundle(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${c.code}" restored`); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.code}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteBundle(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Bundle permanently deleted'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: any) {
    const res = await api.updateBundle(c.id, { is_active: !c.is_active });
    if (res.success) { toast.success(`${!c.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); loadCoverage(); }
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
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteBundle(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreBundle(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteBundle(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  function formatPrice(val: any) {
    if (val === null || val === undefined || val === '') return '--';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val));
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  const formTabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'details', label: 'Details' },
    { id: 'features', label: 'Features' },
    { id: 'stats', label: 'Stats' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Bundles"
        description="Manage bundles and their details"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add bundle</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Bundles', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Bundles
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

      {/* Toolbar: search + filters (only in normal view) */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search bundles...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
              <option value="">All Owners</option>
              <option value="gum_admin">GUM Admin</option>
              <option value="instructor">Instructor</option>
            </select>
            <select className={selectClass} value={filterIsFeatured} onChange={e => setFilterIsFeatured(e.target.value)}>
              <option value="">All Featured</option>
              <option value="true">Featured</option>
              <option value="false">Not Featured</option>
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
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Package}
          title={showTrash ? 'Trash is empty' : 'No bundles yet'}
          description={showTrash ? 'No deleted bundles' : (searchDebounce || filterStatus || filterOwner || filterIsFeatured ? 'No bundles match your filters' : 'Add your first bundle')}
          action={!showTrash && !searchDebounce && !filterStatus && !filterOwner && !filterIsFeatured ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add bundle</Button> : undefined}
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
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected
                    </Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected
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
                <TH>
                  <button onClick={() => handleSort('code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Code <SortIcon field="code" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Name <SortIcon field="name" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('bundle_owner')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Owner <SortIcon field="bundle_owner" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('price')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Price <SortIcon field="price" />
                  </button>
                </TH>
                {!showTrash && <TH>Translations</TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH>
                  <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Active <SortIcon field="is_active" />
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
                  <TD className="py-2.5">
                    <span className={cn('text-sm font-medium font-mono', showTrash ? 'text-slate-500 line-through' : 'text-slate-700')}>{c.code}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{c.name || c.slug || ''}</span>
                    {c.instructor_name && <div className="text-xs text-slate-400 mt-0.5">by {c.instructor_name}</div>}
                  </TD>
                  <TD className="py-2.5">
                    {c.bundle_owner ? (
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', OWNER_COLORS[c.bundle_owner] || 'bg-slate-50 text-slate-600')}>
                        {c.bundle_owner === 'gum_admin' ? 'GUM Admin' : 'Instructor'}
                      </span>
                    ) : <span className="text-slate-300">--</span>}
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm font-medium text-slate-700">{formatPrice(c.price)}</span>
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      {(() => {
                        const cov = coverage[c.id];
                        if (!cov) return <span className="text-slate-300 text-xs">--</span>;
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
                          </div>
                        );
                      })()}
                    </TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span>
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
                          <button onClick={() => onRestore(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* ── View Bundle Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Bundle Details" size="lg">
        {viewing && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name || viewing.code}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {viewing.bundle_owner && (
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', OWNER_COLORS[viewing.bundle_owner] || 'bg-slate-50 text-slate-600')}>
                      {viewing.bundle_owner === 'gum_admin' ? 'GUM Admin' : 'Instructor'}
                    </span>
                  )}
                  {viewing.is_featured && <Badge variant="info">Featured</Badge>}
                </div>
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Code" value={viewing.code} />
              <DetailRow label="Slug" value={`/${viewing.slug}`} />
              <DetailRow label="Name" value={viewing.name} />
              <DetailRow label="Bundle Owner" value={viewing.bundle_owner === 'gum_admin' ? 'GUM Admin' : viewing.bundle_owner === 'instructor' ? 'Instructor' : viewing.bundle_owner} />
              <DetailRow label="Instructor" value={viewing.instructor_name || (viewing.instructor_id ? `ID: ${viewing.instructor_id}` : undefined)} />
              <DetailRow label="Max Courses" value={viewing.max_courses != null ? String(viewing.max_courses) : undefined} />
              <DetailRow label="Price" value={formatPrice(viewing.price)} />
              <DetailRow label="Original Price" value={formatPrice(viewing.original_price)} />
              <DetailRow label="Discount %" value={viewing.discount_percentage != null ? `${viewing.discount_percentage}%` : undefined} />
              <DetailRow label="Validity (days)" value={viewing.validity_days != null ? String(viewing.validity_days) : undefined} />
              <DetailRow label="Starts At" value={viewing.starts_at ? new Date(viewing.starts_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
              <DetailRow label="Expires At" value={viewing.expires_at ? new Date(viewing.expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
            </div>

            {/* Features */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Features</p>
              <div className="flex flex-wrap gap-2">
                {viewing.is_featured && <Badge variant="info">Featured</Badge>}
                {!viewing.is_featured && (
                  <span className="text-sm text-slate-400">No features enabled</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Stats</p>
              <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                <DetailRow label="Rating" value={viewing.rating_average != null ? `${viewing.rating_average} (${viewing.rating_count || 0} reviews)` : undefined} />
                <DetailRow label="Enrollments" value={viewing.enrollment_count != null ? String(viewing.enrollment_count) : undefined} />
                <DetailRow label="Views" value={viewing.view_count != null ? String(viewing.view_count) : undefined} />
              </div>
            </div>

            {/* Timestamps */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
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

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Bundle' : 'Add Bundle'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle -- only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This bundle is currently active' : 'This bundle is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getBundle(editing.id);
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

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 -mx-6 px-6">
            {formTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                  activeTab === tab.id ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Basic */}
          {activeTab === 'basic' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Code" placeholder="bundle-pro-2024" {...register('code', { required: true })} />
                <Input label="Slug" placeholder="bundle-pro-2024" {...register('slug', { required: true, onChange: () => setSlugManual(true) })} />
              </div>
              <Input label="Name" placeholder="Pro Bundle 2024" {...register('name')} />
            </div>
          )}

          {/* Tab: Pricing */}
          {activeTab === 'pricing' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Input label="Price" type="number" step="0.01" placeholder="0.00" {...register('price')} />
                <Input label="Original Price" type="number" step="0.01" placeholder="0.00" {...register('original_price')} />
                <Input label="Discount %" type="number" step="0.01" placeholder="0" {...register('discount_percentage')} />
              </div>
              <Input label="Validity (days)" type="number" placeholder="365" {...register('validity_days')} />
            </div>
          )}

          {/* Tab: Details */}
          {activeTab === 'details' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bundle Owner</label>
                  <select className={cn(selectClass, 'w-full')} {...register('bundle_owner')}>
                    {OWNER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <Input label="Instructor ID" type="number" placeholder="User ID" {...register('instructor_id')} />
              </div>
              <Input label="Max Courses" type="number" placeholder="10" {...register('max_courses')} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Starts At" type="date" {...register('starts_at')} />
                <Input label="Expires At" type="date" {...register('expires_at')} />
              </div>
            </div>
          )}

          {/* Tab: Features */}
          {activeTab === 'features' && (
            <div className="space-y-3">
              <div className="space-y-2.5">
                {[
                  { field: 'is_featured', label: 'Featured Bundle' },
                ].map(item => (
                  <label key={item.field} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register(item.field)} />
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Stats (read-only counters) */}
          {activeTab === 'stats' && editing && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">These fields are read-only counters maintained by the system.</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">Enrollment Count</span>
                  <p className="text-sm font-semibold text-slate-800">{editing.enrollment_count ?? 0}</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">Rating Average</span>
                  <p className="text-sm font-semibold text-slate-800">{editing.rating_average ?? '--'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">Rating Count</span>
                  <p className="text-sm font-semibold text-slate-800">{editing.rating_count ?? 0}</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-xs text-slate-400">View Count</span>
                  <p className="text-sm font-semibold text-slate-800">{editing.view_count ?? 0}</p>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'stats' && !editing && (
            <p className="text-sm text-slate-500">Stats are only available when editing an existing bundle.</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/* ── Small helper for the view dialog ── */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}
