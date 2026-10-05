import { expect, it } from 'vitest';
import {
  taskSchema,
  tasksForDay,
  taskOccurrences,
  sortTasks,
  type Task,
} from './model';

const task = (
  id: string,
  due_on: string | null,
  completed_at: string | null = null,
): Task => ({
  rrule: null,
  excluded_dates: [],
  id,
  due_on,
  completed_at,
  title: id,
  notes: '',
  due_time: null,
  user_id: 'owner',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

it('allows no schedule or a date only and rejects impossible dates and local times', () => {
  const input = {
    title: '  Call someone  ',
    notes: '',
    due_on: '',
    due_time: '',
  };
  expect(taskSchema.parse(input).title).toBe('Call someone');
  expect(taskSchema.safeParse({ ...input, due_on: '2026-10-02' }).success).toBe(
    true,
  );
  expect(taskSchema.safeParse({ ...input, due_time: '09:00' }).success).toBe(
    false,
  );
  expect(taskSchema.safeParse({ ...input, due_on: '2026-02-30' }).success).toBe(
    false,
  );
  expect(
    taskSchema.safeParse({ ...input, due_on: '2026-03-29', due_time: '01:30' })
      .success,
  ).toBe(false);
  expect(
    taskSchema.safeParse({ ...input, due_on: '2026-10-02', due_time: '25:00' })
      .success,
  ).toBe(false);
});

it('keeps overdue tasks on Today while excluding future, completed and unscheduled tasks', () => {
  const rows = [
    task('overdue', '2026-10-01'),
    task('today', '2026-10-02'),
    task('future', '2026-10-03'),
    task('unscheduled', null),
    task('done', '2026-10-01', '2026-10-02T10:00:00Z'),
  ];
  expect(tasksForDay(rows, '2026-10-02').map((row) => row.id)).toEqual([
    'overdue',
    'today',
  ]);
  expect(sortTasks([...rows].reverse()).map((row) => row.id)).toEqual([
    'overdue',
    'today',
    'future',
    'unscheduled',
    'done',
  ]);
});

it('keeps independent recurring completions, exceptions and history after a series changes', () => {
  const recurring = {
    ...task('daily', '2026-10-01'),
    rrule: 'FREQ=DAILY;COUNT=3',
    excluded_dates: ['2026-10-02'],
  };
  const completions = [
    {
      task_id: 'daily',
      user_id: 'owner',
      occurrence_on: '2026-10-01',
      completed_at: '2026-10-01T10:00:00Z',
    },
  ];
  expect(
    tasksForDay([recurring], '2026-10-03', completions).map(
      (row) => row.occurrence_on,
    ),
  ).toEqual(['2026-10-03']);
  const changed = { ...recurring, due_on: '2026-10-03', rrule: null };
  expect(
    taskOccurrences([changed], completions, '2026-10-01', '2026-10-03').map(
      (row) => [row.due_on, !!row.completed_at],
    ),
  ).toEqual([
    ['2026-10-01', true],
    ['2026-10-03', false],
  ]);
});
