// Where a retailer delivers (lessons L62). The Gear World sites are read all over the world, so every product
// card and product page says where the retailer delivers: a visitor in Germany sees at once that a UK shop
// delivers to the United Kingdom, and that a German shop delivers to Germany and Austria.
//
// The countries come from the site config, from each retailer's own delivery page, never guessed:
//   deliversTo: { default: ['GB'], retailers: { Reidl: ['DE', 'AT'] } }
// default: every retailer that is not named. retailers: the retailer name as the site shows it (after
// database.retailerNames). Codes are ISO 3166 country codes, plus 'EU' (the European Union, for a shop that delivers to
// nearly all of it) and 'WORLD' (worldwide).
// A site without deliversTo shows nothing (and keeps its old retailer flag, site.retailerCountries).

export const WORLDWIDE = 'WORLD';
// The European Union, the countries the code 'EU' stands for (src/lib/visibility.js uses the same list).
export const EU_COUNTRIES = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT',
  'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];

// English names, written by the server. The site script shows them in the visitor's language with the
// browser's own country names (Intl.DisplayNames), so a dictionary entry per country is not needed.
// A code that is not here is not shown (a typo must not print a wrong country); the unit tests check the configs.
export const COUNTRY_NAMES = {
  GB: 'United Kingdom', IE: 'Ireland', DE: 'Germany', AT: 'Austria', CH: 'Switzerland', NL: 'Netherlands',
  BE: 'Belgium', LU: 'Luxembourg', FR: 'France', IT: 'Italy', ES: 'Spain', PT: 'Portugal', GR: 'Greece',
  CY: 'Cyprus', MT: 'Malta', PL: 'Poland', CZ: 'Czechia', SK: 'Slovakia', HU: 'Hungary', RO: 'Romania',
  BG: 'Bulgaria', HR: 'Croatia', SI: 'Slovenia', AL: 'Albania', DK: 'Denmark', SE: 'Sweden', NO: 'Norway',
  FI: 'Finland', IS: 'Iceland', LI: 'Liechtenstein', EE: 'Estonia', LV: 'Latvia', LT: 'Lithuania', US: 'United States',
  CA: 'Canada', MX: 'Mexico', AU: 'Australia', NZ: 'New Zealand', JP: 'Japan', EU: 'European Union'
};

// Countries with a flag file, public/assets/flags/<code>.svg (TGW keeps them; tools/theme-site.mjs copies them).
// The flag only helps the eye: the country name is always written next to it.
export const FLAGS = ['GB', 'DE', 'AT', 'NL', 'US', 'EU'];

const own = (obj, key) => Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);

// The countries a retailer delivers to, as a clean list: ['GB'], ['DE', 'AT'], ['WORLD'], or [] (nothing shown).
export function deliveryCountries(site, retailer) {
  const cfg = site && site.deliversTo;
  if (!cfg) return [];
  const name = String(retailer || '');
  const list = own(cfg.retailers, name) ? cfg.retailers[name] : cfg.default;
  if (!Array.isArray(list)) return [];
  const codes = [...new Set(list.map(c => String(c || '').trim().toUpperCase()))];
  if (codes.includes(WORLDWIDE)) return [WORLDWIDE];
  return codes.filter(c => own(COUNTRY_NAMES, c));
}

// Problems in a site's deliversTo, for the unit tests: unknown or small-letter codes, a country listed twice,
// empty lists, WORLD mixed with countries.
export function deliveryConfigProblems(site) {
  const cfg = site && site.deliversTo;
  if (!cfg) return [];
  const problems = [];
  const lists = [['default', cfg.default], ...Object.entries(cfg.retailers || {})];
  for (const [name, list] of lists) {
    if (!Array.isArray(list) || !list.length) { problems.push(`${name}: no countries`); continue; }
    for (const c of list) {
      if (c === WORLDWIDE || own(COUNTRY_NAMES, c)) continue;
      const big = String(c || '').toUpperCase();
      problems.push(own(COUNTRY_NAMES, big) ? `${name}: write "${c}" in capitals ("${big}")` : `${name}: unknown country code "${c}"`);
    }
    if (new Set(list).size !== list.length) problems.push(`${name}: a country is listed twice`);
    if (list.includes(WORLDWIDE) && list.length > 1) problems.push(`${name}: WORLD together with countries`);
  }
  for (const [name, code] of Object.entries(cfg.languages || {})) {
    if (!own(FEED_LANGUAGES, code)) { problems.push(`${name}: unknown feed language "${code}"`); continue; }
    if (!own(cfg.retailers, name)) problems.push(`${name}: a feed language needs the retailer's own countries in deliversTo.retailers`);
    else if (!shownCountries(site, name).length) problems.push(`${name}: none of its countries speaks "${code}", so it is shown nowhere`);
  }
  return problems;
}

// Feeds written in another language than English (owner, 15 Nov 2026, lessons L164: "the shops whose feed is in
// French, Dutch or German are seen only in the countries of their language"). A retailer named in deliversTo.languages
//   deliversTo: { default: ['GB'], retailers: { Reidl: ['DE', 'AT'] }, languages: { Reidl: 'de' } }
// is shown only to visitors from a country it delivers to AND where that language is spoken (src/lib/visibility.js):
// never in the UK view, never in the all view of the other countries, never to Google's crawlers (the UK view). The
// card still says where the retailer delivers (deliveryCountries), which is the truth for the visitor who sees it.
// The countries are those where the language is an official language of the whole country or of a large part of it.
export const FEED_LANGUAGES = {
  de: ['DE', 'AT', 'CH', 'LI', 'LU'],
  fr: ['FR', 'BE', 'LU', 'CH'],
  nl: ['NL', 'BE'],
  es: ['ES', 'MX'],
  it: ['IT', 'CH'],
  pt: ['PT'],
  pl: ['PL'],
  el: ['GR', 'CY'],
  cs: ['CZ'],
  sk: ['SK'],
  hu: ['HU'],
  ro: ['RO'],
  bg: ['BG'],
  hr: ['HR'],
  sl: ['SI'],
  sq: ['AL'],
  da: ['DK'],
  sv: ['SE', 'FI'],
  fi: ['FI'],
  no: ['NO'],
  is: ['IS'],
  et: ['EE'],
  lv: ['LV'],
  lt: ['LT'],
  ja: ['JP']
};

// The feed language of a retailer ('de', 'fr', ...) or '' (English, or not named).
export function feedLanguage(site, retailer) {
  const langs = site && site.deliversTo && site.deliversTo.languages;
  const name = String(retailer || '');
  const code = own(langs, name) ? String(langs[name] || '').trim().toLowerCase() : '';
  return own(FEED_LANGUAGES, code) ? code : '';
}

// The countries whose visitors see a retailer: where it delivers, and, for a feed in another language, only where that
// language is spoken. The Group counts each country from these (src/db.js stats), so its numbers match what a visitor
// from there sees. A feed language that is not in FEED_LANGUAGES shows the retailer nowhere (deliveryConfigProblems).
export function shownCountries(site, retailer) {
  const list = deliveryCountries(site, retailer);
  const langs = site && site.deliversTo && site.deliversTo.languages;
  if (!own(langs, String(retailer || ''))) return list;
  const code = feedLanguage(site, retailer);
  if (!code) return [];
  return FEED_LANGUAGES[code].filter(cc => list.includes(WORLDWIDE) || list.includes(cc) || (list.includes('EU') && EU_COUNTRIES.includes(cc)));
}

