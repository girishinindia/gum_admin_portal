"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/Toast';

const schema = z.object({
  identifier: z.string().min(1, 'Email or mobile required'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

const reasonMessages: Record<string, string> = {
  session_expired: 'Your session expired. Please sign in again.',
  session_revoked: 'Your session was revoked. Please sign in again to continue.',
  account_suspended: 'Your account has been suspended. Contact your administrator.',
  account_inactive: 'Your account has been deactivated. Contact your administrator.',
  account_not_found: 'Your account is no longer available.',
  role_permissions_changed: 'Your permissions were updated. Please sign in again.',
  permission_status_changed: 'Your permissions were updated. Please sign in again.',
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason && reasonMessages[reason]) setBanner(reasonMessages[reason]);
  }, [searchParams]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const res = await login(data.identifier, data.password);
    setLoading(false);
    if (res.success) {
      toast.success('Welcome back!');
      router.push('/dashboard');
    } else {
      toast.error(res.error || 'Login failed');
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">Sign in</h1>
      <p className="text-slate-500 mt-2">Access your admin panel</p>

      {banner && (
        <div className="mt-6 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-sm text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span>{banner}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-[34px] w-4 h-4 text-slate-400 z-10" />
          <Input
            label="Email or Mobile"
            placeholder="girish@growupmore.com"
            className="pl-10"
            error={errors.identifier?.message}
            {...register('identifier')}
          />
        </div>

        <PasswordInput
          label="Password"
          placeholder="••••••••"
          leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Sign in <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">Create one</Link>
      </p>
    </div>
  );
}
