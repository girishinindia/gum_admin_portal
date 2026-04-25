"use client";
import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
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
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, BookOpen, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, Check, X, Sparkles, Zap, Upload, Download, HelpCircle, FileText, FolderTree, ChevronRight } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Chapter, Subject } from '@/lib/types';

interface CoverageItem {
  chapter_id: number;
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

const DEFAULT_BULK_PROMPT = `Create content in English language for selected chapter with human way writing style and convert exact English content with same meaning for other languages which are listed for translations.\n\nTranslate exactly with the same meaning. Keep technical or brand words in English that sound strange or unnatural when translated.\n\nMost Important: don't write everything in pure regional language... use some common and chapter related technical English words in all outputs as it is. Keep technical or brand words in English that sound strange or unnatural or weird when translated.`;

type SortField = 'id' | 'slug' | 'display_order' | 'sort_order' | 'is_active';

export default function ChaptersPage() {
  const [items, setItems] = useState<Chapter[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [viewing, setViewing] = useState<Chapter | null>(null);
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
  const [bulkChapter, setBulkChapter] = useState<Chapter | null>(null);
  const [bulkPrompt, setBulkPrompt] = useState(DEFAULT_BULK_PROMPT);
  const [bulkProvider, setBulkProvider] = useState<AIProvider>('gemini');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkDone, setBulkDone] = useState(false);

  // Import Chapters+Topics
  const [importOpen, setImportOpen] = useState(false);
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importSubjectId, setImportSubjectId] = useState('');
  const [importProvider, setImportProvider] = useState<AIProvider>('gemini');
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm();

  // AI Progress
  const bulkAiProgress = useAiProgress();
  const importAiProgress = useAiProgress();


  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ctrl+g', action: () => { if (!showTrash) setAiOpen(true); } },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g u', action: () => router.push('/users') },
    { key: 'g c', action: () => router.push('/categories') },
    { key: 'g s', action: () => router.push('/subjects') },
    { key: 'g m', action: () => router.push('/material-tree') },
  ]);

  useEffect(() => {
    api.listSubjects('?limit=500&is_active=true').then(res => { if (res.success) setSubjects(res.data || []); });
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary + coverage once on mount
  useEffect(() => {
    api.getTableSummary('chapters').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    loadCoverage();
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterSubject, filterStatus, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterSubject, filterStatus, showTrash]);

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
      if (filterSubject) qs.set('subject_id', filterSubject);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    const res = await api.listChapters('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('chapters');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getChapterTranslationCoverage();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<number, CoverageItem> = {};
      res.data.forEach((c: CoverageItem) => { map[c.chapter_id] = c; });
      setCoverage(map);
    }
  }

  function openBulkGenerate(ch: Chapter) {
    setBulkChapter(ch);
    setBulkPrompt(DEFAULT_BULK_PROMPT);
    setBulkProvider('gemini');
    setBulkResults([]);
    setBulkDone(false);
    setBulkLoading(false);
    setBulkOpen(true);
  }

  async function handleBulkGenerate() {
    if (!bulkChapter) return;
    setBulkLoading(true);
    setBulkResults([]);
    setBulkDone(false);
    bulkAiProgress.start([
      'Analyzing chapter content',
      'Generating translations with AI',
      'Saving translations to database',
    ]);
    try {
      bulkAiProgress.nextStep();
      const res = await api.bulkGenerateChapterTranslations({
        chapter_id: bulkChapter.id,
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
    const sample = `Introduction to ML
\tWhat is Machine Learning
\tTypes of Machine Learning
\tML Applications in Real World
Supervised Learning
\tLinear Regression
\tLogistic Regression
\tDecision Trees
Unsupervised Learning
\tClustering Algorithms
\tDimensionality Reduction`;
    const blob = new Blob([sample], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample-chapters-import.txt'; a.click();
    URL.revokeObjectURL(url);
  }

  function parseChapterImportPreview(content: string) {
    const lines = content.split(/\r?\n/);
    const chapters: any[] = [];
    let currentChapter: any = null;
    for (const raw of lines) {
      if (raw.trim() === '') continue;
      let tabs = 0; let j = 0;
      while (j < raw.length && raw[j] === '\t') { tabs++; j++; }
      if (tabs === 0 && raw[0] === ' ') {
        let spaces = 0; let k = 0;
        while (k < raw.length && raw[k] === ' ') { spaces++; k++; }
        if (spaces >= 4) tabs = 1; else if (spaces >= 2) tabs = 1;
        j = k;
      }
      const name = raw.slice(j).trim();
      if (!name) continue;
      if (tabs === 0) {
        currentChapter = { name, topics: [] };
        chapters.push(currentChapter);
      } else if (tabs >= 1 && currentChapter) {
        currentChapter.topics.push({ name });
      }
    }
    return chapters;
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setImportPreview(parseChapterImportPreview(content));
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importFile || !importSubjectId) return;
    setImportLoading(true);
    setImportResult(null);
    importAiProgress.start([
      'Parsing file structure',
      'Creating records in database',
      'Generating AI translations',
      'Finalizing import',
    ]);
    try {
      // Find subject code/name to wrap the file content
      const subject = subjects.find(s => String(s.id) === importSubjectId);
      if (!subject) { toast.error('Please select a subject'); setImportLoading(false); importAiProgress.reset(); return; }

      // Read file and prepend subject name as parent
      const text = await importFile.text();
      const wrappedContent = `${subject.code || subject.slug}\n${text.split('\n').map(l => l.trim() ? '\t' + l : '').join('\n')}`;
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
    reset({ subject_id: subjects[0]?.id || '', slug: '', display_order: 0, sort_order: 0, is_active: true });
    setDialogOpen(true);
  }

  function openEdit(c: Chapter) {
    setEditing(c);
    setDialogKey(k => k + 1);
    reset({ subject_id: c.subject_id, slug: c.slug, display_order: c.display_order, sort_order: c.sort_order ?? 0, is_active: c.is_active });
    setDialogOpen(true);
  }

  function openView(c: Chapter) {
    setViewing(c);
  }

  async function onSubmit(data: any) {
    const payload = {
      subject_id: Number(data.subject_id),
      slug: data.slug,
      display_order: Number(data.display_order) || 0,
      sort_order: Number(data.sort_order) || 0,
      is_active: data.is_active === true || data.is_active === 'true',
    };

    const res = editing
      ? await api.updateChapter(editing.id, payload)
      : await api.createChapter(payload);

    if (res.success) {
      toast.success(editing ? 'Chapter updated' : 'Chapter created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(c: Chapter) {
    if (!confirm(`Move "${c.slug}" to trash? You can restore it later.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteChapter(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Chapter moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: Chapter) {
    setActionLoadingId(c.id);
    const res = await api.restoreChapter(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${c.slug}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: Chapter) {
    if (!confirm(`PERMANENTLY delete "${c.slug}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.permanentDeleteChapter(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Chapter permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: Chapter) {
    const res = await api.updateChapter(c.id, { is_active: !c.is_active });
    if (res.success) { toast.success(`Chapter ${!c.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteChapter(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreChapter(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
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
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteChapter(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Chapters"
        description="Manage subject chapters"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button variant="outline" onClick={() => { setImportOpen(true); setImportFile(null); setImportPreview(null); setImportResult(null); setImportSubjectId(filterSubject || ''); }}><Upload className="w-4 h-4" /> Import</Button>}
            {!showTrash && <Button variant="outline" onClick={() => setAiOpen(true)}><Sparkles className="w-4 h-4" /> AI Generate</Button>}
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add chapter</Button>}
          </div>
        }
      />

      {/* Summary Stats from table_summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Chapters', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
          Chapters
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
        ref={toolbarRef}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search chapters by slug...'}
      >
        {!showTrash && (
          <>
            <SearchableSelect
              options={subjects.map(s => ({ value: String(s.id), label: s.english_name || '' }))}
              value={filterSubject}
              onChange={setFilterSubject}
              placeholder="All subjects"
              searchPlaceholder="Search subjects..."
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
          title={showTrash ? 'Trash is empty' : 'No chapters yet'}
          description={showTrash ? 'No deleted chapters' : (searchDebounce || filterSubject || filterStatus ? 'No chapters match your filters' : 'Add your first chapter')}
          action={!showTrash && !searchDebounce && !filterSubject && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add chapter</Button> : undefined}
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
                <TH>Subject</TH>
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
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600">{subjects.find(s => s.id === c.subject_id)?.english_name || ''}</span>
                  </TD>
                  <TD className="py-2.5">
                    <div>
                      <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                        {(c as any).english_name || ''}
                      </span>
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600">{c.display_order}</span>
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <span className="text-slate-600">{c.sort_order ?? 0}</span>
                    </TD>
                  )}
                  {!showTrash && (
                    <TD className="py-2.5">
                      {(() => {
                        const cov = coverage[c.id];
                        if (!cov) return <span className="text-slate-300 text-xs">{'\u2014'}</span>;
                        const complete = cov.is_complete;
                        return (
                          <div className="flex items-center gap-1.5">
                            <Badge variant={complete ? 'success' : 'warning'}>
                              {cov.translated_count}/{cov.total_languages}
                            </Badge>
                            {!complete && (
                              <button
                                onClick={() => openBulkGenerate(c)}
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
                      <span className="text-xs text-amber-600">{c.deleted_at ? fromNow(c.deleted_at) : '\u2014'}</span>
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

      {/* ── View Chapter Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Chapter Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                <BookOpen className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 font-mono">{viewing.slug}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {viewing.subject_id && <Badge variant="info">{subjects.find(s => s.id === viewing.subject_id)?.english_name || viewing.subjects?.code || '—'}</Badge>}
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Subject" value={subjects.find(s => s.id === viewing.subject_id)?.english_name || viewing.subjects?.code} />
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
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Chapter' : 'Add Chapter'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This chapter is currently active' : 'This chapter is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getChapter(editing.id);
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
            options={subjects.map(s => ({ value: String(s.id), label: s.english_name || '' }))}
            value={watch('subject_id') || ''}
            onChange={(val) => setValue('subject_id', val)}
            placeholder="Select a subject"
            searchPlaceholder="Search subjects..."
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
      <AiMasterDialog module="chapters" moduleLabel="Chapters" open={aiOpen} onClose={() => setAiOpen(false)} createFn={(item) => api.createChapter(item)} updateFn={(id, item) => api.updateChapter(id, item)} listFn={(qs) => api.listChapters(qs)} onSaved={() => { load(); refreshSummary(); }} />

      {/* Bulk AI Generate Translations Dialog */}
      <Dialog open={bulkOpen} onClose={() => !bulkLoading && setBulkOpen(false)} title="AI Generate Translations" size="lg">
        {bulkChapter && (
          <div className="p-6 space-y-5">
            {/* Chapter info */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center border border-slate-200 flex-shrink-0">
                <BookOpen className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <div className="font-semibold text-slate-900 font-mono text-sm">#{bulkChapter.id}</div>
                <div className="text-xs text-slate-500">/{bulkChapter.slug}</div>
              </div>
            </div>

            {/* Missing languages */}
            {coverage[bulkChapter.id] && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Missing Translations ({coverage[bulkChapter.id].missing_count} of {coverage[bulkChapter.id].total_languages} languages)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {coverage[bulkChapter.id].missing_languages.map(lang => (
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
              subtitle={`Using ${AI_PROVIDERS.find(p => p.value === bulkProvider)?.label || 'AI'} — ${bulkChapter?.slug || ''}`}
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

      {/* ─── Import Chapters Dialog ─── */}
      <Dialog open={importOpen} onClose={() => !importLoading && setImportOpen(false)} title="Import Chapters & Topics" size="lg">
        <div className="space-y-5 p-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Import chapters only, or chapters with topics. One name per line — use tab indent for topics.</p>
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Parent Subject <span className="text-red-500">*</span></label>
            <SearchableSelect
              options={subjects.map(s => ({ value: String(s.id), label: s.english_name || '' }))}
              value={importSubjectId}
              onChange={setImportSubjectId}
              placeholder="Select a subject..."
              searchPlaceholder="Search subjects..."
              disabled={importLoading}
            />
          </div>

          {/* File upload */}
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-blue-300 transition-colors">
            <input type="file" accept=".txt,.csv" onChange={handleImportFile} className="hidden" id="import-chapter-file" disabled={importLoading} />
            <label htmlFor="import-chapter-file" className="cursor-pointer">
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
                  <p className="text-xs text-slate-400 mt-1">Chapters only, or chapters + topics (tab-indented)</p>
                </div>
              )}
            </label>
          </div>

          {/* Tree Preview */}
          {importPreview && importPreview.length > 0 && !importResult && (
            <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-auto bg-slate-50">
              <div className="flex items-center gap-2 mb-3">
                <FolderTree className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Preview</span>
                {(() => {
                  const topicCount = importPreview.reduce((a: number, c: any) => a + c.topics.length, 0);
                  return (
                    <span className="text-xs text-slate-400">
                      ({importPreview.length} chapter{importPreview.length !== 1 ? 's' : ''}{topicCount > 0 ? `, ${topicCount} topic${topicCount !== 1 ? 's' : ''}` : ' only'})
                    </span>
                  );
                })()}
              </div>
              {importPreview.map((chapter: any, ci: number) => (
                <div key={ci} className="mb-2">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
                    <ChevronRight className="w-3.5 h-3.5" /> {chapter.name}
                  </div>
                  {chapter.topics.map((topic: any, ti: number) => (
                    <div key={ti} className="ml-5 mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> {topic.name}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* AI Provider */}
          {importPreview && !importResult && (
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
            title="Importing Material"
            subtitle={`Using ${AI_PROVIDERS.find(p => p.value === importProvider)?.label || 'AI'} for translations`}
          />

          {/* Import Result */}
          {importResult && !importResult.error && (
            <div className="border border-green-200 rounded-lg p-4 bg-green-50 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" /> Import Complete
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-white rounded-lg p-2 border border-green-100">
                  <div className="text-lg font-bold text-blue-700">{importResult.report?.created?.chapters || 0}</div>
                  <div className="text-xs text-slate-500">Chapters created</div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-green-100">
                  <div className="text-lg font-bold text-purple-700">{importResult.report?.created?.topics || 0}</div>
                  <div className="text-xs text-slate-500">Topics created</div>
                </div>
              </div>
              {(importResult.report?.skipped?.chapters > 0 || importResult.report?.skipped?.topics > 0) && (
                <div className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Skipped (already exist): {importResult.report.skipped.chapters} chapters, {importResult.report.skipped.topics} topics
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
            {!importResult && importPreview && (
              <Button onClick={handleImport} disabled={importLoading || !importFile || !importSubjectId}>
                {importLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4" /> Start Import</>}
              </Button>
            )}
          </div>
        </div>
      </Dialog>

      {/* ─── Import Help Dialog ─── */}
      <Dialog open={importHelpOpen} onClose={() => setImportHelpOpen(false)} title="How to Import Chapters" size="lg">
        <div className="space-y-5 p-2 text-sm text-slate-700">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="font-semibold text-blue-800 mb-2">File Format</p>
            <p>Create a <code className="bg-blue-100 px-1.5 py-0.5 rounded text-xs">.txt</code> file — you can import <strong>chapters only</strong> or <strong>chapters with topics</strong>:</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> No tab = Chapter name</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> 1 tab = Topic name (optional)</div>
            </div>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-2">Both Formats Supported</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-lg p-3">
                <p className="font-medium text-blue-700 mb-2 text-xs uppercase tracking-wider">Option 1: Chapters Only</p>
                <div className="font-mono text-xs bg-slate-50 p-2.5 rounded space-y-1">
                  <div className="text-blue-700 font-medium">Graph Algorithms</div>
                  <div className="text-blue-700 font-medium">Dynamic Programming</div>
                  <div className="text-blue-700 font-medium">Greedy Algorithms</div>
                  <div className="text-blue-700 font-medium">Backtracking</div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Just chapter names, one per line. No tabs.</p>
              </div>
              <div className="border border-slate-200 rounded-lg p-3">
                <p className="font-medium text-blue-700 mb-2 text-xs uppercase tracking-wider">Option 2: Chapters + Topics</p>
                <div className="font-mono text-xs bg-slate-50 p-2.5 rounded space-y-0.5">
                  <div className="text-blue-700 font-medium">Graph Algorithms</div>
                  <div className="text-slate-500 pl-5">BFS Traversal</div>
                  <div className="text-slate-500 pl-5">DFS Traversal</div>
                  <div className="text-blue-700 font-medium">Dynamic Programming</div>
                  <div className="text-slate-500 pl-5">Memoization</div>
                  <div className="text-slate-500 pl-5">Tabulation</div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Topics indented with 1 tab under their chapter.</p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
            <p className="font-semibold text-emerald-800 mb-1">You can also mix both</p>
            <div className="font-mono text-xs bg-white p-2.5 rounded border border-emerald-200 space-y-0.5">
              <div className="text-blue-700 font-medium">Graph Algorithms <span className="text-emerald-500 text-[10px] font-normal">(chapter with topics)</span></div>
              <div className="text-slate-500 pl-5">BFS Traversal</div>
              <div className="text-slate-500 pl-5">DFS Traversal</div>
              <div className="text-blue-700 font-medium">Greedy Algorithms <span className="text-emerald-500 text-[10px] font-normal">(chapter only, no topics)</span></div>
              <div className="text-blue-700 font-medium">Dynamic Programming <span className="text-emerald-500 text-[10px] font-normal">(chapter with topics)</span></div>
              <div className="text-slate-500 pl-5">Memoization</div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="font-semibold text-amber-800 mb-1">Important</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>Select the parent subject before importing</li>
              <li>Existing chapters are auto-detected and skipped</li>
              <li>New topics are added under existing or new chapters</li>
              <li>AI generates translations for all new items</li>
              <li>Safe to re-import — duplicates are skipped</li>
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
