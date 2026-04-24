"use client";

import { useRef, useImperativeHandle, forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export interface DataToolbarHandle {
  focusSearch: () => void;
}

export const DataToolbar = forwardRef<DataToolbarHandle, DataToolbarProps>(({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  children,
}, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => inputRef.current?.focus(),
  }));

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className={cn(
            'w-full h-10 pl-10 pr-10 text-sm rounded-lg border border-slate-200 bg-white',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
            'placeholder:text-slate-400'
          )}
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
});

DataToolbar.displayName = 'DataToolbar';
