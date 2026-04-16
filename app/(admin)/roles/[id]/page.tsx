"use client";
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { ArrowLeft, Shield, Save, KeyRound, CheckSquare, Square } from 'lucide-react';

export default function RoleDetailPage() {
  const { id } = useParams();
  const [role, setRole] = useState<any>(null);
  const [allPerms, setAllPerms] = useState<any>({});
  const [assigned, setAssigned] = useState<Set<number>>(new Set());
  const [original, setOriginal] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    setLoading(true);
    const [r, p] = await Promise.all([api.getRole(+id!), api.listPermissionsGrouped()]);
    if (r.success) {
      setRole(r.data);
      const ids = new Set<number>((r.data.permissions || []).map((x: any) => x.permission_id));
      setAssigned(ids);
      setOriginal(new Set(ids));
    }
    if (p.success) setAllPerms(p.data || {});
    setLoading(false);
  }

  const dirty = useMemo(() => {
    if (assigned.size !== original.size) return true;
    for (const id of assigned) if (!original.has(id)) return true;
    return false;
  }, [assigned, original]);

  function togglePerm(pid: number) {
    setAssigned(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  function toggleResource(resource: string) {
    const perms = allPerms[resource] || [];
    const allIds = perms.map((p: any) => p.id);
    const allAssigned = allIds.every((pid: number) => assigned.has(pid));
    setAssigned(prev => {
      const next = new Set(prev);
      if (allAssigned) allIds.forEach((pid: number) => next.delete(pid));
      else allIds.forEach((pid: number) => next.add(pid));
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const removed = [...original].filter(id => !assigned.has(id));
    const added = [...assigned].filter(id => !original.has(id));

    for (const pid of removed) {
      await api.revokeRolePermission(+id!, pid);
    }
    if (added.length > 0) {
      await api.assignBulkPermissions(+id!, added);
    }
    setSaving(false);
    toast.success(`Saved: +${added.length} / -${removed.length}`);
    load();
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-96" /></div>;
  if (!role) return <div>Role not found</div>;

  return (
    <div className="animate-fade-in">
      <Link href="/roles" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to roles
      </Link>

      <Card className="mb-6">
        <CardContent className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">{role.display_name}</h1>
              <code className="text-sm text-slate-500 font-mono">{role.name}</code>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="muted">Level {role.level}</Badge>
                {role.is_system && <Badge variant="info">System</Badge>}
                {role.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
                <Badge variant="default">{assigned.size} permissions</Badge>
              </div>
              {role.description && <p className="text-sm text-slate-600 mt-2">{role.description}</p>}
            </div>
          </div>
          {dirty && (
            <Button onClick={save} loading={saving}>
              <Save className="w-4 h-4" /> Save changes
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {Object.entries(allPerms).map(([resource, perms]: [string, any]) => {
          const allIds = perms.map((p: any) => p.id);
          const assignedCount = allIds.filter((pid: number) => assigned.has(pid)).length;
          const allAssigned = assignedCount === allIds.length;

          return (
            <Card key={resource}>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="capitalize flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-brand-600" />
                    {resource.replace('_', ' ')}
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-0.5">{assignedCount} of {allIds.length} assigned</p>
                </div>
                <button
                  onClick={() => toggleResource(resource)}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {allAssigned ? 'Unselect all' : 'Select all'}
                </button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {perms.map((p: any) => {
                    const isAssigned = assigned.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePerm(p.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${isAssigned ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        {isAssigned ? <CheckSquare className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" /> : <Square className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />}
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 text-sm">{p.display_name}</div>
                          <code className="text-xs text-slate-500 font-mono">{p.resource}:{p.action}</code>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
