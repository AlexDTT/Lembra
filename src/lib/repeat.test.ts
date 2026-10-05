import { expect, it } from 'vitest';
import { localDate, localInstant } from './dates';
import {
  repeatOptions,
  repeatRule,
  repeatPreview,
  validateRepeat,
} from './repeat';

const dates = (rule: string, day: string, count = 5) =>
  repeatPreview(
    {
      rrule: rule,
      starts_at: localInstant(day, '09:00').toISOString(),
      timezone: 'Europe/Lisbon',
    },
    count,
  ).map((date) => localDate(date));

it('uses February 28 or 29 for the last day, and supports offsets from month end', () => {
  expect(dates('FREQ=MONTHLY;BYMONTHDAY=-1', '2027-01-31', 3)).toEqual([
    '2027-01-31',
    '2027-02-28',
    '2027-03-31',
  ]);
  expect(dates('FREQ=MONTHLY;BYMONTHDAY=-1', '2028-01-31', 3)).toEqual([
    '2028-01-31',
    '2028-02-29',
    '2028-03-31',
  ]);
  expect(dates('FREQ=MONTHLY;BYMONTHDAY=-3', '2028-01-01', 3)).toEqual([
    '2028-01-29',
    '2028-02-27',
    '2028-03-29',
  ]);
  expect(dates('FREQ=MONTHLY;BYMONTHDAY=31', '2028-01-31', 3)).toEqual([
    '2028-01-31',
    '2028-03-31',
    '2028-05-31',
  ]);
});
it('supports daily intervals, alternate weeks and ordinal monthly weekdays', () => {
  expect(dates('FREQ=DAILY;INTERVAL=3;COUNT=3', '2026-10-01')).toEqual([
    '2026-10-01',
    '2026-10-04',
    '2026-10-07',
  ]);
  expect(dates('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,TH', '2026-10-01', 5)).toEqual([
    '2026-10-01',
    '2026-10-13',
    '2026-10-15',
    '2026-10-27',
    '2026-10-29',
  ]);
  expect(dates('FREQ=MONTHLY;INTERVAL=2;BYDAY=-1TH', '2026-10-01', 3)).toEqual([
    '2026-10-29',
    '2026-12-31',
    '2027-02-25',
  ]);
  expect(dates('FREQ=MONTHLY;BYDAY=2TH', '2026-10-01', 3)).toEqual([
    '2026-10-08',
    '2026-11-12',
    '2026-12-10',
  ]);
});
it('supports multiple dates, bounded week blocks and selected yearly months', () => {
  expect(dates('FREQ=MONTHLY;BYMONTHDAY=1,15', '2026-10-01', 4)).toEqual([
    '2026-10-01',
    '2026-10-15',
    '2026-11-01',
    '2026-11-15',
  ]);
  expect(
    dates(
      'FREQ=MONTHLY;BYMONTHDAY=8,9,10,11,12,13,14;BYDAY=TH',
      '2026-10-01',
      3,
    ),
  ).toEqual(['2026-10-08', '2026-11-12', '2026-12-10']);
  expect(
    dates('FREQ=YEARLY;INTERVAL=2;BYMONTH=2,10;BYMONTHDAY=-1', '2026-10-01', 3),
  ).toEqual(['2026-10-31', '2028-02-29', '2028-10-31']);
});
it('round trips editable schedules and includes all occurrences on the end date', () => {
  for (const rule of [
    'FREQ=MONTHLY;INTERVAL=2;BYDAY=-1TH',
    'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=-3',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=4',
  ]) {
    expect(repeatRule(repeatOptions(rule, '2026-10-01'))).toBe(rule);
  }
  const options = {
    ...repeatOptions('FREQ=DAILY', '2026-10-23'),
    end: 'until' as const,
    until: '2026-10-25',
  };
  expect(dates(repeatRule(options)!, '2026-10-23')).toEqual([
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
  ]);
  expect(() =>
    validateRepeat('FREQ=DAILY;INTERVAL=0', '2026-10-01T08:00:00Z'),
  ).toThrow();
  expect(() =>
    validateRepeat('FREQ=WEEKLY;BYDAY=', '2026-10-01T08:00:00Z'),
  ).toThrow();
});
