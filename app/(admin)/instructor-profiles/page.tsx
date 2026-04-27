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
import { Plus, UserCheck, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Sparkles, Loader2, Star } from 'lucide-react';
import { AiMasterDialog } from '@/components/ui/AiMasterDialog';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

const INSTRUCTOR_TYPES = ['internal', 'external', 'guest', 'visiting', 'corporate', 'community', 'other'];
const TEACHING_MODES = ['online', 'offline', 'hybrid', 'recorded_only'];
const APPROVAL_STATUSES = ['pending', 'under_review', 'approved', 'rejected', 'suspended', 'blacklisted'];
const PAYMENT_MODELS = ['revenue_share', 'fixed_per_course', 'hourly', 'monthly_salary', 'per_student', 'hybrid', 'volunteer', 'other'];
const BADGES = ['new', 'rising', 'popular', 'top_rated', 'expert', 'elite'];

type SortField = 'id' | 'instructor_code' | 'instructor_type' | 'teaching_mode' | 'average_rating' | 'total_students_taught' | 'approval_status' | 'is_active';

export default function InstructorProfilesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: number; full_name: string }[]>([]);
  const [designations, setDesignations] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [specializations, setSpecializations] = useState<{ id: number; name: string }[]>([]);

  // Pagination, search, sort, filters
  const [filterInstructorType, setFilterInstructorType] = useState('');
  const [filterTeachingMode, setFilterTeachingMode] = useState('');
  const [filterApprovalStatus, setFilterApprovalStatus] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
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
    api.getTableSummary('instructor_profiles').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  // Load master data for dropdowns
  useEffect(() => { loadDropdownData(); }, []);

  async function loadDropdownData() {
    const [usersRes, desRes, deptRes, brRes, specRes, profilesRes] = await Promise.all([
      api.listUsers('?limit=500&type=instructor'),
      api.listDesignations('?limit=500'),
      api.listDepartments('?limit=500'),
      api.listBranches('?limit=500'),
      api.listSpecializations('?limit=500'),
      api.listInstructorProfiles('?limit=500'),
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
    setSpecializations(extract(specRes).map((s: any) => ({ id: s.id, name: s.name })));
  }

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterInstructorType, filterTeachingMode, filterApprovalStatus, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, filterInstructorType, filterTeachingMode, filterApprovalStatus, filterStatus, sortField, sortOrder, showTrash]);

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
      if (filterInstructorType) qs.set('instructor_type', filterInstructorType);
      if (filterTeachingMode) qs.set('teaching_mode', filterTeachingMode);
      if (filterApprovalStatus) qs.set('approval_status', filterApprovalStatus);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listInstructorProfiles('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('instructor_profiles');
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
      user_id: '', instructor_code: '', instructor_type: 'internal',
      designation_id: '', department_id: '', branch_id: '',
      joining_date: '', specialization_id: '', secondary_specialization_id: '',
      teaching_mode: 'offline', teaching_experience_years: '',
      industry_experience_years: '', highest_qualification: '',
      instructor_bio: '', tagline: '', payment_model: 'monthly_salary',
      approval_status: 'pending', badge: ''
    });
    setDialogOpen(true);
  }

  function openEdit(profile: any) {
    setEditing(profile);
    setDialogKey(k => k + 1);
    reset({
      user_id: profile.user_id || '',
      instructor_code: profile.instructor_code || '',
      instructor_type: profile.instructor_type || 'internal',
      designation_id: profile.designation_id || '',
      department_id: profile.department_id || '',
      branch_id: profile.branch_id || '',
      joining_date: profile.joining_date ? profile.joining_date.split('T')[0] : '',
      specialization_id: profile.specialization_id || '',
      secondary_specialization_id: profile.secondary_specialization_id || '',
      teaching_mode: profile.teaching_mode || 'offline',
      teaching_experience_years: profile.teaching_experience_years ?? '',
      industry_experience_years: profile.industry_experience_years ?? '',
      highest_qualification: profile.highest_qualification || '',
      instructor_bio: profile.instructor_bio || '',
      tagline: profile.tagline || '',
      payment_model: profile.payment_model || 'monthly_salary',
      approval_status: profile.approval_status || 'pending',
      badge: profile.badge || ''
    });
    setDialogOpen(true);
  }

  function openView(profile: any) {
    setViewing(profile);
  }

  async function onSubmit(data: any) {
    const payload = {
      user_id: data.user_id ? Number(data.user_id) : null,
      instructor_code: data.instructor_code,
      instructor_type: data.instructor_type,
      designation_id: data.designation_id ? Number(data.designation_id) : null,
      department_id: data.department_id ? Number(data.department_id) : null,
      branch_id: data.branch_id ? Number(data.branch_id) : null,
      joining_date: data.joining_date || null,
      specialization_id: data.specialization_id ? Number(data.specialization_id) : null,
      secondary_specialization_id: data.secondary_specialization_id ? Number(data.secondary_specialization_id) : null,
      teaching_mode: data.teaching_mode,
      teaching_experience_years: data.teaching_experience_years ? Number(data.teaching_experience_years) : null,
      industry_experience_years: data.industry_experience_years ? Number(data.industry_experience_years) : null,
      highest_qualification: data.highest_qualification || null,
      instructor_bio: data.instructor_bio || null,
      tagline: data.tagline || null,
      payment_model: data.payment_model,
      approval_status: data.approval_status,
      badge: data.badge || null
    };

    const res = editing
      ? await api.updateInstructorProfile(editing.id, payload)
      : await api.createInstructorProfile(payload);
    if (res.success) {
      toast.success(editing ? 'Instructor profile updated' : 'Instructor profile created');
      setDialogOpen(false);
      load();
      refreshSummary();
      loadDropdownData();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(profile: any) {
    if (!confirm(`Move "${profile.instructor_code}" to trash? You can restore it later.`)) return;
    setActionLoadingId(profile.id);
    const res = await api.deleteInstructorProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Instructor profile moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(profile: any) {
    setActionLoadingId(profile.id);
    const res = await api.restoreInstructorProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${profile.instructor_code}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(profile: any) {
    if (!confirm(`PERMANENTLY delete "${profile.instructor_code}"? This cannot be undone.`)) return;
    setActionLoadingId(profile.id);
    const res = await api.permanentDeleteInstructorProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Instructor profile permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(profile: any) {
    const res = await api.updateInstructorProfile(profile.id, { is_active: !profile.is_active });
    if (res.success) { toast.success(`${!profile.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

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
    if (!confirm(`Move ${selectedIds.size} instructor profile(s) to trash? You can restore them later.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await api.deleteInstructorProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} instructor profile(s) moved to trash`);
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
        await api.restoreInstructorProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} instructor profile(s) restored`);
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
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} instructor profile(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await api.permanentDeleteInstructorProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} instructor profile(s) permanently deleted`);
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

  function approvalBadgeVariant(status: string) {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'danger';
      case 'suspended': return 'warning';
      case 'under_review': return 'info';
      case 'blacklisted': return 'danger';
      default: return 'muted';
    }
  }

  function approvalBadgeClass(status: string) {
    switch (status) {
      case 'approved': return 'bg-green-50 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'suspended': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'under_review': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'blacklisted': return 'bg-red-50 text-red-700 border-red-200';
      default: return '';
    }
  }

  function renderStars(rating: number | null) {
    if (rating === null || rating === undefined) return <span className="text-slate-400">--</span>;
    return (
      <div className="flex items-center gap-1">
        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        <span className="text-sm font-medium text-slate-700">{Number(rating).toFixed(1)}</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Instructor Profiles"
        description="Manage instructor profiles and assignments"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add instructor profile</Button>}
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
          Instructor Profiles
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search instructor profiles...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterInstructorType} onChange={e => setFilterInstructorType(e.target.value)}>
              <option value="">All Types</option>
              {INSTRUCTOR_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}
            </select>
            <select className={selectClass} value={filterTeachingMode} onChange={e => setFilterTeachingMode(e.target.value)}>
              <option value="">All Modes</option>
              {TEACHING_MODES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}
            </select>
            <select className={selectClass} value={filterApprovalStatus} onChange={e => setFilterApprovalStatus(e.target.value)}>
              <option value="">All Approval</option>
              {APPROVAL_STATUSES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}
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
          icon={showTrash ? Trash2 : UserCheck}
          title={showTrash ? 'Trash is empty' : 'No instructor profiles yet'}
          description={showTrash ? 'No deleted instructor profiles' : (searchDebounce || filterInstructorType ? 'No instructor profiles match your filters' : 'Add your first instructor profile')}
          action={!showTrash && !searchDebounce && !filterInstructorType ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add instructor profile</Button> : undefined}
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
                <TH><button onClick={() => handleSort('instructor_code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Code <SortIcon field="instructor_code" /></button></TH>
                <TH>User</TH>
                <TH><button onClick={() => handleSort('instructor_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Type <SortIcon field="instructor_type" /></button></TH>
                <TH>Specialization</TH>
                <TH><button onClick={() => handleSort('teaching_mode')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Mode <SortIcon field="teaching_mode" /></button></TH>
                <TH><button onClick={() => handleSort('average_rating')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Rating <SortIcon field="average_rating" /></button></TH>
                <TH><button onClick={() => handleSort('total_students_taught')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Students <SortIcon field="total_students_taught" /></button></TH>
                {!showTrash && <TH><button onClick={() => handleSort('approval_status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Approval <SortIcon field="approval_status" /></button></TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH>Verified</TH>
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
                  <TD className="py-2.5"><Badge variant="muted" className="font-mono">{profile.instructor_code}</Badge></TD>
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                      {profile.user?.full_name || profile.users?.full_name || '--'}
                    </span>
                  </TD>
                  <TD className="py-2.5"><Badge variant="info" className="capitalize">{profile.instructor_type?.replace('_', ' ')}</Badge></TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-600">{profile.specializations?.name || profile.specialization?.name || '--'}</span>
                  </TD>
                  <TD className="py-2.5"><Badge variant="muted" className="capitalize">{profile.teaching_mode?.replace('_', ' ')}</Badge></TD>
                  <TD className="py-2.5">{renderStars(profile.average_rating)}</TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{profile.total_students_taught ?? '--'}</span></TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <Badge className={approvalBadgeClass(profile.approval_status)} variant={approvalBadgeVariant(profile.approval_status)}>
                        {profile.approval_status?.replace('_', ' ')}
                      </Badge>
                    </TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{profile.deleted_at ? fromNow(profile.deleted_at) : '--'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    <Badge variant={profile.is_verified ? 'success' : 'muted'}>
                      {profile.is_verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </TD>
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

      {/* ── View Instructor Profile Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Instructor Profile Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.user?.full_name || viewing.users?.full_name || viewing.instructor_code}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="muted" className="font-mono">{viewing.instructor_code}</Badge>
                  <Badge variant="info" className="capitalize">{viewing.instructor_type?.replace('_', ' ')}</Badge>
                  <Badge className={approvalBadgeClass(viewing.approval_status)} variant={approvalBadgeVariant(viewing.approval_status)}>
                    {viewing.approval_status?.replace('_', ' ')}
                  </Badge>
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="User" value={viewing.user?.full_name || viewing.users?.full_name} />
              <DetailRow label="Instructor Code" value={viewing.instructor_code} />
              <DetailRow label="Instructor Type" value={viewing.instructor_type?.replace('_', ' ')} />
              <DetailRow label="Teaching Mode" value={viewing.teaching_mode?.replace('_', ' ')} />
              <DetailRow label="Specialization" value={viewing.specializations?.name || viewing.specialization?.name} />
              <DetailRow label="Secondary Specialization" value={viewing.secondary_specializations?.name || viewing.secondary_specialization?.name} />
              <DetailRow label="Designation" value={viewing.designations?.name || viewing.designation?.name} />
              <DetailRow label="Department" value={viewing.departments?.name || viewing.department?.name} />
              <DetailRow label="Branch" value={viewing.branches?.name || viewing.branch?.name} />
              <DetailRow label="Joining Date" value={viewing.joining_date ? new Date(viewing.joining_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
              <DetailRow label="Teaching Experience" value={viewing.teaching_experience_years != null ? `${viewing.teaching_experience_years} years` : null} />
              <DetailRow label="Industry Experience" value={viewing.industry_experience_years != null ? `${viewing.industry_experience_years} years` : null} />
              <DetailRow label="Highest Qualification" value={viewing.highest_qualification} />
              <DetailRow label="Payment Model" value={viewing.payment_model?.replace('_', ' ')} />
              <DetailRow label="Average Rating" value={viewing.average_rating != null ? `${Number(viewing.average_rating).toFixed(1)} / 5` : null} />
              <DetailRow label="Total Students Taught" value={viewing.total_students_taught != null ? String(viewing.total_students_taught) : null} />
              <DetailRow label="Badge" value={viewing.badge?.replace('_', ' ')} />
              <DetailRow label="Verified" value={viewing.is_verified ? 'Yes' : 'No'} />
              <DetailRow label="Tagline" value={viewing.tagline} />
              <DetailRow label="Bio" value={viewing.instructor_bio} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Instructor Profile' : 'Add Instructor Profile'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This instructor profile is currently active' : 'This instructor profile is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.listInstructorProfiles(`?id=${editing.id}`);
                  if (refreshed.success && refreshed.data && refreshed.data.length > 0) setEditing(refreshed.data[0]);
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
              <label className="block text-sm font-medium text-slate-700 mb-1">User (Instructor)</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('user_id', { required: true })} disabled={!!editing}>
                <option value="">Select a user...</option>
                {editing && editing.user_id && !availableUsers.find((u: any) => u.id === editing.user_id) && (
                  <option value={editing.user_id}>{editing.user?.full_name || `User #${editing.user_id}`}</option>
                )}
                {availableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} (#{u.id})</option>)}
              </select>
            </div>
            <Input label="Instructor Code" placeholder="INS-001" {...register('instructor_code', { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Instructor Type</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('instructor_type', { required: true })}>
                {INSTRUCTOR_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teaching Mode</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('teaching_mode', { required: true })}>
                {TEACHING_MODES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}
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

          <Input label="Joining Date" type="date" {...register('joining_date')} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specialization</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('specialization_id')}>
                <option value="">Select...</option>
                {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Specialization</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('secondary_specialization_id')}>
                <option value="">Select...</option>
                {specializations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Teaching Experience (years)" type="number" placeholder="5" {...register('teaching_experience_years')} />
            <Input label="Industry Experience (years)" type="number" placeholder="3" {...register('industry_experience_years')} />
          </div>

          <Input label="Highest Qualification" placeholder="M.Tech, PhD, MBA..." {...register('highest_qualification')} />
          <Input label="Tagline" placeholder="Passionate about teaching..." {...register('tagline')} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Instructor Bio</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
              placeholder="Brief bio about the instructor..."
              {...register('instructor_bio')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Model</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('payment_model')}>
                {PAYMENT_MODELS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Approval Status</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('approval_status')}>
                {APPROVAL_STATUSES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Badge</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('badge')}>
              <option value="">No Badge</option>
              {BADGES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}</option>)}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
      <AiMasterDialog module="instructor_profiles" moduleLabel="Instructor Profiles" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createInstructorProfile(item)} updateFn={(id, item) => api.updateInstructorProfile(id, item)} defaultPrompt="Generate instructor profile records for GrowUpMore with diverse instructors. Include internal and external instructors with different specializations, teaching modes, and experience levels. Fields: user_id, instructor_code, instructor_type (internal/external/guest/visiting/corporate/community/other), designation_id, department_id, branch_id, joining_date, specialization_id, secondary_specialization_id, teaching_mode (online/offline/hybrid/recorded_only), teaching_experience_years, industry_experience_years, highest_qualification, instructor_bio, tagline, payment_model (revenue_share/fixed_per_course/hourly/monthly_salary/per_student/hybrid/volunteer/other), approval_status (pending/under_review/approved/rejected/suspended/blacklisted), badge (new/rising/popular/top_rated/expert/elite), is_active=true." defaultCount={10} listFn={(qs) => api.listInstructorProfiles(qs)} onSaved={() => { load(); refreshSummary(); }} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}
