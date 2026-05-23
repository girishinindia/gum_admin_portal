"use client";
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
  width?: string;
  className?: string;
}

// Phase 45 — the menu is rendered into document.body via a portal with fixed
// positioning anchored to the trigger. Previously it was `absolute`, so any
// ancestor with `overflow-x-auto`/`overflow-hidden` (e.g. scrollable tables)
// clipped it — the menu was only visible after horizontally scrolling. A
// body-level portal escapes every clipping container.
export function Dropdown({ trigger, children, align = 'right', width = 'w-72', className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Phase 48 — measure menu height after first render; if it would overflow
  // below the viewport, flip it upward (above the trigger). This prevents
  // the last-row dropdown in scrollable tables from being clipped.
  const computeCoords = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight || 200; // estimate if not yet measured
    const gap = 8;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const fitsBelow = spaceBelow >= menuH;
    const top = fitsBelow ? r.bottom + gap : r.top - gap - menuH;
    if (align === 'right') setCoords({ top, right: Math.max(8, window.innerWidth - r.right) });
    else setCoords({ top, left: r.left });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    computeCoords();
    // Re-compute after one frame so menuRef has real height for flip logic
    const raf = requestAnimationFrame(() => computeCoords());
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    function reposition() { computeCoords(); }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, computeCoords]);

  return (
    <div ref={triggerRef} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className="focus:outline-none">
        {trigger}
      </button>
      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: coords.top, left: coords.left, right: coords.right }}
          className={cn(
            'z-[100] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-slide-up',
            width,
            className
          )}
          // Close the menu after an item is chosen (the item's own onClick fires first via bubbling).
          onClick={() => setOpen(false)}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

export function DropdownItem({ onClick, icon: Icon, danger, children }: { onClick?: () => void; icon?: any; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors',
        danger
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
      )}
    >
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="h-px bg-slate-100 my-1" />;
}
