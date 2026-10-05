/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();
self.addEventListener('install', () => {
  void self.skipWaiting();
});
const shell = createHandlerBoundToURL('/index.html');
self.addEventListener('fetch', (event) => {
  if (
    event.request.mode === 'navigate' &&
    new URL(event.request.url).origin === self.location.origin
  ) {
    event.respondWith(
      shell({ event, request: event.request, url: new URL(event.request.url) }),
    );
  }
});
self.addEventListener('push', (event) => {
  let payload: unknown;
  try {
    payload = event.data?.json();
  } catch {
    return;
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('title' in payload) ||
    typeof payload.title !== 'string' ||
    !('body' in payload) ||
    typeof payload.body !== 'string'
  )
    return;
  const tag =
    'tag' in payload && typeof payload.tag === 'string'
      ? payload.tag
      : undefined;
  event.waitUntil(
    self.registration.showNotification(payload.title.slice(0, 160), {
      body: payload.body.slice(0, 500),
      tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: {
        url: safeNotificationUrl('url' in payload ? payload.url : undefined),
      },
    }),
  );
});
function safeNotificationUrl(value: unknown) {
  try {
    if (typeof value !== 'string') return '/';
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin &&
      (url.pathname === '/' ||
        /^\/items\/[0-9a-f-]{36}$/.test(url.pathname) ||
        url.pathname === '/medications' ||
        url.pathname === '/settings')
      ? url.pathname + url.search + url.hash
      : '/';
  } catch {
    return '/';
  }
}
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = safeNotificationUrl(event.notification.data?.url);
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await (existing as WindowClient).navigate(url);
        await (existing as WindowClient).focus();
      } else await self.clients.openWindow(url);
    })(),
  );
});
