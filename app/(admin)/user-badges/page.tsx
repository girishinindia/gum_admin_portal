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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { api, apiRequest } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  Loader2, Medal, Send, Users, Edit2,
} from 'lucide-react';
import { fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'earned_at' | 'created_at';

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

export default function UserBadgesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('earned_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Award form
  const [awardBadgeId, setAwardBadgeId] = useState('');
  const [awardUserId, setAwardUserId] = useState('');
  const [awardReason, setAwardReason] = useState('');

  // Bulk award form
  const [bulkBadgeId, setBulkBadgeId] = useState('');
  const [bulkUserIds, setBulkUserIds] = useState('');
  const [bulkReason, setBulkReason] = useState('');

  // Edit form (doc 24 fix — there was no way to edit an award)
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [editBadgeId, setEditBadgeId] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [editReason, setEditReason] = useState('');

  // Dropdown data (doc 24 fix — raw ID inputs → real pickers)
  const [badges, setBadges] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    api.listBadges({ limit: 200, sort: 'name', order: 'asc' }).then((r: any) => setBadges(r?.data || [])).catch(() => setBadges([]));
    api.listUsers('?limit=500&sort=first_name&order=asc').then((r: any) => setUsers(r?.data || [])).catch(() => setUsers([]));
  }, []);

  const badgeOptions = badges.map((b: any) => ({ value: String(b.id), label: `${b.name}${b.category ? ` (${b.category})` : ''}` }));
  const userOptions = users.map((u: any) => ({
    value: String(u.id),
    label: `${[u.first_name, u.last_name].filter(Boolean).join(' ') || 'User'} — ${u.email || u.mobile || `#${u.id}`}`,
  }));

  const toolbarRef = useRef<DataToolbarHandle>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page, limit: pageSize, search,
        sort: sortField, order: sortOrder,
      };
      const res = await api.listUserBadges(params);
      if (res.success) { setRows(res.data || []); setTotal(res.pagination?.total || 0); }
    } catch { toast.error('Failed to load user badges'); }
    setLoading(false);
  }, [page, pageSize, search, sortField, sortOrder]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  };

  const handleAward = async () => {
    if (!awardBadgeId || !awardUserId) { toast.error('Pick a badge and a user'); return; }
    setSaving(true);
    try {
      const res = await api.awardBadge({
        badge_id: Number(awardBadgeId),
        user_id: Number(awardUserId),
        // API stores extras in metadata (awarded_reason was silently dropped before)
        metadata: awardReason ? { reason: awardReason } : undefined,
      });
      if (res.success) { toast.success('Badge awarded'); setAwardDialogOpen(false); setAwardBadgeId(''); setAwardUserId(''); setAwardReason(''); fetchData(); }
      else toast.error(res.error || 'Failed to award badge');
    } catch { toast.error('Award failed'); }
    setSaving(false);
  };

  const handleBulkAward = async () => {
    if (!bulkBadgeId || !bulkUserIds.trim()) { toast.error('Badge ID and User IDs are required'); return; }
    const userIds = bulkUserIds.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (userIds.length === 0) { toast.error('Enter valid user IDs'); return; }
    setSaving(true);
    try {
      const res = await api.bulkAwardBadge({
        badge_id: Number(bulkBadgeId),
        user_ids: userIds,
        metadata: bulkReason ? { reason: bulkReason } : undefined,
      });
      if (res.success) {
        const d = res.data;
        toast.success(`Awarded: ${d?.awarded ?? userIds.length}, Skipped: ${d?.skipped ?? 0}`);
        setBulkDialogOpen(false); setBulkBadgeId(''); setBulkUserIds(''); setBulkReason(''); fetchData();
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Bulk award failed'); }
    setSaving(false);
  };

  const openEdit = (row: any) => {
    setEditRow(row);
    setEditBadgeId(String(row.badge_id));
    setEditUserId(String(row.user_id));
    setEditReason(row.metadata?.reason || '');
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      const res = await apiRequest<any>(`/user-badges/${editRow.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          badge_id: Number(editBadgeId),
          user_id: Number(editUserId),
          metadata: { ...(editRow.metadata || {}), reason: editReason || undefined },
        }),
      });
      if (res?.success !== false) { toast.success('Award updated'); setEditDialogOpen(false); fetchData(); }
      else toast.error(res?.error || 'Update failed');
    } catch { toast.error('Update failed'); }
    setSaving(false);
  };

  const handleRemove = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await api.removeUserBadge(deleteId);
      if (res.success) { toast.success('Badge removed from user'); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Remove failed'); }
    setDeleting(false); setDeleteId(null);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="User Badges" description="Manage badge awards and achievements for students" actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkDialogOpen(true)}>
            <Users className="w-4 h-4 mr-1.5" /> Bulk Award
          </Button>
          <Button size="sm" onClick={() => setAwardDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Award Badge
          </Button>
        </div>
      } />

      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={v => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by user, badge..."
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <THead>
            <TR>
              <TH className="w-16">ID</TH>
              <TH>BADGE</TH>
              <TH>USER</TH>
              <TH>REASON</TH>
              <TH className="cursor-pointer" onClick={() => toggleSort('earned_at')}>
                <span className="inline-flex items-center gap-1">AWARDED AT <SortIcon field="earned_at" /></span>
              </TH>
              <TH className="w-20 text-right">ACTIONS</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TR key={i}>{Array.from({ length: 6 }).map((_, j) => <TD key={j}><Skeleton className="h-4 w-full" /></TD>)}</TR>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon={Medal} title="No badge awards yet" description="Award badges to students for their achievements" />
                </td>
              </tr>
            ) : rows.map(row => (
              <TR key={row.id}>
                <TD className="text-slate-400 text-xs">{row.id}</TD>
                {/* doc 24 fix: API returns FLAT badge_name/user_name fields — the old
                    row.badge?.name / row.user?.full_name never existed, so the list
                    showed "Badge #1 / User #28" instead of names. */}
                <TD>
                  <div className="flex items-center gap-2">
                    {row.badge_icon_url ? (
                      <img src={row.badge_icon_url} alt={row.badge_name || ''} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center">
                        <Medal className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-800 text-sm">{row.badge_name || `Badge #${row.badge_id}`}</div>
                      {row.badge_category && (
                        <Badge className="bg-slate-100 text-slate-500 text-[10px]">{row.badge_category}</Badge>
                      )}
                    </div>
                  </div>
                </TD>
                <TD>
                  <div className="text-sm text-slate-800">{row.user_name || `User #${row.user_id}`}</div>
                  <div className="text-xs text-slate-400">ID {row.user_id}</div>
                </TD>
                <TD className="text-sm text-slate-600 max-w-[200px] truncate">{row.metadata?.reason || '--'}</TD>
                <TD>
                  <div className="text-sm text-slate-700">{formatDate(row.earned_at)}</div>
                  {row.earned_at && <div className="text-xs text-slate-400">{fromNow(row.earned_at)}</div>}
                </TD>
                {/* doc 24 fix: direct icon actions + Edit */}
                <TD className="text-right whitespace-nowrap">
                  <button title="View" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" onClick={() => { setSelected(row); setViewDialogOpen(true); }}><Eye className="w-4 h-4" /></button>
                  <button title="Edit" className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600" onClick={() => openEdit(row)}><Edit2 className="w-4 h-4" /></button>
                  <button title="Remove" className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500" onClick={() => setDeleteId(row.id)}><Trash2 className="w-4 h-4" /></button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {total > pageSize && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={v => { setPageSize(v); setPage(1); }} total={total} />
      )}

      {/* Award Badge Dialog */}
      <Dialog open={awardDialogOpen} onClose={() => setAwardDialogOpen(false)} title="Award Badge" size="md">
        <div className="p-6 space-y-5">
          {/* doc 24 fix: searchable pickers instead of raw IDs */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Badge *</label>
            <SearchableSelect options={badgeOptions} value={awardBadgeId} onChange={v => setAwardBadgeId(String(v))} placeholder="Search badges…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User *</label>
            <SearchableSelect options={userOptions} value={awardUserId} onChange={v => setAwardUserId(String(v))} placeholder="Search by name or email…" />
          </div>
          <Input label="Reason (optional)" value={awardReason} onChange={e => setAwardReason(e.target.value)} placeholder="e.g. Completed 7-day streak" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAwardDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAward} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              <Send className="w-4 h-4 mr-1.5" /> Award
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Bulk Award Dialog */}
      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} title="Bulk Award Badge" size="md">
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Badge *</label>
            <SearchableSelect options={badgeOptions} value={bulkBadgeId} onChange={v => setBulkBadgeId(String(v))} placeholder="Search badges…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User IDs * (comma-separated)</label>
            <textarea
              className="w-full p-2 text-sm border rounded-lg font-mono h-20 resize-y border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              value={bulkUserIds}
              onChange={e => setBulkUserIds(e.target.value)}
              placeholder="e.g. 1, 5, 12, 42"
            />
          </div>
          <Input label="Reason (optional)" value={bulkReason} onChange={e => setBulkReason(e.target.value)} placeholder="e.g. Course completion reward" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAward} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              <Users className="w-4 h-4 mr-1.5" /> Award All
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Dialog (doc 24 fix) */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} title="Edit Badge Award" size="md">
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Badge *</label>
            <SearchableSelect options={badgeOptions} value={editBadgeId} onChange={v => setEditBadgeId(String(v))} placeholder="Search badges…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User *</label>
            <SearchableSelect options={userOptions} value={editUserId} onChange={v => setEditUserId(String(v))} placeholder="Search by name or email…" />
          </div>
          <Input label="Reason" value={editReason} onChange={e => setEditReason(e.target.value)} placeholder="Why was this badge awarded?" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Save changes
            </Button>
          </div>
        </div>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} title="Badge Award Details" size="lg">
        {selected && (
          <div className="p-6 space-y-4">
            {/* Badge info */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
              {selected.badge_icon_url ? (
                <img src={selected.badge_icon_url} alt={selected.badge_name || ''} className="w-12 h-12 rounded-full border border-amber-200" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Medal className="w-6 h-6 text-amber-600" />
                </div>
              )}
              <div>
                <div className="font-semibold text-slate-800">{selected.badge_name || `Badge #${selected.badge_id}`}</div>
                {selected.badge_category && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">{selected.badge_category}</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Award ID" value={String(selected.id)} />
              <DetailRow label="Badge" value={selected.badge_name || `#${selected.badge_id}`} />
              <DetailRow label="User" value={selected.user_name || `#${selected.user_id}`} />
              <DetailRow label="User ID" value={String(selected.user_id)} />
              <DetailRow label="Awarded At" value={formatDate(selected.earned_at)} />
              <DetailRow label="Created" value={formatDate(selected.created_at)} />
            </div>
            {selected.metadata?.reason && (
              <DetailRow label="Reason" value={selected.metadata.reason} />
            )}
          </div>
        )}
      </Dialog>

      {/* Remove Confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Badge" size="sm">
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">Remove this badge from the user? This will also deduct XP if applicable.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleRemove} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Remove
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
