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
import { Save, Loader2, Briefcase } from 'lucide-react';

interface EmployeeProfileTabProps {
  userId: number;
  canEdit: boolean;
}

export default function EmployeeProfileTab({ userId, canEdit }: EmployeeProfileTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileExists, setProfileExists] = useState(false);

  // Dropdown data
  const [designations, setDesignations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      employee_code: '',
      employee_type: '',
      designation_id: '',
      department_id: '',
      branch_id: '',
      joining_date: '',
      confirmation_date: '',
      probation_end_date: '',
      contract_end_date: '',
      work_mode: '',
      shift_type: '',
      work_location: '',
      weekly_off_days: 'saturday,sunday',
      pay_grade: '',
      salary_currency: 'INR',
      ctc_annual: '',
      basic_salary_monthly: '',
      payment_mode: '',
      pf_number: '',
      esi_number: '',
      uan_number: '',
      professional_tax_number: '',
      tax_regime: '',
      leave_balance_casual: '',
      leave_balance_sick: '',
      leave_balance_earned: '',
      leave_balance_compensatory: '',
      total_experience_years: '',
      experience_at_joining: '',
      has_system_access: false,
      has_email_access: false,
      has_vpn_access: false,
      access_card_number: '',
      laptop_asset_id: '',
      exit_type: '',
      exit_reason: '',
      exit_interview_done: false,
      full_and_final_done: false,
      notice_period_days: '',
    },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, designationsRes, departmentsRes, branchesRes] = await Promise.all([
        api.getEmployeeProfileByUserId(userId).catch(() => null),
        api.listDesignations('?limit=500'),
        api.listDepartments('?limit=500'),
        api.listBranches('?limit=500'),
      ]);

      const desItems = designationsRes?.data?.items || designationsRes?.data || [];
      const deptItems = departmentsRes?.data?.items || departmentsRes?.data || [];
      const brItems = branchesRes?.data?.items || branchesRes?.data || [];
      setDesignations(Array.isArray(desItems) ? desItems : []);
      setDepartments(Array.isArray(deptItems) ? deptItems : []);
      setBranches(Array.isArray(brItems) ? brItems : []);

      const p = profileRes?.data || null;
      if (p && p.id) {
        setProfileExists(true);
        reset({
          employee_code: p.employee_code || '',
          employee_type: p.employee_type || '',
          designation_id: p.designation_id?.toString() || '',
          department_id: p.department_id?.toString() || '',
          branch_id: p.branch_id?.toString() || '',
          joining_date: p.joining_date || '',
          confirmation_date: p.confirmation_date || '',
          probation_end_date: p.probation_end_date || '',
          contract_end_date: p.contract_end_date || '',
          work_mode: p.work_mode || '',
          shift_type: p.shift_type || '',
          work_location: p.work_location || '',
          weekly_off_days: p.weekly_off_days || 'saturday,sunday',
          pay_grade: p.pay_grade || '',
          salary_currency: p.salary_currency || 'INR',
          ctc_annual: p.ctc_annual?.toString() || '',
          basic_salary_monthly: p.basic_salary_monthly?.toString() || '',
          payment_mode: p.payment_mode || '',
          pf_number: p.pf_number || '',
          esi_number: p.esi_number || '',
          uan_number: p.uan_number || '',
          professional_tax_number: p.professional_tax_number || '',
          tax_regime: p.tax_regime || '',
          leave_balance_casual: p.leave_balance_casual?.toString() || '',
          leave_balance_sick: p.leave_balance_sick?.toString() || '',
          leave_balance_earned: p.leave_balance_earned?.toString() || '',
          leave_balance_compensatory: p.leave_balance_compensatory?.toString() || '',
          total_experience_years: p.total_experience_years?.toString() || '',
          experience_at_joining: p.experience_at_joining?.toString() || '',
          has_system_access: p.has_system_access || false,
          has_email_access: p.has_email_access || false,
          has_vpn_access: p.has_vpn_access || false,
          access_card_number: p.access_card_number || '',
          laptop_asset_id: p.laptop_asset_id || '',
          exit_type: p.exit_type || '',
          exit_reason: p.exit_reason || '',
          exit_interview_done: p.exit_interview_done || false,
          full_and_final_done: p.full_and_final_done || false,
          notice_period_days: p.notice_period_days?.toString() || '',
        });
      } else {
        setProfileExists(false);
      }
    } catch (err) {
      console.error('Failed to load employee profile data', err);
      toast.error('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  }, [userId, reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onSubmit = async (data: any) => {
    setSaving(true);
    try {
      const payload = {
        ...data,
        designation_id: data.designation_id ? Number(data.designation_id) : null,
        department_id: data.department_id ? Number(data.department_id) : null,
        branch_id: data.branch_id ? Number(data.branch_id) : null,
        ctc_annual: data.ctc_annual ? Number(data.ctc_annual) : null,
        basic_salary_monthly: data.basic_salary_monthly ? Number(data.basic_salary_monthly) : null,
        leave_balance_casual: data.leave_balance_casual ? Number(data.leave_balance_casual) : null,
        leave_balance_sick: data.leave_balance_sick ? Number(data.leave_balance_sick) : null,
        leave_balance_earned: data.leave_balance_earned ? Number(data.leave_balance_earned) : null,
        leave_balance_compensatory: data.leave_balance_compensatory ? Number(data.leave_balance_compensatory) : null,
        total_experience_years: data.total_experience_years ? Number(data.total_experience_years) : null,
        experience_at_joining: data.experience_at_joining ? Number(data.experience_at_joining) : null,
        notice_period_days: data.notice_period_days ? Number(data.notice_period_days) : null,
      };

      await api.upsertEmployeeProfile(userId, payload);
      toast.success(profileExists ? 'Employee profile updated' : 'Employee profile created');
      setProfileExists(true);
    } catch (err: any) {
      console.error('Failed to save employee profile', err);
      toast.error(err?.message || 'Failed to save employee profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800">Employee Profile</h2>
          {profileExists ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="muted">No employee profile yet</Badge>
          )}
        </div>
        {canEdit && (
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : profileExists ? 'Save Changes' : 'Create Employee Profile'}
          </Button>
        )}
      </div>

      {!profileExists && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
          No employee profile exists for this user. Fill in the details below and click &quot;Create Employee Profile&quot; to get started.
        </div>
      )}

      {/* Group 1 - Identity */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-slate-400" /> Identity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            label="Employee Code"
            {...register('employee_code', { required: 'Employee code is required' })}
            placeholder="e.g. EMP001"
            error={errors.employee_code?.message}
            disabled={!canEdit}
          />
          <Select
            label="Employee Type"
            {...register('employee_type')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              { value: 'full_time', label: 'Full Time' },
              { value: 'part_time', label: 'Part Time' },
              { value: 'contract', label: 'Contract' },
              { value: 'probation', label: 'Probation' },
              { value: 'intern', label: 'Intern' },
              { value: 'consultant', label: 'Consultant' },
              { value: 'temporary', label: 'Temporary' },
              { value: 'freelance', label: 'Freelance' },
            ]}
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Organization</span></div>
      </div>

      {/* Group 2 - Organization */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Organization
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Select
            label="Designation"
            {...register('designation_id')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              ...designations.map((d: any) => ({ value: d.id.toString(), label: d.name || d.title })),
            ]}
          />
          <Select
            label="Department"
            {...register('department_id')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              ...departments.map((d: any) => ({ value: d.id.toString(), label: d.name || d.title })),
            ]}
          />
          <Select
            label="Branch"
            {...register('branch_id')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              ...branches.map((b: any) => ({ value: b.id.toString(), label: b.name || b.title })),
            ]}
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Dates</span></div>
      </div>

      {/* Group 3 - Dates */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Important Dates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            label="Joining Date"
            type="date"
            {...register('joining_date', { required: 'Joining date is required' })}
            error={errors.joining_date?.message}
            disabled={!canEdit}
          />
          <Input label="Confirmation Date" type="date" {...register('confirmation_date')} disabled={!canEdit} />
          <Input label="Probation End Date" type="date" {...register('probation_end_date')} disabled={!canEdit} />
          <Input label="Contract End Date" type="date" {...register('contract_end_date')} disabled={!canEdit} />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Work Details</span></div>
      </div>

      {/* Group 4 - Work Details */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Work Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Select
            label="Work Mode"
            {...register('work_mode')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              { value: 'on_site', label: 'On Site' },
              { value: 'remote', label: 'Remote' },
              { value: 'hybrid', label: 'Hybrid' },
            ]}
          />
          <Select
            label="Shift Type"
            {...register('shift_type')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              { value: 'general', label: 'General' },
              { value: 'morning', label: 'Morning' },
              { value: 'afternoon', label: 'Afternoon' },
              { value: 'night', label: 'Night' },
              { value: 'rotational', label: 'Rotational' },
              { value: 'flexible', label: 'Flexible' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input label="Work Location" {...register('work_location')} placeholder="e.g. Mumbai Office" disabled={!canEdit} />
          <Input label="Weekly Off Days" {...register('weekly_off_days')} placeholder="e.g. saturday,sunday" disabled={!canEdit} />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Compensation</span></div>
      </div>

      {/* Group 5 - Compensation */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Compensation
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Pay Grade" {...register('pay_grade')} placeholder="e.g. L5" disabled={!canEdit} />
          <Input label="Salary Currency" {...register('salary_currency')} placeholder="e.g. INR" disabled={!canEdit} />
          <Input label="CTC Annual" type="number" {...register('ctc_annual')} placeholder="Annual CTC" disabled={!canEdit} />
          <Input label="Basic Salary (Monthly)" type="number" {...register('basic_salary_monthly')} placeholder="Monthly basic" disabled={!canEdit} />
          <Select
            label="Payment Mode"
            {...register('payment_mode')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'cheque', label: 'Cheque' },
              { value: 'cash', label: 'Cash' },
              { value: 'upi', label: 'UPI' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Statutory</span></div>
      </div>

      {/* Group 6 - Statutory */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Statutory Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="PF Number" {...register('pf_number')} placeholder="PF account number" disabled={!canEdit} />
          <Input label="ESI Number" {...register('esi_number')} placeholder="ESI number" disabled={!canEdit} />
          <Input label="UAN Number" {...register('uan_number')} placeholder="Universal Account Number" disabled={!canEdit} />
          <Input label="Professional Tax Number" {...register('professional_tax_number')} placeholder="PT number" disabled={!canEdit} />
          <Select
            label="Tax Regime"
            {...register('tax_regime')}
            disabled={!canEdit}
            options={[
              { value: '', label: 'Select...' },
              { value: 'old', label: 'Old Regime' },
              { value: 'new', label: 'New Regime' },
            ]}
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Leave Balances</span></div>
      </div>

      {/* Group 7 - Leave Balances */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Leave Balances
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Casual Leave" type="number" {...register('leave_balance_casual')} placeholder="0" disabled={!canEdit} />
          <Input label="Sick Leave" type="number" {...register('leave_balance_sick')} placeholder="0" disabled={!canEdit} />
          <Input label="Earned Leave" type="number" {...register('leave_balance_earned')} placeholder="0" disabled={!canEdit} />
          <Input label="Compensatory Leave" type="number" {...register('leave_balance_compensatory')} placeholder="0" disabled={!canEdit} />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Experience</span></div>
      </div>

      {/* Group 8 - Experience */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Experience
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input label="Total Experience (Years)" type="number" {...register('total_experience_years')} placeholder="e.g. 5" disabled={!canEdit} />
          <Input label="Experience at Joining (Years)" type="number" {...register('experience_at_joining')} placeholder="e.g. 3" disabled={!canEdit} />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Access</span></div>
      </div>

      {/* Group 9 - Access */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          Access & Assets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('has_system_access')} disabled={!canEdit} className="rounded border-slate-300" />
            Has System Access
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('has_email_access')} disabled={!canEdit} className="rounded border-slate-300" />
            Has Email Access
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('has_vpn_access')} disabled={!canEdit} className="rounded border-slate-300" />
            Has VPN Access
          </label>
          <Input label="Access Card Number" {...register('access_card_number')} placeholder="Card ID" disabled={!canEdit} />
          <Input label="Laptop Asset ID" {...register('laptop_asset_id')} placeholder="Asset tag" disabled={!canEdit} />
        </div>
      </div>

      {/* Group 10 - Exit (only if profile exists) */}
      {profileExists && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Exit</span></div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              Exit Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Select
                label="Exit Type"
                {...register('exit_type')}
                disabled={!canEdit}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'resignation', label: 'Resignation' },
                  { value: 'termination', label: 'Termination' },
                  { value: 'retirement', label: 'Retirement' },
                  { value: 'contract_end', label: 'Contract End' },
                  { value: 'absconding', label: 'Absconding' },
                  { value: 'mutual_separation', label: 'Mutual Separation' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <Input label="Exit Reason" {...register('exit_reason')} placeholder="Reason for exit" disabled={!canEdit} />
              <Input label="Notice Period (Days)" type="number" {...register('notice_period_days')} placeholder="e.g. 30" disabled={!canEdit} />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" {...register('exit_interview_done')} disabled={!canEdit} className="rounded border-slate-300" />
                Exit Interview Done
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" {...register('full_and_final_done')} disabled={!canEdit} className="rounded border-slate-300" />
                Full & Final Settlement Done
              </label>
            </div>
          </div>
        </>
      )}

      {/* Bottom Save Button */}
      {canEdit && (
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : profileExists ? 'Save Changes' : 'Create Employee Profile'}
          </Button>
        </div>
      )}
    </form>
  );
}
