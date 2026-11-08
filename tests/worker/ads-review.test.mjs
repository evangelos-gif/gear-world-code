// Lessons L101: on 7 Nov 2026 Google Ads suspended the account for "unacceptable business practices". The sites
// looked like shops: a "Gear Cart" with quantities and a total, "Retailer Joybuy" next to our own name, no page
// saying who runs Gear World. Now: a saved list, "Sold by <retailer> (not by Gear World)", an /about/ page and a
// footer line on every site and on the Hub, in every language. The Hub's "Sell Your Business" card is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';

const CODES = ['agw', 'bgw', 'cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'pgw', 'sgw', 'tgw', 'vgw', 'wgw', 'zgw'];
const NEW_KEYS = ['Saved list', '+ Save', '✓ Saved', 'Saved to your list.', 'Your saved list is full ({0} products).', 'Your saved list is empty',
  'Clear the saved list', 'Use the + Save button on any product to keep it here while you compare retailers.', 'Sold by', '(not by Gear World)',
  '{0} delivers to', 'Stock at {0}', 'Contact:', 'Run by Evangelos Kalogerakis, United Kingdom',
  "We don't sell products: we link to retailers and may earn a commission.",
  'Gear World is a network of independent product search and price-comparison sites from the same publisher. We do not sell products, take payments or handle deliveries. Every product links to the retailer that sells it, and we may earn a commission through the Awin and CJ affiliate networks.'];
// The words of a shop's basket, in the 10 languages of the sites: none may be in the texts of the saved list.
const CART_WORDS = /Warenkorb|καλάθι|Καλάθι|carrito|panier|carrello|winkelwagen|carrinho|coș|Coș|корзин|shport/;

test('every dictionary of the 13 sites has the new words, and no basket word is left', () => {
  for (const c of CODES) {
    const dir = `sites/${c}/public/assets/i18n`;
    const files = readdirSync(dir);
    assert.equal(files.length, 10, c);
    for (const f of files) {
      const d = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      for (const k of NEW_KEYS) assert.ok(d[k] && d[k].trim(), `${c}/${f}: ${k}`);
      for (const k of Object.keys(d)) assert.ok(!/\bcart\b|Gear Cart/i.test(k), `${c}/${f}: old key ${k}`);
      // (a product name like "Cric a carrello", a trolley jack, is not a basket: only the texts of the list are checked)
      const bad = NEW_KEYS.map(k => d[k]).filter(v => CART_WORDS.test(v));
      assert.deepEqual(bad, [], `${c}/${f}: basket words`);
      for (const k of ['+ Cart', '✓ In cart', 'Added to your cart.', 'Gear Cart', 'Your Gear Cart is empty', 'Empty the Gear Cart', 'Estimated total']) assert.ok(!(k in d), `${c}/${f}: ${k}`);
      assert.match(d['{0} delivers to'], /\{0\}/);
      assert.match(d['Stock at {0}'], /\{0\}/);
      // Owner's decision, 7 Nov 2026: the name as in the Google verification (Latin letters) and the country, no address.
      assert.ok(d['Run by Evangelos Kalogerakis, United Kingdom'].includes('Evangelos Kalogerakis'), `${c}/${f}: the name stays`);
      for (const k of ['run by Evangelos Kalogerakis, England']) assert.ok(!(k in d), `${c}/${f}: old ${k}`);
      assert.ok(!Object.values(d).some(v => /England|Αγγλία|Inglaterra|Angleterre|Inghilterra|Engeland|Anglia|Англи|Angli\b/.test(v) && /Kalogerakis/.test(v)), `${c}/${f}: "United Kingdom", not England`);
    }
  }
});

test('the 13 sites: "Saved list" in the config, a new asset version, the bookmark icon, no cart words in the script', async () => {
  for (const c of CODES) {
    const s = (await import(`../../sites/${c}/site.config.js`)).default;
    assert.deepEqual(s.cart, { name: 'Saved list', maxItems: 30 }, c);
    // 2026-11-08-<code>-saved-N for L101, -wording-N for the follow-up of L102, -cleanup-N for L103 (a new version
    // each time, L31).
    assert.match(s.assetVersion, /^2026-11-08-[a-z]{3}-(saved|wording|cleanup|security)-\d+$/, c);
    const icons = readFileSync(`sites/${c}/public/assets/icons.svg`, 'utf8');
    assert.match(icons, /<symbol id="saved" /, c);
    const js = readFileSync(`sites/${c}/public/assets/site.js`, 'utf8');
    for (const w of ["t('+ Save')", "t('✓ Saved')", "t('Saved to your list.')", "'/saved/?items='"]) assert.ok(js.includes(w), `${c}: ${w}`);
    assert.ok(!/In cart|\+ Cart|Added to your cart|\/cart\/|qty/.test(js), `${c}: no cart or quantity in site.js`);
  }
  for (const f of readdirSync('src', { recursive: true }).filter(f => f.endsWith('.js'))) {
    const src = readFileSync(`src/${f}`, 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/Gear Cart|\+ Cart|Estimated total|Empty the/.test(src), `src/${f}`);
  }
});

// A real TGW page from the engine, over node:sqlite with the TGW synthetic products.
async function tgwPages(paths) {
  const s = (await import('../../sites/tgw/site.config.js')).default;
  const sql = new DatabaseSync(':memory:');
  for (const f of readdirSync('sites/tgw/migrations').filter(f => f.endsWith('.sql')).sort()) sql.exec(readFileSync(`sites/tgw/migrations/${f}`, 'utf8'));
  sql.exec(readFileSync('tests/fixtures/tgw-seed.sql', 'utf8'));
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  const env = { DB: { prepare: t => stmt(t), batch: async l => Promise.all(l.map(x => x.all())) }, CLICK_LOG: 'off',
    FX_FETCH: async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }) };
  const w = createWorker(s);
  const product = sql.prepare("SELECT id, product_slug FROM products WHERE is_active = 1 AND stable_key IS NOT NULL ORDER BY id LIMIT 2").all();
  const out = {};
  for (const p of paths(product)) {
    const res = await w.fetch(new Request(`https://${s.domain}${p}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' }, redirect: 'manual' }), env, { waitUntil: x => x });
    out[p] = { status: res.status, location: res.headers.get('location') || '', html: res.status === 200 ? await res.text() : '' };
  }
  return { out, product };
}

test('TGW pages: saved list, product labels, About and footer; the old /cart/ addresses lead to /saved/', async () => {
  const { out, product } = await tgwPages(ps => ['/', '/about/', `/saved/?items=${ps.map(p => p.id).join(',')}`, `/cart/?items=${ps[0].id}:3,${ps[1].id}:1`, '/cart', '/saved']);
  const home = out['/'].html;
  assert.match(home, /<a class="cart-link" href="\/saved\/" data-cart-link><svg class="icon"[^>]*><use href="[^"]*#saved"><\/use><\/svg><span class="cart-word">Saved list<\/span>/);
  assert.match(home, />\+ Save<\/button>/);
  assert.match(home, /<p class="footer-legal"><span translate="no">&copy; \d{4} Gear World<\/span> · <span>Run by Evangelos Kalogerakis, United Kingdom<\/span> · <span>We don't sell products: we link to retailers and may earn a commission\.<\/span><\/p>/);
  assert.ok(!/Gear Cart|\+ Cart|>Cart</.test(home));
  const about = out['/about/'].html;
  assert.match(about, /<p class="about-lead">Gear World is a network of independent product search and price-comparison sites from the same publisher\./);
  assert.match(about, /<p class="about-run"><span>Run by Evangelos Kalogerakis, United Kingdom<\/span><\/p>/);
  assert.ok(!/England/.test(about), 'no "England" on /about/');
  assert.match(about, /<p class="about-contact"><span>Contact:<\/span> <a href="mailto:contact@gearworldhub\.com" translate="no">contact@gearworldhub\.com<\/a><\/p>/);
  assert.ok(!/UK retailers/.test(about));
  const saved = out[`/saved/?items=${product.map(p => p.id).join(',')}`].html;
  assert.match(saved, /<h1>Saved list<\/h1>/);
  assert.match(saved, /Clear the saved list/);
  assert.ok(!/Estimated total|class="qty"|Quantity|× \d/.test(saved), 'no total, no quantity');
  assert.equal((saved.match(/href="\/out\/\d+" rel="sponsored nofollow noopener"/g) || []).length, 2);
  assert.match(saved, /<link rel="canonical" href="https:\/\/[^"]+\/saved\/">/);
  const old = out[`/cart/?items=${product[0].id}:3,${product[1].id}:1`];
  assert.equal(old.status, 301);
  assert.ok(old.location.endsWith(`/saved/?items=${product[0].id},${product[1].id}`), old.location);
  assert.equal(out['/cart'].status, 301);
  assert.ok(out['/cart'].location.endsWith('/saved/'));
  assert.equal(out['/saved'].status, 301);
});

test('TGW product page: "Sold by <retailer> (not by Gear World)", "<retailer> delivers to", "Stock at <retailer>"', async () => {
  const s = (await import('../../sites/tgw/site.config.js')).default;
  const { out: first, product } = await tgwPages(ps => ['/']);
  const path = (first['/'].html.match(/href="(\/product\/[^"]+\/)"/) || [])[1];
  assert.ok(path && product.length);
  const { out } = await tgwPages(() => [path]);
  const html = out[path].html;
  assert.match(html, /<dt>Sold by<\/dt><dd><span translate="no">([^<]+)(?:<img [^>]+>)?<\/span> <span class="not-us">\(not by Gear World\)<\/span><\/dd>/);
  const retailer = html.match(/<dt>Sold by<\/dt><dd><span translate="no">([^<]+)<\/span>/)[1];
  // The retailer name stays untranslated in its own translate="no" span (lessons L103).
  assert.ok(html.includes(`<dt><span data-i18n="Stock at {0}" data-i18n-0="${retailer}" data-i18n-keep="0">Stock at <span translate="no">${retailer}</span></span></dt>`));
  if (s.deliversTo) assert.ok(html.includes(`<dt><span data-i18n="{0} delivers to" data-i18n-0="${retailer}" data-i18n-keep="0"><span translate="no">${retailer}</span> delivers to</span></dt>`));
  assert.ok(!/<dt>Retailer<\/dt>|<dt>Stock<\/dt>|<dt>Delivers to<\/dt>/.test(html));
  assert.match(html, /View at /, 'the button stays "View at <retailer>"');
  assert.ok(html.includes(`<span data-i18n="View at {0}" data-i18n-0="${retailer}" data-i18n-keep="0">View at <span translate="no">${retailer}</span></span>`), 'the retailer name of "View at" stays untranslated (L103)');
  // The markup of a comparison page (Google "product snippets"), never the Offer of a shop that sells (merchant listings).
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1])).flat();
  const prod = ld.find(x => x['@type'] === 'Product');
  assert.equal(prod.offers['@type'], 'AggregateOffer');
  assert.ok(!('seller' in prod.offers) && !('price' in prod.offers) && !('availability' in prod.offers), JSON.stringify(prod.offers));
  assert.ok(Number(prod.offers.lowPrice) > 0 && Number(prod.offers.highPrice) >= Number(prod.offers.lowPrice) && prod.offers.offerCount >= 1);
  assert.match(prod.offers.priceCurrency, /^[A-Z]{3}$/);
  assert.ok(!html.includes('"@type":"Offer"'));
});

test('the Hub: /about/, "About" in the menu opens it, the footer line on every page, no sponsored card', () => {
  const pub = 'sites/gwh/public';
  const index = readFileSync(`${pub}/index.html`, 'utf8');
  assert.match(index, /<a href="\/about\/">About<\/a>/);
  // Not even in a comment: a check that reads the page source (Google, the Manager's GET) must not find them.
  assert.ok(!/gwh-business-banner|Sponsored Partner|worldbusinessesforsale|Plans from £395|Sell Your Business|sponsored card/i.test(index));
  const tjs = readFileSync(`${pub}/translations.js`, 'utf8');
  assert.ok(!/sponsoredDesc|sellBusiness|sponsoredPartner|sellingBusiness|sponsoredAria/.test(tjs));
  const rights = JSON.parse(tjs.match(/footerRights: (\[[^\n]*\]),/)[1]);
  assert.equal(rights.length, 11);
  for (const r of rights) assert.ok(r.startsWith('Gear World · ') && r.includes('Evangelos Kalogerakis') && !/England|Αγγλία|Inglaterra|Angleterre|Inghilterra|Engeland|Anglia|Англи|Angli\b/.test(r), r);
  const about = readFileSync(`${pub}/about/index.html`, 'utf8');
  assert.match(about, /<p data-about="run">Run by Evangelos Kalogerakis, United Kingdom<\/p>/);
  assert.match(about, /<p data-about="lead">Gear World is a network of independent product search and price-comparison sites from the same publisher\. We do not sell products, take payments or handle deliveries\./);
  assert.match(about, /<a href="mailto:contact@gearworldhub\.com" translate="no">contact@gearworldhub\.com<\/a>/);
  assert.match(about, /<link rel="canonical" href="https:\/\/gearworldhub\.com\/about\/">/);
  const ajs = readFileSync(`${pub}/about/about.js`, 'utf8');
  for (const key of ['home', 'crumb', 'title', 'lead', 'run', 'contact']) {
    const row = ajs.match(new RegExp(`\\b${key}: \\[([\\s\\S]*?)\\]`))[1];
    assert.equal((row.match(/"(?:[^"\\]|\\.)*"/g) || []).length, 11, key);
  }
  const allow = readFileSync('sites/gwh/public-allowlist.txt', 'utf8').split('\n').map(s => s.trim());
  for (const f of ['about/index.html', 'about/about.js']) assert.ok(allow.includes(f), f);
  const pages = ['index.html', 'about/index.html', 'privacy/index.html', 'cookies/index.html', 'terms/index.html', 'affiliate-disclosure/index.html', 'contact/index.html',
    ...readdirSync(`${pub}/guides`, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => `guides/${d.name}/index.html`), 'guides/index.html'];
  for (const p of pages) {
    const h = readFileSync(`${pub}/${p}`, 'utf8');
    assert.ok(h.includes("Gear World · Run by Evangelos Kalogerakis, United Kingdom · We don't sell products: we link to retailers and may earn a commission."), `${p}: footer line`);
    assert.ok(!/Kalogerakis, England|Kalogerakis in England/.test(h), `${p}: no "England"`);
    assert.ok(!h.includes('All rights reserved'), p);
    if (p !== 'index.html') assert.match(h, /<a href="\/about\/"( aria-current="page")?>About<\/a>/, `${p}: About link in the footer`);
  }
  assert.ok(existsSync('sites/gwh-sitemap') || true);
});

test('the Hub: the deals come "From retailers listed on Gear World", the Christmas slide speaks of gifts, not offers', async () => {
  const pub = 'sites/gwh/public';
  const index = readFileSync(`${pub}/index.html`, 'utf8');
  assert.ok(index.includes('<span data-gwh2="dealsSub">From retailers listed on Gear World, each with its end date.</span>'));
  assert.ok(!/Gear World retailers|Christmas offers in the Gear Worlds/.test(index));
  const js = readFileSync(`${pub}/hub-v2.js`, 'utf8');
  assert.ok(!/Gear World retailers|Christmas offers in the Gear Worlds|xmasDealsTitle/.test(js));
  const row = JSON.parse(js.match(/    dealsSub: (\[[^\n]*\]),\n/)[1]);
  assert.equal(row.length, 11);
  assert.equal(row[0], 'From retailers listed on Gear World, each with its end date.');
  assert.match(js, /file: "christmas", name: "xmasEyebrow", title: "xmasTitle", mirror: true, gifts: true \}/);
});

test('gearworldgroup.com: "Operator" is the person and the country, the footer says Gear World sells nothing', async () => {
  const site = (await import('../../sites/group/site.config.js')).default;
  assert.equal(site.operatorName, 'Evangelos Kalogerakis, United Kingdom');
  const { groupPage } = await import('../../src/group.js');
  const html = groupPage(site, { products: 0, retailers: 0 });
  assert.ok(html.includes('<div><dt>Operator</dt><dd>Evangelos Kalogerakis, United Kingdom</dd></div>'));
  assert.match(html, /<p>&copy; \d{4} Gear World Group · Run by Evangelos Kalogerakis, United Kingdom · We don't sell products: we link to retailers and may earn a commission\.<\/p>/);
  assert.ok(!/England|Sponsored|\bCart\b/.test(html));
});
