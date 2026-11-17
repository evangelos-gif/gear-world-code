#!/usr/bin/env node
// The 13 sites' OWN search, checked with the 65 searches of Gear World Hub (tools/gwh-search-check.mjs, lessons L177).
// READ-ONLY: GET requests only, with the QA identity, never /go/ or /out/. For every search and every Gear World that
// sells it, the site's own first 8 for a UK visitor (deliver_to=GB) are judged by the Hub's rules: the first result is
// the item itself and not an accessory of it, no look-alike in the first 3, every result delivers to the UK, the site
// answered. Lessons L179: "drill" on Construction Gear World showed drill bits first because the sites ordered a search
// "featured" (in stock, then a fixed shuffle), not by what the product is.
//
// Usage: node tools/sites-search-check.mjs              the live sites, in their own order
//        node tools/sites-search-check.mjs --replay     the live sites' matches (up to 600 each), ordered by this copy's
//                                                       src/lib/search-rank.js (the check before an ALL UPDATES)
//        --only cgw,hgw   only these sites.   --out <file>   also write the report there.   Exit 1 when a search fails.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEARCHES, judge } from './gwh-search-check.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const UA = 'GearWorldQA-bot/1.0 (+read-only check)';
const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const domainOf = k => readFileSync(`${repo}sites/${k}/site.config.js`, 'utf8').match(/domain: '([^']+)'/)[1];

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: controller.signal });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

// One page of a site's own search, as the Hub asks for it (no translation: the words are English).
async function page(k, q, n, limit) {
  const u = new URL('/api/products', `https://${domainOf(k)}`);
  for (const [a, b] of Object.entries({ search: q, page: String(n), limit: String(limit), deliver_to: 'GB', translate: '0' })) u.searchParams.set(a, b);
  const d = await getJson(u);
  return { products: d.products || [], more: Boolean(d.pagination && d.pagination.has_more), total: Number(d.pagination && d.pagination.total) || 0 };
}
const asResult = (k, p) => ({ site: k, id: p.id, product_name: p.product_name || '', brand: p.brand || '', category: p.site_category || '',
  category_slug: p.category_slug || '', subcategory: p.subcategory || '', merchant_category: p.merchant_category || '',
  in_stock: p.stock_status === 'in_stock' ? 1 : 0, stock_status: p.stock_status || '', delivers_to: Array.isArray(p.delivers_to) ? p.delivers_to : [] });

// A site that does not sell the item at all (its data, not its order): known, with the next step. The Hub's list names
// every Gear World that sells it, and the Hub still finds it on the others.
export const SITE_GAPS = {
  'mgw work trousers': 'data: Men\'s Gear World has no work trousers (its one match is workout pants); Construction Gear World has them: a workwear retailer for MGW (Retailers & Feeds)',
  'sgw smartwatch': 'data: Sporty Gear World has no smartwatches; Technology and Kids\' Gear World have them: a sports-watch retailer (Retailers & Feeds)',
  'agw motorcycle cover': 'data: Car Gear World has no motorbike covers; Biker and Home Gear World have them',
  'sgw kids bike': 'data: Sporty Gear World has no kids\' bikes; Kids\' Gear World has them'
};

let rank = null;
async function siteResults(k, q, replay) {
  if (!replay) return { results: (await page(k, q, 1, 8)).products.slice(0, 8).map(p => asResult(k, p)), total: null };
  if (!rank) rank = await import(new URL('../src/lib/search-rank.js', import.meta.url));
  const all = [];
  let total = 0;
  for (let n = 1; n <= 10; n++) {
    const got = await page(k, q, n, 60);
    total = got.total;
    all.push(...got.products.map(p => asResult(k, p)));
    if (!got.more) break;
    await sleep(150);
  }
  const cfg = (await import(new URL(`../sites/${k}/site.config.js`, import.meta.url))).default;
  const plan = rank.searchPlan(q, { code: k, categories: cfg.categories || [] });
  return { results: plan ? plan.order(all).slice(0, 8) : all.slice(0, 8), total };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const replay = process.argv.includes('--replay');
  const only = (arg('--only') || '').split(',').filter(Boolean);
  const lines = [`Gear World sites' own search check (L179), ${new Date().toISOString()}, ${replay ? 'replay: the live matches in this copy\'s order (src/lib/search-rank.js)' : 'the live order'}, UK view`];
  let failures = 0;
  let known = 0;
  let checked = 0;
  for (const [q, want, gap, item] of SEARCHES) {
    for (const k of want) {
      if (only.length && !only.includes(k)) continue;
      checked++;
      let out;
      try { out = await siteResults(k, q, replay); } catch { await sleep(2000); try { out = await siteResults(k, q, replay); } catch { out = { results: [], failed: true }; } }
      const j = judge(out.results, out.failed ? [k] : [], [k], q, item);
      // A gap of the Hub's list that is the site's own (its data, not its order) stays known here too.
      const siteGap = SITE_GAPS[`${k} ${q}`] || '';
      const gapText = siteGap || (gap && !/own search/i.test(gap) ? gap : '');
      const gapRule = gapText ? String(gapText).split(':')[0] : '';
      // A data gap excuses only a missing or wrong item, never a look-alike or a result that does not deliver to the UK.
      const excused = !j.pass && gapText && j.broken.every(b => b === gapRule || ((gapRule === 'site' || gapRule === 'data') && ['site', 'top5', 'item', 'empty'].includes(b)));
      const mark = j.pass ? 'PASS' : excused ? 'KNOWN' : 'FAIL';
      if (excused) known++; else if (!j.pass) failures++;
      const top = out.results.slice(0, 3).map(r => String(r.product_name).slice(0, 40)).join(' / ');
      lines.push(`${mark.padEnd(5)} ${k} ${q.padEnd(18)} n=${String(j.n).padEnd(2)}${out.total !== null && out.total !== undefined ? ` of ${out.total}` : ''}${j.broken.length ? ` rules=${j.broken.join(',')}` : ''} | ${top}${excused ? ` | ${gapText}` : ''}`);
      await sleep(replay ? 200 : 400);
    }
  }
  lines.push(`${checked - failures - known} passed, ${failures} failed, ${known} known gaps (${checked} site searches)`);
  const text = lines.join('\n') + '\n';
  process.stdout.write(text);
  const out = arg('--out');
  if (out) writeFileSync(out, text);
  process.exit(failures ? 1 : 0);
}
