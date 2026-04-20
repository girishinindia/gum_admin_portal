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
import { Plus, Languages as LanguagesIcon, Trash2, Edit2, Eye, BookOpen, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Sparkles, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Language } from '@/lib/types';

type SortField = 'id' | 'name' | 'native_name' | 'iso_code' | 'is_active';

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Language | null>(null);
  const [viewing, setViewing] = useState<Language | null>(null);

  // Pagination, search, sort, filters
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

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, pageSize, showTrash]);
  useEffect(() => {
    api.getTableSummary('languages').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);
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
    const res = await api.listLanguages('?' + qs.toString());
    if (res.success) {
      setLanguages(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('languages');
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
    reset({ name: '', native_name: '', iso_code: '', script: '', for_material: false });
    setDialogOpen(true);
  }

  function openEdit(l: Language) {
    setEditing(l);
    reset({
      name: l.name, native_name: l.native_name || '', iso_code: l.iso_code || '',
      script: l.script || '', for_material: l.for_material,
    });
    setDialogOpen(true);
  }

  function openView(l: Language) {
    setViewing(l);
  }

  async function onSubmit(data: any) {
    const payload = { ...data };

    if (editing) {
      // for_material & is_active are handled by their own toggle buttons,
      // so strip them from the form payload to avoid overwriting with stale values
      delete payload.for_material;
      delete payload.is_active;
    } else {
      payload.for_material = data.for_material === true || data.for_material === 'true';
    }

    const res = editing
      ? await api.updateLanguage(editing.id, payload)
      : await api.createLanguage(payload);

    if (res.success) {
      toast.success(editing ? 'Language updated' : 'Language created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(l: Language) {
    if (!confirm(`Move "${l.name}" to trash? You can restore it later.`)) return;
    setActionLoadingId(l.id);
    const res = await api.deleteLanguage(l.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Language moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(l: Language) {
    setActionLoadingId(l.id);
    const res = await api.restoreLanguage(l.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${l.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(l: Language) {
    if (!confirm(`PERMANENTLY delete "${l.name}"? This cannot be undone.`)) return;
    setActionLoadingId(l.id);
    const res = await api.permanentDeleteLanguage(l.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Language permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(l: Language) {
    const res = await api.updateLanguage(l.id, { is_active: !l.is_active });
    if (res.success) { toast.success(`Language ${!l.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleMaterial(l: Language) {
    const res = await api.updateLanguage(l.id, { for_material: !l.for_material });
    if (res.success) { toast.success(`Material ${!l.for_material ? 'enabled' : 'disabled'} for ${l.name}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === languages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(languages.map(l => l.id)));
    }
  }

  async function handleBulkSoftDelete() {
    const count = selectedIds.size;
    if (!confirm(`Move ${count} language(s) to trash? You can restore them later.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let succeeded = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteLanguage(ids[i]);
      if (res.success) succeeded++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    if (succeeded > 0) {
      toast.success(`${succeeded} language(s) moved to trash`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    }
    if (succeeded < count) {
      toast.error(`Failed to move ${count - succeeded} language(s)`);
    }
  }

  async function handleBulkRestore() {
    const count = selectedIds.size;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let succeeded = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreLanguage(ids[i]);
      if (res.success) succeeded++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    if (succeeded > 0) {
      toast.success(`${succeeded} language(s) restored`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    }
    if (succeeded < count) {
      toast.error(`Failed to restore ${count - succeeded} language(s)`);
    }
  }

  async function handleBulkPermanentDelete() {
    const count = selectedIds.size;
    if (!confirm(`PERMANENTLY delete ${count} language(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let succeeded = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteLanguage(ids[i]);
      if (res.success) succeeded++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    if (succeeded > 0) {
      toast.success(`${succeeded} language(s) permanently deleted`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    }
    if (succeeded < count) {
      toast.error(`Failed to delete ${count - succeeded} language(s)`);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Languages"
        description="Manage languages for content and localization"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add language</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Languages', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Languages
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search languages...'}
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
      ) : languages.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : LanguagesIcon}
          title={showTrash ? 'Trash is empty' : 'No languages yet'}
          description={showTrash ? 'No deleted languages' : (searchDebounce || filterStatus ? 'No languages match your filters' : 'Add your first language')}
          action={!showTrash && !searchDebounce && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add language</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk Actions Toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-medium text-slate-700">
                {bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}
              </span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkRestore}
                      disabled={bulkActionLoading}
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                      Restore Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkPermanentDelete}
                      disabled={bulkActionLoading}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                      Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkSoftDelete}
                    disabled={bulkActionLoading}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                    Move to Trash
                  </Button>
                )}
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkActionLoading}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
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
                <TH className="w-10 px-3">
                  <input
                    type="checkbox"
                    checked={languages.length > 0 && selectedIds.size === languages.length}
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
                <TH>
                  <button onClick={() => handleSort('native_name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Native Name <SortIcon field="native_name" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('iso_code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    ISO Code <SortIcon field="iso_code" />
                  </button>
                </TH>
                {!showTrash && (
                  <>
                    <TH>Script</TH>
                    <TH>Material</TH>
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
              {languages.map(l => (
                <TR key={l.id} className={cn(
                  selectedIds.has(l.id) ? 'bg-brand-50' : (showTrash ? 'bg-amber-50/30' : undefined)
                )}>
                  <TD className="py-2.5 px-3">
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
                  <TD className="py-2.5">
                    <span className="text-slate-600">{l.native_name || '—'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="font-mono text-xs text-slate-600">{l.iso_code || '—'}</span>
                  </TD>
                  {!showTrash && (
                    <>
                      <TD className="py-2.5">
                        <span className="text-slate-600">{l.script || '—'}</span>
                      </TD>
                      <TD className="py-2.5">
                        {l.for_material ? (
                          <Badge variant="success"><BookOpen className="w-3 h-3 mr-1" />Yes</Badge>
                        ) : (
                          <span className="text-slate-400 text-sm">No</span>
                        )}
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
            showingCount={languages.length}
          />
        </div>
      )}

      {/* ── View Language Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Language Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                <LanguagesIcon className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {viewing.iso_code && <Badge variant="muted" className="font-mono">{viewing.iso_code}</Badge>}
                  {viewing.for_material && <Badge variant="success"><BookOpen className="w-3 h-3 mr-1" />Material</Badge>}
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Native Name" value={viewing.native_name} />
              <DetailRow label="ISO Code" value={viewing.iso_code} />
              <DetailRow label="Script" value={viewing.script} />
              <DetailRow label="For Material" value={viewing.for_material ? 'Yes' : 'No'} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order)} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Language' : 'Add Language'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This language is currently active' : 'This language is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getLanguage(editing.id);
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

          {/* Material toggle — only when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3">
              <div>
                <span className="text-sm font-medium text-slate-700">For Material</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.for_material ? 'Available for course material' : 'Not available for course material'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleMaterial(editing);
                  const refreshed = await api.getLanguage(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.for_material ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  editing.for_material ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="English" {...register('name', { required: true })} />
            <Input label="Native Name" placeholder="English" {...register('native_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ISO Code" placeholder="en" maxLength={10} {...register('iso_code')} />
            <Input label="Script" placeholder="Latin" {...register('script')} />
          </div>

          {/* Checkbox for material when creating */}
          {!editing && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('for_material')} />
              <span className="text-sm font-medium text-slate-700">Available for course material</span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create language'}</Button>
          </div>
        </form>
      </Dialog>
      <AiMasterDialog module="languages" moduleLabel="Languages" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createLanguage(item)} updateFn={(id, item) => api.updateLanguage(id, item)} onSaved={() => { load(); refreshSummary(); }} />
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
