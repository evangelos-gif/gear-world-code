// Lessons L162 (Manager, 15 Nov 2026, the owner's decision): Polish on the 13 sites. Poland is open (OPEN_COUNTRIES GB, PL)
// and the first country outside the UK to be promoted. Every site has "Polski" in its language menu, PLN among the
// display currencies, and sites/<site>/public/assets/i18n/pl-PL.json with every text of its el-GR.json, in Polish.
// A link with ?lang=pl-PL switches the language like the menu (the links of ads and posts), and a visitor from Poland
// without a choice of their own gets Polish (the Worker names it on the page after the page cache). Google reads
// English, as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker, countryLanguage, COUNTRY_LANGUAGES, MULTI_LANGUAGE_COUNTRIES, withCountryLanguage, withUkBar } from '../../src/engine.js';

const read = f => readFileSync(f, 'utf8');
const SITES = readdirSync('sites').filter(n => existsSync(`sites/${n}/site.config.js`) && existsSync(`sites/${n}/public/assets/site.js`));
const config = {};
for (const s of SITES) config[s] = (await import(`../../sites/${s}/site.config.js`)).default;

// Texts that are the same in Polish and English: names, units, sizes and words Polish uses as they are.
const SAME_IN_POLISH = new Set(['(4 Ah)', '(5 Ah)', '18 V LXT; 5 Ah; Li-ion', '18 V XR; 4 Ah; Li-ion', '2 × 100 ml (200 ml)', '4 × 5 ml (20 ml)',
  '5 × 15 ml (75 ml)', '5 × 20 ml (100 ml)', 'Audio', 'Black Friday', 'EAN / GTIN', 'EDC', 'Gaming', 'Gear World Hub', 'Halloween', 'Joy Day',
  'LXT', 'Streaming', 'XR', 'Hosting.', 'Newsletter.']);
// Words of the English texts that are names or model codes and stay as they are in Polish (brands, retailers, the
// owner, systems): every one that is in an English text is in its Polish text too.
const NAMES = ['Gear World', 'Awin', 'CJ', 'Makita', 'DeWalt', 'Sealey', 'Draper', 'AstroAI', 'My Tool Shed', 'Tooled Up', 'Bazta', 'Plusshop', 'Joybuy',
  'Lattafa', 'Ghost', 'Yara', 'PlayStation', 'Xbox', 'Nintendo', 'Intel NUC', 'Lenovo Tiny', 'Dell', 'CarPlay', 'Android Auto', 'Pinlock', 'Bluetooth',
  'FLEXVOLT', 'ToughSystem', 'Evangelos Kalogerakis', 'DCK266P2', 'DLX2180TJ', 'DCF887', 'SBC6', 'RS600', 'S8', '100HF', 'JavaScript', 'Google', 'JSON',
  'NVMe', 'OBD', 'USB', 'XLR', 'RFID', 'TSA', 'GPS', 'IP66', 'OLED', 'Wi-Fi', 'iPad', 'LCD', 'EFB', 'AGM/GEL', 'Rose, Poppy & Vanilla'];
// Lessons L107 (no price drops, no earlier prices) in Polish, and the shop and partner words of L103 (affiliate is
// "afiliacyjny", never "partnerski").
// ("a nie wcześniejsza cena": the RRP text says that an RRP is NOT an earlier price.)
const PRICE_DROP = /obniżk|obniżon|przecen|spadek cen|była cena|poprzednia cena|(?<!nie )wcześniejsza cena|taniej o \d|oszczędzasz|oszczędź/i;
const PARTNER = /partnersk|partnerz|partnerów|zaufan|Kupuj według kategorii|nasz(e|ych|ymi|ym) sklep/i;
const placeholders = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');

test('L162: the 13 sites have Polski in the menu (after Nederlands), PLN, and a new asset version', () => {
  assert.equal(SITES.length, 13);
  for (const s of SITES) {
    const site = config[s];
    const codes = site.languages.map(l => l.code);
    assert.deepEqual(site.languages.find(l => l.code === 'pl-PL'), { code: 'pl-PL', label: 'Polski' }, s);
    assert.equal(codes.indexOf('pl-PL'), codes.indexOf('nl-NL') + 1, `${s}: after Nederlands`);
    assert.equal(codes.length, 12, `${s}: the 11 languages of the Hub and Polish`);
    assert.deepEqual(site.displayCurrencies, ['GBP', 'EUR', 'PLN', 'ALL', 'RON', 'RUB'], s);
    assert.match(site.assetVersion, new RegExp(`^(2026-11-15-${s}-pl|2026-11-16-${s}-lang|2026-11-17-${s}-legal|2026-11-19-${s}-popup)-\\d+$`), `${s}: browsers load the new site.js (L31)`);
  }
  assert.match(read('src/pages/layout.js'), /PLN: 'zł PLN'/, 'the currency menu says zł PLN');
});

test('L162: pl-PL.json of every site: every text of its el-GR.json, in Polish, in the same layout', () => {
  let files = 0;
  for (const s of SITES) {
    const el = JSON.parse(read(`sites/${s}/public/assets/i18n/el-GR.json`));
    const raw = read(`sites/${s}/public/assets/i18n/pl-PL.json`);
    const pl = JSON.parse(raw);
    assert.deepEqual(Object.keys(pl).sort(), Object.keys(el).sort(), `${s}: the same texts as el-GR`);
    const sorted = {};
    for (const k of Object.keys(pl).sort()) sorted[k] = pl[k];
    assert.equal(raw, JSON.stringify(sorted, null, 1) + '\n', `${s}: sorted, one space, a new line at the end`);
    for (const [k, v] of Object.entries(pl)) {
      assert.ok(typeof v === 'string' && v.trim() && v === v.trim(), `${s}: "${k}" has a text`);
      assert.equal(placeholders(v), placeholders(k), `${s}: the same {0} in "${k}"`);
      if (!SAME_IN_POLISH.has(k)) assert.notEqual(v, k, `${s}: "${k}" is translated`);
      for (const name of NAMES) if (k.includes(name)) assert.ok(v.includes(name), `${s}: "${name}" stays in "${k}" => "${v}"`);
      assert.ok(!PRICE_DROP.test(v), `${s}: no price drop in "${v}" (L107)`);
      assert.ok(!PARTNER.test(v), `${s}: no partner or shop wording in "${v}" (L103)`);
      // Polish letters, not Greek or Cyrillic left from another file.
      assert.ok(!/[Ͱ-ϿЀ-ӿ]/.test(v), `${s}: "${v}"`);
    }
    files++;
  }
  assert.equal(files, 13);
  // The same English text has one Polish text on every site.
  const all = new Map();
  for (const s of SITES) {
    for (const [k, v] of Object.entries(JSON.parse(read(`sites/${s}/public/assets/i18n/pl-PL.json`)))) {
      if (all.has(k)) assert.equal(v, all.get(k), `"${k}" on ${s}`);
      all.set(k, v);
    }
  }
  assert.ok(all.size > 700, `${all.size} texts`);
  // A few that a visitor sees first: the menu, the cards, the bars of the country, the cookies.
  const t = JSON.parse(read('sites/agw/public/assets/i18n/pl-PL.json'));
  assert.equal(t['Search'], 'Szukaj');
  assert.equal(t['Language'], 'Język');
  assert.equal(t['Currency'], 'Waluta');
  assert.equal(t['View at {0}'], 'Zobacz w {0}');
  assert.equal(t['{0} delivers to'], '{0} dostarcza do');
  assert.equal(t['Allow'], 'Zezwól');
  assert.equal(t['Reject'], 'Odrzuć');
  assert.match(t["We're adding retailers for your country. Most retailers below deliver to the UK only. Check delivery before you buy."], /Wielkiej Brytanii/);
  assert.match(t['You are seeing only the products that deliver to {0}.'], /\{0\}/);
});

// The two functions of the site script that choose the language, run as they are (sites/tgw/public/assets/site.js, the
// same file on the 13 sites).
function chooser({ search = '', stored = null, countryLang = '', options = ['en-GB', 'el-GR', 'pl-PL'] } = {}) {
  const js = read('sites/tgw/public/assets/site.js');
  const part = js.slice(js.indexOf('  function knownLang'), js.indexOf('  function loadLanguage'));
  assert.ok(part.includes('function wantedLanguage') && part.length < 2000, 'found in site.js');
  const store = new Map(stored === null ? [] : [['lang', stored]]);
  const ctx = {
    BASE_LANG: 'en-GB',
    URLSearchParams,
    window: { location: { search } },
    document: { querySelector: q => (q === 'select[data-pref="lang"]' ? { options: options.map(value => ({ value })) } : null) },
    root: { getAttribute: name => (name === 'data-country-lang' ? countryLang || null : null) },
    read: (k, fallback) => (store.has(k) ? store.get(k) : fallback),
    write: (k, v) => store.set(k, v)
  };
  vm.runInNewContext(`${part}\nthis.pick = wantedLanguage;`, ctx);
  return { lang: ctx.pick(), stored: store.get('lang') };
}

test('L162: the site script: ?lang= like the menu, Polish for a visitor from Poland without a choice of their own', () => {
  assert.deepEqual(chooser(), { lang: 'en-GB', stored: undefined }, 'nothing: English');
  assert.deepEqual(chooser({ search: '?for=pl&lang=pl-PL&utm_source=pinterest&utm_campaign=pl' }), { lang: 'pl-PL', stored: 'pl-PL' }, 'the Pinterest link: Polish, kept');
  assert.deepEqual(chooser({ search: '?lang=pl-PL', stored: 'el-GR' }), { lang: 'pl-PL', stored: 'pl-PL' }, 'the link is a new choice');
  assert.deepEqual(chooser({ search: '?lang=xx-XX', stored: 'el-GR' }), { lang: 'el-GR', stored: 'el-GR' }, 'a language the site does not have: nothing changes');
  assert.deepEqual(chooser({ search: '?lang=pl-PL', options: ['en-GB', 'el-GR'] }), { lang: 'en-GB', stored: undefined }, 'a site without Polish');
  assert.deepEqual(chooser({ countryLang: 'pl-PL' }), { lang: 'pl-PL', stored: undefined }, 'from Poland: Polish, not kept (the visitor has not chosen)');
  assert.deepEqual(chooser({ countryLang: 'pl-PL', stored: 'en-GB' }), { lang: 'en-GB', stored: 'en-GB' }, 'from Poland, English chosen in the menu: English');
  assert.deepEqual(chooser({ countryLang: 'pl-PL', stored: 'de-DE', options: ['en-GB', 'de-DE', 'pl-PL'] }), { lang: 'de-DE', stored: 'de-DE' }, 'their own choice first');
  assert.deepEqual(chooser({ countryLang: 'pl-PL', options: ['en-GB', 'el-GR'] }), { lang: 'en-GB', stored: undefined }, 'not on the site: English');
  const js = read('sites/tgw/public/assets/site.js');
  assert.match(js, /function loadLanguage\(\) \{\n {4}var wanted = wantedLanguage\(\);/);
  for (const s of SITES) assert.equal(read(`sites/${s}/public/assets/site.js`), js, `${s}: the same site.js`);
});

function memD1(schema) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(schema);
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: 0 } })
  });
  return { prepare: t => stmt(t), batch: async list => Promise.all(list.map(s => s.all())) };
}

test('L162: the Worker names Polish on the page for a visitor from Poland only, never in the cached copy, never for Google', async () => {
  assert.equal(COUNTRY_LANGUAGES.PL, 'pl-PL');
  assert.equal(countryLanguage(config.agw, 'PL'), 'pl-PL');
  assert.equal(countryLanguage(config.agw, 'pl'), 'pl-PL');
  for (const cc of ['GB', 'IE', 'US', 'AU', 'UA', 'TR', '', null]) assert.equal(countryLanguage(config.agw, cc), '', String(cc));
  assert.equal(countryLanguage({ ...config.agw, languages: config.agw.languages.filter(l => l.code !== 'pl-PL') }, 'PL'), '', 'a site without Polish');
  const schema = readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n');
  const DB = memD1(schema + '\n' + read('tests/fixtures/agw-seed.sql'));
  const env = { DB, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } };
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  const worker = createWorker(config.agw);
  const get = async (path, country, headers = {}) => {
    const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test', ...headers } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    const res = await worker.fetch(req, env, { waitUntil: p => p });
    return { res, text: await res.text() };
  };
  try {
    const pl = await get('/', 'PL');
    assert.equal(pl.res.status, 200);
    assert.match(pl.text, /^<!doctype html>\s*<html data-country-lang="pl-PL" lang="en-GB"/i);
    assert.equal(pl.res.headers.get('Cache-Control').split(',')[0], 'private', 'that answer is the visitor\'s only');
    for (const cc of ['GB', 'US', 'BE']) {
      const other = await get('/', cc);
      assert.ok(!other.text.includes('data-country-lang'), cc);
    }
    for (const [res] of store.values ? [...store.values()].map(r => [r]) : []) assert.ok(!(await res.clone().text()).includes('data-country-lang'), 'the cached copies: never');
    // Google's crawlers count as the UK: English, as before. The network's own checks can ask Poland (L158).
    const bot = await get('/', 'PL', { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    assert.ok(!bot.text.includes('data-country-lang'), 'Googlebot from Poland');
    const qa = await get('/', 'US', { 'User-Agent': 'GearWorldQA-bot/1.0 (+read-only check)', 'X-GW-QA-Country': 'PL' });
    assert.ok(qa.text.includes('<html data-country-lang="pl-PL"'), 'the QA check as Poland');
    // A category page and a product page too; JSON answers and the dictionary itself: untouched.
    assert.ok((await get('/category/garage-tools-equipment/', 'PL')).text.includes('data-country-lang="pl-PL"'));
    const api = await get('/api/products?limit=2', 'PL');
    assert.ok(!api.text.includes('data-country-lang'));
    JSON.parse(api.text);
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});

test('L162: the Group page says 12 languages for the sites (the Hub keeps its 11)', () => {
  const g = read('src/group.js');
  assert.ok(g.includes("'12 languages'") && g.includes('Pages in 12 languages,'));
  assert.ok(!/\b11 languages\b/.test(g));
  assert.match(read('sites/group/site.config.js'), /search across every Gear World site, in 11 languages/, 'the Hub: 11');
});

// Lessons L175 (owner, 17 Nov 2026, after Linkwise saw the Greek pages in English): every country whose language the
// sites have opens in it, unless the visitor chose a language; countries with several take the browser's first one.
test('L175: every country with a language of the sites gets it; several languages follow the browser; English otherwise', async () => {
  const codes = config.agw.languages.map(l => l.code);
  for (const [cc, code] of Object.entries(COUNTRY_LANGUAGES)) {
    assert.ok(codes.includes(code), `${cc}: ${code} is a language of the sites`);
    for (const key of Object.keys(config)) {
      const site = config[key];
      if (!site || !Array.isArray(site.languages)) continue;
      assert.equal(countryLanguage(site, cc), site.languages.some(l => l.code === code) ? code : '', `${key} ${cc}`);
    }
  }
  const want = { GR: 'el-GR', CY: 'el-GR', DE: 'de-DE', AT: 'de-DE', FR: 'fr-FR', IT: 'it-IT', ES: 'es-ES', MX: 'es-ES', PT: 'pt-PT', BR: 'pt-PT', NL: 'nl-NL', PL: 'pl-PL', AL: 'sq-AL', XK: 'sq-AL', RO: 'ro-RO', MD: 'ro-RO', RU: 'ru-RU' };
  for (const [cc, code] of Object.entries(want)) assert.equal(countryLanguage(config.agw, cc), code, cc);
  assert.equal(countryLanguage(config.agw, 'gr'), 'el-GR', 'lower case country');
  // Never English speakers, and no guess where the country speaks a language the sites do not have.
  for (const cc of ['GB', 'IE', 'US', 'CA', 'AU', 'NZ', 'MT', 'UA', 'TR', 'SE', 'CZ', 'HU', 'BG', 'HR', 'DK', 'FI', 'NO']) assert.equal(countryLanguage(config.agw, cc), '', cc);
  // Belgium, Switzerland, Luxembourg: the browser decides, among the country's own languages only.
  assert.deepEqual(MULTI_LANGUAGE_COUNTRIES, { BE: ['nl-NL', 'fr-FR', 'de-DE'], CH: ['de-DE', 'fr-FR', 'it-IT'], LU: ['fr-FR', 'de-DE'], CA: ['fr-FR'] });
  // Overseas France and the Dutch Caribbean report their own codes; Canada is French only when the browser says so.
  for (const cc of ['RE', 'GP', 'MQ', 'GF', 'YT', 'NC', 'PF']) assert.equal(countryLanguage(config.agw, cc), 'fr-FR', cc);
  for (const cc of ['AW', 'CW', 'SX', 'BQ']) assert.equal(countryLanguage(config.agw, cc), 'nl-NL', cc);
  assert.equal(countryLanguage(config.agw, 'CA', 'fr-CA,fr;q=0.9,en;q=0.8'), 'fr-FR');
  assert.equal(countryLanguage(config.agw, 'CA', 'en-CA,fr;q=0.5'), '');
  // The browser's weights: q=0 is "not this one", and a higher q comes first whatever the order.
  assert.equal(countryLanguage(config.agw, 'BE', 'fr;q=0, nl;q=0.9'), 'nl-NL');
  assert.equal(countryLanguage(config.agw, 'BE', 'de;q=0.3, fr;q=0.8'), 'fr-FR');
  assert.equal(countryLanguage(config.agw, 'CH', 'en;q=0.2, it'), 'it-IT');
  for (const cc of Object.keys(MULTI_LANGUAGE_COUNTRIES)) assert.ok(!(cc in COUNTRY_LANGUAGES), cc);
  const cases = [
    ['BE', 'fr-BE,fr;q=0.9,en;q=0.8', 'fr-FR'], ['BE', 'nl-BE,nl;q=0.9', 'nl-NL'], ['BE', 'en-GB,nl;q=0.8', ''],
    ['BE', 'it-IT,it;q=0.9', ''], ['BE', '', ''], ['BE', null, ''], ['CH', 'de-CH', 'de-DE'], ['CH', 'it-CH,de;q=0.5', 'it-IT'],
    ['CH', '*, fr;q=0.5', 'fr-FR'], ['LU', 'lb-LU,fr;q=0.8', 'fr-FR'], ['LU', 'pt-PT,de;q=0.7', 'de-DE'], ['GR', 'en-GB', 'el-GR']
  ];
  for (const [cc, header, code] of cases) assert.equal(countryLanguage(config.agw, cc, header), code, `${cc} ${header}`);

  // In the Worker: the page names it for a visitor from Greece, and for Belgium by the browser; never in the cached copy.
  const schema = readdirSync('sites/agw/migrations').sort().map(f => read(`sites/agw/migrations/${f}`)).join('\n');
  const DB = memD1(schema + '\n' + read('tests/fixtures/agw-seed.sql'));
  const env = { DB, CLICK_LOG: 'off', FX_FETCH: async () => { throw new Error('offline'); } };
  const store = new Map();
  const before = globalThis.caches;
  globalThis.caches = { default: {
    match: async key => (store.has(key.url) ? store.get(key.url).clone() : undefined),
    put: async (key, res) => { store.set(key.url, res); }
  } };
  const worker = createWorker(config.agw);
  const get = async (path, country, headers = {}) => {
    const req = new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test', ...headers } });
    if (country) Object.defineProperty(req, 'cf', { value: { country } });
    const res = await worker.fetch(req, env, { waitUntil: p => p });
    return { res, text: await res.text() };
  };
  try {
    const gr = await get('/', 'GR');
    assert.match(gr.text, /<html data-country-lang="el-GR"/i);
    assert.equal(gr.res.headers.get('Cache-Control').split(',')[0], 'private');
    assert.match((await get('/', 'BE', { 'Accept-Language': 'fr-BE,fr;q=0.9' })).text, /<html data-country-lang="fr-FR"/i);
    assert.ok(!(await get('/', 'BE', { 'Accept-Language': 'en-GB' })).text.includes('data-country-lang'));
    assert.ok(!(await get('/', 'GB')).text.includes('data-country-lang'));
    for (const res of store.values()) assert.ok(!(await res.clone().text()).includes('data-country-lang'), 'the cached copies: never');
    const bot = await get('/', 'GR', { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    assert.ok(!bot.text.includes('data-country-lang'), 'Googlebot from Greece reads English');
    for (const ua of ['Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'facebookexternalhit/1.1'])
      assert.ok(!(await get('/', 'RU', { 'User-Agent': ua })).text.includes('data-country-lang'), `no crawler: ${ua}`);
    assert.ok((await get('/', 'GR', { 'User-Agent': 'Mozilla/5.0 (Linux; Android 9; CUBOT P30) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' })).text.includes('data-country-lang="el-GR"'), 'a Cubot phone is a person');
    assert.ok((await get('/', 'US', { 'User-Agent': 'GearWorldQA-bot/1.0 (+read-only check)', 'X-GW-QA-Country': 'GR' })).text.includes('data-country-lang="el-GR"'), 'the network\'s own check as Greece');
    // L174: the Hub's search links (/?search=…&highlight=…) keep the language the visitor chose on the Hub.
    const row = await DB.prepare('SELECT id FROM products WHERE is_active = 1 LIMIT 1').first();
    const hop = async (path) => { const r = await worker.fetch(new Request(`https://cargearworld.com${path}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' }, redirect: 'manual' }), env, { waitUntil: p => p }); return { status: r.status, to: r.headers.get('Location') || '' }; };
    const toProduct = await hop(`/?search=tyre&highlight=${row.id}&lang=el-GR`);
    assert.equal(toProduct.status, 302);
    assert.match(toProduct.to, /^https:\/\/cargearworld\.com\/[^?]+\?lang=el-GR$/, toProduct.to);
    assert.equal((await hop('/?search=tyre&lang=de-DE')).to, 'https://cargearworld.com/search?q=tyre&lang=de-DE');
    assert.equal((await hop('/?search=tyre&lang=xx-XX')).to, 'https://cargearworld.com/search?q=tyre', 'a language the site does not have is dropped');
    assert.equal((await hop('/?search=tyre')).to, 'https://cargearworld.com/search?q=tyre', 'nothing asked, nothing added');
  } finally {
    if (before === undefined) delete globalThis.caches; else globalThis.caches = before;
  }
});

test('L175: the site script keeps the visitor\'s own choice first, then the country language, then English', () => {
  for (const site of ['agw', 'tgw', 'hgw', 'cgw', 'zgw']) {
    const js = read(`sites/${site}/public/assets/site.js`);
    const i = js.indexOf('function wantedLanguage()');
    const body = js.slice(i, js.indexOf('\n  }', i));
    assert.ok(i > 0, site);
    assert.ok(body.indexOf("get('lang')") < body.indexOf("read('lang'") && body.indexOf("read('lang'") < body.indexOf('data-country-lang'), `${site}: ?lang=, then the menu choice, then the country`);
  }
});

test('L175: an answer that must not be kept (no-store) stays so with the country language; any other becomes private', async () => {
  const page = cc => new Response('<!doctype html><html lang="en-GB"><body>x</body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cc } });
  const a = await withCountryLanguage(page('no-store'), 'el-GR');
  assert.equal(a.headers.get('Cache-Control'), 'no-store');
  assert.match(await a.text(), /data-country-lang="el-GR"/);
  assert.equal((await withCountryLanguage(page('public, max-age=300'), 'el-GR')).headers.get('Cache-Control'), 'private, max-age=60');
  // The UK bar comes after it on the same answer, with the same rule.
  const withBar = await withUkBar(await withCountryLanguage(page('no-store'), 'el-GR'));
  assert.equal(withBar.headers.get('Cache-Control'), 'no-store');
  assert.equal((await withUkBar(page('public, max-age=300'))).headers.get('Cache-Control'), 'private, max-age=60');
});
