"use client";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card } from '@/components/ui/Card';
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
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, FileImage, Trash2, Edit2 } from 'lucide-react';
import type { Document as Doc, DocumentType } from '@/lib/types';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    api.listDocumentTypes('?limit=100').then(res => {
      if (res.success) setDocTypes(res.data || []);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounce, filterType]);

  useEffect(() => { load(); }, [searchDebounce, page, filterType]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterType) qs.set('document_type_id', filterType);
    const res = await api.listDocuments('?' + qs.toString());
    if (res.success) {
      setDocuments(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
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
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(d: Doc) {
    if (!confirm(`Delete "${d.name}"? File will also be removed.`)) return;
    const res = await api.deleteDocument(d.id);
    if (res.success) { toast.success('Document deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(d: Doc) {
    const fd = new FormData();
    fd.append('is_active', String(!d.is_active));
    const res = await api.updateDocument(d.id, fd, true);
    if (res.success) { toast.success(`Document ${!d.is_active ? 'activated' : 'deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Documents"
        description="Manage documents and uploaded files"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add document</Button>}
      />

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search documents...">
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="">All document types</option>
          {docTypes.map(dt => (
            <option key={dt.id} value={dt.id}>{dt.name}</option>
          ))}
        </select>
      </DataToolbar>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : documents.length === 0 ? (
        <EmptyState icon={FileImage} title="No documents yet" description={filterType ? "No documents in this type" : "Add your first document"} action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add document</Button>} />
      ) : (
        <div className="grid gap-3">
          {documents.map(d => (
            <Card key={d.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                  {d.file_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={d.file_url} alt={d.name} className="w-full h-full object-cover" />
                  ) : (
                    <FileImage className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{d.name}</h3>
                    {d.document_types?.name && (
                      <Badge variant="info">{d.document_types.name}</Badge>
                    )}
                    <Badge variant="muted">Order: {d.sort_order}</Badge>
                    {!d.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {d.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{d.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(d)}>
                    {d.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(d)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(d)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Document' : 'Add Document'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
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
