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
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  RotateCcw, Loader2, MoreVertical, Trophy, Users,
} from 'lucide-react';
import { fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'name' | 'sort_order' | 'created_at';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'streak', label: 'Streak' },
  { value: 'completion', label: 'Completion' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'special', label: 'Special' },
];

const TRIGGER_TYPES = [
  { value: '', label: 'All Triggers' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'manual', label: 'Manual' },
];

const CATEGORY_COLORS: Record<string, string> = {
  streak: 'bg-orange-50 text-orange-700',
  completion: 'bg-emerald-50 text-emerald-700',
  quiz: 'bg-blue-50 text-blue-700',
  engagement: 'bg-purple-50 text-purple-700',
  special: 'bg-amber-50 text-amber-700',
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

export default function BadgesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(10);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('sort_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTrigger, setFilterTrigger] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState('completion');
  const [formTriggerType, setFormTriggerType] = useState('manual');
  const [formTriggerConfig, setFormTriggerConfig] = useState('{}');
  const [formXpReward, setFormXpReward] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formActive, setFormActive] = useState(true);
  const [iconFile, setIconFile] = useState<File | null>(null);

  const toolbarRef = useRef<DataToolbarHandle>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page, limit: pageSize, search,
        sort: sortField, order: sortOrder,
        show_deleted: showTrash ? 'true' : undefined,
        category: filterCategory || undefined,
        trigger_type: filterTrigger || undefined,
      };
      const res = await api.listBadges(params);
      if (res.success) { setRows(res.data || []); setTotal(res.pagination?.total || 0); }
    } catch { toast.error('Failed to load badges'); }
    setLoading(false);
  }, [page, pageSize, search, sortField, sortOrder, showTrash, filterCategory, filterTrigger]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  };

  const openCreate = () => {
    setDialogMode('create'); setSelected(null);
    setFormName(''); setFormDesc(''); setFormCategory('completion');
    setFormTriggerType('manual'); setFormTriggerConfig('{}');
    setFormXpReward(''); setFormSortOrder('0'); setFormActive(true); setIconFile(null);
    setDialogOpen(true);
  };

  const openEdit = (row: any) => {
    setDialogMode('edit'); setSelected(row);
    setFormName(row.name || ''); setFormDesc(row.description || '');
    setFormCategory(row.category || 'completion');
    setFormTriggerType(row.trigger_type || 'manual');
    setFormTriggerConfig(JSON.stringify(row.trigger_config || {}, null, 2));
    setFormXpReward(row.xp_reward != null ? String(row.xp_reward) : '');
    setFormSortOrder(row.sort_order != null ? String(row.sort_order) : '0');
    setFormActive(row.is_active !== false); setIconFile(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', formName);
      fd.append('description', formDesc);
      fd.append('category', formCategory);
      fd.append('trigger_type', formTriggerType);
      fd.append('trigger_config', formTriggerConfig);
      fd.append('is_active', String(formActive));
      if (formXpReward) fd.append('xp_reward', formXpReward);
      fd.append('sort_order', formSortOrder);
      if (iconFile) fd.append('icon', iconFile);

      const res = dialogMode === 'create'
        ? await api.createBadge(fd)
        : await api.updateBadge(selected.id, fd);
      if (res.success) { toast.success(dialogMode === 'create' ? 'Badge created' : 'Badge updated'); setDialogOpen(false); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = showTrash ? await api.deleteBadge(deleteId) : await api.softDeleteBadge(deleteId);
      if (res.success) { toast.success(showTrash ? 'Deleted' : 'Moved to trash'); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Delete failed'); }
    setDeleting(false); setDeleteId(null);
  };

  const handleRestore = async (id: number) => {
    try {
      const res = await api.restoreBadge(id);
      if (res.success) { toast.success('Restored'); fetchData(); }
      else toast.error(res.error || 'Failed');
    } catch { toast.error('Restore failed'); }
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Badges" description="Create and manage achievement badges for gamification" actions={
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" /> New Badge</Button>
      } />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <DataToolbar ref={toolbarRef} search={search} onSearchChange={v => { setSearch(v); setPage(1); }} searchPlaceholder="Search badges..." />
        </div>
        <select className={selectClass} value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1); }}>
          {CATEGORIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className={selectClass} value={filterTrigger} onChange={e => { setFilterTrigger(e.target.value); setPage(1); }}>
          {TRIGGER_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              <TH>ICON</TH>
              <TH className="cursor-pointer" onClick={() => toggleSort('name')}>
                <span className="inline-flex items-center gap-1">NAME <SortIcon field="name" /></span>
              </TH>
              <TH>CATEGORY</TH>
              <TH>TRIGGER</TH>
              <TH>XP</TH>
              <TH>AWARDED</TH>
              <TH>STATUS</TH>
              <TH className="cursor-pointer" onClick={() => toggleSort('sort_order')}>
                <span className="inline-flex items-center gap-1">ORDER <SortIcon field="sort_order" /></span>
              </TH>
              <TH className="w-20 text-right">ACTIONS</TH>
            </TR>
          </THead>
          <TBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TR key={i}>{Array.from({ length: 10 }).map((_, j) => <TD key={j}><Skeleton className="h-4 w-full" /></TD>)}</TR>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={10}><EmptyState icon={Trophy} title={showTrash ? 'Trash is empty' : 'No badges yet'} description={showTrash ? '' : 'Create badges to motivate students'} /></td></tr>
            ) : rows.map(row => (
              <TR key={row.id} className={row.deleted_at ? 'opacity-60' : ''}>
                <TD className="text-slate-400 text-xs">{row.id}</TD>
                <TD>
                  {row.icon_url ? (
                    <img src={row.icon_url} alt={row.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-slate-400" />
                    </div>
                  )}
                </TD>
                <TD>
                  <div className="font-medium text-slate-800">{row.name}</div>
                  {row.slug && <div className="text-xs text-slate-400">{row.slug}</div>}
                </TD>
                <TD><Badge className={CATEGORY_COLORS[row.category] || 'bg-slate-100 text-slate-600'}>{row.category}</Badge></TD>
                <TD><Badge className={row.trigger_type === 'automatic' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}>{row.trigger_type}</Badge></TD>
                <TD className="text-sm text-slate-700">{row.xp_reward || '--'}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                    <Users className="w-3.5 h-3.5" /> {row.awarded_count || 0}
                  </span>
                </TD>
                <TD>
                  {row.deleted_at ? (
                    <Badge className="bg-red-50 text-red-600">Trashed</Badge>
                  ) : row.is_active ? (
                    <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-500">Inactive</Badge>
                  )}
                </TD>
                <TD className="text-sm text-slate-500">{row.sort_order}</TD>
                <TD className="text-right">
                  <Dropdown trigger={<button className="p-1 rounded hover:bg-slate-100"><MoreVertical className="w-4 h-4 text-slate-400" /></button>}>
                    <DropdownItem icon={Eye} onClick={() => { setSelected(row); setViewDialogOpen(true); }}>View</DropdownItem>
                    {!row.deleted_at && <DropdownItem icon={Edit2} onClick={() => openEdit(row)}>Edit</DropdownItem>}
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
            ))}
          </TBody>
        </Table>
      </div>

      {total > pageSize && <Pagination page={page} totalPages={Math.ceil(total / pageSize)} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={v => { setPageSize(v); setPage(1); }} total={total} />}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={dialogMode === 'create' ? 'New Badge' : 'Edit Badge'} size="lg">
        <div className="p-6 space-y-5">
          <Input label="Badge Name *" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. 7-Day Streak Champion" />
          <Input label="Description" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Brief description of how to earn this badge" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select className={`${selectClass} w-full`} value={formCategory} onChange={e => setFormCategory(e.target.value)}>
                {CATEGORIES.filter(c => c.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trigger Type</label>
              <select className={`${selectClass} w-full`} value={formTriggerType} onChange={e => setFormTriggerType(e.target.value)}>
                {TRIGGER_TYPES.filter(t => t.value).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="XP Reward" type="number" value={formXpReward} onChange={e => setFormXpReward(e.target.value)} placeholder="e.g. 50" />
            <Input label="Sort Order" type="number" value={formSortOrder} onChange={e => setFormSortOrder(e.target.value)} placeholder="0" />
          </div>

          {formTriggerType === 'automatic' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Trigger Config (JSON)</label>
              <textarea className="w-full p-2 text-sm border rounded-lg font-mono h-24 resize-y" value={formTriggerConfig} onChange={e => setFormTriggerConfig(e.target.value)} placeholder='{"type": "streak", "days": 7}' />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Badge Icon</label>
            <input type="file" accept="image/*" className="text-sm" onChange={e => setIconFile(e.target.files?.[0] || null)} />
            {dialogMode === 'edit' && selected?.icon_url && !iconFile && (
              <img src={selected.icon_url} alt="Current icon" className="mt-2 w-12 h-12 rounded-full border" />
            )}
          </div>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} />
            <span className="text-sm text-slate-700">Active</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{dialogMode === 'create' ? 'Create' : 'Update'}</Button>
          </div>
        </div>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} title="Badge Details" size="lg">
        {selected && (
          <div className="p-6 grid grid-cols-2 gap-4">
            {selected.icon_url && (
              <div className="col-span-2 flex justify-center">
                <img src={selected.icon_url} alt={selected.name} className="w-20 h-20 rounded-full border" />
              </div>
            )}
            <DetailRow label="Name" value={selected.name} />
            <DetailRow label="Slug" value={selected.slug} />
            <DetailRow label="Category" value={selected.category} />
            <DetailRow label="Trigger Type" value={selected.trigger_type} />
            <DetailRow label="XP Reward" value={selected.xp_reward ? String(selected.xp_reward) : null} />
            <DetailRow label="Sort Order" value={String(selected.sort_order)} />
            <DetailRow label="Awarded Count" value={String(selected.awarded_count || 0)} />
            <DetailRow label="Status" value={selected.is_active ? 'Active' : 'Inactive'} />
            <DetailRow label="Created" value={formatDate(selected.created_at)} />
            <DetailRow label="Updated" value={formatDate(selected.updated_at)} />
            {selected.description && <div className="col-span-2"><DetailRow label="Description" value={selected.description} /></div>}
            {selected.trigger_config && Object.keys(selected.trigger_config).length > 0 && (
              <div className="col-span-2">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Trigger Config</dt>
                <pre className="mt-1 text-xs bg-slate-50 p-2 rounded">{JSON.stringify(selected.trigger_config, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Confirm Delete" size="sm">
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600">{showTrash ? 'Permanently delete this badge?' : 'Move badge to trash?'}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}{showTrash ? 'Delete Forever' : 'Trash'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
