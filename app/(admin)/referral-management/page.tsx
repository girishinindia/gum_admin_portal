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
  Loader2, X, Gift, Users, Award, Search, ChevronDown,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ───────────────────────────────────────────────────────
type MainTab = 'codes' | 'usages' | 'rewards';

type CodeSortField = 'id' | 'referral_code' | 'discount_percentage' | 'referrer_reward_percentage' | 'usage_limit' | 'total_referrals' | 'total_earnings' | 'is_active';
type UsageSortField = 'id' | 'usage_status' | 'discount_applied' | 'order_amount' | 'converted_at' | 'is_active';
type RewardSortField = 'id' | 'reward_type' | 'reward_amount' | 'status' | 'credited_at' | 'is_active';

// ─── Constants ───────────────────────────────────────────────────
const REFERRER_REWARD_TYPE_OPTIONS = [
  { value: 'wallet_credit', label: 'Wallet Credit' },
  { value: 'cash', label: 'Cash' },
  { value: 'points', label: 'Points' },
];

const REWARD_TYPE_OPTIONS = [
  { value: 'wallet_credit', label: 'Wallet Credit' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit' },
  { value: 'points', label: 'Points' },
];

const USAGE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
];

const REWARD_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'credited', label: 'Credited' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

const USAGE_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  expired: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-700',
};

const REWARD_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  credited: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  expired: 'bg-slate-100 text-slate-600',
};

const REWARD_TYPE_COLORS: Record<string, string> = {
  wallet_credit: 'bg-blue-50 text-blue-700',
  cash: 'bg-green-50 text-green-700',
  credit: 'bg-teal-50 text-teal-700',
  points: 'bg-violet-50 text-violet-700',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

// ─── Helper ──────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

function formatCurrency(val: any) {
  if (val === null || val === undefined || val === '') return '--';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(val));
}

function userLine(user: any) {
  if (!user) return null;
  return (
    <div>
      <div className="text-sm font-medium text-slate-900">{user.full_name || '--'}</div>
      {user.email && <div className="text-xs text-slate-500">{user.email}</div>}
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '--';
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function ReferralManagementPage() {
  const [mainTab, setMainTab] = useState<MainTab>('codes');

  return (
    <div className="animate-fade-in">
      <PageHeader title="Referral Management" />

      {/* ── Main Tabs ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'codes' as MainTab, label: 'Referral Codes', icon: Gift },
          { id: 'usages' as MainTab, label: 'Referral Usages', icon: Users },
          { id: 'rewards' as MainTab, label: 'Referral Rewards', icon: Award },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
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
      {mainTab === 'codes' && <ReferralCodesTab />}
      {mainTab === 'usages' && <ReferralUsagesTab />}
      {mainTab === 'rewards' && <ReferralRewardsTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: REFERRAL CODES
// ══════════════════════════════════════════════════════════════════
function ReferralCodesTab() {
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
  const [sortField, setSortField] = useState<CodeSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterRewardType, setFilterRewardType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [students, setStudents] = useState<any[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const studentDropdownRef = useRef<HTMLDivElement>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  const selectedStudentId = watch('student_id');

  // Load students on mount
  useEffect(() => {
    api.listUsers('?limit=500&type=student').then(res => {
      if (res.success) setStudents(res.data || []);
    });
  }, []);

  // Close student dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(e.target as Node)) {
        setStudentDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary on mount
  useEffect(() => {
    api.getTableSummary('referral_codes').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterRewardType, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterRewardType, filterStatus, showTrash]);

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
      if (filterRewardType) qs.set('referrer_reward_type', filterRewardType);
    }
    const res = await api.listReferralCodes('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('referral_codes');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: CodeSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: CodeSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      student_id: '', discount_percentage: '', max_discount_amount: '',
      referrer_reward_type: 'wallet_credit', referrer_reward_percentage: '',
      usage_limit: '', expires_at: '', notes: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      student_id: c.student_id ?? '', discount_percentage: c.discount_percentage ?? '',
      max_discount_amount: c.max_discount_amount ?? '',
      referrer_reward_type: c.referrer_reward_type || 'wallet_credit',
      referrer_reward_percentage: c.referrer_reward_percentage ?? '',
      usage_limit: c.usage_limit ?? '',
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : '',
      notes: c.notes || '', is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['student_id', 'discount_percentage', 'max_discount_amount', 'referrer_reward_percentage', 'usage_limit'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateReferralCode(editing.id, payload)
      : await api.createReferralCode(payload);
    if (res.success) {
      toast.success(editing ? 'Referral code updated' : 'Referral code created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move referral code "${c.referral_code}" to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteReferralCode(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Referral code moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreReferralCode(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${c.referral_code}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete referral code "${c.referral_code}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteReferralCode(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Referral code permanently deleted'); load(); refreshSummary(); }
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
      const res = await api.softDeleteReferralCode(ids[i]);
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
      const res = await api.restoreReferralCode(ids[i]);
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
      const res = await api.deleteReferralCode(ids[i]);
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
            { label: 'Total Codes', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Referral Codes
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add referral code</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by referral code...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterRewardType} onChange={e => setFilterRewardType(e.target.value)}>
              <option value="">All Reward Types</option>
              {REFERRER_REWARD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          icon={showTrash ? Trash2 : Gift}
          title={showTrash ? 'Trash is empty' : 'No referral codes yet'}
          description={showTrash ? 'No deleted referral codes' : (searchDebounce || filterRewardType || filterStatus ? 'No codes match your filters' : 'Create your first referral code')}
          action={!showTrash && !searchDebounce && !filterRewardType && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add referral code</Button> : undefined}
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
                <TH>Student</TH>
                <TH><button onClick={() => handleSort('referral_code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Referral Code <SortIcon field="referral_code" /></button></TH>
                <TH><button onClick={() => handleSort('discount_percentage')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Discount % <SortIcon field="discount_percentage" /></button></TH>
                <TH><button onClick={() => handleSort('referrer_reward_percentage')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Reward <SortIcon field="referrer_reward_percentage" /></button></TH>
                <TH><button onClick={() => handleSort('usage_limit')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Usage <SortIcon field="usage_limit" /></button></TH>
                <TH>Expires At</TH>
                <TH><button onClick={() => handleSort('total_referrals')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Stats <SortIcon field="total_referrals" /></button></TH>
                <TH><button onClick={() => handleSort('total_earnings')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Earnings <SortIcon field="total_earnings" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Active <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">{c.users ? userLine(c.users) : <span className="text-slate-400 text-sm">ID: {c.student_id}</span>}</TD>
                  <TD className="py-2.5"><span className={cn('text-sm font-mono font-semibold', showTrash ? 'text-slate-500 line-through' : 'text-brand-600')}>{c.referral_code}</span></TD>
                  <TD className="py-2.5">
                    <span className="text-sm font-medium text-slate-700">{c.discount_percentage != null ? `${c.discount_percentage}%` : '--'}</span>
                    {c.max_discount_amount && <div className="text-xs text-slate-400">max {formatCurrency(c.max_discount_amount)}</div>}
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REWARD_TYPE_COLORS[c.referrer_reward_type] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(c.referrer_reward_type || '')}
                    </span>
                    <div className="text-xs text-slate-500 mt-0.5">{c.referrer_reward_percentage != null ? `${c.referrer_reward_percentage}%` : '--'}</div>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-700">{c.usage_count ?? 0}</span>
                    <span className="text-xs text-slate-400">/{c.usage_limit ?? '∞'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <div className="text-xs text-slate-600">{c.expires_at ? fromNow(c.expires_at) : 'No expiry'}</div>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-700">{c.total_referrals ?? 0}/{c.successful_referrals ?? 0}</span>
                    <div className="text-xs text-slate-400">total/success</div>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm font-medium text-slate-700">{formatCurrency(c.total_earnings)}</span></TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>}
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Referral Code Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Gift className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 font-mono">{viewing.referral_code}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REWARD_TYPE_COLORS[viewing.referrer_reward_type] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.referrer_reward_type || '')}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Student" value={viewing.users ? `${viewing.users.full_name || ''} (${viewing.users.email || ''})` : `ID: ${viewing.student_id}`} />
              <DetailRow label="Referral Code" value={viewing.referral_code} />
              <DetailRow label="Discount %" value={viewing.discount_percentage != null ? `${viewing.discount_percentage}%` : undefined} />
              <DetailRow label="Max Discount Amount" value={viewing.max_discount_amount != null ? formatCurrency(viewing.max_discount_amount) : undefined} />
              <DetailRow label="Referrer Reward Type" value={capitalize(viewing.referrer_reward_type || '')} />
              <DetailRow label="Referrer Reward %" value={viewing.referrer_reward_percentage != null ? `${viewing.referrer_reward_percentage}%` : undefined} />
              <DetailRow label="Usage" value={`${viewing.usage_count ?? 0} / ${viewing.usage_limit ?? '∞'}`} />
              <DetailRow label="Expires At" value={viewing.expires_at ? new Date(viewing.expires_at).toLocaleString() : 'No expiry'} />
              <DetailRow label="Notes" value={viewing.notes} />
              <DetailRow label="Total Referrals" value={String(viewing.total_referrals ?? 0)} />
              <DetailRow label="Successful Referrals" value={String(viewing.successful_referrals ?? 0)} />
              <DetailRow label="Total Earnings" value={formatCurrency(viewing.total_earnings)} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Referral Code' : 'Create Referral Code'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" key={dialogKey}>
          {/* Student Dropdown */}
          <div ref={studentDropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Student <span className="text-red-500">*</span></label>
            <input type="hidden" {...register('student_id', { required: true })} />
            <button
              type="button"
              onClick={() => { setStudentDropdownOpen(!studentDropdownOpen); setStudentSearch(''); }}
              className={cn(
                'w-full h-10 px-3 text-sm rounded-lg border bg-white text-left flex items-center justify-between transition-colors',
                studentDropdownOpen ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200 hover:border-slate-300',
                !selectedStudentId && 'text-slate-400'
              )}
            >
              <span className="truncate">
                {selectedStudentId
                  ? (() => {
                      const s = students.find(s => String(s.id) === String(selectedStudentId));
                      return s ? `${s.full_name || 'Unnamed'} (${s.email || ''})` : `Student #${selectedStudentId}`;
                    })()
                  : 'Select a student...'}
              </span>
              <ChevronDown className={cn('w-4 h-4 text-slate-400 flex-shrink-0 transition-transform', studentDropdownOpen && 'rotate-180')} />
            </button>
            {studentDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="overflow-y-auto max-h-48">
                  {students
                    .filter(s => {
                      if (!studentSearch) return true;
                      const q = studentSearch.toLowerCase();
                      return (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
                    })
                    .map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setValue('student_id', s.id, { shouldValidate: true });
                          setStudentDropdownOpen(false);
                          setStudentSearch('');
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-left hover:bg-brand-50 transition-colors flex items-center gap-3',
                          String(selectedStudentId) === String(s.id) && 'bg-brand-50'
                        )}
                      >
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{s.full_name || 'Unnamed'}</div>
                          <div className="text-xs text-slate-500 truncate">{s.email || `ID: ${s.id}`}</div>
                        </div>
                        {String(selectedStudentId) === String(s.id) && (
                          <CheckCircle2 className="w-4 h-4 text-brand-600 ml-auto flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  {students.filter(s => {
                    if (!studentSearch) return true;
                    const q = studentSearch.toLowerCase();
                    return (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q);
                  }).length === 0 && (
                    <div className="px-3 py-4 text-sm text-slate-400 text-center">No students found</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Discount %" type="number" step="0.01" placeholder="e.g. 20" {...register('discount_percentage', { required: true })} />
            <Input label="Max Discount Amount" type="number" step="0.01" placeholder="Optional cap amount" {...register('max_discount_amount')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Referrer Reward Type</label>
              <select className={cn(selectClass, 'w-full')} {...register('referrer_reward_type')}>
                {REFERRER_REWARD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Input label="Referrer Reward %" type="number" step="0.01" placeholder="e.g. 10" {...register('referrer_reward_percentage', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Usage Limit" type="number" placeholder="Leave empty for unlimited" {...register('usage_limit')} />
            <Input label="Expires At" type="datetime-local" {...register('expires_at')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" placeholder="Optional notes about this referral code..." {...register('notes')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_active')} />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>
          {!editing && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">The referral code will be auto-generated from the student name (e.g. GIRISH-A3X9).</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: REFERRAL USAGES
// ══════════════════════════════════════════════════════════════════
function ReferralUsagesTab() {
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
  const [sortField, setSortField] = useState<UsageSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterUsageStatus, setFilterUsageStatus] = useState('');
  const [filterCodeId, setFilterCodeId] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('referral_usages').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterUsageStatus, filterCodeId, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterUsageStatus, filterCodeId, showTrash]);

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
      if (filterUsageStatus) qs.set('usage_status', filterUsageStatus);
      if (filterCodeId) qs.set('referral_code_id', filterCodeId);
    }
    const res = await api.listReferralUsages('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('referral_usages');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: UsageSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: UsageSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      referral_code_id: '', referred_user_id: '', usage_status: 'pending',
      discount_applied: '', order_id: '', order_amount: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      referral_code_id: c.referral_code_id ?? '', referred_user_id: c.referred_user_id ?? '',
      usage_status: c.usage_status || 'pending', discount_applied: c.discount_applied ?? '',
      order_id: c.order_id ?? '', order_amount: c.order_amount ?? '', is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['referral_code_id', 'referred_user_id', 'discount_applied', 'order_id', 'order_amount'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });
    const res = editing
      ? await api.updateReferralUsage(editing.id, payload)
      : await api.createReferralUsage(payload);
    if (res.success) {
      toast.success(editing ? 'Usage updated' : 'Usage created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move usage #${c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteReferralUsage(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Usage moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreReferralUsage(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Usage #${c.id} restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete usage #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteReferralUsage(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Usage permanently deleted'); load(); refreshSummary(); }
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
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.softDeleteReferralUsage(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) moved to trash`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreReferralUsage(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) restored`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteReferralUsage(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) permanently deleted`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Usages', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Referral Usages</button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1"><Button onClick={openCreate}><Plus className="w-4 h-4" /> Add usage</Button></div>
        )}
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search usages...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterUsageStatus} onChange={e => setFilterUsageStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {USAGE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Input placeholder="Code ID" value={filterCodeId} onChange={(e: any) => setFilterCodeId(e.target.value)} className="w-28 h-10" />
          </>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Users}
          title={showTrash ? 'Trash is empty' : 'No referral usages yet'}
          description={showTrash ? 'No deleted usages' : (searchDebounce || filterUsageStatus || filterCodeId ? 'No usages match your filters' : 'Create your first referral usage')}
          action={!showTrash && !searchDebounce && !filterUsageStatus && !filterCodeId ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add usage</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
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
                <TH>Referral Code</TH>
                <TH>Referred User</TH>
                <TH><button onClick={() => handleSort('usage_status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="usage_status" /></button></TH>
                <TH><button onClick={() => handleSort('discount_applied')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Discount Applied <SortIcon field="discount_applied" /></button></TH>
                <TH><button onClick={() => handleSort('order_amount')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Order Amount <SortIcon field="order_amount" /></button></TH>
                <TH><button onClick={() => handleSort('converted_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Converted At <SortIcon field="converted_at" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Active <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">
                    {c.referral_codes ? (
                      <div>
                        <span className="text-sm font-mono font-semibold text-brand-600">{c.referral_codes.referral_code}</span>
                        {c.referral_codes.users && <div className="text-xs text-slate-400">{c.referral_codes.users.full_name || c.referral_codes.users.email}</div>}
                      </div>
                    ) : <span className="text-slate-400 text-sm">Code ID: {c.referral_code_id}</span>}
                  </TD>
                  <TD className="py-2.5">{c.users ? userLine(c.users) : <span className="text-slate-400 text-sm">ID: {c.referred_user_id}</span>}</TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', USAGE_STATUS_COLORS[c.usage_status] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(c.usage_status || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{formatCurrency(c.discount_applied)}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{formatCurrency(c.order_amount)}</span></TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-600">{c.converted_at ? fromNow(c.converted_at) : '--'}</span></TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>}
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Referral Usage Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200 flex-shrink-0">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Usage #{viewing.id}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', USAGE_STATUS_COLORS[viewing.usage_status] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.usage_status || '')}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Referral Code" value={viewing.referral_codes?.referral_code || `ID: ${viewing.referral_code_id}`} />
              <DetailRow label="Code Owner" value={viewing.referral_codes?.users ? `${viewing.referral_codes.users.full_name || ''} (${viewing.referral_codes.users.email || ''})` : '--'} />
              <DetailRow label="Referred User" value={viewing.users ? `${viewing.users.full_name || ''} (${viewing.users.email || ''})` : `ID: ${viewing.referred_user_id}`} />
              <DetailRow label="Usage Status" value={capitalize(viewing.usage_status || '')} />
              <DetailRow label="Discount Applied" value={formatCurrency(viewing.discount_applied)} />
              <DetailRow label="Order ID" value={viewing.order_id != null ? String(viewing.order_id) : undefined} />
              <DetailRow label="Order Amount" value={formatCurrency(viewing.order_amount)} />
              <DetailRow label="Converted At" value={viewing.converted_at ? new Date(viewing.converted_at).toLocaleString() : undefined} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Referral Usage' : 'Create Referral Usage'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" key={dialogKey}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Referral Code ID" type="number" placeholder="FK to referral_codes" {...register('referral_code_id', { required: true })} />
            <Input label="Referred User ID" type="number" placeholder="FK to users" {...register('referred_user_id', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Usage Status</label>
            <select className={cn(selectClass, 'w-full')} {...register('usage_status')}>
              {USAGE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Discount Applied" type="number" step="0.01" placeholder="0.00" {...register('discount_applied')} />
            <Input label="Order ID" type="number" placeholder="Order ID" {...register('order_id')} />
          </div>
          <Input label="Order Amount" type="number" step="0.01" placeholder="0.00" {...register('order_amount')} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_active')} />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 3: REFERRAL REWARDS
// ══════════════════════════════════════════════════════════════════
function ReferralRewardsTab() {
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
  const [sortField, setSortField] = useState<RewardSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterRewardType, setFilterRewardType] = useState('');
  const [filterRewardStatus, setFilterRewardStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('referral_rewards').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterRewardType, filterRewardStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterRewardType, filterRewardStatus, showTrash]);

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
      if (filterRewardType) qs.set('reward_type', filterRewardType);
      if (filterRewardStatus) qs.set('status', filterRewardStatus);
    }
    const res = await api.listReferralRewards('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('referral_rewards');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: RewardSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: RewardSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      referral_code_id: '', referral_usage_id: '', reward_type: 'wallet_credit',
      reward_amount: '', status: 'pending', notes: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      referral_code_id: c.referral_code_id ?? '', referral_usage_id: c.referral_usage_id ?? '',
      reward_type: c.reward_type || 'wallet_credit', reward_amount: c.reward_amount ?? '',
      status: c.status || 'pending', notes: c.notes || '', is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['referral_code_id', 'referral_usage_id', 'reward_amount'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });
    const res = editing
      ? await api.updateReferralReward(editing.id, payload)
      : await api.createReferralReward(payload);
    if (res.success) {
      toast.success(editing ? 'Reward updated' : 'Reward created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move reward #${c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteReferralReward(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Reward moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreReferralReward(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Reward #${c.id} restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete reward #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteReferralReward(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Reward permanently deleted'); load(); refreshSummary(); }
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
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.softDeleteReferralReward(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) moved to trash`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreReferralReward(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) restored`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteReferralReward(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) permanently deleted`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Rewards', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Referral Rewards</button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1"><Button onClick={openCreate}><Plus className="w-4 h-4" /> Add reward</Button></div>
        )}
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search rewards...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterRewardType} onChange={e => setFilterRewardType(e.target.value)}>
              <option value="">All Reward Types</option>
              {REWARD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterRewardStatus} onChange={e => setFilterRewardStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {REWARD_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Award}
          title={showTrash ? 'Trash is empty' : 'No referral rewards yet'}
          description={showTrash ? 'No deleted rewards' : (searchDebounce || filterRewardType || filterRewardStatus ? 'No rewards match your filters' : 'Create your first referral reward')}
          action={!showTrash && !searchDebounce && !filterRewardType && !filterRewardStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add reward</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
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
                <TH>Referral Code</TH>
                <TH>Usage</TH>
                <TH><button onClick={() => handleSort('reward_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Reward Type <SortIcon field="reward_type" /></button></TH>
                <TH><button onClick={() => handleSort('reward_amount')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Amount <SortIcon field="reward_amount" /></button></TH>
                <TH><button onClick={() => handleSort('status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="status" /></button></TH>
                <TH><button onClick={() => handleSort('credited_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Credited At <SortIcon field="credited_at" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Active <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">
                    {c.referral_codes ? (
                      <div>
                        <span className="text-sm font-mono font-semibold text-brand-600">{c.referral_codes.referral_code}</span>
                        {c.referral_codes.users && <div className="text-xs text-slate-400">{c.referral_codes.users.full_name || c.referral_codes.users.email}</div>}
                      </div>
                    ) : <span className="text-slate-400 text-sm">Code ID: {c.referral_code_id}</span>}
                  </TD>
                  <TD className="py-2.5">
                    {c.referral_usages ? (
                      <div>
                        <span className="text-sm text-slate-700">Usage #{c.referral_usages.id}</span>
                        {c.referral_usages.users && <div className="text-xs text-slate-400">{c.referral_usages.users.full_name || c.referral_usages.users.email}</div>}
                      </div>
                    ) : <span className="text-slate-400 text-sm">Usage ID: {c.referral_usage_id}</span>}
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REWARD_TYPE_COLORS[c.reward_type] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(c.reward_type || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm font-medium text-slate-700">{formatCurrency(c.reward_amount)}</span></TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REWARD_STATUS_COLORS[c.status] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(c.status || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-600">{c.credited_at ? fromNow(c.credited_at) : '--'}</span></TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>}
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Referral Reward Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-violet-50 flex items-center justify-center border border-violet-200 flex-shrink-0">
                <Award className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reward #{viewing.id}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REWARD_STATUS_COLORS[viewing.status] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.status || '')}</span>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', REWARD_TYPE_COLORS[viewing.reward_type] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.reward_type || '')}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Referral Code" value={viewing.referral_codes?.referral_code || `ID: ${viewing.referral_code_id}`} />
              <DetailRow label="Code Owner" value={viewing.referral_codes?.users ? `${viewing.referral_codes.users.full_name || ''} (${viewing.referral_codes.users.email || ''})` : '--'} />
              <DetailRow label="Usage ID" value={viewing.referral_usage_id != null ? `#${viewing.referral_usage_id}` : undefined} />
              <DetailRow label="Referred User" value={viewing.referral_usages?.users ? `${viewing.referral_usages.users.full_name || ''} (${viewing.referral_usages.users.email || ''})` : '--'} />
              <DetailRow label="Reward Type" value={capitalize(viewing.reward_type || '')} />
              <DetailRow label="Reward Amount" value={formatCurrency(viewing.reward_amount)} />
              <DetailRow label="Status" value={capitalize(viewing.status || '')} />
              <DetailRow label="Credited At" value={viewing.credited_at ? new Date(viewing.credited_at).toLocaleString() : undefined} />
              <DetailRow label="Notes" value={viewing.notes} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Referral Reward' : 'Create Referral Reward'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" key={dialogKey}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Referral Code ID" type="number" placeholder="FK to referral_codes" {...register('referral_code_id', { required: true })} />
            <Input label="Referral Usage ID" type="number" placeholder="FK to referral_usages" {...register('referral_usage_id', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Reward Type</label>
              <select className={cn(selectClass, 'w-full')} {...register('reward_type')}>
                {REWARD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <Input label="Reward Amount" type="number" step="0.01" placeholder="0.00" {...register('reward_amount', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select className={cn(selectClass, 'w-full')} {...register('status')}>
              {REWARD_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" placeholder="Optional notes..." {...register('notes')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_active')} />
            <span className="text-sm font-medium text-slate-700">Active</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
