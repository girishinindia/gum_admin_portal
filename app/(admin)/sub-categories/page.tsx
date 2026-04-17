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
import { Plus, Layers, Trash2, Edit2, Star } from 'lucide-react';
import type { SubCategory, Category } from '@/lib/types';

export default function SubCategoriesPage() {
  const [items, setItems] = useState<SubCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubCategory | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    api.listCategories('?limit=100').then(res => { if (res.success) setCategories(res.data || []); });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDebounce, filterCategory]);

  useEffect(() => { load(); }, [searchDebounce, page, filterCategory]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterCategory) qs.set('category_id', filterCategory);
    const res = await api.listSubCategories('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ category_id: categories[0]?.id || '', name: '', code: '', slug: '', display_order: 0, is_new: false, new_until: '' });
    setDialogOpen(true);
  }

  function openEdit(sc: SubCategory) {
    setEditing(sc); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ category_id: sc.category_id, name: sc.name, code: sc.code, slug: sc.slug, display_order: sc.display_order, is_new: sc.is_new, new_until: sc.new_until || '' });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) fd.append('image', imageFile, imageFile.name);

    const res = editing
      ? await api.updateSubCategory(editing.id, fd, true)
      : await api.createSubCategory(fd, true);
    if (res.success) {
      toast.success(editing ? 'Sub-category updated' : 'Sub-category created');
      setDialogOpen(false); load();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(sc: SubCategory) {
    if (!confirm(`Delete "${sc.name}"?`)) return;
    const res = await api.deleteSubCategory(sc.id);
    if (res.success) { toast.success('Deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(sc: SubCategory) {
    const fd = new FormData();
    fd.append('is_active', String(!sc.is_active));
    const res = await api.updateSubCategory(sc.id, fd, true);
    if (res.success) { toast.success(`${!sc.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Sub-Categories" description="Manage sub-categories within categories"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add sub-category</Button>} />

      <div className="mb-4">
        <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search sub-categories...">
          <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </DataToolbar>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Layers} title="No sub-categories yet" description={filterCategory ? 'No sub-categories in this category' : 'Add your first sub-category'}
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add sub-category</Button>} />
      ) : (
        <>
          <div className="grid gap-3">
            {items.map(sc => (
              <Card key={sc.id} className="p-4 hover:shadow-card-hover transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                    {sc.image ? (
                      <img src={sc.image} alt={sc.name} className="w-full h-full object-cover" />
                    ) : (
                      <Layers className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold text-slate-900">{sc.name}</h3>
                      <Badge variant="muted" className="font-mono">{sc.code}</Badge>
                      {sc.categories?.name && <Badge variant="info">{sc.categories.name}</Badge>}
                      {sc.is_new && <Badge variant="success"><Star className="w-3 h-3 mr-1" />New</Badge>}
                      {!sc.is_active && <Badge variant="danger">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">/{sc.slug}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onToggleActive(sc)}>
                      {sc.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <button type="button" onClick={() => openEdit(sc)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => onDelete(sc)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Sub-Category' : 'Add Sub-Category'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <ImageUpload key={dialogKey} label="Sub-Category Image" hint="Resized to 400x400px WebP"
            value={editing?.image} aspectRatio={1} maxWidth={400} maxHeight={400} shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }} />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('category_id', { required: true })}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Name" placeholder="React, Python, UI Design..." {...register('name', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Code" placeholder="react" {...register('code', { required: true })} />
            <Input label="Slug" placeholder="react" {...register('slug', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Display Order" type="number" {...register('display_order')} />
            <Input label="New Until (date)" type="date" {...register('new_until')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_new')} />
            <span className="text-sm font-medium text-slate-700">Mark as New</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}