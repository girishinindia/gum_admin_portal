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
import { Plus, Sparkles, Trash2, Edit2 } from 'lucide-react';
import type { Skill } from '@/lib/types';

const CATEGORIES = [
  { value: 'technical',     label: 'Technical' },
  { value: 'soft_skill',    label: 'Soft Skill' },
  { value: 'tool',          label: 'Tool' },
  { value: 'framework',     label: 'Framework' },
  { value: 'language',      label: 'Language' },
  { value: 'domain',        label: 'Domain' },
  { value: 'certification', label: 'Certification' },
  { value: 'other',         label: 'Other' },
];

const categoryColors: Record<string, string> = {
  technical: 'info',
  soft_skill: 'success',
  tool: 'warning',
  framework: 'info',
  language: 'muted',
  domain: 'info',
  certification: 'success',
  other: 'muted',
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterCategory, setFilterCategory] = useState('');

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { load(); }, [filterCategory]);

  async function load() {
    setLoading(true);
    const res = await api.listSkills(filterCategory || undefined);
    if (res.success) setSkills(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    setDialogKey(k => k + 1);
    reset({ name: '', category: 'technical', description: '' });
    setDialogOpen(true);
  }

  function openEdit(s: Skill) {
    setEditing(s);
    setImageFile(null);
    setImagePreview(null);
    setDialogKey(k => k + 1);
    reset({ name: s.name, category: s.category, description: s.description || '' });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) {
      fd.append('icon', imageFile, imageFile.name);
    }

    const res = editing
      ? await api.updateSkill(editing.id, fd, true)
      : await api.createSkill(fd, true);

    if (res.success) {
      toast.success(editing ? 'Skill updated' : 'Skill created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(s: Skill) {
    if (!confirm(`Delete "${s.name}"? Icon will also be removed.`)) return;
    const res = await api.deleteSkill(s.id);
    if (res.success) { toast.success('Skill deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(s: Skill) {
    const fd = new FormData();
    fd.append('is_active', String(!s.is_active));
    const res = await api.updateSkill(s.id, fd, true);
    if (res.success) { toast.success(`Skill ${!s.is_active ? 'activated' : 'deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Skills"
        description="Manage skills, technologies, and certifications"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add skill</Button>}
      />

      {/* Category filter */}
      <div className="mb-4">
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : skills.length === 0 ? (
        <EmptyState icon={Sparkles} title="No skills yet" description={filterCategory ? "No skills in this category" : "Add your first skill"} action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add skill</Button>} />
      ) : (
        <div className="grid gap-3">
          {skills.map(s => (
            <Card key={s.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                  {s.icon ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={s.icon} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{s.name}</h3>
                    <Badge variant={(categoryColors[s.category] || 'muted') as any}>
                      {CATEGORIES.find(c => c.value === s.category)?.label || s.category}
                    </Badge>
                    {!s.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {s.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{s.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(s)}>
                    {s.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(s)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(s)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Skill' : 'Add Skill'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <ImageUpload
            key={dialogKey}
            label="Skill Icon"
            hint="Square icon, resized to 200x200px WebP on server"
            value={editing?.icon}
            aspectRatio={1}
            maxWidth={400}
            maxHeight={400}
            shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }}
          />

          <Input label="Name" placeholder="React, Python, AWS..." {...register('name', { required: true })} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('category', { required: true })}
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={3}
              placeholder="Brief description of this skill..."
              {...register('description')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create skill'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
