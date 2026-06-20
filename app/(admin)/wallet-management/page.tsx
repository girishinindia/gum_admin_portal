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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle,
  Loader2, X, Wallet, ArrowDownCircle, ArrowUpCircle, Snowflake,
  Sun, CreditCard, History, Search,
} from 'lucide-react';
import { cn, fromNow, formatDate } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ───────────────────────────────────────────────────────
type MainTab = 'wallets' | 'transactions';

type WalletSortField = 'id' | 'balance' | 'total_credited' | 'total_debited' | 'is_frozen' | 'payout_day' | 'is_active';
type TxSortField = 'id' | 'transaction_type' | 'amount' | 'source_type' | 'status' | 'created_at' | 'is_active';

// ─── Constants ───────────────────────────────────────────────────
const TRANSACTION_TYPES = [
  { value: 'credit', label: 'Credit' },
  { value: 'debit', label: 'Debit' },
  { value: 'withdrawal', label: 'Withdrawal' },
  { value: 'payout', label: 'Payout' },
];
const SOURCE_TYPES = [
  { value: 'earning', label: 'Earning' },
  { value: 'referral', label: 'Referral' },
  { value: 'refund', label: 'Refund' },
  { value: 'payout', label: 'Payout' },
  { value: 'manual', label: 'Manual' },
  { value: 'reversal', label: 'Reversal' },
];
const TX_STATUSES = [
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'reversed', label: 'Reversed' },
];

const TX_TYPE_COLORS: Record<string, string> = {
  credit: 'bg-emerald-50 text-emerald-700',
  debit: 'bg-red-50 text-red-700',
  withdrawal: 'bg-amber-50 text-amber-700',
  payout: 'bg-blue-50 text-blue-700',
};
const SOURCE_TYPE_COLORS: Record<string, string> = {
  earning: 'bg-emerald-50 text-emerald-700',
  referral: 'bg-violet-50 text-violet-700',
  refund: 'bg-amber-50 text-amber-700',
  payout: 'bg-blue-50 text-blue-700',
  manual: 'bg-slate-100 text-slate-600',
  reversal: 'bg-red-50 text-red-700',
};
const TX_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  reversed: 'bg-red-50 text-red-700',
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

function formatCurrency(val: any) {
  if (val === null || val === undefined || val === '') return '--';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(val));
}

function walletUserLine(wallet: any) {
  const user = wallet?.user;
  if (!user) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '--';
  return (
    <div>
      <div className="text-sm font-medium text-slate-900">{name}</div>
      {user.email && <div className="text-xs text-slate-500">{user.email}</div>}
    </div>
  );
}

function txUserLine(tx: any) {
  const wallet = tx?.wallet;
  const user = wallet?.user;
  if (!user) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || '--';
  return (
    <div>
      <div className="text-sm font-medium text-slate-900">{name}</div>
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
export default function WalletManagementPage() {
  const [mainTab, setMainTab] = useState<MainTab>('wallets');

  return (
    <div className="animate-fade-in">
      <PageHeader title="Wallet Management" />

      {/* ── Main Tabs ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'wallets' as MainTab, label: 'Wallets', icon: Wallet },
          { id: 'transactions' as MainTab, label: 'Transactions', icon: History },
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
      {mainTab === 'wallets' && <WalletsTab />}
      {mainTab === 'transactions' && <TransactionsTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: WALLETS
// ══════════════════════════════════════════════════════════════════
function WalletsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [debitDialogOpen, setDebitDialogOpen] = useState(false);
  const [creditDebitTarget, setCreditDebitTarget] = useState<any | null>(null);
  const [creditDebitKey, setCreditDebitKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<WalletSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterFrozen, setFilterFrozen] = useState('');
  const [filterMinBalance, setFilterMinBalance] = useState('');
  const [filterMaxBalance, setFilterMaxBalance] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const creditForm = useForm();
  const debitForm = useForm();

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary on mount
  useEffect(() => {
    api.getTableSummary('wallets').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterFrozen, filterMinBalance, filterMaxBalance, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterFrozen, filterMinBalance, filterMaxBalance, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = {
      page, limit: pageSize, sort: sortField, order: sortOrder,
    };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) {
      params.show_deleted = 'true';
    } else {
      if (filterFrozen) params.is_frozen = filterFrozen;
      if (filterMinBalance) params.min_balance = filterMinBalance;
      if (filterMaxBalance) params.max_balance = filterMaxBalance;
    }
    const res = await api.getWallets(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('wallets');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: WalletSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: WalletSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      user_id: '', auto_payout_enabled: false, payout_day: '',
      min_payout_amount: '500', payout_method: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(w: any) {
    setEditing(w); setDialogKey(k => k + 1);
    reset({
      user_id: w.user_id ?? '', auto_payout_enabled: w.auto_payout_enabled ?? false,
      payout_day: w.payout_day ?? '', min_payout_amount: w.min_payout_amount ?? '500',
      payout_method: w.payout_method || '', is_active: w.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['user_id', 'payout_day', 'min_payout_amount'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateWallet(editing.id, payload)
      : await api.createWallet(payload);
    if (res.success) {
      toast.success(editing ? 'Wallet updated' : 'Wallet created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  function openCreditDialog(w: any) {
    setCreditDebitTarget(w); setCreditDebitKey(k => k + 1);
    creditForm.reset({ amount: '', description: '' });
    setCreditDialogOpen(true);
  }

  function openDebitDialog(w: any) {
    setCreditDebitTarget(w); setCreditDebitKey(k => k + 1);
    debitForm.reset({ amount: '', description: '' });
    setDebitDialogOpen(true);
  }

  async function onCreditSubmit(data: any) {
    if (!creditDebitTarget) return;
    const res = await api.walletManualCredit(creditDebitTarget.id, { amount: Number(data.amount), description: data.description });
    if (res.success) {
      toast.success(`${formatCurrency(data.amount)} credited to wallet #${creditDebitTarget.id}`);
      setCreditDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Credit failed');
  }

  async function onDebitSubmit(data: any) {
    if (!creditDebitTarget) return;
    const res = await api.walletManualDebit(creditDebitTarget.id, { amount: Number(data.amount), description: data.description });
    if (res.success) {
      toast.success(`${formatCurrency(data.amount)} debited from wallet #${creditDebitTarget.id}`);
      setDebitDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Debit failed');
  }

  // BUG-39: users for the create-wallet picker
  const [pickUsers, setPickUsers] = useState<any[]>([]);
  useEffect(() => {
    api.listUsers('?limit=500&sort=first_name&order=asc').then((r: any) => setPickUsers(r?.data || [])).catch(() => setPickUsers([]));
  }, []);
  const pickUserOptions = pickUsers.map((u: any) => ({
    value: String(u.id),
    label: `${[u.first_name, u.last_name].filter(Boolean).join(' ') || 'User'} — ${u.email || u.mobile || `#${u.id}`}`,
  }));

  async function onToggleFreeze(w: any) {
    const action = w.is_frozen ? 'unfreeze' : 'freeze';
    // BUG-42: freezing requires a reason (recorded + shown in details)
    let reason: string | null = null;
    if (action === 'freeze') {
      reason = window.prompt('Reason for freezing this wallet (required):', '');
      if (reason === null) return;            // cancelled
      if (!reason.trim()) { toast.error('A freeze reason is required'); return; }
    }
    if (!confirm(`${capitalize(action)} wallet #${w.id}?`)) return;
    setActionLoadingId(w.id);
    const res = await api.toggleFreezeWallet(w.id, reason ? { reason: reason.trim() } : undefined);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Wallet ${action === 'freeze' ? 'frozen' : 'unfrozen'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(w: any) {
    if (!confirm(`Move wallet #${w.id} to trash?`)) return;
    setActionLoadingId(w.id);
    const res = await api.softDeleteWallet(w.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Wallet moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(w: any) {
    setActionLoadingId(w.id);
    const res = await api.restoreWallet(w.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Wallet #${w.id} restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(w: any) {
    if (!confirm(`PERMANENTLY delete wallet #${w.id}? This cannot be undone.`)) return;
    setActionLoadingId(w.id);
    const res = await api.permanentDeleteWallet(w.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Wallet permanently deleted'); load(); refreshSummary(); }
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
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.softDeleteWallet(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) moved to trash`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreWallet(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) restored`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteWallet(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) permanently deleted`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Wallets', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Wallets</button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1"><Button onClick={openCreate}><Plus className="w-4 h-4" /> Create Wallet</Button></div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by user name or email...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterFrozen} onChange={e => setFilterFrozen(e.target.value)}>
              <option value="">All Frozen Status</option>
              <option value="true">Frozen</option>
              <option value="false">Not Frozen</option>
            </select>
            <Input placeholder="Min Balance" type="number" value={filterMinBalance} onChange={(e: any) => setFilterMinBalance(e.target.value)} className="w-28 h-10" />
            <Input placeholder="Max Balance" type="number" value={filterMaxBalance} onChange={(e: any) => setFilterMaxBalance(e.target.value)} className="w-28 h-10" />
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
          icon={showTrash ? Trash2 : Wallet}
          title={showTrash ? 'Trash is empty' : 'No wallets yet'}
          description={showTrash ? 'No deleted wallets' : (searchDebounce || filterFrozen || filterMinBalance || filterMaxBalance ? 'No wallets match your filters' : 'Create your first wallet')}
          action={!showTrash && !searchDebounce && !filterFrozen && !filterMinBalance && !filterMaxBalance ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create Wallet</Button> : undefined}
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
                <TH>User</TH>
                <TH><button onClick={() => handleSort('balance')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Balance <SortIcon field="balance" /></button></TH>
                <TH><button onClick={() => handleSort('total_credited')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Total Credited <SortIcon field="total_credited" /></button></TH>
                <TH><button onClick={() => handleSort('total_debited')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Total Debited <SortIcon field="total_debited" /></button></TH>
                <TH><button onClick={() => handleSort('is_frozen')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Frozen <SortIcon field="is_frozen" /></button></TH>
                <TH><button onClick={() => handleSort('payout_day')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Payout Day <SortIcon field="payout_day" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Active <SortIcon field="is_active" /></button></TH>
                <TH><div className="flex items-center justify-end gap-1 pr-1.5">Actions</div></TH>
              </TR>
            </THead>
            <TBody>
              {items.map(w => (
                <TR key={w.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(w.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(w.id)} onChange={() => toggleSelect(w.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{w.id}</span></TD>
                  <TD className="py-2.5">{walletUserLine(w) || <span className="text-slate-400 text-sm">User ID: {w.user_id}</span>}</TD>
                  <TD className="py-2.5"><span className="text-sm font-semibold text-slate-900">{formatCurrency(w.balance)}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-emerald-600">{formatCurrency(w.total_credited)}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-red-600">{formatCurrency(w.total_debited)}</span></TD>
                  <TD className="py-2.5">
                    {w.is_frozen ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"><Snowflake className="w-3 h-3" /> Frozen</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">Active</span>
                    )}
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{w.payout_day ?? '--'}</span></TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{w.deleted_at ? fromNow(w.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={w.is_active ? 'success' : 'danger'}>{w.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(w)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(w)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewing(w)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(w)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onToggleFreeze(w)} disabled={actionLoadingId !== null} className={cn('p-1.5 rounded-md transition-colors disabled:opacity-50', w.is_frozen ? 'text-blue-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50')} title={w.is_frozen ? 'Unfreeze' : 'Freeze'}>
                            {actionLoadingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : w.is_frozen ? <Sun className="w-3.5 h-3.5" /> : <Snowflake className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => openCreditDialog(w)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Credit"><ArrowDownCircle className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openDebitDialog(w)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Debit"><ArrowUpCircle className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(w)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Wallet Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Wallet className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Wallet #{viewing.id}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  {viewing.is_frozen && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700"><Snowflake className="w-3 h-3" /> Frozen</span>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="User" value={viewing.user ? `${[viewing.user.first_name, viewing.user.last_name].filter(Boolean).join(' ')} (${viewing.user.email || ''})` : `User ID: ${viewing.user_id}`} />
              <DetailRow label="Balance" value={formatCurrency(viewing.balance)} />
              <DetailRow label="Currency" value={viewing.currency || 'INR'} />
              <DetailRow label="Total Credited" value={formatCurrency(viewing.total_credited)} />
              <DetailRow label="Total Debited" value={formatCurrency(viewing.total_debited)} />
              <DetailRow label="Total Withdrawn" value={formatCurrency(viewing.total_withdrawn)} />
              <DetailRow label="Frozen" value={viewing.is_frozen ? 'Yes' : 'No'} />
              {viewing.is_frozen && <DetailRow label="Frozen Reason" value={viewing.frozen_reason || '—'} />}
              {viewing.is_frozen && viewing.frozen_at && <DetailRow label="Frozen At" value={new Date(viewing.frozen_at).toLocaleString()} />}
              <DetailRow label="Auto Payout" value={viewing.auto_payout_enabled ? 'Enabled' : 'Disabled'} />
              <DetailRow label="Payout Day" value={viewing.payout_day != null ? String(viewing.payout_day) : undefined} />
              <DetailRow label="Min Payout Amount" value={formatCurrency(viewing.min_payout_amount)} />
              <DetailRow label="Payout Method" value={viewing.payout_method} />
              <DetailRow label="Payout Details" value={viewing.payout_details ? JSON.stringify(viewing.payout_details) : undefined} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Wallet' : 'Create Wallet'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" key={dialogKey}>
          {/* BUG-39: searchable user picker instead of a raw ID */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">User *</label>
            <SearchableSelect options={pickUserOptions} value={watch('user_id') ? String(watch('user_id')) : ''} onChange={(v) => setValue('user_id', v, { shouldValidate: true })} placeholder="Search by name or email…" />
            <input type="hidden" {...register('user_id', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Payout Day (1-28)" type="number" min={1} max={28} placeholder="e.g. 15" {...register('payout_day')} />
            <Input label="Min Payout Amount" type="number" step="0.01" placeholder="e.g. 500" {...register('min_payout_amount')} />
          </div>
          <Input label="Payout Method" placeholder="e.g. bank_transfer, upi" {...register('payout_method')} />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('auto_payout_enabled')} />
              <span className="text-sm font-medium text-slate-700">Auto Payout Enabled</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_active')} />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Credit Dialog ── */}
      <Dialog open={creditDialogOpen} onClose={() => setCreditDialogOpen(false)} title="Manual Credit" size="sm">
        <form onSubmit={creditForm.handleSubmit(onCreditSubmit)} className="p-6 space-y-4" key={`credit-${creditDebitKey}`}>
          {creditDebitTarget && (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <ArrowDownCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-emerald-800">Credit to Wallet #{creditDebitTarget.id}</div>
                <div className="text-xs text-emerald-600">Current balance: {formatCurrency(creditDebitTarget.balance)}</div>
              </div>
            </div>
          )}
          <Input label="Amount" type="number" step="0.01" min="0.01" placeholder="Enter amount" {...creditForm.register('amount', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <textarea className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" placeholder="Reason for manual credit..." {...creditForm.register('description', { required: true })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreditDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Credit Amount</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Debit Dialog ── */}
      <Dialog open={debitDialogOpen} onClose={() => setDebitDialogOpen(false)} title="Manual Debit" size="sm">
        <form onSubmit={debitForm.handleSubmit(onDebitSubmit)} className="p-6 space-y-4" key={`debit-${creditDebitKey}`}>
          {creditDebitTarget && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <ArrowUpCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-red-800">Debit from Wallet #{creditDebitTarget.id}</div>
                <div className="text-xs text-red-600">Current balance: {formatCurrency(creditDebitTarget.balance)}</div>
              </div>
            </div>
          )}
          <Input label="Amount" type="number" step="0.01" min="0.01" placeholder="Enter amount" {...debitForm.register('amount', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description <span className="text-red-500">*</span></label>
            <textarea className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" placeholder="Reason for manual debit..." {...debitForm.register('description', { required: true })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDebitDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger">Debit Amount</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: TRANSACTIONS
// ══════════════════════════════════════════════════════════════════
function TransactionsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<any | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<TxSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterTxType, setFilterTxType] = useState('');
  const [filterSourceType, setFilterSourceType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary on mount
  useEffect(() => {
    api.getTableSummary('wallet_transactions').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterTxType, filterSourceType, filterStatus, filterDateFrom, filterDateTo, filterMinAmount, filterMaxAmount, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterTxType, filterSourceType, filterStatus, filterDateFrom, filterDateTo, filterMinAmount, filterMaxAmount, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = {
      page, limit: pageSize, sort: sortField, order: sortOrder,
    };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) {
      params.show_deleted = 'true';
    } else {
      if (filterTxType) params.transaction_type = filterTxType;
      if (filterSourceType) params.source_type = filterSourceType;
      if (filterStatus) params.status = filterStatus;
      if (filterDateFrom) params.from_date = filterDateFrom;
      if (filterDateTo) params.to_date = `${filterDateTo}T23:59:59`;
      if (filterMinAmount) params.min_amount = filterMinAmount;
      if (filterMaxAmount) params.max_amount = filterMaxAmount;
    }
    const res = await api.getWalletTransactions(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('wallet_transactions');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: TxSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: TxSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  async function onReverse(tx: any) {
    if (!confirm(`Reverse transaction #${tx.id}? This will create a reversal entry.`)) return;
    setActionLoadingId(tx.id);
    const res = await api.reverseWalletTransaction(tx.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Transaction reversed'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(tx: any) {
    if (!confirm(`Move transaction #${tx.id} to trash?`)) return;
    setActionLoadingId(tx.id);
    const res = await api.softDeleteWalletTransaction(tx.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Transaction moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(tx: any) {
    setActionLoadingId(tx.id);
    const res = await api.restoreWalletTransaction(tx.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Transaction #${tx.id} restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(tx: any) {
    if (!confirm(`PERMANENTLY delete transaction #${tx.id}? This cannot be undone.`)) return;
    setActionLoadingId(tx.id);
    const res = await api.permanentDeleteWalletTransaction(tx.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Transaction permanently deleted'); load(); refreshSummary(); }
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
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.softDeleteWalletTransaction(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) moved to trash`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreWalletTransaction(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) restored`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteWalletTransaction(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) permanently deleted`); setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Transactions', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Transactions</button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>}
        </button>
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search transactions...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterTxType} onChange={e => setFilterTxType(e.target.value)}>
              <option value="">All Types</option>
              {TRANSACTION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterSourceType} onChange={e => setFilterSourceType(e.target.value)}>
              <option value="">All Sources</option>
              {SOURCE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {TX_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Input type="date" value={filterDateFrom} onChange={(e: any) => setFilterDateFrom(e.target.value)} className="w-36 h-10" title="Date from" />
            <Input type="date" value={filterDateTo} onChange={(e: any) => setFilterDateTo(e.target.value)} className="w-36 h-10" title="Date to" />
            <Input type="number" value={filterMinAmount} onChange={(e: any) => setFilterMinAmount(e.target.value)} className="w-28 h-10" placeholder="Min amt" title="Min amount" />
            <Input type="number" value={filterMaxAmount} onChange={(e: any) => setFilterMaxAmount(e.target.value)} className="w-28 h-10" placeholder="Max amt" title="Max amount" />
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
          icon={showTrash ? Trash2 : CreditCard}
          title={showTrash ? 'Trash is empty' : 'No transactions yet'}
          description={showTrash ? 'No deleted transactions' : (searchDebounce || filterTxType || filterSourceType || filterStatus || filterDateFrom || filterDateTo ? 'No transactions match your filters' : 'No wallet transactions recorded yet')}
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
                <TH>User</TH>
                <TH><button onClick={() => handleSort('transaction_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Type <SortIcon field="transaction_type" /></button></TH>
                <TH><button onClick={() => handleSort('amount')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Amount <SortIcon field="amount" /></button></TH>
                <TH>Balance Before/After</TH>
                <TH><button onClick={() => handleSort('source_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Source <SortIcon field="source_type" /></button></TH>
                <TH>Description</TH>
                <TH><button onClick={() => handleSort('status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="status" /></button></TH>
                <TH><button onClick={() => handleSort('created_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Created <SortIcon field="created_at" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><div className="flex items-center justify-end gap-1 pr-1.5">Actions</div></TH>
              </TR>
            </THead>
            <TBody>
              {items.map(tx => (
                <TR key={tx.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(tx.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(tx.id)} onChange={() => toggleSelect(tx.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{tx.id}</span></TD>
                  <TD className="py-2.5">{txUserLine(tx) || <span className="text-slate-400 text-sm">Wallet: {tx.wallet_id}</span>}</TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', TX_TYPE_COLORS[tx.transaction_type] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(tx.transaction_type || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm font-semibold text-slate-900">{formatCurrency(tx.amount)}</span></TD>
                  <TD className="py-2.5">
                    <span className="text-xs text-slate-500">{formatCurrency(tx.balance_before)}</span>
                    <span className="text-xs text-slate-400 mx-1">&rarr;</span>
                    <span className="text-xs text-slate-700 font-medium">{formatCurrency(tx.balance_after)}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', SOURCE_TYPE_COLORS[tx.source_type] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(tx.source_type || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-600 max-w-[200px] truncate block">{tx.description || '--'}</span></TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', TX_STATUS_COLORS[tx.status] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(tx.status || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-600">{tx.created_at ? formatDate(tx.created_at, 'MMM D, YYYY') : '--'}</span></TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{tx.deleted_at ? fromNow(tx.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(tx)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === tx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(tx)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === tx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewing(tx)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          {tx.status === 'completed' && (
                            <button onClick={() => onReverse(tx)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="Reverse">
                              {actionLoadingId === tx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => onSoftDelete(tx)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === tx.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Transaction Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <CreditCard className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Transaction #{viewing.id}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', TX_TYPE_COLORS[viewing.transaction_type] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.transaction_type || '')}</span>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', TX_STATUS_COLORS[viewing.status] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.status || '')}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Wallet ID" value={String(viewing.wallet_id)} />
              <DetailRow label="User" value={viewing.wallet?.user ? `${[viewing.wallet.user.first_name, viewing.wallet.user.last_name].filter(Boolean).join(' ')} (${viewing.wallet.user.email || ''})` : '--'} />
              <DetailRow label="Transaction Type" value={capitalize(viewing.transaction_type || '')} />
              <DetailRow label="Amount" value={formatCurrency(viewing.amount)} />
              <DetailRow label="Balance Before" value={formatCurrency(viewing.balance_before)} />
              <DetailRow label="Balance After" value={formatCurrency(viewing.balance_after)} />
              <DetailRow label="Source Type" value={capitalize(viewing.source_type || '')} />
              <DetailRow label="Source ID" value={viewing.source_id != null ? String(viewing.source_id) : undefined} />
              <DetailRow label="Status" value={capitalize(viewing.status || '')} />
              <DetailRow label="Description" value={viewing.description} />
            </div>
            {viewing.metadata && Object.keys(viewing.metadata).length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Metadata</dt>
                <pre className="text-xs text-slate-700 bg-slate-50 rounded-lg p-3 overflow-auto max-h-48 border border-slate-200">{JSON.stringify(viewing.metadata, null, 2)}</pre>
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              {viewing.status === 'completed' && (
                <Button variant="danger" onClick={() => { setViewing(null); onReverse(viewing); }}><RotateCcw className="w-4 h-4" /> Reverse</Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
