"use client";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Briefcase, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Sparkles, Loader2 } from 'lucide-react';
import { AiMasterDialog } from '@/components/ui/AiMasterDialog';
import { cn, fromNow } from '@/lib/utils';

// Inline types
interface EmployeeProfile {
  id: number;
  user_id: number | null;
  employee_code: string;
  employee_type: string;
  designation_id: number | null;
  department_id: number | null;
  branch_id: number | null;
  joining_date: string | null;
  work_mode: string;
  shift_type: string;
  pay_grade: string | null;
  ctc_annual: number | null;
  basic_salary_monthly: number | null;
  payment_mode: string | null;
  tax_regime: string | null;
  notice_period_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  user?: { full_name: string } | null;
  designations?: { name: string } | null;
  departments?: { name: string } | null;
  branches?: { name: string } | null;
}

const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract', 'probation', 'intern', 'consultant', 'temporary', 'freelance'];
const WORK_MODES = ['on_site', 'remote', 'hybrid'];
const SHIFT_TYPES = ['general', 'morning', 'afternoon', 'night', 'rotational', 'flexible', 'other'];
const PAYMENT_MODES = ['bank_transfer', 'cheque', 'cash', 'upi', 'other'];
const TAX_REGIMES = ['old', 'new'];

type SortField = 'id' | 'employee_code' | 'employee_type' | 'work_mode' | 'joining_date' | 'pay_grade' | 'is_active';

export default function EmployeeProfilesPage() {
  const [items, setItems] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeProfile | null>(null);
  const [viewing, setViewing] = useState<EmployeeProfile | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: number; full_name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);

  // Pagination, search, sort, filters
  const [filterEmployeeType, setFilterEmployeeType] = useState('');
  const [filterWorkMode, setFilterWorkMode] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset } = useForm();

  // Summary
  useEffect(() => {
    api.getTableSummary('employee_profiles').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  // Load master data for dropdowns
  useEffect(() => { loadDropdownData(); }, []);

  async function loadDropdownData() {
    const [usersRes, desRes, deptRes, brRes, profilesRes] = await Promise.all([
      api.listUsers('?limit=500&type=employee'),
      api.listDesignations('?limit=500'),
      api.listDepartments('?limit=500'),
      api.listBranches('?limit=500'),
      api.listEmployeeProfiles('?limit=500'),
    ]);
    const allUsers = (usersRes.success && Array.isArray(usersRes.data)) ? usersRes.data : [];
    const existingUserIds = new Set(
      ((profilesRes.success && Array.isArray(profilesRes.data)) ? profilesRes.data : []).map((p: any) => p.user_id)
    );
    setAvailableUsers(allUsers.filter((u: any) => !existingUserIds.has(u.id)).map((u: any) => ({ id: u.id, full_name: u.full_name })));
    const extract = (res: any) => { const d = res?.data?.items || res?.data || []; return Array.isArray(d) ? d : []; };
    setDesignations(extract(desRes).map((d: any) => ({ id: d.id, name: d.name })));
    setDepartments(extract(deptRes).map((d: any) => ({ id: d.id, name: d.name })));
    setBranches(extract(brRes).map((b: any) => ({ id: b.id, name: b.name })));
  }

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterEmployeeType, filterWorkMode, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, filterEmployeeType, filterWorkMode, filterStatus, sortField, sortOrder, showTrash]);

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
      if (filterEmployeeType) qs.set('employee_type', filterEmployeeType);
      if (filterWorkMode) qs.set('work_mode', filterWorkMode);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listEmployeeProfiles('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('employee_profiles');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null);
    setDialogKey(k => k + 1);
    reset({
      user_id: '',
      employee_code: '',
      employee_type: 'full_time',
      designation_id: '',
      department_id: '',
      branch_id: '',
      joining_date: '',
      work_mode: 'on_site',
      shift_type: 'general',
      pay_grade: '',
      ctc_annual: '',
      basic_salary_monthly: '',
      payment_mode: 'bank_transfer',
      tax_regime: 'new',
      notice_period_days: '',
    });
    setDialogOpen(true);
  }

  function openEdit(profile: EmployeeProfile) {
    setEditing(profile);
    setDialogKey(k => k + 1);
    reset({
      user_id: profile.user_id || '',
      employee_code: profile.employee_code || '',
      employee_type: profile.employee_type || 'full_time',
      designation_id: profile.designation_id || '',
      department_id: profile.department_id || '',
      branch_id: profile.branch_id || '',
      joining_date: profile.joining_date ? profile.joining_date.split('T')[0] : '',
      work_mode: profile.work_mode || 'on_site',
      shift_type: profile.shift_type || 'general',
      pay_grade: profile.pay_grade || '',
      ctc_annual: profile.ctc_annual || '',
      basic_salary_monthly: profile.basic_salary_monthly || '',
      payment_mode: profile.payment_mode || 'bank_transfer',
      tax_regime: profile.tax_regime || 'new',
      notice_period_days: profile.notice_period_days || '',
    });
    setDialogOpen(true);
  }

  function openView(profile: EmployeeProfile) {
    setViewing(profile);
  }

  async function onSubmit(data: any) {
    const payload = {
      user_id: data.user_id ? Number(data.user_id) : null,
      employee_code: data.employee_code,
      employee_type: data.employee_type,
      designation_id: data.designation_id ? Number(data.designation_id) : null,
      department_id: data.department_id ? Number(data.department_id) : null,
      branch_id: data.branch_id ? Number(data.branch_id) : null,
      joining_date: data.joining_date || null,
      work_mode: data.work_mode,
      shift_type: data.shift_type,
      pay_grade: data.pay_grade || null,
      ctc_annual: data.ctc_annual ? Number(data.ctc_annual) : null,
      basic_salary_monthly: data.basic_salary_monthly ? Number(data.basic_salary_monthly) : null,
      payment_mode: data.payment_mode || null,
      tax_regime: data.tax_regime || null,
      notice_period_days: data.notice_period_days ? Number(data.notice_period_days) : null,
    };

    const res = editing
      ? await api.updateEmployeeProfile(editing.id, payload)
      : await api.createEmployeeProfile(payload);
    if (res.success) {
      toast.success(editing ? 'Employee profile updated' : 'Employee profile created');
      setDialogOpen(false);
      load();
      refreshSummary();
      loadDropdownData();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(profile: EmployeeProfile) {
    if (!confirm(`Move "${profile.employee_code}" to trash? You can restore it later.`)) return;
    setActionLoadingId(profile.id);
    const res = await api.deleteEmployeeProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Employee profile moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(profile: EmployeeProfile) {
    setActionLoadingId(profile.id);
    const res = await api.restoreEmployeeProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${profile.employee_code}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(profile: EmployeeProfile) {
    if (!confirm(`PERMANENTLY delete "${profile.employee_code}"? This cannot be undone.`)) return;
    setActionLoadingId(profile.id);
    const res = await api.permanentDeleteEmployeeProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Employee profile permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(profile: EmployeeProfile) {
    const res = await api.updateEmployeeProfile(profile.id, { is_active: !profile.is_active });
    if (res.success) { toast.success(`${!profile.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  function formatLabel(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function toggleSelect(id: number) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Move ${selectedIds.size} employee profile(s) to trash? You can restore them later.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await api.deleteEmployeeProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} employee profile(s) moved to trash`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    } catch {
      toast.error('Some deletions failed');
    } finally {
      setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    }
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await api.restoreEmployeeProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} employee profile(s) restored`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    } catch {
      toast.error('Some restorations failed');
    } finally {
      setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    }
  }

  async function handleBulkPermanentDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} employee profile(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await api.permanentDeleteEmployeeProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} employee profile(s) permanently deleted`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    } catch {
      toast.error('Some permanent deletions failed');
    } finally {
      setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Employee Profiles"
        description="Manage employee profiles, designations, and work details"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add employee profile</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Profiles', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button
          onClick={() => setShowTrash(false)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          Employee Profiles
        </button>
        <button
          onClick={() => setShowTrash(true)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn(
              'ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            )}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search employee profiles...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterEmployeeType} onChange={e => setFilterEmployeeType(e.target.value)}>
              <option value="">All Types</option>
              {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
            </select>
            <select className={selectClass} value={filterWorkMode} onChange={e => setFilterWorkMode(e.target.value)}>
              <option value="">All Work Modes</option>
              {WORK_MODES.map(m => <option key={m} value={m}>{formatLabel(m)}</option>)}
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
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Briefcase}
          title={showTrash ? 'Trash is empty' : 'No employee profiles yet'}
          description={showTrash ? 'No deleted employee profiles' : (searchDebounce || filterEmployeeType ? 'No employee profiles match your filters' : 'Add your first employee profile')}
          action={!showTrash && !searchDebounce && !filterEmployeeType ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add employee profile</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className="px-4 py-3 bg-brand-50 border-b border-brand-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-brand-900">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              </div>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkRestore}
                      disabled={bulkActionLoading}
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5 mr-1.5" />}
                      Restore Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkPermanentDelete}
                      disabled={bulkActionLoading}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                      Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkSoftDelete}
                    disabled={bulkActionLoading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                    Move to Trash
                  </Button>
                )}
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkActionLoading}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  title="Clear selection"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-12">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </TH>
                <TH><button onClick={() => handleSort('employee_code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Employee Code <SortIcon field="employee_code" /></button></TH>
                <TH>User</TH>
                <TH><button onClick={() => handleSort('employee_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Type <SortIcon field="employee_type" /></button></TH>
                <TH>Designation</TH>
                <TH>Department</TH>
                {!showTrash && <TH>Branch</TH>}
                <TH><button onClick={() => handleSort('work_mode')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Work Mode <SortIcon field="work_mode" /></button></TH>
                <TH><button onClick={() => handleSort('joining_date')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Joining Date <SortIcon field="joining_date" /></button></TH>
                <TH><button onClick={() => handleSort('pay_grade')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Pay Grade <SortIcon field="pay_grade" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(profile => (
                <TR key={profile.id} className={cn(
                  selectedIds.has(profile.id) ? 'bg-brand-50/40' : (showTrash ? 'bg-amber-50/30' : undefined)
                )}>
                  <TD className="py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(profile.id)}
                      onChange={() => toggleSelect(profile.id)}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </TD>
                  <TD className="py-2.5">
                    <Badge variant="muted" className="font-mono">{profile.employee_code}</Badge>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                      {profile.user?.full_name || '—'}
                    </span>
                  </TD>
                  <TD className="py-2.5"><Badge variant="info" className="capitalize">{formatLabel(profile.employee_type)}</Badge></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{profile.designations?.name || '—'}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{profile.departments?.name || '—'}</span></TD>
                  {!showTrash && (
                    <TD className="py-2.5"><span className="text-sm text-slate-600">{profile.branches?.name || '—'}</span></TD>
                  )}
                  <TD className="py-2.5"><Badge variant="muted" className="capitalize">{formatLabel(profile.work_mode)}</Badge></TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-600">
                      {profile.joining_date ? new Date(profile.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{profile.pay_grade || '—'}</span></TD>
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{profile.deleted_at ? fromNow(profile.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={profile.is_active ? 'success' : 'danger'}>
                        {profile.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(profile)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === profile.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(profile)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === profile.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(profile)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(profile)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onSoftDelete(profile)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === profile.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            total={total}
            showingCount={items.length}
          />
        </div>
      )}

      {/* ── View Employee Profile Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Employee Profile Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.user?.full_name || viewing.employee_code}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="muted" className="font-mono">{viewing.employee_code}</Badge>
                  <Badge variant="info" className="capitalize">{formatLabel(viewing.employee_type)}</Badge>
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="User" value={viewing.user?.full_name} />
              <DetailRow label="Employee Code" value={viewing.employee_code} />
              <DetailRow label="Employee Type" value={formatLabel(viewing.employee_type)} />
              <DetailRow label="Designation" value={viewing.designations?.name} />
              <DetailRow label="Department" value={viewing.departments?.name} />
              <DetailRow label="Branch" value={viewing.branches?.name} />
              <DetailRow label="Joining Date" value={viewing.joining_date ? new Date(viewing.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
              <DetailRow label="Work Mode" value={formatLabel(viewing.work_mode)} />
              <DetailRow label="Shift Type" value={formatLabel(viewing.shift_type)} />
              <DetailRow label="Pay Grade" value={viewing.pay_grade} />
              <DetailRow label="CTC Annual" value={viewing.ctc_annual != null ? `₹${viewing.ctc_annual.toLocaleString('en-IN')}` : undefined} />
              <DetailRow label="Basic Salary Monthly" value={viewing.basic_salary_monthly != null ? `₹${viewing.basic_salary_monthly.toLocaleString('en-IN')}` : undefined} />
              <DetailRow label="Payment Mode" value={viewing.payment_mode ? formatLabel(viewing.payment_mode) : undefined} />
              <DetailRow label="Tax Regime" value={viewing.tax_regime ? formatLabel(viewing.tax_regime) : undefined} />
              <DetailRow label="Notice Period" value={viewing.notice_period_days != null ? `${viewing.notice_period_days} days` : undefined} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              <DetailRow label="Updated" value={new Date(viewing.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Employee Profile' : 'Add Employee Profile'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This employee profile is currently active' : 'This employee profile is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getEmployeeProfile(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  editing.is_active ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">User (Employee)</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('user_id', { required: true })} disabled={!!editing}>
                <option value="">Select a user...</option>
                {editing && editing.user_id && !availableUsers.find(u => u.id === editing.user_id) && (
                  <option value={editing.user_id}>{editing.user?.full_name || `User #${editing.user_id}`}</option>
                )}
                {availableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} (#{u.id})</option>)}
              </select>
            </div>
            <Input label="Employee Code" placeholder="EMP-001" {...register('employee_code', { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Employee Type</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('employee_type', { required: true })}>
                {EMPLOYEE_TYPES.map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Work Mode</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('work_mode', { required: true })}>
                {WORK_MODES.map(m => <option key={m} value={m}>{formatLabel(m)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('designation_id')}>
                <option value="">Select...</option>
                {designations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('department_id')}>
                <option value="">Select...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('branch_id')}>
                <option value="">Select...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Joining Date" type="date" {...register('joining_date')} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Shift Type</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('shift_type')}>
                {SHIFT_TYPES.map(s => <option key={s} value={s}>{formatLabel(s)}</option>)}
              </select>
            </div>
          </div>

          <Input label="Pay Grade" placeholder="L1, L2, Senior..." {...register('pay_grade')} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="CTC Annual" type="number" placeholder="1200000" {...register('ctc_annual')} />
            <Input label="Basic Salary Monthly" type="number" placeholder="50000" {...register('basic_salary_monthly')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('payment_mode')}>
                {PAYMENT_MODES.map(p => <option key={p} value={p}>{formatLabel(p)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tax Regime</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('tax_regime')}>
                {TAX_REGIMES.map(r => <option key={r} value={r}>{formatLabel(r)}</option>)}
              </select>
            </div>
          </div>

          <Input label="Notice Period (days)" type="number" placeholder="30" {...register('notice_period_days')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
      <AiMasterDialog module="employee_profiles" moduleLabel="Employee Profiles" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createEmployeeProfile(item)} updateFn={(id, item) => api.updateEmployeeProfile(id, item)} defaultPrompt="Generate employee profile records for GrowUpMore with realistic Indian employee details. Include a mix of full-time, part-time, contract, and intern employees across different departments. Fields: user_id, employee_code, employee_type (full_time/part_time/contract/probation/intern/consultant/temporary/freelance), designation_id, department_id, branch_id, joining_date, work_mode (on_site/remote/hybrid), shift_type (general/morning/afternoon/night/rotational/flexible/other), pay_grade, ctc_annual, basic_salary_monthly, payment_mode (bank_transfer/cheque/cash/upi/other), tax_regime (old/new), notice_period_days, is_active=true." defaultCount={10} listFn={(qs) => api.listEmployeeProfiles(qs)} onSaved={() => { load(); refreshSummary(); }} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
