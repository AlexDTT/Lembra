import { toCents } from './money';
import { localDate } from './dates';

export function shiftMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
export function moneyPeriod(month: string, view: 'month' | 'year') {
  return view === 'year'
    ? {
        from: `${month.slice(0, 4)}-01-01`,
        to: `${String(Number(month.slice(0, 4)) + 1).padStart(4, '0')}-01-01`,
      }
    : { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` };
}

export function yearlySpending(
  rows: { amount: number; spent_on: string }[],
  year: string,
) {
  return Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${String(index + 1).padStart(2, '0')}`;
    const expenses = rows.filter((row) => row.spent_on.startsWith(`${key}-`));
    return {
      key,
      count: expenses.length,
      cents: expenses.reduce((sum, row) => sum + toCents(row.amount), 0),
    };
  });
}
export function spendingSeries(
  rows: { amount: number; spent_on: string }[],
  month: string,
) {
  const months = Array.from({ length: 6 }, (_, index) =>
    shiftMonth(month, index - 5),
  );
  const monthly = months.map((key) => ({
    key,
    cents: rows
      .filter((row) => row.spent_on.startsWith(key))
      .reduce((sum, row) => sum + toCents(row.amount), 0),
  }));
  const days = new Date(`${shiftMonth(month, 1)}-01T12:00:00Z`);
  days.setUTCDate(0);
  let total = 0;
  const cumulative = Array.from({ length: days.getUTCDate() }, (_, index) => {
    const key = `${month}-${String(index + 1).padStart(2, '0')}`;
    total += rows
      .filter((row) => row.spent_on === key)
      .reduce((sum, row) => sum + toCents(row.amount), 0);
    return { key, cents: total };
  });
  return { monthly, cumulative };
}
export function recordedDoseSeries(
  rows: { occurrence_at: string; status: string }[],
  day: string,
  count = 14,
) {
  const end = new Date(`${day}T12:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(date.getUTCDate() + index - count + 1);
    const key = date.toISOString().slice(0, 10);
    const items = rows.filter(
      (row) => localDate(new Date(row.occurrence_at)) === key,
    );
    return {
      key,
      taken: items.filter((row) => row.status === 'done').length,
      skipped: items.filter((row) => row.status === 'skipped').length,
    };
  });
}
