"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { Plus, Mail, Trash2, Edit2, CheckCircle2, XCircle, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Eye, Loader2, X, Code, Variable } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

/* ── Local types ── */
interface EmailTemplate {
  id: number;
  template_key: string;
  template_name: string;
  brevo_template_id: number | null;
  subject: string | null;
  html_body: string | null;
  text_body: string | null;
  variables: string[] | null;
  notification_type: string | null;
  is_active: boolean;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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

const TABS = ['Basic', 'Body', 'Variables'] as const;

type SortField = 'id' | 'template_name' | 'template_key' | 'is_active';

function ViewField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs font-medium text-slate-500 mb-0.5">{label}</span>
      {value ? (
        <p className={cn('text-sm text-slate-900 whitespace-pre-wrap', mono && 'font-mono text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 max-h-48 overflow-auto')}>{value}</p>
      ) : (
        <p className="text-sm text-slate-300 italic">Not set</p>
      )}
    </div>
  );
}

function jsonPretty(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val, null, 2); } catch { return String(val); }
}

export default function EmailTemplatesPage() {
  const [items, setItems] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Basic');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const [formLoading, setFormLoading] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<EmailTemplate | null>(null);
  const [viewTab, setViewTab] = useState<typeof TABS[number]>('Basic');

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
  ]);

  useEffect(() => {
    refreshSummary();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterType, filterStatus, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterType, filterStatus, sortField, sortOrder, pageSize, showTrash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSummary() {
    const res = await api.getEmailTemplateSummary();
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterType) qs.set('notification_type', filterType);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listEmailTemplates('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  const defaultFormValues = {
    template_key: '', template_name: '', brevo_template_id: '',
    subject: '', notification_type: '',
    html_body: '', text_body: '',
    variables: '[]', is_active: true,
  };

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1); setActiveTab('Basic');
    reset(defaultFormValues);
    setDialogOpen(true);
  }

  function openEdit(item: EmailTemplate) {
    setEditing(item); setDialogKey(k => k + 1); setActiveTab('Basic');
    reset({
      template_key: item.template_key || '',
      template_name: item.template_name || '',
      brevo_template_id: item.brevo_template_id ?? '',
      subject: item.subject || '',
      notification_type: item.notification_type || '',
      html_body: item.html_body || '',
      text_body: item.text_body || '',
      variables: jsonPretty(item.variables) || '[]',
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    setFormLoading(true);
    const payload: any = { ...data };
    // Parse variables as JSON
    if (typeof payload.variables === 'string') {
      try { payload.variables = JSON.parse(payload.variables); } catch { payload.variables = []; }
    }
    // Cast brevo_template_id
    if (payload.brevo_template_id === '' || payload.brevo_template_id === null) {
      payload.brevo_template_id = null;
    } else {
      payload.brevo_template_id = parseInt(payload.brevo_template_id) || null;
    }
    // Boolean
    payload.is_active = payload.is_active === true || payload.is_active === 'true';
    // Nullify empty strings
    for (const k of ['subject', 'notification_type', 'html_body', 'text_body']) {
      if (payload[k] === '') payload[k] = null;
    }

    const res = editing
      ? await api.updateEmailTemplate(editing.id, payload)
      : await api.createEmailTemplate(payload);
    setFormLoading(false);
    if (res.success) {
      toast.success(editing ? 'Template updated' : 'Template created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: EmailTemplate) {
    if (!confirm(`Move "${item.template_name}" to trash?`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteEmailTemplate(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Template moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: EmailTemplate) {
    setActionLoadingId(item.id);
    const res = await api.restoreEmailTemplate(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${item.template_name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: EmailTemplate) {
    if (!confirm(`PERMANENTLY delete "${item.template_name}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteEmailTemplate(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Template permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: EmailTemplate) {
    const res = await api.updateEmailTemplate(item.id, { is_active: !item.is_active });
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: EmailTemplate) {
    setViewItem(item); setViewTab('Basic'); setViewOpen(true);
  }

  // Bulk selection
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} template(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const r = await api.deleteEmailTemplate(ids[i]); if (r.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} template(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} template(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const r = await api.restoreEmailTemplate(ids[i]); if (r.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} template(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} template(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const r = await api.permanentDeleteEmailTemplate(ids[i]); if (r.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} template(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
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

  const selectClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Email Templates" description="Manage email notification templates"
        actions={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add template</Button> : undefined} />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Templates', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button onClick={() => setShowTrash(false)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Templates
        </button>
        <button onClick={() => setShowTrash(true)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search templates...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All types</option>
              {NOTIFICATION_TYPES.map(t => <option key={t} value={t}>{formatType(t)}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat">
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
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : Mail} title={showTrash ? 'Trash is empty' : 'No email templates yet'} description={showTrash ? 'Deleted templates will appear here' : 'Add your first email template'}
          action={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add template</Button> : undefined} />
      ) : (
        <>
          <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
            {/* Bulk action toolbar */}
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
                  <TH><button onClick={() => handleSort('template_key')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Key <SortIcon field="template_key" /></button></TH>
                  <TH><button onClick={() => handleSort('template_name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="template_name" /></button></TH>
                  <TH>Type</TH>
                  <TH>Subject</TH>
                  <TH>Brevo ID</TH>
                  {showTrash && <TH>Deleted</TH>}
                  <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map(item => (
                  <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-brand-50/40')}>
                    <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                    <TD className="py-2.5"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">{item.template_key}</code></TD>
                    <TD className="py-2.5"><span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.template_name}</span></TD>
                    <TD className="py-2.5">
                      {item.notification_type ? (
                        <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', NOTIFICATION_TYPE_COLORS[item.notification_type] || 'bg-slate-50 text-slate-600')}>
                          {formatType(item.notification_type)}
                        </span>
                      ) : <span className="text-slate-300">--</span>}
                    </TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-600 truncate max-w-[200px] block">{item.subject || <span className="text-slate-300">--</span>}</span></TD>
                    <TD className="py-2.5">{item.brevo_template_id ? <Badge variant="muted">{item.brevo_template_id}</Badge> : <span className="text-slate-300">--</span>}</TD>
                    {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '--'}</span></TD>}
                    <TD className="py-2.5">
                      {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                    </TD>
                    <TD className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {showTrash ? (
                          <>
                            <button onClick={() => onRestore(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                            <button onClick={() => onPermanentDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openView(item)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onSoftDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => setPageSize(s)} total={total} showingCount={items.length} />
          </div>
        </>
      )}

      {/* ─── View Dialog ─── */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="View Email Template" size="lg">
        {viewItem && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-700">{viewItem.template_key}</code>
              {viewItem.notification_type && (
                <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', NOTIFICATION_TYPE_COLORS[viewItem.notification_type] || 'bg-slate-50 text-slate-600')}>
                  {formatType(viewItem.notification_type)}
                </span>
              )}
              <Badge variant={viewItem.is_active ? 'success' : 'danger'}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge>
              {viewItem.brevo_template_id && <Badge variant="muted">Brevo #{viewItem.brevo_template_id}</Badge>}
            </div>

            <div className="flex gap-1 border-b border-slate-200 pb-0 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab} type="button" onClick={() => setViewTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${viewTab === tab ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {viewTab === 'Basic' && (
              <div className="space-y-3">
                <ViewField label="Template Name" value={viewItem.template_name} />
                <ViewField label="Subject" value={viewItem.subject} />
                <ViewField label="Notification Type" value={viewItem.notification_type ? formatType(viewItem.notification_type) : null} />
                <ViewField label="Brevo Template ID" value={viewItem.brevo_template_id ? String(viewItem.brevo_template_id) : null} />
              </div>
            )}

            {viewTab === 'Body' && (
              <div className="space-y-3">
                <ViewField label="HTML Body" value={viewItem.html_body} mono />
                <ViewField label="Text Body" value={viewItem.text_body} mono />
              </div>
            )}

            {viewTab === 'Variables' && (
              <div className="space-y-3">
                <ViewField label="Template Variables (JSON)" value={jsonPretty(viewItem.variables)} mono />
                {Array.isArray(viewItem.variables) && viewItem.variables.length > 0 && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Available Placeholders</span>
                    <div className="flex flex-wrap gap-1.5">
                      {viewItem.variables.map((v: string) => (
                        <code key={v} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => { setViewOpen(false); openEdit(viewItem); }}>
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ─── Edit / Create Dialog ─── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Email Template' : 'Add Email Template'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This template is currently active' : 'This template is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getEmailTemplate(editing.id);
                  if (refreshed.success && refreshed.data) {
                    setEditing(refreshed.data);
                    setValue('is_active', refreshed.data.is_active);
                  }
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 pb-0 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${activeTab === tab ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Basic Tab */}
          {activeTab === 'Basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Template Key *" placeholder="e.g. enrollment_confirmed" {...register('template_key', { required: true })} />
                <Input label="Template Name *" placeholder="e.g. Enrollment Confirmation" {...register('template_name', { required: true })} />
              </div>
              <Input label="Subject" placeholder="Email subject with {{variables}}" {...register('subject')} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notification Type</label>
                  <select className={cn(selectClass, 'w-full')} {...register('notification_type')}>
                    <option value="">-- Select --</option>
                    {NOTIFICATION_TYPES.map(t => <option key={t} value={t}>{formatType(t)}</option>)}
                  </select>
                </div>
                <Input label="Brevo Template ID" type="number" placeholder="Optional Brevo ID" {...register('brevo_template_id')} />
              </div>
              {!editing && (
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                  <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  Active
                </label>
              )}
            </div>
          )}

          {/* Body Tab */}
          {activeTab === 'Body' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">HTML Body</label>
                <textarea className={cn(selectClass, 'w-full min-h-[200px] font-mono text-xs')} placeholder="<html>...</html>" {...register('html_body')} />
                <p className="text-xs text-slate-400 mt-1">Use {'{{variable_name}}'} for dynamic content</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Text Body (Fallback)</label>
                <textarea className={cn(selectClass, 'w-full min-h-[120px] font-mono text-xs')} placeholder="Plain text version..." {...register('text_body')} />
              </div>
            </div>
          )}

          {/* Variables Tab */}
          {activeTab === 'Variables' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template Variables (JSON Array)</label>
                <textarea className={cn(selectClass, 'w-full min-h-[120px] font-mono text-xs')} placeholder='["student_name", "course_name", "amount"]' {...register('variables')} />
                <p className="text-xs text-slate-400 mt-1">JSON array of variable names available in this template</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={formLoading}>
              {formLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : editing ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
