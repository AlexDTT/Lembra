import { service, authorize, checked, respond } from '../_shared/worker.ts';
import { deliverPush } from '../_shared/push-delivery.ts';
import { carePt, careEn } from '../../../src/i18n/care.ts';
Deno.serve(async (request: Request) => {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  if (!auth.userId) return respond(403);
  let stage = 'invalid_request';
  try {
    const body: unknown = await request.json();
    if (
      !body ||
      typeof body !== 'object' ||
      !('endpoint' in body) ||
      typeof body.endpoint !== 'string' ||
      body.endpoint.length > 4096
    )
      return respond(400);
    stage = 'subscription_lookup_failed';
    const { data: subscription, error } = await service
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('endpoint', body.endpoint)
      .maybeSingle();
    checked(error);
    if (!subscription)
      return respond(404, { sent: false, error: 'subscription_not_found' });
    if (
      !Deno.env.get('VAPID_PUBLIC_KEY') ||
      !Deno.env.get('VAPID_PRIVATE_KEY') ||
      !Deno.env.get('VAPID_SUBJECT')
    )
      return respond(503, { sent: false, error: 'push_not_configured' });
    stage = 'push_delivery_failed';
    const copy = 'locale' in body && body.locale === 'en' ? careEn : carePt;
    const response = await deliverPush(subscription, {
      title: copy.testTitle,
      body: copy.testBody,
      tag: `test:${crypto.randomUUID()}`,
      url: '/settings',
    });
    if (!response.ok) {
      console.error('Test push rejected', { push_status: response.status });
      return respond(503, {
        sent: false,
        error: 'push_service_rejected',
        push_status: response.status,
      });
    }
    return respond(200, { sent: true });
  } catch {
    console.error('Test reminder failed', { error: stage });
    return respond(stage === 'invalid_request' ? 400 : 503, {
      sent: false,
      error: stage,
    });
  }
});
