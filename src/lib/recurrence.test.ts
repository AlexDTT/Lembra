import { describe, expect, it } from 'vitest';
import { formatInTimeZone } from 'date-fns-tz';
import { occurrencesBetween, nextOccurrence } from './recurrence';

const event = (
  starts_at: string,
  rrule: string | null = null,
  ends_at: string | null = null,
) => ({ starts_at, rrule, ends_at, timezone: 'Europe/Lisbon', active: true });
const dates = (items: Date[]) => items.map((date) => date.toISOString());
describe('recurrence, inclusive ranges and strictly later next occurrence', () => {
  it('handles a single occurrence and range boundaries', () => {
    const item = event('2026-01-10T08:00:00Z');
    expect(
      dates(
        occurrencesBetween(
          item,
          new Date(item.starts_at),
          new Date(item.starts_at),
        ),
      ),
    ).toEqual(['2026-01-10T08:00:00.000Z']);
    expect(
      occurrencesBetween(item, new Date('2026-01-11'), new Date('2026-01-12')),
    ).toEqual([]);
    expect(nextOccurrence(item, new Date('2026-01-09'))?.toISOString()).toBe(
      '2026-01-10T08:00:00.000Z',
    );
    expect(nextOccurrence(item, new Date(item.starts_at))).toBeNull();
  });
  it('expands daily rules', () => {
    expect(
      dates(
        occurrencesBetween(
          event('2026-01-01T08:00:00Z', 'FREQ=DAILY'),
          new Date('2026-01-01'),
          new Date('2026-01-03T23:59:59Z'),
        ),
      ),
    ).toEqual([
      '2026-01-01T08:00:00.000Z',
      '2026-01-02T08:00:00.000Z',
      '2026-01-03T08:00:00.000Z',
    ]);
  });
  it('uses weekly BYDAY', () => {
    expect(
      dates(
        occurrencesBetween(
          event('2026-01-05T08:00:00Z', 'FREQ=WEEKLY;BYDAY=MO,TH'),
          new Date('2026-01-05'),
          new Date('2026-01-12T23:59:59Z'),
        ),
      ),
    ).toEqual([
      '2026-01-05T08:00:00.000Z',
      '2026-01-08T08:00:00.000Z',
      '2026-01-12T08:00:00.000Z',
    ]);
  });
  it('uses monthly BYMONTHDAY and skips nonexistent month days', () => {
    expect(
      dates(
        occurrencesBetween(
          event('2026-01-31T08:00:00Z', 'FREQ=MONTHLY;BYMONTHDAY=31'),
          new Date('2026-01-01'),
          new Date('2026-05-31T23:59:59Z'),
        ),
      ),
    ).toEqual([
      '2026-01-31T08:00:00.000Z',
      '2026-03-31T07:00:00.000Z',
      '2026-05-31T07:00:00.000Z',
    ]);
  });
  it('supports last-day monthly rules', () => {
    const values = occurrencesBetween(
      event('2026-01-31T08:00:00Z', 'FREQ=MONTHLY;BYMONTHDAY=-1'),
      new Date('2026-02-01'),
      new Date('2026-03-31T23:59:59Z'),
    );
    expect(
      values.map((date) =>
        formatInTimeZone(date, 'Europe/Lisbon', 'yyyy-MM-dd HH:mm'),
      ),
    ).toEqual(['2026-02-28 08:00', '2026-03-31 08:00']);
  });
  it.each([
    [
      'spring',
      '2026-03-27T08:00:00Z',
      '2026-03-31T23:59:59Z',
      [
        '2026-03-27T08:00:00.000Z',
        '2026-03-28T08:00:00.000Z',
        '2026-03-29T07:00:00.000Z',
        '2026-03-30T07:00:00.000Z',
        '2026-03-31T07:00:00.000Z',
      ],
    ],
    [
      'autumn',
      '2026-10-23T07:00:00Z',
      '2026-10-27T23:59:59Z',
      [
        '2026-10-23T07:00:00.000Z',
        '2026-10-24T07:00:00.000Z',
        '2026-10-25T08:00:00.000Z',
        '2026-10-26T08:00:00.000Z',
        '2026-10-27T08:00:00.000Z',
      ],
    ],
  ])('keeps 08:00 Lisbon across %s DST', (_label, start, end, expected) => {
    const item = event(start, 'FREQ=DAILY');
    const values = occurrencesBetween(item, new Date(start), new Date(end));
    expect(dates(values)).toEqual(expected);
    expect(
      values.every(
        (date) => formatInTimeZone(date, item.timezone, 'HH:mm') === '08:00',
      ),
    ).toBe(true);
    expect(nextOccurrence(item, values[1])?.toISOString()).toBe(expected[2]);
  });
  it('respects end dates and inactive events', () => {
    const item = event(
      '2026-01-01T08:00:00Z',
      'FREQ=DAILY',
      '2026-01-02T23:59:59Z',
    );
    expect(
      occurrencesBetween(item, new Date('2026-01-01'), new Date('2026-01-05')),
    ).toHaveLength(2);
    expect(nextOccurrence(item, new Date('2026-01-03'))).toBeNull();
    expect(
      occurrencesBetween(
        { ...item, active: false },
        new Date('2026-01-01'),
        new Date('2026-01-05'),
      ),
    ).toEqual([]);
  });
  it('respects COUNT and UTC UNTIL', () => {
    expect(
      occurrencesBetween(
        event('2026-03-28T08:00:00Z', 'FREQ=DAILY;COUNT=2'),
        new Date('2026-03-28'),
        new Date('2026-04-05'),
      ),
    ).toHaveLength(2);
    expect(
      occurrencesBetween(
        event('2026-03-28T08:00:00Z', 'FREQ=DAILY;UNTIL=20260329T070000Z'),
        new Date('2026-03-28'),
        new Date('2026-04-05'),
      ),
    ).toHaveLength(2);
  });
  it('rejects invalid or unbounded subdaily rules', () => {
    expect(() =>
      occurrencesBetween(event('invalid'), new Date(), new Date()),
    ).toThrow();
    expect(() =>
      occurrencesBetween(
        event('2026-01-01T08:00:00Z', 'FREQ=SECONDLY'),
        new Date('2026-01-01'),
        new Date('2026-01-02'),
      ),
    ).toThrow();
  });
});

it('appointment duration does not end its recurring series, and single exclusions are respected', () => {
  const appointment = {
    type: 'appointment',
    starts_at: '2026-01-01T09:00:00Z',
    ends_at: '2026-01-01T09:30:00Z',
    rrule: 'FREQ=WEEKLY',
    timezone: 'Europe/Lisbon',
    excluded_dates: ['2026-01-08T09:00:00Z'],
  };
  expect(
    occurrencesBetween(
      appointment,
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-16T00:00:00Z'),
    ).map((d) => d.toISOString()),
  ).toEqual(['2026-01-01T09:00:00.000Z', '2026-01-15T09:00:00.000Z']);
  expect(
    nextOccurrence(
      appointment,
      new Date('2026-01-01T10:00:00Z'),
    )?.toISOString(),
  ).toBe('2026-01-15T09:00:00.000Z');
});
