// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';
import { safePushEndpoint } from './due-reminders.ts';
export async function deliverPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: object,
) {
  if (!safePushEndpoint(subscription.endpoint))
    throw new Error('Invalid endpoint');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY'),
    privateKey = Deno.env.get('VAPID_PRIVATE_KEY'),
    subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject)
    throw new Error('Push not configured');
  const details = webpush.generateRequestDetails(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
    {
      vapidDetails: { publicKey, privateKey, subject },
      TTL: 300,
      urgency: 'high',
    },
  );
  return fetch(details.endpoint, {
    method: details.method,
    headers: Object.fromEntries(
      Object.entries(details.headers).map(([key, value]) => [
        key,
        String(value),
      ]),
    ),
    body: details.body ? new Uint8Array(details.body) : null,
    signal: AbortSignal.timeout(10000),
    redirect: 'error',
  });
}
