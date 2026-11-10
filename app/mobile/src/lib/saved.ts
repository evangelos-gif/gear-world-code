// Saved products, kept on the phone so the Saved tab opens without internet. No React or native code here,
// so it can be tested with plain Node; saved-context.tsx stores the list and the pictures on the phone.
import type { Product } from './api';

export const MAX_SAVED = 100;

export type SavedItem = Product & {
  /** The day the person saved it (YYYY-MM-DD, phone time). */
  savedAt: string;
  /** The last day the app read this product from its site (YYYY-MM-DD), or '' if never since saving. */
  refreshedAt: string;
  /** The site answered and no longer lists it (hidden, removed, or not delivered to this country). */
  notListed: boolean;
  /** The picture saved on the phone (file:// address), or '' while it is not saved yet. */
  imageFile: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function toSaved(p: Product, today: string): SavedItem {
  return { ...p, savedAt: today, refreshedAt: '', notListed: false, imageFile: '' };
}

/** Newest first, no duplicates, at most MAX_SAVED. */
export function addSaved(list: SavedItem[], item: SavedItem): SavedItem[] {
  return [item, ...list.filter(x => x.key !== item.key)].slice(0, MAX_SAVED);
}

export function removeSaved(list: SavedItem[], key: string): SavedItem[] {
  return list.filter(x => x.key !== key);
}

/**
 * Puts the newest price, stock and check day of one world's products into the list. A product the site no longer
 * lists is kept (the person decides) but marked; that is only trusted when the site answered for exactly these ids.
 */
export function mergeFresh(list: SavedItem[], worldKey: string, fresh: Product[], listed: boolean, today: string): SavedItem[] {
  const byKey = new Map(fresh.map(p => [p.key, p]));
  return list.map(item => {
    if (item.worldKey !== worldKey) return item;
    const p = byKey.get(item.key);
    if (!p) return listed ? { ...item, notListed: true, refreshedAt: today } : item;
    return {
      ...item,
      name: p.name || item.name,
      brand: p.brand,
      retailer: p.retailer || item.retailer,
      price: p.price,
      wasPrice: p.wasPrice,
      currency: p.currency,
      inStock: p.inStock,
      checkRetailer: p.checkRetailer,
      checked: p.checked ?? item.checked,
      image: p.image || item.image,
      productUrl: p.productUrl,
      outUrl: p.outUrl,
      notListed: false,
      refreshedAt: today
    };
  });
}

/** The ids to ask each world for, at most 60 per world (the site's page size). */
export function idsByWorld(list: SavedItem[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const item of list) {
    const ids = (out[item.worldKey] ??= []);
    if (ids.length < 60 && !ids.includes(item.id)) ids.push(item.id);
  }
  return out;
}

/** Reads the stored list; anything broken is dropped, never trusted. */
export function parseSaved(text: string | null): SavedItem[] {
  if (!text) return [];
  let data: unknown;
  try { data = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(data)) return [];
  const out: SavedItem[] = [];
  for (const raw of data) {
    const x = (raw ?? {}) as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
    const key = s(x.key);
    const id = s(x.id);
    const worldKey = s(x.worldKey);
    if (!key || !id || !/^[A-Z]{3}$/.test(worldKey) || key !== `${worldKey}:${id}`) continue;
    if (!/^https:\/\//.test(s(x.base))) continue;
    out.push({
      key, id, worldKey,
      worldName: s(x.worldName), base: s(x.base), name: s(x.name), brand: s(x.brand), retailer: s(x.retailer),
      category: s(x.category), price: n(x.price), wasPrice: n(x.wasPrice), currency: s(x.currency) || 'GBP',
      inStock: typeof x.inStock === 'boolean' ? x.inStock : null,
      checkRetailer: x.checkRetailer === true,
      checked: DAY.test(s(x.checked)) ? s(x.checked) : null,
      image: /^https:\/\//.test(s(x.image)) ? s(x.image) : '',
      productUrl: /^https:\/\//.test(s(x.productUrl)) ? s(x.productUrl) : s(x.base),
      outUrl: /^https:\/\//.test(s(x.outUrl)) ? s(x.outUrl) : '',
      savedAt: DAY.test(s(x.savedAt)) ? s(x.savedAt) : '',
      refreshedAt: DAY.test(s(x.refreshedAt)) ? s(x.refreshedAt) : '',
      notListed: x.notListed === true,
      imageFile: /^file:\/\//.test(s(x.imageFile)) ? s(x.imageFile) : ''
    });
    if (out.length >= MAX_SAVED) break;
  }
  return out;
}

/** A file name for a saved picture: the product key and the picture's own extension. */
export function imageFileName(item: Pick<SavedItem, 'worldKey' | 'id' | 'image'>): string {
  const ext = /\.(jpe?g|png|webp|gif)(?:[?#]|$)/i.exec(item.image)?.[1]?.toLowerCase().replace('jpeg', 'jpg') ?? 'jpg';
  return `${item.worldKey.toLowerCase()}-${item.id.replace(/[^0-9a-z]/gi, '')}.${ext}`;
}
