"use client";
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar, type DataToolbarHandle } from '@/components/ui/DataToolbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, BookOpen, Trash2, Edit2, Globe, CheckCircle2, XCircle, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, AlertTriangle, Eye, Loader2, X } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import type { Language } from '@/lib/types';

/* ── Local types ── */
interface Course {
  id: number;
  code: string;
  slug: string;
  name?: string;
  is_active: boolean;
  [key: string]: any;
}

interface CourseTranslation {
  id: number;
  course_id: number;
  language_id: number;
  title: string;
  short_intro?: string | null;
  long_intro?: string | null;
  tagline?: string | null;
  web_thumbnail?: string | null;
  web_banner?: string | null;
  app_thumbnail?: string | null;
  app_banner?: string | null;
  video_title?: string | null;
  video_description?: string | null;
  video_thumbnail?: string | null;
  video_duration_minutes?: number | null;
  tags?: any;
  is_new_title?: string | null;
  prerequisites?: any;
  skills_gain?: any;
  what_you_will_learn?: any;
  course_includes?: any;
  course_is_for?: any;
  apply_for_designations?: any;
  demand_in_countries?: any;
  salary_standard?: any;
  future_courses?: any;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  canonical_url?: string | null;
  og_site_name?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_type?: string | null;
  og_image?: string | null;
  og_url?: string | null;
  twitter_site?: string | null;
  twitter_title?: string | null;
  twitter_description?: string | null;
  twitter_image?: string | null;
  twitter_card?: string | null;
  robots_directive?: string | null;
  focus_keyword?: string | null;
  structured_data?: any;
  is_active: boolean;
  sort_order?: number | null;
  deleted_at?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  courses?: { code: string; slug?: string; name?: string } | null;
  languages?: { name: string; iso_code?: string; native_name?: string } | null;
}

interface CoverageItem {
  course_id: number;
  total_languages: number;
  translated_count: number;
  missing_count: number;
  is_complete: boolean;
  translated_languages: { id: number; name: string; iso_code: string }[];
  missing_languages: { id: number; name: string; iso_code: string }[];
}

const TABS = ['Basic', 'Content', 'Video', 'Data', 'SEO', 'OG', 'Twitter', 'Images'] as const;

type SortField = 'id' | 'title' | 'is_active';

function ViewField({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <span className="block text-xs font-medium text-slate-500 mb-0.5">{label}</span>
      {value ? (
        <p className={cn('text-sm text-slate-900 whitespace-pre-wrap', mono && 'font-mono text-xs bg-slate-50 p-2 rounded-lg border border-slate-100 max-h-48 overflow-auto')}>{value}</p>
      ) : (
        <p className="text-sm text-slate-300 italic">Not set</p>
      )}
    </div>
  );
}

function jsonPretty(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  try { return JSON.stringify(val, null, 2); } catch { return String(val); }
}

export default function CourseTranslationsPage() {
  const [items, setItems] = useState<CourseTranslation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [coverage, setCoverage] = useState<CoverageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CourseTranslation | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [filterCourse, setFilterCourse] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>('Basic');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = usePageSize();
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  // Image files
  const [webThumbnailFile, setWebThumbnailFile] = useState<File | null>(null);
  const [webThumbnailPreview, setWebThumbnailPreview] = useState<string | null>(null);
  const [webBannerFile, setWebBannerFile] = useState<File | null>(null);
  const [webBannerPreview, setWebBannerPreview] = useState<string | null>(null);
  const [appThumbnailFile, setAppThumbnailFile] = useState<File | null>(null);
  const [appThumbnailPreview, setAppThumbnailPreview] = useState<string | null>(null);
  const [appBannerFile, setAppBannerFile] = useState<File | null>(null);
  const [appBannerPreview, setAppBannerPreview] = useState<string | null>(null);
  const [videoThumbnailFile, setVideoThumbnailFile] = useState<File | null>(null);
  const [videoThumbnailPreview, setVideoThumbnailPreview] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { register, handleSubmit, reset, setValue, getValues, watch } = useForm();
  const [formLoading, setFormLoading] = useState(false);
  const [formMode, setFormMode] = useState<'new' | 'existing'>('new');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewItem, setViewItem] = useState<CourseTranslation | null>(null);
  const [viewTab, setViewTab] = useState<typeof TABS[number]>('Basic');

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const router = useRouter();

  // ─── Auto-fetch translation when course or language changes ───
  const watchedCourseId = watch('course_id');
  const watchedLangId = watch('language_id');
  const skipAutoFetchRef = useRef(false);

  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
    { key: 'g d', action: () => router.push('/dashboard') },
    { key: 'g u', action: () => router.push('/users') },
    { key: 'g c', action: () => router.push('/courses') },
  ]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (skipAutoFetchRef.current) {
      skipAutoFetchRef.current = false;
      return;
    }
    if (!watchedCourseId || !watchedLangId) return;

    let cancelled = false;
    const fetchTranslation = async () => {
      setFormLoading(true);
      const qs = `?course_id=${watchedCourseId}&language_id=${watchedLangId}&limit=1`;
      const res = await api.listCourseTranslations(qs);
      if (cancelled) return;

      if (res.success && res.data && res.data.length > 0) {
        const item = res.data[0] as CourseTranslation;
        setEditing(item);
        setFormMode('existing');
        populateForm(item);
        toast.info(`Loaded existing ${languages.find(l => String(l.id) === String(watchedLangId))?.name || ''} translation`);
      } else {
        setEditing(null);
        setFormMode('new');
        clearFormFields();
      }
      setFormLoading(false);
    };

    const timer = setTimeout(fetchTranslation, 150);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [watchedCourseId, watchedLangId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.listCourses('?limit=500&sort=code&ascending=true').then(res => { if (res.success) setCourses((res.data || []).filter((c: Course) => c.is_active)); });
    api.listLanguages('?for_material=true&limit=100').then(res => { if (res.success) setLanguages((res.data || []).filter((l: Language) => l.is_active)); });
    refreshSummary();
    loadCoverage();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterCourse, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, filterCourse, filterLanguage, filterStatus, sortField, sortOrder, pageSize, showTrash]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refreshSummary() {
    const res = await api.getTableSummary('course_translations');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  async function loadCoverage() {
    const res = await api.getCourseTranslationCoverage();
    if (res.success && Array.isArray(res.data)) setCoverage(res.data);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterCourse) qs.set('course_id', filterCourse);
      if (filterLanguage) qs.set('language_id', filterLanguage);
      if (filterStatus) qs.set('is_active', filterStatus);
    }
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listCourseTranslations('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  function resetImageState() {
    setWebThumbnailFile(null); setWebThumbnailPreview(null);
    setWebBannerFile(null); setWebBannerPreview(null);
    setAppThumbnailFile(null); setAppThumbnailPreview(null);
    setAppBannerFile(null); setAppBannerPreview(null);
    setVideoThumbnailFile(null); setVideoThumbnailPreview(null);
  }

  const defaultFormValues = {
    course_id: '', language_id: '',
    title: '', short_intro: '', long_intro: '', tagline: '',
    is_active: true, sort_order: 0,
    // Video
    video_title: '', video_description: '', video_thumbnail: '', video_duration_minutes: '',
    // Data fields
    tags: '[]', is_new_title: '',
    prerequisites: '[]', skills_gain: '[]', what_you_will_learn: '[]',
    course_includes: '[]', course_is_for: '[]',
    apply_for_designations: '[]', demand_in_countries: '[]',
    salary_standard: '[]', future_courses: '[]',
    // SEO
    meta_title: '', meta_description: '', meta_keywords: '',
    canonical_url: '', robots_directive: '', focus_keyword: '',
    structured_data: '{}',
    // OG
    og_site_name: '', og_title: '', og_description: '', og_type: '', og_image: '', og_url: '',
    // Twitter
    twitter_site: '', twitter_title: '', twitter_description: '', twitter_image: '', twitter_card: '',
    // Images (URL fields — files handled separately)
    web_thumbnail: '', web_banner: '', app_thumbnail: '', app_banner: '',
  };

  function clearFormFields() {
    const cid = getValues('course_id');
    const lid = getValues('language_id');
    Object.entries(defaultFormValues).forEach(([k, v]) => setValue(k, v));
    setValue('course_id', cid);
    setValue('language_id', lid);
    resetImageState();
  }

  function populateForm(item: CourseTranslation) {
    setValue('title', item.title || '');
    setValue('short_intro', item.short_intro || '');
    setValue('long_intro', item.long_intro || '');
    setValue('tagline', item.tagline || '');
    setValue('is_active', item.is_active ?? true);
    setValue('sort_order', item.sort_order ?? 0);
    // Video
    setValue('video_title', item.video_title || '');
    setValue('video_description', item.video_description || '');
    setValue('video_thumbnail', item.video_thumbnail || '');
    setValue('video_duration_minutes', item.video_duration_minutes ?? '');
    // Data
    setValue('tags', jsonPretty(item.tags) || '[]');
    setValue('is_new_title', item.is_new_title || '');
    setValue('prerequisites', jsonPretty(item.prerequisites) || '[]');
    setValue('skills_gain', jsonPretty(item.skills_gain) || '[]');
    setValue('what_you_will_learn', jsonPretty(item.what_you_will_learn) || '[]');
    setValue('course_includes', jsonPretty(item.course_includes) || '[]');
    setValue('course_is_for', jsonPretty(item.course_is_for) || '[]');
    setValue('apply_for_designations', jsonPretty(item.apply_for_designations) || '[]');
    setValue('demand_in_countries', jsonPretty(item.demand_in_countries) || '[]');
    setValue('salary_standard', jsonPretty(item.salary_standard) || '[]');
    setValue('future_courses', jsonPretty(item.future_courses) || '[]');
    // SEO
    setValue('meta_title', item.meta_title || '');
    setValue('meta_description', item.meta_description || '');
    setValue('meta_keywords', item.meta_keywords || '');
    setValue('canonical_url', item.canonical_url || '');
    setValue('robots_directive', item.robots_directive || '');
    setValue('focus_keyword', item.focus_keyword || '');
    setValue('structured_data', jsonPretty(item.structured_data) || '{}');
    // OG
    setValue('og_site_name', item.og_site_name || '');
    setValue('og_title', item.og_title || '');
    setValue('og_description', item.og_description || '');
    setValue('og_type', item.og_type || '');
    setValue('og_image', item.og_image || '');
    setValue('og_url', item.og_url || '');
    // Twitter
    setValue('twitter_site', item.twitter_site || '');
    setValue('twitter_title', item.twitter_title || '');
    setValue('twitter_description', item.twitter_description || '');
    setValue('twitter_image', item.twitter_image || '');
    setValue('twitter_card', item.twitter_card || '');
    // Images
    setValue('web_thumbnail', item.web_thumbnail || '');
    setValue('web_banner', item.web_banner || '');
    setValue('app_thumbnail', item.app_thumbnail || '');
    setValue('app_banner', item.app_banner || '');
    resetImageState();
  }

  function openCreate() {
    skipAutoFetchRef.current = true;
    setEditing(null); setFormMode('new'); resetImageState(); setDialogKey(k => k + 1); setActiveTab('Basic');
    reset({ ...defaultFormValues, course_id: courses[0]?.id || '', language_id: languages[0]?.id || '' });
    setDialogOpen(true);
  }

  function openEdit(item: CourseTranslation) {
    skipAutoFetchRef.current = true;
    setEditing(item); setFormMode('existing'); resetImageState(); setDialogKey(k => k + 1); setActiveTab('Basic');
    reset({
      course_id: item.course_id, language_id: item.language_id,
      title: item.title || '', short_intro: item.short_intro || '', long_intro: item.long_intro || '', tagline: item.tagline || '',
      is_active: item.is_active ?? true, sort_order: item.sort_order ?? 0,
      video_title: item.video_title || '', video_description: item.video_description || '',
      video_thumbnail: item.video_thumbnail || '', video_duration_minutes: item.video_duration_minutes ?? '',
      tags: jsonPretty(item.tags) || '[]', is_new_title: item.is_new_title || '',
      prerequisites: jsonPretty(item.prerequisites) || '[]', skills_gain: jsonPretty(item.skills_gain) || '[]',
      what_you_will_learn: jsonPretty(item.what_you_will_learn) || '[]', course_includes: jsonPretty(item.course_includes) || '[]',
      course_is_for: jsonPretty(item.course_is_for) || '[]', apply_for_designations: jsonPretty(item.apply_for_designations) || '[]',
      demand_in_countries: jsonPretty(item.demand_in_countries) || '[]', salary_standard: jsonPretty(item.salary_standard) || '[]',
      future_courses: jsonPretty(item.future_courses) || '[]',
      meta_title: item.meta_title || '', meta_description: item.meta_description || '', meta_keywords: item.meta_keywords || '',
      canonical_url: item.canonical_url || '', robots_directive: item.robots_directive || '', focus_keyword: item.focus_keyword || '',
      structured_data: jsonPretty(item.structured_data) || '{}',
      og_site_name: item.og_site_name || '', og_title: item.og_title || '', og_description: item.og_description || '',
      og_type: item.og_type || '', og_image: item.og_image || '', og_url: item.og_url || '',
      twitter_site: item.twitter_site || '', twitter_title: item.twitter_title || '',
      twitter_description: item.twitter_description || '', twitter_image: item.twitter_image || '', twitter_card: item.twitter_card || '',
      web_thumbnail: item.web_thumbnail || '', web_banner: item.web_banner || '',
      app_thumbnail: item.app_thumbnail || '', app_banner: item.app_banner || '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();

    // Scalar text fields
    const scalarFields = [
      'course_id', 'language_id', 'title', 'short_intro', 'long_intro', 'tagline',
      'video_title', 'video_description', 'video_thumbnail', 'video_duration_minutes',
      'is_new_title', 'sort_order',
      'meta_title', 'meta_description', 'meta_keywords', 'canonical_url',
      'robots_directive', 'focus_keyword',
      'og_site_name', 'og_title', 'og_description', 'og_type', 'og_image', 'og_url',
      'twitter_site', 'twitter_title', 'twitter_description', 'twitter_image', 'twitter_card',
      'web_thumbnail', 'web_banner', 'app_thumbnail', 'app_banner',
    ];
    scalarFields.forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });

    // Boolean
    fd.append('is_active', String(data.is_active === true || data.is_active === 'true'));

    // JSONB fields - pass as-is (server parses)
    const jsonbFields = [
      'tags', 'prerequisites', 'skills_gain', 'what_you_will_learn',
      'course_includes', 'course_is_for', 'apply_for_designations',
      'demand_in_countries', 'salary_standard', 'future_courses', 'structured_data',
    ];
    jsonbFields.forEach(k => {
      if (data[k]) fd.append(k, data[k]);
    });

    // Image files
    if (webThumbnailFile) fd.append('web_thumbnail_file', webThumbnailFile, webThumbnailFile.name);
    if (webBannerFile) fd.append('web_banner_file', webBannerFile, webBannerFile.name);
    if (appThumbnailFile) fd.append('app_thumbnail_file', appThumbnailFile, appThumbnailFile.name);
    if (appBannerFile) fd.append('app_banner_file', appBannerFile, appBannerFile.name);
    if (videoThumbnailFile) fd.append('video_thumbnail_file', videoThumbnailFile, videoThumbnailFile.name);

    const res = editing
      ? await api.updateCourseTranslation(editing.id, fd, true)
      : await api.createCourseTranslation(fd, true);
    if (res.success) {
      toast.success(editing ? 'Translation updated' : 'Translation created');
      setDialogOpen(false); load(); refreshSummary(); loadCoverage();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(item: CourseTranslation) {
    if (!confirm(`Move "${item.title}" to trash? You can restore it later.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deleteCourseTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: CourseTranslation) {
    setActionLoadingId(item.id);
    const res = await api.restoreCourseTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success(`"${item.title}" restored`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: CourseTranslation) {
    if (!confirm(`PERMANENTLY delete "${item.title}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.permanentDeleteCourseTranslation(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Translation permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(item: CourseTranslation) {
    const fd = new FormData();
    fd.append('is_active', String(!item.is_active));
    const res = await api.updateCourseTranslation(item.id, fd, true);
    if (res.success) { toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  function openView(item: CourseTranslation) {
    setViewItem(item);
    setViewTab('Basic');
    setViewOpen(true);
  }

  // Bulk selection helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  }
  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} translation(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.deleteCourseTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} translation(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.restoreCourseTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }
  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} translation(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) { const res = await api.permanentDeleteCourseTranslation(ids[i]); if (res.success) ok++; setBulkProgress({ done: i + 1, total: ids.length }); }
    toast.success(`${ok} translation(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary(); setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
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

  function getCoverage(courseId: number): CoverageItem | undefined {
    return coverage.find(c => c.course_id === courseId);
  }

  /* ── Shared select class ── */
  const selectClass = "px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="animate-fade-in">
      <PageHeader title="Course Translations" description="Manage multi-language translations for courses"
        actions={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button> : undefined} />

      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Translations', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button onClick={() => setShowTrash(false)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Translations
        </button>
        <button onClick={() => setShowTrash(true)}
          className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search translations...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
              <option value="">All courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
            </select>
            <select className={selectClass} value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
              <option value="">All languages</option>
              {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat">
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

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={showTrash ? Trash2 : BookOpen} title={showTrash ? 'Trash is empty' : 'No translations yet'} description={showTrash ? 'Deleted translations will appear here' : 'Add your first course translation'}
          action={!showTrash ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add translation</Button> : undefined} />
      ) : (
        <>
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
                  <TH>Course</TH>
                  <TH>Language</TH>
                  <TH><button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Title <SortIcon field="title" /></button></TH>
                  <TH>Coverage</TH>
                  {showTrash && <TH>Deleted</TH>}
                  <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="is_active" /></button></TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {items.map(item => {
                  const cov = getCoverage(item.course_id);
                  return (
                    <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-brand-50/40')}>
                      <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                      <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                      <TD className="py-2.5">{item.courses?.code ? <Badge variant="info">{item.courses.code}</Badge> : <span className="text-slate-300">--</span>}</TD>
                      <TD className="py-2.5">{item.languages?.name ? <Badge variant="muted">{item.languages.name}{item.languages.iso_code ? ` (${item.languages.iso_code})` : ''}</Badge> : <span className="text-slate-300">--</span>}</TD>
                      <TD className="py-2.5"><span className={cn('font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.title}</span></TD>
                      <TD className="py-2.5">
                        {cov ? (
                          <span className={cn('text-xs font-medium', cov.is_complete ? 'text-emerald-600' : 'text-amber-600')}>
                            {cov.translated_count}/{cov.total_languages}
                          </span>
                        ) : <span className="text-slate-300">--</span>}
                      </TD>
                      {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '--'}</span></TD>}
                      <TD className="py-2.5">
                        {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                      </TD>
                      <TD className="py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {showTrash ? (
                            <>
                              <button onClick={() => onRestore(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}</button>
                              <button onClick={() => onPermanentDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => openView(item)} className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                              <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => onSoftDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">{actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}</button>
                            </>
                          )}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={(s) => setPageSize(s)} total={total} showingCount={items.length} />
          </div>
        </>
      )}

      {/* ─── View Dialog ─── */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} title="View Course Translation" size="lg">
        {viewItem && (
          <div className="p-6 space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="info">{courses.find(c => c.id === viewItem.course_id)?.code || `Course #${viewItem.course_id}`}</Badge>
              <Badge variant="muted">{viewItem.languages?.name || `Lang #${viewItem.language_id}`}{viewItem.languages?.iso_code ? ` (${viewItem.languages.iso_code})` : ''}</Badge>
              <Badge variant={viewItem.is_active ? 'success' : 'danger'}>{viewItem.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>

            {/* View Tabs */}
            <div className="flex gap-1 border-b border-slate-200 pb-0 overflow-x-auto">
              {TABS.map(tab => (
                <button key={tab} type="button" onClick={() => setViewTab(tab)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${viewTab === tab ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {viewTab === 'Basic' && (
              <div className="space-y-3">
                <ViewField label="Title" value={viewItem.title} />
                <ViewField label="Tagline" value={viewItem.tagline} />
                <ViewField label="Short Intro" value={viewItem.short_intro} />
                <ViewField label="Is New Title" value={viewItem.is_new_title} />
                <ViewField label="Sort Order" value={String(viewItem.sort_order ?? 0)} />
              </div>
            )}

            {viewTab === 'Content' && (
              <div className="space-y-3">
                <ViewField label="Long Intro" value={viewItem.long_intro} />
              </div>
            )}

            {viewTab === 'Video' && (
              <div className="space-y-3">
                <ViewField label="Video Title" value={viewItem.video_title} />
                <ViewField label="Video Description" value={viewItem.video_description} />
                <ViewField label="Video Duration (min)" value={viewItem.video_duration_minutes != null ? String(viewItem.video_duration_minutes) : null} />
              </div>
            )}

            {viewTab === 'Data' && (
              <div className="space-y-3">
                <ViewField label="Tags" value={jsonPretty(viewItem.tags)} mono />
                <ViewField label="Prerequisites" value={jsonPretty(viewItem.prerequisites)} mono />
                <ViewField label="Skills Gain" value={jsonPretty(viewItem.skills_gain)} mono />
                <ViewField label="What You Will Learn" value={jsonPretty(viewItem.what_you_will_learn)} mono />
                <ViewField label="Course Includes" value={jsonPretty(viewItem.course_includes)} mono />
                <ViewField label="Course Is For" value={jsonPretty(viewItem.course_is_for)} mono />
                <ViewField label="Apply For Designations" value={jsonPretty(viewItem.apply_for_designations)} mono />
                <ViewField label="Demand In Countries" value={jsonPretty(viewItem.demand_in_countries)} mono />
                <ViewField label="Salary Standard" value={jsonPretty(viewItem.salary_standard)} mono />
                <ViewField label="Future Courses" value={jsonPretty(viewItem.future_courses)} mono />
              </div>
            )}

            {viewTab === 'SEO' && (
              <div className="space-y-3">
                <ViewField label="Meta Title" value={viewItem.meta_title} />
                <ViewField label="Meta Description" value={viewItem.meta_description} />
                <ViewField label="Meta Keywords" value={viewItem.meta_keywords} />
                <ViewField label="Canonical URL" value={viewItem.canonical_url} />
                <ViewField label="Robots Directive" value={viewItem.robots_directive} />
                <ViewField label="Focus Keyword" value={viewItem.focus_keyword} />
                <ViewField label="Structured Data" value={jsonPretty(viewItem.structured_data)} mono />
              </div>
            )}

            {viewTab === 'OG' && (
              <div className="space-y-3">
                <ViewField label="OG Site Name" value={viewItem.og_site_name} />
                <ViewField label="OG Title" value={viewItem.og_title} />
                <ViewField label="OG Description" value={viewItem.og_description} />
                <ViewField label="OG Type" value={viewItem.og_type} />
                <ViewField label="OG Image" value={viewItem.og_image} />
                <ViewField label="OG URL" value={viewItem.og_url} />
              </div>
            )}

            {viewTab === 'Twitter' && (
              <div className="space-y-3">
                <ViewField label="Twitter Site" value={viewItem.twitter_site} />
                <ViewField label="Twitter Title" value={viewItem.twitter_title} />
                <ViewField label="Twitter Description" value={viewItem.twitter_description} />
                <ViewField label="Twitter Image" value={viewItem.twitter_image} />
                <ViewField label="Twitter Card" value={viewItem.twitter_card} />
              </div>
            )}

            {viewTab === 'Images' && (
              <div className="space-y-3">
                {(['web_thumbnail', 'web_banner', 'app_thumbnail', 'app_banner', 'video_thumbnail'] as const).map(key => (
                  <div key={key}>
                    <span className="block text-xs font-medium text-slate-500 mb-1">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                    {(viewItem as any)[key] ? (
                      <img src={(viewItem as any)[key]} alt={key} className="max-h-40 rounded-lg border border-slate-200" />
                    ) : (
                      <p className="text-sm text-slate-300 italic">Not set</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => { setViewOpen(false); openEdit(viewItem); }}>
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Button>
              <Button type="button" variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ─── Edit / Create Dialog ─── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Course Translation' : 'Add Course Translation'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle -- only shown when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This translation is currently active' : 'This translation is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getCourseTranslation(editing.id);
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
                <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform', editing.is_active ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          )}

          {/* Mode badge */}
          <div className="flex items-center gap-2">
            <Badge variant={formMode === 'existing' ? 'info' : 'success'}>
              {formMode === 'existing' ? 'Editing existing translation' : 'New translation'}
            </Badge>
            {formLoading && <span className="text-xs text-slate-400 animate-pulse">Loading translation...</span>}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 pb-0 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${activeTab === tab ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Basic Tab */}
          {activeTab === 'Basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
                  <select className={cn(selectClass, 'w-full')} {...register('course_id', { required: true })}>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                  <select className={cn(selectClass, 'w-full')} {...register('language_id', { required: true })}>
                    {languages.map(l => <option key={l.id} value={l.id}>{l.name}{l.native_name ? ` (${l.native_name})` : ''}</option>)}
                  </select>
                </div>
              </div>
              <Input label="Title" placeholder="Course title in target language" {...register('title', { required: true })} />
              <Input label="Tagline" placeholder="Short tagline" {...register('tagline')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Short Intro</label>
                <textarea className={cn(selectClass, 'w-full min-h-[80px]')} placeholder="Brief course introduction..." {...register('short_intro')} />
              </div>
              <Input label="Is New Title" placeholder="e.g. 'New!' or 'Just Launched'" {...register('is_new_title')} />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                    Active
                  </label>
                </div>
                <div>
                  <Input label="Sort Order" type="number" placeholder="0" {...register('sort_order', { valueAsNumber: true })} />
                </div>
              </div>
            </div>
          )}

          {/* Content Tab */}
          {activeTab === 'Content' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Long Intro</label>
                <textarea className={cn(selectClass, 'w-full min-h-[200px]')} placeholder="Detailed course introduction..." {...register('long_intro')} />
              </div>
            </div>
          )}

          {/* Video Tab */}
          {activeTab === 'Video' && (
            <div className="space-y-4">
              <Input label="Video Title" placeholder="Video title" {...register('video_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Video Description</label>
                <textarea className={cn(selectClass, 'w-full min-h-[100px]')} placeholder="Video description..." {...register('video_description')} />
              </div>
              <Input label="Video Duration (minutes)" type="number" placeholder="0" {...register('video_duration_minutes')} />
            </div>
          )}

          {/* Data Tab (JSONB fields) */}
          {activeTab === 'Data' && (
            <div className="space-y-4">
              {[
                { field: 'tags', label: 'Tags', placeholder: '["tag1", "tag2"]' },
                { field: 'prerequisites', label: 'Prerequisites', placeholder: '["Basic knowledge of..."]' },
                { field: 'skills_gain', label: 'Skills Gain', placeholder: '["Skill 1", "Skill 2"]' },
                { field: 'what_you_will_learn', label: 'What You Will Learn', placeholder: '["Topic 1", "Topic 2"]' },
                { field: 'course_includes', label: 'Course Includes', placeholder: '["Video lectures", "Assignments"]' },
                { field: 'course_is_for', label: 'Course Is For', placeholder: '["Students", "Professionals"]' },
                { field: 'apply_for_designations', label: 'Apply For Designations', placeholder: '["Designation 1"]' },
                { field: 'demand_in_countries', label: 'Demand In Countries', placeholder: '["India", "USA"]' },
                { field: 'salary_standard', label: 'Salary Standard', placeholder: '[{"country": "India", "min": 500000}]' },
                { field: 'future_courses', label: 'Future Courses', placeholder: '["Advanced course 1"]' },
              ].map(item => (
                <div key={item.field}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{item.label} (JSON)</label>
                  <textarea className={cn(selectClass, 'w-full min-h-[80px] font-mono text-xs')} placeholder={item.placeholder} {...register(item.field)} />
                </div>
              ))}
            </div>
          )}

          {/* SEO Tab */}
          {activeTab === 'SEO' && (
            <div className="space-y-4">
              <Input label="Meta Title" placeholder="SEO title" {...register('meta_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Meta Description</label>
                <textarea className={cn(selectClass, 'w-full min-h-[80px]')} placeholder="SEO description..." {...register('meta_description')} />
              </div>
              <Input label="Meta Keywords" placeholder="keyword1, keyword2" {...register('meta_keywords')} />
              <Input label="Canonical URL" placeholder="https://..." {...register('canonical_url')} />
              <Input label="Robots Directive" placeholder="index, follow" {...register('robots_directive')} />
              <Input label="Focus Keyword" placeholder="main keyword" {...register('focus_keyword')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Structured Data (JSON-LD)</label>
                <textarea className={cn(selectClass, 'w-full min-h-[120px] font-mono text-xs')} placeholder='{"@context": "https://schema.org", ...}' {...register('structured_data')} />
              </div>
            </div>
          )}

          {/* OG Tab */}
          {activeTab === 'OG' && (
            <div className="space-y-4">
              <Input label="OG Site Name" placeholder="Site name" {...register('og_site_name')} />
              <Input label="OG Title" placeholder="Open Graph title" {...register('og_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">OG Description</label>
                <textarea className={cn(selectClass, 'w-full min-h-[80px]')} placeholder="Open Graph description..." {...register('og_description')} />
              </div>
              <Input label="OG Type" placeholder="website" {...register('og_type')} />
              <Input label="OG Image URL" placeholder="https://..." {...register('og_image')} />
              <Input label="OG URL" placeholder="https://..." {...register('og_url')} />
            </div>
          )}

          {/* Twitter Tab */}
          {activeTab === 'Twitter' && (
            <div className="space-y-4">
              <Input label="Twitter Site" placeholder="@handle" {...register('twitter_site')} />
              <Input label="Twitter Title" placeholder="Twitter card title" {...register('twitter_title')} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Twitter Description</label>
                <textarea className={cn(selectClass, 'w-full min-h-[80px]')} placeholder="Twitter card description..." {...register('twitter_description')} />
              </div>
              <Input label="Twitter Image URL" placeholder="https://..." {...register('twitter_image')} />
              <Input label="Twitter Card" placeholder="summary_large_image" {...register('twitter_card')} />
            </div>
          )}

          {/* Images Tab */}
          {activeTab === 'Images' && (
            <div className="space-y-4">
              <ImageUpload key={`wt-${dialogKey}`} label="Web Thumbnail" hint="Recommended: 400x300px"
                value={editing?.web_thumbnail} aspectRatio={400 / 300} maxWidth={400} maxHeight={300} shape="rounded"
                onChange={(file, preview) => { setWebThumbnailFile(file); setWebThumbnailPreview(preview); }} />
              <ImageUpload key={`wb-${dialogKey}`} label="Web Banner" hint="Recommended: 1200x400px"
                value={editing?.web_banner} aspectRatio={1200 / 400} maxWidth={1200} maxHeight={400} shape="rounded"
                onChange={(file, preview) => { setWebBannerFile(file); setWebBannerPreview(preview); }} />
              <ImageUpload key={`at-${dialogKey}`} label="App Thumbnail" hint="Recommended: 300x200px"
                value={editing?.app_thumbnail} aspectRatio={300 / 200} maxWidth={300} maxHeight={200} shape="rounded"
                onChange={(file, preview) => { setAppThumbnailFile(file); setAppThumbnailPreview(preview); }} />
              <ImageUpload key={`ab-${dialogKey}`} label="App Banner" hint="Recommended: 800x400px"
                value={editing?.app_banner} aspectRatio={800 / 400} maxWidth={800} maxHeight={400} shape="rounded"
                onChange={(file, preview) => { setAppBannerFile(file); setAppBannerPreview(preview); }} />
              <ImageUpload key={`vt-${dialogKey}`} label="Video Thumbnail" hint="Recommended: 640x360px"
                value={editing?.video_thumbnail} aspectRatio={640 / 360} maxWidth={640} maxHeight={360} shape="rounded"
                onChange={(file, preview) => { setVideoThumbnailFile(file); setVideoThumbnailPreview(preview); }} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={formLoading}>{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
