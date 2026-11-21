// Saved products: kept only on this phone (no account), with the price each one had when it was saved.
// Each time the list opens, the app looks every product up again on its own Gear World site (the same public
// product API the world screens use, GET only) and shows whether the price went down or up since then.
// Plain functions, no React, so the Node tests can check them.
import { safeBase, safeHttps, type Product } from './api.ts';

export const SAVED_KEY = 'gw-saved-v1';
export const SAVED_MAX = 100;
/** A saved product is looked up again at most this often, unless the person pulls the list down to refresh. */
export const CHECK_EVERY_MS = 15 * 60 * 1000;

export type Latest = {
  price: number | null;
  wasPrice: number | null;
  inStock: boolean | null;
  /** false: the product's site answered and the product is not listed there at the moment. */
  listed: boolean;
  checkedAt: number;
};

export type SavedItem = {
  product: Product;
  savedAt: number;
  savedPrice: number | null;
  latest: Latest | null;
};

export type Change =
  | { kind: 'down' | 'up'; amount: number }
  | { kind: 'same' | 'gone' | 'unknown' };

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const text = (v: unknown, max = 300): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const stock = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

/** The product as it is stored: links checked again, so nothing odd from storage is ever opened. */
export function cleanProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const base = safeBase(p.base);
  const id = text(p.id, 40);
  const worldKey = text(p.worldKey, 6).toUpperCase();
  const name = text(p.name);
  if (!base || !id || !/^[A-Z]{2,6}$/.test(worldKey) || !name) return null;
  const productUrl = safeHttps(p.productUrl);
  return {
    key: `${worldKey}:${id}`,
    id,
    worldKey,
    worldName: text(p.worldName, 80) || worldKey,
    base,
    name,
    brand: text(p.brand, 80),
    retailer: text(p.retailer, 80),
    category: text(p.category, 80),
    price: finite(p.price),
    wasPrice: finite(p.wasPrice),
    currency: /^[A-Z]{3}$/.test(text(p.currency, 3)) ? text(p.currency, 3) : 'GBP',
    inStock: stock(p.inStock),
    image: safeHttps(p.image) ?? '',
    // Only a page on the product's own Gear World site, and its own /out/ link (lessons: links stay on our sites).
    productUrl: productUrl && productUrl.startsWith(`${base}/`) ? productUrl : base,
    outUrl: `${base}/out/${encodeURIComponent(id)}`
  };
}

function cleanLatest(raw: unknown): Latest | null {
  if (!raw || typeof raw !== 'object') return null;
  const l = raw as Record<string, unknown>;
  const checkedAt = typeof l.checkedAt === 'number' && Number.isFinite(l.checkedAt) ? l.checkedAt : 0;
  if (!checkedAt) return null;
  return { price: finite(l.price), wasPrice: finite(l.wasPrice), inStock: stock(l.inStock), listed: l.listed !== false, checkedAt };
}

/** Reads the stored list. A damaged or unknown entry is skipped, never shown. */
export function parseSaved(raw: string | null | undefined): SavedItem[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  const rows = data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items) ? (data as { items: unknown[] }).items : [];
  const out: SavedItem[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const row = r as Record<string, unknown>;
    const product = cleanProduct(row.product);
    if (!product || seen.has(product.key)) continue;
    seen.add(product.key);
    const savedAt = typeof row.savedAt === 'number' && Number.isFinite(row.savedAt) ? row.savedAt : 0;
    out.push({ product, savedAt, savedPrice: finite(row.savedPrice), latest: cleanLatest(row.latest) });
    if (out.length >= SAVED_MAX) break;
  }
  return out;
}

export function serializeSaved(items: SavedItem[]): string {
  return JSON.stringify({ v: 1, items: items.slice(0, SAVED_MAX) });
}

export function isSaved(items: SavedItem[], key: string): boolean {
  return items.some(i => i.product.key === key);
}

/** Newest first. Returns null when the list is full, so the screen can say so instead of dropping an old one. */
export function addSaved(items: SavedItem[], product: Product, now: number): SavedItem[] | null {
  const clean = cleanProduct(product);
  if (!clean) return items;
  const rest = items.filter(i => i.product.key !== clean.key);
  if (rest.length >= SAVED_MAX) return null;
  return [{ product: clean, savedAt: now, savedPrice: clean.price, latest: null }, ...rest];
}

export function removeSaved(items: SavedItem[], key: string): SavedItem[] {
  return items.filter(i => i.product.key !== key);
}

/** The price now compared with the price when it was saved. Small differences (under 1p) count as the same. */
export function priceChange(item: SavedItem): Change {
  const l = item.latest;
  if (!l) return { kind: 'unknown' };
  if (!l.listed) return { kind: 'gone' };
  if (item.savedPrice === null || l.price === null) return { kind: 'unknown' };
  const diff = Math.round((l.price - item.savedPrice) * 100) / 100;
  if (Math.abs(diff) < 0.01) return { kind: 'same' };
  return diff < 0 ? { kind: 'down', amount: -diff } : { kind: 'up', amount: diff };
}

/** The product with the latest price and stock, for the product screen. */
export function withLatest(item: SavedItem): Product {
  const l = item.latest;
  if (!l || !l.listed) return item.product;
  return { ...item.product, price: l.price ?? item.product.price, wasPrice: l.wasPrice, inStock: l.inStock };
}

/** Price drops first (biggest first), then the rest newest first. */
export function sortSaved(items: SavedItem[]): SavedItem[] {
  return [...items].sort((a, b) => {
    const ca = priceChange(a);
    const cb = priceChange(b);
    const da = ca.kind === 'down' ? ca.amount : 0;
    const db = cb.kind === 'down' ? cb.amount : 0;
    if (da !== db) return db - da;
    return b.savedAt - a.savedAt;
  });
}

export function needsCheck(item: SavedItem, now: number, force: boolean): boolean {
  return force || !item.latest || now - item.latest.checkedAt >= CHECK_EVERY_MS;
}

/** What a lookup on the product's site found: the product (or null when it is not in the answer). */
export type Lookup = { found: Product | null; complete: boolean };

/** The words used to find a saved product on its site again: its name (the site keeps the first 8 words). */
export function lookupQuery(product: Product): string {
  return product.name.slice(0, 80);
}

/** Picks the saved product out of a site answer. complete = the answer had every match (no "load more"). */
export function pickFromAnswer(product: Product, products: Product[], hasMore: boolean): Lookup {
  const found = products.find(p => p.id === product.id) ?? null;
  return { found, complete: !hasMore };
}

/**
 * Looks every saved product up again, a few at a time. A product that its site no longer lists is marked as not
 * listed only when the site gave its full answer; when a site does not answer, the last known price stays.
 */
export async function checkPrices(
  items: SavedItem[],
  lookup: (product: Product) => Promise<Lookup>,
  opts: { now: number; force?: boolean; parallel?: number }
): Promise<SavedItem[]> {
  const todo = items.filter(i => needsCheck(i, opts.now, Boolean(opts.force)));
  const results = new Map<string, Latest | null>();
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const item = todo[next++];
      try {
        const r = await lookup(item.product);
        if (r.found) {
          results.set(item.product.key, { price: r.found.price, wasPrice: r.found.wasPrice, inStock: r.found.inStock, listed: true, checkedAt: opts.now });
        } else if (r.complete) {
          results.set(item.product.key, { price: null, wasPrice: null, inStock: null, listed: false, checkedAt: opts.now });
        } else {
          results.set(item.product.key, null);
        }
      } catch {
        results.set(item.product.key, null);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.parallel ?? 3, todo.length)) }, worker));
  return items.map(i => {
    const latest = results.get(i.product.key);
    return latest ? { ...i, latest } : i;
  });
}
