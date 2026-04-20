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
import { AiMasterDialog } from '@/components/ui/AiMasterDialog';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, GraduationCap, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Sparkles, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { EducationLevel } from '@/lib/types';

const CATEGORIES = [
  { value: 'pre_school',     label: 'Pre-School' },
  { value: 'school',         label: 'School' },
  { value: 'diploma',        label: 'Diploma' },
  { value: 'undergraduate',  label: 'Undergraduate' },
  { value: 'postgraduate',   label: 'Postgraduate' },
  { value: 'doctoral',       label: 'Doctoral' },
  { value: 'professional',   label: 'Professional' },
  { value: 'informal',       label: 'Informal' },
  { value: 'other',          label: 'Other' },
];

type SortField = 'id' | 'name' | 'abbreviation' | 'level_category' | 'level_order' | 'is_active';

export default function EducationLevelsPage() {
  const [levels, setLevels] = useState<EducationLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EducationLevel | null>(null);
  const [viewing, setViewing] = useState<EducationLevel | null>(null);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  // Pagination, search, sort, filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Soft delete: toggle between active list and trash
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [aiOpen, setAiOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('education_levels').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterCategory, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, filterCategory, filterStatus, sortField, sortOrder, showTrash]);

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
      if (filterCategory) qs.set('level_category', filterCategory);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listEducationLevels('?' + qs.toString());
    if (res.success) {
      setLevels(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('education_levels');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
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

  function openCreate() {
    setEditing(null);
    reset({ name: '', abbreviation: '', level_order: 0, level_category: 'other', description: '' });
    setDialogOpen(true);
  }

  function openEdit(l: EducationLevel) {
    setEditing(l);
    reset({
      name: l.name, abbreviation: l.abbreviation || '', level_order: l.level_order,
      level_category: l.level_category, description: l.description || '',
    });
    setDialogOpen(true);
  }

  function openView(l: EducationLevel) {
    setViewing(l);
  }

  async function onSubmit(data: any) {
    const payload = {
      ...data,
      level_order: parseInt(data.level_order) || 0,
    };

    const res = editing
      ? await api.updateEducationLevel(editing.id, payload)
      : await api.createEducationLevel(payload);

    if (res.success) {
      toast.success(editing ? 'Education level updated' : 'Education level created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(l: EducationLevel) {
    if (!confirm(`Move "${l.name}" to trash? You can restore it later.`)) return;
    setActionLoadingId(l.id);
    const res = await api.deleteEducationLevel(l.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Education level moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(l: EducationLevel) {
    setActionLoadingId(l.id);
    const res = await api.restoreEducationLevel(l.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${l.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(l: EducationLevel) {
    if (!confirm(`PERMANENTLY delete "${l.name}"? This cannot be undone.`)) return;
    setActionLoadingId(l.id);
    const res = await api.permanentDeleteEducationLevel(l.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Education level permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(l: EducationLevel) {
    const res = await api.updateEducationLevel(l.id, { is_active: !l.is_active });
    if (res.success) { toast.success(`${!l.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  function toggleSelectAll() {
    if (selectedIds.size === levels.length && levels.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(levels.map(l => l.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Move ${selectedIds.size} education level(s) to trash? You can restore them later.`)) return;

    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let success = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteEducationLevel(ids[i]);
      if (res.success) success++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });

    if (success === selectedIds.size) {
      toast.success(`${success} education level(s) moved to trash`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    } else {
      toast.error(`Failed to move ${selectedIds.size - success} item(s)`);
      load();
      refreshSummary();
    }
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Restore ${selectedIds.size} education level(s)?`)) return;

    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let success = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreEducationLevel(ids[i]);
      if (res.success) success++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });

    if (success === selectedIds.size) {
      toast.success(`${success} education level(s) restored`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    } else {
      toast.error(`Failed to restore ${selectedIds.size - success} item(s)`);
      load();
      refreshSummary();
    }
  }

  async function handleBulkPermanentDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} education level(s)? This cannot be undone.`)) return;

    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let success = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteEducationLevel(ids[i]);
      if (res.success) success++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });

    if (success === selectedIds.size) {
      toast.success(`${success} education level(s) permanently deleted`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    } else {
      toast.error(`Failed to delete ${selectedIds.size - success} item(s)`);
      load();
      refreshSummary();
    }
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Education Levels"
        description="Manage education levels and qualifications"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add level</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Education Levels', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Education Levels
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search education levels...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
      ) : levels.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : GraduationCap}
          title={showTrash ? 'Trash is empty' : 'No education levels yet'}
          description={showTrash ? 'No deleted education levels' : (searchDebounce || filterCategory || filterStatus ? 'No education levels match your filters' : 'Add your first education level')}
          action={!showTrash && !searchDebounce && !filterCategory && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add level</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (
            <div className={cn('border-b px-4 py-3 flex items-center justify-between', showTrash ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200')}>
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-medium', showTrash ? 'text-amber-700' : 'text-blue-700')}>
                  {bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkRestore}
                      disabled={bulkActionLoading}
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
                      Restore Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkPermanentDelete}
                      disabled={bulkActionLoading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                      Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkSoftDelete}
                    disabled={bulkActionLoading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                    Move to Trash
                  </Button>
                )}
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkActionLoading}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
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
                <TH className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === levels.length && levels.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH>
                  <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Name <SortIcon field="name" />
                  </button>
                </TH>
                {!showTrash && (
                  <>
                    <TH>
                      <button onClick={() => handleSort('abbreviation')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                        Abbreviation <SortIcon field="abbreviation" />
                      </button>
                    </TH>
                    <TH>
                      <button onClick={() => handleSort('level_category')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                        Category <SortIcon field="level_category" />
                      </button>
                    </TH>
                    <TH>
                      <button onClick={() => handleSort('level_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                        Level Order <SortIcon field="level_order" />
                      </button>
                    </TH>
                  </>
                )}
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
              {levels.map(l => (
                <TR
                  key={l.id}
                  className={cn(
                    selectedIds.has(l.id) ? (showTrash ? 'bg-amber-100/50' : 'bg-blue-100/30') : (showTrash ? 'bg-amber-50/30' : undefined),
                    'hover:bg-opacity-75'
                  )}
                >
                  <TD className="py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(l.id)}
                      onChange={() => toggleSelect(l.id)}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{l.id}</span></TD>
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{l.name}</span>
                  </TD>
                  {!showTrash && (
                    <>
                      <TD className="py-2.5">
                        <span className="font-mono text-xs text-slate-600">{l.abbreviation || '—'}</span>
                      </TD>
                      <TD className="py-2.5">
                        <Badge variant="info">
                          {CATEGORIES.find(c => c.value === l.level_category)?.label || l.level_category}
                        </Badge>
                      </TD>
                      <TD className="py-2.5">
                        <span className="text-slate-600">{l.level_order}</span>
                      </TD>
                    </>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{l.deleted_at ? fromNow(l.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={l.is_active ? 'success' : 'danger'}>
                        {l.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(l)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(l)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(l)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(l)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onSoftDelete(l)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            total={total}
            showingCount={levels.length}
          />
        </div>
      )}

      {/* ── View Education Level Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Education Level Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {viewing.abbreviation && <Badge variant="muted" className="font-mono">{viewing.abbreviation}</Badge>}
                  <Badge variant="info">
                    {CATEGORIES.find(c => c.value === viewing.level_category)?.label || viewing.level_category}
                  </Badge>
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Abbreviation" value={viewing.abbreviation} />
              <DetailRow label="Category" value={CATEGORIES.find(c => c.value === viewing.level_category)?.label || viewing.level_category} />
              <DetailRow label="Level Order" value={String(viewing.level_order)} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order)} />
              <DetailRow label="Description" value={viewing.description} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            </div>

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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Education Level' : 'Add Education Level'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This education level is currently active' : 'This education level is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getEducationLevel(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  editing.is_active ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="Bachelor of Technology" {...register('name', { required: true })} />
            <Input label="Abbreviation" placeholder="B.Tech" {...register('abbreviation')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('level_category', { required: true })}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <Input label="Level Order" type="number" placeholder="1" {...register('level_order')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={2}
              placeholder="Brief description..."
              {...register('description')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create level'}</Button>
          </div>
        </form>
      </Dialog>
      <AiMasterDialog module="education_levels" moduleLabel="Education Levels" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createEducationLevel(item)} updateFn={(id, item) => api.updateEducationLevel(id, item)} defaultPrompt="Generate Indian education levels in this exact order: PRE_SCHOOL — Nursery (level_order=1), LKG (2), UKG (3). SCHOOL — Primary School class 1-5 (4), Middle School 6-8 (5), Secondary SSC 9-10 (6), Higher Secondary HSC 11-12 (7), Senior Secondary Science HSC-Sci (8), Commerce HSC-Com (9), Arts HSC-Arts (10). DIPLOMA — ITI Certificate (11), Polytechnic Diploma (12), Diploma (13), Advanced Diploma (14). UNDERGRADUATE — Associate Degree (15), B.A. (16), B.Sc. (17), B.Com. (18), B.Tech. (19), B.E. (20), BBA (21), BCA (22), B.Des. (23), LL.B. (24), MBBS (25), BDS (26), B.Pharm. (27), B.Ed. (28), BFA (29), B.Arch. (30). POSTGRADUATE — PG Diploma (31), M.A. (32), M.Sc. (33), M.Com. (34), M.Tech. (35), MBA (36), MCA (37), M.Des. (38), LL.M. (39), M.Ed. (40), MPH (41), MSW (42). DOCTORAL — M.Phil. (43), Ph.D. (44), M.D. (45), M.S. Surgery (46), D.Sc. (47), Post-Doctoral (48). PROFESSIONAL — CA (49), CS (50), CMA (51), CFA (52), Bar Council (53), Medical Council (54), Professional Cert (55). INFORMAL — Online Course/MOOC (56), Bootcamp (57), Self-Taught (58), Apprenticeship (59). OTHER — No Formal Education (60). Fields: name, abbreviation (null if none), level_order, level_category, description, is_active=true, sort_order=level_order." defaultCount={60} listFn={(qs) => api.listEducationLevels(qs)} onSaved={() => { load(); refreshSummary(); }} />
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
