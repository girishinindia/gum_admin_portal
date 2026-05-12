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
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Video, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, ExternalLink, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

interface CapstoneProject {
  id: number;
  slug: string;
  course_id: number;
  [key: string]: any;
}

interface CapstoneProjectSolution {
  id: number;
  capstone_project_id: number;
  video_title: string;
  description: string | null;
  video: string | null;
  video_thumbnail: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  assesment_capstone_projects?: { slug: string; course_id: number } | null;
  [key: string]: any;
}

type SortField = 'id' | 'video_title' | 'display_order' | 'is_active' | 'created_at';

export default function CapstoneProjectSolutionsPage() {
  const [items, setItems] = useState<CapstoneProjectSolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CapstoneProjectSolution | null>(null);
  const [viewing, setViewing] = useState<CapstoneProjectSolution | null>(null);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  const [capstoneProjects, setCapstoneProjects] = useState<CapstoneProject[]>([]);
  const [filterProject, setFilterProject] = useState('');
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

  const { register, handleSubmit, reset } = useForm();

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
  ]);

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    api.getTableSummary('assesment_capstone_projects_solution').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    api.listCapstoneProjects('?limit=500').then(res => {
      if (res.success) setCapstoneProjects(res.data || []);
    });
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterProject, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, filterProject, filterStatus, sortField, sortOrder, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField); qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterProject) qs.set('capstone_project_id', filterProject);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listCapstoneProjectSolutions('?' + qs.toString());
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('assesment_capstone_projects_solution');
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
    setEditing(null);
    reset({ capstone_project_id: '', video_title: '', description: '', video_url: '', thumbnail_url: '', display_order: 0, is_active: true });
    setDialogOpen(true);
  }

  function openEdit(d: CapstoneProjectSolution) {
    setEditing(d);
    reset({
      capstone_project_id: d.capstone_project_id,
      video_title: d.video_title || '',
      description: d.description || '',
      video_url: d.video || '',
      thumbnail_url: d.video_thumbnail || '',
      display_order: d.display_order || 0,
      is_active: d.is_active,
    });
    setDialogOpen(true);
  }

  function openView(d: CapstoneProjectSolution) { setViewing(d); }

  async function onSubmit(data: any) {
    const payload: any = {
      capstone_project_id: parseInt(data.capstone_project_id) || 0,
      video_title: data.video_title,
      description: data.description || null,
      video: data.video_url || null,
      video_thumbnail: data.thumbnail_url || null,
      display_order: parseInt(data.display_order) || 0,
      is_active: data.is_active === true || data.is_active === 'true',
    };
    const res = editing
      ? await api.updateCapstoneProjectSolution(editing.id, payload)
      : await api.createCapstoneProjectSolution(payload);
    if (res.success) {
      toast.success(editing ? 'Solution updated' : 'Solution created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(d: CapstoneProjectSolution) {
    if (!confirm(`Move "${d.video_title}" to trash? You can restore it later.`)) return;
    setActionLoadingId(d.id);
    const res = await api.softDeleteCapstoneProjectSolution(d.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Solution moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(d: CapstoneProjectSolution) {
    setActionLoadingId(d.id);
    const res = await api.restoreCapstoneProjectSolution(d.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${d.video_title}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(d: CapstoneProjectSolution) {
    if (!confirm(`PERMANENTLY delete "${d.video_title}"? This cannot be undone.`)) return;
    setActionLoadingId(d.id);
    const res = await api.deleteCapstoneProjectSolution(d.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Solution permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(d: CapstoneProjectSolution) {
    const res = await api.updateCapstoneProjectSolution(d.id, { is_active: !d.is_active });
    if (res.success) { toast.success(`${!d.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length && items.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(d => d.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Move ${selectedIds.size} solution(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let succeeded = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteCapstoneProjectSolution(ids[i]);
      if (res.success) succeeded++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    toast.success(`${succeeded} solution(s) moved to trash`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let succeeded = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreCapstoneProjectSolution(ids[i]);
      if (res.success) succeeded++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    toast.success(`${succeeded} solution(s) restored`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  async function handleBulkPermanentDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} solution(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let succeeded = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteCapstoneProjectSolution(ids[i]);
      if (res.success) succeeded++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    toast.success(`${succeeded} solution(s) permanently deleted`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  function getProjectName(id: number): string {
    const p = capstoneProjects.find(cp => cp.id === id);
    return p ? p.slug : `#${id}`;
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Capstone Project Solutions" description="Manage solution videos for capstone projects"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add solution</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Solutions', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Solutions
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search solutions...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="">All Projects</option>
              {capstoneProjects.map(cp => <option key={cp.id} value={String(cp.id)}>{cp.slug}</option>)}
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
        <EmptyState icon={showTrash ? Trash2 : Video} title={showTrash ? 'Trash is empty' : 'No solutions yet'}
          description={showTrash ? 'No deleted solutions' : (searchDebounce || filterProject || filterStatus ? 'No solutions match your filters' : 'Add your first capstone project solution')}
          action={!showTrash && !searchDebounce && !filterProject && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add solution</Button> : undefined} />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-brand-50 border-b border-brand-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              </div>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading} className="text-red-600 border-red-200 hover:bg-red-50">
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleBulkSoftDelete} disabled={bulkActionLoading} className="text-red-600 border-red-200 hover:bg-red-50">
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Move to Trash
                  </Button>
                )}
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkActionLoading}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-white transition-colors disabled:opacity-50"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-12 px-3">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH><button onClick={() => handleSort('video_title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Video Title <SortIcon field="video_title" /></button></TH>
                <TH>Capstone Project</TH>
                <TH>Video URL</TH>
                <TH><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Order <SortIcon field="display_order" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH><button onClick={() => handleSort('created_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Created <SortIcon field="created_at" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(d => (
                <TR key={d.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(d.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{d.id}</span></TD>
                  <TD className="py-2.5"><span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{d.video_title || '—'}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{getProjectName(d.capstone_project_id)}</span></TD>
                  <TD className="py-2.5">
                    {d.video ? (
                      <a href={d.video} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 hover:underline">
                        <ExternalLink className="w-3 h-3" /> Link
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD className="py-2.5"><span className="text-slate-600">{d.display_order}</span></TD>
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{d.deleted_at ? fromNow(d.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={d.is_active ? 'success' : 'danger'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
                    )}
                  </TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-500">{fromNow(d.created_at)}</span></TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(d)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(d)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(d)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(d)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">{actionLoadingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Solution Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0"><Video className="w-5 h-5 text-indigo-600" /></div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.video_title || 'Untitled'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Capstone Project" value={getProjectName(viewing.capstone_project_id)} />
              <DetailRow label="Display Order" value={String(viewing.display_order)} />
              <DetailRow label="Description" value={viewing.description} />
              <DetailRow label="Video URL" value={viewing.video} />
              <DetailRow label="Thumbnail URL" value={viewing.video_thumbnail} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Solution' : 'Add Solution'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">{editing.is_active ? 'This solution is currently active' : 'This solution is currently inactive'}</p>
              </div>
              <button type="button" onClick={async () => { await onToggleActive(editing); const r = await api.getCapstoneProjectSolution(editing.id); if (r.success && r.data) setEditing(r.data); }}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer', editing.is_active ? 'bg-emerald-500' : 'bg-slate-300')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Capstone Project</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('capstone_project_id', { required: true })}>
              <option value="">Select a project...</option>
              {capstoneProjects.map(cp => <option key={cp.id} value={cp.id}>{cp.slug}</option>)}
            </select>
          </div>
          <Input label="Video Title" placeholder="Solution walkthrough" {...register('video_title', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" rows={2} placeholder="Brief description..." {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Video URL" placeholder="https://..." {...register('video_url')} />
            <Input label="Thumbnail URL" placeholder="https://..." {...register('thumbnail_url')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Display Order" type="number" min={0} {...register('display_order')} />
            {!editing && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Active</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('is_active')}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            )}
          </div>
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
