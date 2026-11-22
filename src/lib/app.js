// The Gear World app on Google Play (owner, 22 Nov 2026: "we got the app, put it on the page so people can download
// it", lessons L218). The official "Get it on Google Play" badge sits at the top of the home page, under the hero
// buttons, on every site on this engine. It shows only to visitors from a country where the app is published, never on
// an iPhone or an iPad (the App Store has not released it yet), and never in a cached copy of a page: the engine adds it
// to each answer (src/engine.js withAppBar), like the country bar.

// The app's page on Google Play. The utm_ tags show in Play Console which site brought the download.
export const APP_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.gearworldhub.app';

// Where the app is published on Google Play (production 1.0.1, 22 Nov 2026: United Kingdom, Greece, Cyprus). A visitor
// from anywhere else would land on "not available in your country". A new country of the app: add it here.
export const APP_COUNTRIES = ['GB', 'GR', 'CY'];

// The languages of Google's own badge files kept in assets/app/google-play-<code>.png (the official PNGs, unchanged).
// English is the default in the HTML. Albanian keeps English: Google's Albanian file still has the old Play logo, and
// the brand rules say never to use an out-of-date badge.
export const APP_BADGE_LANGS = ['el', 'de', 'it', 'es', 'fr', 'nl', 'pl', 'pt', 'ro', 'ru'];
export const APP_BADGE_FILES = ['en', ...APP_BADGE_LANGS];

// The texts (every dictionary has them; the badge itself carries Google's own words in each language).
export const APP_BAR_TEXT = 'Search every Gear World from your phone.';
export const APP_BADGE_LABEL = 'Get it on Google Play';

// iPhone, iPad and iPod in the user agent. An iPad that asks for desktop pages says "Macintosh": the site script hides
// the badge there (a Mac has no touch screen, an iPad has).
const APPLE_MOBILE = /\b(iPhone|iPad|iPod)\b/;

export function appBarWanted(country, userAgent) {
  const cc = String(country || '').toUpperCase();
  return APP_COUNTRIES.includes(cc) && !APPLE_MOBILE.test(String(userAgent || ''));
}

// The link of a site's badge: the app's page with the site code as utm_source.
export function appPlayUrl(code) {
  const source = `gearworld-${String(code || '').toLowerCase().replace(/[^a-z0-9-]/g, '')}`;
  return `${APP_PLAY_URL}&utm_source=${source}&utm_medium=site&utm_campaign=app_bar`;
}
