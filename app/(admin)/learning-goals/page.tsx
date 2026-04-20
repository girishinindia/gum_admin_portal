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
import { Plus, Target, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Sparkles, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { LearningGoal } from '@/lib/types';

type SortField = 'id' | 'name' | 'display_order' | 'is_active';

export default function LearningGoalsPage() {
  const [items, setItems] = useState<LearningGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LearningGoal | null>(null);
  const [viewing, setViewing] = useState<LearningGoal | null>(null);

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
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [aiOpen, setAiOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => {
    api.getTableSummary('learning_goals').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, filterStatus, sortField, sortOrder, showTrash]);

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
    const res = await api.listLearningGoals('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('learning_goals');
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

  function openCreate() { setEditing(null); reset({ name: '', description: '', display_order: 0 }); setDialogOpen(true); }
  function openEdit(g: LearningGoal) { setEditing(g); reset({ name: g.name, description: g.description || '', display_order: g.display_order }); setDialogOpen(true); }
  function openView(g: LearningGoal) { setViewing(g); }

  async function onSubmit(data: any) {
    const payload = { ...data, display_order: parseInt(data.display_order) || 0 };
    const res = editing ? await api.updateLearningGoal(editing.id, payload) : await api.createLearningGoal(payload);
    if (res.success) { toast.success(editing ? 'Learning goal updated' : 'Learning goal created'); setDialogOpen(false); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(g: LearningGoal) {
    if (!confirm(`Move "${g.name}" to trash? You can restore it later.`)) return;
    setActionLoadingId(g.id);
    const res = await api.deleteLearningGoal(g.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Learning goal moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(g: LearningGoal) {
    setActionLoadingId(g.id);
    const res = await api.restoreLearningGoal(g.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${g.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(g: LearningGoal) {
    if (!confirm(`PERMANENTLY delete "${g.name}"? This cannot be undone.`)) return;
    setActionLoadingId(g.id);
    const res = await api.permanentDeleteLearningGoal(g.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Learning goal permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(g: LearningGoal) {
    const res = await api.updateLearningGoal(g.id, { is_active: !g.is_active });
    if (res.success) { toast.success(`${!g.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length && items.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(g => g.id)));
  }

  async function handleBulkSoftDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Move ${selectedIds.size} learning goal(s) to trash? You can restore them later.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteLearningGoal(ids[i]);
      if (res.success) successCount++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    if (successCount > 0) { toast.success(`${successCount} learning goal(s) moved to trash`); setSelectedIds(new Set()); load(); refreshSummary(); }
    if (successCount < selectedIds.size) toast.error(`Failed to move ${selectedIds.size - successCount} item(s)`);
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreLearningGoal(ids[i]);
      if (res.success) successCount++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    if (successCount > 0) { toast.success(`${successCount} learning goal(s) restored`); setSelectedIds(new Set()); load(); refreshSummary(); }
    if (successCount < selectedIds.size) toast.error(`Failed to restore ${selectedIds.size - successCount} item(s)`);
  }

  async function handleBulkPermanentDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} learning goal(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteLearningGoal(ids[i]);
      if (res.success) successCount++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    if (successCount > 0) { toast.success(`${successCount} learning goal(s) permanently deleted`); setSelectedIds(new Set()); load(); refreshSummary(); }
    if (successCount < selectedIds.size) toast.error(`Failed to delete ${selectedIds.size - successCount} item(s)`);
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Learning Goals"
        description="Manage learning objectives and goals"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add goal</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Learning Goals', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Learning Goals
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search learning goals...'}
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
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Target}
          title={showTrash ? 'Trash is empty' : 'No learning goals yet'}
          description={showTrash ? 'No deleted learning goals' : (searchDebounce || filterStatus ? 'No learning goals match your filters' : 'Add your first learning goal')}
          action={!showTrash && !searchDebounce && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add goal</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200">
              <span className="text-sm font-medium text-blue-900">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>
                      {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Restore Selected
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleBulkSoftDelete} disabled={bulkActionLoading} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Move to Trash ({selectedIds.size})
                  </Button>
                )}
                <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-12 px-3"><input type="checkbox" checked={selectedIds.size > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-500/20 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH>
                  <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Name <SortIcon field="name" />
                  </button>
                </TH>
                {!showTrash && <TH>Description</TH>}
                <TH><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Display Order <SortIcon field="display_order" /></button></TH>
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
              {items.map(g => (
                <TR key={g.id} className={cn(selectedIds.has(g.id) && 'bg-brand-50/40', showTrash && !selectedIds.has(g.id) ? 'bg-amber-50/30' : undefined)}>
                  <TD className="py-2.5 px-3"><input type="checkbox" checked={selectedIds.has(g.id)} onChange={() => toggleSelect(g.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-500/20 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{g.id}</span></TD>
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{g.name}</span>
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <span className="text-slate-600 text-sm line-clamp-1">{g.description || '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    <span className="text-slate-600">{g.display_order}</span>
                  </TD>
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{g.deleted_at ? fromNow(g.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={g.is_active ? 'success' : 'danger'}>
                        {g.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(g)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(g)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(g)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(g)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onSoftDelete(g)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === g.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* View Dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Learning Goal Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0"><Target className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Display Order" value={String(viewing.display_order)} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order)} />
              <DetailRow label="Description" value={viewing.description} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Learning Goal' : 'Add Learning Goal'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">{editing.is_active ? 'This learning goal is currently active' : 'This learning goal is currently inactive'}</p>
              </div>
              <button type="button" onClick={async () => { await onToggleActive(editing); const r = await api.getLearningGoal(editing.id); if (r.success && r.data) setEditing(r.data); }}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer', editing.is_active ? 'bg-emerald-500' : 'bg-slate-300')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}
          <Input label="Name" placeholder="Career advancement, Skill mastery..." {...register('name', { required: true })} />
          <Input label="Display Order" type="number" {...register('display_order')} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" rows={2} placeholder="Brief description..." {...register('description')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      <AiMasterDialog module="learning_goals" moduleLabel="Learning Goals" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createLearningGoal(item)} updateFn={(id, item) => api.updateLearningGoal(id, item)} defaultPrompt="Generate exactly these 18 learning goals with display_order: 1) Career Switch — Switching to a completely new career or industry, 2) Upskilling — Learning new skills to grow in current career, 3) Job Preparation — Preparing for job interviews and placement, 4) Freelancing — Learning skills to work as a freelancer, 5) Start a Business — Learning entrepreneurship and startup skills, 6) Academic Requirement — Learning as part of college/university coursework, 7) Exam Preparation — Preparing for competitive exams (GATE, CAT, UPSC, JEE, NEET), 8) Certification — Earning a professional certification (AWS, Google, PMP), 9) Research — Academic or professional research work, 10) Teaching/Instruction — Learning to teach or create courses, 11) Personal Project — Building a personal project or portfolio, 12) Hobby/Interest — Learning for personal enjoyment and curiosity, 13) Company Training — Employer-sponsored learning, 14) School/College Student — Supplementing formal education, 15) Stay Updated — Keeping up with industry trends, 16) Open Source Contribution, 17) Community/Social Impact, 18) Just Exploring — No specific goal. Fields: name, description, display_order, is_active=true, sort_order=display_order." defaultCount={18} listFn={(qs) => api.listLearningGoals(qs)} onSaved={() => { load(); refreshSummary(); }} />
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
