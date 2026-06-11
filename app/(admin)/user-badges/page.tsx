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
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  Loader2, MoreVertical, Medal, Send, Users,
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
    if (!awardBadgeId || !awardUserId) { toast.error('Badge ID and User ID are required'); return; }
    setSaving(true);
    try {
      const res = await api.awardBadge({
        badge_id: Number(awardBadgeId),
        user_id: Number(awardUserId),
        awarded_reason: awardReason || undefined,
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
        awarded_reason: bulkReason || undefined,
      });
      if (res.success) {
        const d = res.data;
        toast.success(`Awarded: ${d?.awarded ?? userIds.length}, Skipped: ${d?.skipped ?? 0}`);
        setBulkDialogOpen(false); setBulkBadgeId(''); setBulkUserIds(''); setBulkReason(''); fetchData();
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Bulk award failed'); }
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
                <TD>
                  <div className="flex items-center gap-2">
                    {row.badge?.icon_url ? (
                      <img src={row.badge.icon_url} alt={row.badge?.name} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center">
                        <Medal className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-800 text-sm">{row.badge?.name || `Badge #${row.badge_id}`}</div>
                      {row.badge?.category && (
                        <Badge className="bg-slate-100 text-slate-500 text-[10px]">{row.badge.category}</Badge>
                      )}
                    </div>
                  </div>
                </TD>
                <TD>
                  <div className="text-sm text-slate-800">{row.user?.full_name || row.user?.email || `User #${row.user_id}`}</div>
                  {row.user?.email && row.user?.full_name && (
                    <div className="text-xs text-slate-400">{row.user.email}</div>
                  )}
                </TD>
                <TD className="text-sm text-slate-600 max-w-[200px] truncate">{row.awarded_reason || '--'}</TD>
                <TD>
                  <div className="text-sm text-slate-700">{formatDate(row.earned_at)}</div>
                  {row.earned_at && <div className="text-xs text-slate-400">{fromNow(row.earned_at)}</div>}
                </TD>
                <TD className="text-right">
                  <Dropdown trigger={<button className="p-1 rounded hover:bg-slate-100"><MoreVertical className="w-4 h-4 text-slate-400" /></button>}>
                    <DropdownItem icon={Eye} onClick={() => { setSelected(row); setViewDialogOpen(true); }}>View</DropdownItem>
                    <DropdownDivider />
                    <DropdownItem icon={Trash2} danger onClick={() => setDeleteId(row.id)}>Remove</DropdownItem>
                  </Dropdown>
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
          <Input label="Badge ID *" type="number" value={awardBadgeId} onChange={e => setAwardBadgeId(e.target.value)} placeholder="e.g. 1" />
          <Input label="User ID *" type="number" value={awardUserId} onChange={e => setAwardUserId(e.target.value)} placeholder="e.g. 42" />
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
          <Input label="Badge ID *" type="number" value={bulkBadgeId} onChange={e => setBulkBadgeId(e.target.value)} placeholder="e.g. 1" />
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

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} title="Badge Award Details" size="lg">
        {selected && (
          <div className="p-6 space-y-4">
            {/* Badge info */}
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
              {selected.badge?.icon_url ? (
                <img src={selected.badge.icon_url} alt={selected.badge?.name} className="w-12 h-12 rounded-full border border-amber-200" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Medal className="w-6 h-6 text-amber-600" />
                </div>
              )}
              <div>
                <div className="font-semibold text-slate-800">{selected.badge?.name || `Badge #${selected.badge_id}`}</div>
                {selected.badge?.category && (
                  <Badge className="bg-amber-100 text-amber-700 text-xs">{selected.badge.category}</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Award ID" value={String(selected.id)} />
              <DetailRow label="Badge ID" value={String(selected.badge_id)} />
              <DetailRow label="User ID" value={String(selected.user_id)} />
              <DetailRow label="User Name" value={selected.user?.full_name || selected.user?.email} />
              <DetailRow label="XP Earned" value={selected.badge?.xp_reward ? String(selected.badge.xp_reward) : null} />
              <DetailRow label="Awarded At" value={formatDate(selected.earned_at)} />
              <DetailRow label="Awarded By" value={selected.awarded_by ? String(selected.awarded_by) : 'System'} />
              <DetailRow label="Created" value={formatDate(selected.created_at)} />
            </div>
            {selected.awarded_reason && (
              <DetailRow label="Reason" value={selected.awarded_reason} />
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
