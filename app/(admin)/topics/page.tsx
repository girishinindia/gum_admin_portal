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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { AiProgressOverlay, useAiProgress } from '@/components/ui/AiProgressOverlay';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, BookOpen, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, Check, X, Sparkles, Zap, Upload, Download, HelpCircle, FileText, FolderTree } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Topic, Chapter, Subject } from '@/lib/types';

interface CoverageItem {
  topic_id: number;
  total_languages: number;
  translated_count: number;
  missing_count: number;
  is_complete: boolean;
  translated_languages: { id: number; name: string; iso_code: string }[];
  missing_languages: { id: number; name: string; iso_code: string }[];
}

interface BulkResult { iso_code: string; language: string; status: 'success' | 'error'; error?: string; id?: number }

type AIProvider = 'anthropic' | 'openai' | 'gemini';
const AI_PROVIDERS: { value: AIProvider; label: string; model: string }[] = [
  { value: 'anthropic', label: 'Anthropic', model: 'Claude Haiku 4.5' },
  { value: 'openai', label: 'OpenAI', model: 'GPT-4o Mini' },
  { value: 'gemini', label: 'Google', model: 'Gemini 2.5 Flash' },
];

const DEFAULT_BULK_PROMPT = `Create content in English language for selected topic with human way writing style and convert exact English content with same meaning for other languages which are listed for translations.\n\nTranslate exactly with the same meaning. Keep technical or brand words in English that sound strange or unnatural when translated.\n\nMost Important: don't write everything in pure regional language... use some common and topic related technical English words in all outputs as it is. Keep technical or brand words in English that sound strange or unnatural or weird when translated.`;

type SortField = 'id' | 'slug' | 'display_order' | 'sort_order' | 'is_active';

export default function TopicsPage() {
  const [items, setItems] = useState<Topic[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Topic | null>(null);
  const [viewing, setViewing] = useState<Topic | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  // Pagination, search, sort, filter
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
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Table summary stats
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Coverage + Bulk Generate
  const [coverage, setCoverage] = useState<Record<number, CoverageItem>>({});
  const [aiOpen, setAiOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTopic, setBulkTopic] = useState<Topic | null>(null);
  const [bulkPrompt, setBulkPrompt] = useState(DEFAULT_BULK_PROMPT);
  const [bulkProvider, setBulkProvider] = useState<AIProvider>('gemini');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkDone, setBulkDone] = useState(false);

  // Import Topics
  const [importOpen, setImportOpen] = useState(false);
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<string[]>([]);
  const [importSubjectId, setImportSubjectId] = useState('');
  const [importChapterId, setImportChapterId] = useState('');
  const [importSubjects, setImportSubjects] = useState<Subject[]>([]);
  const [importProvider, setImportProvider] = useState<AIProvider>('gemini');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Dialog: cascading subject > chapter filters
  const [dialogSubject, setDialogSubject] = useState('');
  const [dialogChapters, setDialogChapters] = useState<Chapter[]>([]);

  const { register, handleSubmit, reset, watch, setValue } = useForm();

  // AI Progress
  const bulkAiProgress = useAiProgress();
  const importAiProgress = useAiProgress();

  useEffect(() => {
    api.listSubjects('?limit=500&is_active=true').then(res => { if (res.success) setSubjects(res.data || []); });
    api.listChapters('?limit=500&is_active=true').then(res => { if (res.success) setChapters(res.data || []); });
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary + coverage once on mount
  useEffect(() => {
    api.getTableSummary('topics').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  // Filtered chapters based on selected subject filter (for toolbar)
  const filteredChaptersForToolbar = filterSubject
    ? chapters.filter(c => String((c as any).subject_id) === filterSubject)
    : chapters;

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterSubject, filterChapter, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterSubject, filterChapter, filterStatus, showTrash]);

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
      if (filterChapter) qs.set('chapter_id', filterChapter);
      else if (filterSubject) qs.set('subject_id', filterSubject);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listTopics('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('topics');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getTopicTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: CoverageItem) => { map[c.topic_id] = c; });
      setCoverage(map);
    }
  }

  function openBulkGenerate(topic: Topic) {
    setBulkTopic(topic);
    setBulkPrompt(DEFAULT_BULK_PROMPT);
    setBulkProvider('gemini');
    setBulkResults([]);
    setBulkDone(false);
    setBulkLoading(false);
    setBulkOpen(true);
  }

  async function handleBulkGenerate() {
    if (!bulkTopic) return;
    setBulkLoading(true);
    setBulkResults([]);
    setBulkDone(false);
    bulkAiProgress.start([
      'Analyzing topic content',
      'Generating translations with AI',
      'Saving translations to database',
    ]);
    try {
      bulkAiProgress.nextStep();
      const res = await api.bulkGenerateTopicTranslations({
        topic_id: bulkTopic.id,
        prompt: bulkPrompt,
        provider: bulkProvider,
      });
      bulkAiProgress.nextStep();
      if (res.success && res.data) {
        setBulkResults(res.data.results || []);
        toast.success(`Generated translations using ${AI_PROVIDERS.find(p => p.value === bulkProvider)?.label}`);
        loadCoverage();
        bulkAiProgress.finish();
      } else {
        toast.error(res.error || 'Bulk generation failed');
        bulkAiProgress.setStepError();
      }
    } catch {
      toast.error('Bulk generation failed');
      bulkAiProgress.setStepError();
    }
    setBulkLoading(false);
    setBulkDone(true);
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

  // ─── Import Handlers ───
  function downloadSampleFile() {
    const sample = `What is Machine Learning
Types of Machine Learning
Supervised vs Unsupervised Learning
ML Applications in Real World
Getting Started with ML
Data Preprocessing Techniques
Model Evaluation Metrics`;
    const blob = new Blob([sample], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample-topics-import.txt'; a.click();
    URL.revokeObjectURL(url);
  }

  function openImportDialog() {
    setImportOpen(true);
    setImportFile(null);
    setImportPreview([]);
    setImportResult(null);
    setImportSubjectId('');
    setImportChapterId('');
    // Use already-loaded subjects
    setImportSubjects(subjects);
  }

  // Chapters filtered by selected import subject
  const importFilteredChapters = importSubjectId
    ? chapters.filter(c => String((c as any).subject_id) === importSubjectId)
    : [];

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const names = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      setImportPreview(names);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importFile || !importChapterId || !importSubjectId) return;
    setImportLoading(true);
    setImportResult(null);
    importAiProgress.start([
      'Parsing file structure',
      'Creating records in database',
      'Generating AI translations',
      'Finalizing import',
    ]);
    try {
      const subject = importSubjects.find(s => String(s.id) === importSubjectId);
      const chapter = chapters.find(c => String(c.id) === importChapterId);
      if (!subject) { toast.error('Please select a subject'); setImportLoading(false); importAiProgress.reset(); return; }
      if (!chapter) { toast.error('Please select a chapter'); setImportLoading(false); importAiProgress.reset(); return; }

      const subjectCode = subject.code;

      // Read file and wrap: subject > chapter > topics (each line becomes a topic with 2 tabs)
      const text = await importFile.text();
      const topicLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const wrappedContent = `${subjectCode}\n\t${chapter.slug}\n${topicLines.map(t => '\t\t' + t).join('\n')}`;
      const blob = new Blob([wrappedContent], { type: 'text/plain' });
      const wrappedFile = new File([blob], importFile.name, { type: 'text/plain' });

      importAiProgress.nextStep();
      const fd = new FormData();
      fd.append('file', wrappedFile);
      fd.append('provider', importProvider);
      fd.append('generate_translations', 'true');
      const res = await api.importMaterialTree(fd);
      importAiProgress.nextStep();
      importAiProgress.nextStep();
      if (res.success) {
        setImportResult(res.data);
        toast.success('Import completed successfully!');
        load(); loadCoverage();
        importAiProgress.finish();
      } else {
        toast.error(res.message || 'Import failed');
        setImportResult({ error: res.message });
        importAiProgress.setStepError();
      }
    } catch (e: any) {
      toast.error(e.message || 'Import failed');
      setImportResult({ error: e.message });
      importAiProgress.setStepError();
    } finally {
      setImportLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setDialogKey(k => k + 1);
    setDialogSubject('');
    setDialogChapters([]);
    reset({ chapter_id: '', slug: '', display_order: 0, sort_order: 0 });
    setDialogOpen(true);
  }

  function openEdit(t: Topic) {
    setEditing(t);
    setDialogKey(k => k + 1);
    // Pre-select subject based on the topic's chapter and load related chapters
    const ch = chapters.find(c => c.id === t.chapter_id);
    const subjectId = ch ? String((ch as any).subject_id) : '';
    setDialogSubject(subjectId);
    if (subjectId) {
      api.listChapters(`?limit=500&is_active=true&subject_id=${subjectId}`).then(res => {
        if (res.success) setDialogChapters(res.data || []);
      });
    } else {
      setDialogChapters([]);
    }
    reset({ chapter_id: t.chapter_id || '', slug: t.slug, display_order: t.display_order, sort_order: t.sort_order ?? 0 });
    setDialogOpen(true);
  }

  function openView(t: Topic) {
    setViewing(t);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {
      slug: data.slug,
      display_order: Number(data.display_order) || 0,
      sort_order: Number(data.sort_order) || 0,
    };
    // chapter_id is nullable — only include if a value was selected
    if (data.chapter_id !== '' && data.chapter_id !== undefined) {
      payload.chapter_id = Number(data.chapter_id);
    } else {
      payload.chapter_id = null;
    }

    const res = editing
      ? await api.updateTopic(editing.id, payload)
      : await api.createTopic(payload);

    if (res.success) {
      toast.success(editing ? 'Topic updated' : 'Topic created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(t: Topic) {
    if (!confirm(`Move "${t.slug}" to trash? You can restore it later.`)) return;
    setActionLoadingId(t.id);
    const res = await api.deleteTopic(t.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Topic moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(t: Topic) {
    setActionLoadingId(t.id);
    const res = await api.restoreTopic(t.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${t.slug}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(t: Topic) {
    if (!confirm(`PERMANENTLY delete "${t.slug}"? This cannot be undone.`)) return;
    setActionLoadingId(t.id);
    const res = await api.permanentDeleteTopic(t.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Topic permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(t: Topic) {
    const res = await api.updateTopic(t.id, { is_active: !t.is_active });
    if (res.success) { toast.success(`Topic ${!t.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  // Bulk selection helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteTopic(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreTopic(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteTopic(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Topics"
        description="Manage chapter topics"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={openImportDialog}><Upload className="w-4 h-4" /> Import</Button>}
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add topic</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Topics', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Topics
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

      {/* Toolbar: search + filters */}
      <DataToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search topics by slug...'}
      >
        {!showTrash && (
          <>
            <SearchableSelect
              options={subjects.map(s => ({ value: String(s.id), label: s.english_name || s.code }))}
              value={filterSubject}
              onChange={(val) => { setFilterSubject(val); setFilterChapter(''); }}
              placeholder="All subjects"
              searchPlaceholder="Search subjects..."
            />
            <SearchableSelect
              options={filteredChaptersForToolbar.map(c => ({ value: String(c.id), label: c.english_name || c.slug }))}
              value={filterChapter}
              onChange={setFilterChapter}
              placeholder={filterSubject ? 'All chapters' : 'All chapters'}
              searchPlaceholder="Search chapters..."
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
            >
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
          icon={showTrash ? Trash2 : BookOpen}
          title={showTrash ? 'Trash is empty' : 'No topics yet'}
          description={showTrash ? 'No deleted topics' : (searchDebounce || filterChapter || filterStatus ? 'No topics match your filters' : 'Add your first topic')}
          action={!showTrash && !searchDebounce && !filterChapter && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add topic</Button> : undefined}
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
                <TH>Chapter</TH>
                <TH>
                  <button onClick={() => handleSort('slug')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Name <SortIcon field="slug" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Display <SortIcon field="display_order" />
                  </button>
                </TH>
                {!showTrash && <TH>
                  <button onClick={() => handleSort('sort_order')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Sort <SortIcon field="sort_order" />
                  </button>
                </TH>}
                {!showTrash && <TH>Translations</TH>}
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
              {items.map(t => (
                <TR key={t.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(t.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{t.id}</span></TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600">{chapters.find(c => c.id === t.chapter_id)?.english_name || t.chapters?.slug || '\u2014'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <div>
                      <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                        {(t as any).english_name || ''}
                      </span>
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600">{t.display_order}</span>
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <span className="text-slate-600">{t.sort_order ?? 0}</span>
                    </TD>
                  )}
                  {!showTrash && (
                    <TD className="py-2.5">
                      {(() => {
                        const cov = coverage[t.id];
                        if (!cov) return <span className="text-slate-300 text-xs">{'\u2014'}</span>;
                        const complete = cov.is_complete;
                        return (
                          <div className="flex items-center gap-1.5">
                            <Badge variant={complete ? 'success' : 'warning'}>
                              {cov.translated_count}/{cov.total_languages}
                            </Badge>
                            {!complete && (
                              <button
                                onClick={() => openBulkGenerate(t)}
                                className="p-1 rounded-md text-violet-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                                title="Generate missing translations"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-amber-600">{t.deleted_at ? fromNow(t.deleted_at) : '\u2014'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={t.is_active ? 'success' : 'danger'}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(t)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(t)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(t)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(t)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onSoftDelete(t)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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

      {/* ── View Topic Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Topic Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                <BookOpen className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 font-mono">{viewing.slug}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {viewing.chapter_id && <Badge variant="info">{chapters.find(c => c.id === viewing.chapter_id)?.english_name || viewing.chapters?.slug || '—'}</Badge>}
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Chapter" value={chapters.find(c => c.id === viewing.chapter_id)?.english_name || viewing.chapters?.slug} />
              <DetailRow label="Slug" value={`/${viewing.slug}`} />
              <DetailRow label="Display Order" value={String(viewing.display_order)} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order ?? 0)} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
              <DetailRow label="Updated" value={fromNow(viewing.updated_at)} />
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Topic' : 'Add Topic'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This topic is currently active' : 'This topic is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getTopic(editing.id);
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
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                    editing.is_active ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          )}

          <SearchableSelect
            label="Subject"
            options={subjects.map(s => ({ value: String(s.id), label: s.english_name || s.code }))}
            value={dialogSubject}
            onChange={(val) => {
              setDialogSubject(val);
              setValue('chapter_id', '');
              if (val) {
                api.listChapters(`?limit=500&is_active=true&subject_id=${val}`).then(res => {
                  if (res.success) setDialogChapters(res.data || []);
                  else setDialogChapters([]);
                });
              } else {
                setDialogChapters([]);
              }
            }}
            placeholder="All subjects"
            searchPlaceholder="Search subjects..."
          />
          <SearchableSelect
            label="Chapter"
            options={dialogChapters.map(c => ({ value: String(c.id), label: c.english_name || c.slug }))}
            value={watch('chapter_id') || ''}
            onChange={(val) => setValue('chapter_id', val)}
            placeholder={dialogSubject ? 'Select a chapter' : 'Select subject first'}
            searchPlaceholder="Search chapters..."
            disabled={!dialogSubject}
          />
          <div>
            <Input label="Slug" placeholder="auto-generated if empty" {...register('slug')} />
            {!editing && <p className="text-xs text-slate-400 mt-1">Leave empty to auto-generate from name</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Display Order" type="number" {...register('display_order')} />
            <Input label="Sort Order" type="number" {...register('sort_order')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
      <AiMasterDialog module="topics" moduleLabel="Topics" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createTopic(item)} updateFn={(id, item) => api.updateTopic(id, item)} listFn={(qs) => api.listTopics(qs)} onSaved={() => { load(); refreshSummary(); }} />

      {/* Bulk AI Generate Translations Dialog */}
      <Dialog open={bulkOpen} onClose={() => !bulkLoading && setBulkOpen(false)} title="AI Generate Translations" size="lg">
        {bulkTopic && (
          <div className="p-6 space-y-5">
            {/* Topic info */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center border border-slate-200 flex-shrink-0">
                <BookOpen className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 font-mono text-sm">#{bulkTopic.id}</div>
                <div className="text-xs text-slate-500">/{bulkTopic.slug}</div>
              </div>
            </div>

            {/* Missing languages */}
            {coverage[bulkTopic.id] && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Missing Translations ({coverage[bulkTopic.id].missing_count} of {coverage[bulkTopic.id].total_languages} languages)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {coverage[bulkTopic.id].missing_languages.map(lang => (
                    <span key={lang.id} className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
                      {lang.name} ({lang.iso_code})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Provider selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">AI Provider</label>
              <div className="grid grid-cols-3 gap-2">
                {AI_PROVIDERS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    disabled={bulkLoading}
                    onClick={() => setBulkProvider(p.value)}
                    className={cn(
                      'px-3 py-2.5 rounded-lg border text-sm font-medium transition-all text-left',
                      bulkProvider === p.value
                        ? 'border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div className="font-semibold">{p.label}</div>
                    <div className="text-xs opacity-70 mt-0.5">{p.model}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Prompt</label>
              <textarea
                value={bulkPrompt}
                onChange={e => setBulkPrompt(e.target.value)}
                disabled={bulkLoading}
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 disabled:opacity-50 resize-none"
              />
            </div>

            {/* AI Progress */}
            <AiProgressOverlay
              active={bulkAiProgress.active}
              steps={bulkAiProgress.steps}
              title="Generating Translations"
              subtitle={`Using ${AI_PROVIDERS.find(p => p.value === bulkProvider)?.label || 'AI'} — ${bulkTopic?.slug || ''}`}
            />

            {/* Results */}
            {bulkResults.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Results</label>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {bulkResults.map((r, i) => (
                    <div key={i} className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                      r.status === 'success' ? 'bg-emerald-50' : 'bg-red-50'
                    )}>
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

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" onClick={() => setBulkOpen(false)} disabled={bulkLoading}>
                {bulkDone ? 'Close' : 'Cancel'}
              </Button>
              {!bulkDone && (
                <Button onClick={handleBulkGenerate} disabled={bulkLoading || !bulkPrompt.trim()}>
                  {bulkLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> Generate All</>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* ─── Import Topics Dialog ─── */}
      <Dialog open={importOpen} onClose={() => !importLoading && setImportOpen(false)} title="Import Topics" size="lg">
        <div className="space-y-5 p-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Upload a .txt file with one topic name per line to bulk-create topics under a chapter.</p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={downloadSampleFile} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 transition-colors whitespace-nowrap border border-emerald-200 rounded-md px-2.5 py-1.5 hover:bg-emerald-50">
                <Download className="w-4 h-4" /> Sample file
              </button>
              <button onClick={() => setImportHelpOpen(true)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap border border-blue-200 rounded-md px-2.5 py-1.5 hover:bg-blue-50">
                <HelpCircle className="w-4 h-4" /> How to use
              </button>
            </div>
          </div>

          {/* Subject selector */}
          <SearchableSelect
            label="Parent Subject *"
            options={importSubjects.map(s => ({ value: String(s.id), label: s.english_name || s.code }))}
            value={importSubjectId}
            onChange={(val) => { setImportSubjectId(val); setImportChapterId(''); }}
            placeholder="Select a subject..."
            searchPlaceholder="Search subjects..."
            disabled={importLoading}
          />

          {/* Chapter selector */}
          <SearchableSelect
            label="Parent Chapter *"
            options={importFilteredChapters.map(c => ({ value: String(c.id), label: c.english_name || c.slug }))}
            value={importChapterId}
            onChange={(val) => setImportChapterId(val)}
            placeholder={importSubjectId ? 'Select a chapter...' : 'Select a subject first...'}
            searchPlaceholder="Search chapters..."
            disabled={importLoading || !importSubjectId}
          />

          {/* File upload */}
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-blue-300 transition-colors">
            <input type="file" accept=".txt,.csv" onChange={handleImportFile} className="hidden" id="import-topic-file" disabled={importLoading} />
            <label htmlFor="import-topic-file" className="cursor-pointer">
              {importFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-slate-700">{importFile.name}</span>
                  <span className="text-xs text-slate-400">({(importFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Click to upload .txt file</p>
                  <p className="text-xs text-slate-400 mt-1">One topic name per line</p>
                </div>
              )}
            </label>
          </div>

          {/* Preview */}
          {importPreview.length > 0 && !importResult && (
            <div className="border border-slate-200 rounded-lg p-4 max-h-48 overflow-auto bg-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <FolderTree className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Preview</span>
                <span className="text-xs text-slate-400">({importPreview.length} topic{importPreview.length !== 1 ? 's' : ''})</span>
              </div>
              {importPreview.map((name, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> {name}
                </div>
              ))}
            </div>
          )}

          {/* AI Provider */}
          {importPreview.length > 0 && !importResult && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">AI Provider (for translations)</label>
              <select value={importProvider} onChange={e => setImportProvider(e.target.value as AIProvider)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" disabled={importLoading}>
                {AI_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label} — {p.model}</option>)}
              </select>
            </div>
          )}

          {/* AI Import Progress */}
          <AiProgressOverlay
            active={importAiProgress.active}
            steps={importAiProgress.steps}
            title="Importing Topics"
            subtitle={`Using ${AI_PROVIDERS.find(p => p.value === importProvider)?.label || 'AI'} for translations`}
          />

          {/* Result */}
          {importResult && !importResult.error && (
            <div className="border border-green-200 rounded-lg p-4 bg-green-50 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Import Complete
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
                <div className="text-lg font-bold text-purple-700">{importResult.report?.created?.topics || 0}</div>
                <div className="text-xs text-slate-500">Topics created</div>
              </div>
              {importResult.report?.skipped?.topics > 0 && (
                <div className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Skipped {importResult.report.skipped.topics} existing topics
                </div>
              )}
              {importResult.ai_translations_generated && (
                <div className="text-xs text-green-600 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI translations generated</div>
              )}
            </div>
          )}

          {importResult?.error && (
            <div className="border border-red-200 rounded-lg p-3 bg-red-50 text-sm text-red-700 flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> {importResult.error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importLoading}>{importResult ? 'Close' : 'Cancel'}</Button>
            {!importResult && importPreview.length > 0 && (
              <Button onClick={handleImport} disabled={importLoading || !importFile || !importSubjectId || !importChapterId}>
                {importLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4" /> Start Import</>}
              </Button>
            )}
          </div>
        </div>
      </Dialog>

      {/* ─── Import Help Dialog ─── */}
      <Dialog open={importHelpOpen} onClose={() => setImportHelpOpen(false)} title="How to Import Topics" size="lg">
        <div className="space-y-5 p-2 text-sm text-slate-700">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="font-semibold text-blue-800 mb-2">File Format</p>
            <p>Create a <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">.txt</code> file with <strong>one topic name per line</strong> — no tabs needed:</p>
            <div className="mt-2 bg-white rounded border border-blue-200 p-3 font-mono text-xs leading-relaxed">
              <div className="text-purple-700">What is Machine Learning</div>
              <div className="text-purple-700">Types of Machine Learning</div>
              <div className="text-purple-700">Supervised vs Unsupervised</div>
              <div className="text-purple-700">ML Applications in Real World</div>
              <div className="text-purple-700">Getting Started with ML</div>
            </div>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-2">How It Works</p>
            <div className="border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex items-start gap-2"><span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">1</span> Select the parent subject first, then pick the chapter</div>
              <div className="flex items-start gap-2"><span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">2</span> Upload your .txt file with topic names</div>
              <div className="flex items-start gap-2"><span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">3</span> Review the preview and click Start Import</div>
              <div className="flex items-start gap-2"><span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">4</span> AI generates all translations, slugs, and Bunny folders automatically</div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="font-semibold text-amber-800 mb-1">Important</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>Select the parent subject and chapter before importing</li>
              <li>Existing topics (matching by name/slug) are automatically skipped</li>
              <li>AI generates translations in all active languages</li>
              <li>Safe to re-import — no duplicates will be created</li>
            </ul>
          </div>

          <div className="flex justify-end"><Button variant="outline" onClick={() => setImportHelpOpen(false)}>Got it</Button></div>
        </div>
      </Dialog>
    </div>
  );
}

/* ── Small helper for the view dialog ── */
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '\u2014'}</dd>
    </div>
  );
}
