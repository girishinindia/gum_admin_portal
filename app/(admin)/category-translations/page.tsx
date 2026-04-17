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
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, BookOpen, Trash2, Edit2, Globe, Wand2 } from 'lucide-react';
import type { CategoryTranslation, Category, Language } from '@/lib/types';

const TABS = ['Content', 'SEO Meta', 'Open Graph', 'Twitter'] as const;

export default function CategoryTranslationsPage() {
  const [items, setItems] = useState<CategoryTranslation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryTranslation | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Content');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  const { register, handleSubmit, reset, setValue, getValues } = useForm();

  const SITE_URL = 'https://growupmore.com';
  const SITE_NAME = 'GrowUpMore';

  function handleGenerateSD() {
    const v = getValues();
    const cat = categories.find(c => String(c.id) === String(v.category_id));
    const lang = languages.find(l => String(l.id) === String(v.language_id));
    const isoCode = lang?.iso_code || 'en';
    const slug = cat?.slug || 'category';
    const pageUrl = v.canonical_url || `${SITE_URL}/${isoCode}/categories/${slug}`;

    const sd = [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: v.name || cat?.name || '',
        ...(v.description && { description: v.description }),
        url: pageUrl,
        inLanguage: isoCode,
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/${isoCode}` },
          { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE_URL}/${isoCode}/categories` },
          { '@type': 'ListItem', position: 3, name: v.name || cat?.name || '' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: v.name || cat?.name || '',
        numberOfItems: 0,
        itemListElement: [],
      },
    ];

    setValue('structured_data', JSON.stringify(sd, null, 2));
    toast.success('Structured data generated');
  }

  useEffect(() => {
    api.listCategories('?limit=100').then(res => { if (res.success) setCategories((res.data || []).filter((c: Category) => c.is_active)); });
    api.listLanguages('?for_material=true&limit=100').then(res => { if (res.success) setLanguages((res.data || []).filter((l: Language) => l.is_active)); });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDebounce, filterCategory, filterLanguage]);
  useEffect(() => { load(); }, [searchDebounce, page, filterCategory, filterLanguage]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterCategory) qs.set('category_id', filterCategory);
    if (filterLanguage) qs.set('language_id', filterLanguage);
    const res = await api.listCategoryTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1); setActiveTab('Content');
    reset({
      category_id: categories[0]?.id || '', language_id: languages[0]?.id || '',
      name: '', description: '', is_new_title: '', tags: '',
      meta_title: '', meta_description: '', meta_keywords: '', canonical_url: '',
      og_site_name: '', og_title: '', og_description: '', og_type: '', og_image: '', og_url: '',
      twitter_site: '', twitter_title: '', twitter_description: '', twitter_image: '', twitter_card: 'summary_large_image',
      robots_directive: 'index,follow', focus_keyword: '', structured_data: '[]',
      sort_order: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(item: CategoryTranslation) {
    setEditing(item); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1); setActiveTab('Content');
    const tags = Array.isArray(item.tags) ? item.tags.join(', ') : '';
    const sd = item.structured_data ? JSON.stringify(item.structured_data, null, 2) : '[]';
    reset({
      category_id: item.category_id, language_id: item.language_id,
      name: item.name, description: item.description || '', is_new_title: item.is_new_title || '', tags,
      meta_title: item.meta_title || '', meta_description: item.meta_description || '',
      meta_keywords: item.meta_keywords || '', canonical_url: item.canonical_url || '',
      og_site_name: item.og_site_name || '', og_title: item.og_title || '',
      og_description: item.og_description || '', og_type: item.og_type || '',
      og_image: item.og_image || '', og_url: item.og_url || '',
      twitter_site: item.twitter_site || '', twitter_title: item.twitter_title || '',
      twitter_description: item.twitter_description || '', twitter_image: item.twitter_image || '',
      twitter_card: item.twitter_card || 'summary_large_image',
      robots_directive: item.robots_directive || 'index,follow', focus_keyword: item.focus_keyword || '',
      structured_data: sd, sort_order: item.sort_order,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    // Convert tags string to JSON array
    const tagsArr = data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    data.tags = JSON.stringify(tagsArr);
    // Keep structured_data as string (will be parsed on server)
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) fd.append('image', imageFile, imageFile.name);

    const res = editing
      ? await api.updateCategoryTranslation(editing.id, fd, true)
      : await api.createCategoryTranslation(fd, true);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(item: CategoryTranslation) {
    if (!confirm(`Delete translation "${item.name}"?`)) return;
    const res = await api.deleteCategoryTranslation(item.id);
    if (res.success) { toast.success('Deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: CategoryTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateCategoryTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Category Translations" description="Manage multi-language translations for categories"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button>} />

      <div className="mb-4">
        <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search translations...">
          <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
            <option value="">All languages</option>
            {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
          </select>
        </DataToolbar>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={BookOpen} title="No translations yet" description="Add your first category translation"
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button>} />
      ) : (
        <>
          <div className="grid gap-3">
            {items.map(item => (
              <Card key={item.id} className="p-4 hover:shadow-card-hover transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Globe className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display font-semibold text-slate-900">{item.name}</h3>
                      {item.categories?.name && <Badge variant="info">{item.categories.name}</Badge>}
                      {item.languages?.name && <Badge variant="muted">{item.languages.name}{item.languages.iso_code ? ` (${item.languages.iso_code})` : ''}</Badge>}
                      {!item.is_active && <Badge variant="danger">Inactive</Badge>}
                    </div>
                    {item.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onToggleActive(item)}>
                      {item.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <button type="button" onClick={() => openEdit(item)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => onDelete(item)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Category Translation' : 'Add Category Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 pb-0">
            {TABS.map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Content Tab */}
          {activeTab === 'Content' && (
            <div className="space-y-4">
              <ImageUpload key={dialogKey} label="Translation Image" hint="Resized to 400x400px WebP"
                value={editing?.image} aspectRatio={1} maxWidth={400} maxHeight={400} shape="rounded"
                onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    {...register('category_id', { required: true })}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    {...register('language_id', { required: true })}>
                    {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <Input label="Translated Name" placeholder="Category name in target language" {...register('name', { required: true })} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
                  placeholder="Translated description..." {...register('description')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="New Badge Title" placeholder="Custom 'New' label" {...register('is_new_title')} />
                <Input label="Sort Order" type="number" {...register('sort_order')} />
              </div>
              <Input label="Tags" placeholder="tag1, tag2, tag3 (comma-separated)" {...register('tags')} />
            </div>
          )}

          {/* SEO Meta Tab */}
          {activeTab === 'SEO Meta' && (
            <div className="space-y-4">
              <Input label="Meta Title" placeholder="SEO title" {...register('meta_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Meta Description</label>
                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
                  placeholder="SEO description..." {...register('meta_description')} />
              </div>
              <Input label="Meta Keywords" placeholder="keyword1, keyword2" {...register('meta_keywords')} />
              <Input label="Canonical URL" placeholder="https://..." {...register('canonical_url')} />
              <Input label="Robots Directive" placeholder="index,follow" {...register('robots_directive')} />
              <Input label="Focus Keyword" placeholder="Primary SEO keyword" {...register('focus_keyword')} />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Structured Data (JSON-LD)</label>
                  <Button type="button" size="sm" variant="outline" onClick={handleGenerateSD}>
                    <Wand2 className="w-3.5 h-3.5" /> Generate
                  </Button>
                </div>
                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[160px] font-mono"
                  placeholder='[{"@type": "..."}]' {...register('structured_data')} />
                <p className="text-xs text-slate-400 mt-1">Auto-generates CollectionPage + BreadcrumbList + ItemList from the Content tab fields. You can edit the JSON after generating.</p>
              </div>
            </div>
          )}

          {/* Open Graph Tab */}
          {activeTab === 'Open Graph' && (
            <div className="space-y-4">
              <Input label="OG Site Name" placeholder="Site name" {...register('og_site_name')} />
              <Input label="OG Title" placeholder="Open Graph title" {...register('og_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">OG Description</label>
                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
                  placeholder="Open Graph description..." {...register('og_description')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="OG Type" placeholder="website" {...register('og_type')} />
                <Input label="OG URL" placeholder="https://..." {...register('og_url')} />
              </div>
              <Input label="OG Image URL" placeholder="https://..." {...register('og_image')} />
            </div>
          )}

          {/* Twitter Tab */}
          {activeTab === 'Twitter' && (
            <div className="space-y-4">
              <Input label="Twitter Site" placeholder="@handle" {...register('twitter_site')} />
              <Input label="Twitter Title" placeholder="Twitter card title" {...register('twitter_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Twitter Description</label>
                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[80px]"
                  placeholder="Twitter card description..." {...register('twitter_description')} />
              </div>
              <Input label="Twitter Image URL" placeholder="https://..." {...register('twitter_image')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Twitter Card Type</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  {...register('twitter_card')}>
                  <option value="summary_large_image">Summary Large Image</option>
                  <option value="summary">Summary</option>
                  <option value="app">App</option>
                  <option value="player">Player</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
