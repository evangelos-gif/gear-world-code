import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { LocaleCode } from '@/i18n/core';
import { setAlert, type AlertMap } from './alerts';
import { productsById, type Product } from './api';
import { allowNotifications } from './notify';
import { localDay, readAlerts, SAVED_KEY, syncBackgroundTask, tellNewPrices, writeAlerts } from './price-task';
import { addSaved, idsByWorld, imageFileName, mergeFresh, parseSaved, removeSaved, toSaved, type SavedItem } from './saved';
import { useWorlds } from './worlds-context';

// The Saved tab: products the person keeps. The list and each picture are stored on the phone, so the tab opens
// without internet; nothing about it is sent anywhere. When online, the app asks each site for the newest price.
// Version 1.0.2: a saved product can have a price alert (src/lib/alerts.ts); the phone checks it when the Saved tab
// opens, when the app starts, and in the background (src/lib/price-task.ts).
const STORAGE_KEY = SAVED_KEY;

const today = () => localDay();

type Saved = {
  items: SavedItem[];
  ready: boolean;
  refreshing: boolean;
  /** true after a refresh that could not reach any site (the list shows the last prices). */
  offline: boolean;
  isSaved: (key: string) => boolean;
  find: (key: string) => SavedItem | undefined;
  toggle: (p: Product) => void;
  remove: (key: string) => void;
  refresh: () => Promise<void>;
  hasAlert: (key: string) => boolean;
  /** Turns the price alert of a saved product on or off; 'denied' when the phone does not allow notifications. */
  toggleAlert: (p: Product, locale: LocaleCode) => Promise<'on' | 'off' | 'denied'>;
};

const Ctx = createContext<Saved | null>(null);

function imageDir(): Directory {
  const dir = new Directory(Paths.document, 'saved-images');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

async function keepImage(item: SavedItem): Promise<string> {
  if (!item.image) return '';
  try {
    const file = await File.downloadFileAsync(item.image, new File(imageDir(), imageFileName(item)), { idempotent: true });
    return file.uri;
  } catch {
    return '';
  }
}

function dropImage(item: SavedItem | undefined) {
  if (!item?.imageFile) return;
  try {
    const file = new File(item.imageFile);
    if (file.exists) file.delete();
  } catch { /* the picture was already gone */ }
}

export function SavedProvider({ children }: { children: ReactNode }) {
  const { find: findWorld } = useWorlds();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [alerts, setAlerts] = useState<AlertMap>({});
  const current = useRef<SavedItem[]>([]);

  const storeAlerts = useCallback(async (next: AlertMap) => {
    setAlerts(next);
    await writeAlerts(next);
    await syncBackgroundTask(Object.keys(next).length > 0);
  }, []);

  /** A product that is no longer saved has no alert. */
  const dropAlert = useCallback((key: string) => {
    readAlerts().then(map => { if (key in map) storeAlerts(setAlert(map, { key, price: null, currency: 'GBP' }, false)); });
  }, [storeAlerts]);

  const store = useCallback((next: SavedItem[]) => {
    current.current = next;
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(text => { if (alive) { current.current = parseSaved(text); setItems(current.current); } })
      .catch(() => undefined)
      .finally(() => { if (alive) setReady(true); });
    readAlerts().then(map => {
      if (!alive) return;
      setAlerts(map);
      syncBackgroundTask(Object.keys(map).length > 0);
    });
    return () => { alive = false; };
  }, []);

  const toggle = useCallback((p: Product) => {
    const list = current.current;
    const old = list.find(x => x.key === p.key);
    if (old) { dropImage(old); store(removeSaved(list, p.key)); dropAlert(p.key); return; }
    const item = toSaved(p, today());
    store(addSaved(list, item));
    keepImage(item).then(uri => {
      if (!uri) return;
      store(current.current.map(x => (x.key === item.key ? { ...x, imageFile: uri } : x)));
    });
  }, [store, dropAlert]);

  const remove = useCallback((key: string) => {
    dropImage(current.current.find(x => x.key === key));
    store(removeSaved(current.current, key));
    dropAlert(key);
  }, [store, dropAlert]);

  const toggleAlert = useCallback(async (p: Product, locale: LocaleCode): Promise<'on' | 'off' | 'denied'> => {
    const map = await readAlerts();
    if (p.key in map) { await storeAlerts(setAlert(map, p, false)); return 'off'; }
    if (!(await allowNotifications(locale))) return 'denied';
    // An alert belongs to a saved product: turning it on also saves the product.
    if (!current.current.some(x => x.key === p.key)) {
      const item = toSaved(p, today());
      store(addSaved(current.current, item));
      keepImage(item).then(uri => { if (uri) store(current.current.map(x => (x.key === item.key ? { ...x, imageFile: uri } : x))); });
    }
    const saved = current.current.find(x => x.key === p.key) ?? p;
    await storeAlerts(setAlert(map, saved, true));
    return 'on';
  }, [store, storeAlerts]);

  const refresh = useCallback(async () => {
    if (!current.current.length) return;
    setRefreshing(true);
    let reached = 0;
    let asked = 0;
    try {
      for (const [worldKey, ids] of Object.entries(idsByWorld(current.current))) {
        const world = findWorld(worldKey);
        const sample = current.current.find(x => x.worldKey === worldKey);
        if (!sample) continue;
        asked++;
        try {
          const r = await productsById(world ?? { key: worldKey, name: sample.worldName, base: sample.base }, ids);
          reached++;
          store(mergeFresh(current.current, worldKey, r.found, r.listed, today()));
        } catch { /* this site did not answer: its products keep their last price and check day */ }
      }
      // Price alerts: a lower, freshly checked price of a product with an alert on becomes a notification.
      if (reached) {
        await tellNewPrices(current.current.filter(x => !x.notListed), current.current.map(x => x.key));
        setAlerts(await readAlerts());
      }
      // Pictures that could not be saved before (no internet then).
      for (const item of current.current.filter(x => !x.imageFile && x.image)) {
        const uri = await keepImage(item);
        if (uri) store(current.current.map(x => (x.key === item.key ? { ...x, imageFile: uri } : x)));
      }
    } finally {
      setOffline(asked > 0 && reached === 0);
      setRefreshing(false);
    }
  }, [findWorld, store]);

  // With alerts on, the prices are checked once when the app starts (the Saved tab checks again when it opens).
  const startChecked = useRef(false);
  useEffect(() => {
    if (!ready || startChecked.current || !Object.keys(alerts).length) return;
    startChecked.current = true;
    refresh();
  }, [ready, alerts, refresh]);

  const value = useMemo<Saved>(() => ({
    items, ready, refreshing, offline,
    isSaved: key => items.some(x => x.key === key),
    find: key => items.find(x => x.key === key),
    toggle, remove, refresh,
    hasAlert: key => key in alerts,
    toggleAlert
  }), [items, ready, refreshing, offline, toggle, remove, refresh, alerts, toggleAlert]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSaved(): Saved {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSaved outside SavedProvider');
  return v;
}
