"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Shield, KeyRound, Globe2, MapPin, Building2, Sparkles, Languages, FileText, GraduationCap, ShieldCheck, FolderOpen, FileImage, Award, Compass, Target, Share2, LayoutGrid, Layers, GitBranch, Network, Link2, ChevronDown, BookOpen, BookMarked, FileQuestion, Video, Library, Tags, Package, FolderTree, Boxes } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SubLink {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  superAdminOnly?: boolean;
  subLinks?: SubLink[];
}

interface NavGroup {
  key: string;
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    key: 'admin',
    title: 'Admin',
    items: [
      { href: '/my-permissions',  label: 'My Access',     icon: ShieldCheck },
      { href: '/users',           label: 'Users',         icon: Users },
      { href: '/roles',           label: 'Roles',         icon: Shield,    superAdminOnly: true },
      { href: '/permissions',     label: 'Permissions',   icon: KeyRound,  superAdminOnly: true },
      { href: '/activity-logs',   label: 'Activity Logs', icon: FileText },
    ],
  },
  {
    key: 'master',
    title: 'Master',
    items: [
      { href: '/countries',        label: 'Countries',        icon: Globe2 },
      { href: '/states',           label: 'States',           icon: MapPin },
      { href: '/cities',           label: 'Cities',           icon: Building2 },
      { href: '/skills',           label: 'Skills',           icon: Sparkles },
      { href: '/languages',        label: 'Languages',        icon: Languages },
      { href: '/education-levels', label: 'Education Levels', icon: GraduationCap },
      { href: '/document-types',   label: 'Document Types',   icon: FolderOpen },
      { href: '/documents',        label: 'Documents',        icon: FileImage },
      { href: '/designations',     label: 'Designations',     icon: Award },
      { href: '/specializations',  label: 'Specializations',  icon: Compass },
      { href: '/learning-goals',   label: 'Learning Goals',   icon: Target },
      { href: '/social-medias',    label: 'Social Media',     icon: Share2 },
      {
        href: '/categories',
        label: 'Categories',
        icon: LayoutGrid,
        subLinks: [{ href: '/category-translations', label: 'Translations' }],
      },
      {
        href: '/sub-categories',
        label: 'Sub-Categories',
        icon: Layers,
        subLinks: [{ href: '/sub-category-translations', label: 'Translations' }],
      },
    ],
  },
  {
    key: 'branch',
    title: 'Branch & Departments',
    items: [
      { href: '/branches',            label: 'Branches',             icon: GitBranch },
      { href: '/departments',         label: 'Departments',          icon: Network },
      { href: '/branch-departments',  label: 'Branch & Departments', icon: Link2 },
    ],
  },
  {
    key: 'material',
    title: 'Material Management',
    items: [
      {
        href: '/subjects',
        label: 'Subjects',
        icon: BookOpen,
        subLinks: [{ href: '/subject-translations', label: 'Translations' }],
      },
      {
        href: '/chapters',
        label: 'Chapters',
        icon: BookMarked,
        subLinks: [{ href: '/chapter-translations', label: 'Translations' }],
      },
      {
        href: '/topics',
        label: 'Topics',
        icon: FileQuestion,
        subLinks: [{ href: '/topic-translations', label: 'Translations' }],
      },
      {
        href: '/sub-topics',
        label: 'Sub-Topics',
        icon: FileQuestion,
        subLinks: [{ href: '/sub-topic-translations', label: 'Translations' }],
      },
      {
        href: '/auto-sub-topics',
        label: 'Auto Sub-Topics',
        icon: Sparkles,
      },
      {
        href: '/auto-video-upload',
        label: 'Auto Video Upload',
        icon: Video,
      },
      {
        href: '/youtube-descriptions',
        label: 'YouTube Descriptions',
        icon: Video,
      },
      {
        href: '/material-tree',
        label: 'Material Tree',
        icon: FolderOpen,
      },
    ],
  },
  {
    key: 'course',
    title: 'Course Management',
    items: [
      {
        href: '/courses',
        label: 'Courses',
        icon: Library,
        subLinks: [{ href: '/course-translations', label: 'Translations' }],
      },
      {
        href: '/course-sub-categories',
        label: 'Course Categories',
        icon: Tags,
      },
      {
        href: '/course-modules',
        label: 'Course Modules',
        icon: Package,
        subLinks: [{ href: '/course-module-translations', label: 'Translations' }],
      },
      {
        href: '/course-structure',
        label: 'Course Structure',
        icon: FolderTree,
      },
      {
        href: '/bundles',
        label: 'Bundles',
        icon: Boxes,
        subLinks: [
          { href: '/bundle-translations', label: 'Translations' },
          { href: '/bundle-courses', label: 'Courses' },
        ],
      },
    ],
  },
];

/** Check if a pathname falls within a group's items (including subLinks) */
function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some(
    (item) =>
      pathname === item.href ||
      pathname.startsWith(item.href + '/') ||
      item.subLinks?.some(
        (s) => pathname === s.href || pathname.startsWith(s.href + '/')
      )
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isSuperAdmin = (user?.max_role_level || 0) >= 100;

  // Initialise open groups — auto-open the group whose item is currently active
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.key] = isGroupActive(g, pathname);
    });
    return initial;
  });

  // Keep the active group open when the route changes
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      navGroups.forEach((g) => {
        if (isGroupActive(g, pathname)) next[g.key] = true;
      });
      return next;
    });
  }, [pathname]);

  const toggle = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pb-2">
        {/* Dashboard — always visible at top */}
        <div className="px-3 pt-3 pb-1">
          <Link
            href="/dashboard"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative group',
              pathname === '/dashboard'
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            )}
          >
            {pathname === '/dashboard' && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-full" />
            )}
            <LayoutDashboard
              className={cn('w-[18px] h-[18px] flex-shrink-0', pathname === '/dashboard' && 'text-brand-600')}
              strokeWidth={pathname === '/dashboard' ? 2.5 : 2}
            />
            Dashboard
          </Link>
        </div>

        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.superAdminOnly || isSuperAdmin
          );
          if (visibleItems.length === 0) return null;

          const isOpen = openGroups[group.key] ?? false;
          const groupActive = isGroupActive(group, pathname);

          return (
            <div key={group.key}>
              {/* Collapsible group header */}
              <button
                onClick={() => toggle(group.key)}
                className={cn(
                  'w-full flex items-center justify-between px-5 pt-4 pb-2 group/header cursor-pointer',
                  'hover:bg-slate-50/60 transition-colors'
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    groupActive ? 'text-brand-600' : 'text-slate-400 group-hover/header:text-slate-500'
                  )}
                >
                  {group.title}
                </span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform duration-200',
                    groupActive ? 'text-brand-500' : 'text-slate-400',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Collapsible content */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200 ease-in-out',
                  isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                <div className="px-3 space-y-0.5 pb-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + '/');
                    const subActive = item.subLinks?.some(
                      (s) =>
                        pathname === s.href ||
                        pathname.startsWith(s.href + '/')
                    );

                    return (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative group',
                            active || subActive
                              ? 'bg-brand-50 text-brand-700'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          )}
                        >
                          {(active || subActive) && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-full" />
                          )}
                          <Icon
                            className={cn(
                              'w-[18px] h-[18px] flex-shrink-0',
                              (active || subActive) && 'text-brand-600'
                            )}
                            strokeWidth={active || subActive ? 2.5 : 2}
                          />
                          {item.label}
                          {item.superAdminOnly && (
                            <span className="ml-auto text-[9px] font-bold text-brand-500 tracking-wider">
                              SUPER
                            </span>
                          )}
                        </Link>

                        {/* Sub-links (e.g. Translations) */}
                        {item.subLinks && (active || subActive) && (
                          <div className="ml-9 mt-0.5 space-y-0.5">
                            {item.subLinks.map((sub) => {
                              const sActive =
                                pathname === sub.href ||
                                pathname.startsWith(sub.href + '/');
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  className={cn(
                                    'block px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                                    sActive
                                      ? 'text-brand-700 bg-brand-50/60'
                                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                  )}
                                >
                                  {sub.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
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
