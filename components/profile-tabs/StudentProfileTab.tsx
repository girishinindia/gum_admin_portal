"use client";
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Card, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';
import { Save, Loader2, GraduationCap, BookOpen, Heart, DollarSign, Briefcase } from 'lucide-react';

interface StudentProfileTabProps {
  userId: number;
  canEdit: boolean;
}

export default function StudentProfileTab({ userId, canEdit }: StudentProfileTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Dropdown data
  const [educationLevels, setEducationLevels] = useState<any[]>([]);
  const [learningGoals, setLearningGoals] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [languages, setLanguages] = useState<any[]>([]);

  const { register, handleSubmit, reset } = useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, edLevelsRes, goalsRes, specsRes, langsRes] = await Promise.all([
        api.getStudentProfileByUserId(userId).catch(() => null),
        api.listEducationLevels('?limit=500'),
        api.listLearningGoals('?limit=500'),
        api.listSpecializations('?limit=500'),
        api.listLanguages('?limit=500'),
      ]);
      const p = profileRes?.data || null;
      setProfile(p);
      const extract = (res: any) => { const d = res?.data?.items || res?.data || []; return Array.isArray(d) ? d : []; };
      setEducationLevels(extract(edLevelsRes));
      setLearningGoals(extract(goalsRes));
      setSpecializations(extract(specsRes));
      setLanguages(extract(langsRes));
      if (p) reset(p);
    } catch {
      // profile may not exist yet
    } finally {
      setLoading(false);
    }
  }, [userId, reset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const result = await api.upsertStudentProfile(userId, data);
      setProfile(result);
      toast.success('Student profile saved successfully');
    } catch {
      toast.error('Failed to save student profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-brand-500" /> Student Profile
          </h2>
          {canEdit && (
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
        <CardContent className="p-5 space-y-5">

          {/* ── Enrollment Details ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" /> Enrollment Details
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Enrollment Number" {...register('enrollment_number', { required: true })} placeholder="e.g. STU-2024-001" />
              <Input label="Enrollment Date" type="date" {...register('enrollment_date')} />
              <Select label="Enrollment Type" {...register('enrollment_type')}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'self', label: 'Self' },
                  { value: 'corporate', label: 'Corporate' },
                  { value: 'scholarship', label: 'Scholarship' },
                  { value: 'referral', label: 'Referral' },
                  { value: 'trial', label: 'Trial' },
                  { value: 'other', label: 'Other' },
                ]}
              />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Current Education ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Current Education
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <Select label="Education Level" {...register('education_level_id')}
                options={[{ value: '', label: 'Select...' }, ...educationLevels.map(e => ({ value: e.id, label: e.name }))]}
              />
              <Input label="Current Institution" {...register('current_institution')} placeholder="University / School name" />
              <Input label="Field of Study" {...register('current_field_of_study')} placeholder="e.g. Computer Science" />
              <Input label="Semester / Year" {...register('current_semester_or_year')} placeholder="e.g. 3rd Year" />
              <Input label="Expected Graduation Date" type="date" {...register('expected_graduation_date')} />
              <div className="flex items-center gap-2 self-end pb-2">
                <input type="checkbox" id="is_currently_studying" {...register('is_currently_studying')} className="rounded border-slate-300" />
                <label htmlFor="is_currently_studying" className="text-sm text-slate-700">Currently Studying</label>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Learning Preferences ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Learning Preferences
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <Select label="Learning Goal" {...register('learning_goal_id')}
                options={[{ value: '', label: 'Select...' }, ...learningGoals.map(g => ({ value: g.id, label: g.name }))]}
              />
              <Select label="Specialization" {...register('specialization_id')}
                options={[{ value: '', label: 'Select...' }, ...specializations.map(s => ({ value: s.id, label: s.name }))]}
              />
              <Select label="Preferred Learning Mode" {...register('preferred_learning_mode')}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'self_paced', label: 'Self-Paced' },
                  { value: 'instructor_led', label: 'Instructor-Led' },
                  { value: 'hybrid', label: 'Hybrid' },
                  { value: 'cohort_based', label: 'Cohort-Based' },
                  { value: 'mentored', label: 'Mentored' },
                ]}
              />
              <Select label="Preferred Language" {...register('preferred_learning_language_id')}
                options={[{ value: '', label: 'Select...' }, ...languages.map(l => ({ value: l.id, label: l.name }))]}
              />
              <Select label="Preferred Content Type" {...register('preferred_content_type')}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'video', label: 'Video' },
                  { value: 'text', label: 'Text' },
                  { value: 'interactive', label: 'Interactive' },
                  { value: 'audio', label: 'Audio' },
                  { value: 'mixed', label: 'Mixed' },
                ]}
              />
              <Select label="Difficulty Preference" {...register('difficulty_preference')}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' },
                  { value: 'mixed', label: 'Mixed' },
                ]}
              />
              <Input label="Daily Learning Hours" type="number" {...register('daily_learning_hours')} placeholder="e.g. 2" />
              <Input label="Weekly Available Days" type="number" {...register('weekly_available_days')} placeholder="e.g. 5" />
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Parent/Guardian ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" /> Parent / Guardian
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Name" {...register('parent_guardian_name')} placeholder="Full name" />
              <Input label="Phone" {...register('parent_guardian_phone')} placeholder="+91 9876543210" />
              <Input label="Email" type="email" {...register('parent_guardian_email')} placeholder="email@example.com" />
              <Select label="Relation" {...register('parent_guardian_relation')}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'father', label: 'Father' },
                  { value: 'mother', label: 'Mother' },
                  { value: 'guardian', label: 'Guardian' },
                  { value: 'spouse', label: 'Spouse' },
                  { value: 'sibling', label: 'Sibling' },
                  { value: 'other', label: 'Other' },
                ]}
              />
            </div>
          </div>

          {/* ── Academic Performance (read-only) ── */}
          {profile && (
            <>
              <div className="border-t border-slate-100" />
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5" /> Academic Performance
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: 'Enrolled', value: profile.courses_enrolled },
                    { label: 'Completed', value: profile.courses_completed },
                    { label: 'In Progress', value: profile.courses_in_progress },
                    { label: 'Certificates', value: profile.certificates_earned },
                    { label: 'Learning Hrs', value: profile.total_learning_hours },
                    { label: 'Avg Score', value: profile.average_score },
                    { label: 'Streak', value: profile.current_streak_days },
                    { label: 'Best Streak', value: profile.longest_streak_days },
                    { label: 'XP Points', value: profile.xp_points },
                    { label: 'Level', value: profile.level },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-slate-50 rounded-lg px-2.5 py-2 text-center">
                      <p className="text-[10px] text-slate-500 mb-0.5 truncate">{stat.label}</p>
                      <p className="text-sm font-semibold text-slate-800">{stat.value ?? '-'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="border-t border-slate-100" />

          {/* ── Financial ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" /> Financial
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <Select label="Subscription Plan" {...register('subscription_plan')}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'free', label: 'Free' },
                  { value: 'basic', label: 'Basic' },
                  { value: 'standard', label: 'Standard' },
                  { value: 'premium', label: 'Premium' },
                  { value: 'enterprise', label: 'Enterprise' },
                  { value: 'lifetime', label: 'Lifetime' },
                ]}
              />
              <div className="flex items-center gap-2 self-end pb-2">
                <input type="checkbox" id="has_active_subscription" {...register('has_active_subscription')} className="rounded border-slate-300" />
                <label htmlFor="has_active_subscription" className="text-sm text-slate-700">Active Subscription</label>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* ── Career ── */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Career
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Preferred Job Roles" {...register('preferred_job_roles')} placeholder="e.g. Frontend Developer" />
              <Input label="Preferred Locations" {...register('preferred_locations')} placeholder="e.g. Bangalore, Remote" />
              <Input label="Expected Salary Range" {...register('expected_salary_range')} placeholder="e.g. 5-8 LPA" />
            </div>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_seeking_job" {...register('is_seeking_job')} className="rounded border-slate-300" />
                <label htmlFor="is_seeking_job" className="text-sm text-slate-700">Seeking Job</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_open_to_internship" {...register('is_open_to_internship')} className="rounded border-slate-300" />
                <label htmlFor="is_open_to_internship" className="text-sm text-slate-700">Open to Internship</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_open_to_freelance" {...register('is_open_to_freelance')} className="rounded border-slate-300" />
                <label htmlFor="is_open_to_freelance" className="text-sm text-slate-700">Open to Freelance</label>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>
    </form>
  );
}
