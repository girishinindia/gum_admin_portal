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
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Compass, Trash2, Edit2 } from 'lucide-react';
import type { Specialization } from '@/lib/types';

const CATEGORIES = [
  { value: 'technology',   label: 'Technology' },
  { value: 'data',         label: 'Data' },
  { value: 'design',       label: 'Design' },
  { value: 'business',     label: 'Business' },
  { value: 'language',     label: 'Language' },
  { value: 'science',      label: 'Science' },
  { value: 'mathematics',  label: 'Mathematics' },
  { value: 'arts',         label: 'Arts' },
  { value: 'health',       label: 'Health' },
  { value: 'exam_prep',    label: 'Exam Prep' },
  { value: 'professional', label: 'Professional' },
  { value: 'other',        label: 'Other' },
];

const catColors: Record<string, string> = {
  technology: 'info', data: 'info', design: 'success', business: 'warning',
  language: 'muted', science: 'info', mathematics: 'info', arts: 'success',
  health: 'success', exam_prep: 'warning', professional: 'warning', other: 'muted',
};

export default function SpecializationsPage() {
  const [items, setItems] = useState<Specialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Specialization | null>(null);
  const [filterCat, setFilterCat] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounce, filterCat]);

  useEffect(() => { load(); }, [searchDebounce, page, filterCat]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterCat) qs.set('category', filterCat);
    const res = await api.listSpecializations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({ name: '', category: 'technology', description: '' });
    setDialogOpen(true);
  }

  function openEdit(s: Specialization) {
    setEditing(s);
    reset({ name: s.name, category: s.category, description: s.description || '' });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const res = editing
      ? await api.updateSpecialization(editing.id, data)
      : await api.createSpecialization(data);
    if (res.success) {
      toast.success(editing ? 'Specialization updated' : 'Specialization created');
      setDialogOpen(false); load();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(s: Specialization) {
    if (!confirm(`Delete "${s.name}"?`)) return;
    const res = await api.deleteSpecialization(s.id);
    if (res.success) { toast.success('Deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(s: Specialization) {
    const res = await api.updateSpecialization(s.id, { is_active: !s.is_active });
    if (res.success) { toast.success(`${!s.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Specializations" description="Manage subject areas and specialization domains"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add specialization</Button>} />

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search specializations...">
        <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </DataToolbar>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Compass} title="No specializations yet" description={filterCat ? 'No specializations in this category' : 'Add your first specialization'}
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add specialization</Button>} />
      ) : (
        <div className="grid gap-3">
          {items.map(s => (
            <Card key={s.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                  <Compass className="w-5 h-5 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{s.name}</h3>
                    <Badge variant={(catColors[s.category] || 'muted') as any}>
                      {CATEGORIES.find(c => c.value === s.category)?.label || s.category}
                    </Badge>
                    {!s.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {s.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(s)}>
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(s)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => onDelete(s)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Specialization' : 'Add Specialization'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input label="Name" placeholder="Web Development, Data Science..." {...register('name', { required: true })} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('category', { required: true })}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={2} placeholder="Brief description..." {...register('description')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
