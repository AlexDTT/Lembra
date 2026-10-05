import { expect, it } from 'vitest';
import {
  moneyPeriod,
  yearlySpending,
  recordedDoseSeries,
  shiftMonth,
  spendingSeries,
} from './insights';
it('selects complete month and year ranges across December and leap years', () => {
  expect(moneyPeriod('2026-12', 'month')).toEqual({
    from: '2026-12-01',
    to: '2027-01-01',
  });
  expect(moneyPeriod('2024-02', 'year')).toEqual({
    from: '2024-01-01',
    to: '2025-01-01',
  });
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftMonth('2026-03', -12)).toBe('2025-03');
});
it('groups a full year in cents, including empty months and excluding adjacent years', () => {
  const values = yearlySpending(
    [
      { amount: 0.1, spent_on: '2024-02-01' },
      { amount: 0.2, spent_on: '2024-02-29' },
      { amount: 12.34, spent_on: '2024-12-31' },
      { amount: 99, spent_on: '2023-12-31' },
      { amount: 99, spent_on: '2025-01-01' },
    ],
    '2024',
  );
  expect(values).toHaveLength(12);
  expect(values[0]).toEqual({ key: '2024-01', count: 0, cents: 0 });
  expect(values[1]).toEqual({ key: '2024-02', count: 2, cents: 30 });
  expect(values.at(-1)).toEqual({ key: '2024-12', count: 1, cents: 1234 });
  expect(values.reduce((sum, item) => sum + item.cents, 0)).toBe(1264);
});
it('keeps month boundaries and cumulative expenses in integer cents', () => {
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  const data = spendingSeries(
    [
      { amount: 0.1, spent_on: '2026-02-01' },
      { amount: 0.2, spent_on: '2026-02-02' },
      { amount: 20, spent_on: '2026-01-31' },
    ],
    '2026-02',
  );
  expect(data.monthly.at(-1)?.cents).toBe(30);
  expect(data.cumulative).toHaveLength(28);
  expect(data.cumulative[0].cents).toBe(10);
  expect(data.cumulative.at(-1)?.cents).toBe(30);
});
it('groups only recorded dose results using the Lisbon date', () => {
  const data = recordedDoseSeries(
    [
      { status: 'done', occurrence_at: '2026-09-29T23:30:00Z' },
      { status: 'skipped', occurrence_at: '2026-09-30T08:00:00Z' },
    ],
    '2026-09-30',
  );
  expect(data).toHaveLength(14);
  expect(data.at(-1)).toEqual({ key: '2026-09-30', taken: 1, skipped: 1 });
  expect(data[0]).toEqual({ key: '2026-09-17', taken: 0, skipped: 0 });
});
it('uses the selected history window for daily records', () => {
  const data = recordedDoseSeries(
    [
      { status: 'done', occurrence_at: '2026-09-24T08:00:00Z' },
      { status: 'skipped', occurrence_at: '2026-09-23T08:00:00Z' },
    ],
    '2026-09-30',
    7,
  );
  expect(data).toHaveLength(7);
  expect(data[0]).toEqual({ key: '2026-09-24', taken: 1, skipped: 0 });
  expect(data.reduce((sum, row) => sum + row.skipped, 0)).toBe(0);
});
