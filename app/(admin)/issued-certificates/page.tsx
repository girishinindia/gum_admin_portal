'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  Loader2, MoreVertical, Award, Ban, Send, ExternalLink,
} from 'lucide-react';
import { fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'issued_at' | 'certificate_number';

const STATUS_COLORS: Record<string, string> = {
  valid: 'bg-emerald-50 text-emerald-700',
  revoked: 'bg-red-50 text-red-700',
  expired: 'bg-slate-100 text-slate-500',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

function formatDate(d: string | null) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCertStatus(row: any): string {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return 'expired';
  return 'valid';
}

export default function IssuedCertificatesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('issued_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [filterRevoked, setFilterRevoked] = useState('');

  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // doc 24 fix: real pickers instead of raw IDs. Templates + users load once;
  // enrollments load for the SELECTED user so admins never guess enrollment ids.
  const [templates, setTemplates] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userEnrollments, setUserEnrollments] = useState<any[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

  useEffect(() => {
    api.listCertificateTemplates({ limit: 200, sort: 'name', order: 'asc' }).then((r: any) => setTemplates(r?.data || [])).catch(() => setTemplates([]));
    api.listUsers('?limit=500&sort=first_name&order=asc').then((r: any) => setUsers(r?.data || [])).catch(() => setUsers([]));
  }, []);

  const templateOptions = templates.filter((t: any) => !t.deleted_at).map((t: any) => ({
    value: String(t.id), label: `${t.name}${t.course_name ? ` — ${t.course_name}` : ''} (${t.template_type})`,
  }));
  const userOptions = users.map((u: any) => ({
    value: String(u.id),
    label: `${[u.first_name, u.last_name].filter(Boolean).join(' ') || 'User'} — ${u.email || u.mobile || `#${u.id}`}`,
  }));
  const enrollmentOptions = userEnrollments.map((e: any) => ({
    value: String(e.id),
    label: `#${e.id} · ${String(e.item_type || '').replace(/_/g, ' ')} ${e.item_id} · ${e.enrollment_status}${e.progress_pct != null ? ` · ${e.progress_pct}%` : ''}`,
  }));

  const onPickUser = (uid: string) => {
    setIssueUserId(uid);
    setIssueEnrollmentId('');
    setUserEnrollments([]);
    if (!uid) return;
    setEnrollmentsLoading(true);
    api.listEnrollments(`?user_id=${uid}&limit=100&sort=created_at&order=desc`)
      .then((r: any) => setUserEnrollments(r?.data || []))
      .catch(() => setUserEnrollments([]))
      .finally(() => setEnrollmentsLoading(false));
  };

  // Issue form
  const [issueTemplateId, setIssueTemplateId] = useState('');
  const [issueUserId, setIssueUserId] = useState('');
  const [issueEnrollmentId, setIssueEnrollmentId] = useState('');

  // Bulk issue form
  const [bulkTemplateId, setBulkTemplateId] = useState('');
  const [bulkEnrollmentIds, setBulkEnrollmentIds] = useState('');

  const toolbarRef = useRef<DataToolbarHandle>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page, limit: pageSize, search,
        sort: sortField, order: sortOrder,
        show_deleted: showTrash ? 'true' : undefined,
        revoked: filterRevoked || undefined,
      };
      const res = await api.listIssuedCertificates(params);
      if (res.success) {
        setRows(res.data || []);
        setTotal(res.pagination?.total || 0);
      }
    } catch { toast.error('Failed to load certificates'); }
    setLoading(false);
  }, [page, pageSize, search, sortField, sortOrder, showTrash, filterRevoked]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  };

  const handleIssue = async () => {
    if (!issueTemplateId || !issueUserId || !issueEnrollmentId) { toast.error('All fields are required'); return; }
    setSaving(true);
    try {
      const res = await api.issueCertificate({ template_id: parseInt(issueTemplateId), user_id: parseInt(issueUserId), enrollment_id: parseInt(issueEnrollmentId) });
      if (res.success) { toast.success('Certificate issued!'); setIssueDialogOpen(false); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Issue failed'); }
    setSaving(false);
  };

  const handleBulkIssue = async () => {
    if (!bulkTemplateId || !bulkEnrollmentIds.trim()) { toast.error('Template and enrollment IDs required'); return; }
    setSaving(true);
    try {
      const ids = bulkEnrollmentIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const res = await api.bulkIssueCertificates({ template_id: parseInt(bulkTemplateId), enrollment_ids: ids });
      if (res.success) {
        toast.success(`${res.data.issued_count} issued, ${res.data.skipped_count} skipped`);
        setBulkDialogOpen(false); fetchData();
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Bulk issue failed'); }
    setSaving(false);
  };

  const handleRevoke = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.revokeCertificate(selected.id, { revoke_reason: revokeReason });
      if (res.success) { toast.success('Certificate revoked'); setRevokeDialogOpen(false); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Revoke failed'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = showTrash
        ? await api.deleteIssuedCertificate(deleteId)
        : await api.softDeleteIssuedCertificate(deleteId);
      if (res.success) { toast.success(showTrash ? 'Deleted' : 'Moved to trash'); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Delete failed'); }
    setDeleting(false); setDeleteId(null);
  };

  const handleRestore = async (id: number) => {
    try {
      const res = await api.restoreIssuedCertificate(id);
      if (res.success) { toast.success('Restored'); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Restore failed'); }
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Issued Certificates" description="Track and manage certificates issued to students" actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkDialogOpen(true)}><Send className="w-4 h-4 mr-1.5" /> Bulk Issue</Button>
          <Button size="sm" onClick={() => setIssueDialogOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> Issue Certificate</Button>
        </div>
      } />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <DataToolbar ref={toolbarRef} search={search} onSearchChange={v => { setSearch(v); setPage(1); }} searchPlaceholder="Search by certificate number..." />
        </div>
        <select className={selectClass} value={filterRevoked} onChange={e => { setFilterRevoked(e.target.value); setPage(1); }}>
          <option value="">All Certificates</option>
          <option value="false">Valid Only</option>
          <option value="true">Revoked Only</option>
        </select>
        <Button size="sm" variant={showTrash ? 'danger' : 'outline'} onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
          {showTrash ? <RotateCcw className="w-4 h-4 mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
          {showTrash ? 'View Active' : 'View Trash'}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH className="w-16">ID</TH>
              <TH className="cursor-pointer" onClick={() => toggleSort('certificate_number')}>
                <span className="inline-flex items-center gap-1">CERTIFICATE # <SortIcon field="certificate_number" /></span>
              </TH>
              <TH>STUDENT</TH>
              <TH>TEMPLATE</TH>
              <TH>COURSE</TH>
              <TH>STATUS</TH>
              <TH className="cursor-pointer" onClick={() => toggleSort('issued_at')}>
                <span className="inline-flex items-center gap-1">ISSUED <SortIcon field="issued_at" /></span>
              </TH>
              <TH className="w-20 text-right">ACTIONS</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TR key={i}>{Array.from({ length: 8 }).map((_, j) => <TD key={j}><Skeleton className="h-4 w-full" /></TD>)}</TR>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={8}><EmptyState icon={Award} title={showTrash ? 'Trash is empty' : 'No certificates issued'} description={showTrash ? '' : 'Issue certificates to students who complete courses'} /></td></tr>
            ) : rows.map(row => {
              const status = getCertStatus(row);
              return (
                <TR key={row.id} className={row.deleted_at ? 'opacity-60' : ''}>
                  <TD className="text-slate-400 text-xs">{row.id}</TD>
                  <TD>
                    <span className="font-mono text-sm text-slate-800">{row.certificate_number}</span>
                    {row.certificate_url && (
                      <a href={row.certificate_url} target="_blank" rel="noopener" className="ml-1.5 inline-flex">
                        <ExternalLink className="w-3 h-3 text-brand-500" />
                      </a>
                    )}
                  </TD>
                  <TD className="text-sm text-slate-700">{row.user_name || '--'}</TD>
                  <TD className="text-sm text-slate-600">{row.template_name || '--'}</TD>
                  <TD className="text-sm text-slate-600">{row.course_name || '--'}</TD>
                  <TD>
                    {row.deleted_at ? (
                      <Badge className="bg-red-50 text-red-600">Trashed</Badge>
                    ) : (
                      <Badge className={STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}>{status}</Badge>
                    )}
                  </TD>
                  <TD className="text-xs text-slate-400">{fromNow(row.issued_at)}</TD>
                  <TD className="text-right">
                    <Dropdown trigger={<button className="p-1 rounded hover:bg-slate-100"><MoreVertical className="w-4 h-4 text-slate-400" /></button>}>
                      <DropdownItem icon={Eye} onClick={() => { setSelected(row); setViewDialogOpen(true); }}>View</DropdownItem>
                      {!row.deleted_at && !row.revoked_at && (
                        <DropdownItem icon={Ban} onClick={() => { setSelected(row); setRevokeReason(''); setRevokeDialogOpen(true); }}>Revoke</DropdownItem>
                      )}
                      <DropdownDivider />
                      {row.deleted_at ? (
                        <>
                          <DropdownItem icon={RotateCcw} onClick={() => handleRestore(row.id)}>Restore</DropdownItem>
                          <DropdownItem icon={Trash2} danger onClick={() => setDeleteId(row.id)}>Delete Forever</DropdownItem>
                        </>
                      ) : (
                        <DropdownItem icon={Trash2} danger onClick={() => setDeleteId(row.id)}>Trash</DropdownItem>
                      )}
                    </Dropdown>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      {total > pageSize && <Pagination page={page} totalPages={Math.ceil(total / pageSize)} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={v => { setPageSize(v); setPage(1); }} total={total} />}

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} title="Certificate Details" size="lg">
        {selected && (
          <div className="p-6 grid grid-cols-2 gap-4">
            <DetailRow label="Certificate #" value={selected.certificate_number} />
            <DetailRow label="Status" value={getCertStatus(selected)} />
            <DetailRow label="Student" value={selected.user_name} />
            <DetailRow label="Template" value={selected.template_name} />
            <DetailRow label="Course" value={selected.course_name} />
            <DetailRow label="Score" value={selected.score_achieved != null ? `${selected.score_achieved}%` : null} />
            <DetailRow label="Progress" value={selected.progress_achieved != null ? `${selected.progress_achieved}%` : null} />
            <DetailRow label="Issued" value={formatDate(selected.issued_at)} />
            <DetailRow label="Expires" value={formatDate(selected.expires_at)} />
            <DetailRow label="Revoked" value={formatDate(selected.revoked_at)} />
            {selected.revoke_reason && <div className="col-span-2"><DetailRow label="Revoke Reason" value={selected.revoke_reason} /></div>}
            {selected.certificate_url && (
              <div className="col-span-2">
                <a href={selected.certificate_url} target="_blank" rel="noopener" className="text-sm text-brand-600 hover:underline inline-flex items-center gap-1">
                  <ExternalLink className="w-4 h-4" /> View Certificate
                </a>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Issue Dialog — doc 24 fix: template → user → that user's enrollments */}
      <Dialog open={issueDialogOpen} onClose={() => setIssueDialogOpen(false)} title="Issue Certificate" size="md">
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Template *</label>
            <SearchableSelect options={templateOptions} value={issueTemplateId} onChange={v => setIssueTemplateId(String(v))} placeholder="Search templates…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Student *</label>
            <SearchableSelect options={userOptions} value={issueUserId} onChange={v => onPickUser(String(v))} placeholder="Search by name or email…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Enrollment *</label>
            {!issueUserId ? (
              <p className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg px-3 py-2.5">Pick a student first — their enrollments load here.</p>
            ) : enrollmentsLoading ? (
              <p className="text-xs text-slate-400 border border-slate-200 rounded-lg px-3 py-2.5"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Loading enrollments…</p>
            ) : enrollmentOptions.length === 0 ? (
              <p className="text-xs text-amber-600 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5">This student has no enrollments — create one on the Enrollments page first.</p>
            ) : (
              <SearchableSelect options={enrollmentOptions} value={issueEnrollmentId} onChange={v => setIssueEnrollmentId(String(v))} placeholder="Pick the enrollment…" />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleIssue} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Issue</Button>
          </div>
        </div>
      </Dialog>

      {/* Bulk Issue Dialog */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} title="Bulk Issue Certificates" size="md">
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Template *</label>
            <SearchableSelect options={templateOptions} value={bulkTemplateId} onChange={v => setBulkTemplateId(String(v))} placeholder="Search templates…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Enrollment IDs * (comma-separated)</label>
            <textarea className="w-full p-2 text-sm border rounded-lg h-24 resize-y" value={bulkEnrollmentIds} onChange={e => setBulkEnrollmentIds(e.target.value)} placeholder="1, 2, 3, 4, 5" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkIssue} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Issue All</Button>
          </div>
        </div>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={revokeDialogOpen} onClose={() => setRevokeDialogOpen(false)} title="Revoke Certificate" size="sm">
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">This will revoke certificate <strong>{selected?.certificate_number}</strong> and remove it from the student&#39;s enrollment.</p>
          <Input label="Reason (optional)" value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="e.g. Academic integrity violation" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleRevoke} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Revoke</Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">{showTrash ? 'Permanently delete? This cannot be undone.' : 'Move to trash?'}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{showTrash ? 'Delete Forever' : 'Trash'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
