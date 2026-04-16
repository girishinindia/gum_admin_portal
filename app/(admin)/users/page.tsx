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
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { api } from '@/lib/api';
import { formatDate, initials } from '@/lib/utils';
import { toast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { Search, Users as UsersIcon, ChevronLeft, ChevronRight, Plus, Mail, Phone, Lock, User as UserIcon } from 'lucide-react';
import type { User, Role } from '@/lib/types';

const createSchema = z.object({
  first_name: z.string().min(1, 'Required').max(75),
  last_name: z.string().min(1, 'Required').max(75),
  email: z.string().email('Invalid email'),
  mobile: z.string().min(10, 'Min 10 digits').max(15),
  password: z.string().min(8, 'Min 8 characters'),
  locale: z.enum(['en', 'hi', 'gu']).default('en'),
  role_id: z.coerce.number().optional(),
});

export default function UsersPage() {
  const { user: me } = useAuth();
  const isSuperAdmin = (me?.max_role_level || 0) >= 100;

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(createSchema) });

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [page, status]);
  useEffect(() => { if (isSuperAdmin) loadRoles(); }, [isSuperAdmin]);

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    const res = await api.listUsers(`?${qs}`);
    if (res.success && Array.isArray(res.data)) {
      setUsers(res.data);
      setTotalPages(res.pagination?.totalPages || 1);
    }
    setLoading(false);
  }

  async function loadRoles() {
    const res = await api.listRoles();
    if (res.success) setRoles(res.data || []);
  }

  async function onCreate(data: any) {
    setCreating(true);
    const payload: any = { ...data };
    if (!payload.role_id) delete payload.role_id;
    const res = await api.createUser(payload);
    setCreating(false);
    if (res.success) {
      toast.success('User created successfully');
      setCreateOpen(false);
      reset();
      load();
    } else {
      toast.error(res.error || 'Failed to create user');
    }
  }

  const statusBadge = (s: string) => {
    const map: any = { active: 'success', inactive: 'muted', suspended: 'danger' };
    return <Badge variant={map[s] || 'default'}>{s}</Badge>;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Users"
        description="Manage all registered users, assign roles, and view activity"
        actions={
          isSuperAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Create user
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
              placeholder="Search by name, email, or mobile..."
              className="w-full h-10 pl-10 pr-3 text-sm rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 px-3 text-sm rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none bg-white"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
          <Button variant="outline" onClick={() => { setPage(1); load(); }}>Search</Button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-20 ml-auto" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No users found"
            description="Try adjusting your filters"
            action={isSuperAdmin ? <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create user</Button> : undefined}
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>User</TH>
                  <TH>Contact</TH>
                  <TH>Status</TH>
                  <TH>Last Login</TH>
                  <TH>Joined</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {users.map((u) => (
                  <TR key={u.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold overflow-hidden flex-shrink-0">
                          {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : initials(u.full_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{u.full_name}</div>
                          <div className="text-xs text-slate-500">ID: {u.id}</div>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <div className="text-sm text-slate-700 truncate max-w-[200px]">{u.email}</div>
                      <div className="text-xs text-slate-500">{u.mobile}</div>
                    </TD>
                    <TD>{statusBadge(u.status)}</TD>
                    <TD className="text-sm text-slate-500">{u.last_login_at ? formatDate(u.last_login_at, 'MMM D') : '—'}</TD>
                    <TD className="text-sm text-slate-500">{formatDate(u.created_at, 'MMM D, YYYY')}</TD>
                    <TD>
                      <Link href={`/users/${u.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="w-4 h-4" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Next <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Create User Dialog — Super Admin only */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create User" description="Admin-created users are auto-verified (no OTP required)" size="lg">
        <form onSubmit={handleSubmit(onCreate)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <UserIcon className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
              <Input label="First Name" placeholder="Girish" className="pl-10" error={errors.first_name?.message as string} {...register('first_name')} />
            </div>
            <div className="relative">
              <UserIcon className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
              <Input label="Last Name" placeholder="Chaudhary" className="pl-10" error={errors.last_name?.message as string} {...register('last_name')} />
            </div>
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Email" type="email" placeholder="user@growupmore.com" className="pl-10" error={errors.email?.message as string} {...register('email')} />
          </div>

          <div className="relative">
            <Phone className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Mobile" placeholder="9876543210" className="pl-10" error={errors.mobile?.message as string} hint="10-digit Indian numbers auto-prefixed with +91" {...register('mobile')} />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Password" type="password" placeholder="Min 8 characters" className="pl-10" error={errors.password?.message as string} hint="User can change this later via Forgot Password" {...register('password')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Language</label>
              <select {...register('locale')} className="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none bg-white">
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Initial Role</label>
              <select {...register('role_id')} className="w-full h-10 px-3 text-sm rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none bg-white">
                <option value="">Default (Student)</option>
                {roles.filter(r => r.is_active).map(r => (
                  <option key={r.id} value={r.id}>{r.display_name} (Level {r.level})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs text-brand-900">
            <strong>Note:</strong> This user will be pre-verified (email + mobile). They can log in immediately with the password you set.
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create User</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
