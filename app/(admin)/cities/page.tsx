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
import { Plus, Building2, Trash2, Edit2, MapPin, Globe2 } from 'lucide-react';
import type { City, State, Country } from '@/lib/types';

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<City | null>(null);

  // Filters
  const [filterCountry, setFilterCountry] = useState<number | ''>('');
  const [filterState, setFilterState] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  // Form-level state dropdown (filtered by selected country in dialog)
  const [formCountry, setFormCountry] = useState<number | ''>('');
  const [formStates, setFormStates] = useState<State[]>([]);

  const { register, handleSubmit, reset, setValue } = useForm();

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDebounce, filterState]);

  useEffect(() => { loadCountries(); }, []);
  useEffect(() => { loadStates(); }, [filterCountry]);
  useEffect(() => { load(); }, [searchDebounce, page, filterState]);

  async function loadCountries() {
    const res = await api.listCountries('?limit=100');
    if (res.success) setCountries((res.data || []).filter((c: Country) => c.is_active));
  }

  async function loadStates() {
    const res = await api.listStates(filterCountry ? `?country_id=${filterCountry}&limit=100` : '?limit=100');
    if (res.success) setStates((res.data || []).filter((s: State) => s.is_active));
    // Reset state filter when country changes
    setFilterState('');
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', '20');
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterState) qs.set('state_id', String(filterState));
    const res = await api.listCities('?' + qs.toString());
    if (res.success) {
      setCities(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  // Load states for the dialog form when a country is selected
  async function loadFormStates(countryId: number) {
    const res = await api.listStates(`?country_id=${countryId}&limit=100`);
    if (res.success) setFormStates((res.data || []).filter((s: State) => s.is_active));
    else setFormStates([]);
  }

  function openCreate() {
    setEditing(null);
    setFormCountry('');
    setFormStates([]);
    reset({ state_id: '', name: '', phonecode: '', timezone: '' });
    setDialogOpen(true);
  }

  function openEdit(c: City) {
    setEditing(c);
    const countryId = c.states?.country_id;
    if (countryId) {
      setFormCountry(countryId);
      loadFormStates(countryId);
    }
    reset({ state_id: c.state_id, name: c.name, phonecode: c.phonecode || '', timezone: c.timezone || '' });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = {
      ...data,
      state_id: parseInt(data.state_id),
    };
    // Remove formCountry helper field
    delete payload.form_country;

    const res = editing
      ? await api.updateCity(editing.id, payload)
      : await api.createCity(payload);

    if (res.success) {
      toast.success(editing ? 'City updated' : 'City created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(c: City) {
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    const res = await api.deleteCity(c.id);
    if (res.success) { toast.success('City deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: City) {
    const res = await api.updateCity(c.id, { is_active: !c.is_active });
    if (res.success) { toast.success(`City ${!c.is_active ? 'activated' : 'deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cities"
        description="Manage cities within states"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add city</Button>}
      />

      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search cities..."
      >
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
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterState}
          onChange={e => setFilterState(e.target.value ? parseInt(e.target.value) : '')}
        >
          <option value="">All states</option>
          {states.map(s => (
            <option key={s.id} value={s.id}>{s.name}{s.state_code ? ` (${s.state_code})` : ''}</option>
          ))}
        </select>
      </DataToolbar>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : cities.length === 0 ? (
        <EmptyState icon={Building2} title="No cities yet" description={filterState ? "No cities in this state" : "Add your first city"} action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add city</Button>} />
      ) : (
        <div className="grid gap-3">
          {cities.map(c => (
            <Card key={c.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{c.name}</h3>
                    {c.phonecode && <Badge variant="muted" className="font-mono">{c.phonecode}</Badge>}
                    {c.timezone && <Badge variant="info">{c.timezone}</Badge>}
                    {!c.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {c.states?.name || 'Unknown state'}
                      {c.states?.state_code && <span className="text-slate-400">({c.states.state_code})</span>}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-1">
                      <Globe2 className="w-3 h-3" />
                      {c.states?.countries?.name || 'Unknown'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(c)}>
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(c)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(c)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit City' : 'Add City'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Country selector (helper — not submitted) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={formCountry}
              onChange={e => {
                const val = e.target.value ? parseInt(e.target.value) : '';
                setFormCountry(val);
                setFormStates([]);
                setValue('state_id', '');
                if (val) loadFormStates(val as number);
              }}
            >
              <option value="">Select country first</option>
              {countries.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.iso2})</option>
              ))}
            </select>
          </div>

          {/* State selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('state_id', { required: true })}
            >
              <option value="">{formCountry ? 'Select state' : 'Select country first'}</option>
              {formStates.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.state_code ? ` (${s.state_code})` : ''}</option>
              ))}
            </select>
          </div>

          <Input label="City Name" placeholder="Surat" {...register('name', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone Code" placeholder="0261" {...register('phonecode')} />
            <Input label="Timezone" placeholder="Asia/Kolkata" {...register('timezone')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create city'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
