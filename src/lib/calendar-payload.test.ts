import { describe, expect, it } from 'vitest';
import {
  calendarPayload,
  googleEventId,
} from '../../supabase/functions/_shared/calendar-payload';
const event = {
  id: '00000000-0000-4000-8000-000000000001',
  type: 'medication',
  title: 'Test',
  dose: '1',
  notes: null,
  location: null,
  starts_at: '2026-09-30T07:00:00Z',
  ends_at: '2026-10-05T22:59:59Z',
  timezone: 'Europe/Lisbon',
  all_day: false,
  rrule: 'FREQ=DAILY',
  reminder_minutes: [0],
};
describe('Google Calendar mapping', () => {
  it('uses stable ids compatible with Google base32hex', () => {
    expect(googleEventId(event.id)).toMatch(/^[0-9a-v]+$/);
    expect(googleEventId(event.id)).toBe(googleEventId(event.id));
  });
  it('preserves timezone and caps medication recurrence', () => {
    const payload = calendarPayload(event);
    expect(payload.start).toEqual({
      dateTime: '2026-09-30T07:00:00.000Z',
      timeZone: 'Europe/Lisbon',
    });
    expect(payload.recurrence).toEqual([
      'RRULE:FREQ=DAILY;UNTIL=20261005T225959Z',
    ]);
    expect(payload.reminders.overrides).toEqual([
      { method: 'popup', minutes: 0 },
    ]);
  });
  it('maps bills to all-day dates, not UTC calendar days', () => {
    const payload = calendarPayload({
      ...event,
      type: 'bill',
      all_day: true,
      starts_at: '2026-09-29T23:30:00Z',
      rrule: null,
    });
    expect(payload.start).toEqual({ date: '2026-09-30' });
    expect(payload.end).toEqual({ date: '2026-10-01' });
  });
});

it('exports a single appointment exclusion without changing the recurring duration', () => {
  const payload = calendarPayload({
    ...event,
    type: 'appointment',
    ends_at: '2026-09-30T07:30:00Z',
    excluded_dates: ['2026-10-01T07:00:00Z'],
  });
  expect(payload.recurrence).toEqual([
    'RRULE:FREQ=DAILY',
    'EXDATE:20261001T070000Z',
  ]);
  expect(payload.end).toEqual({
    dateTime: '2026-09-30T07:30:00.000Z',
    timeZone: 'Europe/Lisbon',
  });
});
