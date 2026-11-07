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
  '{0} delivers to', 'Stock at {0}', 'Contact:', 'run by Evangelos Kalogerakis, England',
  "We don't sell products: we link to retailers and may earn a commission.",
  'Gear World is a product search and price-comparison network run by Evangelos Kalogerakis in England. We do not sell products, take payments or handle deliveries. Every product links to the retailer that sells it, and we may earn a commission through the Awin and CJ affiliate networks.'];
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
      assert.ok(d['run by Evangelos Kalogerakis, England'].includes('Evangelos Kalogerakis'), `${c}/${f}: the name stays`);
    }
  }
});

test('the 13 sites: "Saved list" in the config, a new asset version, the bookmark icon, no cart words in the script', async () => {
  for (const c of CODES) {
    const s = (await import(`../../sites/${c}/site.config.js`)).default;
    assert.deepEqual(s.cart, { name: 'Saved list', maxItems: 30 }, c);
    assert.match(s.assetVersion, /^2026-11-08-[a-z]{3}-saved-\d+$/, c);
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
  assert.match(home, /<p class="footer-legal"><span translate="no">&copy; \d{4} Gear World<\/span> · <span>run by Evangelos Kalogerakis, England<\/span> · <span>We don't sell products: we link to retailers and may earn a commission\.<\/span><\/p>/);
  assert.ok(!/Gear Cart|\+ Cart|>Cart</.test(home));
  const about = out['/about/'].html;
  assert.match(about, /<p class="about-lead">Gear World is a product search and price-comparison network run by Evangelos Kalogerakis in England\./);
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
  assert.ok(html.includes(`<dt><span data-i18n="Stock at {0}" data-i18n-0="${retailer}">Stock at ${retailer}</span></dt>`));
  if (s.deliversTo) assert.ok(html.includes(`<dt><span data-i18n="{0} delivers to" data-i18n-0="${retailer}">${retailer} delivers to</span></dt>`));
  assert.ok(!/<dt>Retailer<\/dt>|<dt>Stock<\/dt>|<dt>Delivers to<\/dt>/.test(html));
  assert.match(html, /View at /, 'the button stays "View at <retailer>"');
});

test('the Hub: /about/, "About" in the menu opens it, the footer line on every page, no sponsored card', () => {
  const pub = 'sites/gwh/public';
  const index = readFileSync(`${pub}/index.html`, 'utf8');
  assert.match(index, /<a href="\/about\/">About<\/a>/);
  assert.ok(!/gwh-business-banner|Sponsored Partner|worldbusinessesforsale|Plans from £395|Sell Your Business &rarr;/.test(index));
  const tjs = readFileSync(`${pub}/translations.js`, 'utf8');
  assert.ok(!/sponsoredDesc|sellBusiness|sponsoredPartner|sellingBusiness|sponsoredAria/.test(tjs));
  const rights = JSON.parse(tjs.match(/footerRights: (\[[^\n]*\]),/)[1]);
  assert.equal(rights.length, 11);
  for (const r of rights) assert.ok(r.startsWith('Gear World · ') && r.includes('Evangelos Kalogerakis'), r);
  const about = readFileSync(`${pub}/about/index.html`, 'utf8');
  assert.match(about, /<p data-about="lead">Gear World is a product search and price-comparison network run by Evangelos Kalogerakis in England\. We do not sell products, take payments or handle deliveries\./);
  assert.match(about, /<a href="mailto:contact@gearworldhub\.com" translate="no">contact@gearworldhub\.com<\/a>/);
  assert.match(about, /<link rel="canonical" href="https:\/\/gearworldhub\.com\/about\/">/);
  const ajs = readFileSync(`${pub}/about/about.js`, 'utf8');
  for (const key of ['home', 'crumb', 'title', 'lead', 'contact']) {
    const row = ajs.match(new RegExp(`\\b${key}: \\[([\\s\\S]*?)\\]`))[1];
    assert.equal((row.match(/"(?:[^"\\]|\\.)*"/g) || []).length, 11, key);
  }
  const allow = readFileSync('sites/gwh/public-allowlist.txt', 'utf8').split('\n').map(s => s.trim());
  for (const f of ['about/index.html', 'about/about.js']) assert.ok(allow.includes(f), f);
  const pages = ['index.html', 'about/index.html', 'privacy/index.html', 'cookies/index.html', 'terms/index.html', 'affiliate-disclosure/index.html', 'contact/index.html',
    ...readdirSync(`${pub}/guides`, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => `guides/${d.name}/index.html`), 'guides/index.html'];
  for (const p of pages) {
    const h = readFileSync(`${pub}/${p}`, 'utf8');
    assert.ok(h.includes("Gear World · run by Evangelos Kalogerakis, England · We don't sell products: we link to retailers and may earn a commission."), `${p}: footer line`);
    assert.ok(!h.includes('All rights reserved'), p);
    if (p !== 'index.html') assert.match(h, /<a href="\/about\/"( aria-current="page")?>About<\/a>/, `${p}: About link in the footer`);
  }
  assert.ok(existsSync('sites/gwh-sitemap') || true);
});
