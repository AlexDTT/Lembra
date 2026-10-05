import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '../../app/auth-context';
import { supabase } from '../../lib/supabase';
import { dayBounds } from '../../lib/dates';
import { readCache, writeCache } from '../../lib/cache';
import type { CompletionRow } from '../../types/domain';

const completionCache = z.array(
  z.object({
    id: z.uuid(),
    user_id: z.uuid(),
    event_id: z.uuid(),
    occurrence_at: z.iso.datetime({ offset: true }),
    status: z.enum(['done', 'skipped']),
    completed_at: z.iso.datetime({ offset: true }),
    amount_paid: z.number().nullable(),
  }),
);
export function useCompletions(day: string) {
  const { session } = useAuth();
  const userId = session!.user.id;
  const key = `completions:${userId}:${day}`;
  const cached = readCache(key, completionCache);
  return useQuery({
    queryKey: ['completions', userId, day],
    initialData: cached?.data.filter((row) => row.user_id === userId),
    initialDataUpdatedAt: cached?.updatedAt,
    queryFn: async ({ signal }) => {
      const [from, to] = dayBounds(day);
      const { data, error } = await supabase
        .from('event_completions')
        .select('*')
        .eq('user_id', userId)
        .gte('occurrence_at', from.toISOString())
        .lte('occurrence_at', to.toISOString())
        .abortSignal(signal);
      if (error) throw error;
      writeCache(key, data);
      return data;
    },
  });
}
type CompletionAction = {
  eventId: string;
  occurrence: string;
  status: 'done' | 'skipped' | null;
};
export function useCompletionAction(day: string) {
  const { session } = useAuth();
  const userId = session!.user.id;
  const client = useQueryClient();
  const queryKey = ['completions', userId, day];
  const cacheKey = `completions:${userId}:${day}`;
  return useMutation({
    mutationFn: async (action: CompletionAction) => {
      if (!navigator.onLine) throw new Error('Offline');
      if (action.status === null) {
        const { error } = await supabase
          .from('event_completions')
          .delete()
          .eq('user_id', userId)
          .eq('event_id', action.eventId)
          .eq('occurrence_at', action.occurrence);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('event_completions').upsert(
        {
          user_id: userId,
          event_id: action.eventId,
          occurrence_at: action.occurrence,
          status: action.status,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,occurrence_at' },
      );
      if (error) throw error;
    },
    onMutate: async (action) => {
      await client.cancelQueries({ queryKey });
      const previous = client.getQueryData<CompletionRow[]>(queryKey);
      const remaining = (previous || []).filter(
        (row) =>
          row.event_id !== action.eventId ||
          new Date(row.occurrence_at).getTime() !==
            new Date(action.occurrence).getTime(),
      );
      const next: CompletionRow[] =
        action.status === null
          ? remaining
          : [
              ...remaining,
              {
                id: crypto.randomUUID(),
                user_id: userId,
                event_id: action.eventId,
                occurrence_at: action.occurrence,
                status: action.status,
                completed_at: new Date().toISOString(),
                amount_paid: null,
              },
            ];
      client.setQueryData(queryKey, next);
      return { previous };
    },
    onError: (_error, _action, context) => {
      client.setQueryData(queryKey, context?.previous || []);
    },
    onSuccess: () => {
      const saved = client.getQueryData<CompletionRow[]>(queryKey);
      if (saved) writeCache(cacheKey, saved);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey });
      void client.invalidateQueries({ queryKey: ['history', userId] });
    },
  });
}
