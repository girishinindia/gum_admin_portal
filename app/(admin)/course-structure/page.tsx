"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { cn } from '@/lib/utils';
import {
  BookOpen, Layers, Hash, ChevronDown, ChevronRight, Save, Loader2,
  Search, ChevronsUpDown, ChevronsDownUp, CheckSquare, Square, Minus,
  Check, X, Sparkles, FolderTree, RefreshCcw, Gift, Upload, FileText,
  AlertTriangle, CheckCircle, XCircle, Info,
} from 'lucide-react';

// ── Types ──

interface Course { id: number; code: string; name: string; slug: string; is_active: boolean }
interface CourseModule { id: number; course_id: number; name: string; slug: string; display_order: number; is_active: boolean }
interface Subject { id: number; code: string; slug: string; name: string; display_order: number }
interface Chapter { id: number; slug: string; name: string; subject_id: number; display_order: number }
interface Topic { id: number; slug: string; name: string; chapter_id: number; display_order: number }

interface CmsRecord { id: number; course_id: number; course_module_id?: number; course_module_subject_id?: number; course_chapter_id?: number; subject_id?: number; chapter_id?: number; topic_id?: number; display_order?: number; sort_order?: number; is_active?: boolean; is_free_trial?: boolean }

// ── Helpers ──

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

function CheckboxIcon({ state }: { state: boolean | 'indeterminate' }) {
  if (state === 'indeterminate') return <div className="w-4 h-4 rounded border-2 border-indigo-400 bg-indigo-100 flex items-center justify-center"><Minus className="w-3 h-3 text-indigo-600" /></div>;
  if (state) return <div className="w-4 h-4 rounded border-2 border-indigo-600 bg-indigo-600 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>;
  return <div className="w-4 h-4 rounded border-2 border-slate-300 bg-white" />;
}

export default function CourseStructurePage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Selection state ──
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);

  // ── Master data ──
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [allTopics, setAllTopics] = useState<Topic[]>([]);

  // ── Existing junction records ──
  const [existingCms, setExistingCms] = useState<CmsRecord[]>([]);  // course_module_subjects
  const [existingCc, setExistingCc] = useState<CmsRecord[]>([]);    // course_chapters
  const [existingCct, setExistingCct] = useState<CmsRecord[]>([]);  // course_chapter_topics

  // ── Checkbox state: Sets of IDs that are checked ──
  const [checkedSubjects, setCheckedSubjects] = useState<Set<number>>(new Set());
  const [checkedChapters, setCheckedChapters] = useState<Set<number>>(new Set());
  const [checkedTopics, setCheckedTopics] = useState<Set<number>>(new Set());
  const [freeTrialChapters, setFreeTrialChapters] = useState<Set<number>>(new Set());

  // ── UI state ──
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingTree, setLoadingTree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ step: '', done: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [dirty, setDirty] = useState(false);

  // ── Import dialog state (multi-file) ──
  const [importOpen, setImportOpen] = useState(false);
  const [importFiles, setImportFiles] = useState<{ name: string; content: string }[]>([]);
  const [importPreviews, setImportPreviews] = useState<any[]>([]);  // per-file preview results
  const [importLoading, setImportLoading] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [importResults, setImportResults] = useState<any[]>([]);  // per-file import results
  const [importOverwrite, setImportOverwrite] = useState(true);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentFile: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts([
    { key: '/', action: () => searchRef.current?.focus() },
    { key: 'ctrl+s', action: () => { if (dirty && selectedCourseId && selectedModuleId) handleSave(); }, allowInInput: true },
    { key: 'r', action: () => { if (selectedCourseId && selectedModuleId) loadTreeData(); } },
    { key: 'g d', action: () => router.push('/dashboard') },
  ]);

  // ── Load courses on mount ──
  useEffect(() => {
    loadCourses();
    loadMasterData();
  }, []);

  // ── Load modules when course changes ──
  useEffect(() => {
    if (selectedCourseId) {
      loadModules(selectedCourseId);
    } else {
      setModules([]);
      setSelectedModuleId(null);
    }
  }, [selectedCourseId]);

  // ── Load tree when both course + module selected ──
  useEffect(() => {
    if (selectedCourseId && selectedModuleId) {
      loadTreeData();
    }
  }, [selectedCourseId, selectedModuleId]);

  // ── Data loaders ──

  async function loadCourses() {
    setLoadingCourses(true);
    try {
      const res = await api.listCourses('?limit=500&sort=code&is_active=true');
      if (res.success) {
        setCourses(Array.isArray(res.data) ? res.data : res.data?.data || []);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load courses');
    }
    setLoadingCourses(false);
  }

  async function loadModules(courseId: number) {
    setLoadingModules(true);
    setSelectedModuleId(null);
    try {
      const res = await api.listCourseModules(`?course_id=${courseId}&limit=500&is_active=true`);
      if (res.success) {
        setModules(Array.isArray(res.data) ? res.data : res.data?.data || []);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load modules');
    }
    setLoadingModules(false);
  }

  async function loadMasterData() {
    try {
      const [subRes, chRes, tpRes] = await Promise.all([
        api.listSubjects('?limit=500&sort=display_order&is_active=true'),
        api.listChapters('?limit=500&sort=display_order&is_active=true'),
        api.listTopics('?limit=500&sort=display_order&is_active=true'),
      ]);
      if (subRes.success) setAllSubjects(Array.isArray(subRes.data) ? subRes.data : subRes.data?.data || []);
      if (chRes.success) setAllChapters(Array.isArray(chRes.data) ? chRes.data : chRes.data?.data || []);
      if (tpRes.success) setAllTopics(Array.isArray(tpRes.data) ? tpRes.data : tpRes.data?.data || []);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load master data');
    }
  }

  const loadTreeData = useCallback(async () => {
    if (!selectedCourseId || !selectedModuleId) return;
    setLoadingTree(true);
    try {
      const [cmsRes, ccRes, cctRes] = await Promise.all([
        api.listCourseModuleSubjects(`?course_module_id=${selectedModuleId}&course_id=${selectedCourseId}&limit=500`),
        api.listCourseChapters(`?course_id=${selectedCourseId}&limit=500`),
        api.listCourseChapterTopics(`?course_id=${selectedCourseId}&limit=500`),
      ]);

      const cmsData: CmsRecord[] = cmsRes.success ? (Array.isArray(cmsRes.data) ? cmsRes.data : cmsRes.data?.data || []) : [];
      const ccData: CmsRecord[] = ccRes.success ? (Array.isArray(ccRes.data) ? ccRes.data : ccRes.data?.data || []) : [];
      const cctData: CmsRecord[] = cctRes.success ? (Array.isArray(cctRes.data) ? cctRes.data : cctRes.data?.data || []) : [];

      setExistingCms(cmsData);
      setExistingCc(ccData);
      setExistingCct(cctData);

      // Pre-check existing assignments
      const subIds = new Set(cmsData.map(r => r.subject_id!).filter(Boolean));
      const chIds = new Set(ccData.map(r => r.chapter_id!).filter(Boolean));
      const tpIds = new Set(cctData.map(r => r.topic_id!).filter(Boolean));
      const ftIds = new Set(ccData.filter(r => r.is_free_trial).map(r => r.chapter_id!).filter(Boolean));

      setCheckedSubjects(subIds);
      setCheckedChapters(chIds);
      setCheckedTopics(tpIds);
      setFreeTrialChapters(ftIds);
      setDirty(false);

      // Auto-expand checked subjects
      setExpandedSubjects(new Set(subIds));
      const expandCh = new Set<number>();
      chIds.forEach(chId => {
        const ch = allChapters.find(c => c.id === chId);
        if (ch) expandCh.add(ch.id);
      });
      setExpandedChapters(expandCh);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load existing assignments');
    }
    setLoadingTree(false);
  }, [selectedCourseId, selectedModuleId, allChapters]);

  // ── Build the tree structure (only subjects with chapters, chapters with topics) ──

  const chaptersBySubject = useCallback(() => {
    const map = new Map<number, Chapter[]>();
    allChapters.forEach(ch => {
      if (!map.has(ch.subject_id)) map.set(ch.subject_id, []);
      map.get(ch.subject_id)!.push(ch);
    });
    return map;
  }, [allChapters]);

  const topicsByChapter = useCallback(() => {
    const map = new Map<number, Topic[]>();
    allTopics.forEach(tp => {
      if (!map.has(tp.chapter_id)) map.set(tp.chapter_id, []);
      map.get(tp.chapter_id)!.push(tp);
    });
    return map;
  }, [allTopics]);

  // Filter by search
  const filterTree = useCallback(() => {
    const q = searchQuery.toLowerCase().trim();
    const chapMap = chaptersBySubject();
    const topMap = topicsByChapter();

    // Get subjects that have chapters with topics
    const validSubjects = allSubjects.filter(sub => {
      const chapters = chapMap.get(sub.id) || [];
      return chapters.some(ch => (topMap.get(ch.id) || []).length > 0);
    });

    if (!q) return validSubjects;

    return validSubjects.filter(sub => {
      if (sub.name.toLowerCase().includes(q)) return true;
      const chapters = chapMap.get(sub.id) || [];
      return chapters.some(ch => {
        if (ch.name.toLowerCase().includes(q)) return true;
        const topics = topMap.get(ch.id) || [];
        return topics.some(tp => tp.name.toLowerCase().includes(q));
      });
    });
  }, [allSubjects, searchQuery, chaptersBySubject, topicsByChapter]);

  // ── Checkbox handlers ──

  const toggleSubject = useCallback((subjectId: number) => {
    setDirty(true);
    const chapMap = chaptersBySubject();
    const topMap = topicsByChapter();
    const wasChecked = checkedSubjects.has(subjectId);

    setCheckedSubjects(prev => {
      const next = new Set(prev);
      if (wasChecked) next.delete(subjectId); else next.add(subjectId);
      return next;
    });

    // Cascade: check/uncheck all chapters and topics under this subject
    const chapters = chapMap.get(subjectId) || [];
    const chapterIds = chapters.map(ch => ch.id);
    const topicIds = chapters.flatMap(ch => (topMap.get(ch.id) || []).map(tp => tp.id));

    if (wasChecked) {
      // Uncheck all
      setCheckedChapters(prev => {
        const next = new Set(prev);
        chapterIds.forEach(id => next.delete(id));
        return next;
      });
      setCheckedTopics(prev => {
        const next = new Set(prev);
        topicIds.forEach(id => next.delete(id));
        return next;
      });
      setFreeTrialChapters(prev => {
        const next = new Set(prev);
        chapterIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Check all
      setCheckedChapters(prev => {
        const next = new Set(prev);
        chapterIds.forEach(id => next.add(id));
        return next;
      });
      setCheckedTopics(prev => {
        const next = new Set(prev);
        topicIds.forEach(id => next.add(id));
        return next;
      });
      // Auto-expand
      setExpandedSubjects(prev => { const n = new Set(prev); n.add(subjectId); return n; });
    }
  }, [checkedSubjects, chaptersBySubject, topicsByChapter]);

  const toggleChapter = useCallback((chapterId: number, subjectId: number) => {
    setDirty(true);
    const topMap = topicsByChapter();
    const wasChecked = checkedChapters.has(chapterId);

    // Ensure parent subject is checked
    if (!wasChecked && !checkedSubjects.has(subjectId)) {
      setCheckedSubjects(prev => { const n = new Set(prev); n.add(subjectId); return n; });
    }

    setCheckedChapters(prev => {
      const next = new Set(prev);
      if (wasChecked) next.delete(chapterId); else next.add(chapterId);
      return next;
    });

    // Cascade topics
    const topicIds = (topMap.get(chapterId) || []).map(tp => tp.id);
    if (wasChecked) {
      setCheckedTopics(prev => {
        const next = new Set(prev);
        topicIds.forEach(id => next.delete(id));
        return next;
      });
      setFreeTrialChapters(prev => {
        const next = new Set(prev);
        next.delete(chapterId);
        return next;
      });
    } else {
      setCheckedTopics(prev => {
        const next = new Set(prev);
        topicIds.forEach(id => next.add(id));
        return next;
      });
      setExpandedChapters(prev => { const n = new Set(prev); n.add(chapterId); return n; });
    }
  }, [checkedChapters, checkedSubjects, topicsByChapter]);

  const toggleTopic = useCallback((topicId: number, chapterId: number, subjectId: number) => {
    setDirty(true);
    const wasChecked = checkedTopics.has(topicId);

    // Ensure parent chapter + subject are checked
    if (!wasChecked) {
      if (!checkedSubjects.has(subjectId)) {
        setCheckedSubjects(prev => { const n = new Set(prev); n.add(subjectId); return n; });
      }
      if (!checkedChapters.has(chapterId)) {
        setCheckedChapters(prev => { const n = new Set(prev); n.add(chapterId); return n; });
      }
    }

    setCheckedTopics(prev => {
      const next = new Set(prev);
      if (wasChecked) next.delete(topicId); else next.add(topicId);
      return next;
    });
  }, [checkedTopics, checkedChapters, checkedSubjects]);

  const toggleFreeTrial = useCallback((chapterId: number) => {
    setDirty(true);
    setFreeTrialChapters(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId); else next.add(chapterId);
      return next;
    });
  }, []);

  // ── Get check state for parent (indeterminate support) ──

  const getSubjectCheckState = useCallback((subjectId: number): boolean | 'indeterminate' => {
    const chapMap = chaptersBySubject();
    const topMap = topicsByChapter();
    const chapters = chapMap.get(subjectId) || [];
    if (chapters.length === 0) return checkedSubjects.has(subjectId);

    const validChapters = chapters.filter(ch => (topMap.get(ch.id) || []).length > 0);
    if (validChapters.length === 0) return checkedSubjects.has(subjectId);

    const checkedCount = validChapters.filter(ch => checkedChapters.has(ch.id)).length;
    if (checkedCount === 0 && !checkedSubjects.has(subjectId)) return false;
    if (checkedCount === validChapters.length) return true;
    return 'indeterminate';
  }, [checkedSubjects, checkedChapters, chaptersBySubject, topicsByChapter]);

  const getChapterCheckState = useCallback((chapterId: number): boolean | 'indeterminate' => {
    const topMap = topicsByChapter();
    const topics = topMap.get(chapterId) || [];
    if (topics.length === 0) return checkedChapters.has(chapterId);

    const checkedCount = topics.filter(tp => checkedTopics.has(tp.id)).length;
    if (checkedCount === 0 && !checkedChapters.has(chapterId)) return false;
    if (checkedCount === topics.length) return true;
    return 'indeterminate';
  }, [checkedChapters, checkedTopics, topicsByChapter]);

  // ── Select All / Clear All ──

  const handleSelectAll = useCallback(() => {
    setDirty(true);
    const chapMap = chaptersBySubject();
    const topMap = topicsByChapter();
    const newSubs = new Set<number>();
    const newChs = new Set<number>();
    const newTps = new Set<number>();

    allSubjects.forEach(sub => {
      const chapters = chapMap.get(sub.id) || [];
      const validChapters = chapters.filter(ch => (topMap.get(ch.id) || []).length > 0);
      if (validChapters.length > 0) {
        newSubs.add(sub.id);
        validChapters.forEach(ch => {
          newChs.add(ch.id);
          (topMap.get(ch.id) || []).forEach(tp => newTps.add(tp.id));
        });
      }
    });

    setCheckedSubjects(newSubs);
    setCheckedChapters(newChs);
    setCheckedTopics(newTps);
  }, [allSubjects, chaptersBySubject, topicsByChapter]);

  const handleClearAll = useCallback(() => {
    setDirty(true);
    setCheckedSubjects(new Set());
    setCheckedChapters(new Set());
    setCheckedTopics(new Set());
    setFreeTrialChapters(new Set());
  }, []);

  // ── Expand / Collapse all ──

  const handleExpandAll = useCallback(() => {
    const chapMap = chaptersBySubject();
    const topMap = topicsByChapter();
    const subs = new Set<number>();
    const chs = new Set<number>();
    allSubjects.forEach(sub => {
      const chapters = chapMap.get(sub.id) || [];
      const valid = chapters.filter(ch => (topMap.get(ch.id) || []).length > 0);
      if (valid.length > 0) {
        subs.add(sub.id);
        valid.forEach(ch => chs.add(ch.id));
      }
    });
    setExpandedSubjects(subs);
    setExpandedChapters(chs);
  }, [allSubjects, chaptersBySubject, topicsByChapter]);

  const handleCollapseAll = useCallback(() => {
    setExpandedSubjects(new Set());
    setExpandedChapters(new Set());
  }, []);

  // ── Summary stats ──

  const subjectCount = checkedSubjects.size;
  const chapterCount = checkedChapters.size;
  const topicCount = checkedTopics.size;

  // ── Save structure ──

  const handleSave = useCallback(async () => {
    if (!selectedCourseId || !selectedModuleId) return;
    setSaving(true);

    try {
      // ── Step 1: Subjects ──
      setSaveProgress({ step: 'Syncing subjects...', done: 0, total: 0 });

      const existingSubjectIds = new Set(existingCms.map(r => r.subject_id!).filter(Boolean));
      const toCreateSubjects = [...checkedSubjects].filter(id => !existingSubjectIds.has(id));
      const toDeleteSubjects = [...existingSubjectIds].filter(id => !checkedSubjects.has(id));

      // Create new subjects
      const newCmsMap = new Map<number, number>(); // subject_id -> cms record id
      let order = 0;
      for (const subId of toCreateSubjects) {
        order++;
        setSaveProgress({ step: 'Creating subject assignments...', done: order, total: toCreateSubjects.length });
        const res = await api.createCourseModuleSubject({
          course_id: selectedCourseId,
          course_module_id: selectedModuleId,
          subject_id: subId,
          display_order: order,
          sort_order: order,
          is_active: true,
        });
        if (res.success && res.data) {
          const newId = res.data.id ?? res.data.data?.id;
          if (newId) newCmsMap.set(subId, newId);
        }
      }

      // Delete removed subjects
      for (const subId of toDeleteSubjects) {
        const record = existingCms.find(r => r.subject_id === subId);
        if (record) {
          await api.deleteCourseModuleSubject(record.id);
        }
      }

      // Build subject_id -> cms_id map (existing + new)
      const cmsIdMap = new Map<number, number>();
      existingCms.forEach(r => {
        if (r.subject_id && checkedSubjects.has(r.subject_id)) {
          cmsIdMap.set(r.subject_id, r.id);
        }
      });
      newCmsMap.forEach((cmsId, subId) => cmsIdMap.set(subId, cmsId));

      // ── Step 2: Chapters ──
      setSaveProgress({ step: 'Syncing chapters...', done: 0, total: 0 });

      const existingChapterIds = new Set(existingCc.map(r => r.chapter_id!).filter(Boolean));
      const toCreateChapters = [...checkedChapters].filter(id => !existingChapterIds.has(id));
      const toDeleteChapters = [...existingChapterIds].filter(id => !checkedChapters.has(id));

      // Also update is_free_trial for existing chapters where it changed
      const existingFreeTrialIds = new Set(existingCc.filter(r => r.is_free_trial).map(r => r.chapter_id!).filter(Boolean));
      const toUpdateFreeTrial: { recordId: number; isFree: boolean }[] = [];
      existingCc.forEach(r => {
        if (r.chapter_id && checkedChapters.has(r.chapter_id)) {
          const wasFree = existingFreeTrialIds.has(r.chapter_id);
          const isFree = freeTrialChapters.has(r.chapter_id);
          if (wasFree !== isFree) {
            toUpdateFreeTrial.push({ recordId: r.id, isFree });
          }
        }
      });

      const newCcMap = new Map<number, number>(); // chapter_id -> cc record id
      order = 0;
      for (const chId of toCreateChapters) {
        order++;
        setSaveProgress({ step: 'Creating chapter assignments...', done: order, total: toCreateChapters.length });
        // Find the parent subject for this chapter
        const chapter = allChapters.find(c => c.id === chId);
        if (!chapter) continue;
        const cmsId = cmsIdMap.get(chapter.subject_id);
        if (!cmsId) continue; // parent subject not assigned

        const res = await api.createCourseChapter({
          course_id: selectedCourseId,
          course_module_subject_id: cmsId,
          chapter_id: chId,
          display_order: order,
          sort_order: order,
          is_active: true,
          is_free_trial: freeTrialChapters.has(chId),
        });
        if (res.success && res.data) {
          const newId = res.data.id ?? res.data.data?.id;
          if (newId) newCcMap.set(chId, newId);
        }
      }

      // Delete removed chapters
      for (const chId of toDeleteChapters) {
        const record = existingCc.find(r => r.chapter_id === chId);
        if (record) {
          await api.deleteCourseChapter(record.id);
        }
      }

      // Update free trial status
      for (const upd of toUpdateFreeTrial) {
        await api.updateCourseChapter(upd.recordId, { is_free_trial: upd.isFree });
      }

      // Build chapter_id -> cc_id map
      const ccIdMap = new Map<number, number>();
      existingCc.forEach(r => {
        if (r.chapter_id && checkedChapters.has(r.chapter_id)) {
          ccIdMap.set(r.chapter_id, r.id);
        }
      });
      newCcMap.forEach((ccId, chId) => ccIdMap.set(chId, ccId));

      // ── Step 3: Topics ──
      setSaveProgress({ step: 'Syncing topics...', done: 0, total: 0 });

      const existingTopicIds = new Set(existingCct.map(r => r.topic_id!).filter(Boolean));
      const toCreateTopics = [...checkedTopics].filter(id => !existingTopicIds.has(id));
      const toDeleteTopics = [...existingTopicIds].filter(id => !checkedTopics.has(id));

      order = 0;
      for (const tpId of toCreateTopics) {
        order++;
        setSaveProgress({ step: 'Creating topic assignments...', done: order, total: toCreateTopics.length });
        const topic = allTopics.find(t => t.id === tpId);
        if (!topic) continue;
        const ccId = ccIdMap.get(topic.chapter_id);
        if (!ccId) continue;

        await api.createCourseChapterTopic({
          course_id: selectedCourseId,
          course_chapter_id: ccId,
          topic_id: tpId,
          display_order: order,
          sort_order: order,
          is_active: true,
        });
      }

      // Delete removed topics
      for (const tpId of toDeleteTopics) {
        const record = existingCct.find(r => r.topic_id === tpId);
        if (record) {
          await api.deleteCourseChapterTopic(record.id);
        }
      }

      toast.success('Course structure saved successfully');
      setDirty(false);

      // Reload to get fresh data
      await loadTreeData();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save course structure');
    }

    setSaving(false);
    setSaveProgress({ step: '', done: 0, total: 0 });
  }, [
    selectedCourseId, selectedModuleId,
    checkedSubjects, checkedChapters, checkedTopics, freeTrialChapters,
    existingCms, existingCc, existingCct,
    allChapters, allTopics, loadTreeData,
  ]);

  // ── Import handlers ──

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const validFiles: { name: string; content: string }[] = [];
    let pending = files.length;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.endsWith('.txt')) {
        pending--;
        if (pending === 0 && validFiles.length === 0) toast.error('Please select .txt files');
        continue;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        validFiles.push({ name: file.name, content: ev.target?.result as string });
        pending--;
        if (pending === 0) {
          setImportFiles(prev => [...prev, ...validFiles]);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setImportFiles(prev => prev.filter((_, i) => i !== index));
    setImportPreviews(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleImportPreview = useCallback(async () => {
    if (importFiles.length === 0) return;
    setImportLoading(true);
    const previews: any[] = [];
    for (const file of importFiles) {
      try {
        const res = await api.previewCourseImport(file.content);
        if (res.success) {
          previews.push({ fileName: file.name, ...res.data, previewOk: true });
        } else {
          previews.push({ fileName: file.name, previewOk: false, error: res.message || 'Failed to parse' });
        }
      } catch (e: any) {
        previews.push({ fileName: file.name, previewOk: false, error: e.message || 'Failed to preview' });
      }
    }
    setImportPreviews(previews);
    setImportStep('preview');
    setImportLoading(false);
  }, [importFiles]);

  const handleImportExecute = useCallback(async () => {
    // Only import files that have no missing items and no parse errors
    const validIndices = importPreviews
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.previewOk && p.stats?.missingItems === 0 && (!p.parsed?.errors || p.parsed.errors.length === 0));

    if (validIndices.length === 0) {
      toast.error('No valid files to import');
      return;
    }

    setImportStep('importing');
    setImportLoading(true);
    setImportProgress({ current: 0, total: validIndices.length, currentFile: '' });

    const results: any[] = [];
    for (let idx = 0; idx < validIndices.length; idx++) {
      const { p, i } = validIndices[idx];
      const file = importFiles[i];
      setImportProgress({ current: idx + 1, total: validIndices.length, currentFile: file.name });
      try {
        const shouldOverwrite = importOverwrite || !!p.existingCourse;
        const res = await api.importCourseFromTxt(file.content, shouldOverwrite);
        if (res.success) {
          results.push({ fileName: file.name, success: true, ...res.data });
        } else {
          results.push({ fileName: file.name, success: false, error: res.message || 'Import failed' });
        }
      } catch (e: any) {
        results.push({ fileName: file.name, success: false, error: e.message || 'Import failed' });
      }
    }

    // Also add skipped files to results
    const skippedIndices = importPreviews
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !p.previewOk || (p.stats?.missingItems > 0) || (p.parsed?.errors?.length > 0));

    for (const { p, i } of skippedIndices) {
      const file = importFiles[i];
      const reason = !p.previewOk ? p.error : p.stats?.missingItems > 0 ? `${p.stats.missingItems} missing references` : 'Parse errors';
      results.push({ fileName: file.name, success: false, skipped: true, error: `Skipped: ${reason}` });
    }

    setImportResults(results);
    setImportStep('done');
    setImportLoading(false);
    loadCourses();
  }, [importFiles, importPreviews, importOverwrite]);

  const handleImportClose = useCallback(() => {
    setImportOpen(false);
    setImportFiles([]);
    setImportPreviews([]);
    setImportResults([]);
    setImportStep('upload');
    setImportLoading(false);
    setImportOverwrite(true);
    setImportProgress({ current: 0, total: 0, currentFile: '' });
  }, []);

  // ── Render ──

  const filteredSubjects = filterTree();
  const chapMap = chaptersBySubject();
  const topMap = topicsByChapter();
  const treeReady = selectedCourseId && selectedModuleId && !loadingTree;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Course Structure"
        description="Manage the content hierarchy for courses"
        actions={
          <div className="flex items-center gap-2">
            {dirty && (
              <Badge variant="warning" className="mr-1">Unsaved changes</Badge>
            )}
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              <Upload className="w-4 h-4" />
              Import .txt
            </Button>
            <Button
              variant="outline"
              onClick={() => { if (selectedCourseId && selectedModuleId) loadTreeData(); }}
              disabled={!selectedCourseId || !selectedModuleId || loadingTree}
            >
              {loadingTree ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Refresh
            </Button>
            <Button
              onClick={handleSave}
              disabled={!dirty || saving || !selectedCourseId || !selectedModuleId}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Structure'}
            </Button>
          </div>
        }
      />

      {/* Save progress indicator */}
      {saving && saveProgress.step && (
        <div className="mb-4 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span className="text-sm text-brand-700 font-medium">{saveProgress.step}</span>
          {saveProgress.total > 0 && (
            <span className="text-xs text-brand-500">{saveProgress.done}/{saveProgress.total}</span>
          )}
          <div className="flex-1 bg-brand-100 rounded-full h-1.5 ml-2">
            <div
              className="bg-brand-600 h-1.5 rounded-full transition-all"
              style={{ width: saveProgress.total > 0 ? `${Math.round((saveProgress.done / saveProgress.total) * 100)}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Top Selection Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Course</label>
            {loadingCourses ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                className={cn(selectClass, 'w-full')}
                value={selectedCourseId ?? ''}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedCourseId(val);
                  setDirty(false);
                }}
              >
                <option value="">Select a course...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Module</label>
            {loadingModules ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <select
                className={cn(selectClass, 'w-full')}
                value={selectedModuleId ?? ''}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedModuleId(val);
                  setDirty(false);
                }}
                disabled={!selectedCourseId}
              >
                <option value="">{selectedCourseId ? 'Select a module...' : 'Select a course first'}</option>
                {modules.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Empty state when no selection */}
      {(!selectedCourseId || !selectedModuleId) && (
        <EmptyState
          icon={FolderTree}
          title="Select a course and module"
          description="Choose a course and module above to manage the content hierarchy"
        />
      )}

      {/* Loading tree */}
      {selectedCourseId && selectedModuleId && loadingTree && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={cn('h-10 rounded-lg', i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-11/12 ml-6' : 'w-10/12 ml-12')} />
            ))}
          </div>
        </div>
      )}

      {/* Tree view */}
      {treeReady && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          {/* Tree toolbar */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter subjects, chapters, topics... (press / to focus)"
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={handleExpandAll}>
                <ChevronsUpDown className="w-3.5 h-3.5" /> Expand All
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCollapseAll}>
                <ChevronsDownUp className="w-3.5 h-3.5" /> Collapse All
              </Button>
              <span className="text-slate-300 mx-1">|</span>
              <Button size="sm" variant="ghost" onClick={handleSelectAll}>
                <CheckSquare className="w-3.5 h-3.5" /> Select All
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClearAll}>
                <Square className="w-3.5 h-3.5" /> Clear All
              </Button>
            </div>
          </div>

          {/* Summary stats */}
          <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4 text-xs">
            <span className="text-slate-500 font-medium">Assigned:</span>
            <span className="text-indigo-600 font-semibold">{subjectCount} subjects</span>
            <span className="text-blue-600 font-semibold">{chapterCount} chapters</span>
            <span className="text-purple-600 font-semibold">{topicCount} topics</span>
            {freeTrialChapters.size > 0 && (
              <span className="text-amber-600 font-semibold flex items-center gap-1">
                <Gift className="w-3 h-3" /> {freeTrialChapters.size} free trial
              </span>
            )}
          </div>

          {/* Tree content */}
          <div className="p-2 min-h-[300px] max-h-[calc(100vh-380px)] overflow-y-auto">
            {filteredSubjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Search className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm font-medium">No matching items</p>
                <p className="text-xs mt-1">Try a different search term</p>
              </div>
            ) : (
              filteredSubjects.map(subject => {
                const chapters = (chapMap.get(subject.id) || []).filter(ch => (topMap.get(ch.id) || []).length > 0);
                const isSubExpanded = expandedSubjects.has(subject.id);
                const subCheckState = getSubjectCheckState(subject.id);
                const checkedChapterCount = chapters.filter(ch => checkedChapters.has(ch.id)).length;

                return (
                  <div key={subject.id} className="mb-0.5">
                    {/* Subject row */}
                    <div className="flex items-center group">
                      <div
                        onClick={() => setExpandedSubjects(prev => {
                          const n = new Set(prev);
                          if (n.has(subject.id)) n.delete(subject.id); else n.add(subject.id);
                          return n;
                        })}
                        className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-indigo-50/50 cursor-pointer"
                      >
                        {isSubExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                        <button
                          onClick={e => { e.stopPropagation(); toggleSubject(subject.id); }}
                          className="shrink-0"
                        >
                          <CheckboxIcon state={subCheckState} />
                        </button>
                        <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-medium text-slate-800">{subject.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600 border border-indigo-200">
                          Subject
                        </span>
                        <span className="ml-auto text-xs text-slate-400">
                          {checkedChapterCount}/{chapters.length} chapters
                        </span>
                      </div>
                    </div>

                    {/* Chapters */}
                    {isSubExpanded && chapters.map(chapter => {
                      const topics = topMap.get(chapter.id) || [];
                      const isChExpanded = expandedChapters.has(chapter.id);
                      const chCheckState = getChapterCheckState(chapter.id);
                      const checkedTopicCount = topics.filter(tp => checkedTopics.has(tp.id)).length;
                      const isFree = freeTrialChapters.has(chapter.id);

                      return (
                        <div key={chapter.id}>
                          {/* Chapter row */}
                          <div className="flex items-center group" style={{ paddingLeft: 24 }}>
                            <div
                              onClick={() => setExpandedChapters(prev => {
                                const n = new Set(prev);
                                if (n.has(chapter.id)) n.delete(chapter.id); else n.add(chapter.id);
                                return n;
                              })}
                              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-blue-50/50 cursor-pointer"
                            >
                              {isChExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                              <button
                                onClick={e => { e.stopPropagation(); toggleChapter(chapter.id, subject.id); }}
                                className="shrink-0"
                              >
                                <CheckboxIcon state={chCheckState} />
                              </button>
                              <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="font-medium text-slate-700">{chapter.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-200">
                                Chapter
                              </span>
                              {/* Free trial toggle */}
                              {checkedChapters.has(chapter.id) && (
                                <button
                                  onClick={e => { e.stopPropagation(); toggleFreeTrial(chapter.id); }}
                                  className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-full font-medium border transition-colors',
                                    isFree
                                      ? 'bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200'
                                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200'
                                  )}
                                  title={isFree ? 'Remove free trial' : 'Mark as free trial'}
                                >
                                  <Gift className="w-3 h-3 inline mr-0.5" />
                                  {isFree ? 'Free Trial' : 'Free?'}
                                </button>
                              )}
                              <span className="ml-auto text-xs text-slate-400">
                                {checkedTopicCount}/{topics.length} topics
                              </span>
                            </div>
                          </div>

                          {/* Topics */}
                          {isChExpanded && topics.map(topic => {
                            const isChecked = checkedTopics.has(topic.id);
                            return (
                              <div
                                key={topic.id}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-purple-50/50 cursor-pointer"
                                style={{ paddingLeft: 72 }}
                                onClick={() => toggleTopic(topic.id, chapter.id, subject.id)}
                              >
                                <CheckboxIcon state={isChecked} />
                                <Hash className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                <span className={cn('text-slate-600', isChecked && 'text-slate-800 font-medium')}>{topic.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Hidden file input (multiple) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Import Dialog (Multi-file) ── */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Import Courses from .txt</h2>
                  <p className="text-xs text-slate-500">Upload one or more course definition files — preview all, then import valid ones</p>
                </div>
              </div>
              <button onClick={handleImportClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">

              {/* Step 1: Upload */}
              {importStep === 'upload' && (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-600">
                      {importFiles.length > 0 ? `${importFiles.length} file(s) selected — click to add more` : 'Click to select .txt course files'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Select one or multiple .txt files at once</p>
                  </div>

                  {/* File list */}
                  {importFiles.length > 0 && (
                    <div className="space-y-2">
                      {importFiles.map((file, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            <span className="text-sm font-medium text-slate-700">{file.name}</span>
                            <span className="text-xs text-slate-400">{file.content.split('\n').length} lines</span>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(i)}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Format help */}
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> File format reference
                    </summary>
                    <pre className="mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] font-mono whitespace-pre-wrap leading-relaxed">{`=== COURSE ===
name: C Programming for Beginners
code: c-prog-beginners
difficulty_level: beginner
course_status: draft
course_language: Hindi
duration_hours: 120
price: 0
original_price: 4999
discount_percentage: 100
is_free: true

=== SUB-CATEGORIES ===
Sub-Category: programming-languages | is_primary: true
Sub-Category: software-engineering

--- MODULE: Getting Started | display_order: 1 ---

Subject: C Programming
  Chapter: Introduction | is_free_trial: true
    Topic: Getting Started with C
    Topic: Your First Program`}</pre>
                  </details>
                </div>
              )}

              {/* Step 2: Preview */}
              {/* Step 2: Preview all files */}
              {importStep === 'preview' && importPreviews.length > 0 && (
                <div className="space-y-4">
                  {/* Overall stats bar */}
                  {(() => {
                    const validCount = importPreviews.filter(p => p.previewOk && p.stats?.missingItems === 0 && (!p.parsed?.errors || p.parsed.errors.length === 0)).length;
                    const issueCount = importPreviews.length - validCount;
                    return (
                      <div className={cn(
                        'rounded-xl p-4 border flex items-center justify-between',
                        issueCount === 0 ? 'bg-emerald-50 border-emerald-200' : validCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                      )}>
                        <div className="flex items-center gap-2">
                          {issueCount === 0 ? <CheckCircle className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
                          <span className="text-sm font-semibold text-slate-700">
                            {validCount} of {importPreviews.length} file(s) ready to import
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">{validCount} valid</span>
                          {issueCount > 0 && <span className="px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">{issueCount} with issues</span>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Per-file preview cards */}
                  {importPreviews.map((preview: any, fileIdx: number) => {
                    const isValid = preview.previewOk && preview.stats?.missingItems === 0 && (!preview.parsed?.errors || preview.parsed.errors.length === 0);
                    return (
                      <details key={fileIdx} open={!isValid || importPreviews.length <= 3}>
                        <summary className={cn(
                          'cursor-pointer rounded-xl p-4 border flex items-center gap-3 transition-colors',
                          isValid ? 'bg-emerald-50/50 border-emerald-200 hover:bg-emerald-50' : 'bg-red-50/50 border-red-200 hover:bg-red-50'
                        )}>
                          {isValid ? <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800 truncate">{preview.fileName}</span>
                              {isValid && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">ready</span>}
                              {!isValid && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">issues</span>}
                            </div>
                            {preview.previewOk && (
                              <div className="text-xs text-slate-500 mt-0.5">
                                {preview.parsed?.course?.name} — {preview.parsed?.course?.code} — {preview.stats?.foundItems}/{preview.stats?.totalItems} refs matched
                              </div>
                            )}
                            {!preview.previewOk && <div className="text-xs text-red-500 mt-0.5">{preview.error}</div>}
                          </div>
                        </summary>

                        {preview.previewOk && (
                          <div className="mt-2 ml-8 space-y-3 pb-2">
                            {/* Course info */}
                            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                              <h3 className="font-semibold text-indigo-800 text-sm mb-2">Course</h3>
                              <div className="grid grid-cols-2 gap-2 text-xs text-indigo-700">
                                <div><span className="text-indigo-500">Name:</span> {preview.parsed.course.name}</div>
                                <div><span className="text-indigo-500">Code:</span> {preview.parsed.course.code}</div>
                                <div><span className="text-indigo-500">Language:</span> {preview.parsed.course.course_language || '—'}{preview.resolvedLanguageId ? ` (ID: ${preview.resolvedLanguageId})` : ''}</div>
                                <div><span className="text-indigo-500">Level:</span> {preview.parsed.course.difficulty_level || '—'}</div>
                                <div><span className="text-indigo-500">Price:</span> {preview.parsed.course.is_free ? 'Free' : `₹${preview.parsed.course.price}`}</div>
                                <div><span className="text-indigo-500">Duration:</span> {preview.parsed.course.duration_hours}h</div>
                              </div>
                            </div>

                  {/* Existing course warning */}
                  {preview.existingCourse && (
                              <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 flex items-start gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-700">
                                  Course &quot;{preview.existingCourse.code}&quot; already exists (ID: {preview.existingCourse.id}) — will add structure to it
                                </div>
                              </div>
                            )}

                            {/* Stats */}
                            {preview.stats && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{preview.stats.foundItems} found</span>
                                {preview.stats.warningItems > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{preview.stats.warningItems} diff parent</span>}
                                {preview.stats.missingItems > 0 && <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">{preview.stats.missingItems} missing</span>}
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{preview.stats.totalItems} total</span>
                              </div>
                            )}

                            {/* Summary badges */}
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium border border-violet-200">{preview.parsed.summary.moduleCount} modules</span>
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium border border-indigo-200">{preview.parsed.summary.subjectCount} subjects</span>
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium border border-blue-200">{preview.parsed.summary.chapterCount} chapters</span>
                              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium border border-purple-200">{preview.parsed.summary.topicCount} topics</span>
                            </div>

                            {/* Sub-categories */}
                            {preview.mapping?.subCategories?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {preview.mapping.subCategories.map((sc: any) => (
                                  <span key={sc.code} className={cn(
                                    'text-[10px] px-2 py-1 rounded-lg border flex items-center gap-1',
                                    sc.status === 'found' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                                  )}>
                                    {sc.status === 'found' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                    {sc.code}{sc.db_id ? ` #${sc.db_id}` : ''}{sc.is_primary ? ' (primary)' : ''}{sc.status === 'missing' ? ' — missing' : ''}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Parse errors */}
                            {preview.parsed.errors.length > 0 && (
                              <div className="bg-red-50 rounded-lg p-2 border border-red-200 text-xs text-red-600">
                                {preview.parsed.errors.map((e: string, ei: number) => <div key={ei}>{e}</div>)}
                              </div>
                            )}

                            {/* Module tree */}
                            <div className="space-y-2 text-xs">
                              {(preview.mapping?.modules || []).map((mod: any, mi: number) => (
                                <div key={mi} className="border border-slate-100 rounded-lg p-2 bg-slate-50/50">
                                  <div className="font-semibold text-violet-700 flex items-center gap-1.5 text-xs">
                                    <FolderTree className="w-3 h-3" /> {mod.name}
                                    <span className="text-[10px] font-normal text-violet-400">#{mod.display_order}</span>
                                  </div>
                                  {mod.subjects.map((sub: any, si: number) => (
                                    <div key={si} className="ml-3 mt-1">
                                      <div className={cn('flex items-center gap-1 text-[11px]', sub.status === 'found' ? 'text-emerald-700' : 'text-red-600')}>
                                        {sub.status === 'found' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                        <BookOpen className="w-2.5 h-2.5" /> {sub.name}
                                        {sub.db_id && <span className="font-mono text-[9px] bg-emerald-100 text-emerald-600 px-0.5 rounded">#{sub.db_id}</span>}
                                      </div>
                                      {sub.chapters.map((ch: any, ci: number) => (
                                        <div key={ci} className="ml-4 mt-0.5">
                                          <div className={cn('flex items-center gap-1 text-[11px]', ch.status === 'found' ? 'text-emerald-700' : ch.status === 'found_other_parent' ? 'text-amber-700' : 'text-red-600')}>
                                            {ch.status === 'found' ? <CheckCircle className="w-2.5 h-2.5" /> : ch.status === 'found_other_parent' ? <AlertTriangle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                                            <Layers className="w-2.5 h-2.5" /> {ch.name}
                                            {ch.db_id && <span className="font-mono text-[9px] bg-emerald-100 text-emerald-600 px-0.5 rounded">#{ch.db_id}</span>}
                                            {ch.is_free_trial && <span className="text-[9px] bg-amber-100 text-amber-600 px-0.5 rounded">free</span>}
                                          </div>
                                          {ch.topics.map((tp: any, ti: number) => (
                                            <div key={ti} className={cn('ml-4 flex items-center gap-1 text-[10px] mt-0.5', tp.status === 'found' ? 'text-emerald-600' : tp.status === 'found_other_parent' ? 'text-amber-600' : 'text-red-500')}>
                                              {tp.status === 'found' ? <CheckCircle className="w-2 h-2" /> : tp.status === 'found_other_parent' ? <AlertTriangle className="w-2 h-2" /> : <XCircle className="w-2 h-2" />}
                                              <Hash className="w-2 h-2" /> {tp.name}
                                              {tp.db_id && <span className="font-mono text-[9px] bg-emerald-100 text-emerald-600 px-0.5 rounded">#{tp.db_id}</span>}
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              )}

              {/* Step 3: Importing */}
              {importStep === 'importing' && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                  <p className="text-sm font-medium text-slate-700">
                    Importing {importProgress.current} of {importProgress.total}...
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{importProgress.currentFile}</p>
                  {importProgress.total > 0 && (
                    <div className="w-64 h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} />
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Done — Summary */}
              {importStep === 'done' && importResults.length > 0 && (
                <div className="space-y-4">
                  {/* Overall summary */}
                  {(() => {
                    const successCount = importResults.filter(r => r.success).length;
                    const failCount = importResults.filter(r => !r.success && !r.skipped).length;
                    const skipCount = importResults.filter(r => r.skipped).length;
                    return (
                      <div className={cn(
                        'rounded-xl p-4 border flex items-start gap-3',
                        successCount > 0 && failCount === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                      )}>
                        <CheckCircle className={cn('w-6 h-6 shrink-0 mt-0.5', successCount > 0 ? 'text-emerald-500' : 'text-amber-500')} />
                        <div>
                          <h3 className="font-semibold text-slate-800 text-sm">Import Complete</h3>
                          <div className="flex items-center gap-3 mt-2 text-xs font-medium">
                            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">{successCount} imported</span>
                            {skipCount > 0 && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">{skipCount} skipped</span>}
                            {failCount > 0 && <span className="px-2 py-1 rounded-full bg-red-100 text-red-700">{failCount} failed</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Per-file results */}
                  {importResults.map((result: any, i: number) => (
                    <details key={i} open={!result.success}>
                      <summary className={cn(
                        'cursor-pointer rounded-lg p-3 border flex items-center gap-2 text-sm',
                        result.success ? 'bg-emerald-50/50 border-emerald-200' : result.skipped ? 'bg-amber-50/50 border-amber-200' : 'bg-red-50/50 border-red-200'
                      )}>
                        {result.success ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : result.skipped ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                        <span className="font-medium text-slate-700">{result.fileName}</span>
                        {result.success && <span className="text-xs text-emerald-600 ml-auto">{result.courseName} (ID: {result.courseId}) — {result.summary?.moduleCount} modules</span>}
                        {!result.success && <span className="text-xs text-red-500 ml-auto">{result.error}</span>}
                      </summary>
                      {result.success && result.log && result.log.length > 0 && (
                        <div className="ml-6 mt-2 bg-slate-50 rounded-lg p-3 border border-slate-200 max-h-40 overflow-y-auto space-y-0.5">
                          {result.log.map((line: string, li: number) => (
                            <div key={li} className={cn(
                              'text-xs font-mono px-2 py-0.5 rounded',
                              line.startsWith('⚠') ? 'text-amber-700 bg-amber-50' :
                              line.startsWith('Created') || line.startsWith('Linked') || line.startsWith('Assigned') ? 'text-green-700 bg-green-50' :
                              'text-slate-600'
                            )}>{line}</div>
                          ))}
                        </div>
                      )}
                    </details>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="text-xs text-slate-400">
                {importStep === 'upload' && `Step 1 of 3: Upload files (${importFiles.length} selected)`}
                {importStep === 'preview' && `Step 2 of 3: Review ${importPreviews.length} file(s)`}
                {importStep === 'importing' && `Step 3 of 3: Importing ${importProgress.current}/${importProgress.total}...`}
                {importStep === 'done' && `Done — ${importResults.filter(r => r.success).length} imported, ${importResults.filter(r => !r.success).length} skipped/failed`}
              </div>
              <div className="flex items-center gap-2">
                {importStep === 'upload' && (
                  <>
                    <Button variant="outline" onClick={handleImportClose}>Cancel</Button>
                    <Button
                      onClick={handleImportPreview}
                      disabled={importFiles.length === 0 || importLoading}
                    >
                      {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      Preview All ({importFiles.length})
                    </Button>
                  </>
                )}
                {importStep === 'preview' && (
                  <>
                    <Button variant="outline" onClick={() => { setImportStep('upload'); setImportPreviews([]); }}>
                      Back
                    </Button>
                    {(() => {
                      const validCount = importPreviews.filter(p => p.previewOk && p.stats?.missingItems === 0 && (!p.parsed?.errors || p.parsed.errors.length === 0)).length;
                      return (
                        <Button
                          onClick={handleImportExecute}
                          disabled={importLoading || validCount === 0}
                        >
                          {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          Import {validCount} Valid File{validCount !== 1 ? 's' : ''}
                        </Button>
                      );
                    })()}
                  </>
                )}
                {importStep === 'done' && (
                  <Button onClick={handleImportClose}>
                    <Check className="w-4 h-4" /> Done
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
