// Gift-guide site that links to the big marketplaces and to the Gear World sites (Mega Stores Gear World, OGW).
// No database, no cookies, no forms, no scripts. Owner's decision, 17 Nov 2026: no price tracking, price history or
// price alerts here (Amazon Associates Operating Agreement 6(y)); no Amazon prices or photos (no Product Advertising
// API yet); Amazon links go straight to the marketplace with the Associates ID, never through a redirect of ours.
// Amazon links appear only when the Worker has AMAZON_LINKS=on (set by tools/ogw-site.ps1 after the owner's phrase
// that the site is in his Associates account); AMAZON_LINKS=preview (the test Worker) links without the ID.
//
// Languages (owner, 18 Nov 2026: "all the languages", lessons L24, L175, L195): the 12 languages of the 13 Gear World
// sites (English and the 11 dictionaries, the same codes and the same menu order). The sites translate in the browser
// with their script; this site has no script, so the Worker writes each page in the visitor's language from the same
// kind of dictionary (sites/ogw/i18n/<code>.json, keyed by the English text, read through site.dictionaries). The
// language: the visitor's choice (?lang=, kept in every link of the page, never on the device), else the language of
// the visitor's country (src/lib/country-language.js, as on the sites), else English. Google and every other crawler
// always get the English page, and every page's canonical address is the English one without ?lang= (the one exception:
// a country edition such as /gr/, in its own language for everyone, crawlers included, lessons L214). Never
// translated: store, product, brand and Gear World names, "Mega Stores Gear World" and codes (translate="no"). The
// Amazon statement stays in English word for word on every page where it is, with the translation after it.
import { html, raw, esc, toString } from './lib/html.js';
import { htmlResponse, textResponse, redirect } from './lib/http.js';
import { versionResponse } from './lib/version.js';
import { GEAR_WORLDS } from '../promos/network.js';
import { promosFor } from '../promos/promos.js';
import { activePromos } from './lib/promos.js';
import { COUNTRY_LANGUAGES, MULTI_LANGUAGE_COUNTRIES } from './lib/country-language.js';
import { APP_BAR_TEXT, APP_BADGE_LABEL, appBarWanted, appPlayUrl, appBadgeFile } from './lib/app.js';

export const AMAZON_STATEMENT = 'As an Amazon Associate I earn from qualifying purchases.';
const AMAZON_TRADEMARK = 'Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.';
// The legal texts last changed on this day (UK and EU GDPR wording as approved for the Gear World sites on 17 Nov 2026;
// 19 Nov 2026: how the page language is chosen, L195; 24 Nov 2026: the Linkwise links of the direct stores, L226).
const LEGAL_UPDATED = '2026-11-24';

const asset = (site, p) => `/assets/${p}?v=${encodeURIComponent(site.assetVersion)}`;

// ---------------- Languages (lessons L24, L175, L195) ----------------
export const BASE_LANG = 'en-GB';
// The languages of Gear World Hub (no Polish): the Hub links carry ?lang= only for these.
export const HUB_LANGS = ['en-GB', 'el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU'];
// The same rules as src/engine.js (tests/worker/ogw.test.mjs checks they stay the same): crawlers read English; the
// network's own checks (GearWorldQA-bot, L158) can still ask for a language or a country.
export const QA_BOT = /^GearWorldQA-bot\//;
export const QA_COUNTRY_HEADER = 'X-GW-QA-Country';
export const OTHER_CRAWLER = /(?<!cu)bot\b|bot\/|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly/i; // not Cubot phones
// Google's crawlers count as UK visitors (src/engine.js GOOGLE_CRAWLER, the same text): the English page, as on the 13 sites.
// Some of them (Google-InspectionTool, GoogleOther, Mediapartners-Google) have no "bot" in their name (review 19/11/2026).
export const GOOGLE_CRAWLER = /\b(Googlebot|AdsBot-Google(-Mobile)?|Google-InspectionTool|Storebot-Google|Mediapartners-Google|GoogleOther)\b/i;
export function readsEnglish(request) {
  const ua = request.headers.get('user-agent') || '';
  return !QA_BOT.test(ua) && OTHER_CRAWLER.test(ua);
}
// Every key a dictionary lacks, as "<lang>\t<key>" (the tests read it; a page shows the English text meanwhile).
export const I18N_MISSING = new Set();

const languageList = site => (Array.isArray(site.languages) && site.languages.length ? site.languages : [{ code: BASE_LANG, label: 'English' }]);

// ?lang= as the sites take it (el-GR), and also the short form (el, EL, el-gr).
export function languageCode(site, asked) {
  const a = String(asked || '').trim().toLowerCase();
  if (!a || a.length > 12) return '';
  const list = languageList(site);
  const exact = list.find(l => l.code.toLowerCase() === a);
  if (exact) return exact.code;
  if (!/^[a-z]{2}$/.test(a)) return '';
  const base = list.find(l => l.code.toLowerCase().split('-')[0] === a);
  return base ? base.code : '';
}

// The browser's languages by preference (q weights; q=0 means "not this one"), as base codes (src/engine.js).
function browserLanguages(header) {
  return String(header || '').split(',').map((part, i) => {
    const [tag, ...params] = part.split(';').map(x => x.trim());
    const qp = params.find(p => /^q=/i.test(p));
    const q = qp ? Number(qp.slice(2)) : 1;
    return { base: tag.toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 0, i };
  }).filter(l => l.base && l.base !== '*' && l.q > 0).sort((a, b) => b.q - a.q || a.i - b.i).map(l => l.base);
}

// The language of a country, as on the 13 sites (L175): one language per country; Belgium, Switzerland, Luxembourg and
// Canada take the first of the browser's languages that is one of theirs (English first keeps English).
export function countryLanguage(site, country, acceptLanguage = '') {
  const cc = String(country || '').toUpperCase();
  const has = code => languageList(site).some(l => l.code === code);
  const several = MULTI_LANGUAGE_COUNTRIES[cc];
  if (several) {
    for (const base of browserLanguages(acceptLanguage)) {
      if (base === 'en') return '';
      const code = several.find(c => c.split('-')[0] === base);
      if (code) return has(code) ? code : '';
    }
    return '';
  }
  const code = COUNTRY_LANGUAGES[cc] || '';
  return code && has(code) ? code : '';
}

function requestCountry(request) {
  const ua = request.headers.get('user-agent') || '';
  if (GOOGLE_CRAWLER.test(ua)) return 'GB';
  const qa = QA_BOT.test(ua) ? String(request.headers.get(QA_COUNTRY_HEADER) || '').trim().toUpperCase() : '';
  if (/^[A-Z]{2}$/.test(qa)) return qa;
  const cf = request.cf && typeof request.cf.country === 'string' ? request.cf.country.toUpperCase() : '';
  return /^[A-Z]{2}$/.test(cf) ? cf : '';
}

// ---------------- Where the visitor is (owner, 21 Nov 2026, lessons L210) ----------------
// "They opened Mega Stores from Greece and it shows them all the stores it has for England, and the offers: this is
// wrong" / "can't they be hidden for Greece and the other countries they don't deliver to?". Each store, its Black
// Friday entry, its codes and Amazon UK show only to visitors from a country in their deliversTo (none given: the UK
// only). The country is the one Cloudflare reports (the QA bot may name one; Google and every other crawler read the UK
// page, as they read English, L195). No country at all (a local test) is the UK page, as before. Every other country,
// including Cloudflare's XX (unknown) and T1 (Tor), is "not the UK".
export const VIEW_BASE = 'GB';
// Every country at once (only to count what other countries see; never a visitor's view).
const ANY_COUNTRY = '*';
export function viewCountry(request) {
  if (readsEnglish(request)) return VIEW_BASE;
  const cc = requestCountry(request);
  if (cc) return cc;
  // Cloudflare gave no country, or a code that is not two letters (T1: Tor): unknown, not the UK. Only a request
  // with no Cloudflare data at all (a local test) is the UK page.
  return request.cf && typeof request.cf === 'object' ? 'XX' : VIEW_BASE;
}

// Where an entry of the config or of black-friday.json delivers: its deliversTo, or the UK when it has none.
const deliveryOf = entry => {
  const to = entry && Array.isArray(entry.deliversTo) ? entry.deliversTo.map(c => String(c).toUpperCase()).filter(Boolean) : [];
  return to.length ? to : [VIEW_BASE];
};
// The country a store's products are read for: its first real country (never WORLD), else the UK.
export function productCountry(store) {
  return deliveryOf(store).filter(c => c !== 'WORLD')[0] || VIEW_BASE;
}
export function deliversHere(entry, country = VIEW_BASE) {
  if (country === ANY_COUNTRY) return true;
  const to = deliveryOf(entry);
  return to.includes('WORLD') || to.includes(String(country || VIEW_BASE).toUpperCase());
}

// Amazon UK (amazon.co.uk with the UK Associates ID) only for the countries of site.amazon.deliversTo (the UK): for
// every other country the pages are written as with AMAZON_LINKS=off (no Amazon button, page or statement).
export function amazonHere(site, country = VIEW_BASE) {
  return deliversHere(site.amazon || {}, country);
}
export function viewMode(site, mode, country = VIEW_BASE) {
  return amazonHere(site, country) ? mode : 'off';
}

// ---------------- Country editions (owner, 21 Nov 2026, lessons L214) ----------------
// Google reads the UK page (L195), so it never saw the stores we list for Greece. megastoresgearworld.com/gr/ is the
// page for Greece: its own address, in Greek, the Greek stores, for every visitor and for Google too, with hreflang
// el-GR next to the UK page's en-GB (Google's way for one site in several countries: a folder per country). Only the
// home page and the store pages have an edition address; the guides and the legal pages stay where they are.
export const EDITIONS = [{ prefix: '/gr', country: 'GR', lang: 'el-GR' }];
export function editionFor(pathname) {
  return EDITIONS.find(e => pathname === e.prefix || String(pathname || '').startsWith(`${e.prefix}/`)) || null;
}
// The stores an edition has a page for: every store listed for its country (never Amazon UK, never a store of a network
// in site.hiddenNetworks, L215), and the direct stores of its country when the Worker has our Linkwise code (L226).
export function editionStores(site, edition, lw = '') {
  return (site.stores || []).filter(s => (isDirectStore(s)
    ? directShown(site, s, edition.country, lw)
    : !s.amazon && Array.isArray(s.sites) && s.sites.length && deliversHere(s, edition.country) && storeListed(site, s)));
}
// The country's own name in the page's language ("Ελλάδα"), from the browser's and the Worker's Intl.
export function regionName(lang, cc) {
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(cc) || cc; } catch { return cc; }
}

// Which language this answer is in: { lang, chosen, byCountry }. chosen = the visitor asked for it (?lang=), so every
// link of the page keeps it; byCountry = from the country or the browser, so the answer is this visitor's only.
export function pickLanguage(site, request, url) {
  // A crawler asking for ?lang= gets English too; that answer is never kept for the visitors of that address.
  if (readsEnglish(request)) return { lang: BASE_LANG, chosen: false, byCountry: Boolean(languageCode(site, url.searchParams.get('lang'))) };
  const asked = languageCode(site, url.searchParams.get('lang'));
  if (asked) return { lang: asked, chosen: true, byCountry: false };
  const own = countryLanguage(site, requestCountry(request), request.headers.get('accept-language'));
  if (own && own !== BASE_LANG) return { lang: own, chosen: false, byCountry: true };
  return { lang: BASE_LANG, chosen: false, byCountry: false };
}

// A name that is never translated (a store, a product, a Gear World site, a code): its own translate="no" span, so a
// browser translation leaves it alone too (lessons L24, L102, L103).
const keep = s => html`<span translate="no">${s}</span>`;
// The name of the stores part, as the site's name in every language (owner, 21 Nov 2026, L208: «Stores» → «Mega Stores»).
const storesLabel = c => keep(c.site.storesLabel || c.site.name);
// Does the visitor's country see any store of this site (L210)? Without one, the menu has no stores link and the home
// page is titled as gift guides only.
const storesHere = c => shownStores(c.site, c.mode, c.country, c.lw).length > 0;

// The page context: the language, its dictionary, and the helpers that write every visible text through it.
//   t(key, ...args)  HTML: the translation with {0}, {1}... filled in (an arg can be HTML, such as keep(name) or a link)
//   tx(key, ...args) plain text (titles, descriptions, aria-label), the args as text
//   href(path)       an address of this site that keeps the chosen language (?lang=)
//   gw(url)          an address of a Gear World site, with ?lang= when the visitor chose a language (L174)
//   hub(path)        an address of Gear World Hub, with ?lang= only for a chosen language the Hub has
//   country          the visitor's country (viewCountry): which stores, codes and Black Friday entries the page shows
//   lw               our Linkwise affiliate code (the Worker secret LINKWISE_CODE, L226), '' without it: the direct
//                    stores and their links exist only with it
export function makeContext(site, lang = BASE_LANG, chosen = false, mode = 'off', path = '/', country = VIEW_BASE, edition = null, lw = '') {
  const code = languageList(site).some(l => l.code === lang) ? lang : BASE_LANG;
  const cc = /^[A-Z]{2}$/.test(String(country || '').toUpperCase()) ? String(country).toUpperCase() : VIEW_BASE;
  const isChosen = Boolean(chosen);
  const dict = code === BASE_LANG ? null : ((site.dictionaries || {})[code] || {});
  const look = key => {
    if (!dict) return key;
    if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    I18N_MISSING.add(`${code}\t${key}`);
    return key;
  };
  const t = (key, ...args) => raw(String(look(key)).split(/(\{\d+\})/).map(part => {
    const m = /^\{(\d+)\}$/.exec(part);
    if (!m || Number(m[1]) >= args.length) return esc(part);
    return toString(args[Number(m[1])]);
  }).join(''));
  const tx = (key, ...args) => String(look(key)).replace(/\{(\d+)\}/g, (all, i) => (Number(i) < args.length ? String(args[Number(i)]) : all));
  // at(path): the address of a page in this page's edition (L214): /gr/ and /gr/stores/... for the home page, its parts
  // and the store pages; every other page (guides, legal) has one address for every country.
  const at = p => (edition && (p === '/' || p.startsWith('/#') || p.startsWith('/stores/')) ? `${edition.prefix}${p}` : p);
  const href = q => {
    const p = at(q);
    if (!isChosen) return p;
    const i = p.indexOf('#');
    const base = i < 0 ? p : p.slice(0, i);
    const hash = i < 0 ? '' : p.slice(i);
    return `${base}${base.includes('?') ? '&' : '?'}lang=${encodeURIComponent(code)}${hash}`;
  };
  const gw = url => {
    if (!isChosen || !url) return url;
    const u = new URL(url);
    u.searchParams.set('lang', code);
    return u.toString();
  };
  const hubBase = (site.hub && site.hub.url) || 'https://gearworldhub.com/';
  const hub = (p = '/') => {
    const u = new URL(p, hubBase);
    if (isChosen && HUB_LANGS.includes(code)) u.searchParams.set('lang', code);
    return u.toString();
  };
  const fmt = (day, opts) => new Intl.DateTimeFormat(code, { ...opts, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  return {
    // Amazon UK only where it delivers (L210): any other country gets the pages of AMAZON_LINKS=off.
    site, lang: code, chosen: isChosen, mode: viewMode(site, mode, cc), country: cc, path: at(path), t, tx, href, gw, hub, at,
    edition: edition || null, region: edition ? regionName(code, edition.country) : '', lw: LINKWISE_CODE.test(String(lw || '')) ? String(lw) : '',
    shortDate: day => fmt(day, { day: 'numeric', month: 'short' }),
    dayDate: day => fmt(day, { weekday: 'short', day: 'numeric', month: 'short' }),
    validDate: day => fmt(day, { day: 'numeric', month: 'short', year: 'numeric' }),
    longDate: day => fmt(day, { day: 'numeric', month: 'long', year: 'numeric' })
  };
}

// The Amazon statement, word for word in English on every page where Amazon links are, then its translation.
function amazonStatement(c) {
  const en = html`<span lang="en-GB" translate="no">${AMAZON_STATEMENT}</span>`;
  return c.lang === BASE_LANG ? en : html`${en} <span class="amz-tr">(${c.t(AMAZON_STATEMENT)})</span>`;
}

// 'on' (the live site, after the owner's phrase), 'preview' (the test Worker: links without the Associates ID) or
// 'off' (no Amazon links at all).
export function amazonMode(env) {
  const v = env && typeof env.AMAZON_LINKS === 'string' ? env.AMAZON_LINKS.trim().toLowerCase() : '';
  return v === 'on' || v === 'preview' ? v : 'off';
}

// Are there marketplace buttons on the pages? On the live site with AMAZON_LINKS=on, and on the test Worker (links
// without the Associates ID). With "off" every text speaks only of the Gear World sites: a page must never say it
// links to marketplaces when it does not (claims that are not true, lessons L107).
const withMarkets = mode => mode === 'on' || mode === 'preview';

// A search on amazon.co.uk for one idea. Only the host and the Associates ID of the site config, and the idea's search
// words, so the link always goes to the marketplace named on the button.
export function amazonUrl(site, q, mode) {
  if (mode !== 'on' && mode !== 'preview') return '';
  const a = site.amazon || {};
  if (!a.host || (mode === 'on' && !/^[a-z0-9-]+-21$/.test(String(a.tag || '')))) return '';
  const u = new URL(`https://${a.host}/s`);
  u.searchParams.set('k', String(q));
  if (mode === 'on') u.searchParams.set('tag', a.tag);
  return u.toString();
}

// One of Amazon's own pages (its Black Friday page, L195) as an Amazon Special Link: the Associates ID only with
// AMAZON_LINKS=on, no ID on the test Worker, nothing with "off".
export function amazonPageUrl(site, page, mode) {
  if (mode !== 'on' && mode !== 'preview') return '';
  const a = site.amazon || {};
  if (!a.host || !/^\/[a-z0-9-]+$/.test(String(page || '')) || (mode === 'on' && !/^[a-z0-9-]+-21$/.test(String(a.tag || '')))) return '';
  const u = new URL(`https://${a.host}${page}`);
  if (mode === 'on') u.searchParams.set('tag', a.tag);
  return u.toString();
}

// The Gear World site of an idea (its code in promos/network.js) and its category page for the same kind of product.
// A category page always lists products; a site search for several words often finds none (checked 17 Nov 2026).
export function gearWorldFor(code) {
  return GEAR_WORLDS.find(w => w.code === String(code || '').toUpperCase()) || null;
}

export function gearWorldUrl(code, cat) {
  const w = gearWorldFor(code);
  if (!w || !/^[a-z0-9-]+$/.test(String(cat || ''))) return '';
  return new URL(`/category/${cat}/`, w.url).toString();
}

// The UK date (YYYY-MM-DD) of a moment: the countdown changes at midnight in London.
export function ukDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// The line above the guides: days to Black Friday, the Black Friday weekend, then days to Christmas. A date, never a
// promise of discounts (lessons L107). Empty after Christmas Day. In the page's language (dates by Intl).
export function countdownText(site, c, now = new Date()) {
  const today = ukDay(now);
  const bf = site.blackFriday;
  const xmas = site.christmas;
  if (bf) {
    const d = daysBetween(today, bf);
    if (d > 1) return c.t('Black Friday: {0} · {1} days to go', c.shortDate(bf), d);
    if (d === 1) return c.t('Black Friday: {0} · 1 day to go', c.shortDate(bf));
    if (d <= 0 && d >= -3) return c.t('Black Friday and Cyber Monday: {0} to {1}', c.shortDate(bf), c.shortDate(addDays(bf, 3)));
  }
  if (xmas) {
    const d = daysBetween(today, xmas);
    if (d > 1) return c.t('Christmas: {0} days to go', d);
    if (d === 1) return c.t('Christmas: 1 day to go');
    if (d === 0) return c.t('Happy Christmas');
  }
  return '';
}

// The English line (the tests and the tools read it).
export function countdown(site, now = new Date()) {
  return toString(countdownText(site, makeContext(site), now)).replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

const FOOTER_LINKS = [
  ['/about/', 'About'],
  ['/how-we-make-money/', 'How we make money'],
  ['/privacy/', 'Privacy policy'],
  ['/cookies/', 'Cookies'],
  ['/terms/', 'Terms of use']
];

// Who runs the site (L101): the name never translated, the country in the page's language ("Evangelos Kalogerakis,
// Ηνωμένο Βασίλειο"), as on the 13 sites (review 19/11/2026).
function operator(site, tr) {
  const s = String(site.operatorName || '');
  const i = s.lastIndexOf(', ');
  return i > 0 ? html`${keep(s.slice(0, i))}, ${tr(s.slice(i + 2))}` : keep(s);
}

const mail = site => html`<a href="mailto:${site.contactEmail}" translate="no">${site.contactEmail}</a>`;

// The note at the top of every guide (and the home page): what the links are, before the reader meets one.
function disclosure(c) {
  const { t, mode } = c;
  if (!withMarkets(mode)) {
    return html`<div class="note" role="note">
  <p>${t('The buttons on this page open categories of the Gear World sites. Those sites link to retailers and may earn a commission, at no extra cost to you.')}</p>
  <p>${t('Prices, stock and delivery are on the page you open. We do not sell anything and we do not track prices.')}</p>
</div>`;
  }
  return html`<div class="note" role="note">
  <p><strong>#ad</strong> · ${t('The buttons on this page are links to marketplaces and to the Gear World sites. If you choose something after following one, we may earn a commission, at no extra cost to you.')} ${mode === 'on' ? amazonStatement(c) : ''}</p>
  <p>${t('Prices, stock and delivery are on the marketplace\'s own page. We do not sell anything and we do not track prices.')}</p>
</div>`;
}

// A globe for the language menu (inline SVG: this site has no icon file).
const GLOBE = raw('<svg class="pref-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.9 8ZM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96ZM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26Zm.84 2h2.95c.32 1.25.78 2.45 1.38 3.56A8.03 8.03 0 0 1 5.1 16Zm2.95-8H5.1a8.03 8.03 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.05 8ZM12 19.96A14.1 14.1 0 0 1 10.09 16h3.82A14.1 14.1 0 0 1 12 19.96ZM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4Zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56ZM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38Z"/></svg>');

// The language menu, like the sites' one (globe, the language's own name, the same order), as a list of links: this
// site has no script, so each language is a link to this page with ?lang= (rel="nofollow": crawlers read English).
function languageMenu(c) {
  const list = languageList(c.site);
  if (list.length < 2) return '';
  const current = list.find(l => l.code === c.lang) || list[0];
  const path = /^\/[A-Za-z0-9/._-]*$/.test(c.path) ? c.path : '/';
  return html`<div class="prefs"><div class="wrap prefs-row">
  <details class="lang-menu">
    <summary class="lang-current">${GLOBE}<span class="visually-hidden">${c.t('Language')}: </span><span translate="no" lang="${current.code}">${current.label}</span></summary>
    <ul class="lang-list" translate="no">${list.map(l => html`<li><a href="${path}?lang=${l.code}" hreflang="${l.code}" lang="${l.code}" rel="nofollow"${l.code === c.lang ? raw(' aria-current="true"') : ''}>${l.label}</a></li>`)}</ul>
  </details>
</div></div>`;
}

// The same header and footer on every page; the footer links to the legal pages (lessons L17) and says who runs the
// site (L101). The Amazon statement and trademark notice only where Amazon links are shown. The Hub link in the header
// strip and in the footer, like the 13 sites (owner, 18 Nov 2026, L195).
function shell(c, { title, description, path, body, robots = '' }) {
  const { site, t, tx, mode } = c;
  const own = c.at(path);
  // The home page in each edition, so Google shows the Greek one in Greece (L214); x-default is the UK page.
  const alternates = path === '/' && !robots
    ? html`<link rel="alternate" hreflang="${BASE_LANG}" href="https://${site.domain}/">
${EDITIONS.map(e => html`<link rel="alternate" hreflang="${e.lang}" href="https://${site.domain}${e.prefix}/">
`)}<link rel="alternate" hreflang="x-default" href="https://${site.domain}/">
` : '';
  const year = new Date().getUTCFullYear();
  const hubName = (site.hub && site.hub.name) || 'Gear World Hub';
  return toString(html`<!doctype html>
<html lang="${c.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://${site.domain}${own}">
${alternates}${robots ? html`<meta name="robots" content="${robots}">` : ''}
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://${site.domain}${own}">
<meta property="og:type" content="website">
<link rel="icon" href="${asset(site, 'favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${asset(site, 'ogw.css')}">
</head>
<body>
<a class="skip" href="#main">${t('Skip to content')}</a>
<header class="top">
${languageMenu(c)}
<div class="wrap top-row">
  <a class="brand" href="${c.href('/')}"><img src="${asset(site, 'logo.svg')}" alt="" width="40" height="40"><span translate="no">${site.name}</span></a>
  <nav class="top-nav" aria-label="${tx('Main')}">${storesHere(c) ? html`<a class="top-link" href="${c.href('/#stores')}">${storesLabel(c)}</a>` : ''}<a class="top-link" href="${c.href('/#guides')}">${t('Gift guides')}</a></nav>
</div>
<div class="hub-strip" data-gw-network><div class="wrap hub-row">
  <span class="hub-name" translate="no">${hubName}</span>
  <span class="hub-tagline">${t('One Hub. Every Gear World.')}</span>
  <a class="hub-link" href="${c.hub('/')}">${t('Explore the Hub')} <span aria-hidden="true">&rarr;</span></a>
</div></div>
</header>
<main id="main">${body}</main>
<footer class="foot"><div class="wrap">
  <nav aria-label="${tx('Legal')}"><ul class="foot-links">${FOOTER_LINKS.map(([href, label]) => html`<li><a href="${c.href(href)}">${t(label)}</a></li>`)}</ul></nav>
  <p class="foot-hub" data-gw-network><span>${t('Gear World network')}:</span> <a href="${c.hub('/')}"><span><span translate="no">${hubName}</span> · ${t('Explore the Hub')}</span></a></p>
  ${mode === 'on' ? html`<p>${amazonStatement(c)} ${t(AMAZON_TRADEMARK)}</p>` : ''}
  <p>${t('This site sets no cookies of its own and does no tracking. Prices and stock are on the page each button opens.')}</p>
  <p>&copy; ${year} ${keep(site.name)} · ${t('Run by {0}', operator(site, t))} · ${withMarkets(mode)
    ? t('We don\'t sell products: we link to marketplaces and to the Gear World sites, and may earn a commission.')
    : directStores(site, c.country, c.lw).length
      ? t('We don\'t sell products: we link to the Gear World sites, which link to retailers, and to a few stores through Linkwise, and may earn a commission.')
      : t('We don\'t sell products: we link to the Gear World sites, which link to retailers and may earn a commission.')}</p>
</div></footer>
</body>
</html>`);
}

function ideaButtons(c, idea) {
  const { site, t, mode } = c;
  const amazon = amazonUrl(site, idea.q, mode);
  const gw = gearWorldFor(idea.gw);
  const gwUrl = gearWorldUrl(idea.gw, idea.cat);
  return html`<p class="buttons">
    ${amazon ? html`<a class="btn btn-market" href="${amazon}" rel="sponsored nofollow noopener" target="_blank">${t('See prices on Amazon')}</a>` : ''}
    ${gwUrl ? html`<a class="btn btn-gw" href="${c.gw(gwUrl)}" rel="noopener" target="_blank"><span>${t('Browse on {0}', keep(gw.name))}</span></a>` : ''}
  </p>`;
}

// ---------------- Codes of the stores (owner, 18 Nov 2026, "Black Friday", lessons L103, L107, L188, L195) ----------------
// The codes and coupons (money off with no code to type) that the stores of this site publish through their affiliate
// programmes and that run today on their Gear World sites (promos/promos.js, activePromos: each disappears after its
// last UK day by itself). One card per store and code (a code on several sites once), in the store order, each linking
// to the store's /discount-codes/<slug>/ page on the first of the store's Gear World sites that lists it: never /out/
// or /go/, never a link to the retailer. A sale (no code, no money off) is not shown (L107, L114). The card says what
// the retailer says ("£50 off when you spend £500", "15% off when you spend £50"): never "deals", "sale", "save",
// "lowest price", "up to" or a discount of our own. Only the stores that deliver to the visitor's country (L210).
export function storeCodes(site, now = Date.now(), only = null, country = VIEW_BASE) {
  const out = [];
  for (const store of awinStores(site)) {
    if (only && store.slug !== only) continue;
    if (!deliversHere(store, country)) continue;
    const seen = new Set();
    for (const code of store.sites) {
      const w = gearWorldFor(code);
      if (!w) continue;
      for (const p of activePromos({ promos: promosFor(code) }, now)) {
        if (p.slug !== store.slug || (p.kind !== 'code' && p.kind !== 'coupon')) continue;
        // A code is for the country it is published for (its deliversTo; none: the UK, like every code today, L210).
        if (!deliversHere(p, country)) continue;
        const key = p.kind === 'code' ? `code:${String(p.code).toUpperCase()}` : `coupon:${Number(p.off)}:${Number(p.minSpend)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ store, promo: p, world: w, url: new URL(`/discount-codes/${store.slug}/`, w.url).toString() });
      }
    }
  }
  return out;
}

function money(amount, currency = 'GBP') {
  const n = Number(amount);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
}

// The retailer's own figure, as on the sites (src/pages/offers.js, L186): money off, or a code's own percentage.
function offerText(c, p) {
  const pct = Number(p.pct);
  const amount = p.kind === 'code' && pct > 0 ? `${pct}%` : money(p.off, p.currency);
  return Number(p.minSpend) > 0 ? c.t('{0} off when you spend {1}', amount, money(p.minSpend, p.currency)) : c.t('{0} off your order', amount);
}

function codeCard(c, item, withStore = true) {
  const { t } = c;
  const p = item.promo;
  return html`<li class="promo-card" data-end="${p.end}">
  ${withStore ? html`<p class="promo-store" translate="no">${item.store.name}</p>` : ''}
  <p class="promo-campaign">${t(p.campaign)}</p>
  ${p.kind === 'code' ? html`<p class="promo-code"><span class="promo-code-label">${t('Code')}</span> <strong translate="no">${p.code}</strong></p>` : ''}
  <p class="promo-offer">${offerText(c, p)}</p>
  <p class="promo-valid">${t('Valid until {0}', c.validDate(p.end))}</p>
  <a class="promo-link" href="${c.gw(item.url)}" rel="noopener" target="_blank"><span>${t('See the details on {0}', keep(item.world.name))}</span></a>
</li>`;
}

// ---------------- Early Black Friday (owner, 18 Nov 2026 23:30: "a countdown until Black Friday, and early Black
// Friday", lessons L188, L195) ----------------
// The retailers that have started their Black Friday and their codes and coupons come from the SAME file as the Hub's
// /black-friday/ page, sites/gwh/black-friday/black-friday.json (kept by the Gear World Manager from the offers tracker,
// only what the owner approved), read when the Worker is built (site.earlyBlackFriday). Each retailer shows from its
// "from" day to its "hide" day and each code until its "end" day (UK days), on the server, and every item carries
// data-end like the Hub's (/stores/stores.js). Links: only Gear World pages (the site search filtered by the retailer,
// like tools/gwh-stores.mjs siteLink; its /discount-codes/ page; its page on this site), never /out/, /go/ or a retailer.
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// The Gear World page with this retailer's products on a site, in the view of a country it delivers to (siteLink).
export function retailerSearchUrl(r, w) {
  const u = new URL(storeSearchUrl(r, w));
  const to = Array.isArray(r.deliversTo) ? r.deliversTo : ['GB'];
  if (!to.includes('GB') && to[0]) u.searchParams.set('for', String(to[0]).toLowerCase());
  return u.toString();
}

// Only the retailers that deliver to the visitor's country (their deliversTo in black-friday.json, L210).
export function earlyBlackFriday(site, now = Date.now(), country = VIEW_BASE) {
  const data = site.earlyBlackFriday || {};
  const today = ukDay(new Date(now));
  const ours = new Map(awinStores(site).filter(s => deliversHere(s, country)).map(s => [s.slug, s]));
  // Never an entry of a store that is hidden (L215), or of a direct store (L226: its pages have no Black Friday part,
  // and an entry would link its name to searches on the Gear World sites, where its products never are).
  const hidden = new Set((site.stores || []).filter(s => !storeListed(site, s) || isDirectStore(s)).map(s => s.slug));
  const codes = Array.isArray(data.codes) ? data.codes : [];
  return (Array.isArray(data.started) ? data.started : [])
    .filter(r => r && r.name && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug || '') && DAY_RE.test(r.from || '') && DAY_RE.test(r.hide || '')
      && (!r.to || DAY_RE.test(r.to)) && r.from <= today && today <= r.hide && Array.isArray(r.sites) && deliversHere(r, country) && !hidden.has(r.slug))
    .map(r => {
      const worlds = r.sites.map(gearWorldFor).filter(Boolean);
      // A code of the file is for its own deliversTo (none: the UK, like every code in pounds today, L210).
      const own = codes.filter(k => k && k.slug === r.slug && (k.kind === 'code' || k.kind === 'coupon') && DAY_RE.test(k.end || '') && today <= k.end && deliversHere(k, country)
        && gearWorldFor(k.site) && r.sites.includes(k.site) && k.title && (k.kind === 'coupon' ? !k.code : /^[A-Z0-9]{3,30}$/.test(k.code || '')))
        .map(k => ({ ...k, world: gearWorldFor(k.site), url: new URL(`/discount-codes/${r.slug}/`, gearWorldFor(k.site).url).toString() }));
      return { ...r, store: ours.get(r.slug) || null, codes: own, links: worlds.map(w => ({ world: w, url: retailerSearchUrl(r, w) })) };
    })
    .filter(r => r.links.length);
}

// The offer line of black-friday.json in the page's language: the retailer's own wording, as the Hub writes it.
function offerTitle(c, title) {
  const m1 = /^(£\d+(?:\.\d{2})?) off when you spend (£\d+(?:\.\d{2})?)$/.exec(title);
  if (m1) return c.t('{0} off when you spend {1}', m1[1], m1[2]);
  const m2 = /^(£\d+(?:\.\d{2})?) off when you spend (£\d+(?:\.\d{2})?), on selected products$/.exec(title);
  if (m2) return c.t('{0} off when you spend {1}, on selected products', m2[1], m2[2]);
  const m3 = /^For (.+) products, when you spend (£\d+(?:\.\d{2})?) or more on (.+)$/.exec(title);
  if (m3 && m3[1] === m3[3]) return c.t('For {0} products, when you spend {1} or more on {0}', keep(m3[1]), m3[2]);
  return c.t(title);
}

// The same card as a code of promos/promos.js, from black-friday.json.
function bfCodeCard(c, k) {
  const { t } = c;
  return html`<li class="promo-card" data-end="${k.end}">
  ${k.kind === 'code'
    ? html`<p class="promo-code"><span class="promo-code-label">${t('Code')}</span> <strong translate="no">${k.code}</strong></p>`
    : html`<p class="promo-code"><span class="promo-code-label">${t('Coupon: no code to type')}</span></p>`}
  <p class="promo-offer">${offerTitle(c, k.title)}</p>
  <p class="promo-valid">${t('Valid until {0}', c.validDate(k.end))}</p>
  <a class="promo-link" href="${c.gw(k.url)}" rel="noopener" target="_blank"><span>${t('See the details on {0}', keep(k.world.name))}</span></a>
</li>`;
}

const bfWhen = (c, r) => (r.to ? c.t('Black Friday from {0} · until {1}', c.shortDate(r.from), c.shortDate(r.to)) : c.t('Black Friday from {0}', c.shortDate(r.from)));

function startedItem(c, r) {
  const { site, t } = c;
  const links = r.links.map((l, i) => html`${i ? ', ' : ''}<a href="${c.gw(l.url)}" translate="no">${l.world.name}</a>`);
  return html`<li class="bf-store" data-end="${r.hide}">
  <h4 class="bf-store-name" translate="no">${r.name}</h4>
  <p class="bf-when">${bfWhen(c, r)}</p>
  <p class="bf-sites">${t('Products on {0}', html`${links}`)}</p>
  ${r.store ? html`<p class="bf-own"><a href="${c.href(`/stores/${r.store.slug}/`)}"><span>${t('{0} on {1}', keep(r.name), keep(site.name))}</span></a></p>` : ''}
  ${r.codes.length ? html`<ul class="promo-list">${r.codes.map(k => bfCodeCard(c, k))}</ul>` : ''}
</li>`;
}

// The same code of a store in black-friday.json and in promos/promos.js (a code by its letters, a coupon by its money).
const codeKey = (slug, kind, code, off, min) => (kind === 'code' ? `${slug}:code:${String(code).toUpperCase()}` : `${slug}:coupon:${Number(off)}:${Number(min)}`);
function bfKey(k) {
  if (k.kind === 'code') return codeKey(k.slug, 'code', k.code);
  const m = /^£(\d+(?:\.\d{2})?) off when you spend £(\d+(?:\.\d{2})?)/.exec(k.title || '');
  return m ? codeKey(k.slug, 'coupon', '', m[1], m[2]) : `${k.slug}:coupon:${k.title}`;
}

// The Black Friday block, below the stores on the home page (owner, 21 Nov 2026, L208: the stores first, then the
// offers), until the end of Cyber Monday (UK day); gone after it.
// A countdown worked out on the server by UK day ("8 days to Black Friday"; nothing moves, no script), the two dates,
// the stores that have started (early Black Friday) with their codes, the codes of this site's stores that the Hub's
// file does not list (promos/promos.js), the Hub's Black Friday page, and only with Amazon links Amazon's own page.
// Stores and codes only for the visitor's country (L210); elsewhere = how many entries run today for other countries.
export function blackFridayParts(site, now = Date.now(), country = VIEW_BASE) {
  const today = ukDay(new Date(now));
  const bf = site.blackFriday;
  const cyber = site.cyberMonday || (bf ? addDays(bf, 3) : '');
  if (!bf || !cyber || today > cyber) return null;
  const pick = cc => {
    const started = earlyBlackFriday(site, now, cc);
    const shown = new Set(started.flatMap(r => r.codes.map(bfKey)));
    const extra = storeCodes(site, now, null, cc).filter(i => !shown.has(codeKey(i.store.slug, i.promo.kind, i.promo.code, i.promo.off, i.promo.minSpend)));
    return { started, extra };
  };
  const here = pick(country);
  const all = pick(ANY_COUNTRY);
  const elsewhere = all.started.length + all.extra.length - here.started.length - here.extra.length;
  return { today, bf, cyber, days: daysBetween(today, bf), started: here.started, extra: here.extra, elsewhere };
}

function blackFridayBlock(c, now) {
  const { site, t } = c;
  const b = blackFridayParts(site, now, c.country);
  if (!b) return '';
  // Nothing of it is listed for this country (L210): the countdown and the dates, a line saying so, and no Hub button
  // (the Hub's Black Friday page lists the same UK stores and codes).
  const noneHere = !b.started.length && !b.extra.length && b.elsewhere > 0;
  // The Hub's Black Friday page lists only the UK stores and their codes in pounds: its button only for the UK.
  const hubButton = c.country === VIEW_BASE;
  const count = b.days > 1 ? t('{0} days to Black Friday', html`<strong class="bf-num">${b.days}</strong>`)
    : b.days === 1 ? t('{0} day to Black Friday', html`<strong class="bf-num">1</strong>`)
      : b.today < b.cyber ? t('Black Friday is on') : t('Cyber Monday is on');
  const amazon = amazonPageUrl(site, site.amazon && site.amazon.blackFriday, c.mode);
  const anyCodes = b.extra.length || b.started.some(r => r.codes.length);
  return html`<section class="wrap section bf" id="black-friday" aria-labelledby="bf-h">
  <h2 id="bf-h">${t('Black Friday {0}', b.bf.slice(0, 4))}</h2>
  <p class="bf-count" data-day="${b.today}">${count}</p>
  <p class="bf-dates">${t('Black Friday: {0} · Cyber Monday: {1}', c.dayDate(b.bf), c.dayDate(b.cyber))}</p>
  ${b.started.length ? html`<h3 class="bf-sub">${b.today < b.bf ? t('Early Black Friday: stores that have already started') : t('Stores that have started their Black Friday')}</h3>
  <p class="section-lede">${t('From the stores\' own emails to Gear World, with their own dates. Each Gear World site lists only the products that deliver to your country.')}</p>
  <ul class="bf-started">${b.started.map(r => startedItem(c, r))}</ul>` : ''}
  ${b.extra.length ? html`<h3 class="bf-sub">${t('Codes from the stores')}</h3>
  <ul class="promo-list">${b.extra.map(i => codeCard(c, i))}</ul>` : ''}
  ${anyCodes ? html`<p class="promo-note">${t('The stores\' own codes, as they publish them through their affiliate programmes. Each one has an end date and disappears after it.')} ${t('Each store sets its own terms: check them on its page before you pay.')}</p>` : ''}
  ${noneHere && !c.edition ? html`<p class="bf-none">${t('No store with Black Friday codes is listed for your country yet.')}</p>` : ''}
  ${!hubButton && !amazon ? '' : html`<p class="bf-links">
    ${!hubButton ? '' : html`<a class="btn btn-gw" href="${c.hub('/black-friday/')}"><span>${t('All Black Friday dates and codes on {0}', keep((site.hub && site.hub.name) || 'Gear World Hub'))}</span></a>`}
    ${amazon ? html`<a class="btn btn-market" href="${amazon}" rel="sponsored nofollow noopener" target="_blank">${t('Black Friday on Amazon')}</a>` : ''}
  </p>`}
</section>`;
}

// ---------------- Stores (owner, 18 Nov 2026, «ΕΓΚΡΙΝΩ MEGA STORES ΜΠΑΡΑ», lessons L191) ----------------
// One page per store at /stores/<slug>/ with real product photos read live from the Gear World sites' /api/products
// (the store's first 6 sites, 4 seconds each, kept 1 hour in the Worker's cache). Only the photo, the name, the brand
// and the Gear World product page are kept: never a price, a was_price or an affiliate_url (Amazon Associates 6(y),
// lessons L103, L107), never an /out/ or /go/ link (a visit from here would count as a click on a retailer link).
// Nothing is written to the repo (no Awin feed data). Amazon has its own page (/stores/amazon/) with the gift ideas and
// the Amazon buttons, only with AMAZON_LINKS on or preview.
// Who asks the Gear World sites: "MegaStoresGearWorld/1.0 (+https://megastoresgearworld.com)" from the site config.
export const storeUserAgent = site => `${String(site.name).replace(/[^A-Za-z0-9]/g, '')}/1.0 (+https://${site.domain})`;
const STORE_SITES_READ = 6;
const STORE_PER_SITE = 8;
const STORE_KEEP = 24;
const STORE_TIMEOUT_MS = 4000;
// Product photos that open (owner, 21 Nov 2026, lessons L211: a CasualShoes card showed an empty photo, 404 at the store).
const PHOTO_TIMEOUT_MS = 2500;
// No photo check starts after this (the rest stay): a store page waits at most about 4 + 2.5 seconds for its photos,
// the home page's check after the answer about 20 + 2.5 (waitUntil runs at most 30 seconds after the answer).
const PHOTO_DEADLINE_MS = 4000;
const PHOTO_LATER_DEADLINE_MS = 20000;
// A product whose name or brand holds a price, a percentage, a word of a shop or of a discount, or Amazon's name is
// left out: those words never appear on this site (L101, L103, L107), and with AMAZON_LINKS off no page names Amazon.
const UNSHOWN_WORDS = /[£$€%]|\b(sale|sales|deals?|save|saving|savings|shop|shopping|buy|cart|basket|official|partners?|discounts?|offers?|free delivery|lowest price|best price|cheapest|clearance|bargains?|coupons?|vouchers?|promo|black friday)\b|amazon/i;
// The same words in Greek, for the Greek stores (L210): offer, discount, sale, gift, free; read without accents.
const UNSHOWN_GREEK = /προσφορ|εκπτωσ|ευκαιρι|δωρο|δωρεαν|εκπτωτικ/;
const unshown = text => UNSHOWN_WORDS.test(text) || UNSHOWN_GREEK.test(String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());

// A store of an affiliate network that has not approved this site yet (owner, 22 Nov 2026: "we will declare it but we
// will hide it", lessons L215). Linkwise approves every page that shows its stores before any promotion: until its email
// approves megastoresgearworld.com, the stores of site.hiddenNetworks are on no page, card, code or Black Friday entry of
// this site, for any country. Their visitors' countries then get the "no store listed for your country" page.
export function storeListed(site, store) {
  const hidden = Array.isArray(site && site.hiddenNetworks) ? site.hiddenNetworks : [];
  return !(store && store.network && hidden.includes(store.network));
}

export function awinStores(site) {
  return (site.stores || []).filter(s => !s.amazon && Array.isArray(s.sites) && s.sites.length && storeListed(site, s));
}

// ---------------- Direct stores (owner and Linkwise, 24 Nov 2026, lessons L226) ----------------
// Public, Sephora, e-shop.gr, AB Vasilopoulos and Kotsovolos accept no comparison site: their products are on none of the
// 13 sites, the Hub or the app. Linkwise agreed to their pages here like the Greek stores of L221 (logo, sets, gift
// ideas, no prices), with one difference: each idea opens the store's own page through our Linkwise link. A direct store
// has `direct` (its Linkwise programme, its own addresses, its sets and ideas) and no `sites`, so it is never read from a
// Gear World database and has no codes, Black Friday entry or product list here. Our affiliate code is never in this
// repository: it is the Worker secret LINKWISE_CODE (tools/ogw-site.ps1), and without it these stores are on no page.
export const LINKWISE_CODE = /^CD\d{3,9}$/;
export function linkwiseCode(env) {
  const v = env && typeof env.LINKWISE_CODE === 'string' ? env.LINKWISE_CODE.trim() : '';
  return LINKWISE_CODE.test(v) ? v : '';
}
export const isDirectStore = s => Boolean(s && !s.amazon && s.direct && Number.isInteger(s.direct.program) && s.direct.program > 0 && !(Array.isArray(s.sites) && s.sites.length));
// Shown to this country: our code is there, the network is not hidden (L215), and it is listed for the country (L210).
function directShown(site, store, country, lw) {
  return isDirectStore(store) && LINKWISE_CODE.test(String(lw || '')) && deliversHere(store, country) && storeListed(site, store);
}
export function directStores(site, country = VIEW_BASE, lw = '') {
  return (site.stores || []).filter(s => directShown(site, s, country, lw));
}
// The Linkwise link to one page of the store: only an https page on one of the store's own addresses, never another
// site; '' for anything else (the idea is then left out).
export function directUrl(store, page, code) {
  if (!isDirectStore(store) || !LINKWISE_CODE.test(String(code || ''))) return '';
  let u;
  try { u = new URL(String(page || '')); } catch { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !(store.direct.hosts || []).includes(u.hostname)) return '';
  return `https://go.linkwi.se/z/${store.direct.program}-0/${code}/?lnkurl=${encodeURIComponent(u.toString())}`;
}

// The stores shown with this mode, in the config's order: Amazon only with Amazon links (on or preview) and only where
// Amazon UK delivers; every other store only to the countries in its deliversTo (L210); a direct store only with our
// Linkwise code (L226).
export function shownStores(site, mode, country = VIEW_BASE, lw = '') {
  return (site.stores || []).filter(s => (s.amazon
    ? withMarkets(viewMode(site, mode, country))
    : isDirectStore(s) ? directShown(site, s, country, lw)
      : Array.isArray(s.sites) && s.sites.length && deliversHere(s, country) && storeListed(site, s)));
}

export function storeCacheKey(site, store) {
  return `https://${site.domain}/__cache/stores/${store.slug}?v=${encodeURIComponent(site.assetVersion)}`;
}

const SITE_HOST = w => new URL(w.url).hostname;

// One product of a site's /api/products answer as this site may show it, or null: an https photo, a product page on
// that same Gear World site, the store's own products, delivered to the store's first country (the UK for every store
// today, L210), not out of stock, a clean name.
export function cleanStoreProduct(p, store, w) {
  if (!p || typeof p !== 'object') return null;
  if (String(p.retailer || '').trim().toLowerCase() !== store.name.toLowerCase()) return null;
  const name = String(p.product_name || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const brand = String(p.brand || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!name || unshown(name) || unshown(brand)) return null;
  if (p.stock_status === 'out_of_stock') return null;
  const to = Array.isArray(p.delivers_to) ? p.delivers_to.map(c => String(c).toUpperCase()) : [];
  const home = productCountry(store);
  if (!to.includes(home) && !to.includes('WORLD')) return null;
  let image;
  let page;
  try {
    image = new URL(String(p.image_url || ''));
    page = new URL(String(p.product_url || ''));
  } catch { return null; }
  if (image.protocol !== 'https:' || page.protocol !== 'https:') return null;
  if (page.hostname !== SITE_HOST(w) || !page.pathname.startsWith('/product/') || /\/(out|go)\//.test(page.pathname)) return null;
  page.hash = '';
  return { name, brand, image: image.toString(), url: page.toString(), site: w.code };
}

// The store's products from one Gear World site: [] when it answers nothing usable, an error when it fails or is slow.
async function readSiteProducts(store, w, deps, extra = null) {
  const u = new URL('/api/products', w.url);
  u.searchParams.set('retailer', store.name);
  u.searchParams.set('deliver_to', productCountry(store));
  u.searchParams.set('badges', '1');
  u.searchParams.set('limit', String((extra && extra.limit) || STORE_PER_SITE));
  // A search among the store's own products (the showcase, L221), never sent to the site's AI translation.
  if (extra && extra.q) {
    u.searchParams.set('q', String(extra.q).slice(0, 80));
    u.searchParams.set('translate', '0');
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), deps.timeoutMs || STORE_TIMEOUT_MS);
  try {
    const res = await deps.fetch(u.toString(), { headers: { 'User-Agent': deps.userAgent, Accept: 'application/json' }, signal: ac.signal, redirect: 'manual' });
    if (!res || res.status !== 200) throw new Error(`HTTP ${res && res.status}`);
    const data = await res.json();
    const rows = data && Array.isArray(data.products) ? data.products : [];
    return rows.map(p => cleanStoreProduct(p, store, w)).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

// The sites one after another (round-robin), one product name once, up to 24.
export function mixStoreProducts(lists, keep = STORE_KEEP) {
  const out = [];
  const seen = new Set();
  const longest = Math.max(0, ...lists.map(l => l.length));
  for (let i = 0; i < longest && out.length < keep; i++) {
    for (const l of lists) {
      const p = l[i];
      if (!p) continue;
      const k = p.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
      if (out.length >= keep) break;
    }
  }
  return out;
}

// One Worker invocation checks at most PHOTO_PARALLEL photos at a time (a Worker keeps only 6 requests waiting for their
// headers at once): each check's 2.5-second timer starts when its own request starts, never while it waits in line
// (independent check of L211).
const PHOTO_PARALLEL = 4;
export function photoLimiter(n = PHOTO_PARALLEL) {
  let active = 0;
  const waiting = [];
  const next = () => {
    if (active >= n || !waiting.length) return;
    active++;
    const { fn, resolve, reject } = waiting.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); });
  };
  return fn => new Promise((resolve, reject) => { waiting.push({ fn, resolve, reject }); next(); });
}

// What a product photo is: 'ok' (the first KB answers 200 or 206 with an image type), 'broken' (404 or 410, or an
// answer that is not an image), 'forbidden' (403: left out too, but it may be the image server refusing Cloudflare) or
// 'unknown' (slow, a network error, 429, 5xx or anything else) or 'late' (not checked: past the check's deadline). Only
// broken and forbidden are left out: a slow or busy image server never hides a good photo (L211). The rest of the
// photo is never read.
export async function photoState(url, fetcher, { timeoutMs = PHOTO_TIMEOUT_MS, userAgent = '', limit = null, until = 0 } = {}) {
  const run = async () => {
    if (until && Date.now() >= until) return 'late';
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetcher(url, { headers: { Range: 'bytes=0-1023', Accept: 'image/*', ...(userAgent ? { 'User-Agent': userAgent } : {}) }, signal: ac.signal });
      try { if (res && res.body && typeof res.body.cancel === 'function') await res.body.cancel(); } catch { /* nothing more to read */ }
      if (!res) return 'unknown';
      if (res.status === 200 || res.status === 206) return /^image\//i.test(String(res.headers.get('Content-Type') || '')) ? 'ok' : 'broken';
      if (res.status === 403) return 'forbidden';
      return [404, 410].includes(res.status) ? 'broken' : 'unknown';
    } catch {
      return 'unknown';
    } finally {
      clearTimeout(timer);
    }
  };
  return limit ? limit(run) : run();
}
export async function photoOpens(url, fetcher, opts = {}) {
  return (await photoState(url, fetcher, opts)) === 'ok';
}

// The products whose photo is not broken, in their order, up to `keep`: the first `keep` are checked, then as many more
// as are missing, until there are enough or none is left. { products, checked, broken, blocked }. opts.deadlineMs: no
// check starts after it (the rest are 'late' and stay; the copy is then kept 10 minutes, not the hour), so a slow
// image server never holds a page long and never leaves unchecked photos for an hour.
// When every photo of 3 or more checked is refused (403), the check itself is taken as blocked (the image server
// refusing Cloudflare): the products stay unchecked (blocked: true) and are kept only 10 minutes. Photos that all
// answer 404 are really gone: left out.
export async function keepOpenPhotos(list, fetcher, keep = STORE_KEEP, opts = {}) {
  const out = [];
  let i = 0;
  let checked = 0;
  let broken = 0;
  let forbidden = 0;
  let late = 0;
  const run = { ...opts, until: opts.deadlineMs ? Date.now() + opts.deadlineMs : 0 };
  while (out.length < keep && i < list.length) {
    const batch = list.slice(i, i + (keep - out.length));
    i += batch.length;
    const states = await Promise.all(batch.map(p => photoState(p.image, fetcher, run)));
    checked += batch.length;
    batch.forEach((p, j) => {
      if (states[j] === 'broken') broken++;
      else if (states[j] === 'forbidden') forbidden++;
      else { if (states[j] === 'late') late++; out.push(p); }
    });
  }
  if (!out.length && checked >= 3 && forbidden === checked) return { products: list.slice(0, keep), checked, broken, late, blocked: true };
  return { products: out, checked, broken: broken + forbidden, late, blocked: false };
}

// The store's products: from the cache, or read from its first 6 Gear World sites at once (Promise.allSettled, so a
// slow or failing site never breaks the page). Kept 1 hour when every site answered, 10 minutes when one failed, and
// 1 minute when nothing came back (the page then says so and still links to every site). One copy for every language.
// Only products whose photo is not broken (L211, keepOpenPhotos) when the Worker checks photos (deps.photoFetch: the
// live Worker always; tests only when they give one), at most PHOTO_PARALLEL at a time per invocation (deps.photoLimit).
export async function storeProducts(site, store, deps = {}, ctx = null) {
  const cache = deps.cache || null;
  const key = storeCacheKey(site, store);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const data = await hit.json();
        if (data && Array.isArray(data.products)) return { products: data.products, cached: true };
      }
    } catch { /* a broken copy is read again from the sites */ }
  }
  const sites = store.sites.map(gearWorldFor).filter(Boolean).slice(0, STORE_SITES_READ);
  const fetcher = deps.fetch || ((...a) => fetch(...a));
  const results = await Promise.allSettled(sites.map(w => readSiteProducts(store, w, { ...deps, fetch: fetcher, userAgent: storeUserAgent(site) })));
  const lists = results.map(r => (r.status === 'fulfilled' ? r.value : []));
  const failed = results.some(r => r.status !== 'fulfilled');
  const candidates = mixStoreProducts(lists, deps.photoFetch ? STORE_SITES_READ * STORE_PER_SITE : STORE_KEEP);
  const ttlFor = (list, blocked = false, late = 0) => (!list.length ? 60 : (failed || blocked || late) ? 600 : 3600);
  const keepCopy = (list, ttl) => {
    if (!cache) return Promise.resolve();
    const res = new Response(JSON.stringify({ products: list }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } });
    return Promise.resolve().then(() => cache.put(key, res)).catch(() => { /* the next visit reads the sites again */ });
  };
  const later = ctx && typeof ctx.waitUntil === 'function';
  if (!deps.photoFetch) {
    const products = candidates.slice(0, STORE_KEEP);
    const put = keepCopy(products, ttlFor(products));
    if (later) ctx.waitUntil(put); else await put;
    return { products, cached: false };
  }
  const background = Boolean(deps.photoLater && later);
  const check = () => keepOpenPhotos(candidates, deps.photoFetch, STORE_KEEP, {
    timeoutMs: deps.photoTimeoutMs, userAgent: storeUserAgent(site), limit: deps.photoLimit || null,
    deadlineMs: deps.photoDeadlineMs || (background ? PHOTO_LATER_DEADLINE_MS : PHOTO_DEADLINE_MS)
  });
  // The home page (deps.photoLater) does not wait for the photos: it shows the products at once, keeps them 1 minute,
  // and checks them after the answer (waitUntil), keeping the checked copy for the hour. A store page waits for them.
  if (background) {
    const products = candidates.slice(0, STORE_KEEP);
    ctx.waitUntil(keepCopy(products, 60)
      .then(check)
      .then(seen => keepCopy(seen.products, ttlFor(seen.products, seen.blocked, seen.late)))
      .catch(() => { /* the next visit checks again */ }));
    return { products, cached: false, unchecked: true };
  }
  const seen = await check();
  const put = keepCopy(seen.products, ttlFor(seen.products, seen.blocked, seen.late));
  if (later) ctx.waitUntil(put); else await put;
  return { products: seen.products, cached: false };
}

// The showcase of a store (owner, 23 Nov 2026: "no prices, only bundles and ideas", lessons L221): its `showcase` sets
// and gift ideas, each pick the first product a search among the store's products on its Gear World site finds (in
// stock, an https photo, its Gear World product page, never twice on the page), its searches tried in the order given:
// the first search of every pick at once, a next one only for a pick still without a product. A product whose photo is
// broken (L211) gives its place to the next one its searches find. Searches go out at most SHOWCASE_PARALLEL at a time, so each
// timer starts with its own request (a Worker keeps only 6 waiting for their headers: 2 searches + 4 photo checks), with translate=0 (no AI
// translation on the site for our own searches). Read once for every language and kept like the store's products:
// 1 hour, 10 minutes when a pick lost its product to a failed search or a photo check could not finish, 1 minute when
// nothing came back (10 seconds when that was a site refusing). The cache key carries the asset version and a hash of the store's `showcase`. A set shows only
// with 2 products or more; an idea only with its product. Never a price.
const SHOWCASE_PER_PICK = 6;
const SHOWCASE_PICKS = 3;
const SHOWCASE_PARALLEL = 2;
const showcaseHash = sc => {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(sc || null)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};
export const showcaseCacheKey = (site, store) => `${storeCacheKey(site, store)}&part=showcase&sc=${showcaseHash(store && store.showcase)}`;
const showcaseQueries = pick => (Array.isArray(pick) ? pick : [pick]).map(q => String(q || '').trim()).filter(Boolean).slice(0, SHOWCASE_PICKS);
const showcaseSite = (store, part) => gearWorldFor((part && part.site) || store.sites[0]);

// The Greek text for a page in Greek, the English one for every other language (only Greece and Cyprus see these stores).
export function showcaseText(c, v) {
  if (!v || typeof v !== 'object') return '';
  return /^el\b/i.test(String(c.lang || '')) ? String(v.el || v.en || '') : String(v.en || v.el || '');
}

// The names of the products a showcase shows (the store page leaves them out of its own list, L221).
export function showcaseNames(data) {
  if (!data) return new Set();
  return new Set([...(data.sets || []).flatMap(x => x.items || []), ...(data.ideas || []).map(x => x.product)]
    .filter(Boolean).map(p => String(p.name).toLowerCase()));
}

export async function storeShowcase(site, store, deps = {}, ctx = null) {
  const sc = store && store.showcase;
  if (!sc || store.amazon) return null;
  const cache = deps.cache || null;
  const key = showcaseCacheKey(site, store);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const data = await hit.json();
        if (data && Array.isArray(data.sets) && Array.isArray(data.ideas)) return data;
      }
    } catch { /* a broken copy is read again from the sites */ }
  }
  const fetcher = deps.fetch || ((...a) => fetch(...a));
  const userAgent = storeUserAgent(site);
  const queue = photoLimiter(SHOWCASE_PARALLEL);
  const reads = new Map();
  const failedReads = new Set();
  // A site that failed or timed out twice is not asked again for this showcase: a site that hangs costs about one time
  // limit (2 searches wait at once), never one per search (L191: a slow site never holds the page), while one blip
  // costs only its own search.
  const down = new Set();
  const fails = new Map();
  const read = (w, q) => {
    const k = `${w.code}\t${q}`;
    if (!reads.has(k)) {
      reads.set(k, queue(() => (down.has(w.code) ? Promise.reject(new Error('site down'))
        : readSiteProducts(store, w, { ...deps, fetch: fetcher, userAgent }, { q, limit: SHOWCASE_PER_PICK })))
        .catch(() => {
          failedReads.add(k);
          fails.set(w.code, (fails.get(w.code) || 0) + 1);
          if (fails.get(w.code) >= 2) down.add(w.code);
          return [];
        }));
    }
    return reads.get(k);
  };
  // Every place on the page: the 3 picks of each set, then each idea.
  const slots = [
    ...(sc.sets || []).flatMap((set, si) => (set.picks || []).map(pick => ({ set: si, w: showcaseSite(store, set), qs: showcaseQueries(pick) }))),
    ...(sc.ideas || []).map((idea, ii) => ({ idea: ii, w: showcaseSite(store, idea), qs: showcaseQueries(idea.pick) }))
  ].filter(x => x.w && x.qs.length);
  for (const x of slots) read(x.w, x.qs[0]);
  const used = new Set();
  const bad = new Set();
  const fill = async x => {
    x.product = null;
    for (const q of x.qs) {
      const list = await read(x.w, q);
      if (failedReads.has(`${x.w.code}\t${q}`)) x.failed = true;
      for (const p of list) {
        const k = p.name.toLowerCase();
        if (used.has(k) || bad.has(k)) continue;
        used.add(k);
        x.product = p;
        return;
      }
    }
  };
  for (const x of slots) await fill(x);
  let blocked = false;
  let late = 0;
  if (deps.photoFetch) {
    // The photos of the chosen products (L211). A broken one gives its place to the next product its searches find
    // whose photo opens, checked one by one, all within the same time limit.
    const opts = { timeoutMs: deps.photoTimeoutMs, userAgent, limit: deps.photoLimit || null };
    const end = Date.now() + (deps.photoDeadlineMs || PHOTO_DEADLINE_MS);
    const chosen = slots.filter(x => x.product);
    const seen = await keepOpenPhotos(chosen.map(x => x.product), deps.photoFetch, chosen.length, { ...opts, deadlineMs: Math.max(1, end - Date.now()) });
    blocked = seen.blocked;
    late = seen.late;
    const open = new Set(seen.products);
    const dropped = chosen.filter(x => !open.has(x.product));
    for (const x of dropped) { bad.add(x.product.name.toLowerCase()); x.product = null; }
    for (const x of dropped) {
      if (Date.now() >= end) { late++; continue; }
      const next = [];
      for (const q of x.qs) {
        for (const p of await read(x.w, q)) {
          const k = p.name.toLowerCase();
          if (!used.has(k) && !bad.has(k) && !next.some(n => n.name.toLowerCase() === k)) next.push(p);
        }
        if (failedReads.has(`${x.w.code}\t${q}`)) x.failed = true;
      }
      if (!next.length) continue;
      const again = await keepOpenPhotos(next, deps.photoFetch, 1, { ...opts, deadlineMs: Math.max(1, end - Date.now()) });
      blocked = blocked || again.blocked;
      late += again.late;
      if (again.products[0]) { x.product = again.products[0]; used.add(x.product.name.toLowerCase()); }
    }
  }
  const data = {
    sets: (sc.sets || []).map((set, si) => ({ title: set.title, line: set.line, items: slots.filter(x => x.set === si && x.product).map(x => x.product) }))
      .filter(x => x.items.length >= 2),
    ideas: (sc.ideas || []).map((idea, ii) => ({ title: idea.title, line: idea.line, product: (slots.find(x => x.idea === ii && x.product) || {}).product || null }))
      .filter(x => x.product)
  };
  const lost = slots.some(x => !x.product && x.failed);
  // Nothing because a site refused (its database overloaded, 23 Nov 2026): 10 seconds, so the next visit tries again
  // once the site's 10-second window has passed.
  const ttl = !data.sets.length && !data.ideas.length ? (failedReads.size ? 10 : 60) : (lost || blocked || late) ? 600 : 3600;
  if (cache) {
    const res = new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } });
    const put = Promise.resolve().then(() => cache.put(key, res)).catch(() => { /* the next visit reads the sites again */ });
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put); else await put;
  }
  return data;
}

// One product of the showcase: its photo and name, the Gear World site it is on, its Gear World product page.
function showcaseProduct(c, p, cls) {
  const w = gearWorldFor(p.site);
  if (!w) return '';
  return html`<div class="${cls}">
    <a class="sc-photo" href="${c.gw(p.url)}" rel="noopener" target="_blank"><img src="${p.image}" alt="${p.name}" width="200" height="200" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
    <p class="sc-name" translate="no">${p.name}</p>
    <a class="sc-link" href="${c.gw(p.url)}" rel="noopener" target="_blank"><span>${c.t('See it on {0}', keep(w.name))}</span></a>
  </div>`;
}

export function showcaseSections(c, store, data) {
  if (!data || (!(data.sets || []).length && !(data.ideas || []).length)) return '';
  const { t } = c;
  return html`${(data.sets || []).length ? html`<section class="wrap section showcase" aria-labelledby="sets-h">
  <h2 id="sets-h">${t('Sets from {0}', keep(store.name))}</h2>
  <p class="section-lede">${t('Products of {0} that go together, chosen by us. Each one opens its page on a Gear World site, which shows the price and the stock.', keep(store.name))}</p>
  <ul class="sc-sets">${data.sets.map(set => html`<li class="sc-set">
    <h3>${showcaseText(c, set.title)}</h3>
    <p class="sc-line">${showcaseText(c, set.line)}</p>
    <ul class="sc-items">${set.items.map(p => html`<li>${showcaseProduct(c, p, 'sc-item')}</li>`)}</ul>
  </li>`)}</ul>
</section>` : ''}
${(data.ideas || []).length ? html`<section class="wrap section showcase" aria-labelledby="ideas-h">
  <h2 id="ideas-h">${t('Gift ideas from {0}', keep(store.name))}</h2>
  <ul class="sc-ideas">${data.ideas.map(idea => html`<li class="sc-idea">
    <h3>${showcaseText(c, idea.title)}</h3>
    <p class="sc-line">${showcaseText(c, idea.line)}</p>
    ${showcaseProduct(c, idea.product, 'sc-item')}
  </li>`)}</ul>
</section>` : ''}`;
}

const storeLogo = (site, store, cls) => {
  if (!store.logo || store.amazon || !/^logos\/[a-z0-9-]+\.(png|jpg|svg|webp)$/.test(store.logo)) return '';
  const [w, h] = Array.isArray(store.logoSize) ? store.logoSize : [168, 168];
  return html`<span class="${cls}"><img src="${asset(site, store.logo)}" alt="${store.name}" width="${w}" height="${h}" decoding="async"></span>`;
};

// The name as a clean text badge (no logo of our own making), or the store's own logo on a white tile.
const storeMark = (site, store) => storeLogo(site, store, 'store-logo') || html`<span class="store-badge" translate="no">${store.name}</span>`;

const siteCount = (c, n) => (n === 1 ? c.t('On 1 Gear World site') : c.t('On {0} Gear World sites', n));

function storeCard(c, store, products) {
  const { site, t } = c;
  const thumbs = (products || []).slice(0, 3);
  if (isDirectStore(store)) {
    // Its own products, from its sets and ideas (L226): the card opens our page of the store, never the store itself.
    // For a direct store the home page's data is the list of its photos that did not open (directPhotos).
    const broken = new Set(Array.isArray(products) ? products.filter(x => typeof x === 'string') : []);
    const own = directPicks(store).filter(p => !broken.has(p.image)).slice(0, 3);
    return html`<li class="store-card">
  <div class="store-mark">${storeMark(site, store)}</div>
  <h3><a class="store-link" href="${c.href(`/stores/${store.slug}/`)}"><span translate="no">${store.name}</span></a></h3>
  <p>${t(store.line)}</p>
  ${own.length ? html`<ul class="store-thumbs">${own.map(p => html`<li><img src="${p.image}" alt="" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer"></li>`)}</ul>` : ''}
  <p class="store-meta">${(store.direct.sets || []).length ? t('Sets and gift ideas from {0}', keep(store.name)) : t('Gift ideas from {0}', keep(store.name))}</p>
</li>`;
  }
  if (store.amazon) {
    return html`<li class="store-card">
  <div class="store-mark"><span class="store-badge" translate="no">${store.name}</span></div>
  <h3><a class="store-link" href="${c.href(`/stores/${store.slug}/`)}"><span translate="no">${store.name}</span></a></h3>
  <p>${t(store.line)}</p>
  <p class="store-meta">${t('{0} gift guides', site.guides.length)}</p>
</li>`;
  }
  return html`<li class="store-card">
  <div class="store-mark">${storeMark(site, store)}</div>
  <h3><a class="store-link" href="${c.href(`/stores/${store.slug}/`)}"><span translate="no">${store.name}</span></a></h3>
  <p>${t(store.line)}</p>
  ${thumbs.length ? html`<ul class="store-thumbs">${thumbs.map(p => html`<li><img src="${p.image}" alt="" width="96" height="96" loading="lazy" decoding="async" referrerpolicy="no-referrer"></li>`)}</ul>` : ''}
  <p class="store-meta">${siteCount(c, store.sites.length)}</p>
</li>`;
}

function storesSection(c, data) {
  const { site, t, mode } = c;
  const stores = shownStores(site, mode, c.country, c.lw);
  // No store of this page is listed for the visitor's country (L210): the part stays, with a line saying so (what we
  // list, never a claim about where a retailer delivers, L107).
  if (!stores.length && shownStores(site, mode, ANY_COUNTRY, c.lw).length) {
    return html`<section class="wrap section" id="stores">
  <h2>${storesLabel(c)}</h2>
  <p class="section-lede stores-none">${t('No store of {0} is listed for your country yet.', storesLabel(c))} ${t('The gift guides open the Gear World sites, where each product shows where it delivers.')}</p>
  <p><a href="${c.href('/#guides')}">${t('Gift guides')}</a></p>
</section>`;
  }
  if (!stores.length) return '';
  return html`<section class="wrap section" id="stores">
  <h2>${storesLabel(c)}</h2>
  <p class="section-lede">${withMarkets(mode)
    ? t('One page per store: product photos from the Gear World sites, and gift ideas to search on Amazon. Prices, stock and delivery are on the page each button opens.')
    : stores.some(isDirectStore)
      ? t('One page per store, with product photos from the Gear World sites or, for some stores, gift ideas that open the store’s own page. Prices, stock and delivery are on the page each button opens.')
      : t('One page per store, with product photos from the Gear World sites. Prices, stock and delivery are on the product page each button opens.')}</p>
  <ul class="stores">${stores.map(s => storeCard(c, s, (data && data[s.slug]) || []))}</ul>
</section>`;
}

// The note at the top of a store page: its buttons open Gear World product pages (no affiliate link of our own here).
function storeDisclosure(c) {
  return html`<div class="note" role="note">
  <p>${c.t('The buttons on this page open product pages of the Gear World sites. Those sites link to retailers and may earn a commission, at no extra cost to you.')}</p>
  <p>${c.t('Prices, stock and delivery are on the page you open. We do not sell anything and we do not track prices.')}</p>
</div>`;
}

// Codes from promos/promos.js that run today on a Gear World site for this store (kind "code" only: a sale or a
// coupon is not a code to type, lessons L107, L114).
function storeHasCodes(store, code, now, country = VIEW_BASE) {
  return activePromos({ promos: promosFor(code) }, now).some(p => p.kind === 'code' && p.slug === store.slug && deliversHere(p, country));
}

export function storeSearchUrl(store, w) {
  const u = new URL('/search', w.url);
  u.searchParams.set('q', store.name);
  u.searchParams.set('retailer', store.name);
  return u.toString();
}

// A store page for a visitor from a country the store is not listed for (L210: deliversTo is where we list it, not a
// claim about where the retailer delivers): its name, one line saying so, and
// the links to the stores and the gift guides. No products, no codes, no links to its products on the sites.
export function storeElsewherePage(c, store) {
  const { site, t, tx } = c;
  return shell(c, {
    title: tx('{0} on {1}', store.name, site.name),
    description: tx('{0} is not listed for your country yet.', store.name),
    path: `/stores/${store.slug}/`,
    // Never in a search engine (L211): Google reads the UK page, so this one only reaches a visitor elsewhere.
    robots: 'noindex',
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="${c.href('/#stores')}">${storesLabel(c)}</a></p>
  <div class="store-title">${storeLogo(site, store, 'store-logo store-logo-lg')}<h1>${t('{0} on {1}', keep(store.name), keep(site.name))}</h1></div>
  <p class="lede store-elsewhere">${t('{0} is not listed for your country yet.', keep(store.name))} ${t('The gift guides open the Gear World sites, where each product shows where it delivers.')}</p>
</div></section>
<section class="wrap section">
  <p><a href="${c.href('/#stores')}">${t('All stores')}</a> · <a href="${c.href('/#guides')}">${t('Gift guides')}</a></p>
</section>`
  });
}

export function storePage(c, store, products, now = Date.now(), showcase = null) {
  const { site, t, tx } = c;
  const worlds = store.sites.map(gearWorldFor).filter(Boolean);
  const codes = storeCodes(site, now, store.slug, c.country);
  const started = earlyBlackFriday(site, now, c.country).find(r => r.slug === store.slug);
  // The products the showcase already shows are not listed twice (L221); the list then has its own heading.
  const inShowcase = showcaseNames(showcase);
  const listed = inShowcase.size ? products.filter(p => !inShowcase.has(String(p.name).toLowerCase())) : products;
  return shell(c, {
    title: tx('{0} on {1}', store.name, site.name),
    description: `${tx(store.line)} ${tx('Product photos from the Gear World sites, each with its Gear World product page.')}`,
    path: `/stores/${store.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="${c.href('/#stores')}">${storesLabel(c)}</a></p>
  <div class="store-title">${storeLogo(site, store, 'store-logo store-logo-lg')}<h1>${t('{0} on {1}', keep(store.name), keep(site.name))}</h1></div>
  <p class="lede">${t(store.line)} ${t('Each product opens its page on a Gear World site, which shows the price, the stock and where {0} delivers.', keep(store.name))}</p>
  ${started ? html`<p class="count bf-when" data-end="${started.hide}">${bfWhen(c, started)}</p>` : ''}
</div></section>
<section class="wrap section">${storeDisclosure(c)}</section>
${showcaseSections(c, store, showcase)}
${codes.length ? html`<section class="wrap section store-codes" aria-labelledby="codes-h">
  <h2 id="codes-h">${t('Codes from {0}', keep(store.name))}</h2>
  <ul class="promo-list">${codes.map(i => codeCard(c, i, false))}</ul>
  <p class="promo-note">${t('Each store sets its own terms: check them on its page before you pay.')}</p>
</section>` : ''}
${(products.length && !listed.length) || (!products.length && inShowcase.size) ? '' : html`<section class="wrap section" aria-label="${tx('Products')}">
  ${inShowcase.size && listed.length ? html`<h2>${t('More from {0}', keep(store.name))}</h2>` : ''}
  ${listed.length
    ? html`<ul class="pcards">${listed.map(p => {
      const w = gearWorldFor(p.site);
      return html`<li class="pcard">
    <a class="pcard-photo" href="${c.gw(p.url)}" rel="noopener" target="_blank"><img src="${p.image}" alt="${p.name}" width="240" height="240" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
    <h2 class="pcard-name" translate="no">${p.name}</h2>
    ${p.brand ? html`<p class="pcard-brand" translate="no">${p.brand}</p>` : ''}
    <p class="pcard-site">${t('On {0}', keep(w.name))}</p>
    <a class="btn btn-gw pcard-btn" href="${c.gw(p.url)}" rel="noopener" target="_blank"><span>${t('See it on {0}', keep(w.name))}</span></a>
  </li>`;
    })}</ul>`
    : html`<p class="empty">${t('Products could not be loaded just now. The links below open {0} on each Gear World site.', keep(store.name))}</p>`}
</section>`}
<section class="wrap section">
  <h2>${t('{0} on the Gear World sites', keep(store.name))}</h2>
  <ul class="site-links">${worlds.map(w => html`<li>
    <a href="${c.gw(retailerSearchUrl(store, w))}"><span>${t('All {0} products on {1}', keep(store.name), keep(w.name))}</span></a>
    ${storeHasCodes(store, w.code, now, c.country) ? html`<a href="${c.gw(new URL(`/discount-codes/${store.slug}/`, w.url).toString())}"><span>${t('{0} voucher codes on {1}', keep(store.name), keep(w.name))}</span></a>` : ''}
  </li>`)}</ul>
  <p><a href="${c.href('/#stores')}">${t('All stores')}</a> · <a href="${c.href('/#guides')}">${t('Gift guides')}</a></p>
</section>`
  });
}

// ---------------- The page of a direct store (L226) ----------------
// Every product of its sets and ideas that has a photo, in page order (for the card on the home page).
export function directPicks(store) {
  const d = (store && store.direct) || {};
  return [...(d.sets || []).flatMap(x => x.items || []), ...(d.ideas || []).map(x => x.item)].filter(p => p && p.image && p.name);
}
// The photos of a direct store's sets and ideas, checked like every other photo of this site (L211): from the store's
// own image servers; a photo that does not open is left out with its product. The result (the photos that did not open)
// is kept 6 hours, 10 minutes when a check did not finish in time or every server refused, so a page checks at most once.
// later: the home page does not wait (it checks in the background and shows the photos at once, L211).
const DIRECT_PHOTO_TTL = 21600;
export const directPhotosKey = (site, store) => `${storeCacheKey(site, store)}&part=direct-photos&h=${showcaseHash(directPicks(store).map(p => p.image))}`;
export async function directPhotos(site, store, deps = {}, ctx = null, { later = false } = {}) {
  const images = [...new Set(directPicks(store).map(p => p.image))];
  const cache = deps.cache || null;
  const key = directPhotosKey(site, store);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const data = await hit.json();
        if (data && Array.isArray(data.broken)) return new Set(data.broken);
      }
    } catch { /* a broken copy is checked again */ }
  }
  if (!deps.photoFetch || !images.length) return new Set();
  const check = async () => {
    const opts = { timeoutMs: deps.photoTimeoutMs, userAgent: storeUserAgent(site), limit: deps.photoLimit || null };
    const seen = await keepOpenPhotos(images.map(image => ({ image })), deps.photoFetch, images.length,
      { ...opts, deadlineMs: later ? PHOTO_LATER_DEADLINE_MS : (deps.photoDeadlineMs || PHOTO_DEADLINE_MS) });
    const open = new Set(seen.products.map(p => p.image));
    const broken = images.filter(i => !open.has(i));
    if (cache) {
      const ttl = seen.late || seen.blocked ? 600 : DIRECT_PHOTO_TTL;
      const res = new Response(JSON.stringify({ broken }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } });
      try { await cache.put(key, res); } catch { /* the next visit checks again */ }
    }
    return new Set(broken);
  };
  if (later) {
    // The home page never waits: without a way to finish in the background, no check at all.
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(check().catch(() => null));
    return new Set();
  }
  return check();
}
const DIRECT_REL = 'sponsored nofollow noopener';
function directProduct(c, store, p, broken = new Set()) {
  const href = directUrl(store, p.url, c.lw);
  if (!href || !/^https:\/\/[^/]+\//.test(String(p.image || '')) || broken.has(p.image)) return '';
  return html`<div class="sc-item">
    <a class="sc-photo" href="${href}" rel="${DIRECT_REL}" target="_blank"><img src="${p.image}" alt="${p.name}" width="200" height="200" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
    <p class="sc-name" translate="no">${p.name}</p>
    <a class="sc-link" href="${href}" rel="${DIRECT_REL}" target="_blank"><span>${c.t('See it at {0}', keep(store.name))}</span></a>
  </div>`;
}
// An idea: one product of the store, or (AB, which has no product feed) one of its categories, as a text link.
function directIdea(c, store, idea, broken) {
  if (idea.item) return directProduct(c, store, idea.item, broken);
  const href = directUrl(store, idea.url, c.lw);
  return href ? html`<a class="sc-link" href="${href}" rel="${DIRECT_REL}" target="_blank"><span>${c.t('See them at {0}', keep(store.name))}</span></a>` : '';
}
// The note at the top of the page: these buttons are our own Linkwise links to the store (not Gear World pages).
function directDisclosure(c, store) {
  return html`<div class="note" role="note">
  <p>${c.t('The buttons on this page open pages of {0} through Linkwise, an affiliate network. If you buy there, we may earn a commission, at no extra cost to you.', keep(store.name))}</p>
  <p>${c.t('Prices, stock and delivery are on the page you open. We do not sell anything and we do not track prices.')}</p>
</div>`;
}
// broken: the photos that did not open (directPhotos): their products are left out, and a set needs 2 products (L221).
export function directStorePage(c, store, broken = new Set()) {
  const { site, t, tx } = c;
  const d = store.direct || {};
  const sets = (d.sets || []).map(set => ({ set, items: (set.items || []).map(p => directProduct(c, store, p, broken)).filter(Boolean) })).filter(x => x.items.length >= 2);
  const ideas = (d.ideas || []).map(idea => ({ idea, body: directIdea(c, store, idea, broken) })).filter(x => toString(x.body));
  return shell(c, {
    title: tx('{0} on {1}', store.name, site.name),
    description: `${tx(store.line)} ${tx('Each idea opens its page on {0}, which shows the price, the stock and the delivery.', store.name)}`,
    path: `/stores/${store.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="${c.href('/#stores')}">${storesLabel(c)}</a></p>
  <div class="store-title">${storeLogo(site, store, 'store-logo store-logo-lg')}<h1>${t('{0} on {1}', keep(store.name), keep(site.name))}</h1></div>
  <p class="lede">${t(store.line)} ${t('Each idea opens its page on {0}, which shows the price, the stock and the delivery.', keep(store.name))}</p>
</div></section>
<section class="wrap section">${directDisclosure(c, store)}</section>
${sets.length ? html`<section class="wrap section showcase" aria-labelledby="sets-h">
  <h2 id="sets-h">${t('Sets from {0}', keep(store.name))}</h2>
  <p class="section-lede">${t('Products of {0} that go together, chosen by us. Each one opens its page on {0}, which shows the price and the stock.', keep(store.name))}</p>
  <ul class="sc-sets">${sets.map(({ set, items }) => html`<li class="sc-set">
    <h3>${showcaseText(c, set.title)}</h3>
    <p class="sc-line">${showcaseText(c, set.line)}</p>
    <ul class="sc-items">${items.map(i => html`<li>${i}</li>`)}</ul>
  </li>`)}</ul>
</section>` : ''}
${ideas.length ? html`<section class="wrap section showcase" aria-labelledby="ideas-h">
  <h2 id="ideas-h">${t('Gift ideas from {0}', keep(store.name))}</h2>
  <ul class="sc-ideas">${ideas.map(({ idea, body }) => html`<li class="sc-idea">
    <h3>${showcaseText(c, idea.title)}</h3>
    <p class="sc-line">${showcaseText(c, idea.line)}</p>
    ${body}
  </li>`)}</ul>
</section>` : ''}
<section class="wrap section">
  <p><a href="${c.href('/#stores')}">${t('All stores')}</a> · <a href="${c.href('/#guides')}">${t('Gift guides')}</a></p>
</section>`
  });
}

// The main Gear World site of a guide: the site most of its ideas link to (the first one on a tie), for its photo.
export function guideWorld(guide) {
  const n = new Map();
  for (const i of guide.ideas || []) n.set(i.gw, (n.get(i.gw) || 0) + 1);
  let best = '';
  for (const [code, c] of n) if (!best || c > n.get(best)) best = code;
  return guide.world || best;
}

export const guideImage = guide => `worlds/${String(guideWorld(guide)).toLowerCase()}.jpg`;

// The Amazon page: the gift ideas, guide by guide, with the Amazon buttons. Our own photos of the Gear Worlds, never an
// Amazon product photo (no Product Advertising API). The Amazon image, when Amazon supplies one, only here, next to
// the Amazon buttons and only with the Associates ID (Trademark Guidelines).
export function amazonStorePage(c, store) {
  const { site, t, tx, mode } = c;
  const mark = site.amazon && /^[a-z0-9/-]+\.(png|jpg|svg|gif)$/.test(String(site.amazon.linkImage || '')) && mode === 'on'
    ? html`<p class="amz-mark"><img src="${asset(site, site.amazon.linkImage)}" alt="Amazon" decoding="async"></p>` : '';
  return shell(c, {
    title: `${tx('Gift ideas to search on Amazon')} | ${site.name}`,
    description: tx('The ideas of our gift guides, each with a search on amazon.co.uk. Compare models, sellers and prices before you choose.'),
    path: `/stores/${store.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="${c.href('/#stores')}">${storesLabel(c)}</a></p>
  <h1>${t('Gift ideas to search on Amazon')}</h1>
  <p class="lede">${t(store.line)} ${t('Each button opens a search on amazon.co.uk, which shows the current models, sellers and prices.')}</p>
</div></section>
<section class="wrap section">${disclosure(c)}</section>
<section class="wrap section">
  <ul class="amz-guides">${site.guides.map(g => html`<li class="amz-guide">
    <img class="amz-photo" src="${asset(site, guideImage(g))}" alt="" width="700" height="420" loading="lazy" decoding="async">
    <div class="amz-body">
      <h2><a href="${c.href(`/guides/${g.slug}/`)}">${t(g.title)}</a></h2>
      <p>${t(g.teaser)}</p>
      ${mark}
      <ul class="amz-ideas">${g.ideas.map(i => {
        const href = amazonUrl(site, i.q, mode);
        return html`<li><span class="amz-idea">${t(i.name)}</span>${href ? html`<a class="btn btn-market btn-sm" href="${href}" rel="sponsored nofollow noopener" target="_blank" aria-label="${tx('{0}: see prices on Amazon', tx(i.name))}">${t('See prices on Amazon')}</a>` : ''}</li>`;
      })}</ul>
    </div>
  </li>`)}</ul>
  <p><a href="${c.href('/#stores')}">${t('All stores')}</a> · <a href="${c.href('/#guides')}">${t('Gift guides')}</a></p>
</section>`
  });
}

// The buttons on the right of the home page's hero (owner, 21 Nov 2026, lessons L208): the countdown to Black Friday
// (until Cyber Monday; then to Christmas), the stores, the gift guides and the first four guides, each a link to its
// part of the page or its guide. Worked out on the server like the countdown (nothing moves, no script, L188).
export function heroButtons(c, now = new Date()) {
  const { site, t, mode } = c;
  const b = blackFridayParts(site, now.getTime(), c.country);
  const tiles = [];
  if (b) {
    const label = b.days > 1 ? t('{0} days to Black Friday', html`<strong class="jump-num">${b.days}</strong>`)
      : b.days === 1 ? t('{0} day to Black Friday', html`<strong class="jump-num">1</strong>`)
        : b.today < b.cyber ? t('Black Friday is on') : t('Cyber Monday is on');
    tiles.push(html`<li class="jump-wide"><a class="jump jump-bf" href="${c.href('/#black-friday')}"><span class="jump-label">${label}</span><span class="jump-meta">${c.dayDate(b.today < b.bf ? b.bf : b.cyber)}</span></a></li>`);
  } else {
    const count = countdownText(site, c, now);
    if (count) tiles.push(html`<li class="jump-wide"><a class="jump jump-bf" href="${c.href('/#guides')}"><span class="jump-label">${count}</span></a></li>`);
  }
  // Only the stores that deliver to the visitor's country (L210); none: no stores button.
  const stores = shownStores(site, mode, c.country, c.lw).length;
  if (stores) tiles.push(html`<li><a class="jump" href="${c.href('/#stores')}"><span class="jump-label">${storesLabel(c)}</span><span class="jump-meta">${t('{0} stores', stores)}</span></a></li>`);
  tiles.push(html`<li><a class="jump" href="${c.href('/#guides')}"><span class="jump-label">${t('Gift guides')}</span><span class="jump-meta">${t('{0} gift guides', site.guides.length)}</span></a></li>`);
  for (const g of site.guides.slice(0, 4)) tiles.push(html`<li><a class="jump" href="${c.href(`/guides/${g.slug}/`)}"><span class="jump-label">${t(g.title)}</span></a></li>`);
  return html`<nav class="hero-jump" aria-label="${storesHere(c) ? c.tx('Stores and gift guides') : c.tx('Gift guides')}"><ul class="jumps">${tiles}</ul></nav>`;
}

// The Gear World app on Google Play (owner, 22 Nov 2026, lessons L218: "yes" to Mega Stores too): Google's own badge in
// the page's language (Albanian: English) after the hero buttons (the countdown and the stores stay on the first screen
// of a phone, L208; on a computer the row runs under both columns), only when the Worker set c.app (a visitor from a country
// of the app, not on an iPhone or iPad; the CSS also hides it on an iPad that asks for desktop pages). No close button:
// this site has no script and stores nothing on the device.
export function appRow(c) {
  return html`<div class="app-bar">
  <p class="app-text"><span class="app-name" translate="no">Gear World app</span> <span class="app-words">${c.t(APP_BAR_TEXT)}</span></p>
  <a class="app-badge" href="${appPlayUrl('megastores')}" target="_blank" rel="noopener" aria-label="${c.tx(APP_BADGE_LABEL)}"><img src="${asset(c.site, `app/google-play-${appBadgeFile(c.lang)}.png`)}" alt="" width="646" height="250" decoding="async"></a>
</div>`;
}

export function homePage(c, now = new Date(), storeData = {}) {
  const { site, t, tx, mode } = c;
  const all = [...site.guides, site.checks].filter(Boolean);
  const hubName = (site.hub && site.hub.name) || 'Gear World Hub';
  // The edition's country after the title (L214): «… · Ελλάδα».
  const where = c.edition ? ` · ${c.region}` : '';
  return shell(c, {
    title: `${storesHere(c) ? tx('Stores and gift guides') : tx('Gift guides')}${where} | ${site.name}`,
    description: !storesHere(c)
      ? tx('Short gift guides for Christmas and the winter. Every idea opens the matching category of a Gear World site, where each product shows the retailer that sells it, its price and where it delivers.')
      : withMarkets(mode)
      ? tx('Store pages with product photos from the Gear World sites, and Christmas gift ideas with searches on the big marketplaces. Compare models, sellers and prices before you choose.')
      : tx('Store pages with product photos from the Gear World sites, and Christmas gift ideas with the matching categories. Compare models, retailers and prices before you choose.'),
    path: '/',
    body: html`
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-text">
  <p class="eyebrow">${storesHere(c) ? t('Stores and gift guides') : t('Gift guides')}${where}</p>
  <h1>${withMarkets(mode) ? t('Gift ideas first. Then compare on the big marketplaces.') : t('Gift ideas first. Then compare.')}</h1>
  <p class="lede">${withMarkets(mode)
    ? t('Short gift guides for Christmas and the winter. Every idea opens a search on a big marketplace and the matching category of a Gear World site, so you can compare models, sellers and prices before you choose.')
    : t('Short gift guides for Christmas and the winter. Every idea opens the matching category of a Gear World site, where each product shows the retailer that sells it, its price and where it delivers.')}</p>
  </div>
  ${heroButtons(c, now)}
  ${c.app ? appRow(c) : ''}
</div></section>
<section class="wrap section">${disclosure(c)}</section>
${storesSection(c, storeData)}
${blackFridayBlock(c, now.getTime())}
<section class="wrap section" id="guides">
  <h2>${t('Gift guides')}</h2>
  <ul class="cards">${all.map(g => html`<li class="card"><h3><a href="${c.href(`/guides/${g.slug}/`)}">${t(g.title)}</a></h3><p>${t(g.teaser)}</p></li>`)}</ul>
</section>
<section class="wrap section">
  <h2>${t('How this site works')}</h2>
  <ul class="ticks">
    <li>${t('We write short lists of gift ideas. An idea is a kind of product, not a product we claim to have tested.')}</li>
    <li>${withMarkets(mode) ? t('Each idea opens a search on a marketplace and the matching category of a Gear World site.') : t('Each idea opens the matching category of a Gear World site.')} ${t('Those pages show the products, the seller, the price and delivery.')}</li>
    <li>${t('We do not sell anything, we do not track prices and we do not set cookies.')}</li>
  </ul>
</section>
<section class="wrap section">
  <h2>${t('The Gear World sites')}</h2>
  <p>${t('Independent product search and price-comparison sites. Each product shows the retailer that sells it and where that retailer delivers.')} ${t('{0} searches all of them at once.', html`<a href="${c.hub('/')}" translate="no">${hubName}</a>`)}</p>
  <ul class="gw-list">${GEAR_WORLDS.map(w => html`<li><a href="${c.gw(w.url)}" translate="no">${w.name}</a></li>`)}</ul>
</section>`
  });
}

// A text written for the UK (a UK plug, UK law, the UKCA mark) has its own line for every other country (introAbroad,
// whyAbroad in the config, L210).
const forCountry = (c, uk, abroad) => (c.country !== VIEW_BASE && abroad ? abroad : uk);

export function guidePage(c, guide) {
  const { site, t, tx, mode } = c;
  return shell(c, {
    title: `${tx(guide.title)} | ${site.name}`,
    description: `${tx(guide.teaser)} ${withMarkets(mode) ? tx('Ideas with searches on the big marketplaces and the Gear World sites.') : tx('Ideas with the matching categories of the Gear World sites.')}`,
    path: `/guides/${guide.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="${c.href('/#guides')}">${t('Gift guides')}</a></p>
  <h1>${t(guide.title)}</h1>
  <p class="lede">${t(forCountry(c, guide.intro, guide.introAbroad))}</p>
</div></section>
<section class="wrap section">${disclosure(c)}</section>
<section class="wrap section">
  <ol class="ideas">${guide.ideas.map(i => html`<li class="idea">
    <h2>${t(i.name)}</h2>
    <p>${t(forCountry(c, i.why, i.whyAbroad))}</p>
    ${ideaButtons(c, i)}
  </li>`)}</ol>
</section>
<section class="wrap section">
  <p><a href="${c.href(`/guides/${site.checks.slug}/`)}">${t(site.checks.title)}</a> · <a href="${c.href('/#guides')}">${t('All gift guides')}</a></p>
</section>`
  });
}

export function checksPage(c) {
  const { site, t, tx } = c;
  const k = site.checks;
  return shell(c, {
    title: `${tx(k.title)} | ${site.name}`,
    description: `${tx(k.teaser)} ${tx('Seven checks that take a few minutes.')}`,
    path: `/guides/${k.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="${c.href('/#guides')}">${t('Gift guides')}</a></p>
  <h1>${t(k.title)}</h1>
  <p class="lede">${t(k.intro)}</p>
</div></section>
<section class="wrap section prose">
  <ol class="steps">${k.steps.map(s => html`<li><h2>${t(s.name)}</h2><p>${t(s.text)}</p></li>`)}</ol>
</section>
<section class="wrap section">${disclosure(c)}<p><a href="${c.href('/#guides')}">${t('All gift guides')}</a></p></section>`
  });
}

// Legal pages (lessons L17), translated like the sites' ones since L176: whole sentences, the names and addresses in
// translate="no", and in every other language the note that the English text applies.
// They describe this site only: no forms, no accounts, no cookies of its own.
// NOTE: a starting point that needs review by a qualified adviser (T31), like the other Gear World sites.
const item = (c, label, text) => html`<li><strong>${c.t(label)}</strong> ${c.t(text)}</li>`;
// The direct stores the site shows (L226), as "Public, Sephora, …" (names never translated), or '' without them.
const directNames = c => {
  const list = directStores(c.site, ANY_COUNTRY, c.lw);
  return list.length ? html`${list.map((s, i) => html`${i ? ', ' : ''}${keep(s.name)}`)}` : '';
};
const LEGAL = {
  '/about/': c => ({
    title: 'About',
    description: c.tx('Who runs {0} and how to contact us.', c.site.name),
    content: html`
<p>${c.t('{0} ({1}) is a small site of gift guides.', keep(c.site.name), keep(c.site.domain))} ${withMarkets(c.mode)
    ? c.t('Each idea links to a search on a big marketplace and to the matching category of one of the Gear World sites, so you can compare models, sellers and prices yourself.')
    : c.t('Each idea links to the matching category of one of the Gear World sites, so you can compare models, sellers and prices yourself.')}</p>
<p>${c.t('It is part of the Gear World sites, a group of independent product search and price-comparison sites.')}</p>
<p>${c.t('Run by {0}. Contact: {1}.', operator(c.site, c.t), mail(c.site))}</p>
<h2>${c.t('What we do not do')}</h2>
<ul>
<li>${c.t('We do not sell anything and we do not take payments.')}</li>
<li>${c.t('We do not track prices or send price alerts.')}</li>
<li>${c.t('We do not show prices: they are on the page each button opens, where they are up to date.')}</li>
${directNames(c)
    ? html`<li>${c.t('The pages of the other stores show product photos, names and brands from the Gear World sites, each with its Gear World product page.')}</li>
<li>${c.t('The pages of {0} show gift ideas of the store itself, each with a Linkwise link to its page on the store’s own site.', directNames(c))}</li>`
    : html`<li>${c.t('The store pages show product photos, names and brands from the Gear World sites, each with its Gear World product page.')}</li>`}
</ul>
${c.mode === 'on' ? html`<p>${amazonStatement(c)}</p>` : ''}`
  }),

  '/how-we-make-money/': c => ({
    title: 'How we make money',
    description: c.tx('How {0} earns money through affiliate links.', c.site.name),
    content: html`
<p>${c.t('{0} is free to use. We earn money through affiliate links.', keep(c.site.name))}</p>
<h2>${c.t('What an affiliate link is')}</h2>
${withMarkets(c.mode)
  ? html`<p>${c.t('Some buttons on this site are affiliate links to marketplaces. If you follow one and then buy something, the marketplace may pay us a commission. You pay the same price as you would if you went to the marketplace directly.')}</p>`
  : directNames(c)
    ? html`<p>${c.t('The buttons of the gift guides open categories of the Gear World sites. Those sites link to retailers through affiliate networks and may earn a commission; you pay the same price.')}</p>`
    : html`<p>${c.t('At the moment this site has no affiliate links of its own: its buttons open categories of the Gear World sites. Those sites link to retailers through affiliate networks and may earn a commission; you pay the same price.')}</p>`}
${c.mode === 'on' ? html`<h2 translate="no">Amazon</h2><p>${amazonStatement(c)}</p><p>${c.t(AMAZON_TRADEMARK)}</p>` : ''}
${directNames(c) ? html`<h2 translate="no">Linkwise</h2><p>${c.t('The gift ideas on the pages of {0} are our own affiliate links through Linkwise, an affiliate network. If you buy after following one, the store may pay us a commission. You pay the same price as you would if you went to the store directly.', directNames(c))}</p>` : ''}
<h2>${c.t('The Gear World sites')}</h2>
<p>${directNames(c)
    ? c.t('The "Browse on" buttons open a category of a Gear World site, and the "See it on" buttons of the other store pages open a product page of a Gear World site. Those sites have their own affiliate links and explain them on their own "How we make money" page.')
    : c.t('The "Browse on" buttons open a category of a Gear World site, and the "See it on" buttons of the store pages open a product page of a Gear World site. Those sites have their own affiliate links and explain them on their own "How we make money" page.')}</p>
<h2>${c.t('How this affects what you see')}</h2>
<p>${c.t('The ideas are not ranked by commission, and nobody pays to be in a guide. We do not show prices: the page each button opens has the current price.')}</p>`
  }),

  '/privacy/': c => ({
    title: 'Privacy policy',
    description: c.tx('How {0} ({1}) handles personal data.', c.site.name, c.site.domain),
    content: html`
<p class="updated">${c.t('Last updated: {0}', c.longDate(LEGAL_UPDATED))}</p>
<p>${c.t('This policy explains what personal data {0} ({1}) uses, why, and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018) and, if you are in the European Union or the European Economic Area, under the EU General Data Protection Regulation (GDPR).', keep(c.site.name), keep(c.site.domain))}</p>
<h2>${c.t('Who is responsible')}</h2>
<p>${c.t('The data controller is {0}. Contact: {1}.', operator(c.site, c.t), mail(c.site))}</p>
<h2>${c.t('What we collect')}</h2>
<ul>
${item(c, 'Visiting the site.', 'The site has no forms, no accounts, no analytics and no advertising tags. We do not record your visit ourselves. Our hosting provider, Cloudflare, keeps technical records of each request (such as the time, the page and the IP address) for up to 7 days, for security and to fix errors.')}
${item(c, 'Language.', 'The page opens in the language of the country your visit comes from, as our hosting provider reports it, or of your browser, unless you choose another one. A language you choose stays in the address of the page, not on your device. We do not keep either.')}
${item(c, 'Email.', 'If you email us, we keep your message and email address to reply (legitimate interests) and delete them when they are no longer needed.')}
${item(c, 'Hosting.', 'The site is hosted by Cloudflare, which processes technical data such as IP addresses to deliver and protect the site.')}
${item(c, 'Product photos.', 'The photos on the store pages load from the retailers\' image servers, which receive technical data such as your IP address to send the image. We tell them nothing about the page you are on.')}
</ul>
<h2>${c.t('When you follow a link')}</h2>
<p>${c.t('When you follow a link to another site, that site\'s own privacy policy applies. The site you open may set its own cookies to know where you came from, so it can pay a commission.')}${directNames(c) ? html` ${c.t('The gift ideas on the pages of {0} first pass through Linkwise (go.linkwi.se), which records the click and may set a cookie so the store can pay the commission.', directNames(c))}` : ''}</p>
<h2>${c.t('Sharing and transfers')}</h2>
<p>${c.t('We do not sell personal data. Our service provider (Cloudflare) may process data outside the UK and the European Economic Area with appropriate safeguards.')}</p>
<h2>${c.t('Your rights')}</h2>
<p>${c.t('You can ask for access to, correction or deletion of your data, ask us to restrict or stop using it, object, and ask for a copy. Email {0}.', mail(c.site))} ${c.t('You can complain to the Information Commissioner\'s Office at {0}.', html`<a href="https://ico.org.uk/" translate="no">ico.org.uk</a>`)} ${c.t('If you are in the European Union or the European Economic Area, you can also complain to the data protection authority of the country where you live.')}</p>`
  }),

  '/cookies/': c => ({
    title: 'Cookies',
    description: c.tx('Which cookies {0} uses.', c.site.domain),
    content: html`
<p class="updated">${c.t('Last updated: {0}', c.longDate(LEGAL_UPDATED))}</p>
<p>${c.t('{0} sets no advertising, analytics or tracking cookies and stores nothing on your device, so there is no cookie banner.', keep(c.site.domain))}</p>
<h2>${c.t('Strictly necessary')}</h2>
<p>${c.t('Our hosting provider Cloudflare may set short-lived security cookies to protect the site from bots. They are needed for the site to work safely and do not track you across sites.')}</p>
<h2>${c.t('Other sites')}</h2>
<p>${c.t('When you follow a link to another site, that site may set its own cookies, which its own cookies page explains.')}</p>`
  }),

  '/terms/': c => ({
    title: 'Terms of use',
    description: c.tx('The terms for using {0}.', c.site.domain),
    content: html`
<p class="updated">${c.t('Last updated: {0}', c.longDate(LEGAL_UPDATED))}</p>
<p>${c.t('These terms apply when you use {0}, operated by {1}. By using the site you accept them.', keep(c.site.domain), operator(c.site, c.t))}</p>
<h2>${c.t('What the site does')}</h2>
<p>${c.t('The site publishes gift ideas with links to other sites. It does not sell anything. Any purchase is between you and the seller, under the terms of the seller and of the site where you buy.')}</p>
<h2>${c.t('The ideas')}</h2>
<p>${c.t('The ideas are general suggestions, not advice about a particular product. Check the product page, the age and safety marks, the seller and the returns policy before you choose.')}</p>
<h2>${c.t('Links to other websites')}</h2>
<p>${c.t('We are not responsible for the content, prices or availability on websites we link to.')}</p>
<h2>${c.t('Liability')}</h2>
<p>${c.t('Nothing in these terms limits liability that cannot be limited by law. Otherwise we are not liable for losses arising from your use of this site.')}</p>
<h2>${c.t('Law')}</h2>
<p>${c.t('These terms are governed by the law of England and Wales. If you are a consumer living in the European Union, you also keep the protection of the mandatory consumer laws of the country where you live.')}</p>
<h2>${c.t('Contact')}</h2>
<p>${mail(c.site)}</p>`
  })
};

export function legalPaths() {
  return Object.keys(LEGAL);
}

export function legalPage(c, path) {
  const make = LEGAL[path];
  if (!make) return null;
  const p = make(c);
  return shell(c, {
    title: `${c.tx(p.title)} | ${c.site.name}`,
    description: p.description,
    path,
    body: html`
<section class="wrap section prose">
  <h1>${c.t(p.title)}</h1>
  ${c.lang === BASE_LANG ? '' : html`<p class="lang-note">${c.t('This is a translation. If it differs from the English text, the English text applies.')}</p>`}
  ${p.content}
</section>`
  });
}

function notFoundPage(c, path) {
  return shell(c, {
    title: `${c.tx('Page not found')} | ${c.site.name}`,
    description: c.tx('This page does not exist.'),
    path,
    robots: 'noindex',
    body: html`
<section class="wrap section prose">
  <h1>${c.t('Page not found')}</h1>
  <p>${c.t('This page does not exist.')} <a href="${c.href('/#guides')}">${c.t('See all gift guides')}</a>.</p>
</section>`
  });
}

// Every page address, for the sitemap (without ?lang=: English, and the country editions in their own language, L214).
// The Amazon page only when the Amazon links are live.
export function pagePaths(site, mode = 'off', lw = '') {
  // Only the stores of the UK page, the one Google reads (L195, L210): a store listed for other countries only (the Greek
  // ones) would show Google its "not listed for your country" page.
  const stores = (site.stores || []).filter(s => (s.amazon ? mode === 'on' : Array.isArray(s.sites) && s.sites.length && deliversHere(s, VIEW_BASE) && storeListed(site, s))).map(s => `/stores/${s.slug}/`);
  // Each edition's home page and store pages (L214).
  const editions = EDITIONS.flatMap(e => [`${e.prefix}/`, ...editionStores(site, e, lw).map(s => `${e.prefix}/stores/${s.slug}/`)]);
  return ['/', ...stores, ...editions, ...site.guides.map(g => `/guides/${g.slug}/`), `/guides/${site.checks.slug}/`, ...Object.keys(LEGAL)];
}

// deps (tests): fetch, cache (match/put, like caches.default), now (a function giving ms), timeoutMs, and photoFetch /
// photoTimeoutMs for the photo check (L211).
export function createGuidesWorker(site, deps = {}) {
  const guides = new Map(site.guides.map(g => [g.slug, g]));
  // A hidden store (L215) has no page at all: its address is a 404, as if it were not on the site.
  const stores = new Map((site.stores || []).filter(s => storeListed(site, s)).map(s => [s.slug, s]));
  const runtime = () => ({
    fetch: deps.fetch,
    cache: deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' && caches.default ? caches.default : null),
    timeoutMs: deps.timeoutMs,
    // Photos are checked by the live Worker (no deps at all: the global fetch), and by a test that gives photoFetch (L211).
    photoFetch: deps.photoFetch !== undefined ? deps.photoFetch : (deps.fetch ? null : (...a) => fetch(...a)),
    photoTimeoutMs: deps.photoTimeoutMs,
    photoLimit: photoLimiter()
  });
  const nowMs = () => (typeof deps.now === 'function' ? deps.now() : Date.now());
  // Every store's products for the home page cards (from the cache, or read now); never breaks the page. Only the
  // stores the visitor's country sees (L210): the others are not even read.
  async function allStoreData(ctx, country = VIEW_BASE, lw = '') {
    const list = awinStores(site).filter(s => deliversHere(s, country));
    // One photo limit for the whole page; the home page never waits for the photo check (L211).
    const rt = { ...runtime(), photoLater: true };
    const r = await Promise.allSettled(list.map(s => storeProducts(site, s, rt, ctx)));
    // The direct stores (L226) after them and with their own photo limit, so their checks never take the places of
    // the other stores' photos (second review 24/11/2026: those would come back late and be read again sooner).
    const direct = directStores(site, country, lw);
    const drt = { ...rt, photoLimit: photoLimiter(2) };
    const d = await Promise.allSettled(direct.map(s => directPhotos(site, s, drt, ctx, { later: true })));
    const out = {};
    list.forEach((s, i) => { out[s.slug] = r[i].status === 'fulfilled' ? r[i].value.products : []; });
    // A direct store (L226): the photos of its card that did not open.
    direct.forEach((s, i) => { out[s.slug] = d[i].status === 'fulfilled' ? [...d[i].value] : []; });
    return out;
  }
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      if (url.hostname === `www.${site.domain}`) {
        url.hostname = site.domain;
        return redirect(url.toString(), 301);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return textResponse('Method not allowed', { status: 405, cache: 'none' });
      // The test Worker (*.workers.dev) is never indexed.
      const preview = url.hostname !== site.domain && !['localhost', '127.0.0.1'].includes(url.hostname);
      // The Worker's Amazon setting (the sitemap lists the Amazon page by it) and what this visitor's country sees:
      // Amazon UK only where it delivers (L210).
      const baseMode = amazonMode(env);
      const country = viewCountry(request);
      const mode = viewMode(site, baseMode, country);
      const choice = pickLanguage(site, request, url);
      // Our Linkwise code (the Worker secret, L226): without it the direct stores are on no page.
      const lw = linkwiseCode(env);
      const ctxFor = path => makeContext(site, choice.lang, choice.chosen, mode, path, country, null, lw);
      const page = (body, status = 200, lang = choice.lang) => {
        // Every page now depends on the visitor's country (its stores, codes and Amazon buttons, L210), and before
        // that a language picked from the country or the browser did too (L175): a page is never kept by a shared
        // cache for other visitors (private), whatever its language.
        const res = htmlResponse(body, { status, method: request.method, cache: 'private' });
        res.headers.set('Content-Language', lang);
        if (preview) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      };
      // Which code version is live, for the deploy tool's check (lessons L156).
      if (url.pathname === '/api/version') return versionResponse(env);
      if (url.pathname === '/robots.txt') {
        return textResponse(preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: https://${site.domain}/sitemap.xml\n`, { method: request.method });
      }
      if (url.pathname === '/sitemap.xml') {
        const urls = pagePaths(site, baseMode, lw).map(p => `<url><loc>https://${site.domain}${p}</loc></url>`).join('\n');
        return textResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { type: 'application/xml', method: request.method });
      }
      // A country edition (L214): /gr/ and /gr/stores/<store>/, in the edition's language for everyone (Google too) unless
      // the visitor picked another (?lang=), and always for the edition's country.
      const ed = editionFor(url.pathname);
      if (ed) {
        if (url.pathname === ed.prefix) { url.pathname = `${ed.prefix}/`; return redirect(url.toString(), 301); }
        // Google's crawlers without "bot" in their name (Google-InspectionTool, GoogleOther) read the edition's language too.
        const crawler = readsEnglish(request) || GOOGLE_CRAWLER.test(request.headers.get('user-agent') || '');
        const asked = crawler ? '' : languageCode(site, url.searchParams.get('lang'));
        const edLang = asked || ed.lang;
        const edCtx = p => makeContext(site, edLang, Boolean(asked), viewMode(site, baseMode, ed.country), p, ed.country, ed, lw);
        const rest = url.pathname.slice(ed.prefix.length);
        const edKeep = to => (asked ? edCtx('/').href(to) : edCtx('/').at(to));
        if (rest === '/stores' || rest === '/stores/') return redirect(`https://${site.domain}${edKeep('/#stores')}`, 302);
        if (rest === '/guides' || rest === '/guides/') return redirect(`https://${site.domain}${edKeep('/#guides')}`, 302);
        if (rest === '/' || rest === '/index.html') {
          // The app row (L218) as on the home page: this visitor's own country and browser.
          const edHome = edCtx('/');
          edHome.app = appBarWanted(country, request.headers.get('user-agent'));
          return page(homePage(edHome, new Date(nowMs()), await allStoreData(ctx, ed.country, lw)), 200, edLang);
        }
        const em = rest.match(/^\/stores\/([a-z0-9-]+)\/?$/);
        const edStore = em && editionStores(site, ed, lw).find(s => s.slug === em[1]);
        if (edStore) {
          if (!rest.endsWith('/')) { url.pathname = `${url.pathname}/`; return redirect(url.toString(), 301); }
          // A direct store (L226): its own sets and ideas, nothing read from a Gear World database.
          if (isDirectStore(edStore)) {
            let broken = new Set();
            try { broken = await directPhotos(site, edStore, runtime(), ctx); } catch { broken = new Set(); }
            return page(directStorePage(edCtx(`/stores/${edStore.slug}/`), edStore, broken), 200, edLang);
          }
          // The store's list first, then its showcase: never both at once on the same site's database (L221).
          const rt = runtime();
          let products = [];
          try { products = (await storeProducts(site, edStore, rt, ctx)).products; } catch { products = []; }
          let showcase = null;
          try { showcase = await storeShowcase(site, edStore, rt, ctx); } catch { showcase = null; }
          return page(storePage(edCtx(`/stores/${edStore.slug}/`), edStore, products, nowMs(), showcase), 200, edLang);
        }
        return page(notFoundPage(edCtx(url.pathname), url.pathname), 404, edLang);
      }
      // A redirect keeps the chosen language (?lang= stays in the address).
      const keepLang = to => (choice.chosen ? makeContext(site, choice.lang, true).href(to) : to);
      if (url.pathname === '/' || url.pathname === '/index.html') {
        // The app row (L218): this visitor's country and browser; the page is private already.
        const home = ctxFor('/');
        home.app = appBarWanted(country, request.headers.get('user-agent'));
        return page(homePage(home, new Date(nowMs()), await allStoreData(ctx, country, lw)));
      }
      if (url.pathname === '/guides' || url.pathname === '/guides/') return redirect(`https://${site.domain}${keepLang('/#guides')}`, 302);
      if (url.pathname === '/stores' || url.pathname === '/stores/') return redirect(`https://${site.domain}${keepLang('/#stores')}`, 302);
      const sm = url.pathname.match(/^\/stores\/([a-z0-9-]+)\/?$/);
      if (sm && stores.has(sm[1])) {
        const store = stores.get(sm[1]);
        // Amazon only with Amazon links (on or preview); a direct store only with our Linkwise code (L226); otherwise the
        // page does not exist.
        const shown = store.amazon ? withMarkets(mode)
          : isDirectStore(store) ? Boolean(lw) : Array.isArray(store.sites) && store.sites.length > 0;
        if (shown && !url.pathname.endsWith('/')) { url.pathname = `${url.pathname}/`; return redirect(url.toString(), 301); }
        if (shown && store.amazon) return page(amazonStorePage(ctxFor(`/stores/${store.slug}/`), store));
        // A store not listed for the visitor's country (L210): the page says so, with no products or codes.
        if (shown && !deliversHere(store, country)) return page(storeElsewherePage(ctxFor(`/stores/${store.slug}/`), store));
        if (shown && isDirectStore(store)) {
          let broken = new Set();
          try { broken = await directPhotos(site, store, runtime(), ctx); } catch { broken = new Set(); }
          return page(directStorePage(ctxFor(`/stores/${store.slug}/`), store, broken));
        }
        if (shown) {
          // The store's list first, then its showcase: never both at once on the same site's database (L221).
          const rt = runtime();
          let products = [];
          try { products = (await storeProducts(site, store, rt, ctx)).products; } catch { products = []; }
          let showcase = null;
          try { showcase = await storeShowcase(site, store, rt, ctx); } catch { showcase = null; }
          return page(storePage(ctxFor(`/stores/${store.slug}/`), store, products, nowMs(), showcase));
        }
        // The Amazon page with Amazon links off: 404 without the word Amazon (not even in the canonical address).
        return page(notFoundPage(ctxFor('/stores/'), '/stores/'), 404);
      }
      const gm = url.pathname.match(/^\/guides\/([a-z0-9-]+)\/?$/);
      if (gm) {
        const slug = gm[1];
        const known = guides.has(slug) || slug === site.checks.slug;
        if (known && !url.pathname.endsWith('/')) { url.pathname = `${url.pathname}/`; return redirect(url.toString(), 301); }
        if (guides.has(slug)) return page(guidePage(ctxFor(`/guides/${slug}/`), guides.get(slug)));
        if (slug === site.checks.slug) return page(checksPage(ctxFor(`/guides/${slug}/`)));
      }
      // Legal pages; the address without the final slash goes to the one with it.
      if (!url.pathname.endsWith('/') && LEGAL[`${url.pathname}/`]) {
        url.pathname = `${url.pathname}/`;
        return redirect(url.toString(), 301);
      }
      if (LEGAL[url.pathname]) return page(legalPage(ctxFor(url.pathname), url.pathname));
      if (env && env.ASSETS && url.pathname.startsWith('/assets/')) return env.ASSETS.fetch(request);
      return page(notFoundPage(ctxFor(url.pathname), url.pathname), 404);
    }
  };
}
