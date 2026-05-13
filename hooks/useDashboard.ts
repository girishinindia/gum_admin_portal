'use client';

/**
 * Phase 14 — useDashboard hook.
 *
 * Wraps the 6 GET /admin/dashboards/* endpoints with React state +
 * refresh control. Handles loading, error, refetch, and 401 redirects
 * via the existing `request()` wrapper in lib/api.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import { apiRequest as request } from '@/lib/api';

export type DashboardKey = 'executive' | 'sales' | 'finance' | 'operations' | 'catalog' | 'engagement';

interface DashboardPayload<T = any> {
  data?:    T;
  message?: string;
  success?: boolean;
}

export function useDashboard<T = any>(key: DashboardKey, params: Record<string, string | number> = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  const path = `/admin/dashboards/${key}${qs ? `?${qs}` : ''}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await request<T>(path) as unknown as DashboardPayload<T>;
      if (res?.data) setData(res.data);
      else setError(res?.message ?? 'No data returned');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refresh: load };
}
