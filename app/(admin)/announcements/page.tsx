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
  Loader2, X, Megaphone, Send, Archive, Pin, Search,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ───────────────────────────────────────────────────────
type SortField = 'id' | 'title' | 'announcement_type' | 'target_scope' | 'priority' | 'status' | 'sent_count' | 'published_at' | 'is_active';

// ─── Constants ───────────────────────────────────────────────────
const ANNOUNCEMENT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'course', label: 'Course' },
  { value: 'batch', label: 'Batch' },
  { value: 'event', label: 'Event' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'urgent', label: 'Urgent' },
];

const TARGET_SCOPES = [
  { value: 'all', label: 'All Users' },
  { value: 'category', label: 'Category' },
  { value: 'sub_category', label: 'Sub Category' },
  { value: 'course', label: 'Course' },
  { value: 'batch', label: 'Batch' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'instructors', label: 'All Instructors' },
  { value: 'students', label: 'All Students' },
  { value: 'custom', label: 'Custom' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

// BUG-37/50/54: API column announcements.priority is integer NOT NULL.
// Map the string label <-> integer at the API boundary.
const PRIORITY_LABEL_TO_INT: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const PRIORITY_INT_TO_LABEL: Record<number, string> = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical' };
// Normalize whatever the API returns (int or already-a-label) back to a string label.
function priorityToLabel(p: any): string {
  if (typeof p === 'number') return PRIORITY_INT_TO_LABEL[p] || 'medium';
  if (typeof p === 'string' && p in PRIORITY_LABEL_TO_INT) return p;
  return 'medium';
}

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'expired', label: 'Expired' },
];

const CHANNELS = ['in_app', 'email', 'sms', 'push'];

const ANNOUNCEMENT_TYPE_COLORS: Record<string, string> = {
  general: 'bg-slate-100 text-slate-600',
  course: 'bg-blue-50 text-blue-700',
  batch: 'bg-violet-50 text-violet-700',
  event: 'bg-teal-50 text-teal-700',
  maintenance: 'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700',
};

const TARGET_SCOPE_COLORS: Record<string, string> = {
  all: 'bg-slate-100 text-slate-600',
  category: 'bg-blue-50 text-blue-700',
  sub_category: 'bg-cyan-50 text-cyan-700',
  course: 'bg-indigo-50 text-indigo-700',
  batch: 'bg-violet-50 text-violet-700',
  webinar: 'bg-pink-50 text-pink-700',
  instructors: 'bg-emerald-50 text-emerald-700',
  students: 'bg-amber-50 text-amber-700',
  custom: 'bg-orange-50 text-orange-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-amber-50 text-amber-700',
  expired: 'bg-red-50 text-red-700',
};

const CHANNEL_COLORS: Record<string, string> = {
  in_app: 'bg-blue-50 text-blue-700',
  email: 'bg-emerald-50 text-emerald-700',
  sms: 'bg-amber-50 text-amber-700',
  push: 'bg-violet-50 text-violet-700',
};

const SCOPES_NEEDING_TARGET_ID = ['category', 'sub_category', 'course', 'batch', 'webinar', 'custom'];

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
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '--';
}

function userLine(user: any) {
  if (!user) return null;
  return (
    <div>
      <div className="text-sm font-medium text-slate-900">{user.first_name} {user.last_name}</div>
      {user.email && <div className="text-xs text-slate-500">{user.email}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function AnnouncementsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [viewStats, setViewStats] = useState<any | null>(null);
  const [viewReads, setViewReads] = useState<any[]>([]);
  const [viewReadsLoading, setViewReadsLoading] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterScope, setFilterScope] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch, formState } = useForm();

  const watchScope = watch('target_scope');

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary on mount
  useEffect(() => {
    api.getTableSummary('announcements').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterType, filterStatus, filterPriority, filterScope, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterType, filterStatus, filterPriority, filterScope, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = {
      page,
      limit: pageSize,
      sort: sortField,
      order: sortOrder,
    };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) {
      params.show_deleted = true;
    } else {
      if (filterType) params.announcement_type = filterType;
      if (filterStatus) params.status = filterStatus;
      // BUG-37/50/54: priority is stored as an int — filter by the int, not the label
      if (filterPriority) params.priority = PRIORITY_LABEL_TO_INT[filterPriority] ?? filterPriority;
      if (filterScope) params.target_scope = filterScope;
    }
    const res = await api.getAnnouncements(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('announcements');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
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

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      title: '', content: '', announcement_type: 'general',
      target_scope: 'all', target_id: '', target_name: '',
      priority: 'medium', status: 'draft', is_pinned: false,
      publish_at: '', expires_at: '',
      channels: ['in_app'], is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditing(item); setDialogKey(k => k + 1);
    reset({
      title: item.title || '',
      content: item.content || '',
      announcement_type: item.announcement_type || 'general',
      target_scope: item.target_scope || 'all',
      target_id: item.target_id ?? '',
      target_name: item.target_name || '',
      priority: priorityToLabel(item.priority), // BUG-37/50/54: int -> label for the select
      status: item.status || 'draft',
      is_pinned: item.is_pinned ?? false,
      publish_at: item.publish_at ? item.publish_at.slice(0, 16) : '',
      expires_at: item.expires_at ? item.expires_at.slice(0, 16) : '',
      channels: item.channels || ['in_app'],
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function openView(item: any) {
    setViewing(item);
    setViewStats(null);
    setViewReads([]);
    // load stats
    const statsRes = await api.getAnnouncementStats(item.id);
    if (statsRes.success) setViewStats(statsRes.data);
    // load reads
    setViewReadsLoading(true);
    const readsRes = await api.getAnnouncementReads(item.id, { limit: 20 });
    if (readsRes.success) setViewReads(readsRes.data || []);
    setViewReadsLoading(false);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      if (k === 'target_id' && v !== '') { payload[k] = Number(v); return; }
      if (k === 'channels') {
        payload[k] = Array.isArray(v) ? v : [v];
        return;
      }
      payload[k] = v;
    });

    // Clear target_id / target_name when scope doesn't need them
    if (!SCOPES_NEEDING_TARGET_ID.includes(payload.target_scope)) {
      delete payload.target_id;
      delete payload.target_name;
    }

    // BUG-37/50/54: announcements.priority is integer NOT NULL — send the int, not the label.
    payload.priority = PRIORITY_LABEL_TO_INT[payload.priority] ?? PRIORITY_LABEL_TO_INT.medium;

    const res = editing
      ? await api.updateAnnouncement(editing.id, payload)
      : await api.createAnnouncement(payload);
    if (res.success) {
      toast.success(editing ? 'Announcement updated' : 'Announcement created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onPublish(item: any) {
    if (!confirm(`Publish announcement "${item.title}"?`)) return;
    setActionLoadingId(item.id);
    const res = await api.publishAnnouncement(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Announcement published'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed to publish');
  }

  async function onArchive(item: any) {
    if (!confirm(`Archive announcement "${item.title}"?`)) return;
    setActionLoadingId(item.id);
    const res = await api.archiveAnnouncement(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Announcement archived'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed to archive');
  }

  async function onSoftDelete(item: any) {
    if (!confirm(`Move announcement "${item.title}" to trash?`)) return;
    setActionLoadingId(item.id);
    const res = await api.softDeleteAnnouncement(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Announcement moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: any) {
    setActionLoadingId(item.id);
    const res = await api.restoreAnnouncement(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${item.title}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: any) {
    if (!confirm(`PERMANENTLY delete announcement "${item.title}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteAnnouncement(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Announcement permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  // Bulk helpers
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
      const res = await api.softDeleteAnnouncement(ids[i]);
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
      const res = await api.restoreAnnouncement(ids[i]);
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
      const res = await api.permanentDeleteAnnouncement(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Announcements" />

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      {/* Sub-tabs: Announcements / Trash */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Announcements
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add announcement</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search announcements...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {ANNOUNCEMENT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="">All Priorities</option>
              {PRIORITIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterScope} onChange={e => setFilterScope(e.target.value)}>
              <option value="">All Scopes</option>
              {TARGET_SCOPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          icon={showTrash ? Trash2 : Megaphone}
          title={showTrash ? 'Trash is empty' : 'No announcements yet'}
          description={showTrash ? 'No deleted announcements' : (searchDebounce || filterType || filterStatus || filterPriority || filterScope ? 'No announcements match your filters' : 'Create your first announcement')}
          action={!showTrash && !searchDebounce && !filterType && !filterStatus && !filterPriority && !filterScope ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add announcement</Button> : undefined}
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
                <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH><button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Title <SortIcon field="title" /></button></TH>
                <TH><button onClick={() => handleSort('announcement_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Type <SortIcon field="announcement_type" /></button></TH>
                <TH><button onClick={() => handleSort('target_scope')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Scope <SortIcon field="target_scope" /></button></TH>
                <TH><button onClick={() => handleSort('priority')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Priority <SortIcon field="priority" /></button></TH>
                <TH><button onClick={() => handleSort('status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="status" /></button></TH>
                <TH>Channels</TH>
                <TH><button onClick={() => handleSort('sent_count')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Sent <SortIcon field="sent_count" /></button></TH>
                <TH><button onClick={() => handleSort('published_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Published <SortIcon field="published_at" /></button></TH>
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
                  <TD className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      {item.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.title || '--'}</span>
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', ANNOUNCEMENT_TYPE_COLORS[item.announcement_type] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(item.announcement_type || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', TARGET_SCOPE_COLORS[item.target_scope] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(item.target_scope || '')}
                    </span>
                    {item.target_name && <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[120px]">{item.target_name}</div>}
                  </TD>
                  <TD className="py-2.5">
                    {/* BUG-37/50/54: priority is an int from the API — normalize to label for badge */}
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', PRIORITY_COLORS[priorityToLabel(item.priority)] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(priorityToLabel(item.priority))}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[item.status] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(item.status || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex flex-wrap gap-0.5">
                      {(item.channels || []).map((ch: string) => (
                        <span key={ch} className={cn('inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded', CHANNEL_COLORS[ch] || 'bg-slate-50 text-slate-600')}>
                          {ch.replace('_', ' ').toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{item.sent_count ?? 0}</span></TD>
                  <TD className="py-2.5">
                    <span className="text-xs text-slate-600">{item.published_at ? fromNow(item.published_at) : '--'}</span>
                  </TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(item)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          {item.status === 'draft' && (
                            <button onClick={() => onPublish(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Publish">
                              {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {item.status === 'published' && (
                            <button onClick={() => onArchive(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="Archive">
                              {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => onSoftDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Announcement Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Megaphone className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[viewing.status] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.status || '')}</span>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', PRIORITY_COLORS[priorityToLabel(viewing.priority)] || 'bg-slate-50 text-slate-600')}>{capitalize(priorityToLabel(viewing.priority))}</span>
                  {viewing.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
                </div>
              </div>
            </div>

            {/* Content */}
            {viewing.content && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Content</dt>
                <dd className="text-sm text-slate-800 whitespace-pre-wrap">{viewing.content}</dd>
              </div>
            )}

            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Type" value={capitalize(viewing.announcement_type || '')} />
              <DetailRow label="Target Scope" value={capitalize(viewing.target_scope || '')} />
              <DetailRow label="Target Name" value={viewing.target_name} />
              <DetailRow label="Target ID" value={viewing.target_id != null ? String(viewing.target_id) : undefined} />
              <DetailRow label="Priority" value={capitalize(priorityToLabel(viewing.priority))} />
              <DetailRow label="Pinned" value={viewing.is_pinned ? 'Yes' : 'No'} />
              <DetailRow label="Channels" value={(viewing.channels || []).map((c: string) => c.replace('_', ' ').toUpperCase()).join(', ') || '--'} />
              <DetailRow label="Sent Count" value={String(viewing.sent_count ?? 0)} />
              <DetailRow label="Status" value={capitalize(viewing.status || '')} />
              <DetailRow label="Publish At (Scheduled)" value={viewing.publish_at ? new Date(viewing.publish_at).toLocaleString() : undefined} />
              <DetailRow label="Expires At" value={viewing.expires_at ? new Date(viewing.expires_at).toLocaleString() : undefined} />
              <DetailRow label="Published At" value={viewing.published_at ? new Date(viewing.published_at).toLocaleString() : undefined} />
            </div>

            {/* Creator / Publisher */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                <div>
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Created By</dt>
                  <dd className="mt-0.5">{viewing.creator ? userLine(viewing.creator) : <span className="text-sm text-slate-400">--</span>}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Published By</dt>
                  <dd className="mt-0.5">{viewing.publisher ? userLine(viewing.publisher) : <span className="text-sm text-slate-400">--</span>}</dd>
                </div>
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
              </div>
            </div>

            {/* Read Stats */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> Read Statistics
              </h4>
              {viewStats ? (
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total Reads', value: viewStats.total_reads ?? 0, color: 'bg-blue-50 text-blue-700' },
                    { label: 'Unique Readers', value: viewStats.unique_readers ?? 0, color: 'bg-emerald-50 text-emerald-700' },
                    { label: 'Email Opens', value: viewStats.email_opens ?? 0, color: 'bg-violet-50 text-violet-700' },
                    { label: 'Avg Read Time', value: viewStats.avg_read_time ? `${viewStats.avg_read_time}s` : '--', color: 'bg-amber-50 text-amber-700' },
                  ].map(stat => (
                    <div key={stat.label} className={cn('rounded-lg px-3 py-2 text-center', stat.color)}>
                      <div className="text-lg font-bold">{stat.value}</div>
                      <div className="text-xs font-medium opacity-70">{stat.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">No read stats available</div>
              )}

              {/* Recent reads */}
              {viewReadsLoading ? (
                <div className="mt-3 space-y-1">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
              ) : viewReads.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Recent Reads</h5>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {viewReads.map((r: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded text-xs">
                        <span className="text-slate-700">{r.user?.first_name} {r.user?.last_name} ({r.user?.email || 'Unknown'})</span>
                        <span className="text-slate-400">{r.read_at ? fromNow(r.read_at) : '--'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Announcement' : 'Create Announcement'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" key={dialogKey}>
          <Input label="Title" placeholder="Announcement title" {...register('title', { required: true })} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Content</label>
            <textarea
              className="w-full h-28 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Announcement content..."
              {...register('content')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Type <span className="text-red-500">*</span></label>
              <select className={cn(selectClass, 'w-full')} {...register('announcement_type', { required: true })}>
                {ANNOUNCEMENT_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
              <select className={cn(selectClass, 'w-full')} {...register('priority')}>
                {PRIORITIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select className={cn(selectClass, 'w-full')} {...register('status')}>
              {STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Scope <span className="text-red-500">*</span></label>
              <select className={cn(selectClass, 'w-full')} {...register('target_scope', { required: true })}>
                {TARGET_SCOPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {SCOPES_NEEDING_TARGET_ID.includes(watchScope) && (
              <Input label="Target ID" type="number" placeholder="e.g. 42" {...register('target_id')} />
            )}
          </div>

          {SCOPES_NEEDING_TARGET_ID.includes(watchScope) && (
            <Input label="Target Name" placeholder="Optional display name for target" {...register('target_name')} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Publish At (Schedule)" type="datetime-local" {...register('publish_at')} />
            <Input label="Expires At" type="datetime-local" {...register('expires_at')} />
          </div>

          {/* Channels multi-checkbox */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Channels</label>
            <div className="flex flex-wrap gap-3">
              {CHANNELS.map(ch => (
                <label key={ch} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    value={ch}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    {...register('channels')}
                  />
                  <span className="text-sm text-slate-700">{ch.replace('_', ' ').toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_pinned')} />
              <span className="text-sm font-medium text-slate-700">Pinned</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_active')} />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
