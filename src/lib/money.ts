export function parseCents(value: string): number {
  const match = /^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError('Invalid monetary amount');
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}
export function toCents(value: number | string): number {
  return parseCents(String(value));
}
export function decimalAmount(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 999999999999)
    throw new RangeError('Invalid cents');
  return Number((cents / 100).toFixed(2));
}
export function formatMoney(cents: number, locale = 'pt-PT'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}
