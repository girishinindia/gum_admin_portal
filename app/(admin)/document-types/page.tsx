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
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, FolderOpen, Trash2, Edit2 } from 'lucide-react';
import type { DocumentType } from '@/lib/types';

export default function DocumentTypesPage() {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentType | null>(null);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await api.listDocumentTypes();
    if (res.success) setTypes(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({ name: '', description: '' });
    setDialogOpen(true);
  }

  function openEdit(dt: DocumentType) {
    setEditing(dt);
    reset({ name: dt.name, description: dt.description || '' });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = { ...data };

    const res = editing
      ? await api.updateDocumentType(editing.id, payload)
      : await api.createDocumentType(payload);

    if (res.success) {
      toast.success(editing ? 'Document type updated' : 'Document type created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(dt: DocumentType) {
    if (!confirm(`Delete "${dt.name}"? This cannot be undone.`)) return;
    const res = await api.deleteDocumentType(dt.id);
    if (res.success) { toast.success('Document type deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(dt: DocumentType) {
    const res = await api.updateDocumentType(dt.id, { is_active: !dt.is_active });
    if (res.success) { toast.success(`${!dt.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Document Types"
        description="Manage document categories and classifications"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add type</Button>}
      />

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : types.length === 0 ? (
        <EmptyState icon={FolderOpen} title="No document types yet" description="Add your first document type" action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add type</Button>} />
      ) : (
        <div className="grid gap-3">
          {types.map(dt => (
            <Card key={dt.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <FolderOpen className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{dt.name}</h3>
                    <Badge variant="muted">Order: {dt.sort_order}</Badge>
                    {!dt.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {dt.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{dt.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(dt)}>
                    {dt.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(dt)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(dt)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Document Type' : 'Add Document Type'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input label="Name" placeholder="Certificate, ID Card, Transcript..." {...register('name', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={2}
              placeholder="Brief description of this document type..."
              {...register('description')}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create type'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
