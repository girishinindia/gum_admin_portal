"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
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
import { Plus, Link2, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, X, Languages } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'display_order' | 'is_active';

export default function MatchingPairsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  // Matching Questions for dropdown
  const [matchingQuestions, setMatchingQuestions] = useState<any[]>([]);

  // Cascade filter dropdowns
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [filterChapterId, setFilterChapterId] = useState<string>('');
  const [filterTopicId, setFilterTopicId] = useState<string>('');

  // Form dialog cascade dropdowns (independent from filter)
  const [formSubjects, setFormSubjects] = useState<any[]>([]);
  const [formChapters, setFormChapters] = useState<any[]>([]);
  const [formTopics, setFormTopics] = useState<any[]>([]);
  const [formQuestions, setFormQuestions] = useState<any[]>([]);
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formChapterId, setFormChapterId] = useState<string>('');
  const [formTopicId, setFormTopicId] = useState<string>('');

  // Pagination, search, sort, filter
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterQuestionId, setFilterQuestionId] = useState<string>('');

  // Table summary stats
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  // Trash mode
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  const { register, handleSubmit, reset, setValue, watch } = useForm();

  // Load subjects on mount
  useEffect(() => {
    api.listSubjects('?limit=999&sort=display_order&order=asc').then(res => {
      if (res.success) setSubjects(res.data || []);
    });
  }, []);

  // Cascade: when filter subject changes, load chapters
  useEffect(() => {
    setFilterChapterId('');
    setFilterTopicId('');
    setFilterQuestionId('');
    if (filterSubjectId) {
      api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${filterSubjectId}`).then(res => {
        if (res.success) setChapters(res.data || []);
        else setChapters([]);
      });
    } else {
      setChapters([]);
    }
    setTopics([]);
    setMatchingQuestions([]);
  }, [filterSubjectId]);

  // Cascade: when filter chapter changes, load topics
  useEffect(() => {
    setFilterTopicId('');
    setFilterQuestionId('');
    if (filterChapterId) {
      api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${filterChapterId}`).then(res => {
        if (res.success) setTopics(res.data || []);
        else setTopics([]);
      });
    } else {
      setTopics([]);
    }
    setMatchingQuestions([]);
  }, [filterChapterId]);

  // Cascade: when filter topic changes, load matching questions
  useEffect(() => {
    setFilterQuestionId('');
    if (filterTopicId) {
      api.listMatchingQuestions(`?limit=999&sort=display_order&order=asc&topic_id=${filterTopicId}`).then(res => {
        if (res.success) setMatchingQuestions(res.data || []);
        else setMatchingQuestions([]);
      });
    } else {
      setMatchingQuestions([]);
    }
  }, [filterTopicId]);

  // Form cascade: subject -> chapters
  useEffect(() => {
    setFormChapterId('');
    setFormTopicId('');
    setValue('matching_question_id', '');
    if (formSubjectId) {
      api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${formSubjectId}`).then(res => {
        if (res.success) setFormChapters(res.data || []);
        else setFormChapters([]);
      });
    } else {
      setFormChapters([]);
    }
    setFormTopics([]);
    setFormQuestions([]);
  }, [formSubjectId]);

  // Form cascade: chapter -> topics
  useEffect(() => {
    setFormTopicId('');
    setValue('matching_question_id', '');
    if (formChapterId) {
      api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${formChapterId}`).then(res => {
        if (res.success) setFormTopics(res.data || []);
        else setFormTopics([]);
      });
    } else {
      setFormTopics([]);
    }
    setFormQuestions([]);
  }, [formChapterId]);

  // Form cascade: topic -> matching questions
  useEffect(() => {
    setValue('matching_question_id', '');
    if (formTopicId) {
      api.listMatchingQuestions(`?limit=999&sort=display_order&order=asc&topic_id=${formTopicId}`).then(res => {
        if (res.success) setFormQuestions(res.data || []);
        else setFormQuestions([]);
      });
    } else {
      setFormQuestions([]);
    }
  }, [formTopicId]);

  // Keyboard shortcuts
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
    { key: 'g o', action: () => router.push('/courses') },
    { key: 'g s', action: () => router.push('/subjects') },
    { key: 'g m', action: () => router.push('/material-tree') },
  ]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary once on mount
  useEffect(() => {
    api.getTableSummary('matching_pairs').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, filterSubjectId, filterChapterId, filterTopicId, filterQuestionId, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, filterSubjectId, filterChapterId, filterTopicId, filterQuestionId, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterStatus) qs.set('is_active', filterStatus);
      if (filterQuestionId) qs.set('matching_question_id', filterQuestionId);
    }
    const res = await api.listMatchingPairs('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('matching_pairs');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
  }

  function getQuestionLabel(questionId: number) {
    const q = matchingQuestions.find(q => q.id === questionId);
    if (!q) return `#${questionId}`;
    const text = q.question_text || q.code || `Question #${q.id}`;
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1);
    setFormSubjectId(''); setFormChapterId(''); setFormTopicId('');
    setFormChapters([]); setFormTopics([]); setFormQuestions([]);
    setFormSubjects(subjects.length > 0 ? subjects : []);
    reset({
      matching_question_id: '', display_order: '', is_active: true,
    });
    setDialogOpen(true);
  }

  async function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1);
    setFormSubjects(subjects.length > 0 ? subjects : []);
    // Reverse-resolve subject, chapter, topic from question's topic_id
    if (c.matching_question_id) {
      const qRes = await api.getMatchingQuestion(c.matching_question_id);
      if (qRes.success && qRes.data && qRes.data.topic_id) {
        const topicRes = await api.getTopic(qRes.data.topic_id);
        if (topicRes.success && topicRes.data) {
          const topic = topicRes.data;
          if (topic.chapter_id) {
            const chapterRes = await api.getChapter(topic.chapter_id);
            if (chapterRes.success && chapterRes.data) {
              const chapter = chapterRes.data;
              setFormSubjectId(String(chapter.subject_id || ''));
              const chaptersRes = await api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${chapter.subject_id}`);
              if (chaptersRes.success) setFormChapters(chaptersRes.data || []);
              setFormChapterId(String(topic.chapter_id));
              const topicsRes = await api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${topic.chapter_id}`);
              if (topicsRes.success) setFormTopics(topicsRes.data || []);
              setFormTopicId(String(qRes.data.topic_id));
              const questionsRes = await api.listMatchingQuestions(`?limit=999&sort=display_order&order=asc&topic_id=${qRes.data.topic_id}`);
              if (questionsRes.success) setFormQuestions(questionsRes.data || []);
            }
          }
        }
      } else {
        setFormSubjectId(''); setFormChapterId(''); setFormTopicId('');
        setFormChapters([]); setFormTopics([]); setFormQuestions([]);
      }
    } else {
      setFormSubjectId(''); setFormChapterId(''); setFormTopicId('');
      setFormChapters([]); setFormTopics([]); setFormQuestions([]);
    }
    reset({
      matching_question_id: c.matching_question_id ?? '',
      display_order: c.display_order ?? '',
      is_active: c.is_active ?? true,
    });
    setDialogOpen(true);
  }

  function openView(c: any) {
    setViewing(c);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['matching_question_id', 'display_order'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateMatchingPair(editing.id, payload)
      : await api.createMatchingPair(payload);
    if (res.success) {
      toast.success(editing ? 'Matching pair updated' : 'Matching pair created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move matching pair #${c.id} to trash? You can restore it later.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteMatchingPair(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Matching pair moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreMatchingPair(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`Matching pair #${c.id} restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete matching pair #${c.id}? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteMatchingPair(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Matching pair permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: any) {
    const res = await api.updateMatchingPair(c.id, { is_active: !c.is_active });
    if (res.success) { toast.success(`${!c.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  // Bulk selection helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteMatchingPair(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreMatchingPair(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.permanentDeleteMatchingPair(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Matching Pairs"
        description="Manage matching pairs for matching questions"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add matching pair</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Pairs', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button
          onClick={() => setShowTrash(false)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          Matching Pairs
        </button>
        <button
          onClick={() => setShowTrash(true)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn(
              'ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            )}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      {/* Toolbar: search + filters (only in normal view) */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search matching pairs...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterSubjectId} onChange={e => setFilterSubjectId(e.target.value)}>
              <option value="">All Subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.display_order ? s.display_order + '. ' : ''}{s.english_name || s.name || `Subject ${s.id}`}</option>)}
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
              {matchingQuestions.map(q => (
                <option key={q.id} value={String(q.id)}>{q.display_order ? q.display_order + '. ' : ''}{q.question_text || q.code || `Question #${q.id}`}</option>
              ))}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </>
        )}
      </DataToolbar>

      {/* Trash banner */}
      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Link2}
          title={showTrash ? 'Trash is empty' : 'No matching pairs yet'}
          description={showTrash ? 'No deleted matching pairs' : (searchDebounce || filterStatus || filterQuestionId || filterSubjectId || filterChapterId || filterTopicId ? 'No matching pairs match your filters' : 'Add your first matching pair')}
          action={!showTrash && !searchDebounce && !filterStatus && !filterQuestionId && !filterSubjectId && !filterChapterId && !filterTopicId ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add matching pair</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
              <div className="flex items-center gap-2">
                {showTrash ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleBulkRestore} disabled={bulkActionLoading}>
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restore Selected
                    </Button>
                    <Button size="sm" variant="danger" onClick={handleBulkPermanentDelete} disabled={bulkActionLoading}>
                      {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Permanently
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>
                    {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  <X className="w-3.5 h-3.5" /> Clear
                </Button>
              </div>
            </div>
          )}
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH>Question</TH>
                <TH>Left Text (EN)</TH>
                <TH>Right Text (EN)</TH>
                <TH>
                  <button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Order <SortIcon field="display_order" />
                  </button>
                </TH>
                <TH>Translations</TH>
                {showTrash && <TH>Deleted</TH>}
                <TH>
                  <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Status <SortIcon field="is_active" />
                  </button>
                </TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">
                    <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-700')}>
                      {getQuestionLabel(c.matching_question_id)}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('text-sm', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                      {c.left_text || <span className="text-slate-300">--</span>}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('text-sm', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                      {c.right_text || <span className="text-slate-300">--</span>}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm font-mono text-slate-600">{c.display_order ?? '--'}</span>
                  </TD>
                  <TD className="py-2.5">
                    {c.translation_count != null ? (
                      <button
                        onClick={() => router.push(`/matching-pair-translations?matching_pair_id=${c.id}`)}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline underline-offset-2 cursor-pointer"
                      >
                        {c.translation_count}
                      </button>
                    ) : (
                      <span className="text-slate-300 text-xs">--</span>
                    )}
                  </TD>
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={c.is_active ? 'success' : 'danger'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
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
                          <button onClick={() => openView(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
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

          {/* Pagination inside table card */}
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            total={total}
            showingCount={items.length}
          />
        </div>
      )}

      {/* -- View Matching Pair Dialog -- */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Matching Pair Details" size="lg">
        {viewing && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                <Link2 className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Matching Pair #{viewing.id}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="ID" value={String(viewing.id)} />
              <DetailRow label="Question" value={getQuestionLabel(viewing.matching_question_id)} />
              <DetailRow label="Left Text (English)" value={viewing.left_text} />
              <DetailRow label="Right Text (English)" value={viewing.right_text} />
              <DetailRow label="Translation Count" value={viewing.translation_count != null ? String(viewing.translation_count) : undefined} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
              <DetailRow label="Is Active" value={viewing.is_active ? 'Yes' : 'No'} />
              <DetailRow label="Question ID" value={viewing.matching_question_id != null ? String(viewing.matching_question_id) : undefined} />
            </div>

            {/* Timestamps */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
                <DetailRow label="Updated" value={viewing.updated_at ? fromNow(viewing.updated_at) : undefined} />
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* -- Create / Edit Dialog -- */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Matching Pair' : 'Add Matching Pair'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle -- only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This matching pair is currently active' : 'This matching pair is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getMatchingPair(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                    editing.is_active ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Subject</label>
                <select className={cn(selectClass, 'w-full')} value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)}>
                  <option value="">Select subject...</option>
                  {formSubjects.map(s => <option key={s.id} value={s.id}>{s.display_order ? s.display_order + '. ' : ''}{s.english_name || s.name || `Subject ${s.id}`}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Chapter</label>
                <select className={cn(selectClass, 'w-full')} value={formChapterId} onChange={e => setFormChapterId(e.target.value)} disabled={!formSubjectId}>
                  <option value="">Select chapter...</option>
                  {formChapters.map(c => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name || `Chapter ${c.id}`}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Topic</label>
                <select className={cn(selectClass, 'w-full')} value={formTopicId} onChange={e => setFormTopicId(e.target.value)} disabled={!formChapterId}>
                  <option value="">Select topic...</option>
                  {formTopics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name || `Topic ${t.id}`}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Matching Question</label>
                <select className={cn(selectClass, 'w-full')} {...register('matching_question_id', { required: true })} disabled={!formTopicId}>
                  <option value="">Select a question...</option>
                  {formQuestions.map(q => (
                    <option key={q.id} value={q.id}>{q.display_order ? q.display_order + '. ' : ''}{q.question_text || q.code || `Question #${q.id}`}</option>
                  ))}
                </select>
              </div>
            </div>
            <Input label="Display Order" type="number" placeholder="1" {...register('display_order')} />
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_active')} />
                <span className="text-sm font-medium text-slate-700">Active</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/* -- Small helper for the view dialog -- */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}
