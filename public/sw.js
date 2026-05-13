/* eslint-disable no-restricted-globals */
/**
 * GrowUpMore Admin — Service Worker
 * Phase 11.2.7 (Web Push)
 *
 * Responsibilities:
 *   • Receive encrypted Web Push payloads, decrypt, and call
 *     `self.registration.showNotification(...)`.
 *   • Handle the `notificationclick` event by focussing an existing tab
 *     (if the same URL is already open) or opening a new one.
 *
 * IMPORTANT: This file is served from the site origin and registered
 * with `navigator.serviceWorker.register('/sw.js')` from `lib/push.ts`.
 * Keep it dependency-free — service workers don't have a build step.
 */

self.addEventListener('install', (event) => {
  // Activate immediately on first install so users don't have to refresh
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: 'GrowUpMore', body: event.data.text() }; }

  const title = payload.title || 'GrowUpMore';
  const options = {
    body:   payload.body  || '',
    icon:   payload.icon  || '/icons/notification.png',
    badge:  payload.badge || '/icons/badge.png',
    tag:    payload.tag,
    data: {
      url:  payload.url   || '/',
      ...(payload.data || {}),
    },
    // Group same-tag notifications instead of stacking
    renotify: true,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // If a tab is already on the target URL, focus it
    for (const client of all) {
      if (client.url.includes(targetUrl) && 'focus' in client) {
        return client.focus();
      }
    }
    // Otherwise open a new tab
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
