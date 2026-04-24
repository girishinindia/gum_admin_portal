"use client";
import { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ShortcutDef,
  GLOBAL_SHORTCUTS,
  CRUD_SHORTCUTS,
  PAGINATION_SHORTCUTS,
  NAV_SHORTCUTS,
  MATERIAL_SHORTCUTS,
  AI_SHORTCUTS,
  CATEGORY_LABELS,
  formatKey,
} from '@/lib/shortcuts';
import { usePathname } from 'next/navigation';

/** Pages that have CRUD table operations */
const CRUD_PAGES = [
  '/categories', '/sub-categories', '/subjects', '/chapters', '/topics', '/sub-topics',
  '/countries', '/states', '/cities', '/skills', '/languages', '/education-levels',
  '/document-types', '/documents', '/designations', '/specializations', '/learning-goals',
  '/social-medias', '/branches', '/departments', '/branch-departments', '/users',
  '/roles', '/permissions', '/activity-logs',
  '/category-translations', '/sub-category-translations',
  '/subject-translations', '/chapter-translations', '/topic-translations', '/sub-topic-translations',
];

/** Pages with AI generate */
const AI_PAGES = [
  '/categories', '/sub-categories', '/subjects', '/chapters', '/topics', '/sub-topics',
  '/countries', '/states', '/cities', '/skills', '/languages', '/education-levels',
  '/document-types', '/documents', '/designations', '/specializations', '/learning-goals',
  '/social-medias', '/branches', '/departments',
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMac(navigator.platform?.toLowerCase().includes('mac') || navigator.userAgent?.toLowerCase().includes('mac'));
  }, []);

  // Listen for '?' key to toggle help
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      if (isInput) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Build list of applicable shortcut groups for current page
  const groups: { category: ShortcutDef['category']; items: ShortcutDef[] }[] = [];

  groups.push({ category: 'global', items: GLOBAL_SHORTCUTS });

  if (CRUD_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    groups.push({ category: 'crud', items: CRUD_SHORTCUTS });
    groups.push({ category: 'pagination', items: PAGINATION_SHORTCUTS });
  }

  groups.push({ category: 'navigation', items: NAV_SHORTCUTS });

  if (pathname === '/material-tree') {
    groups.push({ category: 'material', items: MATERIAL_SHORTCUTS });
  }

  if (AI_PAGES.some(p => pathname === p)) {
    groups.push({ category: 'ai', items: AI_SHORTCUTS });
  }

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full shadow-lg',
          'bg-white border border-slate-200 text-slate-500',
          'hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200',
          'transition-all hover:scale-105 active:scale-95',
          'flex items-center justify-center'
        )}
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      {/* Help modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-slide-up">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
                  <Keyboard className="w-5 h-5 text-brand-600" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">Keyboard Shortcuts</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isMac ? 'Showing Mac shortcuts' : 'Showing Windows shortcuts'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
              {groups.map(group => (
                <div key={group.category}>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    {CATEGORY_LABELS[group.category]}
                  </h3>
                  <div className="space-y-1">
                    {group.items.map(shortcut => (
                      <div
                        key={shortcut.key}
                        className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <span className="text-sm text-slate-700">{shortcut.label}</span>
                        <kbd
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-medium',
                            'bg-slate-100 text-slate-600 border border-slate-200 shadow-sm'
                          )}
                        >
                          {formatKey(shortcut.key, isMac)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-400">
                Press <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono text-[11px] border border-slate-200">?</kbd> anytime to toggle this panel
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
