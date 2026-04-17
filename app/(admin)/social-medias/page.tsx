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
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Share2, Trash2, Edit2 } from 'lucide-react';
import type { SocialMedia } from '@/lib/types';

const PLATFORM_TYPES = [
  { value: 'social',       label: 'Social' },
  { value: 'professional', label: 'Professional' },
  { value: 'code',         label: 'Code' },
  { value: 'video',        label: 'Video' },
  { value: 'blog',         label: 'Blog' },
  { value: 'portfolio',    label: 'Portfolio' },
  { value: 'messaging',    label: 'Messaging' },
  { value: 'website',      label: 'Website' },
  { value: 'other',        label: 'Other' },
];

const typeColors: Record<string, string> = {
  social: 'info', professional: 'success', code: 'muted', video: 'danger',
  blog: 'warning', portfolio: 'success', messaging: 'info', website: 'muted', other: 'muted',
};

export default function SocialMediasPage() {
  const [items, setItems] = useState<SocialMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SocialMedia | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterType, setFilterType] = useState('');

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { load(); }, [filterType]);

  async function load() {
    setLoading(true);
    const res = await api.listSocialMedias(filterType || undefined);
    if (res.success) setItems(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ name: '', code: '', base_url: '', placeholder: '', platform_type: 'social' });
    setDialogOpen(true);
  }

  function openEdit(s: SocialMedia) {
    setEditing(s); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({ name: s.name, code: s.code, base_url: s.base_url || '', placeholder: s.placeholder || '', platform_type: s.platform_type });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') fd.append(k, String(data[k]));
    });
    if (imageFile) fd.append('icon', imageFile, imageFile.name);

    const res = editing
      ? await api.updateSocialMedia(editing.id, fd, true)
      : await api.createSocialMedia(fd, true);
    if (res.success) {
      toast.success(editing ? 'Social media updated' : 'Social media created');
      setDialogOpen(false); load();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(s: SocialMedia) {
    if (!confirm(`Delete "${s.name}"?`)) return;
    const res = await api.deleteSocialMedia(s.id);
    if (res.success) { toast.success('Deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(s: SocialMedia) {
    const fd = new FormData();
    fd.append('is_active', String(!s.is_active));
    const res = await api.updateSocialMedia(s.id, fd, true);
    if (res.success) { toast.success(`${!s.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Social Media Platforms" description="Manage social media and professional platforms"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add platform</Button>} />

      <div className="mb-4">
        <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All types</option>
          {PLATFORM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Share2} title="No social medias yet" description={filterType ? 'No platforms in this type' : 'Add your first platform'}
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add platform</Button>} />
      ) : (
        <div className="grid gap-3">
          {items.map(s => (
            <Card key={s.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                  {s.icon ? (
                    <img src={s.icon} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <Share2 className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{s.name}</h3>
                    <Badge variant="muted" className="font-mono">{s.code}</Badge>
                    <Badge variant={(typeColors[s.platform_type] || 'muted') as any}>
                      {PLATFORM_TYPES.find(t => t.value === s.platform_type)?.label}
                    </Badge>
                    {!s.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {s.base_url && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.base_url}</p>}
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Social Media' : 'Add Social Media'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <ImageUpload key={dialogKey} label="Platform Icon" hint="Square icon, resized to 200x200px WebP"
            value={editing?.icon} aspectRatio={1} maxWidth={400} maxHeight={400} shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="LinkedIn" {...register('name', { required: true })} />
            <Input label="Code" placeholder="linkedin" {...register('code', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Platform Type</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('platform_type', { required: true })}>
              {PLATFORM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <Input label="Base URL" placeholder="https://linkedin.com/" {...register('base_url')} />
          <Input label="Placeholder" placeholder="https://linkedin.com/in/your-profile" {...register('placeholder')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}