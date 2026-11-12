// Lessons L115 (owner's decision, 10 Nov 2026): the discount codes were reachable only from the footer link "Discount
// codes". Every page now has a thin bar between the masthead row (brand, Saved list, search) and the menu (nav.catbar):
// one link to /discount-codes/ with a tag icon and the number of running codes ("4 active codes", "1 active code"; a
// sale or a coupon with no code to type is an "offer"). It shows exactly when the footer link shows, for the same view
// of the visitor (lessons L107, L114): a code of a retailer that does not deliver to the visitor never counts. No
// retailer is the hero, no campaign name ("Black Friday"), no saving and no shop words, in any language. The bar is part
// of the page HTML (cached per view group, no D1 read, no JavaScript needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { createWorker } from '../../src/engine.js';
import { activePromos, ukToday } from '../../src/lib/promos.js';
import { viewFor, countryGroups, OWN_VIEW_COUNTRIES } from '../../src/lib/visibility.js';
import { codesBar, codesBarFor, codesCountText } from '../../src/pages/layout.js';
import { toString } from '../../src/lib/html.js';

const LANGS = ['de-DE', 'el-GR', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pt-PT', 'ro-RO', 'ru-RU', 'sq-AL'];
const KEYS = ['Discount codes', '1 active code', '{0} active codes', '1 active offer', '{0} active offers', '{0} active codes and offers'];
const FOOTER_LINK = '<li><a href="/discount-codes/">Discount codes</a></li>';
// The bar, right after the masthead row and right before the menu. On /discount-codes/ itself it also says
// aria-current="page" (a screen reader hears that it is the page they are on); everywhere else it does not.
const BAR = /<\/div>\n {2}<a class="codes-bar" href="\/discount-codes\/"(?: aria-current="page")?>([\s\S]*?)<\/a>\n {2}<nav class="catbar" aria-label="Categories">/;
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
// The visitors of the check: [name, request.cf.country, user agent]. Every European country that can have a view of its
// own (lessons L107: the 27 EU countries, Iceland, Liechtenstein, Norway, Switzerland and the UK), then the US, an unknown
// country and Google's crawler (from Germany). Google's crawlers get the UK view (src/engine.js).
const EUROPE = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'IS', 'LI', 'NO', 'CH', 'GB'];
const VIEWS = [...EUROPE.map(c => [c, c, '']), ['US', 'US', ''], ['unknown', '', ''], ['Googlebot', 'DE', GOOGLEBOT]];
// Who sees the bar. The codes of CGW, AGW and BGW are of retailers that deliver to the UK only (Tooled Up, My Tool
// Shed). Every country group with a view of its own there (lessons L107) shows only the retailers that deliver to it, so
// it gets 0 codes and no bar:
//   CGW: every European country but the UK: AT and DE (Reidl, VEVOR, GRABO), CH (GRABO), and BE, NL, FR, IE, the rest of
//        the EU, IS, LI and NO (VEVOR, GRABO);
//   AGW: BE (Pneus.be, VEVOR), and NL, FR, IE, AT, DE, the rest of the EU, IS, LI and NO (VEVOR);
//   BGW: the 27 EU countries, IS, LI and NO (VEVOR).
// Switzerland shares the UK view on AGW and BGW (no Swiss-only retailer there), so it sees their codes. The UK view (the
// UK, the US, an unknown country, Google's crawlers) always has the codes. GGW, HGW and KGW have no view but the UK one,
// so every country gets it, with its codes (Joybuy on HGW and KGW, lessons L114).
const UK_VIEW = ['GB', 'US', 'unknown', 'Googlebot'];
const seeing = also => Object.fromEntries(VIEWS.map(([name]) => [name, also === 'all' || UK_VIEW.includes(name) || also.includes(name)]));
const SHOWN = { CGW: seeing([]), AGW: seeing(['CH']), BGW: seeing(['CH']), GGW: seeing('all'), HGW: seeing('all'), KGW: seeing('all') };
// How many view groups each site has (the UK one included): CGW gb, at-de, ch and one for the rest of Europe; AGW gb (with
// CH), be and one for the rest; BGW gb (with CH) and one for the EU, IS, LI, NO; GGW, HGW, KGW only the UK view.
const GROUPS = { CGW: 4, AGW: 3, BGW: 2, GGW: 1, HGW: 1, KGW: 1 };
// What the bar says in the UK view while the codes of the config run (promos/promos.js, 10 Nov 2026).
const WORDS = {
  CGW: ['{0} active codes', '4'], GGW: ['{0} active codes', '4'], AGW: ['{0} active codes', '2'], BGW: ['{0} active codes', '2'],
  HGW: ['{0} active offers', '3'], KGW: ['1 active offer', '']
};
const NO_CODES = ['TGW', 'MGW', 'WGW', 'VGW', 'SGW', 'PGW', 'ZGW'];

// All 13 site configs, by code, with their folder.
async function allSites() {
  const out = {};
  for (const dir of readdirSync('sites').sort()) {
    const file = `sites/${dir}/site.config.js`;
    if (!existsSync(file) || !existsSync(`sites/${dir}/public/assets/i18n`)) continue;
    const site = (await import(pathToFileURL(file).href)).default;
    out[site.code] = { dir, site };
  }
  return out;
}

// The engine reads the real clock for the codes, so the test copies run around today.
const UK_DAY = ukToday();
const dayFrom = n => { const d = new Date(`${UK_DAY}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const runningToday = site => ({ ...site, promos: site.promos.map(p => ({ ...p, start: dayFrom(-1), end: dayFrom(5) })) });
const endedYesterday = site => ({ ...site, promos: site.promos.map(p => ({ ...p, start: dayFrom(-9), end: dayFrom(-1) })) });

// A database with no rows (pages that read nothing), and one with the test products of the site (src/ reads it as D1).
function memoryDb() {
  const rows = [];
  const stmt = (sql, args = []) => ({ bind: (...a) => stmt(sql, a), run: async () => { rows.push({ sql, args }); return { meta: {} }; }, first: async () => null, all: async () => ({ results: [] }) });
  return { rows, prepare: sql => stmt(sql), batch: async l => Promise.all(l.map(s => s.all())) };
}
function seededDb(dir, site) {
  const db = new DatabaseSync(':memory:');
  const legacy = site.database && site.database.layout === 'legacy';
  db.exec(readFileSync(legacy ? 'tests/fixtures/ggw-legacy-schema.sql' : `sites/${dir}/migrations/0001_init.sql`, 'utf8'));
  db.exec(readFileSync(`tests/fixtures/${dir}-seed.sql`, 'utf8'));
  const asked = [];
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => { asked.push(text); return { results: db.prepare(text).all(...args).map(r => ({ ...r })) }; },
    first: async () => { asked.push(text); const r = db.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: 0 } })
  });
  return { asked, prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) };
}
const FX_FETCH = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });

function visitor(site) {
  const worker = createWorker(site);
  return async (path, env, country = '', ua = '') => {
    const req = new Request(`https://${site.domain}${path}`, { headers: { 'User-Agent': ua || 'Mozilla/5.0 test' } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    const r = await worker.fetch(req, env, { waitUntil: p => p });
    return { status: r.status, html: await r.text() };
  };
}
const barOf = html => (html.match(BAR) || [])[1] || '';

test('L115: every view group of the sites with codes: the UK view has the codes, each group with a view of its own (DE, BE, NL, FR, IE, AT, CH...) none', async () => {
  // The list of the check is the engine's list of countries that can have a view of their own.
  assert.deepEqual([...EUROPE].sort(), [...OWN_VIEW_COUNTRIES].sort(), 'the European countries of the check');
  const sites = await allSites();
  for (const [code, want] of Object.entries(SHOWN)) {
    const site = runningToday(sites[code].site);
    const { home, list } = countryGroups(site);
    assert.equal(list.length, GROUPS[code], `${code}: view groups ${list.map(g => g.id).join(', ')}`);
    for (const g of list) {
      const codes = activePromos(site, Date.now(), viewFor(site, g.countries[0] || 'GB')).length;
      // The UK group has the codes; every other group (a view of its own) has none, and none of its countries sees the bar.
      assert.equal(codes > 0, g === home, `${code} ${g.id}: ${codes} codes`);
      for (const c of g.countries) assert.equal(want[c], g === home, `${code} ${g.id} ${c}: expected ${g === home ? 'the bar' : 'no bar'}`);
    }
    // By name, on the three sites with views of their own: Germany, Belgium, the Netherlands, France, Ireland and Austria
    // are never in the UK view there, so they never see the UK-only codes.
    if (GROUPS[code] > 1) {
      for (const c of ['DE', 'BE', 'NL', 'FR', 'IE', 'AT']) assert.ok(viewFor(site, c).group !== home.id && !want[c], `${code} ${c}: a view of its own, no codes`);
    }
  }
});

test('L115: the bar shows exactly when the footer link shows, per view (all 32 European countries, US, unknown, Googlebot), on the 6 sites with codes', async () => {
  const sites = await allSites();
  for (const [code, want] of Object.entries(SHOWN)) {
    const site = runningToday(sites[code].site);
    assert.ok(site.promos.length > 0, `${code}: has codes`);
    const get = visitor(site);
    const env = { DB: memoryDb(), CLICK_LOG: 'off', FX_FETCH };
    for (const [name, country, ua] of VIEWS) {
      // The same rule as the codes pages: the codes of the visitor's view (Google's crawler = the UK).
      const inView = activePromos(site, Date.now(), viewFor(site, ua ? 'GB' : country));
      assert.equal(inView.length > 0, want[name], `${code} ${name}: codes in the view`);
      for (const path of ['/', '/about/', '/discount-codes/', '/this-page-does-not-exist/']) {
        const { html } = await get(path, env, country, ua);
        const bar = barOf(html);
        assert.equal(Boolean(bar), want[name], `${code} ${name} ${path}: bar`);
        assert.equal(html.includes(FOOTER_LINK), want[name], `${code} ${name} ${path}: footer link`);
        assert.equal((html.match(/class="codes-bar"/g) || []).length, want[name] ? 1 : 0, `${code} ${name} ${path}: one bar at most, in its place`);
        assert.equal(/<body class="[^"]*" data-codes>/.test(html), want[name], `${code} ${name} ${path}: <body data-codes> with the bar only`);
        if (!bar) continue;
        // The number is the codes of this view, in the words of their kind.
        const [key, n] = WORDS[code];
        assert.equal(String(inView.length), n || '1', `${code} ${name}: count`);
        assert.ok(bar.includes(`<span class="codes-count"><span data-i18n="${key}"${n ? ` data-i18n-0="${n}"` : ''}>${key.replace('{0}', n)}</span></span>`), `${code} ${name} ${path}: "${key.replace('{0}', n)}"`);
      }
    }
  }
});

test('L115: no bar on the sites without codes, nor on a site whose codes have ended', async () => {
  const sites = await allSites();
  assert.deepEqual(Object.keys(sites).filter(c => !(c in SHOWN)).sort(), [...NO_CODES].sort(), 'the 13 sites are 6 with codes and 7 without');
  const cases = NO_CODES.map(c => [c, sites[c].site]);
  // TGW's only code (Joybuy "Joy Day") ended on 31 Oct 2026; the others have none.
  for (const [code, site] of cases) assert.ok(site.promos.every(p => p.end < '2026-11-10'), `${code}: nothing runs from 10 Nov 2026`);
  cases.push(['CGW ended', endedYesterday(sites.CGW.site)], ['HGW ended', endedYesterday(sites.HGW.site)]);
  for (const [code, site] of cases) {
    assert.equal(activePromos(site).length, 0, `${code}: no code runs today`);
    assert.equal(toString(codesBar(site)), '', `${code}: codesBar() is empty`);
    const get = visitor(site);
    const env = { DB: memoryDb(), CLICK_LOG: 'off', FX_FETCH };
    for (const [name, country, ua] of VIEWS) {
      for (const path of ['/', '/about/', '/this-page-does-not-exist/']) {
        const { html } = await get(path, env, country, ua);
        assert.ok(!/codes-bar|data-codes\b/.test(html), `${code} ${name} ${path}: no bar`);
        assert.ok(!html.includes(FOOTER_LINK), `${code} ${name} ${path}: no footer link`);
      }
    }
  }
});

test('L115: the bar sits between the masthead row and the menu: one plain link that works without JavaScript (snapshot)', async () => {
  const sites = await allSites();
  for (const [code, key, n] of [['CGW', '{0} active codes', '4'], ['HGW', '{0} active offers', '3'], ['KGW', '1 active offer', '']]) {
    const site = runningToday(sites[code].site);
    const { html } = await visitor(site)('/about/', { DB: memoryDb(), CLICK_LOG: 'off', FX_FETCH }, 'GB');
    const v = encodeURIComponent(site.assetVersion);
    const text = key.replace('{0}', n);
    const want = `<div class="wrap masthead-row">
    <a class="brand" href="/" aria-label="${site.name.replace(/'/g, '&#39;')} home" translate="no">`;
    assert.ok(html.includes(want), `${code}: the masthead row`);
    const nav = '<nav class="catbar" aria-label="Categories">';
    const head = html.slice(html.indexOf('<div class="wrap masthead-row">'), html.indexOf(nav) + nav.length);
    assert.ok(head.endsWith(`</form>
  </div>
  <a class="codes-bar" href="/discount-codes/">
    <span class="wrap codes-row"><svg class="icon codes-icon" aria-hidden="true" focusable="false"><use href="/assets/icons.svg?v=${v}#tag"></use></svg><span class="codes-word">Discount codes</span> <span class="codes-count"><span data-i18n="${key}"${n ? ` data-i18n-0="${n}"` : ''}>${text}</span></span><svg class="icon codes-chevron" aria-hidden="true" focusable="false"><use href="/assets/icons.svg?v=${v}#chevron"></use></svg></span>
  </a>
  <nav class="catbar" aria-label="Categories">`), `${code}: snapshot\n${head.slice(-900)}`);
    // Order in the header: (offer bar,) language and currency, masthead row, codes bar, menu, Hub strip.
    const at = s => html.indexOf(s);
    assert.ok(at('data-prefs') < at('masthead-row') && at('masthead-row') < at('class="codes-bar"') && at('class="codes-bar"') < at('class="catbar"') && at('class="catbar"') < at('</header>'), `${code}: order`);
    // One link, nothing hidden, nothing for a script to fill in.
    const bar = barOf(html);
    assert.ok(!/<a\b|<button\b|(?<![-\w])hidden\b|data-cart|data-copy|onclick/.test(bar), `${code}: one plain link`);
  }
  // The site script does not touch the bar: it works without JavaScript (the language only swaps its words, L24).
  for (const { dir } of Object.values(await allSites())) assert.ok(!/codes-/.test(readFileSync(`sites/${dir}/public/assets/site.js`, 'utf8')), dir);
});

test('L115: on /discount-codes/ the bar says aria-current="page" and stays a visible link; nowhere else', async () => {
  const sites = await allSites();
  for (const code of Object.keys(SHOWN)) {
    const site = runningToday(sites[code].site);
    const get = visitor(site);
    const env = { DB: memoryDb(), CLICK_LOG: 'off', FX_FETCH };
    const slug = site.promos[0].slug;
    for (const path of ['/discount-codes/', '/discount-codes/?utm_source=poster', '/', '/about/', `/discount-codes/${slug}/`, '/this-page-does-not-exist/']) {
      const { status, html } = await get(path, env, 'GB');
      const here = path.split('?')[0] === '/discount-codes/';
      assert.ok(barOf(html), `${code} ${path}: the bar (${status})`);
      const tag = (html.match(/<a class="codes-bar"[^>]*>/) || [''])[0];
      assert.equal(tag, `<a class="codes-bar" href="/discount-codes/"${here ? ' aria-current="page"' : ''}>`, `${code} ${path}: ${tag}`);
      // Still a link that works and shows: an href, nothing hidden, the same words as on every page.
      assert.ok(!/hidden|aria-hidden|tabindex|aria-disabled/.test(tag), `${code} ${path}: visible and clickable`);
      assert.equal((html.match(/aria-current="page"/g) || []).length - (html.match(/<span aria-current="page"/g) || []).length, here ? 1 : 0, `${code} ${path}: one current link at most`);
    }
  }
  // The stylesheet keeps the bar on screen on the codes page too, and marks it like the current menu link (a line under
  // it, not a colour alone).
  for (const { dir } of Object.values(sites)) {
    const css = readFileSync(`sites/${dir}/public/assets/site.css`, 'utf8');
    assert.ok(!/\.codes-bar\[aria-current[^{]*\{[^}]*(display: none|visibility: hidden|pointer-events: none)/.test(css), `${dir}: the current bar stays visible and clickable`);
    assert.match(css, /\.codes-bar\[aria-current="page"\] \{[^}]*box-shadow: inset 0 -3px 0 var\(--gold\);/, `${dir}: the current bar is underlined like the current menu link`);
  }
});

test('L115: the count says codes, offers or both; never a retailer, a code, a campaign or a saving', async () => {
  const code = (id, extra = {}) => ({ id, kind: 'code', code: 'X', ...extra });
  const sale = id => ({ id, kind: 'sale', campaign: 'Baby' });
  const coupon = id => ({ id, kind: 'coupon', off: 15, minSpend: 99 });
  const say = list => toString(codesCountText(list));
  assert.equal(say([code('a')]), '<span data-i18n="1 active code">1 active code</span>');
  assert.equal(say([code('a'), code('b'), code('c'), code('d')]), '<span data-i18n="{0} active codes" data-i18n-0="4">4 active codes</span>');
  assert.equal(say([sale('a')]), '<span data-i18n="1 active offer">1 active offer</span>');
  assert.equal(say([coupon('a')]), '<span data-i18n="1 active offer">1 active offer</span>', 'a coupon has no code to type: an offer');
  assert.equal(say([sale('a'), sale('b'), coupon('c')]), '<span data-i18n="{0} active offers" data-i18n-0="3">3 active offers</span>');
  assert.equal(say([code('a'), code('b'), sale('c')]), '<span data-i18n="{0} active codes and offers" data-i18n-0="3">3 active codes and offers</span>');
  // The bars of the real codes: neutral words only.
  const sites = await allSites();
  const BAD = /shop|cart|basket|buy now|UK retailers|save \d|\d+ ?%|price drop|was £|partner|official|trusted|black ?friday|deals?\b|sale\b|£/i;
  for (const c of Object.keys(SHOWN)) {
    const site = runningToday(sites[c].site);
    const bar = toString(codesBar(site));
    assert.ok(bar.startsWith('<a class="codes-bar" href="/discount-codes/">'), c);
    const words = bar.replace(/<[^>]*>/g, ' ') + ' ' + [...bar.matchAll(/(?:data-i18n(?:-\d+)?|aria-label|title)="([^"]*)"/g)].map(m => m[1]).join(' ');
    assert.ok(!BAD.test(words), `${c}: "${(words.match(BAD) || [])[0]}"`);
    for (const p of site.promos) {
      for (const name of [p.retailer, p.code, p.campaign, p.slug].filter(Boolean)) assert.ok(!words.includes(name) && !bar.includes(name), `${c}: no "${name}" in the bar`);
    }
  }
});

test('L115: every text of the bar is in the 130 dictionaries, with no shop, partner, saving or Black Friday words in any language', async () => {
  const BAD = new RegExp([
    'shop', 'cart', 'basket', 'buy', 'retailer', 'partner', 'official', 'trusted', 'black ?friday', 'deal', 'sale\\b', 'save', 'drop', '%', '£',
    'geschäft', 'laden', 'kauf', 'warenkorb', 'händler', 'offiziell', 'vertrauens', 'rabatt ?%',
    'κατάστημ', 'αγορ', 'καλάθι', 'συνεργ', 'επίσημ', 'αξιόπιστ', 'έκπτωση \\d',
    'tienda', 'compra', 'carrito', 'socio', 'oficial', 'confianza',
    'boutique', 'magasin', 'achat', 'achet', 'panier', 'partenai', 'officiel', 'confiance',
    'negozi', 'acquist', 'carrell', 'ufficial', 'affidabil',
    'winkel', 'koop', 'kopen', 'officieel', 'betrouwba',
    'loja', 'carrinho', 'parceir', 'confiança',
    'magazin', 'cumpăr', 'coș', 'partener', 'încredere',
    'магазин', 'покуп', 'корзин', 'партн', 'официальн', 'надёжн', 'надежн', 'пятниц',
    'dyqan', '\\bble', 'blerje', 'shport', 'zyrtar', 'besueshm'
  ].join('|'), 'i');
  const ph = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');
  for (const k of KEYS) assert.ok(!BAD.test(k), `English "${k}"`);
  const sites = await allSites();
  let n = 0;
  for (const { dir, site } of Object.values(sites)) {
    for (const lang of LANGS) {
      assert.ok(site.languages.some(l => l.code === lang), `${dir}: ${lang}`);
      const d = JSON.parse(readFileSync(`sites/${dir}/public/assets/i18n/${lang}.json`, 'utf8'));
      for (const k of KEYS) {
        assert.ok(typeof d[k] === 'string' && d[k].trim(), `${dir}/${lang}: "${k}"`);
        assert.equal(ph(d[k]), ph(k), `${dir}/${lang}: "${k}" keeps its placeholder`);
        assert.ok(!BAD.test(d[k]), `${dir}/${lang}: "${k}" => "${d[k]}"`);
        if (k.startsWith('1 ')) assert.match(d[k], /\b1\b/, `${dir}/${lang}: "${k}" says one`);
      }
      n++;
    }
  }
  assert.equal(n, 130);
  // The same words on every site (one bar for the whole network).
  for (const lang of LANGS) {
    const ref = JSON.parse(readFileSync(`sites/tgw/public/assets/i18n/${lang}.json`, 'utf8'));
    for (const { dir } of Object.values(sites)) {
      const d = JSON.parse(readFileSync(`sites/${dir}/public/assets/i18n/${lang}.json`, 'utf8'));
      for (const k of KEYS.slice(1)) assert.equal(d[k], ref[k], `${dir}/${lang}: "${k}" as on TGW`);
    }
  }
});

test('L115: cached pages keep the bar in the copy of their own view group only (home, category, product, deals, guide)', async () => {
  const sites = await allSites();
  const { dir, site: config } = sites.CGW;
  const cgw = runningToday(config);
  const get = visitor(cgw);
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  try {
    const env = { DB: seededDb(dir, cgw), CLICK_LOG: 'off', FX_FETCH };
    const home = await get('/', env, 'GB');
    const category = (home.html.match(/href="(\/category\/[a-z0-9-]+\/)"/) || [])[1];
    const product = (home.html.match(/href="(\/product\/[^"#?]+\/)"/) || [])[1];
    // A buying guide (its words in sites/cgw/guides.js; the test products are not in it, so it shows as no longer listed).
    const guide = `/guides/${cgw.guides[0].slug}/`;
    assert.ok(category && product && cgw.guides[0].slug, 'pages to check');
    const de = viewFor(cgw, 'DE').group;
    for (const path of ['/', category, product, '/deals/', '/guides/', guide]) {
      const gb = await get(path, env, 'GB');
      assert.equal(gb.status, 200, path);
      const germany = await get(path, env, 'DE');
      assert.equal(germany.status, 200, `${path} DE`);
      assert.ok(barOf(gb.html), `${path}: the UK copy has the bar`);
      assert.ok(!/codes-bar/.test(germany.html), `${path}: the German copy has none`);
      const key = `https://${cgw.domain}${path}`;
      const sep = path.includes('?') ? '&' : '?';
      assert.ok(store.has(`${key}${sep}gw-view=gb`) && store.has(`${key}${sep}gw-view=${de}`), `${path}: one copy per group`);
      assert.ok(barOf(await store.get(`${key}${sep}gw-view=gb`).clone().text()), `${path}: the bar is in the cached UK copy`);
      assert.ok(!/codes-bar/.test(await store.get(`${key}${sep}gw-view=${de}`).clone().text()), `${path}: and not in the German one`);
      // Later visits get their own group's copy: the US, an unknown country and Google's crawler the UK one, Belgium
      // (its own group: VEVOR, GRABO) one without the bar.
      const size = store.size;
      for (const [country, ua] of [['US', ''], ['', ''], ['DE', GOOGLEBOT]]) assert.ok(barOf((await get(path, env, country, ua)).html), `${path} ${country || 'unknown'}${ua ? ' Googlebot' : ''}`);
      assert.equal(store.size, size, `${path}: no other copy for the UK view`);
      assert.ok(!/codes-bar/.test((await get(path, env, 'BE')).html), `${path} BE`);
    }
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});

test('L115: the bar reads nothing from D1: the same queries with and without running codes', async () => {
  const sites = await allSites();
  for (const code of ['CGW', 'AGW', 'HGW']) {
    const { dir, site } = sites[code];
    const running = runningToday(site);
    const none = { ...site, promos: [] };
    const paths = ['/', '/deals/', '/about/', '/discount-codes/', '/this-page-does-not-exist/', '/search?q=a'];
    const probe = await visitor(running)('/', { DB: seededDb(dir, running), CLICK_LOG: 'off', FX_FETCH }, 'GB');
    paths.push((probe.html.match(/href="(\/category\/[a-z0-9-]+\/)"/) || [])[1], (probe.html.match(/href="(\/product\/[^"#?]+\/)"/) || [])[1]);
    for (const path of paths) {
      assert.ok(path, `${code}: a page`);
      const a = { DB: seededDb(dir, running), CLICK_LOG: 'off', FX_FETCH };
      const b = { DB: seededDb(dir, none), CLICK_LOG: 'off', FX_FETCH };
      const withBar = await visitor(running)(path, a, 'GB');
      const without = await visitor(none)(path, b, 'GB');
      assert.ok(barOf(withBar.html) && !/codes-bar/.test(without.html), `${code} ${path}: bar only with codes`);
      assert.deepEqual(a.DB.asked, b.DB.asked, `${code} ${path}: the same D1 queries`);
      if (['/about/', '/discount-codes/'].includes(path)) assert.equal(a.DB.asked.length, 0, `${code} ${path}: no D1 query at all`);
    }
  }
});

test('L115: colours from each site\'s palette (text 7:1, icon 3:1, nothing fixed), the tag icon, a new asset version and the 360 px check', async () => {
  const lum = hex => {
    const c = [0, 2, 4].map(i => parseInt(hex.slice(1).slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const sites = await allSites();
  for (const { dir, site } of Object.values(sites)) {
    const css = readFileSync(`sites/${dir}/public/assets/site.css`, 'utf8');
    const root = css.match(/:root \{([\s\S]*?)\n\}/)[1];
    const v = name => (root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
    // The rules of the bar use the site's own colours only (custom properties), so each site keeps its palette.
    const rules = css.split('\n').filter(l => /\.codes-|\[data-codes\]/.test(l) && /\{/.test(l));
    assert.ok(rules.length >= 10, `${dir}: the bar's rules`);
    for (const r of rules) assert.ok(!/#[0-9a-f]{3,6}\b|rgba?\(|hsla?\(|\b(red|green)\b/i.test(r), `${dir}: no fixed colour in "${r.trim()}"`);
    assert.match(css, /\.codes-bar \{[^}]*background: var\(--panel\); color: var\(--text\);/, `${dir}: panel and text`);
    assert.match(css, /\.codes-row \.icon \{[^}]*color: var\(--link\);/, `${dir}: icon in the link colour`);
    assert.ok(ratio(v('text'), v('panel')) >= 7, `${dir}: text on the bar ${ratio(v('text'), v('panel')).toFixed(2)}:1`);
    assert.ok(ratio(v('link'), v('panel')) >= 3, `${dir}: tag, arrow and underline ${ratio(v('link'), v('panel')).toFixed(2)}:1`);
    // The words carry the meaning: no red or green pair in the bar (the owner cannot tell them apart, lessons L35).
    assert.match(readFileSync(`sites/${dir}/public/assets/icons.svg`, 'utf8'), /<symbol id="tag" viewBox="0 0 24 24" fill="none" stroke="currentColor"/, `${dir}: the tag icon`);
    // New stylesheet (12 Nov 2026: the compact phone hero and aria-current): a new asset version (lessons L31), the same
    // on every site.
    assert.match(site.assetVersion, new RegExp(`^2026-11-12-${dir}-codes-2$`), `${dir}: asset version`);
  }
  const layout = readFileSync('tools/layout-check.mjs', 'utf8');
  assert.match(layout, /\{ name: 'phone-360', width: 360,/);
  assert.match(layout, /the discount codes bar sits between the masthead row and the menu \(L115\)/);
  assert.match(readFileSync('tools/qa-gate.mjs', 'utf8'), /check\('L115'/);
});

test('L30, L115: a phone keeps the hero search and "Browse by category" on the first screen in every language, with both bars', async () => {
  // The browser check (tools/layout-check.mjs, every site job of the checks): 390 px and 360 px, English and the 10 other
  // languages, the country bar and the codes bar added when the page has none, 620 px at most.
  const layout = readFileSync('tools/layout-check.mjs', 'utf8');
  assert.match(layout, /const FIRST_SCREEN = 620;/);
  assert.match(layout, /const LANGUAGES = \['en-GB', 'de-DE', 'el-GR', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pt-PT', 'ro-RO', 'ru-RU', 'sq-AL'\];/);
  assert.match(layout, /for \(const vp of viewports\.filter\(v => v\.isMobile\)\)/, 'both phone sizes');
  assert.match(layout, /search box and "Browse by category" on the first screen \(L30, L115\)/);
  // The bars it adds are the engine's own HTML, with the longest words of the codes bar.
  assert.match(layout, /import \{ ukBarHtml, codesBarFor \} from '\.\.\/src\/pages\/layout\.js';/);
  assert.equal(toString(codesBarFor([{ kind: 'code' }, { kind: 'code' }, { kind: 'sale' }, { kind: 'coupon' }])).match(/data-i18n="([^"]*)"/)[1], '{0} active codes and offers');
  // The stylesheet: on a phone the title uses the full width and the country bar fewer lines; every language but English
  // gets a slightly smaller title (smaller again at 360 px), and the longest site name keeps the Saved list on its row.
  const sites = await allSites();
  for (const { dir } of Object.values(sites)) {
    const css = readFileSync(`sites/${dir}/public/assets/site.css`, 'utf8');
    const phone = css.slice(css.indexOf('@media (max-width: 699px) {\n  .prefs-row'));
    assert.match(phone, /\.hero h1 \{ max-width: none; font-size: 1\.9rem; margin-bottom: 0; \}/, `${dir}: full-width title`);
    assert.match(phone, /\.country-row \{ padding-top: 5px; padding-bottom: 5px; font-size: \.82rem; line-height: 1\.3; \}/, `${dir}: slim country bar`);
    assert.match(phone, /html:not\(:lang\(en\)\) \.hero h1 \{ font-size: 1\.7rem; line-height: 1\.1; \}/, `${dir}: long languages`);
    assert.match(phone, /@media \(max-width: 380px\) \{\n {2}\.brand-name \{ font-size: 1\.04rem; \}[\s\S]*?html:not\(:lang\(en\)\) \.hero h1 \{ font-size: 1\.5rem; \}/, `${dir}: 360 px`);
    // At 360 px the categories of the footer are one column: two columns of long Russian words moved the page sideways.
    assert.match(phone, /@media \(max-width: 380px\) \{[^}]*\}[\s\S]*?\.footer-grid section:first-child ul \{ columns: 1; \}\n\}/, `${dir}: footer list at 360 px`);
    // Nothing of the hero is hidden on a phone: the search box, the button and the words stay.
    assert.ok(!/\.hero[^{]*\{[^}]*display: none/.test(phone) && !/\.hero-search[^{]*\{[^}]*(display: none|visibility: hidden)/.test(css), `${dir}: nothing hidden`);
  }
});
