"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
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
interface DescQuestion {
  id: number;
  code: string;
  slug: string;
  is_active: boolean;
  [key: string]: any;
}

interface DescQuestionTranslation {
  id: number;
  descriptive_question_id: number;
  language_id: number;
  question_text: string;
  answer_text: string;
  hint_text?: string | null;
  explanation_text?: string | null;
  image_1_url?: string | null;
  image_2_url?: string | null;
  is_active: boolean;
  deleted_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  descriptive_questions?: { code: string; slug?: string } | null;
  languages?: { name: string; native_name?: string; iso_code?: string } | null;
}

interface CoverageItem {
  descriptive_question_id: number;
  total_languages: number;
  translated_count: number;
  missing_count: number;
  is_complete: boolean;
  translated_languages: { id: number; name: string; iso_code: string }[];
  missing_languages: { id: number; name: string; iso_code: string }[];
}

type SortField = 'id' | 'created_at' | 'descriptive_question_id' | 'language_id';

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

export default function DescQuestionTranslationsPage() {
  const [items, setItems] = useState<DescQuestionTranslation[]>([]);
  const [descQuestions, setDescQuestions] = useState<DescQuestion[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DescQuestionTranslation | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterChapterId, setFilterChapterId] = useState('');
  const [filterTopicId, setFilterTopicId] = useState('');
  const [filterQuestion, setFilterQuestion] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
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

  // Image files
  const [image1File, setImage1File] = useState<File | null>(null);
  const [image1Preview, setImage1Preview] = useState<string | null>(null);
  const [image2File, setImage2File] = useState<File | null>(null);
  const [image2Preview, setImage2Preview] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset, setValue, getValues, watch } = useForm();
  const [formLoading, setFormLoading] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<DescQuestionTranslation | null>(null);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- Read descriptive_question_id from URL search params to pre-filter ---
  useEffect(() => {
    const urlDescQuestionId = searchParams.get('descriptive_question_id');
    if (urlDescQuestionId) {
      setFilterQuestion(urlDescQuestionId);
    }
  }, [searchParams]);

  // --- Auto-fetch translation when question or language changes ---
  const watchedQuestionId = watch('descriptive_question_id');
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
    if (!watchedQuestionId || !watchedLangId) return;

    let cancelled = false;
    const fetchTranslation = async () => {
      setFormLoading(true);
      const qs = `?descriptive_question_id=${watchedQuestionId}&language_id=${watchedLangId}&limit=1`;
      const res = await api.listDescQuestionTranslations(qs);
      if (cancelled) return;

      if (res.success && res.data && res.data.length > 0) {
        const item = res.data[0] as DescQuestionTranslation;
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
  }, [watchedQuestionId, watchedLangId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.listDescQuestions('?limit=999&sort=display_order&order=asc').then(res => { if (res.success) setDescQuestions(res.data || []); });
    api.listLanguages('?limit=999&sort=name&order=asc').then(res => { if (res.success) setLanguages(res.data || []); });
    api.listSubjects('?limit=999&sort=display_order&order=asc').then(res => { if (res.success) setSubjects(res.data || []); });
    refreshSummary();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Filter cascades
  useEffect(() => {
    setFilterChapterId(''); setFilterTopicId(''); setFilterQuestion('');
    setChapters([]); setTopics([]);
    if (filterSubjectId) {
      api.listChapters(`?subject_id=${filterSubjectId}&limit=999&sort=display_order&order=asc`).then(res => { if (res.success) setChapters(res.data || []); });
    }
  }, [filterSubjectId]);

  useEffect(() => {
    setFilterTopicId(''); setFilterQuestion('');
    setTopics([]);
    if (filterChapterId) {
      api.listTopics(`?chapter_id=${filterChapterId}&limit=999&sort=display_order&order=asc`).then(res => { if (res.success) setTopics(res.data || []); });
    }
  }, [filterChapterId]);

  useEffect(() => {
    setFilterQuestion('');
    if (filterTopicId) {
      api.listDescQuestions(`?topic_id=${filterTopicId}&limit=999&sort=display_order&order=asc`).then(res => { if (res.success) setDescQuestions(res.data || []); });
    } else {
      api.listDescQuestions('?limit=999&sort=display_order&order=asc').then(res => { if (res.success) setDescQuestions(res.data || []); });
    }
  }, [filterTopicId]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterQuestion, filterLanguage, filterStatus, filterSubjectId, filterChapterId, filterTopicId, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterQuestion, filterLanguage, filterStatus, filterSubjectId, filterChapterId, filterTopicId, sortField, sortOrder, pageSize, showTrash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSummary() {
    const res = await api.getTableSummary('descriptive_question_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterQuestion) qs.set('descriptive_question_id', filterQuestion);
      if (filterLanguage) qs.set('language_id', filterLanguage);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listDescQuestionTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  function resetImageState() {
    setImage1File(null); setImage1Preview(null);
    setImage2File(null); setImage2Preview(null);
  }

  const defaultFormValues = {
    descriptive_question_id: '', language_id: '',
    question_text: '', answer_text: '', hint_text: '', explanation_text: '',
    is_active: true,
    image_1_url: '', image_2_url: '',
  };

  function clearFormFields() {
    const qid = getValues('descriptive_question_id');
    const lid = getValues('language_id');
    Object.entries(defaultFormValues).forEach(([k, v]) => setValue(k, v));
    setValue('descriptive_question_id', qid);
    setValue('language_id', lid);
    resetImageState();
  }

  function populateForm(item: DescQuestionTranslation) {
    setValue('question_text', item.question_text || '');
    setValue('answer_text', item.answer_text || '');
    setValue('explanation_text', item.explanation_text || '');
    setValue('hint_text', item.hint_text || '');
    setValue('is_active', item.is_active ?? true);
    setValue('image_1_url', item.image_1_url || '');
    setValue('image_2_url', item.image_2_url || '');
    resetImageState();
  }

  function openCreate() {
    skipAutoFetchRef.current = true;
    setEditing(null); setFormMode('new'); resetImageState(); setDialogKey(k => k + 1);
    reset({ ...defaultFormValues, descriptive_question_id: descQuestions[0]?.id || '', language_id: languages[0]?.id || '' });
    setDialogOpen(true);
  }

  function openEdit(item: DescQuestionTranslation) {
    skipAutoFetchRef.current = true;
    setEditing(item); setFormMode('existing'); resetImageState(); setDialogKey(k => k + 1);
    reset({
      descriptive_question_id: item.descriptive_question_id, language_id: item.language_id,
      question_text: item.question_text || '', answer_text: item.answer_text || '',
      hint_text: item.hint_text || '', explanation_text: item.explanation_text || '',
      is_active: item.is_active ?? true,
      image_1_url: item.image_1_url || '', image_2_url: item.image_2_url || '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();

    // Scalar text fields
    const scalarFields = [
      'descriptive_question_id', 'language_id', 'question_text', 'answer_text',
      'hint_text', 'explanation_text', 'image_1_url', 'image_2_url',
    ];
    scalarFields.forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });

    // Boolean
    fd.append('is_active', String(data.is_active === true || data.is_active === 'true'));

    // Image files
    if (image1File) fd.append('image_1_file', image1File, image1File.name);
    if (image2File) fd.append('image_2_file', image2File, image2File.name);

    const res = editing
      ? await api.updateDescQuestionTranslation(editing.id, fd, true)
      : await api.createDescQuestionTranslation(fd, true);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: DescQuestionTranslation) {
    if (!confirm(`Move translation #${item.id} to trash? You can restore it later.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteDescQuestionTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: DescQuestionTranslation) {
    setActionLoadingId(item.id);
    const res = await api.restoreDescQuestionTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Translation #${item.id} restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: DescQuestionTranslation) {
    if (!confirm(`PERMANENTLY delete translation #${item.id}? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteDescQuestionTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: DescQuestionTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateDescQuestionTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: DescQuestionTranslation) {
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
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteDescQuestionTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreDescQuestionTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteDescQuestionTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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

  /* -- Shared select class -- */
  const selectClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Descriptive Question Translations" description="Manage translations for descriptive questions"
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
              {subjects.map(s => <option key={s.id} value={s.id}>{s.english_name || s.name}</option>)}
            </select>
            <select className={selectClass} value={filterChapterId} onChange={e => setFilterChapterId(e.target.value)} disabled={!filterSubjectId}>
              <option value="">All Chapters</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name}</option>)}
            </select>
            <select className={selectClass} value={filterTopicId} onChange={e => setFilterTopicId(e.target.value)} disabled={!filterChapterId}>
              <option value="">All Topics</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name}</option>)}
            </select>
            <select className={selectClass} value={filterQuestion} onChange={e => setFilterQuestion(e.target.value)} disabled={!filterTopicId}>
              <option value="">All Questions</option>
              {descQuestions.map(q => <option key={q.id} value={q.id}>{q.display_order ? q.display_order + '. ' : ''}{q.code}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat">
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
        <EmptyState icon={showTrash ? Trash2 : Languages} title={showTrash ? 'Trash is empty' : 'No translations yet'} description={showTrash ? 'Deleted translations will appear here' : 'Add your first descriptive question translation'}
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
                  <TH><button onClick={() => handleSort('descriptive_question_id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Question <SortIcon field="descriptive_question_id" /></button></TH>
                  <TH><button onClick={() => handleSort('language_id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Language <SortIcon field="language_id" /></button></TH>
                  <TH>Question Text</TH>
                  <TH>Answer Text</TH>
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
                      {item.descriptive_questions?.code ? (
                        <div>
                          <Badge variant="info">{item.descriptive_questions.code}</Badge>
                          {item.descriptive_questions.slug && <span className="block text-xs text-slate-400 mt-0.5">{item.descriptive_questions.slug}</span>}
                        </div>
                      ) : <span className="text-slate-300">--</span>}
                    </TD>
                    <TD className="py-2.5">{item.languages?.name ? <Badge variant="muted">{item.languages.name}{item.languages.iso_code ? ` (${item.languages.iso_code})` : ''}</Badge> : <span className="text-slate-300">--</span>}</TD>
                    <TD className="py-2.5">
                      <span className={cn('text-sm', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                        {item.question_text ? (item.question_text.length > 50 ? item.question_text.substring(0, 50) + '...' : item.question_text) : <span className="text-slate-300 italic">Empty</span>}
                      </span>
                    </TD>
                    <TD className="py-2.5">
                      {item.answer_text ? (
                        <span className={cn('text-sm', showTrash ? 'text-slate-500 line-through' : 'text-slate-700')}>
                          {item.answer_text.length > 50 ? item.answer_text.substring(0, 50) + '...' : item.answer_text}
                        </span>
                      ) : <span className="text-slate-300 italic">--</span>}
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
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="View Descriptive Question Translation" size="lg">
        {viewItem && (
          <div className="p-6 space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{descQuestions.find(q => q.id === viewItem.descriptive_question_id)?.code || `Question #${viewItem.descriptive_question_id}`}</Badge>
              <Badge variant="muted">{viewItem.languages?.name || `Lang #${viewItem.language_id}`}{viewItem.languages?.iso_code ? ` (${viewItem.languages.iso_code})` : ''}</Badge>
              <Badge variant={viewItem.is_active ? 'success' : 'danger'}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>

            <div className="space-y-3">
              <ViewField label="Question Text" value={viewItem.question_text} />
              {/* Answer Text - shown prominently */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <span className="block text-xs font-semibold text-emerald-700 mb-1">Answer Text (Model Answer)</span>
                <p className="text-sm text-emerald-900 whitespace-pre-wrap">{viewItem.answer_text || <span className="text-slate-300 italic font-normal">Not set</span>}</p>
              </div>
              <ViewField label="Hint Text" value={viewItem.hint_text} />
              <ViewField label="Explanation Text" value={viewItem.explanation_text} />
            </div>

            {/* Image previews */}
            <div className="space-y-3">
              <span className="block text-xs font-medium text-slate-500 mb-1">Images</span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-slate-400 mb-1">Image 1</span>
                  {viewItem.image_1_url ? (
                    <img src={viewItem.image_1_url} alt="Image 1" className="max-h-40 rounded-lg border border-slate-200" />
                  ) : (
                    <p className="text-sm text-slate-300 italic">Not set</p>
                  )}
                </div>
                <div>
                  <span className="block text-xs text-slate-400 mb-1">Image 2</span>
                  {viewItem.image_2_url ? (
                    <img src={viewItem.image_2_url} alt="Image 2" className="max-h-40 rounded-lg border border-slate-200" />
                  ) : (
                    <p className="text-sm text-slate-300 italic">Not set</p>
                  )}
                </div>
              </div>
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Descriptive Question Translation' : 'Add Descriptive Question Translation'} size="lg">
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
                  const refreshed = await api.getDescQuestionTranslation(editing.id);
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Descriptive Question</label>
              <select className={cn(selectClass, 'w-full')} {...register('descriptive_question_id', { required: true })}>
                {descQuestions.map(q => <option key={q.id} value={q.id}>{q.display_order ? q.display_order + '. ' : ''}{q.code}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
              <select className={cn(selectClass, 'w-full')} {...register('language_id', { required: true })}>
                {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
              </select>
            </div>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Question Text <span className="text-red-500">*</span></label>
            <textarea className={cn(selectClass, 'w-full min-h-[120px]')} placeholder="Translated question text..." {...register('question_text', { required: true })} />
          </div>

          {/* Answer Text - prominent */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <label className="block text-sm font-semibold text-emerald-800 mb-1">Answer Text (Model Answer) <span className="text-red-500">*</span></label>
            <textarea className={cn(selectClass, 'w-full min-h-[100px] border-emerald-300 focus:ring-emerald-500')} placeholder="The model answer for this descriptive question..." {...register('answer_text', { required: true })} />
            <p className="text-xs text-emerald-600 mt-1">This is the expected model answer for this descriptive question translation.</p>
          </div>

          {/* Hint Text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hint Text</label>
            <textarea className={cn(selectClass, 'w-full min-h-[60px]')} placeholder="Hint for the student..." {...register('hint_text')} />
          </div>

          {/* Explanation Text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Explanation Text</label>
            <textarea className={cn(selectClass, 'w-full min-h-[80px]')} placeholder="Explanation for the answer..." {...register('explanation_text')} />
          </div>

          {/* Images */}
          <div className="grid grid-cols-2 gap-4">
            <ImageUpload key={`img1-${dialogKey}`} label="Image 1" hint="Question image 1"
              value={editing?.image_1_url} shape="rounded"
              onChange={(file, preview) => { setImage1File(file); setImage1Preview(preview); }} />
            <ImageUpload key={`img2-${dialogKey}`} label="Image 2" hint="Question image 2"
              value={editing?.image_2_url} shape="rounded"
              onChange={(file, preview) => { setImage2File(file); setImage2Preview(preview); }} />
          </div>

          {/* Active checkbox */}
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
