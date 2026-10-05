import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { supabase } from '../../lib/supabase';
import type { TablesInsert } from '../../types/database';
import { z } from 'zod';
import { readCache, writeCache, removeCache } from '../../lib/cache';
import { fetchAll } from '../../lib/pagination';
import type { EventRow } from '../../types/domain';
const eventCache = z.array(
  z
    .object({
      id: z.uuid(),
      user_id: z.uuid(),
      type: z.enum(['medication', 'appointment', 'bill']),
      title: z.string(),
      dose: z.string().nullable(),
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }).nullable(),
      timezone: z.string(),
      active: z.boolean(),
      all_day: z.boolean(),
      rrule: z.string().nullable(),
      location: z.string().nullable(),
      notes: z.string().nullable(),
      amount: z.number().nullable(),
      photo_path: z.string().nullable(),
      reminder_minutes: z.array(z.number()),
      refill_on: z.iso.date().nullable().optional(),
      refill_reminder_days: z.number().int().min(0).max(30).optional(),
      followup_minutes: z
        .union([z.literal(15), z.literal(30), z.literal(60)])
        .nullable()
        .optional(),
      excluded_dates: z.array(z.iso.datetime({ offset: true })).optional(),
    })
    .passthrough(),
);

export function useEvents() {
  const { session } = useAuth();
  const key = `events:${session!.user.id}`;
  const cached = readCache(key, eventCache);
  return useQuery({
    queryKey: ['events', session!.user.id],
    initialData: cached?.data.filter(
      (row) => row.user_id === session!.user.id,
    ) as EventRow[] | undefined,
    initialDataUpdatedAt: cached?.updatedAt,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('starts_at')
        .abortSignal(signal);
      if (error) throw error;
      writeCache(key, data);
      return data;
    },
  });
}
export function useCategories() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['categories', session!.user.id],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('name')
        .abortSignal(signal);
      if (error) throw error;
      return data;
    },
  });
}
export function useEventActions() {
  const { session } = useAuth();
  const client = useQueryClient();
  const refresh = () => {
    removeCache(`events:${session!.user.id}`);
    return client.invalidateQueries({ queryKey: ['events', session!.user.id] });
  };
  return {
    skip: async (event: EventRow, occurrence: Date) => {
      if (!navigator.onLine) throw new Error('Offline');
      const { error } = await supabase.rpc('edit_event_occurrence', {
        p_event_id: event.id,
        p_occurrence_at: occurrence.toISOString(),
        p_scope: 'single',
      });
      if (error) throw error;
      await refresh();
    },
    save: async (
      input: Omit<TablesInsert<'events'>, 'user_id'>,
      id?: string,
      occurrence?: Date,
      scope: 'single' | 'future' = 'single',
    ) => {
      if (!navigator.onLine) throw new Error('Offline');
      const row = { ...input, user_id: session!.user.id };
      const { error } =
        id && occurrence && (scope === 'future' || input.type === 'bill')
          ? await supabase.rpc('edit_event_occurrence', {
              p_event_id: id,
              p_occurrence_at: occurrence.toISOString(),
              p_scope: scope,
              p_input: row,
            })
          : id && occurrence
            ? await supabase.rpc('save_appointment_occurrence', {
                p_event_id: id,
                p_occurrence_at: occurrence.toISOString(),
                p_input: row,
              })
            : id
              ? await supabase
                  .from('events')
                  .update(row)
                  .eq('id', id)
                  .eq('user_id', session!.user.id)
              : await supabase.from('events').insert(row);
      if (error) throw error;
      await refresh();
    },
    remove: async (id: string) => {
      if (!navigator.onLine) throw new Error('Offline');
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)
        .eq('user_id', session!.user.id);
      if (error) throw error;
      await refresh();
      await client.invalidateQueries({
        queryKey: ['expenses', session!.user.id],
      });
    },
  };
}

export function useBillCompletions(enabled = true) {
  const { session } = useAuth();
  const userId = session!.user.id;
  return useQuery({
    queryKey: ['bill-completions', userId],
    enabled,
    queryFn: async ({ signal }) =>
      fetchAll((from, to) =>
        supabase
          .from('event_completions')
          .select('*')
          .eq('user_id', userId)
          .order('id')
          .range(from, to)
          .abortSignal(signal),
      ),
  });
}
