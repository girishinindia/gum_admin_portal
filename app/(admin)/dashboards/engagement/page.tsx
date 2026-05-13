'use client';

import { useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { DashboardShell, formatNum, formatPct, formatDateTime } from '@/components/dashboards/DashboardShell';

interface EngagementData {
  kpis: {
    active_learners_7d: number;
    completion_rate_30d_pct: number;
    platform_avg_rating: number;
    total_reviews: number;
    certificates_issued_30d: number;
    flagged_reviews: number;
  };
  trend: { rating_distribution: Array<{ star: number; count: number }> };
  tables: { recent_reviews: any[]; flagged_reviews: any[]; lowest_rated_courses: any[]; stuck_enrollments: any[] };
  meta: { window_days: number; generated_at: string };
}

function StarBar({ rows }: { rows: Array<{ star: number; count: number }> }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      <div className="text-sm font-semibold text-slate-900 mb-3">Rating distribution</div>
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((s) => {
          const r = rows.find((x) => x.star === s);
          const w = r ? Math.round((r.count / max) * 100) : 0;
          return (
            <div key={s} className="flex items-center gap-2 text-sm">
              <div className="w-8 text-slate-600">{s}★</div>
              <div className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                <div className="bg-amber-400 h-3" style={{ width: `${w}%` }} />
              </div>
              <div className="w-12 text-right text-slate-600 tabular-nums">{r?.count ?? 0}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EngagementDashboardPage() {
  const [days, setDays] = useState(30);
  const { data, loading, error, refresh } = useDashboard<EngagementData>('engagement', { days });

  const kpis = [
    { label: 'Active learners (7d)', value: formatNum(data?.kpis.active_learners_7d ?? 0) },
    { label: 'Completion rate (30d)', value: formatPct(data?.kpis.completion_rate_30d_pct ?? 0), tone: 'good' as const },
    { label: 'Avg rating',           value: (data?.kpis.platform_avg_rating ?? 0).toFixed(2) + ' ★' },
    { label: 'Total reviews',        value: formatNum(data?.kpis.total_reviews ?? 0), href: '/reviews' },
    { label: 'Certificates (30d)',   value: formatNum(data?.kpis.certificates_issued_30d ?? 0), href: '/issued-certificates' },
    { label: 'Flagged reviews',      value: formatNum(data?.kpis.flagged_reviews ?? 0), tone: (data?.kpis.flagged_reviews ?? 0) > 0 ? ('warn' as const) : ('good' as const), href: '/reviews' },
  ];

  return (
    <DashboardShell
      title="Student Engagement"
      subtitle={`Learners, completion, ratings, certificates. Window: last ${days} days.`}
      loading={loading}
      error={error}
      generatedAt={data?.meta?.generated_at}
      onRefresh={refresh}
      quickActions={[
        { label: '7d',  onClick: () => setDays(7) },
        { label: '30d', onClick: () => setDays(30) },
        { label: '90d', onClick: () => setDays(90) },
        { label: 'Reviews', href: '/reviews' },
      ]}
      kpis={kpis}
      trend={<StarBar rows={data?.trend.rating_distribution ?? []} />}
      tables={[
        {
          title: 'Recent reviews',
          rows: data?.tables.recent_reviews ?? [],
          empty: 'No reviews yet.',
          columns: [
            { key: 'rating', label: '★', render: (r: any) => <span className="text-amber-500 font-semibold">{r.rating}</span> },
            { key: 'comment', label: 'Comment', render: (r: any) => <span className="text-xs">{(r.comment ?? '').slice(0, 80)}</span> },
            { key: 'created_at', label: 'When', render: (r: any) => formatDateTime(r.created_at) },
          ],
          href: '/reviews',
        },
        {
          title: 'Flagged reviews',
          rows: data?.tables.flagged_reviews ?? [],
          empty: '✓ No reviews flagged.',
          columns: [
            { key: 'rating', label: '★' },
            { key: 'comment', label: 'Comment', render: (r: any) => <span className="text-xs">{(r.comment ?? '').slice(0, 80)}</span> },
            { key: 'created_at', label: 'Flagged', render: (r: any) => formatDateTime(r.created_at) },
          ],
          href: '/reviews',
        },
        {
          title: 'Lowest rated courses',
          rows: data?.tables.lowest_rated_courses ?? [],
          empty: 'No rated courses yet.',
          columns: [
            { key: 'name', label: 'Course' },
            { key: 'average_rating', label: 'Rating', render: (r: any) => `${Number(r.average_rating ?? 0).toFixed(2)} ★` },
            { key: 'total_reviews_received', label: 'Reviews' },
          ],
          href: '/courses',
        },
        {
          title: 'Stuck enrollments (no activity 14d+)',
          rows: data?.tables.stuck_enrollments ?? [],
          empty: '✓ No stuck enrollments.',
          columns: [
            { key: 'user_id', label: 'User' },
            { key: 'course_id', label: 'Course' },
            { key: 'last_accessed_at', label: 'Last seen', render: (r: any) => formatDateTime(r.last_accessed_at) },
          ],
          href: '/enrollments',
        },
      ]}
    />
  );
}
