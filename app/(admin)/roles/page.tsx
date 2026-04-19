"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useAuth } from '@/hooks/useAuth';
import { Plus, Shield, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, X } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Role } from '@/lib/types';

const schema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Lowercase letters, numbers, underscores only'),
  display_name: z.string().min(1),
  description: z.string().optional(),
  level: z.coerce.number().int().min(0).max(99),
});

type SortField = 'id' | 'display_name' | 'name' | 'level' | 'is_active';

export default function RolesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = (user?.max_role_level || 0) >= 100;

  const [allItems, setAllItems] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Role | null>(null);

  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, pageSize, showTrash]);

  useEffect(() => {
    api.getTableSummary('roles').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin) {
      toast.error('Super admin access required');
      router.replace('/my-permissions');
      return;
    }
    setSelectedIds(new Set());
    load();
  }, [authLoading, isSuperAdmin, router, showTrash]);

  async function load() {
    setLoading(true);
    const qs = showTrash ? '?show_deleted=true' : '';
    const res = await api.listRoles(qs);
    if (res.success) setAllItems(res.data || []);
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('roles');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function getFilteredAndSorted() {
    let filtered = allItems;

    if (searchDebounce) {
      const q = searchDebounce.toLowerCase();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.display_name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }

    if (!showTrash && filterStatus !== '') {
      const isActive = filterStatus === 'true';
      filtered = filtered.filter(r => r.is_active === isActive);
    }

    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'id': aVal = a.id; bVal = b.id; break;
        case 'display_name': aVal = a.display_name; bVal = b.display_name; break;
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'level': aVal = a.level; bVal = b.level; break;
        case 'is_active': aVal = a.is_active; bVal = b.is_active; break;
      }
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }

  const filtered = getFilteredAndSorted();
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(field: SortField) {
    if (sortField === field) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  async function onCreate(data: any) {
    const res = await api.createRole(data);
    if (res.success) { toast.success('Role created'); setCreateOpen(false); reset(); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(role: Role) {
    if (role.is_system) return toast.error('Cannot delete system role');
    if (!confirm(`Move "${role.display_name}" to trash? You can restore it later.`)) return;
    const res = await api.deleteRole(role.id);
    if (res.success) { toast.success('Role moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(role: Role) {
    const res = await api.restoreRole(role.id);
    if (res.success) { toast.success(`"${role.display_name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(role: Role) {
    if (!confirm(`PERMANENTLY delete "${role.display_name}"? This cannot be undone.`)) return;
    const res = await api.permanentDeleteRole(role.id);
    if (res.success) { toast.success('Role permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(role: Role) {
    const res = await api.updateRole(role.id, { is_active: !role.is_active });
    if (res.success) { toast.success(`Role ${!role.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === paginatedItems.length ? new Set() : new Set(paginatedItems.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      const res = await api.deleteRole(id);
      if (res.success) ok++;
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      const res = await api.restoreRole(id);
      if (res.success) ok++;
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    let ok = 0;
    for (const id of selectedIds) {
      const res = await api.permanentDeleteRole(id);
      if (res.success) ok++;
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  if (!isSuperAdmin) {
    return <div className="animate-fade-in" />;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Roles"
        description="Manage role hierarchy and their permissions"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create role</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Roles', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Roles
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

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search roles...'}>
        {!showTrash && (
          <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Roles in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : paginatedItems.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Shield}
          title={showTrash ? 'Trash is empty' : 'No roles found'}
          description={showTrash ? 'No deleted roles' : (searchDebounce || filterStatus ? 'No roles match your filters' : 'Create your first role')}
          action={!showTrash && !searchDebounce && !filterStatus ? <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create role</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}><RotateCcw className="w-3.5 h-3.5" /> Restore Selected</Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Permanently</Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}><Trash2 className="w-3.5 h-3.5" /> Delete Selected</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="w-3.5 h-3.5" /> Clear</Button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10"><input type="checkbox" checked={paginatedItems.length > 0 && selectedIds.size === paginatedItems.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH><button onClick={() => handleSort('display_name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Display Name <SortIcon field="display_name" /></button></TH>
                <TH><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
                <TH><button onClick={() => handleSort('level')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Level <SortIcon field="level" /></button></TH>
                {!showTrash && <TH>System</TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {paginatedItems.map(r => (
                <TR key={r.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(r.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{r.id}</span></TD>
                  <TD className="py-2.5"><span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{r.display_name}</span></TD>
                  <TD className="py-2.5"><code className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded">{r.name}</code></TD>
                  <TD className="py-2.5"><span className="text-slate-600">{r.level}</span></TD>
                  {!showTrash && (
                    <TD className="py-2.5">{r.is_system ? <Badge variant="info">Yes</Badge> : <span className="text-slate-400">—</span>}</TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{r.deleted_at ? fromNow(r.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={r.is_active ? 'success' : 'danger'}>{r.is_active ? 'Active' : 'Inactive'}</Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(r)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onPermanentDelete(r)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Permanent Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewing(r)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <Link href={`/roles/${r.id}`}>
                            <button className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                          {!r.is_system && (
                            <button onClick={() => onSoftDelete(r)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Move to Trash">
                              <Trash2 className="w-3.5 h-3.5" />
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
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={filtered.length} showingCount={paginatedItems.length} />
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Role Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0"><Shield className="w-5 h-5 text-brand-600" /></div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{viewing.display_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 mb-6">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">{viewing.is_active ? 'This role is currently active' : 'This role is currently inactive'}</p>
              </div>
              <button type="button" onClick={async () => { await onToggleActive(viewing); const r = await api.getRole(viewing.id); if (r.success && r.data) setViewing(r.data); }}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer', viewing.is_active ? 'bg-emerald-500' : 'bg-slate-300')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', viewing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Name (Code)" value={viewing.name} />
              <DetailRow label="Level" value={String(viewing.level)} />
              <DetailRow label="System" value={viewing.is_system ? 'Yes' : 'No'} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              {viewing.description && <DetailRow label="Description" value={viewing.description} className="col-span-2" />}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Link href={`/roles/${viewing.id}`}>
                <Button><Edit2 className="w-4 h-4" /> Edit</Button>
              </Link>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create Role" description="Define a new custom role">
        <form onSubmit={handleSubmit(onCreate)} className="p-6 space-y-4">
          <Input label="Name (internal)" placeholder="content_reviewer" error={errors.name?.message as string} hint="Lowercase with underscores" {...register('name')} />
          <Input label="Display Name" placeholder="Content Reviewer" error={errors.display_name?.message as string} {...register('display_name')} />
          <Input label="Description" placeholder="Reviews course content before publishing" {...register('description')} />
          <Input label="Level (0-99)" type="number" placeholder="45" error={errors.level?.message as string} hint="Higher level inherits lower level permissions" {...register('level')} />
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
