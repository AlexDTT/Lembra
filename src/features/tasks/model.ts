import { z } from 'zod';
import type { Tables } from '../../types/database';
import { dayBounds, localDate, localInstant } from '../../lib/dates';
import { occurrencesBetween, nextOccurrence } from '../../lib/recurrence';
import { validateRepeat } from '../../lib/repeat';

export type Task = Tables<'tasks'> & {
  occurrence_on?: string;
  original_due_on?: string | null;
};
export type TaskCompletion = Tables<'task_completions'>;
export const taskSchema = z
  .object({
    rrule: z.string().nullable().optional(),
    excluded_dates: z.array(z.iso.date()).optional(),
    title: z.string().trim().min(1).max(120),
    notes: z.string().max(2000),
    due_on: z.union([z.literal(''), z.iso.date()]),
    due_time: z.union([z.literal(''), z.string().regex(/^\d{2}:\d{2}$/)]),
  })
  .superRefine((input, ctx) => {
    try {
      if (input.due_time && !input.due_on) throw new Error();
      if (input.due_time) localInstant(input.due_on, input.due_time);
      if (input.rrule) {
        if (!input.due_on) throw new Error();
        validateRepeat(
          input.rrule,
          localInstant(input.due_on, input.due_time || '00:00').toISOString(),
        );
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        path: ['due_time'],
        message: 'Invalid schedule',
      });
    }
  });

export function taskEvent(task: Task) {
  return {
    starts_at: localInstant(
      task.original_due_on || task.due_on!,
      task.due_time?.slice(0, 5) || '00:00',
    ).toISOString(),
    rrule: task.rrule || null,
    timezone: 'Europe/Lisbon',
    excluded_dates: (task.excluded_dates || []).map((day) =>
      localInstant(day, task.due_time?.slice(0, 5) || '00:00').toISOString(),
    ),
  };
}
export function taskOccurrences(
  tasks: Task[],
  completions: TaskCompletion[],
  from: string,
  to: string,
): Task[] {
  return tasks.flatMap((task) => {
    const dates =
      task.rrule && task.due_on
        ? occurrencesBetween(
            taskEvent(task),
            dayBounds(from)[0],
            dayBounds(to)[1],
          ).map((date) => localDate(date))
        : task.due_on && task.due_on >= from && task.due_on <= to
          ? [task.due_on]
          : [];
    // Recorded occurrences stay visible even after the schedule is changed.
    const recorded = completions
      .filter(
        (c) =>
          c.task_id === task.id &&
          c.occurrence_on >= from &&
          c.occurrence_on <= to,
      )
      .map((c) => c.occurrence_on);
    return [...new Set([...dates, ...recorded])].sort().map((day) =>
      !task.rrule && !recorded.includes(day)
        ? task
        : {
            ...task,
            original_due_on: task.due_on,
            due_on: day,
            occurrence_on: day,
            completed_at:
              completions.find(
                (c) => c.task_id === task.id && c.occurrence_on === day,
              )?.completed_at || null,
          },
    );
  });
}
export function tasksForDay(
  tasks: Task[],
  day: string,
  completions: TaskCompletion[] = [],
) {
  const start =
    [
      ...tasks.map((task) => task.due_on || day),
      ...completions.map((c) => c.occurrence_on),
    ].sort()[0] || day;
  return taskOccurrences(tasks, completions, start, day).filter(
    (task) => !task.completed_at,
  );
}
export function taskListOccurrences(
  tasks: Task[],
  completions: TaskCompletion[],
  day: string,
) {
  const start =
    [
      ...tasks.map((task) => task.due_on || day),
      ...completions.map((c) => c.occurrence_on),
    ].sort()[0] || day;
  const current = taskOccurrences(tasks, completions, start, day);
  const future = tasks.flatMap((task) => {
    if (!task.rrule) return !task.due_on || task.due_on > day ? [task] : [];
    const next = nextOccurrence(taskEvent(task), dayBounds(day)[1]);
    return next
      ? taskOccurrences([task], completions, localDate(next), localDate(next))
      : [];
  });
  return [...current, ...future];
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) =>
      Number(Boolean(a.completed_at)) - Number(Boolean(b.completed_at)) ||
      (a.due_on || '9999-12-31').localeCompare(b.due_on || '9999-12-31') ||
      (a.due_time || '').localeCompare(b.due_time || '') ||
      a.created_at.localeCompare(b.created_at),
  );
}
