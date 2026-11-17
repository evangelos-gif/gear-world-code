// The language of each country on the Gear World sites (lessons L162, L175, L184). One list for the 13 sites
// (src/engine.js, data-country-lang) and for the Group's country pages (src/group.js, the ?lang= of their links), so the
// two never differ. Kept in this small file so the Group Worker does not need the site engine.

// Lessons L162 (Manager, 15 Nov 2026: Poland is open and the first country outside the UK to be promoted) and L175
// (owner, 17 Nov 2026, after Linkwise saw the Greek pages open in English: "every country opens in its own language"):
// a country whose language the site has gets it without a choice of their own.
export const COUNTRY_LANGUAGES = {
  PL: 'pl-PL',
  GR: 'el-GR', CY: 'el-GR',
  DE: 'de-DE', AT: 'de-DE', LI: 'de-DE',
  FR: 'fr-FR', MC: 'fr-FR', RE: 'fr-FR', GP: 'fr-FR', MQ: 'fr-FR', GF: 'fr-FR', YT: 'fr-FR', MF: 'fr-FR', BL: 'fr-FR',
  PM: 'fr-FR', NC: 'fr-FR', PF: 'fr-FR', WF: 'fr-FR',
  IT: 'it-IT', SM: 'it-IT', VA: 'it-IT',
  ES: 'es-ES', MX: 'es-ES', AR: 'es-ES', CO: 'es-ES', CL: 'es-ES', PE: 'es-ES', VE: 'es-ES', EC: 'es-ES', GT: 'es-ES',
  CU: 'es-ES', BO: 'es-ES', DO: 'es-ES', HN: 'es-ES', PY: 'es-ES', SV: 'es-ES', NI: 'es-ES', CR: 'es-ES', PA: 'es-ES',
  UY: 'es-ES',
  PT: 'pt-PT', BR: 'pt-PT', AO: 'pt-PT', MZ: 'pt-PT',
  NL: 'nl-NL', SR: 'nl-NL', AW: 'nl-NL', CW: 'nl-NL', SX: 'nl-NL', BQ: 'nl-NL',
  AL: 'sq-AL', XK: 'sq-AL',
  RO: 'ro-RO', MD: 'ro-RO',
  RU: 'ru-RU', BY: 'ru-RU'
};
// Countries with several languages of the sites: the first of the browser's languages that is one of them.
// Canada: English unless the browser asks French first.
export const MULTI_LANGUAGE_COUNTRIES = { BE: ['nl-NL', 'fr-FR', 'de-DE'], CH: ['de-DE', 'fr-FR', 'it-IT'], LU: ['fr-FR', 'de-DE'], CA: ['fr-FR'] };

// Lessons L184 (owner, 17 Nov 2026: the Group's United States page opened Women's Gear World in Polish, because the
// phone kept Polish from an earlier ?lang=pl-PL link): a Group country page opens each site in that country's language,
// ?lang=<code>, which the site keeps like a choice in its menu (L162). A country without a language of the sites (the
// United States, the UK, Ireland, Sweden, Japan…) gets English (en-GB). Belgium, Switzerland, Luxembourg and Canada have
// several, so their links name none and the site decides as before (the visitor's choice, then the browser, L175).
export const BASE_LANGUAGE = 'en-GB';
export function linkLanguage(country) {
  const cc = String(country || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc) || MULTI_LANGUAGE_COUNTRIES[cc]) return '';
  return COUNTRY_LANGUAGES[cc] || BASE_LANGUAGE;
}
