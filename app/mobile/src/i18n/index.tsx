import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { APP_STRINGS, type AppKey } from './app-strings';
import { DEFAULT_LOCALE, fill, isLocale, lookup, pickLocale, type Dict, type LocaleCode } from './core';
import HUB from './hub-strings.json';

const STORAGE_KEY = 'gw-language';

type HubEntry = (typeof HUB)['en-GB'];
type HubTextKey = { [K in keyof HubEntry]: HubEntry[K] extends string ? K : never }[keyof HubEntry];
type HubListKey = { [K in keyof HubEntry]: HubEntry[K] extends string[] ? K : never }[keyof HubEntry];
export type TextKey = AppKey | HubTextKey;

const DICTS: Record<string, Dict> = {};
for (const code of Object.keys(HUB)) {
  DICTS[code] = { ...(HUB as Record<string, Dict>)[code], ...(APP_STRINGS[code] ?? {}) };
}

type I18n = {
  locale: LocaleCode;
  ready: boolean;
  setLocale: (code: LocaleCode) => void;
  t: (key: TextKey, vars?: Record<string, string | number>) => string;
  list: (key: HubListKey) => string[];
};

const Ctx = createContext<I18n | null>(null);

function deviceLocale(): LocaleCode {
  try {
    return pickLocale(getLocales().map(l => l.languageTag));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(deviceLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => { if (alive && isLocale(saved)) setLocaleState(saved); })
      .catch(() => undefined)
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const value = useMemo<I18n>(() => ({
    locale,
    ready,
    setLocale: code => {
      setLocaleState(code);
      AsyncStorage.setItem(STORAGE_KEY, code).catch(() => undefined);
    },
    t: (key, vars) => fill(String(lookup(DICTS, locale, key)), vars),
    list: key => {
      const v = lookup(DICTS, locale, key);
      return Array.isArray(v) ? (v as string[]) : [];
    }
  }), [locale, ready]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}
