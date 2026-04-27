"use client";

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'gum_page_size';
const DEFAULT_PAGE_SIZE = 10;
const VALID_SIZES = [10, 20, 50, 100];

/**
 * Custom hook that persists page size selection in localStorage.
 * SSR-safe: reads from localStorage after mount to avoid hydration mismatch.
 * Global: changing page size on any page applies everywhere.
 */
export function usePageSize(defaultSize: number = DEFAULT_PAGE_SIZE): [number, (size: number) => void] {
  const [pageSize, setPageSizeState] = useState(defaultSize);

  // Read from localStorage after mount (SSR-safe)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = Number(stored);
        if (VALID_SIZES.includes(parsed)) {
          setPageSizeState(parsed);
        }
      }
    } catch {
      // localStorage not available (SSR or private browsing)
    }
  }, []);

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
