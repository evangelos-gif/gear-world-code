// Discount codes and campaigns from site.promos (data in promos/promos.js, lessons L32).

// Today's date in the UK (YYYY-MM-DD): offers start and end on UK days.
export function ukToday(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/;
const KIND_ORDER = { code: 0, coupon: 1, sale: 2 };

function complete(p) {
  if (p.kind === 'code') return Boolean(p.code);
  if (p.kind === 'coupon') return Number(p.off) > 0 && Number(p.minSpend) >= 0;
  return Number(p.upTo) > 0;
}

// Offers that run today: started, not ended, complete enough to show. Codes first, then coupons (money off with no
// code to type), then sales; within a kind, the smaller minimum spend first.
export function activePromos(site, now = Date.now()) {
  const today = ukToday(now);
  return (site.promos || [])
    .filter(p => p && p.id && p.retailer && p.slug && VALID_DAY.test(p.start || '') && VALID_DAY.test(p.end || ''))
    .filter(p => p.start <= today && today <= p.end)
    .filter(complete)
    .sort((a, b) => ((KIND_ORDER[a.kind] ?? 2) - (KIND_ORDER[b.kind] ?? 2)) || (Number(a.minSpend) || 0) - (Number(b.minSpend) || 0));
}

export function promoRetailers(site, now = Date.now()) {
  const seen = new Map();
  for (const p of activePromos(site, now)) if (!seen.has(p.slug)) seen.set(p.slug, p.retailer);
  return [...seen].map(([slug, name]) => ({ slug, name }));
}

// The one offer shown in the bar at the top of every page: the first active offer that has a bar emoji.
export function barPromo(site, now = Date.now()) {
  return activePromos(site, now).find(p => p.bar) || null;
}

export function findPromo(site, id) {
  return (site.promos || []).find(p => p.id === id) || null;
}
