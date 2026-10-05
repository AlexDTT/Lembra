import { RRule } from 'rrule';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export type RecurringEvent = {
  starts_at: string;
  rrule: string | null;
  timezone: string;
  ends_at?: string | null;
  active?: boolean;
  type?: string;
  excluded_dates?: string[];
};
const padding = 2 * 86_400_000;
function validDate(value: string | Date): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
  return date;
}
function wall(date: Date, timezone: string): Date {
  return new Date(
    `${formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm:ss.SSS")}Z`,
  );
}
function instant(date: Date, timezone: string): Date | null {
  const local = date.toISOString().slice(0, -1);
  const value = fromZonedTime(local, timezone);
  // Spring-forward times that do not exist are skipped, never silently shifted.
  return wall(value, timezone).getTime() === date.getTime() ? value : null;
}
function ruleFor(event: RecurringEvent): RRule {
  const options = RRule.parseString(event.rrule!.replace(/^RRULE:/, ''));
  if (
    ![RRule.DAILY, RRule.WEEKLY, RRule.MONTHLY, RRule.YEARLY].includes(
      options.freq!,
    )
  )
    throw new RangeError('Unsupported recurrence frequency');
  if (options.byhour || options.byminute || options.bysecond)
    throw new RangeError('Subdaily recurrence is not supported');
  if (options.until) options.until = wall(options.until, event.timezone);
  // rrule 2.8's named-zone conversion depends on the host timezone. Use its UTC
  // tzid for floating wall clocks, then explicitly convert each date in the event zone.
  return new RRule({
    ...options,
    dtstart: wall(validDate(event.starts_at), event.timezone),
    tzid: 'UTC',
  });
}
function cutoff(event: RecurringEvent) {
  return event.type === 'appointment' ? null : event.ends_at;
}
function allowed(event: RecurringEvent, value: Date) {
  return (
    value >= validDate(event.starts_at) &&
    (!cutoff(event) || value <= validDate(cutoff(event)!)) &&
    !(event.excluded_dates || []).some(
      (date) => validDate(date).getTime() === value.getTime(),
    )
  );
}
/** Inclusive range of actual UTC instants, preserving the event's local clock. */
export function occurrencesBetween(
  event: RecurringEvent,
  from: Date,
  to: Date,
): Date[] {
  validDate(from);
  validDate(to);
  validDate(event.starts_at);
  if (from > to || event.active === false) return [];
  if (!event.rrule) {
    const start = validDate(event.starts_at);
    return start >= from && start <= to && allowed(event, start) ? [start] : [];
  }
  const rule = ruleFor(event);
  const upper = cutoff(event)
    ? new Date(Math.min(to.getTime(), validDate(cutoff(event)!).getTime()))
    : to;
  const candidates = rule.between(
    wall(new Date(from.getTime() - padding), event.timezone),
    wall(new Date(upper.getTime() + padding), event.timezone),
    true,
  );
  return candidates
    .map((date) => instant(date, event.timezone))
    .filter(
      (date): date is Date =>
        date !== null && date >= from && date <= to && allowed(event, date),
    );
}
/** Returns the first occurrence strictly after the supplied instant. */
export function nextOccurrence(
  event: RecurringEvent,
  after: Date,
): Date | null {
  validDate(after);
  validDate(event.starts_at);
  if (event.active === false) return null;
  if (!event.rrule) {
    const start = validDate(event.starts_at);
    return start > after && allowed(event, start) ? start : null;
  }
  if (cutoff(event) && after >= validDate(cutoff(event)!)) return null;
  const rule = ruleFor(event);
  let candidate = rule.after(
    wall(new Date(after.getTime() - padding), event.timezone),
    true,
  );
  while (candidate) {
    const value = instant(candidate, event.timezone);
    if (value && cutoff(event) && value > validDate(cutoff(event)!))
      return null;
    if (value && value > after && allowed(event, value)) return value;
    candidate = rule.after(candidate, false);
  }
  return null;
}
