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
import { Plus, Award, Trash2, Edit2 } from 'lucide-react';
import type { Designation } from '@/lib/types';

const LEVEL_BANDS = [
  { value: 'intern',    label: 'Intern' },
  { value: 'entry',     label: 'Entry' },
  { value: 'mid',       label: 'Mid' },
  { value: 'senior',    label: 'Senior' },
  { value: 'lead',      label: 'Lead' },
  { value: 'manager',   label: 'Manager' },
  { value: 'director',  label: 'Director' },
  { value: 'executive', label: 'Executive' },
];

const bandColors: Record<string, string> = {
  intern: 'muted', entry: 'muted', mid: 'info', senior: 'info',
  lead: 'success', manager: 'success', director: 'warning', executive: 'danger',
};

export default function DesignationsPage() {
  const [items, setItems] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Designation | null>(null);
  const [filterBand, setFilterBand] = useState('');

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { load(); }, [filterBand]);

  async function load() {
    setLoading(true);
    const res = await api.listDesignations(filterBand || undefined);
    if (res.success) setItems(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({ name: '', code: '', level: 1, level_band: 'entry', description: '' });
    setDialogOpen(true);
  }

  function openEdit(d: Designation) {
    setEditing(d);
    reset({ name: d.name, code: d.code || '', level: d.level, level_band: d.level_band, description: d.description || '' });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = { ...data, level: parseInt(data.level) || 1 };
    const res = editing
      ? await api.updateDesignation(editing.id, payload)
      : await api.createDesignation(payload);
    if (res.success) {
      toast.success(editing ? 'Designation updated' : 'Designation created');
      setDialogOpen(false); load();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(d: Designation) {
    if (!confirm(`Delete "${d.name}"?`)) return;
    const res = await api.deleteDesignation(d.id);
    if (res.success) { toast.success('Deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(d: Designation) {
    const res = await api.updateDesignation(d.id, { is_active: !d.is_active });
    if (res.success) { toast.success(`${!d.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Designations" description="Manage job titles and designation levels"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add designation</Button>} />

      <div className="mb-4">
        <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterBand} onChange={e => setFilterBand(e.target.value)}>
          <option value="">All levels</option>
          {LEVEL_BANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Award} title="No designations yet" description={filterBand ? 'No designations in this band' : 'Add your first designation'}
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add designation</Button>} />
      ) : (
        <div className="grid gap-3">
          {items.map(d => (
            <Card key={d.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Award className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{d.name}</h3>
                    {d.code && <Badge variant="muted" className="font-mono">{d.code}</Badge>}
                    <Badge variant={(bandColors[d.level_band] || 'muted') as any}>
                      L{d.level} · {LEVEL_BANDS.find(b => b.value === d.level_band)?.label}
                    </Badge>
                    {!d.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {d.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{d.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(d)}>
                    {d.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(d)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => onDelete(d)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Designation' : 'Add Designation'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="Senior Developer" {...register('name', { required: true })} />
            <Input label="Code" placeholder="SR-DEV" {...register('code')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Level (0-10)" type="number" min={0} max={10} {...register('level')} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Level Band</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('level_band', { required: true })}>
                {LEVEL_BANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
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