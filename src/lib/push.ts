import { supabase } from './supabase';
export type PushErrorCode =
  | 'pushConfiguration'
  | 'pushDenied'
  | 'pushNotReady'
  | 'pushSubscribeFailed'
  | 'pushSaveFailed';
export class PushSetupError extends Error {
  constructor(public code: PushErrorCode) {
    super(code);
  }
}
export const pushSupported = () =>
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;
export async function enablePush(userId: string) {
  if (
    !pushSupported() ||
    !navigator.onLine ||
    !import.meta.env.VITE_VAPID_PUBLIC_KEY
  )
    throw new PushSetupError('pushConfiguration');
  if ((await Notification.requestPermission()) !== 'granted')
    throw new PushSetupError('pushDenied');
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) throw new PushSetupError('pushNotReady');
  const existing = await registration.pushManager.getSubscription();
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  let publicKey: Uint8Array<ArrayBuffer>;
  try {
    const decoded = atob(
      (key + padding).replaceAll('-', '+').replaceAll('_', '/'),
    );
    publicKey = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
    if (publicKey.length !== 65 || publicKey[0] !== 4)
      throw new Error('Invalid key');
  } catch {
    throw new PushSetupError('pushConfiguration');
  }
  let subscription: PushSubscription;
  try {
    subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      }));
  } catch {
    throw new PushSetupError(
      Notification.permission === 'denied'
        ? 'pushDenied'
        : 'pushSubscribeFailed',
    );
  }
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys.auth)
    throw new PushSetupError('pushSubscribeFailed');
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    if (!existing) await subscription.unsubscribe().catch(() => {});
    throw new PushSetupError('pushSaveFailed');
  }
  const { error: settingsError } = await supabase
    .from('user_settings')
    .update({ push_enabled: true })
    .eq('user_id', userId);
  if (settingsError) throw new PushSetupError('pushSaveFailed');
}
export async function disablePush(userId: string) {
  try {
    localStorage.removeItem(`lembra-data:reminder-check:${userId}`);
  } catch {
    /* Storage can be disabled. */
  }
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
  if (error) throw error;
}
export async function pushEnabled() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.getRegistration();
  return !!(await registration?.pushManager.getSubscription());
}
