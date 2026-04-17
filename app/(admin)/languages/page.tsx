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
import { Plus, Languages as LanguagesIcon, Trash2, Edit2, BookOpen } from 'lucide-react';
import type { Language } from '@/lib/types';

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Language | null>(null);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await api.listLanguages();
    if (res.success) setLanguages(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({ name: '', native_name: '', iso_code: '', script: '', for_material: false });
    setDialogOpen(true);
  }

  function openEdit(l: Language) {
    setEditing(l);
    reset({
      name: l.name, native_name: l.native_name || '', iso_code: l.iso_code || '',
      script: l.script || '', for_material: l.for_material,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = {
      ...data,
      for_material: data.for_material === true || data.for_material === 'true',
    };

    const res = editing
      ? await api.updateLanguage(editing.id, payload)
      : await api.createLanguage(payload);

    if (res.success) {
      toast.success(editing ? 'Language updated' : 'Language created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(l: Language) {
    if (!confirm(`Delete "${l.name}"? This cannot be undone.`)) return;
    const res = await api.deleteLanguage(l.id);
    if (res.success) { toast.success('Language deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(l: Language) {
    const res = await api.updateLanguage(l.id, { is_active: !l.is_active });
    if (res.success) { toast.success(`Language ${!l.is_active ? 'activated' : 'deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleMaterial(l: Language) {
    const res = await api.updateLanguage(l.id, { for_material: !l.for_material });
    if (res.success) { toast.success(`Material ${!l.for_material ? 'enabled' : 'disabled'} for ${l.name}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Languages"
        description="Manage languages for content and localization"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add language</Button>}
      />

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : languages.length === 0 ? (
        <EmptyState icon={LanguagesIcon} title="No languages yet" description="Add your first language" action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add language</Button>} />
      ) : (
        <div className="grid gap-3">
          {languages.map(l => (
            <Card key={l.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                  <LanguagesIcon className="w-5 h-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{l.name}</h3>
                    {l.native_name && <span className="text-sm text-slate-500">{l.native_name}</span>}
                    {l.iso_code && <Badge variant="muted" className="font-mono">{l.iso_code}</Badge>}
                    {l.for_material && (
                      <Badge variant="success">
                        <BookOpen className="w-3 h-3 mr-1" />Material
                      </Badge>
                    )}
                    {!l.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {l.script && (
                    <div className="text-xs text-slate-500 mt-0.5">Script: {l.script}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleMaterial(l)}>
                    {l.for_material ? 'Remove Material' : 'For Material'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(l)}>
                    {l.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(l)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(l)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Language' : 'Add Language'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="English" {...register('name', { required: true })} />
            <Input label="Native Name" placeholder="English" {...register('native_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="ISO Code" placeholder="en" maxLength={10} {...register('iso_code')} />
            <Input label="Script" placeholder="Latin" {...register('script')} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('for_material')} />
            <span className="text-sm font-medium text-slate-700">Available for course material</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create language'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
