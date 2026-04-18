"use client";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Sparkles, Trash2, Edit2, Eye, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Skill } from '@/lib/types';

const CATEGORIES = [
  { value: 'technical',     label: 'Technical' },
  { value: 'soft_skill',    label: 'Soft Skill' },
  { value: 'tool',          label: 'Tool' },
  { value: 'framework',     label: 'Framework' },
  { value: 'language',      label: 'Language' },
  { value: 'domain',        label: 'Domain' },
  { value: 'certification', label: 'Certification' },
  { value: 'other',         label: 'Other' },
];

const categoryColors: Record<string, string> = {
  technical: 'info',
  soft_skill: 'success',
  tool: 'warning',
  framework: 'info',
  language: 'muted',
  domain: 'info',
  certification: 'success',
  other: 'muted',
};

type SortField = 'id' | 'name' | 'category' | 'is_active';

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [viewing, setViewing] = useState<Skill | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  // Pagination, search, sort, filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [summary, setSummary] = useState<{ is_active: number; is_inactive: number; total: number; updated_at: string } | null>(null);

  const { register, handleSubmit, reset } = useForm();

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [searchDebounce, filterCategory, filterStatus, pageSize]);
  useEffect(() => {
    api.getTableSummary('skills').then(res => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
    });
  }, []);
  useEffect(() => { load(); }, [searchDebounce, page, pageSize, filterCategory, filterStatus, sortField, sortOrder]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterCategory) qs.set('category', filterCategory);
    if (filterStatus) qs.set('is_active', filterStatus);
    qs.set('sort', sortField);
    qs.set('order', sortOrder);
    const res = await api.listSkills('?' + qs.toString());
    if (res.success) {
      setSkills(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotal(res.pagination?.total || 0);
    }
    setLoading(false);
  }

  async function refreshSummary() {
    const res = await api.getTableSummary('skills');
    if (res.success && Array.isArray(res.data) && res.data.length > 0) setSummary(res.data[0]);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
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

  function openCreate() {
    setEditing(null);
    setImageFile(null);
    setImagePreview(null);
    setDialogKey(k => k + 1);
    reset({ name: '', category: 'technical', description: '' });
    setDialogOpen(true);
  }

  function openEdit(s: Skill) {
    setEditing(s);
    setImageFile(null);
    setImagePreview(null);
    setDialogKey(k => k + 1);
    reset({ name: s.name, category: s.category, description: s.description || '' });
    setDialogOpen(true);
  }

  function openView(s: Skill) {
    setViewing(s);
  }

  async function onSubmit(data: any) {
    const fd = new FormData();
    Object.keys(data).forEach(k => {
      if (data[k] !== undefined && data[k] !== null) fd.append(k, String(data[k]));
    });
    if (imageFile) {
      fd.append('icon', imageFile, imageFile.name);
    }

    const res = editing
      ? await api.updateSkill(editing.id, fd, true)
      : await api.createSkill(fd, true);

    if (res.success) {
      toast.success(editing ? 'Skill updated' : 'Skill created');
      setDialogOpen(false);
      load();
      refreshSummary();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(s: Skill) {
    if (!confirm(`Delete "${s.name}"? Icon will also be removed.`)) return;
    const res = await api.deleteSkill(s.id);
    if (res.success) { toast.success('Skill deleted'); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(s: Skill) {
    const fd = new FormData();
    fd.append('is_active', String(!s.is_active));
    const res = await api.updateSkill(s.id, fd, true);
    if (res.success) { toast.success(`Skill ${!s.is_active ? 'activated' : 'deactivated'}`); load(); refreshSummary(); }
    else toast.error(res.error || 'Failed');
  }

  const selectClass = "h-10 px-3 pr-8 text-sm rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 appearance-none cursor-pointer bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22/%3E%3C/svg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat";

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Skills"
        description="Manage skills, technologies, and certifications"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add skill</Button>}
      />

      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Skills', value: summary.total, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
            { label: 'Active', value: summary.is_active, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Inactive', value: summary.is_inactive, icon: XCircle, color: 'bg-red-50 text-red-600' },
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

      {/* Toolbar: search + filters */}
      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search skills...">
        <select className={selectClass} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className={selectClass} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </DataToolbar>

      {loading ? (
        <div className="mt-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : skills.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No skills yet"
          description={searchDebounce || filterCategory || filterStatus ? 'No skills match your filters' : 'Add your first skill'}
          action={!searchDebounce && !filterCategory && !filterStatus ? <Button onClick={openCreate}><Plus className="w-4 h-4" /> Add skill</Button> : undefined}
        />
      ) : (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="w-16"><button onClick={() => handleSort('id')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">ID <SortIcon field="id" /></button></TH>
                <TH className="w-12">Icon</TH>
                <TH>
                  <button onClick={() => handleSort('name')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Name <SortIcon field="name" />
                  </button>
                </TH>
                <TH>
                  <button onClick={() => handleSort('category')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Category <SortIcon field="category" />
                  </button>
                </TH>
                <TH>Description</TH>
                <TH>
                  <button onClick={() => handleSort('is_active')} className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer">
                    Status <SortIcon field="is_active" />
                  </button>
                </TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {skills.map(s => (
                <TR key={s.id}>
                  <TD className="py-2.5"><span className="font-mono text-xs text-slate-500">{s.id}</span></TD>
                  <TD className="py-2.5">
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200">
                      {s.icon ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={s.icon} alt={s.name} className="w-full h-full object-cover" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </TD>
                  <TD className="py-2.5">
                    <span className="font-medium text-slate-900">{s.name}</span>
                  </TD>
                  <TD className="py-2.5">
                    <Badge variant={(categoryColors[s.category] || 'muted') as any}>
                      {CATEGORIES.find(c => c.value === s.category)?.label || s.category}
                    </Badge>
                  </TD>
                  <TD className="py-2.5">
                    <span className="text-slate-600 text-sm line-clamp-1">{s.description || '—'}</span>
                  </TD>
                  <TD className="py-2.5">
                    <Badge variant={s.is_active ? 'success' : 'danger'}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TD>
                  <TD className="py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openView(s)} className="p-1.5 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-md text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onDelete(s)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            total={total}
            showingCount={skills.length}
          />
        </div>
      )}

      {/* ── View Skill Dialog ── */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} title="Skill Details" size="md">
        {viewing && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0 border border-slate-200">
                {viewing.icon ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={viewing.icon} alt={viewing.name} className="w-full h-full object-cover" />
                ) : (
                  <Sparkles className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{viewing.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={(categoryColors[viewing.category] || 'muted') as any}>
                    {CATEGORIES.find(c => c.value === viewing.category)?.label || viewing.category}
                  </Badge>
                  <Badge variant={viewing.is_active ? 'success' : 'danger'}>
                    {viewing.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Category" value={CATEGORIES.find(c => c.value === viewing.category)?.label || viewing.category} />
              <DetailRow label="Sort Order" value={String(viewing.sort_order)} />
              <DetailRow label="Description" value={viewing.description} />
              <DetailRow label="Created" value={new Date(viewing.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} />
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              <Button onClick={() => { setViewing(null); openEdit(viewing); }}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Skill' : 'Add Skill'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Active toggle — only when editing */}
          {editing && (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 -mt-1">
              <div>
                <span className="text-sm font-medium text-slate-700">Status</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing.is_active ? 'This skill is currently active' : 'This skill is currently inactive'}
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await onToggleActive(editing);
                  const refreshed = await api.getSkill(editing.id);
                  if (refreshed.success && refreshed.data) setEditing(refreshed.data);
                }}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-1 cursor-pointer',
                  editing.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                  editing.is_active ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>
          )}

          <ImageUpload
            key={dialogKey}
            label="Skill Icon"
            hint="Square icon, resized to 200x200px WebP on server"
            value={editing?.icon}
            aspectRatio={1}
            maxWidth={400}
            maxHeight={400}
            shape="rounded"
            onChange={(file, preview) => { setImageFile(file); setImagePreview(preview); }}
          />

          <Input label="Name" placeholder="React, Python, AWS..." {...register('name', { required: true })} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('category', { required: true })}
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={3}
              placeholder="Brief description of this skill..."
              {...register('description')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create skill'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
