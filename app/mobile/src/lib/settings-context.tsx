import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import Constants from 'expo-constants';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getAppConfig } from './api';
import { isCountry, parseAppConfig, setClientVersion, setDeliveryCountry, setHiddenRetailers, type Country } from './client';

// Version 1.0.2: the delivery country the person chose, and the Hub's file for the app (what to hide).
// Both are kept on the phone, so they also work in the background price check (src/lib/price-task.ts).
export const COUNTRY_KEY = 'gw-delivery-country';
export const CONFIG_KEY = 'gw-app-config';

setClientVersion(Constants.expoConfig?.version ?? '');

/** Puts the stored country and the last Hub file into effect; used at start and by the background task. */
export async function loadStoredSettings(): Promise<Country | ''> {
  const [country, config] = await Promise.all([
    AsyncStorage.getItem(COUNTRY_KEY).catch(() => null),
    AsyncStorage.getItem(CONFIG_KEY).catch(() => null)
  ]);
  const code = isCountry(country) ? country : '';
  setDeliveryCountry(code);
  if (config) {
    try { setHiddenRetailers(parseAppConfig(JSON.parse(config)).hiddenRetailers); } catch { /* a broken copy hides nothing */ }
  }
  return code;
}

type Settings = {
  ready: boolean;
  /** '' = automatic (where the phone is). */
  country: Country | '';
  setCountry: (code: Country | '') => void;
};

const Ctx = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<Country | ''>('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadStoredSettings()
      .then(code => { if (alive) setCountryState(code); })
      .catch(() => undefined)
      .finally(() => { if (alive) setReady(true); });
    // The newest Hub file; without internet or before the Hub has one, the last copy (or nothing) stays.
    getAppConfig()
      .then(config => {
        setHiddenRetailers(config.hiddenRetailers);
        return AsyncStorage.setItem(CONFIG_KEY, JSON.stringify({ hidden_retailers: config.hiddenRetailers }));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const setCountry = useCallback((code: Country | '') => {
    setDeliveryCountry(code);
    setCountryState(code);
    (code ? AsyncStorage.setItem(COUNTRY_KEY, code) : AsyncStorage.removeItem(COUNTRY_KEY)).catch(() => undefined);
  }, []);

  const value = useMemo<Settings>(() => ({ ready, country, setCountry }), [ready, country, setCountry]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): Settings {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings outside SettingsProvider');
  return v;
}

/** The country set on the phone (its region, e.g. "DE"), or '' when the phone does not say. */
export function phoneRegion(): string {
  try { return getLocales()[0]?.regionCode ?? ''; } catch { return ''; }
}
