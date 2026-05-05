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
import { Plus, Calendar, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, Check, X, Sparkles, Users, DollarSign, Clock, Package } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'title' | 'code' | 'batch_status' | 'batch_owner' | 'price' | 'display_order' | 'is_active';

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-700',
};

const OWNER_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'instructor', label: 'Instructor' },
];

const OWNER_COLORS: Record<string, string> = {
  system: 'bg-blue-50 text-blue-700',
  instructor: 'bg-violet-50 text-violet-700',
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

export default function CourseBatchesPage() {
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
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterBatchStatus, setFilterBatchStatus] = useState<string>('');
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [filterCourse, setFilterCourse] = useState<string>('');

  // Table summary stats
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  // Trash mode
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Courses list for filter & form
  const [courses, setCourses] = useState<any[]>([]);

  // Coverage
  const [coverage, setCoverage] = useState<Record<number, any>>({});

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  const { register, handleSubmit, reset, setValue, watch } = useForm();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
  ]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary + courses once on mount
  useEffect(() => {
    api.getTableSummary('course_batches').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    api.listCourses('?is_active=true&limit=200').then(res => {
      if (res.success) setCourses(res.data || []);
    });
    loadCoverage();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, filterBatchStatus, filterOwner, filterCourse, pageSize, showTrash]);
  useEffect(() => { load(); loadCoverage(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, filterBatchStatus, filterOwner, filterCourse, showTrash]);

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
      if (filterBatchStatus) qs.set('batch_status', filterBatchStatus);
      if (filterOwner) qs.set('batch_owner', filterOwner);
      if (filterCourse) qs.set('course_id', filterCourse);
    }
    const res = await api.listCourseBatches('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('course_batches');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getBatchTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, any> = {};
      res.data.forEach((c: any) => {
        if (!map[c.batch_id]) map[c.batch_id] = [];
        map[c.batch_id].push(c);
      });
      setCoverage(map);
    }
  }

  async function handleFillAllMissing() {
    if (!confirm('This will generate AI content for ALL batches with missing or empty translations. This may take several minutes. Continue?')) return;
    setBulkActionLoading(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'course_batch', generate_all: true, provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s } = res.data;
        toast.success(`Generated content for ${s.success} item(s), ${s.skipped} already complete, ${s.errors} error(s)`);
        load(); loadCoverage();
      } else { toast.error(res.error || 'Bulk generation failed'); }
    } catch { toast.error('Bulk generation failed'); }
    setBulkActionLoading(false);
  }

  async function handleAIGenerateSingle(entityId: number, forceRegenerate: boolean = false) {
    setBulkActionLoading(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'course_batch', entity_ids: [entityId], provider: 'gemini', force_regenerate: forceRegenerate });
      if (res.success && res.data) {
        const { summary: s, results: r } = res.data;
        if (s.skipped > 0 && s.success === 0) {
          toast.success('All translations already complete!');
        } else {
          const langsGenerated = r?.reduce((acc: number, item: any) => acc + (item.languages_generated || 0), 0) || 0;
          toast.success(`${forceRegenerate ? 'Regenerated' : 'Generated'} ${langsGenerated} translation(s)`);
        }
        load(); loadCoverage();
      } else { toast.error(res.error || 'Generation failed'); }
    } catch { toast.error('Generation failed'); }
    setBulkActionLoading(false);
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
    setEditing(null); setDialogKey(k => k + 1); setActiveTab('basic');
    reset({
      title: '', code: '', slug: '', is_active: true,
      course_id: '', batch_owner: 'system', batch_status: 'upcoming',
      instructor_id: '', max_students: '', price: '', is_free: false,
      includes_course_access: true, start_date: '', end_date: '',
      meeting_platform: '', meeting_link: '', display_order: '',
      schedule: '',
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1); setActiveTab('basic');
    reset({
      title: c.title || '', code: c.code || '', slug: c.slug || '',
      is_active: c.is_active ?? true,
      course_id: c.course_id ?? '', batch_owner: c.batch_owner || 'system',
      batch_status: c.batch_status || 'upcoming',
      instructor_id: c.instructor_id ?? '', max_students: c.max_students ?? '',
      price: c.price ?? '', is_free: c.is_free ?? false,
      includes_course_access: c.includes_course_access ?? true,
      start_date: c.start_date ? c.start_date.substring(0, 10) : '',
      end_date: c.end_date ? c.end_date.substring(0, 10) : '',
      meeting_platform: c.meeting_platform || '', meeting_link: c.meeting_link || '',
      display_order: c.display_order ?? '',
      schedule: c.schedule ? JSON.stringify(c.schedule, null, 2) : '',
    });
    setDialogOpen(true);
  }

  function openView(c: any) {
    setViewing(c);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['price', 'max_students', 'instructor_id', 'course_id', 'display_order', 'enrolled_count'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      if (k === 'schedule' && typeof v === 'string') {
        try { payload[k] = JSON.parse(v); } catch { payload[k] = v; }
        return;
      }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateCourseBatch(editing.id, payload)
      : await api.createCourseBatch(payload);
    if (res.success) {
      toast.success(editing ? 'Batch updated' : 'Batch created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.title || c.code}" to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteCourseBatch(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Batch moved to trash'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreCourseBatch(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Batch restored'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.title || c.code}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteCourseBatch(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Batch permanently deleted'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: any) {
    const res = await api.updateCourseBatch(c.id, { is_active: !c.is_active });
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
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteCourseBatch(ids[i]);
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
      const res = await api.restoreCourseBatch(ids[i]);
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
      const res = await api.permanentDeleteCourseBatch(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  function formatPrice(val: any, isFree: boolean) {
    if (isFree) return null;
    if (val === null || val === undefined || val === '') return '--';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val));
  }

  function capacityBar(enrolled: number, max: number) {
    if (!max) return null;
    const pct = Math.min(100, Math.round((enrolled / max) * 100));
    const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
    return (
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-slate-500">{enrolled}/{max}</span>
      </div>
    );
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  const formTabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'pricing', label: 'Pricing' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Course Batches"
        description="Manage course batch scheduling, pricing, and capacity"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={handleFillAllMissing} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Fill All Missing</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Batch</Button>}
          </div>
        }
      />

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Batches', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Batches
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

      {/* Toolbar */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search batches...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title || c.code}</option>)}
            </select>
            <select className={selectClass} value={filterBatchStatus} onChange={e => setFilterBatchStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
              <option value="">All Owners</option>
              {OWNER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Active</option>
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
          icon={showTrash ? Trash2 : Calendar}
          title={showTrash ? 'Trash is empty' : 'No batches yet'}
          description={showTrash ? 'No deleted batches' : (searchDebounce || filterStatus || filterBatchStatus || filterOwner || filterCourse ? 'No batches match your filters' : 'Add your first course batch')}
          action={!showTrash && !searchDebounce && !filterStatus && !filterBatchStatus && !filterOwner && !filterCourse ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Batch</Button> : undefined}
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
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"># <SortIcon field="id" /></button></TH>
                <TH>
                  <button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Title <SortIcon field="title" />
                  </button>
                </TH>
                <TH>Course</TH>
                <TH>
                  <button onClick={() => handleSort('batch_status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Status <SortIcon field="batch_status" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('price')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Price <SortIcon field="price" />
                  </button>
                </TH>
                <TH>Capacity</TH>
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
                  <TD className="py-2.5">
                    <div className="flex flex-col">
                      <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{c.title || c.code || `Batch #${c.id}`}</span>
                      {c.code && <span className="text-xs text-slate-400 font-mono">{c.code}</span>}
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-600">{c.courses?.title || '--'}</span>
                  </TD>
                  <TD className="py-2.5">
                    {c.batch_status ? (
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[c.batch_status] || 'bg-slate-50 text-slate-600')}>
                        {STATUS_OPTIONS.find(o => o.value === c.batch_status)?.label || c.batch_status}
                      </span>
                    ) : <span className="text-slate-300">--</span>}
                  </TD>
                  <TD className="py-2.5">
                    {c.is_free ? (
                      <Badge variant="success">FREE</Badge>
                    ) : (
                      <span className="text-sm font-medium text-slate-700">{formatPrice(c.price, false)}</span>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    {capacityBar(c.enrolled_count || 0, c.max_students || 0)}
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      {(() => {
                        const cov = coverage[c.id];
                        const count = cov ? cov.length : 0;
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                              count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                            )}>
                              {count > 0 && <Check className="w-3 h-3" />}
                              {count}
                            </span>
                            <button
                              onClick={() => handleAIGenerateSingle(c.id, count > 0)}
                              disabled={bulkActionLoading}
                              className={cn('p-1 rounded-md transition-colors', count > 0 ? 'text-amber-500 hover:text-amber-700 hover:bg-amber-50' : 'text-violet-500 hover:text-violet-700 hover:bg-violet-50')}
                              title={count > 0 ? 'Regenerate translations' : 'Generate translations'}
                            >
                              {count > 0 ? <RotateCcw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        );
                      })()}
                    </TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-slate-400">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span>
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
                          <button onClick={() => onToggleActive(c)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title={c.is_active ? 'Deactivate' : 'Activate'}>
                            {c.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
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
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            showingCount={items.length}
          />
        </div>
      )}

      {/* View Dialog */}
      {viewing && (
        <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Batch Details" size="lg">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                <Calendar className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.title || viewing.code || `Batch #${viewing.id}`}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {viewing.batch_status && (
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[viewing.batch_status] || 'bg-slate-50 text-slate-600')}>
                      {STATUS_OPTIONS.find(o => o.value === viewing.batch_status)?.label || viewing.batch_status}
                    </span>
                  )}
                  {viewing.batch_owner && (
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', OWNER_COLORS[viewing.batch_owner] || 'bg-slate-50 text-slate-600')}>
                      {viewing.batch_owner === 'system' ? 'System' : 'Instructor'}
                    </span>
                  )}
                  {viewing.is_free && <Badge variant="info">FREE</Badge>}
                </div>
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Code" value={viewing.code} />
              <DetailRow label="Slug" value={viewing.slug ? `/${viewing.slug}` : undefined} />
              <DetailRow label="Course" value={viewing.courses?.title} />
              <DetailRow label="Instructor" value={viewing.users?.full_name || (viewing.instructor_id ? `ID: ${viewing.instructor_id}` : undefined)} />
              <DetailRow label="Price" value={viewing.is_free ? 'FREE' : formatPrice(viewing.price, false)} />
              <DetailRow label="Capacity" value={`${viewing.enrolled_count || 0} / ${viewing.max_students || 'Unlimited'}`} />
              <DetailRow label="Start Date" value={viewing.start_date ? new Date(viewing.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
              <DetailRow label="End Date" value={viewing.end_date ? new Date(viewing.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
              <DetailRow label="Meeting Platform" value={viewing.meeting_platform} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
              <DetailRow label="Includes Course Access" value={viewing.includes_course_access ? 'Yes' : 'No'} />
              <DetailRow label="Meeting Link" value={viewing.meeting_link} />
            </div>

            {/* Schedule JSON */}
            {viewing.schedule && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Schedule</p>
                <pre className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 overflow-x-auto border border-slate-100">{JSON.stringify(viewing.schedule, null, 2)}</pre>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Create/Edit Dialog */}
      <Dialog key={dialogKey} open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Batch' : 'Create Batch'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 mb-4">
            {formTabs.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
              )}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Title" {...register('title')} placeholder="Batch title (or auto from English translation)" />
                <Input label="Code" {...register('code')} placeholder="e.g. BATCH-2026-JAN" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Slug" {...register('slug')} placeholder="auto-generated or custom" />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course *</label>
                  <select className={cn(selectClass, 'w-full')} {...register('course_id', { required: true })}>
                    <option value="">Select course...</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title || c.code}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
                  <select className={cn(selectClass, 'w-full')} {...register('batch_owner')}>
                    {OWNER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select className={cn(selectClass, 'w-full')} {...register('batch_status')}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <Input label="Instructor ID" type="number" {...register('instructor_id')} placeholder="User ID" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Display Order" type="number" {...register('display_order')} placeholder="0" />
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-sm text-slate-700">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('includes_course_access')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-sm text-slate-700">Includes Course Access</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Start Date" type="date" {...register('start_date')} />
                <Input label="End Date" type="date" {...register('end_date')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Meeting Platform" {...register('meeting_platform')} placeholder="e.g. Zoom, Google Meet" />
                <Input label="Meeting Link" {...register('meeting_link')} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Schedule (JSON)</label>
                <textarea {...register('schedule')} rows={6} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 font-mono" placeholder='{"days": ["Mon", "Wed", "Fri"], "time": "10:00-12:00"}' />
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Price (INR)" type="number" step="0.01" {...register('price')} placeholder="0.00" />
                <Input label="Max Students" type="number" {...register('max_students')} placeholder="Unlimited if empty" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('is_free')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-slate-700">Free Batch</span>
                </label>
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
