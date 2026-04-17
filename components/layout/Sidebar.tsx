"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Shield, KeyRound, Globe2, MapPin, Building2, FileText, GraduationCap, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  href: string;
  label: string;
  icon: any;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard',       label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/my-permissions',  label: 'My Access',     icon: ShieldCheck },
  { href: '/users',           label: 'Users',         icon: Users },
  { href: '/roles',           label: 'Roles',         icon: Shield,    superAdminOnly: true },
  { href: '/permissions',     label: 'Permissions',   icon: KeyRound,  superAdminOnly: true },
  { href: '/countries',       label: 'Countries',     icon: Globe2 },
  { href: '/states',          label: 'States',        icon: MapPin },
  { href: '/cities',          label: 'Cities',        icon: Building2 },
  { href: '/activity-logs',   label: 'Activity Logs', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isSuperAdmin = (user?.max_role_level || 0) >= 100;

  const visibleItems = navItems.filter(item => !item.superAdminOnly || isSuperAdmin);

  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 h-16 flex items-center border-b border-slate-200">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 rounded-xl flex items-center justify-center shadow-brand group-hover:scale-105 transition-transform relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent_50%)]" />
            <GraduationCap className="w-5 h-5 text-white relative" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display font-bold text-slate-900 leading-none text-[15px]">Grow Up More</div>
            <div className="text-[10px] text-brand-600 mt-0.5 tracking-wider uppercase font-semibold">Admin Panel</div>
          </div>
        </Link>
      </div>

      {/* Section label */}
      <div className="px-5 pt-5 pb-2">
        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Main Menu</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-full" />
              )}
              <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', active && 'text-brand-600')} strokeWidth={active ? 2.5 : 2} />
              {item.label}
              {item.superAdminOnly && (
                <span className="ml-auto text-[9px] font-bold text-brand-500 tracking-wider">SUPER</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100">
        <div className="bg-gradient-to-br from-brand-50 to-sky-50 rounded-xl p-3.5 border border-brand-100/50">
          <div className="text-xs font-semibold text-brand-900">Need help?</div>
          <div className="text-[11px] text-brand-700 mt-0.5 leading-relaxed">Read the API docs or contact support</div>
          <a href="https://growupmore.com" target="_blank" rel="noopener noreferrer" className="inline-flex mt-2 text-[11px] font-semibold text-brand-700 hover:text-brand-900">
            Learn more →
          </a>
        </div>
      </div>
    </aside>
  );
}
