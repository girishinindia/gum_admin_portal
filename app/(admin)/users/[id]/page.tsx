"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatDate, initials, fromNow } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Mail, Phone, Calendar, Shield, Monitor, Plus, X, Lock, Crown, UserCircle } from 'lucide-react';

export default function UserDetailPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const isSuperAdmin = (me?.max_role_level || 0) >= 100;
  const isSelf = me?.id === Number(id);

  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function load() {
    setLoading(true);
    const [u, s] = await Promise.all([api.getUser(+id!), api.getUserSessions(+id!)]);
    if (u.success) setUser(u.data);
    if (s.success) setSessions(s.data || []);
    if (isSuperAdmin) {
      const r = await api.listRoles();
      if (r.success) setRoles(r.data || []);
    }
    setLoading(false);
  }

  // Target is super admin if max level >= 100
  const targetIsSuperAdmin = user?.max_role_level >= 100;
  // No user can change their own status (suspend/deactivate). Another super admin can.
  const cannotModifyStatus = isSelf;
  // Nobody can change their own role
  const cannotModifyRoles = isSelf;

  async function updateStatus(status: string) {
    const res = await api.updateUser(+id!, { status });
    if (res.success) { toast.success(`User status updated to ${status}`); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function assignRole(role_id: number) {
    const res = await api.assignUserRole(+id!, { role_id, scope: 'global' });
    if (res.success) { toast.success('Role assigned'); setRoleDialogOpen(false); load(); }
    else toast.error(res.error || 'Failed');
  }

  async function revokeRole(roleName: string) {
    const role = roles.find((r: any) => r.name === roleName);
    if (!role) return;
    // Extra client-side guard — server also enforces this
    if (cannotModifyRoles) {
      return toast.error('Cannot change your own role');
    }
    if (!confirm(`Revoke ${roleName} role?`)) return;
    const res = await api.revokeUserRole(+id!, role.id);
    if (res.success) { toast.success('Role revoked'); load(); }
    else toast.error(res.error || 'Failed');
  }

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-1/3" />
      <Skeleton className="h-64" />
    </div>
  );

  if (!user) return <div>User not found</div>;

  const availableRoles = roles.filter((r: any) => !user.roles?.some((ur: any) => ur.role === r.name));

  // Action buttons based on current status
  const statusActions: React.ReactNode[] = [];
  if (isSuperAdmin && !cannotModifyStatus) {
    if (user.status === 'active') {
      statusActions.push(
        <Button key="deact" variant="outline" onClick={() => confirm('Deactivate this user?') && updateStatus('inactive')}>
          Deactivate
        </Button>,
        <Button key="susp" variant="danger" onClick={() => confirm('Suspend this user? They will not be able to log in.') && updateStatus('suspended')}>
          Suspend
        </Button>
      );
    } else if (user.status === 'inactive') {
      statusActions.push(
        <Button key="act" variant="primary" onClick={() => updateStatus('active')}>Activate</Button>,
        <Button key="susp" variant="danger" onClick={() => confirm('Suspend this user?') && updateStatus('suspended')}>Suspend</Button>
      );
    } else if (user.status === 'suspended') {
      statusActions.push(
        <Button key="act" variant="primary" onClick={() => updateStatus('active')}>Activate</Button>
      );
    }
  }

  return (
    <div className="animate-fade-in">
      <Link href="/users" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to users
      </Link>

      <Card className="mb-6">
        <CardContent className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-2xl font-bold overflow-hidden">
              {user.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(user.full_name)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl font-bold text-slate-900">{user.full_name}</h1>
                {targetIsSuperAdmin && (
                  <Badge variant="default" className="gap-1 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border-amber-200">
                    <Crown className="w-3 h-3" /> Super Admin
                  </Badge>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {user.email}</span>
                <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {user.mobile}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Joined {formatDate(user.created_at, 'MMM YYYY')}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant={user.status === 'active' ? 'success' : user.status === 'suspended' ? 'danger' : 'muted'}>{user.status}</Badge>
                {user.roles?.map((r: any) => (
                  <Badge key={r.role} variant="default" className="gap-1">
                    <Shield className="w-3 h-3" /> {r.display_name} (L{r.level})
                  </Badge>
                ))}
              </div>
              {isSelf && isSuperAdmin && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 inline-flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> You cannot change your own status or roles
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Link href={`/users/${id}/profile`}>
              <Button variant="secondary"><UserCircle className="w-4 h-4" /> Profile</Button>
            </Link>
            {statusActions}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Roles</CardTitle>
              {isSuperAdmin && !cannotModifyRoles ? (
                <Button size="sm" variant="secondary" onClick={() => setRoleDialogOpen(true)} disabled={availableRoles.length === 0}>
                  <Plus className="w-4 h-4" /> Assign
                </Button>
              ) : (
                <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" /> {isSelf ? 'Cannot change own role' : 'Super admin only'}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {user.roles?.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No roles assigned</p>
            ) : (
              <div className="space-y-2">
                {user.roles?.map((r: any) => {
                  
                  return (
                    <div key={r.role} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{r.display_name}</div>
                          <div className="text-xs text-slate-500">Level {r.level}</div>
                        </div>
                      </div>
                      {isSuperAdmin && !cannotModifyRoles && r.level < 100 && (
                        <button onClick={() => revokeRole(r.role)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Revoke role">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Sessions</CardTitle>
              {sessions.length > 0 && isSuperAdmin && (
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!confirm('Revoke all sessions?')) return;
                  const r = await api.revokeAllSessions(+id!);
                  if (r.success) { toast.success('Sessions revoked'); load(); }
                }}>
                  Revoke all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No active sessions</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s: any) => (
                  <div key={s.session_id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5 text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-900 capitalize">{s.device_type || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{s.ip_address} · {fromNow(s.last_active_at)}</div>
                      </div>
                    </div>
                    <Badge variant="muted" className="capitalize">{s.login_method.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)} title="Assign Role" description="Select a role to assign to this user">
        <div className="p-6 space-y-2">
          {availableRoles.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">All roles already assigned</p>
          ) : availableRoles.map((r: any) => (
            <button
              key={r.id}
              onClick={() => assignRole(r.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-slate-900">{r.display_name}</div>
                <div className="text-xs text-slate-500">Level {r.level}{r.description ? ` · ${r.description}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
