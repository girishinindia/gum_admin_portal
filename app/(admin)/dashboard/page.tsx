"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Users, Shield, Globe2, Activity, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface Stats {
  users: number;
  roles: number;
  countries: number;
  recentActivity: any[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [u, r, c, a] = await Promise.all([
        api.listUsers('?page=1&limit=1'),
        api.listRoles(),
        api.listCountries(),
        api.authLogs('?page=1&limit=5'),
      ]);
      setStats({
        users: u.pagination?.total || 0,
        roles: Array.isArray(r.data) ? r.data.length : 0,
        countries: Array.isArray(c.data) ? c.data.length : 0,
        recentActivity: Array.isArray(a.data) ? a.data : [],
      });
    } finally { setLoading(false); }
  }

  const cards = [
    { label: 'Total Users', value: stats?.users, icon: Users, color: 'brand', href: '/users' },
    { label: 'Roles', value: stats?.roles, icon: Shield, color: 'emerald', href: '/roles' },
    { label: 'Countries', value: stats?.countries, icon: Globe2, color: 'amber', href: '/countries' },
    { label: 'Recent Logins', value: stats?.recentActivity.length, icon: Activity, color: 'purple', href: '/activity-logs' },
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
                      {loading ? <Skeleton className="h-9 w-16" /> : card.value?.toLocaleString() || '0'}
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

      <Card>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">Recent Authentication Activity</h2>
            <p className="text-sm text-slate-500 mt-0.5">Latest login, register, and OTP events</p>
          </div>
          <Link href="/activity-logs" className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 font-medium">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : stats?.recentActivity.length ? (
            stats.recentActivity.map((log: any) => (
              <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {log.action.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {log.identifier || '—'} · {log.ip_address || 'unknown IP'}
                  </div>
                </div>
                <div className="text-xs text-slate-400 flex-shrink-0">{formatDate(log.created_at, 'MMM D, h:mm A')}</div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">No recent activity</div>
          )}
        </div>
      </Card>
    </div>
  );
}
