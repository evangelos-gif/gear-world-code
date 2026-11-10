// Discount codes and campaigns from site.promos (data in promos/promos.js, lessons L32).
import { retailerInView } from './visibility.js';

// Today's date in the UK (YYYY-MM-DD): offers start and end on UK days.
export function ukToday(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/;
const KIND_ORDER = { code: 0, coupon: 1, sale: 2 };

function complete(p) {
  if (p.kind === 'code') return Boolean(p.code);
  if (p.kind === 'coupon') return Number(p.off) > 0 && Number(p.minSpend) >= 0;
  // A sale needs its campaign name; it never carries a percentage or a saving (lessons L107).
  return p.kind === 'sale' && Boolean(p.campaign) && p.upTo === undefined && p.extraOff === undefined;
}

// The site as the pages of one answer see it: the same config with the visitor's view (src/lib/visibility.js viewFor)
// as site.promoView. A code then shows only when its retailer is in that view, like the products (Google Ads
// compliance, lessons L107, L114): the codes pages, the footer link, the top bar and the seasonal banner above the
// codes. The engine makes one such copy per request (never a change to the shared config, which other requests read
// at the same time), and the sitemap gets the UK view. A site without promoView (the tests, the tools) shows every code.
export function promoViewSite(site, view) {
  return { ...site, promoView: view || null };
}

// Offers that run today and whose retailer is in the view: started, not ended, complete enough to show. Codes first,
// then coupons (money off with no code to type), then sales; within a kind, the smaller minimum spend first.
export function activePromos(site, now = Date.now(), view = site && site.promoView) {
  const today = ukToday(now);
  return (site.promos || [])
    .filter(p => p && p.id && p.retailer && p.slug && VALID_DAY.test(p.start || '') && VALID_DAY.test(p.end || ''))
    .filter(p => p.start <= today && today <= p.end)
    .filter(complete)
    .filter(p => retailerInView(view, p.retailer))
    .sort((a, b) => ((KIND_ORDER[a.kind] ?? 2) - (KIND_ORDER[b.kind] ?? 2)) || (Number(a.minSpend) || 0) - (Number(b.minSpend) || 0));
}

export function promoRetailers(site, now = Date.now(), view = site && site.promoView) {
  const seen = new Map();
  for (const p of activePromos(site, now, view)) if (!seen.has(p.slug)) seen.set(p.slug, p.retailer);
  return [...seen].map(([slug, name]) => ({ slug, name }));
}

// The one offer shown in the bar at the top of every page: the first active offer that has a bar emoji.
export function barPromo(site, now = Date.now(), view = site && site.promoView) {
  return activePromos(site, now, view).find(p => p.bar) || null;
}

export function findPromo(site, id) {
  return (site.promos || []).find(p => p.id === id) || null;
}
