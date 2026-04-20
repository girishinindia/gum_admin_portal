"use client";
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Save, Loader2, UserCheck } from 'lucide-react';

interface InstructorProfileTabProps {
  userId: number;
  canEdit: boolean;
}

export default function InstructorProfileTab({ userId, canEdit }: InstructorProfileTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Dropdown data
  const [designations, setDesignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  const { register, handleSubmit, reset, watch } = useForm();
  const approvalStatus = watch('approval_status');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, desRes, deptRes, brRes, specRes, langRes] = await Promise.all([
        api.getInstructorProfileByUserId(userId).catch(() => null),
        api.listDesignations('?limit=500'),
        api.listDepartments('?limit=500'),
        api.listBranches('?limit=500'),
        api.listSpecializations('?limit=500'),
        api.listLanguages('?limit=500'),
      ]);

      const p = profileRes?.data || null;
      setProfile(p);

      const extract = (res: any) => { const d = res?.data?.items || res?.data || []; return Array.isArray(d) ? d : []; };
      setDesignations(extract(desRes).filter((d: any) => !d.deleted_at));
      setDepartments(extract(deptRes).filter((d: any) => !d.deleted_at));
      setBranches(extract(brRes).filter((b: any) => !b.deleted_at));
      setSpecializations(extract(specRes).filter((s: any) => !s.deleted_at));
      setLanguages(extract(langRes).filter((l: any) => !l.deleted_at));

      if (p) {
        reset({
          instructor_code: p.instructor_code || '',
          instructor_type: p.instructor_type || '',
          designation_id: p.designation_id || '',
          department_id: p.department_id || '',
          branch_id: p.branch_id || '',
          joining_date: p.joining_date ? p.joining_date.slice(0, 10) : '',
          specialization_id: p.specialization_id || '',
          secondary_specialization_id: p.secondary_specialization_id || '',
          teaching_experience_years: p.teaching_experience_years ?? '',
          industry_experience_years: p.industry_experience_years ?? '',
          total_experience_years: p.total_experience_years ?? '',
          preferred_teaching_language_id: p.preferred_teaching_language_id || '',
          teaching_mode: p.teaching_mode || '',
          instructor_bio: p.instructor_bio || '',
          tagline: p.tagline || '',
          demo_video_url: p.demo_video_url || '',
          highest_qualification: p.highest_qualification || '',
          certifications_summary: p.certifications_summary || '',
          awards_and_recognition: p.awards_and_recognition || '',
          is_available: p.is_available ?? false,
          available_hours_per_week: p.available_hours_per_week ?? '',
          available_from: p.available_from ? p.available_from.slice(0, 10) : '',
          available_until: p.available_until ? p.available_until.slice(0, 10) : '',
          preferred_time_slots: p.preferred_time_slots || '',
          max_concurrent_courses: p.max_concurrent_courses ?? '',
          payment_model: p.payment_model || '',
          revenue_share_percentage: p.revenue_share_percentage ?? '',
          fixed_rate_per_course: p.fixed_rate_per_course ?? '',
          hourly_rate: p.hourly_rate ?? '',
          payment_currency: p.payment_currency || 'INR',
          approval_status: p.approval_status || 'pending',
          is_verified: p.is_verified ?? false,
          is_featured: p.is_featured ?? false,
          badge: p.badge || '',
          rejection_reason: p.rejection_reason || '',
        });
      } else {
        reset({ payment_currency: 'INR', approval_status: 'pending' });
      }
    } catch (err) {
      console.error('Failed to load instructor profile:', err);
      toast.error('Failed to load instructor profile');
    } finally {
      setLoading(false);
    }
  }, [userId, reset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function onSubmit(formData: any) {
    if (!canEdit) return;
    setSaving(true);
    try {
      const cleaned: any = {};
      for (const [k, v] of Object.entries(formData)) {
        if (v === '' || v === undefined) cleaned[k] = null;
        else cleaned[k] = v;
      }
      // Convert IDs to numbers
      for (const k of ['designation_id', 'department_id', 'branch_id', 'specialization_id', 'secondary_specialization_id', 'preferred_teaching_language_id']) {
        if (cleaned[k]) cleaned[k] = Number(cleaned[k]);
        else cleaned[k] = null;
      }
      // Convert numeric fields
      for (const k of ['teaching_experience_years', 'industry_experience_years', 'total_experience_years', 'available_hours_per_week', 'max_concurrent_courses', 'revenue_share_percentage', 'fixed_rate_per_course', 'hourly_rate']) {
        if (cleaned[k] !== null && cleaned[k] !== undefined) cleaned[k] = Number(cleaned[k]);
      }
      // Booleans
      cleaned.is_available = !!formData.is_available;
      cleaned.is_verified = !!formData.is_verified;
      cleaned.is_featured = !!formData.is_featured;

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ── Group 1: Identity ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-slate-400" /> Identity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Instructor Code" {...register('instructor_code', { required: true })} placeholder="e.g. INS-001" disabled={!canEdit} />
          <Select
            label="Instructor Type"
            {...register('instructor_type')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              { value: 'internal', label: 'Internal' },
              { value: 'external', label: 'External' },
              { value: 'guest', label: 'Guest' },
              { value: 'visiting', label: 'Visiting' },
              { value: 'corporate', label: 'Corporate' },
              { value: 'community', label: 'Community' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* ── Group 2: Organization ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Organization</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Designation"
            {...register('designation_id')}
            disabled={!canEdit}
            options={[{ value: '', label: 'Select...' }, ...designations.map(d => ({ value: d.id, label: d.name }))]}
          />
          <Select
            label="Department"
            {...register('department_id')}
            disabled={!canEdit}
            options={[{ value: '', label: 'Select...' }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
          />
          <Select
            label="Branch"
            {...register('branch_id')}
            disabled={!canEdit}
            options={[{ value: '', label: 'Select...' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
          />
          <Input label="Joining Date" type="date" {...register('joining_date')} disabled={!canEdit} />
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* ── Group 3: Teaching Info ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Teaching Info</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Specialization"
            {...register('specialization_id')}
            disabled={!canEdit}
            options={[{ value: '', label: 'Select...' }, ...specializations.map(s => ({ value: s.id, label: s.name }))]}
          />
          <Select
            label="Secondary Specialization"
            {...register('secondary_specialization_id')}
            disabled={!canEdit}
            options={[{ value: '', label: 'Select...' }, ...specializations.map(s => ({ value: s.id, label: s.name }))]}
          />
          <Input label="Teaching Experience (years)" type="number" {...register('teaching_experience_years')} disabled={!canEdit} />
          <Input label="Industry Experience (years)" type="number" {...register('industry_experience_years')} disabled={!canEdit} />
          <Input label="Total Experience (years)" type="number" {...register('total_experience_years')} disabled={!canEdit} />
          <Select
            label="Preferred Teaching Language"
            {...register('preferred_teaching_language_id')}
            disabled={!canEdit}
            options={[{ value: '', label: 'Select...' }, ...languages.map(l => ({ value: l.id, label: l.name }))]}
          />
          <Select
            label="Teaching Mode"
            {...register('teaching_mode')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              { value: 'online', label: 'Online' },
              { value: 'offline', label: 'Offline' },
              { value: 'hybrid', label: 'Hybrid' },
              { value: 'recorded_only', label: 'Recorded Only' },
            ]}
          />
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* ── Group 4: Bio & Presentation ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Bio & Presentation</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Instructor Bio</label>
            <textarea
              {...register('instructor_bio')}
              disabled={!canEdit}
              rows={4}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Write a short bio..."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Tagline" {...register('tagline')} disabled={!canEdit} placeholder="e.g. Expert in Machine Learning" />
            <Input label="Demo Video URL" {...register('demo_video_url')} disabled={!canEdit} placeholder="https://..." />
            <Input label="Highest Qualification" {...register('highest_qualification')} disabled={!canEdit} placeholder="e.g. Ph.D. in Computer Science" />
            <Input label="Certifications Summary" {...register('certifications_summary')} disabled={!canEdit} placeholder="e.g. AWS Certified, PMP" />
            <Input label="Awards & Recognition" {...register('awards_and_recognition')} disabled={!canEdit} placeholder="e.g. Best Faculty 2024" className="md:col-span-2" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* ── Group 5: Performance Metrics (read-only) ── */}
      {profile && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Courses Created', value: profile.total_courses_created },
                { label: 'Courses Published', value: profile.total_courses_published },
                { label: 'Students Taught', value: profile.total_students_taught },
                { label: 'Reviews Received', value: profile.total_reviews_received },
                { label: 'Avg Rating', value: profile.average_rating != null ? Number(profile.average_rating).toFixed(1) : '—' },
                { label: 'Teaching Hours', value: profile.total_teaching_hours },
                { label: 'Content Minutes', value: profile.total_content_minutes },
                { label: 'Completion Rate', value: profile.completion_rate != null ? `${profile.completion_rate}%` : '—' },
                { label: 'Publications', value: profile.publications_count },
                { label: 'Patents', value: profile.patents_count },
              ].map(m => (
                <div key={m.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
                  <div className="text-lg font-semibold text-slate-800">{m.value ?? 0}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100" />
        </>
      )}

      {/* ── Group 6: Availability ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Availability</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
            <input type="checkbox" {...register('is_available')} disabled={!canEdit} className="rounded border-slate-300" />
            Currently Available
          </label>
          <Input label="Available Hours/Week" type="number" {...register('available_hours_per_week')} disabled={!canEdit} />
          <Input label="Available From" type="date" {...register('available_from')} disabled={!canEdit} />
          <Input label="Available Until" type="date" {...register('available_until')} disabled={!canEdit} />
          <Input label="Preferred Time Slots" {...register('preferred_time_slots')} disabled={!canEdit} placeholder="e.g. Mon-Fri 9AM-5PM" />
          <Input label="Max Concurrent Courses" type="number" {...register('max_concurrent_courses')} disabled={!canEdit} />
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* ── Group 7: Compensation ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Compensation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Payment Model"
            {...register('payment_model')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              { value: 'revenue_share', label: 'Revenue Share' },
              { value: 'fixed_per_course', label: 'Fixed per Course' },
              { value: 'hourly', label: 'Hourly' },
              { value: 'monthly_salary', label: 'Monthly Salary' },
              { value: 'per_student', label: 'Per Student' },
              { value: 'hybrid', label: 'Hybrid' },
              { value: 'volunteer', label: 'Volunteer' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input label="Revenue Share %" type="number" {...register('revenue_share_percentage')} disabled={!canEdit} placeholder="e.g. 30" />
          <Input label="Fixed Rate/Course" type="number" {...register('fixed_rate_per_course')} disabled={!canEdit} />
          <Input label="Hourly Rate" type="number" {...register('hourly_rate')} disabled={!canEdit} />
          <Input label="Payment Currency" {...register('payment_currency')} disabled={!canEdit} placeholder="INR" />
        </div>
      </div>

      <div className="border-t border-slate-100" />

      {/* ── Group 8: Approval & Verification ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Approval & Verification</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Approval Status"
            {...register('approval_status')}
            disabled={!canEdit}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'under_review', label: 'Under Review' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'blacklisted', label: 'Blacklisted' },
            ]}
          />
          <Select
            label="Badge"
            {...register('badge')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'None' },
              { value: 'new', label: 'New' },
              { value: 'rising', label: 'Rising' },
              { value: 'popular', label: 'Popular' },
              { value: 'top_rated', label: 'Top Rated' },
              { value: 'expert', label: 'Expert' },
              { value: 'elite', label: 'Elite' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('is_verified')} disabled={!canEdit} className="rounded border-slate-300" />
            Verified
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('is_featured')} disabled={!canEdit} className="rounded border-slate-300" />
            Featured
          </label>
          {approvalStatus === 'rejected' && (
            <Input label="Rejection Reason" {...register('rejection_reason')} disabled={!canEdit} placeholder="Reason for rejection" className="md:col-span-2" />
          )}
        </div>
      </div>

      {/* ── Save Button ── */}
      {canEdit && (
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Instructor Profile'}
          </Button>
        </div>
      )}
    </form>
  );
}
