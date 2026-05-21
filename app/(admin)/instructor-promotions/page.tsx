"use client";
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { usePageSize } from '@/hooks/usePageSize';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog } from '@/components/ui/Dialog';
import { Table, TH, TD } from '@/components/ui/Table';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Pencil, Trash2, RotateCcw, Eye, CheckCircle, XCircle } from 'lucide-react';
import { toast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/layout/PageHeader';

/* ─── types ─── */
interface Promotion {
  id: number; instructor_id: number | null; promotion_name: string; description: string | null;
  promo_code: string | null; discount_type: string; discount_value: number | null;
  max_discount_amount: number | null; min_purchase_amount: number | null;
  applicable_to: string; valid_from: string | null; valid_until: string | null;
  usage_limit: number | null; usage_per_user: number | null; used_count: number;
  promotion_status: string; requires_approval: boolean;
  approved_by: number | null; approved_at: string | null; rejection_reason: string | null;
  is_active: boolean; deleted_at: string | null;
  instructor_name?: string | null; approver_name?: string | null; course_count?: number;
  created_at: string; updated_at: string;
}
interface PromoCourse {
  id: number; promotion_id: number; course_id: number;
  is_active: boolean; deleted_at: string | null;
  instructor_promotions?: { promotion_name: string; promo_code: string };
  courses?: { code: string; slug: string; name: string };
  created_at: string; updated_at: string;
}

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed_amount', label: 'Fixed Amount' },
];
const APPLICABLE_OPTIONS = [
  { value: 'all_my_courses', label: 'All My Courses' },
  { value: 'specific_courses', label: 'Specific Courses' },
  { value: 'all_my_internships', label: 'All My Internships' },
  { value: 'specific_internships', label: 'Specific Internships' },
];
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
];
const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
  rejected: 'bg-red-100 text-red-600',
};

const emptyPromo: Partial<Promotion> = {
  instructor_id: null, promotion_name: '', description: '', promo_code: '',
  discount_type: 'percentage', discount_value: null, max_discount_amount: null,
  min_purchase_amount: null, applicable_to: 'all_my_courses',
  valid_from: null, valid_until: null, usage_limit: null, usage_per_user: null,
  promotion_status: 'draft', requires_approval: true, is_active: true,
};

// Phase 47 — safe date formatter: avoids the literal "Invalid Date" string when
// a stored value can't be parsed (e.g. a bad year that slipped in earlier).
function fmtDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000 || d.getFullYear() > 2100) return '—';
  return withTime ? d.toLocaleString() : d.toLocaleDateString();
}

// Local "now" formatted for a datetime-local input min attribute.
function localNowForInput(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Phase 47 — client-side mirror of the API guard (instant feedback before save).
function validatePromo(p: Partial<Promotion>, enforceFutureFrom: boolean): string | null {
  const isFixed = p.discount_type === 'fixed_amount' || p.discount_type === 'fixed';
  const dval = p.discount_value;
  if (dval == null) return 'Discount value is required';
  if (dval <= 0) return 'Discount value must be greater than 0';
  if (!isFixed && dval > 100) return 'Percentage discount cannot exceed 100%';

  if (p.max_discount_amount != null && p.max_discount_amount < 0) return 'Max discount amount cannot be negative';
  if (p.min_purchase_amount != null && p.min_purchase_amount < 0) return 'Min purchase amount cannot be negative';
  if (isFixed && dval != null && p.min_purchase_amount != null && dval > p.min_purchase_amount) {
    return 'Fixed discount cannot exceed the minimum purchase amount';
  }

  if (p.usage_limit != null && (!Number.isInteger(p.usage_limit) || p.usage_limit < 1)) return 'Usage limit must be a whole number ≥ 1 (leave empty for unlimited)';
  if (p.usage_per_user != null && (!Number.isInteger(p.usage_per_user) || p.usage_per_user < 1)) return 'Usage per user must be a whole number ≥ 1 (leave empty for unlimited)';
  if (p.usage_limit != null && p.usage_per_user != null && p.usage_per_user > p.usage_limit) {
    return 'Usage per user cannot exceed the total usage limit';
  }

  const from = p.valid_from ? new Date(p.valid_from) : null;
  const until = p.valid_until ? new Date(p.valid_until) : null;
  if (from && (isNaN(from.getTime()) || from.getFullYear() < 2000 || from.getFullYear() > 2100)) return 'Valid From must have a year between 2000 and 2100';
  if (until && (isNaN(until.getTime()) || until.getFullYear() < 2000 || until.getFullYear() > 2100)) return 'Valid Until must have a year between 2000 and 2100';
  if (from && until && until <= from) return 'Valid Until must be after Valid From';
  if (enforceFutureFrom && from) {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    if (from < startToday) return 'Valid From must be today or a future date';
  }
  return null;
}

export default function InstructorPromotionsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'promotions' | 'courses'>('promotions');

  /* ═══ TAB 1: Promotions ═══ */
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(20);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('id');
  const [asc, setAsc] = useState(false);
  const [trash, setTrash] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [discountFilter, setDiscountFilter] = useState('');

  // Dialog
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState<Partial<Promotion>>(emptyPromo);
  const [saving, setSaving] = useState(false);

  // View dialog
  const [viewItem, setViewItem] = useState<Promotion | null>(null);

  // Reject dialog
  const [rejectItem, setRejectItem] = useState<Promotion | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Instructors dropdown
  const [instructors, setInstructors] = useState<{ id: number; full_name: string }[]>([]);

  const fetchPromos = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `?page=${page}&limit=${pageSize}&sort=${sort}&order=${asc ? 'asc' : 'desc'}${search ? `&search=${encodeURIComponent(search)}` : ''}${trash ? '&show_deleted=true' : ''}${statusFilter ? `&promotion_status=${statusFilter}` : ''}${discountFilter ? `&discount_type=${discountFilter}` : ''}`;
      const r = await api.listInstructorPromotions(qs);
      setPromos(r.data || []);
      setTotal(r.pagination?.total || 0);
    } catch { toast.error('Failed to load promotions'); }
    setLoading(false);
  }, [page, pageSize, search, sort, asc, trash, statusFilter, discountFilter]);

  useEffect(() => { fetchPromos(); }, [fetchPromos]);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.listInstructorPromotions('?limit=1000');
        // Also fetch instructors for dropdown
        const u = await api.listUsers('?limit=500&type=instructor');
        setInstructors((u.data || []).map((x: any) => ({ id: x.id, full_name: x.full_name })));
      } catch {}
    })();
  }, []);

  const handleSort = (col: string) => {
    if (sort === col) setAsc(!asc); else { setSort(col); setAsc(true); }
  };

  const openCreate = () => { setEditItem({ ...emptyPromo }); setShowDialog(true); };
  const openEdit = (p: Promotion) => { setEditItem({ ...p }); setShowDialog(true); };

  const handleSave = async () => {
    if (!editItem.promotion_name?.trim()) { toast.error('Promotion name is required'); return; }
    const vErr = validatePromo(editItem, !editItem.id);
    if (vErr) { toast.error(vErr); return; }
    setSaving(true);
    try {
      if (editItem.id) {
        await api.updateInstructorPromotion(editItem.id, editItem);
        toast.success('Promotion updated');
      } else {
        await api.createInstructorPromotion(editItem);
        toast.success('Promotion created');
      }
      setShowDialog(false);
      fetchPromos();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
    setSaving(false);
  };

  const handleSoftDelete = async (id: number) => {
    if (!confirm('Move this promotion to trash?')) return;
    try { await api.softDeleteInstructorPromotion(id); toast.success('Moved to trash'); fetchPromos(); }
    catch { toast.error('Delete failed'); }
  };
  const handleRestore = async (id: number) => {
    try { await api.restoreInstructorPromotion(id); toast.success('Restored'); fetchPromos(); }
    catch { toast.error('Restore failed'); }
  };
  const handlePermanentDelete = async (id: number) => {
    if (!confirm('Permanently delete? This cannot be undone!')) return;
    try { await api.deleteInstructorPromotion(id); toast.success('Deleted permanently'); fetchPromos(); }
    catch { toast.error('Delete failed'); }
  };
  const handleApprove = async (id: number) => {
    if (!confirm('Approve this promotion?')) return;
    try { await api.approveInstructorPromotion(id); toast.success('Promotion approved'); fetchPromos(); }
    catch { toast.error('Approve failed'); }
  };
  const handleReject = async () => {
    if (!rejectItem) return;
    try {
      await api.rejectInstructorPromotion(rejectItem.id, { rejection_reason: rejectReason });
      toast.success('Promotion rejected');
      setRejectItem(null); setRejectReason('');
      fetchPromos();
    } catch { toast.error('Reject failed'); }
  };

  /* ═══ TAB 2: Promotion Courses ═══ */
  const [courses, setCourses] = useState<PromoCourse[]>([]);
  const [cTotal, setCTotal] = useState(0);
  const [cPage, setCPage] = useState(1);
  const [cPageSize, setCPageSize] = usePageSize(20);
  const [cLoading, setCLoading] = useState(false);
  const [cTrash, setCTrash] = useState(false);
  const [cPromoFilter, setCPromoFilter] = useState('');

  const [cShowDialog, setCShowDialog] = useState(false);
  const [cEditItem, setCEditItem] = useState<Partial<PromoCourse>>({ promotion_id: 0, course_id: 0, is_active: true });
  const [cSaving, setCSaving] = useState(false);

  // Course dropdown
  const [courseOptions, setCourseOptions] = useState<{ id: number; name: string; code: string }[]>([]);
  // Promotion dropdown for filter + form
  const [promoOptions, setPromoOptions] = useState<{ id: number; promotion_name: string; promo_code: string }[]>([]);

  const fetchCourses = useCallback(async () => {
    setCLoading(true);
    try {
      const qs = `?page=${cPage}&limit=${cPageSize}&sort=id&order=desc${cTrash ? '&show_deleted=true' : ''}${cPromoFilter ? `&promotion_id=${cPromoFilter}` : ''}`;
      const r = await api.listInstructorPromotionCourses(qs);
      setCourses(r.data || []);
      setCTotal(r.pagination?.total || 0);
    } catch { toast.error('Failed to load promotion courses'); }
    setCLoading(false);
  }, [cPage, cPageSize, cTrash, cPromoFilter]);

  useEffect(() => { if (tab === 'courses') fetchCourses(); }, [tab, fetchCourses]);

  // Phase 48 — load the promotion + course dropdown options. Extracted into a
  // callback so it can be re-run when the "Link Course" dialog opens; otherwise
  // a promotion deleted on the Promotions tab lingered in this dropdown until a
  // full page refresh (the list was only fetched once on mount).
  const fetchOptions = useCallback(async () => {
    try {
      const pRes = await api.listInstructorPromotions('?limit=500');
      setPromoOptions((pRes.data || []).map((p: any) => ({ id: p.id, promotion_name: p.promotion_name, promo_code: p.promo_code })));
    } catch {}
    try {
      // Fetch only courses created by the logged-in instructor
      const instructorQs = user?.id ? `?limit=500&instructor_id=${user.id}` : '?limit=500';
      const cRes = await api.listCourses(instructorQs);
      setCourseOptions((cRes.data || []).map((c: any) => ({ id: c.id, name: c.name, code: c.code })));
    } catch {}
  }, [user?.id]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

  const handleCourseSave = async () => {
    setCSaving(true);
    try {
      if (cEditItem.id) {
        await api.updateInstructorPromotionCourse(cEditItem.id, cEditItem);
        toast.success('Updated');
      } else {
        await api.createInstructorPromotionCourse(cEditItem);
        toast.success('Course linked');
      }
      setCShowDialog(false);
      fetchCourses();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
    setCSaving(false);
  };

  const handleCourseSoftDelete = async (id: number) => {
    if (!confirm('Move to trash?')) return;
    try { await api.softDeleteInstructorPromotionCourse(id); toast.success('Trashed'); fetchCourses(); }
    catch { toast.error('Failed'); }
  };
  const handleCourseRestore = async (id: number) => {
    try { await api.restoreInstructorPromotionCourse(id); toast.success('Restored'); fetchCourses(); }
    catch { toast.error('Failed'); }
  };
  const handleCoursePermanentDelete = async (id: number) => {
    if (!confirm('Permanently delete?')) return;
    try { await api.deleteInstructorPromotionCourse(id); toast.success('Deleted'); fetchCourses(); }
    catch { toast.error('Failed'); }
  };

  /* ═══ RENDER ═══ */
  return (
    <div className="animate-fade-in">
      <PageHeader title="Instructor Promotions" description="Manage instructor promotion codes, discounts, and approval workflows" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {(['promotions', 'courses'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'promotions' ? 'Promotions' : 'Promotion Courses'}
          </button>
        ))}
      </div>

      {/* ══════ PROMOTIONS TAB ══════ */}
      {tab === 'promotions' && (
        <div className="space-y-5">
          <DataToolbar search={search} onSearchChange={s => { setSearch(s); setPage(1); }} searchPlaceholder="Search promotions...">
            <div className="flex items-center gap-2">
              <select className="h-9 border border-slate-200 rounded-lg px-2.5 pr-8 text-xs bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select className="h-9 border border-slate-200 rounded-lg px-2.5 pr-8 text-xs bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={discountFilter} onChange={e => { setDiscountFilter(e.target.value); setPage(1); }}>
                <option value="">All Discount Types</option>
                {DISCOUNT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <Button variant={trash ? 'danger' : 'outline'} size="sm" onClick={() => { setTrash(!trash); setPage(1); }}>
                <Trash2 className="w-4 h-4" /> Trash
              </Button>
              {!trash && (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4" /> Add Promotion
                </Button>
              )}
            </div>
          </DataToolbar>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <Table>
              <thead>
                <tr className="bg-slate-50">
                  <TH className="w-12">#</TH>
                  <TH className="cursor-pointer select-none" onClick={() => handleSort('promotion_name')}>Name {sort === 'promotion_name' ? (asc ? '↑' : '↓') : ''}</TH>
                  <TH>Promo Code</TH>
                  <TH>Instructor</TH>
                  <TH className="cursor-pointer select-none" onClick={() => handleSort('discount_type')}>Discount {sort === 'discount_type' ? (asc ? '↑' : '↓') : ''}</TH>
                  <TH>Applicable To</TH>
                  <TH className="cursor-pointer select-none" onClick={() => handleSort('promotion_status')}>Status {sort === 'promotion_status' ? (asc ? '↑' : '↓') : ''}</TH>
                  <TH>Courses</TH>
                  <TH>Usage</TH>
                  <TH>Valid Period</TH>
                  <TH>Active</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                ) : promos.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-slate-400">No promotions found</td></tr>
                ) : promos.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-50 border-t border-slate-100">
                    <TD className="text-slate-500">{(page - 1) * pageSize + idx + 1}</TD>
                    <TD className="font-medium text-slate-800 max-w-[200px] truncate">{p.promotion_name}</TD>
                    <TD><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{p.promo_code || '—'}</code></TD>
                    <TD className="text-sm text-slate-600">{p.instructor_name || '—'}</TD>
                    <TD className="text-sm">
                      {p.discount_type === 'percentage' ? `${p.discount_value}%` : `₹${p.discount_value}`}
                      {p.max_discount_amount ? <span className="text-xs text-slate-400 ml-1">(max ₹{p.max_discount_amount})</span> : null}
                    </TD>
                    <TD className="text-xs text-slate-500">{APPLICABLE_OPTIONS.find(a => a.value === p.applicable_to)?.label || p.applicable_to}</TD>
                    <TD>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.promotion_status] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_OPTIONS.find(s => s.value === p.promotion_status)?.label || p.promotion_status}
                      </span>
                    </TD>
                    <TD className="text-center text-sm">{p.course_count || 0}</TD>
                    <TD className="text-sm text-slate-500">{p.used_count}/{p.usage_limit || '∞'}</TD>
                    <TD className="text-xs text-slate-500">
                      {fmtDate(p.valid_from)}
                      {' → '}
                      {fmtDate(p.valid_until)}
                    </TD>
                    <TD>{p.is_active ? <span className="text-green-600 text-xs font-medium">Yes</span> : <span className="text-slate-400 text-xs">No</span>}</TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewItem(p)} className="p-1 text-slate-400 hover:text-blue-600" title="View"><Eye className="w-4 h-4" /></button>
                        {!trash && (
                          <>
                            <button onClick={() => openEdit(p)} className="p-1 text-slate-400 hover:text-amber-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                            {p.promotion_status === 'pending_approval' && (
                              <>
                                <button onClick={() => handleApprove(p.id)} className="p-1 text-slate-400 hover:text-green-600" title="Approve"><CheckCircle className="w-4 h-4" /></button>
                                <button onClick={() => { setRejectItem(p); setRejectReason(''); }} className="p-1 text-slate-400 hover:text-red-600" title="Reject"><XCircle className="w-4 h-4" /></button>
                              </>
                            )}
                            <button onClick={() => handleSoftDelete(p.id)} className="p-1 text-slate-400 hover:text-red-600" title="Trash"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                        {trash && (
                          <>
                            <button onClick={() => handleRestore(p.id)} className="p-1 text-slate-400 hover:text-green-600" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={() => handlePermanentDelete(p.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete Forever"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <Pagination page={page} totalPages={Math.ceil(total / pageSize) || 1} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />

          {/* Create/Edit Dialog */}
          <Dialog open={showDialog} onClose={() => setShowDialog(false)} title={editItem.id ? 'Edit Promotion' : 'Create Promotion'} size="xl">
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-medium text-slate-600">Promotion Name *</label>
                  <Input value={editItem.promotion_name || ''} onChange={e => setEditItem({ ...editItem, promotion_name: e.target.value })} placeholder="Summer Sale 2026" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Promo Code</label>
                  <Input value={editItem.promo_code || ''} onChange={e => setEditItem({ ...editItem, promo_code: e.target.value })} placeholder="SUMMER2026" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Instructor</label>
                  <Select value={editItem.instructor_id || ''} onChange={e => setEditItem({ ...editItem, instructor_id: e.target.value ? parseInt(e.target.value) : null })} options={[{ value: '', label: 'Select Instructor' }, ...instructors.map(i => ({ value: i.id, label: i.full_name }))]} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Discount Type *</label>
                  <Select value={editItem.discount_type || 'percentage'} onChange={e => setEditItem({ ...editItem, discount_type: e.target.value })} options={DISCOUNT_TYPES} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Discount Value *</label>
                  <Input type="number" min={0} max={editItem.discount_type === 'percentage' ? 100 : undefined} value={editItem.discount_value ?? ''} onChange={e => setEditItem({ ...editItem, discount_value: e.target.value ? parseFloat(e.target.value) : null })} placeholder={editItem.discount_type === 'percentage' ? '10' : '500'} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Max Discount Amount</label>
                  <Input type="number" min={0} value={editItem.max_discount_amount ?? ''} onChange={e => setEditItem({ ...editItem, max_discount_amount: e.target.value ? parseFloat(e.target.value) : null })} placeholder="1000" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Min Purchase Amount</label>
                  <Input type="number" min={0} value={editItem.min_purchase_amount ?? ''} onChange={e => setEditItem({ ...editItem, min_purchase_amount: e.target.value ? parseFloat(e.target.value) : null })} placeholder="500" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Applicable To</label>
                  <Select value={editItem.applicable_to || 'all_my_courses'} onChange={e => setEditItem({ ...editItem, applicable_to: e.target.value })} options={APPLICABLE_OPTIONS} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Valid From</label>
                  <Input type="datetime-local" min={localNowForInput()} max="2100-12-31T23:59" value={editItem.valid_from ? editItem.valid_from.slice(0, 16) : ''} onChange={e => setEditItem({ ...editItem, valid_from: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Valid Until</label>
                  <Input type="datetime-local" min={editItem.valid_from ? editItem.valid_from.slice(0, 16) : localNowForInput()} max="2100-12-31T23:59" value={editItem.valid_until ? editItem.valid_until.slice(0, 16) : ''} onChange={e => setEditItem({ ...editItem, valid_until: e.target.value || null })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Usage Limit (total)</label>
                  <Input type="number" min={1} step={1} value={editItem.usage_limit ?? ''} onChange={e => setEditItem({ ...editItem, usage_limit: e.target.value ? parseInt(e.target.value) : null })} placeholder="Unlimited" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Usage Per User</label>
                  <Input type="number" min={1} step={1} value={editItem.usage_per_user ?? ''} onChange={e => setEditItem({ ...editItem, usage_per_user: e.target.value ? parseInt(e.target.value) : null })} placeholder="1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Status</label>
                  <Select value={editItem.promotion_status || 'draft'} onChange={e => setEditItem({ ...editItem, promotion_status: e.target.value })} options={STATUS_OPTIONS} />
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editItem.requires_approval ?? true} onChange={e => setEditItem({ ...editItem, requires_approval: e.target.checked })} className="rounded" />
                    Requires Approval
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editItem.is_active ?? true} onChange={e => setEditItem({ ...editItem, is_active: e.target.checked })} className="rounded" />
                    Active
                  </label>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-600">Description</label>
                  <textarea value={editItem.description || ''} onChange={e => setEditItem({ ...editItem, description: e.target.value })}
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" rows={3} placeholder="Promotion description..." />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setShowDialog(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editItem.id ? 'Update' : 'Create'}</Button>
              </div>
            </div>
          </Dialog>

          {/* View Dialog */}
          <Dialog open={!!viewItem} onClose={() => setViewItem(null)} title="Promotion Details" size="xl">
            {viewItem && (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div><span className="text-slate-400">Name:</span> <span className="font-medium">{viewItem.promotion_name}</span></div>
                  <div><span className="text-slate-400">Promo Code:</span> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">{viewItem.promo_code || '—'}</code></div>
                  <div><span className="text-slate-400">Instructor:</span> {viewItem.instructor_name || '—'}</div>
                  <div><span className="text-slate-400">Discount:</span> {viewItem.discount_type === 'percentage' ? `${viewItem.discount_value}%` : `₹${viewItem.discount_value}`}</div>
                  <div><span className="text-slate-400">Max Discount:</span> {viewItem.max_discount_amount ? `₹${viewItem.max_discount_amount}` : '—'}</div>
                  <div><span className="text-slate-400">Min Purchase:</span> {viewItem.min_purchase_amount ? `₹${viewItem.min_purchase_amount}` : '—'}</div>
                  <div><span className="text-slate-400">Applicable To:</span> {APPLICABLE_OPTIONS.find(a => a.value === viewItem.applicable_to)?.label}</div>
                  <div><span className="text-slate-400">Status:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[viewItem.promotion_status]}`}>{STATUS_OPTIONS.find(s => s.value === viewItem.promotion_status)?.label}</span></div>
                  <div><span className="text-slate-400">Valid From:</span> {fmtDate(viewItem.valid_from, true)}</div>
                  <div><span className="text-slate-400">Valid Until:</span> {fmtDate(viewItem.valid_until, true)}</div>
                  <div><span className="text-slate-400">Usage:</span> {viewItem.used_count}/{viewItem.usage_limit || '∞'} (per user: {viewItem.usage_per_user || '∞'})</div>
                  <div><span className="text-slate-400">Courses:</span> {viewItem.course_count || 0}</div>
                  <div><span className="text-slate-400">Requires Approval:</span> {viewItem.requires_approval ? 'Yes' : 'No'}</div>
                  <div><span className="text-slate-400">Approved By:</span> {viewItem.approver_name || '—'}</div>
                  {viewItem.rejection_reason && <div className="col-span-2"><span className="text-slate-400">Rejection Reason:</span> <span className="text-red-600">{viewItem.rejection_reason}</span></div>}
                  {viewItem.description && <div className="col-span-2"><span className="text-slate-400">Description:</span> {viewItem.description}</div>}
                  <div><span className="text-slate-400">Active:</span> {viewItem.is_active ? 'Yes' : 'No'}</div>
                  <div><span className="text-slate-400">Created:</span> {new Date(viewItem.created_at).toLocaleString()}</div>
                </div>
              </div>
            )}
          </Dialog>

          {/* Reject Dialog */}
          <Dialog open={!!rejectItem} onClose={() => setRejectItem(null)} title="Reject Promotion">
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Rejecting: <strong>{rejectItem?.promotion_name}</strong></p>
              <div>
                <label className="text-xs font-medium text-slate-600">Rejection Reason</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" rows={3} placeholder="Reason for rejection..." />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setRejectItem(null)}>Cancel</Button>
                <Button variant="danger" onClick={handleReject}>Reject</Button>
              </div>
            </div>
          </Dialog>
        </div>
      )}

      {/* ══════ PROMOTION COURSES TAB ══════ */}
      {tab === 'courses' && (
        <div className="space-y-5">
          <DataToolbar search="" onSearchChange={() => {}} searchPlaceholder="Search...">
            <div className="flex items-center gap-2">
              <select className="h-9 border border-slate-200 rounded-lg px-2.5 pr-8 text-xs w-56 bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" value={cPromoFilter} onChange={e => { setCPromoFilter(e.target.value); setCPage(1); }}>
                <option value="">All Promotions</option>
                {promoOptions.map(p => <option key={p.id} value={p.id}>{p.promotion_name} ({p.promo_code})</option>)}
              </select>
              <Button variant={cTrash ? 'danger' : 'outline'} size="sm" onClick={() => { setCTrash(!cTrash); setCPage(1); }}>
                <Trash2 className="w-4 h-4" /> Trash
              </Button>
              {!cTrash && (
                <Button size="sm" onClick={() => { fetchOptions(); setCEditItem({ promotion_id: 0, course_id: 0, is_active: true }); setCShowDialog(true); }}>
                  <Plus className="w-4 h-4" /> Link Course
                </Button>
              )}
            </div>
          </DataToolbar>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <Table>
              <thead>
                <tr className="bg-slate-50">
                  <TH className="w-12">#</TH>
                  <TH>Promotion</TH>
                  <TH>Course</TH>
                  <TH>Active</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </thead>
              <tbody>
                {cLoading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
                ) : courses.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No promotion courses found</td></tr>
                ) : courses.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50 border-t border-slate-100">
                    <TD className="text-slate-500">{(cPage - 1) * cPageSize + idx + 1}</TD>
                    <TD className="font-medium text-slate-700">{c.instructor_promotions?.promotion_name || '—'} <code className="text-xs bg-slate-100 px-1 rounded ml-1">{c.instructor_promotions?.promo_code}</code></TD>
                    <TD className="text-slate-600">{c.courses?.name || c.courses?.code || '—'}</TD>
                    <TD>{c.is_active ? <span className="text-green-600 text-xs font-medium">Yes</span> : <span className="text-slate-400 text-xs">No</span>}</TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!cTrash && (
                          <>
                            <button onClick={() => { setCEditItem({ ...c }); setCShowDialog(true); }} className="p-1 text-slate-400 hover:text-amber-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => handleCourseSoftDelete(c.id)} className="p-1 text-slate-400 hover:text-red-600" title="Trash"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                        {cTrash && (
                          <>
                            <button onClick={() => handleCourseRestore(c.id)} className="p-1 text-slate-400 hover:text-green-600" title="Restore"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={() => handleCoursePermanentDelete(c.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <Pagination page={cPage} totalPages={Math.ceil(cTotal / cPageSize) || 1} pageSize={cPageSize} total={cTotal} onPageChange={setCPage} onPageSizeChange={s => { setCPageSize(s); setCPage(1); }} />

          {/* Create/Edit Promotion Course Dialog */}
          <Dialog open={cShowDialog} onClose={() => setCShowDialog(false)} title={cEditItem.id ? 'Edit Link' : 'Link Course to Promotion'}>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600">Promotion *</label>
                <Select value={cEditItem.promotion_id || ''} onChange={e => setCEditItem({ ...cEditItem, promotion_id: parseInt(e.target.value) || 0 })} options={[{ value: '', label: 'Select Promotion' }, ...promoOptions.map(p => ({ value: p.id, label: `${p.promotion_name} (${p.promo_code})` }))]} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Course *</label>
                <Select value={cEditItem.course_id || ''} onChange={e => setCEditItem({ ...cEditItem, course_id: parseInt(e.target.value) || 0 })} options={[{ value: '', label: 'Select Course' }, ...courseOptions.map(c => ({ value: c.id, label: c.name || c.code }))]} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cEditItem.is_active ?? true} onChange={e => setCEditItem({ ...cEditItem, is_active: e.target.checked })} className="rounded" />
                Active
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button variant="secondary" onClick={() => setCShowDialog(false)}>Cancel</Button>
                <Button onClick={handleCourseSave} disabled={cSaving}>{cSaving ? 'Saving...' : cEditItem.id ? 'Update' : 'Create'}</Button>
              </div>
            </div>
          </Dialog>
        </div>
      )}
    </div>
  );
}
