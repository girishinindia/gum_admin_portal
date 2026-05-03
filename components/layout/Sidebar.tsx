"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Shield, KeyRound, Globe2, MapPin, Building2, Sparkles, Languages, FileText, GraduationCap, ShieldCheck, FolderOpen, FileImage, Award, Compass, Target, Share2, LayoutGrid, Layers, GitBranch, Network, Link2, ChevronDown, ChevronRight, BookOpen, BookMarked, FileQuestion, Video, Library, Tags, Package, FolderTree, Boxes, HelpCircle, ListChecks, PenLine, Replace, FileEdit, ListOrdered, PlusCircle } from 'lucide-react';
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

interface NavSubGroup {
  key: string;
  label: string;
  icon: any;
  items: NavItem[];
}

interface NavGroup {
  key: string;
  title: string;
  items?: NavItem[];
  subGroups?: NavSubGroup[];
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
  {
    key: 'qa-viewer',
    title: 'Q&A Viewer',
    items: [
      {
        href: '/qa-viewer',
        label: 'Browse Questions',
        icon: BookOpen,
      },
    ],
  },
  {
    key: 'qa',
    title: 'Q&A Bank',
    subGroups: [
      {
        key: 'qa-mcq',
        label: 'MCQ',
        icon: HelpCircle,
        items: [
          {
            href: '/create-mcq',
            label: 'MCQ Questions',
            icon: HelpCircle,
          },
          {
            href: '/auto-mcq-generation',
            label: 'Auto Generate',
            icon: Sparkles,
          },
        ],
      },
      {
        key: 'qa-ow',
        label: 'One Word',
        icon: PenLine,
        items: [
          {
            href: '/create-one-word',
            label: 'One Word Questions',
            icon: PenLine,
          },
          {
            href: '/auto-ow-generation',
            label: 'Auto Generate',
            icon: Sparkles,
          },
        ],
      },
      {
        key: 'qa-desc',
        label: 'Descriptive',
        icon: FileEdit,
        items: [
          {
            href: '/create-descriptive',
            label: 'Descriptive Questions',
            icon: FileEdit,
          },
          {
            href: '/auto-desc-generation',
            label: 'Auto Generate',
            icon: Sparkles,
          },
        ],
      },
      {
        key: 'qa-matching',
        label: 'Matching',
        icon: Link2,
        items: [
          {
            href: '/create-matching',
            label: 'Matching Questions',
            icon: Link2,
          },
          {
            href: '/auto-matching-generation',
            label: 'Auto Generate',
            icon: Sparkles,
          },
        ],
      },
      {
        key: 'qa-ordering',
        label: 'Ordering',
        icon: ListOrdered,
        items: [
          {
            href: '/create-ordering',
            label: 'Ordering Questions',
            icon: ListOrdered,
          },
          {
            href: '/auto-ordering-generation',
            label: 'Auto Generate',
            icon: Sparkles,
          },
        ],
      },
    ],
  },
];

/** Check if a single item (or its subLinks) is active */
function isItemActive(item: NavItem, pathname: string): boolean {
  return (
    pathname === item.href ||
    pathname.startsWith(item.href + '/') ||
    !!item.subLinks?.some((s) => pathname === s.href || pathname.startsWith(s.href + '/'))
  );
}

/** Check if a sub-group has any active item */
function isSubGroupActive(sg: NavSubGroup, pathname: string): boolean {
  return sg.items.some((item) => isItemActive(item, pathname));
}

/** Check if a pathname falls within a group's items (including subLinks and subGroups) */
function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.subGroups) {
    return group.subGroups.some((sg) => isSubGroupActive(sg, pathname));
  }
  return (group.items || []).some((item) => isItemActive(item, pathname));
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isSuperAdmin = (user?.max_role_level || 0) >= 100;

  // Initialise open groups + sub-groups — auto-open whichever is currently active
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.key] = isGroupActive(g, pathname);
      g.subGroups?.forEach((sg) => {
        initial[sg.key] = isSubGroupActive(sg, pathname);
      });
    });
    return initial;
  });

  // Keep the active group/sub-group open when the route changes
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      navGroups.forEach((g) => {
        if (isGroupActive(g, pathname)) next[g.key] = true;
        g.subGroups?.forEach((sg) => {
          if (isSubGroupActive(sg, pathname)) next[sg.key] = true;
        });
      });
      return next;
    });
  }, [pathname]);

  const toggle = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  /** Renders a single nav item with optional sub-links. `compact` shrinks padding for nested sub-group items. */
  const renderNavItem = (item: NavItem, currentPath: string, compact = false) => {
    const Icon = item.icon;
    const active = currentPath === item.href || currentPath.startsWith(item.href + '/');
    const subActive = item.subLinks?.some(
      (s) => currentPath === s.href || currentPath.startsWith(s.href + '/')
    );

    return (
      <div key={item.href}>
        <Link
          href={item.href}
          className={cn(
            'flex items-center gap-3 rounded-lg text-sm font-medium transition-all relative group',
            compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2',
            active || subActive
              ? 'bg-brand-50 text-brand-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )}
        >
          {(active || subActive) && !compact && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-brand-500 rounded-r-full" />
          )}
          <Icon
            className={cn(
              compact ? 'w-4 h-4' : 'w-[18px] h-[18px]',
              'flex-shrink-0',
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
          <div className={cn(compact ? 'ml-7' : 'ml-9', 'mt-0.5 space-y-0.5')}>
            {item.subLinks.map((sub) => {
              const sActive = currentPath === sub.href || currentPath.startsWith(sub.href + '/');
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
  };

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
          const groupItems = group.items || [];
          const visibleItems = groupItems.filter(
            (item) => !item.superAdminOnly || isSuperAdmin
          );
          const hasSubGroups = !!group.subGroups;
          if (!hasSubGroups && visibleItems.length === 0) return null;

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
                {/* Regular flat items */}
                {!hasSubGroups && (
                  <div className="px-3 space-y-0.5 pb-1">
                    {visibleItems.map((item) => renderNavItem(item, pathname))}
                  </div>
                )}

                {/* Sub-grouped items (e.g. Q&A Bank) */}
                {hasSubGroups && (
                  <div className="px-2 pb-1 space-y-0.5">
                    {group.subGroups!.map((sg) => {
                      const sgOpen = openGroups[sg.key] ?? false;
                      const sgActive = isSubGroupActive(sg, pathname);
                      const SgIcon = sg.icon;

                      return (
                        <div key={sg.key}>
                          {/* Sub-group toggle header */}
                          <button
                            onClick={() => toggle(sg.key)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer',
                              sgActive
                                ? 'bg-brand-50/70 text-brand-700'
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            )}
                          >
                            <SgIcon
                              className={cn(
                                'w-4 h-4 flex-shrink-0',
                                sgActive ? 'text-brand-600' : 'text-slate-400'
                              )}
                              strokeWidth={sgActive ? 2.5 : 2}
                            />
                            {sg.label}
                            <ChevronRight
                              className={cn(
                                'w-3.5 h-3.5 ml-auto transition-transform duration-200',
                                sgActive ? 'text-brand-500' : 'text-slate-400',
                                sgOpen && 'rotate-90'
                              )}
                            />
                          </button>

                          {/* Sub-group children */}
                          <div
                            className={cn(
                              'overflow-hidden transition-all duration-200 ease-in-out',
                              sgOpen ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
                            )}
                          >
                            <div className="ml-3 pl-3 border-l border-slate-200 space-y-0.5 py-0.5">
                              {sg.items.map((item) => renderNavItem(item, pathname, true))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
