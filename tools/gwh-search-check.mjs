#!/usr/bin/env node
// Gear World Hub - the search check list (lessons L177, 17/11/2026). READ-ONLY: GET requests only, never /go/ or /out/.
// Evangelos: "not only the tablets, every product must come out right, in every category, in every store". 65 searches,
// 5 for each Gear World, each with the Gear Worlds that really sell it. A search passes when, for a UK visitor:
//   - the first result comes from a Gear World that sells it and is the item itself (its name or category has the last
//     word of the search), at least 3 of the first 5 come from such a Gear World (or all of them, when fewer came back),
//   - no look-alike (toy, tassel, sauce, towel, cufflinks, costume, sticker ...) is in the first 3, unless asked for,
//   - every result delivers to the UK (delivers_to has GB or WORLD),
//   - every site answered (failed_sites is empty).
// "known" marks a gap whose next step is written next to it (it is reported, it does not fail the run). A site that does
// not answer in 4.5 s, twice, is "SLOW" (the site's speed, lessons L74): reported, not counted as a wrong order.
//
// Usage: node tools/gwh-search-check.mjs                      the live Hub (https://gearworldhub.com)
//        node tools/gwh-search-check.mjs --hub <url>          another Hub address (the preview)
//        node tools/gwh-search-check.mjs --replay             ask the 13 sites the way the Hub does and order the answers
//                                                             with this copy's rankHubResults (a check before a deploy)
//        --sentences    also the searches typed as a sentence or with a price (Idea 9, L180): the Hub must say what it
//                       understood (`understood`) and keep to the price; with --replay this copy's rules read them
//        --only <a|b>   only the searches named (exactly, separated by |), e.g. --only "tablet|laptop under 500"
//        --out <file>   also write the report there.  Exit code 1 when a search fails.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const UA = 'GearWorldQA-bot/1.0 (+read-only check)';
// The order of the sites in the Hub's registry (the order of the answer).
const ORDER = ['cgw', 'kgw', 'mgw', 'wgw', 'hgw', 'ggw', 'tgw', 'agw', 'vgw', 'sgw', 'bgw', 'pgw', 'zgw'];

export const SEARCHES = [
  ['drill', ['cgw'], 'top5: Construction Gear World\'s own search gives mostly drill bits for "drill": the sites\' search order (next step of L177, a sites release)'], ['safety boots', ['cgw']], ['angle grinder', ['cgw']], ['hi vis jacket', ['cgw'], '', 'jacket'], ['work trousers', ['cgw', 'mgw']],
  ['laptop', ['tgw', 'pgw']], ['tablet', ['tgw', 'kgw']], ['headphones', ['tgw', 'kgw', 'pgw']], ['gaming keyboard', ['tgw', 'pgw']], ['smartwatch', ['tgw', 'kgw', 'sgw']],
  ['dog bed', ['zgw']], ['cat litter', ['zgw']], ['dog food', ['zgw']], ['dog collar', ['zgw']], ['fish tank', ['zgw'], 'site: Pets Gear World has no fish tanks yet (its "aquarium" products are water care and plants): a retailer with tanks (Retailers & Feeds, next step of L177)'],
  ['gaming chair', ['pgw']], ['controller', ['pgw', 'tgw']], ['gaming headset', ['pgw', 'tgw']], ['gaming mouse', ['pgw', 'tgw']], ['ps5', ['pgw', 'tgw'], '', 'ps5'],
  ['motorcycle helmet', ['bgw']], ['motorcycle gloves', ['bgw']], ['motorcycle jacket', ['bgw']], ['motorcycle boots', ['bgw']], ['motorcycle cover', ['bgw', 'agw', 'hgw']],
  ['dash cam', ['agw', 'hgw']], ['car seat covers', ['agw', 'hgw']], ['tyre inflator', ['agw']], ['jump starter', ['agw', 'cgw']], ['car vacuum', ['agw', 'hgw']],
  ['suitcase', ['vgw']], ['backpack', ['vgw', 'kgw', 'sgw']], ['travel adapter', ['vgw', 'tgw']], ['neck pillow', ['vgw', 'hgw']], ['tent', ['vgw', 'agw'], 'site: Travel Gear World\'s tents have no subcategory, so grow tents come first: category clean-up (next step of L177)'],
  ['dumbbells', ['sgw']], ['yoga mat', ['sgw']], ['running shoes', ['sgw', 'mgw', 'wgw', 'kgw']], ['football', ['sgw', 'kgw']], ['resistance bands', ['sgw']],
  ['dress', ['wgw', 'kgw']], ['perfume', ['wgw', 'mgw']], ['handbag', ['wgw']], ['earrings', ['wgw']], ['womens boots', ['wgw']],
  ['mens watch', ['mgw']], ['wallet', ['mgw', 'wgw']], ['shirt', ['mgw', 'cgw']], ['cufflinks', ['mgw']], ['aftershave', ['mgw']],
  ['lego', ['kgw']], ['pram', ['kgw']], ['school shoes', ['kgw']], ['baby monitor', ['kgw']], ['kids bike', ['kgw', 'sgw']],
  ['kettle', ['hgw'], 'lookalike: a hotpot sauce sits in Home Gear World\'s "Kettle" category: category clean-up of the sites (next step of L177)'], ['duvet', ['hgw']], ['air fryer', ['hgw']], ['vacuum cleaner', ['hgw', 'agw', 'cgw']], ['bedding', ['hgw', 'kgw']],
  ['lawn mower', ['ggw', 'cgw']], ['garden hose', ['ggw', 'cgw']], ['bbq', ['ggw']], ['plant pot', ['ggw', 'hgw']], ['hedge trimmer', ['ggw', 'cgw']]
];

// Idea 9 (L180): searches typed as a sentence or with a price, for a UK visitor (the check's user agent is a bot's, so
// only the rules read them, never the model): [search, Gear Worlds that sell it, known gap, item, max £, min £].
export const SENTENCES = [
  ['i want to buy a tablet', ['tgw', 'kgw'], '', 'tablet'], ['tablet under £200', ['tgw', 'kgw'], '', 'tablet', 200],
  ['need new car tyre', ['agw'], '', 'tyre'], ['running shoes for my son', ['kgw', 'sgw'], '', 'shoe'],
  ['perfume for her', ['wgw'], '', 'perfume'], ['bed for my dog', ['zgw'], '', 'bed'],
  ['laptop under 500', ['tgw', 'pgw'], '', 'laptop', 500], ['headphones between £20 and £60', ['tgw', 'kgw', 'pgw'], '', 'headphone', 60, 20]
];

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJson(url, signal) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function viaHub(base, q) {
  const d = await getJson(`${base}/api/search?${new URLSearchParams({ q, country: 'GB' })}`);
  return { results: d.results || [], failed: d.failed_sites || [], understood: d.understood || null };
}

let ranker = null;
let understand = null;
const domains = {};
async function viaReplay(q, sentence = false) {
  if (!ranker) {
    const hub = await import(new URL('../sites/gwh/worker.js', import.meta.url));
    ranker = hub.rankHubResults;
    understand = hub.understandQuery;
    for (const k of ORDER) domains[k] = readFileSync(`${repo}sites/${k}/site.config.js`, 'utf8').match(/domain: '([^']+)'/)[1];
  }
  // A sentence is read by this copy's rules the way the Hub reads it for a bot (L180): the product words, the price.
  const u0 = sentence ? understand(q) : null;
  const understood = u0 && u0.changed ? u0 : null;
  const term = understood ? understood.item : q;
  const results = [];
  const failed = [];
  for (const k of ORDER) {
    const u = new URL('/api/products', `https://${domains[k]}`);
    for (const [a, b] of Object.entries({ search: term, page: '1', limit: '8', deliver_to: 'GB', badges: '1', translate: '0' })) u.searchParams.set(a, b);
    if (understood && understood.max_price !== null) u.searchParams.set('max', String(understood.max_price));
    if (understood && understood.min_price !== null) u.searchParams.set('min', String(understood.min_price));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500); // the Hub waits 4.5 s for a site (L74)
    try {
      const d = await getJson(u, controller.signal);
      const seen = new Set();
      for (const p of (d.products || []).slice(0, 8)) {
        if (p.id === null || p.id === undefined || seen.has(String(p.id))) continue; // as the Hub does
        seen.add(String(p.id));
        // As the Hub does (L180): a price written in a currency holds only for prices in that currency.
        if (understood && understood.currency && p.currency && String(p.currency).toUpperCase() !== understood.currency) continue;
        results.push({ site: k, product_name: p.product_name || '', brand: p.brand || '', category: p.site_category || '', subcategory: p.subcategory || '',
          merchant_category: p.merchant_category || '', stock_status: p.stock_status || '', delivers_to: Array.isArray(p.delivers_to) ? p.delivers_to : [],
          price: p.price, currency: p.currency || null });
      }
    } catch { failed.push(k); } finally { clearTimeout(timer); }
    await sleep(120);
  }
  return { results: ranker(results, term, understood && understood.site), failed, understood };
}

// Look-alikes that must not be in the first 3 unless the search asks for them (the check of 17/11/2026 found tassels for
// "womens boots", a sauce for "kettle", a toy perfume kit for "perfume").
const LOOK_ALIKES = /\b(toys?|pretend|tassels?|sauces?|towels?|cufflinks?|costumes?|stickers?|posters?|decals?)\b/i;
const ACCESSORY_WORDS = /^(stand|case|cover|pocket|strap|holder|mount|charger|cable|protector|sleeve|pouch|bracket|adapter|adaptor|brush|bit|blade|refill|replacement|spare|descaler|band)s?$|\b(stands?|cases?|covers?|pockets?|straps?|holders?|mounts?|chargers?|cables?|protectors?|sleeves?|pouch|brackets?|adapters?|brush|bits?|blades?|refills?|replacements?|spares?|descaler|bands?)\b/i;
const words = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['\u2019]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const stem = w => w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 4 && w.endsWith('ie') ? w.slice(0, -2) + 'y' : w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w) ? w.slice(0, -1) : w;
// The item of a search: its last word ("boots" in "womens boots"), unless the search gives one.
export function itemOf(q) { const w = words(q); return stem(w[w.length - 1] || ''); }
// max/min (L180): a search with a price; a result in pounds outside it breaks the "price" rule.
export function judge(results, failed, want, q = '', item = '', max = null, min = null) {
  const sites = results.map(r => r.site);
  const thing = item || itemOf(q);
  // A whole word, or the end of a joined word ("Lawnmower" for "mower"), never the start of another ("Kettler").
  const told = r => [r.product_name, r.subcategory, r.category].flatMap(x => words(x).map(stem));
  const isItem = r => !thing || told(r).some(w => w === thing || (w.length > thing.length && w.endsWith(thing)));
  const asked = LOOK_ALIKES.test(q);
  // On Kids' Gear World a toy is the product itself ("lego"), not a look-alike.
  const lookAlike = results.slice(0, 3).filter(r => !asked && LOOK_ALIKES.test(String(r.product_name || '')) &&
    !(want.includes('kgw') && r.site === 'kgw' && !/\b(tassels?|sauces?|towels?|cufflinks?)\b/i.test(String(r.product_name || '')))).length;
  // The first result is the item itself, not an accessory of it ("Targus tablet case" is not a tablet).
  // Only the part of the name before "with", "no", "for" ... says what it is ("Tablet with protective case" is a tablet).
  const headOf = n => String(n || '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(' | ')[0].split(/\s(?:with|without|no|inc|incl|including|for|compatible|fits|suitable)\s|\s\+\s/i)[0];
  const afterItem = r => { const w = words(headOf(r.product_name)).map(stem); const i = w.findIndex(x => x === thing || (x.length > thing.length && x.endsWith(thing))); return i >= 0 ? w.slice(i + 1) : []; };
  const accessoryFirst = results.length > 0 && !ACCESSORY_WORDS.test(q) && afterItem(results[0]).some(x => ACCESSORY_WORDS.test(x));
  const siteOk = want.includes(sites[0]);
  const first = siteOk && results.length > 0 && isItem(results[0]) && !accessoryFirst;
  const top5 = sites.slice(0, 5).filter(s => want.includes(s)).length;
  const top10 = sites.slice(0, 10).filter(s => want.includes(s)).length;
  const enough = top5 >= Math.min(3, sites.slice(0, 5).length);
  const notUk = results.filter(r => { const d = (r.delivers_to || []).filter(Boolean); return d.length > 0 && !d.includes('GB') && !d.includes('WORLD'); }).length;
  // Which rules failed: a known gap excuses only its own rule ("lookalike", "top5" or "site"), never the others.
  const broken = [];
  if (!results.length) broken.push('empty');
  if (!siteOk || !enough) broken.push(siteOk ? 'top5' : 'site');
  if (results.length && (!isItem(results[0]) || accessoryFirst)) broken.push('item');
  if (lookAlike) broken.push('lookalike');
  if (notUk) broken.push('notuk');
  if (failed.length) broken.push('failed');
  const outside = results.filter(r => String(r.currency || 'GBP').toUpperCase() === 'GBP' && Number.isFinite(Number(r.price)) &&
    ((max !== null && Number(r.price) > max) || (min !== null && Number(r.price) < min))).length;
  if (outside) broken.push('price');
  return { pass: broken.length === 0, broken, first, top5, top10, lookAlike, notUk, n: results.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const replay = process.argv.includes('--replay');
  const base = (arg('--hub') || 'https://gearworldhub.com').replace(/\/+$/, '');
  const lines = [`Gear World Hub search check (L177), ${new Date().toISOString()}, ${replay ? 'replay with this copy of the ranking' : base}, UK view`];
  let failures = 0;
  let known = 0;
  let slowCount = 0;
  const withSentences = process.argv.includes('--sentences');
  const list = [...SEARCHES.map(([q, w, g, i]) => [q, w, g, i, null, null, false]), ...(withSentences ? SENTENCES.map(([q, w, g, i, mx, mn]) => [q, w, g, i, mx ?? null, mn ?? null, true]) : [])];
  const only = arg('--only') ? new Set(arg('--only').split('|').map(x => x.trim())) : null;
  for (const [q, want, gap, item, max, min, sentence] of list.filter(x => !only || only.has(x[0]))) {
    const ask = async () => { try { return replay ? await viaReplay(q, sentence) : await viaHub(base, q); } catch (e) { return { results: [], failed: ['hub'] }; } };
    // A sentence must come back with what the Hub understood (L180); without it the Hub searched the whole sentence.
    const judged = o => { const r = judge(o.results, o.failed, want, q, item, max, min); if (sentence && !o.understood) { r.broken.push('understood'); r.pass = false; } return r; };
    let out = await ask();
    let j = judged(out);
    // A site (or the Hub) that did not answer in time: asked once more; still missing = SLOW, the site's speed (L74), not
    // a wrong order. It is reported and does not fail the run.
    if (!j.pass && out.failed.length) { await sleep(2000); out = await ask(); j = judged(out); }
    const slow = !j.pass && out.failed.length > 0 && judged({ ...out, failed: [] }).pass;
    const top = out.results.slice(0, 3).map(r => `${r.site} ${String(r.product_name).slice(0, 38)}`).join(' / ');
    // A known gap excuses only its own rule (the check of 7406b610): if "kettle" ever showed the Kettler bag first again,
    // the "item" rule fails and the search is a FAIL, whatever its known sauce.
    const gapRule = gap ? String(gap).split(':')[0] : '';
    const excused = !j.pass && gap && j.broken.every(b => b === gapRule || (gapRule === 'site' && b === 'top5') || (gapRule === 'site' && b === 'item'));
    // A known gap whose only other broken rule is a slow site: SLOW, not FAIL (the final check of ec76e012).
    const slowGap = !j.pass && gap && !excused && j.broken.every(b => b === 'failed' || b === gapRule || (gapRule === 'site' && (b === 'top5' || b === 'item')));
    const mark = j.pass ? 'PASS' : excused ? 'KNOWN' : (slow || slowGap) ? 'SLOW' : 'FAIL';
    if (excused) known++;
    else if (slow || slowGap) slowCount++;
    else if (!j.pass) failures++;
    lines.push(`${mark.padEnd(5)} ${q.padEnd(sentence ? 32 : 18)} want ${want.join(',').padEnd(15)} n=${String(j.n).padEnd(3)}${j.broken.length ? ` rules=${j.broken.join(',')}` : ''} top5=${j.top5} top10=${j.top10} lookalike=${j.lookAlike} notUK=${j.notUk}${out.failed.length ? ` failed=${out.failed.join(',')}` : ''} | ${top}${excused ? ` | ${gap}` : ''}`);
    if (!replay) await sleep(800);
  }
  const ran = only ? list.filter(x => only.has(x[0])).length : list.length;
  lines.push(`${ran - failures - known - slowCount} passed, ${failures} failed, ${known} known gaps, ${slowCount} with a slow site`);
  const text = lines.join('\n') + '\n';
  process.stdout.write(text);
  const out = arg('--out');
  if (out) writeFileSync(out, text);
  process.exit(failures ? 1 : 0);
}
