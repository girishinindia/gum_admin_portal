"use client";
/**
 * Admin notifications bell (June 2026 fix).
 *
 * WAS: showed auth ACTIVITY LOGS (logins/OTP) and never read the
 * notifications table — so real notifications (e.g. "student replied on a
 * ticket") were invisible even though the API created them correctly.
 *
 * NOW: real in-app notifications for the signed-in admin via
 * /notifications/me (+ unread count, mark-read on click, mark-all-read).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronRight, LifeBuoy, CreditCard, Megaphone, CheckCheck } from 'lucide-react';
import { Dropdown } from '@/components/ui/Dropdown';
import { apiRequest } from '@/lib/api';
import { fromNow, cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Notif {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  reference_type?: string | null;
  reference_id?: number | null;
  created_at: string;
}

function iconFor(type: string) {
  if (type.startsWith('support_ticket')) return LifeBuoy;
  if (type.includes('payment') || type.includes('order') || type.includes('payout')) return CreditCard;
  if (type.includes('announcement') || type.includes('campaign')) return Megaphone;
  return Bell;
}

function toneFor(type: string, read: boolean) {
  if (read) return 'bg-slate-100 text-slate-400';
  if (type === 'support_ticket_reply') return 'bg-amber-50 text-amber-600';
  if (type.startsWith('support_ticket')) return 'bg-brand-50 text-brand-600';
  return 'bg-emerald-50 text-emerald-600';
}

/** Where clicking a notification should take the admin. */
function hrefFor(n: Notif): string {
  if (n.reference_type === 'support_ticket' || n.notification_type.startsWith('support_ticket')) return '/support-tickets';
  if (n.reference_type === 'order') return '/orders';
  if (n.reference_type === 'payout_request') return '/payout-requests';
  return '/notifications';
}

export function NotificationsDropdown() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function load() {
    try {
      const [list, count] = await Promise.all([
        apiRequest<any>('/notifications/me?limit=10'),
        apiRequest<any>('/notifications/me/unread-count'),
      ]);
      if (Array.isArray(list?.data)) setItems(list.data);
      setUnread(Number(count?.data?.unread_count) || 0);
    } catch { /* keep last state */ }
    setLoading(false);
  }

  async function open(n: Notif) {
    if (!n.is_read) {
      setItems((s) => s.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      apiRequest(`/notifications/me/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
    }
    router.push(hrefFor(n));
  }

  async function markAll() {
    setItems((s) => s.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
    apiRequest('/notifications/me/read-all', { method: 'PATCH' }).catch(() => {});
  }

  return (
    <Dropdown
      width="w-96"
      trigger={
        <div className="relative w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-600 hover:text-slate-900">
          <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      }
    >
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="font-display font-semibold text-slate-900">Notifications</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {unread > 0 ? `${unread} unread` : 'You’re all caught up'}
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 px-2 py-1 rounded hover:bg-brand-50 transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm text-slate-500">No notifications yet</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {items.map((n) => {
              const Icon = iconFor(n.notification_type);
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={cn(
                    'w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50/80 transition-colors',
                    !n.is_read && 'bg-brand-50/40'
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', toneFor(n.notification_type, n.is_read))}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm leading-tight truncate', n.is_read ? 'text-slate-600 font-medium' : 'text-slate-900 font-semibold')}>
                      {n.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>
                    <div className="text-[11px] text-slate-400 mt-1">{fromNow(n.created_at)}</div>
                  </div>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => router.push('/notifications')}
        className="w-full px-4 py-3 border-t border-slate-100 text-center text-sm font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50/50 transition-colors"
      >
        <span className="inline-flex items-center gap-1 justify-center">
          View all notifications <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </button>
    </Dropdown>
  );
}
