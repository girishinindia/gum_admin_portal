"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Users, Shield, Globe2, Activity, LogIn, Eye, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn, formatDate, fromNow } from '@/lib/utils';

interface Stats {
  users: number;
  roles: number;
  countries: number;
  recentCount: number;
}

function getActionVariant(log: any): string {
  if (log.action?.includes('failed') || log.action?.includes('denied')) return 'danger';
  if (log.action?.includes('success') || log.action?.includes('verified')) return 'success';
  return 'default';
}

function formatActionLabel(action: string): string {
  return action?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Auth logs table state
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [viewing, setViewing] = useState<any | null>(null);


  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'r', action: () => loadLogs() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g u', action: () => router.push('/users') },
    { key: 'g c', action: () => router.push('/categories') },
    { key: 'g s', action: () => router.push('/subjects') },
    { key: 'g m', action: () => router.push('/material-tree') },
  ]);

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, pageSize]);
  useEffect(() => { loadLogs(); }, [page, pageSize, searchDebounce]);

  async function loadStats() {
    try {
      const [u, r, c] = await Promise.all([
        api.listUsers('?page=1&limit=1'),
        api.listRoles('?limit=100'),
        api.listCountries('?limit=100'),
      ]);
      setStats({
        users: u.pagination?.total || 0,
        roles: Array.isArray(r.data) ? r.data.length : 0,
        countries: Array.isArray(c.data) ? c.data.length : 0,
        recentCount: 0,
      });
    } finally { setStatsLoading(false); }
  }

  async function loadLogs() {
    setLogsLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    const res = await api.authLogs(`?${qs}`);
    if (res.success) {
      setLogs(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
      if (stats) setStats(prev => prev ? { ...prev, recentCount: res.pagination?.total || 0 } : prev);
    }
    setLogsLoading(false);
  }

  const cards = [
    { label: 'Total Users', value: stats?.users, icon: Users, color: 'brand', href: '/users' },
    { label: 'Roles', value: stats?.roles, icon: Shield, color: 'emerald', href: '/roles' },
    { label: 'Countries', value: stats?.countries, icon: Globe2, color: 'amber', href: '/countries' },
    { label: 'Auth Logs', value: total || stats?.recentCount, icon: Activity, color: 'purple', href: '/activity-logs' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome back, ${user?.first_name || 'Admin'}`}
        description="Here's what's happening on your platform today"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          const colorMap: Record<string, string> = {
            brand: 'bg-brand-50 text-brand-600',
            emerald: 'bg-emerald-50 text-emerald-600',
            amber: 'bg-amber-50 text-amber-600',
            purple: 'bg-purple-50 text-purple-600',
          };
          return (
            <Link key={card.label} href={card.href}>
              <Card className="hover:shadow-card-hover transition-all group cursor-pointer">
                <CardContent className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-slate-500 font-medium">{card.label}</div>
                    <div className="mt-2 font-display text-3xl font-bold text-slate-900">
                      {statsLoading ? <Skeleton className="h-9 w-16" /> : card.value?.toLocaleString() || '0'}
                    </div>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[card.color]} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Recent Authentication Activity — Data Table */}
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">Recent Authentication Activity</h2>
          <p className="text-sm text-slate-500 mt-0.5">Latest login, register, and OTP events</p>
        </div>
        <Link href="/activity-logs" className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
          View all <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder="Search auth logs..." />

      {logsLoading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={LogIn} title="No auth logs found" description={searchDebounce ? 'No logs match your search' : 'No recent authentication activity'} />
      ) : (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16">ID</TH>
                <TH>Action</TH>
                <TH>Identifier</TH>
                <TH>IP Address</TH>
                <TH>Device</TH>
                <TH>Time</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {logs.map((log: any) => (
                <TR key={log.id}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{log.id}</span></TD>
                  <TD className="py-2.5">
                    <Badge variant={getActionVariant(log) as any}>
                      {formatActionLabel(log.action || 'Unknown')}
                    </Badge>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700 truncate max-w-[200px] block">{log.identifier || '—'}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{log.ip_address || '—'}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-600">{log.device_type || '—'}</span></TD>
                  <TD className="py-2.5">
                    <div>
                      <span className="text-sm text-slate-900">{fromNow(log.created_at)}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(log.created_at, 'MMM D, h:mm A')}</div>
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewing(log)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={logs.length} />
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Auth Log Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0"><LogIn className="w-5 h-5 text-brand-600" /></div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{formatActionLabel(viewing.action || 'Log Entry')}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getActionVariant(viewing) as any}>{formatActionLabel(viewing.action || 'Unknown')}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="ID" value={String(viewing.id)} />
              <DetailRow label="Action" value={formatActionLabel(viewing.action)} />
              {viewing.identifier && <DetailRow label="Identifier" value={viewing.identifier} />}
              {viewing.user_id && <DetailRow label="User ID" value={String(viewing.user_id)} />}
              {viewing.ip_address && <DetailRow label="IP Address" value={viewing.ip_address} />}
              {viewing.device_type && <DetailRow label="Device" value={viewing.device_type} />}
              {viewing.user_agent && <DetailRow label="User Agent" value={viewing.user_agent} />}
              {viewing.method && <DetailRow label="Method" value={viewing.method} />}
              <DetailRow label="Created" value={formatDate(viewing.created_at, 'MMM D, YYYY h:mm:ss A')} />
            </div>

            {viewing.metadata && Object.keys(viewing.metadata).length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Metadata</h4>
                <pre className="p-3 bg-slate-50 border border-slate-100 rounded-md text-xs text-slate-700 overflow-x-auto font-mono">{JSON.stringify(viewing.metadata, null, 2)}</pre>
              </div>
            )}

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
      <dd className="mt-0.5 text-sm text-slate-800 break-all">{value || '—'}</dd>
    </div>
  );
}
