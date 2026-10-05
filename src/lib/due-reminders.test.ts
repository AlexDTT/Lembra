import { expect, it } from 'vitest';
import {
  dueReminders,
  careReminders,
  safePushEndpoint,
} from '../../supabase/functions/_shared/due-reminders';
it('finds each configured lead time without sending future or stale reminders', () => {
  const event = {
    starts_at: '2026-09-30T08:00:00Z',
    rrule: null,
    timezone: 'Europe/Lisbon',
    reminder_minutes: [60, 0, 60],
  };
  expect(
    dueReminders(event, new Date('2026-09-30T07:00:00Z')).map((r) => r.lead),
  ).toEqual([60]);
  expect(dueReminders(event, new Date('2026-09-30T06:59:00Z'))).toHaveLength(0);
  expect(dueReminders(event, new Date('2026-09-30T07:06:00Z'))).toHaveLength(0);
  expect(
    dueReminders(event, new Date('2026-09-30T08:00:00Z')).map((r) => r.lead),
  ).toEqual([0]);
});
it('cannot turn push endpoints into server-side requests to arbitrary URLs', () => {
  expect(safePushEndpoint('https://fcm.googleapis.com/fcm/send/test')).toBe(
    true,
  );
  for (const endpoint of [
    'http://fcm.googleapis.com/test',
    'https://localhost',
    'https://fcm.googleapis.com.evil.example/test',
    'https://fcm.googleapis.com:444/test',
    'https://user:pass@fcm.googleapis.com/test',
  ])
    expect(safePushEndpoint(endpoint)).toBe(false);
});

it('optional follow-ups and snoozes use independent delivery keys and respect future snoozes', () => {
  const event = {
    type: 'medication',
    starts_at: '2026-01-01T08:00:00Z',
    rrule: 'FREQ=DAILY',
    timezone: 'Europe/Lisbon',
    reminder_minutes: [0],
    followup_minutes: 30,
  };
  expect(
    careReminders(event, new Date('2026-01-01T08:30:00Z')).map((r) => r.kind),
  ).toEqual(['followup']);
  const snooze = {
    occurrence_at: '2026-01-01T08:00:00Z',
    remind_at: '2026-01-01T08:40:00Z',
  };
  expect(
    careReminders(event, new Date('2026-01-01T08:30:00Z'), [snooze]),
  ).toEqual([]);
  const due = careReminders(event, new Date('2026-01-01T08:40:00Z'), [snooze]);
  expect(due.map((r) => r.kind)).toEqual(['snooze']);
  expect(due[0].lead).not.toBe(-30);
  expect(
    careReminders(event, new Date('2026-01-01T08:46:00Z'), [snooze]),
  ).toEqual([]);
});
it('refill reminders use the local calendar day across DST and only one dose per group', () => {
  const event = {
    type: 'medication',
    starts_at: '2026-01-01T08:00:00Z',
    rrule: 'FREQ=DAILY',
    timezone: 'Europe/Lisbon',
    reminder_minutes: [0],
    refill_on: '2026-10-26',
    refill_reminder_days: 3,
  };
  const now = new Date('2026-10-23T08:00:00Z');
  expect(
    careReminders(event, now).filter((r) => r.kind === 'refill'),
  ).toHaveLength(1);
  expect(
    careReminders(event, now, [], false).filter((r) => r.kind === 'refill'),
  ).toHaveLength(0);
});

it('a snooze at the follow-up time sends only the snoozed reminder', () => {
  const event = {
    type: 'medication',
    starts_at: '2026-01-01T08:00:00Z',
    rrule: 'FREQ=DAILY',
    timezone: 'Europe/Lisbon',
    reminder_minutes: [0],
    followup_minutes: 30,
  };
  const snooze = {
    occurrence_at: '2026-01-01T08:00:00Z',
    remind_at: '2026-01-01T08:30:00Z',
  };
  expect(
    careReminders(event, new Date('2026-01-01T08:30:00Z'), [snooze]).map(
      (r) => r.kind,
    ),
  ).toEqual(['snooze']);
});
