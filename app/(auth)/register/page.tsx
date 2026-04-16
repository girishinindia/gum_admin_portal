"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, Lock, User, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from '@/components/ui/Toast';

const step1Schema = z.object({
  first_name: z.string().min(1).max(75),
  last_name: z.string().min(1).max(75),
  email: z.string().email(),
  mobile: z.string().min(10).max(15),
  password: z.string().min(8, 'Min 8 characters'),
});
const otpSchema = z.object({ otp: z.string().length(6) });

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [pendingId, setPendingId] = useState('');
  const [channel, setChannel] = useState<'email' | 'mobile'>('email');
  const [masked, setMasked] = useState({ email: '', mobile: '' });
  const [verifiedEmail, setVerifiedEmail] = useState(false);
  const [verifiedMobile, setVerifiedMobile] = useState(false);
  const [loading, setLoading] = useState(false);

  const s1 = useForm({ resolver: zodResolver(step1Schema) });
  const s2 = useForm({ resolver: zodResolver(otpSchema) });

  const onStep1 = async (data: any) => {
    setLoading(true);
    const res = await api.register(data);
    setLoading(false);
    if (res.success && res.data?.pending_id) {
      setPendingId(res.data.pending_id);
      setMasked({ email: res.data.email, mobile: res.data.mobile });
      setStep(2);
      toast.success('OTP sent to email and mobile');
    } else {
      toast.error(res.error || 'Registration failed');
    }
  };

  const onVerifyOtp = async (data: any) => {
    setLoading(true);
    const res = await api.verifyOtp({ pending_id: pendingId, channel, otp: data.otp });
    setLoading(false);
    if (res.success) {
      if (channel === 'email') setVerifiedEmail(true);
      else setVerifiedMobile(true);
      s2.reset({ otp: '' });
      toast.success(`${channel} verified`);

      // If both OTPs are now verified, account is created → send to login
      if (res.data?.access_token || res.data?.user) {
        toast.success('Account created successfully! Please sign in.');
        setTimeout(() => router.push('/login'), 1200);
      } else {
        setChannel(channel === 'email' ? 'mobile' : 'email');
      }
    } else {
      toast.error(res.error || 'Invalid OTP');
    }
  };

  return (
    <div>
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to sign in
      </Link>

      <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">Create account</h1>
      <p className="text-slate-500 mt-2">
        {step === 1 ? 'Start with your details' : `Verify your ${channel}`}
      </p>

      <div className="flex items-center gap-2 mt-6">
        {[1, 2].map(n => (
          <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${step >= n ? 'bg-brand-500' : 'bg-slate-200'}`} />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={s1.handleSubmit(onStep1)} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" placeholder="Girish" error={s1.formState.errors.first_name?.message as string} {...s1.register('first_name')} />
            <Input label="Last name" placeholder="Chaudhary" error={s1.formState.errors.last_name?.message as string} {...s1.register('last_name')} />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Email" placeholder="girish@growupmore.com" className="pl-10" error={s1.formState.errors.email?.message as string} {...s1.register('email')} />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Mobile" placeholder="9876543210" className="pl-10" error={s1.formState.errors.mobile?.message as string} {...s1.register('mobile')} />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
            <Input label="Password" type="password" placeholder="Min 8 chars" className="pl-10" error={s1.formState.errors.password?.message as string} {...s1.register('password')} />
          </div>
          <Button type="submit" loading={loading} className="w-full" size="lg">Continue</Button>
        </form>
      )}

      {step === 2 && (
        <div className="mt-8 space-y-6">
          <div className="flex gap-2">
            <button type="button" onClick={() => setChannel('email')} disabled={verifiedEmail} className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${channel === 'email' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'} ${verifiedEmail ? 'opacity-75' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4" />
                <span className="text-xs font-medium text-slate-500 uppercase">Email</span>
                {verifiedEmail && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
              </div>
              <div className="text-sm font-medium text-slate-900">{masked.email}</div>
            </button>
            <button type="button" onClick={() => setChannel('mobile')} disabled={verifiedMobile} className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${channel === 'mobile' ? 'border-brand-500 bg-brand-50' : 'border-slate-200'} ${verifiedMobile ? 'opacity-75' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4" />
                <span className="text-xs font-medium text-slate-500 uppercase">Mobile</span>
                {verifiedMobile && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />}
              </div>
              <div className="text-sm font-medium text-slate-900">{masked.mobile}</div>
            </button>
          </div>
          <form onSubmit={s2.handleSubmit(onVerifyOtp)} className="space-y-4">
            <Input
              label={`OTP sent to ${channel}`}
              placeholder="123456"
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              error={s2.formState.errors.otp?.message as string}
              {...s2.register('otp')}
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">Verify {channel}</Button>
            <button type="button" onClick={async () => { const r = await api.resendOtp({ pending_id: pendingId, channel }); if (r.success) toast.success('OTP resent'); }} className="w-full text-center text-sm text-brand-600 hover:text-brand-700 font-medium">
              Resend OTP
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
