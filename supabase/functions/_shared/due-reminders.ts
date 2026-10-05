import { fromZonedTime } from 'date-fns-tz';
import {
  occurrencesBetween,
  type RecurringEvent,
} from '../../../src/lib/recurrence.ts';
export function dueReminders(
  event: RecurringEvent & { reminder_minutes: number[] },
  now: Date,
) {
  return [...new Set(event.reminder_minutes)].flatMap((lead) =>
    occurrencesBetween(
      event,
      new Date(now.getTime() - 5 * 60000 + lead * 60000),
      new Date(now.getTime() + lead * 60000),
    ).map((occurrence) => ({ lead, occurrence })),
  );
}
export function safePushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === 'fcm.googleapis.com' ||
        url.hostname.endsWith('.push.services.mozilla.com') ||
        url.hostname === 'web.push.apple.com' ||
        url.hostname.endsWith('.notify.windows.com'))
    );
  } catch {
    return false;
  }
}

export type CareReminder = {
  occurrence: Date;
  lead: number;
  kind: 'normal' | 'followup' | 'snooze' | 'refill';
};
export function careReminders(
  event: RecurringEvent & {
    reminder_minutes: number[];
    followup_minutes?: number | null;
    refill_on?: string | null;
    refill_reminder_days?: number;
  },
  now: Date,
  snoozes: { occurrence_at: string; remind_at: string }[] = [],
  includeRefill = true,
): CareReminder[] {
  const isDue = (time: Date) =>
    time <= now && time.getTime() >= now.getTime() - 5 * 60000;
  const postponed = (occurrence: Date) =>
    snoozes.some(
      (s) =>
        new Date(s.occurrence_at).getTime() === occurrence.getTime() &&
        new Date(s.remind_at).getTime() >= now.getTime() - 5 * 60000,
    );
  const reminders: CareReminder[] = dueReminders(event, now)
    .filter((r) => !postponed(r.occurrence))
    .map((r) => ({ ...r, kind: 'normal' }));
  if (event.followup_minutes) {
    for (const r of dueReminders(
      { ...event, reminder_minutes: [-event.followup_minutes] },
      now,
    ))
      if (!postponed(r.occurrence)) reminders.push({ ...r, kind: 'followup' });
  }
  for (const snooze of snoozes) {
    const occurrence = new Date(snooze.occurrence_at),
      remindAt = new Date(snooze.remind_at);
    if (
      isDue(remindAt) &&
      occurrencesBetween(event, occurrence, occurrence).length
    )
      reminders.push({
        occurrence,
        lead: -Math.floor(remindAt.getTime() / 60000),
        kind: 'snooze',
      });
  }
  if (includeRefill && event.refill_on && event.active !== false) {
    // The refill clock is independent of the medication's dose schedule.
    const occurrence = fromZonedTime(
      `${event.refill_on}T09:00:00`,
      event.timezone,
    );
    const days = event.refill_reminder_days ?? 3;
    const local = new Date(`${event.refill_on}T12:00:00Z`);
    local.setUTCDate(local.getUTCDate() - days);
    const reminder = fromZonedTime(
      `${local.toISOString().slice(0, 10)}T09:00:00`,
      event.timezone,
    );
    if (isDue(reminder))
      reminders.push({ occurrence, lead: -20000 - days, kind: 'refill' });
  }
  return reminders;
}
