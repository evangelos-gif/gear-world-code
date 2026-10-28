// Buying guides (/guides/, lessons L82): live prices and stock from the database, rows and cards hidden when a
// product is gone, a note when something changed since the guide was written, facts only (no "tested", no scores),
// and every text of every guide page in every dictionary of the site (lessons L24).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from '../../src/engine.js';
import * as db from '../../src/db.js';
import { guidePage, guidesIndexPage, guideProductIds, guideChanged, pencePer, guidePath } from '../../src/pages/guides.js';
import { sitemapStatic } from '../../src/seo.js';
import { translatableTexts } from './i18n-keys.mjs';
import wgw from '../../sites/wgw/site.config.js';
import agw from '../../sites/agw/site.config.js';
import cgw from '../../sites/cgw/site.config.js';
import tgw from '../../sites/tgw/site.config.js';

const SITES = { wgw, agw, cgw };
const LANGS = ['el-GR', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'pt-PT', 'nl-NL', 'sq-AL', 'ro-RO', 'ru-RU'];

// Products as the database would give them, at the price each guide was written with, all in stock.
function productsFor(guide, change = {}) {
  return guideProductIds(guide).flatMap(id => {
    const c = change[id] || {};
    if (c.gone) return [];
    return [{
      id, product_name: `Product ${id}`, product_slug: `product-${id}`, retailer: c.retailer || 'Shop',
      price: c.price ?? guide.prices[id], currency: 'GBP', in_stock: c.out ? 0 : 1, last_seen_at: c.seen || '2026-10-24 10:00:00'
    }];
  });
}
const render = (site, guide, products) => {
  db.useLayout(site);
  return guidePage(site, guide, products);
};

// All words of a guide that a reader sees, for the wording checks.
function guideWords(g) {
  const out = [g.title, g.description, ...g.lead, g.howWeChose];
  for (const b of g.blocks) {
    out.push(b.heading || '');
    if (b.type === 'text') out.push(...b.paragraphs);
    if (b.type === 'offers') { out.push(...b.columns, ...(b.notes || [])); for (const r of b.rows) out.push(...r.cells); }
    if (b.type === 'table') for (const row of b.rows) for (const c of row) out.push(typeof c === 'string' ? c : (c && c.text) || '');
    if (b.type === 'picks') for (const it of b.items) out.push(it.pros, it.cons, it.forWho, it.skip);
  }
  return out;
}

test('guides: WGW, AGW and CGW have one each; every product id they show has the price it was written with', () => {
  assert.deepEqual(Object.values(SITES).map(s => s.guides.map(g => g.slug)), [['perfume-gift-sets-under-30'], ['battery-charger-or-jump-starter'], ['makita-vs-dewalt']]);
  assert.ok(!tgw.guides, 'a site without guides has none');
  for (const site of Object.values(SITES)) {
    for (const g of site.guides) {
      assert.match(g.slug, /^[a-z0-9-]{1,80}$/);
      assert.match(g.written, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(g.description.length <= 160, `${g.slug}: meta description ${g.description.length} characters`);
      for (const id of guideProductIds(g)) assert.ok(Number(g.prices[id]) > 0, `${site.code} ${g.slug}: price for ${id}`);
    }
  }
});

test('guides: facts only. "tested" only as "not tested"/"do not test", no scores or stars, no link or HTML inside a text', () => {
  for (const site of Object.values(SITES)) {
    for (const g of site.guides) {
      for (const w of guideWords(g)) {
        for (const m of w.matchAll(/\btest(ed|s|ing)?\b/gi)) {
          const before = w.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
          assert.ok(/(not |do not )$/.test(before), `${g.slug}: "${w.slice(0, 80)}"`);
        }
        assert.ok(!/\b(reviewed|rated|our verdict|\d(\.\d)?\s*\/\s*10|★)/i.test(w), `${g.slug}: "${w.slice(0, 80)}"`);
        assert.ok(!/[<>]|https?:\/\//.test(w), `${g.slug}: no HTML or link inside "${w.slice(0, 60)}"`);
      }
      assert.match(g.howWeChose, /^We have not tested/);
    }
  }
});

test('guides: with nothing changed, every row and card is there, no change note, oldest price date, Article schema', () => {
  for (const site of Object.values(SITES)) {
    const g = site.guides[0];
    const products = productsFor(g, { [guideProductIds(g)[0]]: { seen: '2026-10-06 09:00:00' } });
    const html = render(site, g, products);
    assert.ok(!guideChanged(g, new Map(products.map(p => [p.id, p]))));
    assert.ok(!html.includes('guide-changed'), site.code);
    const cards = g.blocks.filter(b => b.type === 'picks').reduce((n, b) => n + b.items.length, 0);
    assert.equal((html.match(/<section class="guide-pick">/g) || []).length, cards, site.code);
    assert.match(html, /data-i18n="Prices checked \{0\}, may change\." data-i18n-0="6 Oct 2026" data-i18n-0-date="2026-10-06"/);
    assert.match(html, /"@type":"Article","headline":/);
    assert.match(html, /<link rel="canonical" href="https:\/\/[a-z]+\.com\/guides\/[a-z0-9-]+\/">/);
    // Each card's button goes through /out/ (click log, Awin), never straight to a shop.
    assert.ok(!/href="https?:\/\/(?!(www\.makitatools|www\.dewalt|[a-z]+gearworld|gearworldhub))/.test(html.split('<main')[1].split('</main>')[0]), site.code);
    assert.match(html, /class="btn btn-deal" href="\/out\/\d+" rel="sponsored nofollow noopener"/);
  }
});

test('guides: a product out of stock loses its price cell; when no shop has it, its row and its card are hidden and the note shows', () => {
  const g = cgw.guides[0];
  // The DeWalt battery is only at My Tool Shed (26479): gone -> its row and card 5 go, the Makita battery stays.
  let html = render(cgw, g, productsFor(g, { 26479: { out: true } }));
  assert.ok(!html.includes('>DeWalt DCB182 Battery<'), 'row hidden');
  assert.ok(!html.includes('DeWalt DCB182 18V XR 4 Ah Battery'), 'card hidden');
  assert.ok(html.includes('Makita BL1850B 18V LXT 5 Ah Battery'));
  assert.match(html, /<span>6\.<\/span> <a href="\/product\/product-37328-37328\/" translate="no">Makita BL1850B/, 'card numbers stay as written');
  assert.match(html, /class="guide-changed"><span data-i18n="Some prices or stock have changed since we wrote this guide on \{0\}\./);
  // One of two shops gone: the row stays, that cell is empty and the price links to the other shop.
  html = render(cgw, g, productsFor(g, { 875: { gone: true } }));
  assert.ok(html.includes('>DeWalt DCK266P2 Twin Kit<'));
  assert.ok(!html.includes('/product/product-875-875/'));
  assert.ok(html.includes('/product/product-29689-29689/'));
});

test('guides: a new price shows in the tables and cards, with the note; the cheapest shop wins', () => {
  const g = agw.guides[0];
  const html = render(agw, g, productsFor(g, { 2965: { price: 24.5, retailer: 'Tooled Up' } }));
  assert.match(html, /class="guide-changed"/);
  assert.match(html, /<h3><span>1\.<\/span> <a href="\/product\/product-2965-2965\/" translate="no">Sealey 100HF/);
  assert.match(html, /data-price="24.50" data-currency="GBP">£24\.50<\/span> <span class="retailer" translate="no">Tooled Up<\/span>/);
  assert.match(html, /<td><a href="\/product\/product-2965-2965\/" translate="no"><span class="price" data-price="24.50"/, '"From (our shops)" is the new lowest');
});

test('guides: price per ml from the lowest price, as written in the guide (14.0p, 14.5p, 73p, 97p, 89p)', () => {
  assert.equal(pencePer(13.99, 100), '14.0p');
  assert.equal(pencePer(10.85, 75), '14.5p');
  assert.equal(pencePer(28.99, 200), '14.5p');
  assert.equal(pencePer(14.59, 20), '73p');
  assert.equal(pencePer(29, 30), '97p');
  assert.equal(pencePer(8.88, 10), '89p');
  const g = wgw.guides[0];
  const html = render(wgw, g, productsFor(g));
  for (const p of ['89p', '14.5p', '14.0p', '73p', '97p']) assert.ok(html.includes(`<td translate="no">${p}</td>`), p);
});

test('guides: every text of the guide pages and the guides list is in every dictionary of the site, same {placeholders}', () => {
  const digits = s => (s.match(/\d/g) || []).sort().join('');
  for (const [code, site] of Object.entries(SITES)) {
    const g = site.guides[0];
    const pages = [render(site, g, productsFor(g)), render(site, g, productsFor(g, { [guideProductIds(g)[0]]: { price: 1 } })), guidesIndexPage(site)];
    const keys = new Set();
    for (const p of pages) for (const k of translatableTexts(p)) keys.add(k);
    const words = new Set(guideWords(g));
    for (const lang of LANGS) {
      const dict = JSON.parse(readFileSync(`sites/${code}/public/assets/i18n/${lang}.json`, 'utf8').replace(/^﻿/, ''));
      for (const k of keys) {
        assert.ok(Object.hasOwn(dict, k), `${code} ${lang}: "${k.slice(0, 70)}"`);
        assert.equal((dict[k].match(/\{\d+\}/g) || []).sort().join(), (k.match(/\{\d+\}/g) || []).sort().join(), `${code} ${lang}: ${k}`);
        if (words.has(k)) assert.equal(digits(dict[k]), digits(k), `${code} ${lang}: the same numbers in "${k.slice(0, 70)}"`);
      }
    }
  }
});

test('guides: /guides/ and the guide answer on a site that has them, 404 elsewhere; sitemap and footer link', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync('tests/fixtures/ggw-legacy-schema.sql', 'utf8'));
  sql.exec(readFileSync('tests/fixtures/cgw-seed.sql', 'utf8'));
  const g = cgw.guides[0];
  const add = sql.prepare(`INSERT OR REPLACE INTO products (id, awin_product_id, retailer, site_category, product_name, price, currency, stock_status, affiliate_url, is_active, updated_at)
    VALUES (?, ?, ?, 'Power Tools', ?, ?, 'GBP', 'In Stock', 'https://www.awin1.com/pclick.php?p=1&a=1&m=1', 1, '2026-10-06 20:49:24')`);
  for (const id of guideProductIds(g)) add.run(id, String(id), id % 2 ? 'Tooled Up' : 'My Tool Shed', `Guide product ${id}`, g.prices[id]);
  const stmt = (text, args = []) => ({
    bind: (...a) => stmt(text, a),
    all: async () => ({ results: sql.prepare(text).all(...args).map(r => ({ ...r })) }),
    first: async () => { const r = sql.prepare(text).get(...args); return r ? { ...r } : null; },
    run: async () => ({ meta: { changes: Number(sql.prepare(text).run(...args).changes) } })
  });
  const env = { DB: { prepare: text => stmt(text), batch: async list => Promise.all(list.map(s => s.all())) } };
  const worker = createWorker(cgw);
  const get = path => worker.fetch(new Request(`https://constructiongearworld.com${path}`), env, { waitUntil: p => p });

  const list = await get('/guides/');
  assert.equal(list.status, 200);
  const listHtml = await list.text();
  assert.ok(listHtml.includes(`<a href="${guidePath(g)}">${g.title}</a>`));
  assert.ok(listHtml.includes('<li><a href="/guides/">Buying guides</a></li>'), 'footer link');
  const page = await get(guidePath(g));
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes('Makita vs DeWalt: which 18V cordless system should you buy?'));
  assert.match(html, /data-i18n-0="6 Oct 2026"/);
  assert.equal((await get('/guides')).status, 301);
  assert.equal((await get('/guides/nothing-here/')).status, 404);
  assert.ok(sitemapStatic(cgw).includes('<loc>https://constructiongearworld.com/guides/makita-vs-dewalt/</loc>'));
  assert.ok(!sitemapStatic(tgw).includes('/guides/'));
  const t = await createWorker(tgw).fetch(new Request('https://technologygearworld.com/guides/'), { DB: env.DB }, { waitUntil: p => p });
  assert.equal(t.status, 404);
});

test('guides: the products are read by primary key only ("+p.is_active", lessons L51/L82)', async () => {
  let text = '';
  const fake = { prepare: t => { text = t; return { bind: () => ({ all: async () => ({ results: [] }) }) }; } };
  for (const site of [agw, cgw]) {
    db.useLayout(site);
    await db.getGuideProducts(fake, [1, 2, 3]);
    assert.match(text, /WHERE \+p\.is_active = 1 AND p\.id IN \(\?,\?,\?\)$/, site.code);
  }
});
