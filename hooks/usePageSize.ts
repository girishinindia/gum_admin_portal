"use client";

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'gum_page_size';
const DEFAULT_PAGE_SIZE = 10;
const VALID_SIZES = [10, 20, 50, 100];

/**
 * Read stored page size from localStorage.
 * Safe to call during SSR (returns defaultSize when window is undefined).
 */
function getStoredSize(defaultSize: number): number {
  if (typeof window === 'undefined') return defaultSize;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (VALID_SIZES.includes(parsed)) return parsed;
    }
  } catch {
    // localStorage not available
  }
  return defaultSize;
}

/**
 * Custom hook that persists page size selection in localStorage.
 * Uses lazy initializer to read stored value synchronously on mount,
 * avoiding a double-fetch race condition where the first load uses
 * the default size before the stored value is applied.
 * Global: changing page size on any page applies everywhere.
 */
export function usePageSize(defaultSize: number = DEFAULT_PAGE_SIZE): [number, (size: number) => void] {
  const [pageSize, setPageSizeState] = useState(() => getStoredSize(defaultSize));

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    try {
      localStorage.setItem(STORAGE_KEY, String(size));
    } catch {
      // localStorage not available
    }
  }, []);

  return [pageSize, setPageSize];
}
