"use client";
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Network, Trash2, Edit2 } from 'lucide-react';
import type { Department } from '@/lib/types';

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [filterParent, setFilterParent] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  const { register, handleSubmit, reset } = useForm();

  // Load departments for dropdown on mount
  useEffect(() => {
    async function loadDepartmentsForDropdown() {
      const res = await api.listDepartments('?limit=100');
      if (res.success) {
        setDepartments(res.data || []);
      }
    }
    loadDepartmentsForDropdown();
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter/search change
  useEffect(() => {
    setPage(1);
  }, [searchDebounce, filterParent]);

  // Load departments on page/filter/search change
  useEffect(() => { load(); }, [searchDebounce, page, filterParent]);

  async function refreshDepartments() {
    const res = await api.listDepartments('?limit=100');
    if (res.success) setDepartments(res.data || []);
  }

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterParent === 'null') {
      qs.set('parent_department_id', 'null');
    } else if (filterParent && filterParent !== '') {
      qs.set('parent_department_id', filterParent);
    }
    const res = await api.listDepartments('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({ name: '', code: '', description: '', parent_department_id: '', head_user_id: '' });
    setDialogOpen(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    reset({
      name: d.name,
      code: d.code || '',
      description: d.description || '',
      parent_department_id: d.parent_department_id || '',
      head_user_id: d.head_user_id || '',
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = {
      name: data.name,
      code: data.code,
      description: data.description || null,
      parent_department_id: data.parent_department_id ? parseInt(data.parent_department_id) : null,
      head_user_id: data.head_user_id ? parseInt(data.head_user_id) : null,
    };
    const res = editing
      ? await api.updateDepartment(editing.id, payload)
      : await api.createDepartment(payload);
    if (res.success) {
      toast.success(editing ? 'Department updated' : 'Department created');
      setDialogOpen(false); load(); refreshDepartments();
    } else toast.error(res.error || 'Failed');
  }

  async function onDelete(d: Department) {
    if (!confirm(`Delete "${d.name}"?`)) return;
    const res = await api.deleteDepartment(d.id);
    if (res.success) { toast.success('Deleted'); load(); refreshDepartments(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(d: Department) {
    const res = await api.updateDepartment(d.id, { is_active: !d.is_active });
    if (res.success) { toast.success(`${!d.is_active ? 'Activated' : 'Deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Departments" description="Manage organizational departments and hierarchies"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add department</Button>} />

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search departments...">
        <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterParent} onChange={e => setFilterParent(e.target.value)}>
          <option value="">All departments</option>
          <option value="null">Root departments only</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </DataToolbar>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Network} title="No departments yet" description={filterParent ? 'No departments in this filter' : 'Add your first department'}
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add department</Button>} />
      ) : (
        <div className="grid gap-3">
          {items.map(d => (
            <Card key={d.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Network className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{d.name}</h3>
                    {d.code && <Badge variant="muted" className="font-mono">{d.code}</Badge>}
                    {d.parent_department_id && (() => { const p = departments.find(dep => dep.id === d.parent_department_id); return p ? <Badge variant="info" className="text-xs">Parent: {p.name}</Badge> : null; })()}
                    {d.head && <Badge variant="success" className="text-xs">Head: {d.head.full_name}</Badge>}
                    {!d.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {d.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{d.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(d)}>
                    {d.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(d)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50"><Edit2 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => onDelete(d)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Department' : 'Add Department'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name" placeholder="Engineering" {...register('name', { required: true })} />
            <Input label="Code" placeholder="ENG" {...register('code', { required: true })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parent Department</label>
            <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              {...register('parent_department_id')}>
              <option value="">None (Root Department)</option>
              {departments
                .filter(d => !editing || d.id !== editing.id)
                .map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Head User ID</label>
            <Input label="" type="number" placeholder="Optional user ID" {...register('head_user_id')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={2} placeholder="Brief description..." {...register('description')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
