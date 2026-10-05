import { RRule } from 'rrule';
import { dayBounds, localDate } from './dates';
import { nextOccurrence, type RecurringEvent } from './recurrence';

export const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type RepeatOptions = {
  frequency: 'once' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  days: string[];
  dates: number[];
  months: number[];
  mode: 'dates' | 'weekday' | 'last' | 'week';
  ordinal: number;
  offset: number;
  week: number;
  end: 'never' | 'until' | 'count';
  until: string;
  count: number;
};
export function repeatOptions(
  rule: string | null,
  day: string,
  timezone = 'Europe/Lisbon',
): RepeatOptions {
  const date = new Date(`${day || localDate()}T12:00:00Z`);
  const fields: Record<string, string> = Object.fromEntries(
    (rule || '')
      .replace(/^RRULE:/, '')
      .split(';')
      .map((part) => part.split('=')),
  );
  const byday = (fields.BYDAY || '').split(',').filter(Boolean);
  const dates = fields.BYMONTHDAY?.split(',').map(Number) || [
    date.getUTCDate(),
  ];
  const ordinal = Number(byday[0]?.match(/^-?\d+/)?.[0] || 1);
  return {
    frequency: (fields.FREQ || 'once') as RepeatOptions['frequency'],
    interval: Number(fields.INTERVAL || 1),
    days: byday.length
      ? byday.map((value) => value.slice(-2))
      : [weekdays[(date.getUTCDay() + 6) % 7]],
    dates: dates.filter((value) => value > 0),
    months: fields.BYMONTH?.split(',').map(Number) || [date.getUTCMonth() + 1],
    mode:
      dates[0] < 0
        ? 'last'
        : byday.some((value) => /^-?\d/.test(value))
          ? 'weekday'
          : byday.length && fields.BYMONTHDAY
            ? 'week'
            : 'dates',
    ordinal,
    offset: dates[0] < 0 ? -dates[0] - 1 : 0,
    week: Math.ceil((dates[0] || 1) / 7),
    end: fields.COUNT ? 'count' : fields.UNTIL ? 'until' : 'never',
    until: fields.UNTIL
      ? localDate(
          RRule.parseString(`FREQ=DAILY;UNTIL=${fields.UNTIL}`).until!,
          timezone,
        )
      : day,
    count: Number(fields.COUNT || 10),
  };
}
export function repeatRule(
  options: RepeatOptions,
  timezone = 'Europe/Lisbon',
): string | null {
  if (options.frequency === 'once') return null;
  const parts = [`FREQ=${options.frequency}`, `INTERVAL=${options.interval}`];
  if (options.frequency === 'WEEKLY')
    parts.push(`BYDAY=${options.days.join(',')}`);
  if (options.frequency === 'MONTHLY' || options.frequency === 'YEARLY') {
    if (options.frequency === 'YEARLY')
      parts.push(`BYMONTH=${options.months.join(',')}`);
    if (options.mode === 'weekday')
      parts.push(
        `BYDAY=${options.days.map((day) => `${options.ordinal}${day}`).join(',')}`,
      );
    else if (options.mode === 'last')
      parts.push(`BYMONTHDAY=${-1 - options.offset}`);
    else if (options.mode === 'week') {
      parts.push(
        `BYMONTHDAY=${Array.from({ length: options.week === 5 ? 3 : 7 }, (_, i) => (options.week - 1) * 7 + i + 1).join(',')}`,
      );
      parts.push(`BYDAY=${options.days.join(',')}`);
    } else parts.push(`BYMONTHDAY=${options.dates.join(',')}`);
  }
  if (options.end === 'count') parts.push(`COUNT=${options.count}`);
  if (options.end === 'until')
    parts.push(
      `UNTIL=${dayBounds(options.until, timezone)[1]
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z')}`,
    );
  return parts.join(';');
}
export function repeatPreview(event: RecurringEvent, limit = 5) {
  const values: Date[] = [];
  let after = new Date(new Date(event.starts_at).getTime() - 1);
  for (let i = 0; i < limit; i++) {
    const next = nextOccurrence(event, after);
    if (!next) break;
    values.push(next);
    after = next;
  }
  return values;
}
export function validateRepeat(
  rule: string | null,
  starts_at: string,
  timezone = 'Europe/Lisbon',
) {
  if (!rule) return;
  const options = RRule.parseString(rule);
  if (
    options.interval != null &&
    (!Number.isInteger(options.interval) ||
      options.interval < 1 ||
      options.interval > 366)
  )
    throw new RangeError('Invalid interval');
  if (
    options.count != null &&
    (!Number.isInteger(options.count) ||
      options.count < 1 ||
      options.count > 10000)
  )
    throw new RangeError('Invalid count');
  if (/BY(?:DAY|MONTHDAY|MONTH)=($|;)/.test(rule))
    throw new RangeError('Empty selection');
  if (!repeatPreview({ starts_at, timezone, rrule: rule }).length)
    throw new RangeError('No occurrences');
}
