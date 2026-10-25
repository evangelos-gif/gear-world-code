// Where a retailer delivers (lessons L62). The Gear World sites are read all over the world, so every product
// card and product page says where the retailer delivers: a visitor in Germany sees at once that a UK shop
// delivers to the United Kingdom, and that a German shop delivers to Germany and Austria.
//
// The countries come from the site config, from each retailer's own delivery page, never guessed:
//   deliversTo: { default: ['GB'], retailers: { Reidl: ['DE', 'AT'] } }
// default: every retailer that is not named. retailers: the retailer name as the site shows it (after
// database.retailerNames). Codes are ISO 3166 country codes; 'WORLD' means worldwide.
// A site without deliversTo shows nothing (and keeps its old retailer flag, site.retailerCountries).

export const WORLDWIDE = 'WORLD';

// English names, written by the server. The site script shows them in the visitor's language with the
// browser's own country names (Intl.DisplayNames), so a dictionary entry per country is not needed.
// A code that is not here is not shown (a typo must not print a wrong country); the unit tests check the configs.
export const COUNTRY_NAMES = {
  GB: 'United Kingdom', IE: 'Ireland', DE: 'Germany', AT: 'Austria', CH: 'Switzerland', NL: 'Netherlands',
  BE: 'Belgium', LU: 'Luxembourg', FR: 'France', IT: 'Italy', ES: 'Spain', PT: 'Portugal', GR: 'Greece',
  CY: 'Cyprus', MT: 'Malta', PL: 'Poland', CZ: 'Czechia', SK: 'Slovakia', HU: 'Hungary', RO: 'Romania',
  BG: 'Bulgaria', HR: 'Croatia', SI: 'Slovenia', AL: 'Albania', DK: 'Denmark', SE: 'Sweden', NO: 'Norway',
  FI: 'Finland', IS: 'Iceland', EE: 'Estonia', LV: 'Latvia', LT: 'Lithuania', US: 'United States',
  CA: 'Canada', MX: 'Mexico', AU: 'Australia', NZ: 'New Zealand', JP: 'Japan'
};

// Countries with a flag file, public/assets/flags/<code>.svg (TGW keeps them; tools/theme-site.mjs copies them).
// The flag only helps the eye: the country name is always written next to it.
export const FLAGS = ['GB', 'DE', 'AT', 'NL', 'US'];

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
  return problems;
}
