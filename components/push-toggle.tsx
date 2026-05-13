'use client';

/**
 * Phase 11.2.7 — Push notifications opt-in/opt-out toggle.
 *
 * Drop this anywhere in the admin shell (navbar bell-icon, settings page).
 * It auto-detects browser support and current permission state, hides
 * itself silently on unsupported browsers, and gives the user a single
 * click to subscribe or unsubscribe.
 */

import { useCallback, useEffect, useState } from 'react';
import { enablePush, disablePush, pushStatus, pushSupported } from '@/lib/push';
import { tokens } from '@/lib/api';

type State = 'idle' | 'subscribing' | 'subscribed' | 'denied' | 'unsupported';

export function PushToggle({ className }: { className?: string }) {
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (!pushSupported()) { setState('unsupported'); return; }
    const s = pushStatus();
    if (s === 'granted')      setState('subscribed');
    else if (s === 'denied')  setState('denied');
    else                       setState('idle');
  }, []);

  const toggle = useCallback(async () => {
    const token = tokens.access;
    if (!token) return;

    if (state === 'subscribed') {
      await disablePush(token);
      setState('idle');
      return;
    }

    setState('subscribing');
    try {
      const result = await enablePush(token);
      setState(result === 'subscribed' ? 'subscribed' : result === 'denied' ? 'denied' : 'unsupported');
    } catch (e) {
      console.error('[PushToggle] enablePush failed', e);
      setState('idle');
    }
  }, [state]);

  if (state === 'unsupported') return null;

  const label =
    state === 'subscribed' ? 'Disable notifications' :
    state === 'denied'      ? 'Notifications blocked' :
    state === 'subscribing' ? 'Enabling…'             :
                              'Enable notifications';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === 'subscribing' || state === 'denied'}
      className={className ?? 'inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50'}
      aria-pressed={state === 'subscribed'}
      title={label}
    >
      <span aria-hidden>{state === 'subscribed' ? '🔔' : '🔕'}</span>
      <span>{label}</span>
    </button>
  );
}
