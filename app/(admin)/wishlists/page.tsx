'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/Button';
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
import { Trash2, Eye, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, Loader2, MoreVertical, Heart } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'created_at' | 'item_type';

const ITEM_TYPE_OPTIONS = [
  { value: '', label: 'All Item Types' },
  { value: 'course', label: 'Course' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'batch', label: 'Batch' },
  { value: 'webinar', label: 'Webinar' },
];
const ITEM_TYPE_COLORS: Record<string, string> = {
  course: 'bg-emerald-50 text-emerald-700',
  bundle: 'bg-violet-50 text-violet-700',
  batch: 'bg-amber-50 text-amber-700',
  webinar: 'bg-rose-50 text-rose-700',
};
const selectClass = 'h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 cursor-pointer';

function capitalize(s?: string) { return s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '--'; }

export default function WishlistsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [trashCount, setTrashCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [sort, setSort] = useState<SortField>('created_at');
  const [asc, setAsc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [search, setSearch] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('');
  const toolbarRef = useRef<DataToolbarHandle>(null);
  const [viewOpen, setViewOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [viewItem, setViewItem] = useState<any>(null);
  const [actionLoaders, setActionLoaders] = useState<Record<number, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let qs = `?page=${page}&limit=${pageSize}&sort=${sort}&ascending=${asc}`;
      if (showTrash) qs += '&show_deleted=true';
      if (search) qs += `&search=${encodeURIComponent(search)}`;
      if (itemTypeFilter) qs += `&item_type=${itemTypeFilter}`;
      const res = await api.listWishlists(qs);
      setData(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch { toast.error('Failed to load wishlists'); }
    setLoading(false);
  }, [page, pageSize, sort, asc, showTrash, search, itemTypeFilter]);

  const fetchTrashCount = useCallback(async () => {
    try { const res = await api.listWishlists('?show_deleted=true&limit=1'); setTrashCount(res.pagination?.total || 0); } catch { /* */ }
  }, []);

  useEffect(() => { fetchData(); fetchTrashCount(); }, [fetchData, fetchTrashCount]);

  function toggleSort(field: SortField) { if (sort === field) setAsc(!asc); else { setSort(field); setAsc(true); } }
  function SortIcon({ field }: { field: SortField }) {
    if (sort !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return asc ? <ArrowUp className="w-3.5 h-3.5 text-brand-500" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-500" />;
  }

  async function handleSoftDelete(id: number) {
    setActionLoaders((p) => ({ ...p, [id]: 'x' }));
    try { await api.softDeleteWishlist(id); toast.success('Removed'); fetchData(); fetchTrashCount(); } catch { toast.error('Failed'); }
    setActionLoaders((p) => { const n = { ...p }; delete n[id]; return n; });
  }
  async function handleRestore(id: number) {
    setActionLoaders((p) => ({ ...p, [id]: 'x' }));
    try { await api.restoreWishlist(id); toast.success('Restored'); fetchData(); fetchTrashCount(); } catch { toast.error('Failed'); }
    setActionLoaders((p) => { const n = { ...p }; delete n[id]; return n; });
  }
  async function handlePermanentDelete(id: number) {
    if (!confirm('Permanently delete this wishlist item?')) return;
    setActionLoaders((p) => ({ ...p, [id]: 'x' }));
    try { await api.deleteWishlist(id); toast.success('Deleted'); fetchData(); fetchTrashCount(); } catch { toast.error('Failed'); }
    setActionLoaders((p) => { const n = { ...p }; delete n[id]; return n; });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Wishlists" />

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={(v: string) => { setSearch(v); setPage(1); }} searchPlaceholder="Search wishlists...">
        <div className="flex items-center gap-2">
          <select className={selectClass} value={itemTypeFilter} onChange={(e) => { setItemTypeFilter(e.target.value); setPage(1); }}>
            {ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button variant={showTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setShowTrash(!showTrash); setPage(1); }}>
            <Trash2 className="w-4 h-4" /> Trash
            {trashCount > 0 && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{trashCount}</span>}
          </Button>
        </div>
      </DataToolbar>

      {loading ? (
        <div className="space-y-3 mt-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={Heart} title={showTrash ? 'Trash is empty' : 'No wishlist items'} description={showTrash ? 'No removed items' : 'Users have not saved anything yet'} />
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="w-12 cursor-pointer" onClick={() => toggleSort('id')}><div className="flex items-center gap-1">ID <SortIcon field="id" /></div></TH>
                <TH>USER</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('item_type')}><div className="flex items-center gap-1">ITEM TYPE <SortIcon field="item_type" /></div></TH>
                <TH>ITEM</TH>
                <TH>NOTES</TH>
                <TH className="cursor-pointer" onClick={() => toggleSort('created_at')}><div className="flex items-center gap-1">SAVED <SortIcon field="created_at" /></div></TH>
                <TH className="text-right">ACTIONS</TH>
              </TR>
            </THead>
            <TBody>
              {data.map((item) => (
                <TR key={item.id}>
                  <TD className="text-slate-400 text-xs font-mono">{item.id}</TD>
                  <TD>
                    <div className="text-sm font-medium text-slate-900">{item.users?.full_name || item.users?.email || `User #${item.user_id}`}</div>
                    {item.users?.email && item.users?.full_name && <div className="text-xs text-slate-400">{item.users.email}</div>}
                  </TD>
                  <TD><span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', ITEM_TYPE_COLORS[item.item_type] || 'bg-slate-100 text-slate-600')}>{capitalize(item.item_type)}</span></TD>
                  <TD>
                    <div className="text-sm text-slate-700 truncate max-w-[220px]">{item.item?.title || `#${item.item_id}`}</div>
                    <div className="text-xs text-slate-400 font-mono">id {item.item_id}</div>
                  </TD>
                  <TD><span className="text-sm text-slate-500 truncate max-w-[160px] inline-block">{item.notes || '--'}</span></TD>
                  <TD><span className="text-sm text-slate-600">{item.created_at ? fromNow(item.created_at) : '--'}</span></TD>
                  <TD className="text-right">
                    {actionLoaders[item.id] ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400 ml-auto" />
                    ) : showTrash ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleRestore(item.id)}><RotateCcw className="w-4 h-4" /> Restore</Button>
                        <Button variant="danger" size="sm" onClick={() => handlePermanentDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ) : (
                      <Dropdown trigger={<MoreVertical className="w-4 h-4 text-slate-500 hover:text-slate-700" />} align="right" width="w-44">
                        <DropdownItem icon={Eye} onClick={() => { setViewItem(item); setViewOpen(true); }}>View</DropdownItem>
                        <DropdownDivider />
                        <DropdownItem icon={Trash2} danger onClick={() => handleSoftDelete(item.id)}>Remove</DropdownItem>
                      </Dropdown>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {total > pageSize && (
        <div className="mt-4">
          <Pagination page={page} totalPages={Math.ceil(total / pageSize)} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(s: number) => { setPageSize(s); setPage(1); }} />
        </div>
      )}

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="Wishlist Item" size="md">
        {viewItem && (
          <div className="p-6 space-y-3 text-sm">
            <div className="flex items-center gap-2"><Heart className="w-5 h-5 text-rose-500" /><span className="text-lg font-semibold text-slate-900">Wishlist #{viewItem.id}</span></div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 pt-2">
              <div><dt className="text-xs uppercase tracking-wider text-slate-400">User</dt><dd className="mt-0.5 text-slate-800">{viewItem.users?.full_name || viewItem.users?.email || `#${viewItem.user_id}`}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-slate-400">Item type</dt><dd className="mt-0.5 text-slate-800">{capitalize(viewItem.item_type)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-slate-400">Item</dt><dd className="mt-0.5 text-slate-800">{viewItem.item?.title || `#${viewItem.item_id}`}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-slate-400">Saved</dt><dd className="mt-0.5 text-slate-800">{viewItem.created_at ? fromNow(viewItem.created_at) : '--'}</dd></div>
              <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-slate-400">Notes</dt><dd className="mt-0.5 text-slate-800">{viewItem.notes || '--'}</dd></div>
            </dl>
          </div>
        )}
      </Dialog>
    </div>
  );
}
