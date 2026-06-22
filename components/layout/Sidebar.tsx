"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Users, Shield, KeyRound, Globe2, MapPin, Building2, Sparkles, Languages, FileText, GraduationCap, ShieldCheck, FolderOpen, FileImage, Award, Compass, Target, Share2, LayoutGrid, Layers, GitBranch, Network, Link2, ChevronDown, ChevronRight, BookOpen, BookMarked, FileQuestion, Video, Library, Tags, Package, FolderTree, Boxes, HelpCircle, ListChecks, PenLine, Replace, FileEdit, ListOrdered, PlusCircle, Settings, Database, Landmark, BookText, ClipboardList, PanelLeftClose, PanelLeftOpen, ClipboardCheck, Code2, Briefcase, Rocket, Calendar, Gift, Ticket, Percent, ShoppingCart, CreditCard, Receipt, TrendingUp, BarChart3, Trophy, Medal, Star, Bell, Wallet, Banknote, MessageSquare, Radio, ScrollText, Headphones, Megaphone, Mail, BellRing, Activity, Eye, Lightbulb, Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SubLink {
  href: string;
  label: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  iconColor?: string;
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
  icon?: any;
  iconColor?: string;
  items?: NavItem[];
  subGroups?: NavSubGroup[];
}

const navGroups: NavGroup[] = [
  {
    key: 'dashboards',
    title: 'Dashboards',
    icon: LayoutDashboard,
    iconColor: 'text-blue-600',
    items: [
      { href: '/dashboard',             label: 'Overview',           icon: LayoutDashboard, iconColor: 'text-blue-600' },
      { href: '/dashboards/sales',      label: 'Sales & Revenue',    icon: TrendingUp,      iconColor: 'text-emerald-600' },
      { href: '/dashboards/finance',    label: 'Payouts & Finance',  icon: Banknote,        iconColor: 'text-amber-600' },
      { href: '/dashboards/operations', label: 'Operations',         icon: Activity,        iconColor: 'text-rose-600' },
      { href: '/dashboards/catalog',    label: 'Catalog & Content',  icon: BookOpen,        iconColor: 'text-indigo-600' },
      { href: '/dashboards/engagement', label: 'Student Engagement', icon: Star,            iconColor: 'text-violet-600' },
      { href: '/revenue-dashboard',     label: 'Revenue (live MV)',  icon: BarChart3,       iconColor: 'text-cyan-600' },
      { href: '/platform-revenue',      label: 'Platform Revenue',   icon: Banknote,        iconColor: 'text-green-600' },
    ],
  },
  {
    key: 'admin',
    title: 'Admin',
    icon: Settings,
    iconColor: 'text-violet-500',
    items: [
      { href: '/my-permissions',  label: 'My Access',     icon: ShieldCheck, iconColor: 'text-emerald-500' },
      { href: '/users',           label: 'Users',         icon: Users,      iconColor: 'text-blue-500' },
      { href: '/instructor-profiles', label: 'Instructor Profiles', icon: GraduationCap, iconColor: 'text-orange-500' },
      { href: '/roles',           label: 'Roles',         icon: Shield,     iconColor: 'text-amber-500', superAdminOnly: true },
      { href: '/permissions',     label: 'Permissions',   icon: KeyRound,   iconColor: 'text-rose-500',  superAdminOnly: true },
      { href: '/activity-logs',   label: 'Activity Logs', icon: FileText,   iconColor: 'text-violet-500' },
      { href: '/scheduled-jobs',  label: 'Scheduled Jobs', icon: Calendar,  iconColor: 'text-teal-500' },
    ],
  },
  {
    key: 'master',
    title: 'Master',
    icon: Database,
    iconColor: 'text-amber-500',
    items: [
      { href: '/countries',        label: 'Countries',        icon: Globe2,        iconColor: 'text-blue-500' },
      { href: '/states',           label: 'States',           icon: MapPin,        iconColor: 'text-emerald-500' },
      { href: '/cities',           label: 'Cities',           icon: Building2,     iconColor: 'text-violet-500' },
      { href: '/skills',           label: 'Skills',           icon: Sparkles,      iconColor: 'text-amber-500' },
      { href: '/languages',        label: 'Languages',        icon: Languages,     iconColor: 'text-cyan-500' },
      { href: '/education-levels', label: 'Education Levels', icon: GraduationCap, iconColor: 'text-indigo-500' },
      { href: '/document-types',   label: 'Document Types',   icon: FolderOpen,    iconColor: 'text-orange-500' },
      { href: '/documents',        label: 'Documents',        icon: FileImage,     iconColor: 'text-pink-500' },
      { href: '/designations',     label: 'Designations',     icon: Award,   iconColor: 'text-yellow-500' },
      { href: '/specializations',  label: 'Specializations',  icon: Compass, iconColor: 'text-teal-500' },
      { href: '/learning-goals',   label: 'Learning Goals',   icon: Target,  iconColor: 'text-red-500' },
      { href: '/social-medias',    label: 'Social Media',     icon: Share2,  iconColor: 'text-sky-500' },
      {
        href: '/categories',
        label: 'Categories',
        icon: LayoutGrid,
        iconColor: 'text-purple-500',
        subLinks: [{ href: '/category-translations', label: 'Translations' }],
      },
      {
        href: '/sub-categories',
        label: 'Sub-Categories',
        icon: Layers,
        iconColor: 'text-lime-600',
        subLinks: [{ href: '/sub-category-translations', label: 'Translations' }],
      },
    ],
  },
  {
    key: 'branch',
    title: 'Branch & Departments',
    icon: Landmark,
    iconColor: 'text-rose-500',
    items: [
      { href: '/branches',            label: 'Branches',             icon: GitBranch, iconColor: 'text-emerald-500' },
      { href: '/departments',         label: 'Departments',          icon: Network,   iconColor: 'text-blue-500' },
      { href: '/branch-departments',  label: 'Branch & Departments', icon: Link2,     iconColor: 'text-violet-500' },
    ],
  },
  {
    key: 'material',
    title: 'Material Management',
    icon: BookText,
    iconColor: 'text-emerald-500',
    items: [
      {
        href: '/subjects',
        label: 'Subjects',
        icon: BookOpen,
        iconColor: 'text-blue-500',
        subLinks: [{ href: '/subject-translations', label: 'Translations' }],
      },
      {
        href: '/chapters',
        label: 'Chapters',
        icon: BookMarked,
        iconColor: 'text-violet-500',
        subLinks: [{ href: '/chapter-translations', label: 'Translations' }],
      },
      {
        href: '/topics',
        label: 'Topics',
        icon: FileQuestion,
        iconColor: 'text-amber-500',
        subLinks: [{ href: '/topic-translations', label: 'Translations' }],
      },
      {
        href: '/sub-topics',
        label: 'Sub-Topics',
        icon: FileQuestion,
        iconColor: 'text-teal-500',
        subLinks: [{ href: '/sub-topic-translations', label: 'Translations' }],
      },
      {
        href: '/auto-sub-topics',
        label: 'Auto Sub-Topics',
        icon: Sparkles,
        iconColor: 'text-yellow-500',
      },
      {
        href: '/auto-video-upload',
        label: 'Auto Video Upload',
        icon: Video,
        iconColor: 'text-red-500',
      },
      {
        href: '/youtube-descriptions',
        label: 'YouTube Descriptions',
        icon: Video,
        iconColor: 'text-rose-500',
      },
      {
        href: '/material-tree',
        label: 'Material Tree',
        iconColor: 'text-emerald-500',
        icon: FolderOpen,
      },
    ],
  },
  {
    key: 'course',
    title: 'Course Management',
    icon: GraduationCap,
    iconColor: 'text-blue-500',
    items: [
      {
        href: '/course-builder',
        label: 'Instructor Courses',
        icon: Sparkles,
        iconColor: 'text-violet-500',
      },
      {
        href: '/courses',
        label: 'Courses',
        icon: Library,
        iconColor: 'text-indigo-500',
        subLinks: [{ href: '/course-translations', label: 'Translations' }],
      },
      {
        href: '/course-sub-categories',
        label: 'Course Categories',
        icon: Tags,
        iconColor: 'text-pink-500',
      },
      {
        href: '/course-modules',
        label: 'Course Modules',
        icon: Package,
        iconColor: 'text-amber-500',
        subLinks: [{ href: '/course-module-translations', label: 'Translations' }],
      },
      {
        href: '/course-structure',
        label: 'Course Structure',
        icon: FolderTree,
        iconColor: 'text-teal-500',
      },
      {
        href: '/bundles',
        label: 'Bundles',
        icon: Boxes,
        iconColor: 'text-purple-500',
        subLinks: [
          { href: '/bundle-translations', label: 'Translations' },
          { href: '/bundle-courses', label: 'Courses' },
        ],
      },
      {
        href: '/course-batches',
        label: 'Batch Management',
        icon: Calendar,
        iconColor: 'text-rose-500',
        subLinks: [
          { href: '/batch-translations', label: 'Translations' },
        ],
      },
    ],
  },
  {
    key: 'qa',
    title: 'Q&A Bank',
    icon: ClipboardList,
    iconColor: 'text-orange-500',
    items: [
      {
        href: '/qa-viewer',
        label: 'Browse Q&A',
        icon: BookOpen,
        iconColor: 'text-cyan-500',
      },
    ],
    subGroups: [
      {
        key: 'qa-mcq',
        label: 'MCQ',
        icon: HelpCircle,
        items: [
          {
            href: '/create-mcq',
            label: 'MCQ Q&A',
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
            label: 'One Word Q&A',
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
            label: 'Descriptive Q&A',
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
            label: 'Matching Q&A',
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
            label: 'Ordering Q&A',
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
  {
    key: 'assessments',
    title: 'Assessments',
    icon: ClipboardCheck,
    iconColor: 'text-purple-500',
    items: [
      { href: '/exercises', label: 'Exercises', icon: Code2, iconColor: 'text-green-500' },
      { href: '/mini-projects', label: 'Mini Projects', icon: Package, iconColor: 'text-orange-500' },
      { href: '/capstone-projects', label: 'Capstone Projects', icon: GraduationCap, iconColor: 'text-purple-500' },
    ],
  },
  {
    key: 'webinar-management',
    title: 'Webinar Management',
    icon: Video,
    iconColor: 'text-rose-500',
    items: [
      {
        href: '/webinars',
        label: 'Webinars',
        icon: Video,
        iconColor: 'text-rose-500',
        subLinks: [
          { href: '/webinar-translations', label: 'Translations' },
        ],
      },
    ],
  },
  {
    key: 'discussion-qa',
    title: 'Discussion & Q&A',
    icon: MessageSquare,
    iconColor: 'text-teal-500',
    items: [
      { href: '/discussions', label: 'Discussion Forums', icon: MessageSquare, iconColor: 'text-teal-500' },
    ],
  },
  {
    key: 'live-classes',
    title: 'Live Classes',
    icon: Radio,
    iconColor: 'text-rose-500',
    items: [
      { href: '/live-classes', label: 'Live Sessions', icon: Radio, iconColor: 'text-rose-500' },
    ],
  },
  {
    key: 'podcasts',
    title: 'Podcasts',
    icon: Headphones,
    iconColor: 'text-purple-500',
    items: [
      { href: '/podcasts', label: 'Podcasts', icon: Headphones, iconColor: 'text-purple-500' },
    ],
  },
  {
    key: 'faqs-blog',
    title: 'FAQs & Blog',
    icon: HelpCircle,
    iconColor: 'text-cyan-500',
    items: [
      { href: '/faqs', label: 'FAQ Management', icon: HelpCircle, iconColor: 'text-cyan-500' },
      { href: '/blog', label: 'Blog Management', icon: FileEdit, iconColor: 'text-violet-500' },
    ],
  },
  {
    key: 'policies',
    title: 'Policy Management',
    icon: ScrollText,
    iconColor: 'text-teal-500',
    items: [
      { href: '/policies', label: 'Policies', icon: ScrollText, iconColor: 'text-teal-500' },
    ],
  },
  {
    key: 'support-tickets',
    title: 'Support Tickets',
    icon: Headphones,
    iconColor: 'text-pink-500',
    items: [
      { href: '/support-tickets', label: 'Support Tickets', icon: Headphones, iconColor: 'text-pink-500' },
    ],
  },
  {
    key: 'referral-coupons',
    title: 'Referral & Coupons',
    icon: Gift,
    iconColor: 'text-amber-500',
    items: [
      { href: '/referral-management', label: 'Referral Management', icon: Share2, iconColor: 'text-amber-500' },
      { href: '/coupon-management', label: 'Coupon Management', icon: Ticket, iconColor: 'text-amber-500' },
    ],
  },
  {
    key: 'promotion-management',
    title: 'Promotion Management',
    icon: Percent,
    iconColor: 'text-emerald-500',
    items: [
      { href: '/instructor-promotions', label: 'Instructor Promotions', icon: Percent, iconColor: 'text-emerald-500' },
    ],
  },
  {
    key: 'enrollment-orders',
    title: 'Enrollment & Orders',
    icon: ShoppingCart,
    iconColor: 'text-indigo-500',
    items: [
      { href: '/orders', label: 'Orders', icon: ShoppingCart, iconColor: 'text-indigo-500' },
      { href: '/payment-management', label: 'Payments & Transactions', icon: CreditCard, iconColor: 'text-emerald-500' },
      { href: '/enrollments', label: 'Enrollments', icon: GraduationCap, iconColor: 'text-blue-500' },
      { href: '/wishlists', label: 'Wishlists', icon: Star, iconColor: 'text-rose-500' },
      { href: '/invoice-management', label: 'Invoices & Refunds', icon: Receipt, iconColor: 'text-amber-500' },
      { href: '/revenue-dashboard', label: 'Revenue Dashboard', icon: TrendingUp, iconColor: 'text-rose-500' },
      { href: '/student-progress', label: 'Student Progress', icon: BarChart3, iconColor: 'text-violet-500' },
    ],
  },
  {
    key: 'notifications',
    title: 'Notifications',
    icon: Bell,
    iconColor: 'text-cyan-500',
    items: [
      { href: '/notifications', label: 'Notifications', icon: Bell, iconColor: 'text-cyan-500' },
      { href: '/email-templates', label: 'Email Templates', icon: Mail, iconColor: 'text-cyan-500' },
      { href: '/notification-preferences', label: 'Preferences', icon: BellRing, iconColor: 'text-cyan-500' },
    ],
  },
  {
    key: 'idea-reward',
    title: 'Idea & Reward',
    icon: Lightbulb,
    iconColor: 'text-yellow-500',
    items: [
      { href: '/ideas', label: 'Idea Management', icon: Lightbulb, iconColor: 'text-yellow-500' },
      { href: '/idea-categories', label: 'Idea Categories', icon: FolderTree, iconColor: 'text-amber-500' },
    ],
  },
  {
    key: 'instructor-payouts',
    title: 'Instructor Payouts',
    icon: Banknote,
    iconColor: 'text-emerald-500',
    items: [
      { href: '/instructor-earnings', label: 'Instructor Earnings', icon: Wallet, iconColor: 'text-amber-500' },
      { href: '/instructor-payouts', label: 'Payout Management', icon: Banknote, iconColor: 'text-emerald-500' },
      { href: '/revenue-share-tiers', label: 'Revenue Share Tiers', icon: Percent, iconColor: 'text-violet-500' },
    ],
  },
  {
    key: 'certificates-badges',
    title: 'Certificates & Badges',
    icon: Award,
    iconColor: 'text-amber-500',
    items: [
      { href: '/certificate-templates', label: 'Certificate Templates', icon: GraduationCap, iconColor: 'text-emerald-500' },
      { href: '/issued-certificates', label: 'Issued Certificates', icon: Award, iconColor: 'text-amber-500' },
      { href: '/badges', label: 'Badges', icon: Trophy, iconColor: 'text-yellow-500' },
      { href: '/user-badges', label: 'User Badges', icon: Medal, iconColor: 'text-purple-500' },
    ],
  },
  {
    key: 'reviews-ratings',
    title: 'Reviews & Ratings',
    icon: Star,
    iconColor: 'text-yellow-500',
    items: [
      { href: '/reviews', label: 'Reviews', icon: Star, iconColor: 'text-yellow-500' },
    ],
  },
  {
    key: 'chat-system',
    title: 'Chat System',
    icon: MessageSquare,
    iconColor: 'text-cyan-500',
    items: [
      { href: '/chat-management', label: 'Chat Management', icon: MessageSquare, iconColor: 'text-cyan-500' },
      { href: '/chat-monitoring', label: 'Chat Monitor', icon: Activity, iconColor: 'text-cyan-500' },
    ],
  },
  {
    key: 'announcements',
    title: 'Announcements',
    icon: Megaphone,
    iconColor: 'text-orange-500',
    items: [
      { href: '/announcements', label: 'Announcements', icon: Megaphone, iconColor: 'text-orange-500' },
    ],
  },
  {
    key: 'wallet-management',
    title: 'Wallet Management',
    icon: Wallet,
    iconColor: 'text-indigo-500',
    items: [
      { href: '/wallet-management', label: 'Wallet Management', icon: Wallet, iconColor: 'text-indigo-500' },
    ],
  },
  {
    key: 'site-settings',
    title: 'Site Settings',
    icon: Settings,
    iconColor: 'text-slate-600',
    items: [
      { href: '/section-visibility', label: 'Section Visibility', icon: Eye, iconColor: 'text-sky-500', superAdminOnly: true },
      { href: '/team-members', label: 'Team Members', icon: Users, iconColor: 'text-emerald-500' },
    ],
  },
  {
    key: 'careers',
    title: 'Careers',
    icon: Briefcase,
    iconColor: 'text-teal-600',
    items: [
      { href: '/job-positions', label: 'Job Positions', icon: Briefcase, iconColor: 'text-teal-600' },
      { href: '/job-applications', label: 'Applications', icon: FileText, iconColor: 'text-indigo-500' },
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
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matchesQuery = (text: string) => q === '' || (text || '').toLowerCase().includes(q);

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
  const renderNavItem = (item: NavItem, currentPath: string, compact = false, idx = 0) => {
    const Icon = item.icon;
    const active = currentPath === item.href || currentPath.startsWith(item.href + '/');
    const subActive = item.subLinks?.some(
      (s) => currentPath === s.href || currentPath.startsWith(s.href + '/')
    );
    const isEven = idx % 2 === 0;

    return (
      <div key={item.href} className="relative">
        {/* Horizontal tree branch line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 border-t-2 border-brand-300/60" />
        <Link
          href={item.href}
          className={cn(
            'flex items-center gap-2.5 ml-3 rounded-md text-sm font-medium transition-all relative group',
            compact ? 'px-2 py-1' : 'px-2.5 py-1',
            active || subActive
              ? 'bg-white/80 text-brand-800 shadow-sm'
              : isEven
                ? 'text-slate-700 hover:bg-white/50 hover:text-slate-900 bg-white/25'
                : 'text-slate-700 hover:bg-white/50 hover:text-slate-900'
          )}
        >
          {(active || subActive) && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-brand-600 rounded-r-full" />
          )}
          <Icon
            className={cn(
              'w-[16px] h-[16px]',
              'flex-shrink-0',
              (active || subActive) ? 'text-brand-600' : (item.iconColor || 'text-brand-500/60')
            )}
            strokeWidth={active || subActive ? 2.5 : 2}
          />
          <span className="truncate">{item.label}</span>
          {item.superAdminOnly && (
            <span className="ml-auto flex-shrink-0 text-[9px] font-bold text-brand-600 tracking-wider">
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
                      ? 'text-brand-800 bg-white/60'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
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
    <aside className={cn(
      'bg-gradient-to-b from-white via-sky-50/60 to-brand-50/80 border-r border-brand-200 flex flex-col h-screen sticky top-0 transition-all duration-300',
      collapsed ? 'w-16' : 'w-72'
    )}>
      {/* Brand */}
      <div className={cn('h-16 flex items-center border-b border-brand-200/80', collapsed ? 'px-3 justify-center' : 'px-5')}>
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 rounded-xl flex items-center justify-center shadow-brand group-hover:scale-105 transition-transform relative overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.3),transparent_50%)]" />
            <GraduationCap className="w-5 h-5 text-white relative" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div>
              <div className="font-display font-bold text-brand-900 leading-none text-[15px]">Grow Up More</div>
              <div className="text-[10px] text-brand-600 mt-0.5 tracking-wider uppercase font-semibold">Admin Panel</div>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden pb-2">
        {!collapsed && (
          <div className="px-3 pt-3 pb-1 sticky top-0 z-10 bg-gradient-to-b from-white via-white to-transparent">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search menu…"
                className="w-full h-8 pl-8 pr-7 text-xs rounded-lg border border-brand-200 bg-white/80 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 placeholder:text-slate-400"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
        {/* Phase 14.10 — the standalone "Dashboard" link used to live here,
            but it duplicated the "Dashboards" group below. The command-center
            page (/dashboard) is now the "Overview" entry inside the
            Dashboards group, so the two no longer fight for visual space. */}

        {navGroups.map((group, groupIdx) => {
          const groupItems = group.items || [];
          const permittedItems = groupItems.filter(
            (item) => !item.superAdminOnly || isSuperAdmin
          );
          const groupTitleMatch = matchesQuery(group.title);
          // Menu-search filter: match the group title, an item label, or a sub-link label.
          const visibleItems = q
            ? permittedItems.filter((item) => groupTitleMatch || matchesQuery(item.label) || (item.subLinks?.some((s) => matchesQuery(s.label)) ?? false))
            : permittedItems;
          const visibleSubGroups = (group.subGroups || [])
            .map((sg) => ({
              sg,
              items: q ? sg.items.filter((item) => groupTitleMatch || matchesQuery(sg.label) || matchesQuery(item.label)) : sg.items,
            }))
            .filter((x) => !q || groupTitleMatch || matchesQuery(x.sg.label) || x.items.length > 0);
          const hasSubGroups = visibleSubGroups.length > 0;
          // Under an active query, hide groups with no matches anywhere.
          if (q && !groupTitleMatch && visibleItems.length === 0 && visibleSubGroups.length === 0) return null;
          if (!hasSubGroups && visibleItems.length === 0) return null;

          const isOpen = q ? true : (openGroups[group.key] ?? false);
          const groupActive = isGroupActive(group, pathname);

          if (collapsed) {
            // Collapsed mode: show only the group icon
            const GroupIconC = group.icon;
            return (
              <div key={group.key} className="px-2 pt-1">
                <button
                  onClick={() => setCollapsed(false)}
                  title={group.title}
                  className={cn(
                    'w-full flex items-center justify-center py-2 rounded-lg cursor-pointer transition-colors',
                    groupActive ? 'bg-white/70 text-brand-700 shadow-sm' : 'text-brand-500 hover:bg-white/50 hover:text-brand-700'
                  )}
                >
                  {GroupIconC && <GroupIconC className={cn('w-5 h-5', groupActive ? 'text-brand-600' : (group.iconColor || 'text-brand-400'))} strokeWidth={1.8} />}
                </button>
              </div>
            );
          }

          return (
            <div key={group.key}>
              {/* Collapsible group header */}
              <button
                onClick={() => toggle(group.key)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-5 pt-3 pb-1 group/header cursor-pointer',
                  'hover:bg-white/30 transition-colors'
                )}
              >
                <span
                  className={cn(
                    'text-sm font-semibold transition-colors flex items-center gap-2 min-w-0',
                    groupActive ? 'text-slate-800' : 'text-slate-500 group-hover/header:text-slate-700'
                  )}
                >
                  {group.icon && (() => { const GroupIcon = group.icon; return <GroupIcon className={cn('w-[18px] h-[18px] flex-shrink-0', group.iconColor || 'text-brand-500')} strokeWidth={1.8} />; })()}
                  <span className="truncate">{group.title}</span>
                </span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200',
                    groupActive ? 'text-brand-600' : 'text-brand-400',
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
                {/* Regular flat items (shown above subGroups if both exist) */}
                {visibleItems.length > 0 && (
                  <div className="ml-6 mr-3 pl-3 border-l-2 border-brand-300/60 space-y-0.5 pb-1">
                    {visibleItems.map((item, idx) => renderNavItem(item, pathname, false, idx))}
                  </div>
                )}

                {/* Sub-grouped items (e.g. Q&A Bank) */}
                {hasSubGroups && (
                  <div className="ml-6 mr-2 pl-3 border-l-2 border-brand-300/60 pb-1 space-y-0.5">
                    {visibleSubGroups.map(({ sg, items: sgItems }) => {
                      const sgOpen = q ? true : (openGroups[sg.key] ?? false);
                      const sgActive = isSubGroupActive(sg, pathname);
                      const SgIcon = sg.icon;

                      return (
                        <div key={sg.key} className="relative">
                          {/* Horizontal tree branch for sub-group header */}
                          <div className="absolute left-0 top-5 w-3 border-t-2 border-brand-300/60" />
                          {/* Sub-group toggle header */}
                          <button
                            onClick={() => toggle(sg.key)}
                            className={cn(
                              'w-full flex items-center gap-2.5 ml-3 px-2.5 py-1 rounded-md text-sm font-semibold transition-all cursor-pointer',
                              sgActive
                                ? 'bg-white/70 text-brand-800 shadow-sm'
                                : 'text-slate-600 hover:bg-white/40 hover:text-slate-800'
                            )}
                          >
                            <SgIcon
                              className={cn(
                                'w-[16px] h-[16px] flex-shrink-0',
                                sgActive ? 'text-brand-600' : 'text-brand-500/60'
                              )}
                              strokeWidth={sgActive ? 2.5 : 2}
                            />
                            <span className="truncate">{sg.label}</span>
                            <ChevronRight
                              className={cn(
                                'w-3.5 h-3.5 ml-auto flex-shrink-0 transition-transform duration-200',
                                sgActive ? 'text-brand-600' : 'text-brand-400',
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
                            <div className="ml-6 pl-3 border-l-2 border-brand-300/60 space-y-0.5 py-0.5">
                              {sgItems.map((item, idx) => renderNavItem(item, pathname, true, idx))}
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

      {/* Collapse toggle */}
      <div className={cn('border-t border-brand-200/60', collapsed ? 'p-2' : 'px-4 py-3')}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center gap-2 rounded-lg text-brand-500 hover:text-brand-700 hover:bg-white/50 transition-colors cursor-pointer',
            collapsed ? 'w-full justify-center p-2' : 'px-3 py-1.5 w-full'
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.8} />
          ) : (
            <>
              <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.8} />
              <span className="text-xs font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
