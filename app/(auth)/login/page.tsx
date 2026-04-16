"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, ArrowRight } from 'lucide-react';
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

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

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
        Don't have an account?{' '}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">Create one</Link>
      </p>
    </div>
  );
}
