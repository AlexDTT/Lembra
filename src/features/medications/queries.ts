import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useAuth } from '../../app/auth-context';
import { supabase } from '../../lib/supabase';
import { readCache, writeCache, removeCache } from '../../lib/cache';
import { doseRows, type MedicationInput, type MedicationGroup } from './model';
import type { EventRow } from '../../types/domain';

// Validate every field consumed by the app before trusting browser storage.
const eventCache = z.array(
  z
    .object({
      id: z.uuid(),
      user_id: z.uuid(),
      type: z.literal('medication'),
      group_id: z.uuid().nullable(),
      title: z.string(),
      dose: z.string().nullable(),
      timezone: z.string(),
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }).nullable(),
      rrule: z.string().nullable(),
      active: z.boolean(),
      reminder_minutes: z.array(z.number()),
      refill_on: z.iso.date().nullable().optional(),
      refill_reminder_days: z.number().int().min(0).max(30).optional(),
      followup_minutes: z
        .union([z.literal(15), z.literal(30), z.literal(60)])
        .nullable()
        .optional(),
      excluded_dates: z.array(z.iso.datetime({ offset: true })).optional(),
      google_sync_error: z.string().nullable(),
      photo_path: z.string().nullable().optional(),
    })
    .passthrough(),
);
export function useMedications() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const cached = readCache(`medications:${userId}`, eventCache);
  return useQuery({
    queryKey: ['medications', userId],
    initialData: cached?.data.filter((row) => row.user_id === userId) as
      EventRow[] | undefined,
    initialDataUpdatedAt: cached?.updatedAt,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'medication')
        .eq('user_id', userId)
        .order('title')
        .abortSignal(signal);
      if (error) throw error;
      writeCache(`medications:${userId}`, data);
      return data;
    },
  });
}
export function useMedicationActions() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session!.user.id;
  const refresh = async () => {
    removeCache(`medications:${userId}`);
    await queryClient.invalidateQueries({ queryKey: ['medications', userId] });
    await queryClient.invalidateQueries({ queryKey: ['completions', userId] });
    removeCache(`events:${userId}`);
    await queryClient.invalidateQueries({ queryKey: ['events', userId] });
  };
  return {
    save: async (
      input: MedicationInput,
      group?: MedicationGroup,
      photoPath?: string | null,
    ) => {
      if (!navigator.onLine) throw new Error('Offline');
      const { error } = await supabase.rpc('save_medication_with_photo', {
        p_group_id: group?.id || crypto.randomUUID(),
        p_rows: doseRows(input, group),
        p_photo_path:
          photoPath === ''
            ? undefined
            : (photoPath ?? group?.rows[0].photo_path ?? undefined),
      });
      if (error) throw error;
      await refresh();
    },
    setActive: async (group: MedicationGroup, active: boolean) => {
      if (!navigator.onLine) throw new Error('Offline');
      const { error } = await supabase
        .from('events')
        .update({ active })
        .eq('user_id', userId)
        .eq('type', 'medication')
        .in(
          'id',
          group.rows.map((row) => row.id),
        );
      if (error) throw error;
      await refresh();
    },
    remove: async (group: MedicationGroup) => {
      if (!navigator.onLine) throw new Error('Offline');
      const { error } = await supabase.rpc('delete_medication_group', {
        p_group_id: group.id,
      });
      if (error) throw error;
      const path = group.rows[0].photo_path;
      if (path) await supabase.storage.from('medication-photos').remove([path]);
      await refresh();
    },
  };
}
