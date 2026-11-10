import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { productsById, type Product } from './api';
import { addSaved, idsByWorld, imageFileName, mergeFresh, parseSaved, removeSaved, toSaved, type SavedItem } from './saved';
import { useWorlds } from './worlds-context';

// The Saved tab: products the person keeps. The list and each picture are stored on the phone, so the tab opens
// without internet; nothing about it is sent anywhere. When online, the app asks each site for the newest price.
const STORAGE_KEY = 'gw-saved-v1';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

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
  const current = useRef<SavedItem[]>([]);

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
    return () => { alive = false; };
  }, []);

  const toggle = useCallback((p: Product) => {
    const list = current.current;
    const old = list.find(x => x.key === p.key);
    if (old) { dropImage(old); store(removeSaved(list, p.key)); return; }
    const item = toSaved(p, today());
    store(addSaved(list, item));
    keepImage(item).then(uri => {
      if (!uri) return;
      store(current.current.map(x => (x.key === item.key ? { ...x, imageFile: uri } : x)));
    });
  }, [store]);

  const remove = useCallback((key: string) => {
    dropImage(current.current.find(x => x.key === key));
    store(removeSaved(current.current, key));
  }, [store]);

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

  const value = useMemo<Saved>(() => ({
    items, ready, refreshing, offline,
    isSaved: key => items.some(x => x.key === key),
    find: key => items.find(x => x.key === key),
    toggle, remove, refresh
  }), [items, ready, refreshing, offline, toggle, remove, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSaved(): Saved {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSaved outside SavedProvider');
  return v;
}
