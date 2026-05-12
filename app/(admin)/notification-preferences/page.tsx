"use client";
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { BellRing, Edit2, CheckCircle2, XCircle, BarChart3, ArrowUp, ArrowDown, ArrowUpDown, Eye, Loader2, X, Mail, MessageSquare, Smartphone, ToggleLeft } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

/* ── Local types ── */
interface NotificationPreference {
  id: number;
  user_id: number;
  notification_type: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  users?: { full_name: string | null; email: string | null };
}

const NOTIFICATION_TYPES = [
  'enrollment_confirmed', 'payment_received', 'refund_processed', 'new_content',
  'reminder', 'welcome', 'earning_received', 'payout_approved', 'payout_processed',
  'payout_rejected', 'review_received', 'certificate_issued',
] as const;

const NOTIFICATION_TYPE_COLORS: Record<string, string> = {
  enrollment_confirmed: 'bg-emerald-50 text-emerald-700',
  payment_received: 'bg-blue-50 text-blue-700',
  refund_processed: 'bg-amber-50 text-amber-700',
  new_content: 'bg-violet-50 text-violet-700',
  reminder: 'bg-orange-50 text-orange-700',
  welcome: 'bg-teal-50 text-teal-700',
  earning_received: 'bg-green-50 text-green-700',
  payout_approved: 'bg-sky-50 text-sky-700',
  payout_processed: 'bg-indigo-50 text-indigo-700',
  payout_rejected: 'bg-red-50 text-red-700',
  review_received: 'bg-pink-50 text-pink-700',
  certificate_issued: 'bg-cyan-50 text-cyan-700',
};

function formatType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

type SortField = 'id' | 'notification_type' | 'user_id' | 'is_active';

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="block text-xs font-medium text-slate-500 mb-0.5">{label}</span>
      {value ? (
        <p className="text-sm text-slate-900">{value}</p>
      ) : (
        <p className="text-sm text-slate-300 italic">Not set</p>
      )}
    </div>
  );
}

function ChannelBadge({ enabled, label, icon: Icon }: { enabled: boolean; label: string; icon: React.ElementType }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

/* ── Main page ── */
export default function NotificationPreferencesPage() {
  const [items, setItems] = useState<NotificationPreference[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; total: number } | null>(null);

  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  const [viewItem, setViewItem] = useState<NotificationPreference | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [editItem, setEditItem] = useState<NotificationPreference | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const { register, handleSubmit, reset } = useForm<any>();

  /* ── Keyboard shortcuts ── */
  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'r', action: () => load() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
  ]);

  /* ── Debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Reset page on filter change ── */
  useEffect(() => { setPage(1); }, [searchDebounce, filterType, filterStatus, sortField, sortOrder, pageSize]);
  useEffect(() => { load(); }, [searchDebounce, page, filterType, filterStatus, sortField, sortOrder, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refreshSummary(); }, []);

  /* ── Fetch ── */
  async function refreshSummary() {
    const res = await api.getNotificationPreferenceSummary();
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterType) qs.set('notification_type', filterType);
    if (filterStatus) qs.set('is_active', filterStatus);
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listNotificationPreferences('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  /* ── Sort ── */
  function handleSort(f: SortField) {
    if (sortField === f) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortOrder('asc'); }
  }
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  /* ── View ── */
  function openView(item: NotificationPreference) { setViewItem(item); setViewOpen(true); }

  /* ── Edit ── */
  function openEdit(item: NotificationPreference) {
    setEditItem(item);
    reset({ email_enabled: item.email_enabled, sms_enabled: item.sms_enabled, in_app_enabled: item.in_app_enabled, is_active: item.is_active });
    setEditOpen(true);
  }

  async function onSave(formData: any) {
    if (!editItem) return;
    setFormLoading(true);
    try {
      const res = await api.updateNotificationPreference(editItem.id, formData);
      if (res.success) {
        toast.success('Preference updated');
        setEditOpen(false);
        setEditItem(null);
        load();
        refreshSummary();
      } else { toast.error(res.message || 'Failed to update'); }
    } catch { toast.error('Failed to update preference'); }
    setFormLoading(false);
  }

  const selectClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Notification Preferences" description="Manage user notification channel preferences" />

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Preferences', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
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

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder="Search by type or user…">
        <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {NOTIFICATION_TYPES.map(t => <option key={t} value={t}>{formatType(t)}</option>)}
        </select>
        <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </DataToolbar>

      {/* Content */}
      {loading ? (
        <div className="grid gap-3 mt-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={BellRing} title="No preferences found" description="No notification preferences match your filters." />
      ) : (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="w-48"><button onClick={() => handleSort('user_id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">User <SortIcon field="user_id" /></button></TH>
                <TH><button onClick={() => handleSort('notification_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Type <SortIcon field="notification_type" /></button></TH>
                <TH className="text-center">Email</TH>
                <TH className="text-center">SMS</TH>
                <TH className="text-center">In-App</TH>
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(item => (
                <TR key={item.id}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                  <TD className="py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-900 truncate max-w-[180px]">{item.users?.full_name || `User #${item.user_id}`}</p>
                      {item.users?.email && <p className="text-xs text-slate-400 truncate max-w-[180px]">{item.users.email}</p>}
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', NOTIFICATION_TYPE_COLORS[item.notification_type] || 'bg-slate-50 text-slate-600')}>
                      {formatType(item.notification_type)}
                    </span>
                  </TD>
                  <TD className="py-2.5 text-center">
                    {item.email_enabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                  </TD>
                  <TD className="py-2.5 text-center">
                    {item.sms_enabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                  </TD>
                  <TD className="py-2.5 text-center">
                    {item.in_app_enabled ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                  </TD>
                  <TD className="py-2.5">
                    <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(item)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => setPageSize(s)} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)}>
        {viewItem && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Preference Details</h2>
              <button onClick={() => setViewOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ViewField label="ID" value={String(viewItem.id)} />
              <ViewField label="User" value={viewItem.users?.full_name || `User #${viewItem.user_id}`} />
              <ViewField label="Email" value={viewItem.users?.email} />
              <ViewField label="Notification Type" value={formatType(viewItem.notification_type)} />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-500 mb-2">Channels</span>
              <div className="flex flex-wrap gap-2">
                <ChannelBadge enabled={viewItem.email_enabled} label="Email" icon={Mail} />
                <ChannelBadge enabled={viewItem.sms_enabled} label="SMS" icon={Smartphone} />
                <ChannelBadge enabled={viewItem.in_app_enabled} label="In-App" icon={MessageSquare} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ViewField label="Status" value={viewItem.is_active ? 'Active' : 'Inactive'} />
              <ViewField label="Updated" value={fromNow(viewItem.updated_at)} />
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        {editItem && (
          <form onSubmit={handleSubmit(onSave)} className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Edit Preference</h2>
              <button onClick={() => setEditOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ViewField label="User" value={editItem.users?.full_name || `User #${editItem.user_id}`} />
              <ViewField label="Type" value={formatType(editItem.notification_type)} />
            </div>

            <div className="space-y-3">
              <span className="block text-xs font-medium text-slate-500">Channel Toggles</span>

              {([
                { key: 'email_enabled' as const, label: 'Email Notifications', icon: Mail, desc: 'Send email for this notification type' },
                { key: 'sms_enabled' as const, label: 'SMS Notifications', icon: Smartphone, desc: 'Send SMS for this notification type' },
                { key: 'in_app_enabled' as const, label: 'In-App Notifications', icon: MessageSquare, desc: 'Show in-app notification' },
              ]).map(ch => (
                <label key={ch.key} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <ch.icon className="w-4 h-4 text-slate-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{ch.label}</p>
                      <p className="text-xs text-slate-400">{ch.desc}</p>
                    </div>
                  </div>
                  <input type="checkbox" {...register(ch.key)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                </label>
              ))}
            </div>

            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div className="flex items-center gap-3">
                <ToggleLeft className="w-4 h-4 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Active</p>
                  <p className="text-xs text-slate-400">Enable or disable this preference entirely</p>
                </div>
              </div>
              <input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={formLoading}>
                {formLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving…</> : 'Save Changes'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
