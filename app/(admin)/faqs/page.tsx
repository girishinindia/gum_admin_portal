"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle,
  Loader2, X, FolderTree, Globe, HelpCircle, Languages, Sparkles, Star,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

// ─── AI providers + inline AI generate/translate panel ───────────────
type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
];

/**
 * Phase 46 — inline "AI Generate Content" panel for the translation dialogs,
 * mirroring the material translation modules. Generates English content (when
 * the selected language is English) or translates the existing English version
 * into the selected language, then fills the form via onApply().
 */
function InlineAiTranslatePanel({ entityType, entityId, languageId, languages, onApply }: {
  entityType: string;
  entityId: number | string;
  languageId: number | string;
  languages: any[];
  onApply: (fields: Record<string, any>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const lang = languages.find(l => String(l.id) === String(languageId));
  const isEnglish = lang?.iso_code === 'en';

  async function run() {
    if (!entityId) { toast.error('Select the parent item first'); return; }
    if (!languageId || !lang) { toast.error('Select a language first'); return; }
    setLoading(true);
    try {
      const res = await api.generateEntityTranslation({
        entity_type: entityType,
        entity_id: Number(entityId),
        target_language_code: lang.iso_code,
        target_language_name: lang.name,
        prompt: prompt || undefined,
        provider,
      });
      if (res.success && res.data?.translated) {
        onApply(res.data.translated);
        toast.success(isEnglish ? 'Content generated — review & save' : 'Translation generated — review & save');
      } else {
        toast.error(res.error || 'AI generation failed');
      }
    } catch {
      toast.error('AI generation failed');
    }
    setLoading(false);
  }

  return (
    <div className="border border-indigo-200 rounded-lg overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 transition-colors text-sm font-medium text-indigo-700">
        <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> AI Generate Content</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-white space-y-3">
          <p className="text-xs text-slate-500">
            {isEnglish
              ? <>AI will generate <strong>English</strong> content for all fields below.</>
              : <>AI will translate the <strong>English</strong> version into <strong>{lang?.name || 'the selected language'}</strong>. The English translation must exist first.</>}
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">AI Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {AI_PROVIDERS.map(p => (
                <button key={p.value} type="button" disabled={loading} onClick={() => setProvider(p.value)}
                  className={cn('px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left',
                    provider === p.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')}>
                  <div className="font-semibold text-xs">{p.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{p.model}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{isEnglish ? 'Generation Prompt' : 'Translation Prompt'} <span className="text-slate-400">(optional)</span></label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} disabled={loading}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px] resize-y disabled:opacity-50"
              placeholder={isEnglish ? 'e.g. Generate clear, helpful content.' : 'e.g. Translate exactly; keep technical/brand words in English.'} />
          </div>
          <Button type="button" onClick={run} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate with AI</>}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────
type MainTab = 'categories' | 'cat_translations' | 'faqs' | 'faq_translations';

type CatSortField = 'id' | 'name' | 'display_order' | 'is_active';
type CatTrSortField = 'id' | 'name' | 'is_active';
type FaqSortField = 'id' | 'question' | 'display_order' | 'is_active' | 'is_featured';
type FaqTrSortField = 'id' | 'question' | 'is_active';

// ─── Constants ───────────────────────────────────────────────────
const ITEM_TYPE_OPTIONS = [
  { value: 'course', label: 'Course' },
  { value: 'bundle', label: 'Bundle' },
  { value: 'batch', label: 'Batch' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'general', label: 'General' },
];

const ITEM_TYPE_COLORS: Record<string, string> = {
  course: 'bg-blue-50 text-blue-700',
  bundle: 'bg-violet-50 text-violet-700',
  batch: 'bg-teal-50 text-teal-700',
  webinar: 'bg-amber-50 text-amber-700',
  general: 'bg-slate-100 text-slate-600',
};

const AUTHOR_TYPE_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'instructor', label: 'Instructor' },
];

const AUTHOR_TYPE_COLORS: Record<string, string> = {
  system: 'bg-blue-50 text-blue-700',
  instructor: 'bg-violet-50 text-violet-700',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

// ─── Helpers ─────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '--';
}

function truncate(s: string | null | undefined, max = 60) {
  if (!s) return '--';
  return s.length > max ? s.slice(0, max) + '...' : s;
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function FAQsPage() {
  const [mainTab, setMainTab] = useState<MainTab>('categories');
  const [filterCategoryFromTab, setFilterCategoryFromTab] = useState<number | null>(null);
  const [filterFaqFromTab, setFilterFaqFromTab] = useState<number | null>(null);

  function navigateToCatTranslations(categoryId: number) {
    setFilterCategoryFromTab(categoryId);
    setMainTab('cat_translations');
  }

  function navigateToFaqTranslations(faqId: number) {
    setFilterFaqFromTab(faqId);
    setMainTab('faq_translations');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="FAQ Management" />

      {/* ── Main Tabs ── */}
      <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
        {([
          { id: 'categories' as MainTab, label: 'Categories', icon: FolderTree },
          { id: 'cat_translations' as MainTab, label: 'Cat. Translations', icon: Globe },
          { id: 'faqs' as MainTab, label: 'FAQs', icon: HelpCircle },
          { id: 'faq_translations' as MainTab, label: 'FAQ Translations', icon: Languages },
        ]).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setMainTab(tab.id); if (tab.id !== 'cat_translations') setFilterCategoryFromTab(null); if (tab.id !== 'faq_translations') setFilterFaqFromTab(null); }}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
                mainTab === tab.id ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      {mainTab === 'categories' && <CategoriesTab onViewTranslations={navigateToCatTranslations} />}
      {mainTab === 'cat_translations' && <CatTranslationsTab filterCategoryId={filterCategoryFromTab} />}
      {mainTab === 'faqs' && <FaqsTab onViewTranslations={navigateToFaqTranslations} />}
      {mainTab === 'faq_translations' && <FaqTranslationsTab filterFaqId={filterFaqFromTab} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: FAQ CATEGORIES
// ══════════════════════════════════════════════════════════════════
function CategoriesTab({ onViewTranslations }: { onViewTranslations: (id: number) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<CatSortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterItemType, setFilterItemType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  interface CoverageItem { faq_category_id: number; total_languages: number; translated_count: number; missing_count: number; is_complete: boolean; }
  const [coverage, setCoverage] = useState<Record<number, CoverageItem>>({});

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
  ]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('faq_categories').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterItemType, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterItemType, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterItemType) params.item_type = filterItemType;
    }
    const res = await api.getFaqCategories(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('faq_categories');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getFaqCategoryTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: any) => { map[c.faq_category_id] = c; });
      setCoverage(map);
    }
  }

  function handleSort(field: CatSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: CatSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({ name: '', slug: '', description: '', item_type: 'general', item_id: '', display_order: '', is_active: true });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      name: c.name || '', slug: c.slug || '', description: c.description || '',
      item_type: c.item_type || 'general', item_id: c.item_id ?? '',
      display_order: c.display_order ?? '', is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['item_id', 'display_order'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateFaqCategory(editing.id, payload)
      : await api.createFaqCategory(payload);
    if (res.success) {
      toast.success(editing ? 'Category updated' : 'Category created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.name}" to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteFaqCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category moved to trash'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreFaqCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category restored'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.name}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteFaqCategory(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Category permanently deleted'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteFaqCategory(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreFaqCategory(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteFaqCategory(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Categories', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      {/* Trash toggle */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Categories
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Category</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterItemType} onChange={e => setFilterItemType(e.target.value)}>
              <option value="">All Item Types</option>
              {ITEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
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
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : FolderTree}
          title={showTrash ? 'Trash is empty' : 'No categories yet'}
          description={showTrash ? 'No deleted categories' : (searchDebounce || filterItemType || filterStatus ? 'No categories match your filters' : 'Create your first FAQ category')}
          action={!showTrash && !searchDebounce && !filterItemType && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Category</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action bar */}
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
                <TH className="sticky top-0 z-10 w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="sticky top-0 z-10 w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
                <TH className="sticky top-0 z-10">Item Type</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Display Order <SortIcon field="display_order" /></button></TH>
                <TH className="sticky top-0 z-10">Translations</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => {
                const cov = coverage[c.id];
                return (
                  <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                    <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                    <TD className="py-2.5">
                      <div className="text-sm font-medium text-slate-900">{c.name}</div>
                      {c.slug && <div className="text-xs text-slate-400">{c.slug}</div>}
                    </TD>
                    <TD className="py-2.5">
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', ITEM_TYPE_COLORS[c.item_type] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(c.item_type || '')}
                      </span>
                    </TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700">{c.display_order ?? '--'}</span></TD>
                    <TD className="py-2.5">
                      {cov ? (
                        <button onClick={() => onViewTranslations(c.id)} className={cn('text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity', cov.is_complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                          {cov.translated_count}/{cov.total_languages}
                        </button>
                      ) : <span className="text-xs text-slate-400">--</span>}
                    </TD>
                    <TD className="py-2.5">
                      {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>}
                    </TD>
                    {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span></TD>}
                    <TD className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {showTrash ? (
                          <>
                            <button onClick={() => onRestore(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                              {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => onPermanentDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                              {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setViewing(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onSoftDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                              {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Category Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <FolderTree className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', ITEM_TYPE_COLORS[viewing.item_type] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.item_type || '')}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Name" value={viewing.name} />
              <DetailRow label="Slug" value={viewing.slug} />
              <DetailRow label="Item Type" value={capitalize(viewing.item_type || '')} />
              <DetailRow label="Item ID" value={viewing.item_id != null ? String(viewing.item_id) : undefined} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
              <DetailRow label="Description" value={viewing.description} />
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Category' : 'Create Category'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
              <Input {...register('name', { required: true })} placeholder="Category name" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Slug</label>
              <Input {...register('slug')} placeholder="auto-generated-slug" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Category description" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Item Type</label>
              <select {...register('item_type')} className={selectClass + ' w-full'}>
                {ITEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Item ID</label>
              <Input {...register('item_id')} type="number" placeholder="Optional item ID" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Display Order</label>
              <Input {...register('display_order')} type="number" min={0} placeholder="0" />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: FAQ CATEGORY TRANSLATIONS
// ══════════════════════════════════════════════════════════════════
function CatTranslationsTab({ filterCategoryId }: { filterCategoryId: number | null }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<CatTrSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterCategory, setFilterCategory] = useState<string>(filterCategoryId ? String(filterCategoryId) : '');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [aiGenerating, setAiGenerating] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    api.getFaqCategories({ limit: 200, is_active: 'true' }).then(res => {
      if (res.success) setCategories(res.data || []);
    });
    api.listLanguages('?is_active=true&limit=50').then(res => {
      if (res.success) setLanguages(res.data || []);
    });
    api.getTableSummary('faq_category_translations').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => {
    if (filterCategoryId) setFilterCategory(String(filterCategoryId));
  }, [filterCategoryId]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterCategory, filterLanguage, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterCategory, filterLanguage, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterCategory) params.faq_category_id = filterCategory;
      if (filterLanguage) params.language_id = filterLanguage;
    }
    const res = await api.getFaqCategoryTranslations(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('faq_category_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: CatTrSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: CatTrSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      faq_category_id: filterCategory || '', language_id: '', name: '', description: '',
      meta_title: '', meta_description: '', meta_keywords: '',
      og_title: '', og_description: '', focus_keyword: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      faq_category_id: c.faq_category_id ?? '', language_id: c.language_id ?? '',
      name: c.name || '', description: c.description || '',
      meta_title: c.meta_title || '', meta_description: c.meta_description || '',
      meta_keywords: c.meta_keywords || '', og_title: c.og_title || '',
      og_description: c.og_description || '', focus_keyword: c.focus_keyword || '',
      is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['faq_category_id', 'language_id'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateFaqCategoryTranslation(editing.id, payload)
      : await api.createFaqCategoryTranslation(payload);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move translation #${c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteFaqCategoryTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreFaqCategoryTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete translation #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteFaqCategoryTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function handleAiGenerate(entityId: number) {
    setAiGenerating(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'faq_category', entity_ids: [entityId], provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s, results: r } = res.data;
        if (s.skipped > 0 && s.success === 0) {
          toast.success('All translations already complete!');
        } else {
          const langsGenerated = r?.reduce((acc: number, item: any) => acc + (item.languages_generated || 0), 0) || 0;
          toast.success(`Generated ${langsGenerated} translation(s)`);
        }
        load();
      } else { toast.error(res.error || 'Generation failed'); }
    } catch { toast.error('AI generation failed'); }
    setAiGenerating(false);
  }

  async function handleBulkAiFill() {
    if (!confirm('This will generate AI content for ALL FAQ categories with missing or empty translations. Continue?')) return;
    setAiGenerating(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'faq_category', generate_all: true, provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s } = res.data;
        toast.success(`Generated content for ${s.success} item(s), ${s.skipped} already complete, ${s.errors} error(s)`);
        load();
      } else { toast.error(res.error || 'Bulk generation failed'); }
    } catch { toast.error('Bulk generation failed'); }
    setAiGenerating(false);
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteFaqCategoryTranslation(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreFaqCategoryTranslation(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteFaqCategoryTranslation(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
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

      {/* Trash toggle */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Cat. Translations
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1 flex items-center gap-2">
            <Button variant="outline" onClick={handleBulkAiFill} disabled={aiGenerating}>
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Fill All Missing
            </Button>
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by name...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All Languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
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
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Globe}
          title={showTrash ? 'Trash is empty' : 'No translations yet'}
          description={showTrash ? 'No deleted translations' : (searchDebounce || filterCategory || filterLanguage || filterStatus ? 'No translations match your filters' : 'Create your first category translation')}
          action={!showTrash && !searchDebounce && !filterCategory && !filterLanguage && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action bar */}
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
                <TH className="sticky top-0 z-10 w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="sticky top-0 z-10 w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="sticky top-0 z-10">Category</TH>
                <TH className="sticky top-0 z-10">Language</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Name <SortIcon field="name" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{c.faq_categories?.name || `#${c.faq_category_id}`}</span></TD>
                  <TD className="py-2.5">
                    <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {c.languages?.iso_code || `#${c.language_id}`}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.name, 50)}</span></TD>
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleAiGenerate(c.faq_category_id)} disabled={aiGenerating} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="AI Generate">
                            {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setViewing(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Category Translation Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Globe className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name || '--'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{viewing.languages?.iso_code || `#${viewing.language_id}`}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Category" value={viewing.faq_categories?.name || `#${viewing.faq_category_id}`} />
              <DetailRow label="Language" value={viewing.languages?.name || `#${viewing.language_id}`} />
              <DetailRow label="Name" value={viewing.name} />
              <DetailRow label="Description" value={viewing.description} />
              <DetailRow label="Meta Title" value={viewing.meta_title} />
              <DetailRow label="Meta Description" value={viewing.meta_description} />
              <DetailRow label="Meta Keywords" value={viewing.meta_keywords} />
              <DetailRow label="OG Title" value={viewing.og_title} />
              <DetailRow label="OG Description" value={viewing.og_description} />
              <DetailRow label="Focus Keyword" value={viewing.focus_keyword} />
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Category Translation' : 'Create Category Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Category <span className="text-red-500">*</span></label>
              <select {...register('faq_category_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Language <span className="text-red-500">*</span></label>
              <select {...register('language_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select language...</option>
                {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
              </select>
            </div>
          </div>
          {watch('faq_category_id') && watch('language_id') && (
            <InlineAiTranslatePanel
              entityType="faq_category"
              entityId={watch('faq_category_id')}
              languageId={watch('language_id')}
              languages={languages}
              onApply={(f) => Object.entries(f).forEach(([k, v]) => setValue(k as any, v as any))}
            />
          )}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Name <span className="text-red-500">*</span></label>
              <Input {...register('name', { required: true })} placeholder="Translated name" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Focus Keyword</label>
              <Input {...register('focus_keyword')} placeholder="Focus keyword" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Translated description" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Title</label>
              <Input {...register('meta_title')} placeholder="Meta title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Keywords</label>
              <Input {...register('meta_keywords')} placeholder="Meta keywords" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Description</label>
            <textarea {...register('meta_description')} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Meta description" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">OG Title</label>
              <Input {...register('og_title')} placeholder="Open Graph title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">OG Description</label>
              <Input {...register('og_description')} placeholder="Open Graph description" />
            </div>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 3: FAQS
// ══════════════════════════════════════════════════════════════════
function FaqsTab({ onViewTranslations }: { onViewTranslations: (id: number) => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<FaqSortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterItemType, setFilterItemType] = useState('');
  const [filterAuthorType, setFilterAuthorType] = useState('');
  const [filterFeatured, setFilterFeatured] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [categories, setCategories] = useState<any[]>([]);

  interface CoverageItem { faq_id: number; total_languages: number; translated_count: number; missing_count: number; is_complete: boolean; }
  const [coverage, setCoverage] = useState<Record<number, CoverageItem>>({});

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
  ]);

  useEffect(() => {
    api.getFaqCategories({ limit: 200, is_active: 'true' }).then(res => {
      if (res.success) setCategories(res.data || []);
    });
    api.getTableSummary('faqs').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterCategory, filterItemType, filterAuthorType, filterFeatured, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterCategory, filterItemType, filterAuthorType, filterFeatured, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterCategory) params.category_id = filterCategory;
      if (filterItemType) params.item_type = filterItemType;
      if (filterAuthorType) params.author_type = filterAuthorType;
      if (filterFeatured) params.is_featured = filterFeatured;
    }
    const res = await api.getFaqs(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('faqs');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getFaqTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: any) => { map[c.faq_id] = c; });
      setCoverage(map);
    }
  }

  function handleSort(field: FaqSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: FaqSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      category_id: '', item_type: 'general', item_id: '', question: '', answer: '',
      author_type: 'system', display_order: '', is_featured: false, is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      category_id: c.category_id ?? '', item_type: c.item_type || 'general',
      item_id: c.item_id ?? '', question: c.question || '', answer: c.answer || '',
      author_type: c.author_type || 'system', display_order: c.display_order ?? '',
      is_featured: c.is_featured ?? false, is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['category_id', 'item_id', 'display_order'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateFaq(editing.id, payload)
      : await api.createFaq(payload);
    if (res.success) {
      toast.success(editing ? 'FAQ updated' : 'FAQ created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move FAQ #${c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteFaq(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('FAQ moved to trash'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreFaq(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('FAQ restored'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete FAQ #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteFaq(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('FAQ permanently deleted'); load(); refreshSummary(); loadCoverage(); }
    else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteFaq(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreFaq(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteFaq(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); loadCoverage();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total FAQs', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      {/* Trash toggle */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          FAQs
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add FAQ</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by question...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className={selectClass} value={filterItemType} onChange={e => setFilterItemType(e.target.value)}>
              <option value="">All Item Types</option>
              {ITEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterAuthorType} onChange={e => setFilterAuthorType(e.target.value)}>
              <option value="">All Authors</option>
              {AUTHOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterFeatured} onChange={e => setFilterFeatured(e.target.value)}>
              <option value="">All Featured</option>
              <option value="true">Featured</option>
              <option value="false">Not Featured</option>
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
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : HelpCircle}
          title={showTrash ? 'Trash is empty' : 'No FAQs yet'}
          description={showTrash ? 'No deleted FAQs' : (searchDebounce || filterCategory || filterItemType || filterAuthorType || filterFeatured || filterStatus ? 'No FAQs match your filters' : 'Create your first FAQ')}
          action={!showTrash && !searchDebounce && !filterCategory && !filterItemType && !filterAuthorType && !filterFeatured && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add FAQ</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action bar */}
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
                <TH className="sticky top-0 z-10 w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="sticky top-0 z-10 w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('question')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Question <SortIcon field="question" /></button></TH>
                <TH className="sticky top-0 z-10">Category</TH>
                <TH className="sticky top-0 z-10">Item Type</TH>
                <TH className="sticky top-0 z-10">Author</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('is_featured')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Featured <SortIcon field="is_featured" /></button></TH>
                <TH className="sticky top-0 z-10">Translations</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Order <SortIcon field="display_order" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => {
                const cov = coverage[c.id];
                return (
                  <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                    <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.question, 50)}</span></TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700">{c.faq_categories?.name || `#${c.category_id}`}</span></TD>
                    <TD className="py-2.5">
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', ITEM_TYPE_COLORS[c.item_type] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(c.item_type || '')}
                      </span>
                    </TD>
                    <TD className="py-2.5">
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', AUTHOR_TYPE_COLORS[c.author_type] || 'bg-slate-100 text-slate-600')}>
                        {capitalize(c.author_type || '')}
                      </span>
                    </TD>
                    <TD className="py-2.5">
                      {c.is_featured ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" /> : <Star className="w-4 h-4 text-slate-300" />}
                    </TD>
                    <TD className="py-2.5">
                      {cov ? (
                        <button onClick={() => onViewTranslations(c.id)} className={cn('text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity', cov.is_complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                          {cov.translated_count}/{cov.total_languages}
                        </button>
                      ) : <span className="text-xs text-slate-400">--</span>}
                    </TD>
                    <TD className="py-2.5"><span className="text-sm text-slate-700">{c.display_order ?? '--'}</span></TD>
                    <TD className="py-2.5">
                      {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>}
                    </TD>
                    {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span></TD>}
                    <TD className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {showTrash ? (
                          <>
                            <button onClick={() => onRestore(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                              {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => onPermanentDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                              {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setViewing(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onSoftDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                              {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="FAQ Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <HelpCircle className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{truncate(viewing.question, 80)}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  {viewing.is_featured && <Badge variant="warning">Featured</Badge>}
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', ITEM_TYPE_COLORS[viewing.item_type] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.item_type || '')}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Category" value={viewing.faq_categories?.name || `#${viewing.category_id}`} />
              <DetailRow label="Item Type" value={capitalize(viewing.item_type || '')} />
              <DetailRow label="Item ID" value={viewing.item_id != null ? String(viewing.item_id) : undefined} />
              <DetailRow label="Author Type" value={capitalize(viewing.author_type || '')} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
              <DetailRow label="Featured" value={viewing.is_featured ? 'Yes' : 'No'} />
            </div>
            <div className="mt-4">
              <DetailRow label="Question" value={viewing.question} />
            </div>
            <div className="mt-4">
              <DetailRow label="Answer" value={viewing.answer} />
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit FAQ' : 'Create FAQ'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Category <span className="text-red-500">*</span></label>
              <select {...register('category_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Author Type</label>
              <select {...register('author_type')} className={selectClass + ' w-full'}>
                {AUTHOR_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Item Type</label>
              <select {...register('item_type')} className={selectClass + ' w-full'}>
                {ITEM_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Item ID</label>
              <Input {...register('item_id')} type="number" placeholder="Optional item ID" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Question <span className="text-red-500">*</span></label>
            <textarea {...register('question', { required: true })} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="FAQ question" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Answer <span className="text-red-500">*</span></label>
            <textarea {...register('answer', { required: true })} rows={5} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="FAQ answer" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Display Order</label>
              <Input {...register('display_order')} type="number" min={0} placeholder="0" />
            </div>
            <div className="flex items-center gap-6 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_featured')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Featured</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 4: FAQ TRANSLATIONS
// ══════════════════════════════════════════════════════════════════
function FaqTranslationsTab({ filterFaqId }: { filterFaqId: number | null }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<FaqTrSortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterFaq, setFilterFaq] = useState<string>(filterFaqId ? String(filterFaqId) : '');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [aiGenerating, setAiGenerating] = useState(false);

  const [faqs, setFaqs] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  useEffect(() => {
    api.getFaqs({ limit: 500, is_active: 'true' }).then(res => {
      if (res.success) setFaqs(res.data || []);
    });
    api.listLanguages('?is_active=true&limit=50').then(res => {
      if (res.success) setLanguages(res.data || []);
    });
    api.getTableSummary('faq_translations').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => {
    if (filterFaqId) setFilterFaq(String(filterFaqId));
  }, [filterFaqId]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterFaq, filterLanguage, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterFaq, filterLanguage, filterStatus, showTrash]);

  async function load() {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize, sort: sortField, order: sortOrder };
    if (searchDebounce) params.search = searchDebounce;
    if (showTrash) { params.show_deleted = 'true'; } else {
      if (filterStatus) params.is_active = filterStatus;
      if (filterFaq) params.faq_id = filterFaq;
      if (filterLanguage) params.language_id = filterLanguage;
    }
    const res = await api.getFaqTranslations(params);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('faq_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: FaqTrSortField) {
    if (sortField === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
    setPage(1);
  }

  function SortIcon({ field }: { field: FaqTrSortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" /> : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    reset({
      faq_id: filterFaq || '', language_id: '', question: '', answer: '',
      meta_title: '', meta_description: '', meta_keywords: '',
      og_title: '', og_description: '', twitter_title: '', twitter_description: '',
      focus_keyword: '', is_active: true,
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    reset({
      faq_id: c.faq_id ?? '', language_id: c.language_id ?? '',
      question: c.question || '', answer: c.answer || '',
      meta_title: c.meta_title || '', meta_description: c.meta_description || '',
      meta_keywords: c.meta_keywords || '', og_title: c.og_title || '',
      og_description: c.og_description || '', twitter_title: c.twitter_title || '',
      twitter_description: c.twitter_description || '', focus_keyword: c.focus_keyword || '',
      is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['faq_id', 'language_id'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateFaqTranslation(editing.id, payload)
      : await api.createFaqTranslation(payload);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move translation #${c.id} to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteFaqTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreFaqTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete translation #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteFaqTranslation(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function handleAiGenerate(entityId: number) {
    setAiGenerating(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'faq', entity_ids: [entityId], provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s, results: r } = res.data;
        if (s.skipped > 0 && s.success === 0) {
          toast.success('All translations already complete!');
        } else {
          const langsGenerated = r?.reduce((acc: number, item: any) => acc + (item.languages_generated || 0), 0) || 0;
          toast.success(`Generated ${langsGenerated} translation(s)`);
        }
        load();
      } else { toast.error(res.error || 'Generation failed'); }
    } catch { toast.error('AI generation failed'); }
    setAiGenerating(false);
  }

  async function handleBulkAiFill() {
    if (!confirm('This will generate AI content for ALL FAQs with missing or empty translations. Continue?')) return;
    setAiGenerating(true);
    try {
      const res = await api.bulkGenerateMissingContent({ entity_type: 'faq', generate_all: true, provider: 'gemini' });
      if (res.success && res.data) {
        const { summary: s } = res.data;
        toast.success(`Generated content for ${s.success} item(s), ${s.skipped} already complete, ${s.errors} error(s)`);
        load();
      } else { toast.error(res.error || 'Bulk generation failed'); }
    } catch { toast.error('Bulk generation failed'); }
    setAiGenerating(false);
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteFaqTranslation(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreFaqTranslation(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteFaqTranslation(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <>
      {/* Summary Stats */}
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

      {/* Trash toggle */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          FAQ Translations
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1 flex items-center gap-2">
            <Button variant="outline" onClick={handleBulkAiFill} disabled={aiGenerating}>
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI Fill All Missing
            </Button>
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search by question...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterFaq} onChange={e => setFilterFaq(e.target.value)}>
              <option value="">All FAQs</option>
              {faqs.map(f => <option key={f.id} value={f.id}>{truncate(f.question, 40)}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All Languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
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
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Languages}
          title={showTrash ? 'Trash is empty' : 'No translations yet'}
          description={showTrash ? 'No deleted translations' : (searchDebounce || filterFaq || filterLanguage || filterStatus ? 'No translations match your filters' : 'Create your first FAQ translation')}
          action={!showTrash && !searchDebounce && !filterFaq && !filterLanguage && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Translation</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action bar */}
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
                <TH className="sticky top-0 z-10 w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="sticky top-0 z-10 w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="sticky top-0 z-10">FAQ</TH>
                <TH className="sticky top-0 z-10">Language</TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('question')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Question <SortIcon field="question" /></button></TH>
                <TH className="sticky top-0 z-10"><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                {showTrash && <TH className="sticky top-0 z-10">Deleted</TH>}
                <TH className="sticky top-0 z-10 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.faqs?.question || `#${c.faq_id}`, 40)}</span></TD>
                  <TD className="py-2.5">
                    <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {c.languages?.iso_code || `#${c.language_id}`}
                    </span>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm text-slate-700">{truncate(c.question, 50)}</span></TD>
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleAiGenerate(c.faq_id)} disabled={aiGenerating} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="AI Generate">
                            {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setViewing(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="FAQ Translation Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                <Languages className="w-6 h-6 text-brand-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{truncate(viewing.question, 80)}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{viewing.languages?.iso_code || `#${viewing.language_id}`}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="FAQ" value={viewing.faqs?.question ? truncate(viewing.faqs.question, 60) : `#${viewing.faq_id}`} />
              <DetailRow label="Language" value={viewing.languages?.name || `#${viewing.language_id}`} />
              <DetailRow label="Focus Keyword" value={viewing.focus_keyword} />
              <DetailRow label="Meta Title" value={viewing.meta_title} />
              <DetailRow label="Meta Description" value={viewing.meta_description} />
              <DetailRow label="Meta Keywords" value={viewing.meta_keywords} />
              <DetailRow label="OG Title" value={viewing.og_title} />
              <DetailRow label="OG Description" value={viewing.og_description} />
              <DetailRow label="Twitter Title" value={viewing.twitter_title} />
              <DetailRow label="Twitter Description" value={viewing.twitter_description} />
            </div>
            <div className="mt-4">
              <DetailRow label="Question" value={viewing.question} />
            </div>
            <div className="mt-4">
              <DetailRow label="Answer" value={viewing.answer} />
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit FAQ Translation' : 'Create FAQ Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5" key={dialogKey}>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">FAQ <span className="text-red-500">*</span></label>
              <select {...register('faq_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select FAQ...</option>
                {faqs.map(f => <option key={f.id} value={f.id}>{truncate(f.question, 50)}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Language <span className="text-red-500">*</span></label>
              <select {...register('language_id', { required: true })} className={selectClass + ' w-full'}>
                <option value="">Select language...</option>
                {languages.map(l => <option key={l.id} value={l.id}>{l.name} ({l.iso_code})</option>)}
              </select>
            </div>
          </div>
          {watch('faq_id') && watch('language_id') && (
            <InlineAiTranslatePanel
              entityType="faq"
              entityId={watch('faq_id')}
              languageId={watch('language_id')}
              languages={languages}
              onApply={(f) => Object.entries(f).forEach(([k, v]) => setValue(k as any, v as any))}
            />
          )}
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Question <span className="text-red-500">*</span></label>
            <textarea {...register('question', { required: true })} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Translated question" />
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Answer <span className="text-red-500">*</span></label>
            <textarea {...register('answer', { required: true })} rows={5} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Translated answer" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Title</label>
              <Input {...register('meta_title')} placeholder="Meta title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Keywords</label>
              <Input {...register('meta_keywords')} placeholder="Meta keywords" />
            </div>
          </div>
          <div>
            <label className="block mb-1.5 text-sm font-medium text-slate-700">Meta Description</label>
            <textarea {...register('meta_description')} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Meta description" />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">OG Title</label>
              <Input {...register('og_title')} placeholder="Open Graph title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">OG Description</label>
              <Input {...register('og_description')} placeholder="Open Graph description" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Twitter Title</label>
              <Input {...register('twitter_title')} placeholder="Twitter title" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Twitter Description</label>
              <Input {...register('twitter_description')} placeholder="Twitter description" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block mb-1.5 text-sm font-medium text-slate-700">Focus Keyword</label>
              <Input {...register('focus_keyword')} placeholder="Focus keyword" />
            </div>
            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
