// bol.com Partnerprogramma (site ID 1559450, lessons L154, L204): where the 10 sites that list bol.com show it.
// bol.com delivers to the Netherlands and Belgium only, and its names are Dutch, so the shop is seen ONLY by visitors from
// those countries (deliversTo.languages 'nl', lessons L165): never in the UK view, never in the all view of the other
// countries, never by Google's crawlers (the UK view), the sitemaps or the UK numbers of /api/stats.
// One place for the 10 site configs (sites/<code>/site.config.js spreads bolDelivery() into its deliversTo):
//   AGW HGW VGW SGW CGW GGW ZGW WGW MGW KGW (the targets of tools/import-rules/bol-nl.mjs).
// Home Gear World takes the Netherlands only for now: a Belgium view there would be its 11th page group, and the views of
// the older sites stay at 10 groups (tests/worker/linkwise-l199.test.mjs) until chat 3's new view filter (branch
// claude/view-filter) takes the limit away. Then HGW gets bolDelivery() like the others.
export const BOL_RETAILER = 'bol.com';
export const BOL_COUNTRIES = Object.freeze(['NL', 'BE']);
export const BOL_LANGUAGE = 'nl';
// The sites (codes) that list bol.com, and the bol.com countries each one shows.
export const BOL_SITES = Object.freeze({ agw: BOL_COUNTRIES, hgw: Object.freeze(['NL']), vgw: BOL_COUNTRIES, sgw: BOL_COUNTRIES, cgw: BOL_COUNTRIES,
  ggw: BOL_COUNTRIES, zgw: BOL_COUNTRIES, wgw: BOL_COUNTRIES, mgw: BOL_COUNTRIES, kgw: BOL_COUNTRIES });

// The other three sites (TGW, BGW, PGW) list no bol.com, but they carry the same NL/BE-only line (review of 6954a135):
// a stray bol.com row there could never reach the UK view, Google or the sitemaps either. Not targets of the import.
export const BOL_GUARD_SITES = Object.freeze(['tgw', 'bgw', 'pgw']);

// { retailers, languages } for a site's deliversTo (spread into both objects).
export function bolDelivery(countries = BOL_COUNTRIES) {
  return { retailers: { [BOL_RETAILER]: [...countries] }, languages: { [BOL_RETAILER]: BOL_LANGUAGE } };
}
