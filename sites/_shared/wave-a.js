// Priority A of the sheet «Λείπουν 25-11» (chat 7, 25 Nov 2026, lessons L234): approved shops that are not on the 13
// sites yet and sell to Germany, Austria, the Netherlands, Belgium, Ireland, Poland, the US or the EU. chat 3 says which
// of them have a feed, the countries of each shop's own delivery page and the language of its feed; this file holds
// the delivery line of each one (deliversTo.retailers and deliversTo.languages, lessons L62, L165), and the site
// configs (sites/<code>/site.config.js) spread waveDelivery(code) into their deliversTo, next to bol.com and Linkwise.
//
// The order never changes (L165, L194): FIRST this line live with ALL UPDATES, THEN the import. A shop imported without
// its line falls under the site's default (the UK) and would be listed in the UK view, to Google and in the sitemaps.
//
// One entry per shop and site:
//   { site: 'hgw', retailer: 'Kochblume DE', countries: ['DE'], language: 'de', row: 62, source: 'chat 3, 26 Nov 2026' }
// - retailer: exactly the name the import writes (its rules file or sources.json), which the cards show. On the six
//   older sites (CGW GGW HGW KGW MGW WGW) only [A-Za-z0-9 .-] (tools/legacy-import.ps1).
// - countries: from the shop's own delivery page (chat 3), never guessed, never GB or WORLD (Priority A is outside the UK).
//   A shop may be shown in fewer countries than it delivers to, never in more: where a country would make a new page
//   group (at most 10 a site, L199, L202), it is left out, as Baobab Collection (France only) and bol.com on HGW (the
//   Netherlands only) are.
// - language: the feed's language when it is not English ('de', 'nl', 'fr', 'pl' ..., src/lib/delivery.js
//   FEED_LANGUAGES): the shop is then seen only in its countries that speak it. No language = English names, shown in the
//   all view of every country with "<shop> delivers to ...", except a shop of the US only (the US view, L165).
// - row: the row of «Λείπουν 25-11»; source: who gave the facts and when.
// No line for a shop that is not going to be imported (tests/worker/wave-a.test.mjs).

export const WAVE_A_SITES = Object.freeze(['agw', 'bgw', 'cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'pgw', 'sgw', 'tgw', 'vgw', 'wgw', 'zgw']);
// The older sites, whose import (tools/legacy-import.ps1) accepts only these letters in a shop's name.
export const LEGACY_SITES = Object.freeze(['cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'wgw']);
export const LEGACY_NAME = /^[A-Za-z0-9 .-]{2,40}$/;

export const WAVE_A = Object.freeze([
  // Filled from chat 3's list of the Priority A shops with a feed (plan, 26 Nov 2026).
].map(e => Object.freeze({ ...e, countries: Object.freeze([...e.countries]) })));

// { retailers, languages } of one site, spread into its deliversTo.
export function waveDelivery(code) {
  const retailers = {};
  const languages = {};
  for (const e of WAVE_A) {
    if (e.site !== code) continue;
    retailers[e.retailer] = [...e.countries];
    if (e.language) languages[e.retailer] = e.language;
  }
  return { retailers, languages };
}
