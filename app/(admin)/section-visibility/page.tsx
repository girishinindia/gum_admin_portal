"use client";
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import {
  Eye, EyeOff, GraduationCap, LayoutGrid, FileText, Video,
  Radio, Mic, MessageSquare, MonitorPlay, LifeBuoy, Package,
  Users, Star, HelpCircle, Mail, Award, Globe, BarChart3,
  Footprints, Sparkles, Megaphone,
} from 'lucide-react';

/* ── Types ── */
interface SectionSetting {
  id: number;
  section_key: string;
  label: string;
  description: string | null;
  is_visible: boolean;
  display_order: number;
  updated_at: string | null;
  updated_by: number | null;
}

/* ── Icon map ── */
const sectionIcons: Record<string, any> = {
  courses:         GraduationCap,
  categories:      LayoutGrid,
  blogs:           FileText,
  webinars:        Video,
  live_sessions:   MonitorPlay,
  podcasts:        Mic,
  discussions:     MessageSquare,
  live_classes:    Radio,
  support_tickets: LifeBuoy,
  bundles:         Package,
  instructors:     Users,
  student_reviews: Star,
  faq:             HelpCircle,
  newsletter:      Mail,
  certificate:     Award,
  languages:       Globe,
  stats:           BarChart3,
  how_it_works:    Footprints,
  features:        Sparkles,
  cta:             Megaphone,
};

const sectionColors: Record<string, string> = {
  courses:         'text-blue-500',
  categories:      'text-violet-500',
  blogs:           'text-orange-500',
  webinars:        'text-cyan-500',
  live_sessions:   'text-teal-500',
  podcasts:        'text-pink-500',
  discussions:     'text-emerald-500',
  live_classes:    'text-red-500',
  support_tickets: 'text-amber-500',
  bundles:         'text-indigo-500',
  instructors:     'text-green-600',
  student_reviews: 'text-yellow-500',
  faq:             'text-slate-500',
  newsletter:      'text-purple-500',
  certificate:     'text-sky-500',
  languages:       'text-lime-600',
  stats:           'text-rose-500',
  how_it_works:    'text-fuchsia-500',
  features:        'text-blue-600',
  cta:             'text-orange-600',
};

/* ── Toggle Switch ── */
function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${checked ? 'bg-brand-500' : 'bg-slate-300'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
}

/* ── Page ── */
export default function SectionVisibilityPage() {
  const [sections, setSections] = useState<SectionSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.listSiteSettings();
        setSections(res.data || []);
      } catch {
        toast.error('Failed to load section settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (section: SectionSetting) => {
    const newValue = !section.is_visible;
    setTogglingId(section.id);

    // Optimistic update
    setSections((prev) =>
      prev.map((s) => (s.id === section.id ? { ...s, is_visible: newValue } : s))
    );

    try {
      await api.updateSiteSettings(section.id, newValue);
      toast.success(`${section.label} is now ${newValue ? 'visible' : 'hidden'}`);
    } catch {
      // Revert on failure
      setSections((prev) =>
        prev.map((s) => (s.id === section.id ? { ...s, is_visible: !newValue } : s))
      );
      toast.error(`Failed to update ${section.label}`);
    } finally {
      setTogglingId(null);
    }
  };

  const visibleCount = sections.filter((s) => s.is_visible).length;
  const hiddenCount = sections.filter((s) => !s.is_visible).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Section Visibility"
        description="Control which sections are visible on the public website. Changes take effect within a few minutes."
      />

      {/* Stats */}
      {!loading && sections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Sections</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{sections.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-500" />
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Visible</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{visibleCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-slate-400" />
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Hidden</p>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-500">{hiddenCount}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section Cards */}
      {!loading && sections.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section) => {
            const Icon = sectionIcons[section.section_key] || LayoutGrid;
            const iconColor = sectionColors[section.section_key] || 'text-slate-500';

            return (
              <div
                key={section.id}
                className={`
                  rounded-xl border bg-white p-5 transition-all duration-200
                  ${section.is_visible
                    ? 'border-slate-200 shadow-sm'
                    : 'border-slate-100 bg-slate-50/50 opacity-75'}
                `}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`
                        flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                        ${section.is_visible ? 'bg-slate-100' : 'bg-slate-200/60'}
                      `}
                    >
                      <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-slate-800 truncate">
                        {section.label}
                      </h3>
                      {section.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {section.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Toggle
                    checked={section.is_visible}
                    disabled={togglingId === section.id}
                    onChange={() => handleToggle(section)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && sections.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <LayoutGrid className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm">No section settings found. Run the database migration first.</p>
        </div>
      )}
    </div>
  );
}
