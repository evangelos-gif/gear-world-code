// What the app tells the Hub and the sites about itself (version 1.0.2), the delivery country the person chose,
// and what the app never shows. No React or native code here, so it can be tested with plain Node.

/** Mega Stores opens in the phone's own browser, never inside the app (owner's decision «Α», 25/11/2026). */
export const MEGA_STORES_URL = 'https://megastoresgearworld.com/';

/** The countries the app is published in (Google Play and App Store, 23/11/2026). */
export const DELIVERY_COUNTRIES = ['GB', 'GR', 'CY', 'PL', 'US', 'DE'] as const;
export type Country = (typeof DELIVERY_COUNTRIES)[number];

/** Each country in its own language, the way the language list shows each language. */
export const COUNTRY_NAMES: Record<Country, string> = {
  GB: 'United Kingdom', GR: 'Ελλάδα', CY: 'Κύπρος', PL: 'Polska', US: 'United States', DE: 'Deutschland'
};

export function isCountry(v: unknown): v is Country {
  return typeof v === 'string' && (DELIVERY_COUNTRIES as readonly string[]).includes(v);
}

/**
 * Amazon is never shown or linked inside the app: the app is not declared at Amazon Associates, only
 * megastoresgearworld.com is (owner's decision «Α», 25/11/2026). Checked on the retailer and on every link.
 */
const AMAZON = /amazon|amzn\./i;

/**
 * The 5 big Linkwise retailers stay out of the app, never shown and never compared (lessons L226, 25/11/2026). The
 * other Linkwise retailers of the 13 sites may show in Greece and Cyprus (Linkwise approved the app, 25/11/2026).
 * Names are compared whole (after a " GR" ending), so "Public Desire" is not "Public".
 */
const NEVER_RETAILERS = new Set([
  'kotsovolos', 'κωτσόβολος', 'κωτσοβολος', 'public', 'sephora', 'e-shop', 'e-shop.gr', 'eshop',
  'ab', 'αβ', 'ab vassilopoulos', 'ab vasilopoulos', 'ab βασιλόπουλος', 'αβ βασιλόπουλος'
]);
const NEVER_HOSTS = /\/\/(?:www\.)?(?:kotsovolos|public|sephora|e-shop|ab)\.gr(?:[/:?#]|$)/i;

type State = { version: string; country: Country | ''; hidden: Set<string> };
const state: State = { version: '', country: '', hidden: new Set() };

export function setClientVersion(version: string): void {
  state.version = /^[0-9][0-9A-Za-z.+-]{0,30}$/.test(version) ? version : '';
}

/** '' means automatic: the Hub and the sites use the country the phone is in, as before 1.0.2. */
export function setDeliveryCountry(code: unknown): void {
  state.country = isCountry(code) ? code : '';
}

export function deliveryCountry(): Country | '' {
  return state.country;
}

/** Sent with every request, so the Hub and the sites can tell the app apart from a browser. */
export function clientHeaders(): Record<string, string> {
  return { 'X-GW-Client': `gear-world-app/${state.version || '0'}` };
}

const norm = (s: string) => s.trim().toLowerCase();
const baseName = (s: string) => norm(s).replace(/\s+gr$/, '');

export function setHiddenRetailers(names: string[]): void {
  state.hidden = new Set(names.map(norm).filter(Boolean));
}

/** false for Amazon, the 5 big Linkwise retailers and any retailer the Hub asks the app to hide (app-config.json). */
export function isShown(p: { retailer: string; productUrl?: string; outUrl?: string }): boolean {
  const urls = [p.productUrl ?? '', p.outUrl ?? ''];
  if (AMAZON.test(p.retailer) || urls.some(u => AMAZON.test(u))) return false;
  if (NEVER_RETAILERS.has(baseName(p.retailer)) || urls.some(u => NEVER_HOSTS.test(u))) return false;
  return !state.hidden.has(norm(p.retailer));
}

export type AppConfig = { hiddenRetailers: string[] };

/**
 * The Hub's file for the app (gearworldhub.com/app-config.json): what the app hides, without a new app version.
 * Anything that is not a list of short names is ignored; a missing or broken file hides nothing extra.
 */
export function parseAppConfig(data: unknown): AppConfig {
  const raw = (data as { hidden_retailers?: unknown } | null)?.hidden_retailers;
  const hiddenRetailers = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0 && x.length <= 80).slice(0, 500)
    : [];
  return { hiddenRetailers };
}
