import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../app/auth-context';
import { supabase } from '../../lib/supabase';
import { fetchAll } from '../../lib/pagination';
import { needsBackendSetup } from '../../lib/backend';
import { taskSchema, type Task, type TaskCompletion } from './model';
import type { z } from 'zod';

export function useTasks() {
  const { session } = useAuth();
  const userId = session!.user.id;
  return useQuery({
    queryKey: ['tasks', userId],
    queryFn: async ({ signal }) => {
      try {
        const tasks = await fetchAll((from, to) =>
          supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .order('id')
            .range(from, to)
            .abortSignal(signal),
        );
        let completions: TaskCompletion[] = [];
        try {
          completions = await fetchAll((from, to) =>
            supabase
              .from('task_completions')
              .select('*')
              .eq('user_id', userId)
              .order('task_id')
              .order('occurrence_on')
              .range(from, to)
              .abortSignal(signal),
          );
        } catch (error) {
          if (!needsBackendSetup(error)) throw error;
        }
        return { tasks, completions, available: true };
      } catch (error) {
        if (needsBackendSetup(error))
          return {
            tasks: [] as Task[],
            completions: [] as TaskCompletion[],
            available: false,
          };
        throw error;
      }
    },
  });
}

type TaskAction =
  | {
      kind: 'save';
      input: z.infer<typeof taskSchema>;
      id?: string;
      occurrence?: string;
      scope?: 'single' | 'future' | 'series';
    }
  | { kind: 'complete'; task: Task }
  | { kind: 'delete'; id: string }
  | { kind: 'skip'; task: Task };

export function useTaskAction() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (action: TaskAction) => {
      if (!navigator.onLine) throw new Error('Offline');
      let result;
      if (action.kind === 'save') {
        const input = taskSchema.parse(action.input);
        const row = {
          title: input.title,
          notes: input.notes,
          due_on: input.due_on || null,
          due_time: input.due_time || null,
          rrule: input.rrule || null,
          ...(input.excluded_dates
            ? { excluded_dates: input.excluded_dates }
            : {}),
        };
        result =
          action.id && action.occurrence && action.scope !== 'series'
            ? await supabase.rpc('edit_task_occurrence', {
                p_task_id: action.id,
                p_day: action.occurrence,
                p_scope: action.scope || 'single',
                p_input: row,
              })
            : action.id
              ? await supabase
                  .from('tasks')
                  .update(row)
                  .eq('id', action.id)
                  .eq('user_id', userId)
              : await supabase
                  .from('tasks')
                  .insert({ ...row, user_id: userId });
      } else if (action.kind === 'skip') {
        result = await supabase.rpc('edit_task_occurrence', {
          p_task_id: action.task.id,
          p_day: action.task.occurrence_on!,
          p_scope: 'single',
        });
      } else if (action.kind === 'complete') {
        if (action.task.occurrence_on) {
          result = action.task.completed_at
            ? await supabase
                .from('task_completions')
                .delete()
                .eq('user_id', userId)
                .eq('task_id', action.task.id)
                .eq('occurrence_on', action.task.occurrence_on)
            : await supabase.from('task_completions').upsert(
                {
                  user_id: userId,
                  task_id: action.task.id,
                  occurrence_on: action.task.occurrence_on,
                  completed_at: new Date().toISOString(),
                },
                { onConflict: 'task_id,occurrence_on' },
              );
        } else
          result = await supabase
            .from('tasks')
            .update({
              completed_at: action.task.completed_at
                ? null
                : new Date().toISOString(),
            })
            .eq('id', action.task.id)
            .eq('user_id', userId);
      } else {
        result = await supabase
          .from('tasks')
          .delete()
          .eq('id', action.id)
          .eq('user_id', userId);
      }
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['tasks', userId] });
    },
  });
}
