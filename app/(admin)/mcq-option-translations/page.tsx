"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
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
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Languages, Trash2, Edit2, CheckCircle2, XCircle, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Eye, Loader2, X, Image as ImageIcon } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Language } from '@/lib/types';

/* -- Local types -- */
interface McqOption {
  id: number;
  mcq_question_id: number;
  is_correct: boolean;
  display_order: number;
  [key: string]: any;
}

interface McqOptionTranslation {
  id: number;
  mcq_option_id: number;
  language_id: number;
  option_text: string;
  image?: string | null;
  is_active: boolean;
  deleted_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  mcq_options?: { mcq_question_id: number; is_correct: boolean; display_order: number } | null;
  languages?: { name: string; native_name?: string; iso_code?: string } | null;
}

interface CoverageItem {
  mcq_option_id: number;
  total_languages: number;
  translated_count: number;
  missing_count: number;
  is_complete: boolean;
  translated_languages: { id: number; name: string; iso_code: string }[];
  missing_languages: { id: number; name: string; iso_code: string }[];
}

type SortField = 'id' | 'created_at' | 'mcq_option_id' | 'language_id';

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

export default function McqOptionTranslationsPage() {
  const [items, setItems] = useState<McqOptionTranslation[]>([]);
  const [mcqOptions, setMcqOptions] = useState<McqOption[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [coverage, setCoverage] = useState<CoverageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<McqOptionTranslation | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterMcqOption, setFilterMcqOption] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Cascade filter state
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [mcqQuestions, setMcqQuestions] = useState<any[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterChapterId, setFilterChapterId] = useState('');
  const [filterTopicId, setFilterTopicId] = useState('');
  const [filterQuestionId, setFilterQuestionId] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Image file
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset, setValue, getValues, watch } = useForm();
  const [formLoading, setFormLoading] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<McqOptionTranslation | null>(null);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  // Auto-fetch translation when mcq_option or language changes
  const watchedMcqOptionId = watch('mcq_option_id');
  const watchedLangId = watch('language_id');
  const skipAutoFetchRef = useRef(false);

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
    { key: 'g c', action: () => router.push('/courses') },
  ]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false;
      return;
    }
    if (!watchedMcqOptionId || !watchedLangId) return;

    let cancelled = false;
    const fetchTranslation = async () => {
      setFormLoading(true);
      const qs = `?mcq_option_id=${watchedMcqOptionId}&language_id=${watchedLangId}&limit=1`;
      const res = await api.listMcqOptionTranslations(qs);
      if (cancelled) return;

      if (res.success && res.data && res.data.length > 0) {
        const item = res.data[0] as McqOptionTranslation;
        setEditing(item);
        setFormMode('existing');
        populateForm(item);
        toast.info(`Loaded existing ${languages.find(l => String(l.id) === String(watchedLangId))?.name || ''} translation`);
      } else {
        setEditing(null);
        setFormMode('new');
        clearFormFields();
      }
      setFormLoading(false);
    };

    const timer = setTimeout(fetchTranslation, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [watchedMcqOptionId, watchedLangId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.listMcqOptions('?limit=999&sort=display_order&order=asc').then(res => { if (res.success) setMcqOptions(res.data || []); });
    api.listLanguages('?limit=999&sort=name&order=asc').then(res => { if (res.success) setLanguages(res.data || []); });
    api.listSubjects('?limit=999&sort=display_order&order=asc').then(res => { if (res.success) setSubjects(res.data || []); });
    refreshSummary();
    loadCoverage();
  }, []);

  // Cascade: when filter subject changes, load chapters
  useEffect(() => {
    setFilterChapterId('');
    setFilterTopicId('');
    setFilterQuestionId('');
    setFilterMcqOption('');
    if (filterSubjectId) {
      api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${filterSubjectId}`).then(res => {
        if (res.success) setChapters(res.data || []);
        else setChapters([]);
      });
    } else {
      setChapters([]);
    }
    setTopics([]);
    setMcqQuestions([]);
  }, [filterSubjectId]);

  // Cascade: when filter chapter changes, load topics
  useEffect(() => {
    setFilterTopicId('');
    setFilterQuestionId('');
    setFilterMcqOption('');
    if (filterChapterId) {
      api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${filterChapterId}`).then(res => {
        if (res.success) setTopics(res.data || []);
        else setTopics([]);
      });
    } else {
      setTopics([]);
    }
    setMcqQuestions([]);
  }, [filterChapterId]);

  // Cascade: when filter topic changes, load questions
  useEffect(() => {
    setFilterQuestionId('');
    setFilterMcqOption('');
    if (filterTopicId) {
      api.listMcqQuestions(`?limit=999&sort=display_order&order=asc&topic_id=${filterTopicId}`).then(res => {
        if (res.success) setMcqQuestions(res.data || []);
        else setMcqQuestions([]);
      });
    } else {
      setMcqQuestions([]);
    }
  }, [filterTopicId]);

  // Cascade: when filter question changes, reload mcqOptions filtered by that question
  useEffect(() => {
    setFilterMcqOption('');
    if (filterQuestionId) {
      api.listMcqOptions(`?mcq_question_id=${filterQuestionId}&limit=999&sort=display_order&order=asc`).then(res => {
        if (res.success) setMcqOptions(res.data || []);
        else setMcqOptions([]);
      });
    } else {
      api.listMcqOptions('?limit=999&sort=display_order&order=asc').then(res => {
        if (res.success) setMcqOptions(res.data || []);
      });
    }
  }, [filterQuestionId]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterMcqOption, filterLanguage, filterStatus, filterSubjectId, filterChapterId, filterTopicId, filterQuestionId, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterMcqOption, filterLanguage, filterStatus, filterSubjectId, filterChapterId, filterTopicId, filterQuestionId, sortField, sortOrder, pageSize, showTrash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSummary() {
    const res = await api.getTableSummary('mcq_option_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getMcqOptionTranslationCoverage();
    if (res.success && Array.isArray(res.data)) setCoverage(res.data);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterMcqOption) qs.set('mcq_option_id', filterMcqOption);
      if (filterLanguage) qs.set('language_id', filterLanguage);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listMcqOptionTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  function resetImageState() {
    setImageFile(null);
    setImagePreview(null);
  }

  const defaultFormValues = {
    mcq_option_id: '',
    language_id: '',
    option_text: '',
    is_active: true,
  };

  function clearFormFields() {
    const oid = getValues('mcq_option_id');
    const lid = getValues('language_id');
    Object.entries(defaultFormValues).forEach(([k, v]) => setValue(k, v));
    setValue('mcq_option_id', oid);
    setValue('language_id', lid);
    resetImageState();
  }

  function populateForm(item: McqOptionTranslation) {
    setValue('option_text', item.option_text || '');
    setValue('is_active', item.is_active ?? true);
    resetImageState();
  }

  function openCreate() {
    skipAutoFetchRef.current = true;
    setEditing(null); setFormMode('new'); resetImageState(); setDialogKey(k => k + 1);
    reset({ ...defaultFormValues, mcq_option_id: mcqOptions[0]?.id || '', language_id: languages[0]?.id || '' });
    setDialogOpen(true);
  }

  function openEdit(item: McqOptionTranslation) {
    skipAutoFetchRef.current = true;
    setEditing(item); setFormMode('existing'); resetImageState(); setDialogKey(k => k + 1);
    reset({
      mcq_option_id: item.mcq_option_id,
      language_id: item.language_id,
      option_text: item.option_text || '',
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();

    // Scalar fields
    const scalarFields = ['mcq_option_id', 'language_id', 'option_text'];
    scalarFields.forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });

    // Boolean
    fd.append('is_active', String(data.is_active === true || data.is_active === 'true'));

    // Image file
    if (imageFile) fd.append('image_file', imageFile, imageFile.name);

    const res = editing
      ? await api.updateMcqOptionTranslation(editing.id, fd, true)
      : await api.createMcqOptionTranslation(fd, true);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: McqOptionTranslation) {
    if (!confirm(`Move translation #${item.id} to trash? You can restore it later.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteMcqOptionTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: McqOptionTranslation) {
    setActionLoadingId(item.id);
    const res = await api.restoreMcqOptionTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Translation #${item.id} restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: McqOptionTranslation) {
    if (!confirm(`PERMANENTLY delete translation #${item.id}? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteMcqOptionTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: McqOptionTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateMcqOptionTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: McqOptionTranslation) {
    setViewItem(item);
    setViewOpen(true);
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
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteMcqOptionTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreMcqOptionTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteMcqOptionTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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

  function getOptionLabel(optionId: number): string {
    const opt = mcqOptions.find(o => o.id === optionId);
    if (!opt) return `Option #${optionId}`;
    return `Option #${opt.id} (Q${opt.mcq_question_id}, Order: ${opt.display_order})`;
  }

  /* -- Shared select class -- */
  const selectClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="animate-fade-in">
      <PageHeader title="MCQ Option Translations" description="Manage translations for MCQ options"
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

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search translations...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterSubjectId} onChange={e => setFilterSubjectId(e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.english_name || s.name || `Subject ${s.id}`}</option>)}
            </select>
            <select className={selectClass} value={filterChapterId} onChange={e => setFilterChapterId(e.target.value)} disabled={!filterSubjectId}>
              <option value="">All Chapters</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name || `Chapter ${c.id}`}</option>)}
            </select>
            <select className={selectClass} value={filterTopicId} onChange={e => setFilterTopicId(e.target.value)} disabled={!filterChapterId}>
              <option value="">All Topics</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name || `Topic ${t.id}`}</option>)}
            </select>
            <select className={selectClass} value={filterQuestionId} onChange={e => setFilterQuestionId(e.target.value)} disabled={!filterTopicId}>
              <option value="">All Questions</option>
              {mcqQuestions.map(q => <option key={q.id} value={String(q.id)}>{q.display_order ? q.display_order + '. ' : ''}{q.code || `Question #${q.id}`}</option>)}
            </select>
            <select className={selectClass} value={filterMcqOption} onChange={e => setFilterMcqOption(e.target.value)} disabled={!filterQuestionId}>
              <option value="">All Options</option>
              {mcqOptions.map(o => <option key={o.id} value={o.id}>{o.display_order ? o.display_order + '. ' : ''}Option #{o.id}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
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
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : Languages} title={showTrash ? 'Trash is empty' : 'No translations yet'} description={showTrash ? 'Deleted translations will appear here' : 'Add your first MCQ option translation'}
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
                  <TH><button onClick={() => handleSort('mcq_option_id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Option <SortIcon field="mcq_option_id" /></button></TH>
                  <TH><button onClick={() => handleSort('language_id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Language <SortIcon field="language_id" /></button></TH>
                  <TH>Option Text</TH>
                  <TH>Has Image</TH>
                  {showTrash && <TH>Deleted</TH>}
                  <TH>Active</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map(item => (
                  <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-brand-50/40')}>
                    <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                    <TD className="py-2.5">
                      {item.mcq_options ? (
                        <Badge variant="info">Opt #{item.mcq_option_id} (Q{item.mcq_options.mcq_question_id})</Badge>
                      ) : (
                        <Badge variant="muted">Option #{item.mcq_option_id}</Badge>
                      )}
                    </TD>
                    <TD className="py-2.5">{item.languages?.name ? <Badge variant="muted">{item.languages.name}{item.languages.iso_code ? ` (${item.languages.iso_code})` : ''}</Badge> : <span className="text-slate-300">--</span>}</TD>
                    <TD className="py-2.5"><span className={cn('text-sm', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.option_text ? (item.option_text.length > 60 ? item.option_text.substring(0, 60) + '...' : item.option_text) : <span className="text-slate-300 italic">Empty</span>}</span></TD>
                    <TD className="py-2.5">
                      {item.image ? <ImageIcon className="w-3.5 h-3.5 text-emerald-500" /> : <span className="text-slate-300">--</span>}
                    </TD>
                    {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '--'}</span></TD>}
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

      {/* --- View Dialog --- */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="View MCQ Option Translation" size="lg">
        {viewItem && (
          <div className="p-6 space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{getOptionLabel(viewItem.mcq_option_id)}</Badge>
              <Badge variant="muted">{viewItem.languages?.name || `Lang #${viewItem.language_id}`}{viewItem.languages?.iso_code ? ` (${viewItem.languages.iso_code})` : ''}</Badge>
              <Badge variant={viewItem.is_active ? 'success' : 'danger'}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>

            {/* Option details */}
            {viewItem.mcq_options && (
              <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1">
                <span className="block text-xs font-medium text-slate-500">MCQ Option Details</span>
                <div className="flex items-center gap-3 text-sm text-slate-700">
                  <span>Question ID: {viewItem.mcq_options.mcq_question_id}</span>
                  <span>Order: {viewItem.mcq_options.display_order}</span>
                  <Badge variant={viewItem.mcq_options.is_correct ? 'success' : 'danger'}>{viewItem.mcq_options.is_correct ? 'Correct' : 'Incorrect'}</Badge>
                </div>
              </div>
            )}

            <ViewField label="Option Text" value={viewItem.option_text} />

            {/* Image preview */}
            <div>
              <span className="block text-xs font-medium text-slate-500 mb-1">Image</span>
              {viewItem.image ? (
                <img src={viewItem.image} alt="Option image" className="max-h-48 rounded-lg border border-slate-200" />
              ) : (
                <p className="text-sm text-slate-300 italic">No image</p>
              )}
            </div>

            {/* Audit fields */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <ViewField label="Created At" value={viewItem.created_at ? fromNow(viewItem.created_at) : null} />
              <ViewField label="Updated At" value={viewItem.updated_at ? fromNow(viewItem.updated_at) : null} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => { setViewOpen(false); openEdit(viewItem); }}>
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* --- Edit / Create Dialog --- */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit MCQ Option Translation' : 'Add MCQ Option Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle -- only shown when editing */}
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
                  const refreshed = await api.getMcqOptionTranslation(editing.id);
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

          {/* Mode badge */}
          <div className="flex items-center gap-2">
            <Badge variant={formMode === 'existing' ? 'info' : 'success'}>
              {formMode === 'existing' ? 'Editing existing translation' : 'New translation'}
            </Badge>
            {formLoading && <span className="text-xs text-slate-400 animate-pulse">Loading translation...</span>}
          </div>

          {/* Dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MCQ Option</label>
              <select className={cn(selectClass, 'w-full')} {...register('mcq_option_id', { required: true })}>
                {mcqOptions.map(o => <option key={o.id} value={o.id}>{o.display_order ? o.display_order + '. ' : ''}Option #{o.id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
              <select className={cn(selectClass, 'w-full')} {...register('language_id', { required: true })}>
                {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
              </select>
            </div>
          </div>

          {/* Option text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Option Text</label>
            <textarea className={cn(selectClass, 'w-full min-h-[100px]')} placeholder="Translated option text..." {...register('option_text', { required: true })} />
          </div>

          {/* Image upload */}
          <ImageUpload key={`image-${dialogKey}`} label="Image" hint="Optional image for this option"
            value={editing?.image} shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }} />

          {/* Active checkbox (for new) */}
          {!editing && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                Active
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={formLoading}>{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
