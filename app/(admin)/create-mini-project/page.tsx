"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
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
  Eye, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, ChevronRight,
  Briefcase, BarChart3, Paperclip, FileCode, ChevronDown
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { AssessmentViewDialog } from '@/components/ui/AssessmentViewDialog';

// ── Constants ──

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'coding', label: 'Coding' },
  { value: 'github', label: 'GitHub' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
  { value: 'mixed', label: 'Mixed' },
];

// ── Interfaces ──

interface AssessmentListItem {
  id: number;
  code: string;
  assessment_type: string;
  assessment_scope: string;
  chapter_id: number | null;
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
  translation_count?: number;
  total_languages?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  chapter?: { id: number; slug?: string; english_name?: string } | null;
}

interface CoverageItem {
  language_id: number;
  language_name: string;
  language_code: string;
  has_translation: boolean;
}

interface LangTab {
  id: number;
  name: string;
  code: string;
}

type SortField = 'id' | 'display_order' | 'difficulty_level' | 'points' | 'is_active';

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ──

export default function CreateMiniProjectPage() {
  // ── Cascade filter state ──
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [chapterId, setChapterId] = useState<number | ''>('');

  // ── Form state ──
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Assessment settings (language-independent)
  const [contentType, setContentType] = useState('coding');
  const [difficultyLevel, setDifficultyLevel] = useState('medium');
  const [points, setPoints] = useState(10);
  const [dueDays, setDueDays] = useState<number | ''>('');
  const [estimatedHours, setEstimatedHours] = useState<number | ''>('');
  const [isMandatory, setIsMandatory] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number | ''>(0);

  // Translation fields (language-dependent)
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

  // ── View dialog state ──
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewingCode, setViewingCode] = useState('');

  // ── Language tab state (edit mode) ──
  const [editLangId, setEditLangId] = useState<number>(7);
  const [allTranslations, setAllTranslations] = useState<any[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<LangTab[]>([]);
  const [savingTranslation, setSavingTranslation] = useState(false);

  // ── List state ──
  const [items, setItems] = useState<AssessmentListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(20);

  // ── Search, filter, sort state ──
  const [searchText, setSearchText] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // ── Trash tab state ──
  const [showTrash, setShowTrash] = useState(false);
  const [trashCount, setTrashCount] = useState(0);

  // ── Summary stats ──
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
    setChapterId('');
    api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${subjectId}`).then((r: any) => {
      if (r.success) setChapters(r.data || []);
    });
  }, [subjectId]);

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

  // ── Load assessments list when filters/sort/page change ──
  const loadItems = useCallback(async () => {
    setListLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('assessment_type', 'mini_project');
      qs.set('sort', sortField);
      qs.set('ascending', sortOrder === 'asc' ? 'true' : 'false');
      qs.set('limit', String(pageSize));
      qs.set('page', String(page));
      if (chapterId) qs.set('chapter_id', String(chapterId));
      if (showTrash) {
        qs.set('show_deleted', 'true');
      } else {
        if (filterDifficulty) qs.set('difficulty_level', filterDifficulty);
        if (filterStatus) qs.set('is_active', filterStatus);
      }
      if (searchDebounce) qs.set('search', searchDebounce);

      const r = await api.listAssessments('?' + qs.toString());
      if (r.success) {
        setItems(r.data || []);
        setTotalCount(r.pagination?.total || 0);
      }
    } finally {
      setListLoading(false);
    }
  }, [chapterId, page, pageSize, sortField, sortOrder, showTrash, searchDebounce, filterDifficulty, filterStatus]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // ── Reset page when filters change ──
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [filterDifficulty, filterStatus, showTrash, searchDebounce, chapterId, pageSize]);

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
      ? <ArrowUp className="h-3.5 w-3.5 text-amber-600" />
      : <ArrowDown className="h-3.5 w-3.5 text-amber-600" />;
  };

  // ── Load a specific language's data into the form fields ──
  const loadLanguageIntoForm = (langId: number, translations: any[]) => {
    const trans = translations.find((t: any) => t.language_id === langId);
    setTitle(trans?.title || '');
    setDescription(trans?.description || '');
    setInstructions(trans?.instructions || '');
    setHtmlContent(trans?.html_content || '');
    setTechStack(trans?.tech_stack || '');
    setLearningOutcomes(trans?.learning_outcomes || '');
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
    setContentType('coding');
    setDifficultyLevel('medium');
    setPoints(10);
    setDueDays('');
    setEstimatedHours('');
    setIsMandatory(true);
    setIsActive(true);
    setDisplayOrder(0);
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
      if (!r.success || !r.data) { toast.error('Failed to load mini project'); return; }
      const a = r.data;
      setEditingId(id);
      setContentType(a.content_type || 'coding');
      setDifficultyLevel(a.difficulty_level || 'medium');
      setPoints(a.points || 10);
      setDueDays(a.due_days ?? '');
      setEstimatedHours(a.estimated_hours ?? '');
      setIsMandatory(a.is_mandatory ?? true);
      setIsActive(a.is_active ?? true);
      setDisplayOrder(a.display_order ?? 0);

      // Store all translations for language switching
      const translations = a.translations || [];
      setAllTranslations(translations);

      // Build available languages from coverage
      const langs: LangTab[] = (a.translation_coverage || []).map((c: any) => ({
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
      setTechStack(engTrans?.tech_stack || '');
      setLearningOutcomes(engTrans?.learning_outcomes || '');

      // Translation coverage
      setTranslationCoverage(a.translation_coverage || []);

      // Attachments & Solutions
      setAttachments(a.attachments || []);
      setSolutions(a.solutions || []);

      setMode('edit');
    } catch {
      toast.error('Failed to load mini project details');
    }
  };

  // ── Save translation for a non-English language ──
  const handleSaveTranslation = async () => {
    if (!editingId) return;
    if (!title.trim()) { toast.error('Title is required'); return; }

    setSavingTranslation(true);
    try {
      await api.updateAssessmentFull(editingId, {
        language_id: editLangId,
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        html_content: htmlContent.trim() || null,
        tech_stack: techStack.trim() || null,
        learning_outcomes: learningOutcomes.trim() || null,
      });

      toast.success(`Translation saved for ${availableLanguages.find(l => l.id === editLangId)?.name || 'selected language'}!`);

      // Reload the full assessment to refresh translations
      const r = await api.getAssessmentFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.translations || []);
        setTranslationCoverage(r.data.translation_coverage || []);
      }

      loadItems();
    } catch (e: any) {
      toast.error(e.message || 'Error saving translation');
    } finally {
      setSavingTranslation(false);
    }
  };

  // ── Save assessment (English / create) ──
  const handleSave = async () => {
    // If we're editing in a non-English language, use the translation save path
    if (mode === 'edit' && editLangId !== 7) {
      return handleSaveTranslation();
    }

    if (!chapterId && mode === 'create') { toast.error('Please select a chapter'); return; }
    if (!title.trim()) { toast.error('Title is required'); return; }

    setSaving(true);
    try {
      const payload: any = {
        assessment_type: 'mini_project',
        assessment_scope: 'chapter',
        chapter_id: chapterId || undefined,
        content_type: contentType,
        difficulty_level: difficultyLevel,
        points,
        due_days: dueDays === '' ? null : dueDays,
        estimated_hours: estimatedHours === '' ? null : estimatedHours,
        is_mandatory: isMandatory,
        is_active: isActive,
        display_order: displayOrder === '' ? 0 : displayOrder,
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim() || null,
        html_content: htmlContent.trim() || null,
        tech_stack: techStack.trim() || null,
        learning_outcomes: learningOutcomes.trim() || null,
      };

      let r;
      if (mode === 'edit' && editingId) {
        r = await api.updateAssessmentFull(editingId, { ...payload, language_id: 7 });
      } else {
        r = await api.createAssessmentFull(payload);
      }

      if (r.success) {
        toast.success(mode === 'edit' ? 'Mini project updated!' : 'Mini project created with English translation!');
        resetForm();
        loadItems();
        loadSummary();
      } else {
        toast.error((r as any).message || 'Failed to save');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error saving mini project');
    } finally {
      setSaving(false);
    }
  };

  // ── AI Translate ──
  const handleAiTranslate = async (assessmentId?: number) => {
    const aId = assessmentId || editingId;
    if (!aId) { toast.error('Save the mini project first, then translate'); return; }

    setAiTranslating(true);
    try {
      const r = await api.autoTranslateAssessment({ assessment_ids: [aId] });
      if (r.success) {
        toast.success('AI translations generated!');
        // Reload coverage and translations
        if (editingId) {
          const full = await api.getAssessmentFull(editingId);
          if (full.success) {
            setTranslationCoverage(full.data.translation_coverage || []);
            setAllTranslations(full.data.translations || []);
            loadLanguageIntoForm(editLangId, full.data.translations || []);
          }
        }
        loadItems();
      } else {
        toast.error((r as any).message || 'AI translation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── AI Translate All (chapter-based if chapter selected, otherwise current page IDs) ──
  const handleAiTranslateAll = async () => {
    if (items.length === 0) { toast.error('No mini projects to translate'); return; }
    setAiTranslating(true);
    try {
      const payload = chapterId
        ? { scope_id: chapterId as number, assessment_type: 'mini_project' as const }
        : { assessment_ids: items.map(i => i.id) };
      const r = await api.autoTranslateAssessment(payload);
      if (r.success) {
        toast.success(chapterId ? 'AI translations generated for all mini projects in this chapter!' : `AI translations generated for ${items.length} mini project(s)!`);
        loadItems();
      } else {
        toast.error((r as any).message || 'AI translation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── AI Translate Selected ──
  const handleAiTranslateSelected = async () => {
    if (selectedIds.size === 0) { toast.error('Select mini projects to translate'); return; }
    setAiTranslating(true);
    try {
      const r = await api.autoTranslateAssessment({ assessment_ids: Array.from(selectedIds) });
      if (r.success) {
        toast.success(`AI translations generated for ${selectedIds.size} mini project(s)!`);
        loadItems();
        setSelectedIds(new Set());
      } else {
        toast.error((r as any).message || 'AI translation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── Quick translate from list ──
  const handleQuickTranslate = async (aId: number) => {
    setAiTranslating(true);
    try {
      const r = await api.autoTranslateAssessment({ assessment_ids: [aId] });
      if (r.success) {
        toast.success('Translations generated!');
        loadItems();
      } else {
        toast.error((r as any).message || 'Translation failed');
      }
    } catch {
      toast.error('Translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── Soft delete ──
  const handleSoftDelete = async (id: number) => {
    if (!window.confirm('Move this mini project to trash?')) return;
    setActionLoadingId(id);
    try {
      const r = await api.softDeleteAssessment(id);
      if (r.success) {
        toast.success('Mini project moved to trash');
        loadItems();
        loadSummary();
      } else {
        toast.error((r as any).message || 'Failed to delete');
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
        toast.success('Mini project restored');
        loadItems();
        loadSummary();
      } else {
        toast.error((r as any).message || 'Failed to restore');
      }
    } catch (e: any) {
      toast.error(e.message || 'Restore error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Permanent delete ──
  const handlePermanentDelete = async (id: number) => {
    if (!window.confirm('PERMANENTLY delete this mini project? This cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? This action is irreversible.')) return;
    setActionLoadingId(id);
    try {
      const r = await api.deleteAssessment(id);
      if (r.success) {
        toast.success('Mini project permanently deleted');
        loadItems();
        loadSummary();
      } else {
        toast.error((r as any).message || 'Failed to delete permanently');
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
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
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
    loadItems(); loadSummary();
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
    loadItems(); loadSummary();
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
    loadItems(); loadSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  };

  // ── Delete a single language translation ──
  const handleDeleteTranslation = async (langId: number) => {
    if (langId === 7) return; // Never delete English
    if (!editingId) return;
    const langName = availableLanguages.find(l => l.id === langId)?.name || 'this language';
    if (!confirm(`Delete ${langName} translation for this mini project?`)) return;

    try {
      const trans = allTranslations.find((t: any) => t.language_id === langId);
      if (trans?.id) {
        await api.deleteAssessmentTranslation(trans.id);
      }
      toast.success(`${langName} translation deleted`);
      // Reload assessment data
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
          await api.deleteAssessmentTranslation(trans.id);
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

  // ── Translation count color helper ──
  const getTranslationColor = (count: number, total?: number) => {
    if (!total || total === 0) return count > 0 ? 'text-green-600' : 'text-red-500';
    if (count >= total) return 'text-green-600';
    if (count > 0) return 'text-amber-500';
    return 'text-red-500';
  };

  // ── Pagination helpers ──
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // ── Total language count from coverage ──
  const totalLangs = translationCoverage.length;
  const translatedLangs = translationCoverage.filter(c => c.has_translation).length;
  const missingLangs = totalLangs - translatedLangs;

  // ── Whether currently editing a non-English language ──
  const isNonEnglish = editLangId !== 7;

  // ── Current language name for display ──
  const currentLangName = availableLanguages.find(l => l.id === editLangId)?.name || 'English';
  const currentLangCode = availableLanguages.find(l => l.id === editLangId)?.code || 'en';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Mini Projects"
        description="Create, manage, and translate mini projects in one place"
        actions={
          mode === 'list' && !showTrash ? (
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleAiTranslateSelected} disabled={aiTranslating}>
                  {aiTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Translate ({selectedIds.size})
                </Button>
              )}
              {items.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleAiTranslateAll} disabled={aiTranslating}>
                  {aiTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Translate All
                </Button>
              )}
              <Button size="sm" onClick={startCreate} className="bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="h-4 w-4 mr-1" /> New Mini Project
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ── Summary Stat Cards ── */}
      {mode === 'list' && summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total', value: summary.total, icon: BarChart3, color: 'bg-amber-50 text-amber-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
            { label: 'In Trash', value: summary.is_deleted, icon: Trash2, color: 'bg-amber-50 text-amber-700' },
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
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
              !showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700'
            )}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Mini Projects
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

      {/* Toolbar: search + cascade filters + difficulty/status filters */}
      {mode === 'list' && (
        <DataToolbar
          ref={toolbarRef}
          search={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder={showTrash ? 'Search trash...' : 'Search mini projects...'}
        >
          {!showTrash && (
            <>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer" value={subjectId} onChange={e => setSubjectId(e.target.value ? parseInt(e.target.value) : '')}>
                <option value="">All Subjects</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.english_name || s.name || `Subject #${s.id}`}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer" value={chapterId} onChange={e => setChapterId(e.target.value ? parseInt(e.target.value) : '')} disabled={!subjectId}>
                <option value="">All Chapters</option>
                {chapters.map((c: any) => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name || `Chapter #${c.id}`}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
                <option value="">All Difficulties</option>
                {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
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
        /* ── Assessment List ── */
        <div className="space-y-4">
          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={showTrash ? Trash2 : Briefcase}
              title={showTrash ? 'Trash is empty' : 'No mini projects yet'}
              description={showTrash ? 'No deleted mini projects' : (searchDebounce || filterDifficulty || filterStatus ? 'No mini projects match your filters' : chapterId ? 'Add your first mini project for this chapter' : 'Select a subject and chapter to create mini projects, or browse all below')}
              action={!showTrash && !searchDebounce && !filterDifficulty && !filterStatus && chapterId ? <Button onClick={startCreate} className="bg-amber-600 hover:bg-amber-700 text-white"><Plus className="w-4 h-4" /> Add Mini Project</Button> : undefined}
            />
          ) : (
            <div className={cn('bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
              {/* Bulk action toolbar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                  <span className="text-sm font-medium text-amber-700">
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
                    <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer" /></TH>
                    <TH className="w-16">
                      <button onClick={() => handleSort('id')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        ID <SortIcon field="id" />
                      </button>
                    </TH>
                    <TH>Title</TH>
                    <TH className="w-36">Chapter</TH>
                    <TH className="w-24">
                      <button onClick={() => handleSort('difficulty_level')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        Difficulty <SortIcon field="difficulty_level" />
                      </button>
                    </TH>
                    <TH className="w-28">Translations</TH>
                    <TH className="w-20">
                      <button onClick={() => handleSort('points')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        Points <SortIcon field="points" />
                      </button>
                    </TH>
                    <TH className="w-20">
                      <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        Active <SortIcon field="is_active" />
                      </button>
                    </TH>
                    {showTrash && <TH className="w-28">Deleted</TH>}
                    <TH className="w-36 text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.map(item => (
                    <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-amber-50/40')}>
                      <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer" /></TD>
                      <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                      <TD className={cn('py-2.5 max-w-xs truncate', showTrash && 'text-slate-400 line-through')} title={item.english_title || item.title || ''}>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {item.english_title || item.title || `Mini Project #${item.id}`}
                          </span>
                        </div>
                      </TD>
                      <TD className="py-2.5">
                        <span className="text-xs text-slate-600 truncate block max-w-[130px]" title={item.chapter?.english_name || ''}>
                          {item.chapter?.english_name || (item.chapter_id ? `ID: ${item.chapter_id}` : '--')}
                        </span>
                      </TD>
                      <TD className="py-2.5">
                        <Badge className={cn('text-xs', {
                          'bg-emerald-50 text-emerald-700': item.difficulty_level === 'easy',
                          'bg-amber-50 text-amber-700': item.difficulty_level === 'medium',
                          'bg-red-50 text-red-700': item.difficulty_level === 'hard',
                        })}>
                          {item.difficulty_level}
                        </Badge>
                      </TD>
                      <TD className="py-2.5">
                        {!showTrash ? (
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-sm font-medium', getTranslationColor(item.translation_count || 0, item.total_languages))}>
                              {item.translation_count || 0}/{item.total_languages ?? '?'}
                            </span>
                            <button
                              onClick={() => handleQuickTranslate(item.id)}
                              disabled={aiTranslating}
                              className={cn('ml-0.5', (item.translation_count || 0) > 1 ? 'text-amber-500 hover:text-amber-700' : 'text-purple-500 hover:text-purple-700')}
                              title={(item.translation_count || 0) > 1 ? 'Re-translate' : 'AI Translate'}
                            >
                              {(item.translation_count || 0) > 1
                                ? <RotateCcw className="h-3.5 w-3.5" />
                                : <Sparkles className="h-3.5 w-3.5" />
                              }
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">--</span>
                        )}
                      </TD>
                      <TD className="py-2.5 text-center"><span className="text-sm font-medium text-slate-700">{item.points}</span></TD>
                      <TD className="py-2.5">
                        {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                      </TD>
                      {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '--'}</span></TD>}
                      <TD className="py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {showTrash ? (
                            <>
                              <button onClick={() => handleRestore(item.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                                {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => handlePermanentDelete(item.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                                {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setViewingId(item.id); setViewingCode(item.code); }} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => startEdit(item.id)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleSoftDelete(item.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete">
                                {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
                showingCount={items.length}
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
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-gray-900">
                  {mode === 'edit' ? 'Edit Mini Project' : 'New Mini Project'}
                </h3>
              </div>
              {mode === 'edit' && isNonEnglish && (
                <Badge className="bg-amber-50 text-amber-700 text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  Editing: {currentLangName} ({currentLangCode})
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || savingTranslation} className="bg-amber-600 hover:bg-amber-700 text-white">
                {(saving || savingTranslation) ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                {mode === 'edit'
                  ? isNonEnglish
                    ? `Save ${currentLangName}`
                    : 'Update'
                  : 'Create'}
              </Button>
            </div>
          </div>

          {/* ── Chapter selector (create mode) ── */}
          {mode === 'create' && (
            <div className="px-4 py-3 border-b bg-amber-50/50 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 mr-1">Chapter:</span>
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer" value={subjectId} onChange={e => setSubjectId(e.target.value ? parseInt(e.target.value) : '')}>
                <option value="">Select Subject</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.english_name || s.name || `Subject #${s.id}`}</option>)}
              </select>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer" value={chapterId} onChange={e => setChapterId(e.target.value ? parseInt(e.target.value) : '')} disabled={!subjectId}>
                <option value="">Select Chapter *</option>
                {chapters.map((c: any) => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name || `Chapter #${c.id}`}</option>)}
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
                          ? 'text-amber-600 border-amber-500 bg-white'
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
            {/* Row 1: Assessment settings (disabled for non-English) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
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
                {isNonEnglish && <p className="text-xs text-gray-400 mt-1">Language-independent setting (edit in English)</p>}
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
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                  <Input
                    type="number"
                    min={0}
                    value={points}
                    onChange={e => setPoints(parseInt(e.target.value) || 0)}
                    disabled={isNonEnglish}
                    className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                  <Input
                    type="number"
                    min={0}
                    value={displayOrder}
                    onChange={e => setDisplayOrder(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="0"
                    disabled={isNonEnglish}
                    className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <label className={cn("flex items-center gap-1.5 text-sm", isNonEnglish ? "text-gray-400 cursor-not-allowed" : "cursor-pointer")}>
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" disabled={isNonEnglish} />
                    Active
                  </label>
                </div>
              </div>
            </div>

            {/* Row 2: More settings */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Est. Hours</label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={estimatedHours}
                  onChange={e => setEstimatedHours(e.target.value ? parseFloat(e.target.value) : '')}
                  placeholder="Optional"
                  disabled={isNonEnglish}
                  className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Days</label>
                <Input
                  type="number"
                  min={0}
                  value={dueDays}
                  onChange={e => setDueDays(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Optional"
                  disabled={isNonEnglish}
                  className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className={cn("flex items-center gap-1.5 text-sm", isNonEnglish ? "text-gray-400 cursor-not-allowed" : "cursor-pointer")}>
                  <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} className="rounded" disabled={isNonEnglish} />
                  Mandatory
                </label>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title ({currentLangName}) *
              </label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={`Enter mini project title in ${currentLangName}...`}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description ({currentLangName})
              </label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={`Brief description in ${currentLangName}...`}
              />
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions ({currentLangName})
              </label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px]"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder={`Detailed instructions in ${currentLangName}...`}
              />
            </div>

            {/* HTML Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                HTML Content ({currentLangName})
              </label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px] font-mono text-xs"
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                placeholder={`Rich HTML content in ${currentLangName} (optional)...`}
              />
            </div>

            {/* Tech Stack & Learning Outcomes side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tech Stack ({currentLangName})
                </label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                  value={techStack}
                  onChange={e => setTechStack(e.target.value)}
                  placeholder={`Technologies used in ${currentLangName}...`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Learning Outcomes ({currentLangName})
                </label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                  value={learningOutcomes}
                  onChange={e => setLearningOutcomes(e.target.value)}
                  placeholder={`Learning outcomes in ${currentLangName}...`}
                />
              </div>
            </div>

            {/* Translation Coverage (only in edit mode) */}
            {mode === 'edit' && translationCoverage.length > 0 && (
              <div className="border rounded-lg p-4 bg-amber-50/50">
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
                            'ring-2 ring-amber-400 ring-offset-1': c.language_id === editLangId,
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
      {/* Assessment View Dialog */}
      <AssessmentViewDialog
        open={viewingId !== null}
        onClose={() => setViewingId(null)}
        assessmentType="mini_project"
        assessmentId={viewingId}
        assessmentCode={viewingCode}
      />

      {aiTranslating && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            <span className="text-gray-700 font-medium">Generating AI translations...</span>
          </div>
        </div>
      )}
    </div>
  );
}
