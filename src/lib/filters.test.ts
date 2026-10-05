import { expect, it } from 'vitest';
import {
  amountBounds,
  matchesDatePeriod,
  matchesExpense,
  matchesSearch,
  shiftDay,
} from './filters';

it('finds names without requiring accents or capitalization', () => {
  expect(matchesSearch('Consulta de João', '  JOAO ')).toBe(true);
  expect(matchesSearch('Consulta de João', 'Maria')).toBe(false);
});
it('combines category, source, search and inclusive cent bounds', () => {
  const row = {
    amount: 12.34,
    category_id: 'health',
    completion_id: 'paid-bill',
    note: 'Farmácia',
  };
  const filters = {
    search: 'farmacia',
    category: 'health',
    origin: 'bill',
    minimum: '12,34',
    maximum: '12.34',
  };
  expect(matchesExpense(row, filters)).toBe(true);
  expect(matchesExpense(row, { ...filters, origin: 'manual' })).toBe(false);
  expect(matchesExpense(row, { ...filters, category: 'none' })).toBe(false);
  expect(matchesExpense(row, { ...filters, maximum: '12,33' })).toBe(false);
  expect(amountBounds({ minimum: 'invalid', maximum: '' })).toBeNull();
});
it('keeps week filters on calendar-day boundaries across daylight saving', () => {
  expect(shiftDay('2026-10-24', 6)).toBe('2026-10-30');
  expect(matchesDatePeriod('2026-10-30', 'next7', '2026-10-24')).toBe(true);
  expect(matchesDatePeriod('2026-10-31', 'next7', '2026-10-24')).toBe(false);
  expect(matchesDatePeriod('2026-10-23', 'next7', '2026-10-24')).toBe(false);
});
it('excludes paid bills from overdue and bounds past history', () => {
  expect(matchesDatePeriod('2026-09-30', 'overdue', '2026-10-01')).toBe(true);
  expect(matchesDatePeriod('2026-09-30', 'overdue', '2026-10-01', true)).toBe(
    false,
  );
  expect(matchesDatePeriod('2026-01-01', 'past90', '2026-10-01')).toBe(false);
  expect(matchesDatePeriod('2026-01-01', 'all', '2026-10-01')).toBe(true);
});
