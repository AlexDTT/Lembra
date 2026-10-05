import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'Europe/Lisbon';
export function localDate(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}
export function localTime(date: Date | string, timezone = DEFAULT_TIMEZONE) {
  return formatInTimeZone(date, timezone, 'HH:mm');
}
export function localInstant(
  day: string,
  time: string,
  timezone = DEFAULT_TIMEZONE,
) {
  const value = fromZonedTime(`${day}T${time}:00`, timezone);
  if (
    !Number.isFinite(value.getTime()) ||
    formatInTimeZone(value, timezone, "yyyy-MM-dd'T'HH:mm") !== `${day}T${time}`
  ) {
    throw new RangeError('This local time does not exist');
  }
  return value;
}
export function dayBounds(
  day: string,
  timezone = DEFAULT_TIMEZONE,
): [Date, Date] {
  const start = fromZonedTime(`${day}T00:00:00`, timezone);
  const next = new Date(`${day}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = fromZonedTime(
    `${next.toISOString().slice(0, 10)}T00:00:00`,
    timezone,
  );
  return [start, new Date(end.getTime() - 1)];
}
