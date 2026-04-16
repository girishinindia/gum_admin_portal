"use client";
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import { Shield, Crown, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';

interface MyPermsData {
  is_super_admin: boolean;
  max_role_level: number;
  roles: Array<{
    id: number;
    name: string;
    display_name: string;
    description?: string;
    level: number;
    is_system: boolean;
    scope: string;
    assigned_at: string;
  }>;
  permissions: any[];
  permissions_grouped: Record<string, any[]>;
  total_permissions: number;
  total_resources: number;
}

export default function MyPermissionsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MyPermsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await api.myPermissions();
    if (res.success) setData(res.data);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) return <div>Failed to load permissions</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="My Access"
        description="View your assigned roles and effective permissions on this platform"
      />

      {/* Hero card */}
      <Card className={`mb-6 overflow-hidden ${data.is_super_admin ? 'bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-white border-0' : 'bg-gradient-to-br from-slate-50 to-white'}`}>
        <CardContent className="relative">
          {data.is_super_admin && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.2),transparent_60%)] pointer-events-none" />
          )}
          <div className="relative flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${data.is_super_admin ? 'bg-white/15 backdrop-blur border border-white/20' : 'bg-brand-100 text-brand-700'}`}>
                {data.is_super_admin ? <Crown className="w-7 h-7" strokeWidth={2.5} /> : <ShieldCheck className="w-7 h-7" strokeWidth={2.5} />}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-2xl font-bold">
                    {data.is_super_admin ? 'Super Administrator' : user?.full_name}
                  </h2>
                  {data.is_super_admin && (
                    <Sparkles className="w-5 h-5 text-yellow-300" />
                  )}
                </div>
                <p className={`mt-1 text-sm ${data.is_super_admin ? 'text-brand-100' : 'text-slate-600'}`}>
                  {data.is_super_admin
                    ? 'Full access across the entire platform. Manage users, roles, permissions, and configuration.'
                    : 'Below are the roles you have been assigned and the permissions they grant.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${data.is_super_admin ? 'bg-white/15 text-white border border-white/20' : 'bg-brand-50 text-brand-700 border border-brand-200'}`}>
                    <Shield className="w-3 h-3" /> Level {data.max_role_level}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${data.is_super_admin ? 'bg-white/15 text-white border border-white/20' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                    <KeyRound className="w-3 h-3" /> {data.total_permissions} {data.is_super_admin ? 'permissions (all)' : 'permissions'}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${data.is_super_admin ? 'bg-white/15 text-white border border-white/20' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
                    {data.total_resources} resources
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles */}
      <div className="mb-6">
        <h2 className="font-display text-lg font-semibold text-slate-900 mb-3">Your Roles ({data.roles.length})</h2>
        {data.roles.length === 0 ? (
          <Card>
            <CardContent className="text-center py-10">
              <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No roles assigned. Contact your administrator.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.roles.map(role => (
              <Card key={role.id} className="hover:shadow-card-hover transition-all">
                <CardContent className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-slate-900 text-[15px] leading-tight">{role.display_name}</h3>
                      {role.is_system && <Badge variant="info" className="text-[10px]">System</Badge>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <code className="font-mono text-slate-400">{role.name}</code>
                      <span>·</span>
                      <span>Level {role.level}</span>
                    </div>
                    {role.description && <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{role.description}</p>}
                    <div className="text-[11px] text-slate-400 mt-1.5">Assigned {formatDate(role.assigned_at, 'MMM D, YYYY')}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Permissions */}
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-900 mb-3">
          Your Permissions ({data.total_permissions})
          {data.is_super_admin && <Badge variant="default" className="ml-2 text-[10px]">All resources</Badge>}
        </h2>

        {data.total_permissions === 0 ? (
          <Card>
            <CardContent className="text-center py-10">
              <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No permissions yet. Contact your administrator to get access.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {Object.entries(data.permissions_grouped).map(([resource, perms]) => (
              <Card key={resource}>
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-brand-600" />
                  <span className="font-display font-semibold text-sm text-slate-900 capitalize">{resource.replace('_', ' ')}</span>
                  <Badge variant="muted" className="ml-auto text-[10px]">{perms.length}</Badge>
                </div>
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {perms.map((p: any) => (
                    <div key={p.id} className="flex items-start gap-2 p-2 rounded-md border border-emerald-100 bg-emerald-50/40">
                      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-slate-900 leading-tight">{p.display_name}</div>
                        <code className="text-[10px] text-slate-500 font-mono">{p.resource}:{p.action}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
