"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Plus, Shield, ChevronRight, Trash2 } from 'lucide-react';
import type { Role } from '@/lib/types';

const schema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Lowercase letters, numbers, underscores only'),
  display_name: z.string().min(1),
  description: z.string().optional(),
  level: z.coerce.number().int().min(0).max(99),
});

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await api.listRoles();
    if (res.success) setRoles(res.data || []);
    setLoading(false);
  }

  async function onCreate(data: any) {
    const res = await api.createRole(data);
    if (res.success) { toast.success('Role created'); setCreateOpen(false); reset(); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onDelete(role: Role) {
    if (role.is_system) return toast.error('Cannot delete system role');
    if (!confirm(`Delete role "${role.display_name}"?`)) return;
    const res = await api.deleteRole(role.id);
    if (res.success) { toast.success('Role deleted'); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function onToggleActive(role: Role) {
    const res = await api.updateRole(role.id, { is_active: !role.is_active });
    if (res.success) { toast.success(`Role ${!role.is_active ? 'activated' : 'deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Roles"
        description="Manage role hierarchy and their permissions"
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create role</Button>}
      />

      <div className="grid gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-24 animate-pulse bg-slate-50" />)
        ) : roles.map((r) => (
          <Card key={r.id} className="p-5 hover:shadow-card-hover transition-all group">
            <div className="flex items-center justify-between gap-4">
              <Link href={`/roles/${r.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-slate-900">{r.display_name}</h3>
                    <Badge variant="muted">Level {r.level}</Badge>
                    {r.is_system && <Badge variant="info">System</Badge>}
                    {!r.is_active && <Badge variant="danger">Inactive</Badge>}
                  </div>
                  {r.description && <p className="text-sm text-slate-500 mt-1 truncate">{r.description}</p>}
                  <code className="text-xs text-slate-400 font-mono">{r.name}</code>
                </div>
              </Link>

              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => onToggleActive(r)}>
                  {r.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                {!r.is_system && (
                  <button onClick={() => onDelete(r)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <Link href={`/roles/${r.id}`}>
                  <Button size="sm" variant="ghost"><ChevronRight className="w-4 h-4" /></Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create Role" description="Define a new custom role">
        <form onSubmit={handleSubmit(onCreate)} className="p-6 space-y-4">
          <Input label="Name (internal)" placeholder="content_reviewer" error={errors.name?.message as string} hint="Lowercase with underscores" {...register('name')} />
          <Input label="Display Name" placeholder="Content Reviewer" error={errors.display_name?.message as string} {...register('display_name')} />
          <Input label="Description" placeholder="Reviews course content before publishing" {...register('description')} />
          <Input label="Level (0-99)" type="number" placeholder="45" error={errors.level?.message as string} hint="Higher level inherits lower level permissions" {...register('level')} />
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
