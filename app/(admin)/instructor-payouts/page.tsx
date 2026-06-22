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
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  Loader2, X, MoreVertical, Banknote, Ban, Check,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ────────────────────────────────────────────────────────
type ActiveTab = 'requests' | 'settlements';
type ReqSortField = 'id' | 'request_number' | 'requested_amount' | 'request_status' | 'created_at';
type SettSortField = 'id' | 'settlement_number' | 'settlement_amount' | 'settlement_status' | 'created_at';

// ─── Constants ────────────────────────────────────────────────────
const REQUEST_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SETTLEMENT_STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const PAYMENT_METHODS = [
  { value: '', label: 'All Methods' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  processing: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  failed: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
};

const METHOD_COLORS: Record<string, string> = {
  bank_transfer: 'bg-blue-50 text-blue-700',
  upi: 'bg-violet-50 text-violet-700',
  paypal: 'bg-cyan-50 text-cyan-700',
  other: 'bg-slate-100 text-slate-600',
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

function formatCurrency(amount: number | null | undefined) {
  return `₹${amount?.toFixed(2) || '0.00'}`;
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════
export default function InstructorPayoutsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('requests');

  // ════════════════════════════════════════════════════════════════
  // TAB 1 — PAYOUT REQUESTS STATE
  // ════════════════════════════════════════════════════════════════
  const [reqData, setReqData] = useState<any[]>([]);
  const [reqTotal, setReqTotal] = useState(0);
  const [reqTrashCount, setReqTrashCount] = useState(0);
  const [reqPage, setReqPage] = useState(1);
  const [reqPageSize, setReqPageSize] = usePageSize(10);
  const [reqSort, setReqSort] = useState<ReqSortField>('created_at');
  const [reqAsc, setReqAsc] = useState(false);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqShowTrash, setReqShowTrash] = useState(false);
  const [reqSearch, setReqSearch] = useState('');
  const [reqStatusFilter, setReqStatusFilter] = useState('');
  const [reqMethodFilter, setReqMethodFilter] = useState('');
  const reqToolbarRef = useRef<DataToolbarHandle>(null);

  const [reqStats, setReqStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, processing: 0 });

  // View
  const [reqViewOpen, setReqViewOpen] = useState(false);
  const [reqViewItem, setReqViewItem] = useState<any>(null);
  const [reqViewLoading, setReqViewLoading] = useState(false);

  // Create
  const [reqCreateOpen, setReqCreateOpen] = useState(false);
  const [reqCreating, setReqCreating] = useState(false);
  const { register: regReqCreate, handleSubmit: handleReqCreate, reset: resetReqCreate } = useForm();
  // Instructor picker source for the create form (searchable dropdown).
  const [instructors, setInstructors] = useState<any[]>([]);
  const [reqCreateInstructorId, setReqCreateInstructorId] = useState('');
  useEffect(() => {
    api.listUsers('?type=instructor&limit=500&sort=first_name&order=asc')
      .then((r: any) => setInstructors(r?.data || []))
      .catch(() => setInstructors([]));
  }, []);

  // Edit
  const [reqEditOpen, setReqEditOpen] = useState(false);
  const [reqEditItem, setReqEditItem] = useState<any>(null);
  const [reqSaving, setReqSaving] = useState(false);
  const { register: regReqEdit, handleSubmit: handleReqEdit, reset: resetReqEdit } = useForm();

  // Approve
  const [reqApproveOpen, setReqApproveOpen] = useState(false);
  const [reqApproveItem, setReqApproveItem] = useState<any>(null);
  const [reqApproving, setReqApproving] = useState(false);
  const { register: regReqApprove, handleSubmit: handleReqApprove, reset: resetReqApprove } = useForm();

  // Reject
  const [reqRejectOpen, setReqRejectOpen] = useState(false);
  const [reqRejectItem, setReqRejectItem] = useState<any>(null);
  const [reqRejectionReason, setReqRejectionReason] = useState('');
  const [reqRejecting, setReqRejecting] = useState(false);

  // Action loaders
  const [reqActionLoaders, setReqActionLoaders] = useState<Record<number, string>>({});

  // ════════════════════════════════════════════════════════════════
  // TAB 2 — PAYOUT SETTLEMENTS STATE
  // ════════════════════════════════════════════════════════════════
  const [settData, setSettData] = useState<any[]>([]);
  const [settTotal, setSettTotal] = useState(0);
  const [settTrashCount, setSettTrashCount] = useState(0);
  const [settPage, setSettPage] = useState(1);
  const [settPageSize, setSettPageSize] = usePageSize(10);
  const [settSort, setSettSort] = useState<SettSortField>('created_at');
  const [settAsc, setSettAsc] = useState(false);
  const [settLoading, setSettLoading] = useState(true);
  const [settShowTrash, setSettShowTrash] = useState(false);
  const [settSearch, setSettSearch] = useState('');
  const [settStatusFilter, setSettStatusFilter] = useState('');
  const [settMethodFilter, setSettMethodFilter] = useState('');
  const settToolbarRef = useRef<DataToolbarHandle>(null);

  const [settStats, setSettStats] = useState({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });

  // View
  const [settViewOpen, setSettViewOpen] = useState(false);
  const [settViewItem, setSettViewItem] = useState<any>(null);
  const [settViewLoading, setSettViewLoading] = useState(false);

  // Create
  const [settCreateOpen, setSettCreateOpen] = useState(false);
  const [settCreating, setSettCreating] = useState(false);
  const { register: regSettCreate, handleSubmit: handleSettCreate, reset: resetSettCreate } = useForm();

  // Edit
  const [settEditOpen, setSettEditOpen] = useState(false);
  const [settEditItem, setSettEditItem] = useState<any>(null);
  const [settSaving, setSettSaving] = useState(false);
  const { register: regSettEdit, handleSubmit: handleSettEdit, reset: resetSettEdit } = useForm();

  // Complete
  const [settCompleteOpen, setSettCompleteOpen] = useState(false);
  const [settCompleteItem, setSettCompleteItem] = useState<any>(null);
  const [settCompleting, setSettCompleting] = useState(false);
  const [settTxnRef, setSettTxnRef] = useState('');

  // Fail
  const [settFailOpen, setSettFailOpen] = useState(false);
  const [settFailItem, setSettFailItem] = useState<any>(null);
  const [settFailReason, setSettFailReason] = useState('');
  const [settFailing, setSettFailing] = useState(false);

  // Action loaders
  const [settActionLoaders, setSettActionLoaders] = useState<Record<number, string>>({});

  // ════════════════════════════════════════════════════════════════
  // PAYOUT REQUESTS — FETCH
  // ════════════════════════════════════════════════════════════════
  const fetchReqData = useCallback(async () => {
    setReqLoading(true);
    try {
      const params: Record<string, any> = { page: reqPage, limit: reqPageSize, sort: reqSort, ascending: reqAsc };
      if (reqShowTrash) params.show_deleted = true;
      if (reqSearch) params.search = reqSearch;
      if (reqStatusFilter) params.request_status = reqStatusFilter;
      if (reqMethodFilter) params.payment_method = reqMethodFilter;
      const res = await api.getPayoutRequests(params);
      setReqData(res.data || []);
      setReqTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load payout requests'); }
    setReqLoading(false);
  }, [reqPage, reqPageSize, reqSort, reqAsc, reqShowTrash, reqSearch, reqStatusFilter, reqMethodFilter]);

  const fetchReqTrashCount = useCallback(async () => {
    try {
      const res = await api.getPayoutRequests({ show_deleted: true, limit: 1 });
      setReqTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  const fetchReqStats = useCallback(async () => {
    try {
      const [all, pending, approved, rejected, processing] = await Promise.all([
        api.getPayoutRequests({ limit: 1 }),
        api.getPayoutRequests({ limit: 1, request_status: 'pending' }),
        api.getPayoutRequests({ limit: 1, request_status: 'approved' }),
        api.getPayoutRequests({ limit: 1, request_status: 'rejected' }),
        api.getPayoutRequests({ limit: 1, request_status: 'processing' }),
      ]);
      setReqStats({
        total: all.pagination?.total || 0,
        pending: pending.pagination?.total || 0,
        approved: approved.pagination?.total || 0,
        rejected: rejected.pagination?.total || 0,
        processing: processing.pagination?.total || 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchReqData(); fetchReqTrashCount(); fetchReqStats(); }, [fetchReqData, fetchReqTrashCount, fetchReqStats]);

  // ════════════════════════════════════════════════════════════════
  // PAYOUT SETTLEMENTS — FETCH
  // ════════════════════════════════════════════════════════════════
  const fetchSettData = useCallback(async () => {
    setSettLoading(true);
    try {
      const params: Record<string, any> = { page: settPage, limit: settPageSize, sort: settSort, ascending: settAsc };
      if (settShowTrash) params.show_deleted = true;
      if (settSearch) params.search = settSearch;
      if (settStatusFilter) params.settlement_status = settStatusFilter;
      if (settMethodFilter) params.payment_method = settMethodFilter;
      const res = await api.getPayoutSettlements(params);
      setSettData(res.data || []);
      setSettTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load payout settlements'); }
    setSettLoading(false);
  }, [settPage, settPageSize, settSort, settAsc, settShowTrash, settSearch, settStatusFilter, settMethodFilter]);

  const fetchSettTrashCount = useCallback(async () => {
    try {
      const res = await api.getPayoutSettlements({ show_deleted: true, limit: 1 });
      setSettTrashCount(res.pagination?.total || 0);
    } catch {}
  }, []);

  const fetchSettStats = useCallback(async () => {
    try {
      const [all, pending, processing, completed, failed] = await Promise.all([
        api.getPayoutSettlements({ limit: 1 }),
        api.getPayoutSettlements({ limit: 1, settlement_status: 'pending' }),
        api.getPayoutSettlements({ limit: 1, settlement_status: 'processing' }),
        api.getPayoutSettlements({ limit: 1, settlement_status: 'completed' }),
        api.getPayoutSettlements({ limit: 1, settlement_status: 'failed' }),
      ]);
      setSettStats({
        total: all.pagination?.total || 0,
        pending: pending.pagination?.total || 0,
        processing: processing.pagination?.total || 0,
        completed: completed.pagination?.total || 0,
        failed: failed.pagination?.total || 0,
      });
    } catch {}
  }, []);

  useEffect(() => { fetchSettData(); fetchSettTrashCount(); fetchSettStats(); }, [fetchSettData, fetchSettTrashCount, fetchSettStats]);

  // ════════════════════════════════════════════════════════════════
  // PAYOUT REQUESTS — SORT
  // ════════════════════════════════════════════════════════════════
  function toggleReqSort(field: ReqSortField) {
    if (reqSort === field) setReqAsc(!reqAsc);
    else { setReqSort(field); setReqAsc(true); }
  }
  function ReqSortIcon({ field }: { field: ReqSortField }) {
    if (reqSort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return reqAsc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ════════════════════════════════════════════════════════════════
  // PAYOUT SETTLEMENTS — SORT
  // ════════════════════════════════════════════════════════════════
  function toggleSettSort(field: SettSortField) {
    if (settSort === field) setSettAsc(!settAsc);
    else { setSettSort(field); setSettAsc(true); }
  }
  function SettSortIcon({ field }: { field: SettSortField }) {
    if (settSort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return settAsc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  // ════════════════════════════════════════════════════════════════
  // PAYOUT REQUESTS — ACTIONS
  // ════════════════════════════════════════════════════════════════
  async function openReqView(id: number) {
    setReqViewLoading(true);
    setReqViewOpen(true);
    try {
      const res = await api.getPayoutRequest(id);
      setReqViewItem(res.data);
    } catch { toast.error('Failed to load payout request details'); }
    setReqViewLoading(false);
  }

  function openReqCreate() {
    resetReqCreate({ requested_amount: '', payment_method: 'bank_transfer', bank_details: '', notes: '' });
    setReqCreateInstructorId('');
    setReqCreateOpen(true);
  }

  async function onReqCreate(formData: any) {
    if (!reqCreateInstructorId) { toast.error('Please select an instructor'); return; }
    const amount = parseFloat(formData.requested_amount);
    if (!(amount > 0)) { toast.error('Requested amount must be greater than 0'); return; }
    setReqCreating(true);
    try {
      const payload: any = { ...formData, instructor_id: Number(reqCreateInstructorId), requested_amount: amount };
      if (formData.bank_details) payload.bank_details = JSON.parse(formData.bank_details);
      await api.createPayoutRequest(payload);
      toast.success('Payout request created');
      setReqCreateOpen(false);
      fetchReqData();
      fetchReqStats();
    } catch (e: any) { toast.error(e.message || 'Create failed'); }
    setReqCreating(false);
  }

  function openReqEdit(item: any) {
    setReqEditItem(item);
    resetReqEdit({
      requested_amount: item.requested_amount || '',
      payment_method: item.payment_method || 'bank_transfer',
      bank_details: item.bank_details ? JSON.stringify(item.bank_details, null, 2) : '',
      notes: item.notes || '',
    });
    setReqEditOpen(true);
  }

  async function onReqSaveEdit(formData: any) {
    if (!reqEditItem) return;
    setReqSaving(true);
    try {
      const payload: any = { ...formData, requested_amount: parseFloat(formData.requested_amount) };
      if (formData.bank_details) payload.bank_details = JSON.parse(formData.bank_details);
      await api.updatePayoutRequest(reqEditItem.id, payload);
      toast.success('Payout request updated');
      setReqEditOpen(false);
      fetchReqData();
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
    setReqSaving(false);
  }

  function openReqApprove(item: any) {
    setReqApproveItem(item);
    resetReqApprove({ approved_amount: item.requested_amount || '', admin_notes: '' });
    setReqApproveOpen(true);
  }

  async function onReqApprove(formData: any) {
    if (!reqApproveItem) return;
    setReqApproving(true);
    try {
      await api.approvePayoutRequest(reqApproveItem.id, {
        approved_amount: parseFloat(formData.approved_amount),
        admin_notes: formData.admin_notes,
      });
      toast.success('Payout request approved');
      setReqApproveOpen(false);
      fetchReqData();
      fetchReqStats();
    } catch (e: any) { toast.error(e.message || 'Approve failed'); }
    setReqApproving(false);
  }

  function openReqReject(item: any) {
    setReqRejectItem(item);
    setReqRejectionReason('');
    setReqRejectOpen(true);
  }

  async function handleReqReject() {
    if (!reqRejectItem) return;
    if (!reqRejectionReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    setReqRejecting(true);
    try {
      await api.rejectPayoutRequest(reqRejectItem.id, { rejection_reason: reqRejectionReason });
      toast.success('Payout request rejected');
      setReqRejectOpen(false);
      fetchReqData();
      fetchReqStats();
    } catch (e: any) { toast.error(e.message || 'Reject failed'); }
    setReqRejecting(false);
  }

  async function handleReqSoftDelete(id: number) {
    setReqActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeletePayoutRequest(id); toast.success('Moved to trash'); fetchReqData(); fetchReqTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setReqActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleReqRestore(id: number) {
    setReqActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restorePayoutRequest(id); toast.success('Restored'); fetchReqData(); fetchReqTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setReqActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleReqPermanentDelete(id: number) {
    if (!confirm('Permanently delete this payout request? This cannot be undone.')) return;
    setReqActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeletePayoutRequest(id); toast.success('Permanently deleted'); fetchReqData(); fetchReqTrashCount(); fetchReqStats(); }
    catch { toast.error('Failed to delete'); }
    setReqActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ════════════════════════════════════════════════════════════════
  // PAYOUT SETTLEMENTS — ACTIONS
  // ════════════════════════════════════════════════════════════════
  async function openSettView(id: number) {
    setSettViewLoading(true);
    setSettViewOpen(true);
    try {
      const res = await api.getPayoutSettlement(id);
      setSettViewItem(res.data);
    } catch { toast.error('Failed to load settlement details'); }
    setSettViewLoading(false);
  }

  function openSettCreate() {
    resetSettCreate({ instructor_id: '', payout_request_id: '', settlement_amount: '', processing_fee: '', payment_method: 'bank_transfer', bank_details: '', transaction_reference: '' });
    setSettCreateOpen(true);
  }

  async function onSettCreate(formData: any) {
    setSettCreating(true);
    try {
      const payload: any = {
        ...formData,
        settlement_amount: parseFloat(formData.settlement_amount),
        processing_fee: formData.processing_fee ? parseFloat(formData.processing_fee) : 0,
      };
      if (formData.bank_details) payload.bank_details = JSON.parse(formData.bank_details);
      if (formData.payout_request_id) payload.payout_request_id = parseInt(formData.payout_request_id);
      if (formData.instructor_id) payload.instructor_id = parseInt(formData.instructor_id);
      await api.createPayoutSettlement(payload);
      toast.success('Payout settlement created');
      setSettCreateOpen(false);
      fetchSettData();
      fetchSettStats();
    } catch (e: any) { toast.error(e.message || 'Create failed'); }
    setSettCreating(false);
  }

  function openSettEdit(item: any) {
    setSettEditItem(item);
    resetSettEdit({
      settlement_amount: item.settlement_amount || '',
      processing_fee: item.processing_fee || '',
      payment_method: item.payment_method || 'bank_transfer',
      bank_details: item.bank_details ? JSON.stringify(item.bank_details, null, 2) : '',
      transaction_reference: item.transaction_reference || '',
    });
    setSettEditOpen(true);
  }

  async function onSettSaveEdit(formData: any) {
    if (!settEditItem) return;
    setSettSaving(true);
    try {
      const payload: any = {
        ...formData,
        settlement_amount: parseFloat(formData.settlement_amount),
        processing_fee: formData.processing_fee ? parseFloat(formData.processing_fee) : 0,
      };
      if (formData.bank_details) payload.bank_details = JSON.parse(formData.bank_details);
      await api.updatePayoutSettlement(settEditItem.id, payload);
      toast.success('Settlement updated');
      setSettEditOpen(false);
      fetchSettData();
    } catch (e: any) { toast.error(e.message || 'Update failed'); }
    setSettSaving(false);
  }

  function openSettComplete(item: any) {
    setSettCompleteItem(item);
    setSettTxnRef('');
    setSettCompleteOpen(true);
  }

  async function handleSettComplete() {
    if (!settCompleteItem) return;
    if (!settTxnRef.trim()) { toast.error('Please provide a transaction reference'); return; }
    setSettCompleting(true);
    try {
      await api.completePayoutSettlement(settCompleteItem.id, { transaction_reference: settTxnRef });
      toast.success('Settlement marked as completed');
      setSettCompleteOpen(false);
      fetchSettData();
      fetchSettStats();
    } catch (e: any) { toast.error(e.message || 'Complete failed'); }
    setSettCompleting(false);
  }

  function openSettFail(item: any) {
    setSettFailItem(item);
    setSettFailReason('');
    setSettFailOpen(true);
  }

  async function handleSettFail() {
    if (!settFailItem) return;
    if (!settFailReason.trim()) { toast.error('Please provide a failure reason'); return; }
    setSettFailing(true);
    try {
      await api.failPayoutSettlement(settFailItem.id, { failure_reason: settFailReason });
      toast.success('Settlement marked as failed');
      setSettFailOpen(false);
      fetchSettData();
      fetchSettStats();
    } catch (e: any) { toast.error(e.message || 'Failed to update'); }
    setSettFailing(false);
  }

  async function handleSettSoftDelete(id: number) {
    setSettActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.softDeletePayoutSettlement(id); toast.success('Moved to trash'); fetchSettData(); fetchSettTrashCount(); }
    catch { toast.error('Failed to delete'); }
    setSettActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleSettRestore(id: number) {
    setSettActionLoaders(p => ({ ...p, [id]: 'restoring' }));
    try { await api.restorePayoutSettlement(id); toast.success('Restored'); fetchSettData(); fetchSettTrashCount(); }
    catch { toast.error('Failed to restore'); }
    setSettActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  async function handleSettPermanentDelete(id: number) {
    if (!confirm('Permanently delete this settlement? This cannot be undone.')) return;
    setSettActionLoaders(p => ({ ...p, [id]: 'deleting' }));
    try { await api.permanentDeletePayoutSettlement(id); toast.success('Permanently deleted'); fetchSettData(); fetchSettTrashCount(); fetchSettStats(); }
    catch { toast.error('Failed to delete'); }
    setSettActionLoaders(p => { const n = { ...p }; delete n[id]; return n; });
  }

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in">
      <PageHeader title="Instructor Payouts" />

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg mb-5">
        <button
          className={cn('px-4 py-2 text-sm font-medium rounded-md transition-all', activeTab === 'requests' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800')}
          onClick={() => setActiveTab('requests')}
        >
          Payout Requests
        </button>
        <button
          className={cn('px-4 py-2 text-sm font-medium rounded-md transition-all', activeTab === 'settlements' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800')}
          onClick={() => setActiveTab('settlements')}
        >
          Payout Settlements
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB 1 — PAYOUT REQUESTS                                  */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'requests' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mb-5">
            {[
              { label: 'Total', value: reqStats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'Pending', value: reqStats.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Approved', value: reqStats.approved, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Rejected', value: reqStats.rejected, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Processing', value: reqStats.processing, color: 'text-blue-700', bg: 'bg-blue-50' },
            ].map(stat => (
              <div key={stat.label} className={cn('rounded-xl px-4 py-3', stat.bg)}>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className={cn('text-2xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <DataToolbar
            ref={reqToolbarRef}
            search={reqSearch}
            onSearchChange={(v: string) => { setReqSearch(v); setReqPage(1); }}
            searchPlaceholder="Search by request number..."
          >
            <div className="flex items-center gap-2">
              <select className={selectClass} value={reqStatusFilter} onChange={e => { setReqStatusFilter(e.target.value); setReqPage(1); }}>
                {REQUEST_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className={selectClass} value={reqMethodFilter} onChange={e => { setReqMethodFilter(e.target.value); setReqPage(1); }}>
                {PAYMENT_METHODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button variant={reqShowTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setReqShowTrash(!reqShowTrash); setReqPage(1); }}>
                <Trash2 className="w-4 h-4" />
                Trash
                {reqTrashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{reqTrashCount}</span>}
              </Button>
              <Button size="sm" onClick={openReqCreate}>
                <Plus className="w-4 h-4" />
                Add Request
              </Button>
            </div>
          </DataToolbar>

          {/* Table */}
          {reqLoading ? (
            <div className="space-y-3 mt-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : reqData.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title={reqShowTrash ? 'Trash is empty' : 'No payout requests found'}
              description={reqShowTrash ? 'No deleted payout requests found' : 'Payout requests will appear here once instructors submit them'}
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="cursor-pointer" onClick={() => toggleReqSort('request_number')}>
                      <div className="flex items-center gap-1">REQUEST # <ReqSortIcon field="request_number" /></div>
                    </TH>
                    <TH>INSTRUCTOR</TH>
                    <TH className="cursor-pointer" onClick={() => toggleReqSort('requested_amount')}>
                      <div className="flex items-center gap-1">AMOUNT <ReqSortIcon field="requested_amount" /></div>
                    </TH>
                    <TH>APPROVED AMT</TH>
                    <TH className="cursor-pointer" onClick={() => toggleReqSort('request_status')}>
                      <div className="flex items-center gap-1">STATUS <ReqSortIcon field="request_status" /></div>
                    </TH>
                    <TH>PAYMENT METHOD</TH>
                    <TH className="cursor-pointer" onClick={() => toggleReqSort('created_at')}>
                      <div className="flex items-center gap-1">REQUESTED <ReqSortIcon field="created_at" /></div>
                    </TH>
                    <TH className="text-right">ACTIONS</TH>
                  </TR>
                </THead>
                <TBody>
                  {reqData.map((item) => {
                    const actionState = reqActionLoaders[item.id];
                    const instructorName = item.users?.full_name || item.users?.email || `User #${item.instructor_id}`;
                    return (
                      <TR key={item.id}>
                        <TD>
                          <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                            {item.request_number || `#${item.id}`}
                          </code>
                        </TD>
                        <TD>
                          <div className="text-sm font-medium text-slate-900 truncate max-w-[160px]">{instructorName}</div>
                        </TD>
                        <TD>
                          <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.requested_amount)}</span>
                        </TD>
                        <TD>
                          <span className="text-sm text-slate-700">{formatCurrency(item.approved_amount)}</span>
                        </TD>
                        <TD>
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                            STATUS_COLORS[item.request_status] || 'bg-slate-100 text-slate-600'
                          )}>
                            {capitalize(item.request_status)}
                          </span>
                        </TD>
                        <TD>
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                            METHOD_COLORS[item.payment_method] || 'bg-slate-100 text-slate-600'
                          )}>
                            {capitalize(item.payment_method)}
                          </span>
                        </TD>
                        <TD>
                          <span className="text-sm text-slate-500">{item.created_at ? fromNow(item.created_at) : '--'}</span>
                        </TD>
                        <TD className="text-right">
                          {actionState ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                          ) : reqShowTrash ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => handleReqRestore(item.id)}>
                                <RotateCcw className="w-4 h-4" /> Restore
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => handleReqPermanentDelete(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-48">
                              <DropdownItem icon={Eye} onClick={() => openReqView(item.id)}>View</DropdownItem>
                              <DropdownItem icon={Edit2} onClick={() => openReqEdit(item)}>Edit</DropdownItem>
                              <DropdownDivider />
                              {item.request_status === 'pending' && (
                                <DropdownItem icon={CheckCircle2} onClick={() => openReqApprove(item)}>Approve</DropdownItem>
                              )}
                              {item.request_status === 'pending' && (
                                <DropdownItem icon={XCircle} onClick={() => openReqReject(item)}>Reject</DropdownItem>
                              )}
                              <DropdownDivider />
                              <DropdownItem icon={Trash2} danger onClick={() => handleReqSoftDelete(item.id)}>Delete</DropdownItem>
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
          {reqTotal > reqPageSize && (
            <div className="mt-4">
              <Pagination
                page={reqPage}
                totalPages={Math.ceil(reqTotal / reqPageSize)}
                total={reqTotal}
                pageSize={reqPageSize}
                onPageChange={setReqPage}
                onPageSizeChange={(s: number) => { setReqPageSize(s); setReqPage(1); }}
              />
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TAB 2 — PAYOUT SETTLEMENTS                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {activeTab === 'settlements' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-4 mb-5">
            {[
              { label: 'Total', value: settStats.total, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'Pending', value: settStats.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Processing', value: settStats.processing, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Completed', value: settStats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Failed', value: settStats.failed, color: 'text-red-700', bg: 'bg-red-50' },
            ].map(stat => (
              <div key={stat.label} className={cn('rounded-xl px-4 py-3', stat.bg)}>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <p className={cn('text-2xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <DataToolbar
            ref={settToolbarRef}
            search={settSearch}
            onSearchChange={(v: string) => { setSettSearch(v); setSettPage(1); }}
            searchPlaceholder="Search by settlement # or transaction ref..."
          >
            <div className="flex items-center gap-2">
              <select className={selectClass} value={settStatusFilter} onChange={e => { setSettStatusFilter(e.target.value); setSettPage(1); }}>
                {SETTLEMENT_STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className={selectClass} value={settMethodFilter} onChange={e => { setSettMethodFilter(e.target.value); setSettPage(1); }}>
                {PAYMENT_METHODS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button variant={settShowTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setSettShowTrash(!settShowTrash); setSettPage(1); }}>
                <Trash2 className="w-4 h-4" />
                Trash
                {settTrashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{settTrashCount}</span>}
              </Button>
              <Button size="sm" onClick={openSettCreate}>
                <Plus className="w-4 h-4" />
                Add Settlement
              </Button>
            </div>
          </DataToolbar>

          {/* Table */}
          {settLoading ? (
            <div className="space-y-3 mt-4">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : settData.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title={settShowTrash ? 'Trash is empty' : 'No payout settlements found'}
              description={settShowTrash ? 'No deleted settlements found' : 'Payout settlements will appear here once they are created'}
            />
          ) : (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH className="cursor-pointer" onClick={() => toggleSettSort('settlement_number')}>
                      <div className="flex items-center gap-1">SETTLEMENT # <SettSortIcon field="settlement_number" /></div>
                    </TH>
                    <TH>INSTRUCTOR</TH>
                    <TH>PAYOUT REQ</TH>
                    <TH className="cursor-pointer" onClick={() => toggleSettSort('settlement_amount')}>
                      <div className="flex items-center gap-1">AMOUNT <SettSortIcon field="settlement_amount" /></div>
                    </TH>
                    <TH>FEE</TH>
                    <TH className="cursor-pointer" onClick={() => toggleSettSort('settlement_status')}>
                      <div className="flex items-center gap-1">STATUS <SettSortIcon field="settlement_status" /></div>
                    </TH>
                    <TH>METHOD</TH>
                    <TH className="cursor-pointer" onClick={() => toggleSettSort('created_at')}>
                      <div className="flex items-center gap-1">SETTLED <SettSortIcon field="created_at" /></div>
                    </TH>
                    <TH className="text-right">ACTIONS</TH>
                  </TR>
                </THead>
                <TBody>
                  {settData.map((item) => {
                    const actionState = settActionLoaders[item.id];
                    const instructorName = item.users?.full_name || item.users?.email || `User #${item.instructor_id}`;
                    const reqNumber = item.payout_requests?.request_number || (item.payout_request_id ? `#${item.payout_request_id}` : '--');
                    return (
                      <TR key={item.id}>
                        <TD>
                          <code className="text-sm font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                            {item.settlement_number || `#${item.id}`}
                          </code>
                        </TD>
                        <TD>
                          <div className="text-sm font-medium text-slate-900 truncate max-w-[160px]">{instructorName}</div>
                        </TD>
                        <TD>
                          <code className="text-xs text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">{reqNumber}</code>
                        </TD>
                        <TD>
                          <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.settlement_amount)}</span>
                        </TD>
                        <TD>
                          <span className="text-sm text-slate-700">{formatCurrency(item.processing_fee)}</span>
                        </TD>
                        <TD>
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                            STATUS_COLORS[item.settlement_status] || 'bg-slate-100 text-slate-600'
                          )}>
                            {capitalize(item.settlement_status)}
                          </span>
                        </TD>
                        <TD>
                          <span className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                            METHOD_COLORS[item.payment_method] || 'bg-slate-100 text-slate-600'
                          )}>
                            {capitalize(item.payment_method)}
                          </span>
                        </TD>
                        <TD>
                          <span className="text-sm text-slate-500">{item.created_at ? fromNow(item.created_at) : '--'}</span>
                        </TD>
                        <TD className="text-right">
                          {actionState ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                          ) : settShowTrash ? (
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => handleSettRestore(item.id)}>
                                <RotateCcw className="w-4 h-4" /> Restore
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => handleSettPermanentDelete(item.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-48">
                              <DropdownItem icon={Eye} onClick={() => openSettView(item.id)}>View</DropdownItem>
                              <DropdownItem icon={Edit2} onClick={() => openSettEdit(item)}>Edit</DropdownItem>
                              <DropdownDivider />
                              {['pending', 'processing'].includes(item.settlement_status) && (
                                <DropdownItem icon={CheckCircle2} onClick={() => openSettComplete(item)}>Complete</DropdownItem>
                              )}
                              {['pending', 'processing'].includes(item.settlement_status) && (
                                <DropdownItem icon={XCircle} onClick={() => openSettFail(item)}>Mark Failed</DropdownItem>
                              )}
                              <DropdownDivider />
                              <DropdownItem icon={Trash2} danger onClick={() => handleSettSoftDelete(item.id)}>Delete</DropdownItem>
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
          {settTotal > settPageSize && (
            <div className="mt-4">
              <Pagination
                page={settPage}
                totalPages={Math.ceil(settTotal / settPageSize)}
                total={settTotal}
                pageSize={settPageSize}
                onPageChange={setSettPage}
                onPageSizeChange={(s: number) => { setSettPageSize(s); setSettPage(1); }}
              />
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PAYOUT REQUESTS — DIALOGS                                  */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* ═══ VIEW REQUEST DIALOG ═══ */}
      <Dialog open={reqViewOpen} onClose={() => setReqViewOpen(false)} title="Payout Request Details" size="lg">
        {reqViewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : reqViewItem ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <code className="text-lg font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded">
                {reqViewItem.request_number || `#${reqViewItem.id}`}
              </code>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  STATUS_COLORS[reqViewItem.request_status] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(reqViewItem.request_status)}
                </span>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  METHOD_COLORS[reqViewItem.payment_method] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(reqViewItem.payment_method)}
                </span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Instructor" value={reqViewItem.users?.full_name || reqViewItem.users?.email || `User #${reqViewItem.instructor_id}`} />
              <DetailRow label="Email" value={reqViewItem.users?.email} />
              <DetailRow label="Requested Amount" value={formatCurrency(reqViewItem.requested_amount)} />
              <DetailRow label="Approved Amount" value={formatCurrency(reqViewItem.approved_amount)} />
              <DetailRow label="Payment Method" value={capitalize(reqViewItem.payment_method || '')} />
              <DetailRow label="Status" value={capitalize(reqViewItem.request_status || '')} />
              <DetailRow label="Notes" value={reqViewItem.notes} />
              <DetailRow label="Admin Notes" value={reqViewItem.admin_notes} />
              <DetailRow label="Rejection Reason" value={reqViewItem.rejection_reason} />
              <DetailRow label="Approved At" value={reqViewItem.approved_at ? fromNow(reqViewItem.approved_at) : '--'} />
              <DetailRow label="Rejected At" value={reqViewItem.rejected_at ? fromNow(reqViewItem.rejected_at) : '--'} />
              <DetailRow label="Created" value={reqViewItem.created_at ? fromNow(reqViewItem.created_at) : '--'} />
              <DetailRow label="Updated" value={reqViewItem.updated_at ? fromNow(reqViewItem.updated_at) : '--'} />
            </dl>
            {reqViewItem.bank_details && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Bank Details</h4>
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto text-slate-700">
                  {typeof reqViewItem.bank_details === 'string' ? reqViewItem.bank_details : JSON.stringify(reqViewItem.bank_details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ CREATE REQUEST DIALOG ═══ */}
      <Dialog open={reqCreateOpen} onClose={() => setReqCreateOpen(false)} title="Create Payout Request" size="md">
        <form onSubmit={handleReqCreate(onReqCreate)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Instructor *</label>
            <SearchableSelect
              options={instructors.map((u: any) => ({
                value: String(u.id),
                label: `${[u.first_name, u.last_name].filter(Boolean).join(' ') || u.full_name || 'Instructor'} — ${u.email || u.mobile || `#${u.id}`}`,
              }))}
              value={reqCreateInstructorId}
              onChange={setReqCreateInstructorId}
              placeholder="Select instructor"
              searchPlaceholder="Search name or email…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Requested Amount *</label>
            <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...regReqCreate('requested_amount', { required: true, min: { value: 0.01, message: 'Amount must be greater than 0' } })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method</label>
            <select className={cn(selectClass, 'w-full')} {...regReqCreate('payment_method')}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Details (JSON)</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none font-mono"
              placeholder='{"account_number": "...", "ifsc": "..."}'
              {...regReqCreate('bank_details')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Optional notes..."
              {...regReqCreate('notes')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setReqCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={reqCreating}>Create Request</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ EDIT REQUEST DIALOG ═══ */}
      <Dialog open={reqEditOpen} onClose={() => setReqEditOpen(false)} title="Edit Payout Request" size="md">
        <form onSubmit={handleReqEdit(onReqSaveEdit)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Requested Amount *</label>
            <Input type="number" step="0.01" placeholder="0.00" {...regReqEdit('requested_amount', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method</label>
            <select className={cn(selectClass, 'w-full')} {...regReqEdit('payment_method')}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Details (JSON)</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none font-mono"
              placeholder='{"account_number": "...", "ifsc": "..."}'
              {...regReqEdit('bank_details')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Optional notes..."
              {...regReqEdit('notes')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setReqEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={reqSaving}>Update Request</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ APPROVE REQUEST DIALOG ═══ */}
      <Dialog open={reqApproveOpen} onClose={() => setReqApproveOpen(false)} title="Approve Payout Request" size="md">
        <form onSubmit={handleReqApprove(onReqApprove)} className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Approve this payout request?</p>
              <p className="text-xs text-blue-600 mt-1">
                Request {reqApproveItem?.request_number || `#${reqApproveItem?.id}`} — Requested: {formatCurrency(reqApproveItem?.requested_amount)}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Approved Amount *</label>
            <Input type="number" step="0.01" placeholder="0.00" {...regReqApprove('approved_amount', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Admin Notes</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Optional admin notes..."
              {...regReqApprove('admin_notes')}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setReqApproveOpen(false)}>Cancel</Button>
            <Button type="submit" loading={reqApproving}>
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ REJECT REQUEST DIALOG ═══ */}
      <Dialog open={reqRejectOpen} onClose={() => setReqRejectOpen(false)} title="Reject Payout Request" size="md">
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Are you sure you want to reject this request?</p>
              <p className="text-xs text-red-600 mt-1">
                Request {reqRejectItem?.request_number || `#${reqRejectItem?.id}`} — {formatCurrency(reqRejectItem?.requested_amount)}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Rejection Reason *</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Please provide a reason for rejection..."
              value={reqRejectionReason}
              onChange={e => setReqRejectionReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setReqRejectOpen(false)}>Go Back</Button>
            <Button variant="danger" onClick={handleReqReject} loading={reqRejecting}>
              <XCircle className="w-4 h-4" />
              Reject Request
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* PAYOUT SETTLEMENTS — DIALOGS                               */}
      {/* ═══════════════════════════════════════════════════════════ */}

      {/* ═══ VIEW SETTLEMENT DIALOG ═══ */}
      <Dialog open={settViewOpen} onClose={() => setSettViewOpen(false)} title="Payout Settlement Details" size="lg">
        {settViewLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
        ) : settViewItem ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <code className="text-lg font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded">
                {settViewItem.settlement_number || `#${settViewItem.id}`}
              </code>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  STATUS_COLORS[settViewItem.settlement_status] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(settViewItem.settlement_status)}
                </span>
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium',
                  METHOD_COLORS[settViewItem.payment_method] || 'bg-slate-100 text-slate-600'
                )}>
                  {capitalize(settViewItem.payment_method)}
                </span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DetailRow label="Instructor" value={settViewItem.users?.full_name || settViewItem.users?.email || `User #${settViewItem.instructor_id}`} />
              <DetailRow label="Email" value={settViewItem.users?.email} />
              <DetailRow label="Payout Request" value={settViewItem.payout_requests?.request_number || (settViewItem.payout_request_id ? `#${settViewItem.payout_request_id}` : '--')} />
              <DetailRow label="Settlement Amount" value={formatCurrency(settViewItem.settlement_amount)} />
              <DetailRow label="Processing Fee" value={formatCurrency(settViewItem.processing_fee)} />
              <DetailRow label="Payment Method" value={capitalize(settViewItem.payment_method || '')} />
              <DetailRow label="Transaction Reference" value={settViewItem.transaction_reference} />
              <DetailRow label="Failure Reason" value={settViewItem.failure_reason} />
              <DetailRow label="Created" value={settViewItem.created_at ? fromNow(settViewItem.created_at) : '--'} />
              <DetailRow label="Updated" value={settViewItem.updated_at ? fromNow(settViewItem.updated_at) : '--'} />
            </dl>
            {settViewItem.bank_details && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Bank Details</h4>
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto text-slate-700">
                  {typeof settViewItem.bank_details === 'string' ? settViewItem.bank_details : JSON.stringify(settViewItem.bank_details, null, 2)}
                </pre>
              </div>
            )}
            {settViewItem.metadata && (
              <div>
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Metadata</h4>
                <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto text-slate-700">
                  {typeof settViewItem.metadata === 'string' ? settViewItem.metadata : JSON.stringify(settViewItem.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      {/* ═══ CREATE SETTLEMENT DIALOG ═══ */}
      <Dialog open={settCreateOpen} onClose={() => setSettCreateOpen(false)} title="Create Payout Settlement" size="md">
        <form onSubmit={handleSettCreate(onSettCreate)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Instructor ID *</label>
            <Input placeholder="Enter instructor user ID" {...regSettCreate('instructor_id', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payout Request ID</label>
            <Input placeholder="Enter payout request ID (optional)" {...regSettCreate('payout_request_id')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Settlement Amount *</label>
            <Input type="number" step="0.01" placeholder="0.00" {...regSettCreate('settlement_amount', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Processing Fee</label>
            <Input type="number" step="0.01" placeholder="0.00" {...regSettCreate('processing_fee')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method</label>
            <select className={cn(selectClass, 'w-full')} {...regSettCreate('payment_method')}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Details (JSON)</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none font-mono"
              placeholder='{"account_number": "...", "ifsc": "..."}'
              {...regSettCreate('bank_details')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Transaction Reference</label>
            <Input placeholder="Enter transaction reference (optional)" {...regSettCreate('transaction_reference')} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setSettCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={settCreating}>Create Settlement</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ EDIT SETTLEMENT DIALOG ═══ */}
      <Dialog open={settEditOpen} onClose={() => setSettEditOpen(false)} title="Edit Payout Settlement" size="md">
        <form onSubmit={handleSettEdit(onSettSaveEdit)} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Settlement Amount *</label>
            <Input type="number" step="0.01" placeholder="0.00" {...regSettEdit('settlement_amount', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Processing Fee</label>
            <Input type="number" step="0.01" placeholder="0.00" {...regSettEdit('processing_fee')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method</label>
            <select className={cn(selectClass, 'w-full')} {...regSettEdit('payment_method')}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Details (JSON)</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none font-mono"
              placeholder='{"account_number": "...", "ifsc": "..."}'
              {...regSettEdit('bank_details')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Transaction Reference</label>
            <Input placeholder="Enter transaction reference" {...regSettEdit('transaction_reference')} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setSettEditOpen(false)}>Cancel</Button>
            <Button type="submit" loading={settSaving}>Update Settlement</Button>
          </div>
        </form>
      </Dialog>

      {/* ═══ COMPLETE SETTLEMENT DIALOG ═══ */}
      <Dialog open={settCompleteOpen} onClose={() => setSettCompleteOpen(false)} title="Complete Settlement" size="md">
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Mark this settlement as completed?</p>
              <p className="text-xs text-emerald-600 mt-1">
                Settlement {settCompleteItem?.settlement_number || `#${settCompleteItem?.id}`} — {formatCurrency(settCompleteItem?.settlement_amount)}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Transaction Reference *</label>
            <Input
              placeholder="Enter transaction reference..."
              value={settTxnRef}
              onChange={(e: any) => setSettTxnRef(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setSettCompleteOpen(false)}>Cancel</Button>
            <Button onClick={handleSettComplete} loading={settCompleting}>
              <CheckCircle2 className="w-4 h-4" />
              Complete Settlement
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ═══ FAIL SETTLEMENT DIALOG ═══ */}
      <Dialog open={settFailOpen} onClose={() => setSettFailOpen(false)} title="Mark Settlement as Failed" size="md">
        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Are you sure you want to mark this settlement as failed?</p>
              <p className="text-xs text-red-600 mt-1">
                Settlement {settFailItem?.settlement_number || `#${settFailItem?.id}`} — {formatCurrency(settFailItem?.settlement_amount)}
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Failure Reason *</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Please provide a reason for the failure..."
              value={settFailReason}
              onChange={e => setSettFailReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setSettFailOpen(false)}>Go Back</Button>
            <Button variant="danger" onClick={handleSettFail} loading={settFailing}>
              <XCircle className="w-4 h-4" />
              Mark as Failed
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
