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
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, BookMarked, Trash2, Edit2, Globe, Wand2, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubCategoryTranslation, SubCategory, Language } from '@/lib/types';

const TABS = ['Content', 'SEO Meta', 'Open Graph', 'Twitter'] as const;
type SortField = 'id' | 'name' | 'is_active' | 'sort_order';

export default function SubCategoryTranslationsPage() {
  const [items, setItems] = useState<SubCategoryTranslation[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubCategoryTranslation | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
  const [ogImagePreview, setOgImagePreview] = useState<string | null>(null);
  const [twitterImageFile, setTwitterImageFile] = useState<File | null>(null);
  const [twitterImagePreview, setTwitterImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Content');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(10);
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; total: number } | null>(null);

  const { register, handleSubmit, reset, setValue, getValues } = useForm();

  const SITE_URL = 'https://growupmore.com';
  const SITE_NAME = 'GrowUpMore';

  function handleGenerateSD() {
    const v = getValues();
    const sc = subCategories.find(s => String(s.id) === String(v.sub_category_id));
    const lang = languages.find(l => String(l.id) === String(v.language_id));
    const isoCode = lang?.iso_code || 'en';
    const subCatSlug = sc?.slug || 'sub-category';
    const catSlug = sc?.categories?.code?.toLowerCase() || 'category';
    const catName = sc?.categories?.name || 'Category';
    const pageUrl = v.canonical_url || `${SITE_URL}/${isoCode}/categories/${catSlug}/${subCatSlug}`;

    const sd = [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: v.name || sc?.name || '',
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
          { '@type': 'ListItem', position: 3, name: catName, item: `${SITE_URL}/${isoCode}/categories/${catSlug}` },
          { '@type': 'ListItem', position: 4, name: v.name || sc?.name || '' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: v.name || sc?.name || '',
        numberOfItems: 0,
        itemListElement: [],
      },
    ];

    setValue('structured_data', JSON.stringify(sd, null, 2));
    toast.success('Structured data generated');
  }

  useEffect(() => {
    api.listSubCategories('?limit=100').then(res => { if (res.success) setSubCategories((res.data || []).filter((sc: SubCategory) => sc.is_active)); });
    api.listLanguages('?for_material=true&limit=100').then(res => { if (res.success) setLanguages((res.data || []).filter((l: Language) => l.is_active)); });
    refreshSummary();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDebounce, filterSubCategory, filterLanguage, filterStatus, sortField, sortOrder, pageSize]);
  useEffect(() => { load(); }, [searchDebounce, page, filterSubCategory, filterLanguage, filterStatus, sortField, sortOrder, pageSize]);

  async function refreshSummary() {
    const res = await api.getTableSummary('sub_category_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterSubCategory) qs.set('sub_category_id', filterSubCategory);
    if (filterLanguage) qs.set('language_id', filterLanguage);
    if (filterStatus) qs.set('is_active', filterStatus);
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listSubCategoryTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null); setImageFile(null); setImagePreview(null); setOgImageFile(null); setOgImagePreview(null); setTwitterImageFile(null); setTwitterImagePreview(null); setDialogKey(k => k + 1); setActiveTab('Content');
    reset({
      sub_category_id: subCategories[0]?.id || '', language_id: languages[0]?.id || '',
      name: '', description: '', is_new_title: '', tags: '',
      meta_title: '', meta_description: '', meta_keywords: '', canonical_url: '',
      og_site_name: '', og_title: '', og_description: '', og_type: '', og_image: '', og_url: '',
      twitter_site: '', twitter_title: '', twitter_description: '', twitter_image: '', twitter_card: 'summary_large_image',
      robots_directive: 'index,follow', focus_keyword: '', structured_data: '[]',
      sort_order: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(item: SubCategoryTranslation) {
    setEditing(item); setImageFile(null); setImagePreview(null); setOgImageFile(null); setOgImagePreview(null); setTwitterImageFile(null); setTwitterImagePreview(null); setDialogKey(k => k + 1); setActiveTab('Content');
    const tags = Array.isArray(item.tags) ? item.tags.join(', ') : '';
    const sd = item.structured_data ? JSON.stringify(item.structured_data, null, 2) : '[]';
    reset({
      sub_category_id: item.sub_category_id, language_id: item.language_id,
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
    const tagsArr = data.tags ? data.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
    data.tags = JSON.stringify(tagsArr);
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) fd.append('image', imageFile, imageFile.name);
    if (ogImageFile) fd.append('og_image_file', ogImageFile, ogImageFile.name);
    if (twitterImageFile) fd.append('twitter_image_file', twitterImageFile, twitterImageFile.name);

    const res = editing
      ? await api.updateSubCategoryTranslation(editing.id, fd, true)
      : await api.createSubCategoryTranslation(fd, true);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(item: SubCategoryTranslation) {
    if (!confirm(`Delete translation "${item.name}"?`)) return;
    const res = await api.deleteSubCategoryTranslation(item.id);
    if (res.success) { toast.success('Deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: SubCategoryTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateSubCategoryTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Sub-Category Translations" description="Manage multi-language translations for sub-categories"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button>} />

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Translations', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      <div className="mb-4">
        <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search translations...">
          <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterSubCategory} onChange={e => setFilterSubCategory(e.target.value)}>
            <option value="">All sub-categories</option>
            {subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.name}{sc.categories?.name ? ` (${sc.categories.name})` : ''}</option>)}
          </select>
          <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
            <option value="">All languages</option>
            {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
          </select>
          <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </DataToolbar>
      </div>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={BookMarked} title="No translations yet" description="Add your first sub-category translation"
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button>} />
      ) : (
        <>
          <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                  <TH className="w-14">Image</TH>
                  <TH><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
                  <TH>Sub-Category</TH>
                  <TH>Language</TH>
                  <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map(item => (
                  <TR key={item.id}>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                    <TD className="py-2.5">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                        {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Globe className="w-4 h-4 text-slate-300" />}
                      </div>
                    </TD>
                    <TD className="py-2.5"><span className="font-medium text-slate-900">{item.name}</span>{item.description && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{item.description}</p>}</TD>
                    <TD className="py-2.5">
                      {item.sub_categories?.name ? <Badge variant="info">{item.sub_categories.name}</Badge> : <span className="text-slate-300">—</span>}
                      {item.sub_categories?.categories?.name && <div className="text-xs text-slate-400 mt-0.5">{item.sub_categories.categories.name}</div>}
                    </TD>
                    <TD className="py-2.5">{item.languages?.name ? <Badge variant="muted">{item.languages.name}{item.languages.iso_code ? ` (${item.languages.iso_code})` : ''}</Badge> : <span className="text-slate-300">—</span>}</TD>
                    <TD className="py-2.5"><Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge></TD>
                    <TD className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => onDelete(item)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => setPageSize(s)} total={total} showingCount={items.length} />
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Sub-Category Translation' : 'Add Sub-Category Translation'} size="lg">
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Category</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    {...register('sub_category_id', { required: true })}>
                    {subCategories.map(sc => <option key={sc.id} value={sc.id}>{sc.name}{sc.categories?.name ? ` (${sc.categories.name})` : ''}</option>)}
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
              <Input label="Translated Name" placeholder="Sub-category name in target language" {...register('name', { required: true })} />
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Robots Directive</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  {...register('robots_directive')}>
                  <option value="index,follow">index, follow (default)</option>
                  <option value="noindex,follow">noindex, follow</option>
                  <option value="index,nofollow">index, nofollow</option>
                  <option value="noindex,nofollow">noindex, nofollow</option>
                  <option value="noindex">noindex</option>
                  <option value="nofollow">nofollow</option>
                  <option value="none">none</option>
                  <option value="noarchive">noarchive</option>
                  <option value="nosnippet">nosnippet</option>
                  <option value="noimageindex">noimageindex</option>
                  <option value="noarchive,nosnippet">noarchive, nosnippet</option>
                </select>
              </div>
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
                <p className="text-xs text-slate-400 mt-1">Auto-generates CollectionPage + BreadcrumbList (4-level) + ItemList from the Content tab fields. You can edit the JSON after generating.</p>
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
              <ImageUpload key={`og-${dialogKey}`} label="OG Image" hint="Recommended: 1200x630px. Upload or enter URL below"
                value={editing?.og_image} aspectRatio={1200 / 630} maxWidth={1200} maxHeight={630} shape="rounded"
                onChange={(file, preview) => { setOgImageFile(file); setOgImagePreview(preview); }} />
              <Input label="Or enter OG Image URL manually" placeholder="https://..." {...register('og_image')} />
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
              <ImageUpload key={`tw-${dialogKey}`} label="Twitter Image" hint="Recommended: 1200x600px. Upload or enter URL below"
                value={editing?.twitter_image} aspectRatio={1200 / 600} maxWidth={1200} maxHeight={600} shape="rounded"
                onChange={(file, preview) => { setTwitterImageFile(file); setTwitterImagePreview(preview); }} />
              <Input label="Or enter Twitter Image URL manually" placeholder="https://..." {...register('twitter_image')} />
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
