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
import { Plus, Target, Trash2, Edit2 } from 'lucide-react';
import type { LearningGoal } from '@/lib/types';

export default function LearningGoalsPage() {
  const [items, setItems] = useState<LearningGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LearningGoal | null>(null);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await api.listLearningGoals();
    if (res.success) setItems(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({ name: '', description: '', display_order: 0 });
    setDialogOpen(true);
  }

  function openEdit(g: LearningGoal) {
    setEditing(g);
    reset({ name: g.name, description: g.description || '', display_order: g.display_order });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = { ...data, display_order: parseInt(data.display_order) || 0 };
    const res = editing
      ? await api.updateLearningGoal(editing.id, payload)
      : await api.createLearningGoal(payload);
    if (res.success) {
      toast.success(editing ? 'Learning goal updated' : 'Learning goal created');
      setDialogOpen(false); load();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(g: LearningGoal) {
    if (!confirm(`Delete "${g.name}"?`)) return;
    const res = await api.deleteLearningGoal(g.id);
    if (res.success) { toast.success('Deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(g: LearningGoal) {
    const res = await api.updateLearningGoal(g.id, { is_active: !g.is_active });
    if (res.success) { toast.success(`${!g.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Learning Goals" description="Manage learning objectives and goals"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add goal</Button>} />

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Target} title="No learning goals yet" description="Add your first learning goal"
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add goal</Button>} />
      ) : (
        <div className="grid gap-3">
          {items.map(g => (
            <Card key={g.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{g.name}</h3>
                    <Badge variant="muted">Order: {g.display_order}</Badge>
                    {!g.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {g.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{g.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(g)}>
                    {g.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(g)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => onDelete(g)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Learning Goal' : 'Add Learning Goal'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input label="Name" placeholder="Career advancement, Skill mastery..." {...register('name', { required: true })} />
          <Input label="Display Order" type="number" {...register('display_order')} />
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
