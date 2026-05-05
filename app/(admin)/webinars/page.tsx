"use client";
import { useEffect, useState, useRef, useCallback } from 'react';
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
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Video, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle, Loader2, Check, X, Sparkles, Users, DollarSign, Clock, Globe } from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePageSize } from '@/hooks/usePageSize';

type SortField = 'id' | 'title' | 'webinar_status' | 'webinar_owner' | 'price' | 'display_order' | 'is_active' | 'scheduled_at';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-blue-50 text-blue-700',
  live: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-50 text-red-700',
};

const OWNER_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'instructor', label: 'Instructor' },
];

const OWNER_COLORS: Record<string, string> = {
  system: 'bg-blue-50 text-blue-700',
  instructor: 'bg-violet-50 text-violet-700',
};

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

export default function WebinarsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [activeTab, setActiveTab] = useState('basic');

  // Translation dialog
  const [translationDialogOpen, setTranslationDialogOpen] = useState(false);
  const [translationWebinar, setTranslationWebinar] = useState<any | null>(null);
  const [translations, setTranslations] = useState<any[]>([]);
  const [translationCoverage, setTranslationCoverage] = useState<any[]>([]);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [editingTranslation, setEditingTranslation] = useState<any | null>(null);
  const [translationFormKey, setTranslationFormKey] = useState(0);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Pagination, search, sort, filter
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('display_order');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterWebinarStatus, setFilterWebinarStatus] = useState<string>('');
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [filterCourse, setFilterCourse] = useState<string>('');

  // Table summary stats
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number; updated_at: string } | null>(null);

  // Trash mode
  const [showTrash, setShowTrash] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Courses list for filter & form
  const [courses, setCourses] = useState<any[]>([]);

  const toolbarRef = useRef<DataToolbarHandle>(null);

  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const { register: registerTr, handleSubmit: handleSubmitTr, reset: resetTr, setValue: setValueTr } = useForm();

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: '/', action: () => toolbarRef.current?.focusSearch() },
    { key: 'n', action: () => { if (!showTrash) openCreate(); } },
    { key: 'r', action: () => load() },
    { key: 't', action: () => setShowTrash(prev => !prev) },
    { key: 'ctrl+a', action: () => toggleSelectAll() },
    { key: 'ArrowRight', action: () => { if (page < totalPages) setPage(p => p + 1); } },
    { key: 'ArrowLeft', action: () => { if (page > 1) setPage(p => p - 1); } },
  ]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary + courses once on mount
  useEffect(() => {
    api.getTableSummary('webinars').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
    api.listCourses('?is_active=true&limit=200').then(res => {
      if (res.success) setCourses(res.data || []);
    });
  }, []);

  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, filterWebinarStatus, filterOwner, filterCourse, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, filterWebinarStatus, filterOwner, filterCourse, showTrash]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    if (showTrash) {
      qs.set('show_deleted', 'true');
    } else {
      if (filterStatus) qs.set('is_active', filterStatus);
      if (filterWebinarStatus) qs.set('webinar_status', filterWebinarStatus);
      if (filterOwner) qs.set('webinar_owner', filterOwner);
      if (filterCourse) qs.set('course_id', filterCourse);
    }
    const res = await api.listWebinars('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('webinars');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  // AI generate all translations for a webinar
  async function handleAIGenerate(webinarId: number) {
    setAiGenerating(true);
    try {
      const res = await api.autoTranslateWebinar({ entity_type: 'webinar', entity_id: webinarId, provider: 'gemini' });
      if (res.success) {
        toast.success('AI translations generated successfully');
        if (translationWebinar?.id === webinarId) loadTranslations(webinarId);
      } else {
        toast.error(res.error || 'AI generation failed');
      }
    } catch { toast.error('AI generation failed'); }
    setAiGenerating(false);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-brand-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-brand-600" />;
  }

  function handlePageSizeChange(size: number) {
    setPageSize(size);
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1); setActiveTab('basic');
    reset({
      title: '', code: '', slug: '', is_active: true,
      course_id: '', chapter_id: '', webinar_owner: 'system', webinar_status: 'draft',
      instructor_id: '', max_attendees: '', price: '', is_free: false,
      scheduled_at: '', duration_minutes: '', meeting_platform: '',
      meeting_link: '', recording_url: '', display_order: '',
    });
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditing(c); setDialogKey(k => k + 1); setActiveTab('basic');
    reset({
      title: c.title || '', code: c.code || '', slug: c.slug || '',
      is_active: c.is_active ?? true,
      course_id: c.course_id ?? '', chapter_id: c.chapter_id ?? '',
      webinar_owner: c.webinar_owner || 'system',
      webinar_status: c.webinar_status || 'draft',
      instructor_id: c.instructor_id ?? '', max_attendees: c.max_attendees ?? '',
      price: c.price ?? '', is_free: c.is_free ?? false,
      scheduled_at: c.scheduled_at ? c.scheduled_at.substring(0, 16) : '',
      duration_minutes: c.duration_minutes ?? '',
      meeting_platform: c.meeting_platform || '', meeting_link: c.meeting_link || '',
      recording_url: c.recording_url || '',
      display_order: c.display_order ?? '',
    });
    setDialogOpen(true);
  }

  function openView(c: any) {
    setViewing(c);
  }

  // Translation management
  async function openTranslations(webinar: any) {
    setTranslationWebinar(webinar);
    setTranslationDialogOpen(true);
    setEditingTranslation(null);
    await loadTranslations(webinar.id);
  }

  async function loadTranslations(webinarId: number) {
    setTranslationLoading(true);
    const [covRes, trRes] = await Promise.all([
      api.webinarTranslationCoverage(`?webinar_id=${webinarId}`),
      api.listWebinarTranslations(`?webinar_id=${webinarId}&limit=50`),
    ]);
    if (covRes.success) setTranslationCoverage(covRes.data || []);
    if (trRes.success) setTranslations(trRes.data || []);
    setTranslationLoading(false);
  }

  function openTranslationEdit(lang: any) {
    const existing = translations.find(t => t.language_id === lang.language_id);
    setEditingTranslation(existing || { language_id: lang.language_id, language_name: lang.language_name });
    setTranslationFormKey(k => k + 1);
    if (existing) {
      resetTr({
        title: existing.title || '',
        short_description: existing.short_description || '',
        description: existing.description || '',
        tags: existing.tags ? JSON.stringify(existing.tags) : '',
        meta_title: existing.meta_title || '',
        meta_description: existing.meta_description || '',
        meta_keywords: existing.meta_keywords || '',
        og_title: existing.og_title || '',
        og_description: existing.og_description || '',
        twitter_title: existing.twitter_title || '',
        twitter_description: existing.twitter_description || '',
        focus_keyword: existing.focus_keyword || '',
        is_active: existing.is_active ?? true,
      });
    } else {
      resetTr({
        title: '', short_description: '', description: '', tags: '',
        meta_title: '', meta_description: '', meta_keywords: '',
        og_title: '', og_description: '', twitter_title: '', twitter_description: '',
        focus_keyword: '', is_active: true,
      });
    }
  }

  async function onTranslationSubmit(data: any) {
    const payload: any = { ...data };
    if (payload.tags) { try { payload.tags = JSON.parse(payload.tags); } catch { /* leave string */ } }
    if (typeof payload.is_active === 'string') payload.is_active = payload.is_active === 'true';

    let res;
    if (editingTranslation?.id) {
      res = await api.updateWebinarTranslation(editingTranslation.id, payload);
    } else {
      payload.webinar_id = translationWebinar.id;
      payload.language_id = editingTranslation.language_id;
      res = await api.createWebinarTranslation(payload);
    }
    if (res.success) {
      toast.success(editingTranslation?.id ? 'Translation updated' : 'Translation created');
      setEditingTranslation(null);
      await loadTranslations(translationWebinar.id);
      load(); // refresh main list
    } else toast.error(res.error || 'Failed');
  }

  async function onDeleteTranslation(tr: any) {
    if (!confirm(`Delete ${tr.languages?.name || ''} translation?`)) return;
    const res = await api.softDeleteWebinarTranslation(tr.id);
    if (res.success) {
      toast.success('Translation deleted');
      await loadTranslations(translationWebinar.id);
    } else toast.error(res.error || 'Failed');
  }

  async function onSubmit(data: any) {
    const payload: Record<string, any> = {};
    Object.keys(data).forEach(k => {
      const v = data[k];
      if (v === '' || v === undefined || v === null) return;
      if (typeof v === 'boolean') { payload[k] = v; return; }
      const numericFields = ['price', 'max_attendees', 'instructor_id', 'course_id', 'chapter_id', 'display_order', 'duration_minutes', 'registered_count'];
      if (numericFields.includes(k) && v !== '') { payload[k] = Number(v); return; }
      payload[k] = v;
    });

    const res = editing
      ? await api.updateWebinar(editing.id, payload)
      : await api.createWebinar(payload);
    if (res.success) {
      toast.success(editing ? 'Webinar updated' : 'Webinar created');
      setDialogOpen(false); load(); refreshSummary();
    } else toast.error(res.error || 'Failed');
  }

  async function onSoftDelete(c: any) {
    if (!confirm(`Move "${c.title || c.code}" to trash?`)) return;
    setActionLoadingId(c.id);
    const res = await api.softDeleteWebinar(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Webinar moved to trash'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onRestore(c: any) {
    setActionLoadingId(c.id);
    const res = await api.restoreWebinar(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Webinar restored'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(c: any) {
    if (!confirm(`PERMANENTLY delete "${c.title || c.code}"? This cannot be undone.`)) return;
    setActionLoadingId(c.id);
    const res = await api.deleteWebinar(c.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Webinar permanently deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(c: any) {
    const res = await api.updateWebinar(c.id, { is_active: !c.is_active });
    if (res.success) { toast.success(`${!c.is_active ? 'Activated' : 'Deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  // Bulk selection helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeleteWebinar(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restoreWebinar(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deleteWebinar(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set());
    load(); refreshSummary();
    setBulkActionLoading(false);
    setBulkProgress({ done: 0, total: 0 });
  }

  function formatPrice(val: any, isFree: boolean) {
    if (isFree) return null;
    if (val === null || val === undefined || val === '') return '--';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(val));
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  const formTabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'schedule', label: 'Schedule & Meeting' },
    { id: 'pricing', label: 'Pricing' },
  ];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Webinars"
        description="Manage webinars, scheduling, and translations"
        actions={
          <div className="flex items-center gap-2">
            {!showTrash && <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Webinar</Button>}
          </div>
        }
      />

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Webinars', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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
        <button
          onClick={() => setShowTrash(false)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
          )}
        >
          Webinars
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
          {summary && summary.is_deleted > 0 && (
            <span className={cn(
              'ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold',
              showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
            )}>
              {summary.is_deleted}
            </span>
          )}
        </button>
      </div>

      {/* Toolbar */}
      <DataToolbar
        ref={toolbarRef}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={showTrash ? 'Search trash...' : 'Search webinars...'}
      >
        {!showTrash && (
          <>
            <select className={selectClass} value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
              <option value="">All Courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
            </select>
            <select className={selectClass} value={filterWebinarStatus} onChange={e => setFilterWebinarStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
              <option value="">All Owners</option>
              {OWNER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Active</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </>
        )}
      </DataToolbar>

      {/* Trash banner */}
      {showTrash && (
        <div className="mt-3 mb-1 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Items in trash can be restored or permanently deleted. Permanent deletion cannot be undone.</span>
        </div>
      )}

      {loading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Video}
          title={showTrash ? 'Trash is empty' : 'No webinars yet'}
          description={showTrash ? 'No deleted webinars' : (searchDebounce || filterStatus || filterWebinarStatus || filterOwner || filterCourse ? 'No webinars match your filters' : 'Add your first webinar')}
          action={!showTrash && !searchDebounce && !filterStatus && !filterWebinarStatus && !filterOwner && !filterCourse ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add Webinar</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
          {/* Bulk action toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50 border-b border-brand-200">
              <span className="text-sm font-medium text-brand-700">{bulkActionLoading && bulkProgress.total > 0 ? `Processing ${bulkProgress.done}/${bulkProgress.total}...` : `${selectedIds.size} selected`}</span>
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
                <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"># <SortIcon field="id" /></button></TH>
                <TH>
                  <button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Title <SortIcon field="title" />
                  </button>
                </TH>
                <TH>Course</TH>
                <TH>
                  <button onClick={() => handleSort('webinar_status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Status <SortIcon field="webinar_status" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('scheduled_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Scheduled <SortIcon field="scheduled_at" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('price')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Price <SortIcon field="price" />
                  </button>
                </TH>
                {!showTrash && <TH>Translations</TH>}
                {showTrash && <TH>Deleted</TH>}
                <TH>
                  <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Active <SortIcon field="is_active" />
                  </button>
                </TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(c => (
                <TR key={c.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(c.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{c.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="flex flex-col">
                      <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{c.title || `Webinar #${c.id}`}</span>
                      {c.code && <span className="text-xs text-slate-400 font-mono">{c.code}</span>}
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-sm text-slate-600">{c.courses?.name || '--'}</span>
                  </TD>
                  <TD className="py-2.5">
                    {c.webinar_status ? (
                      <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[c.webinar_status] || 'bg-slate-50 text-slate-600')}>
                        {STATUS_OPTIONS.find(o => o.value === c.webinar_status)?.label || c.webinar_status}
                      </span>
                    ) : <span className="text-slate-300">--</span>}
                  </TD>
                  <TD className="py-2.5">
                    {c.scheduled_at ? (
                      <span className="text-xs text-slate-600">{new Date(c.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    ) : <span className="text-slate-300">--</span>}
                  </TD>
                  <TD className="py-2.5">
                    {c.is_free ? (
                      <Badge variant="success">FREE</Badge>
                    ) : (
                      <span className="text-sm font-medium text-slate-700">{formatPrice(c.price, false)}</span>
                    )}
                  </TD>
                  {!showTrash && (
                    <TD className="py-2.5">
                      <button
                        onClick={() => openTranslations(c)}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                        title="Manage translations"
                      >
                        <Globe className="w-3 h-3" />
                        Manage
                      </button>
                    </TD>
                  )}
                  {showTrash && (
                    <TD className="py-2.5">
                      <span className="text-xs text-slate-400">{c.deleted_at ? fromNow(c.deleted_at) : '--'}</span>
                    </TD>
                  )}
                  <TD className="py-2.5">
                    {showTrash ? (
                      <Badge variant="warning">Deleted</Badge>
                    ) : (
                      <Badge variant={c.is_active ? 'success' : 'danger'}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(c)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onToggleActive(c)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title={c.is_active ? 'Deactivate' : 'Activate'}>
                            {c.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onSoftDelete(c)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
                            {actionLoadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            showingCount={items.length}
          />
        </div>
      )}

      {/* View Dialog */}
      {viewing && (
        <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Webinar Details" size="lg">
          <div className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                <Video className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.title || `Webinar #${viewing.id}`}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {viewing.webinar_status && (
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[viewing.webinar_status] || 'bg-slate-50 text-slate-600')}>
                      {STATUS_OPTIONS.find(o => o.value === viewing.webinar_status)?.label || viewing.webinar_status}
                    </span>
                  )}
                  {viewing.webinar_owner && (
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', OWNER_COLORS[viewing.webinar_owner] || 'bg-slate-50 text-slate-600')}>
                      {viewing.webinar_owner === 'system' ? 'System' : 'Instructor'}
                    </span>
                  )}
                  {viewing.is_free && <Badge variant="info">FREE</Badge>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Code" value={viewing.code} />
              <DetailRow label="Slug" value={viewing.slug ? `/${viewing.slug}` : undefined} />
              <DetailRow label="Course" value={viewing.courses?.name} />
              <DetailRow label="Instructor" value={viewing.users?.full_name || (viewing.instructor_id ? `ID: ${viewing.instructor_id}` : undefined)} />
              <DetailRow label="Price" value={viewing.is_free ? 'FREE' : formatPrice(viewing.price, false)} />
              <DetailRow label="Max Attendees" value={viewing.max_attendees ? String(viewing.max_attendees) : 'Unlimited'} />
              <DetailRow label="Registered" value={String(viewing.registered_count || 0)} />
              <DetailRow label="Duration" value={viewing.duration_minutes ? `${viewing.duration_minutes} min` : undefined} />
              <DetailRow label="Scheduled At" value={viewing.scheduled_at ? new Date(viewing.scheduled_at).toLocaleString('en-IN') : undefined} />
              <DetailRow label="Meeting Platform" value={viewing.meeting_platform} />
              <DetailRow label="Meeting Link" value={viewing.meeting_link} />
              <DetailRow label="Recording URL" value={viewing.recording_url} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
            </div>
          </div>
        </Dialog>
      )}

      {/* Create/Edit Dialog */}
      <Dialog key={dialogKey} open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Webinar' : 'Create Webinar'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="flex gap-1 border-b border-slate-200 mb-4">
            {formTabs.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700'
              )}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Title" {...register('title')} placeholder="Webinar title (or auto from English translation)" />
                <Input label="Code" {...register('code')} placeholder="e.g. WEB-2026-JAN" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Slug" {...register('slug')} placeholder="auto-generated or custom" />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Course</label>
                  <select className={cn(selectClass, 'w-full')} {...register('course_id')}>
                    <option value="">Select course...</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name || c.code}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Owner</label>
                  <select className={cn(selectClass, 'w-full')} {...register('webinar_owner')}>
                    {OWNER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select className={cn(selectClass, 'w-full')} {...register('webinar_status')}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <Input label="Instructor ID" type="number" {...register('instructor_id')} placeholder="User ID" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Display Order" type="number" {...register('display_order')} placeholder="0" />
                <div className="flex items-center gap-4 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...register('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-sm text-slate-700">Active</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Scheduled At" type="datetime-local" {...register('scheduled_at')} />
                <Input label="Duration (minutes)" type="number" {...register('duration_minutes')} placeholder="e.g. 60" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Meeting Platform" {...register('meeting_platform')} placeholder="e.g. Zoom, Google Meet" />
                <Input label="Meeting Link" {...register('meeting_link')} placeholder="https://..." />
              </div>
              <Input label="Recording URL" {...register('recording_url')} placeholder="https://..." />
              <Input label="Chapter ID" type="number" {...register('chapter_id')} placeholder="Optional chapter reference" />
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Price (INR)" type="number" step="0.01" {...register('price')} placeholder="0.00" />
                <Input label="Max Attendees" type="number" {...register('max_attendees')} placeholder="Unlimited if empty" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...register('is_free')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-slate-700">Free Webinar</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>

      {/* Translations Dialog */}
      <Dialog open={translationDialogOpen} onClose={() => { setTranslationDialogOpen(false); setEditingTranslation(null); }} title={`Translations: ${translationWebinar?.title || ''}`} size="xl">
        <div className="p-6">
          {/* AI Generate Button */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">Manage language translations for this webinar. AI can auto-generate all missing translations.</p>
            <Button
              variant="outline"
              onClick={() => translationWebinar && handleAIGenerate(translationWebinar.id)}
              disabled={aiGenerating}
            >
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Generate All
            </Button>
          </div>

          {translationLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : editingTranslation ? (
            /* Translation Edit Form */
            <form key={translationFormKey} onSubmit={handleSubmitTr(onTranslationSubmit)} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-slate-700">
                  {editingTranslation.id ? 'Edit' : 'Create'} - {editingTranslation.languages?.name || editingTranslation.language_name}
                </h4>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTranslation(null)}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input label="Title *" {...registerTr('title', { required: true })} placeholder="Translated title" />
                <Input label="Focus Keyword" {...registerTr('focus_keyword')} placeholder="Primary keyword" />
              </div>
              <Input label="Short Description" {...registerTr('short_description')} placeholder="Brief description" />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea {...registerTr('description')} rows={4} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Full description..." />
              </div>
              <Input label="Tags (JSON array)" {...registerTr('tags')} placeholder='["tag1", "tag2"]' />

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">SEO Fields</p>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Meta Title" {...registerTr('meta_title')} />
                  <Input label="Meta Keywords" {...registerTr('meta_keywords')} />
                </div>
                <div className="mt-3">
                  <Input label="Meta Description" {...registerTr('meta_description')} />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <Input label="OG Title" {...registerTr('og_title')} />
                  <Input label="OG Description" {...registerTr('og_description')} />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <Input label="Twitter Title" {...registerTr('twitter_title')} />
                  <Input label="Twitter Description" {...registerTr('twitter_description')} />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...registerTr('is_active')} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-slate-700">Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setEditingTranslation(null)}>Cancel</Button>
                <Button type="submit">{editingTranslation.id ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          ) : (
            /* Language Coverage Grid */
            <div className="space-y-2">
              {translationCoverage.map(lang => {
                const tr = translations.find(t => t.language_id === lang.language_id);
                return (
                  <div key={lang.language_id} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase',
                        lang.has_translation ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                      )}>
                        {lang.language_code}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-slate-800">{lang.language_name}</span>
                        {tr && tr.title && <span className="ml-2 text-xs text-slate-400">{tr.title.substring(0, 40)}{tr.title.length > 40 ? '...' : ''}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {lang.has_translation ? (
                        <>
                          <Badge variant="success">Done</Badge>
                          <button onClick={() => openTranslationEdit(lang)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {tr && (
                            <button onClick={() => onDeleteTranslation(tr)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <Badge variant="warning">Missing</Badge>
                          <button onClick={() => openTranslationEdit(lang)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Create">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {translationCoverage.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No languages configured for materials. Check language settings.</p>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
