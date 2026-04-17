"use client";
import { useRouter } from 'next/navigation';
import { User, Settings, Shield, LogOut, ChevronDown, KeyRound } from 'lucide-react';
import { Dropdown, DropdownItem, DropdownDivider } from '@/components/ui/Dropdown';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const topRole = user.roles && user.roles.length > 0
    ? [...user.roles].sort((a, b) => b.level - a.level)[0]
    : null;

  return (
    <Dropdown
      width="w-64"
      trigger={
        <div className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center text-xs font-semibold overflow-hidden flex-shrink-0">
            {user.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <span>{user.first_name[0]}{user.last_name[0]}</span>
            )}
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-sm font-medium text-slate-900 leading-none">{user.first_name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 tracking-wider uppercase leading-none">
              {topRole?.display_name || 'User'}
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" strokeWidth={2} />
        </div>
      }
    >
      <div className="px-4 py-4 bg-gradient-to-br from-brand-50 to-sky-50 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-bold overflow-hidden flex-shrink-0 shadow-brand">
            {user.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <span>{user.first_name[0]}{user.last_name[0]}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900 truncate">{user.full_name}</div>
            <div className="text-xs text-slate-600 truncate">{user.email}</div>
          </div>
        </div>
        {topRole && (
          <div className="mt-2.5 flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-brand-600" />
            <Badge variant="default" className="text-[10px]">
              {topRole.display_name} · Level {topRole.level}
            </Badge>
          </div>
        )}
      </div>

      <div className="py-1">
        <DropdownItem icon={User} onClick={() => router.push(`/users/${user.id}`)}>
          View Profile
        </DropdownItem>
        <DropdownItem icon={KeyRound} onClick={() => router.push('/my-permissions')}>
          My Access &amp; Permissions
        </DropdownItem>
        <DropdownItem icon={Settings} onClick={() => router.push('/account-settings')}>
          Account Settings
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem icon={LogOut} danger onClick={logout}>
          Sign out
        </DropdownItem>
      </div>
    </Dropdown>
  );
}
