"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { QuestionViewDialog } from '@/components/ui/QuestionViewDialog';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, HelpCircle, Trash2, Edit2, Check, X, Loader2, Sparkles, Globe,
  CheckCircle2, XCircle, ArrowLeft, Save, RotateCcw,
  Eye, ArrowUpDown, ArrowUp, ArrowDown, Search, AlertTriangle, ChevronRight
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart3 } from 'lucide-react';

const MCQ_TYPE_OPTIONS = [
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

interface OptionItem {
  id?: number;
  option_text: string;
  is_correct: boolean;
}

interface CoverageItem {
  language_id: number;
  language_name: string;
  language_code: string;
  has_question_translation: boolean;
  has_option_translations: boolean;
}

interface McqListItem {
  id: number;
  code: string;
  slug: string;
  mcq_type: string;
  difficulty_level: string;
  points: number;
  display_order: number;
  is_active: boolean;
  question_text?: string;
  translation_count: number;
  total_languages?: number;
  option_count: number;
}

interface LangTab {
  id: number;
  name: string;
  code: string;
}

type SortField = 'display_order' | 'difficulty_level' | 'points' | 'is_active';

export default function CreateMcqPage() {
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
  const [mcqType, setMcqType] = useState('single_choice');
  const [difficultyLevel, setDifficultyLevel] = useState('medium');
  const [questionText, setQuestionText] = useState('');
  const [hintText, setHintText] = useState('');
  const [explanationText, setExplanationText] = useState('');
  const [points, setPoints] = useState(1);
  const [displayOrder, setDisplayOrder] = useState<number | ''>('');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [options, setOptions] = useState<OptionItem[]>([
    { option_text: '', is_correct: true },
    { option_text: '', is_correct: false },
  ]);

  // ── Translation coverage state ──
  const [translationCoverage, setTranslationCoverage] = useState<CoverageItem[]>([]);

  // ── Language tab state (edit mode) ──
  const [editLangId, setEditLangId] = useState<number>(7);
  const [allTranslations, setAllTranslations] = useState<any[]>([]);
  const [allOptions, setAllOptions] = useState<any[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<LangTab[]>([]);
  const [savingTranslation, setSavingTranslation] = useState(false);

  // ── List state ──
  const [questions, setQuestions] = useState<McqListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(20);

  // ── Search, filter, sort state ──
  const [searchText, setSearchText] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [filterMcqType, setFilterMcqType] = useState('');
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

  // ── Translation coverage map ──
  const [coverageMap, setCoverageMap] = useState<Record<number, { translated_count: number; total_languages: number; is_complete: boolean }>>({});

  const toolbarRef = useRef<DataToolbarHandle>(null);

  // ── View dialog state ──
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewQuestionId, setViewQuestionId] = useState<number | null>(null);

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
      const res = await api.getTableSummary('mcq_questions');
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setSummary(res.data[0]);
        setTrashCount(res.data[0].is_deleted || 0);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Load translation coverage ──
  const loadCoverage = useCallback(async () => {
    try {
      const res = await api.getMcqQuestionTranslationCoverage();
      if (res.success && Array.isArray(res.data)) {
        const map: Record<number, any> = {};
        res.data.forEach((c: any) => { map[c.mcq_question_id] = c; });
        setCoverageMap(map);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Load summary + coverage on mount ──
  useEffect(() => {
    loadSummary();
    loadCoverage();
  }, []);

  // ── Load questions list when filters/sort/page change ──
  const loadQuestions = useCallback(async () => {
    setListLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('sort', sortField);
      qs.set('order', sortOrder);
      qs.set('limit', String(pageSize));
      qs.set('page', String(page));
      if (topicId) qs.set('topic_id', String(topicId));
      if (showTrash) {
        qs.set('show_deleted', 'true');
      } else {
        if (filterMcqType) qs.set('mcq_type', filterMcqType);
        if (filterDifficulty) qs.set('difficulty_level', filterDifficulty);
        if (filterStatus) qs.set('is_active', filterStatus);
      }
      if (searchDebounce) qs.set('search', searchDebounce);

      const r = await api.listMcqQuestions('?' + qs.toString());
      if (r.success) {
        setQuestions(r.data || []);
        setTotalCount(r.pagination?.total || 0);
      }
    } finally {
      setListLoading(false);
    }
  }, [topicId, page, pageSize, sortField, sortOrder, showTrash, searchDebounce, filterMcqType, filterDifficulty, filterStatus]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  // ── Reset page when filters change ──
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [filterMcqType, filterDifficulty, filterStatus, showTrash, searchDebounce, topicId, pageSize]);

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

  // ── Load a specific language's data into the form fields ──
  const loadLanguageIntoForm = (langId: number, translations: any[], optionsData: any[]) => {
    const trans = translations.find((t: any) => t.language_id === langId);
    setQuestionText(trans?.question_text || '');
    setHintText(trans?.hint_text || '');
    setExplanationText(trans?.explanation_text || '');

    // Build options with the selected language's text
    const opts: OptionItem[] = optionsData.map((opt: any) => {
      const optTrans = (opt.translations || []).find((t: any) => t.language_id === langId);
      return {
        id: opt.id,
        option_text: optTrans?.option_text || '',
        is_correct: opt.is_correct || false,
      };
    });
    setOptions(opts.length >= 2 ? opts : [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }]);
  };

  // ── Switch language tab ──
  const handleLangTabSwitch = (langId: number) => {
    setEditLangId(langId);
    loadLanguageIntoForm(langId, allTranslations, allOptions);
  };

  // ── Reset form ──
  const resetForm = () => {
    setMode('list');
    setEditingId(null);
    setMcqType('single_choice');
    setDifficultyLevel('medium');
    setQuestionText('');
    setHintText('');
    setExplanationText('');
    setPoints(1);
    setDisplayOrder('');
    setIsMandatory(false);
    setIsActive(true);
    setOptions([
      { option_text: '', is_correct: true },
      { option_text: '', is_correct: false },
    ]);
    setTranslationCoverage([]);
    setEditLangId(7);
    setAllTranslations([]);
    setAllOptions([]);
    setAvailableLanguages([]);
  };

  // ── Start create mode ──
  const startCreate = () => {
    resetForm();
    setMode('create');
  };

  // ── Start edit mode ──
  const startEdit = async (id: number) => {
    try {
      const r = await api.getMcqQuestionFull(id);
      if (!r.success || !r.data) { toast.error('Failed to load question'); return; }
      const q = r.data;
      setEditingId(id);
      setMcqType(q.mcq_type);
      setDifficultyLevel(q.difficulty_level || 'medium');
      setPoints(q.points || 1);
      setDisplayOrder(q.display_order ?? '');
      setIsMandatory(q.is_mandatory ?? false);
      setIsActive(q.is_active ?? true);

      // Store all translations and options for language switching
      const translations = q.question_translations || [];
      const optionsData = q.options || [];
      setAllTranslations(translations);
      setAllOptions(optionsData);

      // Build available languages from coverage
      const langs: LangTab[] = (q.translation_coverage || []).map((c: any) => ({
        id: c.language_id,
        name: c.language_name,
        code: c.language_code,
      }));
      setAvailableLanguages(langs);
      setEditLangId(7); // start with English

      // Get English translation
      const engTrans = translations.find((t: any) => t.language_id === 7);
      setQuestionText(engTrans?.question_text || '');
      setHintText(engTrans?.hint_text || '');
      setExplanationText(engTrans?.explanation_text || '');

      // Build options from enriched data (English)
      const opts: OptionItem[] = optionsData.map((opt: any) => {
        const engOptTrans = (opt.translations || []).find((t: any) => t.language_id === 7);
        return {
          id: opt.id,
          option_text: engOptTrans?.option_text || '',
          is_correct: opt.is_correct || false,
        };
      });
      setOptions(opts.length >= 2 ? opts : [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }]);

      // Translation coverage
      setTranslationCoverage(q.translation_coverage || []);
      setMode('edit');
    } catch {
      toast.error('Failed to load question details');
    }
  };

  // ── Add option ──
  const addOption = () => {
    setOptions(prev => [...prev, { option_text: '', is_correct: false }]);
  };

  // ── Remove option ──
  const removeOption = (idx: number) => {
    if (options.length <= 2) { toast.error('Minimum 2 options required'); return; }
    setOptions(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Update option text ──
  const updateOptionText = (idx: number, text: string) => {
    setOptions(prev => prev.map((o, i) => i === idx ? { ...o, option_text: text } : o));
  };

  // ── Toggle correct ──
  const toggleCorrect = (idx: number) => {
    if (mcqType === 'single_choice' || mcqType === 'true_false') {
      // Only one correct
      setOptions(prev => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
    } else {
      // Multiple correct
      setOptions(prev => prev.map((o, i) => i === idx ? { ...o, is_correct: !o.is_correct } : o));
    }
  };

  // ── Handle MCQ type change ──
  const handleMcqTypeChange = (type: string) => {
    setMcqType(type);
    if (type === 'true_false') {
      setOptions([
        { option_text: 'True', is_correct: true },
        { option_text: 'False', is_correct: false },
      ]);
    }
  };

  // ── Save translation for a non-English language ──
  const handleSaveTranslation = async () => {
    if (!editingId) return;
    if (!questionText.trim()) { toast.error('Question text is required'); return; }
    if (options.some(o => !o.option_text.trim())) { toast.error('All options must have text'); return; }

    setSavingTranslation(true);
    try {
      // Find existing question translation for this language
      const existingQTrans = allTranslations.find((t: any) => t.language_id === editLangId);

      if (existingQTrans && existingQTrans.id) {
        // Update existing question translation
        await api.updateMcqQuestionTranslation(existingQTrans.id, {
          question_text: questionText.trim(),
          hint_text: hintText.trim() || null,
          explanation_text: explanationText.trim() || null,
        });
      } else {
        // Create new question translation
        await api.createMcqQuestionTranslation({
          mcq_question_id: editingId,
          language_id: editLangId,
          question_text: questionText.trim(),
          hint_text: hintText.trim() || null,
          explanation_text: explanationText.trim() || null,
        });
      }

      // Save option translations
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const optionId = allOptions[i]?.id;
        if (!optionId) continue;

        const existingOptTrans = (allOptions[i]?.translations || []).find(
          (t: any) => t.language_id === editLangId
        );

        if (existingOptTrans && existingOptTrans.id) {
          // Update existing option translation
          await api.updateMcqOptionTranslation(existingOptTrans.id, {
            option_text: opt.option_text.trim(),
          });
        } else {
          // Create new option translation
          await api.createMcqOptionTranslation({
            mcq_option_id: optionId,
            language_id: editLangId,
            option_text: opt.option_text.trim(),
          });
        }
      }

      toast.success(`Translation saved for ${availableLanguages.find(l => l.id === editLangId)?.name || 'selected language'}!`);

      // Reload the full question to refresh allTranslations and allOptions
      const r = await api.getMcqQuestionFull(editingId);
      if (r.success && r.data) {
        const q = r.data;
        setAllTranslations(q.question_translations || []);
        setAllOptions(q.options || []);
        setTranslationCoverage(q.translation_coverage || []);
      }

      loadQuestions();
    } catch (e: any) {
      toast.error(e.message || 'Error saving translation');
    } finally {
      setSavingTranslation(false);
    }
  };

  // ── Save question (English / create) ──
  const handleSave = async () => {
    // If we're editing in a non-English language, use the translation save path
    if (mode === 'edit' && editLangId !== 7) {
      return handleSaveTranslation();
    }

    if (!topicId && mode === 'create') { toast.error('Please select a topic'); return; }
    if (!questionText.trim()) { toast.error('Question text is required'); return; }
    if (!options.some(o => o.is_correct)) { toast.error('At least one option must be correct'); return; }
    if (options.some(o => !o.option_text.trim())) { toast.error('All options must have text'); return; }

    setSaving(true);
    try {
      const payload = {
        topic_id: topicId,
        mcq_type: mcqType,
        difficulty_level: difficultyLevel,
        question_text: questionText.trim(),
        hint_text: hintText.trim() || null,
        explanation_text: explanationText.trim() || null,
        points,
        display_order: displayOrder === '' ? undefined : displayOrder,
        is_mandatory: isMandatory,
        is_active: isActive,
        options: options.map((o, idx) => ({
          option_text: o.option_text.trim(),
          is_correct: o.is_correct,
          display_order: idx + 1,
        })),
      };

      let r;
      if (mode === 'edit' && editingId) {
        r = await api.updateFullMcqQuestion(editingId, payload);
      } else {
        r = await api.createFullMcqQuestion(payload);
      }

      if (r.success) {
        toast.success(mode === 'edit' ? 'Question updated!' : 'Question created with options & English translations!');
        resetForm();
        loadQuestions();
        loadSummary();
        loadCoverage();
      } else {
        toast.error(r.message || 'Failed to save');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error saving question');
    } finally {
      setSaving(false);
    }
  };

  // ── AI Translate ──
  const handleAiTranslate = async (questionId?: number) => {
    const qId = questionId || editingId;
    if (!qId) { toast.error('Save the question first, then translate'); return; }

    setAiTranslating(true);
    try {
      const r = await api.autoTranslateMcq({ question_ids: [qId] });
      if (r.success) {
        toast.success('AI translations generated!');
        // Reload coverage and translations
        if (editingId) {
          const full = await api.getMcqQuestionFull(editingId);
          if (full.success) {
            setTranslationCoverage(full.data.translation_coverage || []);
            setAllTranslations(full.data.question_translations || []);
            setAllOptions(full.data.options || []);
            // Reload current language into form
            loadLanguageIntoForm(editLangId, full.data.question_translations || [], full.data.options || []);
          }
        }
        loadQuestions();
      } else {
        toast.error(r.message || 'AI translation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── AI Translate All (topic-based if topic selected, otherwise current page IDs) ──
  const handleAiTranslateAll = async () => {
    if (questions.length === 0) { toast.error('No questions to translate'); return; }
    setAiTranslating(true);
    try {
      const payload = topicId
        ? { topic_id: topicId as number }
        : { question_ids: questions.map(q => q.id) };
      const r = await api.autoTranslateMcq(payload);
      if (r.success) {
        toast.success(topicId ? 'AI translations generated for all questions in this topic!' : `AI translations generated for ${questions.length} question(s)!`);
        loadQuestions();
      } else {
        toast.error(r.message || 'AI translation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── AI Translate Selected questions ──
  const handleAiTranslateSelected = async () => {
    if (selectedIds.size === 0) { toast.error('Select questions to translate'); return; }
    setAiTranslating(true);
    try {
      const r = await api.autoTranslateMcq({ question_ids: Array.from(selectedIds) });
      if (r.success) {
        toast.success(`AI translations generated for ${selectedIds.size} question(s)!`);
        loadQuestions();
        setSelectedIds(new Set());
      } else {
        toast.error(r.message || 'AI translation failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'AI translation error');
    } finally {
      setAiTranslating(false);
    }
  };

  // ── Quick translate from list ──
  const handleQuickTranslate = async (qId: number) => {
    setAiTranslating(true);
    try {
      const r = await api.autoTranslateMcq({ question_ids: [qId] });
      if (r.success) {
        toast.success('Translations generated!');
        loadQuestions();
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
    if (!window.confirm('Move this question to trash?')) return;
    setActionLoadingId(id);
    try {
      const r = await api.deleteMcqQuestion(id);
      if (r.success) {
        toast.success('Question moved to trash');
        loadQuestions();
        loadSummary();
        loadCoverage();
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
      const r = await api.restoreMcqQuestion(id);
      if (r.success) {
        toast.success('Question restored');
        loadQuestions();
        loadSummary();
        loadCoverage();
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
    if (!window.confirm('PERMANENTLY delete this question? This cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? This action is irreversible.')) return;
    setActionLoadingId(id);
    try {
      const r = await api.permanentDeleteMcqQuestion(id);
      if (r.success) {
        toast.success('Question permanently deleted');
        loadQuestions();
        loadSummary();
        loadCoverage();
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
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map(q => q.id)));
    }
  };

  const handleBulkSoftDelete = async () => {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteMcqQuestion(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    loadQuestions(); loadSummary(); loadCoverage();
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
      const res = await api.restoreMcqQuestion(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    loadQuestions(); loadSummary(); loadCoverage();
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
      const res = await api.permanentDeleteMcqQuestion(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    loadQuestions(); loadSummary(); loadCoverage();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  };

  // ── Delete a single language translation ──
  const handleDeleteTranslation = async (langId: number) => {
    if (langId === 7) return; // Never delete English
    if (!editingId) return;
    const langName = availableLanguages.find(l => l.id === langId)?.name || 'this language';
    if (!confirm(`Delete ${langName} translation for this question?`)) return;

    try {
      // Find and delete question translation for this language
      const qTrans = allTranslations.find((t: any) => t.language_id === langId);
      if (qTrans?.id) {
        await api.permanentDeleteMcqQuestionTranslation(qTrans.id);
      }
      // Find and delete option translations for this language
      for (const opt of allOptions) {
        const optTrans = (opt.translations || []).find((t: any) => t.language_id === langId);
        if (optTrans?.id) {
          await api.permanentDeleteMcqOptionTranslation(optTrans.id);
        }
      }
      toast.success(`${langName} translation deleted`);
      // Reload question data
      const r = await api.getMcqQuestionFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.question_translations || []);
        setAllOptions(r.data.options || []);
        setTranslationCoverage(r.data.translation_coverage || []);
      }
      // Switch back to English if we deleted the current language
      if (editLangId === langId) {
        setEditLangId(7);
        loadLanguageIntoForm(7, r?.data?.question_translations || allTranslations, r?.data?.options || allOptions);
      }
      loadCoverage();
    } catch (e: any) {
      toast.error(e.message || 'Error deleting translation');
    }
  };

  // ── Delete all translations except English ──
  const handleDeleteAllTranslations = async () => {
    if (!editingId) return;
    const nonEngLangs = translationCoverage.filter(c => c.language_id !== 7 && (c.has_question_translation || c.has_option_translations));
    if (nonEngLangs.length === 0) { toast.info('No non-English translations to delete'); return; }
    if (!confirm(`Delete ALL translations except English (${nonEngLangs.length} languages)? This cannot be undone.`)) return;

    try {
      for (const lang of nonEngLangs) {
        const qTrans = allTranslations.find((t: any) => t.language_id === lang.language_id);
        if (qTrans?.id) {
          await api.permanentDeleteMcqQuestionTranslation(qTrans.id);
        }
        for (const opt of allOptions) {
          const optTrans = (opt.translations || []).find((t: any) => t.language_id === lang.language_id);
          if (optTrans?.id) {
            await api.permanentDeleteMcqOptionTranslation(optTrans.id);
          }
        }
      }
      toast.success(`All non-English translations deleted (${nonEngLangs.length} languages)`);
      // Reload
      const r = await api.getMcqQuestionFull(editingId);
      if (r.success && r.data) {
        setAllTranslations(r.data.question_translations || []);
        setAllOptions(r.data.options || []);
        setTranslationCoverage(r.data.translation_coverage || []);
      }
      setEditLangId(7);
      loadLanguageIntoForm(7, r?.data?.question_translations || allTranslations, r?.data?.options || allOptions);
      loadCoverage();
    } catch (e: any) {
      toast.error(e.message || 'Error deleting translations');
    }
  };

  // ── View dialog ──
  const openView = (id: number) => {
    setViewQuestionId(id);
    setViewDialogOpen(true);
  };

  // ── Total language count from coverage ──
  const totalLangs = translationCoverage.length;
  const translatedLangs = translationCoverage.filter(c => c.has_question_translation && c.has_option_translations).length;
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
        title="MCQ Questions"
        description="Create, manage, and translate MCQ questions with options in one place"
        actions={
          mode === 'list' && !showTrash ? (
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={handleAiTranslateSelected} disabled={aiTranslating}>
                  {aiTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Translate ({selectedIds.size})
                </Button>
              )}
              {questions.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleAiTranslateAll} disabled={aiTranslating}>
                  {aiTranslating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  AI Translate All
                </Button>
              )}
              <Button size="sm" onClick={startCreate}>
                <Plus className="h-4 w-4 mr-1" /> New Question
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* ── Summary Stat Cards (compact, visible in list mode) ── */}
      {mode === 'list' && summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Questions', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
            MCQ Questions
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

      {/* Toolbar: search + cascade filters + type/difficulty/status filters */}
      {mode === 'list' && (
        <DataToolbar
          ref={toolbarRef}
          search={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder={showTrash ? 'Search trash...' : 'Search MCQ questions...'}
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
              <select className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer" value={filterMcqType} onChange={e => setFilterMcqType(e.target.value)}>
                <option value="">All Types</option>
                {MCQ_TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
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
        /* ── Questions List ── */
        <div className="space-y-4">
          {listLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : questions.length === 0 ? (
            <EmptyState
              icon={showTrash ? Trash2 : HelpCircle}
              title={showTrash ? 'Trash is empty' : 'No MCQ questions yet'}
              description={showTrash ? 'No deleted questions' : (searchDebounce || filterMcqType || filterDifficulty || filterStatus ? 'No questions match your filters' : topicId ? 'Add your first MCQ question' : 'Select a subject, chapter, and topic to create questions — or browse all questions below')}
              action={!showTrash && !searchDebounce && !filterMcqType && !filterDifficulty && !filterStatus && topicId ? <Button onClick={startCreate}><Plus className="w-4 h-4" /> Add question</Button> : undefined}
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
                    <TH className="w-10"><input type="checkbox" checked={questions.length > 0 && selectedIds.size === questions.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                    <TH className="w-12">
                      <button onClick={() => handleSort('display_order')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        # <SortIcon field="display_order" />
                      </button>
                    </TH>
                    <TH>Question</TH>
                    <TH className="w-28">Type</TH>
                    <TH className="w-24">
                      <button onClick={() => handleSort('difficulty_level')} className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                        Difficulty <SortIcon field="difficulty_level" />
                      </button>
                    </TH>
                    <TH className="w-20">Options</TH>
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
                    <TH className="w-40 text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {questions.map(q => {
                    const cov = coverageMap[q.id];
                    return (
                      <TR key={q.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(q.id) && 'bg-brand-50/40')}>
                        <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelect(q.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                        <TD className="py-2.5 text-slate-500">{q.display_order}</TD>
                        <TD className={cn('py-2.5 max-w-xs truncate', showTrash && 'text-slate-400 line-through')} title={q.question_text || q.code}>
                          {q.question_text ? (q.question_text.length > 60 ? q.question_text.substring(0, 60) + '...' : q.question_text) : q.code || q.slug}
                        </TD>
                        <TD className="py-2.5">
                          <Badge className={cn('text-xs', {
                            'bg-blue-50 text-blue-700': q.mcq_type === 'single_choice',
                            'bg-violet-50 text-violet-700': q.mcq_type === 'multiple_choice',
                            'bg-teal-50 text-teal-700': q.mcq_type === 'true_false',
                          })}>
                            {MCQ_TYPE_OPTIONS.find(t => t.value === q.mcq_type)?.label || q.mcq_type}
                          </Badge>
                        </TD>
                        <TD className="py-2.5">
                          <Badge className={cn('text-xs', {
                            'bg-emerald-50 text-emerald-700': q.difficulty_level === 'easy',
                            'bg-amber-50 text-amber-700': q.difficulty_level === 'medium',
                            'bg-red-50 text-red-700': q.difficulty_level === 'hard',
                          })}>
                            {q.difficulty_level}
                          </Badge>
                        </TD>
                        <TD className="py-2.5 text-center">{q.option_count}</TD>
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
                                <span className={cn('text-sm font-medium', getTranslationColor(q.translation_count, q.total_languages))}>
                                  {q.translation_count}/{q.total_languages ?? '?'}
                                </span>
                              )}
                              <button
                                onClick={() => handleQuickTranslate(q.id)}
                                disabled={aiTranslating}
                                className={cn('ml-0.5', q.translation_count > 1 ? 'text-amber-500 hover:text-amber-700' : 'text-purple-500 hover:text-purple-700')}
                                title={q.translation_count > 1 ? 'Re-translate' : 'AI Translate'}
                              >
                                {q.translation_count > 1
                                  ? <RotateCcw className="h-3.5 w-3.5" />
                                  : <Sparkles className="h-3.5 w-3.5" />
                                }
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">--</span>
                          )}
                        </TD>
                        <TD className="py-2.5 text-center">{q.points}</TD>
                        <TD className="py-2.5">
                          <Badge variant={q.is_active ? 'success' : 'danger'}>
                            {q.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TD>
                        <TD className="py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {showTrash ? (
                              <>
                                <button onClick={() => handleRestore(q.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                                  {actionLoadingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => handlePermanentDelete(q.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                                  {actionLoadingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => openView(q.id)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => startEdit(q.id)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleSoftDelete(q.id)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete">
                                  {actionLoadingId === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
                showingCount={questions.length}
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
                {mode === 'edit' ? 'Edit Question' : 'New Question'}
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
                <option value="">Select Topic *</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.display_order ? t.display_order + '. ' : ''}{t.english_name || t.name || `Topic #${t.id}`}</option>)}
              </select>
            </div>
          )}

          {/* ── Language Tabs (edit mode only) ── */}
          {mode === 'edit' && availableLanguages.length > 0 && (
            <div className="px-6 pt-3 border-b bg-gray-50">
              <div className="flex gap-1 overflow-x-auto">
                {availableLanguages.map(lang => {
                  const coverage = translationCoverage.find(c => c.language_id === lang.id);
                  const hasTranslation = coverage?.has_question_translation && coverage?.has_option_translations;
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
            {/* Row 1: Type + Difficulty (disabled for non-English since these are language-independent) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question Type *</label>
                <select
                  className={cn("w-full border rounded-md px-3 py-2 text-sm", isNonEnglish && "bg-gray-100 text-gray-500")}
                  value={mcqType}
                  onChange={e => handleMcqTypeChange(e.target.value)}
                  disabled={isNonEnglish}
                >
                  {MCQ_TYPE_OPTIONS.map(t => (
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
                    min={1}
                    value={points}
                    onChange={e => setPoints(parseInt(e.target.value) || 1)}
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
                    placeholder="Auto"
                    disabled={isNonEnglish}
                    className={cn(isNonEnglish && "bg-gray-100 text-gray-500")}
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <label className={cn("flex items-center gap-1.5 text-sm", isNonEnglish ? "text-gray-400 cursor-not-allowed" : "cursor-pointer")}>
                    <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" disabled={isNonEnglish} />
                    Active
                  </label>
                  <label className={cn("flex items-center gap-1.5 text-sm", isNonEnglish ? "text-gray-400 cursor-not-allowed" : "cursor-pointer")}>
                    <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} className="rounded" disabled={isNonEnglish} />
                    Required
                  </label>
                </div>
              </div>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Text ({currentLangName}) *
              </label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                value={questionText}
                onChange={e => setQuestionText(e.target.value)}
                placeholder={`Enter the question in ${currentLangName}...`}
              />
              {!isNonEnglish && questionText && (
                <p className="text-xs text-gray-400 mt-1">Slug will be auto-generated from question text</p>
              )}
            </div>

            {/* Options */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Options ({currentLangName}) *
                  <span className="text-xs text-gray-400 ml-2">
                    ({mcqType === 'multiple_choice' ? 'Multiple can be correct' : 'Only one correct'})
                  </span>
                </label>
                {mcqType !== 'true_false' && !isNonEnglish && (
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Option
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCorrect(idx)}
                      disabled={isNonEnglish}
                      className={cn(
                        'flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors',
                        opt.is_correct
                          ? 'border-green-500 bg-green-50 text-green-600'
                          : 'border-gray-300 hover:border-gray-400 text-gray-400',
                        isNonEnglish && 'cursor-not-allowed opacity-60'
                      )}
                      title={isNonEnglish ? 'Correct/incorrect is language-independent' : opt.is_correct ? 'Correct answer' : 'Mark as correct'}
                    >
                      {opt.is_correct ? <Check className="h-4 w-4" /> : <span className="text-xs">{String.fromCharCode(65 + idx)}</span>}
                    </button>
                    <Input
                      className="flex-1"
                      value={opt.option_text}
                      onChange={e => updateOptionText(idx, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + idx)} in ${currentLangName}...`}
                      disabled={mcqType === 'true_false' && !isNonEnglish}
                    />
                    {mcqType !== 'true_false' && options.length > 2 && !isNonEnglish && (
                      <button
                        onClick={() => removeOption(idx)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isNonEnglish && (
                <p className="text-xs text-gray-400 mt-2">
                  Correct/incorrect marking and adding/removing options can only be done in English.
                </p>
              )}
            </div>

            {/* Hint & Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hint ({currentLangName})</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px]"
                  value={hintText}
                  onChange={e => setHintText(e.target.value)}
                  placeholder={`Optional hint text in ${currentLangName}...`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Explanation ({currentLangName})</label>
                <textarea
                  className="w-full border rounded-md px-3 py-2 text-sm min-h-[60px]"
                  value={explanationText}
                  onChange={e => setExplanationText(e.target.value)}
                  placeholder={`Optional explanation in ${currentLangName}...`}
                />
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
                    const complete = c.has_question_translation && c.has_option_translations;
                    const partial = c.has_question_translation || c.has_option_translations;
                    return (
                      <div key={c.language_id} className="flex items-center gap-0.5">
                        <Badge
                          className={cn('text-xs cursor-pointer hover:opacity-80 transition-opacity', {
                            'bg-green-100 text-green-700': complete,
                            'bg-yellow-100 text-yellow-700': partial && !complete,
                            'bg-red-50 text-red-600': !partial,
                            'ring-2 ring-blue-400 ring-offset-1': c.language_id === editLangId,
                          })}
                          onClick={() => handleLangTabSwitch(c.language_id)}
                        >
                          {complete ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {c.language_name}
                        </Badge>
                        {c.language_id !== 7 && (complete || partial) && (
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

      {/* AI Translating overlay */}
      {aiTranslating && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            <span className="text-gray-700 font-medium">Generating AI translations...</span>
          </div>
        </div>
      )}

      {/* Question View Dialog */}
      <QuestionViewDialog
        open={viewDialogOpen}
        onClose={() => { setViewDialogOpen(false); setViewQuestionId(null); }}
        questionType="mcq"
        questionId={viewQuestionId}
      />
    </div>
  );
}
