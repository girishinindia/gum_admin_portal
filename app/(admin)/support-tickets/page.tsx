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
  Loader2, X, Ticket, Inbox, MessageSquare, UserPlus,
  ArrowLeft, Send, Paperclip, Clock, RefreshCw,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ───────────────────────────────────────────────────────
type MainTab = 'categories' | 'priorities' | 'tickets' | 'ticket_detail';

type CatSortField = 'id' | 'name' | 'display_order' | 'is_active';
type PriSortField = 'id' | 'name' | 'code' | 'sla_hours' | 'display_order' | 'is_active';
type TicketSortField = 'id' | 'ticket_number' | 'subject' | 'ticket_status' | 'is_active';

// ─── Constants ───────────────────────────────────────────────────
const TICKET_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_reply', label: 'Awaiting Reply' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const TICKET_STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  awaiting_reply: 'bg-purple-50 text-purple-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
};

const RELATED_TYPE_OPTIONS = [
  { value: 'course', label: 'Course' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'order', label: 'Order' },
  { value: 'general', label: 'General' },
];

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

function formatStatus(status: string) {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function SupportTicketsPage() {
  const [mainTab, setMainTab] = useState<MainTab>('tickets');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  function navigateToTicketDetail(ticketId: number) {
    setSelectedTicketId(ticketId);
    setMainTab('ticket_detail');
  }

  function navigateBackToTickets() {
    setSelectedTicketId(null);
    setMainTab('tickets');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Support Tickets" />

      {/* ── Main Tabs ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'categories' as MainTab, label: 'Categories', icon: Ticket },
          { id: 'priorities' as MainTab, label: 'Priorities', icon: AlertTriangle },
          { id: 'tickets' as MainTab, label: 'Tickets', icon: Inbox },
          ...(mainTab === 'ticket_detail' ? [{ id: 'ticket_detail' as MainTab, label: 'Ticket Detail', icon: MessageSquare }] : []),
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'ticket_detail' && !selectedTicketId) return;
                setMainTab(tab.id);
              }}
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
      {mainTab === 'categories' && <CategoriesTab />}
      {mainTab === 'priorities' && <PrioritiesTab />}
      {mainTab === 'tickets' && <TicketsTab onViewDetail={navigateToTicketDetail} />}
      {mainTab === 'ticket_detail' && selectedTicketId && <TicketDetailTab ticketId={selectedTicketId} onBack={navigateBackToTickets} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: TICKET CATEGORIES
// ══════════════════════════════════════════════════════════════════
function CategoriesTab() {
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
  const [sortField, setSortField] = useState<CatSortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

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
    api.getTableSummary('ticket_categories').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
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
    const res = await api.getTicketCategories(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('ticket_categories');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: CatSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: CatSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({ name: '', slug: '', description: '', display_order: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      name: c.name || '', slug: c.slug || '', description: c.description || '',
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

    // Phase 45 — always send description (even empty) so clearing it persists.
    // The empty-string skip above would otherwise drop it and keep the old text.
    payload.description = data.description ?? '';

    const res = editing
      ? await api.updateTicketCategory(editing.id, payload)
      : await api.createTicketCategory(payload);
    if (res.success) {
      toast.success(editing ? 'Category updated' : 'Category created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.name}" to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteTicketCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreTicketCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.name}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteTicketCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category permanently deleted'); load(); refreshSummary(); }
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
      const res = await api.softDeleteTicketCategory(ids[i]);
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
      const res = await api.restoreTicketCategory(ids[i]);
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
      const res = await api.permanentDeleteTicketCategory(ids[i]);
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
            { label: 'Total Categories', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Categories
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Category</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name...'}>
        {!showTrash && (
          <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
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
          icon={showTrash ? Trash2 : Ticket}
          title={showTrash ? 'Trash is empty' : 'No categories yet'}
          description={showTrash ? 'No deleted categories' : (searchDebounce || filterStatus ? 'No categories match your filters' : 'Create your first ticket category')}
          action={!showTrash && !searchDebounce && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Category</Button> : undefined}
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
                <TH className="sticky top-0 z-10">Description</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Display Order <SortIcon field="display_order" /></button></TH>
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
                  <TD className="py-2.5">
                    <div className="text-sm font-medium text-slate-900">{c.name}</div>
                    {c.slug && <div className="text-xs text-slate-400">{c.slug}</div>}
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{truncate(c.description)}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{c.display_order ?? '--'}</span></TD>
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
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Category Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Ticket className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Name" value={viewing.name} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Category' : 'Create Category'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
              <Input {...register('name', { required: true })} placeholder="Category name" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Slug</label>
              <Input {...register('slug')} placeholder="auto-generated-slug" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Category description" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Display Order</label>
              <Input {...register('display_order')} type="number" min={0} placeholder="0" />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
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
// TAB 2: TICKET PRIORITIES
// ══════════════════════════════════════════════════════════════════
function PrioritiesTab() {
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
  const [sortField, setSortField] = useState<PriSortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

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
    api.getTableSummary('ticket_priorities').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
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
    const res = await api.getTicketPriorities(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('ticket_priorities');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: PriSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: PriSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({ name: '', code: '', color: '#3b82f6', sla_hours: '', display_order: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      name: c.name || '', code: c.code || '', color: c.color || '#3b82f6',
      sla_hours: c.sla_hours ?? '', display_order: c.display_order ?? '', is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['sla_hours', 'display_order'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateTicketPriority(editing.id, payload)
      : await api.createTicketPriority(payload);
    if (res.success) {
      toast.success(editing ? 'Priority updated' : 'Priority created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.name}" to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteTicketPriority(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Priority moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreTicketPriority(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Priority restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.name}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteTicketPriority(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Priority permanently deleted'); load(); refreshSummary(); }
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
      const res = await api.softDeleteTicketPriority(ids[i]);
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
      const res = await api.restoreTicketPriority(ids[i]);
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
      const res = await api.permanentDeleteTicketPriority(ids[i]);
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
            { label: 'Total Priorities', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Priorities
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Priority</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name...'}>
        {!showTrash && (
          <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
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
          icon={showTrash ? Trash2 : AlertTriangle}
          title={showTrash ? 'Trash is empty' : 'No priorities yet'}
          description={showTrash ? 'No deleted priorities' : (searchDebounce || filterStatus ? 'No priorities match your filters' : 'Create your first ticket priority')}
          action={!showTrash && !searchDebounce && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Priority</Button> : undefined}
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
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Code <SortIcon field="code" /></button></TH>
                <TH className="sticky top-0 z-10">Color</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('sla_hours')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">SLA Hours <SortIcon field="sla_hours" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Display Order <SortIcon field="display_order" /></button></TH>
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
                  <TD className="py-2.5"><span className="text-sm font-medium text-slate-900">{c.name}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600 font-mono">{c.code || '--'}</span></TD>
                  <TD className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: c.color || '#94a3b8' }} />
                      <span className="text-xs text-slate-500 font-mono">{c.color || '--'}</span>
                    </div>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{c.sla_hours ?? '--'}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{c.display_order ?? '--'}</span></TD>
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
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Priority Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center border flex-shrink-0" style={{ backgroundColor: (viewing.color || '#3b82f6') + '20', borderColor: (viewing.color || '#3b82f6') + '40' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: viewing.color || '#3b82f6' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className="text-xs font-mono text-slate-500">{viewing.code}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Name" value={viewing.name} />
              <DetailRow label="Code" value={viewing.code} />
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Color</dt>
                <dd className="mt-0.5 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: viewing.color || '#94a3b8' }} />
                  <span className="text-sm text-slate-800 font-mono">{viewing.color || '--'}</span>
                </dd>
              </div>
              <DetailRow label="SLA Hours" value={viewing.sla_hours != null ? String(viewing.sla_hours) : undefined} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Priority' : 'Create Priority'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
              <Input {...register('name', { required: true })} placeholder="Priority name" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Code <span className="text-red-500">*</span></label>
              <Input {...register('code', { required: true })} placeholder="e.g. high, medium" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Color</label>
              <Input {...register('color')} placeholder="#3b82f6" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">SLA Hours</label>
              <Input {...register('sla_hours')} type="number" placeholder="24" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Display Order</label>
              <Input {...register('display_order')} type="number" min={0} placeholder="0" />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
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
// TAB 3: TICKETS
// ══════════════════════════════════════════════════════════════════
function TicketsTab({ onViewDetail }: { onViewDetail: (id: number) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<TicketSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTicketStatus, setFilterTicketStatus] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterPriorityId, setFilterPriorityId] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [categories, setCategories] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);

  // Status change dialog
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogTicket, setStatusDialogTicket] = useState<any | null>(null);
  const [statusDialogValue, setStatusDialogValue] = useState('');
  const [statusDialogNotes, setStatusDialogNotes] = useState('');
  const [statusDialogLoading, setStatusDialogLoading] = useState(false);

  // Assign dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignDialogTicket, setAssignDialogTicket] = useState<any | null>(null);
  const [assignDialogValue, setAssignDialogValue] = useState('');
  const [assignDialogLoading, setAssignDialogLoading] = useState(false);

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
    api.getTableSummary('support_tickets').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    api.getSupportTicketStats().then(res => {
      if (res.success) setStats(res.data);
    });
    api.getTicketCategories({ limit: 200, is_active: 'true' }).then(res => {
      if (res.success) setCategories(res.data || []);
    });
    api.getTicketPriorities({ limit: 200, is_active: 'true' }).then(res => {
      if (res.success) setPriorities(res.data || []);
    });
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, filterTicketStatus, filterCategoryId, filterPriorityId, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, filterTicketStatus, filterCategoryId, filterPriorityId, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterTicketStatus) params.ticket_status = filterTicketStatus;
      if (filterCategoryId) params.category_id = filterCategoryId;
      if (filterPriorityId) params.priority_id = filterPriorityId;
    }
    const res = await api.getSupportTickets(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('support_tickets');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    const statsRes = await api.getSupportTicketStats();
    if (statsRes.success) setStats(statsRes.data);
  }

  function handleSort(field: TicketSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: TicketSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({ subject: '', description: '', category_id: '', priority_id: '', user_id: '', related_type: 'general', related_id: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      subject: c.subject || '', description: c.description || '',
      category_id: c.category_id ?? '', priority_id: c.priority_id ?? '',
      user_id: c.user_id ?? '', related_type: c.related_type || 'general',
      related_id: c.related_id ?? '', is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['category_id', 'priority_id', 'user_id', 'related_id'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateSupportTicket(editing.id, payload)
      : await api.createSupportTicket(payload);
    if (res.success) {
      toast.success(editing ? 'Ticket updated' : 'Ticket created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  function openStatusChange(ticket: any) {
    setStatusDialogTicket(ticket);
    setStatusDialogValue(ticket.ticket_status || 'open');
    setStatusDialogNotes('');
    setStatusDialogOpen(true);
  }

  async function onStatusChange() {
    if (!statusDialogTicket) return;
    setStatusDialogLoading(true);
    const res = await api.changeSupportTicketStatus(statusDialogTicket.id, statusDialogValue, statusDialogNotes || undefined);
    setStatusDialogLoading(false);
    if (res.success) {
      toast.success('Ticket status updated');
      setStatusDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  function openAssign(ticket: any) {
    setAssignDialogTicket(ticket);
    setAssignDialogValue(ticket.assigned_to ?? '');
    setAssignDialogOpen(true);
  }

  async function onAssign() {
    if (!assignDialogTicket) return;
    setAssignDialogLoading(true);
    const res = await api.assignSupportTicket(assignDialogTicket.id, assignDialogValue ? Number(assignDialogValue) : null);
    setAssignDialogLoading(false);
    if (res.success) {
      toast.success('Ticket assigned');
      setAssignDialogOpen(false); load();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move ticket #${c.ticket_number || c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteSupportTicket(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Ticket moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreSupportTicket(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Ticket restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete ticket #${c.ticket_number || c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteSupportTicket(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Ticket permanently deleted'); load(); refreshSummary(); }
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
    if (!confirm(`Move ${selectedIds.size} ticket(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteSupportTicket(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} ticket(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} ticket(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreSupportTicket(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} ticket(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} ticket(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteSupportTicket(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} ticket(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Ticket Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4 mb-5">
          {[
            { label: 'Open', value: stats.open ?? 0, icon: Inbox, color: 'bg-blue-50 text-blue-600' },
            { label: 'In Progress', value: stats.in_progress ?? 0, icon: Clock, color: 'bg-amber-50 text-amber-600' },
            { label: 'Awaiting Reply', value: stats.awaiting_reply ?? 0, icon: MessageSquare, color: 'bg-purple-50 text-purple-600' },
            { label: 'Resolved', value: stats.resolved ?? 0, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Closed', value: stats.closed ?? 0, icon: XCircle, color: 'bg-slate-100 text-slate-600' },
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

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Tickets', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Tickets
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create Ticket</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by subject, ticket #...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterTicketStatus} onChange={e => setFilterTicketStatus(e.target.value)}>
              <option value="">All Ticket Status</option>
              {TICKET_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterCategoryId} onChange={e => setFilterCategoryId(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={selectClass} value={filterPriorityId} onChange={e => setFilterPriorityId(e.target.value)}>
              <option value="">All Priorities</option>
              {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
          <span>Tickets in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Inbox}
          title={showTrash ? 'Trash is empty' : 'No tickets yet'}
          description={showTrash ? 'No deleted tickets' : (searchDebounce || filterTicketStatus || filterCategoryId || filterPriorityId || filterStatus ? 'No tickets match your filters' : 'Create your first support ticket')}
          action={!showTrash && !searchDebounce && !filterTicketStatus && !filterCategoryId && !filterPriorityId && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create Ticket</Button> : undefined}
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
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('ticket_number')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Ticket # <SortIcon field="ticket_number" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('subject')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Subject <SortIcon field="subject" /></button></TH>
                <TH className="sticky top-0 z-10">Category</TH>
                <TH className="sticky top-0 z-10">Priority</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('ticket_status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="ticket_status" /></button></TH>
                <TH className="sticky top-0 z-10">User</TH>
                <TH className="sticky top-0 z-10">Assigned To</TH>
                <TH className="sticky top-0 z-10">Created</TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5"><span className="text-sm font-medium text-brand-600">{c.ticket_number || '--'}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-900">{truncate(c.subject, 40)}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{c.ticket_categories?.name || c.category_name || '--'}</span></TD>
                  <TD className="py-2.5">
                    {(c.ticket_priorities || c.priority_name) ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                        backgroundColor: ((c.ticket_priorities?.color || c.priority_color || '#94a3b8') + '20'),
                        color: c.ticket_priorities?.color || c.priority_color || '#64748b',
                      }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.ticket_priorities?.color || c.priority_color || '#94a3b8' }} />
                        {c.ticket_priorities?.name || c.priority_name}
                      </span>
                    ) : <span className="text-xs text-slate-400">--</span>}
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', TICKET_STATUS_COLORS[c.ticket_status] || 'bg-slate-100 text-slate-600')}>
                      {formatStatus(c.ticket_status || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{c.users ? `${c.users.first_name || ''} ${c.users.last_name || ''}`.trim() : (c.user_name || '--')}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{c.assigned_user ? `${c.assigned_user.first_name || ''} ${c.assigned_user.last_name || ''}`.trim() : (c.assigned_to_name || '--')}</span></TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-500">{c.created_at ? fromNow(c.created_at) : '--'}</span></TD>
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
                          <button onClick={() => onViewDetail(c.id)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View Detail"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openStatusChange(c)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Change Status"><RefreshCw className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openAssign(c)} className="p-1.5 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Assign"><UserPlus className="w-3.5 h-3.5" /></button>
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

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Ticket' : 'Create Ticket'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Subject <span className="text-red-500">*</span></label>
            <Input {...register('subject', { required: true })} placeholder="Ticket subject" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Description</label>
            <textarea {...register('description')} rows={4} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Describe the issue..." />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Category</label>
              <select {...register('category_id')} className={selectClass + ' w-full'}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Priority</label>
              <select {...register('priority_id')} className={selectClass + ' w-full'}>
                <option value="">Select Priority</option>
                {priorities.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">User ID</label>
              <Input {...register('user_id')} type="number" placeholder="User ID" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Related Type</label>
              <select {...register('related_type')} className={selectClass + ' w-full'}>
                {RELATED_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Related ID</label>
              <Input {...register('related_id')} type="number" placeholder="Optional related ID" />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Status Change Dialog ── */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} title="Change Ticket Status" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">New Status</label>
            <select className={selectClass + ' w-full'} value={statusDialogValue} onChange={e => setStatusDialogValue(e.target.value)}>
              {TICKET_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Notes (optional)</label>
            <textarea value={statusDialogNotes} onChange={e => setStatusDialogNotes(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Add a note about this status change..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={onStatusChange} disabled={statusDialogLoading}>
              {statusDialogLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Update Status
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Assign Dialog ── */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} title="Assign Ticket" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Assign To (User ID)</label>
            <Input value={assignDialogValue} onChange={e => setAssignDialogValue(e.target.value)} type="number" placeholder="Enter user ID to assign" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={onAssign} disabled={assignDialogLoading}>
              {assignDialogLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Assign
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 4: TICKET DETAIL
// ══════════════════════════════════════════════════════════════════
function TicketDetailTab({ ticketId, onBack }: { ticketId: number; onBack: () => void }) {
  const [ticket, setTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [attachmentsLoading, setAttachmentsLoading] = useState(true);

  // Add message form
  const [newMessage, setNewMessage] = useState('');
  const [newMessageInternal, setNewMessageInternal] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Status change
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusValue, setStatusValue] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Assign
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignValue, setAssignValue] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    loadTicket();
    loadMessages();
    loadAttachments();
  }, [ticketId]);

  async function loadTicket() {
    setLoading(true);
    const res = await api.getSupportTicket(ticketId);
    if (res.success) setTicket(res.data);
    setLoading(false);
  }

  async function loadMessages() {
    setMessagesLoading(true);
    const res = await api.getTicketMessages({ ticket_id: ticketId, limit: 200, sort: 'id', order: 'asc' });
    if (res.success) setMessages(res.data || []);
    setMessagesLoading(false);
  }

  async function loadAttachments() {
    setAttachmentsLoading(true);
    const res = await api.getTicketAttachments({ ticket_id: ticketId, limit: 200 });
    if (res.success) setAttachments(res.data || []);
    setAttachmentsLoading(false);
  }

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    const res = await api.createTicketMessage({ ticket_id: ticketId, message: newMessage, is_internal: newMessageInternal });
    setSendingMessage(false);
    if (res.success) {
      toast.success('Message sent');
      setNewMessage('');
      setNewMessageInternal(false);
      loadMessages();
    } else toast.error(res.error || 'Failed to send message');
  }

  function openStatusChange() {
    if (!ticket) return;
    setStatusValue(ticket.ticket_status || 'open');
    setStatusNotes('');
    setStatusDialogOpen(true);
  }

  async function onStatusChange() {
    setStatusLoading(true);
    const res = await api.changeSupportTicketStatus(ticketId, statusValue, statusNotes || undefined);
    setStatusLoading(false);
    if (res.success) {
      toast.success('Status updated');
      setStatusDialogOpen(false);
      loadTicket();
    } else toast.error(res.error || 'Failed');
  }

  function openAssign() {
    setAssignValue(ticket?.assigned_to ?? '');
    setAssignDialogOpen(true);
  }

  async function onAssign() {
    setAssignLoading(true);
    const res = await api.assignSupportTicket(ticketId, assignValue ? Number(assignValue) : null);
    setAssignLoading(false);
    if (res.success) {
      toast.success('Ticket assigned');
      setAssignDialogOpen(false);
      loadTicket();
    } else toast.error(res.error || 'Failed');
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <EmptyState
        icon={Inbox}
        title="Ticket not found"
        description="The requested ticket could not be loaded."
        action={<Button onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back to Tickets</Button>}
      />
    );
  }

  return (
    <>
      {/* Back button */}
      <div className="mb-4">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back to Tickets</Button>
      </div>

      {/* Ticket Info Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-bold text-slate-900">{ticket.ticket_number || `#${ticket.id}`}</h2>
              <span className={cn('inline-flex text-xs font-semibold px-2.5 py-1 rounded-full', TICKET_STATUS_COLORS[ticket.ticket_status] || 'bg-slate-100 text-slate-600')}>
                {formatStatus(ticket.ticket_status || '')}
              </span>
              {(ticket.ticket_priorities || ticket.priority_name) && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{
                  backgroundColor: ((ticket.ticket_priorities?.color || ticket.priority_color || '#94a3b8') + '20'),
                  color: ticket.ticket_priorities?.color || ticket.priority_color || '#64748b',
                }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ticket.ticket_priorities?.color || ticket.priority_color || '#94a3b8' }} />
                  {ticket.ticket_priorities?.name || ticket.priority_name}
                </span>
              )}
            </div>
            <h3 className="text-lg text-slate-700">{ticket.subject}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openStatusChange}><RefreshCw className="w-3.5 h-3.5" /> Change Status</Button>
            <Button variant="outline" size="sm" onClick={openAssign}><UserPlus className="w-3.5 h-3.5" /> Assign</Button>
          </div>
        </div>

        {ticket.description && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">{ticket.description}</div>
        )}

        <div className="grid grid-cols-4 gap-x-8 gap-y-4 pt-4 border-t border-slate-100">
          <DetailRow label="Category" value={ticket.ticket_categories?.name || ticket.category_name} />
          <DetailRow label="User" value={ticket.users ? `${ticket.users.first_name || ''} ${ticket.users.last_name || ''}`.trim() : (ticket.user_name || undefined)} />
          <DetailRow label="Assigned To" value={ticket.assigned_user ? `${ticket.assigned_user.first_name || ''} ${ticket.assigned_user.last_name || ''}`.trim() : (ticket.assigned_to_name || undefined)} />
          <DetailRow label="Related" value={ticket.related_type ? `${capitalize(ticket.related_type)}${ticket.related_id ? ` #${ticket.related_id}` : ''}` : undefined} />
          <DetailRow label="Created" value={ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined} />
          <DetailRow label="Updated" value={ticket.updated_at ? fromNow(ticket.updated_at) : undefined} />
        </div>
      </div>

      {/* Messages Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Messages ({messages.length})</h3>
        </div>

        {messagesLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No messages yet</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {messages.map(msg => (
              <div key={msg.id} className={cn('px-6 py-4', msg.is_internal && 'bg-amber-50/50')}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {msg.users ? `${msg.users.first_name || ''} ${msg.users.last_name || ''}`.trim() : (msg.sender_name || `User #${msg.user_id || '--'}`)}
                    </span>
                    {msg.is_internal && <Badge variant="warning">Internal</Badge>}
                  </div>
                  <span className="text-xs text-slate-400">{msg.created_at ? fromNow(msg.created_at) : '--'}</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add Message Form */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <div className="space-y-3">
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              placeholder="Type your message..."
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newMessageInternal} onChange={e => setNewMessageInternal(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm text-slate-600">Internal note</span>
              </label>
              <Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim()}>
                {sendingMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Message
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Attachments ({attachments.length})</h3>
        </div>

        {attachmentsLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : attachments.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No attachments</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {attachments.map(att => (
              <div key={att.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Paperclip className="w-4 h-4 text-slate-400" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{att.file_name || att.original_name || 'Attachment'}</div>
                    <div className="text-xs text-slate-400">{att.file_type || '--'} {att.file_size ? `(${(att.file_size / 1024).toFixed(1)} KB)` : ''}</div>
                  </div>
                </div>
                <span className="text-xs text-slate-400">{att.created_at ? fromNow(att.created_at) : '--'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Status Change Dialog ── */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} title="Change Ticket Status" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">New Status</label>
            <select className={selectClass + ' w-full'} value={statusValue} onChange={e => setStatusValue(e.target.value)}>
              {TICKET_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Notes (optional)</label>
            <textarea value={statusNotes} onChange={e => setStatusNotes(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Add a note about this status change..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={onStatusChange} disabled={statusLoading}>
              {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Update Status
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Assign Dialog ── */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} title="Assign Ticket" size="sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Assign To (User ID)</label>
            <Input value={assignValue} onChange={e => setAssignValue(e.target.value)} type="number" placeholder="Enter user ID to assign" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={onAssign} disabled={assignLoading}>
              {assignLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Assign
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
