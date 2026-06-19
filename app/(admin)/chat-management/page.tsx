"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
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
import { ImageUpload } from '@/components/ui/ImageUpload';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  MessageSquare, Plus, Edit2, Trash2, Eye, RotateCcw, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, Hash, Users, Globe, Lock, Link,
  Smile, Sparkles, Zap, Image, Copy, ExternalLink, RefreshCw,
  Pin, PinOff, Volume2, VolumeX, UserMinus
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

const selectClass = 'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none';

type MainTab = 'rooms' | 'sticker_categories' | 'stickers' | 'emoji_categories' | 'custom_emojis' | 'quick_replies' | 'invites';

const tabs: { key: MainTab; label: string; icon: any }[] = [
  { key: 'rooms', label: 'Chat Rooms', icon: MessageSquare },
  { key: 'sticker_categories', label: 'Sticker Categories', icon: Sparkles },
  { key: 'stickers', label: 'Stickers', icon: Image },
  { key: 'emoji_categories', label: 'Emoji Categories', icon: Smile },
  { key: 'custom_emojis', label: 'Custom Emojis', icon: Smile },
  { key: 'quick_replies', label: 'Quick Replies', icon: Zap },
  { key: 'invites', label: 'Invites', icon: Link },
];

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value ?? <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

// ══════════════════════════════════════════════
// CHAT ROOMS TAB
// ══════════════════════════════════════════════
function ChatRoomsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [membersFor, setMembersFor] = useState<any | null>(null);
  const [messagesFor, setMessagesFor] = useState<any | null>(null);
  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, filterType, pageSize, showTrash]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterType, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: 'created_at', order: 'desc' };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) params.show_deleted = 'true';
    if (filterType) params.room_type = filterType;
    const res = await api.getChatRooms(params);
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    setLoading(false);
  }

  function openCreate() { setEditing(null); reset({ name: '', description: '', room_type: 'public', max_members: '', allow_invite_link: true }); setDialogKey(k => k + 1); setDialogOpen(true); }
  function openEdit(item: any) { setEditing(item); reset({ name: item.name, description: item.description || '', room_type: item.room_type, max_members: item.max_members || '', allow_invite_link: item.allow_invite_link }); setDialogKey(k => k + 1); setDialogOpen(true); }

  async function onSubmit(data: any) {
    const payload: any = { name: data.name, description: data.description || null, room_type: data.room_type, allow_invite_link: data.allow_invite_link };
    if (data.max_members) payload.max_members = parseInt(data.max_members);
    const res = editing ? await api.updateChatRoom(editing.id, payload) : await api.createChatRoom(payload);
    if (res.success) { toast.success(editing ? 'Room updated' : 'Room created'); setDialogOpen(false); load(); } else toast.error(res.error);
  }

  async function onSoftDelete(item: any) { if (!confirm(`Move "${item.name}" to trash?`)) return; setActionLoadingId(item.id); const res = await api.softDeleteChatRoom(item.id); if (res.success) { toast.success('Moved to trash'); load(); } else toast.error(res.error); setActionLoadingId(null); }
  async function onRestore(item: any) { setActionLoadingId(item.id); const res = await api.restoreChatRoom(item.id); if (res.success) { toast.success('Restored'); load(); } else toast.error(res.error); setActionLoadingId(null); }
  async function onPermanentDelete(item: any) { if (!confirm(`PERMANENTLY delete "${item.name}"? This cannot be undone.`)) return; setActionLoadingId(item.id); const res = await api.permanentDeleteChatRoom(item.id); if (res.success) { toast.success('Permanently deleted'); load(); } else toast.error(res.error); setActionLoadingId(null); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setShowTrash(false)} className={cn('px-3 py-1.5 text-sm font-medium rounded-md', !showTrash ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-slate-700')}>
          <MessageSquare className="w-4 h-4 inline mr-1" /> Rooms
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-3 py-1.5 text-sm font-medium rounded-md', showTrash ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700')}>
          <Trash2 className="w-4 h-4 inline mr-1" /> Trash
        </button>
        {!showTrash && <Button size="sm" onClick={openCreate} className="ml-auto"><Plus className="w-4 h-4 mr-1" /> Add Room</Button>}
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder="Search rooms...">
        <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
          <option value="direct">Direct</option>
        </select>
      </DataToolbar>

      {loading ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div> : items.length === 0 ? <EmptyState icon={MessageSquare} title={showTrash ? 'Trash is empty' : 'No chat rooms'} /> : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <Table>
            <THead><TR>
              <TH className="sticky top-0 z-10">Name</TH>
              <TH className="sticky top-0 z-10">Type</TH>
              <TH className="sticky top-0 z-10">Invite Code</TH>
              <TH className="sticky top-0 z-10">Created By</TH>
              <TH className="sticky top-0 z-10">Batch</TH>
              <TH className="sticky top-0 z-10">Status</TH>
              <TH className="sticky top-0 z-10">Created</TH>
              <TH className="sticky top-0 z-10 text-right">Actions</TH>
            </TR></THead>
            <TBody>
              {items.map(item => (
                <TR key={item.id}>
                  <TD className="font-medium">{item.name}</TD>
                  <TD><Badge variant={item.room_type === 'public' ? 'info' : item.room_type === 'private' ? 'warning' : 'default'}>{item.room_type}</Badge></TD>
                  <TD><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{item.invite_code}</code></TD>
                  <TD className="text-sm text-slate-600">{item.users ? `${item.users.first_name} ${item.users.last_name}` : '—'}</TD>
                  <TD className="text-sm text-slate-600">{item.course_batches?.title || '—'}</TD>
                  <TD>{showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}</TD>
                  <TD className="text-sm text-slate-500">{fromNow(item.created_at)}</TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {actionLoadingId === item.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : showTrash ? (<>
                        <button onClick={() => onRestore(item)} className="p-1 text-slate-400 hover:text-emerald-600" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => onPermanentDelete(item)} className="p-1 text-slate-400 hover:text-red-600" title="Delete forever"><Trash2 className="w-4 h-4" /></button>
                      </>) : (<>
                        <button onClick={() => setViewing(item)} className="p-1 text-slate-400 hover:text-brand-600" title="View"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setMembersFor(item)} className="p-1 text-slate-400 hover:text-brand-600" title="Members"><Users className="w-4 h-4" /></button>
                        <button onClick={() => setMessagesFor(item)} className="p-1 text-slate-400 hover:text-brand-600" title="Moderate messages"><MessageSquare className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(item)} className="p-1 text-slate-400 hover:text-brand-600" title="Edit"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => onSoftDelete(item)} className="p-1 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </>)}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />

      {/* View Dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Chat Room Details" size="lg">
        {viewing && (
          <div className="p-6 grid grid-cols-2 gap-4">
            <DetailRow label="Name" value={viewing.name} />
            <DetailRow label="Type" value={viewing.room_type} />
            <DetailRow label="Description" value={viewing.description} />
            <DetailRow label="Invite Code" value={viewing.invite_code} />
            <DetailRow label="Max Members" value={viewing.max_members || 'Unlimited'} />
            <DetailRow label="Invite Links" value={viewing.allow_invite_link ? 'Enabled' : 'Disabled'} />
            <DetailRow label="Status" value={viewing.is_active ? 'Active' : 'Inactive'} />
            <DetailRow label="Batch" value={viewing.course_batches?.title} />
            <DetailRow label="Created By" value={viewing.users ? `${viewing.users.first_name} ${viewing.users.last_name}` : null} />
            <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleString() : null} />
          </div>
        )}
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Chat Room' : 'Create Chat Room'} size="md">
        <form key={dialogKey} onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div><label className="text-sm font-medium text-slate-700">Name *</label><Input {...register('name', { required: true })} placeholder="Room name" /></div>
          <div><label className="text-sm font-medium text-slate-700">Description</label><Input {...register('description')} placeholder="Optional description" /></div>
          <div><label className="text-sm font-medium text-slate-700">Type *</label>
            <select {...register('room_type')} className={cn(selectClass, 'w-full')}>
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="direct">Direct</option>
            </select>
          </div>
          <div><label className="text-sm font-medium text-slate-700">Max Members</label><Input {...register('max_members')} type="number" placeholder="Unlimited" /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" {...register('allow_invite_link')} className="rounded border-slate-300" />
            <label className="text-sm text-slate-700">Allow invite links</label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      <RoomMembersDialog room={membersFor} onClose={() => setMembersFor(null)} />
      <RoomMessagesDialog room={messagesFor} onClose={() => setMessagesFor(null)} />
    </div>
  );
}

// ══════════════════════════════════════════════
// GENERIC CRUD TAB (for simple tables: sticker categories, emoji categories)
// ══════════════════════════════════════════════
function SimpleCrudTab({ entityLabel, apiList, apiGet, apiCreate, apiUpdate, apiSoftDelete, apiRestore, apiDelete, fields, filterFields }: {
  entityLabel: string;
  apiList: (params: any) => Promise<any>;
  apiGet: (id: number) => Promise<any>;
  // Phase 15.3 — accept an optional isFormData flag for multipart uploads.
  apiCreate: (data: any, isFormData?: boolean) => Promise<any>;
  apiUpdate: (id: number, data: any, isFormData?: boolean) => Promise<any>;
  apiSoftDelete: (id: number) => Promise<any>;
  apiRestore: (id: number) => Promise<any>;
  apiDelete: (id: number) => Promise<any>;
  fields: {
    key: string;
    label: string;
    type?: 'text' | 'number' | 'checkbox' | 'image';
    required?: boolean;
    /** When type='image', this is the multer field name expected by the backend (e.g. 'image', 'thumbnail'). */
    uploadFieldName?: string;
    /** Preferred image dimensions for the editor; cosmetic only. */
    imageAspectRatio?: number;
    imageMaxWidth?: number;
    imageMaxHeight?: number;
  }[];
  filterFields?: { key: string; label: string; options: { value: string; label: string }[] }[];
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  // Phase 15.3 — track an upload File per image-typed field by its uploadFieldName.
  const [imageFiles, setImageFiles] = useState<Record<string, File | null>>({});
  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, pageSize, showTrash]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: 'display_order', order: 'asc' };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) params.show_deleted = 'true';
    const res = await apiList(params);
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    setLoading(false);
  }

  function openCreate() { setEditing(null); const defaults: any = {}; fields.forEach(f => defaults[f.key] = f.type === 'checkbox' ? false : f.type === 'number' ? '' : ''); reset(defaults); setImageFiles({}); setDialogKey(k => k + 1); setDialogOpen(true); }
  function openEdit(item: any) { setEditing(item); const vals: any = {}; fields.forEach(f => vals[f.key] = item[f.key] ?? ''); reset(vals); setImageFiles({}); setDialogKey(k => k + 1); setDialogOpen(true); }

  async function onSubmit(data: any) {
    // Phase 15.3 — if any image field has a File, submit as FormData; otherwise JSON.
    const hasFiles = Object.values(imageFiles).some((f) => f instanceof File);

    if (hasFiles) {
      const fd = new FormData();
      fields.forEach((f) => {
        const v = data[f.key];
        if (f.type === 'checkbox')      fd.append(f.key, String(!!v));
        else if (f.type === 'image')    { /* file is appended below */ }
        else if (v !== '' && v !== undefined && v !== null) fd.append(f.key, f.type === 'number' ? String(parseInt(v)) : v);
      });
      for (const [fieldName, file] of Object.entries(imageFiles)) {
        if (file) fd.append(fieldName, file, file.name);
      }
      const res = editing ? await apiUpdate(editing.id, fd, true) : await apiCreate(fd, true);
      if (res.success) { toast.success(editing ? `${entityLabel} updated` : `${entityLabel} created`); setDialogOpen(false); load(); } else toast.error(res.error);
      return;
    }

    const payload: any = {};
    fields.forEach((f) => {
      if (f.type === 'image') return;   // skip — only sent via FormData
      if (data[f.key] !== '' && data[f.key] !== undefined) payload[f.key] = f.type === 'number' ? parseInt(data[f.key]) : data[f.key];
    });
    const res = editing ? await apiUpdate(editing.id, payload) : await apiCreate(payload);
    if (res.success) { toast.success(editing ? `${entityLabel} updated` : `${entityLabel} created`); setDialogOpen(false); load(); } else toast.error(res.error);
  }

  async function onSoftDelete(item: any) { if (!confirm(`Move "${item.name || item.title}" to trash?`)) return; setActionLoadingId(item.id); const res = await apiSoftDelete(item.id); if (res.success) { toast.success('Moved to trash'); load(); } else toast.error(res.error); setActionLoadingId(null); }
  async function onRestore(item: any) { setActionLoadingId(item.id); const res = await apiRestore(item.id); if (res.success) { toast.success('Restored'); load(); } else toast.error(res.error); setActionLoadingId(null); }
  async function onPermanentDelete(item: any) { if (!confirm(`PERMANENTLY delete "${item.name || item.title}"?`)) return; setActionLoadingId(item.id); const res = await apiDelete(item.id); if (res.success) { toast.success('Permanently deleted'); load(); } else toast.error(res.error); setActionLoadingId(null); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button onClick={() => setShowTrash(false)} className={cn('px-3 py-1.5 text-sm font-medium rounded-md', !showTrash ? 'bg-brand-50 text-brand-700' : 'text-slate-500 hover:text-slate-700')}>
          <Hash className="w-4 h-4 inline mr-1" /> {entityLabel}s
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-3 py-1.5 text-sm font-medium rounded-md', showTrash ? 'bg-red-50 text-red-700' : 'text-slate-500 hover:text-slate-700')}>
          <Trash2 className="w-4 h-4 inline mr-1" /> Trash
        </button>
        {!showTrash && <Button size="sm" onClick={openCreate} className="ml-auto"><Plus className="w-4 h-4 mr-1" /> Add {entityLabel}</Button>}
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={`Search ${entityLabel.toLowerCase()}s...`} />

      {loading ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div> : items.length === 0 ? <EmptyState icon={Sparkles} title={showTrash ? 'Trash is empty' : `No ${entityLabel.toLowerCase()}s`} /> : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <Table>
            <THead><TR>
              {fields.filter(f => f.key !== 'description').slice(0, 5).map(f => <TH key={f.key} className="sticky top-0 z-10">{f.label}</TH>)}
              <TH className="sticky top-0 z-10">Status</TH>
              <TH className="sticky top-0 z-10 text-right">Actions</TH>
            </TR></THead>
            <TBody>
              {items.map(item => (
                <TR key={item.id}>
                  {fields.filter(f => f.key !== 'description').slice(0, 5).map(f => (
                    <TD key={f.key} className={f.key === 'name' || f.key === 'title' ? 'font-medium' : 'text-sm text-slate-600'}>
                      {f.type === 'checkbox' ? (item[f.key] ? 'Yes' : 'No') :
                       f.key === 'image_url' || f.key === 'thumbnail_url' ? (item[f.key] ? <img src={item[f.key]} alt="" className="w-8 h-8 rounded object-cover" /> : '—') :
                       item[f.key] ?? '—'}
                    </TD>
                  ))}
                  <TD>{showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active !== false ? 'success' : 'danger'}>{item.is_active !== false ? 'Active' : 'Inactive'}</Badge>}</TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {actionLoadingId === item.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : showTrash ? (<>
                        <button onClick={() => onRestore(item)} className="p-1 text-slate-400 hover:text-emerald-600"><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => onPermanentDelete(item)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </>) : (<>
                        <button onClick={() => setViewing(item)} className="p-1 text-slate-400 hover:text-brand-600"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(item)} className="p-1 text-slate-400 hover:text-brand-600"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => onSoftDelete(item)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </>)}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />

      {/* View Dialog */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title={`${entityLabel} Details`} size="md">
        {viewing && <div className="p-6 grid grid-cols-2 gap-4">{fields.map(f => <DetailRow key={f.key} label={f.label} value={f.type === 'checkbox' ? (viewing[f.key] ? 'Yes' : 'No') : viewing[f.key]} />)}<DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleString() : null} /></div>}
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? `Edit ${entityLabel}` : `Create ${entityLabel}`} size="md">
        <form key={dialogKey} onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              {f.type !== 'image' && (
                <label className="text-sm font-medium text-slate-700">{f.label}{f.required ? ' *' : ''}</label>
              )}
              {f.type === 'checkbox' ? (
                <div className="flex items-center gap-2 mt-1"><input type="checkbox" {...register(f.key)} className="rounded border-slate-300" /></div>
              ) : f.type === 'image' ? (
                <ImageUpload
                  key={`${f.key}-${dialogKey}`}
                  label={`${f.label}${f.required ? ' *' : ''}`}
                  hint="Drag &amp; drop or click — crop, resize, then save"
                  value={editing?.[f.key]}
                  aspectRatio={f.imageAspectRatio}
                  maxWidth={f.imageMaxWidth ?? 512}
                  maxHeight={f.imageMaxHeight ?? 512}
                  shape="rounded"
                  onChange={(file) => setImageFiles((prev) => ({ ...prev, [f.uploadFieldName ?? f.key]: file }))}
                />
              ) : (
                <Input {...register(f.key, { required: f.required })} type={f.type || 'text'} placeholder={f.label} />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════
// CHAT INVITES TAB
// ══════════════════════════════════════════════
function ChatInvitesTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);
  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { api.getChatRooms({ limit: 100 }).then(r => { if (r.success) setRooms(r.data || []); }); }, []);
  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [searchDebounce, filterStatus, pageSize]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterStatus]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: 'created_at', order: 'desc' };
    if (searchDebounce) params.search = searchDebounce;
    if (filterStatus) params.status = filterStatus;
    const res = await api.getChatInvites(params);
    if (res.success) { setItems(res.data || []); setTotalPages(res.pagination?.totalPages || 1); setTotal(res.pagination?.total || 0); }
    setLoading(false);
  }

  function openCreate() { reset({ room_id: '', invite_type: 'link', max_uses: '', expires_days: '7' }); setDialogKey(k => k + 1); setDialogOpen(true); }

  async function onSubmit(data: any) {
    const payload: any = { room_id: parseInt(data.room_id), invite_type: data.invite_type };
    if (data.max_uses) payload.max_uses = parseInt(data.max_uses);
    if (data.expires_days) {
      const exp = new Date(); exp.setDate(exp.getDate() + parseInt(data.expires_days));
      payload.expires_at = exp.toISOString();
    }
    const res = await api.createChatInvite(payload);
    if (res.success) {
      toast.success('Invite created');
      if (res.data?.invite_url) { navigator.clipboard.writeText(res.data.invite_url).then(() => toast.success('Invite URL copied to clipboard')); }
      setDialogOpen(false); load();
    } else toast.error(res.error);
  }

  async function onRevoke(item: any) { if (!confirm('Revoke this invite?')) return; setActionLoadingId(item.id); const res = await api.revokeChatInvite(item.id); if (res.success) { toast.success('Invite revoked'); load(); } else toast.error(res.error); setActionLoadingId(null); }
  async function onDelete(item: any) { if (!confirm('Permanently delete this invite?')) return; setActionLoadingId(item.id); const res = await api.deleteChatInvite(item.id); if (res.success) { toast.success('Deleted'); load(); } else toast.error(res.error); setActionLoadingId(null); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <span className="text-sm font-medium text-slate-700"><Link className="w-4 h-4 inline mr-1" /> Invites</span>
        <Button size="sm" onClick={openCreate} className="ml-auto"><Plus className="w-4 h-4 mr-1" /> Generate Invite</Button>
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder="Search invites...">
        <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </DataToolbar>

      {loading ? <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-10 w-full" />)}</div> : items.length === 0 ? <EmptyState icon={Link} title="No invites" /> : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <Table>
            <THead><TR>
              <TH className="sticky top-0 z-10">Room</TH>
              <TH className="sticky top-0 z-10">Type</TH>
              <TH className="sticky top-0 z-10">Token</TH>
              <TH className="sticky top-0 z-10">Uses</TH>
              <TH className="sticky top-0 z-10">Status</TH>
              <TH className="sticky top-0 z-10">Expires</TH>
              <TH className="sticky top-0 z-10">Created By</TH>
              <TH className="sticky top-0 z-10 text-right">Actions</TH>
            </TR></THead>
            <TBody>
              {items.map(item => (
                <TR key={item.id}>
                  <TD className="font-medium">{item.chat_rooms?.name || '—'}</TD>
                  <TD><Badge variant={item.invite_type === 'link' ? 'info' : 'default'}>{item.invite_type}</Badge></TD>
                  <TD><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{item.invite_token?.substring(0, 12)}...</code></TD>
                  <TD className="text-sm">{item.use_count}{item.max_uses ? ` / ${item.max_uses}` : ''}</TD>
                  <TD><Badge variant={item.status === 'active' ? 'success' : item.status === 'revoked' ? 'danger' : 'warning'}>{item.status}</Badge></TD>
                  <TD className="text-sm text-slate-500">{item.expires_at ? fromNow(item.expires_at) : 'Never'}</TD>
                  <TD className="text-sm text-slate-600">{item.users ? `${item.users.first_name} ${item.users.last_name}` : '—'}</TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {actionLoadingId === item.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (<>
                        <button onClick={() => setViewing(item)} className="p-1 text-slate-400 hover:text-brand-600"><Eye className="w-4 h-4" /></button>
                        {item.status === 'active' && <button onClick={() => onRevoke(item)} className="p-1 text-slate-400 hover:text-orange-600" title="Revoke"><Lock className="w-4 h-4" /></button>}
                        <button onClick={() => onDelete(item)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </>)}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />

      {/* View */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Invite Details" size="md">
        {viewing && (
          <div className="p-6 grid grid-cols-2 gap-4">
            <DetailRow label="Room" value={viewing.chat_rooms?.name} />
            <DetailRow label="Type" value={viewing.invite_type} />
            <DetailRow label="Token" value={viewing.invite_token} />
            <DetailRow label="Status" value={viewing.status} />
            <DetailRow label="Uses" value={`${viewing.use_count}${viewing.max_uses ? ` / ${viewing.max_uses}` : ''}`} />
            <DetailRow label="Expires" value={viewing.expires_at ? new Date(viewing.expires_at).toLocaleString() : 'Never'} />
            <DetailRow label="Created By" value={viewing.users ? `${viewing.users.first_name} ${viewing.users.last_name}` : null} />
            <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleString() : null} />
          </div>
        )}
      </Dialog>

      {/* Create */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Generate Invite" size="md">
        <form key={dialogKey} onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div><label className="text-sm font-medium text-slate-700">Room *</label>
            <select {...register('room_id', { required: true })} className={cn(selectClass, 'w-full')}>
              <option value="">Select room...</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div><label className="text-sm font-medium text-slate-700">Type</label>
            <select {...register('invite_type')} className={cn(selectClass, 'w-full')}>
              <option value="link">Link (anyone with URL)</option>
              <option value="direct">Direct (specific user)</option>
            </select>
          </div>
          <div><label className="text-sm font-medium text-slate-700">Max Uses</label><Input {...register('max_uses')} type="number" placeholder="Unlimited" /></div>
          <div><label className="text-sm font-medium text-slate-700">Expires in (days)</label><Input {...register('expires_days')} type="number" placeholder="7" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Generate</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ══════════════════════════════════════════════
// ROOM MEMBERS DIALOG (moderation)
// ══════════════════════════════════════════════
function RoomMembersDialog({ room, onClose }: { room: any | null; onClose: () => void }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [newUserId, setNewUserId] = useState('');
  const [bulkIds, setBulkIds] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!room) return;
    setLoading(true);
    const res = await api.getChatMembers({ room_id: room.id, limit: 200, sort: 'created_at', order: 'asc' });
    if (res.success) setMembers(res.data || []);
    setLoading(false);
  }, [room]);

  useEffect(() => { if (room) { setNewUserId(''); setBulkIds(''); load(); } }, [room, load]);

  function memberName(m: any) {
    return m.users ? `${m.users.first_name ?? ''} ${m.users.last_name ?? ''}`.trim() || `User #${m.user_id}` : `User #${m.user_id}`;
  }

  async function addOne() {
    const uid = parseInt(newUserId);
    if (!uid) { toast.error('Enter a valid user ID'); return; }
    setAdding(true);
    const res = await api.addChatMember({ room_id: room.id, user_id: uid, role: 'member' });
    setAdding(false);
    if (res.success) { toast.success('Member added'); setNewUserId(''); load(); } else toast.error(res.error);
  }
  async function addBulk() {
    const ids = bulkIds.split(/[\s,]+/).map((s) => parseInt(s)).filter((n) => !isNaN(n));
    if (ids.length === 0) { toast.error('Enter one or more user IDs'); return; }
    setAdding(true);
    const res = await api.bulkAddChatMembers({ room_id: room.id, user_ids: ids });
    setAdding(false);
    if (res.success) { toast.success(`Added ${ids.length} member(s)`); setBulkIds(''); load(); } else toast.error(res.error);
  }
  async function toggleMute(m: any) {
    setBusyId(m.id);
    const res = await api.updateChatMember(m.id, { is_muted: !m.is_muted });
    if (res.success) { toast.success(m.is_muted ? 'Unmuted' : 'Muted'); load(); } else toast.error(res.error);
    setBusyId(null);
  }
  async function changeRole(m: any, role: string) {
    setBusyId(m.id);
    const res = await api.updateChatMember(m.id, { role });
    if (res.success) { toast.success('Role updated'); load(); } else toast.error(res.error);
    setBusyId(null);
  }
  async function removeMember(m: any) {
    if (!confirm(`Remove ${memberName(m)} from this room?`)) return;
    setBusyId(m.id);
    const res = await api.removeChatMember(m.id);
    if (res.success) { toast.success('Member removed'); load(); } else toast.error(res.error);
    setBusyId(null);
  }

  return (
    <Dialog open={!!room} onClose={onClose} title={room ? `Members · ${room.name}` : 'Members'} size="lg">
      {room && (
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[170px]">
              <label className="text-xs font-medium text-slate-500">Add by user ID</label>
              <div className="flex gap-2 mt-1">
                <Input value={newUserId} onChange={(e: any) => setNewUserId(e.target.value)} type="number" placeholder="e.g. 42" />
                <Button size="sm" onClick={addOne} disabled={adding}><Plus className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs font-medium text-slate-500">Bulk add (comma / space-separated IDs)</label>
              <div className="flex gap-2 mt-1">
                <Input value={bulkIds} onChange={(e: any) => setBulkIds(e.target.value)} placeholder="42, 43, 44" />
                <Button size="sm" variant="ghost" onClick={addBulk} disabled={adding}>Bulk Add</Button>
              </div>
            </div>
          </div>

          {loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
            : members.length === 0 ? <EmptyState icon={Users} title="No members" />
            : (
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[50vh] overflow-y-auto">
              <Table>
                <THead><TR>
                  <TH className="sticky top-0 z-10">User</TH>
                  <TH className="sticky top-0 z-10">Role</TH>
                  <TH className="sticky top-0 z-10">Status</TH>
                  <TH className="sticky top-0 z-10 text-right">Actions</TH>
                </TR></THead>
                <TBody>
                  {members.map((m) => (
                    <TR key={m.id}>
                      <TD className="font-medium">{memberName(m)} <span className="text-slate-400 text-xs">#{m.user_id}</span></TD>
                      <TD>
                        <select className={selectClass} value={m.role || 'member'} onChange={(e) => changeRole(m, e.target.value)} disabled={busyId === m.id}>
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                          <option value="owner">owner</option>
                        </select>
                      </TD>
                      <TD>{m.is_muted ? <Badge variant="warning">Muted</Badge> : <Badge variant="success">Active</Badge>}</TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {busyId === m.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (<>
                            <button onClick={() => toggleMute(m)} className="p-1 text-slate-400 hover:text-amber-600" title={m.is_muted ? 'Unmute' : 'Mute'}>{m.is_muted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>
                            <button onClick={() => removeMember(m)} className="p-1 text-slate-400 hover:text-red-600" title="Remove"><UserMinus className="w-4 h-4" /></button>
                          </>)}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ══════════════════════════════════════════════
// ROOM MESSAGES DIALOG (moderation)
// ══════════════════════════════════════════════
function RoomMessagesDialog({ room, onClose }: { room: any | null; onClose: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!room) return;
    setLoading(true);
    const res = await api.getChatMessagesByRoom(room.id, { limit: 50, page: 1 });
    if (res.success) setMessages(res.data || []);
    setLoading(false);
  }, [room]);

  useEffect(() => { if (room) load(); }, [room, load]);

  async function pin(m: any) {
    setBusyId(m.id);
    const res = await api.togglePinMessage(m.id);
    if (res.success) { toast.success(m.is_pinned ? 'Unpinned' : 'Pinned'); load(); } else toast.error(res.error);
    setBusyId(null);
  }
  async function del(m: any) {
    if (!confirm('Delete this message?')) return;
    setBusyId(m.id);
    const res = await api.softDeleteChatMessage(m.id);
    if (res.success) { toast.success('Message deleted'); load(); } else toast.error(res.error);
    setBusyId(null);
  }

  return (
    <Dialog open={!!room} onClose={onClose} title={room ? `Messages · ${room.name}` : 'Messages'} size="lg">
      {room && (
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">Latest 50 messages — newest first.</p>
            <Button size="sm" variant="ghost" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
          </div>
          {loading ? <div className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
            : messages.length === 0 ? <EmptyState icon={MessageSquare} title="No messages" />
            : (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">{m.users ? `${m.users.first_name ?? ''} ${m.users.last_name ?? ''}`.trim() || `User #${m.sender_id}` : `User #${m.sender_id}`}</span>
                      {m.is_pinned && <Badge variant="info">Pinned</Badge>}
                      {m.message_type && m.message_type !== 'text' && <Badge variant="default">{m.message_type}</Badge>}
                      <span className="text-xs text-slate-400">{fromNow(m.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5 break-words">{m.content || <span className="text-slate-400 italic">(no text)</span>}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {busyId === m.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : (<>
                      <button onClick={() => pin(m)} className="p-1 text-slate-400 hover:text-brand-600" title={m.is_pinned ? 'Unpin' : 'Pin'}>{m.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}</button>
                      <button onClick={() => del(m)} className="p-1 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ══════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════
export default function ChatManagementPage() {
  const [mainTab, setMainTab] = useState<MainTab>('rooms');

  return (
    <div className="space-y-6">
      <PageHeader title="Chat Management" description="Manage chat rooms, stickers, emojis, quick replies and invites" />

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setMainTab(tab.key)}
              className={cn('flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                mainTab === tab.key ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300')}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {mainTab === 'rooms' && <ChatRoomsTab />}

      {mainTab === 'sticker_categories' && (
        <SimpleCrudTab entityLabel="Sticker Category"
          apiList={api.getStickerCategories} apiGet={api.getStickerCategory}
          apiCreate={(d, isFD) => api.createStickerCategory(d, isFD)} apiUpdate={(id, d, isFD) => api.updateStickerCategory(id, d, isFD)}
          apiSoftDelete={api.softDeleteStickerCategory} apiRestore={api.restoreStickerCategory} apiDelete={api.permanentDeleteStickerCategory}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'slug', label: 'Slug', required: true },
            // Phase 15.3 — drag-drop upload; backend multer field name is 'thumbnail'
            { key: 'thumbnail_url', label: 'Thumbnail', type: 'image', uploadFieldName: 'thumbnail', imageAspectRatio: 1, imageMaxWidth: 512, imageMaxHeight: 512 },
            { key: 'display_order', label: 'Order', type: 'number' },
          ]}
        />
      )}

      {mainTab === 'stickers' && (
        <SimpleCrudTab entityLabel="Sticker"
          apiList={api.getStickers} apiGet={api.getSticker}
          apiCreate={(d, isFD) => api.createSticker(d, isFD)} apiUpdate={(id, d, isFD) => api.updateSticker(id, d, isFD)}
          apiSoftDelete={api.softDeleteSticker} apiRestore={api.restoreSticker} apiDelete={api.permanentDeleteSticker}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'slug', label: 'Slug' },
            { key: 'category_id', label: 'Category ID', type: 'number', required: true },
            // Phase 15.3 — drag-drop upload; backend multer field name is 'image'
            { key: 'image_url', label: 'Sticker Image', type: 'image', uploadFieldName: 'image', imageAspectRatio: 1, imageMaxWidth: 512, imageMaxHeight: 512 },
            { key: 'is_animated', label: 'Animated', type: 'checkbox' },
            { key: 'display_order', label: 'Order', type: 'number' },
          ]}
        />
      )}

      {mainTab === 'emoji_categories' && (
        <SimpleCrudTab entityLabel="Emoji Category"
          apiList={api.getEmojiCategories} apiGet={api.getEmojiCategory}
          apiCreate={api.createEmojiCategory} apiUpdate={(id, d) => api.updateEmojiCategory(id, d)}
          apiSoftDelete={api.softDeleteEmojiCategory} apiRestore={api.restoreEmojiCategory} apiDelete={api.permanentDeleteEmojiCategory}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'slug', label: 'Slug', required: true },
            { key: 'icon', label: 'Icon (emoji)' },
            { key: 'display_order', label: 'Order', type: 'number' },
          ]}
        />
      )}

      {mainTab === 'custom_emojis' && (
        <SimpleCrudTab entityLabel="Custom Emoji"
          apiList={api.getCustomEmojis} apiGet={api.getCustomEmoji}
          apiCreate={(d, isFD) => api.createCustomEmoji(d, isFD)} apiUpdate={(id, d, isFD) => api.updateCustomEmoji(id, d, isFD)}
          apiSoftDelete={api.softDeleteCustomEmoji} apiRestore={api.restoreCustomEmoji} apiDelete={api.permanentDeleteCustomEmoji}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'shortcode', label: 'Shortcode', required: true },
            { key: 'category_id', label: 'Category ID', type: 'number', required: true },
            // Phase 15.3 — drag-drop upload; backend multer field name is 'image'
            { key: 'image_url', label: 'Emoji Image', type: 'image', uploadFieldName: 'image', imageAspectRatio: 1, imageMaxWidth: 256, imageMaxHeight: 256 },
            { key: 'is_animated', label: 'Animated', type: 'checkbox' },
            { key: 'display_order', label: 'Order', type: 'number' },
          ]}
        />
      )}

      {mainTab === 'quick_replies' && (
        <SimpleCrudTab entityLabel="Quick Reply"
          apiList={api.getQuickReplies} apiGet={api.getQuickReply}
          apiCreate={api.createQuickReply} apiUpdate={(id, d) => api.updateQuickReply(id, d)}
          apiSoftDelete={api.softDeleteQuickReply} apiRestore={api.restoreQuickReply} apiDelete={api.permanentDeleteQuickReply}
          fields={[
            { key: 'title', label: 'Title', required: true },
            { key: 'shortcut', label: 'Shortcut' },
            { key: 'content', label: 'Content', required: true },
            { key: 'scope', label: 'Scope' },
            { key: 'display_order', label: 'Order', type: 'number' },
          ]}
        />
      )}

      {mainTab === 'invites' && <ChatInvitesTab />}
    </div>
  );
}
