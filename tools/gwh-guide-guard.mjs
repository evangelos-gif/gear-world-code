#!/usr/bin/env node
// Gear World Hub gift guides - live guard (Google Ads compliance, lessons L107). READ-ONLY: it writes nothing and
// opens nothing itself; tools/gwh-hub-v2.ps1 runs the SELECTs it plans (primary key, a few rows per site) and hands the
// answers back to it. A product a Hub guide links to must open as a normal page on its site in the UK view: not gone,
// not switched off, from a retailer that delivers to the UK, and with a price check from the last 30 days (otherwise
// its page shows a notice instead of the product). One whose price check is older than 14 days says "Check price and
// stock at the retailer" on its page: reported, so guides.json can get a newer product before it turns into a notice.
// Lessons L109 (9 Nov 2026): the price in guides.json must be the price the site shows. A guide that says £105.95 for a
// product whose page says £155.95 is a price we cannot back up (Google Ads), so a PRICE line stops the live step too,
// like a NOTICE. An offer of the same product at another retailer ("Same price at ...") is checked as well when
// guides.json gives its id.
//
// Usage:
//   node tools/gwh-guide-guard.mjs plan                  lines "<site>\t<database name>\t<SELECT ...>", one per site
//   node tools/gwh-guide-guard.mjs judge <site> <file> [--out <report>]   <file>: the output of wrangler d1 execute
//                                                        --json for that SELECT; prints the findings (or writes them to
//                                                        <report>), last line
//                                                        "GUARD <site> checked=<n> notices=<n> old=<n> prices=<n>"
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadData, SITES, money } from './gwh-guides.mjs';
import { homeView, hiddenReason, needsCheck } from '../src/lib/visibility.js';
import { IN_STOCK_WORDS } from '../src/db.js';

const ROOT = new URL('../', import.meta.url);
const CODE_OF = Object.fromEntries(Object.entries(SITES).map(([code, s]) => [s.domain, code]));

// The product ids each site's pages are asked for by the Hub guides (the guide's own link, "-<id>/" at the end).
export function linkedIds(data = loadData()) {
  const out = {};
  for (const g of data.guides) {
    for (const it of g.items) {
      const u = new URL(it.url);
      const code = CODE_OF[u.hostname];
      const m = u.pathname.match(/-(\d+)\/$/);
      if (!code || !m) throw new Error(`not a Gear World product page: ${it.url}`);
      const id = Number(m[1]);
      (out[code] = out[code] || []).push({ id, name: it.name, price: Number(it.price), guide: g.slug });
      // The other retailers of the same product that the card names (offers), when guides.json gives their id.
      for (const o of it.offers || []) {
        if (o.id == null || Number(o.id) === id) continue;
        out[code].push({ id: Number(o.id), name: `${it.name} at ${o.retailer}`, price: Number(o.price), guide: g.slug });
      }
    }
  }
  return out;
}

export function databaseName(code) {
  const text = readFileSync(new URL(`sites/${code}/wrangler.jsonc.example`, ROOT), 'utf8');
  const m = text.match(/"database_name"\s*:\s*"([a-z0-9-]+)"/);
  if (!m) throw new Error(`${code}: no database_name in wrangler.jsonc.example`);
  return m[1];
}

async function siteConfig(code) {
  const file = new URL(`sites/${code}/site.config.js`, ROOT);
  if (!existsSync(file)) throw new Error(`${code}: no site.config.js`);
  return (await import(pathToFileURL(fileURLToPath(file)).href)).default;
}

const legacy = site => Boolean(site.database && site.database.layout === 'legacy');

// One SELECT per site, by primary key. Plain column names and numbers only: no quote, no < > & | ^ % (the PowerShell
// tool passes it to wrangler on one command line).
export async function plan(data = loadData()) {
  const lines = [];
  for (const [code, items] of Object.entries(linkedIds(data))) {
    const site = await siteConfig(code);
    const ids = [...new Set(items.map(i => i.id))].sort((a, b) => a - b);
    const cols = legacy(site) ? 'id, retailer, price, stock_status, is_active, updated_at' : 'id, retailer, price, in_stock, is_active, last_seen_at';
    lines.push([code, databaseName(code), `SELECT ${cols} FROM products WHERE id IN (${ids.join(',')})`]);
  }
  return lines;
}

// The rows of a wrangler d1 execute --json answer ([{ results: [...] }]), or null when it is not one.
export function rowsOf(text) {
  const s = String(text || '');
  const i = s.indexOf('[');
  const j = s.lastIndexOf(']');
  if (i < 0 || j < i) return null;
  try {
    const parsed = JSON.parse(s.slice(i, j + 1));
    const first = Array.isArray(parsed) ? parsed[0] : null;
    return first && Array.isArray(first.results) ? first.results : null;
  } catch { return null; }
}

// A row as the site shows it: the older layout's shown retailer name, its stock words and its date column.
function asShown(site, row) {
  if (!legacy(site)) return { ...row, in_stock: Number(row.in_stock) === 1 ? 1 : 0 };
  const names = (site.database && site.database.retailerNames) || {};
  return {
    ...row,
    retailer: names[row.retailer] || row.retailer,
    in_stock: IN_STOCK_WORDS.includes(String(row.stock_status || '').trim().toLowerCase()) ? 1 : 0,
    last_seen_at: row.updated_at
  };
}

export async function judge(code, text, at = Date.now(), data = loadData()) {
  const site = await siteConfig(code);
  const items = linkedIds(data)[code] || [];
  const rows = rowsOf(text);
  const lines = [];
  let notices = 0;
  let old = 0;
  let prices = 0;
  if (!rows) {
    lines.push(`${code}: NOTICE - the database answer could not be read, so no product of this site is confirmed`);
    return { lines, notices: items.length, old: 0, prices: 0, checked: 0, text: [...lines, `GUARD ${code} checked=0 notices=${items.length} old=0 prices=0`].join('\n') };
  }
  const view = homeView(site, at);
  const byId = new Map(rows.map(r => [Number(r.id), asShown(site, r)]));
  for (const it of items) {
    const p = byId.get(it.id);
    const tag = `${code} ${it.id} (${it.guide}): ${it.name}`;
    let why = '';
    if (!p) why = 'not in the database';
    else if (Number(p.is_active) !== 1) why = 'switched off (is_active = 0)';
    else {
      const r = hiddenReason(view, p);
      if (r === 'country') why = `${p.retailer} does not deliver to the UK`;
      else if (r === 'stale') why = `no price check for 30 days (last ${String(p.last_seen_at || '-').slice(0, 10)})`;
      else if (Number(p.in_stock) !== 1) why = 'out of stock';
    }
    if (why) { notices++; lines.push(`NOTICE ${tag}: ${why}`); continue; }
    if (needsCheck(view, p)) { old++; lines.push(`OLD    ${tag}: price checked ${String(p.last_seen_at).slice(0, 10)}, more than 14 days ago`); }
    // L109: another price than the site shows stops the live step (tools/gwh-hub-v2.ps1, exit 20), like a notice.
    if (!(Math.abs(Number(p.price) - it.price) < 0.005)) { prices++; lines.push(`PRICE  ${tag}: ${money(it.price)} in guides.json, ${money(p.price)} on the site`); }
  }
  lines.push(`GUARD ${code} checked=${items.length} notices=${notices} old=${old} prices=${prices}`);
  return { lines, notices, old, prices, checked: items.length, text: lines.join('\n') };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, code, file] = process.argv.slice(2);
  if (cmd === 'plan') {
    for (const l of await plan()) console.log(l.join('\t'));
  } else if (cmd === 'judge' && SITES[code] && file) {
    // --out <file>: the findings as UTF-8 in a file (Windows PowerShell 5.1 would read the console in another code page).
    const i = process.argv.indexOf('--out');
    const text = (await judge(code, readFileSync(file, 'utf8'))).text + '\n';
    if (i > 0 && process.argv[i + 1]) writeFileSync(process.argv[i + 1], text); else process.stdout.write(text);
  } else {
    console.log('Usage: node tools/gwh-guide-guard.mjs plan | judge <site> <file>');
    process.exitCode = 2;
  }
}
