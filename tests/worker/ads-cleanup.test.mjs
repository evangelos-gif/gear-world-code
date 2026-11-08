// Lessons L103: after L101 and L102, a full sweep of every text of the 13 sites, the Hub and gearworldgroup.com still
// found words of a shop or of a partnership: "Shop by category", "12 retailer partners" ("Partnerhändler",
// "συνεργαζόμενα καταστήματα"), "trusted retailers", codes "that retailers give to their affiliate partners", "Shop
// through <site>" and "our retailers" in the codes page description, "From (our shops)" in the Car guide, a hidden
// "Buy" header, the Hub's "partner banners" and "partner links" (the Hub has no affiliate links), "partnership
// enquiries", the Greek "partner shops", the French "paniers" and "Baskets", "Pretend shopping" and "shops" in the gift
// guides, a winter slide promising sales that may not be listed, and the old styles.css with the sponsored-card rules.
// Retailer names inside a translated text ("View at", "Stock at", "Shop at", the codes) were not kept untranslated.
// These tests make sure none of it comes back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import { productCard, viewAt, keepName, tr } from '../../src/pages/layout.js';
import { offersIndexPage, retailerOffersPage, promoBarHtml } from '../../src/pages/offers.js';
import { guidePage, guideProductIds } from '../../src/pages/guides.js';
import * as db from '../../src/db.js';
import { toString } from '../../src/lib/html.js';
import { groupPage, legalPage, legalPaths } from '../../src/group.js';
import group from '../../sites/group/site.config.js';
import { sitemapBody } from '../../tools/gwh-sitemap.mjs';

const CODES = ['agw', 'bgw', 'cgw', 'ggw', 'hgw', 'kgw', 'mgw', 'pgw', 'sgw', 'tgw', 'vgw', 'wgw', 'zgw'];
const LANGS = ['de-DE', 'el-GR', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pt-PT', 'ro-RO', 'ru-RU', 'sq-AL'];
const NOW = Date.parse('2026-11-08T12:00:00Z');

// English words of a shop that sells, ships or takes payment, or that claims a partnership.
const SHOP_EN = /\b(Shop by category|retailer partners?|affiliate partners|trusted retailers|our shops|our stores?|our retailers|our partners|Shop through|partner (banners|links|shops)|partnership|add to (cart|basket|bag)|buy now|order now|free (delivery|shipping)|we (deliver|ship)\b|Gear World retailers|UK (shoppers|retailers)|Pretend shopping)\b/i;
// The same, as the 10 languages of the sites said it before L103 (and "trusted" in each language).
const SHOP_LANGS = /Partnerhändler|Affiliate-Partnern|vertrauenswürdig|Nach Kategorie einkaufen|unsere Händler|συνεργαζόμεν|στους συνεργάτες|αξιόπιστ|Αγορές ανά κατηγορία|στα καταστήματά μας|tiendas? asociadas?|de confianza|Compra por categoría|nuestras tiendas|marchands? partenaires?|partenaires affiliés|de confiance|Acheter par catégorie|nos marchands|negozi? partner|partner affiliati|affidabil|Acquista per categoria|nei nostri negozi|partnerwinkels?|affiliatepartners|betrouwba|Winkelen per categorie|onze winkels|lojas? parceiras?|de confiança|Compre por categoria|as nossas lojas|magazine? partener|partenerilor|de încredere|Cumpără pe categorii|magazinele noastre|магазин(ов)?-партн|своим партн|надёжн|Покупки по категориям|наши магазины|dyqane? partner|partnerëve|besueshm|Bli sipas kategorisë|dyqanet tona/;

test('the 130 dictionaries: the neutral texts in every language, and no shop, partner or "trusted" word left', () => {
  const NEW = ['Browse by category', 'retailer compared', 'retailers compared', '{0} compares prices across retailers.', 'Retailer link',
    'Codes and sales that retailers publish through their affiliate programmes. Every code has an end date and is removed when it ends.',
    'Codes and sales that {0} publishes through its affiliate programme. Every code has an end date and is removed when it ends.'];
  const GONE = ['Shop by category', 'retailer partner', 'retailer partners', '{0} compares prices from trusted retailers.', 'Buy', 'From (our shops)',
    'Codes and sales that retailers give to their affiliate partners. Every code has an end date and is removed when it ends.',
    'Codes and sales that {0} gives to its affiliate partners. Every code has an end date and is removed when it ends.'];
  let files = 0;
  for (const c of CODES) {
    const dir = `sites/${c}/public/assets/i18n`;
    assert.deepEqual(readdirSync(dir).map(f => f.replace('.json', '')).sort(), LANGS, c);
    for (const lang of LANGS) {
      const raw = readFileSync(`${dir}/${lang}.json`, 'utf8');
      const d = JSON.parse(raw);
      for (const k of NEW) assert.ok(d[k] && d[k].trim() && d[k] !== k, `${c}/${lang}: "${k}"`);
      for (const k of GONE) assert.ok(!(k in d), `${c}/${lang}: old "${k}"`);
      if (c === 'agw') assert.ok(d['Lowest price (retailers listed)'] && d['Lowest price (retailers listed)'] !== 'Lowest price (retailers listed)', `agw/${lang}: the guide row`);
      for (const k of NEW.filter(x => x.includes('{0}'))) assert.match(d[k], /\{0\}/, `${c}/${lang}: "${k}" keeps {0}`);
      for (const [k, v] of Object.entries(d)) {
        assert.ok(!SHOP_EN.test(k), `${c}/${lang}: key "${k}"`);
        assert.ok(!SHOP_LANGS.test(v), `${c}/${lang}: "${k}" => "${v}"`);
      }
      // The same layout as before: keys in code-point order, one space, a new line at the end (small diffs).
      const sorted = {};
      for (const k of Object.keys(d).sort()) sorted[k] = d[k];
      assert.equal(raw, JSON.stringify(sorted, null, 1) + '\n', `${c}/${lang}: sorted, as before`);
      files++;
    }
  }
  assert.equal(files, 130);
});

test('the site code and settings: no shop or partner wording in what pages show (comments aside)', () => {
  const sources = [...readdirSync('src/pages').map(f => `src/pages/${f}`), 'src/lib/seasons.js', 'src/lib/promos.js', 'src/group.js',
    ...CODES.map(c => `sites/${c}/site.config.js`), 'sites/agw/guides.js', 'sites/cgw/guides.js', 'sites/wgw/guides.js'];
  for (const f of sources) {
    const code = readFileSync(f, 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    const m = code.match(SHOP_EN);
    assert.ok(!m, `${f}: "${m && m[0]}"`);
    assert.ok(!/visually-hidden">Buy</.test(code), `${f}: a hidden "Buy" header`);
  }
  for (const c of CODES) {
    assert.match(readFileSync(`sites/${c}/site.config.js`, 'utf8'), new RegExp(`assetVersion: '2026-11-08-${c}-cleanup-\\d+'`), `${c}: a new asset version for the new dictionaries (L31)`);
    // The served script, stylesheet and icons have no shop words even in a comment, and no shopping-cart drawing.
    for (const f of ['site.js', 'site.css', 'icons.svg']) {
      const text = readFileSync(`sites/${c}/public/assets/${f}`, 'utf8');
      assert.ok(!/Gear Cart|Shop by category|shopping|\bpartner|sponsor(?!ed nofollow)/i.test(text), `${c}/${f}`);
    }
    assert.ok(!/<symbol id="cart"/.test(readFileSync(`sites/${c}/public/assets/icons.svg`, 'utf8')), `${c}: no cart icon`);
    assert.ok(!/icon: 'cart'/.test(readFileSync(`sites/${c}/site.config.js`, 'utf8')), `${c}: no category with the cart icon`);
  }
  // The gearworldgroup.com page speaks to retailers of "your own promotions", never "official".
  for (const page of [groupPage(group, { products: 1000, retailers: 10 }), ...legalPaths().map(p => legalPage(group, p))]) {
    assert.ok(!/\bofficial\b|\bpartners?\b|sponsored/i.test(page.replace(/rel="[^"]*"/g, '')), 'group page: no official, partner or sponsored');
  }
});

test('tr(): keepName() keeps a retailer name (or a code) in its own translate="no" span, every time it appears', () => {
  assert.deepEqual(keepName('Joybuy'), { text: 'Joybuy', keep: true });
  assert.equal(toString(viewAt('B&Q')), '<span data-i18n="View at {0}" data-i18n-0="B&amp;Q" data-i18n-keep="0">View at <span translate="no">B&amp;Q</span></span>');
  assert.equal(toString(tr('Copy the code, open {0} with the button. {0} sets the terms.', keepName('Very'))),
    '<span data-i18n="Copy the code, open {0} with the button. {0} sets the terms." data-i18n-0="Very" data-i18n-keep="0">Copy the code, open <span translate="no">Very</span> with the button. <span translate="no">Very</span> sets the terms.</span>');
  const site = { code: 'TGW', currency: 'GBP', locale: 'en-GB', assetVersion: 'x' };
  const card = toString(productCard(site, { id: 7, product_name: 'P', brand: 'B', retailer: 'Joybuy', price: 9.99, currency: 'GBP', in_stock: 1, image_url: 'https://img.example/a.jpg', product_slug: 'p', offer_count: 1 }));
  assert.ok(card.includes('<span data-i18n="View at {0}" data-i18n-0="Joybuy" data-i18n-keep="0">View at <span translate="no">Joybuy</span></span></a>'), card);
  // No tr() of a retailer name without keepName() / viewAt() left in the page code.
  for (const f of readdirSync('src/pages').map(x => `src/pages/${x}`)) {
    const code = readFileSync(f, 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/tr\('View at \{0\}', (?!keepName)/.test(code), `${f}: "View at" without the kept name`);
    for (const m of code.matchAll(/\btr\('[^']*\{0\}[^']*', ([a-z]+\.)?retailer\b/g)) assert.fail(`${f}: ${m[0]} without keepName()`);
  }
});

// A real TGW page from the engine, over node:sqlite with the TGW synthetic products (as in ads-review.test.mjs).
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
  const ids = sql.prepare("SELECT id FROM products WHERE is_active = 1 AND stable_key IS NOT NULL ORDER BY id LIMIT 2").all().map(r => r.id);
  const out = {};
  for (const p of paths(ids)) {
    const res = await w.fetch(new Request(`https://${s.domain}${p}`, { headers: { 'User-Agent': 'Mozilla/5.0 test' }, redirect: 'manual' }), env, { waitUntil: x => x });
    out[p] = res.status === 200 ? await res.text() : '';
  }
  return out;
}
const visible = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<(h1|h2|h3|p|span|strong|a|dd|td|li|div|th)\b[^>]*translate="no"[^>]*>[\s\S]*?<\/\1>/g, ' ').replace(/\srel="[^"]*"/g, ' ');

test('TGW pages: "Browse by category", "retailers compared", "compares prices across retailers", kept retailer names', async () => {
  const out = await tgwPages(ids => ['/', `/compare/?ids=${ids.join(',')}`, `/saved/?items=${ids.join(',')}`, '/about/', '/deals/']);
  const home = out['/'];
  assert.match(home, /<a class="btn btn-gold" href="#cats-h">Browse by category<\/a>/);
  assert.match(home, /<h2 id="cats-h">Browse by category<\/h2>/);
  assert.match(home, /<li><strong>[\d,]+<\/strong> <span data-i18n="retailers? compared">retailers? compared<\/span><\/li>/);
  assert.match(home, /<span data-i18n="\{0\} compares prices across retailers\." data-i18n-0="Technology Gear World">Technology Gear World compares prices across retailers\.<\/span>/);
  for (const [path, html] of Object.entries(out)) {
    assert.ok(html, `${path} opens`);
    const m = visible(html).match(SHOP_EN);
    assert.ok(!m, `${path}: "${m && m[0]}"`);
    const views = [...html.matchAll(/<span data-i18n="View at \{0\}"([^>]*)>View at ([\s\S]*?)<\/span><\/a>/g)];
    for (const v of views) assert.ok(/data-i18n-keep="0"/.test(v[1]) && /^<span translate="no">[^<]+<\/span>$/.test(v[2]), `${path}: ${v[0]}`);
    if (path !== '/about/') assert.ok(views.length > 0, `${path}: has "View at" buttons`);
  }
  assert.match(out[Object.keys(out)[1]], /<th scope="row"><span class="visually-hidden">Retailer link<\/span><\/th>/, 'compare: the hidden header of the buttons row');
});

test('discount codes: neutral description, "published through their affiliate programmes", kept retailer names and codes', async () => {
  const tgw = (await import('../../sites/tgw/site.config.js')).default;
  const idx = offersIndexPage(tgw, NOW);
  const desc = idx.match(/<meta name="description" content="([^"]+)">/)[1];
  assert.ok(!/Shop through|our retailers/.test(desc), desc);
  assert.match(desc, /Codes published by the retailers, compared on Technology Gear World\.$/);
  assert.match(idx, /Codes and sales that retailers publish through their affiliate programmes\./);
  // Without any code, the description names nobody: "retailers listed on <site>".
  const none = offersIndexPage({ ...tgw, promos: [] }, NOW).match(/<meta name="description" content="([^"]+)">/)[1];
  assert.match(none, /from retailers listed on Technology Gear World, with end dates\./);
  const slug = (tgw.promos.find(p => p.start <= '2026-11-08' && p.end >= '2026-11-08') || {}).slug;
  assert.ok(slug, 'a running code on 8/11/2026 in the test data');
  const r = retailerOffersPage(tgw, slug, NOW);
  const retailer = tgw.promos.find(p => p.slug === slug).retailer;
  const k = `data-i18n-0="${retailer}" data-i18n-keep="0">`;
  assert.ok(r.includes(`<h1><span data-i18n="{0} discount codes" ${k}<span translate="no">${retailer}</span> discount codes</span></h1>`), 'heading');
  assert.ok(r.includes(`<span data-i18n="Codes and sales that {0} publishes through its affiliate programme. Every code has an end date and is removed when it ends." ${k}Codes and sales that <span translate="no">${retailer}</span> publishes`), 'lede');
  assert.ok(r.includes(`<span data-i18n="Shop at {0}" ${k}Shop at <span translate="no">${retailer}</span></span></a>`), '"Shop at"');
  assert.ok(r.includes(`<span translate="no">${retailer}</span> with the button and enter the code at checkout. <span translate="no">${retailer}</span> sets the final terms`), 'how to use a code: both names kept');
  assert.ok(!/affiliate partners/.test(r));
  const bar = toString(promoBarHtml(tgw, NOW));
  assert.ok(bar.includes(`<span translate="no">${retailer}</span>: `), bar);
  const code = (tgw.promos.find(p => p.kind === 'code' && p.start <= '2026-11-08' && p.end >= '2026-11-08') || {}).code;
  if (/with code/.test(bar)) assert.ok(bar.includes(`with code <span translate="no">${code}</span>`) || /data-i18n-keep="0 3"/.test(bar), bar);
});

test('the Car guide: "Lowest price (retailers listed)", not "From (our shops)"; its buttons keep the retailer name', async () => {
  const agw = (await import('../../sites/agw/site.config.js')).default;
  const g = agw.guides[0];
  const products = guideProductIds(g).map(id => ({ id, product_name: `P ${id}`, product_slug: `p-${id}`, retailer: 'Tooled Up', price: g.prices[id], currency: 'GBP', image_url: 'https://img.example/x.jpg', in_stock: 1, last_seen_at: '2026-10-24 10:00:00' }));
  db.useLayout(agw);
  const html = guidePage(agw, g, products);
  assert.match(html, /<th scope="row">Lowest price \(retailers listed\)<\/th>/);
  assert.ok(!/our shops/.test(html));
  assert.ok(html.includes('<span data-i18n="View at {0}" data-i18n-0="Tooled Up" data-i18n-keep="0">View at <span translate="no">Tooled Up</span></span>'));
});

// ---------- the Hub ----------
const PUB = 'sites/gwh/public';
const hubFiles = () => {
  const out = [];
  const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) { if (e.name !== 'seasonal') walk(p); } else if (/\.(html|js|css|json)$/.test(e.name)) out.push(p); } };
  walk(PUB);
  return out;
};

test('the Hub: no shop, partner, sponsor or basket wording in any page, script or stylesheet, in 11 languages', () => {
  const HUB_BAD = /\bshops?\b|shopping|\bpartners?\b|partnership|sponsor|gwh-business|συνεργαζόμεν|\bpaniers?\b|"Baskets"|Boxing Day and January sales|our retailers|trusted/i;
  const files = [...hubFiles(), 'sites/gwh/guides/guides.json'];
  assert.ok(files.length >= 25, `${files.length} files`);
  for (const f of files) {
    // Image addresses of a retailer's own CDN (cdn.shopify.com) and the toy's own name are not our words.
    const text = readFileSync(f, 'utf8').replace(/https:\/\/cdn\.shopify\.com\/[^"\s]+/g, '').replace(/rel="[^"]*"/g, '');
    const m = text.match(HUB_BAD);
    assert.ok(!m, `${f}: "${m && m[0]}"`);
  }
  // "retailer" is translated inside the other languages (it was left in English in 7 of them).
  const tjs = readFileSync(`${PUB}/translations.js`, 'utf8');
  for (const [lang, word] of [['fr', 'site du marchand'], ['it', 'sito del negozio'], ['es', 'web de la tienda'], ['pt', 'site da loja'], ['sq', 'faqen e dyqanit'], ['ro', 'site-ul magazinului'], ['ru', 'сайте продавца'], ['el', 'ιστοσελίδα του καταστήματος']]) {
    assert.ok(tjs.includes(word), `${lang}: ${word}`);
  }
  assert.ok(!/\b(du|del|do) retailer\b|на сайте retailer|retailer-it|retailerului/.test(tjs), 'no English "retailer" inside another language');
  assert.match(tjs, /cta\.textContent = data\.explore;/);
  // The deals list: the retailer name untranslated, no "shop" class.
  const hjs = readFileSync(`${PUB}/hub-v2.js`, 'utf8');
  assert.match(hjs, /<span class="gwh2-deal-retailer" translate="no">\$\{esc\(d\.retailer\)\}<\/span>/);
  assert.match(readFileSync(`${PUB}/hub-v2.css`, 'utf8'), /\.gwh2-deal-retailer\{/);
});

test('the Hub legal pages say what is there: no affiliate links on the Hub, who runs it, honest dates', () => {
  const disc = readFileSync(`${PUB}/affiliate-disclosure/index.html`, 'utf8');
  assert.match(disc, /<p class="lg-updated">Last updated: 7 November 2026<\/p>/);
  assert.match(disc, /The Hub itself has no affiliate links and no paid placements\./);
  assert.match(disc, /take you to pages of the Gear World sites, never straight to a retailer/);
  const priv = readFileSync(`${PUB}/privacy/index.html`, 'utf8');
  assert.match(priv, /<p class="lg-updated">Last updated: 7 November 2026<\/p>/);
  assert.match(priv, /The Hub itself has no affiliate links; the links to retailers on those sites go through the Awin affiliate network\./);
  const terms = readFileSync(`${PUB}/terms/index.html`, 'utf8');
  assert.match(terms, /<p class="lg-updated">Last updated: 7 November 2026<\/p>/);
  assert.match(terms, /operated by Gear World \(run by Evangelos Kalogerakis, United Kingdom\)/);
  assert.match(readFileSync(`${PUB}/contact/index.html`, 'utf8'), /and for business enquiries from retailers and affiliate networks, email/);
  // The Hub really has no affiliate link: nothing on it goes to Awin, a retailer redirect or /out/ / /go/.
  for (const f of hubFiles()) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!/awin1\.com|\/out\/\d|\/go\/[a-z0-9]/.test(text), `${f}: an affiliate link`);
  }
  // The sites: privacy, cookies and terms changed on 7/11/2026 (L101), so their date says so.
  assert.match(readFileSync('src/pages/info.js', 'utf8'), /const UPDATED = '7 November 2026';/);
});

function hub() {
  const window = { addEventListener() {}, dispatchEvent() {} };
  vm.runInNewContext(readFileSync(`${PUB}/hub-v2.js`, 'utf8'), { window, document: { readyState: 'loading', addEventListener() {} }, URLSearchParams, Intl, console });
  return window.GearWorldHubV2;
}

test('the Hub deals slides speak of the retailers\' codes only while one runs, otherwise of the e-mail sign-up', () => {
  const h = hub();
  const deals = JSON.parse(readFileSync(`${PUB}/hub-deals.json`, 'utf8')).deals;
  const at = d => Date.parse(`${d}T12:00:00Z`);
  const dealsSlides = Array.from(h.campaigns.filter(c => c.href === '#deals').map(c => c.id)).sort();
  assert.deepEqual(dealsSlides, ['black-friday', 'halloween', 'winter-sales']);
  const winter = h.campaigns.find(c => c.id === 'winter-sales');
  const signUp = { text: 'soonText', cta: 'soonCta', href: '#newsletter' };
  assert.deepEqual({ ...h.campaignView(winter, deals, true, at('2026-12-28')) }, { text: 'bfText', cta: 'bfCta', href: '#deals' }, 'a code runs until 31/12');
  assert.deepEqual({ ...h.campaignView(winter, deals, true, at('2027-01-05')) }, signUp, 'no code runs on 5/1/2027');
  assert.deepEqual({ ...h.campaignView(winter, [], true, at('2026-12-28')) }, signUp, 'an empty list');
  assert.deepEqual({ ...h.campaignView(winter, deals, false, at('2026-12-28')) }, signUp, 'while the list is loading');
  for (const id of ['christmas', 'new-year-fitness', 'valentines-day', 'black-friday-soon']) {
    const c = h.campaigns.find(x => x.id === id);
    assert.deepEqual({ ...h.campaignView(c, [], false) }, { text: c.text, cta: c.cta, href: c.href }, `${id} does not depend on the deals`);
  }
  assert.equal(h.hasRealDeals(deals, true, at('2026-12-28')), true);
  assert.equal(h.hasRealDeals(deals, false, at('2026-12-28')), false);
  // The winter slide is named after the season, like the others ("... across 13 Gear Worlds"), never "sales".
  assert.equal(h.strings.salesTitle[0], 'After Christmas across 13 Gear Worlds');
  for (const k of ['salesTitle', 'salesEyebrow']) {
    assert.equal(h.strings[k].length, 11);
    for (const t of h.strings[k]) assert.ok(!/sale|soldes|saldi|rebajas|saldos|uitverkoop|ulje|reduceri|распродаж|εκπτώσ|Schlussverkauf/i.test(t), `${k}: ${t}`);
  }
  // The button of the seasonal video follows the same rule.
  const js = readFileSync(`${PUB}/hub-v2.js`, 'utf8');
  assert.equal((js.match(/hasRealDeals\(deals, dealsLoaded\) \? tx\("bfCta"\) : tx\("soonCta"\)/g) || []).length, 2);
  assert.ok(!/activeDeals\(deals\)\.length \|\| !dealsLoaded/.test(js), 'no "See the deals" before the list has loaded');
  assert.ok(h.strings.ideaTrainers[3] === 'Chaussures de sport');
});

test('the Hub: styles.css (not loaded by the page) keeps no rule of the sponsored card; new ?v= for the changed files', () => {
  const css = readFileSync(`${PUB}/styles.css`, 'utf8');
  assert.ok(!/gwh-business|sponsor|shop/i.test(css));
  const index = readFileSync(`${PUB}/index.html`, 'utf8');
  assert.ok(!/\/styles\.css/.test(index), 'the page does not load styles.css');
  for (const f of ['hub-v2.css', 'translations.js', 'hub-v2.js']) assert.ok(index.includes(`/${f}?v=20261108-cleanup1`), f);
  assert.ok(!/partner/i.test(index));
});

test('the Hub sitemap has /about/ (owner, 7/11/2026); the tools ask this release\'s phrases', async () => {
  const body = await sitemapBody('new');
  assert.ok(body.includes('<loc>https://gearworldhub.com/about/</loc>'));
  const hubTool = readFileSync('tools/gwh-hub-v2.ps1', 'utf8');
  // The release after this one (L105, robots.txt) asks its own phrases.
  assert.ok(hubTool.includes("$PhrasePreview = 'ΕΓΚΡΙΝΩ HUB ROBOTS PREVIEW'") && hubTool.includes("$PhraseLive = 'ΕΓΚΡΙΝΩ HUB ROBOTS LIVE'"));
  assert.ok(hubTool.includes("$PhraseRemovePreview = 'ΕΓΚΡΙΝΩ HUB REMOVE PREVIEW'"));
  const tests = readFileSync('tests/run-tests.ps1', 'utf8');
  assert.ok(tests.includes("'egkrino hub robots preview'") && tests.includes("'egkrino hub robots live'") && !/HUB WORDING|hub wording|HUB CLEANUP|hub cleanup/.test(tests));
  const sitesTool = readFileSync('tools/ads-fixes-sites.ps1', 'utf8');
  assert.ok(sitesTool.includes("$Phrase = 'ΕΓΚΡΙΝΩ ADS FIXES'"));
  assert.ok(sitesTool.includes("'Browse by category'") && sitesTool.includes('data-i18n-keep="0"'), 'the live check looks for the L103 wording');
  // Colours the owner can tell apart (lessons L35): no red or green in the report.
  assert.ok(!/-ForegroundColor (Green|Red)|'(Green|Red)'/.test(sitesTool));
  assert.ok(readFileSync('tools/gwh-sitemap.ps1', 'utf8').includes('13 σελίδες'));
  assert.match(readFileSync('docs/LESSONS.md', 'utf8'), /\n\| L103 \|/);
});
