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
import { Plus, Link2, Trash2, Edit2 } from 'lucide-react';
import type { BranchDepartment, Branch, Department } from '@/lib/types';

export default function BranchDepartmentsPage() {
  const [items, setItems] = useState<BranchDepartment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BranchDepartment | null>(null);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  const { register, handleSubmit, reset } = useForm();

  // Load dropdowns on mount
  useEffect(() => {
    api.listBranches('?limit=100').then(res => {
      if (res.success) setBranches(res.data || []);
    });
    api.listDepartments('?limit=100').then(res => {
      if (res.success) setDepartments(res.data || []);
    });
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchDebounce, filterBranch, filterDepartment]);

  // Load data when filters or page changes
  useEffect(() => { load(); }, [searchDebounce, page, filterBranch, filterDepartment]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (searchDebounce) qs.set('search', searchDebounce);
    if (filterBranch) qs.set('branch_id', filterBranch);
    if (filterDepartment) qs.set('department_id', filterDepartment);
    const res = await api.listBranchDepartments('?' + qs.toString());
    if (res.success) {
      setItems(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    reset({
      branch_id: branches[0]?.id || '',
      department_id: departments[0]?.id || '',
      local_head_user_id: '',
      employee_capacity: '',
      floor_or_wing: '',
      extension_number: '',
      sort_order: 0,
    });
    setDialogOpen(true);
  }

  function openEdit(item: BranchDepartment) {
    setEditing(item);
    reset({
      branch_id: item.branch_id,
      department_id: item.department_id,
      local_head_user_id: item.local_head_user_id || '',
      employee_capacity: item.employee_capacity || '',
      floor_or_wing: item.floor_or_wing || '',
      extension_number: item.extension_number || '',
      sort_order: item.sort_order,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: any) {
    const payload = {
      ...data,
      branch_id: parseInt(data.branch_id) || null,
      department_id: parseInt(data.department_id) || null,
      local_head_user_id: data.local_head_user_id ? parseInt(data.local_head_user_id) : null,
      employee_capacity: data.employee_capacity ? parseInt(data.employee_capacity) : null,
      sort_order: parseInt(data.sort_order) || 0,
    };

    const res = editing
      ? await api.updateBranchDepartment(editing.id, payload)
      : await api.createBranchDepartment(payload);

    if (res.success) {
      toast.success(editing ? 'Assignment updated' : 'Assignment created');
      setDialogOpen(false);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onDelete(item: BranchDepartment) {
    const branchName = item.branches?.name || 'Unknown';
    const deptName = item.departments?.name || 'Unknown';
    if (!confirm(`Delete assignment of ${deptName} to ${branchName}?`)) return;
    const res = await api.deleteBranchDepartment(item.id);
    if (res.success) {
      toast.success('Deleted');
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  async function onToggleActive(item: BranchDepartment) {
    const res = await api.updateBranchDepartment(item.id, { is_active: !item.is_active });
    if (res.success) {
      toast.success(`${!item.is_active ? 'Activated' : 'Deactivated'}`);
      load();
    } else {
      toast.error(res.error || 'Failed');
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Branch Departments"
        description="Manage department assignments to branches"
        actions={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add assignment</Button>}
      />

      <DataToolbar search={search} onSearchChange={setSearch} searchPlaceholder="Search assignments...">
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterBranch}
          onChange={e => setFilterBranch(e.target.value)}
        >
          <option value="">All branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterDepartment}
          onChange={e => setFilterDepartment(e.target.value)}
        >
          <option value="">All departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </DataToolbar>

      {loading ? (
        <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="No assignments yet"
          description={filterBranch || filterDepartment ? "No assignments match your filters" : "Add your first branch-department assignment"}
          action={<Button onClick={openCreate}><Plus className="w-4 h-4" /> Add assignment</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {items.map(item => (
            <Card key={item.id} className="p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">
                      {item.departments?.name || 'Unknown'} @ {item.branches?.name || 'Unknown'}
                    </h3>
                    {item.branches?.code && <Badge variant="muted" className="font-mono">{item.branches.code}</Badge>}
                    {item.departments?.code && <Badge variant="muted" className="font-mono">{item.departments.code}</Badge>}
                    {item.branches?.branch_type && (
                      <Badge variant="info" className="capitalize">{item.branches.branch_type}</Badge>
                    )}
                    {!item.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                    {item.employee_capacity && (
                      <span>Capacity: <span className="font-semibold text-slate-900">{item.employee_capacity}</span></span>
                    )}
                    {item.floor_or_wing && (
                      <span>Location: <span className="font-semibold text-slate-900">{item.floor_or_wing}</span></span>
                    )}
                    {item.extension_number && (
                      <span>Extension: <span className="font-semibold text-slate-900">{item.extension_number}</span></span>
                    )}
                    {item.local_head?.full_name && (
                      <span>Head: <span className="font-semibold text-slate-900">{item.local_head.full_name}</span></span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onToggleActive(item)}>
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <button type="button" onClick={() => openEdit(item)} className="p-2 rounded-md text-slate-500 hover:text-brand-600 hover:bg-brand-50">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => onDelete(item)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={editing ? 'Edit Assignment' : 'Add Assignment'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('branch_id', { required: true })}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                {...register('department_id', { required: true })}
              >
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Local Head User ID"
            type="number"
            placeholder="Optional - ID of local department head"
            {...register('local_head_user_id')}
          />

          <Input
            label="Employee Capacity"
            type="number"
            placeholder="Optional - number of employees"
            {...register('employee_capacity')}
          />

          <Input
            label="Floor or Wing"
            placeholder="Optional - e.g., 3rd Floor, Building A"
            {...register('floor_or_wing')}
          />

          <Input
            label="Extension Number"
            placeholder="Optional - phone extension"
            {...register('extension_number')}
          />

          <Input
            label="Sort Order"
            type="number"
            placeholder="0"
            {...register('sort_order')}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? 'Save changes' : 'Create'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
