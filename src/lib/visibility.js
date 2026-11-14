// Which products a visitor sees (Google Ads compliance, 9 Nov 2026, lessons L107). Google suspended the Ads account for
// "unacceptable business practices": offering products the visitor cannot get, and claims that are not true. So:
//
// A. Delivery country (Cloudflare request.cf.country). The countries of each retailer are the site config's deliversTo
//    (src/lib/delivery.js): `default` for every retailer that is not named, `retailers` for the others.
//    Since 14 Nov 2026 (the open-country rule, owner 12 and 14 Nov 2026, lessons L151, src/lib/open-countries.js):
//    - An OPEN country (OPEN_COUNTRIES, today only the UK) sees only the retailers that deliver there.
//    - The United States keep their view of 14 Nov 2026 (lessons L141): what ships to the US where a retailer of the site
//      does, otherwise the UK view with the bar.
//    - Every other country, and an unknown one, sees ALL the products ("all" view), each card, product page and code
//      card with "<retailer> delivers to ..." (src/pages/layout.js deliveryLine), and the bar below. Until L151 every
//      European country had a view of its own (only what delivered there) and the rest the UK view.
//    Google's crawlers get the UK view (src/engine.js), so the sitemaps, Search and Merchant Center see what they saw
//    before. A site without deliversTo shows every retailer.
//    The countries that see the same retailers share one "group" (gb, all, us), and the page cache keeps one copy per
//    group, so one country never gets another country's page.
//    A visitor of the UK view or the all view whose country the UK retailers do not deliver to (an unknown country, any
//    country but the UK, the US where no retailer ships) sees a slim bar at the top of every page: "We're adding
//    retailers for your country..." (owner's option A, 9 Nov 2026; needsUkBar below). The engine adds it to each answer
//    after the page cache, so it costs no D1 read and no cache copy of its own.
//    strictCountries (site config, empty today): a country in that list gets only what delivers there (its own group,
//    empty when nothing does), as an open country does.
// B. Freshness. A product whose price was last checked more than 30 days ago is not listed (its page says so), and one
//    checked 14-30 days ago says "Check price and stock at the retailer" instead of a stock claim, next to the real
//    "Price checked" date. The date is last_seen_at (the older layout: updated_at, which the import changes only when
//    the price or stock changes).
//
// D1 cost (lessons L51, L105): the filter is one more WHERE term on each query, written with a unary + on the columns and
// inside likelihood(..., 1.0), so SQLite keeps the index of today for every hot query (category, price, group key).
// One plan changes on the new layout: the brands of a category are counted from the category's rows and a sort,
// instead of a walk of the whole brand index (every active row of the site). That reads far fewer rows for every
// category except a huge one that is nearly all shown (AGW tyres for a visitor from Belgium: about 61,000 rows instead of
// 38,000), measured with tools/d1-view-bench.mjs.
// D1 counts the rows a query steps through in its index or table, not the reads of a row by its id that follow an
// index (measured with the D1 of wrangler: COUNT(*) over an index range with or without the filter, the same rows), so a
// filter over a range that is read anyway costs nothing, and fewer rows reach the sorts and window functions after it.
// Only a list that stops at a LIMIT walks further when rows are filtered out; "similar products" bounds that walk
// (src/db.js). tests/worker/visibility.test.mjs checks the plans and the results.
import { deliveryCountries, WORLDWIDE } from './delivery.js';
import { OPEN_COUNTRIES } from './open-countries.js';

export const EU_COUNTRIES = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
// The European Economic Area outside the EU.
export const EEA_ONLY = ['IS', 'LI', 'NO'];
// The countries with a view of their own (lessons L151, owner 12 and 14 Nov 2026): the open countries
// (src/lib/open-countries.js, today the UK), which see only what delivers there, and the United States, which keep the
// view of 14 Nov 2026 (L141). Every other country, and an unknown one, sees ALL the products ("all" view), each with
// where its retailer delivers. Until L151 every European country had a view of its own and the rest the UK view.
export const OWN_VIEW_COUNTRIES = [...new Set([...OPEN_COUNTRIES, 'US'])];
export const HOME_COUNTRY = 'GB';
export const HOME_GROUP = 'gb';
export const ALL_GROUP = 'all';

// Days after the last price check: over HIDE_AFTER_DAYS a product is not listed, over CHECK_AFTER_DAYS it says
// "Check price and stock at the retailer" (owner, 9 Nov 2026).
export const HIDE_AFTER_DAYS = 30;
export const CHECK_AFTER_DAYS = 14;

// The clock (tests set a fixed day; the Worker always uses the real time).
let clock = () => Date.now();
export function useClock(fn) {
  clock = typeof fn === 'function' ? fn : () => Date.now();
}
export function now() {
  return clock();
}

// Does a list of country codes (deliversTo) cover a country? 'WORLD' covers all, 'EU' every EU country.
export function listCovers(list, cc) {
  const codes = Array.isArray(list) ? list : [];
  return codes.includes(WORLDWIDE) || codes.includes(cc) || (codes.includes('EU') && EU_COUNTRIES.includes(cc));
}

function retailerCovers(site, retailer, cc) {
  return listCovers(deliveryCountries(site, retailer), cc);
}

// A short stable name for a group of countries: the codes themselves for up to 3, else "eu-" and a hash of the list.
function groupId(codes) {
  if (codes.length <= 3) return codes.join('-').toLowerCase();
  let h = 2166136261;
  for (const ch of codes.join(',')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `eu-${(h >>> 0).toString(16).padStart(8, '0').slice(0, 6)}`;
}

// The country groups of a site: { home: group, all: group, byCountry: Map(code -> group), list: [group] }.
// group = { id, countries, hidden: [names] (NOT IN) or null, only: [names] (IN) or null }.
// all (L151): the view of every country without a view of its own, every retailer; on a site whose UK view hides no
// retailer it is the UK group itself (one cached copy, as before).
// The retailers of a site that deliver to one country: { sig, hidden: [names] (NOT IN) or null, only: [names] (IN) or
// null }, or null when none of them does.
function deliveryRule(site, cc) {
  const cfg = site && site.deliversTo;
  if (!cfg) return { sig: 'not:', hidden: null, only: null };
  const names = Object.keys(cfg.retailers || {}).sort();
  if (listCovers(cfg.default, cc)) {
    const hidden = names.filter(n => !retailerCovers(site, n, cc));
    return { sig: `not:${hidden.join('|')}`, hidden: hidden.length ? hidden : null, only: null };
  }
  const only = names.filter(n => retailerCovers(site, n, cc));
  return only.length ? { sig: `only:${only.join('|')}`, hidden: null, only } : null;
}

const groupCache = new WeakMap();
export function countryGroups(site) {
  if (site && groupCache.has(site)) return groupCache.get(site);
  const ruleFor = cc => deliveryRule(site, cc);
  const homeRule = ruleFor(HOME_COUNTRY) || { sig: 'not:', hidden: null, only: null };
  const strict = new Set([...strictCountries(site), ...OPEN_COUNTRIES.filter(c => c !== HOME_COUNTRY)]);
  const bySig = new Map();
  const home = { id: HOME_GROUP, countries: [], hidden: homeRule.hidden, only: homeRule.only };
  bySig.set(homeRule.sig, home);
  // Every retailer: the same rows as the UK view when that view hides none (sig 'not:').
  const allRule = { sig: 'not:', hidden: null, only: null };
  let all = bySig.get(allRule.sig);
  if (!all) { all = { id: ALL_GROUP, countries: [], hidden: null, only: null }; bySig.set(allRule.sig, all); }
  const byCountry = new Map();
  for (const cc of [...OWN_VIEW_COUNTRIES, ...[...strict].filter(c => !OWN_VIEW_COUNTRIES.includes(c))]) {
    // An open or strict country with no retailer that delivers there: its own empty view (only: []), never the UK view.
    // The US with no retailer that ships there: the UK view, with the bar (L141).
    const rule = ruleFor(cc) || (strict.has(cc) ? { sig: 'none', hidden: null, only: [] } : homeRule);
    let g = bySig.get(rule.sig);
    if (!g) { g = { id: '', countries: [], hidden: rule.hidden, only: rule.only }; bySig.set(rule.sig, g); }
    g.countries.push(cc);
    byCountry.set(cc, g);
  }
  for (const g of bySig.values()) if (g !== home && g !== all) g.id = groupId(g.countries);
  const list = [...bySig.values()].filter(g => g === home || g === all || g.countries.length);
  const out = { home, all, byCountry, list };
  if (site) groupCache.set(site, out);
  return out;
}

// The countries of a site that see only what delivers there, never the UK view (site.strictCountries, 2-letter codes;
// empty on every site: the network-wide list is OPEN_COUNTRIES, lessons L151).
export function strictCountries(site) {
  return (Array.isArray(site && site.strictCountries) ? site.strictCountries : []).filter(c => /^[A-Z]{2}$/.test(c) && c !== HOME_COUNTRY);
}

// Does this visitor get the bar "We're adding retailers for your country..."? Yes when they see the UK view or the
// "all" view (L151) and the UK retailers do not deliver to their country: unknown, no view of their own, or the US where
// none of the site's retailers ships. Never for the UK (Google's crawlers count as the UK, src/engine.js), a country with
// a view of its own (an open or strict country, the US with its retailers), or a country the UK retailers deliver to.
export function needsUkBar(site, country) {
  const cc = cleanCountry(country);
  if (cc === HOME_COUNTRY) return false;
  if (!cc) return true;
  const groups = countryGroups(site);
  const g = groups.byCountry.get(cc);
  if (g && g !== groups.home && g !== groups.all) return false;
  const cfg = site && site.deliversTo;
  return !(cfg && listCovers(cfg.default, cc));
}

const DAY = 86400000;
const isoDay = t => new Date(t).toISOString().slice(0, 10);

// The cleaned 2-letter country of a request: Cloudflare's request.cf.country ("XX" and "T1" mean unknown or Tor).
export function cleanCountry(value) {
  const cc = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? cc : '';
}

// What one visitor sees. country: the visitor's country ('' = unknown). The dates are whole UTC days:
//   cutoff     a product is listed only when last checked on or after this day (HIDE_AFTER_DAYS ago)
//   checkFrom  checked before this day (CHECK_AFTER_DAYS ago): "Check price and stock at the retailer"
export function viewFor(site, country, at = now()) {
  const cc = cleanCountry(country);
  const groups = countryGroups(site);
  // The UK and Google's crawlers: the UK view; the US and an open or strict country: theirs; everyone else: all (L151).
  const g = cc === HOME_COUNTRY ? groups.home : (cc && groups.byCountry.get(cc)) || groups.all;
  return {
    group: g.id,
    country: cc,
    hidden: g.hidden,
    only: g.only,
    // The all view of a site whose UK view hides some retailers: the code cards say where their retailer delivers too.
    everyRetailer: g === groups.all && g !== groups.home,
    cutoff: isoDay(at - HIDE_AFTER_DAYS * DAY),
    checkFrom: isoDay(at - CHECK_AFTER_DAYS * DAY)
  };
}

// Gear World Hub's search (/api/products?deliver_to=, src/engine.js) keeps the views of before L151 until its cards say
// where each retailer delivers (it then asks with &badges=1): the UK, the US and an open or strict country as on the
// site; a European country only what delivers there; every other country, or one no retailer of the site delivers to,
// the UK view. So the Hub never lists a product without saying where it delivers.
const HUB_VIEW_COUNTRIES = [...EU_COUNTRIES, ...EEA_ONLY, 'CH'];
export function hubViewFor(site, country, at = now()) {
  const cc = cleanCountry(country);
  const v = viewFor(site, cc, at);
  const groups = countryGroups(site);
  const own = groups.byCountry.get(cc);
  if (cc === HOME_COUNTRY || (own && own !== groups.all)) return v;
  const rule = HUB_VIEW_COUNTRIES.includes(cc) ? deliveryRule(site, cc) : null;
  if (!rule) return { ...homeView(site, at), country: cc };
  return { ...v, group: `hub-${cc.toLowerCase()}`, hidden: rule.hidden, only: rule.only, everyRetailer: false };
}

// The UK view: sitemaps, /api/stats and everything that must not depend on who asks.
export function homeView(site, at = now()) {
  return viewFor(site, HOME_COUNTRY, at);
}

// The extra WHERE term of a view on the rows named `alias` (the products table, or the older layout's view), or null.
// The + keeps SQLite from using an index for it and likelihood(..., 1.0) tells it the term removes no row, so its
// estimates and its plan stay as they were (the filter still removes the rows, it is only a hint).
export function visibleSql(view, alias = 'p') {
  if (!view) return null;
  const parts = [];
  const binds = [];
  if (view.hidden && view.hidden.length) {
    parts.push(`+${alias}.retailer NOT IN (${view.hidden.map(() => '?').join(', ')})`);
    binds.push(...view.hidden);
  }
  if (view.only && view.only.length) {
    parts.push(`+${alias}.retailer IN (${view.only.map(() => '?').join(', ')})`);
    binds.push(...view.only);
  } else if (view.only) {
    parts.push('0'); // a strict country that no retailer delivers to: nothing
  }
  if (view.cutoff) {
    parts.push(`+${alias}.last_seen_at >= ?`);
    binds.push(view.cutoff);
  }
  return parts.length ? { sql: `likelihood(${parts.join(' AND ')}, 1.0)`, binds } : null;
}

// The same test in JavaScript, on a row that was read: '' (shown), 'country' (the retailer does not deliver to the
// visitor's country) or 'stale' (not checked for more than HIDE_AFTER_DAYS). Text compares as in SQLite (ASCII dates);
// a missing date counts as stale, like NULL in SQL.
export function hiddenReason(view, row) {
  if (!view || !row) return '';
  const r = typeof row.retailer === 'string' ? row.retailer : String(row.retailer ?? '');
  if (view.hidden && view.hidden.includes(r)) return 'country';
  if (view.only && !view.only.includes(r)) return 'country';
  if (view.cutoff && !(typeof row.last_seen_at === 'string' && row.last_seen_at >= view.cutoff)) return 'stale';
  return '';
}

export function isShown(view, row) {
  return hiddenReason(view, row) === '';
}

// Is a retailer in this view, by its delivery countries only (no date)? The discount codes follow the same rule as the
// products: a code shows only to a visitor whose view lists its retailer (lessons L114). No view: every retailer.
export function retailerInView(view, retailer) {
  if (!view) return true;
  const r = typeof retailer === 'string' ? retailer : String(retailer ?? '');
  if (view.hidden && view.hidden.includes(r)) return false;
  if (view.only && !view.only.includes(r)) return false;
  return true;
}

// Checked 14-30 days ago: no stock claim, "Check price and stock at the retailer" (the price check date stays).
export function needsCheck(view, row) {
  if (!view || !view.checkFrom || !row) return false;
  return !(typeof row.last_seen_at === 'string' && row.last_seen_at >= view.checkFrom);
}

// The cache key of a page for a view: the page address plus the group (one copy per country group).
export function cacheKeyUrl(url, view) {
  const u = new URL(String(url));
  if (view && view.group) u.searchParams.set('gw-view', view.group);
  return u.toString();
}
