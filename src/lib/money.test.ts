import { describe, expect, it } from 'vitest';
import { decimalAmount, parseCents, toCents, formatMoney } from './money';
describe('integer cents', () => {
  it('parses Portuguese and English decimal input without floating arithmetic', () => {
    expect(parseCents('12,34')).toBe(1234);
    expect(parseCents('12.3')).toBe(1230);
    expect(parseCents('0')).toBe(0);
    expect(toCents(0.1) + toCents(0.2)).toBe(30);
  });
  it('roundtrips database amounts', () => {
    for (const cents of [0, 1, 1234, 999999999999])
      expect(toCents(decimalAmount(cents))).toBe(cents);
  });
  it('rejects negatives, extra precision, infinity and amounts exceeding numeric(12,2)', () => {
    for (const value of [
      '-1',
      '1.001',
      'NaN',
      'Infinity',
      '10000000000',
      '1e3',
      '',
    ])
      expect(() => parseCents(value)).toThrow();
    expect(() => decimalAmount(1.5)).toThrow();
  });
  it('formats euros in the chosen locale', () => {
    expect(formatMoney(1234, 'en')).toBe('€12.34');
    expect(formatMoney(1234, 'pt-PT')).toContain('12,34');
  });
});
