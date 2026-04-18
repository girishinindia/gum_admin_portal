"use client";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Building2, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { City, State, Country } from '@/lib/types';

type SortField = 'id' | 'name' | 'phonecode' | 'timezone' | 'is_active';

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<City | null>(null);
  const [viewing, setViewing] = useState<City | null>(null);

  // Filters
  const [filterCountry, setFilterCountry] = useState<number | ''>('');
  const [filterState, setFilterState] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState('');

  // Pagination, search, sort
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; total: number; updated_at: string } | null>(null);

  // Form-level state dropdown (filtered by selected country in dialog)
  const [formCountry, setFormCountry] = useState<number | ''>('');
  const [formStates, setFormStates] = useState<State[]>([]);

  const { register, handleSubmit, reset, setValue } = useForm();

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDebounce, filterState, filterStatus, pageSize]);

  useEffect(() => { loadCountries(); }, []);
  useEffect(() => { loadStates(); }, [filterCountry]);
  useEffect(() => {
    api.getTableSummary('cities').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterState, filterStatus, sortField, sortOrder]);

  async function loadCountries() {
    const res = await api.listCountries('?limit=100');
    if (res.success) setCountries((res.data || []).filter((c: Country) => c.is_active));
  }

  async function loadStates() {
    const res = await api.listStates(filterCountry ? `?country_id=${filterCountry}&limit=100` : '?limit=100');
    if (res.success) setStates((res.data || []).filter((s: State) => s.is_active));
    setFilterState('');
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterState) qs.set('state_id', String(filterState));
    if (filterStatus) qs.set('is_active', filterStatus);
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listCities('?' + qs.toString());
    if (res.success) {
      setCities(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('cities');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  // Load states for the dialog form when a country is selected
  async function loadFormStates(countryId: number) {
    const res = await api.listStates(`?country_id=${countryId}&limit=100`);
    if (res.success) setFormStates((res.data || []).filter((s: State) => s.is_active));
    else setFormStates([]);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
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

  function openView(c: City) {
    setViewing(c);
  }

  async function onSubmit(data: any) {
    const payload = { ...data, state_id: parseInt(data.state_id) };
    delete payload.form_country;

    const res = editing
      ? await api.updateCity(editing.id, payload)
      : await api.createCity(payload);

    if (res.success) {
      toast.success(editing ? 'City updated' : 'City created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(c: City) {
    if (!confirm(`Delete "${c.name}"? This cannot be undone.`)) return;
    const res = await api.deleteCity(c.id);
    if (res.success) { toast.success('City deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: City) {
    const res = await api.updateCity(c.id, { is_active: !c.is_active });
    if (res.success) { toast.success(`City ${!c.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  const hasFilters = !!(searchDebounce || filterCountry || filterState || filterStatus);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cities"
        description="Manage cities within states"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add city</Button>}
      />

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Cities', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', card.color)}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-medium">{card.label}</div>
                  <div className="text-xl font-bold text-slate-900 leading-tight">{card.value.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar: search + filters */}
      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search cities...">
        <select className={selectClass} value={filterCountry} onChange={e => setFilterCountry(e.target.value ? parseInt(e.target.value) : '')}>
          <option value="">All Countries</option>
          {countries.map(c => <option key={c.id} value={c.id}>{c.name} ({c.iso2})</option>)}
        </select>
        <select className={selectClass} value={filterState} onChange={e => setFilterState(e.target.value ? parseInt(e.target.value) : '')}>
          <option value="">All States</option>
          {states.map(s => <option key={s.id} value={s.id}>{s.name}{s.state_code ? ` (${s.state_code})` : ''}</option>)}
        </select>
        <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </DataToolbar>

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : cities.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No cities yet"
          description={hasFilters ? 'No cities match your filters' : 'Add your first city'}
          action={!hasFilters ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add city</Button> : undefined}
        />
      ) : (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH>
                  <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    City Name <SortIcon field="name" />
                  </button>
                </TH>
                <TH>State</TH>
                <TH>Country</TH>
                <TH>
                  <button onClick={() => handleSort('phonecode')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Phone Code <SortIcon field="phonecode" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('timezone')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Timezone <SortIcon field="timezone" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Status <SortIcon field="is_active" />
                  </button>
                </TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {cities.map(c => (
                <TR key={c.id}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">
                    <span className="font-medium text-slate-900">{c.name}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600">
                      {c.states?.name || '—'}
                      {c.states?.state_code && <span className="text-slate-400 ml-1">({c.states.state_code})</span>}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600">
                      {c.states?.countries?.name || '—'}
                      {c.states?.countries?.iso2 && <span className="text-slate-400 ml-1">({c.states.countries.iso2})</span>}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600">{c.phonecode || '—'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600 text-xs">{c.timezone || '—'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <Badge variant={c.is_active ? 'success' : 'danger'}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(c)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            total={total}
            showingCount={cities.length}
          />
        </div>
      )}

      {/* ── View City Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="City Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {viewing.phonecode && <Badge variant="muted" className="font-mono">{viewing.phonecode}</Badge>}
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="State" value={viewing.states?.name ? `${viewing.states.name}${viewing.states.state_code ? ` (${viewing.states.state_code})` : ''}` : undefined} />
              <DetailRow label="Country" value={viewing.states?.countries?.name ? `${viewing.states.countries.name} (${viewing.states.countries.iso2})` : undefined} />
              <DetailRow label="Phone Code" value={viewing.phonecode} />
              <DetailRow label="Timezone" value={viewing.timezone} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order)} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit City' : 'Add City'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This city is currently active' : 'This city is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getCity(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  editing.is_active ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          )}

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
              {countries.map(c => <option key={c.id} value={c.id}>{c.name} ({c.iso2})</option>)}
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
              {formStates.map(s => <option key={s.id} value={s.id}>{s.name}{s.state_code ? ` (${s.state_code})` : ''}</option>)}
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

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
