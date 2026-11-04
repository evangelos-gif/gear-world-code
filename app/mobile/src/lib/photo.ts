// Photo (camera) search helpers without React or native code, so they can be tested with plain Node.
// The app works like the camera button on gearworldhub.com (gear-world-camera.js): the photo is made smaller
// on the phone (max 1024 px JPEG, no hidden details such as GPS), sent once to the Hub's /api/photo-search,
// and never stored. The words found are then searched across all Gear Worlds, the brand's products first.

export const PHOTO_MAX_SIDE = 1024;
export const PHOTO_MAX_BYTES = 1024 * 1024;
/** Below this many products of the brand, the other similar products are shown under them (as on the Hub). */
export const FEW_BRAND = 4;
/** At most this many products per Gear World, as on the Hub. */
export const PER_WORLD = 8;

export type PhotoWorld = { key: string; name: string };
export type PhotoAnswer = {
  product: string;
  query: string;
  keywords: string[];
  brand: string;
  world: PhotoWorld | null;
};

export type PhotoMessage =
  | 'photoNoProduct' | 'photoLimitHour' | 'photoLimitDay' | 'photoTooBig' | 'photoNotPhoto'
  | 'photoUnavailable' | 'photoDenied' | 'photoBlocked';

const str = (v: unknown, max: number): string =>
  (v === null || v === undefined ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, max).trim();

/** The Hub's answer, checked (never trusted). `null` when no product was found. */
export function parsePhotoAnswer(data: unknown): PhotoAnswer | null {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.ok !== true || d.found !== true) return null;
  const query = str(d.query, 80);
  if (query.length < 2) return null;
  const w = (d.world ?? null) as Record<string, unknown> | null;
  const key = w ? str(w.key, 6).toUpperCase() : '';
  return {
    product: str(d.product, 60) || query,
    query,
    keywords: Array.isArray(d.keywords) ? d.keywords.map(k => str(k, 30)).filter(Boolean).slice(0, 6) : [],
    brand: str(d.brand, 40),
    world: /^[A-Z]{2,6}$/.test(key) ? { key, name: str(w?.name, 60) || key } : null
  };
}

/** What the person sees when the photo search could not give words to search for. */
export function photoErrorMessage(status: number, data: unknown): PhotoMessage {
  const error = String(((data ?? {}) as { error?: unknown }).error ?? '');
  if (status === 429) return error === 'limit_day' ? 'photoLimitDay' : 'photoLimitHour';
  if (status === 413) return 'photoTooBig';
  if (status === 400 || status === 415) return 'photoNotPhoto';
  if (status === 200 && (data as { ok?: unknown } | null)?.ok === true) return 'photoNoProduct';
  return 'photoUnavailable';
}

/** The size to shrink a photo to: the long side at most `max` px. `null` = it is small enough already. */
export function shrinkSize(width: number, height: number, max = PHOTO_MAX_SIDE): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0)) return { width: max };
  if (width <= max && height <= max) return null;
  return width >= height ? { width: max } : { height: max };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 text to bytes (no atob, so it works the same everywhere). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = String(b64 || '').replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let n = 0;
  let bits = 0;
  let value = 0;
  for (let i = 0; i < clean.length; i++) {
    value = (value << 6) | B64.indexOf(clean[i]);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (value >> bits) & 0xff;
    }
  }
  return out.slice(0, n);
}

/** A JPEG file starts with FF D8 FF. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function withoutWords(text: string, words: string): string {
  const drop = new Set(words.toLowerCase().split(/\s+/).filter(Boolean));
  return text.split(/\s+/).filter(w => w && !drop.has(w.toLowerCase())).join(' ');
}

export type PlanStep = { q: string; brand: string };

/**
 * The words to search for, in order: 1. with the brand, when the photo shows one; 2. the words without the brand
 * (searched at the same time as 1); 3. the product type, only when nothing was found.
 */
export function searchPlan(answer: PhotoAnswer): PlanStep[] {
  const plan: PlanStep[] = [];
  const add = (text: string, brand: string) => {
    const q = text.replace(/\s+/g, ' ').trim().slice(0, 80).trim();
    if (q.length >= 2 && !plan.some(p => p.q.toLowerCase() === q.toLowerCase())) plan.push({ q, brand });
  };
  const brand = answer.brand;
  const hasBrand = !!brand && answer.query.toLowerCase().includes(brand.toLowerCase());
  if (brand) add(hasBrand ? answer.query : `${brand} ${answer.query}`, brand);
  add(hasBrand ? withoutWords(answer.query, brand) : answer.query, '');
  add(answer.product, '');
  return plan;
}

type Item = { key: string; worldKey: string; brand: string; name: string };

/** Is this product of the brand in the photo? (e.g. "Bosch" also finds "Bosch Professional") */
export function isBrand(product: Item, brand: string): boolean {
  const b = brand.toLowerCase().trim();
  if (!b) return false;
  const first = b.split(/\s+/)[0];
  const pb = product.brand.toLowerCase().trim();
  return (pb.length >= 2 && (pb.includes(b) || b.includes(pb))) || (first.length >= 3 && product.name.toLowerCase().includes(first));
}

/** The brand's products first, then the other similar ones; each product once, at most PER_WORLD per world. */
export function mergeResults<T extends Item>(first: T[], second: T[]): T[] {
  const seen = new Set<string>();
  const perWorld = new Map<string, number>();
  const out: T[] = [];
  for (const p of first.concat(second)) {
    const n = perWorld.get(p.worldKey) ?? 0;
    if (seen.has(p.key) || n >= PER_WORLD) continue;
    seen.add(p.key);
    perWorld.set(p.worldKey, n + 1);
    out.push(p);
  }
  return out;
}

/**
 * Runs the search plan with `search` (the Hub search; `null` = that search failed).
 * Returns the products to show and the words used, or `null` when every search failed.
 */
export async function photoResults<T extends Item>(
  answer: PhotoAnswer,
  search: (q: string) => Promise<T[] | null>
): Promise<{ products: T[]; query: string } | null> {
  const plan = searchPlan(answer);
  let query = answer.query;
  let products: T[] | null = null;
  let spare: { q: string; found: T[] } | null = null;
  if (plan.length && plan[0].brand) {
    const branded = plan.shift()!;
    const plain = plan.length ? plan.shift()! : null;
    const [a, b] = await Promise.all([search(branded.q), plain ? search(plain.q) : Promise.resolve(null)]);
    const hits = (a ?? []).filter(p => isBrand(p, branded.brand));
    if (hits.length) {
      products = mergeResults(hits, hits.length >= FEW_BRAND ? [] : (b ?? []));
      query = branded.q;
    } else if (b && b.length) {
      products = mergeResults(b, []);
      query = plain!.q;
    } else {
      if (a || b) { products = []; query = plain ? plain.q : branded.q; }
      if (a && a.length) spare = { q: branded.q, found: a };
    }
  }
  for (const step of plan) {
    if (products && products.length) break;
    const found = await search(step.q);
    if (!found) continue;
    if (!products || found.length) { products = mergeResults(found, []); query = step.q; }
  }
  if (products && !products.length && spare) { products = mergeResults(spare.found, []); query = spare.q; }
  return products ? { products, query } : null;
}

/** Products of the best Gear World first, then the other worlds by how many products they have. */
export function orderByBest<T extends { worldKey: string }>(products: T[], bestKey: string | null | undefined): T[] {
  const best = String(bestKey ?? '').toUpperCase();
  const count = new Map<string, number>();
  const first = new Map<string, number>();
  products.forEach((p, i) => {
    count.set(p.worldKey, (count.get(p.worldKey) ?? 0) + 1);
    if (!first.has(p.worldKey)) first.set(p.worldKey, i);
  });
  const rank = (k: string) => [k === best ? 0 : 1, -(count.get(k) ?? 0), first.get(k) ?? 0];
  return products
    .map((p, i) => ({ p, i }))
    .sort((x, y) => {
      const a = rank(x.p.worldKey);
      const b = rank(y.p.worldKey);
      return a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || x.i - y.i;
    })
    .map(x => x.p);
}

/** How many products each world has, in the order they are shown. */
export function countByWorld(products: { worldKey: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of products) out[p.worldKey] = (out[p.worldKey] ?? 0) + 1;
  return out;
}

/** "We found: …": what the product is first, then the other words (each once). */
export function photoWords(answer: PhotoAnswer, query: string): string {
  const type = answer.product.trim();
  const typeWords = type.toLowerCase().split(/\s+/);
  const extra = answer.keywords.filter(k => k && !typeWords.includes(k.toLowerCase()));
  const list = (type ? [type] : []).concat(extra);
  return (list.length ? list : [query]).join(' · ');
}

/** The answer as a short text for the search screen's address, and back (checked again). */
export function encodePhotoParam(answer: PhotoAnswer): string {
  return JSON.stringify({ p: answer.product, q: answer.query, k: answer.keywords, b: answer.brand, w: answer.world });
}

export function decodePhotoParam(value: unknown): PhotoAnswer | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const d = JSON.parse(value) as Record<string, unknown>;
    return parsePhotoAnswer({ ok: true, found: true, product: d.p, query: d.q, keywords: d.k, brand: d.b, world: d.w });
  } catch {
    return null;
  }
}
