"use client";
import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokens } from '@/lib/api';
import { GraduationCap } from 'lucide-react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  useEffect(() => { if (tokens.access) router.replace('/dashboard'); }, [router]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: brand showcase */}
      <div className="hidden lg:flex relative bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(125,211,252,0.25),transparent_50%)]" />

        {/* Decorative circles */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-brand-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-brand-300/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
              <GraduationCap className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-bold text-xl leading-none">Grow Up More</div>
              <div className="text-xs text-brand-200 mt-1 tracking-wider uppercase">Admin Panel</div>
            </div>
          </div>

          <div className="max-w-md">
            <h2 className="font-display text-4xl font-bold leading-tight mb-3">
              Manage your e-learning platform with confidence.
            </h2>
            <p className="text-brand-100 text-lg leading-relaxed">
              Full control over users, roles, content, and analytics — in one place.
            </p>
          </div>

          <div className="text-sm text-brand-200">
            © {new Date().getFullYear()} Grow Up More · GrowUpMore.com
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-brand">
              <GraduationCap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="font-display font-bold text-slate-900">Grow Up More</div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
