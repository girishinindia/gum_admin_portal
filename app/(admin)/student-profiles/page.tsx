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
import { Plus, GraduationCap, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X, Sparkles, Loader2 } from 'lucide-react';
import { AiMasterDialog } from '@/components/ui/AiMasterDialog';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

const ENROLLMENT_TYPES = ['self', 'corporate', 'scholarship', 'referral', 'trial', 'other'];
const LEARNING_MODES = ['self_paced', 'instructor_led', 'hybrid', 'cohort_based', 'mentored'];
const CONTENT_TYPES = ['video', 'text', 'interactive', 'audio', 'mixed'];
const DIFFICULTY_PREFERENCES = ['beginner', 'intermediate', 'advanced', 'mixed'];
const SUBSCRIPTION_PLANS = ['free', 'basic', 'standard', 'premium', 'enterprise', 'lifetime'];

type SortField = 'id' | 'enrollment_number' | 'enrollment_type' | 'subscription_plan' | 'xp_points' | 'level' | 'is_active';

export default function StudentProfilesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: number; full_name: string }[]>([]);
  const [educationLevels, setEducationLevels] = useState<{ id: number; name: string }[]>([]);

  // Pagination, search, sort, filters
  const [filterEnrollmentType, setFilterEnrollmentType] = useState('');
  const [filterSubscriptionPlan, setFilterSubscriptionPlan] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
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
    api.getTableSummary('student_profiles').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  // Load master data for dropdowns
  useEffect(() => { loadDropdownData(); }, []);

  async function loadDropdownData() {
    const [usersRes, edLevelsRes, profilesRes] = await Promise.all([
      api.listUsers('?limit=500&type=student'),
      api.listEducationLevels('?limit=500'),
      api.listStudentProfiles('?limit=500'),
    ]);
    const allUsers = (usersRes.success && Array.isArray(usersRes.data)) ? usersRes.data : [];
    const existingUserIds = new Set(
      ((profilesRes.success && Array.isArray(profilesRes.data)) ? profilesRes.data : []).map((p: any) => p.user_id)
    );
    setAvailableUsers(allUsers.filter((u: any) => !existingUserIds.has(u.id)).map((u: any) => ({ id: u.id, full_name: u.full_name })));
    const extract = (res: any) => { const d = res?.data?.items || res?.data || []; return Array.isArray(d) ? d : []; };
    setEducationLevels(extract(edLevelsRes).map((e: any) => ({ id: e.id, name: e.name })));
  }

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterEnrollmentType, filterSubscriptionPlan, filterDifficulty, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, filterEnrollmentType, filterSubscriptionPlan, filterDifficulty, filterStatus, sortField, sortOrder, showTrash]);

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
      if (filterEnrollmentType) qs.set('enrollment_type', filterEnrollmentType);
      if (filterSubscriptionPlan) qs.set('subscription_plan', filterSubscriptionPlan);
      if (filterDifficulty) qs.set('difficulty_preference', filterDifficulty);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listStudentProfiles('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('student_profiles');
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
      enrollment_number: '',
      enrollment_type: 'self',
      enrollment_date: '',
      education_level_id: '',
      current_institution: '',
      current_field_of_study: '',
      preferred_learning_mode: 'self_paced',
      preferred_content_type: 'video',
      difficulty_preference: 'beginner',
      subscription_plan: 'free',
      daily_learning_hours: '',
      weekly_available_days: ''
    });
    setDialogOpen(true);
  }

  function openEdit(profile: any) {
    setEditing(profile);
    setDialogKey(k => k + 1);
    reset({
      user_id: profile.user_id || '',
      enrollment_number: profile.enrollment_number || '',
      enrollment_type: profile.enrollment_type || 'self',
      enrollment_date: profile.enrollment_date ? profile.enrollment_date.substring(0, 10) : '',
      education_level_id: profile.education_level_id || '',
      current_institution: profile.current_institution || '',
      current_field_of_study: profile.current_field_of_study || '',
      preferred_learning_mode: profile.preferred_learning_mode || 'self_paced',
      preferred_content_type: profile.preferred_content_type || 'video',
      difficulty_preference: profile.difficulty_preference || 'beginner',
      subscription_plan: profile.subscription_plan || 'free',
      daily_learning_hours: profile.daily_learning_hours || '',
      weekly_available_days: profile.weekly_available_days || ''
    });
    setDialogOpen(true);
  }

  function openView(profile: any) {
    setViewing(profile);
  }

  async function onSubmit(data: any) {
    const payload = {
      user_id: data.user_id ? Number(data.user_id) : null,
      enrollment_number: data.enrollment_number,
      enrollment_type: data.enrollment_type,
      enrollment_date: data.enrollment_date || null,
      education_level_id: data.education_level_id ? Number(data.education_level_id) : null,
      current_institution: data.current_institution || null,
      current_field_of_study: data.current_field_of_study || null,
      preferred_learning_mode: data.preferred_learning_mode,
      preferred_content_type: data.preferred_content_type,
      difficulty_preference: data.difficulty_preference,
      subscription_plan: data.subscription_plan,
      daily_learning_hours: data.daily_learning_hours ? Number(data.daily_learning_hours) : null,
      weekly_available_days: data.weekly_available_days ? Number(data.weekly_available_days) : null
    };

    const res = editing
      ? await api.updateStudentProfile(editing.id, payload)
      : await api.createStudentProfile(payload);
    if (res.success) {
      toast.success(editing ? 'Student profile updated' : 'Student profile created');
      setDialogOpen(false);
      load();
      refreshSummary();
      loadDropdownData();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(profile: any) {
    if (!confirm(`Move "${profile.enrollment_number}" to trash? You can restore it later.`)) return;
    setActionLoadingId(profile.id);
    const res = await api.deleteStudentProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Student profile moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(profile: any) {
    setActionLoadingId(profile.id);
    const res = await api.restoreStudentProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${profile.enrollment_number}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(profile: any) {
    if (!confirm(`PERMANENTLY delete "${profile.enrollment_number}"? This cannot be undone.`)) return;
    setActionLoadingId(profile.id);
    const res = await api.permanentDeleteStudentProfile(profile.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Student profile permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(profile: any) {
    const res = await api.updateStudentProfile(profile.id, { is_active: !profile.is_active });
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
    if (!confirm(`Move ${selectedIds.size} student profile(s) to trash? You can restore them later.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await api.deleteStudentProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} student profile(s) moved to trash`);
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
        await api.restoreStudentProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} student profile(s) restored`);
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
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} student profile(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        await api.permanentDeleteStudentProfile(ids[i]);
        setBulkProgress({ done: i + 1, total: ids.length });
      }
      toast.success(`${selectedIds.size} student profile(s) permanently deleted`);
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
        title="Student Profiles"
        description="Manage student enrollment profiles and learning preferences"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add student profile</Button>}
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
          Student Profiles
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search student profiles...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterEnrollmentType} onChange={e => setFilterEnrollmentType(e.target.value)}>
              <option value="">All Enrollment Types</option>
              {ENROLLMENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select className={selectClass} value={filterSubscriptionPlan} onChange={e => setFilterSubscriptionPlan(e.target.value)}>
              <option value="">All Plans</option>
              {SUBSCRIPTION_PLANS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select className={selectClass} value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
              <option value="">All Difficulties</option>
              {DIFFICULTY_PREFERENCES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
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
          icon={showTrash ? Trash2 : GraduationCap}
          title={showTrash ? 'Trash is empty' : 'No student profiles yet'}
          description={showTrash ? 'No deleted student profiles' : (searchDebounce || filterEnrollmentType ? 'No student profiles match your filters' : 'Add your first student profile')}
          action={!showTrash && !searchDebounce && !filterEnrollmentType ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add student profile</Button> : undefined}
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
                <TH><button onClick={() => handleSort('enrollment_number')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Enrollment # <SortIcon field="enrollment_number" /></button></TH>
                <TH>User</TH>
                <TH><button onClick={() => handleSort('enrollment_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Enrollment Type <SortIcon field="enrollment_type" /></button></TH>
                <TH>Education Level</TH>
                <TH>Institution</TH>
                <TH>Learning Mode</TH>
                <TH><button onClick={() => handleSort('subscription_plan')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Plan <SortIcon field="subscription_plan" /></button></TH>
                <TH><button onClick={() => handleSort('xp_points')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">XP <SortIcon field="xp_points" /></button></TH>
                <TH><button onClick={() => handleSort('level')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Level <SortIcon field="level" /></button></TH>
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
                    <Badge variant="muted" className="font-mono">{profile.enrollment_number}</Badge>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{profile.user?.full_name || '—'}</span>
                  </TD>
                  <TD className="py-2.5"><Badge variant="info" className="capitalize">{profile.enrollment_type?.replace(/_/g, ' ')}</Badge></TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-600">{profile.education_levels?.name || '—'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-600">{profile.current_institution || '—'}</span>
                  </TD>
                  <TD className="py-2.5"><Badge variant="muted" className="capitalize">{profile.preferred_learning_mode?.replace(/_/g, ' ') || '—'}</Badge></TD>
                  <TD className="py-2.5"><Badge variant="info" className="capitalize">{profile.subscription_plan}</Badge></TD>
                  <TD className="py-2.5">
                    <span className="text-sm font-medium text-slate-700">{profile.xp_points?.toLocaleString() ?? '0'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm font-medium text-slate-700">{profile.level ?? '0'}</span>
                  </TD>
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

      {/* ── View Student Profile Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Student Profile Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.user?.full_name || 'Student Profile'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="muted" className="font-mono">{viewing.enrollment_number}</Badge>
                  <Badge variant="info" className="capitalize">{viewing.enrollment_type?.replace(/_/g, ' ')}</Badge>
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="User ID" value={String(viewing.user_id || '—')} />
              <DetailRow label="User Name" value={viewing.user?.full_name} />
              <DetailRow label="Enrollment Number" value={viewing.enrollment_number} />
              <DetailRow label="Enrollment Type" value={viewing.enrollment_type?.replace(/_/g, ' ')} />
              <DetailRow label="Enrollment Date" value={viewing.enrollment_date ? new Date(viewing.enrollment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null} />
              <DetailRow label="Education Level" value={viewing.education_levels?.name} />
              <DetailRow label="Current Institution" value={viewing.current_institution} />
              <DetailRow label="Field of Study" value={viewing.current_field_of_study} />
              <DetailRow label="Learning Mode" value={viewing.preferred_learning_mode?.replace(/_/g, ' ')} />
              <DetailRow label="Content Type" value={viewing.preferred_content_type?.replace(/_/g, ' ')} />
              <DetailRow label="Difficulty" value={viewing.difficulty_preference?.replace(/_/g, ' ')} />
              <DetailRow label="Subscription Plan" value={viewing.subscription_plan} />
              <DetailRow label="Daily Learning Hours" value={String(viewing.daily_learning_hours ?? '—')} />
              <DetailRow label="Weekly Available Days" value={String(viewing.weekly_available_days ?? '—')} />
              <DetailRow label="XP Points" value={String(viewing.xp_points ?? '0')} />
              <DetailRow label="Level" value={String(viewing.level ?? '0')} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Student Profile' : 'Add Student Profile'} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This student profile is currently active' : 'This student profile is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getStudentProfile?.(editing.id);
                  if (refreshed?.success && refreshed.data) setEditing(refreshed.data);
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
              <label className="block text-sm font-medium text-slate-700 mb-1">User (Student)</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('user_id', { required: true })} disabled={!!editing}>
                <option value="">Select a user...</option>
                {editing && editing.user_id && !availableUsers.find(u => u.id === editing.user_id) && (
                  <option value={editing.user_id}>{editing.user?.full_name || `User #${editing.user_id}`}</option>
                )}
                {availableUsers.map(u => <option key={u.id} value={u.id}>{u.full_name} (#{u.id})</option>)}
              </select>
            </div>
            <Input label="Enrollment Number" placeholder="ENR-2024-001" {...register('enrollment_number', { required: true })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enrollment Type</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('enrollment_type', { required: true })}>
                {ENROLLMENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <Input label="Enrollment Date" type="date" {...register('enrollment_date')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Education Level</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('education_level_id')}>
                <option value="">Select...</option>
                {educationLevels.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <Input label="Current Institution" placeholder="MIT, Stanford..." {...register('current_institution')} />
          </div>

          <Input label="Current Field of Study" placeholder="Computer Science, Mathematics..." {...register('current_field_of_study')} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Learning Mode</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('preferred_learning_mode')}>
                {LEARNING_MODES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Content Type</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('preferred_content_type')}>
                {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty Preference</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('difficulty_preference')}>
                {DIFFICULTY_PREFERENCES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subscription Plan</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('subscription_plan')}>
                {SUBSCRIPTION_PLANS.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Daily Learning Hours" type="number" placeholder="2" {...register('daily_learning_hours')} />
            <Input label="Weekly Available Days" type="number" placeholder="5" {...register('weekly_available_days')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
      <AiMasterDialog module="student_profiles" moduleLabel="Student Profiles" open={aiOpen} onClose={() => setAiOpen(false)} createFn={api.createStudentProfile} updateFn={(id, data) => api.updateStudentProfile(id, data)} defaultPrompt="Generate student profile records for GrowUpMore with diverse enrollment types, learning preferences, and subscription plans. Include realistic Indian student names, institutions, and fields of study. Fields: user_id, enrollment_number, enrollment_type (self/corporate/scholarship/referral/trial/other), enrollment_date, education_level_id, current_institution, current_field_of_study, preferred_learning_mode (self_paced/instructor_led/hybrid/cohort_based/mentored), preferred_content_type (video/text/interactive/audio/mixed), difficulty_preference (beginner/intermediate/advanced/mixed), subscription_plan (free/basic/standard/premium/enterprise/lifetime), daily_learning_hours, weekly_available_days, is_active=true." defaultCount={10} listFn={(qs) => api.listStudentProfiles(qs)} onSaved={() => { load(); refreshSummary(); }} />
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
