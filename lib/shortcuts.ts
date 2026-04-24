/**
 * Central keyboard shortcut registry.
 * Every shortcut used across the admin portal is defined here
 * so the help overlay can render them all.
 */

export interface ShortcutDef {
  /** The key (lowercase). For combos use modifier prefix: 'ctrl+n', 'shift+d' */
  key: string;
  /** Short human label shown in the help modal */
  label: string;
  /** Category for grouping in help modal */
  category: 'global' | 'crud' | 'pagination' | 'navigation' | 'material' | 'ai';
}

// ── Global ──────────────────────────────────────────
export const GLOBAL_SHORTCUTS: ShortcutDef[] = [
  { key: '/', label: 'Focus search', category: 'global' },
  { key: '?', label: 'Show keyboard shortcuts', category: 'global' },
  { key: 'r', label: 'Refresh data', category: 'global' },
  { key: 'Escape', label: 'Close dialog / modal', category: 'global' },
];

// ── CRUD pages ──────────────────────────────────────
export const CRUD_SHORTCUTS: ShortcutDef[] = [
  { key: 'n', label: 'Add new item', category: 'crud' },
  { key: 't', label: 'Toggle Active / Trash', category: 'crud' },
  { key: 'ctrl+a', label: 'Select all rows', category: 'crud' },
];

// ── Pagination ──────────────────────────────────────
export const PAGINATION_SHORTCUTS: ShortcutDef[] = [
  { key: 'ArrowRight', label: 'Next page', category: 'pagination' },
  { key: 'ArrowLeft', label: 'Previous page', category: 'pagination' },
];

// ── Navigation (G then …) ───────────────────────────
export const NAV_SHORTCUTS: ShortcutDef[] = [
  { key: 'g d', label: 'Go to Dashboard', category: 'navigation' },
  { key: 'g u', label: 'Go to Users', category: 'navigation' },
  { key: 'g c', label: 'Go to Categories', category: 'navigation' },
  { key: 'g s', label: 'Go to Subjects', category: 'navigation' },
  { key: 'g m', label: 'Go to Material Tree', category: 'navigation' },
];

// ── Material Tree ───────────────────────────────────
export const MATERIAL_SHORTCUTS: ShortcutDef[] = [
  { key: 'i', label: 'Open Import / Sync', category: 'material' },
  { key: 'v', label: 'Check Video Status', category: 'material' },
];

// ── AI ──────────────────────────────────────────────
export const AI_SHORTCUTS: ShortcutDef[] = [
  { key: 'ctrl+g', label: 'Open AI Generate', category: 'ai' },
];

/** All categories with display labels */
export const CATEGORY_LABELS: Record<ShortcutDef['category'], string> = {
  global: 'Global',
  crud: 'List / Table',
  pagination: 'Pagination',
  navigation: 'Navigation (G then ...)',
  material: 'Material Tree',
  ai: 'AI Actions',
};

/**
 * Format a key string for display based on OS.
 * e.g. 'ctrl+a' → '⌘ A' on Mac, 'Ctrl + A' on Windows
 */
export function formatKey(key: string, isMac: boolean): string {
  // Two-key sequences like 'g d'
  if (key.includes(' ') && !key.includes('+')) {
    const parts = key.split(' ');
    return parts.map(k => formatSingleKey(k, isMac)).join(' then ');
  }

  // Modifier combos like 'ctrl+a'
  if (key.includes('+')) {
    const parts = key.split('+');
    return parts.map(k => formatSingleKey(k.trim(), isMac)).join(isMac ? '' : ' + ');
  }

  return formatSingleKey(key, isMac);
}

function formatSingleKey(key: string, isMac: boolean): string {
  const map: Record<string, [string, string]> = {
    ctrl:       ['⌘', 'Ctrl'],
    alt:        ['⌥', 'Alt'],
    shift:      ['⇧', 'Shift'],
    escape:     ['Esc', 'Esc'],
    arrowright:  ['→', '→'],
    arrowleft:   ['←', '←'],
    arrowup:     ['↑', '↑'],
    arrowdown:   ['↓', '↓'],
    '/':        ['/', '/'],
    '?':        ['?', '?'],
  };

  const lower = key.toLowerCase();
  if (map[lower]) return isMac ? map[lower][0] : map[lower][1];
  return key.toUpperCase();
}
