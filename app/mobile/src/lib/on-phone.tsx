import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { worldProducts, type Product, type World } from './api';
import { addRecent, parseRecent, RECENT_KEY } from './recent';
import {
  addSaved, checkPrices, isSaved, lookupQuery, needsCheck, parseSaved, pickFromAnswer, removeSaved, SAVED_KEY, serializeSaved,
  type SavedItem
} from './saved';

// Saved products and recent searches live only on this phone (AsyncStorage). There is no account and nothing here
// is sent anywhere; the price check only asks each product's own Gear World site for that product again (GET).

type OnPhone = {
  saved: SavedItem[];
  savedReady: boolean;
  checking: boolean;
  isSaved: (key: string) => boolean;
  /** 'full' when the list already holds the most products it can keep. */
  toggleSaved: (product: Product) => 'saved' | 'removed' | 'full';
  removeSaved: (key: string) => void;
  clearSaved: () => void;
  checkSaved: (force?: boolean) => Promise<void>;
  recent: string[];
  addRecent: (query: string) => void;
  clearRecent: () => void;
};

const Ctx = createContext<OnPhone | null>(null);

/** The product's own site, from the saved product itself (a world can leave the Hub list; the link still works). */
const siteOf = (p: Product): World => ({ key: p.worldKey, name: p.worldName, domain: p.base.slice(8), base: p.base, audience: '', categories: [] });

export function OnPhoneProvider({ children }: { children: ReactNode }) {
  const [saved, setSavedState] = useState<SavedItem[]>([]);
  const [recent, setRecentState] = useState<string[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const savedRef = useRef<SavedItem[]>([]);
  const recentRef = useRef<string[]>([]);
  const checkingRef = useRef(false);

  const setSaved = useCallback((next: SavedItem[]) => {
    savedRef.current = next;
    setSavedState(next);
    AsyncStorage.setItem(SAVED_KEY, serializeSaved(next)).catch(() => undefined);
  }, []);

  const setRecent = useCallback((next: string[]) => {
    recentRef.current = next;
    setRecentState(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.multiGet([SAVED_KEY, RECENT_KEY])
      .then(rows => {
        if (!alive) return;
        const stored = Object.fromEntries(rows);
        // Anything saved or searched in the first moment, before the phone's list was read, stays first.
        const items = parseSaved(stored[SAVED_KEY]);
        const now = savedRef.current;
        const mergedSaved = [...now, ...items.filter(i => !isSaved(now, i.product.key))];
        if (now.length) setSaved(mergedSaved); else { savedRef.current = mergedSaved; setSavedState(mergedSaved); }
        const past = parseRecent(stored[RECENT_KEY]);
        const mergedRecent = recentRef.current.reduceRight((list, q) => addRecent(list, q), past);
        if (recentRef.current.length) setRecent(mergedRecent); else { recentRef.current = mergedRecent; setRecentState(mergedRecent); }
      })
      .catch(() => undefined)
      .finally(() => { if (alive) setSavedReady(true); });
    return () => { alive = false; };
  }, [setSaved, setRecent]);

  const checkSaved = useCallback(async (force = false) => {
    const now = Date.now();
    if (checkingRef.current || !savedRef.current.some(i => needsCheck(i, now, force))) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      const checked = await checkPrices(savedRef.current, async product => {
        const page = await worldProducts(siteOf(product), { search: lookupQuery(product), limit: 60 });
        return pickFromAnswer(product, page.products, page.hasMore);
      }, { now, force });
      // The list may have changed while the prices were checked: keep it as it is now, add only the new prices.
      const latest = new Map(checked.map(i => [i.product.key, i.latest]));
      setSaved(savedRef.current.map(i => {
        const l = latest.get(i.product.key);
        return l && l.checkedAt === now ? { ...i, latest: l } : i;
      }));
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [setSaved]);

  const value = useMemo<OnPhone>(() => ({
    saved, savedReady, checking, checkSaved, recent,
    isSaved: key => isSaved(saved, key),
    toggleSaved: product => {
      if (isSaved(savedRef.current, product.key)) { setSaved(removeSaved(savedRef.current, product.key)); return 'removed'; }
      const next = addSaved(savedRef.current, product, Date.now());
      if (!next) return 'full';
      setSaved(next);
      return 'saved';
    },
    removeSaved: key => setSaved(removeSaved(savedRef.current, key)),
    clearSaved: () => setSaved([]),
    addRecent: query => setRecent(addRecent(recentRef.current, query)),
    clearRecent: () => setRecent([])
  }), [saved, savedReady, checking, checkSaved, recent, setSaved, setRecent]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnPhone(): OnPhone {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOnPhone outside OnPhoneProvider');
  return v;
}
