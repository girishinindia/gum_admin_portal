'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { DashboardShell, formatNum, formatDateTime } from '@/components/dashboards/DashboardShell';

interface OpsData {
  kpis: {
    open_tickets: number; tickets_today: number;
    breached_slas: number; failed_webhooks_24h: number;
    system_errors_24h: number;
  };
  tables: {
    oldest_open_tickets: any[];
    breached_slas: any[];
    failed_webhooks: any[];
    recent_admin_actions: any[];
    recent_system_errors: any[];
  };
  meta: { generated_at: string; note?: string };
}

export default function OperationsDashboardPage() {
  const { data, loading, error, refresh } = useDashboard<OpsData>('operations');

  const kpis = [
    { label: 'Open tickets',     value: formatNum(data?.kpis.open_tickets ?? 0),       href: '/support-tickets', tone: (data?.kpis.open_tickets ?? 0) > 10 ? ('warn' as const) : undefined },
    { label: 'Tickets today',    value: formatNum(data?.kpis.tickets_today ?? 0) },
    { label: 'Breached SLAs',    value: formatNum(data?.kpis.breached_slas ?? 0),      tone: (data?.kpis.breached_slas ?? 0) > 0 ? ('danger' as const) : ('good' as const) },
    { label: 'Webhook fails 24h',value: formatNum(data?.kpis.failed_webhooks_24h ?? 0),tone: (data?.kpis.failed_webhooks_24h ?? 0) > 0 ? ('warn' as const) : undefined },
    { label: 'System errors 24h',value: formatNum(data?.kpis.system_errors_24h ?? 0),  tone: (data?.kpis.system_errors_24h ?? 0) > 0 ? ('warn' as const) : ('good' as const), href: '/activity-logs' },
  ];

  return (
    <DashboardShell
      title="Operations & System Health"
      subtitle={data?.meta?.note ?? 'Tickets, webhooks, system errors, and admin actions at a glance.'}
      loading={loading}
      error={error}
      generatedAt={data?.meta?.generated_at}
      onRefresh={refresh}
      quickActions={[
        { label: 'Queues',        href: '/queues' },
        { label: 'Scheduled jobs', href: '/scheduled-jobs' },
        { label: 'Activity logs',  href: '/activity-logs' },
        { label: 'Tickets',        href: '/support-tickets' },
      ]}
      kpis={kpis}
      tables={[
        {
          title: 'Oldest open tickets',
          rows: data?.tables.oldest_open_tickets ?? [],
          empty: '✓ No open tickets.',
          columns: [
            { key: 'ticket_number', label: 'Ticket' },
            { key: 'subject', label: 'Subject' },
            { key: 'created_at', label: 'Created', render: (r: any) => formatDateTime(r.created_at) },
          ],
          href: '/support-tickets',
        },
        {
          title: 'Failed webhooks · 24h',
          rows: data?.tables.failed_webhooks ?? [],
          empty: '✓ No webhook failures.',
          columns: [
            { key: 'provider', label: 'Provider' },
            { key: 'event_type', label: 'Event' },
            { key: 'occurred_at', label: 'When', render: (r: any) => formatDateTime(r.occurred_at) },
            { key: 'error', label: 'Error', render: (r: any) => <span className="text-rose-600 text-xs">{r.error?.slice(0, 50) ?? '—'}</span> },
          ],
        },
        {
          title: 'Recent system errors · 24h',
          rows: data?.tables.recent_system_errors ?? [],
          empty: '✓ Clean.',
          columns: [
            { key: 'action', label: 'Action' },
            { key: 'message', label: 'Message', render: (r: any) => <span className="text-xs">{r.message?.slice(0, 70) ?? '—'}</span> },
            { key: 'created_at', label: 'When', render: (r: any) => formatDateTime(r.created_at) },
          ],
          href: '/activity-logs',
        },
        {
          title: 'Recent admin actions',
          rows: data?.tables.recent_admin_actions ?? [],
          empty: 'No recent actions logged.',
          columns: [
            { key: 'action', label: 'Action' },
            { key: 'target_type', label: 'Target' },
            { key: 'target_name', label: 'Name' },
            { key: 'created_at', label: 'When', render: (r: any) => formatDateTime(r.created_at) },
          ],
          href: '/activity-logs',
        },
      ]}
    />
  );
}
