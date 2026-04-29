"use client";
import { useEffect, useState, useRef, useMemo } from 'react';
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
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Tags, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Loader2, Star, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { CourseSubCategory, Category, SubCategory } from '@/lib/types';

/* ── Local types for dropdowns ── */
interface CourseOption { id: number; code: string; slug: string; name?: string; is_active: boolean; }

type SortField = 'id' | 'display_order' | 'sort_order' | 'is_active';

export default function CourseSubCategoriesPage() {
  const [items, setItems] = useState<CourseSubCategory[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);

  // Dialogs
  const [assignOpen, setAssignOpen] = useState(false);
  const [editing, setEditing] = useState<CourseSubCategory | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [viewing, setViewing] = useState<CourseSubCategory | null>(null);

  // Assign dialog state
  const [assignCourseId, setAssignCourseId] = useState<number | ''>('');
  const [selectedSubCatIds, setSelectedSubCatIds] = useState<Set<number>>(new Set());
  const [primarySubCatId, setPrimarySubCatId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set());
  const [catSearch, setCatSearch] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [existingLinks, setExistingLinks] = useState<CourseSubCategory[]>([]);

  // Pagination, search, sort, filters
  const [filterCourse, setFilterCourse] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPrimary, setFilterPrimary] = useState('');
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

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openAssign(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g c', action: () => router.push('/courses') },
  ]);

  // Load dropdowns on mount
  useEffect(() => {
    api.listCourses('?limit=500&sort=code&ascending=true').then(res => { if (res.success) setCourses((res.data || []).filter((c: CourseOption) => c.is_active)); });
    api.listCategories('?limit=500&sort=display_order&ascending=true').then(res => { if (res.success) setCategories(res.data || []); });
    api.listSubCategories('?limit=500&sort=display_order&ascending=true').then(res => { if (res.success) setSubCategories(res.data || []); });
    refreshSummary();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterCourse, filterSubCategory, filterStatus, filterPrimary, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterCourse, filterSubCategory, filterStatus, filterPrimary, sortField, sortOrder, pageSize, showTrash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSummary() {
    const res = await api.getTableSummary('course_sub_categories');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterCourse) qs.set('course_id', filterCourse);
      if (filterSubCategory) qs.set('sub_category_id', filterSubCategory);
      if (filterStatus) qs.set('is_active', filterStatus);
      if (filterPrimary) qs.set('is_primary', filterPrimary);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listCourseSubCategories('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  /* ── Assign Dialog (checkboxes) ── */
  async function openAssign() {
    setAssignCourseId('');
    setSelectedSubCatIds(new Set());
    setPrimarySubCatId(null);
    setExpandedCategories(new Set(categories.map(c => c.id)));
    setCatSearch('');
    setExistingLinks([]);
    setAssignOpen(true);
  }

  // When course changes, load its existing links
  async function onAssignCourseChange(courseId: number | '') {
    setAssignCourseId(courseId);
    if (!courseId) { setExistingLinks([]); setSelectedSubCatIds(new Set()); setPrimarySubCatId(null); return; }
    const res = await api.listCourseSubCategories(`?course_id=${courseId}&limit=500`);
    const links: CourseSubCategory[] = res.success ? (res.data || []) : [];
    setExistingLinks(links);
    setSelectedSubCatIds(new Set(links.map(l => l.sub_category_id)));
    const primary = links.find(l => l.is_primary);
    setPrimarySubCatId(primary ? primary.sub_category_id : null);
  }

  function toggleSubCat(scId: number) {
    setSelectedSubCatIds(prev => {
      const next = new Set(prev);
      if (next.has(scId)) {
        next.delete(scId);
        if (primarySubCatId === scId) setPrimarySubCatId(null);
      } else {
        next.add(scId);
      }
      return next;
    });
  }

  function toggleCategory(catId: number) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  }

  // Select/deselect all sub-cats in a category
  function toggleCategorySubCats(catId: number) {
    const catSubCats = activeSubCategories.filter(sc => sc.category_id === catId);
    const allSelected = catSubCats.every(sc => selectedSubCatIds.has(sc.id));
    setSelectedSubCatIds(prev => {
      const next = new Set(prev);
      catSubCats.forEach(sc => { allSelected ? next.delete(sc.id) : next.add(sc.id); });
      return next;
    });
  }

  const activeCategories = useMemo(() => categories.filter(c => c.is_active), [categories]);
  const activeSubCategories = useMemo(() => subCategories.filter(sc => sc.is_active), [subCategories]);

  // Filter categories/sub-cats by search
  const filteredCategories = useMemo(() => {
    if (!catSearch.trim()) return activeCategories;
    const q = catSearch.toLowerCase();
    return activeCategories.filter(cat => {
      const catMatch = (cat.english_name || cat.code).toLowerCase().includes(q);
      const hasMatchingSub = activeSubCategories.some(sc => sc.category_id === cat.id && (sc.english_name || sc.code).toLowerCase().includes(q));
      return catMatch || hasMatchingSub;
    });
  }, [activeCategories, activeSubCategories, catSearch]);

  async function handleAssignSubmit() {
    if (!assignCourseId) { toast.error('Please select a course'); return; }
    setAssignLoading(true);

    const existingSubCatIds = new Set(existingLinks.map(l => l.sub_category_id));
    const toCreate = [...selectedSubCatIds].filter(id => !existingSubCatIds.has(id));
    const toDelete = existingLinks.filter(l => !selectedSubCatIds.has(l.sub_category_id));

    // Update primary flag on existing links
    const toUpdatePrimary = existingLinks.filter(l =>
      selectedSubCatIds.has(l.sub_category_id) && l.is_primary !== (l.sub_category_id === primarySubCatId)
    );

    let ok = 0;
    let fail = 0;

    // Create new links
    for (const scId of toCreate) {
      const res = await api.createCourseSubCategory({
        course_id: assignCourseId,
        sub_category_id: scId,
        is_primary: scId === primarySubCatId,
        is_active: true,
        display_order: 0,
        sort_order: 0,
      });
      if (res.success) ok++; else fail++;
    }

    // Delete removed links (soft delete)
    for (const link of toDelete) {
      const res = await api.deleteCourseSubCategory(link.id);
      if (res.success) ok++; else fail++;
    }

    // Update primary flag
    for (const link of toUpdatePrimary) {
      await api.updateCourseSubCategory(link.id, { is_primary: link.sub_category_id === primarySubCatId });
    }

    setAssignLoading(false);
    if (fail === 0) {
      toast.success(`Updated: ${toCreate.length} added, ${toDelete.length} removed`);
    } else {
      toast.error(`${fail} operation(s) failed`);
    }
    setAssignOpen(false);
    load();
    refreshSummary();
  }

  /* ── Edit dialog (single link) ── */
  function openEdit(item: CourseSubCategory) {
    setEditing(item);
    setEditOpen(true);
  }

  async function onEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = {};
    payload.is_primary = fd.get('is_primary') === 'on';
    payload.display_order = Number(fd.get('display_order')) || 0;
    payload.sort_order = Number(fd.get('sort_order')) || 0;
    const res = await api.updateCourseSubCategory(editing.id, payload);
    if (res.success) {
      toast.success('Updated');
      setEditOpen(false);
      load();
      refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: CourseSubCategory) {
    if (!confirm('Move this link to trash?')) return;
    setActionLoadingId(item.id);
    const res = await api.deleteCourseSubCategory(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: CourseSubCategory) {
    setActionLoadingId(item.id);
    const res = await api.restoreCourseSubCategory(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: CourseSubCategory) {
    if (!confirm('PERMANENTLY delete this link? This cannot be undone.')) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteCourseSubCategory(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: CourseSubCategory) {
    const res = await api.updateCourseSubCategory(item.id, { is_active: !item.is_active });
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
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteCourseSubCategory(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} link(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} link(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreCourseSubCategory(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} link(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} link(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteCourseSubCategory(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
      <PageHeader title="Course Categories" description="Assign sub-categories to courses (many-to-many)"
        actions={!showTrash ? <Button onClick={openAssign}><Plus className="w-4 h-4" /> Assign Categories</Button> : undefined} />

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

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search links...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
              <option value="">All courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
            </select>
            <select className={selectClass} value={filterSubCategory} onChange={e => setFilterSubCategory(e.target.value)}>
              <option value="">All sub-categories</option>
              {subCategories.filter(sc => sc.is_active).map(sc => <option key={sc.id} value={sc.id}>{sc.english_name || sc.code}</option>)}
            </select>
            <select className={selectClass} value={filterPrimary} onChange={e => setFilterPrimary(e.target.value)}>
              <option value="">All</option>
              <option value="true">Primary</option>
              <option value="false">Not Primary</option>
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
        <EmptyState icon={showTrash ? Trash2 : Tags} title={showTrash ? 'Trash is empty' : 'No course category links yet'} description={showTrash ? 'Deleted links will appear here' : 'Start by assigning sub-categories to courses'}
          action={!showTrash ? <Button onClick={openAssign}><Plus className="w-4 h-4" /> Assign Categories</Button> : undefined} />
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
                <TH>Course</TH>
                <TH>Sub-Category</TH>
                <TH>Category</TH>
                <TH>Primary</TH>
                <TH><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Order <SortIcon field="display_order" /></button></TH>
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
                  <TD className="py-2.5">{item.courses ? <Badge variant="info">{item.courses.name || item.courses.code}</Badge> : <span className="text-slate-300">--</span>}</TD>
                  <TD className="py-2.5">{item.sub_categories ? <span className="font-medium text-slate-900">{item.sub_categories.name || item.sub_categories.code}</span> : <span className="text-slate-300">--</span>}</TD>
                  <TD className="py-2.5">{item.sub_categories?.categories ? <Badge variant="muted">{item.sub_categories.categories.name || item.sub_categories.categories.code}</Badge> : <span className="text-slate-300">--</span>}</TD>
                  <TD className="py-2.5">
                    {item.is_primary ? <Badge variant="warning"><Star className="w-3 h-3" /> Primary</Badge> : <span className="text-slate-300">--</span>}
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{item.display_order}</span></TD>
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Course Category Link" size="md">
        {viewing && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{viewing.courses?.name || viewing.courses?.code || `Course #${viewing.course_id}`}</Badge>
              <span className="text-slate-400">&rarr;</span>
              <Badge variant="muted">{viewing.sub_categories?.name || viewing.sub_categories?.code || `SubCat #${viewing.sub_category_id}`}</Badge>
              {viewing.sub_categories?.categories && (
                <>
                  <span className="text-slate-300 text-xs">in</span>
                  <Badge variant="muted">{viewing.sub_categories.categories.name || viewing.sub_categories.categories.code}</Badge>
                </>
              )}
              {viewing.is_primary && <Badge variant="warning"><Star className="w-3 h-3" /> Primary</Badge>}
              <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Display Order</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{viewing.display_order}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sort Order</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{viewing.sort_order}</dd>
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

      {/* ── Assign Categories Dialog (checkbox tree) ── */}
      <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Categories to Course" size="lg">
        <div className="p-6 space-y-4">
          {/* Course selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Select Course</label>
            <select
              className={cn(selectClass, 'w-full')}
              value={assignCourseId}
              onChange={e => onAssignCourseChange(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select a course...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
            </select>
          </div>

          {assignCourseId && (
            <>
              {/* Search sub-categories */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search categories or sub-categories..."
                  value={catSearch}
                  onChange={e => setCatSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Selection summary */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {selectedSubCatIds.size} sub-categor{selectedSubCatIds.size === 1 ? 'y' : 'ies'} selected
                  {primarySubCatId && <span className="ml-2 text-amber-600">(1 primary)</span>}
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setSelectedSubCatIds(new Set(activeSubCategories.map(sc => sc.id))); }} className="text-xs text-brand-600 hover:underline">Select all</button>
                  <button type="button" onClick={() => { setSelectedSubCatIds(new Set()); setPrimarySubCatId(null); }} className="text-xs text-slate-500 hover:underline">Clear all</button>
                </div>
              </div>

              {/* Category + Sub-category checkbox tree */}
              <div className="border border-slate-200 rounded-lg max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                {filteredCategories.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-400">No categories found</div>
                ) : (
                  filteredCategories.map(cat => {
                    const catSubs = activeSubCategories.filter(sc => sc.category_id === cat.id);
                    if (catSubs.length === 0) return null;
                    const expanded = expandedCategories.has(cat.id);
                    const selectedCount = catSubs.filter(sc => selectedSubCatIds.has(sc.id)).length;
                    const allSelected = selectedCount === catSubs.length;
                    const someSelected = selectedCount > 0 && !allSelected;

                    return (
                      <div key={cat.id}>
                        {/* Category header */}
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                          <button type="button" onClick={() => toggleCategory(cat.id)} className="p-0.5 rounded hover:bg-slate-200 transition-colors">
                            {expanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                          </button>
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected; }}
                            onChange={() => toggleCategorySubCats(cat.id)}
                            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                          />
                          <span className="text-sm font-semibold text-slate-700 flex-1">{cat.english_name || cat.code}</span>
                          <span className="text-xs text-slate-400">
                            {selectedCount}/{catSubs.length}
                          </span>
                        </div>

                        {/* Sub-categories */}
                        {expanded && (
                          <div className="py-1">
                            {catSubs.map(sc => {
                              const isChecked = selectedSubCatIds.has(sc.id);
                              const isPrimary = primarySubCatId === sc.id;
                              const existingLink = existingLinks.find(l => l.sub_category_id === sc.id);
                              return (
                                <div key={sc.id} className={cn(
                                  'flex items-center gap-3 px-4 pl-11 py-2 hover:bg-slate-50 transition-colors',
                                  isPrimary && 'bg-amber-50/50'
                                )}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSubCat(sc.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                  />
                                  <span className={cn('text-sm flex-1', isChecked ? 'text-slate-900' : 'text-slate-500')}>
                                    {sc.english_name || sc.code}
                                  </span>
                                  {isChecked && (
                                    <button
                                      type="button"
                                      onClick={() => setPrimarySubCatId(isPrimary ? null : sc.id)}
                                      className={cn(
                                        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors',
                                        isPrimary
                                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                                          : 'bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-600'
                                      )}
                                      title={isPrimary ? 'Remove primary' : 'Set as primary'}
                                    >
                                      <Star className="w-3 h-3" />
                                      {isPrimary ? 'Primary' : 'Set primary'}
                                    </button>
                                  )}
                                  {existingLink && (
                                    <span className="text-xs text-emerald-500">linked</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAssignSubmit}
              disabled={!assignCourseId || assignLoading}
            >
              {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tags className="w-4 h-4" />}
              Save Assignments
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Edit Single Link Dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit Course Category Link" size="sm">
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
                  const refreshed = await api.getCourseSubCategory(editing.id);
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

            {/* Read-only info */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{editing.courses?.name || editing.courses?.code || `Course #${editing.course_id}`}</Badge>
              <span className="text-slate-400">&rarr;</span>
              <Badge variant="muted">{editing.sub_categories?.name || editing.sub_categories?.code || `SubCat #${editing.sub_category_id}`}</Badge>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="is_primary" defaultChecked={editing.is_primary} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm font-medium text-slate-700">Primary sub-category</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display Order</label>
                <input type="number" name="display_order" defaultValue={editing.display_order ?? 0} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sort Order</label>
                <input type="number" name="sort_order" defaultValue={editing.sort_order ?? 0} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
            </div>

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
