"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, Lock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';

const step1Schema = z.object({ email: z.string().email(), mobile: z.string().min(10).max(15) });
const otpSchema = z.object({ otp: z.string().length(6, 'Must be 6 digits') });
const pwdSchema = z.object({
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string().min(8),
}).refine(d => d.new_password === d.confirm, { message: "Passwords don't match", path: ['confirm'] });

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [resetPendingId, setResetPendingId] = useState('');
  const [channel, setChannel] = useState<'email' | 'mobile'>('email');
  const [masked, setMasked] = useState({ email: '', mobile: '' });
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [verifiedMobile, setVerifiedMobile] = useState(false);
  const [loading, setLoading] = useState(false);

  const s1 = useForm({ resolver: zodResolver(step1Schema) });
  const s2 = useForm({ resolver: zodResolver(otpSchema) });
  const s3 = useForm({ resolver: zodResolver(pwdSchema) });

  const onStep1 = async (data: any) => {
    setLoading(true);
    const res = await api.forgotPassword(data);
    setLoading(false);
    if (res.success && res.data?.reset_pending_id) {
      setResetPendingId(res.data.reset_pending_id);
      setMasked({ email: res.data.email, mobile: res.data.mobile });
      setStep(2);
      toast.success('OTPs sent to both channels');
    } else {
      toast.success(res.message || 'If an account exists, OTPs have been sent.');
    }
  };

  const onVerifyOtp = async (data: any) => {
    if (!resetPendingId) return;
    setLoading(true);
    const res = await api.verifyResetOtp({ reset_pending_id: resetPendingId, channel, otp: data.otp });
    setLoading(false);
    if (res.success) {
      if (channel === 'email') setVerifiedEmail(true);
      else setVerifiedMobile(true);
      s2.reset({ otp: '' });
      toast.success(`${channel} verified`);
      if (res.data?.can_reset_password) setStep(3);
      else setChannel(channel === 'email' ? 'mobile' : 'email');
    } else {
      toast.error(res.error || 'Invalid OTP');
    }
  };

  const onResetPassword = async (data: any) => {
    setLoading(true);
    const res = await api.resetPassword({ reset_pending_id: resetPendingId, new_password: data.new_password });
    setLoading(false);
    if (res.success) {
      toast.success('Password reset! Please sign in with your new password.');
      router.push('/login');
    } else {
      toast.error(res.error || 'Reset failed');
    }
  };

  return (
    <div>
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to sign in
      </Link>

      <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">Reset password</h1>
      <p className="text-slate-500 mt-2">
        {step === 1 && 'Verify your email and mobile to reset your password'}
        {step === 2 && 'Enter the OTP sent to your ' + channel}
        {step === 3 && 'Choose a new password'}
      </p>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mt-6">
        {[1, 2, 3].map(n => (
          <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${step >= n ? 'bg-brand-500' : 'bg-slate-200'}`} />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={s1.handleSubmit(onStep1)} className="mt-8 space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Email" placeholder="girish@growupmore.com" className="pl-10" error={s1.formState.errors.email?.message as string} {...s1.register('email')} />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Mobile number" placeholder="9876543210" className="pl-10" error={s1.formState.errors.mobile?.message as string} hint="Both email and mobile must match the same account" {...s1.register('mobile')} />
          </div>
          <Button type="submit" loading={loading} className="w-full" size="lg">Send OTP to both</Button>
        </form>
      )}

      {step === 2 && (
        <div className="mt-8 space-y-6">
          {/* Channel switcher */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setChannel('email')}
              className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${channel === 'email' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'} ${verifiedEmail ? 'opacity-75' : ''}`}
              disabled={verifiedEmail}
            >
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Email</span>
                {verifiedEmail && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
              </div>
              <div className="text-sm font-medium text-slate-900">{masked.email}</div>
            </button>
            <button
              type="button"
              onClick={() => setChannel('mobile')}
              className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${channel === 'mobile' ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'} ${verifiedMobile ? 'opacity-75' : ''}`}
              disabled={verifiedMobile}
            >
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Mobile</span>
                {verifiedMobile && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
              </div>
              <div className="text-sm font-medium text-slate-900">{masked.mobile}</div>
            </button>
          </div>

          <form onSubmit={s2.handleSubmit(onVerifyOtp)} className="space-y-4">
            <Input
              label={`6-digit OTP sent to your ${channel}`}
              placeholder="123456"
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              error={s2.formState.errors.otp?.message as string}
              {...s2.register('otp')}
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">Verify {channel}</Button>
            <button
              type="button"
              onClick={async () => {
                const res = await api.resendResetOtp({ reset_pending_id: resetPendingId, channel });
                if (res.success) toast.success(`OTP resent to ${channel}`);
                else toast.error(res.error || 'Resend failed');
              }}
              className="w-full text-center text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Resend OTP
            </button>
          </form>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={s3.handleSubmit(onResetPassword)} className="mt-8 space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="New password" type="password" placeholder="••••••••" className="pl-10" error={s3.formState.errors.new_password?.message as string} {...s3.register('new_password')} />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Confirm password" type="password" placeholder="••••••••" className="pl-10" error={s3.formState.errors.confirm?.message as string} {...s3.register('confirm')} />
          </div>
          <Button type="submit" loading={loading} className="w-full" size="lg">Reset password</Button>
        </form>
      )}
    </div>
  );
}
