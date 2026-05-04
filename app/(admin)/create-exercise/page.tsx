"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Check, X, Loader2, Sparkles, Globe,
  CheckCircle2, XCircle, ArrowLeft, Save, RotateCcw,
  Eye, ArrowUpDown, ArrowUp, ArrowDown, Search, AlertTriangle, ChevronRight,
  Code2, BarChart3, Paperclip, FileCode, ChevronDown
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { AssessmentViewDialog } from '@/components/ui/AssessmentViewDialog';
import { usePageSize } from '@/hooks/usePageSize';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { EmptyState } from '@/components/ui/EmptyState';

const CONTENT_TYPE_OPTIONS = [
  { value: 'html', label: 'HTML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'code', label: 'Code' },
  { value: 'mixed', label: 'Mixed' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

interface CoverageItem {
  language_id: number;
  language_name: string;
  language_code: string;
  has_translation: boolean;
}

interface ExerciseListItem {
  id: number;
  code: string;
  slug: string;
  assessment_type: string;
  assessment_scope: string;
  content_type: string;
  difficulty_level: string;
  points: number;
  display_order: number;
  is_active: boolean;
  english_title?: string;
  attachment_count: number;
  solution_count: number;
  translation_count?: number;
  total_languages?: number;
}

interface LangTab {
  id: number;
  name: string;
  code: string;
}

type SortField = 'display_order' | 'difficulty_level' | 'points' | 'is_active';

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CreateExercisePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Cascade filter state ──
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subTopics, setSubTopics] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [chapterId, setChapterId] = useState<number | ''>('');
  const [topicId, setTopicId] = useState<number | ''>('');
  const [subTopicId, setSubTopicId] = useState<number | ''>('');

  // ── Form state ──
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Assessment settings (language-independent)
  const [contentType, setContentType] = useState('html');
  const [difficultyLevel, setDifficultyLevel] = useState('medium');
  const [points, setPoints] = useState(1);
  const [dueDays, setDueDays] = useState<number | ''>(7);
  const [estimatedHours, setEstimatedHours] = useState<number | ''>(1);
  const [isMandatory, setIsMandatory] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<number | ''>('');
  const [isActive, setIsActive] = useState(true);

  // Translation fields (per language)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [techStack, setTechStack] = useState('');
  const [learningOutcomes, setLearningOutcomes] = useState('');

  // ── Translation coverage state ──
  const [translationCoverage, setTranslationCoverage] = useState<CoverageItem[]>([]);

  // ── Attachments & Solutions state ──
  const [attachments, setAttachments] = useState<any[]>([]);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [showSolutionForm, setShowSolutionForm] = useState(false);
  const [attachmentExpanded, setAttachmentExpanded] = useState(true);
  const [solutionExpanded, setSolutionExpanded] = useState(true);
  // ── View dialog state ──
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewingCode, setViewingCode] = useState('');
  // Attachment form
  const [attType, setAttType] = useState('coding_file');
  const [attFile, setAttFile] = useState<File | null>(null);
  const [attGithubUrl, setAttGithubUrl] = useState('');
  const [attFileName, setAttFileName] = useState('');
  const [attSaving, setAttSaving] = useState(false);
  // Solution form
  const [solType, setSolType] = useState('coding_file');
  const [solFile, setSolFile] = useState<File | null>(null);
  const [solGithubUrl, setSolGithubUrl] = useState('');
  const [solVideoUrl, setSolVideoUrl] = useState('');
  const [solZipUrl, setSolZipUrl] = useState('');
  const [solFileName, setSolFileName] = useState('');
  const [solSaving, setSolSaving] = useState(false);

  // ── Language tab state (edit mode) ──
  const [editLangId, setEditLangId] = useState<number>(7);
  const [allTranslations, setAllTranslations] = useState<any[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<LangTab[]>([]);
  const [savingTranslation, setSavingTranslation] = useState(false);

  // ── List state ──
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(20);

  // ── Search, filter, sort state ──
  const [searchText, setSearchText] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [filterContentType, setFilterContentType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // ── Trash tab state ──
  const [showTrash, setShowTrash] = useState(false);
  const [trashCount, setTrashCount] = useState(0);

  // ── Summary stats from table_summary ──
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);

  // ── Bulk selection ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── Loading state ──
  const [saving, setSaving] = useState(false);
  const [aiTranslating, setAiTranslating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // ── Search debounce ──
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounce(searchText);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchText]);

  // ── Load subjects on mount ──
  useEffect(() => {
    api.listSubjects('?limit=999&sort=display_order&order=asc').then((r: any) => {
      if (r.success) setSubjects(r.data || []);
    });
  }, []);

  // ── Cascade: Subject -> Chapters ──
  useEffect(() => {
    if (!subjectId) { setChapters([]); setChapterId(''); return; }
    setChapterId(''); setTopicId(''); setSubTopicId('');
    api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${subjectId}`).then((r: any) => {
      if (r.success) setChapters(r.data || []);
    });
  }, [subjectId]);

  // ── Cascade: Chapter -> Topics ──
  useEffect(() => {
    if (!chapterId) { setTopics([]); setTopicId(''); setSubTopicId(''); return; }
    setTopicId(''); setSubTopicId('');
    api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${chapterId}`).then((r: any) => {
      if (r.success) setTopics(r.data || []);
    });
  }, [chapterId]);

  // ── Cascade: Topic -> Sub-Topics ──
  useEffect(() => {
    if (!topicId) { setSubTopics([]); setSubTopicId(''); return; }
    setSubTopicId('');
    api.listSubTopics(`?limit=999&sort=display_order&order=asc&topic_id=${topicId}`).then((r: any) => {
      if (r.success) setSubTopics(r.data || []);
    });
  }, [topicId]);

  // ── Load summary stats ──
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.getTableSummary('assessments');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setSummary(res.data[0]);
        setTrashCount(res.data[0].is_deleted || 0);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Load summary on mount ──
  useEffect(() => {
    loadSummary();
  }, []);

  // ── Load exercises list when filters/sort/page change ──
  const loadExercises = useCallback(async () => {
    setListLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('assessment_type', 'exercise');
      qs.set('sort', sortField);
      qs.set('order', sortOrder);
      qs.set('limit', String(pageSize));
      qs.set('page', String(page));
      if (subTopicId) qs.set('sub_topic_id', String(subTopicId));
      if (showTrash) {
        qs.set('show_deleted', 'true');
      } else {
        if (filterContentType) qs.set('content_type', filterContentType);
        if (filterDifficulty) qs.set('difficulty_level', filterDifficulty);
        if (filterStatus) qs.set('is_active', filterStatus);
      }
      if (searchDebounce) qs.set('search', searchDebounce);

      const r = await api.listAssessments('?' + qs.toString());
      if (r.success) {
        setExercises(r.data || []);
        setTotalCount(r.pagination?.total || 0);
      }
    } finally {
      setListLoading(false);
    }
  }, [subTopicId, page, pageSize, sortField, sortOrder, showTrash, searchDebounce, filterContentType, filterDifficulty, filterStatus]);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  // ── Reset page when filters change ──
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [filterContentType, filterDifficulty, filterStatus, showTrash, searchDebounce, subTopicId, pageSize]);

  // ── Sort handler ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
      : <ArrowDown className="h-3.5 w-3.5 text-blue-600" />;
  };

  // ── Helper: convert JSON array to multi-line string ──
  const jsonArrayToLines = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.join('\n');
        return val;
      } catch {
        return val;
      }
    }
    if (Array.isArray(val)) return val.join('\n');
    return '';
  };

  // ── Helper: convert multi-line string to JSON array ──
  const linesToJsonArray = (val: string): string[] => {
    return val.split('\n').map(s => s.trim()).filter(Boolean);
  };

  // ── Load a specific language's data into the form fields ──
  const loadLanguageIntoForm = (langId: number, translations: any[]) => {
    const trans = translations.find((t: any) => t.language_id === langId);
    setTitle(trans?.title || '');
    setDescription(trans?.description || '');
    setInstructions(trans?.instructions || '');
    setHtmlContent(trans?.html_content || '');
    setTechStack(jsonArrayToLines(trans?.tech_stack));
    setLearningOutcomes(jsonArrayToLines(trans?.learning_outcomes));
  };

  // ── Switch language tab ──
  const handleLangTabSwitch = (langId: number) => {
    setEditLangId(langId);
    loadLanguageIntoForm(langId, allTranslations);
  };

  // ── Reset form ──
  const resetForm = () => {
    setMode('list');
    setEditingId(null);
    setContentType('html');
    setDifficultyLevel('medium');
    setPoints(1);
    setDueDays(7);
    setEstimatedHours(1);
    setIsMandatory(false);
    setDisplayOrder('');
    setIsActive(true);
    setTitle('');
    setDescription('');
    setInstructions('');
    setHtmlContent('');
    setTechStack('');
    setLearningOutcomes('');
    setTranslationCoverage([]);
    setEditLangId(7);
    setAllTranslations([]);
    setAvailableLanguages([]);
    setAttachments([]);
    setSolutions([]);
    setShowAttachmentForm(false);
    setShowSolutionForm(false);
  };

  // ── Start create mode ──
  const startCreate = () => {
    resetForm();
    setMode('create');
  };

  // ── Start edit mode ──
  const startEdit = async (id: number) => {
    try {
      const r = await api.getAssessmentFull(id);
      if (!r.success || !r.data) { toast.error('Failed to load exercise'); return; }
      const ex = r.data;
      setEditingId(id);
      setContentType(ex.content_type || 'html');
      setDifficultyLevel(ex.difficulty_level || 'medium');
      setPoints(ex.points || 1);
      setDueDays(ex.due_days ?? 7);
      setEstimatedHours(ex.estimated_hours ?? 1);
      setIsMandatory(ex.is_mandatory ?? false);
      setDisplayOrder(ex.display_order ?? '');
      setIsActive(ex.is_active ?? true);

      // Store all translations for language switching
      const translations = ex.translations || [];
      setAllTranslations(translations);

      // Build available languages from coverage
      const langs: LangTab[] = (ex.translation_coverage || []).map((c: any) => ({
        id: c.language_id,
        name: c.language_name,
        code: c.language_code,
      }));
      setAvailableLanguages(langs);
      setEditLangId(7); // start with English

      // Get English translation
      const engTrans = translations.find((t: any) => t.language_id === 7);
      setTitle(engTrans?.title || '');
      setDescription(engTrans?.description || '');
      setInstructions(engTrans?.instructions || '');
      setHtmlContent(engTrans?.html_content || '');
      setTechStack(jsonArrayToLines(engTrans?.tech_stack));
      setLearningOutcomes(jsonArrayToLines(engTrans?.learning_outcomes));

      // Translation coverage
      setTranslationCoverage(ex.translation_coverage || []);

      // Attachments & Solutions
      setAttachments(ex.attachments || []);
      setSolutions(ex.solutions || []);

      setMode('edit');
    } catch {
      toast.error('Failed to load exercise details');
    }
  };

  // ── Save translation for a non-English language ──
  const handleSaveTranslation = async () => {
    if (!editingId) return;
    if (!title.trim()) { toast.error('Title is required'); return; }

    setSavingTranslation(true);
    try {
      const payload: any = {
        language_id: editLangId,
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        html_content: htmlContent.trim() || null,
        tech_stack: linesToJsonArray(techStack),
        learning_outcomes: linesToJsonArray(learningOutcomes),
      };

      await api.updateAssessmentFull(editingId, payload);

      toast.success(`Translation saved for ${availableLanguages.find(l => l.id === editLangId)?.name || 'selected language'}!`);

      // Reload the full exercise to refresh allTranslations
      const r = await api.getAssessmentFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.translations || []);
        setTranslationCoverage(r.data.translation_coverage || []);
      }

      loadExercises();
    } catch (e: any) {
      toast.error(e.message || 'Error saving translation');
    } finally {
      setSavingTranslation(false);
    }
  };

  // ── Save exercise (English / create) ──
  const handleSave = async () => {
    // If we're editing in a non-English language, use the translation save path
    if (mode === 'edit' && editLangId !== 7) {
      return handleSaveTranslation();
    }

    if (!subTopicId && mode === 'create') { toast.error('Please select a sub-topic'); return; }
    if (!title.trim()) { toast.error('Title is required'); return; }

    setSaving(true);
    try {
      if (mode === 'create') {
        const payload = {
          assessment_type: 'exercise',
          assessment_scope: 'sub_topic',
          sub_topic_id: subTopicId || undefined,
          content_type: contentType,
          difficulty_level: difficultyLevel,
          points,
          due_days: dueDays === '' ? undefined : dueDays,
          estimated_hours: estimatedHours === '' ? undefined : estimatedHours,
          is_mandatory: isMandatory,
          display_order: displayOrder === '' ? undefined : displayOrder,
          is_active: isActive,
          title: title.trim(),
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          html_content: htmlContent.trim() || null,
          tech_stack: linesToJsonArray(techStack),
          learning_outcomes: linesToJsonArray(learningOutcomes),
        };

        const r = await api.createAssessmentFull(payload);
        if (r.success) {
          toast.success('Exercise created with English translation!');
          resetForm();
          loadExercises();
          loadSummary();
        } else {
          toast.error(r.message || 'Failed to create');
        }
      } else if (mode === 'edit' && editingId) {
        // Update assessment settings + English translation
        const payload: any = {
          content_type: contentType,
          difficulty_level: difficultyLevel,
          points,
          due_days: dueDays === '' ? undefined : dueDays,
          estimated_hours: estimatedHours === '' ? undefined : estimatedHours,
          is_mandatory: isMandatory,
          display_order: displayOrder === '' ? undefined : displayOrder,
          is_active: isActive,
          language_id: 7,
          title: title.trim(),
          description: description.trim() || null,
          instructions: instructions.trim() || null,
          html_content: htmlContent.trim() || null,
          tech_stack: linesToJsonArray(techStack),
          learning_outcomes: linesToJsonArray(learningOutcomes),
        };

        const r = await api.updateAssessmentFull(editingId, payload);
        if (r.success) {
          toast.success('Exercise updated!');
          resetForm();
          loadExercises();
          loadSummary();
        } else {
          toast.error(r.message || 'Failed to update');
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Error saving exercise');
    } finally {
      setSaving(false);
    }
  };

  // ── AI Translate ──
  const handleAiTranslate = async (exerciseId?: number) => {
    const exId = exerciseId || editingId;
    if (!exId) { toast.error('Save the exercise first, then translate'); return; }

    setAiTranslating(true);
    try {
      const r = await api.autoTranslateAssessment({ assessment_ids: [exId] });
      if (r.success) {
        toast.success('AI translations generated!');
        // Reload coverage and translations
        if (editingId) {
          const full = await api.getAssessmentFull(editingId);
          if (full.success) {
            setTranslationCoverage(full.data.translation_coverage || []);
            setAllTranslations(full.data.translations || []);
            // Reload current language into form
            loadLanguageIntoForm(editLangId, full.data.translations || []);
          }
        }
        loadExercises();
      } else {
        toast.error(r.message || 'AI translation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── AI Translate All (current page exercises) ──
  const handleAiTranslateAll = async () => {
    if (exercises.length === 0) { toast.error('No exercises to translate'); return; }
    setAiTranslating(true);
    try {
      let ok = 0;
      for (const ex of exercises) {
        const r = await api.autoTranslateAssessment({ assessment_ids: [ex.id] });
        if (r.success) ok++;
      }
      toast.success(`AI translations generated for ${ok} exercise(s)!`);
      loadExercises();
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── AI Translate Selected exercises ──
  const handleAiTranslateSelected = async () => {
    if (selectedIds.size === 0) { toast.error('Select exercises to translate'); return; }
    setAiTranslating(true);
    try {
      let ok = 0;
      for (const id of Array.from(selectedIds)) {
        const r = await api.autoTranslateAssessment({ assessment_ids: [id] });
        if (r.success) ok++;
      }
      toast.success(`AI translations generated for ${ok} exercise(s)!`);
      loadExercises();
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── Quick translate from list ──
  const handleQuickTranslate = async (exId: number) => {
    setAiTranslating(true);
    try {
      const r = await api.autoTranslateAssessment({ assessment_ids: [exId] });
      if (r.success) {
        toast.success('Translations generated!');
        loadExercises();
      } else {
        toast.error(r.message || 'Translation failed');
      }
    } catch {
      toast.error('Translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── Soft delete ──
  const handleSoftDelete = async (id: number) => {
    if (!window.confirm('Move this exercise to trash?')) return;
    setActionLoadingId(id);
    try {
      const r = await api.softDeleteAssessment(id);
      if (r.success) {
        toast.success('Exercise moved to trash');
        loadExercises();
        loadSummary();
      } else {
        toast.error(r.message || 'Failed to delete');
      }
    } catch (e: any) {
      toast.error(e.message || 'Delete error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Restore from trash ──
  const handleRestore = async (id: number) => {
    setActionLoadingId(id);
    try {
      const r = await api.restoreAssessment(id);
      if (r.success) {
        toast.success('Exercise restored');
        loadExercises();
        loadSummary();
      } else {
        toast.error(r.message || 'Failed to restore');
      }
    } catch (e: any) {
      toast.error(e.message || 'Restore error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Permanent delete ──
  const handlePermanentDelete = async (id: number) => {
    if (!window.confirm('PERMANENTLY delete this exercise? This cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? This action is irreversible.')) return;
    setActionLoadingId(id);
    try {
      const r = await api.deleteAssessment(id);
      if (r.success) {
        toast.success('Exercise permanently deleted');
        loadExercises();
        loadSummary();
      } else {
        toast.error(r.message || 'Failed to delete permanently');
      }
    } catch (e: any) {
      toast.error(e.message || 'Permanent delete error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Bulk selection helpers ──
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === exercises.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(exercises.map(ex => ex.id)));
    }
  };

  const handleBulkSoftDelete = async () => {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteAssessment(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    loadExercises(); loadSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  };

  const handleBulkRestore = async () => {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreAssessment(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    loadExercises(); loadSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  };

  const handleBulkPermanentDelete = async () => {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteAssessment(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    loadExercises(); loadSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  };

  // ── Delete a single language translation ──
  const handleDeleteTranslation = async (langId: number) => {
    if (langId === 7) return; // Never delete English
    if (!editingId) return;
    const langName = availableLanguages.find(l => l.id === langId)?.name || 'this language';
    if (!confirm(`Delete ${langName} translation for this exercise?`)) return;

    try {
      // Find the translation for this language and delete it
      const trans = allTranslations.find((t: any) => t.language_id === langId);
      if (trans?.id) {
        await api.permanentDeleteAssessmentTranslation(trans.id);
      }
      toast.success(`${langName} translation deleted`);
      // Reload exercise data
      const r = await api.getAssessmentFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.translations || []);
        setTranslationCoverage(r.data.translation_coverage || []);
      }
      // Switch back to English if we deleted the current language
      if (editLangId === langId) {
        setEditLangId(7);
        loadLanguageIntoForm(7, r?.data?.translations || allTranslations);
      }
    } catch (e: any) {
      toast.error(e.message || 'Error deleting translation');
    }
  };

  // ── Delete all translations except English ──
  const handleDeleteAllTranslations = async () => {
    if (!editingId) return;
    const nonEngLangs = translationCoverage.filter(c => c.language_id !== 7 && c.has_translation);
    if (nonEngLangs.length === 0) { toast.info('No non-English translations to delete'); return; }
    if (!confirm(`Delete ALL translations except English (${nonEngLangs.length} languages)? This cannot be undone.`)) return;

    try {
      for (const lang of nonEngLangs) {
        const trans = allTranslations.find((t: any) => t.language_id === lang.language_id);
        if (trans?.id) {
          await api.permanentDeleteAssessmentTranslation(trans.id);
        }
      }
      toast.success(`All non-English translations deleted (${nonEngLangs.length} languages)`);
      // Reload
      const r = await api.getAssessmentFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.translations || []);
        setTranslationCoverage(r.data.translation_coverage || []);
      }
      setEditLangId(7);
      loadLanguageIntoForm(7, r?.data?.translations || allTranslations);
    } catch (e: any) {
      toast.error(e.message || 'Error deleting translations');
    }
  };

  // ── Attachment handlers ──
  const handleCreateAttachment = async () => {
    if (!editingId) return;
    if (attType === 'github_link' && !attGithubUrl.trim()) { toast.error('GitHub URL is required'); return; }
    if (attType !== 'github_link' && !attFile) { toast.error('File is required'); return; }

    setAttSaving(true);
    try {
      const data: any = {
        assessment_id: editingId,
        attachment_type: attType,
      };
      if (attFileName.trim()) data.file_name = attFileName.trim();
      if (attGithubUrl.trim()) data.github_url = attGithubUrl.trim();

      const r = await api.createAssessmentAttachment(data, attFile || undefined);
      if (r.success) {
        toast.success('Attachment added!');
        // Reload attachments
        const full = await api.getAssessmentFull(editingId);
        if (full.success) setAttachments(full.data.attachments || []);
        // Reset form
        setShowAttachmentForm(false);
        setAttType('coding_file');
        setAttFile(null);
        setAttGithubUrl('');
        setAttFileName('');
      } else {
        toast.error(r.message || 'Failed to add attachment');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error adding attachment');
    } finally {
      setAttSaving(false);
    }
  };

  const handleDeleteAttachment = async (id: number) => {
    if (!window.confirm('Permanently delete this attachment?')) return;
    try {
      const r = await api.deleteAssessmentAttachment(id);
      if (r.success) {
        toast.success('Attachment deleted');
        setAttachments(prev => prev.filter(a => a.id !== id));
      } else {
        toast.error(r.message || 'Failed to delete attachment');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error deleting attachment');
    }
  };

  // ── Solution handlers ──
  const handleCreateSolution = async () => {
    if (!editingId) return;
    if (solType === 'github_link' && !solGithubUrl.trim()) { toast.error('GitHub URL is required'); return; }
    if (solType === 'video' && !solVideoUrl.trim()) { toast.error('Video URL is required'); return; }
    if (solType === 'zip' && !solZipUrl.trim() && !solFile) { toast.error('Zip URL or file is required'); return; }
    if (!['github_link', 'video', 'zip'].includes(solType) && !solFile) { toast.error('File is required'); return; }

    setSolSaving(true);
    try {
      const data: any = {
        assessment_id: editingId,
        solution_type: solType,
      };
      if (solFileName.trim()) data.file_name = solFileName.trim();
      if (solGithubUrl.trim()) data.github_url = solGithubUrl.trim();
      if (solVideoUrl.trim()) data.video_url = solVideoUrl.trim();
      if (solZipUrl.trim()) data.zip_url = solZipUrl.trim();

      const r = await api.createAssessmentSolution(data, solFile || undefined);
      if (r.success) {
        toast.success('Solution added!');
        // Reload solutions
        const full = await api.getAssessmentFull(editingId);
        if (full.success) setSolutions(full.data.solutions || []);
        // Reset form
        setShowSolutionForm(false);
        setSolType('coding_file');
        setSolFile(null);
        setSolGithubUrl('');
        setSolVideoUrl('');
        setSolZipUrl('');
        setSolFileName('');
      } else {
        toast.error(r.message || 'Failed to add solution');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error adding solution');
    } finally {
      setSolSaving(false);
    }
  };

  const handleDeleteSolution = async (id: number) => {
    if (!window.confirm('Permanently delete this solution?')) return;
    try {
      const r = await api.deleteAssessmentSolution(id);
      if (r.success) {
        toast.success('Solution deleted');
        setSolutions(prev => prev.filter(s => s.id !== id));
      } else {
        toast.error(r.message || 'Failed to delete solution');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error deleting solution');
    }
  };

  // ── Total language count from coverage ──
  const totalLangs = translationCoverage.length;
  const translatedLangs = translationCoverage.filter(c => c.has_translation).length;
  const missingLangs = totalLangs - translatedLangs;

  // ── Whether currently editing a non-English language ──
  const isNonEnglish = editLangId !== 7;

  // ── Pagination helpers ──
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // ── Translation count color helper ──
  const getTranslationColor = (count: number, total?: number) => {
    if (!total || total === 0) return count > 0 ? 'text-green-600' : 'text-red-500';
    if (count >= total) return 'text-green-600';
    if (count > 0) return 'text-amber-500';
    return 'text-red-500';
  };

  // ── Current language name for display ──
  const currentLangName = availableLanguages.find(l => l.id === editLangId)?.name || 'English';
  const currentLangCode = availableLanguages.find(l => l.id === editLangId)?.code || 'en';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Exercises"
        description="Create, manage, and translate exercise assessments with translations in one place"
        actions={
          mode === 'list' && !showTrash ? (
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleAiTranslateSelected} disabled={aiTranslating}>
                  {aiTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Translate ({selectedIds.size})
                </Button>
              )}
              {exercises.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleAiTranslateAll} disabled={aiTranslating}>
                  {aiTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Translate All
                </Button>
              )}
              <Button size="sm" onClick={startCreate}>
                <Plus className="h-4 w-4 mr-1" /> New Exercise
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ── Summary Stat Cards (compact, visible in list mode) ── */}
      {mode === 'list' && summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Exercises', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
          ].map(card => {
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
      {mode === 'list' && (
        <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
          <button
            onClick={() => setShowTrash(false)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
            )}
          >
            Exercises
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
            {trashCount > 0 && (
              <span className={cn(
                'ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
                showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
              )}>
                {trashCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Toolbar: search + cascade filters + content_type/difficulty/status filters */}
      {mode === 'list' && (
        <DataToolbar
          ref={toolbarRef}
          search={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder={showTrash ? 'Search trash...' : 'Search exercises...'}
        >
          {!showTrash && (
            <>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={subjectId} onChange={e => setSubjectId(e.target.value ? parseInt(e.target.value) : '')}>
                <option value="">All Subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.english_name || s.name || `Subject #${s.id}`}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={chapterId} onChange={e => setChapterId(e.target.value ? parseInt(e.target.value) : '')} disabled={!subjectId}>
                <option value="">All Chapters</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name || `Chapter #${c.id}`}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={topicId} onChange={e => setTopicId(e.target.value ? parseInt(e.target.value) : '')} disabled={!chapterId}>
                <option value="">All Topics</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name || `Topic #${t.id}`}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={subTopicId} onChange={e => setSubTopicId(e.target.value ? parseInt(e.target.value) : '')} disabled={!topicId}>
                <option value="">All Sub-Topics</option>
                {subTopics.map(st => <option key={st.id} value={st.id}>{st.display_order ? st.display_order + '. ' : ''}{st.english_name || st.name || `Sub-Topic #${st.id}`}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={filterContentType} onChange={e => setFilterContentType(e.target.value)}>
                <option value="">All Content Types</option>
                {CONTENT_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
                <option value="">All Difficulties</option>
                {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </>
          )}
        </DataToolbar>
      )}

      {/* Trash banner */}
      {mode === 'list' && showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {/* ── Content area ── */}
      {mode === 'list' ? (
        /* ── Exercises List ── */
        <div className="space-y-4">
          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : exercises.length === 0 ? (
            <EmptyState
              icon={showTrash ? Trash2 : FileCode}
              title={showTrash ? 'Trash is empty' : 'No exercises yet'}
              description={showTrash ? 'No deleted exercises' : (searchDebounce || filterContentType || filterDifficulty || filterStatus ? 'No exercises match your filters' : subTopicId ? 'Add your first exercise' : 'Select a subject, chapter, topic, and sub-topic to create exercises — or browse all exercises below')}
              action={!showTrash && !searchDebounce && !filterContentType && !filterDifficulty && !filterStatus && subTopicId ? <Button onClick={startCreate}><Plus className="w-4 h-4" /> Add exercise</Button> : undefined}
            />
          ) : (
            <div className={cn('bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
              {/* Bulk action toolbar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
                  <span className="text-sm font-medium text-brand-700">
                    {bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}
                  </span>
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
                    <TH className="w-10"><input type="checkbox" checked={exercises.length > 0 && selectedIds.size === exercises.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                    <TH className="w-12">
                      <button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        # <SortIcon field="display_order" />
                      </button>
                    </TH>
                    <TH>Title</TH>
                    <TH className="w-24">
                      <button onClick={() => handleSort('difficulty_level')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        Difficulty <SortIcon field="difficulty_level" />
                      </button>
                    </TH>
                    <TH className="w-20">
                      <button onClick={() => handleSort('points')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        Points <SortIcon field="points" />
                      </button>
                    </TH>
                    <TH className="w-24">Content Type</TH>
                    <TH className="w-20">Attach.</TH>
                    <TH className="w-20">Solutions</TH>
                    <TH className="w-28">Translations</TH>
                    <TH className="w-20">
                      <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        Active <SortIcon field="is_active" />
                      </button>
                    </TH>
                    <TH className="w-36 text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {exercises.map(ex => (
                    <TR key={ex.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(ex.id) && 'bg-brand-50/40')}>
                      <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(ex.id)} onChange={() => toggleSelect(ex.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                      <TD className="py-2.5 text-slate-500">{ex.display_order}</TD>
                      <TD className={cn('py-2.5 max-w-xs truncate', showTrash && 'text-slate-400 line-through')} title={ex.english_title || ex.code}>
                        {ex.english_title ? (ex.english_title.length > 60 ? ex.english_title.substring(0, 60) + '...' : ex.english_title) : ex.code || ex.slug}
                      </TD>
                      <TD className="py-2.5">
                        <Badge className={cn('text-xs', {
                          'bg-emerald-50 text-emerald-700': ex.difficulty_level === 'easy',
                          'bg-amber-50 text-amber-700': ex.difficulty_level === 'medium',
                          'bg-red-50 text-red-700': ex.difficulty_level === 'hard',
                        })}>
                          {ex.difficulty_level}
                        </Badge>
                      </TD>
                      <TD className="py-2.5 text-center">{ex.points}</TD>
                      <TD className="py-2.5">
                        <Badge className={cn('text-xs', {
                          'bg-blue-50 text-blue-700': ex.content_type === 'html',
                          'bg-violet-50 text-violet-700': ex.content_type === 'markdown',
                          'bg-teal-50 text-teal-700': ex.content_type === 'code',
                          'bg-orange-50 text-orange-700': ex.content_type === 'mixed',
                        })}>
                          {CONTENT_TYPE_OPTIONS.find(t => t.value === ex.content_type)?.label || ex.content_type}
                        </Badge>
                      </TD>
                      <TD className="py-2.5 text-center">
                        {ex.attachment_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Paperclip className="w-3 h-3" /> {ex.attachment_count}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">0</span>
                        )}
                      </TD>
                      <TD className="py-2.5 text-center">
                        {ex.solution_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <Code2 className="w-3 h-3" /> {ex.solution_count}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">0</span>
                        )}
                      </TD>
                      <TD className="py-2.5">
                        {!showTrash ? (
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-sm font-medium', getTranslationColor(ex.translation_count || 0, ex.total_languages))}>
                              {ex.translation_count || 0}/{ex.total_languages ?? '?'}
                            </span>
                            <button
                              onClick={() => handleQuickTranslate(ex.id)}
                              disabled={aiTranslating}
                              className={cn('ml-0.5', (ex.translation_count || 0) > 1 ? 'text-amber-500 hover:text-amber-700' : 'text-purple-500 hover:text-purple-700')}
                              title={(ex.translation_count || 0) > 1 ? 'Re-translate' : 'AI Translate'}
                            >
                              {(ex.translation_count || 0) > 1
                                ? <RotateCcw className="h-3.5 w-3.5" />
                                : <Sparkles className="h-3.5 w-3.5" />
                              }
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">--</span>
                        )}
                      </TD>
                      <TD className="py-2.5">
                        <Badge variant={ex.is_active ? 'success' : 'danger'}>
                          {ex.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TD>
                      <TD className="py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {showTrash ? (
                            <>
                              <button onClick={() => handleRestore(ex.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                                {actionLoadingId === ex.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => handlePermanentDelete(ex.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                                {actionLoadingId === ex.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setViewingId(ex.id); setViewingCode(ex.code); }} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => startEdit(ex.id)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleSoftDelete(ex.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete">
                                {actionLoadingId === ex.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                total={totalCount}
                showingCount={exercises.length}
              />
            </div>
          )}
        </div>
      ) : (
        /* ── Create / Edit Form ── */
        <div className="bg-white border rounded-lg">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h3 className="font-semibold text-gray-900">
                {mode === 'edit' ? 'Edit Exercise' : 'New Exercise'}
              </h3>
              {mode === 'edit' && isNonEnglish && (
                <Badge className="bg-blue-50 text-blue-700 text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  Editing: {currentLangName} ({currentLangCode})
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || savingTranslation}>
                {(saving || savingTranslation) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {mode === 'edit'
                  ? isNonEnglish
                    ? `Save ${currentLangName}`
                    : 'Update'
                  : 'Create'}
              </Button>
            </div>
          </div>

          {/* ── Sub-Topic selector (create mode) ── */}
          {mode === 'create' && (
            <div className="px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 mr-1">Sub-Topic:</span>
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={subjectId} onChange={e => setSubjectId(e.target.value ? parseInt(e.target.value) : '')}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.english_name || s.name || `Subject #${s.id}`}</option>)}
              </select>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={chapterId} onChange={e => setChapterId(e.target.value ? parseInt(e.target.value) : '')} disabled={!subjectId}>
                <option value="">Select Chapter</option>
                {chapters.map(c => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name || `Chapter #${c.id}`}</option>)}
              </select>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={topicId} onChange={e => setTopicId(e.target.value ? parseInt(e.target.value) : '')} disabled={!chapterId}>
                <option value="">Select Topic</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name || `Topic #${t.id}`}</option>)}
              </select>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={subTopicId} onChange={e => setSubTopicId(e.target.value ? parseInt(e.target.value) : '')} disabled={!topicId}>
                <option value="">Select Sub-Topic *</option>
                {subTopics.map(st => <option key={st.id} value={st.id}>{st.display_order ? st.display_order + '. ' : ''}{st.english_name || st.name || `Sub-Topic #${st.id}`}</option>)}
              </select>
            </div>
          )}

          {/* ── Language Tabs (edit mode only) ── */}
          {mode === 'edit' && availableLanguages.length > 0 && (
            <div className="px-6 pt-3 border-b bg-gray-50">
              <div className="flex gap-1 overflow-x-auto">
                {availableLanguages.map(lang => {
                  const coverage = translationCoverage.find(c => c.language_id === lang.id);
                  const hasTranslation = coverage?.has_translation;
                  return (
                    <button
                      key={lang.id}
                      onClick={() => handleLangTabSwitch(lang.id)}
                      className={cn(
                        'px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 transition-colors',
                        editLangId === lang.id
                          ? 'text-blue-600 border-blue-500 bg-white'
                          : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      {lang.id !== 7 && (
                        hasTranslation
                          ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                          : <XCircle className="h-3 w-3 text-gray-300" />
                      )}
                      {lang.name}
                      <span className="text-xs text-gray-400">({lang.code})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* ── Section 1: Assessment Settings (language-independent) ── */}
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-gray-500" />
                Assessment Settings
                {isNonEnglish && <span className="text-xs text-gray-400 font-normal">(read-only — edit in English)</span>}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content Type *</label>
                  <select
                    className={cn("w-full border rounded-md px-3 py-2 text-sm", isNonEnglish && "bg-gray-100 text-gray-500")}
                    value={contentType}
                    onChange={e => setContentType(e.target.value)}
                    disabled={isNonEnglish}
                  >
                    {CONTENT_TYPE_OPTIONS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    className={cn("w-full border rounded-md px-3 py-2 text-sm", isNonEnglish && "bg-gray-100 text-gray-500")}
                    value={difficultyLevel}
                    onChange={e => setDifficultyLevel(e.target.value)}
                    disabled={isNonEnglish}
                  >
                    {DIFFICULTY_OPTIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                  <Input
                    type="number"
                    min={1}
                    value={points}
                    onChange={e => setPoints(parseInt(e.target.value) || 1)}
                    disabled={isNonEnglish}
                    className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <Input
                    type="number"
                    min={0}
                    value={displayOrder}
                    onChange={e => setDisplayOrder(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="Auto"
                    disabled={isNonEnglish}
                    className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Days</label>
                  <Input
                    type="number"
                    min={1}
                    value={dueDays}
                    onChange={e => setDueDays(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="7"
                    disabled={isNonEnglish}
                    className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Hours</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={estimatedHours}
                    onChange={e => setEstimatedHours(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="1"
                    disabled={isNonEnglish}
                    className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                  />
                </div>
                <div className="flex items-end gap-4 pb-1 col-span-2">
                  <label className={cn("flex items-center gap-1.5 text-sm", isNonEnglish ? "text-gray-400 cursor-not-allowed" : "cursor-pointer")}>
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" disabled={isNonEnglish} />
                    Active
                  </label>
                  <label className={cn("flex items-center gap-1.5 text-sm", isNonEnglish ? "text-gray-400 cursor-not-allowed" : "cursor-pointer")}>
                    <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} className="rounded" disabled={isNonEnglish} />
                    Mandatory
                  </label>
                </div>
              </div>
            </div>

            {/* ── Section 2: Translation Fields (per language) ── */}
            <div className="border-t pt-5">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-500" />
                Translation Fields ({currentLangName})
              </h4>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title ({currentLangName}) *
                </label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={`Enter the exercise title in ${currentLangName}...`}
                />
              </div>

              {/* Description & Instructions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description ({currentLangName})</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder={`Optional description in ${currentLangName}...`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions ({currentLangName})</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder={`Optional instructions in ${currentLangName}...`}
                  />
                </div>
              </div>

              {/* HTML Content */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTML Content ({currentLangName})
                </label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[160px] font-mono text-xs"
                  value={htmlContent}
                  onChange={e => setHtmlContent(e.target.value)}
                  placeholder={`Enter HTML content in ${currentLangName}...`}
                />
              </div>

              {/* Tech Stack & Learning Outcomes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tech Stack ({currentLangName})
                    <span className="text-xs text-gray-400 ml-2">one item per line</span>
                  </label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                    value={techStack}
                    onChange={e => setTechStack(e.target.value)}
                    placeholder={`e.g.\nReact\nTypeScript\nNode.js`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Learning Outcomes ({currentLangName})
                    <span className="text-xs text-gray-400 ml-2">one item per line</span>
                  </label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                    value={learningOutcomes}
                    onChange={e => setLearningOutcomes(e.target.value)}
                    placeholder={`e.g.\nUnderstand state management\nBuild REST APIs\nWrite unit tests`}
                  />
                </div>
              </div>
            </div>

            {/* Translation Coverage (only in edit mode) */}
            {mode === 'edit' && translationCoverage.length > 0 && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Translation Coverage ({translatedLangs}/{totalLangs} languages)
                  </h4>
                  <div className="flex items-center gap-2">
                    {missingLangs > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAiTranslate()}
                        disabled={aiTranslating}
                      >
                        {aiTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1 text-purple-500" />}
                        AI Translate Remaining ({missingLangs})
                      </Button>
                    )}
                    {translatedLangs > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteAllTranslations}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete All Except English
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {translationCoverage.map(c => {
                    return (
                      <div key={c.language_id} className="flex items-center gap-0.5">
                        <Badge
                          className={cn('text-xs cursor-pointer hover:opacity-80 transition-opacity', {
                            'bg-green-100 text-green-700': c.has_translation,
                            'bg-red-50 text-red-600': !c.has_translation,
                            'ring-2 ring-blue-400 ring-offset-1': c.language_id === editLangId,
                          })}
                          onClick={() => handleLangTabSwitch(c.language_id)}
                        >
                          {c.has_translation ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {c.language_name}
                        </Badge>
                        {c.language_id !== 7 && c.has_translation && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteTranslation(c.language_id); }}
                            className="p-0.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title={`Delete ${c.language_name} translation`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {translatedLangs === totalLangs && totalLangs > 0 && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> All languages translated!
                  </p>
                )}
              </div>
            )}

            {/* ── Attachments Panel (edit mode only) ── */}
            {mode === 'edit' && editingId && (
              <div className="border rounded-lg bg-gray-50">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setAttachmentExpanded(!attachmentExpanded)}
                >
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-gray-500" />
                    Attachments ({attachments.length})
                  </h4>
                  <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", attachmentExpanded && "rotate-180")} />
                </button>
                {attachmentExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Existing attachments list */}
                    {attachments.length > 0 ? (
                      <div className="space-y-2">
                        {attachments.map((att: any) => (
                          <div key={att.id} className="flex items-center justify-between bg-white border rounded px-3 py-2 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge className="text-xs shrink-0">{att.attachment_type || 'file'}</Badge>
                              {att.file_url ? (
                                <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                  {att.file_name || 'Unnamed'}
                                </a>
                              ) : (
                                <span className="text-gray-700 truncate">{att.file_name || 'Unnamed'}</span>
                              )}
                              <span className="text-xs text-gray-400 shrink-0">{formatBytes(att.file_size)}</span>
                              {att.github_url && (
                                <a href={att.github_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline shrink-0">
                                  GitHub
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                              title="Delete attachment"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No attachments yet.</p>
                    )}

                    {/* Add Attachment form */}
                    {showAttachmentForm ? (
                      <div className="border rounded p-3 bg-white space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                            <select
                              className="w-full border rounded px-2 py-1.5 text-sm"
                              value={attType}
                              onChange={e => setAttType(e.target.value)}
                            >
                              <option value="coding_file">Coding File</option>
                              <option value="github_link">GitHub Link</option>
                              <option value="pdf">PDF</option>
                              <option value="image">Image</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">File Name</label>
                            <Input
                              value={attFileName}
                              onChange={e => setAttFileName(e.target.value)}
                              placeholder="Auto from file if empty"
                              className="text-sm"
                            />
                          </div>
                        </div>
                        {attType === 'github_link' ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">GitHub URL *</label>
                            <Input
                              value={attGithubUrl}
                              onChange={e => setAttGithubUrl(e.target.value)}
                              placeholder="https://github.com/..."
                              className="text-sm"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">File *</label>
                            <input
                              type="file"
                              className="w-full text-sm"
                              onChange={e => {
                                const f = e.target.files?.[0] || null;
                                setAttFile(f);
                                if (f && !attFileName) setAttFileName(f.name);
                              }}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <Button size="sm" onClick={handleCreateAttachment} disabled={attSaving}>
                            {attSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setShowAttachmentForm(false);
                            setAttType('coding_file');
                            setAttFile(null);
                            setAttGithubUrl('');
                            setAttFileName('');
                          }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setShowAttachmentForm(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Attachment
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── Solutions Panel (edit mode only) ── */}
            {mode === 'edit' && editingId && (
              <div className="border rounded-lg bg-gray-50">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                  onClick={() => setSolutionExpanded(!solutionExpanded)}
                >
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-gray-500" />
                    Solutions ({solutions.length})
                  </h4>
                  <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", solutionExpanded && "rotate-180")} />
                </button>
                {solutionExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Existing solutions list */}
                    {solutions.length > 0 ? (
                      <div className="space-y-2">
                        {solutions.map((sol: any) => (
                          <div key={sol.id} className="flex items-center justify-between bg-white border rounded px-3 py-2 text-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <Badge className="text-xs shrink-0">{sol.solution_type || 'file'}</Badge>
                              {sol.file_url ? (
                                <a href={sol.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                                  {sol.file_name || 'Unnamed'}
                                </a>
                              ) : (
                                <span className="text-gray-700 truncate">{sol.file_name || 'Unnamed'}</span>
                              )}
                              {sol.github_url && (
                                <a href={sol.github_url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-600 hover:underline shrink-0">
                                  GitHub
                                </a>
                              )}
                              {sol.video_url && (
                                <a href={sol.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">
                                  Video
                                </a>
                              )}
                              {sol.zip_url && (
                                <a href={sol.zip_url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline shrink-0">
                                  ZIP
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteSolution(sol.id)}
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0"
                              title="Delete solution"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No solutions yet.</p>
                    )}

                    {/* Add Solution form */}
                    {showSolutionForm ? (
                      <div className="border rounded p-3 bg-white space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                            <select
                              className="w-full border rounded px-2 py-1.5 text-sm"
                              value={solType}
                              onChange={e => setSolType(e.target.value)}
                            >
                              <option value="html">HTML</option>
                              <option value="coding_file">Coding File</option>
                              <option value="github_link">GitHub Link</option>
                              <option value="pdf">PDF</option>
                              <option value="image">Image</option>
                              <option value="video">Video</option>
                              <option value="zip">ZIP</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">File Name</label>
                            <Input
                              value={solFileName}
                              onChange={e => setSolFileName(e.target.value)}
                              placeholder="Auto from file if empty"
                              className="text-sm"
                            />
                          </div>
                        </div>
                        {solType === 'github_link' ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">GitHub URL *</label>
                            <Input
                              value={solGithubUrl}
                              onChange={e => setSolGithubUrl(e.target.value)}
                              placeholder="https://github.com/..."
                              className="text-sm"
                            />
                          </div>
                        ) : solType === 'video' ? (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Video URL *</label>
                            <Input
                              value={solVideoUrl}
                              onChange={e => setSolVideoUrl(e.target.value)}
                              placeholder="https://..."
                              className="text-sm"
                            />
                          </div>
                        ) : solType === 'zip' ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">ZIP URL (or upload file below)</label>
                              <Input
                                value={solZipUrl}
                                onChange={e => setSolZipUrl(e.target.value)}
                                placeholder="https://... (optional if uploading file)"
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">File (optional if URL provided)</label>
                              <input
                                type="file"
                                className="w-full text-sm"
                                onChange={e => {
                                  const f = e.target.files?.[0] || null;
                                  setSolFile(f);
                                  if (f && !solFileName) setSolFileName(f.name);
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">File *</label>
                            <input
                              type="file"
                              className="w-full text-sm"
                              onChange={e => {
                                const f = e.target.files?.[0] || null;
                                setSolFile(f);
                                if (f && !solFileName) setSolFileName(f.name);
                              }}
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <Button size="sm" onClick={handleCreateSolution} disabled={solSaving}>
                            {solSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                            Save
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => {
                            setShowSolutionForm(false);
                            setSolType('coding_file');
                            setSolFile(null);
                            setSolGithubUrl('');
                            setSolVideoUrl('');
                            setSolZipUrl('');
                            setSolFileName('');
                          }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setShowSolutionForm(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Solution
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* AI Translating overlay */}
      {aiTranslating && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            <span className="text-gray-700 font-medium">Generating AI translations...</span>
          </div>
        </div>
      )}

      {/* Assessment View Dialog */}
      <AssessmentViewDialog
        open={viewingId !== null}
        onClose={() => setViewingId(null)}
        assessmentType="exercise"
        assessmentId={viewingId}
        assessmentCode={viewingCode}
      />
    </div>
  );
}
