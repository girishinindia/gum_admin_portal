"use client";
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Languages, Trash2, Edit2, CheckCircle2, XCircle, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Eye, Loader2, X } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Language } from '@/lib/types';

/* -- Local types -- */
interface MatchingPair {
  id: number;
  [key: string]: any;
}

interface MatchingPairTranslation {
  id: number;
  matching_pair_id: number;
  language_id: number;
  left_text: string;
  right_text: string;
  is_active: boolean;
  deleted_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  matching_pairs?: { id: number } | null;
  languages?: { name: string; native_name?: string; iso_code?: string } | null;
}

interface CoverageItem {
  matching_pair_id: number;
  total_languages: number;
  translated_count: number;
  missing_count: number;
  is_complete: boolean;
  translated_languages: { id: number; name: string; iso_code: string }[];
  missing_languages: { id: number; name: string; iso_code: string }[];
}

type SortField = 'id' | 'created_at' | 'matching_pair_id' | 'language_id';

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

export default function MatchingPairTranslationsPage() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<MatchingPairTranslation[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<MatchingPair[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [coverage, setCoverage] = useState<CoverageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MatchingPairTranslation | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [matchingQuestions, setMatchingQuestions] = useState<any[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState('');
  const [filterChapterId, setFilterChapterId] = useState('');
  const [filterTopicId, setFilterTopicId] = useState('');
  const [filterQuestionId, setFilterQuestionId] = useState('');
  const [filterPairId, setFilterPairId] = useState(searchParams.get('matching_pair_id') || '');
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

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset, setValue, getValues, watch } = useForm();
  const [formLoading, setFormLoading] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<MatchingPairTranslation | null>(null);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  // Auto-fetch translation when pair or language changes
  const watchedPairId = watch('matching_pair_id');
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
    if (!watchedPairId || !watchedLangId) return;

    let cancelled = false;
    const fetchTranslation = async () => {
      setFormLoading(true);
      const qs = `?matching_pair_id=${watchedPairId}&language_id=${watchedLangId}&limit=1`;
      const res = await api.listMatchingPairTranslations(qs);
      if (cancelled) return;

      if (res.success && res.data && res.data.length > 0) {
        const item = res.data[0] as MatchingPairTranslation;
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
  }, [watchedPairId, watchedLangId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.listMatchingPairs('?limit=999&sort=display_order&order=asc').then(res => { if (res.success) setMatchingPairs(res.data || []); });
    api.listLanguages('?limit=999&sort=name&order=asc').then(res => { if (res.success) setLanguages(res.data || []); });
    api.listSubjects('?limit=999&sort=display_order&order=asc').then(res => { if (res.success) setSubjects(res.data || []); });
    refreshSummary();
    loadCoverage();
  }, []);

  // Cascade filters: Subject → Chapter → Topic → Question → Pair
  useEffect(() => {
    setFilterChapterId(''); setFilterTopicId(''); setFilterQuestionId(''); setFilterPairId('');
    setChapters([]); setTopics([]); setMatchingQuestions([]);
    if (filterSubjectId) {
      api.listChapters(`?subject_id=${filterSubjectId}&limit=999&sort=display_order&order=asc`).then(res => { if (res.success) setChapters(res.data || []); });
    }
  }, [filterSubjectId]);

  useEffect(() => {
    setFilterTopicId(''); setFilterQuestionId(''); setFilterPairId('');
    setTopics([]); setMatchingQuestions([]);
    if (filterChapterId) {
      api.listTopics(`?chapter_id=${filterChapterId}&limit=999&sort=display_order&order=asc`).then(res => { if (res.success) setTopics(res.data || []); });
    }
  }, [filterChapterId]);

  useEffect(() => {
    setFilterQuestionId(''); setFilterPairId('');
    setMatchingQuestions([]);
    if (filterTopicId) {
      api.listMatchingQuestions(`?topic_id=${filterTopicId}&limit=999&sort=display_order&order=asc`).then(res => { if (res.success) setMatchingQuestions(res.data || []); });
    }
  }, [filterTopicId]);

  useEffect(() => {
    setFilterPairId('');
    if (filterQuestionId) {
      api.listMatchingPairs(`?matching_question_id=${filterQuestionId}&limit=999&sort=display_order&order=asc`).then(res => { if (res.success) setMatchingPairs(res.data || []); });
    } else {
      api.listMatchingPairs('?limit=999&sort=display_order&order=asc').then(res => { if (res.success) setMatchingPairs(res.data || []); });
    }
  }, [filterQuestionId]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterPairId, filterLanguage, filterStatus, filterSubjectId, filterChapterId, filterTopicId, filterQuestionId, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterPairId, filterLanguage, filterStatus, filterSubjectId, filterChapterId, filterTopicId, filterQuestionId, sortField, sortOrder, pageSize, showTrash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSummary() {
    const res = await api.getTableSummary('matching_pair_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getMatchingPairTranslationCoverage();
    if (res.success && Array.isArray(res.data)) setCoverage(res.data);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterPairId) qs.set('matching_pair_id', filterPairId);
      if (filterLanguage) qs.set('language_id', filterLanguage);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listMatchingPairTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  const defaultFormValues = {
    matching_pair_id: '',
    language_id: '',
    left_text: '',
    right_text: '',
    is_active: true,
  };

  function clearFormFields() {
    const pid = getValues('matching_pair_id');
    const lid = getValues('language_id');
    Object.entries(defaultFormValues).forEach(([k, v]) => setValue(k, v));
    setValue('matching_pair_id', pid);
    setValue('language_id', lid);
  }

  function populateForm(item: MatchingPairTranslation) {
    setValue('left_text', item.left_text || '');
    setValue('right_text', item.right_text || '');
    setValue('is_active', item.is_active ?? true);
  }

  function openCreate() {
    skipAutoFetchRef.current = true;
    setEditing(null); setFormMode('new'); setDialogKey(k => k + 1);
    reset({ ...defaultFormValues, matching_pair_id: matchingPairs[0]?.id || '', language_id: languages[0]?.id || '' });
    setDialogOpen(true);
  }

  function openEdit(item: MatchingPairTranslation) {
    skipAutoFetchRef.current = true;
    setEditing(item); setFormMode('existing'); setDialogKey(k => k + 1);
    reset({
      matching_pair_id: item.matching_pair_id,
      language_id: item.language_id,
      left_text: item.left_text || '',
      right_text: item.right_text || '',
      is_active: item.is_active ?? true,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};

    // Scalar fields
    const scalarFields = ['matching_pair_id', 'language_id', 'left_text', 'right_text'];
    scalarFields.forEach(k => {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') {
        payload[k] = ['matching_pair_id', 'language_id'].includes(k) ? Number(data[k]) : data[k];
      }
    });

    // Boolean
    payload.is_active = data.is_active === true || data.is_active === 'true';

    const res = editing
      ? await api.updateMatchingPairTranslation(editing.id, payload)
      : await api.createMatchingPairTranslation(payload);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: MatchingPairTranslation) {
    if (!confirm(`Move translation #${item.id} to trash? You can restore it later.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteMatchingPairTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: MatchingPairTranslation) {
    setActionLoadingId(item.id);
    const res = await api.restoreMatchingPairTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Translation #${item.id} restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: MatchingPairTranslation) {
    if (!confirm(`PERMANENTLY delete translation #${item.id}? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteMatchingPairTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: MatchingPairTranslation) {
    const res = await api.updateMatchingPairTranslation(item.id, { is_active: !item.is_active });
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: MatchingPairTranslation) {
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
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteMatchingPairTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreMatchingPairTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteMatchingPairTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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

  function getPairLabel(pairId: number): string {
    return `Pair #${pairId}`;
  }

  /* -- Shared select class -- */
  const selectClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Matching Pair Translations" description="Manage translations for matching pairs"
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
              {subjects.map(s => <option key={s.id} value={s.id}>{s.display_order ? s.display_order + '. ' : ''}{s.english_name || s.name}</option>)}
            </select>
            <select className={selectClass} value={filterChapterId} onChange={e => setFilterChapterId(e.target.value)} disabled={!filterSubjectId}>
              <option value="">All Chapters</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name}</option>)}
            </select>
            <select className={selectClass} value={filterTopicId} onChange={e => setFilterTopicId(e.target.value)} disabled={!filterChapterId}>
              <option value="">All Topics</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name}</option>)}
            </select>
            <select className={selectClass} value={filterQuestionId} onChange={e => setFilterQuestionId(e.target.value)} disabled={!filterTopicId}>
              <option value="">All Questions</option>
              {matchingQuestions.map(q => <option key={q.id} value={q.id}>{q.display_order ? q.display_order + '. ' : ''}{q.code}</option>)}
            </select>
            <select className={selectClass} value={filterPairId} onChange={e => setFilterPairId(e.target.value)} disabled={!filterQuestionId}>
              <option value="">All Pairs</option>
              {matchingPairs.map(p => <option key={p.id} value={p.id}>{p.display_order ? p.display_order + '. ' : ''}Pair #{p.id}</option>)}
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
        <EmptyState icon={showTrash ? Trash2 : Languages} title={showTrash ? 'Trash is empty' : 'No translations yet'} description={showTrash ? 'Deleted translations will appear here' : 'Add your first matching pair translation'}
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
                  <TH><button onClick={() => handleSort('matching_pair_id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Pair <SortIcon field="matching_pair_id" /></button></TH>
                  <TH><button onClick={() => handleSort('language_id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Language <SortIcon field="language_id" /></button></TH>
                  <TH>Left Text</TH>
                  <TH>Right Text</TH>
                  {showTrash && <TH>Deleted</TH>}
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map(item => (
                  <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-brand-50/40')}>
                    <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                    <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                    <TD className="py-2.5">
                      <Badge variant="info">Pair #{item.matching_pair_id}</Badge>
                    </TD>
                    <TD className="py-2.5">{item.languages?.name ? <Badge variant="muted">{item.languages.name}{item.languages.iso_code ? ` (${item.languages.iso_code})` : ''}</Badge> : <span className="text-slate-300">--</span>}</TD>
                    <TD className="py-2.5"><span className={cn('text-sm', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.left_text ? (item.left_text.length > 40 ? item.left_text.substring(0, 40) + '...' : item.left_text) : <span className="text-slate-300 italic">Empty</span>}</span></TD>
                    <TD className="py-2.5"><span className={cn('text-sm', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.right_text ? (item.right_text.length > 40 ? item.right_text.substring(0, 40) + '...' : item.right_text) : <span className="text-slate-300 italic">Empty</span>}</span></TD>
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
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="View Matching Pair Translation" size="lg">
        {viewItem && (
          <div className="p-6 space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{getPairLabel(viewItem.matching_pair_id)}</Badge>
              <Badge variant="muted">{viewItem.languages?.name || `Lang #${viewItem.language_id}`}{viewItem.languages?.iso_code ? ` (${viewItem.languages.iso_code})` : ''}</Badge>
              <Badge variant={viewItem.is_active ? 'success' : 'danger'}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>

            <ViewField label="Left Text" value={viewItem.left_text} />
            <ViewField label="Right Text" value={viewItem.right_text} />

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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Matching Pair Translation' : 'Add Matching Pair Translation'} size="lg">
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
                  const refreshed = await api.getMatchingPairTranslation(editing.id);
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Matching Pair</label>
              <select className={cn(selectClass, 'w-full')} {...register('matching_pair_id', { required: true })}>
                {matchingPairs.map(p => <option key={p.id} value={p.id}>{p.display_order ? p.display_order + '. ' : ''}Pair #{p.id}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
              <select className={cn(selectClass, 'w-full')} {...register('language_id', { required: true })}>
                {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
              </select>
            </div>
          </div>

          {/* Left Text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Left Text</label>
            <textarea className={cn(selectClass, 'w-full min-h-[100px]')} placeholder="Left side text..." {...register('left_text', { required: true })} />
          </div>

          {/* Right Text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Right Text</label>
            <textarea className={cn(selectClass, 'w-full min-h-[100px]')} placeholder="Right side text..." {...register('right_text', { required: true })} />
          </div>

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
