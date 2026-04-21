"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Search, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
  searchPlaceholder?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  label,
  className,
  searchPlaceholder = 'Search...',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected option label
  const selectedOption = options.find(o => String(o.value) === String(value));

  // Filtered options
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleSelect = useCallback((val: string | number) => {
    onChange(String(val));
    setOpen(false);
    setSearch('');
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setSearch('');
  }, [onChange]);

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      )}
      <div ref={containerRef} className={cn('relative', className)}>
        {/* Trigger button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => { if (!disabled) setOpen(!open); }}
          className={cn(
            'w-full h-10 px-3 pr-16 text-sm rounded-lg border bg-white text-left transition-colors flex items-center',
            'border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none',
            disabled && 'bg-slate-50 text-slate-400 cursor-not-allowed',
            !disabled && 'cursor-pointer hover:border-slate-300',
            open && 'border-brand-500 ring-2 ring-brand-500/20'
          )}
        >
          <span className={cn('truncate flex-1', !selectedOption && 'text-slate-400')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            {value && !disabled && (
              <span
                onClick={handleClear}
                className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')} />
          </div>
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {/* Search input */}
            {options.length > 5 && (
              <div className="p-2 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                  />
                </div>
              </div>
            )}

            {/* Options list */}
            <div className="max-h-52 overflow-y-auto">
              {/* Placeholder option for clearing */}
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={cn(
                  'w-full px-3 py-2 text-sm text-left transition-colors',
                  !value ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-400 hover:bg-slate-50'
                )}
              >
                {placeholder}
              </button>

              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-400 text-center">No results found</div>
              ) : (
                filtered.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'w-full px-3 py-2 text-sm text-left transition-colors',
                      String(opt.value) === String(value)
                        ? 'bg-brand-50 text-brand-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
