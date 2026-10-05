import { useEffect, useState, type ReactNode } from 'react';
import { I18nContext, type Locale } from './context';
import { pt, en } from './strings';
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() =>
    localStorage.getItem('lembra-locale') === 'en' ? 'en' : 'pt-PT',
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem('lembra-locale', locale);
  }, [locale]);
  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: (key) => (locale === 'en' ? en : pt)[key],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}
