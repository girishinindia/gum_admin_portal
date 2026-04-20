"use client";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { api } from '@/lib/api';
import { formatDate, initials } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Users as UsersIcon, Mail, Phone, Lock, User as UserIcon, Eye, Edit2, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, Trash2, RotateCcw, AlertTriangle, X, UserCircle, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { User, Role } from '@/lib/types';

const createSchema = z.object({
  first_name: z.string().min(1, 'Required').max(75),
  last_name: z.string().min(1, 'Required').max(75),
  email: z.string().email('Invalid email'),
  mobile: z.string().min(10, 'Min 10 digits').max(15),
  password: z.string().min(8, 'Min 8 characters'),
  locale: z.enum(['en', 'hi', 'gu']).default('en'),
  role_id: z.coerce.number().optional(),
});

type SortField = 'id' | 'full_name' | 'email' | 'status' | 'created_at';

export default function UsersPage() {
  const searchParams = useSearchParams();
  const { user: me } = useAuth();
  const isSuperAdmin = (me?.max_role_level || 0) >= 100;

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<User | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [createKey, setCreateKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [searchDebounce, setSearchDebounce] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTrash, setShowTrash] = useState(false);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(createSchema) });

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q !== search) { setSearch(q); setSearchDebounce(q); setPage(1); }
  }, [searchParams]);

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, status, typeFilter, pageSize, showTrash]);

  useEffect(() => {
    api.syncTableSummary('users').then(() => {
      api.getTableSummary('users').then(res => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
      });
    });
  }, []);

  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, status, typeFilter, sortField, sortOrder, showTrash]);
  useEffect(() => { if (isSuperAdmin) loadRoles(); }, [isSuperAdmin]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField); qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (status) qs.set('status', status);
    }
    if (typeFilter) qs.set('type', typeFilter);
    const res = await api.listUsers(`?${qs}`);
    if (res.success && Array.isArray(res.data)) {
      setUsers(res.data);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function loadRoles() {
    const res = await api.listRoles();
    if (res.success) setRoles(res.data || []);
  }

  async function refreshSummary() {
    await api.syncTableSummary('users');
    const res = await api.getTableSummary('users');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  async function openView(u: User) {
    const res = await api.getUser(u.id);
    if (res.success && res.data) setViewing(res.data);
    else setViewing(u);
  }

  function resetDialog() { reset(); setAvatarFile(null); }

  async function onCreate(data: any) {
    setCreating(true);
    const fd = new FormData();
    fd.append('first_name', data.first_name); fd.append('last_name', data.last_name);
    fd.append('email', data.email); fd.append('mobile', data.mobile);
    fd.append('password', data.password); fd.append('locale', data.locale || 'en');
    if (data.role_id) fd.append('role_id', String(data.role_id));
    if (avatarFile) fd.append('avatar', avatarFile);
    const res = await api.createUser(fd, true);
    setCreating(false);
    if (res.success) { toast.success('User created successfully'); setCreateOpen(false); resetDialog(); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed to create user');
  }

  async function onSoftDelete(u: User) {
    if (!confirm(`Move "${u.full_name}" to trash? Their sessions will be revoked.`)) return;
    setActionLoadingId(u.id);
    const res = await api.deleteUser(u.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('User moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(u: User) {
    setActionLoadingId(u.id);
    const res = await api.restoreUser(u.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${u.full_name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(u: User) {
    if (!confirm(`PERMANENTLY delete "${u.full_name}"? This cannot be undone.`)) return;
    setActionLoadingId(u.id);
    const res = await api.permanentDeleteUser(u.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('User permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  const statusBadge = (s: string) => {
    const map: any = { active: 'success', inactive: 'muted', suspended: 'danger' };
    return <Badge variant={map[s] || 'default'}>{s}</Badge>;
  };

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteUser(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreUser(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteUser(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Users" description="Manage all registered users, assign roles, and view activity"
        actions={
          <div className="flex items-center gap-2">
            {isSuperAdmin && !showTrash && <Button onClick={() => { setCreateKey(k => k + 1); setCreateOpen(true); }}><Plus className="w-4 h-4" /> Create user</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Users', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Users
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

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name, email, or mobile...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <select className={selectClass} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="student">Student</option>
              <option value="employee">Employee</option>
              <option value="instructor">Instructor</option>
            </select>
          </>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Users in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : UsersIcon}
          title={showTrash ? 'Trash is empty' : 'No users found'}
          description={showTrash ? 'No deleted users' : 'Try adjusting your filters'}
          action={!showTrash && isSuperAdmin ? <Button onClick={() => { setCreateKey(k => k + 1); setCreateOpen(true); }}><Plus className="w-4 h-4" /> Create user</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected
                    </Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  <X className="w-3.5 h-3.5" /> Clear
                </Button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10"><input type="checkbox" checked={users.length > 0 && selectedIds.size === users.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH><button onClick={() => handleSort('full_name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">User <SortIcon field="full_name" /></button></TH>
                <TH><button onClick={() => handleSort('email')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Contact <SortIcon field="email" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                {!showTrash && <TH>Type</TH>}
                <TH><button onClick={() => handleSort('status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="status" /></button></TH>
                {!showTrash && <TH>Last Login</TH>}
                {!showTrash && <TH><button onClick={() => handleSort('created_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Joined <SortIcon field="created_at" /></button></TH>}
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {users.map(u => (
                <TR key={u.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(u.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{u.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold overflow-hidden flex-shrink-0">
                        {(u.user_profiles?.[0]?.profile_image_url || u.avatar_url) ? <img src={(u.user_profiles?.[0]?.profile_image_url || u.avatar_url)!} alt="" className="w-full h-full object-cover" /> : initials(u.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className={cn('font-medium text-sm truncate', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{u.full_name}</div>
                        {u.display_name && <div className="text-[11px] text-slate-400">{u.display_name}</div>}
                      </div>
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <div className="text-sm text-slate-700 truncate max-w-[200px]">{u.email}</div>
                    <div className="text-xs text-slate-400">{u.mobile}</div>
                  </TD>
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{u.deleted_at ? fromNow(u.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  {!showTrash && (
                    <TD className="py-2.5">
                      <Badge variant={u.type === 'employee' ? 'info' : u.type === 'instructor' ? 'success' : 'default'}>
                        {u.type ? u.type.charAt(0).toUpperCase() + u.type.slice(1) : 'Student'}
                      </Badge>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      statusBadge(u.status)
                    )}
                  </TD>
                  {!showTrash && <TD className="py-2.5 text-sm text-slate-500">{u.last_login_at ? formatDate(u.last_login_at, 'MMM D') : '—'}</TD>}
                  {!showTrash && <TD className="py-2.5 text-sm text-slate-500">{formatDate(u.created_at, 'MMM D, YYYY')}</TD>}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(u)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(u)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(u)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <Link href={`/users/${u.id}/profile`}>
                            <button className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Profile">
                              <UserCircle className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                          <Link href={`/users/${u.id}`}>
                            <button className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                          {isSuperAdmin && me?.id !== u.id && (
                            <button onClick={() => onSoftDelete(u)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                              {actionLoadingId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={users.length} />
        </div>
      )}

      {/* View User Dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="User Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-lg font-semibold overflow-hidden flex-shrink-0">
                {(viewing.user_profiles?.[0]?.profile_image_url || viewing.avatar_url) ? <img src={viewing.user_profiles?.[0]?.profile_image_url || viewing.avatar_url!} alt="" className="w-full h-full object-cover" /> : initials(viewing.full_name)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.full_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {statusBadge(viewing.status)}
                  <span className="text-sm text-slate-500">ID: {viewing.id}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Email" value={viewing.email} />
              <DetailRow label="Mobile" value={viewing.mobile} />
              <DetailRow label="Locale" value={viewing.locale?.toUpperCase()} />
              <DetailRow label="Login Count" value={String(viewing.login_count)} />
              <DetailRow label="Last Login" value={viewing.last_login_at ? formatDate(viewing.last_login_at, 'MMM D, YYYY h:mm A') : '—'} />
              <DetailRow label="Joined" value={formatDate(viewing.created_at, 'MMM D, YYYY')} />
              {viewing.roles && viewing.roles.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Roles</dt>
                  <dd className="mt-1 flex gap-2 flex-wrap">
                    {viewing.roles.map((r, i) => <Badge key={i} variant="info">{r.display_name} (L{r.level})</Badge>)}
                  </dd>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Link href={`/users/${viewing.id}`}><Button><Edit2 className="w-4 h-4" /> Edit</Button></Link>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); resetDialog(); }} title="Create User" description="Admin-created users are auto-verified (no OTP required)" size="lg">
        <form onSubmit={handleSubmit(onCreate)} className="p-6 space-y-4">
          <ImageUpload key={createKey} label="Profile Picture (optional)" hint="Crop, resize & filter. Server resizes to 300x300 WebP."
            aspectRatio={1} maxWidth={600} maxHeight={600} shape="circle" onChange={(file) => setAvatarFile(file)} />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <UserIcon className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
              <Input label="First Name" placeholder="Girish" className="pl-10" error={errors.first_name?.message as string} {...register('first_name')} />
            </div>
            <div className="relative">
              <UserIcon className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
              <Input label="Last Name" placeholder="Chaudhary" className="pl-10" error={errors.last_name?.message as string} {...register('last_name')} />
            </div>
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Email" type="email" placeholder="user@growupmore.com" className="pl-10" error={errors.email?.message as string} {...register('email')} />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Mobile" placeholder="9876543210" className="pl-10" error={errors.mobile?.message as string} hint="10-digit Indian numbers auto-prefixed with +91" {...register('mobile')} />
          </div>
          <PasswordInput label="Password" placeholder="Min 8 characters" leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            error={errors.password?.message as string} hint="User can change this later via Forgot Password" {...register('password')} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Language</label>
              <select {...register('locale')} className="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none bg-white">
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="gu">Gujarati</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Initial Role</label>
              <select {...register('role_id')} className="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none bg-white">
                <option value="">Default (Student)</option>
                {roles.filter(r => r.is_active).map(r => <option key={r.id} value={r.id}>{r.display_name} (Level {r.level})</option>)}
              </select>
            </div>
          </div>
          <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs text-brand-900">
            <strong>Note:</strong> This user will be pre-verified (email + mobile). They can log in immediately with the password you set.
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); resetDialog(); }}>Cancel</Button>
            <Button type="submit" loading={creating}>Create User</Button>
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
