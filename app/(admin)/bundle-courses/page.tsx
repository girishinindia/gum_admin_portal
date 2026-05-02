"use client";
import { useEffect, useState, useRef } from 'react';
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
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { useAuth } from '@/hooks/useAuth';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Link2, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Loader2, Search, Check } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

/* ── Local types ── */
interface BundleOption { id: number; code: string; slug: string; name?: string; is_active: boolean; }
interface CourseOption { id: number; code: string; slug: string; name?: string; is_active: boolean; created_by?: number | null; }

interface BundleCourse {
  id: number;
  bundle_id: number;
  course_id: number;
  display_order: number;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  bundles?: { code: string; slug: string; name: string };
  courses?: { code: string; slug: string; name: string };
}

type SortField = 'id' | 'display_order' | 'is_active';

export default function BundleCoursesPage() {
  const [items, setItems] = useState<BundleCourse[]>([]);
  const [bundles, setBundles] = useState<BundleOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BundleCourse | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewing, setViewing] = useState<BundleCourse | null>(null);

  // Create dialog state
  const [createBundleId, setCreateBundleId] = useState<number | ''>('');
  const [createSelectedCourses, setCreateSelectedCourses] = useState<Set<number>>(new Set());
  const [createIsActive, setCreateIsActive] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [createProgress, setCreateProgress] = useState({ done: 0, total: 0 });
  const [courseSearch, setCourseSearch] = useState('');
  const [assignedCourseIds, setAssignedCourseIds] = useState<Set<number>>(new Set());

  // Pagination, search, sort, filters
  const [filterBundle, setFilterBundle] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();
  const { user } = useAuth();
  const isSuperAdmin = (user?.max_role_level || 0) >= 100;

  // For instructors, only show their own courses; super admins see all
  const visibleCourses = isSuperAdmin
    ? courses
    : courses.filter(c => c.created_by === user?.id);

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g b', action: () => router.push('/bundles') },
  ]);

  // Load dropdowns on mount
  useEffect(() => {
    api.listBundles('?limit=500&sort=code&ascending=true').then(res => { if (res.success) setBundles(res.data || []); });
    api.listCourses('?limit=500&sort=code&ascending=true').then(res => { if (res.success) setCourses(res.data || []); });
    refreshSummary();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterBundle, filterCourse, filterStatus, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterBundle, filterCourse, filterStatus, sortField, sortOrder, pageSize, showTrash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSummary() {
    const res = await api.getTableSummary('bundle_courses');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterBundle) qs.set('bundle_id', filterBundle);
      if (filterCourse) qs.set('course_id', filterCourse);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listBundleCourses('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  /* ── Create Dialog ── */
  function openCreate() {
    setCreateBundleId('');
    setCreateSelectedCourses(new Set());
    setCreateIsActive(true);
    setCourseSearch('');
    setAssignedCourseIds(new Set());
    setCreateProgress({ done: 0, total: 0 });
    setCreateOpen(true);
  }

  // When bundle changes, fetch already-assigned courses for that bundle
  async function loadAssignedCourses(bundleId: number) {
    const res = await api.listBundleCourses(`?bundle_id=${bundleId}&limit=500`);
    if (res.success && Array.isArray(res.data)) {
      setAssignedCourseIds(new Set(res.data.map((bc: any) => bc.course_id)));
    }
  }

  function toggleCourseSelection(courseId: number) {
    setCreateSelectedCourses(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId); else next.add(courseId);
      return next;
    });
  }

  function selectAllFilteredCourses() {
    const filtered = getFilteredCourses();
    const available = filtered.filter(c => !assignedCourseIds.has(c.id));
    if (available.every(c => createSelectedCourses.has(c.id))) {
      // Deselect all filtered
      setCreateSelectedCourses(prev => {
        const next = new Set(prev);
        available.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      // Select all filtered
      setCreateSelectedCourses(prev => {
        const next = new Set(prev);
        available.forEach(c => next.add(c.id));
        return next;
      });
    }
  }

  function getFilteredCourses() {
    if (!courseSearch.trim()) return visibleCourses;
    const q = courseSearch.toLowerCase();
    return visibleCourses.filter(c =>
      (c.name || '').toLowerCase().includes(q)
    );
  }

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!createBundleId) { toast.error('Please select a bundle'); return; }
    if (createSelectedCourses.size === 0) { toast.error('Please select at least one course'); return; }
    setCreateLoading(true);
    const courseIds = Array.from(createSelectedCourses);
    setCreateProgress({ done: 0, total: courseIds.length });
    let ok = 0;
    let errors: string[] = [];
    for (let i = 0; i < courseIds.length; i++) {
      const res = await api.createBundleCourse({
        bundle_id: createBundleId,
        course_id: courseIds[i],
        display_order: i,
        is_active: createIsActive,
      });
      if (res.success) ok++;
      else errors.push(res.error || `Failed for course ${courseIds[i]}`);
      setCreateProgress({ done: i + 1, total: courseIds.length });
    }
    setCreateLoading(false);
    setCreateProgress({ done: 0, total: 0 });
    if (ok > 0) {
      toast.success(`${ok} course(s) assigned to bundle`);
      setCreateOpen(false);
      load();
      refreshSummary();
    }
    if (errors.length > 0) {
      toast.error(`${errors.length} failed: ${errors[0]}`);
    }
  }

  /* ── Edit dialog ── */
  function openEdit(item: BundleCourse) {
    setEditing(item);
    setEditOpen(true);
  }

  async function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = {};
    payload.bundle_id = Number(fd.get('bundle_id')) || editing.bundle_id;
    payload.course_id = Number(fd.get('course_id')) || editing.course_id;
    payload.display_order = Number(fd.get('display_order')) || 0;
    payload.is_active = fd.get('is_active') === 'on';
    const res = await api.updateBundleCourse(editing.id, payload);
    if (res.success) {
      toast.success('Updated');
      setEditOpen(false);
      load();
      refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: BundleCourse) {
    if (!confirm('Move this link to trash?')) return;
    setActionLoadingId(item.id);
    const res = await api.deleteBundleCourse(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: BundleCourse) {
    setActionLoadingId(item.id);
    const res = await api.restoreBundleCourse(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: BundleCourse) {
    if (!confirm('PERMANENTLY delete this link? This cannot be undone.')) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteBundleCourse(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: BundleCourse) {
    const res = await api.updateBundleCourse(item.id, { is_active: !item.is_active });
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  // Bulk helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} link(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteBundleCourse(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} link(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} link(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreBundleCourse(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} link(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} link(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteBundleCourse(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} link(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  const selectClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Bundle Courses" description="Assign courses to bundles (many-to-many)"
        actions={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Assign course</Button> : undefined} />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Links', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button onClick={() => setShowTrash(false)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Links
        </button>
        <button onClick={() => setShowTrash(true)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search bundle courses...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterBundle} onChange={e => setFilterBundle(e.target.value)}>
              <option value="">All bundles</option>
              {bundles.map(b => <option key={b.id} value={b.id}>{b.name || b.code}</option>)}
            </select>
            <select className={selectClass} value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
              <option value="">All courses</option>
              {visibleCourses.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
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
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : Link2} title={showTrash ? 'Trash is empty' : 'No bundle course links yet'} description={showTrash ? 'Deleted links will appear here' : 'Start by assigning courses to bundles'}
          action={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Assign course</Button> : undefined} />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore</Button>
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
                <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH>Bundle</TH>
                <TH>Course</TH>
                {!showTrash && <TH><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Display Order <SortIcon field="display_order" /></button></TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Active <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(item => (
                <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                  <TD className="py-2.5">{item.bundles ? <Badge variant="info">{item.bundles.name || item.bundles.code}</Badge> : <span className="text-slate-300">--</span>}</TD>
                  <TD className="py-2.5">{item.courses ? <span className="font-medium text-slate-900">{item.courses.name || item.courses.code}</span> : <span className="text-slate-300">--</span>}</TD>
                  {!showTrash && <TD className="py-2.5"><span className="text-sm text-slate-600">{item.display_order}</span></TD>}
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '--'}</span></TD>}
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
                          <button onClick={() => setViewing(item)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => setPageSize(s)} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Bundle Course Link" size="md">
        {viewing && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{viewing.bundles?.name || viewing.bundles?.code || `Bundle #${viewing.bundle_id}`}</Badge>
              <span className="text-slate-400">&rarr;</span>
              <Badge variant="muted">{viewing.courses?.name || viewing.courses?.code || `Course #${viewing.course_id}`}</Badge>
              <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Display Order</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{viewing.display_order}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{viewing.is_active ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Created</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Updated</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{viewing.updated_at ? fromNow(viewing.updated_at) : '--'}</dd>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create Dialog (Multi-select) ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Assign Courses to Bundle" size="lg">
        <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
          {/* Bundle selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bundle</label>
            <select
              className={cn(selectClass, 'w-full')}
              value={createBundleId}
              onChange={e => {
                const val = e.target.value ? Number(e.target.value) : '';
                setCreateBundleId(val);
                setCreateSelectedCourses(new Set());
                if (val) loadAssignedCourses(val as number);
                else setAssignedCourseIds(new Set());
              }}
              required
            >
              <option value="">Select a bundle...</option>
              {bundles.map(b => <option key={b.id} value={b.id}>{b.name || b.code}</option>)}
            </select>
          </div>

          {/* Course multi-select with checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                Courses {createSelectedCourses.size > 0 && <span className="text-brand-600 font-semibold">({createSelectedCourses.size} selected)</span>}
              </label>
              {createBundleId && (
                <button type="button" onClick={selectAllFilteredCourses} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                  {getFilteredCourses().filter(c => !assignedCourseIds.has(c.id)).every(c => createSelectedCourses.has(c.id)) ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {/* Search within courses */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search courses..."
                value={courseSearch}
                onChange={e => setCourseSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Course checklist */}
            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-slate-100">
              {!createBundleId ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">Select a bundle first</div>
              ) : getFilteredCourses().length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-400">No courses match your search</div>
              ) : (
                getFilteredCourses().map(c => {
                  const isAssigned = assignedCourseIds.has(c.id);
                  const isSelected = createSelectedCourses.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                        isAssigned ? 'bg-slate-50 opacity-60 cursor-not-allowed' : isSelected ? 'bg-brand-50/50' : 'hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isAssigned || isSelected}
                        disabled={isAssigned}
                        onChange={() => !isAssigned && toggleCourseSelection(c.id)}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                      />
                      <div className="flex-1 min-w-0">
                        <span className={cn('text-sm font-medium truncate', isAssigned ? 'text-slate-400 line-through' : 'text-slate-800')}>{c.name || c.code}</span>
                      </div>
                      {isAssigned && (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Assigned
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
            {assignedCourseIds.size > 0 && (
              <p className="text-xs text-slate-400 mt-1">{assignedCourseIds.size} course(s) already assigned to this bundle</p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={createIsActive}
              onChange={e => setCreateIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>

          {/* Progress bar during creation */}
          {createLoading && createProgress.total > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Assigning courses...</span>
                <span>{createProgress.done}/{createProgress.total}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${(createProgress.done / createProgress.total) * 100}%` }} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>Cancel</Button>
            <Button type="submit" disabled={createLoading || createSelectedCourses.size === 0}>
              {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Assign {createSelectedCourses.size > 0 ? `${createSelectedCourses.size} course(s)` : 'courses'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit Bundle Course Link" size="sm">
        {editing && (
          <form onSubmit={onEditSubmit} className="p-6 space-y-4">
            {/* Status toggle */}
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'Currently active' : 'Currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getBundleCourse(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bundle</label>
              <select name="bundle_id" defaultValue={editing.bundle_id} className={cn(selectClass, 'w-full')}>
                {bundles.map(b => <option key={b.id} value={b.id}>{b.name || b.code}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
              <select name="course_id" defaultValue={editing.course_id} className={cn(selectClass, 'w-full')}>
                {visibleCourses.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
              <input type="number" name="display_order" defaultValue={editing.display_order ?? 0} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            {/* Hidden checkbox for is_active so form data captures it */}
            <input type="hidden" name="is_active" value="off" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_active" defaultChecked={editing.is_active} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit">Save changes</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
