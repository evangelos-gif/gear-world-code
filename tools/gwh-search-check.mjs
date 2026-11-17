#!/usr/bin/env node
// Gear World Hub - the search check list (lessons L177, 17/11/2026). READ-ONLY: GET requests only, never /go/ or /out/.
// Evangelos: "not only the tablets, every product must come out right, in every category, in every store". 65 searches,
// 5 for each Gear World, each with the Gear Worlds that really sell it. A search passes when, for a UK visitor:
//   - the first result comes from a Gear World that sells it, and at least 3 of the first 5 do (or all of them, when
//     fewer came back),
//   - every result delivers to the UK (delivers_to has GB or WORLD),
//   - every site answered (failed_sites is empty).
// "known" marks a gap whose next step is written next to it (it is reported, it does not fail the run).
//
// Usage: node tools/gwh-search-check.mjs                      the live Hub (https://gearworldhub.com)
//        node tools/gwh-search-check.mjs --hub <url>          another Hub address (the preview)
//        node tools/gwh-search-check.mjs --replay             ask the 13 sites the way the Hub does and order the answers
//                                                             with this copy's rankHubResults (a check before a deploy)
//        --out <file>   also write the report there.  Exit code 1 when a search fails.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const UA = 'GearWorldQA-bot/1.0 (+read-only check)';
// The order of the sites in the Hub's registry (the order of the answer).
const ORDER = ['cgw', 'kgw', 'mgw', 'wgw', 'hgw', 'ggw', 'tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw'];

export const SEARCHES = [
  ['drill', ['cgw'], 'Construction Gear World\'s own search gives mostly drill bits for "drill": the sites\' search order (next step of L177, a sites release)'], ['safety boots', ['cgw']], ['angle grinder', ['cgw']], ['hi vis jacket', ['cgw']], ['work trousers', ['cgw', 'mgw']],
  ['laptop', ['tgw', 'pgw']], ['tablet', ['tgw', 'kgw']], ['headphones', ['tgw', 'kgw', 'pgw']], ['gaming keyboard', ['tgw', 'pgw']], ['smartwatch', ['tgw', 'kgw', 'sgw']],
  ['dog bed', ['zgw']], ['cat litter', ['zgw']], ['dog food', ['zgw']], ['dog collar', ['zgw']], ['fish tank', ['zgw'], 'Pets Gear World calls them "aquarium": a word list for the sites\' search (next step of L177)'],
  ['gaming chair', ['pgw']], ['controller', ['pgw', 'tgw']], ['gaming headset', ['pgw', 'tgw']], ['gaming mouse', ['pgw', 'tgw']], ['ps5', ['pgw', 'tgw']],
  ['motorcycle helmet', ['bgw']], ['motorcycle gloves', ['bgw']], ['motorcycle jacket', ['bgw']], ['motorcycle boots', ['bgw']], ['motorcycle cover', ['bgw', 'agw', 'hgw']],
  ['dash cam', ['agw', 'hgw']], ['car seat covers', ['agw', 'hgw']], ['tyre inflator', ['agw']], ['jump starter', ['agw', 'cgw']], ['car vacuum', ['agw', 'hgw']],
  ['suitcase', ['vgw']], ['backpack', ['vgw', 'kgw', 'sgw']], ['travel adapter', ['vgw', 'tgw']], ['neck pillow', ['vgw', 'hgw']], ['tent', ['vgw', 'agw'], 'Travel Gear World\'s tents have no subcategory, so grow tents come first: category clean-up (next step of L177)'],
  ['dumbbells', ['sgw']], ['yoga mat', ['sgw']], ['running shoes', ['sgw', 'mgw', 'wgw', 'kgw']], ['football', ['sgw', 'kgw']], ['resistance bands', ['sgw']],
  ['dress', ['wgw', 'kgw']], ['perfume', ['wgw', 'mgw']], ['handbag', ['wgw']], ['earrings', ['wgw']], ['womens boots', ['wgw']],
  ['mens watch', ['mgw']], ['wallet', ['mgw', 'wgw']], ['shirt', ['mgw', 'cgw']], ['cufflinks', ['mgw']], ['aftershave', ['mgw']],
  ['lego', ['kgw']], ['pram', ['kgw']], ['school shoes', ['kgw']], ['baby monitor', ['kgw']], ['kids bike', ['kgw', 'sgw']],
  ['kettle', ['hgw']], ['duvet', ['hgw']], ['air fryer', ['hgw']], ['vacuum cleaner', ['hgw', 'agw', 'cgw']], ['bedding', ['hgw', 'kgw']],
  ['lawn mower', ['ggw', 'cgw']], ['garden hose', ['ggw', 'cgw']], ['bbq', ['ggw']], ['plant pot', ['ggw', 'hgw']], ['hedge trimmer', ['ggw', 'cgw']]
];

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function viaHub(base, q) {
  const d = await getJson(`${base}/api/search?${new URLSearchParams({ q, country: 'GB' })}`);
  return { results: d.results || [], failed: d.failed_sites || [] };
}

let ranker = null;
const domains = {};
async function viaReplay(q) {
  if (!ranker) {
    ranker = (await import(new URL('../sites/gwh/worker.js', import.meta.url))).rankHubResults;
    for (const k of ORDER) domains[k] = readFileSync(`${repo}sites/${k}/site.config.js`, 'utf8').match(/domain: '([^']+)'/)[1];
  }
  const results = [];
  const failed = [];
  for (const k of ORDER) {
    const u = new URL('/api/products', `https://${domains[k]}`);
    for (const [a, b] of Object.entries({ search: q, page: '1', limit: '8', deliver_to: 'GB', badges: '1', translate: '0' })) u.searchParams.set(a, b);
    try {
      const d = await getJson(u);
      for (const p of (d.products || []).slice(0, 8)) {
        results.push({ site: k, product_name: p.product_name || '', brand: p.brand || '', category: p.site_category || '', subcategory: p.subcategory || '',
          merchant_category: p.merchant_category || '', stock_status: p.stock_status || '', delivers_to: Array.isArray(p.delivers_to) ? p.delivers_to : [] });
      }
    } catch { failed.push(k); }
    await sleep(120);
  }
  return { results: ranker(results, q), failed };
}

export function judge(results, failed, want) {
  const sites = results.map(r => r.site);
  const first = want.includes(sites[0]);
  const top5 = sites.slice(0, 5).filter(s => want.includes(s)).length;
  const top10 = sites.slice(0, 10).filter(s => want.includes(s)).length;
  const enough = top5 >= Math.min(3, sites.slice(0, 5).length);
  const notUk = results.filter(r => { const d = (r.delivers_to || []).filter(Boolean); return d.length > 0 && !d.includes('GB') && !d.includes('WORLD'); }).length;
  return { pass: results.length > 0 && first && enough && notUk === 0 && failed.length === 0, first, top5, top10, notUk, n: results.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const replay = process.argv.includes('--replay');
  const base = (arg('--hub') || 'https://gearworldhub.com').replace(/\/+$/, '');
  const lines = [`Gear World Hub search check (L177), ${new Date().toISOString()}, ${replay ? 'replay with this copy of the ranking' : base}, UK view`];
  let failures = 0;
  let known = 0;
  for (const [q, want, gap] of SEARCHES) {
    let out;
    try { out = replay ? await viaReplay(q) : await viaHub(base, q); }
    catch (e) { out = { results: [], failed: ['hub'] }; }
    const j = judge(out.results, out.failed, want);
    const top = out.results.slice(0, 3).map(r => `${r.site} ${String(r.product_name).slice(0, 38)}`).join(' / ');
    const mark = j.pass ? 'PASS' : gap ? 'KNOWN' : 'FAIL';
    if (!j.pass && gap) known++;
    else if (!j.pass) failures++;
    lines.push(`${mark.padEnd(5)} ${q.padEnd(18)} want ${want.join(',').padEnd(15)} n=${String(j.n).padEnd(3)} top5=${j.top5} top10=${j.top10} notUK=${j.notUk}${out.failed.length ? ` failed=${out.failed.join(',')}` : ''} | ${top}${!j.pass && gap ? ` | ${gap}` : ''}`);
    if (!replay) await sleep(800);
  }
  lines.push(`${SEARCHES.length - failures - known} passed, ${failures} failed, ${known} known gaps`);
  const text = lines.join('\n') + '\n';
  process.stdout.write(text);
  const out = arg('--out');
  if (out) writeFileSync(out, text);
  process.exit(failures ? 1 : 0);
}
