import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { FALLBACK_WORLDS, getWorlds, parseRegistry, type World } from './api';

const CACHE_KEY = 'gw-worlds-v1';

type WorldsState = {
  worlds: World[];
  loading: boolean;
  failed: boolean;
  refresh: () => Promise<void>;
  find: (key: string) => World | undefined;
};

const Ctx = createContext<WorldsState | null>(null);

/** The list of worlds comes from the Hub (/api/registry), so a new world shows up without a new app version. */
export function WorldsProvider({ children }: { children: ReactNode }) {
  const [worlds, setWorlds] = useState<World[]>(FALLBACK_WORLDS);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const live = await getWorlds();
      setWorlds(live);
      setFailed(false);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ok: true, sites: live.map(w => ({
        site_key: w.key, site_name: w.name, domain: w.domain, audience: w.audience,
        categories: w.categories.map(c => ({ category_key: c.key, category_name: c.name, slug: c.slug }))
      })) })).catch(() => undefined);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(CACHE_KEY)
      .then(raw => {
        if (!alive || !raw) return;
        try { setWorlds(parseRegistry(JSON.parse(raw))); } catch { /* ignore a bad cache */ }
      })
      .catch(() => undefined)
      .finally(() => { if (alive) refresh(); });
    return () => { alive = false; };
  }, [refresh]);

  const value = useMemo<WorldsState>(() => ({
    worlds, loading, failed, refresh,
    find: key => worlds.find(w => w.key === key.toUpperCase())
  }), [worlds, loading, failed, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorlds(): WorldsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWorlds outside WorldsProvider');
  return v;
}
