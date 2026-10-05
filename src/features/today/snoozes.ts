import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { supabase } from '../../lib/supabase';
import { useCareBackend } from '../../lib/backend';
import { pushEnabled } from '../../lib/push';
export function useDoseSnooze() {
  const { session } = useAuth();
  const client = useQueryClient();
  const backend = useCareBackend();
  const mutation = useMutation({
    mutationFn: async ({
      eventId,
      occurrence,
    }: {
      eventId: string;
      occurrence: string;
    }) => {
      if (backend.data !== true) throw new Error('Feature unavailable');
      if (!navigator.onLine || !(await pushEnabled()))
        throw new Error('Notifications unavailable');
      const remindAt = new Date(Date.now() + 10 * 60000).toISOString();
      const { error } = await supabase.from('dose_snoozes').upsert(
        {
          user_id: session!.user.id,
          event_id: eventId,
          occurrence_at: occurrence,
          remind_at: remindAt,
        },
        { onConflict: 'event_id,occurrence_at' },
      );
      if (error) throw error;
      return remindAt;
    },
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ['snoozes', session!.user.id],
      });
    },
  });
  return { ...mutation, available: backend.data === true };
}
