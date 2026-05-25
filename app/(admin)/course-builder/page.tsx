"use client";
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { FileUpload } from '@/components/ui/FileUpload';
import { VideoUpload } from '@/components/ui/VideoUpload';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  Plus, Pencil, Trash2, ArrowLeft, CheckCircle, XCircle, Send, ShieldCheck,
  Package, FolderTree, FileText, Video, BookOpen, ClipboardList, FlaskConical, Loader2,
  BarChart3, Clock, RotateCcw, AlertCircle, Eye, ExternalLink, X, Upload, Download, HelpCircle, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── constants ─── */
const LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-blue-100 text-blue-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  published: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-gray-100 text-gray-500',
};
const HIGHLIGHT_KINDS = [
  { value: 'prerequisite', label: 'Prerequisite' },
  { value: 'outcome', label: 'Outcome (what you\'ll learn)' },
  { value: 'skill', label: 'Skill gained' },
  { value: 'audience', label: 'Who it\'s for' },
  { value: 'requirement', label: 'Requirement' },
];
const UNIT_TYPES = [
  { value: 'module', label: 'Module' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'topic', label: 'Topic (lesson)' },
];
/* TOPIC_TYPES removed — topic_type dropdown no longer shown; all content types uploaded in one form */
/* YouTube URL validation — accepts youtube.com/watch, youtu.be/, youtube.com/embed/, youtube.com/shorts/ */
function isValidYouTubeUrl(url: string): boolean {
  if (!url.trim()) return true; // empty is fine
  return /^https?:\/\/(www\.)?(youtube\.com\/(watch|embed|shorts)|youtu\.be\/)/i.test(url.trim());
}

type Tab = 'basics' | 'highlights' | 'curriculum' | 'faqs' | 'capstones' | 'mini-projects';

/* ─── Shared import preview parsing (used by both listing-page and CurriculumTab) ─── */
const IMPORT_VALID_TOPIC_TYPES = ['video', 'article', 'quiz', 'exercise', 'project'];
const IMPORT_VALID_HIGHLIGHT_KINDS = ['prerequisite', 'outcome', 'skill', 'audience', 'requirement'];

function splitImportSectionsShared(content: string): Record<string, string> {
  const markerRe = /^\[([A-Z_]+)\]\s*$/;
  const lines = content.split(/\r?\n/);
  const sections: Record<string, string> = {};
  let cur: string | null = null;
  let curLines: string[] = [];
  let hasMarkers = false;
  for (const line of lines) {
    const m = line.trim().match(markerRe);
    if (m) { hasMarkers = true; if (cur) sections[cur] = curLines.join('\n'); cur = m[1]; curLines = []; }
    else curLines.push(line);
  }
  if (cur) sections[cur] = curLines.join('\n');
  if (!hasMarkers) sections['CURRICULUM'] = content;
  return sections;
}

function parseCurriculumPreviewShared(block: string) {
  const lines = block.split(/\r?\n/);
  const mods: any[] = [];
  let curMod: any = null, curCh: any = null, curTopic: any = null, lastEntity: string | null = null;
  for (const raw of lines) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    let tabs = 0, j = 0;
    while (j < raw.length && raw[j] === '\t') { tabs++; j++; }
    if (tabs === 0 && raw[0] === ' ') { let sp = 0, k = 0; while (k < raw.length && raw[k] === ' ') { sp++; k++; } if (sp >= 8) tabs = 2; else if (sp >= 4) tabs = 1; j = k; }
    const text = raw.slice(j).trim();
    if (!text) continue;
    const propMatch = text.match(/^(summary|is_free_preview|points|youtube_url)\s*:\s*(.*)$/i);
    if (propMatch) {
      const key = propMatch[1].toLowerCase();
      const val = propMatch[2].trim();
      const target = lastEntity === 'module' ? curMod : lastEntity === 'chapter' ? curCh : lastEntity === 'topic' ? curTopic : null;
      if (target) { if (key === 'summary') target.summary = val; else if (key === 'is_free_preview') target.is_free_preview = val === 'true'; else if (key === 'points') target.points = parseInt(val); else if (key === 'youtube_url') target.youtube_url = val; }
      continue;
    }
    if (tabs === 0) { curMod = { title: text, chapters: [] }; curCh = null; curTopic = null; lastEntity = 'module'; mods.push(curMod); }
    else if (tabs === 1 && curMod) { curCh = { title: text, topics: [] }; curTopic = null; lastEntity = 'chapter'; curMod.chapters.push(curCh); }
    else if (tabs === 2 && curCh) {
      const pi = text.lastIndexOf('|'); let title = text, tt = 'video';
      if (pi > 0) { const mt = text.slice(pi + 1).trim().toLowerCase(); if (IMPORT_VALID_TOPIC_TYPES.includes(mt)) { title = text.slice(0, pi).trim(); tt = mt; } }
      curTopic = { title, topic_type: tt }; lastEntity = 'topic'; curCh.topics.push(curTopic);
    }
  }
  return mods;
}

function parseImportPreviewShared(content: string) {
  const sections = splitImportSectionsShared(content);
  const preview: any = { hasCourse: false, hasHighlights: false, hasFaq: false, hasCurriculum: false, courseFields: {} as Record<string, string>, highlights: [] as any[], faqs: [] as any[], modules: [] as any[] };
  if (sections['COURSE']) {
    preview.hasCourse = true;
    for (const raw of sections['COURSE'].split(/\r?\n/)) { const t = raw.trim(); if (!t || t.startsWith('#')) continue; const ci = t.indexOf(':'); if (ci > 0) preview.courseFields[t.slice(0, ci).trim().toLowerCase()] = t.slice(ci + 1).trim(); }
  }
  if (sections['HIGHLIGHTS']) {
    preview.hasHighlights = true;
    for (const raw of sections['HIGHLIGHTS'].split(/\r?\n/)) { const t = raw.trim(); if (!t || t.startsWith('#')) continue; const ci = t.indexOf(':'); if (ci > 0) { const kind = t.slice(0, ci).trim().toLowerCase(); const text = t.slice(ci + 1).trim(); if (IMPORT_VALID_HIGHLIGHT_KINDS.includes(kind) && text) preview.highlights.push({ kind, text }); } }
  }
  if (sections['FAQ']) {
    preview.hasFaq = true;
    let curQ: string | null = null;
    for (const raw of sections['FAQ'].split(/\r?\n/)) { const t = raw.trim(); if (!t || t.startsWith('#')) continue; if (/^Q\s*:\s*/i.test(t)) { curQ = t.replace(/^Q\s*:\s*/i, '').trim(); } else if (/^A\s*:\s*/i.test(t) && curQ) { preview.faqs.push({ question: curQ, answer: t.replace(/^A\s*:\s*/i, '').trim() }); curQ = null; } }
  }
  if (sections['CURRICULUM']) { preview.hasCurriculum = true; preview.modules = parseCurriculumPreviewShared(sections['CURRICULUM']); }
  return preview;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>{status?.replace('_', ' ')}</span>;
}

export default function CourseBuilderPage() {
  return <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading…</div>}><CourseBuilderInner /></Suspense>;
}

function CourseBuilderInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [view, setView] = useState<'list' | 'edit'>('list');
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trash: 0 });
  const [viewing, setViewing] = useState<any | null>(null);
  const [viewChildren, setViewChildren] = useState<{ highlights: any[]; units: any[]; faqs: any[]; capstones: any[]; miniProjects: any[] }>({ highlights: [], units: [], faqs: [], capstones: [], miniProjects: [] });
  const [viewLoading, setViewLoading] = useState(false);

  /* ── multi-select / bulk actions ── */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const [languages, setLanguages] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);

  const [course, setCourse] = useState<any | null>(null); // currently edited course
  const [tab, setTab] = useState<Tab>('basics');
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [highlights, setHighlights] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [capstones, setCapstones] = useState<any[]>([]);
  const [miniProjects, setMiniProjects] = useState<any[]>([]);
  const [readiness, setReadiness] = useState<{ ready: boolean; problems: string[] } | null>(null);

  // ── Listing-page import state ──
  const [listImportOpen, setListImportOpen] = useState(false);
  const [listImportFile, setListImportFile] = useState<File | null>(null);
  const [listImportPreview, setListImportPreview] = useState<any | null>(null);
  const [listImportLoading, setListImportLoading] = useState(false);
  const [listImportResult, setListImportResult] = useState<any | null>(null);
  const [listImportInstructorId, setListImportInstructorId] = useState<string>('');
  const [listImportHelpOpen, setListImportHelpOpen] = useState(false);

  function downloadListImportSample() {
    const sample = `# Sample: Full Course Import
# This file creates a new course with details, highlights, FAQs, and curriculum
# All sections are optional — include only what you need
# Lines starting with # are comments (ignored)

[COURSE]
title: Introduction to Web Development
subtitle: Build modern websites from scratch
short_intro: Learn HTML, CSS, and JavaScript step by step
long_intro: This comprehensive course covers the core technologies of the web.
level: beginner
price: 499
original_price: 999
is_free: false
has_certificate: true

[HIGHLIGHTS]
# Format: kind: text
# Kinds: prerequisite, outcome, skill, audience, requirement
prerequisite: Basic computer literacy
outcome: Build responsive websites from scratch
outcome: Write clean, semantic HTML
skill: HTML5
skill: CSS3
skill: JavaScript ES6+
audience: Aspiring web developers
requirement: A code editor (VS Code recommended)

[FAQ]
Q: Do I need programming experience?
A: No! This course starts from the very basics.
Q: What tools do I need?
A: Just a code editor (VS Code is free) and a modern web browser.

[CURRICULUM]
# 0 tabs = Module, 1 tab = Chapter, 2 tabs = Topic | type
# Topic types: video, article, quiz, exercise, project
# Properties: summary, is_free_preview, points, youtube_url

Introduction to Web Development
\tsummary: Learn the fundamentals of building websites
\tHTML Fundamentals
\t\tsummary: Core HTML concepts
\t\tWhat is HTML | video
\t\t\tis_free_preview: true
\t\tHTML Document Structure | article
\t\tHTML Tags Practice | exercise
\t\t\tpoints: 10
\tCSS Styling
\t\tCSS Selectors | video
\t\t\tis_free_preview: true
\t\tBox Model | article
\t\tCSS Quiz | quiz
\t\t\tpoints: 15
JavaScript Essentials
\tsummary: Master the programming language of the web
\tVariables and Data Types
\t\tUnderstanding Variables | video
\t\tData Types | article
\t\tData Type Quiz | quiz
\t\t\tpoints: 10`;
    const blob = new Blob([sample], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample_course_import.txt'; a.click();
    URL.revokeObjectURL(url);
  }

  function handleListImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setListImportFile(file); setListImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => { setListImportPreview(parseImportPreviewShared(ev.target?.result as string)); };
    reader.readAsText(file);
  }

  async function handleListImport() {
    if (!listImportFile) return;
    if (!listImportInstructorId) { toast.error('Select an instructor first'); return; }
    const preview = listImportPreview;
    const courseTitle = preview?.courseFields?.title || listImportFile.name.replace('.txt', '');
    setListImportLoading(true); setListImportResult(null);
    try {
      // Step 1: Create a course with basic fields from preview
      const pf = preview?.courseFields || {};
      const isFree = pf.is_free === 'true' || pf.is_free === '1' || pf.is_free === 'yes';
      const createPayload: any = { instructor_id: Number(listImportInstructorId), title: courseTitle, level: pf.level || 'beginner', is_free: isFree, requires_verification: true };
      if (!isFree && pf.price) createPayload.price = Number(pf.price);
      if (pf.original_price) createPayload.original_price = Number(pf.original_price);
      if (pf.subtitle) createPayload.subtitle = pf.subtitle;
      const createRes = await api.createAuthoringCourse(createPayload);
      if (!createRes.success) { toast.error(createRes.error || 'Failed to create course'); setListImportLoading(false); return; }
      const newCourseId = createRes.data.id;
      // Step 2: Import the file into the new course
      const importRes = await api.importCourseStructure(newCourseId, listImportFile);
      if (importRes.success) {
        setListImportResult({ ...importRes.data, courseId: newCourseId, courseTitle });
        toast.success(importRes.message || 'Course imported!');
        fetchCourses(); refreshStats();
      } else {
        toast.error(importRes.message || 'Import failed');
        setListImportResult({ error: importRes.message });
      }
    } catch (e: any) { toast.error(e.message || 'Import failed'); setListImportResult({ error: e.message }); }
    setListImportLoading(false);
  }

  function openImportedCourse() {
    if (!listImportResult?.courseId) return;
    setListImportOpen(false);
    (async () => {
      try {
        const r = await api.getAuthoringCourse(listImportResult.courseId);
        if (r.success && r.data) { openEdit(r.data); }
      } catch { toast.error('Failed to open course'); }
    })();
  }

  async function refreshReadiness(courseId: number) {
    // Defensive: a failed readiness call (e.g. API not yet restarted) must never
    // crash the editor. On error we clear readiness so Submit isn't blocked —
    // the API re-checks readiness on submit anyway.
    try {
      const r = await api.authoringCourseReadiness(courseId);
      setReadiness(r?.success ? r.data : null);
    } catch {
      setReadiness(null);
    }
  }

  /* ── list ── */
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const qs = showTrash
        ? `?limit=100&sort=id&order=desc&show_deleted=true`
        : `?limit=100&sort=id&order=desc${statusFilter ? `&status=${statusFilter}` : ''}`;
      const r = await api.listAuthoringCourses(qs);
      setCourses(r.data || []);
    } catch { toast.error('Failed to load instructor courses'); }
    setLoading(false);
  }, [statusFilter, showTrash]);

  const refreshStats = useCallback(async () => {
    try {
      const [t, p, q, tr] = await Promise.all([
        api.listAuthoringCourses('?limit=1'),
        api.listAuthoringCourses('?limit=1&status=published'),
        api.listAuthoringCourses('?limit=1&status=pending_approval'),
        api.listAuthoringCourses('?limit=1&show_deleted=true'),
      ]);
      setStats({
        total: t.pagination?.total || 0,
        published: p.pagination?.total || 0,
        pending: q.pagination?.total || 0,
        trash: tr.pagination?.total || 0,
      });
    } catch { /* non-fatal */ }
  }, []);

  // Reset selection when switching filters / trash
  useEffect(() => { setSelectedIds(new Set()); }, [showTrash, statusFilter]);

  useEffect(() => { if (view === 'list') { fetchCourses(); refreshStats(); } }, [view, fetchCourses, refreshStats]);
  useEffect(() => {
    (async () => {
      // category / sub_category base `name` columns are null on this DB — the
      // display name lives in the *_translations tables. Resolve the English name.
      const langRes = await api.listLanguages('?is_active=true&limit=50');
      const langs = langRes.data || [];
      setLanguages(langs);
      const enId = langs.find((l: any) => l.iso_code === 'en')?.id;

      const [catRes, subRes, catTr, subTr] = await Promise.all([
        api.listCategories('?limit=500&is_active=true'),
        api.listSubCategories('?limit=1000&is_active=true'),
        api.listCategoryTranslations('?limit=1000'),
        api.listSubCategoryTranslations('?limit=2000'),
      ]);
      const catName = new Map<number, string>();
      for (const t of (catTr.data || [])) { if ((!enId || t.language_id === enId) && t.name) catName.set(t.category_id, t.name); }
      const subName = new Map<number, string>();
      for (const t of (subTr.data || [])) { if ((!enId || t.language_id === enId) && t.name) subName.set(t.sub_category_id, t.name); }
      setCategories((catRes.data || []).map((c: any) => ({ ...c, name: c.name || catName.get(c.id) || c.code || `#${c.id}` })));
      setSubCategories((subRes.data || []).map((s: any) => ({ ...s, name: s.name || subName.get(s.id) || s.code || `#${s.id}` })));
    })();
    // Only instructor-type users may own a course.
    api.listUsers('?limit=500&type=instructor').then(r => { if (r.success) setInstructors(r.data || []); });
  }, []);

  /* ── restore from URL params on mount ── */
  const [urlRestored, setUrlRestored] = useState(false);
  useEffect(() => {
    if (urlRestored) return;
    const paramId = searchParams.get('id');
    const paramTab = searchParams.get('tab') as Tab | null;
    if (paramId) {
      (async () => {
        try {
          const r = await api.getAuthoringCourse(Number(paramId));
          if (r.success && r.data) {
            setCourse(r.data);
            setForm({ ...r.data, language_id: r.data.language_id ?? '', category_id: r.data.category_id ?? '', price: r.data.price ?? '', original_price: r.data.original_price ?? '' });
            if (paramTab) setTab(paramTab);
            else setTab('basics');
            setView('edit');
            await loadChildren(r.data.id);
          }
        } catch { /* non-fatal: just land on list */ }
      })();
    }
    setUrlRestored(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Push ?id & ?tab to the URL bar (no page reload) */
  function syncUrl(courseId?: number | null, activeTab?: string) {
    const params = new URLSearchParams();
    if (courseId) params.set('id', String(courseId));
    if (activeTab) params.set('tab', activeTab);
    const qs = params.toString();
    router.replace(qs ? `/course-builder?${qs}` : '/course-builder', { scroll: false });
  }

  /* ── open editor ── */
  function openCreate() {
    setCourse(null);
    setForm({ title: '', subtitle: '', short_intro: '', long_intro: '', level: 'beginner', language_id: '', category_id: '', price: '', original_price: '', is_free: false, thumbnail_url: '', trailer_video: '', has_certificate: false, requires_verification: true });
    setHighlights([]); setUnits([]); setFaqs([]); setReadiness(null);
    setTab('basics'); setView('edit');
    syncUrl(null, 'basics');
  }
  async function openEdit(c: any) {
    setCourse(c);
    setForm({ ...c, language_id: c.language_id ?? '', category_id: c.category_id ?? '', price: c.price ?? '', original_price: c.original_price ?? '' });
    setTab('basics'); setView('edit');
    syncUrl(c.id, 'basics');
    await loadChildren(c.id);
  }
  async function loadChildren(courseId: number) {
    const [cr, h, u, f, cp, mp] = await Promise.all([
      api.getAuthoringCourse(courseId),
      api.listAuthoringHighlights(courseId), api.listAuthoringUnits(courseId), api.listAuthoringFaqs(courseId),
      api.listAuthoringCapstones(courseId), api.listAuthoringMiniProjects(courseId),
    ]);
    // Re-sync the course record so status badge reflects any re-approval reset
    if (cr.success && cr.data) { setCourse(cr.data); setForm((prev: any) => ({ ...prev, ...cr.data })); }
    setHighlights(h.data || []); setUnits(u.data || []); setFaqs(f.data || []);
    setCapstones(cp.data || []); setMiniProjects(mp.data || []);
    refreshReadiness(courseId);
  }

  /* ── basics save ── */
  async function saveBasics() {
    if (!form.instructor_id) { toast.error('Select the instructor this course belongs to'); return; }
    if (!form.title?.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    const payload: any = { ...form };
    ['language_id', 'category_id'].forEach(k => { payload[k] = payload[k] === '' ? null : Number(payload[k]); });
    ['price', 'original_price'].forEach(k => { payload[k] = payload[k] === '' || payload[k] == null ? null : Number(payload[k]); });
    try {
      if (course?.id) {
        const r = await api.updateAuthoringCourse(course.id, payload);
        if (r.success) { setCourse(r.data); refreshReadiness(course.id); toast.success('Saved'); } else toast.error(r.error || 'Save failed');
      } else {
        const r = await api.createAuthoringCourse(payload);
        if (r.success) { setCourse(r.data); setForm({ ...form, ...r.data }); refreshReadiness(r.data.id); syncUrl(r.data.id, 'basics'); toast.success('Draft created — now add curriculum'); }
        else toast.error(r.error || 'Create failed');
      }
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
    setSaving(false);
  }

  async function doSubmit() {
    if (!course?.id) return;
    const r = await api.submitAuthoringCourse(course.id);
    if (r.success) { setCourse(r.data); toast.success('Submitted for review'); } else toast.error(r.error || 'Failed');
  }
  async function doVerify() {
    if (!course?.id) return;
    if (!confirm('Verify and publish this instructor course?')) return;
    const r = await api.verifyAuthoringCourse(course.id);
    if (r.success) { setCourse(r.data); toast.success('Verified & published'); } else toast.error(r.error || 'Failed');
  }
  async function doReject() {
    if (!course?.id) return;
    const reason = prompt('Rejection reason (optional):') ?? '';
    const r = await api.rejectAuthoringCourse(course.id, { rejection_reason: reason });
    if (r.success) { setCourse(r.data); toast.success('Rejected'); } else toast.error(r.error || 'Failed');
  }
  async function doDelete(c: any) {
    if (!confirm(`Move "${c.title}" to trash?`)) return;
    const r = await api.softDeleteAuthoringCourse(c.id);
    if (r.success) { toast.success('Moved to trash'); fetchCourses(); refreshStats(); } else toast.error(r.error || 'Failed');
  }
  async function doRestore(c: any) {
    const r = await api.restoreAuthoringCourse(c.id);
    if (r.success) { toast.success('Restored'); fetchCourses(); refreshStats(); } else toast.error(r.error || 'Failed');
  }
  async function doPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.title}"? This removes its curriculum, highlights & FAQs and cannot be undone.`)) return;
    const r = await api.deleteAuthoringCourse(c.id);
    if (r.success) { toast.success('Permanently deleted'); fetchCourses(); refreshStats(); } else toast.error(r.error || 'Failed');
  }

  async function openView(c: any) {
    setViewing(c);
    setViewLoading(true);
    try {
      const [cr, h, u, f, cp, mp] = await Promise.all([
        api.getAuthoringCourse(c.id),
        api.listAuthoringHighlights(c.id),
        api.listAuthoringUnits(c.id),
        api.listAuthoringFaqs(c.id),
        api.listAuthoringCapstones(c.id),
        api.listAuthoringMiniProjects(c.id),
      ]);
      if (cr.success && cr.data) setViewing(cr.data);
      setViewChildren({
        highlights: h.data || [],
        units: u.data || [],
        faqs: f.data || [],
        capstones: cp.data || [],
        miniProjects: mp.data || [],
      });
    } catch { /* non-fatal — dialog still shows basic info */ }
    setViewLoading(false);
  }

  /* ── bulk-select helpers ── */
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === courses.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(courses.map(c => c.id)));
  }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} course(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteAuthoringCourse(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} course(s) moved to trash`);
    setSelectedIds(new Set()); fetchCourses(); refreshStats();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} course(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreAuthoringCourse(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} course(s) restored`);
    setSelectedIds(new Set()); fetchCourses(); refreshStats();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} course(s)? This removes all curriculum, highlights & FAQs and cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteAuthoringCourse(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} course(s) permanently deleted`);
    setSelectedIds(new Set()); fetchCourses(); refreshStats();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  /* ─────────────── LIST VIEW ─────────────── */
  if (view === 'list') {
    const STAT_CARDS = [
      { label: 'Total Courses', value: stats.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
      { label: 'Published', value: stats.published, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600' },
      { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'bg-amber-50 text-amber-600' },
      { label: 'In Trash', value: stats.trash, icon: Trash2, color: 'bg-amber-50 text-amber-600' },
    ];
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Instructor Courses"
          description="Create instructor courses with curriculum, exercises & FAQs — verified before going live"
          actions={!showTrash ? <div className="flex gap-2"><Button variant="outline" onClick={() => { setListImportOpen(true); setListImportFile(null); setListImportPreview(null); setListImportResult(null); setListImportInstructorId(''); }}><Upload className="w-4 h-4" /> Import from File</Button><Button onClick={openCreate}><Plus className="w-4 h-4" /> Add course</Button></div> : undefined}
        />

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          {STAT_CARDS.map((card) => {
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

        {/* Courses / Trash tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
          <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>Courses</button>
          <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
            <Trash2 className="w-3.5 h-3.5" /> Trash
            {stats.trash > 0 && <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{stats.trash}</span>}
          </button>
        </div>

        {/* Status filter (normal view only) */}
        {!showTrash && (
          <div className="mb-4">
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[{ value: '', label: 'All Statuses' }, { value: 'draft', label: 'Draft' }, { value: 'pending_approval', label: 'Pending Approval' }, { value: 'published', label: 'Published' }, { value: 'rejected', label: 'Rejected' }]} />
          </div>
        )}

        <div className={cn('bg-white rounded-xl border overflow-hidden', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action bar */}
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

          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={courses.length > 0 && selectedIds.size === courses.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></th>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Level</th>
                <th className="text-left px-4 py-3">Price</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Verified</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : courses.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">{showTrash ? 'Trash is empty' : 'No courses yet. Click "Add course".'}</td></tr>
              ) : courses.map(c => (
                <tr key={c.id} className={cn('hover:bg-slate-50', showTrash && 'bg-amber-50/30', selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.title}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{c.level}</td>
                  <td className="px-4 py-3 text-slate-600">{c.is_free ? 'Free' : `₹${c.price ?? 0}`}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">{c.verified_at ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><ShieldCheck className="w-4 h-4" /> Yes</span> : <span className="text-slate-400 text-xs">No</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {showTrash ? (
                      <>
                        <button onClick={() => doRestore(c)} className="p-1.5 text-slate-400 hover:text-emerald-600" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => doPermanentDelete(c)} className="p-1.5 text-slate-400 hover:text-red-600" title="Delete permanently"><Trash2 className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => openView(c)} className="p-1.5 text-slate-400 hover:text-sky-600" title="View details"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => doDelete(c)} className="p-1.5 text-slate-400 hover:text-red-600" title="Trash"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── View Details Dialog ── */}
        <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Course Details" size="lg">
          {viewing && (
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start gap-4">
                {viewing.thumbnail_url ? (
                  <img src={viewing.thumbnail_url} alt="" className="w-24 h-16 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
                ) : (
                  <div className="w-24 h-16 rounded-lg bg-violet-50 flex items-center justify-center border border-violet-200 flex-shrink-0">
                    <BookOpen className="w-8 h-8 text-violet-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">{viewing.title}</h3>
                  {viewing.subtitle && <p className="text-sm text-slate-500 mt-0.5">{viewing.subtitle}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <StatusBadge status={viewing.status} />
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">{viewing.level}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{viewing.is_free ? 'Free' : `₹${viewing.price ?? 0}`}</span>
                    {viewing.verified_at && <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck className="w-3 h-3" /> Verified</span>}
                    {viewing.has_certificate && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Certificate</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-1.5">
                    Instructor: {instructors.find((i: any) => i.id === viewing.instructor_id)?.full_name || instructors.find((i: any) => i.id === viewing.instructor_id)?.email || `#${viewing.instructor_id}`}
                    {viewing.category_id && <> · Category: {subCategories.find((s: any) => s.id === viewing.category_id)?.name || `#${viewing.category_id}`}</>}
                  </div>
                </div>
              </div>

              {/* Short intro */}
              {viewing.short_intro && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Short Intro</dt>
                  <dd className="text-sm text-slate-700">{viewing.short_intro}</dd>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <div><dt className="text-xs font-medium text-slate-400 uppercase">Price</dt><dd className="text-sm text-slate-800 mt-0.5">{viewing.is_free ? 'Free' : `₹${viewing.price ?? '--'}`}</dd></div>
                <div><dt className="text-xs font-medium text-slate-400 uppercase">Original Price</dt><dd className="text-sm text-slate-800 mt-0.5">{viewing.original_price ? `₹${viewing.original_price}` : '--'}</dd></div>
                <div><dt className="text-xs font-medium text-slate-400 uppercase">Language</dt><dd className="text-sm text-slate-800 mt-0.5">{languages.find((l: any) => l.id === viewing.language_id)?.name || '--'}</dd></div>
                <div><dt className="text-xs font-medium text-slate-400 uppercase">Created</dt><dd className="text-sm text-slate-800 mt-0.5">{viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'}</dd></div>
                <div><dt className="text-xs font-medium text-slate-400 uppercase">Updated</dt><dd className="text-sm text-slate-800 mt-0.5">{viewing.updated_at ? new Date(viewing.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '--'}</dd></div>
                {viewing.rejection_reason && <div className="col-span-3"><dt className="text-xs font-medium text-red-400 uppercase">Rejection Reason</dt><dd className="text-sm text-red-700 mt-0.5">{viewing.rejection_reason}</dd></div>}
              </div>

              {viewLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : (
                <>
                  {/* Highlights */}
                  {viewChildren.highlights.length > 0 && (() => {
                    const kindColors: Record<string, { bg: string; text: string; border: string }> = {
                      audience:     { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200' },
                      outcome:      { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200' },
                      prerequisite: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
                      requirement:  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                      skill:        { bg: 'bg-teal-50',   text: 'text-teal-700',   border: 'border-teal-200' },
                    };
                    const fallback = { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' };
                    return (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-violet-500" /> Highlights ({viewChildren.highlights.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {viewChildren.highlights.map((h: any) => {
                            const c = kindColors[h.kind] || fallback;
                            return (
                              <span key={h.id} className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border', c.bg, c.text, c.border)}>
                                <span className="font-semibold capitalize">{h.kind}:</span> {h.text}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* FAQs */}
                  {viewChildren.faqs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4 text-violet-500" /> FAQs ({viewChildren.faqs.length})</h4>
                      <div className="space-y-2">
                        {viewChildren.faqs.map((faq: any) => (
                          <div key={faq.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="text-sm font-medium text-slate-800">Q: {faq.question}</div>
                            <div className="text-xs text-slate-500 mt-1">A: {faq.answer}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Capstones & Mini Projects side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    {viewChildren.capstones.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><Package className="w-4 h-4 text-violet-500" /> Capstones ({viewChildren.capstones.length})</h4>
                        <div className="space-y-1">
                          {viewChildren.capstones.map((cp: any) => (
                            <div key={cp.id} className="text-xs text-slate-600 flex items-center gap-1.5">
                              <span className="w-1 h-1 bg-slate-400 rounded-full" /> {cp.title}
                              {cp.solution_github_url && <a href={cp.solution_github_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">git</a>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {viewChildren.miniProjects.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><FlaskConical className="w-4 h-4 text-violet-500" /> Mini Projects ({viewChildren.miniProjects.length})</h4>
                        <div className="space-y-1">
                          {viewChildren.miniProjects.map((mp: any) => (
                            <div key={mp.id} className="text-xs text-slate-600 flex items-center gap-1.5">
                              <span className="w-1 h-1 bg-slate-400 rounded-full" /> {mp.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Curriculum tree */}
                  {viewChildren.units.length > 0 && (() => {
                    const vu = viewChildren.units;
                    const mods = vu.filter((x: any) => x.unit_type === 'module');
                    const chaps = vu.filter((x: any) => x.unit_type === 'chapter');
                    const topics = vu.filter((x: any) => x.unit_type === 'topic');
                    const childOf = (pid: number) => vu.filter((x: any) => x.parent_unit_id === pid);
                    const vFileSlots = (t: any) => {
                      const hasVid = t.video || t.youtube_url;
                      return [
                        { label: t.video ? 'Bunny Stream Video' : t.youtube_url ? 'YouTube / External' : 'Video', url: t.video || t.youtube_url || null, color: 'text-orange-600', uploaded: !!hasVid },
                        { label: 'Exercise PDF',     url: t.exercise_pdf || null,              color: 'text-emerald-600', uploaded: !!t.exercise_pdf },
                        { label: 'Exercise Solution', url: t.exercise_solution_pdf || null,     color: 'text-teal-600',    uploaded: !!t.exercise_solution_pdf },
                        { label: 'Assignment PDF',   url: t.assignment_pdf || null,            color: 'text-blue-600',    uploaded: !!t.assignment_pdf },
                        { label: 'Article PDF',       url: t.article_pdf || null,              color: 'text-indigo-600',  uploaded: !!t.article_pdf },
                        { label: 'Project PDF',       url: t.project_pdf || null,              color: 'text-purple-600',  uploaded: !!t.project_pdf },
                        { label: 'Project Solution',  url: t.project_solution_file_url || null, color: 'text-fuchsia-600', uploaded: !!t.project_solution_file_url },
                      ];
                    };
                    const ViewTopicLine = ({ t }: { t: any }) => {
                      const slots = vFileSlots(t);
                      const uploaded = slots.filter(s => s.uploaded).length;
                      const remaining = slots.length - uploaded;
                      const hasVid = !!(t.video || t.youtube_url);
                      return (
                        <div className="ml-5 mt-1">
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <FileText className="w-3.5 h-3.5 text-violet-400" />
                            <span className="font-medium text-slate-600">{t.title}</span>
                            {hasVid && <span className="font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 text-[10px]">video</span>}
                            {t.is_free_preview && <span className="font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px]">free</span>}
                            <span className="text-slate-400">{uploaded}/{slots.length} files</span>
                            {remaining > 0 && <span className="text-amber-500 text-[10px]">{remaining} remaining</span>}
                          </div>
                          <div className="ml-4 mt-0.5 space-y-px">
                            {slots.map((f, i) => (
                              <div key={f.label} className="flex items-center gap-1.5 text-[11px]">
                                <span className="text-slate-300 select-none w-3 text-center">{i === slots.length - 1 ? '└' : '├'}</span>
                                {f.uploaded && f.url ? (
                                  <a href={f.url} target="_blank" rel="noopener noreferrer" className={cn('hover:underline flex items-center gap-1', f.color)}>
                                    {f.label} <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                  </a>
                                ) : (
                                  <span className="text-slate-300 italic">{f.label} — not uploaded</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    };
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><FolderTree className="w-4 h-4 text-violet-500" /> Curriculum</h4>
                          <span className="text-xs text-slate-400">{mods.length} modules · {chaps.length} chapters · {topics.length} topics</span>
                        </div>
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
                          {mods.map((m: any) => (
                            <div key={m.id} className="px-3 py-2">
                              <div className="flex items-center gap-2 font-medium text-slate-700"><Package className="w-3.5 h-3.5 text-amber-500" /> {m.title}
                                <span className="text-[10px] text-slate-400 font-normal">{childOf(m.id).filter((x: any) => x.unit_type === 'chapter').length} ch · {childOf(m.id).filter((x: any) => x.unit_type === 'topic').length + childOf(m.id).filter((x: any) => x.unit_type === 'chapter').flatMap((ch: any) => childOf(ch.id)).length} topics</span>
                              </div>
                              {childOf(m.id).map((ch: any) => ch.unit_type === 'chapter' ? (
                                <div key={ch.id} className="ml-5 mt-1.5">
                                  <div className="flex items-center gap-2 text-slate-600"><FolderTree className="w-3.5 h-3.5 text-blue-400" /> {ch.title}
                                    <span className="text-[10px] text-slate-400">{childOf(ch.id).length} topics</span>
                                  </div>
                                  {childOf(ch.id).map((t: any) => <ViewTopicLine key={t.id} t={t} />)}
                                </div>
                              ) : (
                                <ViewTopicLine key={ch.id} t={ch} />
                              ))}
                            </div>
                          ))}
                        </div>
                        {/* Orphan / unassigned topics — NULL parent or deleted parent */}
                        {(() => {
                          const vuIds = new Set(vu.map((x: any) => x.id));
                          const orphans = vu.filter((x: any) => x.unit_type === 'topic' && (!x.parent_unit_id || !vuIds.has(x.parent_unit_id)));
                          if (!orphans.length) return null;
                          return (
                            <div className="mt-2 border border-amber-300 rounded-lg bg-amber-50/50 text-sm">
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 rounded-t-lg font-medium text-amber-800">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Unassigned Topics ({orphans.length})
                                <span className="text-[10px] text-amber-600 font-normal ml-auto">not inside any module</span>
                              </div>
                              {orphans.map((t: any) => <ViewTopicLine key={t.id} t={t} />)}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
                <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Pencil className="w-4 h-4" /> Edit</Button>
              </div>
            </div>
          )}
        </Dialog>

        {/* ── Import Full Course Dialog (listing page) ── */}
        <Dialog open={listImportOpen} onClose={() => !listImportLoading && setListImportOpen(false)} title="Import Full Course from Text File" size="lg">
          <div className="space-y-4 p-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-slate-500">Upload a <code className="bg-slate-100 px-1 rounded text-xs">.txt</code> file to create a new course with details, highlights, FAQs, and curriculum — all at once.</p>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={downloadListImportSample} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 transition-colors whitespace-nowrap border border-emerald-200 rounded-md px-2.5 py-1.5 hover:bg-emerald-50">
                  <Download className="w-3.5 h-3.5" /> Sample file
                </button>
                <button onClick={() => setListImportHelpOpen(true)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap border border-blue-200 rounded-md px-2.5 py-1.5 hover:bg-blue-50">
                  <HelpCircle className="w-3.5 h-3.5" /> How to use
                </button>
              </div>
            </div>

            {/* Instructor selector */}
            {!listImportResult && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Instructor <span className="text-red-500">*</span></label>
                <Select value={listImportInstructorId} onChange={e => setListImportInstructorId(e.target.value)} disabled={listImportLoading} options={[{ value: '', label: 'Select instructor...' }, ...instructors.map((i: any) => ({ value: String(i.id), label: i.full_name || i.email }))]} />
              </div>
            )}

            {/* File upload */}
            {!listImportResult && (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors">
                <input type="file" accept=".txt" onChange={handleListImportFile} className="hidden" id="list-import-input" disabled={listImportLoading} />
                <label htmlFor="list-import-input" className="cursor-pointer">
                  {listImportFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-slate-700">{listImportFile.name}</span>
                      <span className="text-xs text-slate-400">({(listImportFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to upload .txt file</p>
                      <p className="text-xs text-slate-400 mt-1">Sections: [COURSE], [HIGHLIGHTS], [FAQ], [CURRICULUM]</p>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* Preview */}
            {listImportPreview && !listImportResult && (listImportPreview.hasCourse || listImportPreview.hasHighlights || listImportPreview.hasFaq || listImportPreview.hasCurriculum) && (() => {
              const lpHighlightColors: Record<string, string> = { prerequisite: 'text-amber-600', outcome: 'text-emerald-600', skill: 'text-sky-600', audience: 'text-violet-600', requirement: 'text-rose-600' };
              return (
              <div className="border border-slate-200 rounded-lg p-4 max-h-80 overflow-auto bg-slate-50 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <FolderTree className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Preview</span>
                  <div className="flex gap-1.5 ml-auto">
                    {listImportPreview.hasCourse && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">COURSE</span>}
                    {listImportPreview.hasHighlights && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{listImportPreview.highlights.length} HIGHLIGHTS</span>}
                    {listImportPreview.hasFaq && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{listImportPreview.faqs.length} FAQs</span>}
                    {listImportPreview.hasCurriculum && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">{listImportPreview.modules.length} MODULES</span>}
                  </div>
                </div>
                {/* Course details */}
                {listImportPreview.hasCourse && Object.keys(listImportPreview.courseFields).length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-xs font-semibold text-blue-700 mb-1.5">Course Details</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(listImportPreview.courseFields).map(([k, v]: [string, any]) => (
                        <div key={k} className="flex gap-1.5 text-xs"><span className="text-blue-600 font-medium min-w-[90px]">{k}:</span><span className="text-slate-600 truncate">{String(v)}</span></div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Highlights detail */}
                {listImportPreview.hasHighlights && listImportPreview.highlights.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <p className="text-xs font-semibold text-green-700 mb-1.5">Highlights ({listImportPreview.highlights.length})</p>
                    <div className="space-y-0.5">
                      {listImportPreview.highlights.map((h: any, i: number) => (
                        <div key={i} className="flex gap-1.5 text-xs">
                          <span className={cn('font-medium min-w-[80px]', lpHighlightColors[h.kind] || 'text-slate-500')}>{h.kind}:</span>
                          <span className="text-slate-600">{h.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* FAQ detail */}
                {listImportPreview.hasFaq && listImportPreview.faqs.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1.5">FAQs ({listImportPreview.faqs.length})</p>
                    <div className="space-y-1.5">
                      {listImportPreview.faqs.map((f: any, i: number) => (
                        <div key={i} className="text-xs">
                          <div className="font-medium text-slate-700">Q: {f.question}</div>
                          <div className="text-slate-500 pl-3 truncate">A: {f.answer}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Curriculum tree */}
                {listImportPreview.hasCurriculum && listImportPreview.modules.length > 0 && (
                  <div className="bg-violet-50 border border-violet-200 rounded-md p-3">
                    <p className="text-xs font-semibold text-violet-700 mb-1.5">
                      Curriculum ({listImportPreview.modules.length} module{listImportPreview.modules.length !== 1 ? 's' : ''}, {listImportPreview.modules.reduce((a: number, m: any) => a + m.chapters.length, 0)} chapters, {listImportPreview.modules.reduce((a: number, m: any) => a + m.chapters.reduce((b: number, c: any) => b + c.topics.length, 0), 0)} topics)
                    </p>
                    {listImportPreview.modules.map((mod: any, mi: number) => (
                      <div key={mi} className="mb-2">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                          <Package className="w-3.5 h-3.5" /> {mod.title}
                          {mod.summary && <span className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]">— {mod.summary}</span>}
                        </div>
                        {mod.chapters.map((ch: any, ci: number) => (
                          <div key={ci} className="ml-5 mt-1">
                            <div className="flex items-center gap-1.5 text-sm text-blue-600">
                              <ChevronRight className="w-3 h-3" /> {ch.title}
                              {ch.summary && <span className="text-[10px] text-slate-400 truncate max-w-[180px]">— {ch.summary}</span>}
                            </div>
                            {ch.topics.map((t: any, ti: number) => (
                              <div key={ti} className="ml-5 mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                <FileText className="w-3 h-3 text-violet-400" />
                                <span>{t.title}</span>
                                {t.youtube_url && <span className="text-[10px] font-medium text-sky-600 bg-sky-50 px-1 rounded">video</span>}
                                {t.is_free_preview && <span className="text-[10px] text-green-600 bg-green-50 px-1 rounded">free</span>}
                                {t.points && <span className="text-[10px] text-violet-600">{t.points}pts</span>}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              );
            })()}

            {/* Result */}
            {listImportResult && !listImportResult.error && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="font-semibold text-emerald-800 mb-2">Course Created &amp; Imported!</p>
                <p className="text-sm text-emerald-700 mb-3">Course <strong>&quot;{listImportResult.courseTitle}&quot;</strong> has been created successfully.</p>
                <div className="space-y-2 text-xs text-slate-600">
                  {listImportResult.report?.course && <p>Course details updated</p>}
                  {(listImportResult.report?.highlights?.added > 0) && <p>{listImportResult.report.highlights.added} highlights added</p>}
                  {(listImportResult.report?.faqs?.added > 0) && <p>{listImportResult.report.faqs.added} FAQs added</p>}
                  {(listImportResult.report?.created?.modules > 0 || listImportResult.report?.created?.chapters > 0) && (
                    <p>Curriculum: {listImportResult.report.created.modules} modules, {listImportResult.report.created.chapters} chapters, {listImportResult.report.created.topics} topics</p>
                  )}
                </div>
                {listImportResult.report?.errors?.length > 0 && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                    {listImportResult.report.errors.map((e: string, i: number) => <p key={i}>• {e}</p>)}
                  </div>
                )}
              </div>
            )}
            {listImportResult?.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{listImportResult.error}</div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setListImportOpen(false)} disabled={listImportLoading}>
                {listImportResult ? 'Close' : 'Cancel'}
              </Button>
              {listImportResult && !listImportResult.error && (
                <Button onClick={openImportedCourse}><Pencil className="w-4 h-4" /> Open Course Editor</Button>
              )}
              {!listImportResult && listImportPreview && (listImportPreview.hasCourse || listImportPreview.hasCurriculum) && (
                <Button onClick={handleListImport} disabled={listImportLoading || !listImportInstructorId}>
                  {listImportLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Creating &amp; Importing...</>) : (<><Upload className="w-4 h-4" /> Create Course &amp; Import</>)}
                </Button>
              )}
            </div>
          </div>
        </Dialog>

        {/* ── Listing Import Help Dialog ── */}
        <Dialog open={listImportHelpOpen} onClose={() => setListImportHelpOpen(false)} title="How to Import Course from Text File" size="lg">
          <div className="space-y-4 p-2 text-sm text-slate-700">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="font-semibold text-slate-800 mb-2">File Structure — 4 Sections</p>
              <p>Use <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">[SECTION]</code> markers to separate different parts. All sections are optional.</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> <code>[COURSE]</code> — Title, price, level, etc.</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-500" /> <code>[HIGHLIGHTS]</code> — Prerequisites, outcomes, skills</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> <code>[FAQ]</code> — Q&amp;A pairs</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-violet-500" /> <code>[CURRICULUM]</code> — Modules, chapters, topics</div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="font-semibold text-blue-800 mb-1">[COURSE] — key: value</p>
              <p className="text-xs text-slate-600">Keys: title, subtitle, short_intro, long_intro, level, price, original_price, is_free, has_certificate, category_id, language_id</p>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="font-semibold text-green-800 mb-1">[HIGHLIGHTS] — kind: text</p>
              <p className="text-xs text-slate-600">Kinds: prerequisite, outcome, skill, audience, requirement</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <p className="font-semibold text-amber-800 mb-1">[FAQ] — Q: / A: pairs</p>
              <p className="text-xs text-slate-600">Each question on a <code>Q:</code> line, answer on the next <code>A:</code> line</p>
            </div>
            <div className="bg-violet-50 border border-violet-100 rounded-lg p-4">
              <p className="font-semibold text-violet-800 mb-1">[CURRICULUM] — tab-indented tree</p>
              <p className="text-xs text-slate-600">0 tabs = Module, 1 tab = Chapter, 2 tabs = Topic. Properties: summary, is_free_preview, points, youtube_url. Files are uploaded via the UI.</p>
            </div>
            <div className="flex justify-end"><Button variant="outline" onClick={() => setListImportHelpOpen(false)}>Close</Button></div>
          </div>
        </Dialog>
      </div>
    );
  }

  /* ─────────────── EDIT VIEW ─────────────── */
  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'basics', label: 'Basics', icon: BookOpen },
    { id: 'highlights', label: 'Highlights', icon: ClipboardList },
    { id: 'curriculum', label: 'Curriculum', icon: FolderTree },
    { id: 'capstones', label: 'Capstones', icon: Package },
    { id: 'mini-projects', label: 'Mini Projects', icon: FlaskConical },
    { id: 'faqs', label: 'FAQs', icon: FileText },
  ];
  const needsCourse = !course?.id;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => { setView('list'); syncUrl(); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold text-slate-800">{course?.title || 'New Course'}</h1>
        {course?.status && <StatusBadge status={course.status} />}
      </div>
      <p className="text-sm text-slate-500 ml-10 mb-4">{needsCourse ? 'Fill the basics and save to unlock curriculum, highlights & FAQs.' : 'Instructor draft — must be verified by a super admin before it goes live.'}</p>

      {/* workflow actions */}
      {course?.id && (
        <div className="ml-10 mb-4">
          <div className="flex flex-wrap gap-2 items-center">
            {(course.status === 'draft' || course.status === 'rejected') && (
              <Button size="sm" variant="outline" onClick={doSubmit} disabled={!!readiness && !readiness.ready} title={readiness && !readiness.ready ? 'Complete the checklist first' : ''}>
                <Send className="w-4 h-4" /> Submit for review
              </Button>
            )}
            {course.status === 'pending_approval' && <>
              <Button size="sm" onClick={doVerify} className="bg-emerald-600 hover:bg-emerald-700 text-white"><CheckCircle className="w-4 h-4" /> Verify &amp; Publish</Button>
              <Button size="sm" variant="outline" onClick={doReject} className="text-red-600 border-red-200"><XCircle className="w-4 h-4" /> Reject</Button>
            </>}
            {course.status === 'rejected' && course.rejection_reason && <span className="text-xs text-red-600 self-center">Reason: {course.rejection_reason}</span>}
          </div>
          {(course.status === 'draft' || course.status === 'rejected') && readiness && !readiness.ready && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1"><AlertCircle className="w-3.5 h-3.5" /> Before you can submit:</div>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {readiness.problems.map((p, i) => <li key={i} className="flex items-center gap-1.5">• {p}</li>)}
              </ul>
            </div>
          )}
          {(course.status === 'draft' || course.status === 'rejected') && readiness && readiness.ready && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Ready to submit for review.</div>
          )}
        </div>
      )}

      {/* tabs */}
      <div className="flex gap-1 border-b border-slate-200 ml-10 mb-5">
        {TABS.map(t => (
          <button key={t.id} disabled={t.id !== 'basics' && needsCourse} onClick={() => { setTab(t.id); syncUrl(course?.id, t.id); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tab === t.id ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="ml-10 max-w-4xl">
        {tab === 'basics' && <BasicsTab form={form} setForm={setForm} languages={languages} categories={categories} subCategories={subCategories} instructors={instructors} saving={saving} onSave={saveBasics} courseId={course?.id} onMedia={() => course?.id && refreshReadiness(course.id)} />}
        {tab === 'highlights' && course?.id && <HighlightsTab courseId={course.id} items={highlights} reload={() => loadChildren(course.id)} />}
        {tab === 'curriculum' && course?.id && <CurriculumTab courseId={course.id} units={units} reload={() => loadChildren(course.id)} />}
        {tab === 'capstones' && course?.id && <CapstonesTab courseId={course.id} items={capstones} reload={() => loadChildren(course.id)} />}
        {tab === 'mini-projects' && course?.id && <MiniProjectsTab courseId={course.id} items={miniProjects} units={units} reload={() => loadChildren(course.id)} />}
        {tab === 'faqs' && course?.id && <FaqsTab courseId={course.id} items={faqs} reload={() => loadChildren(course.id)} />}
      </div>
    </div>
  );
}

/* ════════════ Basics Tab ════════════ */
function BasicsTab({ form, setForm, languages, categories, subCategories, instructors, saving, onSave, courseId, onMedia }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const [thumbBusy, setThumbBusy] = useState(false);
  const [trailerProgress, setTrailerProgress] = useState<number | null>(null);

  // Category → Sub-category cascade. form.category_id stores the SUB-category id;
  // the parent Category is just a filter, derived from the chosen sub-category.
  const [catParent, setCatParent] = useState<string>('');
  useEffect(() => {
    if (form.category_id && subCategories?.length) {
      const sc = subCategories.find((s: any) => String(s.id) === String(form.category_id));
      if (sc) setCatParent(String(sc.category_id));
    }
  }, [form.category_id, subCategories]);
  const subOptions = subCategories
    .filter((s: any) => catParent && String(s.category_id) === String(catParent))
    .map((s: any) => ({ value: s.id, label: s.name }));

  async function onThumbnail(file: File | null) {
    if (!file) { set('thumbnail_url', null); return; }
    if (!courseId) { toast.error('Save basics first, then upload the thumbnail'); return; }
    setThumbBusy(true);
    const r = await api.uploadAuthoringThumbnail(courseId, file);
    setThumbBusy(false);
    if (r.success) { setForm({ ...form, thumbnail_url: r.data.thumbnail_url }); onMedia?.(); toast.success('Thumbnail uploaded'); }
    else toast.error(r.error || 'Upload failed');
  }
  async function onTrailerFile(file: File | null) {
    if (!file) {
      if (courseId) {
        try {
          await api.removeAuthoringTrailerVideo(courseId);
          setForm({ ...form, trailer_video: null }); onMedia?.(); toast.success('Trailer removed');
        } catch (e: any) { toast.error(e?.message || 'Remove failed'); }
      } else { set('trailer_video', null); }
      return;
    }
    if (!courseId) { toast.error('Save basics first, then upload the trailer'); return; }
    setTrailerProgress(0);
    try {
      const r = await api.uploadAuthoringTrailerVideo(courseId, file, p => setTrailerProgress(p));
      if (r.success) { setForm({ ...form, trailer_video: r.data.trailer_video }); onMedia?.(); toast.success('Trailer uploaded'); }
      else toast.error(r.error || 'Upload failed');
    } catch { toast.error('Upload failed'); }
    setTrailerProgress(null);
  }
  return (
    <div className="space-y-4">
      <Field label="Instructor *">
        <Select
          value={form.instructor_id || ''}
          onChange={e => set('instructor_id', e.target.value ? Number(e.target.value) : null)}
          options={[{ value: '', label: 'Select the instructor this course belongs to…' }, ...instructors.map((i: any) => ({ value: i.id, label: i.full_name || i.email || `User #${i.id}` }))]}
        />
        {instructors.length === 0 && <p className="text-xs text-amber-600 mt-1">No instructor-type users found. Add an instructor user first.</p>}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Title *"><Input value={form.title || ''} onChange={e => set('title', e.target.value)} placeholder="Flutter Development Internship" /></Field>
        <Field label="Subtitle"><Input value={form.subtitle || ''} onChange={e => set('subtitle', e.target.value)} placeholder="Short tagline" /></Field>
      </div>
      <Field label="Short intro"><textarea value={form.short_intro || ''} onChange={e => set('short_intro', e.target.value)} rows={2} className={taCls} placeholder="1-2 sentences" /></Field>
      <Field label="Long intro"><textarea value={form.long_intro || ''} onChange={e => set('long_intro', e.target.value)} rows={4} className={taCls} placeholder="Detailed description" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Level"><Select value={form.level || 'beginner'} onChange={e => set('level', e.target.value)} options={LEVELS} /></Field>
        <Field label="Language"><Select value={form.language_id || ''} onChange={e => set('language_id', e.target.value)} options={[{ value: '', label: 'Select…' }, ...languages.map((l: any) => ({ value: l.id, label: l.name }))]} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category">
          <SearchableSelect
            value={catParent}
            onChange={(v) => { setCatParent(v); set('category_id', null); }}
            options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
            placeholder="Select category…"
            searchPlaceholder="Search categories…"
          />
        </Field>
        <Field label="Sub-category">
          <SearchableSelect
            value={form.category_id || ''}
            onChange={(v) => set('category_id', v ? Number(v) : null)}
            options={subOptions}
            placeholder={catParent ? 'Select sub-category…' : 'Pick a category first'}
            searchPlaceholder="Search sub-categories…"
            disabled={!catParent}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Price (₹)"><Input type="number" min={0} value={form.price ?? ''} onChange={e => set('price', e.target.value)} disabled={form.is_free} /></Field>
        <Field label="Original price (₹)"><Input type="number" min={0} value={form.original_price ?? ''} onChange={e => set('original_price', e.target.value)} disabled={form.is_free} /></Field>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_free} onChange={e => { const c = e.target.checked; setForm({ ...form, is_free: c, ...(c ? { price: 0, original_price: 0 } : {}) }); }} /> Free</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.has_certificate} onChange={e => set('has_certificate', e.target.checked)} /> Certificate</label>
        </div>
      </div>
      {!courseId && <p className="text-xs text-amber-600">Save the basics first to enable thumbnail &amp; trailer uploads.</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <ImageUpload label="Thumbnail" value={form.thumbnail_url || null} onChange={(file) => onThumbnail(file)} hint="JPG / PNG / WebP · 1280×720 recommended" />
          {thumbBusy && <p className="text-xs text-violet-600 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</p>}
        </div>
        <VideoUpload
          label="Trailer video"
          value={form.trailer_video || null}
          progress={trailerProgress}
          onFileChange={onTrailerFile}
          onUrlChange={(url) => set('trailer_video', url)}
          onOpen={courseId ? async () => { const r = await api.authoringTrailerPlayback(courseId); if (r.success && r.data?.url) window.open(r.data.url, '_blank'); } : undefined}
          hint="Upload to Bunny Stream, or paste a YouTube/external URL"
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        Every instructor course is reviewed and verified by a super admin before it goes live.
      </div>
      <div className="pt-2"><Button onClick={onSave} disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save basics'}</Button></div>
    </div>
  );
}

/* ════════════ Highlights Tab ════════════ */
function HighlightsTab({ courseId, items, reload }: any) {
  const [kind, setKind] = useState('outcome');
  const [text, setText] = useState('');
  async function add() {
    if (!text.trim()) return;
    const r = await api.createAuthoringHighlight({ authoring_course_id: courseId, kind, text });
    if (r.success) { setText(''); reload(); } else toast.error(r.error || 'Failed');
  }
  async function del(id: number) { const r = await api.deleteAuthoringHighlight(id); if (r.success) reload(); else toast.error(r.error || 'Failed'); }
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="w-56"><Select value={kind} onChange={e => setKind(e.target.value)} options={HIGHLIGHT_KINDS} /></div>
        <Input value={text} onChange={e => setText(e.target.value)} placeholder="Add a bullet point…" onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <Button onClick={add}><Plus className="w-4 h-4" /> Add</Button>
      </div>
      {HIGHLIGHT_KINDS.map(k => {
        const rows = items.filter((i: any) => i.kind === k.value);
        if (rows.length === 0) return null;
        return (
          <div key={k.value}>
            <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{k.label}</div>
            <ul className="space-y-1">
              {rows.map((i: any) => (
                <li key={i.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                  <span className="text-slate-700">{i.text}</span>
                  <button onClick={() => del(i.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {items.length === 0 && <p className="text-sm text-slate-400">No highlights yet.</p>}
    </div>
  );
}

/* ════════════ Curriculum Tab ════════════ */
function CurriculumTab({ courseId, units, reload }: any) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [u, setU] = useState<any>({});
  const [vidProg, setVidProg] = useState<number | null>(null);
  const PDF_FIELD: Record<string, string> = { article: 'article_pdf', exercise: 'exercise_pdf', exercise_solution: 'exercise_solution_pdf', project: 'project_pdf', assignment: 'assignment_pdf', project_solution: 'project_solution_file_url' };

  // ── Import from text file state ──
  const [importOpen, setImportOpen] = useState(false);
  const [importHelpOpen, setImportHelpOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const HIGHLIGHT_KIND_COLORS: Record<string, string> = { prerequisite: 'text-amber-600', outcome: 'text-emerald-600', skill: 'text-sky-600', audience: 'text-violet-600', requirement: 'text-rose-600' };

  // Use the shared top-level parser
  const parseImportPreview = parseImportPreviewShared;

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImportFile(file); setImportResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => { setImportPreview(parseImportPreview(ev.target?.result as string)); };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!importFile) return;
    setImportLoading(true); setImportResult(null);
    try {
      const res = await api.importCourseStructure(courseId, importFile);
      if (res.success) { setImportResult(res.data); toast.success(res.message || 'Import completed!'); reload(); }
      else { toast.error(res.message || 'Import failed'); setImportResult({ error: res.message }); }
    } catch (e: any) { toast.error(e.message || 'Import failed'); setImportResult({ error: e.message }); }
    setImportLoading(false);
  }

  function downloadSampleFile() {
    const sample = `# Sample: Full Course Import
# This file imports course details, highlights, FAQs, AND curriculum
# All sections are optional — include only what you need
# Lines starting with # are comments (ignored)

[COURSE]
title: Introduction to Web Development
subtitle: Build modern websites from scratch
short_intro: Learn HTML, CSS, and JavaScript step by step
long_intro: This comprehensive course takes you from absolute beginner to building complete websites. You will learn the core technologies of the web — HTML for structure, CSS for styling, and JavaScript for interactivity.
level: beginner
price: 499
original_price: 999
is_free: false
has_certificate: true

[HIGHLIGHTS]
# Format: kind: text
# Kinds: prerequisite, outcome, skill, audience, requirement
prerequisite: Basic computer literacy
prerequisite: A laptop or desktop computer
outcome: Build responsive websites from scratch
outcome: Write clean, semantic HTML
outcome: Style pages with modern CSS (Flexbox, Grid)
outcome: Add interactivity with JavaScript
skill: HTML5
skill: CSS3
skill: JavaScript ES6+
skill: Responsive Design
audience: Aspiring web developers
audience: Designers who want to code
requirement: A code editor (VS Code recommended)
requirement: Chrome or Firefox browser

[FAQ]
Q: Do I need programming experience?
A: No! This course starts from the very basics. If you can use a computer, you can learn web development.
Q: What tools do I need?
A: Just a code editor (VS Code is free) and a modern web browser. Everything else is taught in the course.
Q: How long does the course take?
A: Most students complete it in 4-6 weeks at 5-10 hours per week. But you have lifetime access to go at your own pace.
Q: Will I get a certificate?
A: Yes! Upon completing all modules and passing the final project, you receive a verified certificate.

[CURRICULUM]
# 0 tabs = Module, 1 tab = Chapter, 2 tabs = Topic | type
# Supported topic types: video, article, quiz, exercise, project
# Optional properties: summary, is_free_preview, points, youtube_url

Introduction to Web Development
\tsummary: Learn the fundamentals of building websites
\tHTML Fundamentals
\t\tsummary: Core HTML concepts and document structure
\t\tWhat is HTML | video
\t\t\tsummary: Overview of HTML markup language
\t\t\tis_free_preview: true
\t\tHTML Document Structure | article
\t\t\tsummary: DOCTYPE, head, body elements explained
\t\tHTML Tags Practice | exercise
\t\t\tsummary: Build your first HTML page from scratch
\t\t\tpoints: 10
\tCSS Styling
\t\tsummary: Style your web pages with CSS
\t\tCSS Selectors and Properties | video
\t\t\tsummary: Learn how to target and style elements
\t\t\tis_free_preview: true
\t\tBox Model Deep Dive | article
\t\t\tsummary: Understanding margins, padding, borders
\t\tCSS Layout Quiz | quiz
\t\t\tsummary: Test your CSS knowledge
\t\t\tpoints: 15
JavaScript Essentials
\tsummary: Master the programming language of the web
\tVariables and Data Types
\t\tsummary: Foundation of JavaScript programming
\t\tUnderstanding Variables | video
\t\t\tsummary: var, let, const differences
\t\t\tis_free_preview: true
\t\tData Types Explained | article
\t\t\tsummary: Strings, numbers, booleans, arrays, objects
\t\tData Type Quiz | quiz
\t\t\tsummary: Identify correct data types
\t\t\tpoints: 10
\tFunctions and Scope
\t\tsummary: Functions, closures, and scope chains
\t\tArrow Functions | video
\t\t\tsummary: Modern function syntax in ES6+
\t\tClosure Exercise | exercise
\t\t\tsummary: Build a counter using closures
\t\t\tpoints: 20
\t\tMini Project | project
\t\t\tsummary: Build a calculator app
\t\t\tpoints: 50`;
    const blob = new Blob([sample], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample_course_import.txt'; a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadTopicVideo(file: File | null) {
    if (!file) {
      // remove: delete the Bunny asset + clear both columns (server-side)
      if (editing) {
        try {
          const r = await api.removeAuthoringUnitVideo(editing.id);
          setU((s: any) => ({ ...s, video: null, youtube_url: null })); reload();
          toast.success(r?.message || 'Video removed');
        } catch (e: any) { toast.error(e?.message || 'Remove failed'); }
      } else {
        setU((s: any) => ({ ...s, video: null, youtube_url: null }));
      }
      return;
    }
    if (!editing) { toast.error('Save the topic first, then upload its video'); return; }
    setVidProg(0);
    try {
      const r = await api.uploadAuthoringUnitVideo(editing.id, file, p => setVidProg(p));
      if (r.success) { setU((s: any) => ({ ...s, video: r.data.video, youtube_url: r.data.youtube_url })); reload(); toast.success('Video uploaded'); }
      else toast.error(r.error || 'Upload failed');
    } catch { toast.error('Upload failed'); }
    setVidProg(null);
  }
  async function uploadTopicPdf(kind: string, file: File | null) {
    const col = PDF_FIELD[kind];
    if (!file) {
      if (editing) {
        try {
          await api.removeAuthoringUnitFile(editing.id, kind);
          setU((s: any) => ({ ...s, [col]: null })); reload(); toast.success('File removed');
        } catch (e: any) { toast.error(e?.message || 'Remove failed'); }
      } else {
        setU((s: any) => ({ ...s, [col]: null }));
      }
      return;
    }
    if (!editing) { toast.error('Save the topic first, then upload its file'); return; }
    const r = await api.uploadAuthoringUnitFile(editing.id, kind, file);
    if (r.success) { setU((s: any) => ({ ...s, [col]: r.data[col] })); reload(); toast.success('File uploaded'); }
    else toast.error(r.error || 'Upload failed');
  }

  const modules = units.filter((x: any) => x.unit_type === 'module');
  const chapters = units.filter((x: any) => x.unit_type === 'chapter');
  const childrenOf = (pid: number) => units.filter((x: any) => x.parent_unit_id === pid);

  // ── Filtered parent options based on selected unit_type ──
  // module  → no parent allowed (always top level)
  // chapter → only modules as parent
  // topic   → only chapters as parent
  function getParentOptions(unitType: string) {
    if (unitType === 'chapter') return modules.map((x: any) => ({ value: x.id, label: `module: ${x.title}` }));
    if (unitType === 'topic') return chapters.map((x: any) => ({ value: x.id, label: `chapter: ${x.title}` }));
    return []; // module → no parent options
  }

  function handleTypeChange(newType: string) {
    const opts = getParentOptions(newType);
    let newParent: string | number = '';
    if (newType === 'module') {
      newParent = ''; // modules are always top-level
    } else if (opts.length > 0) {
      // keep current parent if it's still valid, otherwise pick the first option
      const currentValid = opts.some((o: any) => String(o.value) === String(u.parent_unit_id));
      newParent = currentValid ? u.parent_unit_id : opts[0].value;
    }
    setU({ ...u, unit_type: newType, parent_unit_id: newParent });
  }

  function openAdd(unit_type: string, parent_unit_id: number | null) {
    setEditing(null);
    setU({ unit_type, parent_unit_id: parent_unit_id ?? '', title: '', summary: '', display_order: 0, is_free_preview: false });
    setDialogOpen(true);
  }
  function openEdit(unit: any) { setEditing(unit); setU({ ...unit, parent_unit_id: unit.parent_unit_id ?? '' }); setDialogOpen(true); }

  async function save() {
    if (!u.title?.trim()) { toast.error('Title is required'); return; }
    if (u.youtube_url && !isValidYouTubeUrl(u.youtube_url)) { toast.error('Invalid YouTube URL — must be youtube.com or youtu.be link'); return; }
    const payload: any = { ...u, authoring_course_id: courseId, parent_unit_id: u.parent_unit_id === '' ? null : Number(u.parent_unit_id) };
    if (u.unit_type !== 'topic') payload.topic_type = null;
    const r = editing ? await api.updateAuthoringUnit(editing.id, payload) : await api.createAuthoringUnit(payload);
    if (r.success) { setDialogOpen(false); reload(); } else toast.error(r.error || 'Failed');
  }
  async function del(unit: any) {
    if (!confirm(`Remove "${unit.title}" and everything under it?`)) return;
    const r = await api.deleteAuthoringUnit(unit.id);
    if (r.success) reload(); else toast.error(r.error || 'Failed');
  }

  /** Build ALL 7 file slots for a topic — uploaded items have a url, remaining don't */
  function getFileSlots(t: any) {
    const hasVideo = t.video || t.youtube_url;
    return [
      { label: t.video ? 'Bunny Stream Video' : t.youtube_url ? 'YouTube / External' : 'Video',
        url: t.video || t.youtube_url || null, icon: Video, color: 'text-orange-500', uploaded: !!hasVideo },
      { label: 'Exercise PDF',       url: t.exercise_pdf || null,              icon: FlaskConical,  color: 'text-emerald-500', uploaded: !!t.exercise_pdf },
      { label: 'Exercise Solution',  url: t.exercise_solution_pdf || null,     icon: FlaskConical,  color: 'text-teal-500',    uploaded: !!t.exercise_solution_pdf },
      { label: 'Assignment PDF',     url: t.assignment_pdf || null,            icon: ClipboardList, color: 'text-blue-500',    uploaded: !!t.assignment_pdf },
      { label: 'Article PDF',        url: t.article_pdf || null,              icon: FileText,      color: 'text-indigo-500',  uploaded: !!t.article_pdf },
      { label: 'Project PDF',        url: t.project_pdf || null,              icon: BookOpen,      color: 'text-purple-500',  uploaded: !!t.project_pdf },
      { label: 'Project Solution',   url: t.project_solution_file_url || null, icon: Package,       color: 'text-fuchsia-500', uploaded: !!t.project_solution_file_url },
    ];
  }

  const TopicRow = ({ t }: { t: any }) => {
    const slots = getFileSlots(t);
    const uploaded = slots.filter(s => s.uploaded).length;
    const remaining = slots.length - uploaded;
    const hasVideo = !!(t.video || t.youtube_url);
    return (
      <div className="pl-10 pr-3 py-1.5 hover:bg-slate-50 rounded">
        {/* ── topic header row ── */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <FileText className="w-4 h-4 text-violet-400" /> {t.title}
            {hasVideo && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">video</span>}
            {t.is_free_preview && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">free</span>}
            <span className="text-[10px] text-slate-400">{uploaded}/{slots.length} files</span>
            {remaining > 0 && <span className="text-[10px] text-amber-600">{remaining} remaining</span>}
          </span>
          <span className="flex gap-1 flex-shrink-0">
            <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={() => del(t)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </span>
        </div>
        {/* ── file tree under the topic — all slots shown ── */}
        <div className="ml-6 mt-1 space-y-0.5">
          {slots.map((f, i) => {
            const FIcon = f.icon;
            const isLast = i === slots.length - 1;
            return (
              <div key={f.label} className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-300 select-none w-4 text-center">{isLast ? '└' : '├'}</span>
                <FIcon className={cn('w-3 h-3 flex-shrink-0', f.uploaded ? f.color : 'text-slate-300')} />
                {f.uploaded && f.url ? (
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    className={cn('hover:underline flex items-center gap-1', f.color)}>
                    {f.label} <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                ) : (
                  <span className="text-slate-300 italic">{f.label} — not uploaded</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => openAdd('module', null)}><Plus className="w-4 h-4" /> Add module</Button>
        <Button size="sm" variant="outline" onClick={() => { setImportOpen(true); setImportFile(null); setImportPreview(null); setImportResult(null); }}><Upload className="w-4 h-4" /> Import from File</Button>
      </div>
      {modules.length === 0 && <p className="text-sm text-slate-400">No modules yet.</p>}
      {modules.map((m: any) => (
        <div key={m.id} className="border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-t-lg">
            <span className="flex items-center gap-2 font-semibold text-slate-700 text-sm">
              <Package className="w-4 h-4 text-amber-500" /> {m.title}
              {(() => {
                const allKids = childrenOf(m.id);
                const chaps = allKids.filter((x: any) => x.unit_type === 'chapter');
                // collect all topics: direct children + children of chapters
                const directTopics = allKids.filter((x: any) => x.unit_type === 'topic');
                const chapTopics = chaps.flatMap((ch: any) => childrenOf(ch.id));
                const topics = [...directTopics, ...chapTopics];
                if (!allKids.length) return null;
                return <span className="text-[10px] text-slate-400 font-normal ml-1">{chaps.length} ch · {topics.length} topics</span>;
              })()}
            </span>
            <span className="flex gap-1 items-center">
              <button onClick={() => openAdd('chapter', m.id)} className="text-xs text-violet-600 hover:underline">+ Chapter</button>
              <button onClick={() => openAdd('topic', m.id)} className="text-xs text-violet-600 hover:underline ml-2">+ Topic</button>
              <button onClick={() => openEdit(m)} className="text-slate-400 hover:text-blue-600 ml-2"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => del(m)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </span>
          </div>
          <div className="p-2 space-y-1">
            {childrenOf(m.id).map((ch: any) => ch.unit_type === 'chapter' ? (
              <div key={ch.id}>
                <div className="flex items-center justify-between px-3 py-1.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <FolderTree className="w-4 h-4 text-blue-400" /> {ch.title}
                    {(() => {
                      const kids = childrenOf(ch.id);
                      if (!kids.length) return null;
                      const vids = kids.filter((t: any) => t.video || t.youtube_url).length;
                      const pdfs = kids.filter((t: any) => t.exercise_pdf || t.assignment_pdf || t.article_pdf || t.project_pdf).length;
                      return <span className="text-[10px] text-slate-400 ml-1">{kids.length} topics{vids ? ` · ${vids} video` : ''}{pdfs ? ` · ${pdfs} pdf` : ''}</span>;
                    })()}
                  </span>
                  <span className="flex gap-1 items-center">
                    <button onClick={() => openAdd('topic', ch.id)} className="text-xs text-violet-600 hover:underline">+ Topic</button>
                    <button onClick={() => openEdit(ch)} className="text-slate-400 hover:text-blue-600 ml-2"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(ch)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                  </span>
                </div>
                {childrenOf(ch.id).map((t: any) => <TopicRow key={t.id} t={t} />)}
              </div>
            ) : <TopicRow key={ch.id} t={ch} />)}
          </div>
        </div>
      ))}

      {/* ── Orphan / unassigned topics — parent_unit_id is NULL or points to a deleted unit ── */}
      {(() => {
        const unitIds = new Set(units.map((x: any) => x.id));
        const orphans = units.filter((x: any) => x.unit_type === 'topic' && (!x.parent_unit_id || !unitIds.has(x.parent_unit_id)));
        if (!orphans.length) return null;
        return (
          <div className="border border-amber-300 rounded-lg bg-amber-50/50">
            <div className="flex items-center justify-between bg-amber-100 px-3 py-2 rounded-t-lg">
              <span className="flex items-center gap-2 font-semibold text-amber-800 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Unassigned Topics ({orphans.length})
              </span>
              <span className="text-[10px] text-amber-600">These topics are not inside any module — assign or delete them</span>
            </div>
            <div className="p-2 space-y-1">
              {orphans.map((t: any) => <TopicRow key={t.id} t={t} />)}
            </div>
          </div>
        );
      })()}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit unit' : 'Add unit'} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type"><Select value={u.unit_type} onChange={e => handleTypeChange(e.target.value)} options={UNIT_TYPES} /></Field>
            <Field label="Parent">
              {u.unit_type === 'module' ? (
                <div className="h-10 px-3 flex items-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">— none (top level) —</div>
              ) : (
                <Select value={u.parent_unit_id} onChange={e => setU({ ...u, parent_unit_id: e.target.value })} options={getParentOptions(u.unit_type)} />
              )}
            </Field>
          </div>
          <Field label="Title *"><Input value={u.title || ''} onChange={e => setU({ ...u, title: e.target.value })} /></Field>
          <Field label="Summary"><textarea value={u.summary || ''} onChange={e => setU({ ...u, summary: e.target.value })} rows={2} className={taCls} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display order"><Input type="number" min={0} value={u.display_order ?? 0} onChange={e => setU({ ...u, display_order: Number(e.target.value) })} /></Field>
            {u.unit_type === 'topic' && (
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!u.is_free_preview} onChange={e => setU({ ...u, is_free_preview: e.target.checked })} /> Free preview</label>
              </div>
            )}
          </div>
          {u.unit_type === 'topic' && <>
            {!editing && (
              <p className="text-xs text-amber-600">Save the topic first, then re-open it to upload media &amp; files.</p>
            )}

            {/* ── Video ── */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Video</div>
              {editing ? (
                <VideoUpload label="Video" value={u.video || u.youtube_url || null} progress={vidProg}
                  onFileChange={uploadTopicVideo} onUrlChange={(url) => setU((s: any) => ({ ...s, youtube_url: url }))}
                  onOpen={u.video ? async () => { const r = await api.authoringUnitVideoPlayback(editing.id); if (r.success && r.data?.url) window.open(r.data.url, '_blank'); } : undefined}
                  hint="Upload to Bunny Stream, or paste a YouTube/external URL" />
              ) : (
                <div>
                  <Field label="YouTube URL (optional)"><Input value={u.youtube_url || ''} onChange={e => setU({ ...u, youtube_url: e.target.value })} placeholder="https://youtube.com/watch?v=…" /></Field>
                  {u.youtube_url && !isValidYouTubeUrl(u.youtube_url) && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Invalid YouTube URL — must be youtube.com/watch, youtu.be/, or youtube.com/embed/</p>
                  )}
                </div>
              )}
            </div>

            {/* ── Exercise ── */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> Exercise</div>
              {editing ? <>
                <Field label="Exercise PDF"><FileUpload value={u.exercise_pdf || null} onChange={(f) => uploadTopicPdf('exercise', f)} /></Field>
                <Field label="Solution PDF"><FileUpload value={u.exercise_solution_pdf || null} onChange={(f) => uploadTopicPdf('exercise_solution', f)} /></Field>
              </> : <p className="text-xs text-slate-400">Save topic first to upload exercise files.</p>}
            </div>

            {/* ── Assignment ── */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Assignment</div>
              {editing ? (
                <Field label="Assignment PDF"><FileUpload value={u.assignment_pdf || null} onChange={(f) => uploadTopicPdf('assignment', f)} /></Field>
              ) : <p className="text-xs text-slate-400">Save topic first to upload assignment.</p>}
            </div>

            {/* ── Mini Project ── */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Mini Project</div>
              {editing ? (
                <Field label="Project brief PDF"><FileUpload value={u.project_pdf || null} onChange={(f) => uploadTopicPdf('project', f)} /></Field>
              ) : <p className="text-xs text-slate-400">Save topic first to upload project brief.</p>}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Scope"><Select value={u.project_scope || 'mini'} onChange={e => setU({ ...u, project_scope: e.target.value })} options={[{ value: 'mini', label: 'Mini project' }, { value: 'capstone', label: 'Capstone' }]} /></Field>
                <Field label="Git URL"><Input value={u.project_git_url || ''} onChange={e => setU({ ...u, project_git_url: e.target.value })} /></Field>
              </div>
            </div>

            {/* ── Solution ── */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Project Solution</div>
              {editing ? (
                <Field label="Solution ZIP"><FileUpload value={u.project_solution_file_url || null} onChange={(f) => uploadTopicPdf('project_solution', f)} accept=".zip,.pdf" /></Field>
              ) : <p className="text-xs text-slate-400">Save topic first to upload solution file.</p>}
            </div>

            {/* ── Article (keep for backward compat) ── */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Article PDF</div>
              {editing ? (
                <Field label="Article PDF"><FileUpload value={u.article_pdf || null} onChange={(f) => uploadTopicPdf('article', f)} /></Field>
              ) : <p className="text-xs text-slate-400">Save topic first to upload article.</p>}
            </div>
          </>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Dialog>

      {/* ─── Import Course Dialog ─── */}
      <Dialog open={importOpen} onClose={() => !importLoading && setImportOpen(false)} title="Import Course from Text File" size="lg">
        <div className="space-y-5 p-2">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Upload a <code className="bg-slate-100 px-1 rounded text-xs">.txt</code> file to import course details, highlights, FAQs, and/or curriculum structure.</p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => downloadSampleFile()} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 transition-colors whitespace-nowrap border border-emerald-200 rounded-md px-2.5 py-1.5 hover:bg-emerald-50">
                <Download className="w-3.5 h-3.5" /> Sample file
              </button>
              <button onClick={() => setImportHelpOpen(true)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap border border-blue-200 rounded-md px-2.5 py-1.5 hover:bg-blue-50">
                <HelpCircle className="w-3.5 h-3.5" /> How to use
              </button>
            </div>
          </div>

          {/* File upload */}
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-blue-300 transition-colors">
            <input type="file" accept=".txt" onChange={handleImportFile} className="hidden" id="import-structure-input" disabled={importLoading} />
            <label htmlFor="import-structure-input" className="cursor-pointer">
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
                  <p className="text-xs text-slate-400 mt-1">Tab-indented course structure format</p>
                </div>
              )}
            </label>
          </div>

          {/* Sections Preview */}
          {importPreview && !importResult && (importPreview.hasCourse || importPreview.hasHighlights || importPreview.hasFaq || importPreview.hasCurriculum) && (
            <div className="border border-slate-200 rounded-lg p-4 max-h-80 overflow-auto bg-slate-50 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <FolderTree className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Preview</span>
                <div className="flex gap-1.5 ml-auto">
                  {importPreview.hasCourse && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">COURSE</span>}
                  {importPreview.hasHighlights && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{importPreview.highlights.length} HIGHLIGHTS</span>}
                  {importPreview.hasFaq && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{importPreview.faqs.length} FAQs</span>}
                  {importPreview.hasCurriculum && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">{importPreview.modules.length} MODULES</span>}
                </div>
              </div>

              {/* Course details preview */}
              {importPreview.hasCourse && Object.keys(importPreview.courseFields).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1.5">Course Details</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {Object.entries(importPreview.courseFields).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex gap-1.5 text-xs">
                        <span className="text-blue-600 font-medium min-w-[90px]">{k}:</span>
                        <span className="text-slate-600 truncate">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Highlights preview */}
              {importPreview.hasHighlights && importPreview.highlights.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-xs font-semibold text-green-700 mb-1.5">Highlights ({importPreview.highlights.length})</p>
                  <div className="space-y-0.5">
                    {importPreview.highlights.map((h: any, i: number) => (
                      <div key={i} className="flex gap-1.5 text-xs">
                        <span className={cn('font-medium min-w-[80px]', HIGHLIGHT_KIND_COLORS[h.kind] || 'text-slate-500')}>{h.kind}:</span>
                        <span className="text-slate-600">{h.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FAQ preview */}
              {importPreview.hasFaq && importPreview.faqs.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1.5">FAQs ({importPreview.faqs.length})</p>
                  <div className="space-y-1.5">
                    {importPreview.faqs.map((f: any, i: number) => (
                      <div key={i} className="text-xs">
                        <div className="font-medium text-slate-700">Q: {f.question}</div>
                        <div className="text-slate-500 pl-3 truncate">A: {f.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Curriculum tree preview */}
              {importPreview.hasCurriculum && importPreview.modules.length > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-md p-3">
                  <p className="text-xs font-semibold text-violet-700 mb-1.5">
                    Curriculum ({importPreview.modules.length} module{importPreview.modules.length !== 1 ? 's' : ''}, {importPreview.modules.reduce((a: number, m: any) => a + m.chapters.length, 0)} chapters, {importPreview.modules.reduce((a: number, m: any) => a + m.chapters.reduce((b: number, c: any) => b + c.topics.length, 0), 0)} topics)
                  </p>
                  {importPreview.modules.map((mod: any, mi: number) => (
                    <div key={mi} className="mb-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                        <Package className="w-3.5 h-3.5" /> {mod.title}
                        {mod.summary && <span className="text-[10px] text-slate-400 font-normal truncate max-w-[200px]">— {mod.summary}</span>}
                      </div>
                      {mod.chapters.map((ch: any, ci: number) => (
                        <div key={ci} className="ml-5 mt-1">
                          <div className="flex items-center gap-1.5 text-sm text-blue-600">
                            <ChevronRight className="w-3 h-3" /> {ch.title}
                            {ch.summary && <span className="text-[10px] text-slate-400 truncate max-w-[180px]">— {ch.summary}</span>}
                          </div>
                          {ch.topics.map((t: any, ti: number) => (
                            <div key={ti} className="ml-5 mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                              <FileText className="w-3 h-3 text-violet-400" />
                              <span>{t.title}</span>
                              {t.youtube_url && <span className="text-[10px] font-medium text-sky-600 bg-sky-50 px-1 rounded">video</span>}
                              {t.is_free_preview && <span className="text-[10px] text-green-600 bg-green-50 px-1 rounded">free</span>}
                              {t.points && <span className="text-[10px] text-violet-600">{t.points}pts</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {importResult && !importResult.error && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="font-semibold text-emerald-800 mb-2">Import Successful!</p>
              <div className="space-y-3">
                {/* Course update */}
                {importResult.report?.course && (
                  <div className="bg-white rounded-lg p-2 border border-emerald-100 text-center">
                    <div className="text-sm font-semibold text-blue-700">Course Details Updated</div>
                  </div>
                )}
                {/* Highlights */}
                {(importResult.report?.highlights?.added > 0 || importResult.report?.highlights?.removed > 0) && (
                  <div className="bg-white rounded-lg p-2 border border-emerald-100 flex items-center justify-center gap-3">
                    <span className="text-sm font-semibold text-green-700">Highlights:</span>
                    <span className="text-xs text-slate-600">{importResult.report.highlights.added} added, {importResult.report.highlights.removed} old removed</span>
                  </div>
                )}
                {/* FAQs */}
                {(importResult.report?.faqs?.added > 0 || importResult.report?.faqs?.removed > 0) && (
                  <div className="bg-white rounded-lg p-2 border border-emerald-100 flex items-center justify-center gap-3">
                    <span className="text-sm font-semibold text-amber-700">FAQs:</span>
                    <span className="text-xs text-slate-600">{importResult.report.faqs.added} added, {importResult.report.faqs.removed} old removed</span>
                  </div>
                )}
                {/* Curriculum */}
                {(importResult.report?.created?.modules > 0 || importResult.report?.created?.chapters > 0 || importResult.report?.created?.topics > 0) && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <div className="text-lg font-bold text-amber-700">{importResult.report?.created?.modules || 0}</div>
                      <div className="text-xs text-slate-500">Modules</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <div className="text-lg font-bold text-blue-700">{importResult.report?.created?.chapters || 0}</div>
                      <div className="text-xs text-slate-500">Chapters</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-emerald-100">
                      <div className="text-lg font-bold text-violet-700">{importResult.report?.created?.topics || 0}</div>
                      <div className="text-xs text-slate-500">Topics</div>
                    </div>
                  </div>
                )}
              </div>
              {importResult.report?.errors?.length > 0 && (
                <div className="mt-3 text-xs text-red-600 bg-red-50 rounded p-2">
                  <p className="font-medium mb-1">{importResult.report.errors.length} error(s):</p>
                  {importResult.report.errors.map((e: string, i: number) => <p key={i}>• {e}</p>)}
                </div>
              )}
            </div>
          )}
          {importResult?.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{importResult.error}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importLoading}>
              {importResult ? 'Close' : 'Cancel'}
            </Button>
            {!importResult && importPreview && (importPreview.hasCourse || importPreview.hasHighlights || importPreview.hasFaq || (importPreview.hasCurriculum && importPreview.modules.length > 0)) && (
              <Button onClick={handleImport} disabled={importLoading}>
                {importLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>) : (<><Upload className="w-4 h-4" /> Start Import</>)}
              </Button>
            )}
          </div>
        </div>
      </Dialog>

      {/* ─── Import Help Dialog ─── */}
      <Dialog open={importHelpOpen} onClose={() => setImportHelpOpen(false)} title="How to Import Course from Text File" size="lg">
        <div className="space-y-4 p-2 text-sm text-slate-700">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="font-semibold text-slate-800 mb-2">File Structure — 4 Sections</p>
            <p>The file uses <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">[SECTION]</code> markers to separate different parts. All sections are optional — include only what you need.</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500" /> <code>[COURSE]</code> — Course metadata</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-green-500" /> <code>[HIGHLIGHTS]</code> — Prerequisites, outcomes, etc.</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> <code>[FAQ]</code> — Questions &amp; answers</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-violet-500" /> <code>[CURRICULUM]</code> — Module/chapter/topic tree</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="font-semibold text-blue-800 mb-2">[COURSE] — Course Details</p>
            <p>One <code className="bg-blue-100 px-1 rounded text-xs">key: value</code> per line. Only included fields are updated.</p>
            <div className="mt-2 font-mono text-xs space-y-0.5 bg-white rounded border border-blue-200 p-3">
              <div><span className="text-blue-600 font-bold">title:</span> Course Title</div>
              <div><span className="text-blue-600 font-bold">subtitle:</span> Course Subtitle</div>
              <div><span className="text-blue-600 font-bold">short_intro:</span> Brief description</div>
              <div><span className="text-blue-600 font-bold">long_intro:</span> Detailed description</div>
              <div><span className="text-blue-600 font-bold">level:</span> beginner | intermediate | advanced</div>
              <div><span className="text-blue-600 font-bold">price:</span> 499</div>
              <div><span className="text-blue-600 font-bold">original_price:</span> 999</div>
              <div><span className="text-blue-600 font-bold">is_free:</span> true/false</div>
              <div><span className="text-blue-600 font-bold">has_certificate:</span> true/false</div>
              <div><span className="text-blue-600 font-bold">category_id:</span> 3 <span className="text-slate-400">— numeric ID</span></div>
              <div><span className="text-blue-600 font-bold">language_id:</span> 1 <span className="text-slate-400">— numeric ID</span></div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-100 rounded-lg p-4">
            <p className="font-semibold text-green-800 mb-2">[HIGHLIGHTS] — Prerequisites, Outcomes, Skills</p>
            <p>One <code className="bg-green-100 px-1 rounded text-xs">kind: text</code> per line. <strong>Replaces all</strong> existing highlights when included.</p>
            <div className="mt-2 grid grid-cols-5 gap-2 text-xs font-medium">
              <span className="text-amber-600">prerequisite</span>
              <span className="text-emerald-600">outcome</span>
              <span className="text-sky-600">skill</span>
              <span className="text-violet-600">audience</span>
              <span className="text-rose-600">requirement</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
            <p className="font-semibold text-amber-800 mb-2">[FAQ] — Questions &amp; Answers</p>
            <p><code className="bg-amber-100 px-1 rounded text-xs">Q:</code> and <code className="bg-amber-100 px-1 rounded text-xs">A:</code> pairs. <strong>Replaces all</strong> existing FAQs when included.</p>
            <div className="mt-2 font-mono text-xs bg-white rounded border border-amber-200 p-3">
              <div><span className="text-amber-600 font-bold">Q:</span> Your question here?</div>
              <div><span className="text-amber-600 font-bold">A:</span> The answer goes here.</div>
            </div>
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-lg p-4">
            <p className="font-semibold text-violet-800 mb-2">[CURRICULUM] — Module/Chapter/Topic Tree</p>
            <p>Tab-indented hierarchy. Add <code className="bg-violet-100 px-1 rounded text-xs">| type</code> after topic name.</p>
            <div className="mt-2 bg-white rounded border border-violet-200 p-3 font-mono text-xs leading-relaxed">
              <div className="text-amber-700 font-bold">Module Name</div>
              <div className="text-blue-600 pl-6">Chapter Name</div>
              <div className="text-violet-600 pl-12">Topic Name | video</div>
              <div className="text-slate-400 pl-16">summary: Description</div>
              <div className="text-slate-400 pl-16">is_free_preview: true</div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 0 tabs = Module</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> 1 tab = Chapter</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> 2 tabs = Topic</div>
            </div>
            <p className="mt-2 text-xs">The <code className="bg-violet-100 px-1 rounded">| type</code> after topic name is optional (for backward compatibility). Files are uploaded separately via the UI.</p>
            <p className="text-xs">Properties: <code className="bg-violet-100 px-1 rounded">summary</code>, <code className="bg-violet-100 px-1 rounded">is_free_preview</code>, <code className="bg-violet-100 px-1 rounded">points</code>, <code className="bg-violet-100 px-1 rounded">youtube_url</code>, <code className="bg-violet-100 px-1 rounded">id</code> (for updates)</p>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-lg p-3">
            <p className="font-semibold text-red-800 mb-1">Important Notes</p>
            <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
              <li><strong>[HIGHLIGHTS]</strong> and <strong>[FAQ]</strong> sections REPLACE all existing data when included</li>
              <li>If you only want to update curriculum, omit [HIGHLIGHTS] and [FAQ] sections</li>
              <li>Use real TAB characters (not spaces) for curriculum indentation, or 4+ spaces per level</li>
              <li>Lines starting with # are comments and ignored</li>
              <li>Files (PDFs, videos, thumbnails) must be uploaded separately via the UI</li>
              <li>To update existing curriculum units, include <code className="bg-red-100 px-1 rounded">id: N</code> below the heading</li>
              <li>Download sample files to see the exact format in action</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setImportHelpOpen(false)}>Got it</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/* ════════════ Capstone Projects Tab ════════════ */
function CapstonesTab({ courseId, items, reload }: any) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setF({ title: '', description: '', display_order: (items.length + 1) * 10, solution_github_url: '' });
    setDialogOpen(true);
  }
  function openEdit(cp: any) {
    setEditing(cp);
    setF({ title: cp.title || '', description: cp.description || '', display_order: cp.display_order ?? 0, solution_github_url: cp.solution_github_url || '' });
    setDialogOpen(true);
  }

  async function save() {
    if (!f.title?.trim()) { toast.error('Title is required'); return; }
    setBusy(true);
    const payload = { ...f, authoring_course_id: courseId, display_order: Number(f.display_order) || 0 };
    const r = editing
      ? await api.updateAuthoringCapstone(editing.id, payload)
      : await api.createAuthoringCapstone(payload);
    setBusy(false);
    if (r.success) { setDialogOpen(false); reload(); toast.success(editing ? 'Updated' : 'Created'); }
    else toast.error(r.error || 'Failed');
  }

  async function del(cp: any) {
    if (!confirm(`Delete capstone "${cp.title}"?`)) return;
    const r = await api.deleteAuthoringCapstone(cp.id);
    if (r.success) reload(); else toast.error(r.error || 'Failed');
  }

  async function uploadFile(cpId: number, kind: string, file: File | null) {
    if (!file) {
      const r = await api.removeAuthoringCapstoneFile(cpId, kind);
      if (r.success) { reload(); toast.success('File removed'); } else toast.error(r.error || 'Remove failed');
      return;
    }
    const r = await api.uploadAuthoringCapstoneFile(cpId, kind, file);
    if (r.success) { reload(); toast.success('File uploaded'); } else toast.error(r.error || 'Upload failed');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Course-level capstone projects with PDF brief &amp; solution (ZIP / GitHub URL).</p>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4" /> Add capstone</Button>
      </div>

      {items.length === 0 && <p className="text-sm text-slate-400">No capstone projects yet.</p>}
      <div className="space-y-3">
        {items.map((cp: any) => (
          <div key={cp.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{cp.title}</h4>
                {cp.description && <p className="text-xs text-slate-500 mt-0.5">{cp.description}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(cp)} className="text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(cp)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Brief PDF"><FileUpload value={cp.pdf_url || null} onChange={(file: File | null) => uploadFile(cp.id, 'pdf', file)} /></Field>
              <Field label="Solution (ZIP)"><FileUpload value={cp.solution_file_url || null} onChange={(file: File | null) => uploadFile(cp.id, 'solution', file)} accept=".zip,.pdf" /></Field>
            </div>
            {cp.solution_github_url && <p className="text-xs text-slate-500 mt-2">GitHub: <a href={cp.solution_github_url} target="_blank" className="text-violet-600 hover:underline">{cp.solution_github_url}</a></p>}
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Capstone Project' : 'New Capstone Project'} size="md">
        <div className="p-6 space-y-4">
          <Field label="Title *"><Input value={f.title || ''} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Capstone project title" /></Field>
          <Field label="Description"><textarea value={f.description || ''} onChange={e => setF({ ...f, description: e.target.value })} rows={3} className={taCls} placeholder="What the student will build…" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display order"><Input type="number" min={0} value={f.display_order ?? 0} onChange={e => setF({ ...f, display_order: Number(e.target.value) })} /></Field>
            <Field label="Solution GitHub URL"><Input value={f.solution_github_url || ''} onChange={e => setF({ ...f, solution_github_url: e.target.value })} placeholder="https://github.com/…" /></Field>
          </div>
          {!editing && <p className="text-xs text-amber-600">Save first, then re-open to upload PDF &amp; solution files.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : editing ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/* ════════════ Mini Projects Tab ════════════ */
function MiniProjectsTab({ courseId, items, units, reload }: any) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);

  // Only modules and chapters can have mini projects
  const parentOptions = (units || [])
    .filter((u: any) => u.unit_type === 'module' || u.unit_type === 'chapter')
    .map((u: any) => ({ value: u.id, label: `${u.unit_type}: ${u.title}` }));

  function openAdd() {
    setEditing(null);
    setF({ title: '', description: '', unit_id: '', display_order: (items.length + 1) * 10, solution_github_url: '' });
    setDialogOpen(true);
  }
  function openEdit(mp: any) {
    setEditing(mp);
    setF({ title: mp.title || '', description: mp.description || '', unit_id: mp.unit_id ?? '', display_order: mp.display_order ?? 0, solution_github_url: mp.solution_github_url || '' });
    setDialogOpen(true);
  }

  async function save() {
    if (!f.title?.trim()) { toast.error('Title is required'); return; }
    if (!f.unit_id) { toast.error('Select a module or chapter'); return; }
    setBusy(true);
    const payload = { ...f, authoring_course_id: courseId, unit_id: Number(f.unit_id), display_order: Number(f.display_order) || 0 };
    const r = editing
      ? await api.updateAuthoringMiniProject(editing.id, payload)
      : await api.createAuthoringMiniProject(payload);
    setBusy(false);
    if (r.success) { setDialogOpen(false); reload(); toast.success(editing ? 'Updated' : 'Created'); }
    else toast.error(r.error || 'Failed');
  }

  async function del(mp: any) {
    if (!confirm(`Delete mini project "${mp.title}"?`)) return;
    const r = await api.deleteAuthoringMiniProject(mp.id);
    if (r.success) reload(); else toast.error(r.error || 'Failed');
  }

  async function uploadFile(mpId: number, kind: string, file: File | null) {
    if (!file) {
      const r = await api.removeAuthoringMiniProjectFile(mpId, kind);
      if (r.success) { reload(); toast.success('File removed'); } else toast.error(r.error || 'Remove failed');
      return;
    }
    const r = await api.uploadAuthoringMiniProjectFile(mpId, kind, file);
    if (r.success) { reload(); toast.success('File uploaded'); } else toast.error(r.error || 'Upload failed');
  }

  // Group mini projects by their parent unit
  const unitMap = new Map((units || []).map((u: any) => [u.id, u]));
  const grouped = new Map<number, any[]>();
  for (const mp of items) {
    const uid = mp.unit_id;
    if (!grouped.has(uid)) grouped.set(uid, []);
    grouped.get(uid)!.push(mp);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Mini projects attached to modules &amp; chapters — PDF brief &amp; solution (ZIP / GitHub URL).</p>
        <Button size="sm" onClick={openAdd} disabled={parentOptions.length === 0}><Plus className="w-4 h-4" /> Add mini project</Button>
      </div>
      {parentOptions.length === 0 && <p className="text-xs text-amber-600">Add modules/chapters in the Curriculum tab first.</p>}

      {items.length === 0 && parentOptions.length > 0 && <p className="text-sm text-slate-400">No mini projects yet.</p>}

      {[...grouped.entries()].map(([unitId, mps]) => {
        const unit = unitMap.get(unitId) as any;
        return (
          <div key={unitId} className="border border-slate-200 rounded-lg">
            <div className="bg-slate-50 px-3 py-2 rounded-t-lg">
              <span className="text-xs font-semibold text-slate-500 uppercase">{unit?.unit_type || 'unit'}</span>
              <span className="text-sm font-medium text-slate-700 ml-2">{unit?.title || `#${unitId}`}</span>
            </div>
            <div className="p-3 space-y-3">
              {mps.map((mp: any) => (
                <div key={mp.id} className="bg-white border border-slate-100 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">{mp.title}</h4>
                      {mp.description && <p className="text-xs text-slate-500 mt-0.5">{mp.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(mp)} className="text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => del(mp)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Brief PDF"><FileUpload value={mp.pdf_url || null} onChange={(file: File | null) => uploadFile(mp.id, 'pdf', file)} /></Field>
                    <Field label="Solution (ZIP)"><FileUpload value={mp.solution_file_url || null} onChange={(file: File | null) => uploadFile(mp.id, 'solution', file)} accept=".zip,.pdf" /></Field>
                  </div>
                  {mp.solution_github_url && <p className="text-xs text-slate-500 mt-2">GitHub: <a href={mp.solution_github_url} target="_blank" className="text-violet-600 hover:underline">{mp.solution_github_url}</a></p>}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Mini Project' : 'New Mini Project'} size="md">
        <div className="p-6 space-y-4">
          <Field label="Attach to (module / chapter) *">
            <Select value={f.unit_id || ''} onChange={e => setF({ ...f, unit_id: e.target.value })}
              options={[{ value: '', label: 'Select…' }, ...parentOptions]}
              disabled={!!editing} />
            {editing && <p className="text-xs text-slate-400 mt-1">Parent unit cannot be changed after creation.</p>}
          </Field>
          <Field label="Title *"><Input value={f.title || ''} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Mini project title" /></Field>
          <Field label="Description"><textarea value={f.description || ''} onChange={e => setF({ ...f, description: e.target.value })} rows={3} className={taCls} placeholder="Brief description…" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Display order"><Input type="number" min={0} value={f.display_order ?? 0} onChange={e => setF({ ...f, display_order: Number(e.target.value) })} /></Field>
            <Field label="Solution GitHub URL"><Input value={f.solution_github_url || ''} onChange={e => setF({ ...f, solution_github_url: e.target.value })} placeholder="https://github.com/…" /></Field>
          </div>
          {!editing && <p className="text-xs text-amber-600">Save first, then re-open to upload PDF &amp; solution files.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : editing ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

/* ════════════ FAQs Tab ════════════ */
function FaqsTab({ courseId, items, reload }: any) {
  const [q, setQ] = useState(''); const [a, setA] = useState('');
  async function add() {
    if (!q.trim() || !a.trim()) { toast.error('Question and answer are required'); return; }
    const r = await api.createAuthoringFaq({ authoring_course_id: courseId, question: q, answer: a });
    if (r.success) { setQ(''); setA(''); reload(); } else toast.error(r.error || 'Failed');
  }
  async function del(id: number) { const r = await api.deleteAuthoringFaq(id); if (r.success) reload(); else toast.error(r.error || 'Failed'); }
  return (
    <div className="space-y-4">
      <div className="space-y-2 border border-slate-200 rounded-lg p-4">
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Question" />
        <textarea value={a} onChange={e => setA(e.target.value)} rows={3} className={taCls} placeholder="Answer" />
        <Button size="sm" onClick={add}><Plus className="w-4 h-4" /> Add FAQ</Button>
      </div>
      <ul className="space-y-2">
        {items.map((f: any) => (
          <li key={f.id} className="bg-slate-50 rounded-lg px-4 py-3">
            <div className="flex items-start justify-between">
              <div><p className="font-medium text-slate-800 text-sm">{f.question}</p><p className="text-sm text-slate-600 mt-1">{f.answer}</p></div>
              <button onClick={() => del(f.id)} className="text-slate-400 hover:text-red-600 ml-3"><Trash2 className="w-4 h-4" /></button>
            </div>
          </li>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No FAQs yet.</p>}
      </ul>
    </div>
  );
}

/* ── shared bits ── */
const taCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500';
function Field({ label, children }: { label: string; children: any }) {
  return <div><label className="block mb-1.5 text-sm font-medium text-slate-700">{label}</label>{children}</div>;
}
