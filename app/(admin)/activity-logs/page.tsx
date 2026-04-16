"use client";
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { formatDate, fromNow } from '@/lib/utils';
import { FileText, LogIn, Settings, Database, AlertTriangle, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type LogType = 'auth' | 'admin' | 'data' | 'system';

const tabs: { type: LogType; label: string; icon: any; color: string }[] = [
  { type: 'auth',   label: 'Auth',   icon: LogIn,          color: 'text-brand-600' },
  { type: 'admin',  label: 'Admin',  icon: Settings,       color: 'text-purple-600' },
  { type: 'data',   label: 'Data',   icon: Database,       color: 'text-emerald-600' },
  { type: 'system', label: 'System', icon: AlertTriangle,  color: 'text-amber-600' },
];

export default function ActivityLogsPage() {
  const [type, setType] = useState<LogType>('auth');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState('');

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [type, page]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '50' });
    if (filter) qs.set('action', filter);

    const fns: Record<LogType, any> = {
      auth:   api.authLogs,   admin:  api.adminLogs,
      data:   api.dataLogs,   system: api.systemLogs,
    };

    const res = await fns[type](`?${qs}`);
    if (res.success) {
      setLogs(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Activity Logs" description="Audit trail across authentication, admin, data, and system events" />

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

      <div className="flex gap-2 mb-4">
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
      </div>

      <Card>
        {loading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="p-4 flex gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState icon={FileText} title="No logs found" description="Try different filters or a different log type" />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {logs.map((log: any) => (
                <LogRow key={log.id} log={log} type={type} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-slate-100">
                <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /> Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next <ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function LogRow({ log, type }: { log: any; type: LogType }) {
  const actionLabel = log.action?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  const variant = type === 'system'
    ? (log.level === 'error' || log.level === 'critical' ? 'danger' : log.level === 'warn' ? 'warning' : 'muted')
    : log.action?.includes('failed') || log.action?.includes('denied')
      ? 'danger'
      : log.action?.includes('success') || log.action?.includes('verified')
        ? 'success'
        : 'default';

  return (
    <div className="p-4 hover:bg-slate-50/50 transition-colors flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={variant}>{actionLabel}</Badge>
          {log.target_name && <span className="text-sm text-slate-700">→ {log.target_name}</span>}
          {log.resource_name && <span className="text-sm text-slate-700">→ {log.resource_name}</span>}
          {log.identifier && <span className="text-xs text-slate-500">{log.identifier}</span>}
          {log.status_code && <Badge variant={log.status_code >= 500 ? 'danger' : 'warning'}>{log.status_code}</Badge>}
        </div>
        <div className="mt-1 text-xs text-slate-500 flex items-center gap-3 flex-wrap">
          {log.ip_address && <span>IP: {log.ip_address}</span>}
          {log.device_type && <span>Device: {log.device_type}</span>}
          {log.endpoint && <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{log.http_method} {log.endpoint}</code>}
          {log.response_time && <span>{log.response_time}ms</span>}
        </div>
        {log.changes && Object.keys(log.changes).length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-brand-600 cursor-pointer hover:text-brand-700">View changes</summary>
            <pre className="mt-2 p-3 bg-slate-50 border border-slate-100 rounded-md text-xs text-slate-700 overflow-x-auto">{JSON.stringify(log.changes, null, 2)}</pre>
          </details>
        )}
        {log.message && <p className="text-sm text-slate-600 mt-1">{log.message}</p>}
      </div>
      <div className="text-xs text-slate-400 text-right flex-shrink-0">
        <div>{fromNow(log.created_at)}</div>
        <div className="text-[10px] mt-0.5">{formatDate(log.created_at, 'MMM D, h:mm A')}</div>
      </div>
    </div>
  );
}
