"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
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
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, BookMarked, Trash2, Edit2, Globe, Wand2, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Eye, Sparkles, Loader2, ChevronDown, ChevronUp, X, Mic } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { SubTopicTranslation, SubTopic, Language } from '@/lib/types';

const TABS = ['Content', 'Video', 'SEO Meta', 'Open Graph', 'Twitter'] as const;
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

export default function SubTopicTranslationsPage() {
  const [items, setItems] = useState<SubTopicTranslation[]>([]);
  const [subTopics, setSubTopics] = useState<SubTopic[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubTopicTranslation | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoThumbnailFile, setVideoThumbnailFile] = useState<File | null>(null);
  const [videoThumbnailPreview, setVideoThumbnailPreview] = useState<string | null>(null);
  const [ogImageFile, setOgImageFile] = useState<File | null>(null);
  const [ogImagePreview, setOgImagePreview] = useState<string | null>(null);
  const [twitterImageFile, setTwitterImageFile] = useState<File | null>(null);
  const [twitterImagePreview, setTwitterImagePreview] = useState<string | null>(null);
  const [pageFile, setPageFile] = useState<File | null>(null);
  const [pagePreview, setPagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterSubTopic, setFilterSubTopic] = useState('');
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
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // View dialog
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<SubTopicTranslation | null>(null);
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
    const st = subTopics.find(s => String(s.id) === String(v.sub_topic_id));
    const lang = languages.find(l => String(l.id) === String(v.language_id));
    const isoCode = lang?.iso_code || 'en';
    const subTopicSlug = st?.slug || 'sub-topic';
    const topicSlug = (st as any)?.topics?.slug || 'topic';
    const subjectSlug = (st as any)?.topics?.subjects?.slug || 'subject';
    const pageUrl = v.canonical_url || `${SITE_URL}/${isoCode}/subjects/${subjectSlug}/${topicSlug}/${subTopicSlug}`;

    const sd = [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        name: v.name || '',
        ...(v.short_intro && { description: v.short_intro }),
        url: pageUrl,
        inLanguage: isoCode,
        ...(v.image && { image: v.image }),
        isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
        provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/${isoCode}` },
          { '@type': 'ListItem', position: 2, name: 'Subjects', item: `${SITE_URL}/${isoCode}/subjects` },
          { '@type': 'ListItem', position: 3, name: subjectSlug, item: `${SITE_URL}/${isoCode}/subjects/${subjectSlug}` },
          { '@type': 'ListItem', position: 4, name: topicSlug, item: `${SITE_URL}/${isoCode}/subjects/${subjectSlug}/${topicSlug}` },
          { '@type': 'ListItem', position: 5, name: v.name || subTopicSlug },
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

  useEffect(() => {
    api.listSubTopics('?limit=500&is_active=true').then(res => { if (res.success) setSubTopics(res.data || []); });
    api.listLanguages('?for_material=true&limit=100').then(res => { if (res.success) setLanguages((res.data || []).filter((l: Language) => l.is_active)); });
    refreshSummary();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterSubTopic, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterSubTopic, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]);

  async function refreshSummary() {
    const res = await api.getTableSummary('sub_topic_translations');
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
      if (filterSubTopic) qs.set('sub_topic_id', filterSubTopic);
      if (filterLanguage) qs.set('language_id', filterLanguage);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listSubTopicTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null); setImageFile(null); setImagePreview(null); setVideoThumbnailFile(null); setVideoThumbnailPreview(null);
    setOgImageFile(null); setOgImagePreview(null); setTwitterImageFile(null); setTwitterImagePreview(null);
    setPageFile(null); setPagePreview(null);
    setDialogKey(k => k + 1); setActiveTab('Content');
    reset({
      sub_topic_id: subTopics[0]?.id || '', language_id: languages[0]?.id || '',
      name: '', short_intro: '', long_intro: '', tags: '',
      video_title: '', video_description: '', page: '',
      meta_title: '', meta_description: '', meta_keywords: '', canonical_url: '',
      og_title: '', og_description: '', og_image: '', og_url: '',
      twitter_title: '', twitter_description: '', twitter_image: '',
      focus_keyword: '', structured_data: '[]',
    });
    setDialogOpen(true);
  }

  function openEdit(item: SubTopicTranslation) {
    setEditing(item); setImageFile(null); setImagePreview(null); setVideoThumbnailFile(null); setVideoThumbnailPreview(null);
    setOgImageFile(null); setOgImagePreview(null); setTwitterImageFile(null); setTwitterImagePreview(null);
    setPageFile(null); setPagePreview(null);
    setDialogKey(k => k + 1); setActiveTab('Content');
    const tags = Array.isArray((item as any).tags) ? (item as any).tags.join(', ') : '';
    const sd = (item as any).structured_data ? JSON.stringify((item as any).structured_data, null, 2) : '[]';
    reset({
      sub_topic_id: item.sub_topic_id, language_id: item.language_id,
      name: item.name, short_intro: item.short_intro || '', long_intro: item.long_intro || '', tags,
      video_title: (item as any).video_title || '', video_description: (item as any).video_description || '',
      page: (item as any).page || '',
      meta_title: (item as any).meta_title || '', meta_description: (item as any).meta_description || '',
      meta_keywords: (item as any).meta_keywords || '', canonical_url: (item as any).canonical_url || '',
      og_title: (item as any).og_title || '', og_description: (item as any).og_description || '',
      og_image: (item as any).og_image || '', og_url: (item as any).og_url || '',
      twitter_title: (item as any).twitter_title || '', twitter_description: (item as any).twitter_description || '',
      twitter_image: (item as any).twitter_image || '',
      focus_keyword: (item as any).focus_keyword || '', structured_data: sd,
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
    if (imageFile) fd.append('image_file', imageFile, imageFile.name);
    if (videoThumbnailFile) fd.append('video_thumbnail_file', videoThumbnailFile, videoThumbnailFile.name);
    if (ogImageFile) fd.append('og_image_file', ogImageFile, ogImageFile.name);
    if (twitterImageFile) fd.append('twitter_image_file', twitterImageFile, twitterImageFile.name);
    if (pageFile) fd.append('page_file', pageFile, pageFile.name);

    const res = editing
      ? await api.updateSubTopicTranslation(editing.id, fd, true)
      : await api.createSubTopicTranslation(fd, true);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: SubTopicTranslation) {
    if (!confirm(`Move "${item.name}" to trash? You can restore it later.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteSubTopicTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: SubTopicTranslation) {
    setActionLoadingId(item.id);
    const res = await api.restoreSubTopicTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${item.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: SubTopicTranslation) {
    if (!confirm(`PERMANENTLY delete "${item.name}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteSubTopicTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: SubTopicTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateSubTopicTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: SubTopicTranslation) {
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
    'Content':          ['stt-name', 'stt-short-intro', 'stt-long-intro', 'stt-tags'],
    'Video':            ['stt-video-title', 'stt-video-desc'],
    'SEO Meta':         ['stt-meta-title', 'stt-meta-desc', 'stt-meta-kw', 'stt-focus-kw'],
    'Open Graph':       ['stt-og-title', 'stt-og-desc'],
    'Twitter':          ['stt-tw-title', 'stt-tw-desc'],
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
    const subTopicId = getValues('sub_topic_id');
    const langId = getValues('language_id');
    if (!subTopicId || !langId) { toast.error('Please select a sub-topic and language first'); return; }

    const lang = languages.find(l => String(l.id) === String(langId));
    if (!lang) { toast.error('Language not found'); return; }

    setAiLoading(true);
    try {
      const res = await api.generateSubTopicTranslation({
        sub_topic_id: Number(subTopicId),
        target_language_code: lang.iso_code || '',
        target_language_name: lang.name,
        prompt: aiPrompt,
        provider: aiProvider,
      });

      if (res.success && res.data?.translated) {
        const t = res.data.translated;
        setValue('name', t.name || '');
        setValue('short_intro', t.short_intro || '');
        setValue('long_intro', t.long_intro || '');
        setValue('tags', t.tags || '');
        setValue('video_title', t.video_title || '');
        setValue('video_description', t.video_description || '');
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
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteSubTopicTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreSubTopicTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteSubTopicTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
      <PageHeader title="Sub-Topic Translations" description="Manage multi-language translations for sub-topics"
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
        <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search translations...'}>
          {!showTrash && (
            <>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={filterSubTopic} onChange={e => setFilterSubTopic(e.target.value)}>
                <option value="">All sub-topics</option>
                {subTopics.map(st => <option key={st.id} value={st.id}>{st.slug}{(st as any).topics?.slug ? ` (${(st as any).topics.slug})` : ''}</option>)}
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
        <EmptyState icon={showTrash ? Trash2 : BookMarked} title={showTrash ? 'Trash is empty' : 'No translations yet'} description={showTrash ? 'Deleted translations will appear here' : 'Add your first sub-topic translation'}
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
                  <TH>Sub-Topic</TH>
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
                    <TD className="py-2.5"><span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.name}</span>{item.short_intro && !showTrash && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{item.short_intro}</p>}</TD>
                    <TD className="py-2.5">
                      {(item as any).sub_topics?.slug ? <Badge variant="info">{(item as any).sub_topics.slug}</Badge> : <span className="text-slate-300">—</span>}
                      {(item as any).sub_topics?.topics?.slug && <div className="text-xs text-slate-400 mt-0.5">{(item as any).sub_topics.topics.slug}</div>}
                    </TD>
                    <TD className="py-2.5">{(item as any).languages?.name ? <Badge variant="muted">{(item as any).languages.name}{(item as any).languages.iso_code ? ` (${(item as any).languages.iso_code})` : ''}</Badge> : <span className="text-slate-300">—</span>}</TD>
                    {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{(item as any).deleted_at ? fromNow((item as any).deleted_at) : '—'}</span></TD>}
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
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="View Sub-Topic Translation" size="lg">
        {viewItem && (
          <div className="p-6 space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{(viewItem as any).sub_topics?.slug || `SubTopic #${viewItem.sub_topic_id}`}</Badge>
              {(viewItem as any).sub_topics?.topics?.slug && <Badge variant="muted">{(viewItem as any).sub_topics.topics.slug}</Badge>}
              <Badge variant="muted">{(viewItem as any).languages?.name || `Lang #${viewItem.language_id}`}{(viewItem as any).languages?.iso_code ? ` (${(viewItem as any).languages.iso_code})` : ''}</Badge>
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
                <ViewField label="Short Intro" value={viewItem.short_intro} />
                <ViewField label="Long Intro" value={viewItem.long_intro} />
                <ViewField label="Tags" value={Array.isArray((viewItem as any).tags) ? (viewItem as any).tags.join(', ') : (viewItem as any).tags} />
                {(viewItem as any).image && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Main Image</span>
                    <img src={(viewItem as any).image} alt="Main" className="max-h-40 rounded-lg border border-slate-200" />
                  </div>
                )}
              </div>
            )}

            {viewTab === 'Video' && (
              <div className="space-y-3">
                <ViewField label="Video Title" value={(viewItem as any).video_title} />
                <ViewField label="Video Description" value={(viewItem as any).video_description} />
                {(viewItem as any).video_thumbnail && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Video Thumbnail</span>
                    <img src={(viewItem as any).video_thumbnail} alt="Thumbnail" className="max-h-40 rounded-lg border border-slate-200" />
                  </div>
                )}
                {(viewItem as any).page && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-0.5">Page</span>
                    <a href={(viewItem as any).page} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline">{(viewItem as any).page}</a>
                  </div>
                )}
              </div>
            )}

            {viewTab === 'SEO Meta' && (
              <div className="space-y-3">
                <ViewField label="Meta Title" value={(viewItem as any).meta_title} />
                <ViewField label="Meta Description" value={(viewItem as any).meta_description} />
                <ViewField label="Meta Keywords" value={(viewItem as any).meta_keywords} />
                <ViewField label="Canonical URL" value={(viewItem as any).canonical_url} />
                <ViewField label="Focus Keyword" value={(viewItem as any).focus_keyword} />
                <ViewField label="Structured Data" value={(viewItem as any).structured_data ? JSON.stringify((viewItem as any).structured_data, null, 2) : ''} mono />
              </div>
            )}

            {viewTab === 'Open Graph' && (
              <div className="space-y-3">
                <ViewField label="OG Title" value={(viewItem as any).og_title} />
                <ViewField label="OG Description" value={(viewItem as any).og_description} />
                <ViewField label="OG URL" value={(viewItem as any).og_url} />
                {(viewItem as any).og_image && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">OG Image</span>
                    <img src={(viewItem as any).og_image} alt="OG" className="max-h-40 rounded-lg border border-slate-200" />
                  </div>
                )}
              </div>
            )}

            {viewTab === 'Twitter' && (
              <div className="space-y-3">
                <ViewField label="Twitter Title" value={(viewItem as any).twitter_title} />
                <ViewField label="Twitter Description" value={(viewItem as any).twitter_description} />
                {(viewItem as any).twitter_image && (
                  <div>
                    <span className="block text-xs font-medium text-slate-500 mb-1">Twitter Image</span>
                    <img src={(viewItem as any).twitter_image} alt="Twitter" className="max-h-40 rounded-lg border border-slate-200" />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Sub-Topic Translation' : 'Add Sub-Topic Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
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
                  AI will generate translated content for the selected sub-topic and language. Select a provider and customize the prompt below.
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sub-Topic</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    {...register('sub_topic_id', { required: true })}>
                    {subTopics.map(st => <option key={st.id} value={st.id}>{st.slug}{(st as any).topics?.slug ? ` (${(st as any).topics.slug})` : ''}</option>)}
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
              <MultiLangField id="stt-name" label="Translated Name" placeholder="Sub-topic name in target language" {...register('name', { required: true })} />
              <MultiLangField id="stt-short-intro" label="Short Intro" placeholder="Brief introduction..." multiline {...register('short_intro')} />
              <MultiLangField id="stt-long-intro" label="Long Intro" placeholder="Detailed introduction..." multiline {...register('long_intro')} />
              <MultiLangField id="stt-tags" label="Tags" placeholder="tag1, tag2, tag3 (comma-separated)" {...register('tags')} />
              <ImageUpload key={`img-${dialogKey}`} label="Main Image" hint="Recommended: 800x800px"
                value={(editing as any)?.image} aspectRatio={800 / 800} maxWidth={800} maxHeight={800} shape="rounded"
                onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }} />
            </div>
          )}

          {/* Video Tab */}
          {activeTab === 'Video' && (
            <div className="space-y-4">
              <MultiLangField id="stt-video-title" label="Video Title" placeholder="Video title in target language" {...register('video_title')} />
              <MultiLangField id="stt-video-desc" label="Video Description" placeholder="Video description..." multiline {...register('video_description')} />
              <ImageUpload key={`vt-${dialogKey}`} label="Video Thumbnail" hint="Recommended: 800x450px"
                value={(editing as any)?.video_thumbnail} aspectRatio={800 / 450} maxWidth={800} maxHeight={450} shape="rounded"
                onChange={(file, preview) => { setVideoThumbnailFile(file); setVideoThumbnailPreview(preview); }} />
              {/* Page HTML Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Page (HTML file)</label>
                {((editing as any)?.page && !pageFile) && (
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <a href={(editing as any).page} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline truncate max-w-[300px]">{(editing as any).page}</a>
                    <button type="button" onClick={() => setValue('page', '')} className="text-red-400 hover:text-red-600">Remove</button>
                  </div>
                )}
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center hover:border-brand-300 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('page-file-input')?.click()}>
                  {pageFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm text-slate-700">{pageFile.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setPageFile(null); }} className="text-red-400 hover:text-red-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Click to upload HTML page file</p>
                  )}
                  <input id="page-file-input" type="file" accept=".html,.htm" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) setPageFile(e.target.files[0]); }} />
                </div>
              </div>
            </div>
          )}

          {/* SEO Meta Tab */}
          {activeTab === 'SEO Meta' && (
            <div className="space-y-4">
              <MultiLangField id="stt-meta-title" label="Meta Title" placeholder="SEO title" {...register('meta_title')} />
              <MultiLangField id="stt-meta-desc" label="Meta Description" placeholder="SEO description..." multiline {...register('meta_description')} />
              <MultiLangField id="stt-meta-kw" label="Meta Keywords" placeholder="keyword1, keyword2" {...register('meta_keywords')} />
              <Input label="Canonical URL" placeholder="https://..." {...register('canonical_url')} />
              <MultiLangField id="stt-focus-kw" label="Focus Keyword" placeholder="Primary SEO keyword" {...register('focus_keyword')} />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Structured Data (JSON-LD)</label>
                  <Button type="button" size="sm" variant="outline" onClick={handleGenerateSD}>
                    <Wand2 className="w-3.5 h-3.5" /> Generate
                  </Button>
                </div>
                <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-h-[160px] font-mono"
                  placeholder='[{"@type": "..."}]' {...register('structured_data')} />
                <p className="text-xs text-slate-400 mt-1">Auto-generates Article + BreadcrumbList (5-level: Home &gt; Subjects &gt; Subject &gt; Topic &gt; Sub-Topic) + ItemList from the Content tab fields. You can edit the JSON after generating.</p>
              </div>
            </div>
          )}

          {/* Open Graph Tab */}
          {activeTab === 'Open Graph' && (
            <div className="space-y-4">
              <MultiLangField id="stt-og-title" label="OG Title" placeholder="Open Graph title" {...register('og_title')} />
              <MultiLangField id="stt-og-desc" label="OG Description" placeholder="Open Graph description..." multiline {...register('og_description')} />
              <Input label="OG URL" placeholder="https://..." {...register('og_url')} />
              <ImageUpload key={`og-${dialogKey}`} label="OG Image" hint="Recommended: 1200x630px"
                value={(editing as any)?.og_image} aspectRatio={1200 / 630} maxWidth={1200} maxHeight={630} shape="rounded"
                onChange={(file, preview) => { setOgImageFile(file); setOgImagePreview(preview); }} />
            </div>
          )}

          {/* Twitter Tab */}
          {activeTab === 'Twitter' && (
            <div className="space-y-4">
              <MultiLangField id="stt-tw-title" label="Twitter Title" placeholder="Twitter card title" {...register('twitter_title')} />
              <MultiLangField id="stt-tw-desc" label="Twitter Description" placeholder="Twitter card description..." multiline {...register('twitter_description')} />
              <ImageUpload key={`tw-${dialogKey}`} label="Twitter Image" hint="Recommended: 1200x600px"
                value={(editing as any)?.twitter_image} aspectRatio={1200 / 600} maxWidth={1200} maxHeight={600} shape="rounded"
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
