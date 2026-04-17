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
import { Plus, GraduationCap, Trash2, Edit2 } from 'lucide-react';
import type { EducationLevel } from '@/lib/types';

const CATEGORIES = [
  { value: 'pre_school',     label: 'Pre-School' },
  { value: 'school',         label: 'School' },
  { value: 'diploma',        label: 'Diploma' },
  { value: 'undergraduate',  label: 'Undergraduate' },
  { value: 'postgraduate',   label: 'Postgraduate' },
  { value: 'doctoral',       label: 'Doctoral' },
  { value: 'professional',   label: 'Professional' },
  { value: 'informal',       label: 'Informal' },
  { value: 'other',          label: 'Other' },
];

export default function EducationLevelsPage() {
  const [levels, setLevels] = useState<EducationLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EducationLevel | null>(null);
  const [filterCategory, setFilterCategory] = useState('');

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { load(); }, [filterCategory]);

  async function load() {
    setLoading(true);
    const res = await api.listEducationLevels(filterCategory || undefined);
    if (res.success) setLevels(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({ name: '', abbreviation: '', level_order: 0, level_category: 'other', description: '' });
    setDialogOpen(true);
  }

  function openEdit(l: EducationLevel) {
    setEditing(l);
    reset({
      name: l.name, abbreviation: l.abbreviation || '', level_order: l.level_order,
      level_category: l.level_category, description: l.description || '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = {
      ...data,
      level_order: parseInt(data.level_order) || 0,
    };

    const res = editing
      ? await api.updateEducationLevel(editing.id, payload)
      : await api.createEducationLevel(payload);

    if (res.success) {
      toast.success(editing ? 'Education level updated' : 'Education level created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(l: EducationLevel) {
    if (!confirm(`Delete "${l.name}"? This cannot be undone.`)) return;
    const res = await api.deleteEducationLevel(l.id);
    if (res.success) { toast.success('Education level deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(l: EducationLevel) {
    const res = await api.updateEducationLevel(l.id, { is_active: !l.is_active });
    if (res.success) { toast.success(`${!l.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Education Levels"
        description="Manage education levels and qualifications"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add level</Button>}
      />

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
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : levels.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No education levels yet" description="Add your first education level" action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add level</Button>} />
      ) : (
        <div className="grid gap-3">
          {levels.map(l => (
            <Card key={l.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{l.name}</h3>
                    {l.abbreviation && <Badge variant="muted" className="font-mono">{l.abbreviation}</Badge>}
                    <Badge variant="info">
                      {CATEGORIES.find(c => c.value === l.level_category)?.label || l.level_category}
                    </Badge>
                    <Badge variant="muted">Order: {l.level_order}</Badge>
                    {!l.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {l.description && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{l.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Education Level' : 'Add Education Level'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="Bachelor of Technology" {...register('name', { required: true })} />
            <Input label="Abbreviation" placeholder="B.Tech" {...register('abbreviation')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('level_category', { required: true })}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <Input label="Level Order" type="number" placeholder="1" {...register('level_order')} />
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
            <Button type="submit">{editing ? 'Save changes' : 'Create level'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
