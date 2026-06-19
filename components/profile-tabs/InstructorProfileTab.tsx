"use client";
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Save, Loader2, UserCheck, BarChart3, DollarSign, ShieldCheck,
  Building2, GraduationCap, CalendarClock, FileText,
} from 'lucide-react';

interface InstructorProfileTabProps {
  userId: number;
  canEdit: boolean;
}

interface Opt { id: number; name?: string; english_name?: string; title?: string; code?: string; }
const optLabel = (o: Opt) => o.name || o.english_name || o.title || o.code || `#${o.id}`;
const toOptions = (rows: Opt[]) => [
  { value: '', label: 'Select...' },
  ...rows.map((o) => ({ value: String(o.id), label: optLabel(o) })),
];

const textareaClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition-colors ' +
  'focus:border-brand-500 focus:ring-1 focus:ring-brand-500 placeholder:text-slate-400 disabled:bg-slate-50';

export default function InstructorProfileTab({ userId, canEdit }: InstructorProfileTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // FK dropdown data
  const [designations, setDesignations] = useState<Opt[]>([]);
  const [departments, setDepartments] = useState<Opt[]>([]);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [specializations, setSpecializations] = useState<Opt[]>([]);
  const [languages, setLanguages] = useState<Opt[]>([]);

  const { register, handleSubmit, reset, watch } = useForm();
  const approvalStatus = watch('approval_status');

  const loadLists = useCallback(async () => {
    const safe = async (fn: () => Promise<any>) => { try { const r = await fn(); return (r?.data ?? []) as Opt[]; } catch { return []; } };
    const [d, dep, br, sp, lang] = await Promise.all([
      safe(() => api.listDesignations('?limit=500')),
      safe(() => api.listDepartments('?limit=500')),
      safe(() => api.listBranches('?limit=500')),
      safe(() => api.listSpecializations('?limit=500')),
      safe(() => api.listLanguages('?limit=500')),
    ]);
    setDesignations(d); setDepartments(dep); setBranches(br); setSpecializations(sp); setLanguages(lang);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const profileRes = await api.getInstructorProfileByUserId(userId).catch(() => null);
      const p = profileRes?.data || null;
      setProfile(p);

      const numOrEmpty = (v: any) => (v === null || v === undefined ? '' : v);
      const idOrEmpty = (v: any) => (v === null || v === undefined ? '' : String(v));

      if (p) {
        reset({
          // Identity
          instructor_code: p.instructor_code || '',
          instructor_type: p.instructor_type || '',
          // Organization
          designation_id: idOrEmpty(p.designation_id),
          department_id: idOrEmpty(p.department_id),
          branch_id: idOrEmpty(p.branch_id),
          joining_date: p.joining_date || '',
          // Teaching info
          specialization_id: idOrEmpty(p.specialization_id),
          secondary_specialization_id: idOrEmpty(p.secondary_specialization_id),
          teaching_mode: p.teaching_mode || '',
          preferred_teaching_language_id: idOrEmpty(p.preferred_teaching_language_id),
          teaching_experience_years: numOrEmpty(p.teaching_experience_years),
          industry_experience_years: numOrEmpty(p.industry_experience_years),
          total_experience_years: numOrEmpty(p.total_experience_years),
          total_teaching_hours: numOrEmpty(p.total_teaching_hours),
          highest_qualification: p.highest_qualification || '',
          // Availability
          is_available: p.is_available ?? false,
          available_hours_per_week: numOrEmpty(p.available_hours_per_week),
          available_from: p.available_from || '',
          available_until: p.available_until || '',
          preferred_time_slots: p.preferred_time_slots || '',
          max_concurrent_courses: numOrEmpty(p.max_concurrent_courses),
          // Compensation
          payment_model: p.payment_model || '',
          revenue_share_percentage: numOrEmpty(p.revenue_share_percentage),
          payment_currency: p.payment_currency || 'INR',
          fixed_rate_per_course: numOrEmpty(p.fixed_rate_per_course),
          hourly_rate: numOrEmpty(p.hourly_rate),
          // Bio & media
          tagline: p.tagline || '',
          instructor_bio: p.instructor_bio || '',
          demo_video_url: p.demo_video_url || '',
          intro_video_duration_sec: numOrEmpty(p.intro_video_duration_sec),
          certifications_summary: p.certifications_summary || '',
          awards_and_recognition: p.awards_and_recognition || '',
          // Performance metrics (admin-editable)
          total_courses_created: numOrEmpty(p.total_courses_created),
          total_courses_published: numOrEmpty(p.total_courses_published),
          total_students_taught: numOrEmpty(p.total_students_taught),
          completion_rate: numOrEmpty(p.completion_rate),
          total_content_minutes: numOrEmpty(p.total_content_minutes),
          patents_count: numOrEmpty(p.patents_count),
          publications_count: numOrEmpty(p.publications_count),
          // Approval
          approval_status: p.approval_status || 'pending',
          badge: p.badge || '',
          is_verified: p.is_verified ?? false,
          is_featured: p.is_featured ?? false,
          rejection_reason: p.rejection_reason || '',
        });
      } else {
        reset({ payment_currency: 'INR', approval_status: 'pending', is_available: false });
      }
    } catch (err) {
      console.error('Failed to load instructor profile:', err);
      toast.error('Failed to load instructor profile');
    } finally {
      setLoading(false);
    }
  }, [userId, reset]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { fetchData(); }, [fetchData]);

  function rangeError(formData: any): string | null {
    const yr = (k: string, label: string) => {
      const raw = formData[k];
      if (raw === '' || raw == null) return null;
      const v = Number(raw);
      if (Number.isNaN(v) || v < 0 || v > 80) return `${label} must be between 0 and 80`;
      return null;
    };
    for (const [k, label] of [
      ['teaching_experience_years', 'Teaching Experience'],
      ['industry_experience_years', 'Industry Experience'],
      ['total_experience_years', 'Total Experience'],
    ] as [string, string][]) { const e = yr(k, label); if (e) return e; }

    if (formData.available_hours_per_week !== '' && formData.available_hours_per_week != null) {
      const v = Number(formData.available_hours_per_week);
      if (Number.isNaN(v) || v < 0 || v > 168) return 'Hours/Week must be between 0 and 168';
    }
    if (formData.completion_rate !== '' && formData.completion_rate != null) {
      const v = Number(formData.completion_rate);
      if (Number.isNaN(v) || v < 0 || v > 100) return 'Completion Rate must be between 0 and 100';
    }
    if (formData.available_from && formData.available_until && formData.available_until < formData.available_from) {
      return 'Available Until must be on or after Available From';
    }
    return null;
  }

  async function onSubmit(formData: any) {
    if (!canEdit) return;

    if (!formData.instructor_code || String(formData.instructor_code).trim() === '') {
      toast.error('Instructor Code is required'); return;
    }
    if (!formData.instructor_type || formData.instructor_type === '') {
      toast.error('Instructor Type is required'); return;
    }
    if (formData.revenue_share_percentage !== '' && formData.revenue_share_percentage != null) {
      const rs = Number(formData.revenue_share_percentage);
      if (Number.isNaN(rs) || rs < 0 || rs > 100) { toast.error('Revenue Share % must be between 0 and 100'); return; }
    }
    if (formData.hourly_rate !== '' && formData.hourly_rate != null) {
      const hr = Number(formData.hourly_rate);
      if (Number.isNaN(hr) || hr < 0) { toast.error('Hourly Rate must be 0 or greater'); return; }
    }
    if (formData.fixed_rate_per_course !== '' && formData.fixed_rate_per_course != null) {
      const fr = Number(formData.fixed_rate_per_course);
      if (Number.isNaN(fr) || fr < 0) { toast.error('Fixed Rate per Course must be 0 or greater'); return; }
    }
    const rErr = rangeError(formData);
    if (rErr) { toast.error(rErr); return; }

    setSaving(true);
    try {
      const cleaned: any = {};
      for (const [k, v] of Object.entries(formData)) {
        cleaned[k] = (v === '' || v === undefined) ? null : v;
      }
      // Booleans (checkboxes)
      cleaned.is_verified = !!formData.is_verified;
      cleaned.is_featured = !!formData.is_featured;
      cleaned.is_available = !!formData.is_available;
      // The API coerces numeric/id strings server-side.

      await api.upsertInstructorProfile(userId, cleaned);
      toast.success('Instructor profile saved');
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save instructor profile');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
    );
  }

  const SectionTitle = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" /> {children}
    </h3>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-500" /> Instructor Profile
          </h2>
          {canEdit && (
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
        <CardContent className="p-5 space-y-5">

          {/* Identity */}
          <div>
            <SectionTitle icon={UserCheck}>Identity</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Instructor Code" {...register('instructor_code', { required: true })} placeholder="e.g. INS-001" disabled={!canEdit} />
              <Select label="Instructor Type" {...register('instructor_type')} disabled={!canEdit}
                options={[
                  { value: '', label: 'Select...' }, { value: 'internal', label: 'Internal' }, { value: 'external', label: 'External' },
                  { value: 'guest', label: 'Guest' }, { value: 'visiting', label: 'Visiting' }, { value: 'corporate', label: 'Corporate' },
                  { value: 'community', label: 'Community' }, { value: 'other', label: 'Other' },
                ]}
              />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Organization */}
          <div>
            <SectionTitle icon={Building2}>Organization</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select label="Designation" {...register('designation_id')} disabled={!canEdit} options={toOptions(designations)} />
              <Select label="Department" {...register('department_id')} disabled={!canEdit} options={toOptions(departments)} />
              <Select label="Branch" {...register('branch_id')} disabled={!canEdit} options={toOptions(branches)} />
              <Input label="Joining Date" type="date" {...register('joining_date')} disabled={!canEdit} />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Teaching info */}
          <div>
            <SectionTitle icon={GraduationCap}>Teaching Info</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select label="Specialization" {...register('specialization_id')} disabled={!canEdit} options={toOptions(specializations)} />
              <Select label="Secondary Specialization" {...register('secondary_specialization_id')} disabled={!canEdit} options={toOptions(specializations)} />
              <Select label="Teaching Mode" {...register('teaching_mode')} disabled={!canEdit}
                options={[
                  { value: '', label: 'Select...' }, { value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' },
                  { value: 'hybrid', label: 'Hybrid' }, { value: 'blended', label: 'Blended' },
                ]}
              />
              <Input label="Teaching Exp (yrs)" type="number" {...register('teaching_experience_years')} disabled={!canEdit} />
              <Input label="Industry Exp (yrs)" type="number" {...register('industry_experience_years')} disabled={!canEdit} />
              <Input label="Total Exp (yrs)" type="number" {...register('total_experience_years')} disabled={!canEdit} />
              <Select label="Teaching Language" {...register('preferred_teaching_language_id')} disabled={!canEdit} options={toOptions(languages)} />
              <Input label="Total Teaching Hours" type="number" {...register('total_teaching_hours')} disabled={!canEdit} />
              <Input label="Highest Qualification" {...register('highest_qualification')} disabled={!canEdit} placeholder="e.g. M.Tech" />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Availability */}
          <div>
            <SectionTitle icon={CalendarClock}>Availability</SectionTitle>
            <label className="flex items-center gap-2 text-sm text-slate-700 mb-3">
              <input type="checkbox" {...register('is_available')} disabled={!canEdit} className="rounded border-slate-300" /> Currently Available
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Hours/Week" type="number" {...register('available_hours_per_week')} disabled={!canEdit} />
              <Input label="Available From" type="date" {...register('available_from')} disabled={!canEdit} />
              <Input label="Available Until" type="date" {...register('available_until')} disabled={!canEdit} />
              <Input label="Preferred Time Slots" {...register('preferred_time_slots')} disabled={!canEdit} placeholder="e.g. Mon-Fri 9-5" />
              <Input label="Max Concurrent Courses" type="number" {...register('max_concurrent_courses')} disabled={!canEdit} />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Compensation */}
          <div>
            <SectionTitle icon={DollarSign}>Compensation</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select label="Payment Model" {...register('payment_model')} disabled={!canEdit}
                options={[
                  { value: '', label: 'Select...' }, { value: 'revenue_share', label: 'Revenue Share' },
                  { value: 'fixed_per_course', label: 'Fixed per Course' }, { value: 'hourly', label: 'Hourly' },
                  { value: 'monthly_salary', label: 'Monthly Salary' }, { value: 'per_student', label: 'Per Student' },
                  { value: 'hybrid', label: 'Hybrid' }, { value: 'volunteer', label: 'Volunteer' }, { value: 'other', label: 'Other' },
                ]}
              />
              <Input label="Revenue Share %" type="number" {...register('revenue_share_percentage')} disabled={!canEdit} placeholder="e.g. 30" />
              <Input label="Currency" {...register('payment_currency')} disabled={!canEdit} placeholder="INR" />
              <Input label="Fixed Rate/Course" type="number" {...register('fixed_rate_per_course')} disabled={!canEdit} />
              <Input label="Hourly Rate" type="number" {...register('hourly_rate')} disabled={!canEdit} />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Bio & media */}
          <div>
            <SectionTitle icon={FileText}>Bio &amp; Media</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Tagline" {...register('tagline')} disabled={!canEdit} placeholder="One-line headline" />
              <Input label="Demo Video URL" {...register('demo_video_url')} disabled={!canEdit} placeholder="https://..." />
              <Input label="Intro Video Duration (sec)" type="number" {...register('intro_video_duration_sec')} disabled={!canEdit} />
            </div>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Instructor Bio</label>
                <textarea {...register('instructor_bio')} disabled={!canEdit} rows={3} className={textareaClass} placeholder="Short professional bio" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Certifications Summary</label>
                  <textarea {...register('certifications_summary')} disabled={!canEdit} rows={2} className={textareaClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Awards &amp; Recognition</label>
                  <textarea {...register('awards_and_recognition')} disabled={!canEdit} rows={2} className={textareaClass} />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Performance metrics */}
          <div>
            <SectionTitle icon={BarChart3}>Performance Metrics</SectionTitle>
            {profile && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="bg-slate-50 rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[10px] text-slate-500 mb-0.5">Reviews</p>
                  <p className="text-sm font-semibold text-slate-800">{profile.total_reviews_received ?? 0}</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[10px] text-slate-500 mb-0.5">Avg Rating</p>
                  <p className="text-sm font-semibold text-slate-800">{profile.average_rating != null ? Number(profile.average_rating).toFixed(1) : '—'}</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input label="Courses Created" type="number" {...register('total_courses_created')} disabled={!canEdit} />
              <Input label="Courses Published" type="number" {...register('total_courses_published')} disabled={!canEdit} />
              <Input label="Students Taught" type="number" {...register('total_students_taught')} disabled={!canEdit} />
              <Input label="Completion %" type="number" {...register('completion_rate')} disabled={!canEdit} />
              <Input label="Content Minutes" type="number" {...register('total_content_minutes')} disabled={!canEdit} />
              <Input label="Patents" type="number" {...register('patents_count')} disabled={!canEdit} />
              <Input label="Publications" type="number" {...register('publications_count')} disabled={!canEdit} />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Approval & verification */}
          <div>
            <SectionTitle icon={ShieldCheck}>Approval &amp; Verification</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select label="Approval Status" {...register('approval_status')} disabled={!canEdit}
                options={[
                  { value: 'pending', label: 'Pending' }, { value: 'under_review', label: 'Under Review' },
                  { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
                  { value: 'suspended', label: 'Suspended' }, { value: 'blacklisted', label: 'Blacklisted' },
                ]}
              />
              <Select label="Badge" {...register('badge')} disabled={!canEdit}
                options={[
                  { value: '', label: 'None' }, { value: 'new', label: 'New' }, { value: 'rising', label: 'Rising' },
                  { value: 'popular', label: 'Popular' }, { value: 'top_rated', label: 'Top Rated' },
                  { value: 'expert', label: 'Expert' }, { value: 'elite', label: 'Elite' },
                ]}
              />
            </div>
            <div className="flex items-center gap-6 mt-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" {...register('is_verified')} disabled={!canEdit} className="rounded border-slate-300" /> Verified
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" {...register('is_featured')} disabled={!canEdit} className="rounded border-slate-300" /> Featured
              </label>
            </div>
            {approvalStatus === 'rejected' && (
              <div className="mt-3">
                <Input label="Rejection Reason" {...register('rejection_reason')} disabled={!canEdit} placeholder="Reason for rejection" />
              </div>
            )}
          </div>

        </CardContent>
      </Card>
    </form>
  );
}
