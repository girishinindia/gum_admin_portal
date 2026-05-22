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
import { ImageUpload } from '@/components/ui/ImageUpload';
import { VideoUpload } from '@/components/ui/VideoUpload';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Plus, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown,
  CheckCircle2, XCircle, BarChart3, RotateCcw, AlertTriangle,
  Loader2, X, Headphones, Send, Archive, Search, Clock, ShieldCheck,
  ThumbsDown, Play, Youtube, Video,
} from 'lucide-react';
import { cn, fromNow } from '@/lib/utils';
import { usePageSize } from '@/hooks/usePageSize';

// ─── Types ───────────────────────────────────────────────────────
type SortField = 'id' | 'title' | 'poster_type' | 'status' | 'published_at' | 'is_active' | 'display_order';

// ─── Constants ───────────────────────────────────────────────────
const POSTER_TYPES = [
  { value: 'system', label: 'System' },
  { value: 'instructor', label: 'Instructor' },
];

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'coming_soon', label: 'Coming Soon' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  coming_soon: 'bg-violet-50 text-violet-700',
  pending_approval: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
  archived: 'bg-slate-100 text-slate-500',
};

const POSTER_TYPE_COLORS: Record<string, string> = {
  system: 'bg-blue-50 text-blue-700',
  instructor: 'bg-teal-50 text-teal-700',
};

const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

// ─── Helpers ─────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '--'}</dd>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '--';
}

function userLine(user: any) {
  if (!user) return null;
  return (
    <div>
      <div className="text-sm font-medium text-slate-900">{user.first_name} {user.last_name}</div>
      {user.email && <div className="text-xs text-slate-500">{user.email}</div>}
    </div>
  );
}

function videoSourceBadge(item: any) {
  if (item.video_url) return <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-50 text-orange-700"><Video className="w-2.5 h-2.5" />Bunny</span>;
  if (item.youtube_url) return <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-50 text-red-700"><Youtube className="w-2.5 h-2.5" />YouTube</span>;
  return <span className="text-[10px] text-slate-400">No video</span>;
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function PodcastsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<any | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  // Video & thumbnail state for dialog
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  // Pending removal flags — only execute on Save, not immediately
  const [pendingRemoveVideo, setPendingRemoveVideo] = useState(false);
  const [pendingRemoveThumbnail, setPendingRemoveThumbnail] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize();
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPosterType, setFilterPosterType] = useState('');

  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; is_deleted: number; total: number } | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Categories & sub-categories for dropdown
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);

  const toolbarRef = useRef<DataToolbarHandle>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();
  const watchCategoryId = watch('category_id');

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary + categories (with English translation names) on mount
  useEffect(() => {
    api.getTableSummary('podcasts').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });

    (async () => {
      // Resolve English display names from translations (same pattern as course-builder)
      const langRes = await api.listLanguages('?is_active=true&limit=50');
      const langs = langRes.data || [];
      const enId = langs.find((l: any) => l.iso_code === 'en')?.id;

      const [catRes, subRes, catTr, subTr] = await Promise.all([
        api.listCategories('?limit=500'),
        api.listSubCategories('?limit=1000'),
        api.listCategoryTranslations('?limit=1000'),
        api.listSubCategoryTranslations('?limit=2000'),
      ]);

      const catName = new Map<number, string>();
      for (const t of (catTr.data || [])) { if ((!enId || t.language_id === enId) && t.name) catName.set(t.category_id, t.name); }
      const subName = new Map<number, string>();
      for (const t of (subTr.data || [])) { if ((!enId || t.language_id === enId) && t.name) subName.set(t.sub_category_id, t.name); }

      setCategories((catRes.data || []).map((c: any) => ({ ...c, _label: c.name || catName.get(c.id) || c.slug || `#${c.id}` })));
      setSubCategories((subRes.data || []).map((s: any) => ({ ...s, _label: s.name || subName.get(s.id) || s.slug || `#${s.id}` })));
    })();
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [searchDebounce, filterStatus, filterPosterType, pageSize, showTrash]);
  useEffect(() => { load(); setSelectedIds(new Set()); }, [searchDebounce, page, pageSize, sortField, sortOrder, filterStatus, filterPosterType, showTrash]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    params.set('sort', sortField);
    params.set('order', sortOrder);
    if (searchDebounce) params.set('search', searchDebounce);
    if (showTrash) {
      params.set('show_deleted', 'true');
    } else {
      if (filterStatus) params.set('status', filterStatus);
      if (filterPosterType) params.set('poster_type', filterPosterType);
    }
    const res = await api.listPodcasts(`?${params.toString()}`);
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('podcasts');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
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

  function resetDialogState() {
    setVideoFile(null);
    setVideoUrlInput(null);
    setThumbnailFile(null);
    setVideoProgress(null);
    setSaving(false);
    setPendingRemoveVideo(false);
    setPendingRemoveThumbnail(false);
  }

  function openCreate() {
    setEditing(null); setDialogKey(k => k + 1); resetDialogState();
    reset({
      title: '', description: '', short_summary: '',
      youtube_url: '', category_id: '', sub_category_id: '', tags: '',
      duration_hours: '', duration_minutes: '', display_order: '',
      is_featured: false, is_active: true, status: 'draft',
    });
    setDialogOpen(true);
  }

  function openEdit(item: any) {
    setEditing(item); setDialogKey(k => k + 1); resetDialogState();
    reset({
      title: item.title || '',
      description: item.description || '',
      short_summary: item.short_summary || '',
      youtube_url: item.youtube_url || '',
      category_id: item.category_id ?? '',
      sub_category_id: item.sub_category_id ?? '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || ''),
      duration_hours: item.duration_seconds ? String(Math.floor(item.duration_seconds / 3600)) : '',
      duration_minutes: item.duration_seconds ? String(Math.floor((item.duration_seconds % 3600) / 60)) : '',
      display_order: item.display_order ?? '',
      is_featured: item.is_featured ?? false,
      is_active: item.is_active ?? true,
      status: item.status || 'draft',
    });
    setDialogOpen(true);
  }

  function openView(item: any) {
    setViewing(item);
  }

  async function onSubmit(data: any) {
    setSaving(true);
    const payload: Record<string, any> = {};

    // Only include changed fields
    for (const k of Object.keys(data)) {
      const v = data[k];
      // Skip duration_hours/duration_minutes — handled below
      if (k === 'duration_hours' || k === 'duration_minutes') continue;
      if (v === '' || v === undefined || v === null) continue;
      if (typeof v === 'boolean') { payload[k] = v; continue; }
      if (k === 'category_id' && v !== '') { payload[k] = Number(v); continue; }
      if (k === 'sub_category_id' && v !== '') { payload[k] = Number(v); continue; }
      if (k === 'display_order' && v !== '') { payload[k] = Number(v); continue; }
      if (k === 'tags') {
        payload[k] = v.split(',').map((t: string) => t.trim()).filter(Boolean);
        continue;
      }
      payload[k] = v;
    }

    // Convert hours + minutes → duration_seconds
    const hrs = parseInt(data.duration_hours) || 0;
    const mins = parseInt(data.duration_minutes) || 0;
    if (hrs > 0 || mins > 0) {
      payload.duration_seconds = hrs * 3600 + mins * 60;
    }

    // If user typed a YouTube URL and there's no video file, include it
    if (videoUrlInput) {
      payload.youtube_url = videoUrlInput;
    }

    let podcastId = editing?.id;

    // 1. Create or update the podcast
    const res = editing
      ? await api.updatePodcast(editing.id, payload)
      : await api.createPodcast(payload);

    if (!res.success) {
      toast.error(res.error || 'Failed');
      setSaving(false);
      return;
    }

    if (!editing) {
      podcastId = res.data?.id;
    }

    // 2. Execute pending removals (deferred from dialog buttons)
    if (pendingRemoveVideo && podcastId) {
      const rmRes = await api.removePodcastVideo(podcastId);
      if (!rmRes.success) toast.error('Video removal failed: ' + (rmRes.error || ''));
    }
    if (pendingRemoveThumbnail && podcastId) {
      const rmRes = await api.removePodcastThumbnail(podcastId);
      if (!rmRes.success) toast.error('Thumbnail removal failed: ' + (rmRes.error || ''));
    }

    // 3. Upload thumbnail if a new file was picked
    if (thumbnailFile && podcastId) {
      const thumbRes = await api.uploadPodcastThumbnail(podcastId, thumbnailFile);
      if (!thumbRes.success) toast.error('Thumbnail upload failed: ' + (thumbRes.error || ''));
    }

    // 4. Upload video if a new file was picked
    if (videoFile && podcastId) {
      setVideoProgress(0);
      const vidRes = await api.uploadPodcastVideo(podcastId, videoFile, (p) => setVideoProgress(p));
      setVideoProgress(null);
      if (!vidRes.success) toast.error('Video upload failed: ' + (vidRes.error || ''));
    }

    toast.success(editing ? 'Podcast updated' : 'Podcast created');
    setDialogOpen(false);
    resetDialogState();
    load();
    refreshSummary();
    setSaving(false);
  }

  // ── Status transitions ──
  async function onMarkComingSoon(item: any) {
    if (!confirm(`Mark "${item.title}" as Coming Soon?`)) return;
    setActionLoadingId(item.id);
    const res = await api.markPodcastComingSoon(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Marked as Coming Soon'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onSubmitForApproval(item: any) {
    if (!confirm(`Submit "${item.title}" for approval?`)) return;
    setActionLoadingId(item.id);
    const res = await api.submitPodcast(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Submitted for approval'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onApprove(item: any) {
    if (!confirm(`Approve and publish "${item.title}"?`)) return;
    setActionLoadingId(item.id);
    const res = await api.approvePodcast(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Podcast approved & published'); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  async function onReject(item: any) {
    if (!confirm(`Reject "${item.title}"? It will go back to draft.`)) return;
    setActionLoadingId(item.id);
    const res = await api.rejectPodcast(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Podcast rejected → draft'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onPublish(item: any) {
    if (!confirm(`Publish "${item.title}"?`)) return;
    setActionLoadingId(item.id);
    const res = await api.publishPodcast(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Podcast published'); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  async function onArchive(item: any) {
    if (!confirm(`Archive "${item.title}"?`)) return;
    setActionLoadingId(item.id);
    const res = await api.archivePodcast(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Podcast archived'); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  async function onRemoveVideo(item: any) {
    if (!confirm(`Remove the video from "${item.title}"?`)) return;
    setActionLoadingId(item.id);
    const res = await api.removePodcastVideo(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Video removed'); load(); } else toast.error(res.error || 'Failed');
  }

  async function onRemoveThumbnail(item: any) {
    if (!confirm(`Remove the thumbnail from "${item.title}"?`)) return;
    setActionLoadingId(item.id);
    const res = await api.removePodcastThumbnail(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Thumbnail removed'); load(); } else toast.error(res.error || 'Failed');
  }

  // ── Delete / Restore ──
  async function onSoftDelete(item: any) {
    if (!confirm(`Move "${item.title}" to trash?`)) return;
    setActionLoadingId(item.id);
    const res = await api.softDeletePodcast(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Moved to trash'); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  async function onRestore(item: any) {
    setActionLoadingId(item.id);
    const res = await api.restorePodcast(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Restored'); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  async function onPermanentDelete(item: any) {
    if (!confirm(`PERMANENTLY delete "${item.title}"? This cannot be undone.`)) return;
    setActionLoadingId(item.id);
    const res = await api.deletePodcast(item.id);
    setActionLoadingId(null);
    if (res.success) { toast.success('Permanently deleted'); load(); refreshSummary(); } else toast.error(res.error || 'Failed');
  }

  // ── Playback ──
  async function openPlayback(item: any) {
    const res = await api.podcastPlayback(item.id);
    if (res.success && res.data?.url) {
      window.open(res.data.url, '_blank');
    } else {
      toast.error('Could not get playback URL');
    }
  }

  // Bulk helpers
  function toggleSelect(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(i => i.id)));
  }

  async function handleBulkSoftDelete() {
    if (!confirm(`Move ${selectedIds.size} item(s) to trash?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.softDeletePodcast(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) moved to trash`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkRestore() {
    if (!confirm(`Restore ${selectedIds.size} item(s)?`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.restorePodcast(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) restored`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  async function handleBulkPermanentDelete() {
    if (!confirm(`PERMANENTLY delete ${selectedIds.size} item(s)? This cannot be undone.`)) return;
    setBulkActionLoading(true);
    const ids = Array.from(selectedIds);
    setBulkProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      const res = await api.deletePodcast(ids[i]);
      if (res.success) ok++;
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    toast.success(`${ok} item(s) permanently deleted`);
    setSelectedIds(new Set()); load(); refreshSummary();
    setBulkActionLoading(false); setBulkProgress({ done: 0, total: 0 });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Podcasts" />

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
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

      {/* Sub-tabs: Podcasts / Trash */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
        <button onClick={() => setShowTrash(false)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', !showTrash ? 'text-brand-600 border-brand-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          Podcasts
        </button>
        <button onClick={() => setShowTrash(true)} className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5', showTrash ? 'text-amber-600 border-amber-500' : 'text-slate-500 border-transparent hover:text-slate-700')}>
          <Trash2 className="w-3.5 h-3.5" /> Trash
          {summary && summary.is_deleted > 0 && (
            <span className={cn('ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold', showTrash ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>{summary.is_deleted}</span>
          )}
        </button>
        {!showTrash && (
          <div className="ml-auto mb-1">
            <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add podcast</Button>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <DataToolbar ref={toolbarRef} search={search} onSearchChange={setSearch} searchPlaceholder={showTrash ? 'Search trash...' : 'Search podcasts...'}>
        {!showTrash && (
          <>
            <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select className={selectClass} value={filterPosterType} onChange={e => setFilterPosterType(e.target.value)}>
              <option value="">All Poster Types</option>
              {POSTER_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={showTrash ? Trash2 : Headphones}
          title={showTrash ? 'Trash is empty' : 'No podcasts yet'}
          description={showTrash ? 'No deleted podcasts' : (searchDebounce || filterStatus || filterPosterType ? 'No podcasts match your filters' : 'Create your first podcast')}
          action={!showTrash && !searchDebounce && !filterStatus && !filterPosterType ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add podcast</Button> : undefined}
        />
      ) : (
        <div className={cn('mt-4 bg-white rounded-xl border overflow-hidden shadow-sm', showTrash ? 'border-amber-200' : 'border-slate-200')}>
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

          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-10"><input type="checkbox" checked={items.length > 0 && selectedIds.size === items.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TH>
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="w-16">Thumb</TH>
                <TH><button onClick={() => handleSort('title')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Title <SortIcon field="title" /></button></TH>
                <TH><button onClick={() => handleSort('poster_type')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Source <SortIcon field="poster_type" /></button></TH>
                <TH>Video</TH>
                <TH><button onClick={() => handleSort('status')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Status <SortIcon field="status" /></button></TH>
                <TH><button onClick={() => handleSort('published_at')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Published <SortIcon field="published_at" /></button></TH>
                {showTrash && <TH>Deleted</TH>}
                <TH><button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">Active <SortIcon field="is_active" /></button></TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map(item => (
                <TR key={item.id} className={cn(showTrash ? 'bg-amber-50/30' : undefined, selectedIds.has(item.id) && 'bg-brand-50/40')}>
                  <TD className="py-2.5"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer" /></TD>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{item.id}</span></TD>
                  <TD className="py-2.5">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="w-12 h-8 rounded object-cover border border-slate-200" />
                    ) : (
                      <div className="w-12 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <Headphones className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    )}
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('text-sm font-medium', showTrash ? 'text-slate-500 line-through' : 'text-slate-900')}>{item.title || '--'}</span>
                    {item.category_id && <div className="text-xs text-slate-400 mt-0.5">{categories.find((c: any) => c.id === item.category_id)?._label || item.categories?.slug || '--'}{item.sub_category_id ? ` › ${subCategories.find((s: any) => s.id === item.sub_category_id)?._label || item.sub_categories?.slug || ''}` : ''}</div>}
                  </TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', POSTER_TYPE_COLORS[item.poster_type] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(item.poster_type || '')}
                    </span>
                    {item.users && <div className="text-xs text-slate-400 mt-0.5">{item.users.first_name} {item.users.last_name}</div>}
                  </TD>
                  <TD className="py-2.5">{videoSourceBadge(item)}</TD>
                  <TD className="py-2.5">
                    <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[item.status] || 'bg-slate-50 text-slate-600')}>
                      {capitalize(item.status || '')}
                    </span>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-xs text-slate-600">{item.published_at ? fromNow(item.published_at) : '--'}</span>
                  </TD>
                  {showTrash && <TD className="py-2.5"><span className="text-xs text-amber-600">{item.deleted_at ? fromNow(item.deleted_at) : '--'}</span></TD>}
                  <TD className="py-2.5">
                    {showTrash ? <Badge variant="warning">Deleted</Badge> : <Badge variant={item.is_active ? 'success' : 'danger'}>{item.is_active ? 'Active' : 'Inactive'}</Badge>}
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {showTrash ? (
                        <>
                          <button onClick={() => onRestore(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Restore">
                            {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => onPermanentDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Delete permanently">
                            {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openView(item)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          {(item.video_url || item.youtube_url) && (
                            <button onClick={() => openPlayback(item)} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Play">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {/* Status action buttons */}
                          {item.status === 'draft' && (
                            <>
                              <button onClick={() => onMarkComingSoon(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-50" title="Mark Coming Soon">
                                {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                              </button>
                              {item.poster_type === 'instructor' ? (
                                <button onClick={() => onSubmitForApproval(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="Submit for Approval">
                                  {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                </button>
                              ) : (
                                <button onClick={() => onPublish(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Publish">
                                  {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </>
                          )}
                          {item.status === 'coming_soon' && (
                            item.poster_type === 'instructor' ? (
                              <button onClick={() => onSubmitForApproval(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="Submit for Approval">
                                {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <button onClick={() => onPublish(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Publish">
                                {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              </button>
                            )
                          )}
                          {item.status === 'pending_approval' && (
                            <>
                              <button onClick={() => onApprove(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Approve & Publish">
                                {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => onReject(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Reject">
                                {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          )}
                          {item.status === 'published' && (
                            <button onClick={() => onArchive(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50" title="Archive">
                              {actionLoadingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <button onClick={() => onSoftDelete(item)} disabled={actionLoadingId !== null} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50" title="Move to Trash">
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
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} pageSize={pageSize} onPageSizeChange={setPageSize} total={total} showingCount={items.length} />
        </div>
      )}

      {/* ── View Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Podcast Details" size="lg">
        {viewing && (
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              {viewing.thumbnail_url ? (
                <img src={viewing.thumbnail_url} alt="" className="w-24 h-16 rounded-lg object-cover border border-slate-200 flex-shrink-0" />
              ) : (
                <div className="w-24 h-16 rounded-lg bg-brand-50 flex items-center justify-center border border-brand-200 flex-shrink-0">
                  <Headphones className="w-8 h-8 text-brand-500" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>{viewing.is_active ? 'Active' : 'Inactive'}</Badge>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_COLORS[viewing.status] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.status || '')}</span>
                  <span className={cn('inline-flex text-xs font-semibold px-2 py-0.5 rounded-full', POSTER_TYPE_COLORS[viewing.poster_type] || 'bg-slate-50 text-slate-600')}>{capitalize(viewing.poster_type || '')}</span>
                  {viewing.is_featured && <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">Featured</span>}
                </div>
              </div>
            </div>

            {/* Description */}
            {viewing.description && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Description</dt>
                <dd className="text-sm text-slate-800 whitespace-pre-wrap">{viewing.description}</dd>
              </div>
            )}

            {viewing.short_summary && (
              <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Short Summary</dt>
                <dd className="text-sm text-slate-800">{viewing.short_summary}</dd>
              </div>
            )}

            <div className="grid grid-cols-3 gap-x-8 gap-y-4">
              <DetailRow label="Poster Type" value={capitalize(viewing.poster_type || '')} />
              <div>
                <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">Posted By</dt>
                <dd className="mt-0.5">{viewing.users ? userLine(viewing.users) : <span className="text-sm text-slate-400">--</span>}</dd>
              </div>
              <DetailRow label="Category" value={viewing.category_id ? (categories.find((c: any) => c.id === viewing.category_id)?._label || viewing.categories?.slug) : undefined} />
              <DetailRow label="Sub-Category" value={viewing.sub_category_id ? (subCategories.find((s: any) => s.id === viewing.sub_category_id)?._label || viewing.sub_categories?.slug) : undefined} />
              <DetailRow label="Video Source" value={viewing.video_url ? 'Bunny Stream' : viewing.youtube_url ? 'YouTube' : 'None'} />
              <DetailRow label="Duration" value={viewing.duration_seconds ? `${Math.floor(viewing.duration_seconds / 60)}m ${viewing.duration_seconds % 60}s` : undefined} />
              <DetailRow label="Display Order" value={viewing.display_order != null ? String(viewing.display_order) : undefined} />
              <DetailRow label="Tags" value={Array.isArray(viewing.tags) ? viewing.tags.join(', ') : viewing.tags} />
              <DetailRow label="Featured" value={viewing.is_featured ? 'Yes' : 'No'} />
              <DetailRow label="Status" value={capitalize(viewing.status || '')} />
              <DetailRow label="Published At" value={viewing.published_at ? new Date(viewing.published_at).toLocaleString() : undefined} />
              <DetailRow label="Verified At" value={viewing.verified_at ? new Date(viewing.verified_at).toLocaleString() : undefined} />
              <DetailRow label="Created" value={viewing.created_at ? new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined} />
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              {(viewing.video_url || viewing.youtube_url) && (
                <Button variant="outline" onClick={() => openPlayback(viewing)}><Play className="w-4 h-4" /> Play</Button>
              )}
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}><Edit2 className="w-4 h-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); resetDialogState(); }} title={editing ? 'Edit Podcast' : 'Create Podcast'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4" key={dialogKey}>
          <Input label="Title *" placeholder="Podcast title" {...register('title', { required: true })} />

          {/* Status selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select className={cn(selectClass, 'w-full')} {...register('status')}>
              {STATUSES.map(o => {
                // Users can freely pick draft or coming_soon.
                // pending_approval, published, archived are shown when editing but disabled
                // — those transitions happen via dedicated action buttons / super admin approval.
                const editable = ['draft', 'coming_soon'].includes(o.value);
                return (
                  <option key={o.value} value={o.value} disabled={!editable}>
                    {o.label}{!editable ? ' (use action buttons)' : ''}
                  </option>
                );
              })}
            </select>
            <p className="text-xs text-slate-400 mt-1">Approval &amp; publishing require super admin action via list buttons</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea
              className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
              placeholder="Full description..."
              {...register('description')}
            />
          </div>

          <Input label="Short Summary" placeholder="One-line summary for cards" {...register('short_summary')} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
              <select className={cn(selectClass, 'w-full')} {...register('category_id', {
                onChange: () => { setValue('sub_category_id', ''); }
              })}>
                <option value="">-- None --</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c._label || c.name || c.slug || `Category #${c.id}`}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sub-Category</label>
              <select className={cn(selectClass, 'w-full')} {...register('sub_category_id')}>
                <option value="">-- None --</option>
                {subCategories
                  .filter((sc: any) => watchCategoryId && sc.category_id === Number(watchCategoryId))
                  .map((sc: any) => <option key={sc.id} value={sc.id}>{sc._label || sc.name || sc.slug || `Sub-cat #${sc.id}`}</option>)}
              </select>
              {!watchCategoryId && <p className="text-xs text-slate-400 mt-1">Select a category first</p>}
            </div>
          </div>

          <Input label="Tags" placeholder="tag1, tag2, tag3" {...register('tags')} />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration (HH:MM)</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="99"
                  placeholder="HH"
                  className="w-full h-10 px-3 text-sm text-center rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  {...register('duration_hours')}
                />
                <span className="text-lg font-bold text-slate-400">:</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="MM"
                  className="w-full h-10 px-3 text-sm text-center rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  {...register('duration_minutes')}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">e.g. 01:30 = 1 hr 30 min</p>
            </div>
            <Input label="Display Order" type="number" placeholder="0" {...register('display_order')} />
          </div>

          {/* Video Upload (Bunny Stream) */}
          <VideoUpload
            label="Video (Bunny Stream)"
            value={pendingRemoveVideo ? null : (editing?.video_url || null)}
            allowUrlMode={true}
            maxSizeMb={500}
            onFileChange={(f) => { setVideoFile(f); if (f) { setVideoUrlInput(null); setPendingRemoveVideo(false); } }}
            onUrlChange={(u) => { setVideoUrlInput(u); if (u) { setVideoFile(null); setPendingRemoveVideo(false); } }}
            progress={videoProgress}
            hint="Upload to Bunny Stream, or paste a YouTube URL"
          />

          {/* YouTube URL (separate field for explicit YouTube) */}
          <Input label="YouTube URL (alternative)" placeholder="https://youtube.com/watch?v=..." {...register('youtube_url')} />

          {/* Thumbnail Upload */}
          <ImageUpload
            label="Thumbnail"
            value={pendingRemoveThumbnail ? null : (editing?.thumbnail_url || null)}
            aspectRatio={16 / 9}
            maxWidth={1280}
            maxHeight={720}
            onChange={(file) => { setThumbnailFile(file); if (file) setPendingRemoveThumbnail(false); }}
          />

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_featured')} />
              <span className="text-sm font-medium text-slate-700">Featured</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...register('is_active')} />
              <span className="text-sm font-medium text-slate-700">Active</span>
            </label>
          </div>

          {/* Editing: quick actions for video/thumbnail removal (deferred until Save) */}
          {editing && (editing.video_url || editing.thumbnail_url) && (
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              {editing.video_url && !pendingRemoveVideo && (
                <Button type="button" size="sm" variant="outline" onClick={() => setPendingRemoveVideo(true)}>
                  <Trash2 className="w-3.5 h-3.5" /> Remove existing video
                </Button>
              )}
              {editing.video_url && pendingRemoveVideo && (
                <span className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" /> Video will be removed on save
                  <button type="button" className="text-xs text-slate-500 hover:text-slate-700 underline" onClick={() => setPendingRemoveVideo(false)}>Undo</button>
                </span>
              )}
              {editing.thumbnail_url && !pendingRemoveThumbnail && (
                <Button type="button" size="sm" variant="outline" onClick={() => setPendingRemoveThumbnail(true)}>
                  <Trash2 className="w-3.5 h-3.5" /> Remove existing thumbnail
                </Button>
              )}
              {editing.thumbnail_url && pendingRemoveThumbnail && (
                <span className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="w-3.5 h-3.5" /> Thumbnail will be removed on save
                  <button type="button" className="text-xs text-slate-500 hover:text-slate-700 underline" onClick={() => setPendingRemoveThumbnail(false)}>Undo</button>
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetDialogState(); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
