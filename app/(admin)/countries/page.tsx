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
import { Plus, Globe2, Trash2, Edit2 } from 'lucide-react';
import type { Country } from '@/lib/types';

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await api.listCountries();
    if (res.success) setCountries(res.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setImageBlob(null);
    setImagePreview(null);
    reset({ name: '', iso2: '', iso3: '', phone_code: '', nationality: '', currency: '', currency_symbol: '' });
    setDialogOpen(true);
  }

  function openEdit(c: Country) {
    setEditing(c);
    setImageBlob(null);
    setImagePreview(null);
    reset({
      name: c.name, iso2: c.iso2, iso3: c.iso3, phone_code: c.phone_code, nationality: c.nationality,
      currency: c.currency, currency_symbol: c.currency_symbol, currency_name: c.currency_name, tld: c.tld,
      national_language: c.national_language,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => { if (data[k]) fd.append(k, data[k]); });
    if (imageBlob) fd.append('flag_image', imageBlob, 'flag.webp');

    const res = editing
      ? await api.updateCountry(editing.id, fd, true)
      : await api.createCountry(fd, true);

    if (res.success) {
      toast.success(editing ? 'Country updated' : 'Country created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(c: Country) {
    if (!confirm(`Delete "${c.name}"? Flag image will also be removed.`)) return;
    const res = await api.deleteCountry(c.id);
    if (res.success) { toast.success('Country deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: Country) {
    const fd = new FormData();
    fd.append('is_active', String(!c.is_active));
    const res = await api.updateCountry(c.id, fd, true);
    if (res.success) { toast.success(`Country ${!c.is_active ? 'activated' : 'deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Countries"
        description="Manage countries, currencies, and flag images"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add country</Button>}
      />

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : countries.length === 0 ? (
        <EmptyState icon={Globe2} title="No countries yet" description="Add your first country" action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add country</Button>} />
      ) : (
        <div className="grid gap-3">
          {countries.map(c => (
            <Card key={c.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-14 h-10 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                  {c.flag_image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.flag_image} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <Globe2 className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{c.name}</h3>
                    <Badge variant="muted" className="font-mono">{c.iso2} · {c.iso3}</Badge>
                    {c.currency && <Badge variant="info">{c.currency_symbol} {c.currency}</Badge>}
                    {!c.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {c.phone_code && `${c.phone_code} · `}{c.nationality && `${c.nationality} · `}{c.national_language}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(c)}>
                    {c.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button onClick={() => openEdit(c)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(c)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Country' : 'Add Country'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <ImageUpload
            label="Flag Image"
            hint="Crop to 4:3 ratio, resized to max 200×150px WebP on server"
            value={editing?.flag_image}
            aspectRatio={4 / 3}
            maxWidth={800}
            maxHeight={600}
            shape="rounded"
            onChange={(blob, preview) => { setImageBlob(blob); setImagePreview(preview); }}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="United States" {...register('name', { required: true })} />
            <Input label="Nationality" placeholder="American" {...register('nationality')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="ISO-2" placeholder="US" maxLength={2} {...register('iso2', { required: true })} />
            <Input label="ISO-3" placeholder="USA" maxLength={3} {...register('iso3', { required: true })} />
            <Input label="Phone Code" placeholder="+1" {...register('phone_code')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Currency" placeholder="USD" maxLength={3} {...register('currency')} />
            <Input label="Symbol" placeholder="$" maxLength={3} {...register('currency_symbol')} />
            <Input label="TLD" placeholder=".us" {...register('tld')} />
          </div>
          <Input label="Currency Name" placeholder="US Dollar" {...register('currency_name')} />
          <Input label="National Language" placeholder="English" {...register('national_language')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create country'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
