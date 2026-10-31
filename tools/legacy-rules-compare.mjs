#!/usr/bin/env node
// Old site, new rules: are they the same? READ-ONLY.
//
// An older site (MGW, WGW, ...) gets general category rules (sites/<site>/category-rules.js) in place of its rules per shop.
// Before the shared import uses them, this tool checks them against what the site shows today: every live product is
// classified again by the new rules, and the report says how many keep their category, which move and which would be left
// out, per shop and per reason, with examples. It also counts the products only the OTHER site shows that the new rules
// would put here too (unisex products go to both sites).
//
// Input: a JSON file { "<site>": [[retailer, product_name, merchant_category, site_category, subcategory], ...], ... } with the
// site's ACTIVE products, read from its database with a SELECT (Claude reads it with the Cloudflare API; it is never committed:
// it is shop feed data). Nothing is written to any database.
//
// Usage: node tools/legacy-rules-compare.mjs --rows <file.json> --sites mgw,wgw [--examples 8] [--out report.txt]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Category names an older import used that the site shows under another page (site.config.js database.categories).
const ALIASES = { 'Jewellery & Watches': 'Watches', Bags: 'Bags & Accessories' };

export async function compareRules({ rows, sites, examples = 8, root = join(here, '..') }) {
  const L = [];
  const out = {};
  for (const site of sites) {
    const R = await import(pathToFileURL(join(root, 'sites', site, 'category-rules.js')).href);
    const sources = JSON.parse(readFileSync(join(root, 'sites', site, 'sources.json'), 'utf8')).sources;
    const byName = new Map(sources.map(s => [String(s.retailer).toLowerCase(), s]));
    const live = rows[site] || [];
    const others = sites.filter(s => s !== site).flatMap(s => rows[s] || []);
    const mine = new Set(live.map(r => `${r[0]}|${r[1]}`));
    const st = { n: 0, same: 0, sub: 0, moved: 0, out: 0, alsoHere: 0 };
    const per = {}, moved = {}, left = {}, also = {};
    const add = (obj, k, x) => { (obj[k] ||= []).push(x); };
    const place = (ret, name, mc) => R.classify(R.cleanProductName(name), mc || '', '', byName.get(String(ret).toLowerCase()) || null);
    for (const [ret, name, mc, cat, sub] of live) {
      const c = place(ret, name, mc);
      const want = ALIASES[cat] || cat;
      const p = (per[ret] ||= { n: 0, same: 0 });
      st.n++; p.n++;
      if (!c.ok) { st.out++; add(left, c.reason, `${ret} | ${name} | ${mc || '-'}`); continue; }
      if (c.category === want) { st.same++; p.same++; if (c.subcategory === sub) st.sub++; continue; }
      st.moved++; add(moved, `${want} -> ${c.category}`, `${ret} | ${name} | ${mc || '-'}`);
    }
    for (const [ret, name, mc, cat] of others) {
      if (mine.has(`${ret}|${name}`)) continue;
      const c = place(ret, name, mc);
      if (c.ok) { st.alsoHere++; add(also, `${cat} -> ${c.category}`, `${ret} | ${name}`); }
    }
    const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : '-');
    L.push(`##### ${site.toUpperCase()}: ${st.n} live products | same category ${st.same} (${pct(st.same, st.n)}) | other category ${st.moved} | left out ${st.out} | same subcategory ${st.sub}`);
    L.push(`      products only the other site shows that these rules would put here too: ${st.alsoHere}`);
    for (const [r, p] of Object.entries(per).sort((a, b) => b[1].n - a[1].n)) L.push(`   ${r.slice(0, 40).padEnd(40)} ${p.same}/${p.n} (${pct(p.same, p.n)})`);
    const dump = (title, obj) => {
      L.push(` -- ${title}`);
      for (const [k, list] of Object.entries(obj).sort((a, b) => b[1].length - a[1].length)) {
        L.push(`   ${String(list.length).padStart(5)}  ${k}`);
        for (const x of list.slice(0, examples)) L.push(`          ${x.slice(0, 160)}`);
      }
    };
    dump('left out, by reason', left);
    dump('in another category (live -> new rules)', moved);
    dump('also here (other site -> this site)', also);
    L.push('');
    out[site] = st;
  }
  return { report: L.join('\n') + '\n', stats: out };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  if (!val('rows') || !val('sites')) { console.error('usage: node tools/legacy-rules-compare.mjs --rows <file.json> --sites mgw,wgw [--examples 8] [--out report.txt]'); process.exit(2); }
  const rows = JSON.parse(readFileSync(val('rows'), 'utf8'));
  const sites = val('sites').split(',').map(s => s.trim().toLowerCase()).filter(s => /^[a-z]{3}$/.test(s));
  const { report } = await compareRules({ rows, sites, examples: Number(val('examples') || 8) });
  if (val('out')) writeFileSync(val('out'), report); else process.stdout.write(report);
}
