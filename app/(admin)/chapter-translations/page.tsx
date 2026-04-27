"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
import { MultiLangField, initMLIFields, setMLILanguage, useMLIScript } from '@/components/ui/MultiLangField';
import { AiProgressOverlay } from '@/components/ui/AiProgressOverlay';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, BookOpen, Trash2, Edit2, Globe, CheckCircle2, XCircle, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Mic, Eye, Loader2, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { ChapterTranslation, Chapter, Language } from '@/lib/types';

type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
];

type SortField = 'id' | 'name' | 'is_active';

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="block text-xs font-medium text-slate-500 mb-0.5">{label}</span>
      {value ? (
        <p className="text-sm text-slate-900 whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-slate-300 italic">Not set</p>
      )}
    </div>
  );
}

export default function ChapterTranslationsPage() {
  const [items, setItems] = useState<ChapterTranslation[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChapterTranslation | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterChapter, setFilterChapter] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset, setValue, getValues, watch } = useForm();
  const mliReady = useMLIScript();
  const [formLoading, setFormLoading] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<ChapterTranslation | null>(null);

  // AI Generate
  const [aiPrompt, setAiPrompt] = useState('Translate exactly with the same meaning. Keep technical or brand words in English that sound strange or unnatural when translated.');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');

  const watchedLangId = watch('language_id');
  const selectedLangCode = useMemo(() => {
    if (!watchedLangId || languages.length === 0) return 'en';
    const lang = languages.find(l => String(l.id) === String(watchedLangId));
    return lang?.iso_code || 'en';
  }, [watchedLangId, languages]);

  const MLI_FIELDS = ['ct-name', 'ct-short-intro', 'ct-long-intro', 'ct-prerequisites', 'ct-learning-objectives'];


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
    if (!dialogOpen || !mliReady) return;
    const timer = setTimeout(() => initMLIFields(MLI_FIELDS, selectedLangCode), 250);
    return () => clearTimeout(timer);
  }, [dialogOpen, mliReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dialogOpen || !mliReady) return;
    setMLILanguage(MLI_FIELDS, selectedLangCode);
  }, [selectedLangCode, dialogOpen, mliReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const watchedChapterId = watch('chapter_id');
  const skipAutoFetchRef = useRef(false);

  useEffect(() => {
    if (!dialogOpen) return;
    if (skipAutoFetchRef.current) { skipAutoFetchRef.current = false; return; }
    if (!watchedChapterId || !watchedLangId) return;

    let cancelled = false;
    const fetchTranslation = async () => {
      setFormLoading(true);
      const qs = `?chapter_id=${watchedChapterId}&language_id=${watchedLangId}&limit=1`;
      const res = await api.listChapterTranslations(qs);
      if (cancelled) return;

      if (res.success && res.data && res.data.length > 0) {
        const item = res.data[0] as ChapterTranslation;
        setEditing(item); setFormMode('existing');
        setValue('name', item.name || '');
        setValue('short_intro', item.short_intro || '');
        setValue('long_intro', item.long_intro || '');
        setValue('prerequisites', item.prerequisites || '');
        setValue('learning_objectives', item.learning_objectives || '');
        setValue('sort_order', item.sort_order ?? 0);
        setImageFile(null); setImagePreview(null);
        toast.info(`Loaded existing ${languages.find(l => String(l.id) === String(watchedLangId))?.name || ''} translation`);
      } else {
        setEditing(null); setFormMode('new');
        setValue('name', ''); setValue('short_intro', ''); setValue('long_intro', '');
        setValue('prerequisites', ''); setValue('learning_objectives', '');
        setValue('sort_order', 0);
        setImageFile(null); setImagePreview(null);
      }
      setFormLoading(false);
    };

    const timer = setTimeout(fetchTranslation, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [watchedChapterId, watchedLangId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.listChapters('?limit=500&is_active=true').then(res => { if (res.success) setChapters(res.data || []); });
    api.listLanguages('?for_material=true&limit=100').then(res => { if (res.success) setLanguages((res.data || []).filter((l: Language) => l.is_active)); });
    refreshSummary();
  }, []);

  useEffect(() => { const t = setTimeout(() => setSearchDebounce(search), 400); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterChapter, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterChapter, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]);

  async function refreshSummary() {
    const res = await api.getTableSummary('chapter_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (showTrash) { qs.set('show_deleted', 'true'); }
    else {
      if (filterChapter) qs.set('chapter_id', filterChapter);
      if (filterLanguage) qs.set('language_id', filterLanguage);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField); qs.set('order', sortOrder);
    const res = await api.listChapterTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  function openCreate() {
    skipAutoFetchRef.current = true;
    setEditing(null); setFormMode('new'); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({
      chapter_id: chapters[0]?.id || '', language_id: languages[0]?.id || '',
      name: '', short_intro: '', long_intro: '', prerequisites: '', learning_objectives: '', sort_order: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(item: ChapterTranslation) {
    skipAutoFetchRef.current = true;
    setEditing(item); setFormMode('existing'); setImageFile(null); setImagePreview(null); setDialogKey(k => k + 1);
    reset({
      chapter_id: item.chapter_id, language_id: item.language_id,
      name: item.name, short_intro: item.short_intro || '', long_intro: item.long_intro || '',
      prerequisites: item.prerequisites || '', learning_objectives: item.learning_objectives || '',
      sort_order: item.sort_order ?? 0,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    fd.append('chapter_id', String(data.chapter_id));
    fd.append('language_id', String(data.language_id));
    fd.append('name', data.name);
    if (data.short_intro) fd.append('short_intro', data.short_intro);
    if (data.long_intro) fd.append('long_intro', data.long_intro);
    if (data.prerequisites) fd.append('prerequisites', data.prerequisites);
    if (data.learning_objectives) fd.append('learning_objectives', data.learning_objectives);
    fd.append('sort_order', String(data.sort_order || 0));
    if (imageFile) fd.append('image_file', imageFile, imageFile.name);

    const res = editing
      ? await api.updateChapterTranslation(editing.id, fd, true)
      : await api.createChapterTranslation(fd, true);
    if (res.success) {
      toast.success(editing ? 'Chapter translation updated' : 'Chapter translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: ChapterTranslation) {
    if (!confirm(`Move "${item.name}" to trash?`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteChapterTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: ChapterTranslation) {
    setActionLoadingId(item.id);
    const res = await api.restoreChapterTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${item.name}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: ChapterTranslation) {
    if (!confirm(`PERMANENTLY delete "${item.name}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteChapterTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: ChapterTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateChapterTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: ChapterTranslation) { setViewItem(item); setViewOpen(true); }

  async function handleAIGenerate() {
    const chapterId = getValues('chapter_id');
    const langId = getValues('language_id');
    if (!chapterId || !langId) { toast.error('Please select a chapter and language first'); return; }

    const lang = languages.find(l => String(l.id) === String(langId));
    if (!lang) { toast.error('Language not found'); return; }

    setAiLoading(true);
    try {
      const res = await api.generateChapterTranslation({
        chapter_id: Number(chapterId),
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
        setValue('prerequisites', t.prerequisites || '');
        setValue('learning_objectives', t.learning_objectives || '');

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

  function toggleSelect(id: number) { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleSelectAll() { setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id))); }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} translation(s) to trash?`)) return;
    setBulkActionLoading(true); const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteChapterTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} moved to trash`); setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} translation(s)?`)) return;
    setBulkActionLoading(true); const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreChapterTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} restored`); setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} translation(s)?`)) return;
    setBulkActionLoading(true); const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteChapterTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} permanently deleted`); setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkGenerateContent() {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const parentIds = new Set<number>();
      items.filter(i => selectedIds.has(i.id)).forEach(i => {
        if (i.chapter_id) parentIds.add(i.chapter_id);
      });
      const res = await api.bulkGenerateMissingContent({
        entity_type: 'chapter',
        entity_ids: Array.from(parentIds),
        provider: 'gemini',
      });
      if (res.success && res.data) {
        const { summary } = res.data;
        toast.success(`Generated content for ${summary.success} item(s), ${summary.skipped} already complete`);
        load();
      } else {
        toast.error(res.error || 'Bulk generation failed');
      }
    } catch {
      toast.error('Bulk generation failed');
    }
    setBulkActionLoading(false);
  }

  async function handleFillAllMissing() {
    if (!confirm('This will generate AI content for ALL entities with missing or empty translations. This may take several minutes. Continue?')) return;
    setBulkActionLoading(true);
    setBulkProgress({ done: 0, total: 0 });
    try {
      const res = await api.bulkGenerateMissingContent({
        entity_type: 'chapter',
        generate_all: true,
        provider: 'gemini',
      });
      if (res.success && res.data) {
        const { summary } = res.data;
        toast.success(`Generated content for ${summary.success} item(s), ${summary.skipped} already complete, ${summary.errors} error(s)`);
        load();
      } else {
        toast.error(res.error || 'Bulk generation failed');
      }
    } catch {
      toast.error('Bulk generation failed');
    }
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); } setPage(1);
  }
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <Script src="/js/multi-lang-input.js" strategy="afterInteractive" onLoad={() => (window as any).__mliMarkReady?.()} />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/css/multi-lang-input.css" />

      <PageHeader title="Chapter Translations" description="Manage multi-language translations for chapters"
        actions={!showTrash ? <div className="flex items-center gap-2"><Button variant="outline" onClick={handleFillAllMissing} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Fill All Missing</Button><Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button></div> : undefined} />

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
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', card.color)}><Icon className="w-4.5 h-4.5" /></div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 font-medium">{card.label}</div>
                  <div className="text-xl font-bold text-slate-900 leading-tight">{card.value.toLocaleString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Translations
        </button>
        <button onClick={() => setShowTrash(true)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>}
        </button>
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search translations...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterChapter} onChange={e => setFilterChapter(e.target.value)}>
              <option value="">All chapters</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{(c as any).english_name || c.slug}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </>
        )}
      </DataToolbar>

      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : BookOpen} title={showTrash ? 'Trash is empty' : 'No translations yet'} description={showTrash ? 'Deleted translations will appear here' : 'Add your first chapter translation'}
          action={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button> : undefined} />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore</Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkGenerateContent} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Generate Content</Button>
                    <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>{bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected</Button>
                  </>
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
                <TH>Chapter</TH>
                <TH>Language</TH>
                {!showTrash && <TH>Content</TH>}
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
                  <TD className="py-2.5">
                    <span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.name}</span>
                    {item.short_intro && !showTrash && <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{item.short_intro}</p>}
                  </TD>
                  <TD className="py-2.5">{item.chapters?.slug ? <Badge variant="info">{item.chapters.slug}</Badge> : <span className="text-slate-300">—</span>}</TD>
                  <TD className="py-2.5">{item.languages?.name ? <Badge variant="muted">{item.languages.name}{item.languages.iso_code ? ` (${item.languages.iso_code})` : ''}</Badge> : <span className="text-slate-300">—</span>}</TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      {item.short_intro ? (
                        <Badge variant="success">Filled</Badge>
                      ) : (
                        <button onClick={() => openEdit(item)} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors" title="Generate content with AI">
                          <Sparkles className="w-3 h-3" /> Empty
                        </button>
                      )}
                    </TD>
                  )}
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
      )}

      {/* View Dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="View Chapter Translation" size="md">
        {viewItem && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{viewItem.chapters?.slug || `Chapter #${viewItem.chapter_id}`}</Badge>
              <Badge variant="muted">{viewItem.languages?.name || `Lang #${viewItem.language_id}`}{viewItem.languages?.iso_code ? ` (${viewItem.languages.iso_code})` : ''}</Badge>
              <Badge variant={viewItem.is_active ? 'success' : 'danger'}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="space-y-3">
              <ViewField label="Translated Name" value={viewItem.name} />
              <ViewField label="Short Intro" value={viewItem.short_intro} />
              <ViewField label="Long Intro" value={viewItem.long_intro} />
              <ViewField label="Prerequisites" value={viewItem.prerequisites} />
              <ViewField label="Learning Objectives" value={viewItem.learning_objectives} />
              <ViewField label="Sort Order" value={String(viewItem.sort_order ?? 0)} />
              {viewItem.image && (
                <div>
                  <span className="block text-xs font-medium text-slate-500 mb-1">Image</span>
                  <img src={viewItem.image} alt="Translation" className="max-h-40 rounded-lg border border-slate-200" />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => { setViewOpen(false); openEdit(viewItem); }}><Edit2 className="w-3.5 h-3.5" /> Edit</Button>
              <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Edit / Create Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Chapter Translation' : 'Add Chapter Translation'} size="lg">
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
                  const refreshed = await api.getChapterTranslation(editing.id);
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
                  {selectedLangCode === 'en'
                    ? <>AI will generate <strong>English</strong> content (name, intro, prerequisites, learning objectives) for the selected chapter.</>
                    : <>AI will translate the <strong>English</strong> version into <strong>{languages.find(l => String(l.id) === String(watchedLangId))?.name || 'the selected language'}</strong>. English translation must exist first.</>
                  }
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">AI Provider</label>
                  <div className="grid grid-cols-3 gap-2">
                    {AI_PROVIDERS.map(p => (
                      <button key={p.value} type="button" disabled={aiLoading} onClick={() => setAiProvider(p.value)}
                        className={cn(
                          'px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left',
                          aiProvider === p.value
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        )}>
                        <div className="font-semibold text-xs">{p.label}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{p.model}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {selectedLangCode === 'en' ? 'Generation Prompt' : 'Translation Prompt'}
                  </label>
                  <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} disabled={aiLoading}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px] resize-y disabled:opacity-50"
                    placeholder={selectedLangCode === 'en'
                      ? 'e.g. Generate educational content with clear prerequisites and objectives.'
                      : 'e.g. Translate exactly with same meaning. Keep technical/brand words in English.'}
                  />
                </div>
                <Button type="button" onClick={handleAIGenerate} disabled={aiLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                  {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
                </Button>
                <AiProgressOverlay
                  active={aiLoading}
                  phases={['Analyzing chapter content...', 'Generating translation with AI...', 'Processing response...', 'Preparing fields...']}
                  title="AI Translation"
                  subtitle={`Generating ${languages.find(l => String(l.id) === String(watch('language_id')))?.name || ''} translation`}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={formMode === 'existing' ? 'info' : 'success'}>
              {formMode === 'existing' ? 'Editing existing translation' : 'New translation'}
            </Badge>
            {formLoading && <span className="text-xs text-slate-400 animate-pulse">Loading translation...</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Chapter</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('chapter_id', { required: true })}>
                {chapters.map(c => <option key={c.id} value={c.id}>{(c as any).english_name || c.slug}</option>)}
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

          <MultiLangField id="ct-name" label="Translated Name" placeholder="Chapter name in target language" {...register('name', { required: true })} />
          <MultiLangField id="ct-short-intro" label="Short Intro" placeholder="Brief introduction..." multiline {...register('short_intro')} />
          <MultiLangField id="ct-long-intro" label="Long Intro" placeholder="Detailed introduction..." multiline {...register('long_intro')} />
          <MultiLangField id="ct-prerequisites" label="Prerequisites" placeholder="What learners should know before..." multiline {...register('prerequisites')} />
          <MultiLangField id="ct-learning-objectives" label="Learning Objectives" placeholder="What learners will achieve..." multiline {...register('learning_objectives')} />

          <ImageUpload key={`img-${dialogKey}`} label="Image" hint="Upload an image for this translation"
            value={editing?.image} maxWidth={800} maxHeight={600} shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }} />

          <Input label="Sort Order" type="number" {...register('sort_order')} />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={formLoading}>{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
