// Discount codes and campaigns from site.promos (data in promos/promos.js, lessons L32).

// Today's date in the UK (YYYY-MM-DD): offers start and end on UK days.
export function ukToday(now = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
}

const VALID_DAY = /^\d{4}-\d{2}-\d{2}$/;

// Offers that run today: started, not ended, complete enough to show. Codes first, then bigger saving.
export function activePromos(site, now = Date.now()) {
  const today = ukToday(now);
  return (site.promos || [])
    .filter(p => p && p.id && p.retailer && p.slug && VALID_DAY.test(p.start || '') && VALID_DAY.test(p.end || ''))
    .filter(p => p.start <= today && today <= p.end)
    .filter(p => (p.kind === 'code' ? Boolean(p.code) : Number(p.upTo) > 0))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'code' ? -1 : 1) || (Number(a.minSpend) || 0) - (Number(b.minSpend) || 0));
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
