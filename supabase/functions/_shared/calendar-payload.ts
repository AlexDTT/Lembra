type CalendarEvent = {
  id: string;
  type: string;
  title: string;
  dose: string | null;
  notes: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  all_day: boolean;
  rrule: string | null;
  reminder_minutes: number[];
  excluded_dates?: string[];
};
function dateInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day']
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join('-');
}
export function googleEventId(id: string) {
  return `lembra${id.replaceAll('-', '').toLowerCase()}`;
}
export function calendarPayload(event: CalendarEvent) {
  const start = new Date(event.starts_at);
  const end = new Date(
    event.type === 'appointment' && event.ends_at
      ? event.ends_at
      : start.getTime() + 15 * 60000,
  );
  let rule = event.rrule;
  if (
    rule &&
    event.type === 'medication' &&
    event.ends_at &&
    !rule.includes('UNTIL=') &&
    !rule.includes('COUNT=')
  )
    rule += `;UNTIL=${new Date(event.ends_at)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')}`;
  const day = dateInZone(start, event.timezone);
  const next = new Date(`${day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    summary: event.title,
    description: [event.dose, event.notes].filter(Boolean).join('\n'),
    location: event.location || '',
    start: event.all_day
      ? { date: day }
      : { dateTime: start.toISOString(), timeZone: event.timezone },
    end: event.all_day
      ? { date: next.toISOString().slice(0, 10) }
      : { dateTime: end.toISOString(), timeZone: event.timezone },
    ...(rule
      ? {
          recurrence: [
            `RRULE:${rule.replace(/^RRULE:/, '')}`,
            ...(event.excluded_dates || []).map(
              (date) =>
                `EXDATE:${new Date(date)
                  .toISOString()
                  .replace(/[-:]/g, '')
                  .replace(/\.\d{3}Z$/, 'Z')}`,
            ),
          ],
        }
      : { recurrence: [] }),
    reminders: {
      useDefault: false,
      overrides: event.reminder_minutes
        .slice(0, 5)
        .map((minutes) => ({ method: 'popup', minutes })),
    },
    extendedProperties: { private: { lembraEventId: event.id } },
  };
}
