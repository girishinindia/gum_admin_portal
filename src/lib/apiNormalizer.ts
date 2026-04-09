/* ================================================================
   API Response Normalizer

   The GrowUpMore API returns paginated lists in this shape:
     { success, message, data: { <entityKey>: [...], pagination: {...} } }

   e.g. for roles:
     { success: true, message: "Roles fetched", data: { roles: [...], pagination: { totalCount, pageIndex, pageSize } } }

   Our PaginatedResponse<T> type expects:
     { success, message, data: T[], pagination: { totalCount, pageIndex, pageSize } }

   This normalizer bridges the gap.
   ================================================================ */
import type { PaginatedResponse } from "@/types";

/**
 * Normalizes a raw API paginated response into our PaginatedResponse<T> shape.
 * Handles both formats:
 *   - Nested:  { success, message, data: { roles: [...], pagination: {...} } }
 *   - Flat:    { success, message, data: [...], pagination: {...} }
 *
 * @param raw - The raw response body from axios (after `const { data } = await api.get(...)`)
 * @param entityKey - The key inside `data` where the array lives (e.g. "roles", "users")
 */
export function normalizePaginatedResponse<T>(
  raw: Record<string, unknown>,
  entityKey: string
): PaginatedResponse<T> {
  const success = (raw.success as boolean) ?? false;
  const message = (raw.message as string) ?? "";

  // Case 1: data is already an array (flat format)
  if (Array.isArray(raw.data)) {
    return {
      success,
      message,
      data: raw.data as T[],
      pagination: (raw.pagination as PaginatedResponse<T>["pagination"]) ?? {
        totalCount: (raw.data as T[]).length,
        pageIndex: 1,
        pageSize: (raw.data as T[]).length,
      },
    };
  }

  // Case 2: data is an object with nested entity key
  const dataObj = (raw.data ?? {}) as Record<string, unknown>;

  // Try the explicit key first; fall back to auto-detecting the first array
  let items: T[];
  if (entityKey in dataObj && Array.isArray(dataObj[entityKey])) {
    items = dataObj[entityKey] as T[];
  } else {
    // Auto-detect: find the first array value that isn't "pagination"
    const autoKey = Object.keys(dataObj).find(
      (k) => k !== "pagination" && Array.isArray(dataObj[k])
    );
    items = autoKey ? (dataObj[autoKey] as T[]) : [];
    if (process.env.NODE_ENV !== "production" && !autoKey) {
      console.warn(`[apiNormalizer] Key "${entityKey}" not found in data. Keys:`, Object.keys(dataObj));
    }
  }

  const pagination = (dataObj.pagination ?? raw.pagination ?? {
    totalCount: items.length,
    pageIndex: 1,
    pageSize: items.length,
  }) as PaginatedResponse<T>["pagination"];

  return {
    success,
    message,
    data: items,
    pagination,
  };
}

/**
 * Normalizes a single-entity API response.
 * Handles: { success, message, data: { user: {...} } }  →  { success, message, data: T }
 */
export function normalizeEntityResponse<T>(
  raw: Record<string, unknown>,
  entityKey: string
): { success: boolean; message: string; data: T } {
  const success = (raw.success as boolean) ?? false;
  const message = (raw.message as string) ?? "";
  const dataObj = raw.data as Record<string, unknown> | undefined;

  // If data contains the entity key, unwrap it; otherwise use data directly
  const entity = (dataObj && entityKey in dataObj
    ? dataObj[entityKey]
    : raw.data) as T;

  return { success, message, data: entity };
}
