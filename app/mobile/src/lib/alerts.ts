// Price alerts for saved products (version 1.0.2). The phone itself checks the price of the saved products the
// person asked about and shows a notification when the retailer's price is lower than the last one it saw.
// Nothing is sent to a server: no push keys, no list of phones or saved products anywhere (plan 24/11/2026).
// Rules (Manager 24/11): only real prices with their check day, checked at most 2 days ago (lessons L211), and the
// notification never says "discount", "%" or "sale" (lessons L107): it says the new price and the day it was checked.
// No React or native code here, so it can be tested with plain Node.

export const ALERT_MAX_AGE_DAYS = 2;
export const MAX_ALERTS = 100;

/** The last price the phone saw for each product with an alert on, by product key ("CGW:1047"). */
export type AlertMap = Record<string, { price: number | null; currency: string }>;

export type PriceLike = {
  key: string;
  name: string;
  retailer: string;
  price: number | null;
  currency: string;
  /** The day the site last checked the price (YYYY-MM-DD), or null. */
  checked: string | null;
  inStock: boolean | null;
};

export type PriceAlert = { key: string; name: string; retailer: string; price: number; currency: string; checked: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const KEY = /^[A-Z]{3}:[0-9A-Za-z_-]{1,40}$/;

/** Whole days from `from` to `to` (both YYYY-MM-DD), or null when one of them is not a day. */
export function daysBetween(from: string, to: string): number | null {
  if (!DAY.test(from) || !DAY.test(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : null;
}

/** A price the app may tell about: a real price, checked between today and 2 days ago, not out of stock. */
export function isFresh(p: Pick<PriceLike, 'price' | 'checked' | 'inStock'>, today: string): boolean {
  if (p.price === null || !(p.price > 0) || p.inStock === false || !p.checked) return false;
  const age = daysBetween(p.checked, today);
  return age !== null && age >= 0 && age <= ALERT_MAX_AGE_DAYS;
}

/** Turns the alert of one product on (remembering today's price) or off. */
export function setAlert(map: AlertMap, p: Pick<PriceLike, 'key' | 'price' | 'currency'>, on: boolean): AlertMap {
  const next = { ...map };
  if (!on) { delete next[p.key]; return next; }
  if (!KEY.test(p.key) || (!(p.key in next) && Object.keys(next).length >= MAX_ALERTS)) return next;
  next[p.key] = { price: p.price !== null && p.price > 0 ? p.price : null, currency: p.currency || 'GBP' };
  return next;
}

/** Only the alerts of products that are still saved. */
export function keepSaved(map: AlertMap, savedKeys: string[]): AlertMap {
  const keep = new Set(savedKeys);
  return Object.fromEntries(Object.entries(map).filter(([k]) => keep.has(k)));
}

/**
 * Compares the newest prices with the last ones seen. A notification is made only for a fresh price that is lower,
 * in the same currency; every fresh price becomes the new "last seen", so each change is told once.
 */
export function checkAlerts(map: AlertMap, latest: PriceLike[], today: string): { map: AlertMap; alerts: PriceAlert[] } {
  const next = { ...map };
  const alerts: PriceAlert[] = [];
  for (const p of latest) {
    const last = next[p.key];
    if (!last || !isFresh(p, today)) continue;
    const price = p.price as number;
    const currency = p.currency || 'GBP';
    if (last.price !== null && last.currency === currency && price < last.price) {
      alerts.push({ key: p.key, name: p.name, retailer: p.retailer, price, currency, checked: p.checked as string });
    }
    next[p.key] = { price, currency };
  }
  return { map: next, alerts };
}

/** Reads the stored alerts; anything broken is dropped. */
export function parseAlerts(text: string | null): AlertMap {
  if (!text) return {};
  let data: unknown;
  try { data = JSON.parse(text); } catch { return {}; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: AlertMap = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (!KEY.test(k) || !v || typeof v !== 'object') continue;
    const x = v as Record<string, unknown>;
    const price = typeof x.price === 'number' && Number.isFinite(x.price) && x.price > 0 ? x.price : null;
    const currency = typeof x.currency === 'string' && /^[A-Z]{3}$/.test(x.currency) ? x.currency : 'GBP';
    out[k] = { price, currency };
    if (Object.keys(out).length >= MAX_ALERTS) break;
  }
  return out;
}
