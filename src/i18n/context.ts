import { createContext, useContext } from 'react';
import type { TranslationKey } from './strings';
export type Locale = 'pt-PT' | 'en';
export const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
} | null>(null);
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('I18n provider missing');
  return value;
}
