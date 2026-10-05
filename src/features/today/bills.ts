import { dayBounds } from '../../lib/dates';
import { shiftDay } from '../../lib/filters';
import { occurrencesBetween } from '../../lib/recurrence';
import { useBillCompletions, useEvents } from '../events/queries';
import type { EventRow } from '../../types/domain';
export function useAttentionBills(day: string) {
  const events = useEvents();
  const completions = useBillCompletions();
  const [from] = dayBounds(shiftDay(day, -90));
  const [, to] = dayBounds(shiftDay(day, 7));
  let invalid = false;
  const bills: { event: EventRow; occurrence: Date }[] = [];
  for (const event of (events.data || []).filter((e) => e.type === 'bill')) {
    try {
      for (const occurrence of occurrencesBetween(
        event,
        event.rrule ? from : new Date(event.starts_at),
        to,
      )) {
        if (
          !completions.data?.some(
            (c) =>
              c.event_id === event.id &&
              new Date(c.occurrence_at).getTime() === occurrence.getTime(),
          )
        )
          bills.push({ event, occurrence });
      }
    } catch {
      invalid = true;
    }
  }
  bills.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime());
  return {
    bills,
    invalid,
    pending: events.isPending || completions.isPending,
    error: events.isError || completions.isError,
    refetch: async () => {
      await Promise.all([events.refetch(), completions.refetch()]);
    },
  };
}
