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
import { Plus, MapPin, Trash2, Edit2, Globe2 } from 'lucide-react';
import type { State, Country } from '@/lib/types';

export default function StatesPage() {
  const [states, setStates] = useState<State[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<State | null>(null);
  const [filterCountry, setFilterCountry] = useState<number | ''>('');

  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => { loadCountries(); }, []);
  useEffect(() => { load(); }, [filterCountry]);

  async function loadCountries() {
    const res = await api.listCountries();
    if (res.success) setCountries((res.data || []).filter((c: Country) => c.is_active));
  }

  async function load() {
    setLoading(true);
    const res = await api.listStates(filterCountry || undefined);
    if (res.success) setStates(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({ country_id: filterCountry || '', name: '', state_code: '' });
    setDialogOpen(true);
  }

  function openEdit(s: State) {
    setEditing(s);
    reset({ country_id: s.country_id, name: s.name, state_code: s.state_code || '' });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = {
      ...data,
      country_id: parseInt(data.country_id),
    };

    const res = editing
      ? await api.updateState(editing.id, payload)
      : await api.createState(payload);

    if (res.success) {
      toast.success(editing ? 'State updated' : 'State created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(s: State) {
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    const res = await api.deleteState(s.id);
    if (res.success) { toast.success('State deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(s: State) {
    const res = await api.updateState(s.id, { is_active: !s.is_active });
    if (res.success) { toast.success(`State ${!s.is_active ? 'activated' : 'deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="States / Provinces"
        description="Manage states and provinces within countries"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add state</Button>}
      />

      {/* Country filter */}
      <div className="mb-4">
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterCountry}
          onChange={e => setFilterCountry(e.target.value ? parseInt(e.target.value) : '')}
        >
          <option value="">All countries</option>
          {countries.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.iso2})</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : states.length === 0 ? (
        <EmptyState icon={MapPin} title="No states yet" description={filterCountry ? "No states in this country" : "Add your first state"} action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add state</Button>} />
      ) : (
        <div className="grid gap-3">
          {states.map(s => (
            <Card key={s.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{s.name}</h3>
                    {s.state_code && <Badge variant="muted" className="font-mono">{s.state_code}</Badge>}
                    {!s.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Globe2 className="w-3 h-3" />
                    {s.countries?.name || 'Unknown country'}
                    {s.countries?.iso2 && <span className="text-slate-400">({s.countries.iso2})</span>}
                  </div>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit State' : 'Add State'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('country_id', { required: true })}
            >
              <option value="">Select country</option>
              {countries.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.iso2})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="State Name" placeholder="Gujarat" {...register('name', { required: true })} />
            <Input label="State Code" placeholder="GJ" maxLength={10} {...register('state_code')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create state'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
