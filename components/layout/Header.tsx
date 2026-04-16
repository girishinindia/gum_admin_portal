"use client";
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search } from 'lucide-react';
import { NotificationsDropdown } from './NotificationsDropdown';
import { UserMenu } from './UserMenu';

const routeLabels: Record<string, string> = {
  'dashboard': 'Dashboard',
  'my-permissions': 'My Access',
  'users': 'Users',
  'roles': 'Roles',
  'permissions': 'Permissions',
  'countries': 'Countries',
  'activity-logs': 'Activity Logs',
};

function getBreadcrumb(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'Home';
  const base = routeLabels[parts[0]] || parts[0];
  if (parts.length === 1) return base;
  return `${base} · Detail`;
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const breadcrumb = getBreadcrumb(pathname);
  const [search, setSearch] = useState('');

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/users?search=${encodeURIComponent(q)}`);
    setSearch('');
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 h-16 flex items-center px-6 gap-4">
      <div className="hidden md:flex items-center gap-2 text-sm">
        <span className="text-slate-400">Grow Up More</span>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-700">{breadcrumb}</span>
      </div>

      <div className="flex-1 flex justify-center max-w-md mx-auto">
        <form onSubmit={onSearch} className="relative w-full hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users (name, email, mobile)..."
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 focus:outline-none placeholder:text-slate-400 transition-all"
          />
        </form>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <NotificationsDropdown />
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <UserMenu />
      </div>
    </header>
  );
}
