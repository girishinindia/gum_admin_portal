"use client";
import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border border-slate-200 shadow-card-hover',
          title: 'font-medium text-slate-900',
          description: 'text-slate-600',
          success: '!bg-white',
          error: '!bg-white',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
