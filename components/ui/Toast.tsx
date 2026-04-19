"use client";
import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors={false}
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border shadow-lg !px-4 !py-3',
          title: 'font-medium',
          description: 'text-sm',
          success: '!bg-emerald-50 !border-emerald-200 !text-emerald-900 [&_[data-title]]:!text-emerald-900 [&_[data-description]]:!text-emerald-700 [&_[data-icon]]:!text-emerald-500',
          error: '!bg-red-50 !border-red-200 !text-red-900 [&_[data-title]]:!text-red-900 [&_[data-description]]:!text-red-700 [&_[data-icon]]:!text-red-500',
          warning: '!bg-amber-50 !border-amber-200 !text-amber-900 [&_[data-title]]:!text-amber-900 [&_[data-description]]:!text-amber-700 [&_[data-icon]]:!text-amber-500',
          info: '!bg-blue-50 !border-blue-200 !text-blue-900 [&_[data-title]]:!text-blue-900 [&_[data-description]]:!text-blue-700 [&_[data-icon]]:!text-blue-500',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
