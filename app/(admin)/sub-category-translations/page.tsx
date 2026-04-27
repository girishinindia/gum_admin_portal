"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MultiLangField, initMLIFields, setMLILanguage, useMLIScript } from '@/components/ui/MultiLangField';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, BookMarked, Trash2, Edit2, Globe, Wand2, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Eye, Sparkles, Loader2, ChevronDown, ChevronUp, X, Mic } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { SubCategoryTranslation, SubCategory, Language } from '@/lib/types';

const TABS = ['Content', 'SEO Meta', 'Open Graph', 'Twitter'] as const;
type SortField = 'id' | 'name' | 'is_active';

type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
];

function ViewField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs font-medium text-slate-500 mb-0.5">{label}</span>
      {value ? (
        <p className={cn('text-sm text-slate-900 whitespace-pre-wrap', mono && 'font-mono text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 max-h-48 overflow-auto')}>{value}</p>
      ) : (
        <p className="text-sm text-slate-300 italic">Not set</p>
      )}
    </div>
  );
}

export default function SubCategoryTranslationsPage() {
  const [items, setItems] = useState<SubCategoryTranslation[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubCategoryTranslation | null>(null);
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
  const [pageSize, setPageSize] = usePageSize();
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // View dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<SubCategoryTranslation | null>(null);
  const [viewTab, setViewTab] = useState<typeof TABS[number]>('Content');

  // AI Generate
  const [aiPrompt, setAiPrompt] = useState('Translate exactly with the same meaning. Keep technical or brand words in English that sound strange or unnatural when translated.');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');

  const { register, handleSubmit, reset, setValue, getValues, watch } = useForm();

  const SITE_URL = 'https://growupmore.com';
  const SITE_NAME = 'GrowUpMore';

  function handleGenerateSD() {
    const v = getValues();
    const sc = subCategories.find(s => String(s.id) === String(v.sub_category_id));
    const lang = languages.find(l => String(l.id) === String(v.language_id));
    const isoCode = lang?.iso_code || 'en';
    const subCatSlug = sc?.slug || 'sub-category';
    const catSlug = sc?.categories?.slug || 'category';
    const catCode = sc?.categories?.code || 'Category';
    const pageUrl = v.canonical_url || `${SITE_URL}/${isoCode}/categories/${catSlug}/${subCatSlug}`;

    const sd = [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: v.name || '',
        ...(v.description && { description: v.description }),
        url: pageUrl,
        inLanguage: isoCode,
        ...(sc?.image && { image: sc.image }),
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/${isoCode}` },
          { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE_URL}/${isoCode}/categories` },
          { '@type': 'ListItem', position: 3, name: catCode, item: `${SITE_URL}/${isoCode}/categories/${catSlug}` },
          { '@type': 'ListItem', position: 4, name: v.name || '' },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: v.name || '',
        numberOfItems: 0,
        itemListElement: [],
      },
    ];

    setValue('structured_data', JSON.stringify(sd, null, 2));
    toast.success('Structured data generated');
  }


  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g u', action: () => router.push('/users') },
    { key: 'g c', action: () => router.push('/categories') },
    { key: 'g s', action: () => router.push('/subjects') },
    { key: 'g m', action: () => router.push('/material-tree') },
  ]);

  useEffect(() => {
    api.listSubCategories('?limit=100').then(res => { if (res.success) setSubCategories((res.data || []).filter((sc: SubCategory) => sc.is_active)); });
    api.listLanguages('?for_material=true&limit=100').then(res => { if (res.success) setLanguages((res.data || []).filter((l: Language) => l.is_active)); });
    refreshSummary();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterSubCategory, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterSubCategory, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]);

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
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterSubCategory) qs.set('sub_category_id', filterSubCategory);
      if (filterLanguage) qs.set('language_id', filterLanguage);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
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
    setEditing(null); setOgImageFile(null); setOgImagePreview(null); setTwitterImageFile(null); setTwitterImagePreview(null); setDialogKey(k => k + 1); setActiveTab('Content');
    reset({
      sub_category_id: subCategories[0]?.id || '', language_id: languages[0]?.id || '',
      name: '', description: '', is_new_title: '', tags: '',
      meta_title: '', meta_description: '', meta_keywords: '', canonical_url: '',
      og_title: '', og_description: '', og_image: '', og_url: '',
      twitter_title: '', twitter_description: '', twitter_image: '',
      focus_keyword: '', structured_data: '[]',
    });
    setDialogOpen(true);
  }

  function openEdit(item: SubCategoryTranslation) {
    setEditing(item); setOgImageFile(null); setOgImagePreview(null); setTwitterImageFile(null); setTwitterImagePreview(null); setDialogKey(k => k + 1); setActiveTab('Content');
    const tags = Array.isArray(item.tags) ? item.tags.join(', ') : '';
    const sd = item.structured_data ? JSON.stringify(item.structured_data, null, 2) : '[]';
    reset({
      sub_category_id: item.sub_category_id, language_id: item.language_id,
      name: item.name, description: item.description || '', is_new_title: item.is_new_title || '', tags,
      meta_title: item.meta_title || '', meta_description: item.meta_description || '',
      meta_keywords: item.meta_keywords || '', canonical_url: item.canonical_url || '',
      og_title: item.og_title || '',
      og_description: item.og_description || '',
      og_image: item.og_image || '', og_url: item.og_url || '',
      twitter_title: item.twitter_title || '',
      twitter_description: item.twitter_description || '', twitter_image: item.twitter_image || '',
      focus_keyword: item.focus_keyword || '',
      structured_data: sd,
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

  async function onSoftDelete(item: SubCategoryTranslation) {
    if (!confirm(`Move "${item.name}" to trash? You can restore it later.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteSubCategoryTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: SubCategoryTranslation) {
    setActionLoadingId(item.id);
    const res = await api.restoreSubCategoryTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${item.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: SubCategoryTranslation) {
    if (!confirm(`PERMANENTLY delete "${item.name}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteSubCategoryTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: SubCategoryTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateSubCategoryTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: SubCategoryTranslation) {
    setViewItem(item);
    setViewTab('Content');
    setViewOpen(true);
  }

  const mliReady = useMLIScript();
  const watchedLangId = watch('language_id');

  const selectedLangCode = useMemo(() => {
    if (!watchedLangId || languages.length === 0) return 'en';
    const lang = languages.find(l => String(l.id) === String(watchedLangId));
    return lang?.iso_code || 'en';
  }, [watchedLangId, languages]);

  // Field IDs per tab for MultiLangInput initialisation
  const MLI_FIELDS: Record<string, string[]> = {
    'Content':    ['sct-name', 'sct-description', 'sct-is-new-title', 'sct-tags'],
    'SEO Meta':   ['sct-meta-title', 'sct-meta-desc', 'sct-meta-kw', 'sct-focus-kw'],
    'Open Graph': ['sct-og-title', 'sct-og-desc'],
    'Twitter':    ['sct-tw-title', 'sct-tw-desc'],
  };

  // Initialise MultiLangInput on fields when: dialog opens, tab switches, or script loads
  useEffect(() => {
    if (!dialogOpen || !mliReady) return;
    const fields = MLI_FIELDS[activeTab] || [];
    const timer = setTimeout(() => initMLIFields(fields, selectedLangCode), 250);
    return () => clearTimeout(timer);
  }, [dialogOpen, activeTab, mliReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update language on ALL initialised fields when the language selector changes
  useEffect(() => {
    if (!dialogOpen || !mliReady) return;
    const allFields = Object.values(MLI_FIELDS).flat();
    setMLILanguage(allFields, selectedLangCode);
  }, [selectedLangCode, dialogOpen, mliReady]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAIGenerate() {
    const subCatId = getValues('sub_category_id');
    const langId = getValues('language_id');
    if (!subCatId || !langId) { toast.error('Please select a sub-category and language first'); return; }

    const lang = languages.find(l => String(l.id) === String(langId));
    if (!lang) { toast.error('Language not found'); return; }

    setAiLoading(true);
    try {
      const res = await api.generateSubCategoryTranslation({
        sub_category_id: Number(subCatId),
        target_language_code: lang.iso_code || '',
        target_language_name: lang.name,
        prompt: aiPrompt,
        provider: aiProvider,
      });

      if (res.success && res.data?.translated) {
        const t = res.data.translated;
        setValue('name', t.name || '');
        setValue('description', t.description || '');
        setValue('is_new_title', t.is_new_title || '');
        setValue('tags', t.tags || '');
        setValue('meta_title', t.meta_title || '');
        setValue('meta_description', t.meta_description || '');
        setValue('meta_keywords', t.meta_keywords || '');
        setValue('og_title', t.og_title || '');
        setValue('og_description', t.og_description || '');
        setValue('twitter_title', t.twitter_title || '');
        setValue('twitter_description', t.twitter_description || '');
        setValue('focus_keyword', t.focus_keyword || '');

        const providerLabel = AI_PROVIDERS.find(p => p.value === aiProvider)?.label || aiProvider;
        const tokens = res.data.usage?.total_tokens || 0;
        toast.success(`AI generated ${lang.name} translation via ${providerLabel} (${tokens} tokens)`);
      } else {
        toast.error(res.error || 'AI generation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  }

  // Bulk selection helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} translation(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteSubCategoryTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} translation(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreSubCategoryTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} translation(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteSubCategoryTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
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
        actions={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button> : undefined} />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Translations', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
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

      {/* Trash toggle tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Translations
        </button>
        <button onClick={() => setShowTrash(true)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      <div className="mb-4">
        <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search translations...'}>
          {!showTrash && (
            <>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={filterSubCategory} onChange={e => setFilterSubCategory(e.target.value)}>
                <option value="">All sub-categories</option>
                {subCategories.map(sc => <option key={sc.id} value={sc.id}>{(sc as any).english_name || sc.code}{sc.categories?.code ? ` (${sc.categories.code})` : ''}</option>)}
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
            </>
          )}
        </DataToolbar>
      </div>

      {showTrash && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : BookMarked} title={showTrash ? 'Trash is empty' : 'No translations yet'} description={showTrash ? 'Deleted translations will appear here' : 'Add your first sub-category translation'}
          action={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button> : undefined} />
      ) : (
        <>
          <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
            {/* Bulk action toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
                <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
                <div className="flex items-center gap-2">
                  {showTrash ? (
                    <>
                      <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected</Button>
                      <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}><X className="w-3.5 h-3.5" /> Clear</Button>
                </div>
              </div>
            )}
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                  <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                  <TH><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
                  <TH>Sub-Category</TH>
                  <TH>Language</TH>
                  {showTrash && <TH>Deleted</TH>}
                  <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map(item => (
                  <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-brand-50/40')}>
                    <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                    <TD className="py-2.5"><span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.name}</span>{item.description && !showTrash && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{item.description}</p>}</TD>
                    <TD className="py-2.5">
                      {item.sub_categories?.code ? <Badge variant="info">{item.sub_categories.code}</Badge> : <span className="text-slate-300">—</span>}
                      {item.sub_categories?.categories?.code && <div className="text-xs text-slate-400 mt-0.5">{item.sub_categories.categories.code}</div>}
                    </TD>
                    <TD className="py-2.5">{item.languages?.name ? <Badge variant="muted">{item.languages.name}{item.languages.iso_code ? ` (${item.languages.iso_code})` : ''}</Badge> : <span className="text-slate-300">—</span>}</TD>
                    {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '—'}</span></TD>}
                    <TD className="py-2.5">
                      {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                    </TD>
                    <TD className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {showTrash ? (
                          <>
                            <button onClick={() => onRestore(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                            <button onClick={() => onPermanentDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openView(item)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onSoftDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                          </>
                        )}
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

      {/* Multi-Language Input: transliteration + speech-to-text */}
      <Script src="/js/multi-lang-input.js" strategy="afterInteractive" onLoad={() => (window as any).__mliMarkReady?.()} />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/multi-lang-input.css" />

      {/* ─── View Dialog ─── */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="View Sub-Category Translation" size="lg">
        {viewItem && (
          <div className="p-6 space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{viewItem.sub_categories?.code || `SubCat #${viewItem.sub_category_id}`}</Badge>
              {viewItem.sub_categories?.categories?.code && <Badge variant="muted">{viewItem.sub_categories.categories.code}</Badge>}
              <Badge variant="muted">{viewItem.languages?.name || `Lang #${viewItem.language_id}`}{viewItem.languages?.iso_code ? ` (${viewItem.languages.iso_code})` : ''}</Badge>
              <Badge variant={viewItem.is_active ? 'success' : 'danger'}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>

            {/* View Tabs */}
            <div className="flex gap-1 border-b border-slate-200 pb-0">
              {TABS.map(tab => (
                <button key={tab} type="button" onClick={() => setViewTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${viewTab === tab ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {viewTab === 'Content' && (
              <div className="space-y-3">
                <ViewField label="Translated Name" value={viewItem.name} />
                <ViewField label="Description" value={viewItem.description} />
                <ViewField label="New Badge Title" value={viewItem.is_new_title} />
                <ViewField label="Tags" value={Array.isArray(viewItem.tags) ? viewItem.tags.join(', ') : viewItem.tags} />
              </div>
            )}

            {viewTab === 'SEO Meta' && (
              <div className="space-y-3">
                <ViewField label="Meta Title" value={viewItem.meta_title} />
                <ViewField label="Meta Description" value={viewItem.meta_description} />
                <ViewField label="Meta Keywords" value={viewItem.meta_keywords} />
                <ViewField label="Canonical URL" value={viewItem.canonical_url} />
                <ViewField label="Focus Keyword" value={viewItem.focus_keyword} />
                <ViewField label="Structured Data" value={viewItem.structured_data ? JSON.stringify(viewItem.structured_data, null, 2) : ''} mono />
              </div>
            )}

            {viewTab === 'Open Graph' && (
              <div className="space-y-3">
                <ViewField label="OG Title" value={viewItem.og_title} />
                <ViewField label="OG Description" value={viewItem.og_description} />
                <ViewField label="OG URL" value={viewItem.og_url} />
                {viewItem.og_image && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">OG Image</span>
                    <img src={viewItem.og_image} alt="OG" className="max-h-40 rounded-lg border border-slate-200" />
                  </div>
                )}
              </div>
            )}

            {viewTab === 'Twitter' && (
              <div className="space-y-3">
                <ViewField label="Twitter Title" value={viewItem.twitter_title} />
                <ViewField label="Twitter Description" value={viewItem.twitter_description} />
                {viewItem.twitter_image && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Twitter Image</span>
                    <img src={viewItem.twitter_image} alt="Twitter" className="max-h-40 rounded-lg border border-slate-200" />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => { setViewOpen(false); openEdit(viewItem); }}>
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ─── Create / Edit Dialog ─── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Sub-Category Translation' : 'Add Sub-Category Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This translation is currently active' : 'This translation is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getSubCategoryTranslation(editing.id);
                  if (refreshed.success && refreshed.data) {
                    setEditing(refreshed.data);
                    setValue('is_active', refreshed.data.is_active);
                  }
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}

          {/* AI Generate Panel */}
          <div className="border border-indigo-200 rounded-lg overflow-hidden">
            <button type="button" onClick={() => setAiPanelOpen(!aiPanelOpen)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors text-sm font-medium text-indigo-700">
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Generate Content</span>
              {aiPanelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {aiPanelOpen && (
              <div className="px-4 py-3 bg-white space-y-3">
                <p className="text-xs text-slate-500">
                  AI will generate translated content for the selected sub-category and language. Select a provider and customize the prompt below.
                </p>
                {/* AI Provider selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">AI Provider</label>
                  <div className="grid grid-cols-3 gap-2">
                    {AI_PROVIDERS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        disabled={aiLoading}
                        onClick={() => setAiProvider(p.value)}
                        className={cn(
                          'px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left',
                          aiProvider === p.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        )}
                      >
                        <div className="font-semibold text-xs">{p.label}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{p.model}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Translation Prompt</label>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    disabled={aiLoading}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px] resize-y disabled:opacity-50"
                    placeholder="e.g. Translate exactly with same meaning. Keep technical/brand words in English."
                  />
                </div>
                <Button type="button" onClick={handleAIGenerate} disabled={aiLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
                </Button>
              </div>
            )}
          </div>

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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Category</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    {...register('sub_category_id', { required: true })}>
                    {subCategories.map(sc => <option key={sc.id} value={sc.id}>{(sc as any).english_name || sc.code}{sc.categories?.code ? ` (${sc.categories.code})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Language <Mic className="w-3 h-3 inline text-slate-400 ml-1" /></label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    {...register('language_id', { required: true })}>
                    {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
                  </select>
                </div>
              </div>
              {selectedLangCode !== 'en' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700">
                  <Mic className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Transliteration &amp; speech-to-text active — type in English, press <strong>Space</strong> to auto-convert. Click <strong>SPEAK</strong> to dictate.</span>
                </div>
              )}
              <MultiLangField id="sct-name" label="Translated Name" placeholder="Sub-category name in target language" {...register('name', { required: true })} />
              <MultiLangField id="sct-description" label="Description" placeholder="Translated description..." multiline {...register('description')} />
              <MultiLangField id="sct-is-new-title" label="New Badge Title" placeholder="Custom 'New' label" {...register('is_new_title')} />
              <MultiLangField id="sct-tags" label="Tags" placeholder="tag1, tag2, tag3 (comma-separated)" {...register('tags')} />
            </div>
          )}

          {/* SEO Meta Tab */}
          {activeTab === 'SEO Meta' && (
            <div className="space-y-4">
              <MultiLangField id="sct-meta-title" label="Meta Title" placeholder="SEO title" {...register('meta_title')} />
              <MultiLangField id="sct-meta-desc" label="Meta Description" placeholder="SEO description..." multiline {...register('meta_description')} />
              <MultiLangField id="sct-meta-kw" label="Meta Keywords" placeholder="keyword1, keyword2" {...register('meta_keywords')} />
              <Input label="Canonical URL" placeholder="https://..." {...register('canonical_url')} />
              <MultiLangField id="sct-focus-kw" label="Focus Keyword" placeholder="Primary SEO keyword" {...register('focus_keyword')} />
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
              <MultiLangField id="sct-og-title" label="OG Title" placeholder="Open Graph title" {...register('og_title')} />
              <MultiLangField id="sct-og-desc" label="OG Description" placeholder="Open Graph description..." multiline {...register('og_description')} />
              <Input label="OG URL" placeholder="https://..." {...register('og_url')} />
              <ImageUpload key={`og-${dialogKey}`} label="OG Image" hint="Recommended: 1200x630px"
                value={editing?.og_image} aspectRatio={1200 / 630} maxWidth={1200} maxHeight={630} shape="rounded"
                onChange={(file, preview) => { setOgImageFile(file); setOgImagePreview(preview); }} />
            </div>
          )}

          {/* Twitter Tab */}
          {activeTab === 'Twitter' && (
            <div className="space-y-4">
              <MultiLangField id="sct-tw-title" label="Twitter Title" placeholder="Twitter card title" {...register('twitter_title')} />
              <MultiLangField id="sct-tw-desc" label="Twitter Description" placeholder="Twitter card description..." multiline {...register('twitter_description')} />
              <ImageUpload key={`tw-${dialogKey}`} label="Twitter Image" hint="Recommended: 1200x600px"
                value={editing?.twitter_image} aspectRatio={1200 / 600} maxWidth={1200} maxHeight={600} shape="rounded"
                onChange={(file, preview) => { setTwitterImageFile(file); setTwitterImagePreview(preview); }} />
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
