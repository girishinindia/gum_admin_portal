"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Inbox, Trash2, Eye, RotateCcw, AlertTriangle, Loader2, FileText, ExternalLink } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

interface JobApplication {
  id: number;
  position_id: number | null;
  position_title: string;
  full_name: string;
  email: string;
  phone: string;
  current_location: string | null;
  experience_years: string | null;
  current_ctc: string | null;
  expected_ctc: string | null;
  notice_period: string | null;
  portfolio_url: string | null;
  linkedin_url: string | null;
  cover_letter: string | null;
  resume_url: string | null;
  resume_original_name: string | null;
  status: string;
  admin_notes: string | null;
  deleted_at: string | null;
  created_at: string;
  job_positions?: { title: string; slug: string } | null;
}

const STATUSES = ['new', 'reviewed', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];
const statusColor: Record<string, string> = {
  new: 'info', reviewed: 'muted', shortlisted: 'warning', interview: 'warning', offered: 'success', hired: 'success', rejected: 'danger',
};

export default function JobApplicationsPage() {
  const [items, setItems] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<JobApplication | null>(null);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', 'created_at'); qs.set('order', 'desc');
    if (showTrash) qs.set('show_deleted', 'true');
    else if (filterStatus) qs.set('status', filterStatus);
    const res = await api.listJobApplications('?' + qs.toString());
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    setLoading(false);
  }

  function openView(a: JobApplication) { setViewing(a); setStatus(a.status); setNotes(a.admin_notes || ''); }

  async function saveDetail() {
    if (!viewing) return;
    setSavingDetail(true);
    try {
      const res = await api.updateJobApplication(viewing.id, { status, admin_notes: notes });
      if (res.success) { toast.success('Application updated'); setViewing(null); load(); }
      else toast.error(res.error || 'Failed');
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    setSavingDetail(false);
  }

  async function onSoftDelete(a: JobApplication) {
    if (!confirm(`Move ${a.full_name}'s application to trash?`)) return;
    setActionLoadingId(a.id);
    const res = await api.deleteJobApplication(a.id).catch((e: any) => ({ success: false, error: e.message }));
    setActionLoadingId(null);
    if (res.success) { toast.success('Moved to trash'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onRestore(a: JobApplication) {
    setActionLoadingId(a.id);
    const res = await api.restoreJobApplication(a.id).catch((e: any) => ({ success: false, error: e.message }));
    setActionLoadingId(null);
    if (res.success) { toast.success('Restored'); load(); } else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Job Applications" description="Career applications submitted through the website" />

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Applications</button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}><Trash2 className="w-3.5 h-3.5" /> Trash</button>
      </div>

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name, email, position...'}>
        {!showTrash && (
          <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Applications in trash can be restored.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : Inbox} title={showTrash ? 'Trash is empty' : 'No applications yet'} description={showTrash ? 'No deleted applications' : 'Applications will appear here once candidates apply'} />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16">ID</TH>
                <TH>Candidate</TH>
                <TH>Position</TH>
                <TH>Status</TH>
                <TH>Applied</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(a => (
                <TR key={a.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined)}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{a.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="font-medium text-slate-900">{a.full_name}</div>
                    <div className="text-xs text-slate-500">{a.email}</div>
                  </TD>
                  <TD className="py-2.5"><span className="text-slate-600 text-sm">{a.job_positions?.title || a.position_title}</span></TD>
                  <TD className="py-2.5"><Badge variant={(statusColor[a.status] || 'muted') as any}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</Badge></TD>
                  <TD className="py-2.5"><span className="text-xs text-slate-500">{fromNow(a.created_at)}</span></TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <button onClick={() => onRestore(a)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" title="Restore">{actionLoadingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                      ) : (
                        <>
                          <button onClick={() => openView(a)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(a)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50" title="Move to Trash">{actionLoadingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Application Details" size="lg">
        {viewing && (
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.full_name}</h3>
                <p className="text-sm text-slate-500">Applied for <span className="font-medium text-slate-700">{viewing.job_positions?.title || viewing.position_title}</span> · {fromNow(viewing.created_at)}</p>
              </div>
              {viewing.resume_url && (
                <a href={viewing.resume_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 text-brand-700 px-3 py-2 text-sm font-medium hover:bg-brand-100">
                  <FileText className="w-4 h-4" /> Résumé <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <Detail label="Email" value={viewing.email} />
              <Detail label="Phone" value={viewing.phone} />
              <Detail label="Location" value={viewing.current_location} />
              <Detail label="Experience" value={viewing.experience_years} />
              <Detail label="Current CTC" value={viewing.current_ctc} />
              <Detail label="Expected CTC" value={viewing.expected_ctc} />
              <Detail label="Notice period" value={viewing.notice_period} />
              <Detail label="Résumé file" value={viewing.resume_original_name} />
              <Detail label="Portfolio" value={viewing.portfolio_url} link />
              <Detail label="LinkedIn" value={viewing.linkedin_url} link />
            </div>

            {viewing.cover_letter && (
              <div>
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Cover letter</div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3">{viewing.cover_letter}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select className={cn(selectClass, 'w-full')} value={status} onChange={e => setStatus(e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Internal notes</label>
              <textarea rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Private notes for the hiring team" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={saveDetail} disabled={savingDetail}>{savingDetail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}</Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function Detail({ label, value, link }: { label: string; value?: string | null; link?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 break-words">
        {value ? (link ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{value}</a> : value) : '—'}
      </dd>
    </div>
  );
}
