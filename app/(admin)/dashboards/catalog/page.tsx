'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { DashboardShell, formatNum, formatDate, formatDateTime } from '@/components/dashboards/DashboardShell';
import { TrendChart } from '@/components/dashboards/TrendChart';

interface CatalogData {
  kpis: {
    courses_published: number; courses_draft: number;
    pending_instructor_approvals: number;
    total_mcq_questions: number;
    upcoming_webinars: number;
    upcoming_live_classes: number;
  };
  trend: { courses_created_daily: Array<{ day: string; courses_created: number }> };
  tables: {
    drafts_older_7d: any[];
    pending_instructor_approvals: any[];
    upcoming_webinars: any[];
    upcoming_live_classes: any[];
  };
  meta: { generated_at: string };
}

export default function CatalogDashboardPage() {
  const { data, loading, error, refresh } = useDashboard<CatalogData>('catalog');

  const kpis = [
    { label: 'Published courses', value: formatNum(data?.kpis.courses_published ?? 0), href: '/courses' },
    { label: 'Draft courses',     value: formatNum(data?.kpis.courses_draft ?? 0),    href: '/courses', tone: (data?.kpis.courses_draft ?? 0) > 10 ? ('warn' as const) : undefined },
    { label: 'Pending instructors', value: formatNum(data?.kpis.pending_instructor_approvals ?? 0), href: '/instructor-profiles', tone: (data?.kpis.pending_instructor_approvals ?? 0) > 0 ? ('warn' as const) : undefined },
    { label: 'MCQ questions',     value: formatNum(data?.kpis.total_mcq_questions ?? 0), href: '/mcq-questions' },
    { label: 'Upcoming webinars', value: formatNum(data?.kpis.upcoming_webinars ?? 0),   href: '/webinars' },
    { label: 'Upcoming live classes', value: formatNum(data?.kpis.upcoming_live_classes ?? 0), href: '/live-classes' },
  ];

  const trendData = (data?.trend.courses_created_daily ?? []).map((r) => ({ x: r.day, y: r.courses_created }));

  return (
    <DashboardShell
      title="Catalog & Content"
      subtitle="Courses, instructors, Q&A coverage, webinars, live classes."
      loading={loading}
      error={error}
      generatedAt={data?.meta?.generated_at}
      onRefresh={refresh}
      quickActions={[
        { label: 'New course',          href: '/courses' },
        { label: 'Approve instructor',  href: '/instructor-profiles' },
        { label: 'Material tree',       href: '/material-tree' },
      ]}
      kpis={kpis}
      trend={<TrendChart title="Courses created · last 30 days" data={trendData} yFormat={formatNum} />}
      tables={[
        {
          title: 'Drafts older than 7 days',
          rows: data?.tables.drafts_older_7d ?? [],
          empty: '✓ No stale drafts.',
          columns: [
            { key: 'name', label: 'Course' },
            { key: 'slug', label: 'Slug' },
            { key: 'created_at', label: 'Created', render: (r: any) => formatDate(r.created_at) },
          ],
          href: '/courses',
        },
        {
          title: 'Pending instructor approvals',
          rows: data?.tables.pending_instructor_approvals ?? [],
          empty: '✓ No pending approvals.',
          columns: [
            { key: 'instructor_code', label: 'Code' },
            { key: 'user_id', label: 'User' },
            { key: 'created_at', label: 'Requested', render: (r: any) => formatDate(r.created_at) },
          ],
          href: '/instructor-profiles',
        },
        {
          title: 'Upcoming webinars',
          rows: data?.tables.upcoming_webinars ?? [],
          empty: 'No upcoming webinars.',
          columns: [
            { key: 'name', label: 'Webinar' },
            { key: 'start_at', label: 'Starts', render: (r: any) => formatDateTime(r.start_at) },
          ],
          href: '/webinars',
        },
        {
          title: 'Upcoming live classes',
          rows: data?.tables.upcoming_live_classes ?? [],
          empty: 'No upcoming live classes.',
          columns: [
            { key: 'session_title', label: 'Session' },
            { key: 'scheduled_at', label: 'Scheduled', render: (r: any) => formatDateTime(r.scheduled_at) },
          ],
          href: '/live-classes',
        },
      ]}
    />
  );
}
