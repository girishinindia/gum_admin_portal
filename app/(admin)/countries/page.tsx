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
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Globe2, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Sparkles, Loader2 } from 'lucide-react';
import { AiMasterDialog } from '@/components/ui/AiMasterDialog';
import { cn, fromNow } from '@/lib/utils';
import type { Country } from '@/lib/types';

type SortField = 'id' | 'name' | 'iso2' | 'phone_code' | 'currency' | 'is_active' | 'sort_order';

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [viewing, setViewing] = useState<Country | null>(null);
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

  // Soft delete: toggle between active list and trash
  const [showTrash, setShowTrash] = useState(false);

  // Bulk select and actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Table summary stats
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary once on mount
  useEffect(() => {
    api.getTableSummary('countries').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
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
    const res = await api.listCountries('?' + qs.toString());
    if (res.success) {
      setCountries(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('countries');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
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
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    setDialogKey(k => k + 1);
    reset({ name: '', iso2: '', iso3: '', phone_code: '', nationality: '', currency: '', currency_symbol: '', currency_name: '', tld: '', national_language: '' });
    setDialogOpen(true);
  }

  function openEdit(c: Country) {
    setEditing(c);
    setImageFile(null);
    setImagePreview(null);
    setDialogKey(k => k + 1);
    reset({
      name: c.name, iso2: c.iso2, iso3: c.iso3, phone_code: c.phone_code, nationality: c.nationality,
      currency: c.currency, currency_symbol: c.currency_symbol, currency_name: c.currency_name, tld: c.tld,
      national_language: c.national_language,
    });
    setDialogOpen(true);
  }

  function openView(c: Country) {
    setViewing(c);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) fd.append('flag_image', imageFile, imageFile.name);

    const res = editing
      ? await api.updateCountry(editing.id, fd, true)
      : await api.createCountry(fd, true);

    if (res.success) {
      toast.success(editing ? 'Country updated' : 'Country created');
      setDialogOpen(false);
      load(); refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(c: Country) {
    if (!confirm(`Move "${c.name}" to trash? You can restore it later.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteCountry(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Country moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: Country) {
    setActionLoadingId(c.id);
    const res = await api.restoreCountry(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${c.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: Country) {
    if (!confirm(`PERMANENTLY delete "${c.name}"? This cannot be undone and flag image will be removed.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteCountry(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Country permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: Country) {
    const fd = new FormData();
    fd.append('is_active', String(!c.is_active));
    const res = await api.updateCountry(c.id, fd, true);
    if (res.success) { toast.success(`Country ${!c.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
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
    if (selectedIds.size === countries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(countries.map(c => c.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Move ${selectedIds.size} countries to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let success = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteCountry(ids[i]);
      if (res.success) success++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    toast.success(`${success}/${selectedIds.size} countries moved to trash`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Restore ${selectedIds.size} countries?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let success = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreCountry(ids[i]);
      if (res.success) success++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    toast.success(`${success}/${selectedIds.size} countries restored`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  async function handleBulkPermanentDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} countries? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let success = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteCountry(ids[i]);
      if (res.success) success++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    toast.success(`${success}/${selectedIds.size} countries permanently deleted`);
    setSelectedIds(new Set());
    load();
    refreshSummary();
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Countries"
        description="Manage countries, currencies, and flag images"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add country</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Countries', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Countries
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search countries...'}
      >
        {!showTrash && (
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
          >
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
      ) : countries.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Globe2}
          title={showTrash ? 'Trash is empty' : 'No countries yet'}
          description={showTrash ? 'No deleted countries' : (searchDebounce || filterStatus ? 'No countries match your filters' : 'Add your first country')}
          action={!showTrash && !searchDebounce && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add country</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className={cn('px-4 py-3 border-b flex items-center justify-between', showTrash ? 'bg-amber-50 border-amber-200' : 'bg-brand-50 border-slate-200')}>
              <div className={cn('text-sm font-medium', showTrash ? 'text-amber-900' : 'text-brand-900')}>
                {bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}
              </div>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkRestore}
                      disabled={bulkActionLoading}
                      className="h-8 px-2.5 text-xs"
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}
                      Restore Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleBulkPermanentDelete}
                      disabled={bulkActionLoading}
                      className="h-8 px-2.5 text-xs"
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                      Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleBulkSoftDelete}
                    disabled={bulkActionLoading}
                    className="h-8 px-2.5 text-xs"
                  >
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                    Move to Trash
                  </Button>
                )}
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkActionLoading}
                  className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
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
                    checked={countries.length > 0 && selectedIds.size === countries.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="w-14">Flag</TH>
                <TH>
                  <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Country <SortIcon field="name" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('iso2')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    ISO <SortIcon field="iso2" />
                  </button>
                </TH>
                {!showTrash && (
                  <>
                    <TH>
                      <button onClick={() => handleSort('phone_code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                        Phone Code <SortIcon field="phone_code" />
                      </button>
                    </TH>
                    <TH>Nationality</TH>
                    <TH>
                      <button onClick={() => handleSort('currency')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                        Currency <SortIcon field="currency" />
                      </button>
                    </TH>
                    <TH>Language</TH>
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
              {countries.map(c => (
                <TR key={c.id} className={cn(
                  selectedIds.has(c.id) ? 'bg-brand-50/40' : (showTrash ? 'bg-amber-50/30' : undefined)
                )}>
                  <TD className="py-2.5 px-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="w-10 h-7 rounded overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                      {c.flag_image ? (
                        <img src={c.flag_image} alt={c.name} className="w-full h-full object-cover" />
                      ) : (
                        <Globe2 className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{c.name}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="font-mono text-xs text-slate-600">{c.iso2} / {c.iso3}</span>
                  </TD>
                  {!showTrash && (
                    <>
                      <TD className="py-2.5">
                        <span className="text-slate-600">{c.phone_code || '—'}</span>
                      </TD>
                      <TD className="py-2.5">
                        <span className="text-slate-600">{c.nationality || '—'}</span>
                      </TD>
                      <TD className="py-2.5">
                        {c.currency ? (
                          <span className="text-slate-600">
                            {c.currency_symbol && <span className="text-slate-400 mr-0.5">{c.currency_symbol}</span>}
                            {c.currency}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TD>
                      <TD className="py-2.5">
                        <span className="text-slate-600">{c.national_language || '—'}</span>
                      </TD>
                    </>
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
            showingCount={countries.length}
          />
        </div>
      )}

      {/* ── View Country Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Country Details" size="lg">
        {viewing && (
          <div className="p-6">
            {/* Header: flag + name */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-14 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                {viewing.flag_image ? (
                  <img src={viewing.flag_image} alt={viewing.name} className="w-full h-full object-cover" />
                ) : (
                  <Globe2 className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="muted" className="font-mono">{viewing.iso2} / {viewing.iso3}</Badge>
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Phone Code" value={viewing.phone_code} />
              <DetailRow label="Nationality" value={viewing.nationality} />
              <DetailRow label="National Language" value={viewing.national_language} />
              <DetailRow label="TLD" value={viewing.tld} />
              <DetailRow label="Currency" value={viewing.currency ? `${viewing.currency_symbol || ''} ${viewing.currency}`.trim() : undefined} />
              <DetailRow label="Currency Name" value={viewing.currency_name} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order)} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Country' : 'Add Country'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This country is currently active' : 'This country is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getCountry(editing.id);
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

          <ImageUpload
            key={dialogKey}
            label="Flag Image"
            hint="Crop to 4:3 ratio, resized to max 200x150px WebP on server"
            value={editing?.flag_image}
            aspectRatio={4 / 3}
            maxWidth={800}
            maxHeight={600}
            shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="United States" {...register('name', { required: true })} />
            <Input label="Nationality" placeholder="American" {...register('nationality')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="ISO-2" placeholder="US" maxLength={2} {...register('iso2', { required: true })} />
            <Input label="ISO-3" placeholder="USA" maxLength={3} {...register('iso3', { required: true })} />
            <Input label="Phone Code" placeholder="+1" {...register('phone_code')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Currency" placeholder="USD" maxLength={3} {...register('currency')} />
            <Input label="Symbol" placeholder="$" maxLength={3} {...register('currency_symbol')} />
            <Input label="TLD" placeholder=".us" {...register('tld')} />
          </div>
          <Input label="Currency Name" placeholder="US Dollar" {...register('currency_name')} />
          <Input label="National Language" placeholder="English" {...register('national_language')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create country'}</Button>
          </div>
        </form>
      </Dialog>

      <AiMasterDialog module="countries" moduleLabel="Countries" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createCountry(item)} updateFn={(id, item) => api.updateCountry(id, item)} defaultPrompt="Generate countries with accurate data. Include all major countries: India, United States, United Kingdom, Canada, Australia, Germany, France, Japan, China, Brazil, Russia, South Korea, Singapore, UAE, Saudi Arabia, South Africa, Mexico, Indonesia, Thailand, Vietnam, Netherlands, Sweden, Switzerland, Italy, Spain, Portugal, Israel, Turkey, Egypt, Nigeria, Kenya, New Zealand, Ireland, Belgium, Norway, Denmark, Finland, Poland, Argentina, Colombia, Chile, Malaysia, Philippines, Bangladesh, Pakistan, Sri Lanka, Nepal. Fields: name, nationality, iso2, iso3, phone_code, currency, currency_symbol, currency_name, tld, national_language, region, subregion, languages (JSON array), latitude, longitude, is_active=true, sort_order." defaultCount={50} onSaved={() => { load(); refreshSummary(); }} />
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
