"use client";
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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
import { KeyRound, Lock, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Permission } from '@/lib/types';

type SortField = 'id' | 'display_name' | 'resource' | 'action' | 'is_active';

export default function PermissionsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = (user?.max_role_level || 0) >= 100;

  const [allItems, setAllItems] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Permission | null>(null);

  const [filterResource, setFilterResource] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; total: number; updated_at: string } | null>(null);

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, filterResource, filterStatus, pageSize]);

  useEffect(() => {
    api.getTableSummary('permissions').then(res => {
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
    load();
  }, [authLoading, isSuperAdmin, router]);

  async function load() {
    setLoading(true);
    const res = await api.listPermissions();
    if (res.success && Array.isArray(res.data)) setAllItems(res.data);
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('permissions');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function toggleActive(p: Permission) {
    const res = await api.updatePermission(p.id, { is_active: !p.is_active });
    if (res.success) {
      toast.success(`Permission ${!p.is_active ? 'activated' : 'deactivated'}`);
      await load();
      await refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  const uniqueResources = useMemo(() => {
    return Array.from(new Set(allItems.map(p => p.resource))).sort();
  }, [allItems]);

  function getFilteredAndSorted() {
    let filtered = allItems;

    if (searchDebounce) {
      const q = searchDebounce.toLowerCase();
      filtered = filtered.filter(p =>
        p.display_name.toLowerCase().includes(q) ||
        p.resource.toLowerCase().includes(q) ||
        p.action.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }

    if (filterResource) filtered = filtered.filter(p => p.resource === filterResource);
    if (filterStatus === 'true') filtered = filtered.filter(p => p.is_active);
    else if (filterStatus === 'false') filtered = filtered.filter(p => !p.is_active);

    filtered = [...filtered].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'id': aVal = a.id; bVal = b.id; break;
        case 'display_name': aVal = a.display_name.toLowerCase(); bVal = b.display_name.toLowerCase(); break;
        case 'resource': aVal = a.resource.toLowerCase(); bVal = b.resource.toLowerCase(); break;
        case 'action': aVal = a.action.toLowerCase(); bVal = b.action.toLowerCase(); break;
        case 'is_active': aVal = a.is_active; bVal = b.is_active; break;
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

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8">
          <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h2 className="font-display text-lg font-semibold text-slate-900">Super Admin only</h2>
          <p className="text-sm text-slate-500 mt-1">Redirecting you to your permissions...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Permissions" description="Manage all system permissions and their active status" />

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Permissions', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
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

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search permissions...">
        <select className={selectClass} value={filterResource} onChange={e => setFilterResource(e.target.value)}>
          <option value="">All Resources</option>
          {uniqueResources.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </DataToolbar>

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : paginatedItems.length === 0 ? (
        <EmptyState icon={KeyRound} title="No permissions found"
          description={searchDebounce || filterResource || filterStatus ? 'No permissions match your filters' : 'No permissions available'} />
      ) : (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH><button onClick={() => handleSort('display_name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Display Name <SortIcon field="display_name" /></button></TH>
                <TH><button onClick={() => handleSort('resource')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Resource <SortIcon field="resource" /></button></TH>
                <TH><button onClick={() => handleSort('action')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Action <SortIcon field="action" /></button></TH>
                <TH>Description</TH>
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {paginatedItems.map(p => (
                <TR key={p.id}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{p.id}</span></TD>
                  <TD className="py-2.5"><span className="font-medium text-slate-900">{p.display_name}</span></TD>
                  <TD className="py-2.5"><Badge variant="muted">{p.resource}</Badge></TD>
                  <TD className="py-2.5"><code className="text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded">{p.action}</code></TD>
                  <TD className="py-2.5"><span className="text-slate-600 text-sm line-clamp-1">{p.description || '—'}</span></TD>
                  <TD className="py-2.5"><Badge variant={p.is_active ? 'success' : 'danger'}>{p.is_active ? 'Active' : 'Inactive'}</Badge></TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewing(p)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Permission Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0"><KeyRound className="w-5 h-5 text-brand-600" /></div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.display_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 mb-6">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">{viewing.is_active ? 'This permission is currently active' : 'This permission is currently inactive'}</p>
              </div>
              <button type="button" onClick={async () => { await toggleActive(viewing); const res = await api.listPermissions(); if (res.success && Array.isArray(res.data)) { const found = res.data.find((x: Permission) => x.id === viewing.id); if (found) setViewing(found); } }}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer', viewing.is_active ? 'bg-emerald-500' : 'bg-slate-300')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', viewing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Code" value={`${viewing.resource}:${viewing.action}`} />
              <DetailRow label="Resource" value={viewing.resource} />
              <DetailRow label="Action" value={viewing.action} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              {viewing.description && <DetailRow label="Description" value={viewing.description} />}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
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
