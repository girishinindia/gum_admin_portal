"use client";

import { Button } from './Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  total?: number;
  showingCount?: number;
}

export const Pagination = ({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  total,
  showingCount,
}: PaginationProps) => {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    const halfWindow = Math.floor(maxVisiblePages / 2);

    let startPage = Math.max(1, page - halfWindow);
    let endPage = Math.min(totalPages, page + halfWindow);

    if (endPage - startPage < maxVisiblePages - 1) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
    }

    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) pages.push('...');
    }

    for (let i = startPage; i <= endPage; i++) pages.push(i);

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      {/* Left side: page size selector + info */}
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className={cn(
                'h-8 px-2 pr-7 text-xs rounded-lg border border-slate-200 bg-white',
                'text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
                'appearance-none cursor-pointer',
                'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20viewBox%3D%270%200%2020%2020%27%20fill%3D%27%2394a3b8%27%3E%3Cpath%20fill-rule%3D%27evenodd%27%20d%3D%27M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%27%20clip-rule%3D%27evenodd%27/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_4px_center] bg-no-repeat'
              )}
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        <span className="text-xs text-slate-500">
          {total !== undefined && showingCount !== undefined
            ? `Showing ${showingCount} of ${total}`
            : `Page ${page} of ${totalPages}`}
        </span>
      </div>

      {/* Right side: page navigation */}
      {totalPages > 1 && (
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>

          <div className="flex gap-1">
            {pageNumbers.map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="text-sm text-slate-400 px-1">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange(p as number)}
                  className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${
                    page === p
                      ? 'bg-brand-500 text-white'
                      : 'text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

Pagination.displayName = 'Pagination';
