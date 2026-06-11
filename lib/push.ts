/**
 * Phase 11.2.7 — Web Push client helper (Next.js admin portal).
 *
 * Three exported functions:
 *
 *   - `pushSupported()`           — feature-detect on the current browser
 *   - `pushStatus()`              — return one of `'granted' | 'denied' | 'default' | 'unsupported'`
 *   - `enablePush()`              — request permission, register SW, subscribe, POST to API
 *   - `disablePush()`             — unsubscribe locally, tell API to forget the device
 *
 * Designed to be safe to call from server components (every function
 * short-circuits when `window` is undefined).
 */

import type { ApiResponse } from './types';
import { API_URL } from './api'; // single source of truth (Phase 7)

// ── Feature detect ──────────────────────────────────────────────
export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function pushStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission;
}

// ── Helpers ─────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(safe);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function fetchVapidPublicKey(): Promise<string> {
  const res = await fetch(`${API_URL}/push/vapid-public-key`, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to fetch VAPID public key');
  const body = (await res.json()) as ApiResponse<{ vapidPublicKey: string }>;
  const key = body.data?.vapidPublicKey;
  if (!key) throw new Error('VAPID public key missing from response');
  return key;
}

async function postSubscription(sub: PushSubscription, token: string): Promise<void> {
  const json: any = sub.toJSON();
  const res = await fetch(`${API_URL}/push-devices/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys:     { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      user_agent: navigator.userAgent,
      platform: 'web',
    }),
  });
  if (!res.ok) throw new Error('Failed to register push device');
}

async function deleteSubscription(endpoint: string, token: string): Promise<void> {
  await fetch(`${API_URL}/push-devices/${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Public API ──────────────────────────────────────────────────

/**
 * Walk the user through the full opt-in flow:
 *   1. ensure the browser supports push,
 *   2. register `/sw.js` if not already registered,
 *   3. prompt for notification permission,
 *   4. call `PushManager.subscribe` with the VAPID public key,
 *   5. POST the subscription to the API.
 *
 * @param accessToken  Bearer token for the authenticated user.
 * @returns `'subscribed'` on success, `'denied'` if the user blocked,
 *          `'unsupported'` if the browser can't do push at all.
 */
export async function enablePush(accessToken: string): Promise<'subscribed' | 'denied' | 'unsupported'> {
  if (!pushSupported()) return 'unsupported';
  if (!accessToken)    throw new Error('enablePush requires an access token');

  // Register or reuse the SW
  const reg =
    (await navigator.serviceWorker.getRegistration('/sw.js')) ??
    (await navigator.serviceWorker.register('/sw.js'));

  // Prompt the user
  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') return 'denied';

  // Reuse existing subscription if there is one; otherwise create a new one
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const vapidPublic = await fetchVapidPublicKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // PushManager.subscribe accepts `BufferSource` — cast to satisfy the
      // tightened lib.dom.d.ts type (Uint8Array<ArrayBufferLike> vs ArrayBuffer).
      applicationServerKey: urlBase64ToUint8Array(vapidPublic) as unknown as BufferSource,
    });
  }

  await postSubscription(sub, accessToken);
  return 'subscribed';
}

/**
 * Unsubscribe locally and tell the API to deactivate the device row.
 */
export async function disablePush(accessToken: string): Promise<void> {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  if (accessToken) await deleteSubscription(endpoint, accessToken);
}
