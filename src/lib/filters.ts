import { parseCents, toCents } from './money';

export function matchesSearch(value: string, search: string) {
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim();
  return normalize(value).includes(normalize(search));
}
export function matchesCategory(value: string | null, category: string) {
  return (
    category === 'all' ||
    (category === 'none' ? value === null : value === category)
  );
}
export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export type ExpenseFilters = {
  search: string;
  category: string;
  origin: string;
  minimum: string;
  maximum: string;
};
export function amountBounds(
  filters: Pick<ExpenseFilters, 'minimum' | 'maximum'>,
) {
  try {
    const minimum = filters.minimum.trim() ? parseCents(filters.minimum) : 0;
    const maximum = filters.maximum.trim()
      ? parseCents(filters.maximum)
      : Infinity;
    return minimum <= maximum ? { minimum, maximum } : null;
  } catch {
    return null;
  }
}
export function matchesExpense(
  row: {
    amount: number;
    category_id: string | null;
    completion_id: string | null;
    note?: string | null;
  },
  filters: ExpenseFilters,
  categoryName = '',
) {
  const bounds = amountBounds(filters);
  return (
    !!bounds &&
    matchesSearch(`${row.note || ''} ${categoryName}`, filters.search) &&
    matchesCategory(row.category_id, filters.category) &&
    (filters.origin === 'all' ||
      (filters.origin === 'bill' ? !!row.completion_id : !row.completion_id)) &&
    toCents(row.amount) >= bounds.minimum &&
    toCents(row.amount) <= bounds.maximum
  );
}

export function matchesDatePeriod(
  day: string,
  period: string,
  today: string,
  paid = false,
) {
  if (period === 'all') return true;
  if (period === 'overdue') return day < today && !paid;
  if (period === 'past90') return day < today && day >= shiftDay(today, -90);
  return (
    day >= today &&
    day <=
      shiftDay(today, period === 'next7' ? 6 : period === 'next30' ? 29 : 90)
  );
}
