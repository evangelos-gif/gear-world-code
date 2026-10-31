#!/usr/bin/env node
// Gear World Hub - shadow catalogue (phase 1 of "every product through the Hub", owner, 31 Oct 2026). READ-ONLY.
//
// The owner wants every product of every network to come in through the Hub and be shared out to the right site and
// category on its own. Before anything changes, this tool shows what that would mean, with today's feeds:
//   - every Awin programme the owner has JOINED (Awin feed list, --list) whose feed is on this PC is offered to all 5 sites
//     that have general category rules (TGW, AGW, VGW, SGW, BGW);
//   - a shop a site already lists in its sources.json keeps exactly its own rules there (allowPaths, feedIds, ... L65);
//   - a shop a site does not list yet is offered with no section filter: the site's rules decide by the name alone;
//   - the same checks as a real import (stock, price, image, Awin link, duplicates), through tools/tgw-import-plan.mjs.
// Nothing is imported, no SQL is written, Cloudflare and D1 are not contacted, and no feed file changes.
//
// Writes, in a NEW folder: summary.txt (short, for the owner and Claude) and <SITE>/report.txt (the full plan per site).
// Usage: node tools/hub-shadow-catalog.mjs --archive <dir>[;<dir>] --out <dir> [--list <awin feed list csv>]
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { archiveList, planImport } from './tgw-import-plan.mjs';
import { readList } from './moto-feed-scan.mjs';
import * as TGW_RULES from '../sites/tgw/category-rules.js';
import * as AGW_RULES from '../sites/agw/category-rules.js';
import * as VGW_RULES from '../sites/vgw/category-rules.js';
import * as SGW_RULES from '../sites/sgw/category-rules.js';
import * as BGW_RULES from '../sites/bgw/category-rules.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

// The 5 sites with general category rules. The 6 older sites (CGW, MGW, WGW, KGW, HGW, GGW) only have rules per shop
// (tools/import-rules/), so they cannot take a shop they do not know yet: phase 4.
export const SHADOW_SITES = [
  { code: 'TGW', dir: 'tgw', name: 'Technology', rules: TGW_RULES },
  { code: 'AGW', dir: 'agw', name: 'Car', rules: AGW_RULES },
  { code: 'VGW', dir: 'vgw', name: 'Travel', rules: VGW_RULES },
  { code: 'SGW', dir: 'sgw', name: 'Sporty', rules: SGW_RULES },
  { code: 'BGW', dir: 'bgw', name: 'Biker', rules: BGW_RULES }
];
export const OLD_SITES = ['CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW'];
const JOINED = /^(active|joined)$/i;
const SAMPLES = 4;
const SHOPS_SHOWN = 10;

// Every AWIN_<advertiserId>_<feedId>.csv.gz in the archive folders, and the CJ files (read in phase 5).
export function archiveFeeds(archives) {
  const byAdv = new Map();
  let cj = 0;
  for (const dir of archives) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) {
      const m = n.match(/^AWIN_(\d+)_(\d+)\.csv\.gz$/i);
      if (m) { const s = byAdv.get(Number(m[1])) || new Set(); s.add(Number(m[2])); byAdv.set(Number(m[1]), s); continue; }
      if (/^CJ_\d+.*\.csv(\.gz)?$/i.test(n)) cj++;
    }
  }
  return { byAdv, cj };
}

// Which shops are offered: joined on Awin AND on this PC (only joined programmes pay), with the joined feeds only.
// Without the Awin list (no saved key), every shop on this PC is offered and the summary says so.
export function offeredShops(byAdv, list) {
  const offered = new Map();
  const missing = [];
  const notJoined = [];
  if (!list) {
    for (const [adv, feeds] of byAdv) offered.set(adv, { name: '', feedIds: [...feeds].sort((a, b) => a - b) });
    return { offered, missing, notJoined, joinedCount: null };
  }
  const joined = new Map();
  for (const r of list) {
    const adv = Number(r.id), fid = Number(r.feedId);
    if (!adv || !JOINED.test(r.membership)) continue;
    const j = joined.get(adv) || { name: r.name, feeds: new Map() };
    if (fid) j.feeds.set(fid, r);
    joined.set(adv, j);
  }
  for (const [adv, j] of joined) {
    const onPc = byAdv.get(adv) || new Set();
    const feedIds = [...j.feeds.keys()].filter(f => onPc.has(f)).sort((a, b) => a - b);
    for (const [f, r] of j.feeds) if (!onPc.has(f)) missing.push({ adv, name: j.name, feedId: f, products: r.products || 0 });
    if (feedIds.length) offered.set(adv, { name: j.name, feedIds });
  }
  for (const adv of byAdv.keys()) if (!joined.has(adv)) notJoined.push(adv);
  return { offered, missing, notJoined, joinedCount: joined.size };
}

// The sources one site gets: its own list unchanged, plus every offered shop it does not list, with no section filter.
export function siteSources(own, offered) {
  const listed = new Set(own.map(s => Number(s.advertiserId)));
  const added = [];
  for (const [adv, o] of offered) {
    if (listed.has(adv)) continue;
    added.push({ advertiserId: adv, feedIds: o.feedIds, retailer: o.name || `Awin ${adv}`, currency: 'GBP', condition: 'new', approved: true, hubShadow: true });
  }
  return { sources: [...own, ...added], listed };
}

const fmt = n => new Intl.NumberFormat('en-GB').format(n);
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

export async function shadowCatalog({ archive, outDir, list = null, now = new Date(), sites = SHADOW_SITES, log = () => {} }) {
  const archives = archiveList(archive);
  const { byAdv, cj } = archiveFeeds(archives);
  const { offered, missing, notJoined, joinedCount } = offeredShops(byAdv, list);
  // Shop names: the name a site already uses, else the Awin list's.
  const owns = sites.map(site => JSON.parse(readFileSync(join(repoRoot, 'sites', site.dir, 'sources.json'), 'utf8')).sources);
  const names = new Map();
  for (const own of owns) for (const s of own) if (!names.has(Number(s.advertiserId))) names.set(Number(s.advertiserId), s.retailer);
  for (const [adv, o] of offered) { if (names.has(adv)) o.name = names.get(adv); else if (o.name) names.set(adv, o.name); }
  const results = [];
  for (const [i, site] of sites.entries()) {
    const own = owns[i];
    const { sources, listed } = siteSources(own, offered);
    const dir = join(outDir, site.code);
    mkdirSync(dir, { recursive: true });
    const sourcesFile = join(dir, 'sources-shadow.json');
    writeFileSync(sourcesFile, JSON.stringify({ _comment: `Hub shadow catalogue ${now.toISOString()}: ${site.code} sources plus every joined shop it does not list (no section filter). Not used by any site.`, sources }, null, 1));
    const t0 = Date.now();
    log(`${site.code}: ${sources.filter(s => s.approved).length} shops...`);
    const { stats, products } = await planImport({ archive: archives, sourcesFile, outDir: dir, now, rules: site.rules, label: `${site.code} HUB SHADOW`, writeSql: false });
    // Only what the summary needs: the full product rows are dropped here (the site report has the details).
    const rows = products.map(p => ({ key: p.stable_key, adv: Number(p.awin_advertiser_id), retailer: p.retailer, slug: p.category_slug, name: p.product_name, price: p.price }));
    const rowsPerShop = new Map();
    for (const s of sources) {
      const r = stats.perRetailer[s.retailer];
      if (r) rowsPerShop.set(Number(s.advertiserId), Math.max(rowsPerShop.get(Number(s.advertiserId)) || 0, r.rows));
    }
    results.push({ site, listed, rows, rowsPerShop, seconds: Math.round((Date.now() - t0) / 1000) });
  }
  const shopName = adv => names.get(adv) || `Awin ${adv}`;

  // ---------- Summary ----------
  const L = [];
  const stamp = now.toISOString().replace('T', ' ').slice(0, 16);
  L.push(`HUB: ΚΑΤΑΛΟΓΟΣ «ΣΤΗ ΣΚΙΑ» (Φάση 1) - ΜΟΝΟ ΑΝΑΓΝΩΣΗ - ${stamp} UTC`);
  L.push('Δεν άλλαξε τίποτα: ούτε sites, ούτε βάσεις D1, ούτε αρχεία feeds. Δεν γράφτηκε SQL.');
  L.push(`Φάκελοι feeds: ${archives.join(' ; ')}`);
  if (list) {
    L.push(`Λίστα Awin: ${fmt(list.length)} feeds, ${joinedCount} προγράμματα όπου είσαι μέλος. Στον υπολογιστή και μέλος: ${offered.size} καταστήματα (${[...offered.values()].reduce((a, o) => a + o.feedIds.length, 0)} feeds).`);
  } else {
    L.push('🟡 ΠΡΟΣΟΧΗ: δεν διαβάστηκε η λίστα του Awin (δεν υπάρχει φυλαγμένο κλειδί). Μετράνε ΟΛΑ τα feeds του υπολογιστή, και όσα δεν είσαι πια μέλος.');
    L.push(`Καταστήματα στον υπολογιστή: ${offered.size}.`);
  }
  if (missing.length) {
    const top = [...missing].sort((a, b) => b.products - a.products);
    L.push(`Feeds μελών που ΛΕΙΠΟΥΝ από τον υπολογιστή: ${missing.length} (δεν μετρήθηκαν). Τα μεγαλύτερα:`);
    for (const m of top.slice(0, 8)) L.push(`  - ${m.adv} ${cut(m.name, 36)} (feed ${m.feedId}, ${fmt(m.products)} προϊόντα)`);
  }
  if (notJoined.length) L.push(`Αρχεία στον υπολογιστή από ${notJoined.length} καταστήματα όπου ΔΕΝ είσαι μέλος: δεν μετρήθηκαν (δεν πληρώνουν).`);
  if (cj) L.push(`Αρχεία CJ στον υπολογιστή: ${cj}. Δεν διαβάζονται ακόμα (Φάση 5).`);
  L.push('');

  L.push('== Ανά site: σήμερα και μέσω Hub ==');
  L.push('  «από τα δικά του» = καταστήματα που το site έχει ήδη, με τους ίδιους κανόνες');
  L.push('  «νέα» = προϊόντα από καταστήματα που το site ΔΕΝ έχει, που οι κανόνες του δέχονται μόνο από το όνομα');
  for (const r of results) {
    const mine = r.rows.filter(p => r.listed.has(p.adv)).length;
    const extra = r.rows.length - mine;
    L.push(`  ${r.site.code} ${r.site.name.padEnd(10)} από τα δικά του ${fmt(mine).padStart(7)} | νέα +${fmt(extra).padStart(7)} | σύνολο ${fmt(r.rows.length).padStart(7)}   (${r.seconds} δευτ.)`);
  }
  L.push(`  ${OLD_SITES.join(', ')}: δεν έχουν ακόμα γενικούς κανόνες κατηγοριών (μόνο κανόνες ανά κατάστημα). Μπαίνουν στη Φάση 4.`);
  L.push('');

  L.push(`== Ανά site: τα καταστήματα που θα έφερναν νέα προϊόντα (έως ${SHOPS_SHOWN}) ==`);
  for (const r of results) {
    const per = new Map();
    for (const p of r.rows) {
      if (r.listed.has(p.adv)) continue;
      const e = per.get(p.adv) || { n: 0, cats: {}, samples: [] };
      e.n++; e.cats[p.slug] = (e.cats[p.slug] || 0) + 1;
      if (e.samples.length < SAMPLES) e.samples.push(`${cut(p.name, 70)} | ${p.price.toFixed(2)} | ${p.slug}`);
      per.set(p.adv, e);
    }
    const top = [...per.entries()].sort((a, b) => b[1].n - a[1].n);
    L.push(`  -- ${r.site.code}: ${top.length} νέα καταστήματα`);
    for (const [adv, e] of top.slice(0, SHOPS_SHOWN)) {
      const cats = Object.entries(e.cats).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${fmt(v)}`).join(', ');
      L.push(`     ${String(adv).padEnd(7)} ${cut(shopName(adv), 30).padEnd(30)} +${fmt(e.n).padStart(6)}  (${cats})`);
      for (const s of e.samples) L.push(`              · ${s}`);
    }
  }
  L.push('');

  // The same product (same shop and product id) taken by more than one site: one "home" site and a canonical link later.
  const sitesOf = new Map();
  for (const r of results) for (const p of r.rows) {
    const e = sitesOf.get(p.key) || { sites: [], name: p.name, retailer: p.retailer };
    e.sites.push(`${r.site.code}:${p.slug}`);
    sitesOf.set(p.key, e);
  }
  const multi = [...sitesOf.values()].filter(e => e.sites.length > 1);
  const pairs = {};
  for (const e of multi) {
    const codes = e.sites.map(s => s.split(':')[0]);
    for (let i = 0; i < codes.length; i++) for (let j = i + 1; j < codes.length; j++) {
      const k = `${codes[i]}+${codes[j]}`;
      (pairs[k] ||= { n: 0, examples: [] }).n++;
      if (pairs[k].examples.length < 3) pairs[k].examples.push(`${cut(e.name, 60)} (${e.retailer}) → ${e.sites.join(', ')}`);
    }
  }
  L.push(`== Το ίδιο προϊόν σε 2 ή περισσότερα sites: ${fmt(multi.length)} από ${fmt(sitesOf.size)} ==`);
  for (const [k, v] of Object.entries(pairs).sort((a, b) => b[1].n - a[1].n)) {
    L.push(`  ${k.padEnd(8)} ${fmt(v.n)}`);
    for (const x of v.examples) L.push(`      · ${x}`);
  }
  L.push('');

  L.push(`== Καταστήματα που δεν δίνουν ΚΑΝΕΝΑ προϊόν στα 5 sites (τα μεγαλύτερα, έως 15) ==`);
  L.push('  (συνήθως ανήκουν σε παλιό site: ρούχα, σπίτι, κήπος, εργαλεία. Μπαίνουν με τη Φάση 4)');
  const taken = new Map();
  for (const e of sitesOf.keys()) { const adv = Number(String(e).split(':')[0]); taken.set(adv, (taken.get(adv) || 0) + 1); }
  const rowsAll = new Map();
  for (const r of results) for (const [adv, n] of r.rowsPerShop) rowsAll.set(adv, Math.max(rowsAll.get(adv) || 0, n));
  const none = [...offered.keys()].filter(adv => !taken.get(adv)).map(adv => [adv, rowsAll.get(adv) || 0]).sort((a, b) => b[1] - a[1]);
  L.push(`  ${none.length} από ${offered.size} καταστήματα`);
  for (const [adv, n] of none.slice(0, 15)) L.push(`     ${String(adv).padEnd(7)} ${cut(shopName(adv), 36).padEnd(36)} ${fmt(n).padStart(8)} γραμμές`);
  L.push('');
  L.push('Λεπτομέρειες ανά site (όλα τα δείγματα και οι λόγοι απόρριψης): ' + results.map(r => `${r.site.code}\\report.txt`).join(', '));
  L.push('Επόμενο: το Claude διαβάζει την αναφορά, φτιάχνει κανόνες για όσα μπήκαν σε λάθος site, και μετά η Φάση 2 (αυτόματη νυχτερινή εργασία, πάλι χωρίς αλλαγές στα sites).');
  L.push('=== ΤΕΛΟΣ ===');
  const summary = L.join('\r\n');
  writeFileSync(join(outDir, 'summary.txt'), '﻿' + summary);
  return { summary, results, offered, missing, multi: multi.length };
}

// ---------- CLI ----------
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = val('archive');
  const outDir = val('out');
  if (!archive || !outDir) {
    console.error('usage: node tools/hub-shadow-catalog.mjs --archive <dir>[;<dir>] --out <dir> [--list <awin feed list csv>]');
    process.exit(2);
  }
  if (existsSync(join(outDir, 'summary.txt'))) {
    console.error(`Output folder already has a summary: ${outDir}. Use a new folder.`);
    process.exit(2);
  }
  mkdirSync(outDir, { recursive: true });
  const list = val('list') ? await readList(val('list')) : null;
  const { offered, multi } = await shadowCatalog({ archive, outDir, list, log: m => console.log(m) });
  console.log(`shops offered ${offered.size} | products on 2+ sites ${multi}`);
  console.log(`summary: ${join(outDir, 'summary.txt')}`);
}
