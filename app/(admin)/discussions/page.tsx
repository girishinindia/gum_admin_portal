'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  Loader2, X, MoreVertical, MessageSquare, MessageCircle, Pin,
  Lock, CheckCheck, Reply,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type ActiveTab = 'threads' | 'replies';
type ThreadSortField = 'id' | 'title' | 'item_type' | 'thread_status' | 'reply_count' | 'created_at';
type ReplySortField = 'id' | 'thread_id' | 'author_id' | 'is_accepted_answer' | 'created_at';

// ─── Constants ────────────────────────────────────────────────────
const ITEM_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'course', label: 'Course' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'batch', label: 'Batch' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'lesson', label: 'Lesson' },
];

const THREAD_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'pinned', label: 'Pinned' },
];

const THREAD_STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  closed: 'bg-slate-100 text-slate-600',
  resolved: 'bg-emerald-50 text-emerald-700',
  pinned: 'bg-amber-50 text-amber-700',
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  course: 'bg-blue-50 text-blue-700',
  bundle: 'bg-violet-50 text-violet-700',
  batch: 'bg-cyan-50 text-cyan-700',
  webinar: 'bg-rose-50 text-rose-700',
  lesson: 'bg-amber-50 text-amber-700',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

// ─── Helpers ────────────────────────────────────────────────────
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

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════
export default function DiscussionsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('threads');

  // ════════════════════════════════════════════════════════════════
  // STATS (always visible)
  // ════════════════════════════════════════════════════════════════
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, pinned: 0 });

  const fetchStats = useCallback(async () => {
    try {
      const [all, open, resolved, pinned] = await Promise.all([
        api.getDiscussionThreads({ limit: 1 }),
        api.getDiscussionThreads({ limit: 1, thread_status: 'open' }),
        api.getDiscussionThreads({ limit: 1, thread_status: 'resolved' }),
        api.getDiscussionThreads({ limit: 1, is_pinned: true }),
      ]);
      setStats({
        total: all.pagination?.total || 0,
        open: open.pagination?.total || 0,
        resolved: resolved.pagination?.total || 0,
        pinned: pinned.pagination?.total || 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ════════════════════════════════════════════════════════════════
  // TAB 1 — THREADS STATE
  // ════════════════════════════════════════════════════════════════
  const [thrData, setThrData] = useState<any[]>([]);
  const [thrTotal, setThrTotal] = useState(0);
  const [thrTrashCount, setThrTrashCount] = useState(0);
  const [thrPage, setThrPage] = useState(1);
  const [thrPageSize, setThrPageSize] = usePageSize(10);
  const [thrSort, setThrSort] = useState<ThreadSortField>('created_at');
  const [thrAsc, setThrAsc] = useState(false);
  const [thrLoading, setThrLoading] = useState(true);
  const [thrShowTrash, setThrShowTrash] = useState(false);
  const [thrSearch, setThrSearch] = useState('');
  const [thrTypeFilter, setThrTypeFilter] = useState('');
  const [thrStatusFilter, setThrStatusFilter] = useState('');
  const thrToolbarRef = useRef<DataToolbarHandle>(null);

  // View
  const [thrViewOpen, setThrViewOpen] = useState(false);
  const [thrViewItem, setThrViewItem] = useState<any>(null);
  const [thrViewLoading, setThrViewLoading] = useState(false);

  // Create
  const [thrCreateOpen, setThrCreateOpen] = useState(false);
  const [thrCreating, setThrCreating] = useState(false);
  const { register: regThrCreate, handleSubmit: handleThrCreate, reset: resetThrCreate } = useForm();

  // Edit
  const [thrEditOpen, setThrEditOpen] = useState(false);
  const [thrEditItem, setThrEditItem] = useState<any>(null);
  const [thrSaving, setThrSaving] = useState(false);
  const { register: regThrEdit, handleSubmit: handleThrEdit, reset: resetThrEdit } = useForm();

  // Action loaders
  const [thrActionLoaders, setThrActionLoaders] = useState<Record<number, string>>({});

  // ════════════════════════════════════════════════════════════════
  // TAB 2 — REPLIES STATE
  // ════════════════════════════════════════════════════════════════
  const [repData, setRepData] = useState<any[]>([]);
  const [repTotal, setRepTotal] = useState(0);
  const [repTrashCount, setRepTrashCount] = useState(0);
  const [repPage, setRepPage] = useState(1);
  const [repPageSize, setRepPageSize] = usePageSize(10);
  const [repSort, setRepSort] = useState<ReplySortField>('created_at');
  const [repAsc, setRepAsc] = useState(false);
  const [repLoading, setRepLoading] = useState(true);
  const [repShowTrash, setRepShowTrash] = useState(false);
  const [repSearch, setRepSearch] = useState('');
  const [repThreadFilter, setRepThreadFilter] = useState('');
  const [repAcceptedFilter, setRepAcceptedFilter] = useState('');
  const [repInstructorFilter, setRepInstructorFilter] = useState('');
  const repToolbarRef = useRef<DataToolbarHandle>(null);

  // View
  const [repViewOpen, setRepViewOpen] = useState(false);
  const [repViewItem, setRepViewItem] = useState<any>(null);
  const [repViewLoading, setRepViewLoading] = useState(false);

  // Create
  const [repCreateOpen, setRepCreateOpen] = useState(false);
  const [repCreating, setRepCreating] = useState(false);
  const { register: regRepCreate, handleSubmit: handleRepCreate, reset: resetRepCreate } = useForm();

  // Edit
  const [repEditOpen, setRepEditOpen] = useState(false);
  const [repEditItem, setRepEditItem] = useState<any>(null);
  const [repSaving, setRepSaving] = useState(false);
  const { register: regRepEdit, handleSubmit: handleRepEdit, reset: resetRepEdit } = useForm();

  // Action loaders
  const [repActionLoaders, setRepActionLoaders] = useState<Record<number, string>>({});

  // ════════════════════════════════════════════════════════════════
  // THREADS — FETCH
  // ════════════════════════════════════════════════════════════════
  const fetchThrData = useCallback(async () => {
    setThrLoading(true);
    try {
      const params: Record<string, any> = { page: thrPage, limit: thrPageSize, sort: thrSort, ascending: thrAsc };
      if (thrShowTrash) params.show_deleted = true;
      if (thrSearch) params.search = thrSearch;
      if (thrTypeFilter) params.item_type = thrTypeFilter;
      if (thrStatusFilter) params.thread_status = thrStatusFilter;
      const res = await api.getDiscussionThreads(params);
      setThrData(res.data || []);
      setThrTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load discussion threads'); }
    setThrLoading(false);
  }, [thrPage, thrPageSize, thrSort, thrAsc, thrShowTrash, thrSearch, thrTypeFilter, thrStatusFilter]);

  const fetchThrTrashCount = useCallback(async () => {
    try {
      const res = await api.getDiscussionThreads({ show_deleted: true, limit: 1 });
      setThrTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchThrData(); fetchThrTrashCount(); }, [fetchThrData, fetchThrTrashCount]);

  // ════════════════════════════════════════════════════════════════
  // REPLIES — FETCH
  // ════════════════════════════════════════════════════════════════
  const fetchRepData = useCallback(async () => {
    setRepLoading(true);
    try {
      const params: Record<string, any> = { page: repPage, limit: repPageSize, sort: repSort, ascending: repAsc };
      if (repShowTrash) params.show_deleted = true;
      if (repSearch) params.search = repSearch;
      if (repThreadFilter) params.thread_id = repThreadFilter;
      if (repAcceptedFilter) params.is_accepted_answer = repAcceptedFilter === 'true';
      if (repInstructorFilter) params.is_instructor_reply = repInstructorFilter === 'true';
      const res = await api.getDiscussionReplies(params);
      setRepData(res.data || []);
      setRepTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load discussion replies'); }
    setRepLoading(false);
  }, [repPage, repPageSize, repSort, repAsc, repShowTrash, repSearch, repThreadFilter, repAcceptedFilter, repInstructorFilter]);

  const fetchRepTrashCount = useCallback(async () => {
    try {
      const res = await api.getDiscussionReplies({ show_deleted: true, limit: 1 });
      setRepTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchRepData(); fetchRepTrashCount(); }, [fetchRepData, fetchRepTrashCount]);

  // ════════════════════════════════════════════════════════════════
  // THREADS — SORT
  // ════════════════════════════════════════════════════════════════
  function toggleThrSort(field: ThreadSortField) {
    if (thrSort === field) setThrAsc(!thrAsc);
    else { setThrSort(field); setThrAsc(true); }
  }
  function ThrSortIcon({ field }: { field: ThreadSortField }) {
    if (thrSort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return thrAsc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ════════════════════════════════════════════════════════════════
  // REPLIES — SORT
  // ════════════════════════════════════════════════════════════════
  function toggleRepSort(field: ReplySortField) {
    if (repSort === field) setRepAsc(!repAsc);
    else { setRepSort(field); setRepAsc(true); }
  }
  function RepSortIcon({ field }: { field: ReplySortField }) {
    if (repSort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return repAsc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ════════════════════════════════════════════════════════════════
  // THREADS — ACTIONS
  // ════════════════════════════════════════════════════════════════
  async function openThrView(id: number) {
    setThrViewLoading(true);
    setThrViewOpen(true);
    try {
      const res = await api.getDiscussionThread(id);
      setThrViewItem(res.data);
    } catch { toast.error('Failed to load thread details'); }
    setThrViewLoading(false);
  }

  function openThrCreate() {
    resetThrCreate({ title: '', body: '', item_type: 'course', item_id: '', author_id: '', thread_status: 'open', is_pinned: false });
    setThrCreateOpen(true);
  }

  async function onThrCreate(formData: any) {
    setThrCreating(true);
    try {
      const payload: any = { ...formData };
      if (formData.item_id) payload.item_id = parseInt(formData.item_id);
      if (formData.author_id) payload.author_id = parseInt(formData.author_id);
      payload.is_pinned = !!formData.is_pinned;
      await api.createDiscussionThread(payload);
      toast.success('Thread created');
      setThrCreateOpen(false);
      fetchThrData();
      fetchStats();
    } catch (e: any) { toast.error(e.message || 'Create failed'); }
    setThrCreating(false);
  }

  function openThrEdit(item: any) {
    setThrEditItem(item);
    resetThrEdit({
      title: item.title || '',
      body: item.body || '',
      item_type: item.item_type || 'course',
      item_id: item.item_id || '',
      thread_status: item.thread_status || 'open',
      is_pinned: item.is_pinned || false,
    });
    setThrEditOpen(true);
  }

  async function onThrSaveEdit(formData: any) {
    if (!thrEditItem) return;
    setThrSaving(true);
    try {
      const payload: any = { ...formData };
      if (formData.item_id) payload.item_id = parseInt(formData.item_id);
      payload.is_pinned = !!formData.is_pinned;
      await api.updateDiscussionThread(thrEditItem.id, payload);
      toast.success('Thread updated');
      setThrEditOpen(false);
      fetchThrData();
      fetchStats();
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
    setThrSaving(false);
  }

  async function handleThrClose(id: number) {
    setThrActionLoaders(p => ({ ...p, [id]: 'closing' }));
    try { await api.closeDiscussionThread(id); toast.success('Thread closed'); fetchThrData(); fetchStats(); }
    catch { toast.error('Failed to close thread'); }
    setThrActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleThrResolve(id: number) {
    setThrActionLoaders(p => ({ ...p, [id]: 'resolving' }));
    try { await api.resolveDiscussionThread(id); toast.success('Thread resolved'); fetchThrData(); fetchStats(); }
    catch { toast.error('Failed to resolve thread'); }
    setThrActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleThrPin(id: number) {
    setThrActionLoaders(p => ({ ...p, [id]: 'pinning' }));
    try { await api.pinDiscussionThread(id); toast.success('Thread pin toggled'); fetchThrData(); fetchStats(); }
    catch { toast.error('Failed to toggle pin'); }
    setThrActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleThrSoftDelete(id: number) {
    setThrActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteDiscussionThread(id); toast.success('Moved to trash'); fetchThrData(); fetchThrTrashCount(); fetchStats(); }
    catch { toast.error('Failed to delete'); }
    setThrActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleThrRestore(id: number) {
    setThrActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreDiscussionThread(id); toast.success('Restored'); fetchThrData(); fetchThrTrashCount(); fetchStats(); }
    catch { toast.error('Failed to restore'); }
    setThrActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleThrPermanentDelete(id: number) {
    if (!confirm('Permanently delete this thread? This cannot be undone.')) return;
    setThrActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeleteDiscussionThread(id); toast.success('Permanently deleted'); fetchThrData(); fetchThrTrashCount(); fetchStats(); }
    catch { toast.error('Failed to delete'); }
    setThrActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ════════════════════════════════════════════════════════════════
  // REPLIES — ACTIONS
  // ════════════════════════════════════════════════════════════════
  async function openRepView(id: number) {
    setRepViewLoading(true);
    setRepViewOpen(true);
    try {
      const res = await api.getDiscussionReply(id);
      setRepViewItem(res.data);
    } catch { toast.error('Failed to load reply details'); }
    setRepViewLoading(false);
  }

  function openRepCreate() {
    resetRepCreate({ thread_id: '', parent_reply_id: '', author_id: '', body: '', is_instructor_reply: false });
    setRepCreateOpen(true);
  }

  async function onRepCreate(formData: any) {
    setRepCreating(true);
    try {
      const payload: any = { ...formData };
      payload.thread_id = parseInt(formData.thread_id);
      if (formData.parent_reply_id) payload.parent_reply_id = parseInt(formData.parent_reply_id);
      else delete payload.parent_reply_id;
      payload.author_id = parseInt(formData.author_id);
      payload.is_instructor_reply = !!formData.is_instructor_reply;
      await api.createDiscussionReply(payload);
      toast.success('Reply created');
      setRepCreateOpen(false);
      fetchRepData();
    } catch (e: any) { toast.error(e.message || 'Create failed'); }
    setRepCreating(false);
  }

  function openRepEdit(item: any) {
    setRepEditItem(item);
    resetRepEdit({
      body: item.body || '',
      is_instructor_reply: item.is_instructor_reply || false,
    });
    setRepEditOpen(true);
  }

  async function onRepSaveEdit(formData: any) {
    if (!repEditItem) return;
    setRepSaving(true);
    try {
      const payload: any = { ...formData };
      payload.is_instructor_reply = !!formData.is_instructor_reply;
      await api.updateDiscussionReply(repEditItem.id, payload);
      toast.success('Reply updated');
      setRepEditOpen(false);
      fetchRepData();
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
    setRepSaving(false);
  }

  async function handleRepAccept(id: number) {
    setRepActionLoaders(p => ({ ...p, [id]: 'accepting' }));
    try { await api.acceptDiscussionReply(id); toast.success('Reply accepted as answer'); fetchRepData(); }
    catch { toast.error('Failed to accept reply'); }
    setRepActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRepSoftDelete(id: number) {
    setRepActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteDiscussionReply(id); toast.success('Moved to trash'); fetchRepData(); fetchRepTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setRepActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRepRestore(id: number) {
    setRepActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreDiscussionReply(id); toast.success('Restored'); fetchRepData(); fetchRepTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setRepActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRepPermanentDelete(id: number) {
    if (!confirm('Permanently delete this reply? This cannot be undone.')) return;
    setRepActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeleteDiscussionReply(id); toast.success('Permanently deleted'); fetchRepData(); fetchRepTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setRepActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Discussion & Q&A"
        actions={
          <Button size="sm" onClick={activeTab === 'threads' ? openThrCreate : openRepCreate}>
            <Plus className="w-4 h-4" />
            {activeTab === 'threads' ? 'New Thread' : 'New Reply'}
          </Button>
        }
      />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Threads', value: stats.total, icon: MessageSquare, color: 'text-blue-700', bg: 'bg-blue-50', iconColor: 'text-blue-500' },
          { label: 'Open', value: stats.open, icon: MessageCircle, color: 'text-blue-700', bg: 'bg-blue-50', iconColor: 'text-blue-500' },
          { label: 'Resolved', value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
          { label: 'Pinned', value: stats.pinned, icon: Pin, color: 'text-amber-700', bg: 'bg-amber-50', iconColor: 'text-amber-500' },
        ].map(stat => (
          <div key={stat.label} className={cn('rounded-xl px-4 py-3', stat.bg)}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <stat.icon className={cn('w-4 h-4', stat.iconColor)} />
            </div>
            <p className={cn('text-2xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-5">
        <button
          className={cn('px-4 py-2 text-sm font-medium rounded-md transition-all', activeTab === 'threads' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800')}
          onClick={() => setActiveTab('threads')}
        >
          Threads
        </button>
        <button
          className={cn('px-4 py-2 text-sm font-medium rounded-md transition-all', activeTab === 'replies' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800')}
          onClick={() => setActiveTab('replies')}
        >
          Replies
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB 1 — THREADS                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'threads' && (
        <>
          {/* Toolbar */}
          <DataToolbar
            ref={thrToolbarRef}
            search={thrSearch}
            onSearchChange={(v: string) => { setThrSearch(v); setThrPage(1); }}
            searchPlaceholder="Search threads..."
          >
            <div className="flex items-center gap-2">
              <select className={selectClass} value={thrTypeFilter} onChange={e => { setThrTypeFilter(e.target.value); setThrPage(1); }}>
                {ITEM_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className={selectClass} value={thrStatusFilter} onChange={e => { setThrStatusFilter(e.target.value); setThrPage(1); }}>
                {THREAD_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button variant={thrShowTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setThrShowTrash(!thrShowTrash); setThrPage(1); }}>
                <Trash2 className="w-4 h-4" />
                Trash
                {thrTrashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{thrTrashCount}</span>}
              </Button>
            </div>
          </DataToolbar>

          {/* Table */}
          {thrLoading ? (
            <div className="space-y-3 mt-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : thrData.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={thrShowTrash ? 'Trash is empty' : 'No threads found'}
              description={thrShowTrash ? 'No deleted threads found' : 'Discussion threads will appear here once created'}
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="cursor-pointer" onClick={() => toggleThrSort('id')}>
                      <div className="flex items-center gap-1">ID <ThrSortIcon field="id" /></div>
                    </TH>
                    <TH className="cursor-pointer" onClick={() => toggleThrSort('title')}>
                      <div className="flex items-center gap-1">TITLE <ThrSortIcon field="title" /></div>
                    </TH>
                    <TH className="cursor-pointer" onClick={() => toggleThrSort('item_type')}>
                      <div className="flex items-center gap-1">ITEM TYPE <ThrSortIcon field="item_type" /></div>
                    </TH>
                    <TH>ITEM ID</TH>
                    <TH>AUTHOR</TH>
                    <TH className="cursor-pointer" onClick={() => toggleThrSort('thread_status')}>
                      <div className="flex items-center gap-1">STATUS <ThrSortIcon field="thread_status" /></div>
                    </TH>
                    <TH className="cursor-pointer" onClick={() => toggleThrSort('reply_count')}>
                      <div className="flex items-center gap-1">REPLIES <ThrSortIcon field="reply_count" /></div>
                    </TH>
                    <TH>PINNED</TH>
                    <TH className="cursor-pointer" onClick={() => toggleThrSort('created_at')}>
                      <div className="flex items-center gap-1">CREATED <ThrSortIcon field="created_at" /></div>
                    </TH>
                    <TH className="text-right">ACTIONS</TH>
                  </TR>
                </THead>
                <TBody>
                  {thrData.map((item) => {
                    const actionState = thrActionLoaders[item.id];
                    const authorName = item.users?.full_name || item.users?.email || `User #${item.author_id}`;
                    return (
                      <TR key={item.id}>
                        <TD>
                          <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">#{item.id}</code>
                        </TD>
                        <TD>
                          <div className="text-sm font-medium text-slate-900 truncate max-w-[220px]">{item.title || '--'}</div>
                        </TD>
                        <TD>
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', ITEM_TYPE_COLORS[item.item_type] || 'bg-slate-100 text-slate-600')}>
                            {capitalize(item.item_type)}
                          </span>
                        </TD>
                        <TD><span className="text-sm text-slate-600">{item.item_id || '--'}</span></TD>
                        <TD>
                          <div className="text-sm font-medium text-slate-900 truncate max-w-[140px]">{authorName}</div>
                        </TD>
                        <TD>
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', THREAD_STATUS_COLORS[item.thread_status] || 'bg-slate-100 text-slate-600')}>
                            {capitalize(item.thread_status)}
                          </span>
                        </TD>
                        <TD><span className="text-sm text-slate-700">{item.reply_count ?? 0}</span></TD>
                        <TD>
                          {item.is_pinned ? <Pin className="w-4 h-4 text-amber-500" /> : <span className="text-slate-300">--</span>}
                        </TD>
                        <TD><span className="text-sm text-slate-500">{item.created_at ? fromNow(item.created_at) : '--'}</span></TD>
                        <TD className="text-right">
                          {actionState ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                          ) : thrShowTrash ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => handleThrRestore(item.id)}>
                                <RotateCcw className="w-4 h-4" /> Restore
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => handleThrPermanentDelete(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-48">
                              <DropdownItem icon={Eye} onClick={() => openThrView(item.id)}>View</DropdownItem>
                              <DropdownItem icon={Edit2} onClick={() => openThrEdit(item)}>Edit</DropdownItem>
                              <DropdownDivider />
                              <DropdownItem icon={Lock} onClick={() => handleThrClose(item.id)}>Close Thread</DropdownItem>
                              <DropdownItem icon={CheckCheck} onClick={() => handleThrResolve(item.id)}>Resolve Thread</DropdownItem>
                              <DropdownItem icon={Pin} onClick={() => handleThrPin(item.id)}>{item.is_pinned ? 'Unpin' : 'Pin'}</DropdownItem>
                              <DropdownDivider />
                              <DropdownItem icon={Trash2} danger onClick={() => handleThrSoftDelete(item.id)}>Delete</DropdownItem>
                            </Dropdown>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {thrTotal > thrPageSize && (
            <div className="mt-4">
              <Pagination
                page={thrPage}
                totalPages={Math.ceil(thrTotal / thrPageSize)}
                total={thrTotal}
                pageSize={thrPageSize}
                onPageChange={setThrPage}
                onPageSizeChange={(s: number) => { setThrPageSize(s); setThrPage(1); }}
              />
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB 2 — REPLIES                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'replies' && (
        <>
          {/* Toolbar */}
          <DataToolbar
            ref={repToolbarRef}
            search={repSearch}
            onSearchChange={(v: string) => { setRepSearch(v); setRepPage(1); }}
            searchPlaceholder="Search replies..."
          >
            <div className="flex items-center gap-2">
              <Input
                placeholder="Thread ID"
                className="w-28 h-10"
                value={repThreadFilter}
                onChange={(e: any) => { setRepThreadFilter(e.target.value); setRepPage(1); }}
              />
              <select className={selectClass} value={repAcceptedFilter} onChange={e => { setRepAcceptedFilter(e.target.value); setRepPage(1); }}>
                <option value="">All Answers</option>
                <option value="true">Accepted Only</option>
                <option value="false">Not Accepted</option>
              </select>
              <select className={selectClass} value={repInstructorFilter} onChange={e => { setRepInstructorFilter(e.target.value); setRepPage(1); }}>
                <option value="">All Authors</option>
                <option value="true">Instructor Only</option>
                <option value="false">Student Only</option>
              </select>
              <Button variant={repShowTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setRepShowTrash(!repShowTrash); setRepPage(1); }}>
                <Trash2 className="w-4 h-4" />
                Trash
                {repTrashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{repTrashCount}</span>}
              </Button>
            </div>
          </DataToolbar>

          {/* Table */}
          {repLoading ? (
            <div className="space-y-3 mt-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : repData.length === 0 ? (
            <EmptyState
              icon={Reply}
              title={repShowTrash ? 'Trash is empty' : 'No replies found'}
              description={repShowTrash ? 'No deleted replies found' : 'Discussion replies will appear here once posted'}
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="cursor-pointer" onClick={() => toggleRepSort('id')}>
                      <div className="flex items-center gap-1">ID <RepSortIcon field="id" /></div>
                    </TH>
                    <TH className="cursor-pointer" onClick={() => toggleRepSort('thread_id')}>
                      <div className="flex items-center gap-1">THREAD <RepSortIcon field="thread_id" /></div>
                    </TH>
                    <TH className="cursor-pointer" onClick={() => toggleRepSort('author_id')}>
                      <div className="flex items-center gap-1">AUTHOR <RepSortIcon field="author_id" /></div>
                    </TH>
                    <TH>BODY</TH>
                    <TH className="cursor-pointer" onClick={() => toggleRepSort('is_accepted_answer')}>
                      <div className="flex items-center gap-1">ACCEPTED <RepSortIcon field="is_accepted_answer" /></div>
                    </TH>
                    <TH>INSTRUCTOR</TH>
                    <TH>UPVOTES</TH>
                    <TH className="cursor-pointer" onClick={() => toggleRepSort('created_at')}>
                      <div className="flex items-center gap-1">CREATED <RepSortIcon field="created_at" /></div>
                    </TH>
                    <TH className="text-right">ACTIONS</TH>
                  </TR>
                </THead>
                <TBody>
                  {repData.map((item) => {
                    const actionState = repActionLoaders[item.id];
                    const threadTitle = item.discussion_threads?.title || `Thread #${item.thread_id}`;
                    const authorName = item.users?.full_name || item.users?.email || `User #${item.author_id}`;
                    const bodyPreview = item.body && item.body.length > 80 ? item.body.substring(0, 80) + '...' : item.body || '--';
                    return (
                      <TR key={item.id}>
                        <TD>
                          <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">#{item.id}</code>
                        </TD>
                        <TD>
                          <div className="text-sm font-medium text-slate-900 truncate max-w-[160px]">{threadTitle}</div>
                        </TD>
                        <TD>
                          <div className="text-sm font-medium text-slate-900 truncate max-w-[120px]">{authorName}</div>
                        </TD>
                        <TD>
                          <div className="text-sm text-slate-600 truncate max-w-[200px]">{bodyPreview}</div>
                        </TD>
                        <TD>
                          {item.is_accepted_answer ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-slate-300">--</span>}
                        </TD>
                        <TD>
                          {item.is_instructor_reply ? (
                            <Badge variant="info">Instructor</Badge>
                          ) : <span className="text-slate-300">--</span>}
                        </TD>
                        <TD><span className="text-sm text-slate-700">{item.upvote_count ?? 0}</span></TD>
                        <TD><span className="text-sm text-slate-500">{item.created_at ? fromNow(item.created_at) : '--'}</span></TD>
                        <TD className="text-right">
                          {actionState ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                          ) : repShowTrash ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => handleRepRestore(item.id)}>
                                <RotateCcw className="w-4 h-4" /> Restore
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => handleRepPermanentDelete(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-48">
                              <DropdownItem icon={Eye} onClick={() => openRepView(item.id)}>View</DropdownItem>
                              <DropdownItem icon={Edit2} onClick={() => openRepEdit(item)}>Edit</DropdownItem>
                              <DropdownDivider />
                              <DropdownItem icon={CheckCheck} onClick={() => handleRepAccept(item.id)}>Accept Answer</DropdownItem>
                              <DropdownDivider />
                              <DropdownItem icon={Trash2} danger onClick={() => handleRepSoftDelete(item.id)}>Delete</DropdownItem>
                            </Dropdown>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {repTotal > repPageSize && (
            <div className="mt-4">
              <Pagination
                page={repPage}
                totalPages={Math.ceil(repTotal / repPageSize)}
                total={repTotal}
                pageSize={repPageSize}
                onPageChange={setRepPage}
                onPageSizeChange={(s: number) => { setRepPageSize(s); setRepPage(1); }}
              />
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* THREADS — DIALOGS                                          */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* ═══ VIEW THREAD DIALOG ═══ */}
      <Dialog open={thrViewOpen} onClose={() => setThrViewOpen(false)} title="Thread Details" size="lg">
        {thrViewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : thrViewItem ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{thrViewItem.title || '--'}</h3>
              <div className="flex items-center gap-2">
                <span className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium', THREAD_STATUS_COLORS[thrViewItem.thread_status] || 'bg-slate-100 text-slate-600')}>
                  {capitalize(thrViewItem.thread_status)}
                </span>
                <span className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium', ITEM_TYPE_COLORS[thrViewItem.item_type] || 'bg-slate-100 text-slate-600')}>
                  {capitalize(thrViewItem.item_type)}
                </span>
                {thrViewItem.is_pinned && <Pin className="w-4 h-4 text-amber-500" />}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Thread ID" value={`#${thrViewItem.id}`} />
              <DetailRow label="Author" value={thrViewItem.users?.full_name || thrViewItem.users?.email || `User #${thrViewItem.author_id}`} />
              <DetailRow label="Item Type" value={capitalize(thrViewItem.item_type || '')} />
              <DetailRow label="Item ID" value={thrViewItem.item_id?.toString()} />
              <DetailRow label="Status" value={capitalize(thrViewItem.thread_status || '')} />
              <DetailRow label="Reply Count" value={thrViewItem.reply_count?.toString() ?? '0'} />
              <DetailRow label="Pinned" value={thrViewItem.is_pinned ? 'Yes' : 'No'} />
              <DetailRow label="Created" value={thrViewItem.created_at ? fromNow(thrViewItem.created_at) : '--'} />
              <DetailRow label="Updated" value={thrViewItem.updated_at ? fromNow(thrViewItem.updated_at) : '--'} />
            </dl>
            {thrViewItem.body && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Body</h4>
                <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 whitespace-pre-wrap">
                  {thrViewItem.body}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ CREATE THREAD DIALOG ═══ */}
      <Dialog open={thrCreateOpen} onClose={() => setThrCreateOpen(false)} title="Create Thread" size="md">
        <form onSubmit={handleThrCreate(onThrCreate)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
            <Input placeholder="Enter thread title" {...regThrCreate('title', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Body</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Thread body content..."
              {...regThrCreate('body')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Item Type</label>
              <select className={cn(selectClass, 'w-full')} {...regThrCreate('item_type')}>
                {ITEM_TYPES.filter(t => t.value !== '').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Item ID</label>
              <Input type="number" placeholder="Enter item ID" {...regThrCreate('item_id')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Author ID *</label>
              <Input type="number" placeholder="Enter author user ID" {...regThrCreate('author_id', { required: true })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select className={cn(selectClass, 'w-full')} {...regThrCreate('thread_status')}>
                {THREAD_STATUSES.filter(s => s.value !== '').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="thr-create-pinned" className="rounded border-slate-300" {...regThrCreate('is_pinned')} />
            <label htmlFor="thr-create-pinned" className="text-sm text-slate-700">Pin this thread</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setThrCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={thrCreating}>Create Thread</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ EDIT THREAD DIALOG ═══ */}
      <Dialog open={thrEditOpen} onClose={() => setThrEditOpen(false)} title="Edit Thread" size="md">
        <form onSubmit={handleThrEdit(onThrSaveEdit)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
            <Input placeholder="Enter thread title" {...regThrEdit('title', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Body</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Thread body content..."
              {...regThrEdit('body')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Item Type</label>
              <select className={cn(selectClass, 'w-full')} {...regThrEdit('item_type')}>
                {ITEM_TYPES.filter(t => t.value !== '').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Item ID</label>
              <Input type="number" placeholder="Enter item ID" {...regThrEdit('item_id')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select className={cn(selectClass, 'w-full')} {...regThrEdit('thread_status')}>
              {THREAD_STATUSES.filter(s => s.value !== '').map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="thr-edit-pinned" className="rounded border-slate-300" {...regThrEdit('is_pinned')} />
            <label htmlFor="thr-edit-pinned" className="text-sm text-slate-700">Pin this thread</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setThrEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={thrSaving}>Update Thread</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* REPLIES — DIALOGS                                          */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* ═══ VIEW REPLY DIALOG ═══ */}
      <Dialog open={repViewOpen} onClose={() => setRepViewOpen(false)} title="Reply Details" size="lg">
        {repViewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : repViewItem ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <code className="text-lg font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded">Reply #{repViewItem.id}</code>
              {repViewItem.is_accepted_answer && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accepted Answer
                </span>
              )}
              {repViewItem.is_instructor_reply && (
                <Badge variant="info">Instructor</Badge>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Reply ID" value={`#${repViewItem.id}`} />
              <DetailRow label="Thread" value={repViewItem.discussion_threads?.title || `Thread #${repViewItem.thread_id}`} />
              <DetailRow label="Author" value={repViewItem.users?.full_name || repViewItem.users?.email || `User #${repViewItem.author_id}`} />
              <DetailRow label="Parent Reply ID" value={repViewItem.parent_reply_id?.toString() || '--'} />
              <DetailRow label="Upvotes" value={repViewItem.upvote_count?.toString() ?? '0'} />
              <DetailRow label="Accepted Answer" value={repViewItem.is_accepted_answer ? 'Yes' : 'No'} />
              <DetailRow label="Instructor Reply" value={repViewItem.is_instructor_reply ? 'Yes' : 'No'} />
              <DetailRow label="Created" value={repViewItem.created_at ? fromNow(repViewItem.created_at) : '--'} />
              <DetailRow label="Updated" value={repViewItem.updated_at ? fromNow(repViewItem.updated_at) : '--'} />
            </dl>
            {repViewItem.body && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Body</h4>
                <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-700 whitespace-pre-wrap">
                  {repViewItem.body}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ CREATE REPLY DIALOG ═══ */}
      <Dialog open={repCreateOpen} onClose={() => setRepCreateOpen(false)} title="Create Reply" size="md">
        <form onSubmit={handleRepCreate(onRepCreate)} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Thread ID *</label>
              <Input type="number" placeholder="Enter thread ID" {...regRepCreate('thread_id', { required: true })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Parent Reply ID</label>
              <Input type="number" placeholder="Optional (nested reply)" {...regRepCreate('parent_reply_id')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Author ID *</label>
            <Input type="number" placeholder="Enter author user ID" {...regRepCreate('author_id', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Body *</label>
            <textarea
              className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Reply content..."
              {...regRepCreate('body', { required: true })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="rep-create-instructor" className="rounded border-slate-300" {...regRepCreate('is_instructor_reply')} />
            <label htmlFor="rep-create-instructor" className="text-sm text-slate-700">Instructor reply</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setRepCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={repCreating}>Create Reply</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ EDIT REPLY DIALOG ═══ */}
      <Dialog open={repEditOpen} onClose={() => setRepEditOpen(false)} title="Edit Reply" size="md">
        <form onSubmit={handleRepEdit(onRepSaveEdit)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Body *</label>
            <textarea
              className="w-full h-32 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Reply content..."
              {...regRepEdit('body', { required: true })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="rep-edit-instructor" className="rounded border-slate-300" {...regRepEdit('is_instructor_reply')} />
            <label htmlFor="rep-edit-instructor" className="text-sm text-slate-700">Instructor reply</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setRepEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={repSaving}>Update Reply</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
