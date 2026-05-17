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
  Loader2, X, MoreVertical, Video, Users, Calendar, Play,
  Square, Ban, Clock, Film,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type ActiveTab = 'sessions' | 'attendance' | 'recordings';
type SessionSortField = 'id' | 'title' | 'item_type' | 'session_status' | 'scheduled_at' | 'created_at';
type AttendanceSortField = 'id' | 'session_id' | 'user_id' | 'attendance_status' | 'created_at';
type RecordingSortField = 'id' | 'session_id' | 'title' | 'recording_status' | 'created_at';

const ITEM_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'course', label: 'Course' },
  { value: 'batch', label: 'Batch' },
  { value: 'webinar', label: 'Webinar' },
];

const SESSION_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rescheduled', label: 'Rescheduled' },
];

const SESSION_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700',
  live: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-700',
  rescheduled: 'bg-amber-50 text-amber-700',
};

const ATTENDANCE_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'registered', label: 'Registered' },
  { value: 'attended', label: 'Attended' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'left_early', label: 'Left Early' },
];

const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  registered: 'bg-blue-50 text-blue-700',
  attended: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
  left_early: 'bg-orange-50 text-orange-700',
};

const RECORDING_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
  { value: 'deleted', label: 'Deleted' },
];

const RECORDING_STATUS_COLORS: Record<string, string> = {
  processing: 'bg-amber-50 text-amber-700',
  ready: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  deleted: 'bg-slate-100 text-slate-600',
};

const PLATFORMS = [
  { value: '', label: 'All Platforms' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'other', label: 'Other' },
];

const ITEM_TYPE_COLORS: Record<string, string> = {
  course: 'bg-blue-50 text-blue-700',
  batch: 'bg-cyan-50 text-cyan-700',
  webinar: 'bg-rose-50 text-rose-700',
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDateTime(d: string | null) {
  if (!d) return '--';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE — 3-TAB LAYOUT
// ══════════════════════════════════════════════════════════════════
export default function LiveClassesPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sessions');

  // ── Stats ──
  const [stats, setStats] = useState({ total: 0, scheduled: 0, live: 0, completed: 0 });
  const fetchStats = useCallback(async () => {
    try {
      const [all, sched, live, comp] = await Promise.all([
        api.getLiveSessions({ limit: 1 }),
        api.getLiveSessions({ limit: 1, session_status: 'scheduled' }),
        api.getLiveSessions({ limit: 1, session_status: 'live' }),
        api.getLiveSessions({ limit: 1, session_status: 'completed' }),
      ]);
      setStats({
        total: all.pagination?.total || 0,
        scheduled: sched.pagination?.total || 0,
        live: live.pagination?.total || 0,
        completed: comp.pagination?.total || 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Live Classes" />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Sessions', value: stats.total, icon: Calendar, color: 'bg-blue-50 text-blue-600' },
          { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'bg-blue-50 text-blue-600' },
          { label: 'Live Now', value: stats.live, icon: Play, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'bg-slate-100 text-slate-600' },
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

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'sessions' as ActiveTab, label: 'Sessions', icon: Video },
          { id: 'attendance' as ActiveTab, label: 'Attendance', icon: Users },
          { id: 'recordings' as ActiveTab, label: 'Recordings', icon: Film },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
                activeTab === tab.id ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'sessions' && <SessionsTab onStatsChange={fetchStats} />}
      {activeTab === 'attendance' && <AttendanceTab />}
      {activeTab === 'recordings' && <RecordingsTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: SESSIONS
// ══════════════════════════════════════════════════════════════════
function SessionsTab({ onStatsChange }: { onStatsChange: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [sort, setSort] = useState<SessionSortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, watch } = useForm();
  const isRecurring = watch('is_recurring');

  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: pageSize, sort, ascending: asc, search };
      if (showTrash) params.show_deleted = true;
      if (statusFilter) params.session_status = statusFilter;
      if (typeFilter) params.item_type = typeFilter;
      const res = await api.getLiveSessions(params);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load sessions'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, statusFilter, typeFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.getLiveSessions({ show_deleted: true, limit: 1 });
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  function toggleSort(field: SessionSortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: SessionSortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  function openForm(item?: any) {
    if (item) {
      setEditing(item);
      reset({
        title: item.title || '',
        description: item.description || '',
        item_type: item.item_type || '',
        item_id: item.item_id || '',
        instructor_id: item.instructor_id || '',
        session_status: item.session_status || 'scheduled',
        scheduled_at: item.scheduled_at ? item.scheduled_at.slice(0, 16) : '',
        duration_minutes: item.duration_minutes || 60,
        meeting_platform: item.meeting_platform || '',
        meeting_url: item.meeting_url || '',
        meeting_id: item.meeting_id || '',
        meeting_password: item.meeting_password || '',
        max_attendees: item.max_attendees || '',
        is_recurring: item.is_recurring || false,
        recurrence_rule: item.recurrence_rule ? JSON.stringify(item.recurrence_rule) : '',
        parent_session_id: item.parent_session_id || '',
      });
    } else {
      setEditing(null);
      reset({
        title: '', description: '', item_type: '', item_id: '', instructor_id: '',
        session_status: 'scheduled', scheduled_at: '', duration_minutes: 60,
        meeting_platform: '', meeting_url: '', meeting_id: '', meeting_password: '',
        max_attendees: '', is_recurring: false, recurrence_rule: '', parent_session_id: '',
      });
    }
    setFormOpen(true);
  }

  async function onSave(formData: any) {
    setSaving(true);
    try {
      const body = { ...formData };
      if (body.scheduled_at) body.scheduled_at = new Date(body.scheduled_at).toISOString();
      else body.scheduled_at = null;
      if (!body.item_id) body.item_id = null;
      if (!body.instructor_id) body.instructor_id = null;
      if (!body.max_attendees) body.max_attendees = null;
      if (!body.parent_session_id) body.parent_session_id = null;
      body.duration_minutes = Number(body.duration_minutes) || 60;
      if (body.recurrence_rule) {
        try { body.recurrence_rule = JSON.parse(body.recurrence_rule); } catch { /* keep as string */ }
      } else { body.recurrence_rule = null; }

      if (editing) {
        await api.updateLiveSession(editing.id, body);
        toast.success('Session updated');
      } else {
        await api.createLiveSession(body);
        toast.success('Session created');
      }
      setFormOpen(false);
      fetchData();
      fetchTrashCount();
      onStatsChange();
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  }

  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getLiveSession(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load session'); }
    setViewLoading(false);
  }

  async function handleStart(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'starting' }));
    try { await api.startLiveSession(id); toast.success('Session started'); fetchData(); onStatsChange(); }
    catch { toast.error('Failed to start session'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleEnd(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'ending' }));
    try { await api.endLiveSession(id); toast.success('Session ended'); fetchData(); onStatsChange(); }
    catch { toast.error('Failed to end session'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleCancel(id: number) {
    if (!confirm('Cancel this session?')) return;
    setActionLoaders(p => ({ ...p, [id]: 'cancelling' }));
    try { await api.cancelLiveSession(id); toast.success('Session cancelled'); fetchData(); onStatsChange(); }
    catch { toast.error('Failed to cancel session'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  function openReschedule(id: number) {
    setRescheduleId(id);
    setRescheduleDate('');
    setRescheduleOpen(true);
  }

  async function handleReschedule() {
    if (!rescheduleId || !rescheduleDate) return;
    setRescheduleSaving(true);
    try {
      await api.rescheduleLiveSession(rescheduleId, { scheduled_at: new Date(rescheduleDate).toISOString() });
      toast.success('Session rescheduled');
      setRescheduleOpen(false);
      fetchData();
      onStatsChange();
    } catch { toast.error('Failed to reschedule'); }
    setRescheduleSaving(false);
  }

  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteLiveSession(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); onStatsChange(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreLiveSession(id); toast.success('Restored'); fetchData(); fetchTrashCount(); onStatsChange(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this session? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeleteLiveSession(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); onStatsChange(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <>
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search sessions..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            {ITEM_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            {SESSION_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button variant={showTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
            <Trash2 className="w-4 h-4" />
            Trash
            {trashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </Button>
          {!showTrash && (
            <Button size="sm" onClick={() => openForm()}>
              <Plus className="w-4 h-4" /> Add Session
            </Button>
          )}
        </div>
      </DataToolbar>

      {loading ? (
        <div className="space-y-3 mt-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={Video} title={showTrash ? 'Trash is empty' : 'No sessions yet'} description={showTrash ? 'No deleted sessions found' : 'Create your first live session to get started'} />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12">#</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('id')}><div className="flex items-center gap-1">ID <SortIcon field="id" /></div></TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('title')}><div className="flex items-center gap-1">TITLE <SortIcon field="title" /></div></TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('item_type')}><div className="flex items-center gap-1">TYPE <SortIcon field="item_type" /></div></TH>
                <TH>ITEM ID</TH>
                <TH>INSTRUCTOR</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('session_status')}><div className="flex items-center gap-1">STATUS <SortIcon field="session_status" /></div></TH>
                <TH>PLATFORM</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('scheduled_at')}><div className="flex items-center gap-1">SCHEDULED AT <SortIcon field="scheduled_at" /></div></TH>
                <TH>DURATION</TH>
                <TH>RECURRING</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}><div className="flex items-center gap-1">CREATED <SortIcon field="created_at" /></div></TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item, idx) => {
                const actionState = actionLoaders[item.id];
                return (
                  <TR key={item.id}>
                    <TD className="text-slate-400 text-xs">{(page - 1) * pageSize + idx + 1}</TD>
                    <TD><span className="text-sm font-medium text-slate-900">{item.id}</span></TD>
                    <TD><div className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{item.title || '--'}</div></TD>
                    <TD>
                      {item.item_type ? (
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', ITEM_TYPE_COLORS[item.item_type] || 'bg-slate-100 text-slate-600')}>
                          {capitalize(item.item_type)}
                        </span>
                      ) : <span className="text-xs text-slate-400">--</span>}
                    </TD>
                    <TD><span className="text-sm text-slate-700">{item.item_id || '--'}</span></TD>
                    <TD><span className="text-sm text-slate-700">{item.instructor?.name || item.instructor_id || '--'}</span></TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', SESSION_STATUS_COLORS[item.session_status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.session_status || '')}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-700">{capitalize(item.meeting_platform || '')}</span></TD>
                    <TD><span className="text-sm text-slate-600">{formatDateTime(item.scheduled_at)}</span></TD>
                    <TD><span className="text-sm text-slate-700">{item.duration_minutes ? `${item.duration_minutes} min` : '--'}</span></TD>
                    <TD>{item.is_recurring ? <Badge variant="info">Recurring</Badge> : <span className="text-xs text-slate-400">No</span>}</TD>
                    <TD><span className="text-sm text-slate-500">{fromNow(item.created_at)}</span></TD>
                    <TD className="text-right">
                      {actionState ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                      ) : showTrash ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleRestore(item.id)}><RotateCcw className="w-4 h-4" /> Restore</Button>
                          <Button variant="danger" size="sm" onClick={() => handlePermanentDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-48">
                          <DropdownItem icon={Eye} onClick={() => openView(item.id)}>View</DropdownItem>
                          <DropdownItem icon={Edit2} onClick={() => openForm(item)}>Edit</DropdownItem>
                          <DropdownDivider />
                          {item.session_status === 'scheduled' && <DropdownItem icon={Play} onClick={() => handleStart(item.id)}>Start Session</DropdownItem>}
                          {item.session_status === 'live' && <DropdownItem icon={Square} onClick={() => handleEnd(item.id)}>End Session</DropdownItem>}
                          <DropdownItem icon={Ban} onClick={() => handleCancel(item.id)}>Cancel Session</DropdownItem>
                          <DropdownItem icon={Clock} onClick={() => openReschedule(item.id)}>Reschedule</DropdownItem>
                          <DropdownDivider />
                          <DropdownItem icon={Trash2} danger onClick={() => handleSoftDelete(item.id)}>Delete</DropdownItem>
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

      {total > pageSize && (
        <div className="mt-4">
          <Pagination page={page} totalPages={Math.ceil(total / pageSize)} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }} />
        </div>
      )}

      {/* ═══ SESSION CREATE/EDIT DIALOG ═══ */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Session' : 'Create Session'} size="lg">
        <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
              <Input {...register('title', { required: true })} placeholder="Session title" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
              <textarea {...register('description')} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" placeholder="Session description..." />
            </div>
            {/* Phase 44 — these 5 columns are NOT NULL in live_sessions
                (no DB defaults). Marking the inputs as `required` blocks
                the submit until they're filled, so we never POST a row
                that Supabase would reject for constraint violation. */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Item Type <span className="text-rose-500">*</span></label>
              <select {...register('item_type', { required: true })} required className={selectClass + ' w-full'}>
                <option value="">Select type</option>
                <option value="course">Course</option>
                <option value="batch">Batch</option>
                <option value="webinar">Webinar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Item ID <span className="text-rose-500">*</span></label>
              <Input {...register('item_id', { required: true })} required type="number" min={1} placeholder="Item ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Instructor ID <span className="text-rose-500">*</span></label>
              <Input {...register('instructor_id', { required: true })} required type="number" min={1} placeholder="Instructor ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select {...register('session_status')} className={selectClass + ' w-full'}>
                <option value="scheduled">Scheduled</option>
                <option value="live">Live</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="rescheduled">Rescheduled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Scheduled At <span className="text-rose-500">*</span></label>
              <Input {...register('scheduled_at', { required: true })} required type="datetime-local" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (minutes)</label>
              <Input {...register('duration_minutes')} type="number" placeholder="60" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Platform</label>
              <select {...register('meeting_platform')} className={selectClass + ' w-full'}>
                <option value="">Select platform</option>
                <option value="zoom">Zoom</option>
                <option value="google_meet">Google Meet</option>
                <option value="teams">Microsoft Teams</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Max Attendees</label>
              <Input {...register('max_attendees')} type="number" placeholder="Max attendees" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Meeting URL</label>
              <Input {...register('meeting_url')} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Meeting ID</label>
              <Input {...register('meeting_id')} placeholder="Meeting ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Meeting Password</label>
              <Input {...register('meeting_password')} placeholder="Password" />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input {...register('is_recurring')} type="checkbox" className="rounded border-slate-300" />
              <label className="text-sm font-medium text-slate-700">Is Recurring</label>
            </div>
            {isRecurring && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Recurrence Rule (JSON)</label>
                <textarea {...register('recurrence_rule')} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" placeholder='{"frequency": "weekly", "days": ["Mon", "Wed"]}' />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Parent Session ID</label>
              <Input {...register('parent_session_id')} type="number" placeholder="Optional" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ SESSION VIEW DIALOG ═══
           Phase 44.1 — Dialog body has no built-in padding (see
           components/ui/Dialog.tsx — the inner `max-h…overflow-y-auto`
           div has no `p-*`). Every other admin page wraps its detail
           view in `p-6 space-y-5` (see enrollments/page.tsx:533). The
           three view dialogs on this page were missing that wrapper,
           so the grid sat flush against the modal edges. Adding the
           wrapper matches the canonical pattern. */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Session Details" size="lg">
        {viewLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 rounded" />)}</div>
        ) : viewItem ? (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <DetailRow label="ID" value={String(viewItem.id)} />
              <DetailRow label="Title" value={viewItem.title} />
              <DetailRow label="Description" value={viewItem.description} />
              <DetailRow label="Item Type" value={capitalize(viewItem.item_type || '')} />
              <DetailRow label="Item ID" value={String(viewItem.item_id || '--')} />
              <DetailRow label="Instructor" value={viewItem.instructor?.name || String(viewItem.instructor_id || '--')} />
              <DetailRow label="Status" value={capitalize(viewItem.session_status || '')} />
              <DetailRow label="Platform" value={capitalize(viewItem.meeting_platform || '')} />
              <DetailRow label="Scheduled At" value={formatDateTime(viewItem.scheduled_at)} />
              <DetailRow label="Duration" value={viewItem.duration_minutes ? `${viewItem.duration_minutes} min` : '--'} />
              <DetailRow label="Meeting URL" value={viewItem.meeting_url} />
              <DetailRow label="Meeting ID" value={viewItem.meeting_id} />
              <DetailRow label="Meeting Password" value={viewItem.meeting_password} />
              <DetailRow label="Max Attendees" value={String(viewItem.max_attendees || '--')} />
              <DetailRow label="Recurring" value={viewItem.is_recurring ? 'Yes' : 'No'} />
              <DetailRow label="Recurrence Rule" value={viewItem.recurrence_rule ? JSON.stringify(viewItem.recurrence_rule) : '--'} />
              <DetailRow label="Parent Session ID" value={String(viewItem.parent_session_id || '--')} />
              <DetailRow label="Created" value={fromNow(viewItem.created_at)} />
              <DetailRow label="Updated" value={fromNow(viewItem.updated_at)} />
            </div>
          </div>
        ) : null}
      </Dialog>

      {/* ═══ RESCHEDULE DIALOG ═══ */}
      <Dialog open={rescheduleOpen} onClose={() => setRescheduleOpen(false)} title="Reschedule Session" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Date & Time</label>
            <Input type="datetime-local" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Cancel</Button>
            <Button onClick={handleReschedule} disabled={!rescheduleDate || rescheduleSaving}>
              {rescheduleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Reschedule
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: ATTENDANCE
// ══════════════════════════════════════════════════════════════════
function AttendanceTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [sort, setSort] = useState<AttendanceSortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [markOpen, setMarkOpen] = useState(false);
  const [markSaving, setMarkSaving] = useState(false);
  const { register: markRegister, handleSubmit: markHandleSubmit, reset: markReset } = useForm();

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: pageSize, sort, ascending: asc, search };
      if (showTrash) params.show_deleted = true;
      if (statusFilter) params.attendance_status = statusFilter;
      const res = await api.getSessionAttendances(params);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load attendance'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, statusFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.getSessionAttendances({ show_deleted: true, limit: 1 });
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  function toggleSort(field: AttendanceSortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: AttendanceSortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  function openForm(item?: any) {
    if (item) {
      setEditing(item);
      reset({
        session_id: item.session_id || '',
        user_id: item.user_id || '',
        attendance_status: item.attendance_status || 'registered',
        joined_at: item.joined_at ? item.joined_at.slice(0, 16) : '',
        left_at: item.left_at ? item.left_at.slice(0, 16) : '',
        duration_attended: item.duration_attended || '',
        feedback: item.feedback || '',
        rating: item.rating || '',
      });
    } else {
      setEditing(null);
      reset({
        session_id: '', user_id: '', attendance_status: 'registered',
        joined_at: '', left_at: '', duration_attended: '', feedback: '', rating: '',
      });
    }
    setFormOpen(true);
  }

  async function onSave(formData: any) {
    setSaving(true);
    try {
      const body = { ...formData };
      if (body.joined_at) body.joined_at = new Date(body.joined_at).toISOString(); else body.joined_at = null;
      if (body.left_at) body.left_at = new Date(body.left_at).toISOString(); else body.left_at = null;
      if (!body.duration_attended) body.duration_attended = null; else body.duration_attended = Number(body.duration_attended);
      if (!body.rating) body.rating = null; else body.rating = Number(body.rating);
      body.session_id = Number(body.session_id);
      body.user_id = Number(body.user_id);

      if (editing) {
        await api.updateSessionAttendance(editing.id, body);
        toast.success('Attendance updated');
      } else {
        await api.createSessionAttendance(body);
        toast.success('Attendance created');
      }
      setFormOpen(false);
      fetchData();
      fetchTrashCount();
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  }

  async function onMarkAttendance(formData: any) {
    setMarkSaving(true);
    try {
      const body = {
        session_id: Number(formData.session_id),
        user_id: Number(formData.user_id),
        attendance_status: formData.attendance_status || 'attended',
      };
      await api.markSessionAttendance(body);
      toast.success('Attendance marked');
      setMarkOpen(false);
      fetchData();
    } catch (e: any) { toast.error(e.message || 'Failed to mark attendance'); }
    setMarkSaving(false);
  }

  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getSessionAttendance(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load attendance record'); }
    setViewLoading(false);
  }

  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteSessionAttendance(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreSessionAttendance(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this attendance record? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeleteSessionAttendance(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <>
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search attendance..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            {ATTENDANCE_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button variant={showTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
            <Trash2 className="w-4 h-4" />
            Trash
            {trashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </Button>
          {!showTrash && (
            <>
              <Button variant="outline" size="sm" onClick={() => { markReset({ session_id: '', user_id: '', attendance_status: 'attended' }); setMarkOpen(true); }}>
                <CheckCircle2 className="w-4 h-4" /> Mark Attendance
              </Button>
              <Button size="sm" onClick={() => openForm()}>
                <Plus className="w-4 h-4" /> Add Record
              </Button>
            </>
          )}
        </div>
      </DataToolbar>

      {loading ? (
        <div className="space-y-3 mt-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={Users} title={showTrash ? 'Trash is empty' : 'No attendance records yet'} description={showTrash ? 'No deleted records found' : 'Attendance records will appear here'} />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12">#</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('id')}><div className="flex items-center gap-1">ID <SortIcon field="id" /></div></TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('session_id')}><div className="flex items-center gap-1">SESSION <SortIcon field="session_id" /></div></TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('user_id')}><div className="flex items-center gap-1">USER <SortIcon field="user_id" /></div></TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('attendance_status')}><div className="flex items-center gap-1">STATUS <SortIcon field="attendance_status" /></div></TH>
                <TH>JOINED AT</TH>
                <TH>LEFT AT</TH>
                <TH>DURATION</TH>
                <TH>RATING</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}><div className="flex items-center gap-1">CREATED <SortIcon field="created_at" /></div></TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item, idx) => {
                const actionState = actionLoaders[item.id];
                return (
                  <TR key={item.id}>
                    <TD className="text-slate-400 text-xs">{(page - 1) * pageSize + idx + 1}</TD>
                    <TD><span className="text-sm font-medium text-slate-900">{item.id}</span></TD>
                    <TD><span className="text-sm text-slate-700">{item.session?.title || `#${item.session_id}`}</span></TD>
                    <TD><span className="text-sm text-slate-700">{item.user?.name || `#${item.user_id}`}</span></TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', ATTENDANCE_STATUS_COLORS[item.attendance_status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.attendance_status || '')}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-600">{formatDateTime(item.joined_at)}</span></TD>
                    <TD><span className="text-sm text-slate-600">{formatDateTime(item.left_at)}</span></TD>
                    <TD><span className="text-sm text-slate-700">{item.duration_attended ? `${item.duration_attended} min` : '--'}</span></TD>
                    <TD>
                      {item.rating ? (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={cn('text-xs', i < item.rating ? 'text-amber-400' : 'text-slate-200')}>&#9733;</span>
                          ))}
                        </div>
                      ) : <span className="text-xs text-slate-400">--</span>}
                    </TD>
                    <TD><span className="text-sm text-slate-500">{fromNow(item.created_at)}</span></TD>
                    <TD className="text-right">
                      {actionState ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                      ) : showTrash ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleRestore(item.id)}><RotateCcw className="w-4 h-4" /> Restore</Button>
                          <Button variant="danger" size="sm" onClick={() => handlePermanentDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-44">
                          <DropdownItem icon={Eye} onClick={() => openView(item.id)}>View</DropdownItem>
                          <DropdownItem icon={Edit2} onClick={() => openForm(item)}>Edit</DropdownItem>
                          <DropdownDivider />
                          <DropdownItem icon={Trash2} danger onClick={() => handleSoftDelete(item.id)}>Delete</DropdownItem>
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

      {total > pageSize && (
        <div className="mt-4">
          <Pagination page={page} totalPages={Math.ceil(total / pageSize)} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }} />
        </div>
      )}

      {/* ═══ ATTENDANCE CREATE/EDIT DIALOG ═══ */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Attendance' : 'Create Attendance'} size="md">
        <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Session ID *</label>
              <Input {...register('session_id', { required: true })} type="number" placeholder="Session ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">User ID *</label>
              <Input {...register('user_id', { required: true })} type="number" placeholder="User ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select {...register('attendance_status')} className={selectClass + ' w-full'}>
                <option value="registered">Registered</option>
                <option value="attended">Attended</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="left_early">Left Early</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Joined At</label>
              <Input {...register('joined_at')} type="datetime-local" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Left At</label>
              <Input {...register('left_at')} type="datetime-local" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (minutes)</label>
              <Input {...register('duration_attended')} type="number" placeholder="Minutes attended" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Feedback</label>
              <textarea {...register('feedback')} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" placeholder="Feedback..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Rating</label>
              <select {...register('rating')} className={selectClass + ' w-full'}>
                <option value="">No rating</option>
                <option value="1">1 Star</option>
                <option value="2">2 Stars</option>
                <option value="3">3 Stars</option>
                <option value="4">4 Stars</option>
                <option value="5">5 Stars</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ ATTENDANCE VIEW DIALOG ═══ */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Attendance Details" size="md">
        {viewLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 rounded" />)}</div>
        ) : viewItem ? (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <DetailRow label="ID" value={String(viewItem.id)} />
              <DetailRow label="Session" value={viewItem.session?.title || `#${viewItem.session_id}`} />
              <DetailRow label="User" value={viewItem.user?.name || `#${viewItem.user_id}`} />
              <DetailRow label="Status" value={capitalize(viewItem.attendance_status || '')} />
              <DetailRow label="Joined At" value={formatDateTime(viewItem.joined_at)} />
              <DetailRow label="Left At" value={formatDateTime(viewItem.left_at)} />
              <DetailRow label="Duration Attended" value={viewItem.duration_attended ? `${viewItem.duration_attended} min` : '--'} />
              <DetailRow label="Rating" value={viewItem.rating ? `${viewItem.rating}/5` : '--'} />
              <DetailRow label="Feedback" value={viewItem.feedback} />
              <DetailRow label="Created" value={fromNow(viewItem.created_at)} />
              <DetailRow label="Updated" value={fromNow(viewItem.updated_at)} />
            </div>
          </div>
        ) : null}
      </Dialog>

      {/* ═══ MARK ATTENDANCE DIALOG ═══ */}
      <Dialog open={markOpen} onClose={() => setMarkOpen(false)} title="Mark Attendance" size="sm">
        <form onSubmit={markHandleSubmit(onMarkAttendance)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Session ID *</label>
            <Input {...markRegister('session_id', { required: true })} type="number" placeholder="Session ID" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">User ID *</label>
            <Input {...markRegister('user_id', { required: true })} type="number" placeholder="User ID" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select {...markRegister('attendance_status')} className={selectClass + ' w-full'}>
              <option value="attended">Attended</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="left_early">Left Early</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setMarkOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={markSaving}>{markSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Mark</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 3: RECORDINGS
// ══════════════════════════════════════════════════════════════════
function RecordingsTab() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [sort, setSort] = useState<RecordingSortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: pageSize, sort, ascending: asc, search };
      if (showTrash) params.show_deleted = true;
      if (statusFilter) params.recording_status = statusFilter;
      const res = await api.getSessionRecordings(params);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load recordings'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, statusFilter]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.getSessionRecordings({ show_deleted: true, limit: 1 });
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  function toggleSort(field: RecordingSortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: RecordingSortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  function openForm(item?: any) {
    if (item) {
      setEditing(item);
      reset({
        session_id: item.session_id || '',
        title: item.title || '',
        recording_url: item.recording_url || '',
        bunny_video_id: item.bunny_video_id || '',
        duration_seconds: item.duration_seconds || '',
        file_size_bytes: item.file_size_bytes || '',
        recording_status: item.recording_status || 'processing',
      });
    } else {
      setEditing(null);
      reset({
        session_id: '', title: '', recording_url: '', bunny_video_id: '',
        duration_seconds: '', file_size_bytes: '', recording_status: 'processing',
      });
    }
    setFormOpen(true);
  }

  async function onSave(formData: any) {
    setSaving(true);
    try {
      const body = { ...formData };
      body.session_id = Number(body.session_id);
      if (!body.duration_seconds) body.duration_seconds = null; else body.duration_seconds = Number(body.duration_seconds);
      if (!body.file_size_bytes) body.file_size_bytes = null; else body.file_size_bytes = Number(body.file_size_bytes);

      if (editing) {
        await api.updateSessionRecording(editing.id, body);
        toast.success('Recording updated');
      } else {
        await api.createSessionRecording(body);
        toast.success('Recording created');
      }
      setFormOpen(false);
      fetchData();
      fetchTrashCount();
    } catch (e: any) { toast.error(e.message || 'Save failed'); }
    setSaving(false);
  }

  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getSessionRecording(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load recording'); }
    setViewLoading(false);
  }

  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteSessionRecording(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreSessionRecording(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this recording? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeleteSessionRecording(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <>
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search recordings..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            {RECORDING_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button variant={showTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
            <Trash2 className="w-4 h-4" />
            Trash
            {trashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </Button>
          {!showTrash && (
            <Button size="sm" onClick={() => openForm()}>
              <Plus className="w-4 h-4" /> Add Recording
            </Button>
          )}
        </div>
      </DataToolbar>

      {loading ? (
        <div className="space-y-3 mt-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={Film} title={showTrash ? 'Trash is empty' : 'No recordings yet'} description={showTrash ? 'No deleted recordings found' : 'Recordings will appear here after sessions are recorded'} />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12">#</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('id')}><div className="flex items-center gap-1">ID <SortIcon field="id" /></div></TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('session_id')}><div className="flex items-center gap-1">SESSION <SortIcon field="session_id" /></div></TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('title')}><div className="flex items-center gap-1">TITLE <SortIcon field="title" /></div></TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('recording_status')}><div className="flex items-center gap-1">STATUS <SortIcon field="recording_status" /></div></TH>
                <TH>DURATION</TH>
                <TH>FILE SIZE</TH>
                <TH>BUNNY VIDEO ID</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}><div className="flex items-center gap-1">CREATED <SortIcon field="created_at" /></div></TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item, idx) => {
                const actionState = actionLoaders[item.id];
                return (
                  <TR key={item.id}>
                    <TD className="text-slate-400 text-xs">{(page - 1) * pageSize + idx + 1}</TD>
                    <TD><span className="text-sm font-medium text-slate-900">{item.id}</span></TD>
                    <TD><span className="text-sm text-slate-700">{item.session?.title || `#${item.session_id}`}</span></TD>
                    <TD><div className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{item.title || '--'}</div></TD>
                    <TD>
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', RECORDING_STATUS_COLORS[item.recording_status] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(item.recording_status || '')}
                      </span>
                    </TD>
                    <TD><span className="text-sm text-slate-700">{item.duration_seconds ? formatDuration(item.duration_seconds) : '--'}</span></TD>
                    <TD><span className="text-sm text-slate-700">{item.file_size_bytes ? formatFileSize(item.file_size_bytes) : '--'}</span></TD>
                    <TD>
                      {item.bunny_video_id ? (
                        <code className="text-xs text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">{item.bunny_video_id}</code>
                      ) : <span className="text-xs text-slate-400">--</span>}
                    </TD>
                    <TD><span className="text-sm text-slate-500">{fromNow(item.created_at)}</span></TD>
                    <TD className="text-right">
                      {actionState ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                      ) : showTrash ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleRestore(item.id)}><RotateCcw className="w-4 h-4" /> Restore</Button>
                          <Button variant="danger" size="sm" onClick={() => handlePermanentDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-44">
                          <DropdownItem icon={Eye} onClick={() => openView(item.id)}>View</DropdownItem>
                          <DropdownItem icon={Edit2} onClick={() => openForm(item)}>Edit</DropdownItem>
                          <DropdownDivider />
                          <DropdownItem icon={Trash2} danger onClick={() => handleSoftDelete(item.id)}>Delete</DropdownItem>
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

      {total > pageSize && (
        <div className="mt-4">
          <Pagination page={page} totalPages={Math.ceil(total / pageSize)} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }} />
        </div>
      )}

      {/* ═══ RECORDING CREATE/EDIT DIALOG ═══ */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Recording' : 'Create Recording'} size="md">
        <form onSubmit={handleSubmit(onSave)} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Session ID *</label>
              <Input {...register('session_id', { required: true })} type="number" placeholder="Session ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>
              <Input {...register('title')} placeholder="Recording title" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Recording URL</label>
              <Input {...register('recording_url')} placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bunny Video ID</label>
              <Input {...register('bunny_video_id')} placeholder="Bunny video ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (seconds)</label>
              <Input {...register('duration_seconds')} type="number" placeholder="Seconds" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">File Size (bytes)</label>
              <Input {...register('file_size_bytes')} type="number" placeholder="Bytes" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select {...register('recording_status')} className={selectClass + ' w-full'}>
                <option value="processing">Processing</option>
                <option value="ready">Ready</option>
                <option value="failed">Failed</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ RECORDING VIEW DIALOG ═══ */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Recording Details" size="md">
        {viewLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 rounded" />)}</div>
        ) : viewItem ? (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <DetailRow label="ID" value={String(viewItem.id)} />
              <DetailRow label="Session" value={viewItem.session?.title || `#${viewItem.session_id}`} />
              <DetailRow label="Title" value={viewItem.title} />
              <DetailRow label="Status" value={capitalize(viewItem.recording_status || '')} />
              <DetailRow label="Recording URL" value={viewItem.recording_url} />
              <DetailRow label="Bunny Video ID" value={viewItem.bunny_video_id} />
              <DetailRow label="Duration" value={viewItem.duration_seconds ? formatDuration(viewItem.duration_seconds) : '--'} />
              <DetailRow label="File Size" value={viewItem.file_size_bytes ? formatFileSize(viewItem.file_size_bytes) : '--'} />
              <DetailRow label="Created" value={fromNow(viewItem.created_at)} />
              <DetailRow label="Updated" value={fromNow(viewItem.updated_at)} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
