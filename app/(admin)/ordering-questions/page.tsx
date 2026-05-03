"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { QuestionViewDialog } from '@/components/ui/QuestionViewDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, ListOrdered, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, Check, X } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'code' | 'slug' | 'display_order' | 'difficulty_level' | 'points' | 'is_active';

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  hard: 'bg-red-50 text-red-700',
};

export default function OrderingQuestionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [viewDialogQuestion, setViewDialogQuestion] = useState<{ id: number; code: string } | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

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
  const [filterSubjectId, setFilterSubjectId] = useState<string>('');
  const [filterChapterId, setFilterChapterId] = useState<string>('');
  const [filterTopicId, setFilterTopicId] = useState<string>('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('');

  // Cascade dropdowns
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  // Form dialog cascade dropdowns (independent from filter)
  const [formSubjects, setFormSubjects] = useState<any[]>([]);
  const [formChapters, setFormChapters] = useState<any[]>([]);
  const [formTopics, setFormTopics] = useState<any[]>([]);
  const [formSubjectId, setFormSubjectId] = useState<string>('');
  const [formChapterId, setFormChapterId] = useState<string>('');

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
  const [slugManual, setSlugManual] = useState(false);
  const watchedCode = watch('code');

  // Auto-generate slug from code
  useEffect(() => {
    if (!slugManual && watchedCode !== undefined) {
      const slug = (watchedCode || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      setValue('slug', slug);
    }
  }, [watchedCode, slugManual, setValue]);

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

  // Load summary + subjects once on mount
  useEffect(() => {
    api.getTableSummary('ordering_questions').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadSubjects();
  }, []);

  // Cascade: when subject changes, load chapters
  useEffect(() => {
    setFilterChapterId('');
    setFilterTopicId('');
    if (filterSubjectId) {
      api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${filterSubjectId}`).then(res => {
        if (res.success) setChapters(res.data || []);
        else setChapters([]);
      });
    } else {
      setChapters([]);
    }
  }, [filterSubjectId]);

  // Cascade: when chapter changes, load topics
  useEffect(() => {
    setFilterTopicId('');
    if (filterChapterId) {
      api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${filterChapterId}`).then(res => {
        if (res.success) setTopics(res.data || []);
        else setTopics([]);
      });
    } else {
      setTopics([]);
    }
  }, [filterChapterId]);

  // Form cascade: when form subject changes, load form chapters
  useEffect(() => {
    setFormChapterId('');
    setValue('topic_id', '');
    if (formSubjectId) {
      api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${formSubjectId}`).then(res => {
        if (res.success) setFormChapters(res.data || []);
        else setFormChapters([]);
      });
    } else {
      setFormChapters([]);
    }
    setFormTopics([]);
  }, [formSubjectId]);

  // Form cascade: when form chapter changes, load form topics
  useEffect(() => {
    setValue('topic_id', '');
    if (formChapterId) {
      api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${formChapterId}`).then(res => {
        if (res.success) setFormTopics(res.data || []);
        else setFormTopics([]);
      });
    } else {
      setFormTopics([]);
    }
  }, [formChapterId]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, filterSubjectId, filterChapterId, filterTopicId, filterDifficulty, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, filterSubjectId, filterChapterId, filterTopicId, filterDifficulty, showTrash]);

  async function loadSubjects() {
    const res = await api.listSubjects('?limit=999&sort=display_order&order=asc');
    if (res.success) setSubjects(res.data || []);
  }

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
      if (filterTopicId) qs.set('topic_id', filterTopicId);
      if (filterDifficulty) qs.set('difficulty_level', filterDifficulty);
    }
    const res = await api.listOrderingQuestions('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('ordering_questions');
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

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1); setSlugManual(false);
    setFormSubjectId(''); setFormChapterId(''); setFormChapters([]); setFormTopics([]);
    setFormSubjects(subjects.length > 0 ? subjects : []);
    reset({
      topic_id: '', code: '', slug: '',
      points: 1, display_order: 0, difficulty_level: 'medium',
      partial_scoring: false, is_mandatory: false, is_active: true,
    });
    setDialogOpen(true);
  }

  async function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1); setSlugManual(true);
    setFormSubjects(subjects.length > 0 ? subjects : []);
    // Reverse-resolve subject & chapter from topic_id
    if (c.topic_id) {
      const topicRes = await api.getTopic(c.topic_id);
      if (topicRes.success && topicRes.data) {
        const topic = topicRes.data;
        if (topic.chapter_id) {
          const chapterRes = await api.getChapter(topic.chapter_id);
          if (chapterRes.success && chapterRes.data) {
            const chapter = chapterRes.data;
            setFormSubjectId(String(chapter.subject_id || ''));
            // Load chapters for that subject
            const chaptersRes = await api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${chapter.subject_id}`);
            if (chaptersRes.success) setFormChapters(chaptersRes.data || []);
            setFormChapterId(String(topic.chapter_id));
            // Load topics for that chapter
            const topicsRes = await api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${topic.chapter_id}`);
            if (topicsRes.success) setFormTopics(topicsRes.data || []);
          }
        }
      }
    } else {
      setFormSubjectId(''); setFormChapterId(''); setFormChapters([]); setFormTopics([]);
    }
    reset({
      topic_id: c.topic_id ?? '', code: c.code || '', slug: c.slug || '',
      points: c.points ?? 1, display_order: c.display_order ?? 0,
      difficulty_level: c.difficulty_level || 'medium',
      partial_scoring: c.partial_scoring ?? false,
      is_mandatory: c.is_mandatory ?? false, is_active: c.is_active ?? true,
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
      const numericFields = ['topic_id', 'points', 'display_order'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateOrderingQuestion(editing.id, payload)
      : await api.createOrderingQuestion(payload);
    if (res.success) {
      toast.success(editing ? 'Ordering question updated' : 'Ordering question created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.code}" to trash? You can restore it later.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteOrderingQuestion(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Ordering question moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreOrderingQuestion(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${c.code}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.code}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteOrderingQuestion(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Ordering question permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: any) {
    const res = await api.updateOrderingQuestion(c.id, { is_active: !c.is_active });
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
      const res = await api.deleteOrderingQuestion(ids[i]);
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
      const res = await api.restoreOrderingQuestion(ids[i]);
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
      const res = await api.permanentDeleteOrderingQuestion(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  function formatDifficulty(val: string) {
    const map: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
    return map[val] || val;
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Ordering Questions"
        description="Manage ordering sequence questions for assessments"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add question</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Questions', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Ordering Questions
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
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search ordering questions...'}
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
            <select className={selectClass} value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
              <option value="">All Difficulties</option>
              {DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          icon={showTrash ? Trash2 : ListOrdered}
          title={showTrash ? 'Trash is empty' : 'No ordering questions yet'}
          description={showTrash ? 'No deleted questions' : (searchDebounce || filterStatus || filterTopicId || filterDifficulty ? 'No questions match your filters' : 'Add your first ordering question')}
          action={!showTrash && !searchDebounce && !filterStatus && !filterTopicId && !filterDifficulty ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add question</Button> : undefined}
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
                <TH>
                  <button onClick={() => handleSort('code')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Code <SortIcon field="code" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('slug')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Slug <SortIcon field="slug" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('difficulty_level')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Difficulty <SortIcon field="difficulty_level" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('points')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Points <SortIcon field="points" />
                  </button>
                </TH>
                <TH>Items</TH>
                {!showTrash && <TH>Translations</TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH>
                  <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Active <SortIcon field="is_active" />
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
                    <span className={cn('text-sm font-medium font-mono', showTrash ? 'text-slate-500 line-through' : 'text-slate-700')}>{c.code}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                      {c.slug || ''}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    {c.difficulty_level ? (
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', DIFFICULTY_COLORS[c.difficulty_level] || 'bg-slate-50 text-slate-600')}>
                        {formatDifficulty(c.difficulty_level)}
                      </span>
                    ) : <span className="text-slate-300">--</span>}
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm font-medium text-slate-700">{c.points ?? '--'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm font-medium text-slate-700">{c.item_count ?? '--'}</span>
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <span className="text-sm text-slate-600">{c.translation_count != null ? c.translation_count : '--'}</span>
                    </TD>
                  )}
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
                          <button onClick={() => setViewDialogQuestion({ id: c.id, code: c.code })} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="Full View">
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

      {/* ── View Ordering Question Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Ordering Question Details" size="lg">
        {viewing && (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                <ListOrdered className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.code}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {viewing.difficulty_level && (
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', DIFFICULTY_COLORS[viewing.difficulty_level] || 'bg-slate-50 text-slate-600')}>
                      {formatDifficulty(viewing.difficulty_level)}
                    </span>
                  )}
                  {viewing.is_mandatory && <Badge variant="info">Mandatory</Badge>}
                  {viewing.partial_scoring && <Badge variant="info">Partial Scoring</Badge>}
                </div>
              </div>
            </div>

            {/* Detail grid */}
            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Code" value={viewing.code} />
              <DetailRow label="Slug" value={viewing.slug ? `/${viewing.slug}` : undefined} />
              <DetailRow label="Topic ID" value={viewing.topic_id != null ? String(viewing.topic_id) : undefined} />
              <DetailRow label="Difficulty" value={viewing.difficulty_level ? formatDifficulty(viewing.difficulty_level) : undefined} />
              <DetailRow label="Points" value={viewing.points != null ? String(viewing.points) : undefined} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
              <DetailRow label="Item Count" value={viewing.item_count != null ? String(viewing.item_count) : undefined} />
              <DetailRow label="Translations" value={viewing.translation_count != null ? String(viewing.translation_count) : undefined} />
              <DetailRow label="Partial Scoring" value={viewing.partial_scoring ? 'Yes' : 'No'} />
            </div>

            {/* Flags */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Flags</p>
              <div className="flex flex-wrap gap-2">
                {viewing.is_mandatory && <Badge variant="info">Mandatory</Badge>}
                {viewing.is_active && <Badge variant="success">Active</Badge>}
                {viewing.partial_scoring && <Badge variant="info">Partial Scoring</Badge>}
                {!viewing.is_mandatory && !viewing.is_active && !viewing.partial_scoring && (
                  <span className="text-sm text-slate-400">No flags enabled</span>
                )}
              </div>
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

      {/* ── Full Question View Dialog ── */}
      <QuestionViewDialog
        open={!!viewDialogQuestion}
        onClose={() => setViewDialogQuestion(null)}
        questionType="ordering"
        questionId={viewDialogQuestion?.id ?? null}
        questionCode={viewDialogQuestion?.code ?? ''}
      />

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Ordering Question' : 'Add Ordering Question'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle -- only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This question is currently active' : 'This question is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getOrderingQuestion(editing.id);
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
            <div className="grid grid-cols-3 gap-3">
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Topic</label>
                <select className={cn(selectClass, 'w-full')} {...register('topic_id')} disabled={!formChapterId}>
                  <option value="">Select topic...</option>
                  {formTopics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name || `Topic ${t.id}`}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Code" placeholder="order-math-001" {...register('code', { required: true })} />
              <Input label="Slug" placeholder="order-math-001" {...register('slug', { required: true, onChange: () => setSlugManual(true) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Difficulty Level</label>
                <select className={cn(selectClass, 'w-full')} {...register('difficulty_level')}>
                  {DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <Input label="Points" type="number" placeholder="1" {...register('points')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Display Order" type="number" placeholder="0" {...register('display_order')} />
              <div />
            </div>
            <div className="space-y-2.5">
              {[
                { field: 'partial_scoring', label: 'Partial Scoring' },
                { field: 'is_mandatory', label: 'Mandatory Question' },
                { field: 'is_active', label: 'Active' },
              ].map(item => (
                <label key={item.field} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register(item.field)} />
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                </label>
              ))}
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

/* ── Small helper for the view dialog ── */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}
