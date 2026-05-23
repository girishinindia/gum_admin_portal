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
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  Plus, Pencil, Trash2, ArrowLeft, CheckCircle, XCircle, Send, ShieldCheck,
  Package, FolderTree, FileText, Video, BookOpen, ClipboardList, FlaskConical, Loader2,
  BarChart3, Clock, RotateCcw, AlertCircle, Eye,
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

type Tab = 'basics' | 'highlights' | 'curriculum' | 'faqs' | 'capstones' | 'mini-projects';

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
  const [viewing, setViewing] = useState<any | null>(null);
  const [viewChildren, setViewChildren] = useState<{ highlights: any[]; units: any[]; faqs: any[]; capstones: any[]; miniProjects: any[] }>({ highlights: [], units: [], faqs: [], capstones: [], miniProjects: [] });
  const [viewLoading, setViewLoading] = useState(false);

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
                  {/* Curriculum tree */}
                  {viewChildren.units.length > 0 && (() => {
                    const vu = viewChildren.units;
                    const mods = vu.filter((x: any) => x.unit_type === 'module');
                    const chaps = vu.filter((x: any) => x.unit_type === 'chapter');
                    const topics = vu.filter((x: any) => x.unit_type === 'topic');
                    const childOf = (pid: number) => vu.filter((x: any) => x.parent_unit_id === pid);
                    const typeIcon: Record<string, string> = { video: '🎬', article: '📝', quiz: '📋', exercise: '🧪', project: '📦' };
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5"><FolderTree className="w-4 h-4 text-violet-500" /> Curriculum</h4>
                          <span className="text-xs text-slate-400">{mods.length} modules · {chaps.length} chapters · {topics.length} topics</span>
                        </div>
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
                          {mods.map((m: any) => (
                            <div key={m.id} className="px-3 py-2">
                              <div className="flex items-center gap-2 font-medium text-slate-700"><Package className="w-3.5 h-3.5 text-amber-500" /> {m.title}</div>
                              {childOf(m.id).map((ch: any) => ch.unit_type === 'chapter' ? (
                                <div key={ch.id} className="ml-5 mt-1.5">
                                  <div className="flex items-center gap-2 text-slate-600"><FolderTree className="w-3.5 h-3.5 text-blue-400" /> {ch.title}</div>
                                  {childOf(ch.id).map((t: any) => (
                                    <div key={t.id} className="ml-5 mt-1 flex items-center gap-2 text-slate-500 text-xs">
                                      <span>{typeIcon[t.topic_type] || '📄'}</span> {t.title}
                                      <span className="text-slate-300">·</span>
                                      <span className="text-slate-400">{t.topic_type}</span>
                                      {t.is_free_preview && <span className="text-emerald-600 font-medium">free</span>}
                                      {t.video && <span className="text-orange-500">bunny</span>}
                                      {t.youtube_url && !t.video && <span className="text-red-500">youtube</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div key={ch.id} className="ml-5 mt-1 flex items-center gap-2 text-slate-500 text-xs">
                                  <span>{typeIcon[ch.topic_type] || '📄'}</span> {ch.title}
                                  <span className="text-slate-300">·</span>
                                  <span className="text-slate-400">{ch.topic_type}</span>
                                  {ch.is_free_preview && <span className="text-emerald-600 font-medium">free</span>}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Highlights */}
                  {viewChildren.highlights.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-violet-500" /> Highlights ({viewChildren.highlights.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {viewChildren.highlights.map((h: any) => (
                          <span key={h.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-100">
                            <span className="font-semibold capitalize">{h.kind}:</span> {h.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

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
          {u.unit_type === 'topic' && (
            <Field label="Topic type">
              <Select value={u.topic_type || 'video'} onChange={e => setU({ ...u, topic_type: e.target.value })} options={TOPIC_TYPES} />
            </Field>
          )}
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
                <Field label="YouTube URL (optional)"><Input value={u.youtube_url || ''} onChange={e => setU({ ...u, youtube_url: e.target.value })} placeholder="https://youtube.com/…" /></Field>
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
