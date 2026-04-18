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
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, FileImage, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Document as Doc, DocumentType } from '@/lib/types';

type SortField = 'id' | 'name' | 'is_active';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  // Pagination, search, sort, filters
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Soft delete: toggle between active list and trash
  const [showTrash, setShowTrash] = useState(false);

  const { register, handleSubmit, reset } = useForm();

  // Load document types for filter & form dropdowns
  useEffect(() => {
    api.listDocumentTypes('?limit=100').then(res => {
      if (res.success) setDocTypes(res.data || []);
    });
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary once on mount
  useEffect(() => {
    api.getTableSummary('documents').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => { setPage(1); }, [searchDebounce, filterType, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterType, filterStatus, sortField, sortOrder, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterType) qs.set('document_type_id', String(filterType));
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listDocuments('?' + qs.toString());
    if (res.success) {
      setDocuments(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('documents');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    setDialogKey(k => k + 1);
    reset({ name: '', document_type_id: docTypes[0]?.id || '', description: '' });
    setDialogOpen(true);
  }

  function openEdit(d: Doc) {
    setEditing(d);
    setImageFile(null);
    setImagePreview(null);
    setDialogKey(k => k + 1);
    reset({
      name: d.name,
      document_type_id: d.document_type_id,
      description: d.description || '',
    });
    setDialogOpen(true);
  }

  function openView(d: Doc) {
    setViewing(d);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) {
      fd.append('file', imageFile, imageFile.name);
    }

    const res = editing
      ? await api.updateDocument(editing.id, fd, true)
      : await api.createDocument(fd, true);

    if (res.success) {
      toast.success(editing ? 'Document updated' : 'Document created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(d: Doc) {
    if (!confirm(`Move "${d.name}" to trash? You can restore it later.`)) return;
    const res = await api.deleteDocument(d.id);
    if (res.success) { toast.success('Document moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(d: Doc) {
    const res = await api.restoreDocument(d.id);
    if (res.success) { toast.success(`"${d.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(d: Doc) {
    if (!confirm(`PERMANENTLY delete "${d.name}"? This cannot be undone and file will be removed.`)) return;
    const res = await api.permanentDeleteDocument(d.id);
    if (res.success) { toast.success('Document permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(d: Doc) {
    const fd = new FormData();
    fd.append('is_active', String(!d.is_active));
    const res = await api.updateDocument(d.id, fd, true);
    if (res.success) { toast.success(`Document ${!d.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Documents"
        description="Manage documents and uploaded files"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add document</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Documents', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', card.color)}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-medium">{card.label}</div>
                  <div className="text-xl font-bold text-slate-900 leading-tight">{card.value.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trash toggle tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button
          onClick={() => setShowTrash(false)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          Documents
        </button>
        <button
          onClick={() => setShowTrash(true)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn(
              'ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            )}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      {/* Toolbar: search + filters (only in normal view) */}
      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search documents...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              {docTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </>
        )}
      </DataToolbar>

      {/* Trash banner */}
      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : FileImage}
          title={showTrash ? 'Trash is empty' : 'No documents yet'}
          description={showTrash ? 'No deleted documents' : (searchDebounce || filterType || filterStatus ? 'No documents match your filters' : 'Add your first document')}
          action={!showTrash && !searchDebounce && !filterType && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add document</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="w-12">File</TH>
                <TH>
                  <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Name <SortIcon field="name" />
                  </button>
                </TH>
                {!showTrash && (
                  <>
                    <TH>Document Type</TH>
                    <TH>Description</TH>
                  </>
                )}
                {showTrash && <TH>Deleted</TH>}
                <TH>
                  <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Status <SortIcon field="is_active" />
                  </button>
                </TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {documents.map(d => (
                <TR key={d.id} className={showTrash ? 'bg-amber-50/30' : undefined}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{d.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                      {d.file_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={d.file_url} alt={d.name} className="w-full h-full object-cover" />
                      ) : (
                        <FileImage className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{d.name}</span>
                  </TD>
                  {!showTrash && (
                    <>
                      <TD className="py-2.5">
                        {d.document_types?.name ? (
                          <Badge variant="info">{d.document_types.name}</Badge>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </TD>
                      <TD className="py-2.5">
                        <span className="text-slate-600 text-sm line-clamp-1">{d.description || '—'}</span>
                      </TD>
                    </>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{d.deleted_at ? fromNow(d.deleted_at) : '—'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={d.is_active ? 'success' : 'danger'}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(d)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Restore">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onPermanentDelete(d)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Permanent Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(d)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(d)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onSoftDelete(d)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Move to Trash">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            total={total}
            showingCount={documents.length}
          />
        </div>
      )}

      {/* ── View Document Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Document Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                {viewing.file_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={viewing.file_url} alt={viewing.name} className="w-full h-full object-cover" />
                ) : (
                  <FileImage className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {viewing.document_types?.name && <Badge variant="info">{viewing.document_types.name}</Badge>}
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Document Type" value={viewing.document_types?.name} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order)} />
              <DetailRow label="Description" value={viewing.description} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              {viewing.file_url && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">File Preview</dt>
                  <dd className="mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={viewing.file_url} alt={viewing.name} className="max-w-[200px] max-h-[200px] rounded-lg border border-slate-200 object-contain" />
                  </dd>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Document' : 'Add Document'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This document is currently active' : 'This document is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getDocument(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  editing.is_active ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          )}

          <ImageUpload
            key={dialogKey}
            label="Document File"
            hint="Image file, resized to 800x800px WebP on server"
            value={editing?.file_url}
            aspectRatio={1}
            maxWidth={800}
            maxHeight={800}
            shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }}
          />

          <Input label="Name" placeholder="Document name..." {...register('name', { required: true })} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('document_type_id', { required: true })}
            >
              {docTypes.map(dt => (
                <option key={dt.id} value={dt.id}>{dt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={2}
              placeholder="Brief description..."
              {...register('description')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create document'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
