"use client";
import { useEffect, useRef, useCallback } from 'react';

export interface ShortcutBinding {
  /** Key to listen for. Lowercase single key, or 'ctrl+k', 'shift+n', 'g d' for sequences */
  key: string;
  /** Action to execute */
  action: () => void;
  /** If true, fires even when typing in an input/textarea/select (default: false) */
  allowInInput?: boolean;
}

/**
 * Registers keyboard shortcuts for the current page.
 * - Ignores keystrokes inside input/textarea/select unless allowInInput is true
 * - Supports modifier combos: 'ctrl+n' (uses Cmd on Mac automatically)
 * - Supports two-key sequences: 'g d' (press G, then D within 1s)
 */
export function useKeyboardShortcuts(shortcuts: ShortcutBinding[]) {
  const pendingSequence = useRef<string | null>(null);
  const sequenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        if (isInput && !shortcut.allowInInput) continue;

        const key = shortcut.key.toLowerCase();

        // ── Two-key sequence (e.g. 'g d') ──
        if (key.includes(' ') && !key.includes('+')) {
          const [first, second] = key.split(' ');

          // If we're waiting for the second key
          if (pendingSequence.current === first && e.key.toLowerCase() === second && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            pendingSequence.current = null;
            if (sequenceTimer.current) clearTimeout(sequenceTimer.current);
            shortcut.action();
            return;
          }
          continue; // Don't match single-key logic
        }

        // ── Modifier combo (e.g. 'ctrl+a') ──
        if (key.includes('+')) {
          const parts = key.split('+');
          const mainKey = parts[parts.length - 1];
          const needsCtrl = parts.includes('ctrl');
          const needsShift = parts.includes('shift');
          const needsAlt = parts.includes('alt');

          const ctrlOrMeta = e.ctrlKey || e.metaKey;

          if (
            e.key.toLowerCase() === mainKey &&
            (!needsCtrl || ctrlOrMeta) &&
            (!needsShift || e.shiftKey) &&
            (!needsAlt || e.altKey)
          ) {
            e.preventDefault();
            shortcut.action();
            return;
          }
          continue;
        }

        // ── Simple single key ──
        if (e.ctrlKey || e.metaKey || e.altKey) continue;

        if (e.key === key || e.key.toLowerCase() === key) {
          // Check if this key is the start of any two-key sequence
          const isSequenceStart = shortcuts.some(s => {
            const k = s.key.toLowerCase();
            return k.includes(' ') && !k.includes('+') && k.split(' ')[0] === key;
          });

          if (isSequenceStart) {
            // Start sequence — record the first key and wait for second
            pendingSequence.current = key;
            if (sequenceTimer.current) clearTimeout(sequenceTimer.current);
            sequenceTimer.current = setTimeout(() => {
              // Timeout — fire the single-key shortcut if it exists
              pendingSequence.current = null;
            }, 1000);
            // Don't fire the single-key action yet if there's a pending sequence
            // But if no simple-key shortcut matches this key, just record and return
            return;
          }

          e.preventDefault();
          shortcut.action();
          return;
        }
      }

      // Record potential first key for sequences
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !isInput) {
        const asStart = e.key.toLowerCase();
        const isSequenceStart = shortcuts.some(s => {
          const k = s.key.toLowerCase();
          return k.includes(' ') && !k.includes('+') && k.split(' ')[0] === asStart;
        });
        if (isSequenceStart) {
          pendingSequence.current = asStart;
          if (sequenceTimer.current) clearTimeout(sequenceTimer.current);
          sequenceTimer.current = setTimeout(() => {
            pendingSequence.current = null;
          }, 1000);
        } else {
          pendingSequence.current = null;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      if (sequenceTimer.current) clearTimeout(sequenceTimer.current);
    };
  }, [handler]);
}
