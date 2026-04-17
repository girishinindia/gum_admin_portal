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
import { Plus, GitBranch, Trash2, Edit2 } from 'lucide-react';
import type { Branch, Country, State, City } from '@/lib/types';

const BRANCH_TYPES = ['headquarters', 'office', 'campus', 'remote', 'warehouse', 'other'];

export default function BranchesPage() {
  const [items, setItems] = useState<Branch[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [dialogStates, setDialogStates] = useState<State[]>([]);
  const [dialogCities, setDialogCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  const { register, handleSubmit, reset, watch, setValue } = useForm();
  const watchCountry = watch('country_id');
  const watchState = watch('state_id');

  // Load countries on mount
  useEffect(() => {
    api.listCountries('?limit=100').then(res => { if (res.success) setCountries(res.data || []); });
  }, []);

  // Load states based on filter country
  useEffect(() => {
    if (filterCountry) {
      api.listStates(`?country_id=${filterCountry}&limit=100`).then(res => { if (res.success) setStates(res.data || []); });
    } else {
      setStates([]);
    }
    setFilterState('');
    setFilterCity('');
  }, [filterCountry]);

  // Load cities based on filter state
  useEffect(() => {
    if (filterState) {
      api.listCities(`?state_id=${filterState}&limit=100`).then(res => { if (res.success) setCities(res.data || []); });
    } else {
      setCities([]);
    }
    setFilterCity('');
  }, [filterState]);

  // Load dialog states based on dialog country
  useEffect(() => {
    if (watchCountry) {
      api.listStates(`?country_id=${watchCountry}&limit=100`).then(res => { if (res.success) setDialogStates(res.data || []); });
      setValue('state_id', '');
      setValue('city_id', '');
    } else {
      setDialogStates([]);
    }
  }, [watchCountry, setValue]);

  // Load dialog cities based on dialog state
  useEffect(() => {
    if (watchState) {
      api.listCities(`?state_id=${watchState}&limit=100`).then(res => { if (res.success) setDialogCities(res.data || []); });
      setValue('city_id', '');
    } else {
      setDialogCities([]);
    }
  }, [watchState, setValue]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter/search change
  useEffect(() => { setPage(1); }, [searchDebounce, filterCountry, filterState, filterCity, filterType]);

  // Load branches
  useEffect(() => { load(); }, [searchDebounce, page, filterCountry, filterState, filterCity, filterType]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterCountry) qs.set('country_id', filterCountry);
    if (filterState) qs.set('state_id', filterState);
    if (filterCity) qs.set('city_id', filterCity);
    if (filterType) qs.set('branch_type', filterType);
    const res = await api.listBranches('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setDialogKey(k => k + 1);
    reset({
      country_id: countries[0]?.id || '',
      state_id: '',
      city_id: '',
      branch_manager_id: '',
      name: '',
      code: '',
      branch_type: 'office',
      address_line_1: '',
      address_line_2: '',
      pincode: '',
      phone: '',
      email: '',
      website: '',
      google_maps_url: ''
    });
    setDialogOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setDialogKey(k => k + 1);
    reset({
      country_id: branch.country_id || '',
      state_id: branch.state_id || '',
      city_id: branch.city_id || '',
      branch_manager_id: branch.branch_manager_id || '',
      name: branch.name,
      code: branch.code,
      branch_type: branch.branch_type,
      address_line_1: branch.address_line_1 || '',
      address_line_2: branch.address_line_2 || '',
      pincode: branch.pincode || '',
      phone: branch.phone || '',
      email: branch.email || '',
      website: branch.website || '',
      google_maps_url: branch.google_maps_url || ''
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = {
      country_id: data.country_id ? Number(data.country_id) : null,
      state_id: data.state_id ? Number(data.state_id) : null,
      city_id: data.city_id ? Number(data.city_id) : null,
      branch_manager_id: data.branch_manager_id ? Number(data.branch_manager_id) : null,
      name: data.name,
      code: data.code,
      branch_type: data.branch_type,
      address_line_1: data.address_line_1 || null,
      address_line_2: data.address_line_2 || null,
      pincode: data.pincode || null,
      phone: data.phone || null,
      email: data.email || null,
      website: data.website || null,
      google_maps_url: data.google_maps_url || null
    };

    const res = editing
      ? await api.updateBranch(editing.id, payload)
      : await api.createBranch(payload);
    if (res.success) {
      toast.success(editing ? 'Branch updated' : 'Branch created');
      setDialogOpen(false);
      load();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(branch: Branch) {
    if (!confirm(`Delete "${branch.name}"?`)) return;
    const res = await api.deleteBranch(branch.id);
    if (res.success) { toast.success('Deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(branch: Branch) {
    const res = await api.updateBranch(branch.id, { is_active: !branch.is_active });
    if (res.success) { toast.success(`${!branch.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Branches" description="Manage organization branches and offices"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add branch</Button>} />

      <div className="mb-4">
        <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search branches...">
          <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
            <option value="">All countries</option>
            {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {filterCountry && (
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={filterState} onChange={e => setFilterState(e.target.value)}>
              <option value="">All states</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {filterState && (
            <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={filterCity} onChange={e => setFilterCity(e.target.value)}>
              <option value="">All cities</option>
              {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            {BRANCH_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </DataToolbar>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={GitBranch} title="No branches yet" description={filterCountry ? 'No branches in this location' : 'Add your first branch'}
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add branch</Button>} />
      ) : (
        <>
          <div className="grid gap-3">
            {items.map(branch => (
              <Card key={branch.id} className="p-4 hover:shadow-card-hover transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                    <GitBranch className="w-6 h-6 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold text-slate-900">{branch.name}</h3>
                      <Badge variant="muted" className="font-mono">{branch.code}</Badge>
                      <Badge variant="info">{branch.branch_type.charAt(0).toUpperCase() + branch.branch_type.slice(1)}</Badge>
                      {branch.countries?.name && <Badge variant="secondary">{branch.countries.name}</Badge>}
                      {branch.states?.name && <Badge variant="secondary">{branch.states.name}</Badge>}
                      {branch.cities?.name && <Badge variant="secondary">{branch.cities.name}</Badge>}
                      {!branch.is_active && <Badge variant="danger">Inactive</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                      {branch.address_line_1 && <p>{branch.address_line_1}</p>}
                      {branch.phone && <p>Phone: {branch.phone}</p>}
                      {branch.email && <p>Email: {branch.email}</p>}
                      {branch.website && <p>Web: {branch.website}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onToggleActive(branch)}>
                      {branch.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <button type="button" onClick={() => openEdit(branch)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => onDelete(branch)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Branch' : 'Add Branch'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('country_id')}>
              <option value="">Select country</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {watchCountry && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('state_id')}>
                <option value="">Select state</option>
                {dialogStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {watchState && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('city_id')}>
                <option value="">Select city</option>
                {dialogCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <Input label="Name" placeholder="Mumbai Office, NYC Headquarters..." {...register('name', { required: true })} />
          <Input label="Code" placeholder="MUM-01, NYC-HQ" {...register('code', { required: true })} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Branch Type</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('branch_type', { required: true })}>
              {BRANCH_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>

          <Input label="Address Line 1" placeholder="123 Main Street" {...register('address_line_1')} />
          <Input label="Address Line 2" placeholder="Suite 100, Floor 5" {...register('address_line_2')} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Pincode" placeholder="400001" {...register('pincode')} />
            <Input label="Phone" placeholder="+91 22 1234 5678" {...register('phone')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" placeholder="office@company.com" {...register('email')} />
            <Input label="Website" placeholder="https://office.company.com" {...register('website')} />
          </div>

          <Input label="Google Maps URL" placeholder="https://maps.google.com/..." {...register('google_maps_url')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
