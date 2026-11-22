// Mega Stores Gear World in every language, the Hub link and Black Friday (owner, 18 Nov 2026 23:00 and 23:30: "all the
// languages, and a link to the Hub like every page, and Black Friday", "a countdown until Black Friday, and early Black
// Friday"; lessons L24, L103, L107, L174, L175, L176, L186, L188, L191, L195). Fake fetch, fixed days, never the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import liveSite from '../../sites/ogw/site.config.js';
import {
  AMAZON_STATEMENT, BASE_LANG, HUB_LANGS, I18N_MISSING, createGuidesWorker, legalPaths, awinStores, languageCode,
  countryLanguage as ogwCountryLanguage, readsEnglish as ogwReadsEnglish, QA_BOT as OGW_QA_BOT, OTHER_CRAWLER as OGW_CRAWLER, GOOGLE_CRAWLER as OGW_GOOGLE,
  earlyBlackFriday, blackFridayParts, storeCodes, shownStores
} from '../../src/marketplace-guides.js';
import { countryLanguage, readsEnglish, QA_BOT, OTHER_CRAWLER, GOOGLE_CRAWLER } from '../../src/engine.js';
import { translatableTexts } from './i18n-keys.mjs';
import { GEAR_WORLDS } from '../../promos/network.js';
// The Linkwise stores are hidden until Linkwise approves this site (L215, tests/worker/ogw-hidden.test.mjs): these tests
// check the per-country rules as they will be after the approval (hiddenNetworks empty).
const site = { ...liveSite, hiddenNetworks: [] };

const LANGS = ['el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'pl-PL', 'sq-AL', 'ro-RO', 'ru-RU'];
const DICTS = Object.fromEntries(LANGS.map(l => [l, JSON.parse(readFileSync(`sites/ogw/i18n/${l}.json`, 'utf8'))]));
const at = day => Date.parse(`${day}T12:00:00Z`);
const NOW = at('2026-11-19');
const LIVE = 'https://megastoresgearworld.com';
const ON = { AMAZON_LINKS: 'on' };
const OFF = {};
const PRE = { AMAZON_LINKS: 'preview' };
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const QA = 'GearWorldQA-bot/1.0 (+read-only check)';

function fakeFetch() {
  return async input => {
    const u = new URL(String(input));
    const host = u.hostname;
    const tag = host.split('.')[0];
    const r = u.searchParams.get('retailer');
    const rows = [1, 2, 3].map(n => ({ product_name: `${r} ${tag} item ${n}`, brand: 'Acme', retailer: r, price: 12.34, stock_status: 'in_stock',
      image_url: `https://img.example/${tag}/${n}.jpg`, delivers_to: ['GB'], product_url: `https://${host}/product/${tag}-${n}/`, affiliate_url: `https://${host}/out/${n}` }));
    return new Response(JSON.stringify({ ok: true, products: rows }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}
const workerAt = (day, s = site) => createGuidesWorker(s, { fetch: fakeFetch(), cache: null, now: () => at(day) });
const W = workerAt('2026-11-19');
async function get(path, env = ON, { ua = BROWSER, headers = {}, cf = null, worker = W } = {}) {
  const req = new Request(LIVE + path, { headers: { 'user-agent': ua, ...headers } });
  if (cf) Object.defineProperty(req, 'cf', { value: cf });
  const r = await worker.fetch(req, env);
  return { r, text: await r.text() };
}
const STORE_PAGES = awinStores(site).map(s => `/stores/${s.slug}/`);
const PAGES = ['/', ...site.guides.map(g => `/guides/${g.slug}/`), `/guides/${site.checks.slug}/`, ...legalPaths(), ...STORE_PAGES];
const withLang = (p, l) => `${p}${p.includes('?') ? '&' : '?'}lang=${l}`;
const withoutOffers = text => text.replace(/<p class="promo-offer">[\s\S]*?<\/p>/g, '');
const visible = text => withoutOffers(text).replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ');
// The retailer's own code wording (L186, L188): the only lines that may hold money or a discount word.
const OFFER_KEYS = new Set(['{0} off when you spend {1}', '{0} off your order', '{0} off when you spend {1}, on selected products',
  'For {0} products, when you spend {1} or more on {0}', 'On your order, no minimum spend']);
// Texts that are names or the same word in a language on purpose.
const SAME = new Set(['Black Friday', 'Black Friday {0}', 'Black Friday: {0} · Cyber Monday: {1}', 'Einhell', 'Code', 'Cookies', 'Contact',
  'Hosting.', 'Email.', 'Smartwatch', 'Webcam', 'Fitness tracker', 'Slow cooker', 'Dash cam', 'E-reader', 'Extra controller']);
// A key the current data does not use but a code without a minimum spend would (src/pages/offers.js has it too).
// Since L208 (owner, 21 Nov 2026) the hero shows the Black Friday countdown as its first button; the Black Friday lines of
// countdown() stay for the tools (English) and for the day the line comes back.
const RESERVED = new Set(['{0} off your order', 'Black Friday: {0} · {1} days to go', 'Black Friday: {0} · 1 day to go', 'Black Friday and Cyber Monday: {0} to {1}']);
// Names that stay as they are in every language (a "-" of German or Dutch compounds counts as a space).
const NAMES = ['Gear World', 'Amazon', 'amazon.co.uk', 'Black Friday', 'Cyber Monday', 'PlayStation', 'Xbox', 'Switch', 'iPhone', 'Android',
  'UKCA', 'CE', 'IPX5', 'Cloudflare', "Information Commissioner's Office", 'Bluetooth', 'LED', 'mAh', 'dB'];
// L103, L107: no deals, sale, save, discount, lowest price, partner, trusted, official or cart words of our own, in any
// language (the sites' list of L103, and the words of a discount or a saving).
const SHOP_LANGS = /Partnerhändler|Affiliate-Partnern|vertrauenswürdig|Nach Kategorie einkaufen|unsere Händler|συνεργαζόμεν|στους συνεργάτες|αξιόπιστ|Αγορές ανά κατηγορία|στα καταστήματά μας|tiendas? asociadas?|de confianza|Compra por categoría|nuestras tiendas|marchands? partenaires?|partenaires affiliés|de confiance|Acheter par catégorie|nos marchands|negozi? partner|partner affiliati|affidabil|Acquista per categoria|nei nostri negozi|partnerwinkels?|affiliatepartners|betrouwba|Winkelen per categorie|onze winkels|lojas? parceiras?|de confiança|Compre por categoria|as nossas lojas|magazine? partener|partenerilor|de încredere|Cumpără pe categorii|magazinele noastre|магазин(ов)?-партн|своим партн|надёжн|Покупки по категориям|наши магазины|dyqane? partner|partnerëve|besueshm|Bli sipas kategorisë|dyqanet tona|partnersk|partnerz|partnerów|zaufan|Kupuj według kategorii|nasz(e|ych|ymi|ym) sklep/;
const BAD = {
  'el-GR': /προσφορ|έκπτωσ|εκπτώσ|εξοικονομ|γλιτώ|φθην|χαμηλότερη τιμή|επίσημ|καλάθι/i,
  'de-DE': /Angebot|Rabatt|\bSale\b|sparen|Schnäppchen|günstigst|niedrigste|Partner|offiziell|Warenkorb/i,
  'fr-FR': /\boffres?\b|promo|réduction|remise|soldes|économis|bon plan|partenaire|officiel|panier|boutique/i,
  'it-IT': /offert|scont|saldi|risparmi|partner|ufficial|carrello/i,
  'es-ES': /\bofertas?\b|descuento|rebaja|ahorr|asociad|oficial|carrito/i,
  'pt-PT': /\bofertas?\b|promoç|desconto|saldos|poupa|econom|parceir|oficial|carrinho/i,
  'nl-NL': /aanbieding|korting|uitverkoop|bespa|partner|officieel|winkelwagen/i,
  'pl-PL': /promocj|ofert|rabat|zniżk|wyprzeda|oszczęd|obniżk|przecen|oficjaln|koszyk/i,
  'sq-AL': /ofert|zbritje|ulje|kursen|partner|zyrtar|shport/i,
  'ro-RO': /ofert|reducere|reduceri|promoți|economis|partener|oficial|coș\b/i,
  'ru-RU': /скидк|распродаж|акци[яию]|предложени|сэконом|выгод|официальн|корзин/i
};
const EN_BAD = /\bshop\b|\bshopping\b|\bcart\b|\bbasket\b|buy now|\bofficial\b|\bpartners?\b|\btrusted\b|free delivery|\bdeals?\b|\bsale\b|\bsave\b|\d\s?%|lowest price|best price|\bdiscounts?\b|\boffers?\b|\bcheapest\b/i;
const placeholders = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// ---------------------------------------------------------------- the dictionaries

test('L195: 11 dictionaries, the same texts in each, the sites\' layout (code-point order, one space, a new line)', () => {
  assert.deepEqual(readdirSync('sites/ogw/i18n').sort(), LANGS.map(l => `${l}.json`).sort());
  assert.deepEqual(site.languages.map(l => l.code), ['en-GB', 'el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'pl-PL', 'sq-AL', 'ro-RO', 'ru-RU'],
    'the codes and the menu order of the 13 sites');
  const tgw = (async () => (await import('../../sites/tgw/site.config.js')).default)();
  return tgw.then(t => {
    assert.deepEqual(site.languages, t.languages, 'the same menu as Technology Gear World');
    const keys = Object.keys(DICTS['el-GR']).sort();
    for (const l of LANGS) {
      const raw = readFileSync(`sites/ogw/i18n/${l}.json`, 'utf8');
      const d = JSON.parse(raw);
      assert.deepEqual(Object.keys(d).sort(), keys, `${l}: the same texts as el-GR`);
      const sorted = {};
      for (const k of Object.keys(d).sort()) sorted[k] = d[k];
      assert.equal(raw, JSON.stringify(sorted, null, 1) + '\n', `${l}: sorted, one space, a new line at the end`);
      for (const [k, v] of Object.entries(d)) {
        assert.ok(typeof v === 'string' && v.trim() && v === v.trim(), `${l}: "${k}" has a text`);
        assert.equal(placeholders(v), placeholders(k), `${l}: the same {0} in "${k}"`);
        if (!SAME.has(k)) assert.notEqual(v, k, `${l}: "${k}" is translated`);
        for (const n of NAMES) if (new RegExp(`(^|[^A-Za-z])${n.replace(/[.']/g, '\\$&')}([^A-Za-z]|$)`).test(k)) {
          assert.ok(v.replace(/-/g, ' ').includes(n), `${l}: "${n}" stays in "${k}" => "${v}"`);
        }
        if (OFFER_KEYS.has(k)) continue;
        assert.ok(!SHOP_LANGS.test(v), `${l}: no partner or shop wording in "${v}" (L103)`);
        const bad = v.match(BAD[l]);
        assert.ok(!bad, `${l}: "${bad && bad[0]}" in "${v}" (L103, L107)`);
      }
      assert.ok(Object.keys(d).length >= 380, `${l}: ${Object.keys(d).length} texts`);
    }
  });
});

test('L195: every text the pages use is in every dictionary, and every dictionary text is used (all pages, modes and days)', async () => {
  const empty = { ...site, dictionaries: { 'el-GR': {} } };
  const days = ['2026-11-19', '2026-11-22', '2026-11-26', '2026-11-27', '2026-11-30', '2026-12-01', '2026-12-24', '2026-12-25'];
  const paths = ['/', '/stores/amazon/', '/nope/', ...PAGES];
  const failing = async () => { throw new Error('down'); };
  const renderAll = async (s, langs) => {
    for (const day of days) {
      for (const fetch of [fakeFetch(), failing]) {
        const w = createGuidesWorker(s, { fetch, cache: null, now: () => at(day) });
        // The UK page, Greece (its own stores) and a country no store is listed for (L210: their own lines).
        for (const cc of ['GB', 'GR', 'US']) {
          for (const env of [ON, OFF, PRE]) for (const lang of langs) for (const p of paths) {
            const req = new Request(LIVE + withLang(p, lang));
            Object.defineProperty(req, 'cf', { value: { country: cc } });
            await (await w.fetch(req, env)).text();
          }
        }
      }
    }
  };
  // An empty dictionary gives every text the pages ask for.
  I18N_MISSING.clear();
  await renderAll(empty, ['el-GR']);
  const used = new Set([...I18N_MISSING].map(x => x.split('\t')[1]));
  assert.ok(used.size >= 370, `${used.size} texts`);
  // The real dictionaries have every one of them, in every language.
  I18N_MISSING.clear();
  await renderAll(site, LANGS);
  assert.deepEqual([...I18N_MISSING], [], 'no text without its translation');
  for (const k of Object.keys(DICTS['el-GR'])) assert.ok(used.has(k) || RESERVED.has(k), `unused dictionary text: "${k}"`);
  for (const k of used) for (const l of LANGS) assert.ok(Object.prototype.hasOwnProperty.call(DICTS[l], k), `${l}: "${k}"`);
});

// ---------------------------------------------------------------- choosing the language

test('L175, L195: the same rules as the 13 sites: crawlers read English, the QA check may ask, each country its language', () => {
  assert.equal(OGW_QA_BOT.source, QA_BOT.source, 'QA bot: the engine\'s rule');
  assert.equal(OGW_CRAWLER.source, OTHER_CRAWLER.source, 'crawlers: the engine\'s rule');
  for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'facebookexternalhit/1.1', 'Mozilla/5.0 (compatible; bingbot/2.0)', BROWSER, QA, 'Cubot X30']) {
    const r = new Request(LIVE, { headers: { 'user-agent': ua } });
    assert.equal(ogwReadsEnglish(r), readsEnglish(r), ua);
  }
  const s13 = { languages: site.languages };
  for (const [cc, al] of [['GR', ''], ['CY', ''], ['DE', ''], ['AT', ''], ['PL', ''], ['BR', ''], ['RU', ''], ['AL', ''], ['XK', ''], ['MD', ''], ['GB', ''], ['US', ''],
    ['BE', 'fr-BE,fr;q=0.9'], ['BE', 'en-GB,nl;q=0.8'], ['CH', 'it-CH'], ['CA', 'fr-CA'], ['CA', 'en-CA'], ['LU', 'de']]) {
    assert.equal(ogwCountryLanguage(site, cc, al), countryLanguage(s13, cc, al), `${cc} ${al}`);
  }
  assert.equal(languageCode(site, 'el'), 'el-GR', '?lang=el, the short form');
  assert.equal(languageCode(site, 'EL-gr'), 'el-GR');
  assert.equal(languageCode(site, 'pl'), 'pl-PL');
  assert.equal(languageCode(site, 'xx'), '', 'an unknown language');
  assert.equal(languageCode(site, 'el-GR"><script>'), '');
});

test('L195: ?lang= in every language: the page in that language, the English canonical, every link of the site keeps it', async () => {
  const GIFT = { 'el-GR': 'Οδηγοί δώρων', 'de-DE': 'Geschenkratgeber', 'fr-FR': 'Guides cadeaux', 'it-IT': 'Guide regalo', 'es-ES': 'Guías de regalos',
    'pt-PT': 'Guias de presentes', 'nl-NL': 'Cadeaugidsen', 'pl-PL': 'Poradniki prezentowe', 'sq-AL': 'Udhëzues dhuratash', 'ro-RO': 'Ghiduri de cadouri', 'ru-RU': 'Гиды по подаркам' };
  for (const l of LANGS) {
    assert.equal(DICTS[l]['Gift guides'], GIFT[l], `${l}: "Gift guides"`);
    for (const p of PAGES) {
      const { r, text } = await get(withLang(p, l));
      assert.equal(r.status, 200, `${l} ${p}`);
      assert.ok(text.startsWith(`<!doctype html>\n<html lang="${l}">`), `${l} ${p}: <html lang>`);
      assert.equal(r.headers.get('Content-Language'), l);
      assert.ok(text.includes(`<link rel="canonical" href="https://megastoresgearworld.com${p}">`), `${l} ${p}: the English address is the canonical one`);
      assert.ok(text.includes(`>${esc(GIFT[l])}</a>`), `${l} ${p}: the menu in ${l}`);
      assert.ok(!/<script/i.test(text) && !r.headers.get('Set-Cookie'), `${l} ${p}: still no script and no cookie`);
      // Every link to a page of this site keeps the chosen language; the language menu names every language.
      for (const h of [...text.matchAll(/href="(\/[^"]*)"/g)].map(m => m[1].replace(/&amp;/g, '&'))) {
        if (h.startsWith('/assets/')) continue;
        assert.match(h, new RegExp(`[?&]lang=(${l}|${site.languages.map(x => x.code).join('|')})(#|$)`), `${l} ${p}: ${h}`);
      }
      for (const x of site.languages) assert.ok(text.includes(`href="${p}?lang=${x.code}" hreflang="${x.code}" lang="${x.code}" rel="nofollow"`), `${l} ${p}: the menu has ${x.code}`);
      assert.ok(text.includes(`<span translate="no" lang="${l}">${site.languages.find(x => x.code === l).label}</span>`), `${l} ${p}: the menu shows the language`);
    }
  }
  // The short form, an unknown language and a page without ?lang=.
  let x = await get('/?lang=el');
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="el-GR">') && x.text.includes('href="/guides/tech-gift-ideas/?lang=el-GR"'));
  x = await get('/?lang=xx');
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="en-GB">') && x.text.includes('href="/guides/tech-gift-ideas/"'));
  x = await get('/guides/');
  assert.equal(x.r.headers.get('Location'), 'https://megastoresgearworld.com/#guides');
  x = await get('/guides/?lang=de-DE');
  assert.equal(x.r.headers.get('Location'), 'https://megastoresgearworld.com/?lang=de-DE#guides', 'a redirect keeps the language');
});

test('L175, L195: the country picks the language when the visitor chose none (private answer); crawlers always read English', async () => {
  let x = await get('/', ON, { cf: { country: 'GR' } });
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="el-GR">'), 'Greece: Greek');
  assert.equal(x.r.headers.get('Cache-Control'), 'private, max-age=60', 'never kept by a shared cache');
  assert.ok(x.text.includes('href="/guides/tech-gift-ideas/"'), 'links without ?lang= (the country decides again)');
  assert.ok(x.text.includes('<a class="hub-link" href="https://gearworldhub.com/">'), 'the Hub without ?lang=: the visitor did not choose');
  x = await get('/?lang=en-GB', ON, { cf: { country: 'GR' } });
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="en-GB">'), 'the visitor\'s choice first');
  // L210: every page depends on the visitor's country now (its stores, codes and Amazon), so none is kept by a shared cache.
  assert.equal(x.r.headers.get('Cache-Control'), 'private, max-age=60');
  assert.ok(x.text.includes('<a class="hub-link" href="https://gearworldhub.com/?lang=en-GB">'), 'a chosen English goes to the Hub too (L174)');
  x = await get('/', ON, { cf: { country: 'BE' }, headers: { 'accept-language': 'fr-BE,fr;q=0.9,en;q=0.5' } });
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="fr-FR">'), 'Belgium, French browser');
  x = await get('/', ON, { cf: { country: 'BE' }, headers: { 'accept-language': 'en-GB,nl;q=0.8' } });
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="en-GB">'), 'Belgium, English first');
  x = await get('/', ON, { cf: { country: 'GB' } });
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="en-GB">'));
  assert.equal(x.r.headers.get('Cache-Control'), 'private, max-age=60', 'L210: the UK page is not kept by a shared cache either');
  // The network's QA check asks for a country with its header, and for a language with ?lang= (tools/ogw-site.ps1).
  x = await get('/', ON, { ua: QA, headers: { 'X-GW-QA-Country': 'GB' } });
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="en-GB">'));
  x = await get('/?lang=el', ON, { ua: QA, headers: { 'X-GW-QA-Country': 'GB' } });
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="el-GR">') && x.text.includes('Οδηγοί δώρων'), 'the check of tools/ogw-site.ps1');
  x = await get('/', ON, { ua: QA, headers: { 'X-GW-QA-Country': 'GR' } });
  assert.ok(x.text.startsWith('<!doctype html>\n<html lang="el-GR">'), 'the QA check may ask a country');
  for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'facebookexternalhit/1.1']) {
    for (const p of ['/', '/?lang=el-GR', '/privacy/?lang=ru-RU', '/stores/joybuy/?lang=de-DE']) {
      x = await get(p, ON, { ua, cf: { country: 'GR' } });
      assert.ok(x.text.startsWith('<!doctype html>\n<html lang="en-GB">'), `${ua} ${p}: English`);
      assert.equal(x.r.headers.get('Content-Language'), 'en-GB');
      if (p.includes('lang=')) assert.equal(x.r.headers.get('Cache-Control'), 'private, max-age=60', `${ua} ${p}: the English answer of a ?lang= address is never kept for visitors`);
      assert.ok(!/[?&]lang=(?!(en-GB|el-GR|de-DE|fr-FR|it-IT|es-ES|pt-PT|nl-NL|pl-PL|sq-AL|ro-RO|ru-RU)" hreflang)/.test(x.text), `${ua} ${p}: no ?lang= links but the menu`);
      assert.ok(x.text.includes('<link rel="canonical" href="https://megastoresgearworld.com/'), 'the canonical');
    }
  }
});

// ---------------------------------------------------------------- what each page says

const SCRIPT = { 'el-GR': /[Ͱ-Ͽἀ-῿]/, 'ru-RU': /[Ѐ-ӿ]/ };
test('L24, L195: Greek and Russian pages: every text outside translate="no" is in that language or one of its own kept words', async () => {
  for (const l of ['el-GR', 'ru-RU']) {
    const kept = Object.values(DICTS[l]).filter(v => !SCRIPT[l].test(v)).map(v => new RegExp(`^${v.replace(/[.*+?^$()[\]\\|]/g, '\\$&').replace(/\\?\{\d+\\?\}/g, '.+')}$`));
    const allowed = t => /^[\s\d.,:;·()\-–—/&#|%£€$!?'"«»„“”→]*$/.test(t) || t === '#ad' || kept.some(r => r.test(t));
    for (const day of ['2026-11-19', '2026-11-27', '2026-12-05']) {
      const w = workerAt(day);
      for (const env of [ON, OFF, PRE]) {
        for (const p of [...PAGES, '/stores/amazon/', '/nope/']) {
          const { text } = await get(withLang(p, l), env, { worker: w });
          for (const t of translatableTexts(text)) assert.ok(SCRIPT[l].test(t) || allowed(t), `${l} ${day} ${p}: "${t}" is not in ${l}`);
          const title = text.match(/<title>([^<]*)<\/title>/)[1].split(' | ')[0];
          assert.ok(SCRIPT[l].test(title) || allowed(title) || title === 'Mega Stores Gear World', `${l} ${p}: title "${title}"`);
        }
      }
    }
  }
});

test('L103, L195: names are never translated: stores, products, brands, Gear World sites, Mega Stores Gear World, codes', async () => {
  for (const l of LANGS) {
    const home = (await get(withLang('/', l))).text;
    assert.ok(home.includes('<span translate="no">Mega Stores Gear World</span>'), `${l}: the site name`);
    for (const w of GEAR_WORLDS) assert.ok(home.includes(`translate="no">${w.name.replace(/'/g, '&#39;')}</a>`), `${l}: ${w.name}`);
    for (const s of awinStores(site).filter(x => !String(x.slug).endsWith('-gr'))) assert.ok(home.includes(`<a class="store-link" href="/stores/${s.slug}/?lang=${l}"><span translate="no">${s.name}</span></a>`), `${l}: ${s.name} (the UK page)`);
    for (const code of ['CLAIMFIFTY', 'CLAIMSEVFY', 'EIN15PCDD']) assert.ok(home.includes(`<strong translate="no">${code}</strong>`), `${l}: ${code}`);
    const joy = (await get(withLang('/stores/joybuy/', l))).text;
    assert.match(joy, /<h2 class="pcard-name" translate="no">Joybuy [a-z]+ item 1<\/h2>/, `${l}: product names`);
    assert.match(joy, /<p class="pcard-brand" translate="no">Acme<\/p>/, `${l}: brands`);
    assert.ok(joy.includes(`<h1>${esc(DICTS[l]['{0} on {1}']).replace('{0}', '<span translate="no">Joybuy</span>').replace('{1}', '<span translate="no">Mega Stores Gear World</span>')}</h1>`), `${l}: the store page title`);
  }
});

test('Amazon Associates: the statement stays in English word for word on every page with Amazon links, in every language', async () => {
  for (const l of [BASE_LANG, ...LANGS]) {
    for (const p of [...PAGES, '/stores/amazon/']) {
      const on = (await get(l === BASE_LANG ? p : withLang(p, l), ON)).text;
      assert.ok(on.includes(`<span lang="en-GB" translate="no">${AMAZON_STATEMENT}</span>`), `${l} ${p}: the statement in English`);
      if (l !== BASE_LANG) assert.ok(on.includes(`<span class="amz-tr">(${esc(DICTS[l][AMAZON_STATEMENT])})</span>`), `${l} ${p}: its translation after it`);
      for (const env of [OFF, PRE]) assert.ok(!(await get(l === BASE_LANG ? p : withLang(p, l), env)).text.includes(AMAZON_STATEMENT), `${l} ${p}: no statement without the Associates ID`);
      if (p === '/stores/amazon/') continue;
      assert.ok(!/amazon/i.test((await get(l === BASE_LANG ? p : withLang(p, l), OFF)).text), `${l} ${p}: no Amazon at all when off`);
    }
  }
});

test('L174, L195: the Hub link in the header and the footer of every page, in every language, with the chosen language', async () => {
  for (const l of [BASE_LANG, ...LANGS]) {
    for (const env of [ON, OFF, PRE]) {
      for (const p of [...PAGES, '/nope/']) {
        const { text } = await get(l === BASE_LANG ? p : withLang(p, l), env);
        const hub = l === BASE_LANG ? 'https://gearworldhub.com/' : HUB_LANGS.includes(l) ? `https://gearworldhub.com/?lang=${l}` : 'https://gearworldhub.com/';
        const label = esc(l === BASE_LANG ? 'Explore the Hub' : DICTS[l]['Explore the Hub']);
        assert.ok(text.includes(`<a class="hub-link" href="${hub}">${label} <span aria-hidden="true">&rarr;</span></a>`), `${l} ${p}: the Hub link in the header`);
        assert.ok(text.includes(`<p class="foot-hub" data-gw-network><span>${esc(l === BASE_LANG ? 'Gear World network' : DICTS[l]['Gear World network'])}:</span> <a href="${hub}"><span><span translate="no">Gear World Hub</span> · ${label}</span></a></p>`), `${l} ${p}: the Hub link in the footer`);
      }
    }
  }
  assert.ok(!HUB_LANGS.includes('pl-PL'), 'the Hub has no Polish: a Polish page links to the Hub without ?lang=');
});

test('L101, L103, L107, L191: no bad words in any language, no /out/ or /go/, prices only in the retailers\' own code lines', async () => {
  for (const day of ['2026-11-19', '2026-11-27']) {
    const w = workerAt(day);
    for (const l of [BASE_LANG, ...LANGS]) {
      for (const env of [ON, OFF, PRE]) {
        for (const p of [...PAGES, '/stores/amazon/']) {
          const { text } = await get(l === BASE_LANG ? p : withLang(p, l), env, { worker: w });
          assert.ok(!/href="[^"]*\/(out|go)\//.test(text), `${l} ${p}: no /out/ or /go/`);
          const v = visible(text);
          assert.ok(!/£|€|\bGBP\b|12\.34/.test(v), `${l} ${p}: no price`);
          const m = l === BASE_LANG ? v.match(EN_BAD) : (v.match(BAD[l]) || v.match(SHOP_LANGS));
          assert.ok(!m, `${l} ${day} ${p}: "${m && m[0]}"`);
          // English words left in another language (a word with a letter of that language, "cartão", is not one).
          if (l !== BASE_LANG) assert.ok(!v.replace(/\p{L}*[^\x00-\x7F]\p{L}*/gu, ' ').match(EN_BAD), `${l} ${p}: no English bad word left`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------- Black Friday (L188, L195)

test('Black Friday: the countdown by UK day (19/11 = 8 days, 26/11 = 1 day, 27-29/11 on, 30/11 Cyber Monday, 1/12 gone)', async () => {
  const count = async (day, lang = '') => {
    const { text } = await get(lang ? withLang('/', lang) : '/', ON, { worker: workerAt(day) });
    const m = text.match(/<p class="bf-count" data-day="([^"]+)">([\s\S]*?)<\/p>/);
    return { text, day: m && m[1], count: m && m[2] };
  };
  let x = await count('2026-11-19');
  assert.equal(x.count, '<strong class="bf-num">8</strong> days to Black Friday');
  assert.equal(x.day, '2026-11-19');
  assert.ok(x.text.includes('<h2 id="bf-h">Black Friday 2026</h2>'));
  assert.ok(x.text.includes('<p class="bf-dates">Black Friday: Fri 27 Nov · Cyber Monday: Mon 30 Nov</p>'));
  // L208 (owner, 21 Nov 2026): the stores first, then the offers; the countdown is the first button of the hero.
  assert.ok(x.text.indexOf('id="stores"') > 0 && x.text.indexOf('id="stores"') < x.text.indexOf('id="black-friday"') && x.text.indexOf('id="black-friday"') < x.text.indexOf('id="guides"'), 'below the Stores section, above the gift guides');
  assert.ok(x.text.includes('<li class="jump-wide"><a class="jump jump-bf" href="/#black-friday"><span class="jump-label"><strong class="jump-num">8</strong> days to Black Friday</span><span class="jump-meta">Fri 27 Nov</span></a></li>'), 'the countdown button of the hero');
  assert.ok(!x.text.includes('<p class="count">'), 'no second countdown line');
  assert.equal((await count('2026-11-26')).count, '<strong class="bf-num">1</strong> day to Black Friday');
  // London's day: 23:30 on 26 Nov in London is still 26 Nov.
  const late = createGuidesWorker(site, { fetch: fakeFetch(), cache: null, now: () => Date.parse('2026-11-26T23:30:00Z') });
  assert.match((await get('/', ON, { worker: late })).text, /<strong class="bf-num">1<\/strong> day to Black Friday/);
  for (const d of ['2026-11-27', '2026-11-28', '2026-11-29']) assert.equal((await count(d)).count, 'Black Friday is on', d);
  assert.equal((await count('2026-11-30')).count, 'Cyber Monday is on');
  x = await count('2026-12-01');
  assert.ok(!x.text.includes('id="black-friday"') && !x.text.includes('bf-count'), '1 Dec: the block is gone');
  assert.ok(x.text.includes('<a class="jump jump-bf" href="/#guides"><span class="jump-label">Christmas: 24 days to go</span></a>'), 'then the Christmas button');
  assert.ok(!/blackfriday|black-friday\//.test(x.text), 'no Amazon or Hub Black Friday link after Cyber Monday');
  // In every language, worked out on the server: no script, nothing that moves.
  for (const l of LANGS) {
    const y = await count('2026-11-19', l);
    assert.equal(y.count, esc(DICTS[l]['{0} days to Black Friday']).replace('{0}', '<strong class="bf-num">8</strong>'), l);
    assert.ok(!/<script|@keyframes|animation/.test(y.text), `${l}: nothing moves`);
  }
  const css = readFileSync('sites/ogw/public/assets/ogw.css', 'utf8');
  assert.ok(!/@keyframes|animation:/.test(css), 'no animation in the styles');
  assert.deepEqual([site.blackFriday, site.cyberMonday], [site.earlyBlackFriday.blackFriday, site.earlyBlackFriday.cyberMonday], 'the same dates as the Hub');
});

test('Early Black Friday: the stores that started, from the Hub\'s black-friday.json, with their dates, Gear World links and codes', async () => {
  const data = JSON.parse(readFileSync('sites/gwh/black-friday/black-friday.json', 'utf8'));
  assert.deepEqual(site.earlyBlackFriday, data, 'the same file as the Hub\'s /black-friday/ page');
  const { text } = await get('/');
  const block = text.slice(text.indexOf('id="black-friday"'), text.indexOf('id="guides"'));
  assert.ok(block.includes('<h3 class="bf-sub">Early Black Friday: stores that have already started</h3>'));
  const items = block.match(/<li class="bf-store" data-end="[^"]+">[\s\S]*?<\/li>\s*(?=<li class="bf-store"|<\/ul>)/g) || [];
  const started = data.started.filter(r => r.from <= '2026-11-19' && '2026-11-19' <= r.hide);
  assert.equal(items.length, started.length, 'every retailer that started');
  const ours = new Set(awinStores(site).map(s => s.slug));
  started.forEach((r, i) => {
    const it = items[i];
    assert.ok(it.startsWith(`<li class="bf-store" data-end="${r.hide}">`), `${r.name}: data-end`);
    assert.ok(it.includes(`<h4 class="bf-store-name" translate="no">${r.name}</h4>`), r.name);
    const when = r.to ? `Black Friday from ${new Date(`${r.from}T12:00:00Z`).getUTCDate()} Nov · until ${Number(r.to.slice(8))} ${r.to.slice(5, 7) === '12' ? 'Dec' : 'Nov'}` : `Black Friday from ${Number(r.from.slice(8))} Nov`;
    assert.ok(it.includes(`<p class="bf-when">${when}</p>`), `${r.name}: ${when}`);
    for (const code of r.sites) {
      const w = GEAR_WORLDS.find(g => g.code === code.toUpperCase());
      const u = new URL('/search', w.url);
      u.searchParams.set('q', r.name);
      u.searchParams.set('retailer', r.name);
      assert.ok(it.includes(`<a href="${u.toString().replace(/&/g, '&amp;')}" translate="no">${w.name.replace(/'/g, '&#39;')}</a>`), `${r.name}: its products on ${w.name}`);
    }
    assert.equal(it.includes(`<p class="bf-own"><a href="/stores/${r.slug}/">`), ours.has(r.slug), `${r.name}: its page here only when it is one of our stores`);
    const codes = data.codes.filter(k => k.slug === r.slug && '2026-11-19' <= k.end);
    const cards = it.match(/<li class="promo-card" data-end="[^"]+">[\s\S]*?<\/li>/g) || [];
    assert.equal(cards.length, codes.length, `${r.name}: its codes and coupons`);
    codes.forEach((k, j) => {
      assert.ok(cards[j].startsWith(`<li class="promo-card" data-end="${k.end}">`));
      if (k.kind === 'code') assert.ok(cards[j].includes(`<strong translate="no">${k.code}</strong>`), k.code);
      else assert.ok(cards[j].includes('Coupon: no code to type'), 'a coupon');
      assert.match(cards[j], /<p class="promo-valid">Valid until \d{1,2} (Nov|Dec) 2026<\/p>/);
      const w = GEAR_WORLDS.find(g => g.code === k.site.toUpperCase());
      assert.ok(cards[j].includes(`href="${w.url}discount-codes/${r.slug}/"`), `${k.code || k.title}: its Gear World codes page`);
    });
  });
  for (const h of [...block.matchAll(/href="([^"]+)"/g)].map(m => new URL(m[1].replace(/&amp;/g, '&'), LIVE))) {
    assert.ok(/^([a-z]+gearworld\.com|gearworldhub\.com|megastoresgearworld\.com|www\.amazon\.co\.uk)$/.test(h.hostname), `only Gear World pages and Amazon's own page: ${h}`);
    assert.ok(!/\/(out|go)\//.test(h.pathname), `${h}: never /out/ or /go/`);
  }
  // The Hub's page and, only with Amazon links, Amazon's own Black Friday page (an Amazon Special Link, no logo).
  assert.ok(block.includes('<a class="btn btn-gw" href="https://gearworldhub.com/black-friday/"><span>All Black Friday dates and codes on <span translate="no">Gear World Hub</span></span></a>'));
  assert.ok(block.includes('<a class="btn btn-market" href="https://www.amazon.co.uk/blackfriday?tag=gearworld04-21" rel="sponsored nofollow noopener" target="_blank">Black Friday on Amazon</a>'));
  assert.ok(text.indexOf(AMAZON_STATEMENT) < text.indexOf('amazon.co.uk/blackfriday'), 'the statement before the Amazon link');
  assert.ok(!/<img[^>]+amazon/i.test(block), 'no Amazon logo');
  const pre = (await get('/', PRE)).text;
  assert.ok(pre.includes('href="https://www.amazon.co.uk/blackfriday" rel="sponsored nofollow noopener"') && !pre.includes('tag='), 'the test address: no Associates ID');
  const off = (await get('/', OFF)).text;
  assert.ok(!/amazon/i.test(off) && off.includes('id="black-friday"'), 'off: the block without any Amazon');
  // Greek: the Hub link keeps the language.
  const el = (await get('/?lang=el-GR')).text;
  assert.ok(el.includes('href="https://gearworldhub.com/black-friday/?lang=el-GR"'));
  assert.ok(el.includes(`<h3 class="bf-sub">${esc(DICTS['el-GR']['Early Black Friday: stores that have already started'])}</h3>`));
});

test('Early Black Friday: each retailer and code hides after its own UK day, on the server; a store not started yet is not shown', async () => {
  const data = {
    blackFriday: '2026-11-27', cyberMonday: '2026-11-30',
    started: [
      { name: 'Tooled Up', slug: 'tooled-up', from: '2026-11-09', to: '2026-11-20', hide: '2026-11-20', sites: ['cgw'], deliversTo: ['GB'] },
      { name: 'My Tool Shed', slug: 'my-tool-shed', from: '2026-11-09', to: '', hide: '2026-11-30', sites: ['cgw', 'ggw'], deliversTo: ['GB'] },
      { name: 'Later Store', slug: 'later-store', from: '2026-11-25', to: '2026-11-30', hide: '2026-11-30', sites: ['hgw'], deliversTo: ['GB'] },
      { name: 'Abroad Store', slug: 'abroad-store', from: '2026-11-01', to: '', hide: '2026-11-30', sites: ['hgw'], deliversTo: ['DE', 'GB'] },
      { name: 'Bad Store', slug: 'Bad Store', from: '2026-11-01', to: '', hide: '2026-11-30', sites: ['hgw'], deliversTo: ['GB'] }
    ],
    codes: [
      { kind: 'code', name: 'My Tool Shed', slug: 'my-tool-shed', site: 'cgw', code: 'SHORT1', title: '£5 off when you spend £50', end: '2026-11-21' },
      { kind: 'code', name: 'My Tool Shed', slug: 'my-tool-shed', site: 'ggw', code: 'LONG22', title: '£9 off when you spend £90', end: '2026-11-29' },
      { kind: 'code', name: 'My Tool Shed', slug: 'my-tool-shed', site: 'agw', code: 'NOTSITE', title: '£9 off when you spend £90', end: '2026-11-29' },
      { kind: 'coupon', name: 'My Tool Shed', slug: 'my-tool-shed', site: 'cgw', title: '£10 off when you spend £59, on selected products', end: '2026-11-29' }
    ]
  };
  const s = { ...site, earlyBlackFriday: data };
  const names = day => earlyBlackFriday(s, at(day)).map(r => r.slug);
  const codes = day => earlyBlackFriday(s, at(day)).flatMap(r => r.codes.map(k => k.code || k.title));
  assert.deepEqual(names('2026-11-20'), ['tooled-up', 'my-tool-shed', 'abroad-store'], 'started ones; a bad slug is left out');
  assert.deepEqual(names('2026-11-21'), ['my-tool-shed', 'abroad-store'], 'Tooled Up hidden after 20 Nov');
  assert.deepEqual(names('2026-11-25'), ['my-tool-shed', 'later-store', 'abroad-store'], 'a store shows from its own first day');
  assert.deepEqual(codes('2026-11-21'), ['SHORT1', 'LONG22', '£10 off when you spend £59, on selected products'], 'a code of a site its retailer is not on is left out');
  assert.deepEqual(codes('2026-11-22'), ['LONG22', '£10 off when you spend £59, on selected products'], 'SHORT1 hidden after 21 Nov');
  assert.deepEqual(codes('2026-11-30'), [], 'every code ended');
  assert.equal(earlyBlackFriday(s, at('2026-11-20')).find(r => r.slug === 'abroad-store').links[0].url, 'https://homegearworld.com/search?q=Abroad+Store&retailer=Abroad+Store',
    'a store that delivers to the UK: the UK view');
  const w = createGuidesWorker(s, { fetch: fakeFetch(), cache: null, now: () => at('2026-11-22') });
  const page = await (await w.fetch(new Request(`${LIVE}/`), ON)).text();
  assert.ok(!page.includes('SHORT1') && page.includes('LONG22') && !page.includes('>Tooled Up</h4>'), 'the page shows only what still runs');
  assert.ok(page.includes('<p class="bf-when">Black Friday from 9 Nov</p>'), 'no "until" without the retailer\'s own last day');
  // The codes of our stores that the Hub's file does not list come from promos/promos.js, once, with their own dates.
  const parts = blackFridayParts(s, at('2026-11-22'));
  assert.deepEqual(parts.extra.map(i => `${i.store.slug} ${i.promo.code || `${i.promo.off}/${i.promo.minSpend}`}`),
    ['joybuy 10/59', 'joybuy 40/199', 'tooled-up EIN15PCDD', 'tooled-up CLAIMFIFTY', 'tooled-up CLAIMSEVFY', 'my-tool-shed EIN15PCDD', 'my-tool-shed CLAIMFIFTY', 'my-tool-shed CLAIMSEVFY']);
  assert.ok(page.includes('<h3 class="bf-sub">Codes from the stores</h3>'));
  assert.ok(page.includes('<p class="promo-offer">15% off when you spend £50</p>'), 'the retailer\'s own percentage (L186)');
  // With the real file every code of our stores is in it: no second list.
  assert.deepEqual(blackFridayParts(site, at('2026-11-19')).extra, []);
  assert.equal(blackFridayParts(site, at('2026-12-01')), null);
});

test('store pages: the store\'s codes with their end dates; each disappears after its last UK day', async () => {
  const tu = day => get('/stores/tooled-up/', ON, { worker: workerAt(day) }).then(x => x.text);
  let t = await tu('2026-11-19');
  assert.ok(t.includes('<h2 id="codes-h">Codes from <span translate="no">Tooled Up</span></h2>'));
  for (const c of ['CLAIMFIFTY', 'CLAIMSEVFY', 'EIN15PCDD']) assert.ok(t.includes(`<strong translate="no">${c}</strong>`), c);
  assert.ok(t.includes('<p class="promo-offer">£50 off when you spend £500</p>') && t.includes('<p class="promo-valid">Valid until 6 Dec 2026</p>'));
  assert.ok(t.includes('<p class="promo-offer">15% off when you spend £50</p>') && t.includes('<p class="promo-valid">Valid until 30 Dec 2026</p>'));
  assert.ok(t.includes('<p class="count bf-when" data-end="2026-12-06">Black Friday from 9 Nov · until 6 Dec</p>'), 'its Black Friday dates');
  assert.equal((t.match(/href="https:\/\/constructiongearworld\.com\/discount-codes\/tooled-up\/"/g) || []).length >= 3, true);
  t = await tu('2026-12-07');
  assert.ok(!t.includes('CLAIMFIFTY') && t.includes('EIN15PCDD'), '7 Dec: the Black Friday codes are gone, Einhell runs to 30 Dec');
  assert.ok(!t.includes('bf-when'), 'its Black Friday is over');
  t = await tu('2026-12-31');
  assert.ok(!t.includes('codes-h') && !t.includes('/discount-codes/'), '31 Dec: no code left');
  // Joybuy's coupons until 30 Nov, in Greek too.
  t = (await get('/stores/joybuy/?lang=el-GR', ON, { worker: workerAt('2026-11-30') })).text;
  assert.equal((t.match(/<li class="promo-card" data-end="2026-11-30">/g) || []).length, 2);
  assert.ok(t.includes(`<p class="promo-offer">${esc(DICTS['el-GR']['{0} off when you spend {1}']).replace('{0}', '£10').replace('{1}', '£59')}</p>`));
  t = (await get('/stores/joybuy/', ON, { worker: workerAt('2026-12-01') })).text;
  assert.ok(!t.includes('promo-card'), '1 Dec: no Joybuy coupon');
  assert.deepEqual(storeCodes(site, at('2026-12-31')), [], 'nothing runs after the last end date');
});

test('tools/ogw-site.ps1: the preview and live check read Greek, the Hub link, the countdown, an early Black Friday store and its code', () => {
  const ps = readFileSync('tools/ogw-site.ps1', 'utf8');
  assert.ok(ps.includes("Get-Page ($base + '/?lang=el')"), 'the Greek home page');
  assert.ok(ps.includes('<html lang="el-GR"') && ps.includes('Οδηγοί δώρων'), 'html lang and a Greek word');
  assert.ok(ps.includes('class="hub-link" href="https://gearworldhub.com/'), 'the Hub link');
  assert.ok(ps.includes('class="bf-count"') && ps.includes('class="bf-store"'), 'the countdown and an early Black Friday store');
  assert.ok(ps.includes('gearworld\\.com/discount-codes/'), 'a code that links to a Gear World /discount-codes/ page');
  assert.ok(ps.includes('https://www.amazon.co.uk/blackfriday?tag='), 'the Amazon Black Friday link with the Associates ID (mode on)');
  assert.ok(ps.includes("$BlackFridayEnd = '2026-11-30'"), 'the block is checked until the end of Cyber Monday');
  assert.ok(ps.includes('<p class="promo-offer">'), 'the £ check leaves out the retailers\' own code lines');
  assert.ok(!/[^\r]\n/.test(ps), 'CRLF only');
});

test('L195 review 19/11: Google crawlers without "bot" in the name get English; the country is translated, the name is not', async () => {
  assert.equal(OGW_GOOGLE.source, GOOGLE_CRAWLER.source, "Google's crawlers: the engine's rule");
  for (const ua of ['Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)', 'GoogleOther', 'Mediapartners-Google']) {
    for (const cc of ['DE', 'FR', 'GR']) {
      const r = new Request(LIVE, { headers: { 'user-agent': ua } });
      Object.defineProperty(r, 'cf', { value: { country: cc } });
      const res = await workerAt('2026-11-19').fetch(r, { AMAZON_LINKS: 'on' }, { waitUntil() {} });
      const page = await res.text();
      assert.match(page, /<html lang="en-GB"/, `${ua} from ${cc}: English`);
    }
  }
  const el = await (await workerAt('2026-11-19').fetch(new Request(LIVE + '/?lang=el', { headers: { 'user-agent': BROWSER } }), { AMAZON_LINKS: 'on' }, { waitUntil() {} })).text();
  assert.ok(el.includes('Evangelos Kalogerakis</span>, Ηνωμένο Βασίλειο'), 'the footer says the country in Greek');
  assert.ok(!/United Kingdom/.test(el.replace(/<link[^>]*>/g, '')), 'no English country name on the Greek page');
  assert.ok(!/συνεργατών/.test(JSON.stringify(DICTS['el-GR'])), 'Greek says affiliate, not partners (L103)');
});

// ---------------------------------------------------------------- Hero buttons (owner, 21 Nov 2026, L208)

test('L208: the hero has buttons on the right (countdown, stores, gift guides, 4 guides), translated, and the stores come before the offers', async () => {
  const buttons = text => {
    const nav = text.slice(text.indexOf('<nav class="hero-jump"'), text.indexOf('</nav>', text.indexOf('<nav class="hero-jump"')));
    return [...nav.matchAll(/<a class="jump[^"]*" href="([^"]+)"><span class="jump-label">([\s\S]*?)<\/span>(?:<span class="jump-meta">([\s\S]*?)<\/span>)?<\/a>/g)].map(m => ({ href: m[1], label: m[2], meta: m[3] || '' }));
  };
  const { text } = await get('/', ON, { worker: workerAt('2026-11-21') });
  const b = buttons(text);
  assert.deepEqual(b.map(x => x.href), ['/#black-friday', '/#stores', '/#guides', ...site.guides.slice(0, 4).map(g => `/guides/${g.slug}/`)]);
  assert.equal(b[0].label, '<strong class="jump-num">6</strong> days to Black Friday');
  assert.equal(b[1].label, '<span translate="no">Mega Stores</span>', 'L208: «Mega Stores», not «Stores»');
  assert.ok(text.includes('<h2><span translate="no">Mega Stores</span></h2>'), 'the heading of the stores part');
  assert.equal(b[1].meta, `${shownStores(site, 'on').length} stores`);
  assert.equal(b[2].meta, `${site.guides.length} gift guides`);
  assert.ok(text.indexOf('<nav class="hero-jump"') > text.indexOf('<section class="hero">') && text.indexOf('<nav class="hero-jump"') < text.indexOf('class="note"'), 'inside the hero');
  assert.ok(text.indexOf('id="stores"') < text.indexOf('id="black-friday"'), 'the stores first, then the offers');
  assert.ok(!/<script|animation/.test(text.slice(text.indexOf('<section class="hero">'), text.indexOf('class="note"'))), 'nothing moves');
  // Without Amazon links the Amazon card is not counted.
  assert.equal(buttons((await get('/', OFF, { worker: workerAt('2026-11-21') })).text)[1].meta, `${shownStores(site, 'off').length} stores`);
  // In every language: the same links, translated labels.
  for (const l of LANGS) {
    const y = buttons((await get(withLang('/', l), ON, { worker: workerAt('2026-11-21') })).text);
    assert.deepEqual(y.map(x => x.href.replace(/[?&]lang=[^#&]+/, '')), b.map(x => x.href), l);
    assert.equal(y[0].label, esc(DICTS[l]['{0} days to Black Friday']).replace('{0}', '<strong class="jump-num">6</strong>'), l);
    assert.equal(y[1].label, '<span translate="no">Mega Stores</span>', `${l}: «Mega Stores» as it is`);
    assert.equal(y[1].meta, esc(DICTS[l]['{0} stores']).replace('{0}', String(shownStores(site, 'on').length)), l);
    assert.equal(y[3].label, esc(DICTS[l][site.guides[0].title]), l);
  }
  const css = readFileSync('sites/ogw/public/assets/ogw.css', 'utf8');
  assert.match(css, /\.hero-grid \{ grid-template-columns: minmax\(0, 1\.1fr\) minmax\(0, 1fr\);/, 'two columns on a computer');
  assert.match(css, /\.jumps \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/, 'two buttons per row');
  assert.match(css, /\.jump \{[^}]*min-height: 64px;/, 'big enough to tap');
});
