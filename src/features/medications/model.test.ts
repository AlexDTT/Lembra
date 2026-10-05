import { describe, expect, it } from 'vitest';
import { doseRows, inputFor, medicationSchema } from './model';
import { occurrencesBetween } from '../../lib/recurrence';
import { dayBounds } from '../../lib/dates';

describe('medication input and multi-dose schedule', () => {
  it('creates two daily times with correct Lisbon summer instants', () => {
    const input = {
      ...inputFor(),
      title: 'Medicamento',
      dose: '1 comprimido',
      startDate: '2026-07-01',
      times: ['08:00', '20:00'],
    };
    const rows = doseRows(input);
    expect(rows.map((row) => row.starts_at)).toEqual([
      '2026-07-01T07:00:00.000Z',
      '2026-07-01T19:00:00.000Z',
    ]);
    expect(
      rows.flatMap((row) =>
        occurrencesBetween(row, ...dayBounds('2026-07-02')),
      ),
    ).toHaveLength(2);
  });
  it('rejects duplicate times, impossible dates, no days and negative lead times', () => {
    const valid = { ...inputFor(), title: 'A', dose: 'B' };
    for (const invalid of [
      { times: ['08:00', '08:00'] },
      { startDate: '2026-02-30' },
      { days: [] },
      { reminder: -1 },
      { endDate: '2020-01-01' },
    ]) {
      expect(medicationSchema.safeParse({ ...valid, ...invalid }).success).toBe(
        false,
      );
    }
  });
  it('uses selected weekdays and includes doses on the final date', () => {
    const rows = doseRows({
      ...inputFor(),
      title: 'A',
      dose: 'B',
      startDate: '2026-03-27',
      endDate: '2026-03-30',
      times: ['08:00', '20:00'],
      days: ['MO', 'FR'],
    });
    expect(rows[0].rrule).toBe('FREQ=WEEKLY;BYDAY=MO,FR');
    expect(
      rows.flatMap((row) =>
        occurrencesBetween(row, ...dayBounds('2026-03-30')),
      ),
    ).toHaveLength(2);
    expect(
      rows.flatMap((row) =>
        occurrencesBetween(row, ...dayBounds('2026-03-31')),
      ),
    ).toHaveLength(0);
  });
  it('rejects a start time inside the spring-forward gap', () => {
    expect(() =>
      doseRows({
        ...inputFor(),
        title: 'A',
        dose: 'B',
        startDate: '2026-03-29',
        times: ['01:30'],
      }),
    ).toThrow();
  });
});
