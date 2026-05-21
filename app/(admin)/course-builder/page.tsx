"use client";
import { useEffect, useState, useCallback } from 'react';
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
import {
  Plus, Pencil, Trash2, ArrowLeft, CheckCircle, XCircle, Send, ShieldCheck,
  Package, FolderTree, FileText, Video, BookOpen, ClipboardList, FlaskConical, Loader2,
  BarChart3, Clock, RotateCcw, AlertCircle,
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
const TOPIC_TYPES = [
  { value: 'video', label: 'Video' },
  { value: 'article', label: 'Article (PDF)' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'project', label: 'Project' },
];
const TOPIC_ICON: Record<string, any> = { video: Video, article: FileText, quiz: ClipboardList, exercise: FlaskConical, project: BookOpen };

type Tab = 'basics' | 'highlights' | 'curriculum' | 'faqs';

function StatusBadge({ status }: { status: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>{status?.replace('_', ' ')}</span>;
}

export default function CourseBuilderPage() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [stats, setStats] = useState({ total: 0, published: 0, pending: 0, trash: 0 });

  const [languages, setLanguages] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);

  const [course, setCourse] = useState<any | null>(null); // currently edited course
  const [tab, setTab] = useState<Tab>('basics');
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [highlights, setHighlights] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [readiness, setReadiness] = useState<{ ready: boolean; problems: string[] } | null>(null);

  async function refreshReadiness(courseId: number) {
    const r = await api.authoringCourseReadiness(courseId);
    if (r.success) setReadiness(r.data);
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

  useEffect(() => { if (view === 'list') { fetchCourses(); refreshStats(); } }, [view, fetchCourses, refreshStats]);
  useEffect(() => {
    api.listLanguages('?is_active=true&limit=50').then(r => { if (r.success) setLanguages(r.data || []); });
    api.listCourseSubCategories('?limit=300').then(r => { if (r.success) setCategories(r.data || []); });
    // Only instructor-type users may own a course.
    api.listUsers('?limit=500&type=instructor').then(r => { if (r.success) setInstructors(r.data || []); });
  }, []);

  /* ── open editor ── */
  function openCreate() {
    setCourse(null);
    setForm({ title: '', subtitle: '', short_intro: '', long_intro: '', level: 'beginner', language_id: '', category_id: '', price: '', original_price: '', is_free: false, thumbnail_url: '', trailer_video: '', has_certificate: false, requires_verification: true });
    setHighlights([]); setUnits([]); setFaqs([]); setReadiness(null);
    setTab('basics'); setView('edit');
  }
  async function openEdit(c: any) {
    setCourse(c);
    setForm({ ...c, language_id: c.language_id ?? '', category_id: c.category_id ?? '', price: c.price ?? '', original_price: c.original_price ?? '' });
    setTab('basics'); setView('edit');
    await loadChildren(c.id);
  }
  async function loadChildren(courseId: number) {
    const [h, u, f] = await Promise.all([
      api.listAuthoringHighlights(courseId), api.listAuthoringUnits(courseId), api.listAuthoringFaqs(courseId),
    ]);
    setHighlights(h.data || []); setUnits(u.data || []); setFaqs(f.data || []);
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
        if (r.success) { setCourse(r.data); setForm({ ...form, ...r.data }); refreshReadiness(r.data.id); toast.success('Draft created — now add curriculum'); }
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
          actions={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add course</Button> : undefined}
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

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
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
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
              ) : courses.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">{showTrash ? 'Trash is empty' : 'No courses yet. Click "Add course".'}</td></tr>
              ) : courses.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
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
      </div>
    );
  }

  /* ─────────────── EDIT VIEW ─────────────── */
  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'basics', label: 'Basics', icon: BookOpen },
    { id: 'highlights', label: 'Highlights', icon: ClipboardList },
    { id: 'curriculum', label: 'Curriculum', icon: FolderTree },
    { id: 'faqs', label: 'FAQs', icon: FileText },
  ];
  const needsCourse = !course?.id;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <button onClick={() => setView('list')} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ArrowLeft className="w-5 h-5" /></button>
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
          <button key={t.id} disabled={t.id !== 'basics' && needsCourse} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${tab === t.id ? 'border-violet-500 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      <div className="ml-10 max-w-4xl">
        {tab === 'basics' && <BasicsTab form={form} setForm={setForm} languages={languages} categories={categories} instructors={instructors} saving={saving} onSave={saveBasics} courseId={course?.id} onMedia={() => course?.id && refreshReadiness(course.id)} />}
        {tab === 'highlights' && course?.id && <HighlightsTab courseId={course.id} items={highlights} reload={() => loadChildren(course.id)} />}
        {tab === 'curriculum' && course?.id && <CurriculumTab courseId={course.id} units={units} reload={() => loadChildren(course.id)} />}
        {tab === 'faqs' && course?.id && <FaqsTab courseId={course.id} items={faqs} reload={() => loadChildren(course.id)} />}
      </div>
    </div>
  );
}

/* ════════════ Basics Tab ════════════ */
function BasicsTab({ form, setForm, languages, categories, instructors, saving, onSave, courseId, onMedia }: any) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const [thumbBusy, setThumbBusy] = useState(false);
  const [trailerProgress, setTrailerProgress] = useState<number | null>(null);

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
    if (!file) { set('trailer_video', null); return; }
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
      <div className="grid grid-cols-3 gap-4">
        <Field label="Level"><Select value={form.level || 'beginner'} onChange={e => set('level', e.target.value)} options={LEVELS} /></Field>
        <Field label="Language"><Select value={form.language_id || ''} onChange={e => set('language_id', e.target.value)} options={[{ value: '', label: 'Select…' }, ...languages.map((l: any) => ({ value: l.id, label: l.name }))]} /></Field>
        <Field label="Category"><Select value={form.category_id || ''} onChange={e => set('category_id', e.target.value)} options={[{ value: '', label: 'Select…' }, ...categories.map((c: any) => ({ value: c.id, label: c.name }))]} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Price (₹)"><Input type="number" min={0} value={form.price ?? ''} onChange={e => set('price', e.target.value)} disabled={form.is_free} /></Field>
        <Field label="Original price (₹)"><Input type="number" min={0} value={form.original_price ?? ''} onChange={e => set('original_price', e.target.value)} disabled={form.is_free} /></Field>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_free} onChange={e => set('is_free', e.target.checked)} /> Free</label>
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
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.requires_verification !== false} onChange={e => set('requires_verification', e.target.checked)} /> Requires super-admin verification before going live</label>
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
  const PDF_FIELD: Record<string, string> = { article: 'article_pdf', exercise: 'exercise_pdf', exercise_solution: 'exercise_solution_pdf', project: 'project_pdf' };

  async function uploadTopicVideo(file: File | null) {
    if (!file) { setU((s: any) => ({ ...s, video: null })); return; }
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
    if (!file) { setU((s: any) => ({ ...s, [PDF_FIELD[kind]]: null })); return; }
    if (!editing) { toast.error('Save the topic first, then upload its file'); return; }
    const r = await api.uploadAuthoringUnitFile(editing.id, kind, file);
    if (r.success) { const col = PDF_FIELD[kind]; setU((s: any) => ({ ...s, [col]: r.data[col] })); reload(); toast.success('File uploaded'); }
    else toast.error(r.error || 'Upload failed');
  }

  const modules = units.filter((x: any) => x.unit_type === 'module');
  const childrenOf = (pid: number) => units.filter((x: any) => x.parent_unit_id === pid);
  const parentOptions = units.filter((x: any) => x.unit_type === 'module' || x.unit_type === 'chapter')
    .map((x: any) => ({ value: x.id, label: `${x.unit_type}: ${x.title}` }));

  function openAdd(unit_type: string, parent_unit_id: number | null) {
    setEditing(null);
    setU({ unit_type, parent_unit_id: parent_unit_id ?? '', title: '', summary: '', topic_type: 'video', display_order: 0, is_free_preview: false });
    setDialogOpen(true);
  }
  function openEdit(unit: any) { setEditing(unit); setU({ ...unit, parent_unit_id: unit.parent_unit_id ?? '' }); setDialogOpen(true); }

  async function save() {
    if (!u.title?.trim()) { toast.error('Title is required'); return; }
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

  const TopicRow = ({ t }: { t: any }) => {
    const Icon = TOPIC_ICON[t.topic_type] || FileText;
    return (
      <div className="flex items-center justify-between pl-10 pr-3 py-1.5 hover:bg-slate-50 rounded">
        <span className="flex items-center gap-2 text-sm text-slate-600"><Icon className="w-4 h-4 text-violet-400" /> {t.title} <span className="text-xs text-slate-400">· {t.topic_type}</span></span>
        <span className="flex gap-1">
          <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => del(t)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => openAdd('module', null)}><Plus className="w-4 h-4" /> Add module</Button>
      {modules.length === 0 && <p className="text-sm text-slate-400">No modules yet.</p>}
      {modules.map((m: any) => (
        <div key={m.id} className="border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-t-lg">
            <span className="flex items-center gap-2 font-semibold text-slate-700 text-sm"><Package className="w-4 h-4 text-amber-500" /> {m.title}</span>
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
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-600"><FolderTree className="w-4 h-4 text-blue-400" /> {ch.title}</span>
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit unit' : 'Add unit'} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type"><Select value={u.unit_type} onChange={e => setU({ ...u, unit_type: e.target.value })} options={UNIT_TYPES} /></Field>
            <Field label="Parent"><Select value={u.parent_unit_id} onChange={e => setU({ ...u, parent_unit_id: e.target.value })} options={[{ value: '', label: '— none (top level) —' }, ...parentOptions]} /></Field>
          </div>
          <Field label="Title *"><Input value={u.title || ''} onChange={e => setU({ ...u, title: e.target.value })} /></Field>
          <Field label="Summary"><textarea value={u.summary || ''} onChange={e => setU({ ...u, summary: e.target.value })} rows={2} className={taCls} /></Field>
          {u.unit_type === 'topic' && <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Topic type"><Select value={u.topic_type} onChange={e => setU({ ...u, topic_type: e.target.value })} options={TOPIC_TYPES} /></Field>
              <Field label="Display order"><Input type="number" min={0} value={u.display_order ?? 0} onChange={e => setU({ ...u, display_order: Number(e.target.value) })} /></Field>
            </div>
            {!editing && u.topic_type && u.topic_type !== 'quiz' && (
              <p className="text-xs text-amber-600">Save the topic first, then re-open it to upload media.</p>
            )}
            {u.topic_type === 'video' && (
              editing ? (
                <VideoUpload label="Video" value={u.video || u.youtube_url || null} progress={vidProg}
                  onFileChange={uploadTopicVideo} onUrlChange={(url) => setU({ ...u, youtube_url: url })}
                  onOpen={u.video ? async () => { const r = await api.authoringUnitVideoPlayback(editing.id); if (r.success && r.data?.url) window.open(r.data.url, '_blank'); } : undefined}
                  hint="Upload to Bunny Stream, or paste a YouTube/external URL" />
              ) : (
                <Field label="YouTube URL (optional)"><Input value={u.youtube_url || ''} onChange={e => setU({ ...u, youtube_url: e.target.value })} placeholder="https://youtube.com/…" /></Field>
              )
            )}
            {u.topic_type === 'article' && editing && <Field label="Article PDF"><FileUpload value={u.article_pdf || null} onChange={(f) => uploadTopicPdf('article', f)} /></Field>}
            {u.topic_type === 'exercise' && editing && <>
              <Field label="Exercise PDF"><FileUpload value={u.exercise_pdf || null} onChange={(f) => uploadTopicPdf('exercise', f)} /></Field>
              <Field label="Solution PDF"><FileUpload value={u.exercise_solution_pdf || null} onChange={(f) => uploadTopicPdf('exercise_solution', f)} /></Field>
            </>}
            {u.topic_type === 'project' && <>
              {editing && <Field label="Project brief PDF"><FileUpload value={u.project_pdf || null} onChange={(f) => uploadTopicPdf('project', f)} /></Field>}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Scope"><Select value={u.project_scope || 'mini'} onChange={e => setU({ ...u, project_scope: e.target.value })} options={[{ value: 'mini', label: 'Mini project' }, { value: 'capstone', label: 'Capstone' }]} /></Field>
                <Field label="Git URL"><Input value={u.project_git_url || ''} onChange={e => setU({ ...u, project_git_url: e.target.value })} /></Field>
              </div>
            </>}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!u.is_free_preview} onChange={e => setU({ ...u, is_free_preview: e.target.checked })} /> Free preview</label>
          </>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? 'Update' : 'Add'}</Button>
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
