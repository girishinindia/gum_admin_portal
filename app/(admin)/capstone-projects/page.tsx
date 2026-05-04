"use client";
import { useEffect, useState, useRef } from 'react';
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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, FileQuestion, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, X, Sparkles } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';

interface Assessment {
  id: number;
  assessment_type: string;
  assessment_scope: string;
  course_id: number | null;
  english_title?: string;
  title?: string;
  content_type: string;
  difficulty_level: string;
  points: number;
  estimated_hours: number | null;
  due_days: number | null;
  is_mandatory: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  course?: { id: number; slug: string; english_title?: string } | null;
}

interface Course { id: number; slug: string; english_title?: string }

const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard'];
const CONTENT_TYPES = ['coding', 'github', 'pdf', 'image', 'mixed'];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'emerald',
  medium: 'blue',
  hard: 'red',
};

type SortField = 'id' | 'english_title' | 'difficulty_level' | 'points' | 'display_order' | 'is_active';

export default function CapstoneProjectsPage() {
  const [items, setItems] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [viewing, setViewing] = useState<Assessment | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Toolbar filters
  const [filterCourse, setFilterCourse] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('');

  // Courses data
  const [courses, setCourses] = useState<Course[]>([]);

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // AI Generate state
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const aiAbortRef = useRef<AbortController | null>(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm();
  const toolbarRef = useRef<DataToolbarHandle>(null);

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
  ]);

  // Load courses on mount
  useEffect(() => {
    api.listCourses('?limit=200&is_active=true').then(res => { if (res.success) setCourses(res.data || []); });
    loadSummary();
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [searchDebounce, filterCourse, filterStatus, filterDifficulty, pageSize, showTrash]);

  // Load data
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterCourse, filterStatus, filterDifficulty, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('assessment_type', 'capstone_project');
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    qs.set('sort', sortField);
    qs.set('ascending', sortOrder === 'asc' ? 'true' : 'false');
    if (searchDebounce) qs.set('search', searchDebounce);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterCourse) qs.set('course_id', filterCourse);
      if (filterStatus) qs.set('is_active', filterStatus);
      if (filterDifficulty) qs.set('difficulty_level', filterDifficulty);
    }
    const res = await api.listAssessments('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function loadSummary() {
    const res: any = await api.listAssessments('?assessment_type=capstone_project&summary=true');
    if (res.success && res.summary) {
      setSummary(res.summary);
    } else if (res.success && res.data) {
      // Fallback: compute from full list if summary not available
      const all = res.data || [];
      setSummary({
        is_active: all.filter((a: Assessment) => a.is_active && !a.deleted_at).length,
        is_inactive: all.filter((a: Assessment) => !a.is_active && !a.deleted_at).length,
        is_deleted: all.filter((a: Assessment) => !!a.deleted_at).length,
        total: all.length,
      });
    }
  }

  async function handleAiGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const provider = formData.get('provider') as string;
    const num = Number(formData.get('num_assessments')) || 0;
    const difficulty = formData.get('difficulty_mix') as string;
    const autoTranslate = formData.get('auto_translate') === 'on';

    setAiGenerating(true);
    setAiResult(null);
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      const res = await api.autoGenerateAssessment({
        assessment_type: 'capstone_project',
        scope_id: Number(filterCourse),
        num_assessments: num || undefined,
        difficulty_mix: difficulty === 'auto' ? undefined : difficulty,
        provider,
        auto_translate: autoTranslate,
      }, controller.signal);
      if (res.success) {
        const count = res.data?.length || (res as any).count || 0;
        setAiResult({ success: true, count });
        toast.success(`AI generated ${count} capstone project(s)`);
        load();
        loadSummary();
      } else {
        setAiResult({ success: false, error: res.error || 'Generation failed' });
        toast.error(res.error || 'AI generation failed');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setAiResult({ success: false, error: err.message || 'Generation failed' });
        toast.error(err.message || 'AI generation failed');
      }
    } finally {
      setAiGenerating(false);
      aiAbortRef.current = null;
    }
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
    reset({
      course_id: '',
      content_type: 'coding',
      difficulty_level: 'medium',
      points: 10,
      estimated_hours: '',
      due_days: '',
      is_mandatory: true,
      is_active: true,
      display_order: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(item: Assessment) {
    setEditing(item);
    setDialogKey(k => k + 1);
    reset({
      course_id: item.course_id ? String(item.course_id) : '',
      content_type: item.content_type || 'coding',
      difficulty_level: item.difficulty_level || 'medium',
      points: item.points || 10,
      estimated_hours: item.estimated_hours || '',
      due_days: item.due_days || '',
      is_mandatory: item.is_mandatory ?? true,
      is_active: item.is_active ?? true,
      display_order: item.display_order || 0,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {
      assessment_type: 'capstone_project',
      assessment_scope: 'course',
      course_id: data.course_id ? Number(data.course_id) : null,
      content_type: data.content_type,
      difficulty_level: data.difficulty_level,
      points: Number(data.points) || 0,
      estimated_hours: data.estimated_hours ? Number(data.estimated_hours) : null,
      due_days: data.due_days ? Number(data.due_days) : null,
      is_mandatory: !!data.is_mandatory,
      is_active: !!data.is_active,
      display_order: Number(data.display_order) || 0,
    };

    const res = editing
      ? await api.updateAssessment(editing.id, payload)
      : await api.createAssessment(payload);

    if (res.success) {
      toast.success(editing ? 'Capstone project updated' : 'Capstone project created');
      setDialogOpen(false);
      load();
      loadSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onSoftDelete(item: Assessment) {
    const title = item.english_title || item.title || `#${item.id}`;
    if (!confirm(`Move "${title}" to trash?`)) return;
    setActionLoadingId(item.id);
    const res = await api.softDeleteAssessment(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Capstone project moved to trash'); load(); loadSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: Assessment) {
    setActionLoadingId(item.id);
    const res = await api.restoreAssessment(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Capstone project restored'); load(); loadSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: Assessment) {
    const title = item.english_title || item.title || `#${item.id}`;
    if (!confirm(`PERMANENTLY delete "${title}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteAssessment(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Capstone project permanently deleted'); load(); loadSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function getDifficultyBadgeVariant(level: string): string {
    const map: Record<string, string> = {
      beginner: 'emerald',
      intermediate: 'blue',
      advanced: 'orange',
      expert: 'red',
      all_levels: 'slate',
    };
    return map[level] || 'slate';
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Capstone Projects"
        description="Manage capstone project assessments"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && (
              <>
                <button
                  onClick={() => { setAiResult(null); setShowAiDialog(true); }}
                  disabled={!filterCourse}
                  title={filterCourse ? 'AI Generate Capstone Projects' : 'Select a course first'}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    filterCourse
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-violet-200 text-violet-400 cursor-not-allowed'
                  )}
                >
                  <Sparkles className="w-4 h-4" /> AI Generate
                </button>
                <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Capstone Project</Button>
              </>
            )}
          </div>
        }
      />

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
            { label: 'Total', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      {/* Trash Toggle Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Capstone Projects
        </button>
        <button onClick={() => setShowTrash(true)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>}
        </button>
      </div>

      {/* Toolbar with filters */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search capstone projects...'}>
        {!showTrash && (
          <>
            <SearchableSelect
              options={courses.map(c => ({ value: String(c.id), label: c.english_title || c.slug || '' }))}
              value={filterCourse}
              onChange={setFilterCourse}
              placeholder="All courses"
              searchPlaceholder="Search courses..."
            />
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

      {/* Data Table */}
      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : FileQuestion} title={showTrash ? 'Trash is empty' : 'No capstone projects yet'}
          description={showTrash ? 'No deleted capstone projects' : (searchDebounce || filterCourse || filterStatus || filterDifficulty ? 'No capstone projects match your filters' : 'Add your first capstone project')}
          action={!showTrash && !searchDebounce && !filterCourse && !filterStatus && !filterDifficulty ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Capstone Project</Button> : undefined} />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH><button onClick={() => handleSort('english_title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Title <SortIcon field="english_title" /></button></TH>
                <TH>Course</TH>
                <TH><button onClick={() => handleSort('difficulty_level')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Difficulty <SortIcon field="difficulty_level" /></button></TH>
                <TH><button onClick={() => handleSort('points')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Points <SortIcon field="points" /></button></TH>
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(item => (
                <TR key={item.id} className={showTrash ? 'bg-amber-50/30' : undefined}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                  <TD className="py-2.5">
                    <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>
                      {item.english_title || item.title || `Capstone Project #${item.id}`}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-600">
                      {item.course?.english_title || item.course?.slug || (item.course_id ? `ID: ${item.course_id}` : '—')}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <Badge variant={getDifficultyBadgeVariant(item.difficulty_level) as any}>
                      {item.difficulty_level?.replace('_', ' ') || '—'}
                    </Badge>
                  </TD>
                  <TD className="py-2.5"><span className="text-sm font-medium text-slate-700">{item.points}</span></TD>
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '—'}</span></TD>}
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                          <button onClick={() => onPermanentDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setViewing(item)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
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
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Capstone Project Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.english_title || viewing.title || `Capstone Project #${viewing.id}`}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={getDifficultyBadgeVariant(viewing.difficulty_level) as any}>{viewing.difficulty_level?.replace('_', ' ')}</Badge>
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Course" value={viewing.course?.english_title || viewing.course?.slug || (viewing.course_id ? `ID: ${viewing.course_id}` : undefined)} />
              <DetailRow label="Content Type" value={viewing.content_type} />
              <DetailRow label="Difficulty" value={viewing.difficulty_level?.replace('_', ' ')} />
              <DetailRow label="Points" value={String(viewing.points)} />
              <DetailRow label="Estimated Hours" value={viewing.estimated_hours ? String(viewing.estimated_hours) : undefined} />
              <DetailRow label="Due Days" value={viewing.due_days ? String(viewing.due_days) : undefined} />
              <DetailRow label="Mandatory" value={viewing.is_mandatory ? 'Yes' : 'No'} />
              <DetailRow label="Display Order" value={String(viewing.display_order)} />
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

      {/* AI Generate Dialog */}
      {showAiDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
                <h3 className="text-lg font-semibold text-slate-900">AI Generate Capstone Projects</h3>
              </div>
              <button onClick={() => { setShowAiDialog(false); if (aiAbortRef.current) aiAbortRef.current.abort(); }} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAiGenerate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">AI Provider</label>
                <select name="provider" defaultValue="gemini" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="gemini">Gemini</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Number of Capstone Projects <span className="text-slate-400 font-normal">(0 = AI decides)</span></label>
                <input name="num_assessments" type="number" min="0" max="50" defaultValue="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty</label>
                <select name="difficulty_mix" defaultValue="auto" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="auto">Auto (AI decides)</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input name="auto_translate" type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                <span className="text-sm font-medium text-slate-700">Auto-translate to all languages</span>
              </label>
              {aiResult && (
                <div className={cn('px-3 py-2 rounded-lg text-sm', aiResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
                  {aiResult.success ? `Successfully generated ${aiResult.count} capstone project(s)!` : aiResult.error}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAiDialog(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={aiGenerating} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50">
                  {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Capstone Project' : 'Add Capstone Project'} size="md">
        <form key={dialogKey} onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Course selector */}
          <SearchableSelect
            label="Course *"
            options={courses.map(c => ({ value: String(c.id), label: c.english_title || c.slug || '' }))}
            value={watch('course_id') || ''}
            onChange={(val) => setValue('course_id', val)}
            placeholder="Select a course"
            searchPlaceholder="Search courses..."
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content Type</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('content_type')}>
                {CONTENT_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty Level</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500" {...register('difficulty_level')}>
                {DIFFICULTY_LEVELS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="Points" type="number" {...register('points')} />
            <Input label="Est. Hours" type="number" step="0.5" placeholder="Optional" {...register('estimated_hours')} />
            <Input label="Due Days" type="number" placeholder="Optional" {...register('due_days')} />
          </div>

          <Input label="Display Order" type="number" {...register('display_order')} />

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_mandatory')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm font-medium text-slate-700">Mandatory</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
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

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
