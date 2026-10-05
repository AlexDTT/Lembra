import { deliverPush } from '../_shared/push-delivery.ts';
import { carePt, careEn } from '../../../src/i18n/care.ts';
import { service, authorize, checked, respond } from '../_shared/worker.ts';
import { careReminders, safePushEndpoint } from '../_shared/due-reminders.ts';
import { productPt, productEn } from '../../../src/i18n/product.ts';
Deno.serve(async (request: Request) => {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY'),
    privateKey = Deno.env.get('VAPID_PRIVATE_KEY'),
    subject = Deno.env.get('VAPID_SUBJECT');
  if (!publicKey || !privateKey || !subject)
    return respond(503, { error: 'not_configured' });
  const owner = crypto.randomUUID();
  let locked = false;
  let sent = 0;
  try {
    const { data: claim, error: claimError } = await service.rpc(
      'claim_worker',
      { p_name: 'send-reminders', p_owner: owner },
    );
    checked(claimError);
    if (!claim) return respond(202, { busy: true });
    locked = true;
    let query = service
      .from('user_settings')
      .select('user_id,locale')
      .eq('push_enabled', true);
    if (auth.userId) query = query.eq('user_id', auth.userId);
    const { data: users, error: usersError } = await query;
    checked(usersError);
    const now = new Date();
    const deadline = Date.now() + 70000;
    for (const user of users || []) {
      const [
        { data: events, error: eventError },
        { data: subscriptions, error: subError },
        { data: snoozes, error: snoozeError },
      ] = await Promise.all([
        service
          .from('events')
          .select('*')
          .eq('user_id', user.user_id)
          .eq('active', true)
          .order('id'),
        service
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', user.user_id),
        service
          .from('dose_snoozes')
          .select('*')
          .eq('user_id', user.user_id)
          .gte('remind_at', new Date(now.getTime() - 5 * 60000).toISOString()),
      ]);
      checked(eventError);
      checked(subError);
      checked(snoozeError);
      const care = user.locale === 'en' ? careEn : carePt;
      const refillGroups = new Set<string>();
      const copy = user.locale === 'en' ? productEn : productPt;
      for (const event of events || []) {
        const group = event.group_id || event.id;
        const includeRefill = !refillGroups.has(group);
        refillGroups.add(group);
        for (const { occurrence, lead, kind } of careReminders(
          event,
          now,
          (snoozes || []).filter((s) => s.event_id === event.id),
          includeRefill,
        )) {
          if (Date.now() > deadline) return respond(200, { sent });
          const { data: completion, error: completeError } = await service
            .from('event_completions')
            .select('id')
            .eq('event_id', event.id)
            .eq('user_id', user.user_id)
            .eq('occurrence_at', occurrence.toISOString())
            .maybeSingle();
          checked(completeError);
          if (completion && kind !== 'refill') continue;
          for (const subscription of subscriptions || []) {
            if (!safePushEndpoint(subscription.endpoint)) continue;
            const { data: claimed, error } = await service.rpc(
              'claim_reminder',
              {
                p_user_id: user.user_id,
                p_event_id: event.id,
                p_subscription_id: subscription.id,
                p_occurrence_at: occurrence.toISOString(),
                p_lead_minutes: lead,
              },
            );
            checked(error);
            if (!claimed) continue;
            const time = new Intl.DateTimeFormat(
              user.locale === 'en' ? 'en' : 'pt-PT',
              {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: event.timezone,
              },
            ).format(occurrence);
            const payload = {
              title:
                kind === 'refill'
                  ? care.refillTitle
                  : kind === 'followup' || kind === 'snooze'
                    ? care.notRecorded
                    : copy[
                        event.type === 'medication'
                          ? 'pushMedication'
                          : event.type === 'bill'
                            ? 'pushBill'
                            : 'pushAppointment'
                      ],
              body: [
                event.title,
                kind === 'refill' ? care.refillHelp : event.dose,
                time,
              ]
                .filter(Boolean)
                .join(' · '),
              tag: `${event.id}:${occurrence.toISOString()}:${lead}`,
              url:
                kind === 'refill'
                  ? '/medications'
                  : `/items/${event.id}?at=${encodeURIComponent(occurrence.toISOString())}`,
            };
            try {
              const response = await deliverPush(subscription, payload);
              if (response.status === 404 || response.status === 410) {
                const { error } = await service
                  .from('push_subscriptions')
                  .delete()
                  .eq('id', subscription.id);
                checked(error);
                continue;
              }
              if (!response.ok) continue;
              const { error: sentError } = await service
                .from('reminder_deliveries')
                .update({ sent_at: new Date().toISOString() })
                .eq('event_id', event.id)
                .eq('subscription_id', subscription.id)
                .eq('occurrence_at', occurrence.toISOString())
                .eq('lead_minutes', lead);
              checked(sentError);
              const { error: statusError } = await service
                .from('integration_status')
                .upsert({
                  user_id: user.user_id,
                  push_last_success: new Date().toISOString(),
                });
              checked(statusError);
              sent++;
            } catch {
              /* Leave the unsent lease to expire for retry, without logging health data. */
            }
          }
        }
      }
    }
    return respond(200, { sent });
  } catch {
    return respond(500, { error: 'temporarily_unavailable' });
  } finally {
    if (locked)
      await service
        .from('worker_leases')
        .delete()
        .eq('name', 'send-reminders')
        .eq('owner', owner);
  }
});
