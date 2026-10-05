import { z } from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import { localDate, localInstant, localTime, dayBounds } from '../../lib/dates';
import type { EventRow } from '../../types/domain';

export const weekDays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export const dayLabels = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;
const dateSchema = z.iso.date();
export const medicationSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    dose: z.string().trim().min(1).max(120),
    times: z
      .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
      .min(1)
      .max(8),
    days: z.array(z.enum(weekDays)).min(1).max(7),
    startDate: dateSchema,
    endDate: z.union([dateSchema, z.literal('')]),
    reminder: z.number().int().min(0).max(10080),
    active: z.boolean(),
    refillOn: z.union([dateSchema, z.literal('')]).optional(),
    refillDays: z.number().int().min(0).max(30).optional(),
    followup: z
      .union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)])
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.endDate < value.startDate)
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End before start',
      });
    if (new Set(value.times).size !== value.times.length)
      ctx.addIssue({
        code: 'custom',
        path: ['times'],
        message: 'Duplicate times',
      });
    if (new Set(value.days).size !== value.days.length)
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: 'Duplicate days',
      });
  });
export type MedicationInput = z.infer<typeof medicationSchema>;
export type MedicationGroup = { id: string; rows: EventRow[] };
export function groupMedications(rows: EventRow[]): MedicationGroup[] {
  const groups = new Map<string, EventRow[]>();
  for (const row of rows) {
    const key = row.group_id || row.id;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups].map(([id, rows]) => ({
    id,
    rows: rows.sort((a, b) =>
      localTime(a.starts_at, a.timezone).localeCompare(
        localTime(b.starts_at, b.timezone),
      ),
    ),
  }));
}
export function inputFor(group?: MedicationGroup): MedicationInput {
  if (!group)
    return {
      title: '',
      dose: '',
      times: ['08:00'],
      days: [...weekDays],
      startDate: localDate(),
      endDate: '',
      reminder: 0,
      active: true,
      refillOn: '',
      refillDays: 3,
      followup: 0,
    };
  const row = group.rows[0];
  const byday = row.rrule?.match(/BYDAY=([^;]+)/)?.[1].split(',');
  return {
    title: row.title,
    dose: row.dose || '',
    times: group.rows.map((item) => localTime(item.starts_at, item.timezone)),
    days: byday ? weekDays.filter((day) => byday.includes(day)) : [...weekDays],
    startDate: localDate(new Date(row.starts_at), row.timezone),
    endDate: row.ends_at ? localDate(new Date(row.ends_at), row.timezone) : '',
    reminder: row.reminder_minutes[0] || 0,
    active: row.active,
    refillOn: row.refill_on || '',
    refillDays: row.refill_reminder_days ?? 3,
    followup: (row.followup_minutes || 0) as 0 | 15 | 30 | 60,
  };
}
export function doseRows(input: MedicationInput, group?: MedicationGroup) {
  const data = medicationSchema.parse(input);
  const timezone = group?.rows[0].timezone || 'Europe/Lisbon';
  const rule =
    data.days.length === 7
      ? 'FREQ=DAILY'
      : `FREQ=WEEKLY;BYDAY=${weekDays.filter((day) => data.days.includes(day)).join(',')}`;
  return data.times.map((time) => {
    const existing = group?.rows.find(
      (row) => localTime(row.starts_at, row.timezone) === time,
    );
    return {
      id: existing?.id || null,
      title: data.title,
      dose: data.dose,
      timezone,
      starts_at: localInstant(data.startDate, time, timezone).toISOString(),
      ends_at: data.endDate
        ? dayBounds(data.endDate, timezone)[1].toISOString()
        : null,
      rrule: rule,
      reminder: data.reminder,
      active: data.active,
      refill_on: data.refillOn || null,
      refill_reminder_days: data.refillDays ?? 3,
      followup_minutes: data.followup || null,
    };
  });
}
export function dosePeriod(
  occurrence: Date,
  timezone: string,
): 'morning' | 'afternoon' | 'evening' {
  const hour = Number(formatInTimeZone(occurrence, timezone, 'H'));
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}
