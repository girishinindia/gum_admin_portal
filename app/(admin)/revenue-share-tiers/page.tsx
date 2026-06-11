'use client';

/**
 * Revenue Share Tiers (June 2026).
 * Manages the student-count slabs that decide the instructor/system split.
 * Scope precedence at resolution time:
 *   instructor + content type  >  instructor  >  content type  >  global.
 * Seeded global defaults: 0-100 → 60% · 101-500 → 70% · 501-5000 → 75% · 5000+ → 80%.
 */

import { useCallback, useEffect, useState } from 'react';
import { Percent, Plus, Pencil, Trash2, RotateCcw, X } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { toast } from '@/components/ui/Toast';

interface Tier {
  id: number;
  instructor_id: number | null;
  item_type: string | null;
  min_students: number;
  max_students: number | null;
  instructor_share_pct: number | string;
  notes?: string | null;
  is_active: boolean;
  deleted_at?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instructor?: any;
}

const TYPES = ['course', 'bundle', 'batch', 'webinar'];
const inputClass = 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-brand-400 outline-none';

export default function RevenueShareTiersPage() {
  const [rows, setRows] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tier | null>(null);
  const [saving, setSaving] = useState(false);

  // form state
  const [fInstructor, setFInstructor] = useState('');
  const [fType, setFType] = useState('');
  const [fMin, setFMin] = useState('0');
  const [fMax, setFMax] = useState('');
  const [fPct, setFPct] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [fActive, setFActive] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/revenue-share-tiers?limit=200&sort=min_students&order=asc${showTrash ? '&show_deleted=true' : ''}`);
      setRows(res.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tiers');
    }
    setLoading(false);
  }, [showTrash]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() {
    setEditing(null);
    setFInstructor(''); setFType(''); setFMin('0'); setFMax(''); setFPct(''); setFNotes(''); setFActive(true);
    setDialogOpen(true);
  }
  function openEdit(t: Tier) {
    setEditing(t);
    setFInstructor(t.instructor_id ? String(t.instructor_id) : '');
    setFType(t.item_type || '');
    setFMin(String(t.min_students ?? 0));
    setFMax(t.max_students != null ? String(t.max_students) : '');
    setFPct(String(t.instructor_share_pct ?? ''));
    setFNotes(t.notes || '');
    setFActive(!!t.is_active);
    setDialogOpen(true);
  }

  async function save() {
    if (!fPct.trim()) { toast.error('Instructor share % is required'); return; }
    setSaving(true);
    const payload = {
      instructor_id: fInstructor.trim() || null,
      item_type: fType || null,
      min_students: fMin.trim() || '0',
      max_students: fMax.trim() || null,
      instructor_share_pct: fPct.trim(),
      notes: fNotes.trim() || null,
      is_active: String(fActive),
    };
    try {
      if (editing) await apiRequest(`/revenue-share-tiers/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await apiRequest('/revenue-share-tiers', { method: 'POST', body: JSON.stringify(payload) });
      toast.success(editing ? 'Tier updated' : 'Tier created');
      setDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
    setSaving(false);
  }

  async function remove(t: Tier) {
    try {
      await apiRequest(`/revenue-share-tiers/${t.id}`, { method: 'DELETE' });
      toast.success('Tier deleted');
      fetchData();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Delete failed'); }
  }
  async function restore(t: Tier) {
    try {
      await apiRequest(`/revenue-share-tiers/${t.id}/restore`, { method: 'PATCH' });
      toast.success('Tier restored');
      fetchData();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Restore failed'); }
  }

  const scopeLabel = (t: Tier) => {
    const who = t.instructor_id
      ? (t.instructor?.full_name || `${t.instructor?.first_name ?? ''} ${t.instructor?.last_name ?? ''}`.trim() || `User #${t.instructor_id}`)
      : 'All instructors';
    const what = t.item_type ? t.item_type : 'all types';
    return `${who} · ${what}`;
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="heading text-2xl text-slate-900 flex items-center gap-2"><Percent className="h-6 w-6 text-violet-500" /> Revenue Share Tiers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Instructor/system split by distinct paid students, per content type. Most specific scope wins:
            instructor+type → instructor → type → global. Defaults: 0–100 → 60% · 101–500 → 70% · 501–5000 → 75% · 5000+ → 80%.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTrash(v => !v)} className={`rounded-full border px-4 py-2 text-sm font-semibold ${showTrash ? 'border-rose-300 text-rose-600 bg-rose-50' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            {showTrash ? 'Viewing Trash' : 'Trash'}
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition-colors">
            <Plus className="h-4 w-4" /> Add Tier
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-md bg-white border border-slate-200 shadow-card overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Students</th>
              <th className="px-4 py-3">Instructor %</th>
              <th className="px-4 py-3">System %</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">{showTrash ? 'Trash is empty' : 'No tiers yet'}</td></tr>
            ) : rows.map((t) => {
              const pct = Number(t.instructor_share_pct);
              return (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm text-slate-500">{t.id}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${t.instructor_id || t.item_type ? 'text-violet-700' : 'text-slate-800'}`}>{scopeLabel(t)}</span>
                    {!t.instructor_id && !t.item_type && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">default</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{t.min_students.toLocaleString('en-IN')} – {t.max_students == null ? '∞' : t.max_students.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-sm font-bold text-brand-700">{pct}%</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{Math.round((100 - pct) * 100) / 100}%</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 max-w-[220px] truncate">{t.notes || '--'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${t.deleted_at ? 'bg-rose-50 text-rose-600' : t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.deleted_at ? 'Deleted' : t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.deleted_at ? (
                      <button onClick={() => restore(t)} title="Restore" className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"><RotateCcw className="h-4 w-4" /></button>
                    ) : (
                      <>
                        <button onClick={() => openEdit(t)} title="Edit" className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(t)} title="Delete" className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-[90] bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setDialogOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="heading text-lg text-slate-900">{editing ? 'Edit Tier' : 'Add Tier'}</h2>
              <button onClick={() => setDialogOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Instructor ID <span className="text-slate-400 font-normal">(blank = all)</span></label>
                <input value={fInstructor} onChange={e => setFInstructor(e.target.value)} placeholder="e.g. 15" className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Content type <span className="text-slate-400 font-normal">(blank = all)</span></label>
                <select value={fType} onChange={e => setFType(e.target.value)} className={inputClass}>
                  <option value="">All types</option>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Min students</label>
                <input value={fMin} onChange={e => setFMin(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Max students <span className="text-slate-400 font-normal">(blank = ∞)</span></label>
                <input value={fMax} onChange={e => setFMax(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Instructor share %</label>
                <input value={fPct} onChange={e => setFPct(e.target.value)} placeholder="e.g. 70" className={inputClass} />
              </div>
              <div className="flex items-end pb-1">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={fActive} onChange={e => setFActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Active
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">Notes</label>
                <input value={fNotes} onChange={e => setFNotes(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDialogOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
              <button onClick={save} disabled={saving} className="rounded-full bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 text-sm font-semibold disabled:opacity-50">{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
