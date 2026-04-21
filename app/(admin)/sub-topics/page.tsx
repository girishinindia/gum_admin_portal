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
import { AiMasterDialog } from '@/components/ui/AiMasterDialog';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, FileQuestion, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, Check, X, Sparkles, Zap, FileText, Video, Youtube } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import Link from 'next/link';
import type { SubTopic, Topic, Subject, Chapter } from '@/lib/types';

interface CoverageItem {
  sub_topic_id: number;
  total_languages: number;
  translated_count: number;
  missing_count: number;
  is_complete: boolean;
  translated_languages: { id: number; name: string; iso_code: string }[];
  missing_languages: { id: number; name: string; iso_code: string }[];
  pages_uploaded: number;
  video_source: string | null;
  has_video: boolean;
}

interface BulkResult { iso_code: string; language: string; status: 'success' | 'error'; error?: string; id?: number }

type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
];

const DEFAULT_BULK_PROMPT = `Create content in English language for selected sub-topic with human way writing style and convert exact English content with same meaning for other languages which are listed for translations.\n\nTranslate exactly with the same meaning. Keep technical or brand words in English that sound strange or unnatural when translated.\n\nMost Important: don't write everything in pure regional language... use some common and sub-topic related technical English words in all outputs as it is. Keep technical or brand words in English that sound strange or unnatural or weird when translated.`;

const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert', 'all_levels'];

type SortField = 'id' | 'slug' | 'display_order' | 'is_active' | 'difficulty_level';

export default function SubTopicsPage() {
  const [items, setItems] = useState<SubTopic[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SubTopic | null>(null);
  const [viewing, setViewing] = useState<SubTopic | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterChapter, setFilterChapter] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [coverage, setCoverage] = useState<Record<number, CoverageItem>>({});
  const [aiOpen, setAiOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSubTopic, setBulkSubTopic] = useState<SubTopic | null>(null);
  const [bulkPrompt, setBulkPrompt] = useState(DEFAULT_BULK_PROMPT);
  const [bulkProvider, setBulkProvider] = useState<AIProvider>('gemini');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkDone, setBulkDone] = useState(false);

  // Video upload
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoTab, setVideoTab] = useState<'upload' | 'youtube'>('upload');

  const { register, handleSubmit, reset } = useForm();

  // Load subjects on mount
  useEffect(() => {
    api.listSubjects('?limit=500&is_active=true').then(res => { if (res.success) setSubjects(res.data || []); });
    api.listTopics('?limit=500&is_active=true').then(res => { if (res.success) setTopics(res.data || []); });
  }, []);

  // Load chapters when subject filter changes
  useEffect(() => {
    setFilterChapter(''); setFilterTopic('');
    if (filterSubject) {
      api.listChapters(`?limit=500&is_active=true&subject_id=${filterSubject}`).then(res => { if (res.success) setChapters(res.data || []); });
    } else {
      setChapters([]);
    }
  }, [filterSubject]);

  // Reset topic filter when chapter changes
  useEffect(() => {
    setFilterTopic('');
  }, [filterChapter]);

  // Filtered topics based on selected chapter
  const filteredTopics = filterChapter ? topics.filter(t => String((t as any).chapter_id) === filterChapter) : topics;

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api.getTableSummary('sub_topics').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterSubject, filterChapter, filterTopic, filterStatus, filterDifficulty, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterSubject, filterChapter, filterTopic, filterStatus, filterDifficulty, showTrash]);

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
      if (filterTopic) qs.set('topic_id', filterTopic);
      else if (filterChapter) qs.set('chapter_id', filterChapter);
      else if (filterSubject) qs.set('subject_id', filterSubject);
      if (filterStatus) qs.set('is_active', filterStatus);
      if (filterDifficulty) qs.set('difficulty_level', filterDifficulty);
    }
    const res = await api.listSubTopics('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('sub_topics');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getSubTopicTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: CoverageItem) => { map[c.sub_topic_id] = c; });
      setCoverage(map);
    }
  }

  function openBulkGenerate(st: SubTopic) {
    setBulkSubTopic(st);
    setBulkPrompt(DEFAULT_BULK_PROMPT);
    setBulkProvider('gemini');
    setBulkResults([]);
    setBulkDone(false);
    setBulkLoading(false);
    setBulkOpen(true);
  }

  async function handleBulkGenerate() {
    if (!bulkSubTopic) return;
    setBulkLoading(true);
    setBulkResults([]);
    setBulkDone(false);
    try {
      const res = await api.bulkGenerateSubTopicTranslations({
        sub_topic_id: bulkSubTopic.id,
        prompt: bulkPrompt,
        provider: bulkProvider,
      });
      if (res.success && res.data) {
        setBulkResults(res.data.results || []);
        toast.success(`Generated translations using ${AI_PROVIDERS.find(p => p.value === bulkProvider)?.label}`);
        loadCoverage();
      } else {
        toast.error(res.error || 'Bulk generation failed');
      }
    } catch {
      toast.error('Bulk generation failed');
    }
    setBulkLoading(false);
    setBulkDone(true);
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

  function openCreate() {
    setEditing(null);
    setDialogKey(k => k + 1);
    reset({ topic_id: '', slug: '', display_order: 0, difficulty_level: 'all_levels', estimated_minutes: '', youtube_url: '' });
    setVideoFile(null);
    setVideoUploading(false);
    setVideoProgress(0);
    setVideoTab('upload');
    setDialogOpen(true);
  }

  function openEdit(t: SubTopic) {
    setEditing(t);
    setDialogKey(k => k + 1);
    reset({ topic_id: t.topic_id || '', slug: t.slug, display_order: t.display_order, difficulty_level: t.difficulty_level || 'all_levels', estimated_minutes: t.estimated_minutes || '', youtube_url: (t as any).youtube_url || '' });
    setVideoFile(null);
    setVideoUploading(false);
    setVideoProgress(0);
    setVideoTab((t as any).video_source === 'youtube' ? 'youtube' : 'upload');
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const obj: Record<string, any> = {
      slug: data.slug,
      display_order: Number(data.display_order) || 0,
      difficulty_level: data.difficulty_level || 'beginner',
      topic_id: data.topic_id ? Number(data.topic_id) : undefined,
      estimated_minutes: data.estimated_minutes ? Number(data.estimated_minutes) : null,
    };

    // Handle YouTube URL
    if (data.youtube_url?.trim()) {
      obj.youtube_url = data.youtube_url.trim();
      obj.video_source = 'youtube';
      obj.video_id = null;
      obj.video_url = null;
      obj.video_thumbnail_url = null;
      obj.video_status = null;
    }

    const res = editing
      ? await api.updateSubTopic(editing.id, obj)
      : await api.createSubTopic(obj);

    if (res.success) {
      const savedId = editing ? editing.id : res.data?.id;
      // Upload video file if selected
      if (videoFile && savedId) {
        setVideoUploading(true);
        setVideoProgress(0);
        try {
          await api.uploadSubTopicVideo(savedId, videoFile, (percent: number) => setVideoProgress(percent));
          toast.success('Video uploaded successfully');
        } catch {
          toast.error('Video upload failed');
        }
        setVideoUploading(false);
        setVideoFile(null);
      }
      toast.success(editing ? 'Sub-topic updated' : 'Sub-topic created');
      setDialogOpen(false);
      load();
      refreshSummary();
      loadCoverage();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(t: SubTopic) {
    if (!confirm(`Move "${t.slug}" to trash?`)) return;
    setActionLoadingId(t.id);
    const res = await api.deleteSubTopic(t.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Sub-topic moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(t: SubTopic) {
    setActionLoadingId(t.id);
    const res = await api.restoreSubTopic(t.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${t.slug}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(t: SubTopic) {
    if (!confirm(`PERMANENTLY delete "${t.slug}"? This cannot be undone.`)) return;
    setActionLoadingId(t.id);
    const res = await api.permanentDeleteSubTopic(t.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Sub-topic permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(t: SubTopic) {
    const res = await api.updateSubTopic(t.id, { is_active: !t.is_active });
    if (res.success) { toast.success(`Sub-topic ${!t.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function toggleSelect(id: number) { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function toggleSelectAll() { setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id))); }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true); const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteSubTopic(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) moved to trash`); setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true); const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreSubTopic(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) restored`); setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true); const ids = Array.from(selectedIds); setBulkProgress({ done: 0, total: ids.length }); let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteSubTopic(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) permanently deleted`); setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sub-Topics"
        description="Manage topic sub-topics"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Link href="/auto-sub-topics"><Button variant="outline"><Sparkles className="w-4 h-4" /> Auto Sub-Topics</Button></Link>}
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add sub-topic</Button>}
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Sub-Topics', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Sub-Topics
        </button>
        <button onClick={() => setShowTrash(true)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>}
        </button>
      </div>

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search sub-topics by slug...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.slug}</option>)}
            </select>
            <select className={selectClass} value={filterChapter} onChange={e => setFilterChapter(e.target.value)} disabled={!filterSubject}>
              <option value="">{filterSubject ? 'All chapters' : 'Select subject first'}</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.slug}</option>)}
            </select>
            <select className={selectClass} value={filterTopic} onChange={e => setFilterTopic(e.target.value)} disabled={!filterChapter}>
              <option value="">{filterChapter ? 'All topics' : 'Select chapter first'}</option>
              {filteredTopics.map(t => <option key={t.id} value={t.id}>{t.slug}</option>)}
            </select>
            <select className={selectClass} value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
              <option value="">All levels</option>
              {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
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
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : FileQuestion} title={showTrash ? 'Trash is empty' : 'No sub-topics yet'}
          description={showTrash ? 'No deleted sub-topics' : (searchDebounce || filterTopic || filterStatus || filterDifficulty ? 'No sub-topics match your filters' : 'Add your first sub-topic')}
          action={!showTrash && !searchDebounce && !filterTopic && !filterStatus && !filterDifficulty ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add sub-topic</Button> : undefined} />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
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
                <TH>Topic</TH>
                <TH><button onClick={() => handleSort('slug')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Slug <SortIcon field="slug" /></button></TH>
                <TH><button onClick={() => handleSort('difficulty_level')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Difficulty <SortIcon field="difficulty_level" /></button></TH>
                {!showTrash && <TH>Translations</TH>}
                {!showTrash && <TH>Pages</TH>}
                {!showTrash && <TH>Video</TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(t => (
                <TR key={t.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(t.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{t.id}</span></TD>
                  <TD className="py-2.5"><span className="text-slate-600">{t.topics?.slug || '\u2014'}</span></TD>
                  <TD className="py-2.5">
                    <span className={cn('font-mono text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{t.slug}</span>
                  </TD>
                  <TD className="py-2.5">
                    {t.difficulty_level ? <Badge variant="info">{t.difficulty_level.replace('_', ' ')}</Badge> : <span className="text-slate-300">{'\u2014'}</span>}
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      {(() => {
                        const cov = coverage[t.id];
                        if (!cov) return <span className="text-slate-300 text-xs">{'\u2014'}</span>;
                        return (
                          <div className="flex items-center gap-1.5">
                            <Badge variant={cov.is_complete ? 'success' : 'warning'}>{cov.translated_count}/{cov.total_languages}</Badge>
                            {!cov.is_complete && (
                              <button onClick={() => openBulkGenerate(t)} className="p-1 rounded-md text-violet-500 hover:text-violet-700 hover:bg-violet-50 transition-colors" title="Generate missing translations">
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </TD>
                  )}
                  {!showTrash && (
                    <TD className="py-2.5">
                      {(() => {
                        const cov = coverage[t.id];
                        if (!cov) return <span className="text-slate-300 text-xs">{'\u2014'}</span>;
                        const autoUrl = `/auto-sub-topics?topic_id=${t.topic_id}`;
                        return (
                          <Link href={autoUrl} className="flex items-center gap-1.5 group" title="Upload page files">
                            <FileText className={cn('w-3.5 h-3.5', cov.pages_uploaded > 0 ? 'text-emerald-500' : 'text-slate-300')} />
                            <Badge variant={cov.pages_uploaded === cov.total_languages ? 'success' : cov.pages_uploaded > 0 ? 'warning' : 'muted'}>
                              <span className="group-hover:underline">{cov.pages_uploaded}/{cov.total_languages}</span>
                            </Badge>
                          </Link>
                        );
                      })()}
                    </TD>
                  )}
                  {!showTrash && (
                    <TD className="py-2.5">
                      {(() => {
                        const cov = coverage[t.id];
                        if (!cov) return <span className="text-slate-300 text-xs">{'\u2014'}</span>;
                        if (!cov.has_video) return <span className="text-slate-300 text-xs">No video</span>;
                        return (
                          <div className="flex items-center gap-1.5">
                            {cov.video_source === 'youtube' ? (
                              <Youtube className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                              <Video className="w-3.5 h-3.5 text-brand-500" />
                            )}
                            <Badge variant={cov.video_source === 'youtube' ? 'warning' : 'info'}>
                              {cov.video_source === 'youtube' ? 'YouTube' : 'Bunny'}
                            </Badge>
                          </div>
                        );
                      })()}
                    </TD>
                  )}
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{t.deleted_at ? fromNow(t.deleted_at) : '\u2014'}</span></TD>}
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={t.is_active ? 'success' : 'danger'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(t)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">{actionLoadingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                          <button onClick={() => onPermanentDelete(t)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">{actionLoadingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewing(t)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onSoftDelete(t)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">{actionLoadingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Sub-Topic Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 font-mono">{viewing.slug}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {viewing.topics?.slug && <Badge variant="info">{viewing.topics.slug}</Badge>}
                  {viewing.difficulty_level && <Badge variant="muted">{viewing.difficulty_level.replace('_', ' ')}</Badge>}
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Topic" value={viewing.topics?.slug} />
              <DetailRow label="Slug" value={`/${viewing.slug}`} />
              <DetailRow label="Difficulty" value={viewing.difficulty_level?.replace('_', ' ')} />
              <DetailRow label="Est. Minutes" value={viewing.estimated_minutes ? String(viewing.estimated_minutes) : undefined} />
              <DetailRow label="Display Order" value={String(viewing.display_order)} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              <DetailRow label="Updated" value={fromNow(viewing.updated_at)} />
              {(viewing as any).video_source && <DetailRow label="Video Source" value={(viewing as any).video_source === 'bunny' ? 'Bunny Stream' : 'YouTube'} />}
              {(viewing as any).youtube_url && <DetailRow label="YouTube URL" value={(viewing as any).youtube_url} />}
              {(viewing as any).video_status && <DetailRow label="Video Status" value={(viewing as any).video_status} />}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Sub-Topic' : 'Add Sub-Topic'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">{editing.is_active ? 'Currently active' : 'Currently inactive'}</p>
              </div>
              <button type="button" onClick={async () => {
                await onToggleActive(editing);
                const refreshed = await api.getSubTopic(editing.id);
                if (refreshed.success && refreshed.data) setEditing(refreshed.data);
              }} className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer', editing.is_active ? 'bg-emerald-500' : 'bg-slate-300')}>
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Topic</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('topic_id')}>
              <option value="">No topic</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.slug}</option>)}
            </select>
          </div>
          <Input label="Slug" placeholder="my-sub-topic-slug" {...register('slug', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty Level</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('difficulty_level')}>
                {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
              </select>
            </div>
            <Input label="Est. Minutes" type="number" placeholder="30" {...register('estimated_minutes')} />
          </div>
          {/* Video Section */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Video</label>

            {/* Show current video if editing */}
            {editing && (editing as any).video_source && (
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                {(editing as any).video_source === 'bunny' && (editing as any).video_thumbnail_url && (
                  <img src={(editing as any).video_thumbnail_url} alt="" className="w-20 h-12 rounded object-cover" />
                )}
                {(editing as any).video_source === 'youtube' && (
                  <div className="w-20 h-12 rounded bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 text-xs font-bold">YT</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Badge variant={(editing as any).video_source === 'bunny' ? 'info' : 'warning'}>
                    {(editing as any).video_source === 'bunny' ? 'Bunny Stream' : 'YouTube'}
                  </Badge>
                  {(editing as any).video_status && <span className="ml-2 text-xs text-slate-500">{(editing as any).video_status}</span>}
                </div>
                <button type="button" onClick={async () => {
                  if (!confirm('Remove current video?')) return;
                  await api.deleteSubTopicVideo(editing.id);
                  const refreshed = await api.getSubTopic(editing.id);
                  if (refreshed.success) setEditing(refreshed.data);
                  toast.success('Video removed');
                }} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              </div>
            )}

            {/* Toggle: Upload vs YouTube */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              <button type="button" onClick={() => setVideoTab('upload')}
                className={cn('flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                  videoTab === 'upload' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                Upload Video
              </button>
              <button type="button" onClick={() => setVideoTab('youtube')}
                className={cn('flex-1 py-1.5 text-xs font-medium rounded-md transition-all',
                  videoTab === 'youtube' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
                YouTube URL
              </button>
            </div>

            {videoTab === 'upload' && (
              <div>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-brand-300 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('video-file-input')?.click()}>
                  {videoFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{videoFile.name}</span>
                      <span className="text-xs text-slate-400">({(videoFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setVideoFile(null); }}
                        className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-500">Click to select video file</p>
                      <p className="text-xs text-slate-400 mt-1">MP4, WebM, MOV up to 500MB</p>
                    </div>
                  )}
                  <input id="video-file-input" type="file" accept="video/*" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) setVideoFile(e.target.files[0]); }} />
                </div>
                {videoUploading && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Uploading...</span>
                      <span>{videoProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-brand-500 h-2 rounded-full transition-all duration-300" style={{ width: `${videoProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {videoTab === 'youtube' && (
              <Input label="" placeholder="https://www.youtube.com/watch?v=..." {...register('youtube_url')} />
            )}
          </div>

          <Input label="Display Order" type="number" {...register('display_order')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      <AiMasterDialog module="sub_topics" moduleLabel="Sub-Topics" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createSubTopic(item)} updateFn={(id, item) => api.updateSubTopic(id, item)} listFn={(qs) => api.listSubTopics(qs)} onSaved={() => { load(); refreshSummary(); loadCoverage(); }} />

      {/* Bulk AI Generate Translations Dialog */}
      <Dialog open={bulkOpen} onClose={() => !bulkLoading && setBulkOpen(false)} title="AI Generate Translations" size="lg">
        {bulkSubTopic && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
              <div>
                <div className="font-semibold text-slate-900 font-mono text-sm">#{bulkSubTopic.id}</div>
                <div className="text-xs text-slate-500">/{bulkSubTopic.slug}</div>
              </div>
            </div>

            {coverage[bulkSubTopic.id] && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Missing Translations ({coverage[bulkSubTopic.id].missing_count} of {coverage[bulkSubTopic.id].total_languages} languages)</label>
                <div className="flex flex-wrap gap-1.5">
                  {coverage[bulkSubTopic.id].missing_languages.map(lang => (
                    <span key={lang.id} className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">{lang.name} ({lang.iso_code})</span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {AI_PROVIDERS.map(p => (
                  <button key={p.value} type="button" disabled={bulkLoading} onClick={() => setBulkProvider(p.value)}
                    className={cn('px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left',
                      bulkProvider === p.value ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500/20' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50')}>
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{p.model}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Prompt</label>
              <textarea value={bulkPrompt} onChange={e => setBulkPrompt(e.target.value)} disabled={bulkLoading} rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 disabled:opacity-50 resize-none" />
            </div>

            {bulkResults.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Results</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {bulkResults.map((r, i) => (
                    <div key={i} className={cn('flex items-center justify-between px-3 py-2 rounded-lg text-sm', r.status === 'success' ? 'bg-emerald-50' : 'bg-red-50')}>
                      <span className="font-medium text-slate-700">{r.language} ({r.iso_code})</span>
                      <span className={cn('flex items-center gap-1 text-xs font-medium', r.status === 'success' ? 'text-emerald-600' : 'text-red-600')}>
                        {r.status === 'success' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                        {r.status === 'success' ? 'Saved' : r.error || 'Error'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkLoading}>{bulkDone ? 'Close' : 'Cancel'}</Button>
              {!bulkDone && (
                <Button onClick={handleBulkGenerate} disabled={bulkLoading || !bulkPrompt.trim()}>
                  {bulkLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Zap className="w-4 h-4" /> Generate All</>}
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '\u2014'}</dd>
    </div>
  );
}
