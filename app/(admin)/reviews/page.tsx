'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  Loader2, MoreVertical, Star, RefreshCw, RotateCcw,
  ThumbsUp, Flag, EyeOff, CheckCircle, Clock,
  ShieldCheck, ShieldOff,
} from 'lucide-react';
import { fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'rating' | 'created_at' | 'helpful_count';

const ITEM_TYPES = ['course', 'batch', 'webinar', 'bundle', 'instructor', 'blog', 'live_session', 'podcast'] as const;
const TYPE_LABELS: Record<string, string> = {
  course: 'Course', batch: 'Batch', webinar: 'Webinar', bundle: 'Bundle',
  instructor: 'Instructor', blog: 'Blog', live_session: 'Live Session', podcast: 'Podcast',
};
const STATUSES = ['pending', 'published', 'flagged', 'hidden'] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow',
  published: 'green',
  flagged: 'red',
  hidden: 'slate',
};

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  published: CheckCircle,
  flagged: Flag,
  hidden: EyeOff,
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 whitespace-pre-wrap">{value || '--'}</dd>
    </div>
  );
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${s} ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`} />
      ))}
    </span>
  );
}

function formatDate(d: string | null) {
  if (!d) return '--';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReviewsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [trashed, setTrashed] = useState(false);

  // Stats
  const [stats, setStats] = useState<any>(null);

  // Dialogs
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Create form
  const [formUserId, setFormUserId] = useState('');
  const [formItemType, setFormItemType] = useState('course');
  const [formItemId, setFormItemId] = useState('');
  const [formRating, setFormRating] = useState('5');
  const [formTitle, setFormTitle] = useState('');
  const [formReviewText, setFormReviewText] = useState('');
  const [formStatus, setFormStatus] = useState('published');

  // BUG-64: multi-select + bulk actions (pattern from support-tickets/page.tsx)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page, limit: pageSize, search, sort: sortField,
        ascending: sortOrder === 'asc',
        trashed,
      };
      if (filterType) params.item_type = filterType;
      if (filterStatus) params.status = filterStatus;
      if (filterRating) params.rating = filterRating;

      const res = await api.listReviews(params);
      if (res.success) {
        setRows(res.data);
        setTotal(res.pagination?.total || 0);
      }
    } catch { toast.error('Failed to load reviews'); }
    setLoading(false);
  }, [page, pageSize, search, sortField, sortOrder, filterType, filterStatus, filterRating, trashed]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.getReviewStats({});
      if (res.success) setStats(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchData(); setSelectedIds(new Set()); }, [fetchData]); // BUG-64: clear selection on reload
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
    setPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />;
  };

  const handleCreate = async () => {
    if (!formUserId || !formItemId || !formRating) { toast.error('Fill required fields'); return; }
    setSaving(true);
    try {
      const res = await api.createReview({
        user_id: parseInt(formUserId), item_type: formItemType,
        item_id: parseInt(formItemId), rating: parseInt(formRating),
        title: formTitle || null, review_text: formReviewText || null,
        status: formStatus,
      });
      if (res.success) {
        toast.success('Review created');
        setCreateDialogOpen(false);
        resetForm();
        fetchData();
        fetchStats();
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed to create review'); }
    setSaving(false);
  };

  const resetForm = () => {
    setFormUserId(''); setFormItemType('course'); setFormItemId('');
    setFormRating('5'); setFormTitle(''); setFormReviewText(''); setFormStatus('published');
  };

  const handleChangeStatus = async () => {
    if (!statusTarget || !newStatus) return;
    setSaving(true);
    try {
      const res = await api.changeReviewStatus(statusTarget.id, newStatus);
      if (res.success) {
        toast.success(`Status changed to ${newStatus}`);
        setStatusDialogOpen(false);
        fetchData(); fetchStats();
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed to change status'); }
    setSaving(false);
  };

  // Toggle the verified-purchase flag on a review, then refresh the list.
  const handleToggleVerified = async (row: any) => {
    try {
      const res = await api.updateReview(row.id, { is_verified_purchase: !row.is_verified_purchase });
      if (res.success) {
        toast.success(row.is_verified_purchase ? 'Marked as not verified' : 'Marked as verified');
        fetchData();
      } else toast.error(res.error || 'Failed');
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
  };

  const handleSoftDelete = async (id: number) => {
    setDeleting(true);
    try {
      const res = await api.softDeleteReview(id);
      if (res.success) { toast.success('Review moved to trash'); fetchData(); fetchStats(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
    setDeleting(false);
  };

  const handleRestore = async (id: number) => {
    try {
      const res = await api.restoreReview(id);
      if (res.success) { toast.success('Review restored'); fetchData(); fetchStats(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
  };

  const handlePermanentDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await api.deleteReview(deleteId);
      if (res.success) {
        toast.success('Review permanently deleted');
        setDeleteId(null);
        fetchData(); fetchStats();
      } else toast.error(res.error || 'Failed');
    } catch { toast.error('Failed'); }
    setDeleting(false);
  };

  const handleView = async (id: number) => {
    try {
      const res = await api.getReview(id);
      if (res.success) { setSelected(res.data); setViewDialogOpen(true); }
    } catch { toast.error('Failed to load review'); }
  };

  // BUG-64: multi-select helpers + bulk actions that loop the existing single-item calls
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
  };
  const handleBulkSoftDelete = async () => {
    if (!confirm(`Move ${selectedIds.size} review(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { try { const r = await api.softDeleteReview(ids[i]); if (r.success) ok++; } catch {} setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} review(s) moved to trash`);
    setSelectedIds(new Set()); fetchData(); fetchStats(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  };
  const handleBulkRestore = async () => {
    if (!confirm(`Restore ${selectedIds.size} review(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { try { const r = await api.restoreReview(ids[i]); if (r.success) ok++; } catch {} setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} review(s) restored`);
    setSelectedIds(new Set()); fetchData(); fetchStats(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  };
  const handleBulkPermanentDelete = async () => {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} review(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { try { const r = await api.deleteReview(ids[i]); if (r.success) ok++; } catch {} setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} review(s) permanently deleted`);
    setSelectedIds(new Set()); fetchData(); fetchStats(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reviews & Ratings"
        description={`${total} review${total !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
                           variant={trashed ? 'primary' : 'outline'}
              onClick={() => { setTrashed(!trashed); setPage(1); }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {trashed ? 'Show Active' : 'Trash'}
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Review
            </Button>
          </div>
        }
      />

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-xs text-slate-500">Total</div>
          </div>
          <div className="bg-white border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.average_rating}</div>
            <div className="text-xs text-slate-500">Avg Rating</div>
          </div>
          {[5, 4, 3, 2, 1].map(r => (
            <div key={r} className="bg-white border rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-slate-700">{stats.by_rating?.[r] || 0}</div>
              <div className="text-xs text-slate-500">{r} Star{r > 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      )}

      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={(v: string) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by title or review text..."
      >
        <select
          className="text-sm border rounded-md px-2 py-1.5 bg-white"
          value={filterType}
          onChange={e => { setFilterType(e.target.value); setPage(1); }}
        >
          <option value="">All Types</option>
          {ITEM_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <select
          className="text-sm border rounded-md px-2 py-1.5 bg-white"
          value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select
          className="text-sm border rounded-md px-2 py-1.5 bg-white"
          value={filterRating}
          onChange={e => { setFilterRating(e.target.value); setPage(1); }}
        >
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
        </select>
      </DataToolbar>

      <div className="bg-white border rounded-lg overflow-hidden">
        {/* BUG-64: bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
            <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
            <div className="flex items-center gap-2">
              {trashed ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected</Button>
                  <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently</Button>
                </>
              ) : (
                <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-10"><input type="checkbox" checked={rows.length > 0 && selectedIds.size === rows.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="cursor-pointer" onClick={() => handleSort('id')}>
                  <span className="inline-flex items-center gap-1">ID <SortIcon field="id" /></span>
                </TH>
                <TH>User</TH>
                <TH>Type</TH>
                <TH>Item</TH>
                <TH className="cursor-pointer" onClick={() => handleSort('rating')}>
                  <span className="inline-flex items-center gap-1">Rating <SortIcon field="rating" /></span>
                </TH>
                <TH>Title</TH>
                <TH>Status</TH>
                <TH className="cursor-pointer" onClick={() => handleSort('helpful_count')}>
                  <span className="inline-flex items-center gap-1">Helpful <SortIcon field="helpful_count" /></span>
                </TH>
                <TH>Verified</TH>
                <TH className="cursor-pointer" onClick={() => handleSort('created_at')}>
                  <span className="inline-flex items-center gap-1">Created <SortIcon field="created_at" /></span>
                </TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TR key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <TD key={j}><Skeleton className="h-4 w-full" /></TD>
                    ))}
                  </TR>
                ))
              ) : rows.length === 0 ? (
                <TR>
                  <td colSpan={12}>
                    <EmptyState icon={Star} title="No reviews found" description={trashed ? 'Trash is empty' : 'No reviews match your filters'} />
                  </td>
                </TR>
              ) : (
                rows.map(row => {
                  const StIcon = STATUS_ICONS[row.status] || Clock;
                  return (
                    <TR key={row.id} className={selectedIds.has(row.id) ? 'bg-brand-50/40' : undefined}>
                      {/* BUG-64: row select checkbox */}
                      <TD><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                      <TD className="font-mono text-xs">{row.id}</TD>
                      <TD className="max-w-[120px] truncate text-sm">{row.user_name || `User #${row.user_id}`}</TD>
                      <TD>
                        <Badge color="blue">{row.item_type}</Badge>
                      </TD>
                      <TD className="max-w-[150px] truncate text-sm">{row.item_name || `#${row.item_id}`}</TD>
                      <TD><StarRating rating={row.rating} /></TD>
                      <TD className="max-w-[150px] truncate text-sm">{row.title || '--'}</TD>
                      <TD>
                        <Badge color={STATUS_COLORS[row.status] || 'slate'}>
                          <StIcon className="w-3 h-3 mr-1" />
                          {row.status}
                        </Badge>
                      </TD>
                      <TD className="text-center">
                        <span className={`inline-flex items-center gap-1 text-xs ${row.helpful_count > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          <ThumbsUp className="w-3 h-3" /> {row.helpful_count || 0}
                        </span>
                      </TD>
                      <TD>
                        {row.is_verified_purchase ? (
                          <Badge color="green">Verified</Badge>
                        ) : (
                          <span className="text-xs text-slate-400">Not verified</span>
                        )}
                      </TD>
                      <TD className="text-xs text-slate-500">{fromNow(row.created_at)}</TD>
                      <TD>
                        <div className="flex items-center gap-1">
                          {/* BUG-64: inline quick actions */}
                          <button onClick={() => handleView(row.id)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          {!trashed ? (
                            <button onClick={() => handleSoftDelete(row.id)} disabled={deleting} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash"><Trash2 className="w-3.5 h-3.5" /></button>
                          ) : (
                            <>
                              <button onClick={() => handleRestore(row.id)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore"><RotateCcw className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setDeleteId(row.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete permanently"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                          <Dropdown trigger={<span className="p-1 hover:bg-slate-100 rounded inline-flex items-center"><MoreVertical className="w-4 h-4" /></span>}>
                          <DropdownItem onClick={() => handleView(row.id)}>
                            <Eye className="w-4 h-4 mr-2" /> View
                          </DropdownItem>
                          {!trashed && (
                            <>
                              <DropdownDivider />
                              <DropdownItem onClick={() => handleToggleVerified(row)}>
                                {row.is_verified_purchase
                                  ? <><ShieldOff className="w-4 h-4 mr-2" /> Mark Not Verified</>
                                  : <><ShieldCheck className="w-4 h-4 mr-2" /> Mark Verified</>}
                              </DropdownItem>
                              <DropdownDivider />
                              {STATUSES.filter(s => s !== row.status).map(s => (
                                <DropdownItem key={s} onClick={() => {
                                  setStatusTarget(row); setNewStatus(s); setStatusDialogOpen(true);
                                }}>
                                  {React.createElement(STATUS_ICONS[s] || Clock, { className: 'w-4 h-4 mr-2' })}
                                  Set {s}
                                </DropdownItem>
                              ))}
                              <DropdownDivider />
                              <DropdownItem onClick={() => handleSoftDelete(row.id)} danger>
                                <Trash2 className="w-4 h-4 mr-2" /> Move to Trash
                              </DropdownItem>
                            </>
                          )}
                          {trashed && (
                            <>
                              <DropdownItem onClick={() => handleRestore(row.id)}>
                                <RotateCcw className="w-4 h-4 mr-2" /> Restore
                              </DropdownItem>
                              <DropdownDivider />
                              <DropdownItem onClick={() => setDeleteId(row.id)} danger>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete Permanently
                              </DropdownItem>
                            </>
                          )}
                          </Dropdown>
                        </div>
                      </TD>
                    </TR>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* ── View Dialog ── */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} title="Review Details" size="lg">
        {selected && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <StarRating rating={selected.rating} size="md" />
              <span className="text-lg font-semibold">{selected.rating}/5</span>
              <Badge color={STATUS_COLORS[selected.status] || 'slate'}>{selected.status}</Badge>
              {selected.is_verified_purchase && <Badge color="green">Verified Purchase</Badge>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="ID" value={String(selected.id)} />
              <DetailRow label="User" value={selected.user_name || `User #${selected.user_id}`} />
              <DetailRow label="Item Type" value={selected.item_type} />
              <DetailRow label="Item" value={selected.item_name || `#${selected.item_id}`} />
              <DetailRow label="Title" value={selected.title} />
              <DetailRow label="Helpful Count" value={String(selected.helpful_count)} />
              <DetailRow label="Reported Count" value={String(selected.reported_count)} />
              <DetailRow label="Created" value={formatDate(selected.created_at)} />
            </div>
            {selected.review_text && (
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Review Text</dt>
                <dd className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">{selected.review_text}</dd>
              </div>
            )}
            {selected.admin_notes && (
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Admin Notes</dt>
                <dd className="text-sm text-slate-600 bg-amber-50 p-3 rounded-lg whitespace-pre-wrap">{selected.admin_notes}</dd>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* ── Create Dialog ── */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} title="Create Review" size="md">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">User *</label>
              <SearchSelect
                key={`user-${createDialogOpen}`}
                placeholder="Search user by name or email…"
                loadOptions={(s) => api.reviewUserOptions(s).then((r: any) => r.data || [])}
                onChange={(id) => setFormUserId(id === '' ? '' : String(id))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Item Type *</label>
              <select className="w-full text-sm border rounded-md px-3 py-2" value={formItemType} onChange={e => { setFormItemType(e.target.value); setFormItemId(''); }}>
                {ITEM_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rating *</label>
              <select className="w-full text-sm border rounded-md px-3 py-2" value={formRating} onChange={e => setFormRating(e.target.value)}>
                {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} Star{r > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Item *</label>
              <SearchSelect
                key={`item-${createDialogOpen}-${formItemType}`}
                placeholder={`Search ${TYPE_LABELS[formItemType]} by name…`}
                loadOptions={(s) => api.reviewItemOptions(formItemType, s).then((r: any) => r.data || [])}
                onChange={(id) => setFormItemId(id === '' ? '' : String(id))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Review title (optional)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Review Text</label>
            <textarea
              className="w-full text-sm border rounded-md px-3 py-2 min-h-[100px]"
              value={formReviewText}
              onChange={e => setFormReviewText(e.target.value)}
              placeholder="Write the review..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select className="w-full text-sm border rounded-md px-3 py-2" value={formStatus} onChange={e => setFormStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Create
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Status Change Dialog ── */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} title="Change Review Status" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Change review #{statusTarget?.id} status from <Badge color={STATUS_COLORS[statusTarget?.status]}>{statusTarget?.status}</Badge> to <Badge color={STATUS_COLORS[newStatus]}>{newStatus}</Badge>?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeStatus} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirm
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Permanent Delete Confirm ── */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Permanently Delete Review" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">This will permanently delete review #{deleteId} and all helpfulness votes. This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handlePermanentDelete} disabled={deleting}>
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Delete Forever
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
