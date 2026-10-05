import rrule, { type RRule as RRuleType } from 'npm:rrule@2.8.1';
// Deno receives CommonJS while Vite receives ESM; keep recurrence logic identical.
export const { RRule } = rrule;
export type RRule = RRuleType;
