"use client";
import { useEffect, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import {
  RefreshCw, Layers, AlertTriangle, CheckCircle2, XCircle, Loader2, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';

/* ── Types (mirror gum_api QueueStats) ── */
interface QueueStat {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/* ── Page ── */
export default function QueuesPage() {
  const [queues, setQueues] = useState<QueueStat[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchQueues = useCallback(async () => {
    try {
      const res = await api.getQueues();
      const data = res.data as any;
      setEnabled(data?.enabled ?? false);
      setQueues(data?.queues || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load queues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueues();
    const interval = setInterval(fetchQueues, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchQueues]);

  const handleRetry = async (name: string) => {
    setRetrying(name);
    try {
      const res = await api.retryQueueFailed(name);
      const retried = (res.data as any)?.retried;
      toast.success(`Retry triggered on "${name}"${typeof retried === 'number' ? ` (${retried} waiting)` : ''}`);
      fetchQueues();
    } catch (err: any) {
      toast.error(err?.message || `Failed to retry "${name}"`);
    } finally {
      setRetrying(null);
    }
  };

  /* ── Stats ── */
  const totalFailed = queues.reduce((s, q) => s + q.failed, 0);
  const totalActive = queues.reduce((s, q) => s + q.active, 0);
  const totalWaiting = queues.reduce((s, q) => s + q.waiting, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Queues"
        description="Monitor BullMQ background queues and replay failed jobs"
        actions={
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchQueues(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        }
      />

      {!loading && !enabled ? (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Queues are disabled. Set <code className="font-mono">QUEUE_ENABLED=true</code> in the API environment to enable background processing.</span>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Waiting', value: totalWaiting, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active', value: totalActive, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Failed', value: totalFailed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
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

          {/* Queue Table */}
          {loading ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <Skeleton className="h-32 w-full" />
            </div>
          ) : queues.length === 0 ? (
            <EmptyState icon={Layers} title="No queues" description="No queues are currently registered." />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <Table>
                <THead>
                  <TR>
                    <TH>Queue</TH>
                    <TH>Waiting</TH>
                    <TH>Active</TH>
                    <TH>Completed</TH>
                    <TH>Failed</TH>
                    <TH>Delayed</TH>
                    <TH>Paused</TH>
                    <TH className="text-right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {queues.map((q) => {
                    const isRetrying = retrying === q.name;
                    return (
                      <TR key={q.name}>
                        <TD><span className="font-medium text-gray-900 text-sm">{q.name}</span></TD>
                        <TD><span className="text-sm text-gray-600">{q.waiting}</span></TD>
                        <TD><span className="text-sm text-gray-600">{q.active}</span></TD>
                        <TD><span className="text-sm text-gray-600">{q.completed}</span></TD>
                        <TD>
                          <span className={cn('text-sm', q.failed > 0 ? 'text-red-600 font-medium' : 'text-gray-400')}>
                            {q.failed}
                          </span>
                        </TD>
                        <TD><span className="text-sm text-gray-600">{q.delayed}</span></TD>
                        <TD><span className="text-sm text-gray-600">{q.paused}</span></TD>
                        <TD className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetry(q.name)}
                            disabled={isRetrying || q.failed === 0}
                          >
                            {isRetrying ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {isRetrying ? 'Retrying…' : 'Retry failed'}
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
