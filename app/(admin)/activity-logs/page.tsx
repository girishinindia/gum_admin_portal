"use client";
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Pagination } from '@/components/ui/Pagination';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatDate, fromNow } from '@/lib/utils';
import { FileText, LogIn, Settings, Database, AlertTriangle, Filter, Eye, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LogType = 'auth' | 'admin' | 'data' | 'system';

const tabs: { type: LogType; label: string; icon: any; color: string }[] = [
  { type: 'auth',   label: 'Auth',   icon: LogIn,          color: 'text-brand-600' },
  { type: 'admin',  label: 'Admin',  icon: Settings,       color: 'text-purple-600' },
  { type: 'data',   label: 'Data',   icon: Database,       color: 'text-emerald-600' },
  { type: 'system', label: 'System', icon: AlertTriangle,  color: 'text-amber-600' },
];

function getActionVariant(log: any, type: LogType) {
  if (type === 'system') {
    if (log.level === 'error' || log.level === 'critical') return 'danger';
    if (log.level === 'warn') return 'warning';
    return 'muted';
  }
  if (log.action?.includes('failed') || log.action?.includes('denied')) return 'danger';
  if (log.action?.includes('success') || log.action?.includes('verified')) return 'success';
  return 'default';
}

function formatActionLabel(action: string): string {
  return action?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '';
}

export default function ActivityLogsPage() {
  const [type, setType] = useState<LogType>('auth');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [viewing, setViewing] = useState<any | null>(null);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; total: number; updated_at: string } | null>(null);


  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'r', action: () => load() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g u', action: () => router.push('/users') },
    { key: 'g c', action: () => router.push('/categories') },
    { key: 'g s', action: () => router.push('/subjects') },
    { key: 'g m', action: () => router.push('/material-tree') },
  ]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('admin_activity_log').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => { load(); }, [type, page, pageSize, searchDebounce]);
  useEffect(() => { setPage(1); }, [searchDebounce, filter, pageSize]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (filter) qs.set('action', filter);
    if (searchDebounce) qs.set('search', searchDebounce);

    const fns: Record<LogType, any> = {
      auth: api.authLogs, admin: api.adminLogs,
      data: api.dataLogs, system: api.systemLogs,
    };

    const res = await fns[type](`?${qs}`);
    if (res.success) {
      setLogs(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('admin_activity_log');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Activity Logs" description="Audit trail across authentication, admin, data, and system events" />

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Logs', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-xl p-1 shadow-card max-w-2xl">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = type === tab.type;
          return (
            <button
              key={tab.type}
              onClick={() => { setType(tab.type); setPage(1); setFilter(''); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center',
                active ? 'bg-brand-50 text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <Icon className={cn('w-4 h-4', active && tab.color)} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder="Search logs...">
        <div className="relative flex-1 max-w-md">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (setPage(1), load())}
            placeholder="Filter by action (e.g. login_success)"
            className="w-full h-10 pl-10 pr-3 text-sm rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none bg-white"
          />
        </div>
        <Button variant="outline" onClick={() => { setPage(1); load(); }}>Apply</Button>
        {filter && <Button variant="ghost" onClick={() => { setFilter(''); setPage(1); setTimeout(load, 0); }}>Clear</Button>}
      </DataToolbar>

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={FileText} title="No logs found" description="Try different filters or a different log type" />
      ) : (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16">ID</TH>
                <TH>Action</TH>
                <TH>Target / Details</TH>
                <TH>IP Address</TH>
                <TH>Time</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {logs.map((log: any) => (
                <TR key={log.id}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{log.id}</span></TD>
                  <TD className="py-2.5">
                    <Badge variant={getActionVariant(log, type)}>
                      {formatActionLabel(log.action || log.level || 'Unknown')}
                    </Badge>
                  </TD>
                  <TD className="py-2.5">
                    <div>
                      <span className="text-sm text-slate-900">
                        {log.target_name || log.resource_name || log.identifier || log.message || '—'}
                      </span>
                      {log.endpoint && (
                        <div className="mt-0.5">
                          <code className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {log.http_method} {log.endpoint}
                          </code>
                        </div>
                      )}
                    </div>
                  </TD>
                  <TD className="py-2.5"><span className="text-slate-600 text-sm">{log.ip_address || '—'}</span></TD>
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Log Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-brand-600" /></div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{formatActionLabel(viewing.action || viewing.level || 'Log Entry')}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getActionVariant(viewing, type)}>{formatActionLabel(viewing.action || viewing.level || 'Unknown')}</Badge>
                  {viewing.status_code && <Badge variant={viewing.status_code >= 500 ? 'danger' : 'warning'}>{viewing.status_code}</Badge>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {viewing.action && <DetailRow label="Action" value={formatActionLabel(viewing.action)} />}
              {viewing.level && <DetailRow label="Level" value={viewing.level} />}
              {(viewing.target_name || viewing.resource_name) && <DetailRow label="Target / Resource" value={viewing.target_name || viewing.resource_name} />}
              {viewing.identifier && <DetailRow label="Identifier" value={viewing.identifier} />}
              {viewing.ip_address && <DetailRow label="IP Address" value={viewing.ip_address} />}
              {viewing.device_type && <DetailRow label="Device" value={viewing.device_type} />}
              {viewing.endpoint && <DetailRow label="Endpoint" value={`${viewing.http_method || ''} ${viewing.endpoint}`.trim()} />}
              {viewing.response_time && <DetailRow label="Response Time" value={`${viewing.response_time}ms`} />}
              {viewing.status_code && <DetailRow label="Status Code" value={String(viewing.status_code)} />}
              {viewing.message && <DetailRow label="Message" value={viewing.message} />}
              <DetailRow label="Created" value={formatDate(viewing.created_at, 'MMM D, YYYY h:mm:ss A')} />
            </div>

            {viewing.changes && Object.keys(viewing.changes).length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Changes</h4>
                <pre className="p-3 bg-slate-50 border border-slate-100 rounded-md text-xs text-slate-700 overflow-x-auto font-mono">{JSON.stringify(viewing.changes, null, 2)}</pre>
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
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
