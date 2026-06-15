'use client';

/**
 * Idea Categories — admin CRUD for the "Submit Your Idea & Get Reward" module.
 * API: GET /idea-categories?include_inactive=true · POST/PATCH/DELETE (RBAC).
 */

import { useCallback, useEffect, useState } from 'react';
import { FolderTree, Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { toast } from '@/components/ui/Toast';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Cat {
  id: number; name: string; slug: string; description?: string | null; icon?: string | null;
  display_order: number; is_active: boolean; deleted_at?: string | null;
}

const input = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400';

export default function IdeaCategoriesPage() {
  const [rows, setRows] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTrash, setShowTrash] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cat | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<any>('/idea-categories?include_inactive=true&include_deleted=true&limit=200');
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch { toast.error('Failed to load categories'); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openForm = (c?: Cat) => {
    setEditing(c || null);
    setForm(c ? { name: c.name, slug: c.slug, description: c.description || '', icon: c.icon || '', display_order: c.display_order, is_active: c.is_active }
              : { name: '', slug: '', description: '', icon: '💡', display_order: rows.length + 1, is_active: true });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const body = { ...form, display_order: Number(form.display_order) || 0 };
      const res = editing
        ? await apiRequest<any>(`/idea-categories/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiRequest<any>('/idea-categories', { method: 'POST', body: JSON.stringify(body) });
      if (res?.success === false) throw new Error(res?.error || 'Save failed');
      toast.success(editing ? 'Category updated' : 'Category created');
      setOpen(false); load();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
    setSaving(false);
  };

  const trash = async (c: Cat) => {
    // BUG-81: warn if ideas still reference this category — trashing it leaves
    // them without a category. Usage count comes from GET /idea-categories/:id/usage.
    let warning = '';
    try {
      const usage = await apiRequest<any>(`/idea-categories/${c.id}/usage`);
      const n = Number(usage?.data?.ideas_using ?? 0);
      if (n > 0) warning = `\n\n${n} idea(s) use this category — they'll lose their category. Continue?`;
    } catch { /* usage lookup is best-effort; fall back to the plain prompt */ }
    if (!confirm(`Move "${c.name}" to trash?${warning}`)) return;
    const res = await apiRequest<any>(`/idea-categories/${c.id}`, { method: 'DELETE' });
    if (res?.success === false) toast.error(res?.error || 'Failed'); else { toast.success('Moved to trash'); load(); }
  };
  const restore = async (c: Cat) => {
    const res = await apiRequest<any>(`/idea-categories/${c.id}/restore`, { method: 'PATCH' });
    if (res?.success === false) toast.error(res?.error || 'Failed'); else { toast.success('Restored'); load(); }
  };

  const visible = rows.filter(r => showTrash ? r.deleted_at : !r.deleted_at);

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><FolderTree className="w-6 h-6 text-amber-500" /> Idea Categories</h1>
          <p className="text-sm text-slate-500 mt-1">Categories students & instructors pick when submitting an idea.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTrash(t => !t)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            {showTrash ? 'Show active' : 'Trash'}
          </button>
          <button onClick={() => openForm()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Plus className="w-4 h-4" /> New category
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">{showTrash ? 'Trash is empty' : 'No categories yet'}</td></tr>
            ) : visible.sort((a, b) => a.display_order - b.display_order).map(c => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 text-slate-500">{c.display_order}</td>
                <td className="px-4 py-3">
                  <span className="mr-2">{c.icon}</span>
                  <span className="font-medium text-slate-900">{c.name}</span>
                  {c.description ? <div className="text-xs text-slate-400 mt-0.5">{c.description}</div> : null}
                </td>
                <td className="px-4 py-3"><code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">{c.slug}</code></td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.deleted_at ? 'bg-rose-50 text-rose-600' : c.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.deleted_at ? 'trashed' : c.is_active ? 'active' : 'inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {showTrash ? (
                    <button onClick={() => restore(c)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-emerald-600 hover:border-emerald-300"><RotateCcw className="w-3 h-3" /> Restore</button>
                  ) : (
                    <>
                      <button onClick={() => openForm(c)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-300"><Pencil className="w-3 h-3" /> Edit</button>
                      <button onClick={() => trash(c)} className="ml-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:border-rose-300"><Trash2 className="w-3 h-3" /> Trash</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-y-auto" onClick={() => !saving && setOpen(false)}>
          <div className="mt-12 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">{editing ? 'Edit category' : 'New category'}</h3>
            <div className="space-y-3">
              <div><label className="text-xs font-semibold uppercase text-slate-500">Name *</label>
                <input className={input} value={form.name || ''} onChange={e => setForm((s: any) => ({ ...s, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold uppercase text-slate-500">Slug</label>
                  <input className={input} placeholder="auto from name" value={form.slug || ''} onChange={e => setForm((s: any) => ({ ...s, slug: e.target.value }))} /></div>
                <div><label className="text-xs font-semibold uppercase text-slate-500">Icon (emoji)</label>
                  <input className={input} value={form.icon || ''} onChange={e => setForm((s: any) => ({ ...s, icon: e.target.value }))} /></div>
              </div>
              <div><label className="text-xs font-semibold uppercase text-slate-500">Description</label>
                <textarea rows={2} className={input} value={form.description || ''} onChange={e => setForm((s: any) => ({ ...s, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div><label className="text-xs font-semibold uppercase text-slate-500">Display order</label>
                  <input type="number" className={input} value={form.display_order ?? 0} onChange={e => setForm((s: any) => ({ ...s, display_order: e.target.value }))} /></div>
                <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                  <input type="checkbox" checked={!!form.is_active} onChange={e => setForm((s: any) => ({ ...s, is_active: e.target.checked }))} /> Active
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={saving} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
              <button onClick={save} disabled={saving} className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
