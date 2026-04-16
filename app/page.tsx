"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tokens } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(tokens.access ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}
