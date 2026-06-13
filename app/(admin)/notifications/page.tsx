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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  Loader2, X, MoreVertical, Bell, Check,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type SortField = 'id' | 'notification_type' | 'channel' | 'is_read' | 'sent_at' | 'created_at';

const NOTIFICATION_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'payment', label: 'Payment' },
  { value: 'content', label: 'Content' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'system', label: 'System' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'achievement', label: 'Achievement' },
];

const CHANNELS = [
  { value: '', label: 'All Channels' },
  { value: 'in_app', label: 'In App' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
];

const READ_FILTER = [
  { value: '', label: 'All' },
  { value: 'true', label: 'Read' },
  { value: 'false', label: 'Unread' },
];

const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  enrollment: 'bg-blue-50 text-blue-700',
  payment: 'bg-emerald-50 text-emerald-700',
  content: 'bg-violet-50 text-violet-700',
  reminder: 'bg-amber-50 text-amber-700',
  system: 'bg-slate-100 text-slate-600',
  promotion: 'bg-pink-50 text-pink-700',
  achievement: 'bg-yellow-50 text-yellow-700',
};

const CHANNEL_COLORS: Record<string, string> = {
  in_app: 'bg-blue-50 text-blue-700',
  email: 'bg-emerald-50 text-emerald-700',
  sms: 'bg-amber-50 text-amber-700',
  push: 'bg-violet-50 text-violet-700',
};

// BUG-44: priority badge styling for the list column
const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-700',
  urgent: 'bg-red-50 text-red-700',
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
export default function NotificationsPage() {
  // ── List state ──
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [sort, setSort] = useState<SortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');
  // BUG-22 fix: Sent At date-range filter
  const [sentFrom, setSentFrom] = useState('');
  const [sentTo, setSentTo] = useState('');
  // BUG-19 fix: user picker data
  const [pickUsers, setPickUsers] = useState<any[]>([]);
  useEffect(() => {
    api.listUsers('?limit=500&sort=first_name&order=asc').then((r: any) => setPickUsers(r?.data || [])).catch(() => setPickUsers([]));
  }, []);
  const userOptions = pickUsers.map((u: any) => ({
    value: String(u.id),
    label: `${[u.first_name, u.last_name].filter(Boolean).join(' ') || 'User'} — ${u.email || u.mobile || `#${u.id}`}`,
  }));
  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── Stats state ──
  const [stats, setStats] = useState({ total: 0, unread: 0, email: 0, sms: 0, push: 0 });

  // ── View state ──
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // ── Create state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, watch, setValue } = useForm();

  // ── Action loaders ──
  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: pageSize,
        sort,
        ascending: asc,
      };
      if (showTrash) params.show_deleted = true;
      if (search) params.search = search;
      if (typeFilter) params.notification_type = typeFilter;
      if (channelFilter) params.channel = channelFilter;
      if (readFilter) params.is_read = readFilter;
      if (sentFrom) params.sent_from = sentFrom; // BUG-22
      if (sentTo) params.sent_to = sentTo;
      const res = await api.getNotifications(params);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load notifications'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, typeFilter, channelFilter, readFilter, sentFrom, sentTo]);

  const fetchTrashCount = useCallback(async () => {
    try {
      const res = await api.getNotifications({ show_deleted: true, limit: 1 });
      setTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const [all, unread, email, sms, push] = await Promise.all([
        api.getNotifications({ limit: 1 }),
        api.getNotifications({ limit: 1, channel: 'in_app', is_read: false }),
        api.getNotifications({ limit: 1, channel: 'email' }),
        api.getNotifications({ limit: 1, channel: 'sms' }),
        api.getNotifications({ limit: 1, channel: 'push' }),
      ]);
      setStats({
        total: all.pagination?.total || 0,
        unread: unread.pagination?.total || 0,
        email: email.pagination?.total || 0,
        sms: sms.pagination?.total || 0,
        push: push.pagination?.total || 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); fetchStats(); }, [fetchData, fetchTrashCount, fetchStats]);

  // ── Sort helper ──
  function toggleSort(field: SortField) {
    if (sort === field) setAsc(!asc);
    else { setSort(field); setAsc(true); }
  }
  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ── View notification ──
  async function openView(id: number) {
    setViewLoading(true);
    setViewOpen(true);
    try {
      const res = await api.getNotification(id);
      setViewItem(res.data);
    } catch { toast.error('Failed to load notification details'); }
    setViewLoading(false);
  }

  // ── Create notification ──
  function openCreate() {
    reset({
      user_id: '',
      title: '',
      body: '',
      notification_type: 'system',
      channel: 'in_app',
      action_url: '',
      priority: 'normal',
    });
    setCreateOpen(true);
  }

  async function onSaveCreate(formData: any) {
    setSaving(true);
    try {
      await api.createNotification({
        ...formData,
        user_id: Number(formData.user_id),
      });
      toast.success('Notification created');
      setCreateOpen(false);
      fetchData();
      fetchStats();
    } catch (e: any) { toast.error(e.message || 'Create failed'); }
    setSaving(false);
  }

  // ── Mark as read ──
  async function handleMarkAsRead(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'marking' }));
    try {
      await api.markNotificationAsRead(id);
      toast.success('Marked as read');
      fetchData();
      fetchStats();
    } catch { toast.error('Failed to mark as read'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Soft delete ──
  async function handleSoftDelete(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeleteNotification(id); toast.success('Moved to trash'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Restore ──
  async function handleRestore(id: number) {
    setActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restoreNotification(id); toast.success('Restored'); fetchData(); fetchTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ── Permanent delete ──
  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this notification? This cannot be undone.')) return;
    setActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeleteNotification(id); toast.success('Permanently deleted'); fetchData(); fetchTrashCount(); fetchStats(); }
    catch { toast.error('Failed to delete'); }
    setActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Notifications" actions={
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Create Notification
        </Button>
      } />

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-5 gap-4 mb-5">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Unread', value: stats.unread, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Email', value: stats.email, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'SMS', value: stats.sms, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Push', value: stats.push, color: 'text-violet-700', bg: 'bg-violet-50' },
        ].map(stat => (
          <div key={stat.label} className={cn('rounded-xl px-4 py-3', stat.bg)}>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by title..."
      >
        <div className="flex items-center gap-2">
          <select className={selectClass} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            {NOTIFICATION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={selectClass} value={channelFilter} onChange={e => { setChannelFilter(e.target.value); setPage(1); }}>
            {CHANNELS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className={selectClass} value={readFilter} onChange={e => { setReadFilter(e.target.value); setPage(1); }}>
            {READ_FILTER.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* BUG-22: Sent At range */}
          <input type="date" title="Sent from" className={selectClass} value={sentFrom} onChange={e => { setSentFrom(e.target.value); setPage(1); }} />
          <input type="date" title="Sent to" className={selectClass} value={sentTo} onChange={e => { setSentTo(e.target.value); setPage(1); }} />
          <Button variant={showTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
            <Trash2 className="w-4 h-4" />
            Trash
            {trashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </Button>
        </div>
      </DataToolbar>

      {/* ── Table ── */}
      {loading ? (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={showTrash ? 'Trash is empty' : 'No notifications found'}
          description={showTrash ? 'No deleted notifications found' : 'Notifications will appear here once they are created'}
        />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="cursor-pointer" onClick={() => toggleSort('id')}>
                  <div className="flex items-center gap-1">ID <SortIcon field="id" /></div>
                </TH>
                <TH>USER</TH>
                <TH>TITLE</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('notification_type')}>
                  <div className="flex items-center gap-1">TYPE <SortIcon field="notification_type" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('channel')}>
                  <div className="flex items-center gap-1">CHANNEL <SortIcon field="channel" /></div>
                </TH>
                {/* BUG-44: Priority column */}
                <TH>PRIORITY</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('is_read')}>
                  <div className="flex items-center gap-1">READ <SortIcon field="is_read" /></div>
                </TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('sent_at')}>
                  <div className="flex items-center gap-1">SENT AT <SortIcon field="sent_at" /></div>
                </TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item) => {
                const actionState = actionLoaders[item.id];
                const userName = item.users?.full_name || item.users?.email || `User #${item.user_id}`;
                return (
                  <TR key={item.id}>
                    <TD>
                      <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        #{item.id}
                      </code>
                    </TD>
                    <TD>
                      <div className="text-sm font-medium text-slate-900 truncate max-w-[160px]">{userName}</div>
                    </TD>
                    <TD>
                      <div className="text-sm text-slate-700 truncate max-w-[200px]">{item.title || '--'}</div>
                    </TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        NOTIFICATION_TYPE_COLORS[item.notification_type] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.notification_type)}
                      </span>
                    </TD>
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        CHANNEL_COLORS[item.channel] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.channel)}
                      </span>
                    </TD>
                    {/* BUG-44: Priority cell */}
                    <TD>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                        PRIORITY_COLORS[item.priority] || 'bg-slate-100 text-slate-600'
                      )}>
                        {capitalize(item.priority || 'normal')}
                      </span>
                    </TD>
                    <TD>
                      {item.is_read ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </TD>
                    <TD>
                      <span className="text-sm text-slate-500">{item.sent_at ? fromNow(item.sent_at) : '--'}</span>
                    </TD>
                    <TD className="text-right">
                      {actionState ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                      ) : showTrash ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleRestore(item.id)}>
                            <RotateCcw className="w-4 h-4" /> Restore
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handlePermanentDelete(item.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center whitespace-nowrap">
                          {/* BUG-22: direct icon actions */}
                          <button title="View" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => openView(item.id)}><Eye className="w-4 h-4" /></button>
                          {!item.is_read && (
                            <button title="Mark as Read" className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600" onClick={() => handleMarkAsRead(item.id)}><Check className="w-4 h-4" /></button>
                          )}
                          <button title="Delete" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" onClick={() => handleSoftDelete(item.id)}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}

      {/* ── Pagination ── */}
      {total > pageSize && (
        <div className="mt-4">
          <Pagination
            page={page}
            totalPages={Math.ceil(total / pageSize)}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}

      {/* ═══ VIEW DIALOG ═══ */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Notification Details" size="lg">
        {viewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : viewItem ? (
          <div className="p-6 space-y-5">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <code className="text-lg font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded">
                #{viewItem.id}
              </code>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  NOTIFICATION_TYPE_COLORS[viewItem.notification_type] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(viewItem.notification_type)}
                </span>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  CHANNEL_COLORS[viewItem.channel] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(viewItem.channel)}
                </span>
                {viewItem.is_read ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Read
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-50 text-red-700">
                    <XCircle className="w-3.5 h-3.5" /> Unread
                  </span>
                )}
              </div>
            </div>

            {/* Details grid */}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Title" value={viewItem.title} />
              <DetailRow label="User" value={viewItem.users?.full_name || viewItem.users?.email || `User #${viewItem.user_id}`} />
              <div className="col-span-2">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Body</dt>
                <dd className="mt-0.5 text-sm text-slate-800 whitespace-pre-wrap">{viewItem.message || viewItem.body || '--'}</dd>
              </div>
              <DetailRow label="Notification Type" value={capitalize(viewItem.notification_type || '')} />
              <DetailRow label="Channel" value={capitalize(viewItem.channel || '')} />
              <DetailRow label="Priority" value={capitalize(viewItem.priority || 'normal')} />
              <DetailRow label="Read" value={viewItem.is_read ? 'Yes' : 'No'} />
              <DetailRow label="Sent At" value={viewItem.sent_at ? fromNow(viewItem.sent_at) : '--'} />
              <DetailRow label="Read At" value={viewItem.read_at ? fromNow(viewItem.read_at) : '--'} />
              <DetailRow label="Action URL" value={viewItem.action_url} />
              <DetailRow label="Created" value={viewItem.created_at ? fromNow(viewItem.created_at) : '--'} />
              <DetailRow label="Updated" value={viewItem.updated_at ? fromNow(viewItem.updated_at) : '--'} />
            </dl>

            {/* Metadata */}
            {viewItem.metadata && Object.keys(viewItem.metadata).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Metadata</h4>
                <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 overflow-x-auto">
                  {JSON.stringify(viewItem.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ CREATE DIALOG ═══ */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create Notification" size="md">
        <form onSubmit={handleSubmit(onSaveCreate)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">User *</label>
            {/* BUG-19: searchable picker instead of a raw ID */}
            <SearchableSelect options={userOptions} value={watch('user_id') || ''} onChange={(v) => setValue('user_id', v, { shouldValidate: true })} placeholder="Search by name or email…" />
            <input type="hidden" {...register('user_id', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
            <Input placeholder="Notification title..." {...register('title', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Body</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Notification body..."
              {...register('body')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notification Type</label>
              <select className={cn(selectClass, 'w-full')} {...register('notification_type')}>
                <option value="enrollment">Enrollment</option>
                <option value="payment">Payment</option>
                <option value="content">Content</option>
                <option value="reminder">Reminder</option>
                <option value="system">System</option>
                <option value="promotion">Promotion</option>
                <option value="achievement">Achievement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Channel</label>
              <select className={cn(selectClass, 'w-full')} {...register('channel')}>
                <option value="in_app">In App</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Action URL</label>
            <Input placeholder="https://..." {...register('action_url')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Priority</label>
            <select className={cn(selectClass, 'w-full')} {...register('priority')}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Notification</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
