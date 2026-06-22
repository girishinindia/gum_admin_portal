"use client";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Users, Trash2, Edit2, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, X, Loader2 } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

interface TeamMember {
  id: number;
  name: string;
  role: string | null;
  bio: string | null;
  image_url: string | null;
  section: 'leadership' | 'team';
  linkedin_url: string | null;
  twitter_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  display_order: number;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
}

const SECTIONS = [
  { value: 'leadership', label: 'Leadership' },
  { value: 'team', label: 'Mentors & Operations' },
];

type SortField = 'id' | 'name' | 'section' | 'display_order' | 'is_active';

export default function TeamMembersPage() {
  const [items, setItems] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [saving, setSaving] = useState(false);

  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTrash, setShowTrash] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, filterSection, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterSection, filterStatus, sortField, sortOrder, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page)); qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField); qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterSection) qs.set('section', filterSection);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listTeamMembers('?' + qs.toString());
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    setLoading(false);
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ name: '', role: '', section: 'team', bio: '', display_order: 0, linkedin_url: '', twitter_url: '', instagram_url: '', facebook_url: '' });
    setDialogOpen(true);
  }

  function openEdit(m: TeamMember) {
    setEditing(m); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({
      name: m.name, role: m.role || '', section: m.section || 'team', bio: m.bio || '',
      display_order: m.display_order ?? 0,
      linkedin_url: m.linkedin_url || '', twitter_url: m.twitter_url || '',
      instagram_url: m.instagram_url || '', facebook_url: m.facebook_url || '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    setSaving(true);
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) fd.append('image', imageFile, imageFile.name);
    else if (imagePreview === '__removed__') fd.append('image', '');

    const res = editing
      ? await api.updateTeamMember(editing.id, fd, true)
      : await api.createTeamMember(fd, true);
    setSaving(false);
    if (res.success) { toast.success(editing ? 'Team member updated' : 'Team member created'); setDialogOpen(false); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(m: TeamMember) {
    const fd = new FormData();
    fd.append('is_active', String(!m.is_active));
    const res = await api.updateTeamMember(m.id, fd, true);
    if (res.success) { toast.success(!m.is_active ? 'Activated' : 'Deactivated'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(m: TeamMember) {
    if (!confirm(`Move "${m.name}" to trash? You can restore it later.`)) return;
    setActionLoadingId(m.id);
    const res = await api.deleteTeamMember(m.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Moved to trash'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onRestore(m: TeamMember) {
    setActionLoadingId(m.id);
    const res = await api.restoreTeamMember(m.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${m.name}" restored`); load(); } else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(m: TeamMember) {
    if (!confirm(`PERMANENTLY delete "${m.name}"? This cannot be undone.`)) return;
    setActionLoadingId(m.id);
    const res = await api.permanentDeleteTeamMember(m.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Permanently deleted'); load(); } else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Team Members"
        description="Manage the people shown on the public Our Team page"
        actions={!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add member</Button>}
      />

      {/* Trash toggle tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Team Members</button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}><Trash2 className="w-3.5 h-3.5" /> Trash</button>
      </div>

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name or role...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              <option value="">All Sections</option>
              {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Users}
          title={showTrash ? 'Trash is empty' : 'No team members yet'}
          description={showTrash ? 'No deleted members' : (searchDebounce || filterSection || filterStatus ? 'No members match your filters' : 'Add your first team member')}
          action={!showTrash && !searchDebounce && !filterSection && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add member</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="w-12">Photo</TH>
                <TH><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">Name <SortIcon field="name" /></button></TH>
                <TH>Role</TH>
                <TH><button onClick={() => handleSort('section')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">Section <SortIcon field="section" /></button></TH>
                <TH className="w-20"><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">Order <SortIcon field="display_order" /></button></TH>
                {showTrash ? <TH>Deleted</TH> : <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 cursor-pointer">Status <SortIcon field="is_active" /></button></TH>}
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(m => (
                <TR key={m.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined)}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{m.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                      {m.image_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={m.image_url} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">{(m.name || '?').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </TD>
                  <TD className="py-2.5"><span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{m.name}</span></TD>
                  <TD className="py-2.5"><span className="text-slate-600 text-sm line-clamp-1">{m.role || '—'}</span></TD>
                  <TD className="py-2.5"><Badge variant={m.section === 'leadership' ? 'info' : 'muted'}>{SECTIONS.find(s => s.value === m.section)?.label || m.section}</Badge></TD>
                  <TD className="py-2.5"><span className="text-slate-600 text-sm">{m.display_order}</span></TD>
                  {showTrash ? (
                    <TD className="py-2.5"><span className="text-xs text-amber-600">{m.deleted_at ? fromNow(m.deleted_at) : '—'}</span></TD>
                  ) : (
                    <TD className="py-2.5"><Badge variant={m.is_active ? 'success' : 'danger'}>{m.is_active ? 'Active' : 'Inactive'}</Badge></TD>
                  )}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(m)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50" title="Restore">{actionLoadingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                          <button onClick={() => onPermanentDelete(m)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete permanently">{actionLoadingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openEdit(m)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(m)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50" title="Move to Trash">{actionLoadingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Team Member' : 'Add Team Member'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">{editing.is_active ? 'Shown on the website' : 'Hidden from the website'}</p>
              </div>
              <button type="button" onClick={async () => { await onToggleActive(editing); const r = await api.getTeamMember(editing.id); if (r.success && r.data) setEditing(r.data); }}
                className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer', editing.is_active ? 'bg-emerald-500' : 'bg-slate-300')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}

          <ImageUpload key={dialogKey} label="Photo" hint="Square photo, resized to 600x600px WebP"
            value={editing?.image_url || undefined} aspectRatio={1} maxWidth={800} maxHeight={800} shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(file ? preview : '__removed__'); }} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="Full name" error={errors.name ? 'Name is required' : undefined} {...register('name', { required: true })} />
            <Input label="Role" placeholder="e.g. App & Web Development" {...register('role')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('section', { required: true })}>
                {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <Input label="Display Order" type="number" placeholder="0" {...register('display_order')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bio</label>
            <textarea rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Short description shown on the card" {...register('bio')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="LinkedIn URL" placeholder="https://linkedin.com/in/..." {...register('linkedin_url')} />
            <Input label="Twitter / X URL" placeholder="https://x.com/..." {...register('twitter_url')} />
            <Input label="Instagram URL" placeholder="https://instagram.com/..." {...register('instagram_url')} />
            <Input label="Facebook URL" placeholder="https://facebook.com/..." {...register('facebook_url')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? 'Save changes' : 'Create')}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
