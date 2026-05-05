"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, FileQuestion, Trash2, Edit2, Check, X, Loader2, Sparkles, Globe,
  CheckCircle2, XCircle, ArrowLeft, Save, RotateCcw,
  Eye, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, ChevronRight,
  ExternalLink, Upload, BarChart3
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

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
  topic_id: number;
  title: string;
  slug: string;
  points: number;
  difficulty_level: string;
  display_order: number;
  is_active: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  english_title?: string;
  topics?: { name: string; slug: string; chapter_id: number; chapters?: { name: string; slug: string; subjects?: { name: string; slug: string } } } | null;
  translation_count?: number;
  total_languages?: number;
}

interface LangTab {
  id: number;
  name: string;
  code: string;
}

type SortField = 'display_order' | 'difficulty_level' | 'points' | 'is_active';

export default function ExercisesPage() {
  // ── Cascade filter state ──
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [chapterId, setChapterId] = useState<number | ''>('');
  const [topicId, setTopicId] = useState<number | ''>('');

  // ── Form state ──
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formTopicId, setFormTopicId] = useState<number | ''>('');
  const [difficultyLevel, setDifficultyLevel] = useState('easy');
  const [points, setPoints] = useState<number | ''>(1);
  const [displayOrder, setDisplayOrder] = useState<number | ''>(0);
  const [isActive, setIsActive] = useState(true);

  // ── Translation form state ──
  const [transTitle, setTransTitle] = useState('');
  const [transDescription, setTransDescription] = useState('');
  const [fileQuestion, setFileQuestion] = useState<File | null>(null);
  const [fileSolution, setFileSolution] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState('');
  const [existingFileSolutionUrl, setExistingFileSolutionUrl] = useState('');

  // ── Translation coverage state ──
  const [translationCoverage, setTranslationCoverage] = useState<CoverageItem[]>([]);

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
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState<SortField>('display_order');
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

  // ── Translation coverage map (for list view) ──
  const [coverageMap, setCoverageMap] = useState<Record<number, { translated_count: number; total_languages: number; is_complete: boolean }>>({});

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileSolutionInputRef = useRef<HTMLInputElement>(null);

  // ── View dialog state ──
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewExercise, setViewExercise] = useState<any>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewLangId, setViewLangId] = useState<number>(7);

  // ── Loading state ──
  const [saving, setSaving] = useState(false);
  const [aiTranslating, setAiTranslating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // ── Form cascade state (for create/edit topic selection) ──
  const [formSubjects, setFormSubjects] = useState<any[]>([]);
  const [formChapters, setFormChapters] = useState<any[]>([]);
  const [formTopics, setFormTopics] = useState<any[]>([]);
  const [formSubjectId, setFormSubjectId] = useState<number | ''>('');
  const [formChapterId, setFormChapterId] = useState<number | ''>('');

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts([
    { key: '/', action: () => { if (mode === 'list') toolbarRef.current?.focusSearch(); } },
    { key: 'n', action: () => { if (mode === 'list' && !showTrash) startCreate(); } },
    { key: 'r', action: () => { if (mode === 'list') loadExercises(); } },
    { key: 't', action: () => { if (mode === 'list') setShowTrash(prev => !prev); } },
  ]);

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
      if (r.success) { setSubjects(r.data || []); setFormSubjects(r.data || []); }
    });
  }, []);

  // ── Cascade: Subject -> Chapters ──
  useEffect(() => {
    if (!subjectId) { setChapters([]); setChapterId(''); return; }
    setChapterId(''); setTopicId('');
    api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${subjectId}`).then((r: any) => {
      if (r.success) setChapters(r.data || []);
    });
  }, [subjectId]);

  // ── Cascade: Chapter -> Topics ──
  useEffect(() => {
    if (!chapterId) { setTopics([]); setTopicId(''); return; }
    setTopicId('');
    api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${chapterId}`).then((r: any) => {
      if (r.success) setTopics(r.data || []);
    });
  }, [chapterId]);

  // ── Load summary stats ──
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.getTableSummary('assesment_exercise');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setSummary(res.data[0]);
        setTrashCount(res.data[0].is_deleted || 0);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Load translation coverage for list ──
  const loadCoverage = useCallback(async () => {
    try {
      const res = await api.getExerciseTranslationCoverage('');
      if (res.success && Array.isArray(res.data)) {
        const map: Record<number, any> = {};
        res.data.forEach((c: any) => { map[c.assessment_exercise_id] = c; });
        setCoverageMap(map);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Load summary + coverage on mount ──
  useEffect(() => {
    loadSummary();
    loadCoverage();
  }, []);

  // ── Load exercises list ──
  const loadExercises = useCallback(async () => {
    setListLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('sort', sortField);
      qs.set('order', sortOrder);
      qs.set('pageSize', String(pageSize));
      qs.set('page', String(page));
      if (topicId) qs.set('topic_id', String(topicId));
      if (showTrash) {
        qs.set('status', 'deleted');
      } else {
        if (filterDifficulty) qs.set('difficulty_level', filterDifficulty);
        if (filterStatus) qs.set('status', filterStatus);
      }
      if (searchDebounce) qs.set('search', searchDebounce);

      const r = await api.listExercises('?' + qs.toString());
      if (r.success) {
        setExercises(r.data || []);
        setTotalCount(r.pagination?.total || 0);
        if (r.summary) setSummary(r.summary);
      }
    } finally {
      setListLoading(false);
    }
  }, [topicId, page, pageSize, sortField, sortOrder, showTrash, searchDebounce, filterDifficulty, filterStatus]);

  useEffect(() => { loadExercises(); }, [loadExercises]);

  // ── Reset page when filters change ──
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [filterDifficulty, filterStatus, showTrash, searchDebounce, topicId, pageSize]);

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

  // ── Load a specific language's translation into form ──
  const loadLanguageIntoForm = (langId: number, translations: any[]) => {
    const trans = translations.find((t: any) => t.language_id === langId);
    setTransTitle(trans?.name || '');
    setTransDescription(trans?.description || '');
    setExistingFileUrl(trans?.file_url || '');
    setExistingFileSolutionUrl(trans?.file_solution_url || '');
    setFileQuestion(null);
    setFileSolution(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileSolutionInputRef.current) fileSolutionInputRef.current.value = '';
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
    setFormTopicId('');
    setDifficultyLevel('easy');
    setPoints(1);
    setDisplayOrder(0);
    setIsActive(true);
    setTransTitle('');
    setTransDescription('');
    setFileQuestion(null);
    setFileSolution(null);
    setExistingFileUrl('');
    setExistingFileSolutionUrl('');
    setTranslationCoverage([]);
    setEditLangId(7);
    setAllTranslations([]);
    setAvailableLanguages([]);
    setFormSubjectId('');
    setFormChapterId('');
    setFormChapters([]);
    setFormTopics([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileSolutionInputRef.current) fileSolutionInputRef.current.value = '';
  };

  // ── Start create mode ──
  const startCreate = () => {
    resetForm();
    setFormSubjects(subjects);
    setMode('create');
  };

  // ── Start edit mode ──
  const startEdit = async (id: number) => {
    try {
      const r = await api.getExerciseFull(id);
      if (!r.success || !r.data) { toast.error('Failed to load exercise'); return; }
      const ex = r.data;
      setEditingId(id);
      setFormTopicId(ex.topic_id || '');
      setDifficultyLevel(ex.difficulty_level || 'easy');
      setPoints(ex.points ?? 1);
      setDisplayOrder(ex.display_order ?? 0);
      setIsActive(ex.is_active ?? true);

      // Store all translations for language switching
      const translations = ex.assesment_exercise_translations || [];
      setAllTranslations(translations);

      // Build available languages from coverage
      const langs: LangTab[] = (ex.translation_coverage || []).map((c: any) => ({
        id: c.language_id,
        name: c.language_name,
        code: c.language_code,
      }));
      setAvailableLanguages(langs);
      setEditLangId(7); // start with English

      // Load English translation
      const engTrans = translations.find((t: any) => t.language_id === 7);
      setTransTitle(engTrans?.name || '');
      setTransDescription(engTrans?.description || '');
      setExistingFileUrl(engTrans?.file_url || '');
      setExistingFileSolutionUrl(engTrans?.file_solution_url || '');
      setFileQuestion(null);
      setFileSolution(null);

      // Translation coverage
      setTranslationCoverage(ex.translation_coverage || []);

      // Pre-populate cascade selects — topic hierarchy is directly on exercise now
      setFormSubjects(subjects);
      setFormSubjectId('');
      setFormChapterId('');
      setFormChapters([]);
      setFormTopics([]);

      setMode('edit');
    } catch {
      toast.error('Failed to load exercise details');
    }
  };

  // ── Save translation for a non-English language ──
  const handleSaveTranslation = async () => {
    if (!editingId) return;
    if (!transTitle.trim()) { toast.error('Name is required'); return; }

    setSavingTranslation(true);
    try {
      const existingTrans = allTranslations.find((t: any) => t.language_id === editLangId);

      const data: any = {
        name: transTitle.trim(),
        description: transDescription.trim() || null,
      };

      if (existingTrans && existingTrans.id) {
        // Update existing translation
        await api.updateExerciseTranslation(existingTrans.id, data, fileQuestion || undefined, fileSolution || undefined);
      } else {
        // Create new translation
        data.assesment_exercise_id = editingId;
        data.language_id = editLangId;
        await api.createExerciseTranslation(data, fileQuestion || undefined, fileSolution || undefined);
      }

      toast.success(`Translation saved for ${availableLanguages.find(l => l.id === editLangId)?.name || 'selected language'}!`);

      // Reload the full exercise to refresh translations
      const r = await api.getExerciseFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.assesment_exercise_translations || []);
        setTranslationCoverage(r.data.translation_coverage || []);
        // Reload current language
        loadLanguageIntoForm(editLangId, r.data.assesment_exercise_translations || []);
      }

      loadExercises();
      loadCoverage();
    } catch (e: any) {
      toast.error(e.message || 'Error saving translation');
    } finally {
      setSavingTranslation(false);
    }
  };

  // ── Save exercise (English / create) ──
  const handleSave = async () => {
    // If editing a non-English language, use the translation save path
    if (mode === 'edit' && editLangId !== 7) {
      return handleSaveTranslation();
    }

    if (!formTopicId && mode === 'create') { toast.error('Please select a topic'); return; }
    if (!transTitle.trim()) { toast.error('Name is required'); return; }

    setSaving(true);
    try {
      const payload: any = {
        name: transTitle.trim(),
        topic_id: formTopicId || undefined,
        difficulty_level: difficultyLevel,
        points: points === '' ? undefined : Number(points),
        display_order: displayOrder === '' ? 0 : Number(displayOrder),
        is_active: isActive,
        description: transDescription.trim() || null,
      };

      let r;
      if (mode === 'edit' && editingId) {
        r = await api.updateFullExercise(editingId, payload, fileQuestion || undefined, fileSolution || undefined);
      } else {
        r = await api.createFullExercise(payload, fileQuestion || undefined, fileSolution || undefined);
      }

      if (r.success) {
        toast.success(mode === 'edit' ? 'Exercise updated!' : 'Exercise created with English translation!');
        resetForm();
        loadExercises();
        loadSummary();
        loadCoverage();
      } else {
        toast.error(r.message || r.error || 'Failed to save');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error saving exercise');
    } finally {
      setSaving(false);
    }
  };

  // ── AI Translate (placeholder — no AI endpoint exists yet, but we follow the pattern) ──
  const handleAiTranslate = async (exerciseId?: number) => {
    toast.info('AI translation for exercises is not yet available');
  };

  const handleAiTranslateSelected = async () => {
    toast.info('AI translation for exercises is not yet available');
  };

  // ── Soft delete ──
  const handleSoftDelete = async (id: number) => {
    if (!window.confirm('Move this exercise to trash?')) return;
    setActionLoadingId(id);
    try {
      const r = await api.softDeleteExercise(id);
      if (r.success) {
        toast.success('Exercise moved to trash');
        loadExercises();
        loadSummary();
        loadCoverage();
      } else {
        toast.error(r.message || r.error || 'Failed to delete');
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
      const r = await api.restoreExercise(id);
      if (r.success) {
        toast.success('Exercise restored');
        loadExercises();
        loadSummary();
        loadCoverage();
      } else {
        toast.error(r.message || r.error || 'Failed to restore');
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
      const r = await api.deleteExercise(id);
      if (r.success) {
        toast.success('Exercise permanently deleted');
        loadExercises();
        loadSummary();
        loadCoverage();
      } else {
        toast.error(r.message || r.error || 'Failed to delete permanently');
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
      setSelectedIds(new Set(exercises.map(e => e.id)));
    }
  };

  const handleBulkSoftDelete = async () => {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteExercise(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    loadExercises(); loadSummary(); loadCoverage();
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
      const res = await api.restoreExercise(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    loadExercises(); loadSummary(); loadCoverage();
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
      const res = await api.deleteExercise(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    loadExercises(); loadSummary(); loadCoverage();
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
      const trans = allTranslations.find((t: any) => t.language_id === langId);
      if (trans?.id) {
        await api.deleteExerciseTranslation(trans.id);
      }
      toast.success(`${langName} translation deleted`);
      // Reload exercise data
      const r = await api.getExerciseFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.assesment_exercise_translations || []);
        setTranslationCoverage(r.data.translation_coverage || []);
      }
      // Switch back to English if we deleted the current language
      if (editLangId === langId) {
        setEditLangId(7);
        loadLanguageIntoForm(7, r?.data?.translations || allTranslations);
      }
      loadCoverage();
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
          await api.deleteExerciseTranslation(trans.id);
        }
      }
      toast.success(`All non-English translations deleted (${nonEngLangs.length} languages)`);
      // Reload
      const r = await api.getExerciseFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.assesment_exercise_translations || []);
        setTranslationCoverage(r.data.translation_coverage || []);
      }
      setEditLangId(7);
      loadLanguageIntoForm(7, r?.data?.translations || allTranslations);
      loadCoverage();
    } catch (e: any) {
      toast.error(e.message || 'Error deleting translations');
    }
  };

  // ── Open view dialog ──
  const openView = async (id: number) => {
    setViewLoading(true);
    setViewDialogOpen(true);
    setViewLangId(7);
    try {
      const r = await api.getExerciseFull(id);
      if (r.success && r.data) {
        setViewExercise(r.data);
      } else {
        toast.error('Failed to load exercise');
      }
    } catch {
      toast.error('Failed to load exercise');
    } finally {
      setViewLoading(false);
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

  // ── Difficulty badge ──
  const getDifficultyBadge = (level: string) => {
    const config: Record<string, string> = {
      easy: 'bg-emerald-50 text-emerald-700',
      medium: 'bg-amber-50 text-amber-700',
      hard: 'bg-red-50 text-red-700',
    };
    return (
      <Badge className={cn('text-xs', config[level] || 'bg-slate-50 text-slate-600')}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Exercises"
        description="Create, manage, and translate exercises with file uploads in one place"
        actions={
          mode === 'list' && !showTrash ? (
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleAiTranslateSelected} disabled={aiTranslating}>
                  {aiTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Translate ({selectedIds.size})
                </Button>
              )}
              <Button size="sm" onClick={startCreate}>
                <Plus className="h-4 w-4 mr-1" /> New Exercise
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ── Summary Stat Cards ── */}
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

      {/* ── Trash toggle tabs ── */}
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

      {/* ── Toolbar: search + cascade filters + difficulty/status filters ── */}
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
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)}>
                <option value="">All Difficulties</option>
                {DIFFICULTY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </>
          )}
        </DataToolbar>
      )}

      {/* ── Trash banner ── */}
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
              icon={showTrash ? Trash2 : FileQuestion}
              title={showTrash ? 'Trash is empty' : 'No exercises yet'}
              description={showTrash ? 'No deleted exercises' : (searchDebounce || filterDifficulty || filterStatus ? 'No exercises match your filters' : 'Add your first exercise')}
              action={!showTrash && !searchDebounce && !filterDifficulty && !filterStatus ? <Button onClick={startCreate}><Plus className="w-4 h-4" /> Add Exercise</Button> : undefined}
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
                      <>
                        <Button size="sm" variant="outline" onClick={handleAiTranslateSelected} disabled={bulkActionLoading || aiTranslating}>
                          {aiTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} AI Translate
                        </Button>
                        <Button size="sm" variant="danger" onClick={handleBulkSoftDelete} disabled={bulkActionLoading}>
                          {bulkActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete Selected
                        </Button>
                      </>
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
                    <TH>Topic</TH>
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
                    <TH className="w-28">Translations</TH>
                    <TH className="w-20">
                      <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        Status <SortIcon field="is_active" />
                      </button>
                    </TH>
                    {showTrash && <TH>Deleted</TH>}
                    <TH className="w-40 text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {exercises.map(ex => {
                    const cov = coverageMap[ex.id];
                    return (
                      <TR key={ex.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(ex.id) && 'bg-brand-50/40')}>
                        <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(ex.id)} onChange={() => toggleSelect(ex.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                        <TD className="py-2.5 text-slate-500">{ex.display_order}</TD>
                        <TD className={cn('py-2.5 max-w-xs truncate', showTrash && 'text-slate-400 line-through')} title={ex.english_title || ex.title || ex.slug}>
                          {ex.english_title || ex.title || ex.slug || '---'}
                        </TD>
                        <TD className="py-2.5">
                          <span className="text-sm text-slate-600">
                            {(ex as any).topics?.name || (ex as any).topics?.slug || '---'}
                          </span>
                        </TD>
                        <TD className="py-2.5">
                          {getDifficultyBadge(ex.difficulty_level)}
                        </TD>
                        <TD className="py-2.5 text-center">
                          <span className="text-sm font-medium text-slate-700">{ex.points != null ? Number(ex.points) : '---'}</span>
                        </TD>
                        <TD className="py-2.5">
                          {!showTrash ? (
                            <div className="flex items-center gap-1.5">
                              {cov ? (
                                <span className={cn(
                                  'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                                  cov.is_complete ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                )}>
                                  {cov.is_complete && <Check className="w-3 h-3" />}
                                  {cov.translated_count}/{cov.total_languages}
                                </span>
                              ) : (
                                <span className={cn('text-sm font-medium', getTranslationColor(ex.translation_count || 0, ex.total_languages))}>
                                  {ex.translation_count || 0}/{ex.total_languages ?? '?'}
                                </span>
                              )}
                              <button
                                onClick={() => handleAiTranslate(ex.id)}
                                disabled={aiTranslating}
                                className="ml-0.5 text-purple-500 hover:text-purple-700"
                                title="AI Translate"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">--</span>
                          )}
                        </TD>
                        <TD className="py-2.5">
                          {showTrash ? (
                            <Badge variant="warning">Deleted</Badge>
                          ) : (
                            <Badge variant={ex.is_active ? 'success' : 'danger'}>
                              {ex.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          )}
                        </TD>
                        {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{ex.deleted_at ? fromNow(ex.deleted_at) : '---'}</span></TD>}
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
                                <button onClick={() => openView(ex.id)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => startEdit(ex.id)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => startEdit(ex.id)} className="p-1.5 rounded-md text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors" title="Translate">
                                  <Globe className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleSoftDelete(ex.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete">
                                  {actionLoadingId === ex.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
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

          {/* ── Topic selector (create mode) ── */}
          {mode === 'create' && (
            <div className="px-4 py-3 border-b bg-slate-50 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-500 mr-1">Topic:</span>
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={formSubjectId} onChange={e => {
                const val = e.target.value ? parseInt(e.target.value) : '';
                setFormSubjectId(val);
                setFormChapterId('');
                setFormTopicId('');
                setFormChapters([]);
                setFormTopics([]);
                if (val) {
                  api.listChapters(`?limit=999&sort=display_order&order=asc&subject_id=${val}`).then(r => {
                    if (r.success) setFormChapters(r.data || []);
                  });
                }
              }}>
                <option value="">Select Subject</option>
                {formSubjects.map(s => <option key={s.id} value={s.id}>{s.english_name || s.name || `Subject #${s.id}`}</option>)}
              </select>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={formChapterId} onChange={e => {
                const val = e.target.value ? parseInt(e.target.value) : '';
                setFormChapterId(val);
                setFormTopicId('');
                setFormTopics([]);
                if (val) {
                  api.listTopics(`?limit=999&sort=display_order&order=asc&chapter_id=${val}`).then(r => {
                    if (r.success) setFormTopics(r.data || []);
                  });
                }
              }} disabled={!formSubjectId}>
                <option value="">Select Chapter</option>
                {formChapters.map(c => <option key={c.id} value={c.id}>{c.display_order ? c.display_order + '. ' : ''}{c.english_name || c.name || `Chapter #${c.id}`}</option>)}
              </select>
              <ChevronRight className="h-3 w-3 text-gray-300" />
              <select className="h-8 px-2 pr-6 text-xs rounded border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={formTopicId} onChange={e => setFormTopicId(e.target.value ? parseInt(e.target.value) : '')} disabled={!formChapterId}>
                <option value="">Select Topic *</option>
                {formTopics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name || `Topic #${t.id}`}</option>)}
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
                      {lang.id !== 7 && hasTranslation && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTranslation(lang.id); }}
                          className="p-0.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
                          title={`Delete ${lang.name} translation`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ── Left side: Exercise fields ── */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">Exercise Details</h4>

                {/* Topic display in edit mode */}
                {mode === 'edit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                    <div className="px-3 py-2 bg-gray-50 border rounded-md text-sm text-gray-600">
                      {formTopicId ? `ID: ${formTopicId}` : '---'}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Topic cannot be changed after creation</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
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
                      min={0}
                      step="0.01"
                      value={points}
                      onChange={e => setPoints(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="1"
                      disabled={isNonEnglish}
                      className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
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

                <div className="flex items-center gap-4">
                  <label className={cn("flex items-center gap-1.5 text-sm", isNonEnglish ? "text-gray-400 cursor-not-allowed" : "cursor-pointer")}>
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" disabled={isNonEnglish} />
                    Active
                  </label>
                </div>
              </div>

              {/* ── Right side: Translation content ── */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">
                  Translation ({currentLangName})
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name ({currentLangName}) *
                  </label>
                  <Input
                    value={transTitle}
                    onChange={e => setTransTitle(e.target.value)}
                    placeholder={`Name in ${currentLangName}...`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description ({currentLangName})
                  </label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                    value={transDescription}
                    onChange={e => setTransDescription(e.target.value)}
                    placeholder={`Optional description in ${currentLangName}...`}
                  />
                </div>

                {/* File upload: Question HTML */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Upload className="h-3.5 w-3.5 inline mr-1" />
                    Question File (HTML) ({currentLangName})
                  </label>
                  {existingFileUrl && !fileQuestion && (
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <a href={existingFileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        View Current File <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={e => setFileQuestion(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                  />
                  {fileQuestion && (
                    <p className="text-xs text-green-600 mt-1">New file: {fileQuestion.name}</p>
                  )}
                </div>

                {/* File upload: Solution HTML */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Upload className="h-3.5 w-3.5 inline mr-1" />
                    Solution File (HTML) ({currentLangName})
                  </label>
                  {existingFileSolutionUrl && !fileSolution && (
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <a href={existingFileSolutionUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        View Current Solution <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  <input
                    ref={fileSolutionInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={e => setFileSolution(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                  />
                  {fileSolution && (
                    <p className="text-xs text-green-600 mt-1">New file: {fileSolution.name}</p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Translation Coverage (only in edit mode) ── */}
            {mode === 'edit' && translationCoverage.length > 0 && (
              <div className="border rounded-lg p-4 bg-gray-50 mt-6">
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
                    const complete = c.has_translation;
                    return (
                      <div key={c.language_id} className="flex items-center gap-0.5">
                        <Badge
                          className={cn('text-xs cursor-pointer hover:opacity-80 transition-opacity', {
                            'bg-green-100 text-green-700': complete,
                            'bg-red-50 text-red-600': !complete,
                            'ring-2 ring-blue-400 ring-offset-1': c.language_id === editLangId,
                          })}
                          onClick={() => handleLangTabSwitch(c.language_id)}
                        >
                          {complete ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {c.language_name}
                        </Badge>
                        {c.language_id !== 7 && complete && (
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
          </div>
        </div>
      )}

      {/* ── AI Translating overlay ── */}
      {aiTranslating && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            <span className="text-gray-700 font-medium">Generating AI translations...</span>
          </div>
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={viewDialogOpen} onClose={() => { setViewDialogOpen(false); setViewExercise(null); }} title="Exercise Details" size="lg">
        {viewLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20" />
          </div>
        ) : viewExercise ? (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewExercise.title || viewExercise.slug}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {getDifficultyBadge(viewExercise.difficulty_level)}
                  <Badge variant={viewExercise.is_active ? 'success' : 'danger'}>{viewExercise.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className="text-xs text-slate-500">Points: {viewExercise.points}</span>
                </div>
              </div>
            </div>

            {/* Exercise meta fields */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-6">
              <DetailRow label="ID" value={String(viewExercise.id)} />
              <DetailRow label="Slug" value={viewExercise.slug} />
              <DetailRow label="Display Order" value={String(viewExercise.display_order)} />
              <DetailRow label="Subject" value={viewExercise.topics?.chapters?.subjects?.name} />
              <DetailRow label="Chapter" value={viewExercise.topics?.chapters?.name} />
              <DetailRow label="Topic" value={viewExercise.topics?.name || viewExercise.topics?.slug} />
              <DetailRow label="Created" value={viewExercise.created_at ? fromNow(viewExercise.created_at) : undefined} />
            </div>

            {/* Language tabs for translations */}
            {viewExercise.translation_coverage && viewExercise.translation_coverage.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Translations
                </h4>
                <div className="flex gap-1 mb-3 overflow-x-auto border-b border-gray-200">
                  {viewExercise.translation_coverage.map((c: any) => (
                    <button
                      key={c.language_id}
                      onClick={() => setViewLangId(c.language_id)}
                      className={cn(
                        'px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px whitespace-nowrap flex items-center gap-1.5 transition-colors',
                        viewLangId === c.language_id
                          ? 'text-blue-600 border-blue-500 bg-white'
                          : 'text-gray-500 border-transparent hover:text-gray-700'
                      )}
                    >
                      {c.has_translation
                        ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                        : <XCircle className="h-3 w-3 text-gray-300" />
                      }
                      {c.language_name}
                    </button>
                  ))}
                </div>
                {(() => {
                  const trans = (viewExercise.assesment_exercise_translations || []).find((t: any) => t.language_id === viewLangId);
                  if (!trans) return <p className="text-sm text-gray-400">No translation available for this language.</p>;
                  return (
                    <div className="space-y-3">
                      <DetailRow label="Name" value={trans.name} />
                      <DetailRow label="Description" value={trans.description} />
                      {trans.file_url && (
                        <div>
                          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Question File</dt>
                          <dd className="mt-0.5">
                            <a href={trans.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                              View File <ExternalLink className="h-3 w-3" />
                            </a>
                          </dd>
                        </div>
                      )}
                      {trans.file_solution_url && (
                        <div>
                          <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Solution File</dt>
                          <dd className="mt-0.5">
                            <a href={trans.file_solution_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                              View Solution <ExternalLink className="h-3 w-3" />
                            </a>
                          </dd>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => { setViewDialogOpen(false); setViewExercise(null); }}>Close</Button>
              <Button onClick={() => { setViewDialogOpen(false); setViewExercise(null); startEdit(viewExercise.id); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '---'}</dd>
    </div>
  );
}
