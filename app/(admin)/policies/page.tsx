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
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle,
  Loader2, X, Shield, Globe, FileText, Languages, Sparkles, Send, Archive,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ───────────────────────────────────────────────────────
type MainTab = 'policy_types' | 'type_translations' | 'policies' | 'policy_translations';

type PolicyTypeSortField = 'id' | 'name' | 'display_order' | 'is_active';
type TypeTrSortField = 'id' | 'name' | 'is_active';
type PolicySortField = 'id' | 'title' | 'version' | 'policy_status' | 'is_active';
type PolicyTrSortField = 'id' | 'title' | 'is_active';

// ─── Constants ───────────────────────────────────────────────────
const CONTENT_FORMAT_OPTIONS = [
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'plain', label: 'Plain Text' },
];

const POLICY_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-amber-50 text-amber-700',
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

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function PoliciesPage() {
  const [mainTab, setMainTab] = useState<MainTab>('policy_types');
  const [filterPolicyTypeFromTab, setFilterPolicyTypeFromTab] = useState<number | null>(null);
  const [filterPolicyFromTab, setFilterPolicyFromTab] = useState<number | null>(null);

  function navigateToTypeTranslations(policyTypeId: number) {
    setFilterPolicyTypeFromTab(policyTypeId);
    setMainTab('type_translations');
  }

  function navigateToPolicyTranslations(policyId: number) {
    setFilterPolicyFromTab(policyId);
    setMainTab('policy_translations');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Policy Management" />

      {/* ── Main Tabs ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'policy_types' as MainTab, label: 'Policy Types', icon: Shield },
          { id: 'type_translations' as MainTab, label: 'Type Translations', icon: Globe },
          { id: 'policies' as MainTab, label: 'Policies', icon: FileText },
          { id: 'policy_translations' as MainTab, label: 'Policy Translations', icon: Languages },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setMainTab(tab.id); if (tab.id !== 'type_translations') setFilterPolicyTypeFromTab(null); if (tab.id !== 'policy_translations') setFilterPolicyFromTab(null); }}
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
      {mainTab === 'policy_types' && <PolicyTypesTab onViewTranslations={navigateToTypeTranslations} />}
      {mainTab === 'type_translations' && <TypeTranslationsTab filterPolicyTypeId={filterPolicyTypeFromTab} />}
      {mainTab === 'policies' && <PoliciesTab onViewTranslations={navigateToPolicyTranslations} />}
      {mainTab === 'policy_translations' && <PolicyTranslationsTab filterPolicyId={filterPolicyFromTab} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: POLICY TYPES
// ══════════════════════════════════════════════════════════════════
function PolicyTypesTab({ onViewTranslations }: { onViewTranslations: (id: number) => void }) {
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
  const [sortField, setSortField] = useState<PolicyTypeSortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  interface CoverageItem { policy_type_id: number; total_languages: number; translated_count: number; missing_count: number; is_complete: boolean; }
  const [coverage, setCoverage] = useState<Record<number, CoverageItem>>({});

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
    api.getTableSummary('policy_types').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
    }
    const res = await api.getPolicyTypes(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('policy_types');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getPolicyTypeTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: any) => { map[c.policy_type_id] = c; });
      setCoverage(map);
    }
  }

  function handleSort(field: PolicyTypeSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: PolicyTypeSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({ name: '', code: '', slug: '', description: '', display_order: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      name: c.name || '', code: c.code || '', slug: c.slug || '', description: c.description || '',
      display_order: c.display_order ?? '', is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['display_order'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updatePolicyType(editing.id, payload)
      : await api.createPolicyType(payload);
    if (res.success) {
      toast.success(editing ? 'Policy type updated' : 'Policy type created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.name}" to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeletePolicyType(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Policy type moved to trash'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restorePolicyType(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Policy type restored'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.name}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeletePolicyType(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Policy type permanently deleted'); load(); refreshSummary(); loadCoverage(); }
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
      const res = await api.softDeletePolicyType(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restorePolicyType(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeletePolicyType(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Policy Types', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Policy Types
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Policy Type</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name...'}>
        {!showTrash && (
          <>
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
          icon={showTrash ? Trash2 : Shield}
          title={showTrash ? 'Trash is empty' : 'No policy types yet'}
          description={showTrash ? 'No deleted policy types' : (searchDebounce || filterStatus ? 'No policy types match your filters' : 'Create your first policy type')}
          action={!showTrash && !searchDebounce && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Policy Type</Button> : undefined}
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
                <TH className="sticky top-0 z-10">Code</TH>
                <TH className="sticky top-0 z-10">Description</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Display Order <SortIcon field="display_order" /></button></TH>
                <TH className="sticky top-0 z-10">Translations</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => {
                const cov = coverage[c.id];
                return (
                  <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                    <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                    <TD className="py-2.5">
                      <div className="text-sm font-medium text-slate-900">{c.name}</div>
                      {c.slug && <div className="text-xs text-slate-400">{c.slug}</div>}
                    </TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700 font-mono">{c.code || '--'}</span></TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.description, 40)}</span></TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700">{c.display_order ?? '--'}</span></TD>
                    <TD className="py-2.5">
                      {cov ? (
                        <button onClick={() => onViewTranslations(c.id)} className={cn('text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity', cov.is_complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                          {cov.translated_count}/{cov.total_languages}
                        </button>
                      ) : <span className="text-xs text-slate-400">--</span>}
                    </TD>
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
                );
              })}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Policy Type Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Shield className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  {viewing.code && <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{viewing.code}</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Name" value={viewing.name} />
              <DetailRow label="Code" value={viewing.code} />
              <DetailRow label="Slug" value={viewing.slug} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Policy Type' : 'Create Policy Type'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
              <Input {...register('name', { required: true })} placeholder="Policy type name" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Code</label>
              <Input {...register('code')} placeholder="e.g. privacy_policy" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Slug</label>
              <Input {...register('slug')} placeholder="auto-generated-slug" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Display Order</label>
              <Input {...register('display_order')} type="number" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Policy type description" />
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
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: POLICY TYPE TRANSLATIONS
// ══════════════════════════════════════════════════════════════════
function TypeTranslationsTab({ filterPolicyTypeId }: { filterPolicyTypeId: number | null }) {
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
  const [sortField, setSortField] = useState<TypeTrSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPolicyType, setFilterPolicyType] = useState<string>(filterPolicyTypeId ? String(filterPolicyTypeId) : '');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [aiGenerating, setAiGenerating] = useState(false);

  const [policyTypes, setPolicyTypes] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    api.getPolicyTypes({ limit: 200, is_active: 'true' }).then(res => {
      if (res.success) setPolicyTypes(res.data || []);
    });
    api.listLanguages('?is_active=true&limit=50').then(res => {
      if (res.success) setLanguages(res.data || []);
    });
    api.getTableSummary('policy_type_translations').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => {
    if (filterPolicyTypeId) setFilterPolicyType(String(filterPolicyTypeId));
  }, [filterPolicyTypeId]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterPolicyType, filterLanguage, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterPolicyType, filterLanguage, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterPolicyType) params.policy_type_id = filterPolicyType;
      if (filterLanguage) params.language_id = filterLanguage;
    }
    const res = await api.getPolicyTypeTranslations(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('policy_type_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: TypeTrSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: TypeTrSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      policy_type_id: filterPolicyType || '', language_id: '', name: '', description: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      policy_type_id: c.policy_type_id ?? '', language_id: c.language_id ?? '',
      name: c.name || '', description: c.description || '',
      is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['policy_type_id', 'language_id'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updatePolicyTypeTranslation(editing.id, payload)
      : await api.createPolicyTypeTranslation(payload);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move translation #${c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeletePolicyTypeTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restorePolicyTypeTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete translation #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeletePolicyTypeTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function handleAiGenerate(entityId: number) {
    setAiGenerating(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'policy_type', entity_ids: [entityId], provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s, results: r } = res.data;
        if (s.skipped > 0 && s.success === 0) {
          toast.success('All translations already complete!');
        } else {
          const langsGenerated = r?.reduce((acc: number, item: any) => acc + (item.languages_generated || 0), 0) || 0;
          toast.success(`Generated ${langsGenerated} translation(s)`);
        }
        load();
      } else { toast.error(res.error || 'Generation failed'); }
    } catch { toast.error('AI generation failed'); }
    setAiGenerating(false);
  }

  async function handleBulkAiFill() {
    if (!confirm('This will generate AI content for ALL policy types with missing or empty translations. Continue?')) return;
    setAiGenerating(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'policy_type', generate_all: true, provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s } = res.data;
        toast.success(`Generated content for ${s.success} item(s), ${s.skipped} already complete, ${s.errors} error(s)`);
        load();
      } else { toast.error(res.error || 'Bulk generation failed'); }
    } catch { toast.error('Bulk generation failed'); }
    setAiGenerating(false);
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
      const res = await api.softDeletePolicyTypeTranslation(ids[i]);
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
      const res = await api.restorePolicyTypeTranslation(ids[i]);
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
      const res = await api.permanentDeletePolicyTypeTranslation(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Translations', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', card.color)}><Icon className="w-4.5 h-4.5" /></div>
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
          Type Translations
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1 flex items-center gap-2">
            <Button variant="outline" onClick={handleBulkAiFill} disabled={aiGenerating}>
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Fill All Missing
            </Button>
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterPolicyType} onChange={e => setFilterPolicyType(e.target.value)}>
              <option value="">All Policy Types</option>
              {policyTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All Languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
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
          icon={showTrash ? Trash2 : Globe}
          title={showTrash ? 'Trash is empty' : 'No translations yet'}
          description={showTrash ? 'No deleted translations' : (searchDebounce || filterPolicyType || filterLanguage || filterStatus ? 'No translations match your filters' : 'Create your first type translation')}
          action={!showTrash && !searchDebounce && !filterPolicyType && !filterLanguage && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button> : undefined}
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
                <TH className="sticky top-0 z-10">Policy Type</TH>
                <TH className="sticky top-0 z-10">Language</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
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
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{c.policy_types?.name || `#${c.policy_type_id}`}</span></TD>
                  <TD className="py-2.5">
                    <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {c.languages?.iso_code || `#${c.language_id}`}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.name, 50)}</span></TD>
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
                          <button onClick={() => handleAiGenerate(c.policy_type_id)} disabled={aiGenerating} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="AI Generate">
                            {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Type Translation Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Globe className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name || '--'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{viewing.languages?.iso_code || `#${viewing.language_id}`}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Policy Type" value={viewing.policy_types?.name || `#${viewing.policy_type_id}`} />
              <DetailRow label="Language" value={viewing.languages?.name || `#${viewing.language_id}`} />
              <DetailRow label="Name" value={viewing.name} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Type Translation' : 'Create Type Translation'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Policy Type <span className="text-red-500">*</span></label>
              <select {...register('policy_type_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select policy type...</option>
                {policyTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Language <span className="text-red-500">*</span></label>
              <select {...register('language_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select language...</option>
                {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
            <Input {...register('name', { required: true })} placeholder="Translated name" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Translated description" />
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
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 3: POLICIES
// ══════════════════════════════════════════════════════════════════
function PoliciesTab({ onViewTranslations }: { onViewTranslations: (id: number) => void }) {
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
  const [sortField, setSortField] = useState<PolicySortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPolicyType, setFilterPolicyType] = useState('');
  const [filterPolicyStatus, setFilterPolicyStatus] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [policyTypes, setPolicyTypes] = useState<any[]>([]);

  interface CoverageItem { policy_id: number; total_languages: number; translated_count: number; missing_count: number; is_complete: boolean; }
  const [coverage, setCoverage] = useState<Record<number, CoverageItem>>({});

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
  ]);

  useEffect(() => {
    api.getPolicyTypes({ limit: 200, is_active: 'true' }).then(res => {
      if (res.success) setPolicyTypes(res.data || []);
    });
    api.getTableSummary('policies').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterPolicyType, filterPolicyStatus, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterPolicyType, filterPolicyStatus, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterPolicyType) params.policy_type_id = filterPolicyType;
      if (filterPolicyStatus) params.policy_status = filterPolicyStatus;
    }
    const res = await api.getPolicies(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('policies');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getPolicyTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: any) => { map[c.policy_id] = c; });
      setCoverage(map);
    }
  }

  function handleSort(field: PolicySortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: PolicySortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      policy_type_id: '', title: '', content: '', version: '1.0', version_notes: '',
      content_format: 'html', slug: '', meta_title: '', meta_description: '',
      effective_from: '', effective_until: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      policy_type_id: c.policy_type_id ?? '', title: c.title || '', content: c.content || '',
      version: c.version || '', version_notes: c.version_notes || '',
      content_format: c.content_format || 'html', slug: c.slug || '',
      meta_title: c.meta_title || '', meta_description: c.meta_description || '',
      effective_from: c.effective_from ? c.effective_from.slice(0, 10) : '',
      effective_until: c.effective_until ? c.effective_until.slice(0, 10) : '',
      is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['policy_type_id'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updatePolicy(editing.id, payload)
      : await api.createPolicy(payload);
    if (res.success) {
      toast.success(editing ? 'Policy updated' : 'Policy created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onPublish(c: any) {
    if (!confirm(`Publish policy "${truncate(c.title, 40)}"?`)) return;
    setActionLoadingId(c.id);
    const res = await api.publishPolicy(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Policy published'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onArchive(c: any) {
    if (!confirm(`Archive policy "${truncate(c.title, 40)}"?`)) return;
    setActionLoadingId(c.id);
    const res = await api.archivePolicy(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Policy archived'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move policy #${c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeletePolicy(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Policy moved to trash'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restorePolicy(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Policy restored'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete policy #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeletePolicy(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Policy permanently deleted'); load(); refreshSummary(); loadCoverage(); }
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
      const res = await api.softDeletePolicy(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restorePolicy(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeletePolicy(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Policies', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', card.color)}><Icon className="w-4.5 h-4.5" /></div>
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
          Policies
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Policy</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by title...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterPolicyType} onChange={e => setFilterPolicyType(e.target.value)}>
              <option value="">All Policy Types</option>
              {policyTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={selectClass} value={filterPolicyStatus} onChange={e => setFilterPolicyStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Active</option>
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
          icon={showTrash ? Trash2 : FileText}
          title={showTrash ? 'Trash is empty' : 'No policies yet'}
          description={showTrash ? 'No deleted policies' : (searchDebounce || filterPolicyType || filterPolicyStatus || filterStatus ? 'No policies match your filters' : 'Create your first policy')}
          action={!showTrash && !searchDebounce && !filterPolicyType && !filterPolicyStatus && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Policy</Button> : undefined}
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
                <TH className="sticky top-0 z-10">Policy Type</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('version')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Version <SortIcon field="version" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('policy_status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="policy_status" /></button></TH>
                <TH className="sticky top-0 z-10">Is Current</TH>
                <TH className="sticky top-0 z-10">Translations</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Active <SortIcon field="is_active" /></button></TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => {
                const cov = coverage[c.id];
                return (
                  <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                    <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.title, 50)}</span></TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700">{c.policy_types?.name || `#${c.policy_type_id}`}</span></TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700 font-mono">{c.version || '--'}</span></TD>
                    <TD className="py-2.5">
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', POLICY_STATUS_COLORS[c.policy_status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(c.policy_status || '')}
                      </span>
                    </TD>
                    <TD className="py-2.5">
                      {c.is_current_version ? <Badge variant="success">Current</Badge> : <span className="text-xs text-slate-400">--</span>}
                    </TD>
                    <TD className="py-2.5">
                      {cov ? (
                        <button onClick={() => onViewTranslations(c.id)} className={cn('text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity', cov.is_complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                          {cov.translated_count}/{cov.total_languages}
                        </button>
                      ) : <span className="text-xs text-slate-400">--</span>}
                    </TD>
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
                            {c.policy_status === 'draft' && (
                              <button onClick={() => onPublish(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Publish">
                                {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {c.policy_status === 'published' && (
                              <button onClick={() => onArchive(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="Archive">
                                {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button onClick={() => onSoftDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                              {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Policy Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <FileText className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{truncate(viewing.title, 80)}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', POLICY_STATUS_COLORS[viewing.policy_status] || 'bg-slate-100 text-slate-600')}>{capitalize(viewing.policy_status || '')}</span>
                  {viewing.is_current_version && <Badge variant="success">Current Version</Badge>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Policy Type" value={viewing.policy_types?.name || `#${viewing.policy_type_id}`} />
              <DetailRow label="Version" value={viewing.version} />
              <DetailRow label="Content Format" value={capitalize(viewing.content_format || '')} />
              <DetailRow label="Slug" value={viewing.slug} />
              <DetailRow label="Meta Title" value={viewing.meta_title} />
              <DetailRow label="Meta Description" value={viewing.meta_description} />
              <DetailRow label="Effective From" value={viewing.effective_from ? new Date(viewing.effective_from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
              <DetailRow label="Effective Until" value={viewing.effective_until ? new Date(viewing.effective_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
              <DetailRow label="Version Notes" value={viewing.version_notes} />
            </div>
            <div className="mt-4">
              <DetailRow label="Title" value={viewing.title} />
            </div>
            <div className="mt-4">
              <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Content</dt>
              <dd className="mt-0.5 text-sm text-slate-800 max-h-48 overflow-y-auto whitespace-pre-wrap">{viewing.content || '--'}</dd>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Policy' : 'Create Policy'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Policy Type <span className="text-red-500">*</span></label>
              <select {...register('policy_type_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select policy type...</option>
                {policyTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Content Format</label>
              <select {...register('content_format')} className={selectClass + ' w-full'}>
                {CONTENT_FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Title <span className="text-red-500">*</span></label>
            <Input {...register('title', { required: true })} placeholder="Policy title" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Content <span className="text-red-500">*</span></label>
            <textarea {...register('content', { required: true })} rows={8} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Policy content" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Version</label>
              <Input {...register('version')} placeholder="1.0" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Slug</label>
              <Input {...register('slug')} placeholder="auto-generated-slug" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Version Notes</label>
            <textarea {...register('version_notes')} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Version notes" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Title</label>
              <Input {...register('meta_title')} placeholder="Meta title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Description</label>
              <Input {...register('meta_description')} placeholder="Meta description" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Effective From</label>
              {/* Phase 45 — reject absurd years (e.g. 0002) via a sane range. */}
              <Input type="date" min="2000-01-01" max="2100-12-31"
                error={errors.effective_from?.message as string | undefined}
                {...register('effective_from', {
                  validate: (v) => {
                    if (!v) return true;
                    const y = Number(String(v).slice(0, 4));
                    return (y >= 2000 && y <= 2100) || 'Enter a valid date (year 2000–2100)';
                  },
                })} />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Effective Until</label>
              <Input type="date" min="2000-01-01" max="2100-12-31"
                error={errors.effective_until?.message as string | undefined}
                {...register('effective_until', {
                  validate: (v) => {
                    if (!v) return true;
                    const y = Number(String(v).slice(0, 4));
                    if (y < 2000 || y > 2100) return 'Enter a valid date (year 2000–2100)';
                    // Phase 45 — must not be before Effective From.
                    const from = watch('effective_from');
                    if (from && String(v) < String(from)) return 'Effective Until must be on or after Effective From';
                    return true;
                  },
                })} />
            </div>
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
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 4: POLICY TRANSLATIONS
// ══════════════════════════════════════════════════════════════════
function PolicyTranslationsTab({ filterPolicyId }: { filterPolicyId: number | null }) {
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
  const [sortField, setSortField] = useState<PolicyTrSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterPolicy, setFilterPolicy] = useState<string>(filterPolicyId ? String(filterPolicyId) : '');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [aiGenerating, setAiGenerating] = useState(false);

  const [policies, setPolicies] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    api.getPolicies({ limit: 500, is_active: 'true' }).then(res => {
      if (res.success) setPolicies(res.data || []);
    });
    api.listLanguages('?is_active=true&limit=50').then(res => {
      if (res.success) setLanguages(res.data || []);
    });
    api.getTableSummary('policy_translations').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => {
    if (filterPolicyId) setFilterPolicy(String(filterPolicyId));
  }, [filterPolicyId]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterPolicy, filterLanguage, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterPolicy, filterLanguage, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterPolicy) params.policy_id = filterPolicy;
      if (filterLanguage) params.language_id = filterLanguage;
    }
    const res = await api.getPolicyTranslations(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('policy_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: PolicyTrSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: PolicyTrSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      policy_id: filterPolicy || '', language_id: '', title: '', content: '',
      meta_title: '', meta_description: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      policy_id: c.policy_id ?? '', language_id: c.language_id ?? '',
      title: c.title || '', content: c.content || '',
      meta_title: c.meta_title || '', meta_description: c.meta_description || '',
      is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['policy_id', 'language_id'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updatePolicyTranslation(editing.id, payload)
      : await api.createPolicyTranslation(payload);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move translation #${c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeletePolicyTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restorePolicyTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete translation #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeletePolicyTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function handleAiGenerate(entityId: number) {
    setAiGenerating(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'policy', entity_ids: [entityId], provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s, results: r } = res.data;
        if (s.skipped > 0 && s.success === 0) {
          toast.success('All translations already complete!');
        } else {
          const langsGenerated = r?.reduce((acc: number, item: any) => acc + (item.languages_generated || 0), 0) || 0;
          toast.success(`Generated ${langsGenerated} translation(s)`);
        }
        load();
      } else { toast.error(res.error || 'Generation failed'); }
    } catch { toast.error('AI generation failed'); }
    setAiGenerating(false);
  }

  async function handleBulkAiFill() {
    if (!confirm('This will generate AI content for ALL policies with missing or empty translations. Continue?')) return;
    setAiGenerating(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'policy', generate_all: true, provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s } = res.data;
        toast.success(`Generated content for ${s.success} item(s), ${s.skipped} already complete, ${s.errors} error(s)`);
        load();
      } else { toast.error(res.error || 'Bulk generation failed'); }
    } catch { toast.error('Bulk generation failed'); }
    setAiGenerating(false);
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
      const res = await api.softDeletePolicyTranslation(ids[i]);
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
      const res = await api.restorePolicyTranslation(ids[i]);
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
      const res = await api.permanentDeletePolicyTranslation(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Translations', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', card.color)}><Icon className="w-4.5 h-4.5" /></div>
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
          Policy Translations
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1 flex items-center gap-2">
            <Button variant="outline" onClick={handleBulkAiFill} disabled={aiGenerating}>
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Fill All Missing
            </Button>
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by title...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterPolicy} onChange={e => setFilterPolicy(e.target.value)}>
              <option value="">All Policies</option>
              {policies.map(f => <option key={f.id} value={f.id}>{truncate(f.title, 40)}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All Languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
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
          icon={showTrash ? Trash2 : Languages}
          title={showTrash ? 'Trash is empty' : 'No translations yet'}
          description={showTrash ? 'No deleted translations' : (searchDebounce || filterPolicy || filterLanguage || filterStatus ? 'No translations match your filters' : 'Create your first policy translation')}
          action={!showTrash && !searchDebounce && !filterPolicy && !filterLanguage && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button> : undefined}
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
                <TH className="sticky top-0 z-10">Policy</TH>
                <TH className="sticky top-0 z-10">Language</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Title <SortIcon field="title" /></button></TH>
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
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.policies?.title || `#${c.policy_id}`, 40)}</span></TD>
                  <TD className="py-2.5">
                    <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {c.languages?.iso_code || `#${c.language_id}`}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.title, 50)}</span></TD>
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
                          <button onClick={() => handleAiGenerate(c.policy_id)} disabled={aiGenerating} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="AI Generate">
                            {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Policy Translation Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Languages className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{truncate(viewing.title, 80)}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{viewing.languages?.iso_code || `#${viewing.language_id}`}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Policy" value={viewing.policies?.title ? truncate(viewing.policies.title, 60) : `#${viewing.policy_id}`} />
              <DetailRow label="Language" value={viewing.languages?.name || `#${viewing.language_id}`} />
              <DetailRow label="Meta Title" value={viewing.meta_title} />
              <DetailRow label="Meta Description" value={viewing.meta_description} />
            </div>
            <div className="mt-4">
              <DetailRow label="Title" value={viewing.title} />
            </div>
            <div className="mt-4">
              <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Content</dt>
              <dd className="mt-0.5 text-sm text-slate-800 max-h-48 overflow-y-auto whitespace-pre-wrap">{viewing.content || '--'}</dd>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Policy Translation' : 'Create Policy Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Policy <span className="text-red-500">*</span></label>
              <select {...register('policy_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select policy...</option>
                {policies.map(f => <option key={f.id} value={f.id}>{truncate(f.title, 50)}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Language <span className="text-red-500">*</span></label>
              <select {...register('language_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select language...</option>
                {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Title <span className="text-red-500">*</span></label>
            <Input {...register('title', { required: true })} placeholder="Translated title" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Content <span className="text-red-500">*</span></label>
            <textarea {...register('content', { required: true })} rows={8} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Translated content" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Title</label>
              <Input {...register('meta_title')} placeholder="Meta title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Description</label>
              <Input {...register('meta_description')} placeholder="Meta description" />
            </div>
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
    </>
  );
}
