"use client";
import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { api } from '@/lib/api';
import { fromNow } from '@/lib/utils';
import {
  Clock, Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Timer, Calendar, Zap, Trash2, Bell, CreditCard, GraduationCap,
  ShoppingCart, Tag, FileText, BarChart3, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';

/* ── Types ── */
interface CronJob {
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun: string | null;
  lastResult: any;
  lastDuration: number | null;
  nextRun: string | null;
  runCount: number;
  errorCount: number;
}

/* ── Helpers ── */
const jobIcons: Record<string, any> = {
  'enrollment-expiry':        GraduationCap,
  'order-expiry':             ShoppingCart,
  'announcement-lifecycle':   FileText,
  'earning-confirmation':     CreditCard,
  'auto-payout':              CreditCard,
  'instructor-profile-sync':  BarChart3,
  'notification-digest':      Bell,
  'certificate-auto-issue':   Shield,
  'failed-notification-retry': AlertTriangle,
  'course-reminder':          GraduationCap,
  'stale-cart-cleanup':       Trash2,
  'coupon-deactivation':      Tag,
  'old-notification-cleanup': Bell,
};

const jobColors: Record<string, string> = {
  'enrollment-expiry':        'text-blue-500',
  'order-expiry':             'text-orange-500',
  'announcement-lifecycle':   'text-purple-500',
  'earning-confirmation':     'text-emerald-500',
  'auto-payout':              'text-green-600',
  'instructor-profile-sync':  'text-cyan-500',
  'notification-digest':      'text-yellow-500',
  'certificate-auto-issue':   'text-indigo-500',
  'failed-notification-retry': 'text-red-500',
  'course-reminder':          'text-teal-500',
  'stale-cart-cleanup':       'text-slate-500',
  'coupon-deactivation':      'text-pink-500',
  'old-notification-cleanup': 'text-amber-500',
};

function parseCron(expr: string): string {
  const parts = expr.split(' ');
  if (parts.length !== 5) return expr;
  const [min, hour, dom, , dow] = parts;

  if (dow !== '*' && dow !== '?') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `Weekly ${days[parseInt(dow)] || dow} at ${hour}:${min.padStart(2, '0')}`;
  }
  if (min.startsWith('*/')) return `Every ${min.replace('*/', '')} min`;
  if (hour === '*') return `Hourly at :${min.padStart(2, '0')}`;
  return `Daily at ${hour}:${min.padStart(2, '0')}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatResult(result: any): string {
  if (!result) return '—';
  if (typeof result === 'object') {
    return Object.entries(result)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return String(result);
}

/* ── Page ── */
export default function ScheduledJobsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ name: string; success: boolean; result?: any; error?: string } | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.getCronStatus();
      setJobs(res.data || []);
    } catch (err: any) {
      toast.error('Failed to load job status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleTrigger = async (name: string) => {
    setTriggering(name);
    try {
      const res = await api.triggerCronJob(name);
      const jobResult = res.data as any;
      setTriggerResult({ name, success: jobResult?.success, result: jobResult?.result, error: jobResult?.error });
      if (jobResult?.success) {
        toast.success(`Job "${name}" completed successfully`);
      } else {
        toast.error(`Job "${name}" failed: ${jobResult?.error || 'Unknown error'}`);
      }
      fetchJobs(); // Refresh data after trigger
    } catch (err: any) {
      toast.error(`Failed to trigger "${name}"`);
      setTriggerResult({ name, success: false, error: err.message });
    } finally {
      setTriggering(null);
    }
  };

  /* ── Stats ── */
  const totalJobs = jobs.length;
  const enabledJobs = jobs.filter(j => j.enabled).length;
  const totalRuns = jobs.reduce((s, j) => s + j.runCount, 0);
  const totalErrors = jobs.reduce((s, j) => s + j.errorCount, 0);

  /* ── Categories ── */
  const categories: { label: string; jobs: string[]; color: string }[] = [
    { label: 'Expiry & Lifecycle', jobs: ['enrollment-expiry', 'order-expiry', 'announcement-lifecycle'], color: 'border-blue-200' },
    { label: 'Payments & Earnings', jobs: ['earning-confirmation', 'auto-payout', 'instructor-profile-sync'], color: 'border-green-200' },
    { label: 'Notifications & Certs', jobs: ['notification-digest', 'certificate-auto-issue', 'failed-notification-retry', 'course-reminder'], color: 'border-purple-200' },
    { label: 'Cleanup & Maintenance', jobs: ['stale-cart-cleanup', 'coupon-deactivation', 'old-notification-cleanup'], color: 'border-slate-200' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled Jobs"
        description="Monitor and manage automated background tasks"
        actions={
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchJobs(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: totalJobs, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Enabled', value: enabledJobs, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Runs', value: totalRuns, icon: Zap, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Errors', value: totalErrors, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
            <div className={cn('p-2.5 rounded-lg', stat.bg)}>
              <stat.icon className={cn('w-5 h-5', stat.color)} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-xl font-semibold text-gray-900">
                {loading ? <Skeleton className="h-6 w-12" /> : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Job Table by Category */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <Skeleton className="h-6 w-48 mb-4" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={Clock} title="No scheduled jobs" description="No cron jobs are currently registered." />
      ) : (
        categories.map((cat) => {
          const catJobs = jobs.filter(j => cat.jobs.includes(j.name));
          if (catJobs.length === 0) return null;

          return (
            <div key={cat.label} className={cn('bg-white rounded-lg border-2 overflow-hidden', cat.color)}>
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">{cat.label}</h3>
              </div>
              <Table>
                <THead>
                  <TR>
                    <TH>Job</TH>
                    <TH>Schedule</TH>
                    <TH>Status</TH>
                    <TH>Last Run</TH>
                    <TH>Duration</TH>
                    <TH>Last Result</TH>
                    <TH>Runs / Errors</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {catJobs.map((job) => {
                    const Icon = jobIcons[job.name] || Clock;
                    const color = jobColors[job.name] || 'text-gray-500';
                    const isTriggering = triggering === job.name;

                    return (
                      <TR key={job.name}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <Icon className={cn('w-4 h-4 flex-shrink-0', color)} />
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{job.name}</p>
                              <p className="text-xs text-gray-500 max-w-[280px] truncate">{job.description}</p>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-1.5">
                            <Timer className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-sm text-gray-600">{parseCron(job.schedule)}</span>
                          </div>
                        </TD>
                        <TD>
                          <Badge variant={job.enabled ? 'success' : 'muted'}>
                            {job.enabled ? 'Active' : 'Disabled'}
                          </Badge>
                        </TD>
                        <TD>
                          <span className="text-sm text-gray-600">
                            {job.lastRun ? fromNow(job.lastRun) : '—'}
                          </span>
                        </TD>
                        <TD>
                          <span className="text-sm text-gray-600">
                            {formatDuration(job.lastDuration)}
                          </span>
                        </TD>
                        <TD>
                          <span className="text-xs text-gray-500 max-w-[200px] truncate block">
                            {formatResult(job.lastResult)}
                          </span>
                        </TD>
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-700">{job.runCount}</span>
                            <span className="text-gray-300">/</span>
                            <span className={cn('text-sm', job.errorCount > 0 ? 'text-red-600 font-medium' : 'text-gray-400')}>
                              {job.errorCount}
                            </span>
                          </div>
                        </TD>
                        <TD className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTrigger(job.name)}
                            disabled={isTriggering || !job.enabled}
                          >
                            {isTriggering ? (
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {isTriggering ? 'Running…' : 'Trigger'}
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          );
        })
      )}

      {/* Trigger Result Dialog */}
      {triggerResult && (
        <Dialog
          open={!!triggerResult}
          onClose={() => setTriggerResult(null)}
          title={`Job: ${triggerResult.name}`}
        >
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              {triggerResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={cn('font-medium', triggerResult.success ? 'text-emerald-700' : 'text-red-700')}>
                {triggerResult.success ? 'Completed Successfully' : 'Failed'}
              </span>
            </div>

            {triggerResult.error && (
              <div className="bg-red-50 text-red-700 rounded-md p-3 text-sm">
                {triggerResult.error}
              </div>
            )}

            {triggerResult.result && (
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Result</p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(triggerResult.result, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setTriggerResult(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
