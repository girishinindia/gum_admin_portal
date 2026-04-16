"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronRight, LogIn, UserPlus, ShieldAlert, KeyRound } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { api } from '@/lib/api';
import { fromNow } from '@/lib/utils';
import { cn } from '@/lib/utils';

function getIcon(action: string) {
  if (action.includes('login')) return LogIn;
  if (action.includes('register')) return UserPlus;
  if (action.includes('failed') || action.includes('locked')) return ShieldAlert;
  if (action.includes('password') || action.includes('otp')) return KeyRound;
  return Bell;
}

function getTone(action: string) {
  if (action.includes('failed') || action.includes('locked') || action.includes('denied')) return 'bg-red-50 text-red-600';
  if (action.includes('success') || action.includes('verified') || action.includes('completed')) return 'bg-emerald-50 text-emerald-600';
  if (action.includes('register')) return 'bg-purple-50 text-purple-600';
  return 'bg-brand-50 text-brand-600';
}

export function NotificationsDropdown() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function load() {
    const res = await api.authLogs('?page=1&limit=8');
    if (res.success && Array.isArray(res.data)) {
      setLogs(res.data);
      // Count "new" as events in last 5 minutes
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      setUnread(res.data.filter((l: any) => new Date(l.created_at).getTime() > fiveMinAgo).length);
    }
    setLoading(false);
  }

  return (
    <Dropdown
      width="w-96"
      trigger={
        <div className="relative w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-600 hover:text-slate-900">
          <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
          )}
        </div>
      }
    >
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="font-display font-semibold text-slate-900">Notifications</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {unread > 0 ? `${unread} new in the last 5 min` : 'Recent authentication activity'}
          </div>
        </div>
        {unread > 0 && (
          <span className="text-[10px] font-bold tracking-wider uppercase bg-red-500 text-white px-1.5 py-0.5 rounded">
            {unread} new
          </span>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm text-slate-500">No recent notifications</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map((log: any) => {
              const Icon = getIcon(log.action);
              const tone = getTone(log.action);
              const label = log.action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              return (
                <Link
                  key={log.id}
                  href="/activity-logs"
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors"
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', tone)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 leading-tight">{label}</div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {log.identifier || log.ip_address || '—'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{fromNow(log.created_at)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Link href="/activity-logs" className="block px-4 py-3 border-t border-slate-100 text-center text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50/50 transition-colors">
        <span className="inline-flex items-center gap-1">
          View all activity <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    </Dropdown>
  );
}
