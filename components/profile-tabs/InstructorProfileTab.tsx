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
import { Card, CardContent } from '@/components/ui/Card';
import { Save, Loader2, UserCheck, BarChart3, DollarSign, ShieldCheck } from 'lucide-react';

interface InstructorProfileTabProps {
  userId: number;
  canEdit: boolean;
}

export default function InstructorProfileTab({ userId, canEdit }: InstructorProfileTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const { register, handleSubmit, reset, watch } = useForm();
  const approvalStatus = watch('approval_status');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const profileRes = await api.getInstructorProfileByUserId(userId).catch(() => null);

      const p = profileRes?.data || null;
      setProfile(p);

      if (p) {
        reset({
          instructor_code: p.instructor_code || '',
          instructor_type: p.instructor_type || '',
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

    // ── Validation ──
    if (!formData.instructor_code || String(formData.instructor_code).trim() === '') {
      toast.error('Instructor Code is required');
      return;
    }
    if (!formData.instructor_type || formData.instructor_type === '') {
      toast.error('Instructor Type is required');
      return;
    }
    if (formData.revenue_share_percentage !== '' && formData.revenue_share_percentage != null) {
      const rs = Number(formData.revenue_share_percentage);
      if (Number.isNaN(rs) || rs < 0 || rs > 100) {
        toast.error('Revenue Share % must be between 0 and 100');
        return;
      }
    }
    if (formData.hourly_rate !== '' && formData.hourly_rate != null) {
      const hr = Number(formData.hourly_rate);
      if (Number.isNaN(hr) || hr < 0) {
        toast.error('Hourly Rate must be 0 or greater');
        return;
      }
    }
    if (formData.fixed_rate_per_course !== '' && formData.fixed_rate_per_course != null) {
      const fr = Number(formData.fixed_rate_per_course);
      if (Number.isNaN(fr) || fr < 0) {
        toast.error('Fixed Rate per Course must be 0 or greater');
        return;
      }
    }

    setSaving(true);
    try {
      const cleaned: any = {};
      for (const [k, v] of Object.entries(formData)) {
        if (v === '' || v === undefined) cleaned[k] = null;
        else cleaned[k] = v;
      }
      // Convert numeric fields
      for (const k of ['revenue_share_percentage', 'fixed_rate_per_course', 'hourly_rate']) {
        if (cleaned[k] !== null && cleaned[k] !== undefined) cleaned[k] = Number(cleaned[k]);
      }
      // Booleans
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

          {/* ── Identity ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Identity
            </h3>
            <div className="grid grid-cols-3 gap-3">
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

          {/* ── Performance Metrics (read-only) ── */}
          {profile && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Performance Metrics
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Reviews', value: profile.total_reviews_received },
                    { label: 'Avg Rating', value: profile.average_rating != null ? Number(profile.average_rating).toFixed(1) : '—' },
                  ].map(m => (
                    <div key={m.label} className="bg-slate-50 rounded-lg px-2.5 py-2 text-center">
                      <p className="text-[10px] text-slate-500 mb-0.5 truncate">{m.label}</p>
                      <p className="text-sm font-semibold text-slate-800">{m.value ?? 0}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="border-t border-slate-100" />

          {/* ── Compensation ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Compensation
            </h3>
            <div className="grid grid-cols-3 gap-3">
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

          {/* ── Approval & Verification ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Approval & Verification
            </h3>
            <div className="grid grid-cols-3 gap-3">
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
