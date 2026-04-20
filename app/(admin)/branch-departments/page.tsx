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
import { Plus, Link2, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { BranchDepartment, Branch, Department } from '@/lib/types';

type SortField = 'id' | 'sort_order' | 'is_active';

export default function BranchDepartmentsPage() {
  const [items, setItems] = useState<BranchDepartment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchDepartment | null>(null);
  const [viewing, setViewing] = useState<BranchDepartment | null>(null);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  // Pagination, search, sort, filters
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
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

  // Load dropdowns on mount
  useEffect(() => {
    api.listBranches('?limit=100').then(res => { if (res.success) setBranches(res.data || []); });
    api.listDepartments('?limit=100').then(res => { if (res.success) setDepartments(res.data || []); });
  }, []);

  // Summary
  useEffect(() => {
    api.getTableSummary('branch_departments').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterBranch, filterDepartment, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, filterBranch, filterDepartment, filterStatus, sortField, sortOrder, showTrash]);

  async function refreshSummary() {
    const res = await api.getTableSummary('branch_departments');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

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
      if (filterBranch) qs.set('branch_id', filterBranch);
      if (filterDepartment) qs.set('department_id', filterDepartment);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listBranchDepartments('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
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
    reset({
      branch_id: branches[0]?.id || '',
      department_id: departments[0]?.id || '',
      local_head_user_id: '',
      employee_capacity: '',
      floor_or_wing: '',
      extension_number: '',
      sort_order: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(item: BranchDepartment) {
    setEditing(item);
    reset({
      branch_id: item.branch_id,
      department_id: item.department_id,
      local_head_user_id: item.local_head_user_id || '',
      employee_capacity: item.employee_capacity || '',
      floor_or_wing: item.floor_or_wing || '',
      extension_number: item.extension_number || '',
      sort_order: item.sort_order,
    });
    setDialogOpen(true);
  }

  function openView(item: BranchDepartment) {
    setViewing(item);
  }

  async function onSubmit(data: any) {
    const payload = {
      ...data,
      branch_id: parseInt(data.branch_id) || null,
      department_id: parseInt(data.department_id) || null,
      local_head_user_id: data.local_head_user_id ? parseInt(data.local_head_user_id) : null,
      employee_capacity: data.employee_capacity ? parseInt(data.employee_capacity) : null,
      sort_order: parseInt(data.sort_order) || 0,
    };

    const res = editing
      ? await api.updateBranchDepartment(editing.id, payload)
      : await api.createBranchDepartment(payload);

    if (res.success) {
      toast.success(editing ? 'Assignment updated' : 'Assignment created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(item: BranchDepartment) {
    const branchName = item.branches?.name || 'Unknown';
    const deptName = item.departments?.name || 'Unknown';
    if (!confirm(`Move "${deptName} @ ${branchName}" to trash? You can restore it later.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteBranchDepartment(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Assignment moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: BranchDepartment) {
    setActionLoadingId(item.id);
    const res = await api.restoreBranchDepartment(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Assignment restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: BranchDepartment) {
    const branchName = item.branches?.name || 'Unknown';
    const deptName = item.departments?.name || 'Unknown';
    if (!confirm(`PERMANENTLY delete "${deptName} @ ${branchName}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteBranchDepartment(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Assignment permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: BranchDepartment) {
    const res = await api.updateBranchDepartment(item.id, { is_active: !item.is_active });
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  function toggleSelect(id: number) {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
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
    if (!confirm(`Move ${selectedIds.size} assignment(s) to trash? You can restore them later.`)) return;

    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteBranchDepartment(ids[i]);
      if (res.success) successCount++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });

    if (successCount > 0) {
      toast.success(`${successCount} assignment(s) moved to trash`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    }
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Restore ${selectedIds.size} assignment(s)?`)) return;

    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreBranchDepartment(ids[i]);
      if (res.success) successCount++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });

    if (successCount > 0) {
      toast.success(`${successCount} assignment(s) restored`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    }
  }

  async function handleBulkPermanentDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} assignment(s)? This cannot be undone.`)) return;

    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteBranchDepartment(ids[i]);
      if (res.success) successCount++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });

    if (successCount > 0) {
      toast.success(`${successCount} assignment(s) permanently deleted`);
      setSelectedIds(new Set());
      load();
      refreshSummary();
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Branch Departments"
        description="Manage department assignments to branches"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add assignment</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Assignments', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Assignments
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search assignments...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select className={selectClass} value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
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
          icon={showTrash ? Trash2 : Link2}
          title={showTrash ? 'Trash is empty' : 'No assignments yet'}
          description={showTrash ? 'No deleted assignments' : (filterBranch || filterDepartment ? 'No assignments match your filters' : 'Add your first branch-department assignment')}
          action={!showTrash && !filterBranch && !filterDepartment ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add assignment</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className={cn('px-4 py-3 border-b flex items-center justify-between', showTrash ? 'bg-amber-50 border-amber-200' : 'bg-brand-50 border-brand-200')}>
              <span className={cn('text-sm font-medium', showTrash ? 'text-amber-900' : 'text-brand-900')}>
                {bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}
              </span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkRestore}
                      disabled={bulkActionLoading}
                      className="h-8"
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={handleBulkPermanentDelete}
                      disabled={bulkActionLoading}
                      className="h-8"
                    >
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleBulkSoftDelete}
                    disabled={bulkActionLoading}
                    className="h-8"
                  >
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Move to Trash
                  </Button>
                )}
                <button
                  onClick={() => setSelectedIds(new Set())}
                  disabled={bulkActionLoading}
                  className={cn(
                    'p-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    showTrash ? 'text-amber-600 hover:bg-amber-100' : 'text-brand-600 hover:bg-brand-100'
                  )}
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
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
                    title="Select all on this page"
                  />
                </TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH>Branch</TH>
                <TH>Department</TH>
                {!showTrash && <TH>Local Head</TH>}
                {!showTrash && <TH>Capacity</TH>}
                {!showTrash && <TH>Floor/Wing</TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(item => (
                <TR
                  key={item.id}
                  className={cn(
                    selectedIds.has(item.id) ? 'bg-brand-50/40' : (showTrash ? 'bg-amber-50/30' : undefined)
                  )}
                >
                  <TD className="py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 rounded border-slate-300 text-brand-600 cursor-pointer"
                    />
                  </TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.branches?.name || '—'}</span>
                      {item.branches?.code && <Badge variant="muted" className="font-mono text-xs">{item.branches.code}</Badge>}
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.departments?.name || '—'}</span>
                      {item.departments?.code && <Badge variant="muted" className="font-mono text-xs">{item.departments.code}</Badge>}
                    </div>
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <span className="text-sm text-slate-600">{item.local_head?.full_name || '—'}</span>
                    </TD>
                  )}
                  {!showTrash && (
                    <TD className="py-2.5">
                      <span className="text-sm text-slate-600">{item.employee_capacity || '—'}</span>
                    </TD>
                  )}
                  {!showTrash && (
                    <TD className="py-2.5">
                      <span className="text-sm text-slate-600">{item.floor_or_wing || '—'}</span>
                    </TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={item.is_active ? 'success' : 'danger'}>
                        {item.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
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
                          <button onClick={() => openView(item)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ── View Assignment Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Assignment Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {viewing.departments?.name || 'Unknown'} @ {viewing.branches?.name || 'Unknown'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {viewing.branches?.code && <Badge variant="muted" className="font-mono">{viewing.branches.code}</Badge>}
                  {viewing.departments?.code && <Badge variant="muted" className="font-mono">{viewing.departments.code}</Badge>}
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Local Head" value={viewing.local_head?.full_name} />
              <DetailRow label="Employee Capacity" value={viewing.employee_capacity ? String(viewing.employee_capacity) : null} />
              <DetailRow label="Floor / Wing" value={viewing.floor_or_wing} />
              <DetailRow label="Extension Number" value={viewing.extension_number} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order)} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Assignment' : 'Add Assignment'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This assignment is currently active' : 'This assignment is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getBranchDepartment(editing.id);
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('branch_id', { required: true })}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('department_id', { required: true })}
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Local Head User ID"
            type="number"
            placeholder="Optional - ID of local department head"
            {...register('local_head_user_id')}
          />

          <Input
            label="Employee Capacity"
            type="number"
            placeholder="Optional - number of employees"
            {...register('employee_capacity')}
          />

          <Input
            label="Floor or Wing"
            placeholder="Optional - e.g., 3rd Floor, Building A"
            {...register('floor_or_wing')}
          />

          <Input
            label="Extension Number"
            placeholder="Optional - phone extension"
            {...register('extension_number')}
          />

          <Input
            label="Sort Order"
            type="number"
            placeholder="0"
            {...register('sort_order')}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
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
