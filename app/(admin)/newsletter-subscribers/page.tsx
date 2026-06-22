"use client";
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Mail, Trash2, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

interface Subscriber {
  id: number;
  email: string;
  name: string | null;
  source: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
}

export default function NewsletterSubscribersPage() {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', 'created_at'); qs.set('order', 'desc');
    if (showTrash) qs.set('show_deleted', 'true');
    else if (filterStatus) qs.set('is_active', filterStatus);
    const res = await api.listNewsletterSubscribers('?' + qs.toString());
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    setLoading(false);
  }

  async function onSoftDelete(s: Subscriber) {
    if (!confirm(`Remove ${s.email} from the list?`)) return;
    setActionLoadingId(s.id);
    const res = await api.deleteNewsletterSubscriber(s.id).catch((e: any) => ({ success: false, error: e.message }));
    setActionLoadingId(null);
    if (res.success) { toast.success('Moved to trash'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onRestore(s: Subscriber) {
    setActionLoadingId(s.id);
    const res = await api.restoreNewsletterSubscriber(s.id).catch((e: any) => ({ success: false, error: e.message }));
    setActionLoadingId(null);
    if (res.success) { toast.success('Restored'); load(); } else toast.error(res.error || 'Failed');
  }

  function exportCsv() {
    const rows = [['Email', 'Name', 'Source', 'Status', 'Subscribed at']];
    items.forEach((s) => rows.push([s.email, s.name || '', s.source || '', s.is_active ? 'Active' : 'Inactive', s.created_at]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'newsletter-subscribers.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Newsletter" description="People subscribed through the website" />

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Subscribers</button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}><Trash2 className="w-3.5 h-3.5" /> Trash</button>
      </div>

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by email or name...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Unsubscribed</option>
            </select>
            <button onClick={exportCsv} className="h-10 px-3 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50">Export CSV</button>
          </>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>Removed subscribers can be restored.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : Mail} title={showTrash ? 'Trash is empty' : 'No subscribers yet'} description={showTrash ? 'No removed subscribers' : 'Newsletter signups will appear here'} />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16">ID</TH>
                <TH>Email</TH>
                <TH>Name</TH>
                <TH>Source</TH>
                <TH>Status</TH>
                <TH>Subscribed</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(s => (
                <TR key={s.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined)}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{s.id}</span></TD>
                  <TD className="py-2.5"><span className="font-medium text-slate-900">{s.email}</span></TD>
                  <TD className="py-2.5"><span className="text-slate-600 text-sm">{s.name || '—'}</span></TD>
                  <TD className="py-2.5"><Badge variant="muted">{s.source || 'website'}</Badge></TD>
                  <TD className="py-2.5"><Badge variant={s.is_active ? 'success' : 'danger'}>{s.is_active ? 'Active' : 'Unsubscribed'}</Badge></TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-500">{fromNow(s.created_at)}</span></TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <button onClick={() => onRestore(s)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" title="Restore">{actionLoadingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                      ) : (
                        <button onClick={() => onSoftDelete(s)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50" title="Remove">{actionLoadingId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
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
    </div>
  );
}
