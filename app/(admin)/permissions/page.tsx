"use client";
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { KeyRound } from 'lucide-react';

export default function PermissionsPage() {
  const [grouped, setGrouped] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await api.listPermissions();
    if (res.success && Array.isArray(res.data)) {
      const g = res.data.reduce((acc: any, p: any) => {
        (acc[p.resource] = acc[p.resource] || []).push(p);
        return acc;
      }, {});
      setGrouped(g);
    }
    setLoading(false);
  }

  async function toggleActive(p: any) {
    const res = await api.updatePermission(p.id, { is_active: !p.is_active });
    if (res.success) { toast.success(`Permission ${!p.is_active ? 'activated' : 'deactivated'}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Permissions" description="All permissions grouped by resource. Toggle active status." />

      <div className="grid gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)
        ) : Object.entries(grouped).map(([resource, perms]: [string, any]) => (
          <Card key={resource}>
            <CardHeader>
              <CardTitle className="capitalize flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-brand-600" />
                {resource.replace('_', ' ')}
                <Badge variant="muted" className="ml-auto">{perms.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {perms.map((p: any) => (
                  <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 text-sm">{p.display_name}</div>
                      <code className="text-xs text-slate-500 font-mono">{p.resource}:{p.action}</code>
                      {p.description && <p className="text-xs text-slate-500 mt-1">{p.description}</p>}
                    </div>
                    <button
                      onClick={() => toggleActive(p)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${p.is_active ? 'bg-brand-500' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${p.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
