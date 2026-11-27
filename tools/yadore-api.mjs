#!/usr/bin/env node
// READ-ONLY calls to the Yadore Publisher API (https://docs.yadore.com/) for tools/yadore.ps1 (lessons L235). Nothing is
// clicked and nothing changes at Yadore or on the sites: only GET /v2/markets, /v2/merchant, /v2/offer and the Report and
// Conversion endpoints.
// The key comes only from the environment variable GW_YADORE_KEY (set by the PowerShell tool for this one run from this
// PC's DPAPI file); it is never printed or written. Output: one line of JSON (the line starting with '{'), with the
// report lines in Greek for the owner.
//   node tools/yadore-api.mjs test                         one call (/v2/markets): does the key work, which markets
//   node tools/yadore-api.mjs plan [--market gr]           the stores of the market and, for every category word of the
//                                                          13 sites (src/lib/yadore-words.js), how many offers would show
//                                                          and from which stores; a proposed list of a few stores
//   node tools/yadore-api.mjs report --from D --to D [--market gr]
//                                                          clicks and sales per store (Conversion API), clicks and revenue
//                                                          per day (Report API); the 300-click rule and conversion
//   node tools/yadore-api.mjs site-check [--sites tgw,pgw] NO KEY: GET of the live category pages as the network's
//                                                          read-only check sees them from Greece (GearWorldQA-bot with
//                                                          X-GW-QA-Country: GR, lessons L158) and from the UK; never a
//                                                          /out/ or /out/y/ link
import { pathToFileURL } from 'node:url';
import { YADORE_WORDS } from '../src/lib/yadore-words.js';
import { existsSync } from 'node:fs';
import { readOffers, neverStore, storeKey, L107_WORDS, storesOf, YADORE_ASK } from '../src/lib/yadore.js';

export const API = 'https://api.yadore.com';
export const RULE_CLICKS = 300; // a store with this many clicks and no sale is paused (Anna, 20 Nov 2026)
export const MIN_CONVERSION = 0.01; // target: at least 1% of clicks become a sale
export const SUGGEST = 8; // "few stores at the start"
const SHARE = 0.7; // our share of Yadore's revenue (the estimated CPC and the reports are 100% Yadore, docs FAQ 7)

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function call(fetchFn, key, path, params = {}) {
  const u = new URL(path, API);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') u.searchParams.set(k, String(v));
  let res;
  try {
    res = await fetchFn(u.toString(), { headers: { 'API-Key': key, Accept: 'application/json' } });
  } catch (err) {
    return { ok: false, status: 0, error: 'network', detail: String((err && err.message) || err).slice(0, 120) };
  }
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  if (!res.ok) {
    const auth = res.status === 401 || res.status === 403 || JSON.stringify(body || {}).includes('API-Key');
    return { ok: false, status: res.status, error: auth ? 'key' : 'http', detail: JSON.stringify(body || {}).slice(0, 200) };
  }
  return { ok: true, status: res.status, body };
}

export async function testKey(fetchFn, key) {
  const r = await call(fetchFn, key, '/v2/markets');
  if (!r.ok) return { ok: false, error: r.error, status: r.status, lines: [r.error === 'key' ? 'Το κλειδί δεν δουλεύει (το Yadore το απέρριψε).' : `Το Yadore δεν απάντησε σωστά (${r.status || 'δίκτυο'}).`] };
  const markets = ((r.body && r.body.markets) || []).map(m => String((m && m.id) || m)).filter(Boolean).sort();
  return { ok: true, markets, lines: [`Το κλειδί δουλεύει. Ανοιχτές αγορές (${markets.length}): ${markets.join(', ')}`] };
}

const pad = (s, n) => (String(s) + ' '.repeat(n)).slice(0, Math.max(n, String(s).length));

// The stores of the market and what our category words would show. wait: milliseconds between calls (gentle on the API).
export async function plan(fetchFn, key, { market = 'gr', sites = null, wait = 250 } = {}) {
  const lines = [];
  const t = await testKey(fetchFn, key);
  if (!t.ok) return { ok: false, error: t.error, lines: t.lines };
  lines.push(...t.lines);
  if (!t.markets.includes(market)) return { ok: false, error: 'market', lines: [...lines, `Η αγορά ${market} ΔΕΝ είναι ανοιχτή για τον λογαριασμό.`] };
  const m = await call(fetchFn, key, '/v2/merchant', { market });
  if (!m.ok) return { ok: false, error: m.error, lines: [...lines, `Η λίστα καταστημάτων δεν ήρθε (${m.status}).`] };
  const merchants = ((m.body && m.body.merchants) || []).map(x => ({
    name: String(x.name || ''), offers: Number(x.offerCount) || 0,
    traffic: (Array.isArray(x.trafficTypes) ? x.trafficTypes : []).map(tt => `${tt.type}:${tt.permission}`).join(' '),
    never: neverStore(x.name), l107: L107_WORDS.test(storeKey(x.name))
  })).filter(x => x.name);
  const byStore = new Map(merchants.map(x => [storeKey(x.name), { ...x, categories: new Set(), hits: 0 }]));
  const cats = [];
  const words = YADORE_WORDS[market] || {};
  const codes = Object.keys(words).filter(c => !sites || sites.includes(c));
  let calls = 0;
  for (const code of codes) {
    for (const [slug, list] of Object.entries(words[code])) {
      const stores = new Map();
      let shown = 0;
      let failed = 0;
      for (const keyword of list.slice(0, 2)) {
        if (calls++) await sleep(wait);
        const r = await call(fetchFn, key, '/v2/offer', { market, keyword, precision: 'fuzzy', sort: 'rel_desc', limit: YADORE_ASK });
        if (!r.ok) { failed++; continue; }
        const offers = readOffers(r.body, {}, market, { anyStore: true });
        shown += offers.length;
        for (const o of offers) {
          const k = storeKey(o.store);
          stores.set(k, (stores.get(k) || 0) + 1);
          const s = byStore.get(k) || { name: o.store, offers: 0, traffic: '', never: false, l107: false, categories: new Set(), hits: 0 };
          s.categories.add(`${code}/${slug}`);
          s.hits++;
          byStore.set(k, s);
        }
      }
      cats.push({ site: code, slug, words: list, shown, failed, stores: [...stores.entries()].sort((a, b) => b[1] - a[1]) });
    }
  }
  // A store that does not allow SEO traffic (ours, as registered with Yadore) is never proposed.
  const seoOf = s => ((s.traffic || '').match(/\bseo:(\S+)/i) || [])[1] || '';
  const usable = [...byStore.values()].filter(s => !s.never && !s.l107 && seoOf(s) !== 'not_allowed');
  const suggest = usable.filter(s => s.categories.size).sort((a, b) => b.categories.size - a.categories.size || b.hits - a.hits || a.name.localeCompare(b.name)).slice(0, SUGGEST);
  const now = storesOf(market);
  lines.push('', `Καταστήματα στην αγορά ${market}: ${merchants.length} (Yadore /v2/merchant).`);
  lines.push(`Λίστα του κώδικα τώρα (${now.length}): ${now.length ? now.join(', ') : '(άδεια: το πλαίσιο δεν δείχνει τίποτα)'}`);
  for (const code of codes) {
    const own = storesOf(market, code);
    lines.push(`  ${code}: ${own.length ? own.join(', ') : 'κανένα (χωρίς πλαίσιο)'}`);
  }
  lines.push('', `Πρόταση: ${suggest.length} καταστήματα με τις περισσότερες κατηγορίες μας (ποτέ τα 5 της Linkwise, Amazon, Aliexpress, Panora, ονόματα με λέξη L107):`);
  for (const s of suggest) lines.push(`  ${pad(storeKey(s.name), 32)} κατηγορίες ${pad(s.categories.size, 3)} προϊόντα στις λέξεις ${pad(s.hits, 4)} στο Yadore ${s.offers || '?'}${s.traffic ? ` · ${s.traffic}` : ''}`);
  lines.push('', 'Ανά site και κατηγορία (προϊόντα που θα έδειχνε το πλαίσιο πριν από τα όρια, και τα 3 πρώτα καταστήματα):');
  let empty = 0;
  for (const c of cats) {
    if (!c.shown) empty++;
    const top = c.stores.slice(0, 3).map(([n, k]) => `${n} ${k}`).join(', ');
    lines.push(`  ${pad(`${c.site}/${c.slug}`, 46)} ${pad(c.shown, 3)} ${c.failed ? `(ΛΑΘΟΣ σε ${c.failed} λέξη) ` : ''}[${c.words.join(' | ')}] ${top}`);
  }
  lines.push('', `Κατηγορίες: ${cats.length}, χωρίς κανένα προϊόν: ${empty}. Κλήσεις στο Yadore: ${calls + 2} (μόνο ανάγνωση, κανένα κλικ).`);
  const never = merchants.filter(x => x.never).map(x => storeKey(x.name));
  if (never.length) lines.push(`Εκτός πάντα (ήταν στην αγορά): ${never.slice(0, 20).join(', ')}${never.length > 20 ? ' …' : ''}`);
  return { ok: true, market, merchants: merchants.length, categories: cats.length, empty, suggest: suggest.map(s => storeKey(s.name)), lines };
}

const isDay = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
function days(from, to) {
  const out = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`) && out.length < 62; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

// Clicks and sales per store (Conversion API, tracked clicks only) and clicks and revenue per day (Report API).
export async function report(fetchFn, key, { market = 'gr', from, to, wait = 250 } = {}) {
  if (!isDay(from) || !isDay(to) || from > to) return { ok: false, error: 'dates', lines: ['Λάθος ημερομηνίες (μορφή ΕΕΕΕ-ΜΜ-ΗΗ, από ≤ έως).'] };
  const lines = [`Yadore, αγορά ${market}, ${from} έως ${to} (UTC). Μόνο ανάγνωση.`];
  const c = await call(fetchFn, key, '/v2/conversion/detail/merchant', { market, from, to, format: 'json' });
  if (!c.ok) return { ok: false, error: c.error, lines: [...lines, `Οι πωλήσεις ανά κατάστημα δεν ήρθαν (${c.status || 'δίκτυο'}).`] };
  const rows = ((c.body && c.body.salesByMerchant) || []).map(r => ({
    store: storeKey((r.merchant && r.merchant.name) || ''), clicks: Number(r.clicks) || 0, sales: Number(r.sales) || 0
  })).filter(r => r.store).sort((a, b) => b.clicks - a.clicks);
  const pause = [];
  lines.push('', 'Ανά κατάστημα (κλικ που μετρά το Yadore, πωλήσεις, μετατροπή):');
  for (const r of rows) {
    const conv = r.clicks ? r.sales / r.clicks : 0;
    let verdict = 'ΕΝΤΑΞΕΙ';
    if (r.clicks >= RULE_CLICKS && r.sales === 0) { verdict = '🔴 ΠΑΥΣΗ (κανόνας 300 κλικ χωρίς πώληση)'; pause.push(r.store); }
    else if (r.clicks >= 100 && conv < MIN_CONVERSION) verdict = '🟡 ΠΡΟΣΟΧΗ (μετατροπή κάτω από 1%)';
    else if (r.sales === 0) verdict = `χωρίς πώληση ακόμα (${RULE_CLICKS - r.clicks} κλικ μέχρι τον κανόνα)`;
    lines.push(`  ${pad(r.store, 32)} κλικ ${pad(r.clicks, 5)} πωλήσεις ${pad(r.sales, 4)} μετατροπή ${pad((conv * 100).toFixed(1) + '%', 6)} ${verdict}`);
  }
  if (!rows.length) lines.push('  (κανένα κλικ ακόμα)');
  const tot = (c.body && c.body.total) || {};
  lines.push(`Σύνολο: κλικ ${Number(tot.clicks) || rows.reduce((a, r) => a + r.clicks, 0)}, πωλήσεις ${Number(tot.sales) || rows.reduce((a, r) => a + r.sales, 0)}.`);
  lines.push('', 'Ανά ημέρα (Report API: όλα τα κλικ, έσοδα σε ευρώ· το Yadore τα αλλάζει έως 3 μέρες μετά):');
  let clicks = 0;
  let revenue = 0;
  let n = 0;
  const list = days(from, to);
  if (list[list.length - 1] !== to) lines.push(`  (μόνο οι πρώτες ${list.length} ημέρες: για περισσότερες, ξανά με νέο -From)`);
  for (const day of list) {
    if (n++) await sleep(wait);
    const st = await call(fetchFn, key, '/v2/report/status', { date: day });
    const g = await call(fetchFn, key, '/v2/report/general', { date: day, format: 'json' });
    if (!g.ok) { lines.push(`  ${day} δεν ήρθε (${g.status || 'δίκτυο'})`); continue; }
    const mk = (g.body && g.body.market && g.body.market[market] && g.body.market[market].total) || {};
    const k = Number(mk.clicks) || 0;
    const rev = Number(mk.revenue) || 0;
    clicks += k;
    revenue += rev;
    lines.push(`  ${day} κλικ ${pad(k, 5)} έσοδα Yadore €${rev.toFixed(2)} (δικά μας ~€${(rev * SHARE).toFixed(2)})${st.ok && st.body && st.body.status === 'incomplete' ? ' · ημέρα ακόμα ανοιχτή' : ''}`);
  }
  lines.push(`Σύνολο ημερών: κλικ ${clicks}, έσοδα Yadore €${revenue.toFixed(2)}, δικά μας ~€${(revenue * SHARE).toFixed(2)} (70%).`);
  if (pause.length) lines.push('', `ΓΙΑ ΠΑΥΣΗ (300 κλικ χωρίς πώληση): ${pause.join(', ')} → tools/yadore.ps1 -Step pause -Stores '${pause.join(',')}' με φράση.`);
  return { ok: true, market, from, to, stores: rows.length, clicks, revenue: Number(revenue.toFixed(2)), pause, lines };
}

// The live pages as the network's own read-only check sees them (lessons L158). Per site: /api/version, every category
// of the Yadore words from Greece (box or not, how many offers, which stores, the marks it must have) and one page from
// the UK (no box).
export const QA_UA = 'GearWorldQA-bot/1.0 (+read-only check)';
export function readBox(html) {
  const i = html.indexOf('<section class="yd-box"');
  if (i < 0) return null;
  const b = html.slice(i, html.indexOf('</section>', i) + 10);
  const cards = (b.match(/<article class="label-card">/g) || []).length;
  const links = (b.match(/href="\/out\/y\/[A-Za-z0-9_.-]+"/g) || []).length;
  const sponsored = (b.match(/rel="sponsored nofollow noopener" target="_blank"/g) || []).length;
  const stores = [...b.matchAll(/<span class="retailer" translate="no">([^<]+)<\/span>/g)].map(m => storeKey(m[1]));
  const problems = [];
  if (!/data-i18n="Sponsored"/.test(b)) problems.push('χωρίς «Sponsored»');
  if (!/which pays us for each click/.test(b)) problems.push('χωρίς σημείωση προμήθειας');
  if (!/Prices checked/.test(b)) problems.push('χωρίς ημερομηνία ελέγχου');
  if (links !== cards * 2 || sponsored !== cards * 2) problems.push('links χωρίς sponsored nofollow');
  if (/<iframe|api\.yadore\.com/i.test(b)) problems.push('iframe ή link του Yadore μέσα στη σελίδα');
  if (L107_WORDS.test(b.replace(/<[^>]+>/g, ' '))) problems.push('λέξη L107');
  for (const s of stores) if (neverStore(s)) problems.push(`κατάστημα που απαγορεύεται: ${s}`);
  return { cards, stores, problems };
}
export async function siteCheck(fetchFn, { sites = null, root = '.', wait = 150 } = {}) {
  const lines = ['Έλεγχος μόνο ανάγνωσης: σελίδες κατηγοριών από την Ελλάδα (GearWorldQA-bot, X-GW-QA-Country: GR) και μία από το ΗΒ. Κανένα link /out/.'];
  const words = YADORE_WORDS.gr;
  let shown = 0;
  let bad = 0;
  let pages = 0;
  const get = async (url, cc) => {
    try {
      const r = await fetchFn(url, { headers: { 'User-Agent': QA_UA, 'X-GW-QA-Country': cc }, redirect: 'manual' });
      return { status: r.status, text: r.status === 200 ? await r.text() : '' };
    } catch { return { status: 0, text: '' }; }
  };
  for (const code of Object.keys(words).filter(c => !sites || sites.includes(c))) {
    const cfg = `${root}/sites/${code}/site.config.js`;
    if (!existsSync(cfg)) continue;
    const site = (await import(pathToFileURL(cfg).href)).default;
    const origin = `https://${site.domain}`;
    const v = await get(`${origin}/api/version`, 'GB');
    let commit = '';
    try { commit = JSON.parse(v.text).commit || ''; } catch { commit = ''; }
    lines.push('', `${code.toUpperCase()} ${site.domain} · έκδοση ${commit ? commit.slice(0, 12) : '?'}`);
    for (const slug of Object.keys(words[code])) {
      await sleep(wait);
      pages++;
      const r = await get(`${origin}/category/${slug}/`, 'GR');
      if (r.status !== 200) { bad++; lines.push(`  ${pad(slug, 36)} 🔴 ΠΡΟΒΛΗΜΑ: απάντηση ${r.status}`); continue; }
      const b = readBox(r.text);
      if (!b) { lines.push(`  ${pad(slug, 36)} χωρίς πλαίσιο (πριν από 2/12 18:00, χωρίς κλειδί, χωρίς κατάστημα της λίστας ή όρια ημέρας)`); continue; }
      shown++;
      if (b.problems.length) bad++;
      lines.push(`  ${pad(slug, 36)} ${b.problems.length ? '🔴 ΠΡΟΒΛΗΜΑ' : '🟢 ΕΝΤΑΞΕΙ'} πλαίσιο ${b.cards} · ${[...new Set(b.stores)].join(', ')}${b.problems.length ? ' · ' + b.problems.join(' · ') : ''}`);
    }
    const first = Object.keys(words[code])[0];
    const uk = await get(`${origin}/category/${first}/`, 'GB');
    if (uk.status === 200 && readBox(uk.text)) { bad++; lines.push(`  ΗΒ ${first}: 🔴 ΠΡΟΒΛΗΜΑ: το πλαίσιο φαίνεται και στο ΗΒ`); }
    else lines.push(`  ΗΒ ${first}: ${uk.status === 200 ? '🟢 ΕΝΤΑΞΕΙ χωρίς πλαίσιο' : `απάντηση ${uk.status}`}`);
  }
  lines.push('', `Σελίδες: ${pages}, με πλαίσιο: ${shown}, με πρόβλημα: ${bad}.`);
  return { ok: bad === 0, pages, shown, bad, lines };
}

function arg(argv, name, dflt = '') {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
}

async function main(argv) {
  const key = String(process.env.GW_YADORE_KEY || '').trim();
  const cmd = argv[0] || '';
  let out;
  if (cmd === 'site-check') out = await siteCheck(fetch, { sites: arg(argv, 'sites') ? arg(argv, 'sites').split(',') : null, root: arg(argv, 'root', '.') });
  else if (!key) out = { ok: false, error: 'nokey', lines: ['Δεν βρέθηκε κλειδί (GW_YADORE_KEY).'] };
  else if (cmd === 'test') out = await testKey(fetch, key);
  else if (cmd === 'plan') out = await plan(fetch, key, { market: arg(argv, 'market', 'gr'), sites: arg(argv, 'sites') ? arg(argv, 'sites').split(',') : null });
  else if (cmd === 'report') out = await report(fetch, key, { market: arg(argv, 'market', 'gr'), from: arg(argv, 'from'), to: arg(argv, 'to') });
  else out = { ok: false, error: 'usage', lines: ['Χρήση: test | plan | report --from ΕΕΕΕ-ΜΜ-ΗΗ --to ΕΕΕΕ-ΜΜ-ΗΗ'] };
  // The key never leaves: any copy of it in an answer (an echo of the API) is masked.
  const text = JSON.stringify(out);
  process.stdout.write((key ? text.split(key).join('[κλειδί]') : text) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main(process.argv.slice(2));
