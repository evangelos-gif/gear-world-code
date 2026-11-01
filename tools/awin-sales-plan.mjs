#!/usr/bin/env node
// What really sells, and from which site (1 Nov 2026, lessons L64). READ-ONLY.
// Reads the transactions that the Awin Publisher API returned (one JSON file per window of up to 31 days), the names of
// your joined programmes, and the product names from the sites' databases (wrangler output), and says:
//   - totals: how many sales, their value and your commission, by status (pending / approved / declined)
//   - by site (from our clickref "<site>-<product id>", or else from the page the click came from)
//   - by shop, and every sale with its date, site, shop, product, value, commission and status.
// Nothing is changed anywhere.
//
// node tools/awin-sales-plan.mjs --in <transactions json> [--in ...] --ids-out <file>
// node tools/awin-sales-plan.mjs --in <transactions json> [--in ...] [--programmes <json>] [--names cgw=<wrangler output> ...]
//      --from <yyyy-mm-dd> --to <yyyy-mm-dd> --out <dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rowsFromWrangler } from './cleanup-rules/tidy.mjs';

export const SITE_DB = {
  cgw: 'construction-gear-customers', mgw: 'mens-gear-world', wgw: 'womens-gear-world', kgw: 'kids-gear-world',
  hgw: 'home-gear-world', ggw: 'garden-gear-world', tgw: 'technology-gear-world', agw: 'car-gear-world',
  vgw: 'travel-gear-world', sgw: 'sporty-gear-world', bgw: 'biker-gear-world', pgw: 'gaming-gear-world'
};
export const SITE_DOMAINS = {
  'constructiongearworld.com': 'cgw', 'mensgearworld.com': 'mgw', 'womensgearworld.com': 'wgw', 'kidsgearworld.com': 'kgw',
  'homegearworld.com': 'hgw', 'gardengearworld.com': 'ggw', 'technologygearworld.com': 'tgw', 'cargearworld.com': 'agw',
  'travelgearworld.com': 'vgw', 'sportygearworld.com': 'sgw', 'bikergearworld.com': 'bgw', 'gaminggearworld.com': 'pgw',
  'gearworldhub.com': 'hub', 'gearworldgroup.com': 'group'
};
const STATUS = { pending: 'εκκρεμεί', approved: 'εγκρίθηκε', declined: 'απορρίφθηκε', deleted: 'διαγράφηκε' };

export function clickRefOf(t) {
  const c = (t && t.clickRefs) || {};
  return String(c.clickRef || (t && t.clickRef) || '').trim();
}

// The site (and product) of a sale: our clickref "<site>-<id>" or "<site>-promo-<id>" (src/engine.js), else the page.
export function siteOf(t) {
  const ref = clickRefOf(t);
  const m = /^([a-z]{3})-(promo-)?(\d{1,12})$/i.exec(ref);
  if (m && SITE_DB[m[1].toLowerCase()]) {
    return { site: m[1].toLowerCase(), productId: m[2] ? null : Number(m[3]), promoId: m[2] ? Number(m[3]) : null, ref, from: 'clickref' };
  }
  for (const u of [t && t.publisherUrl, t && t.url]) {
    try {
      const host = new URL(String(u)).hostname.toLowerCase().replace(/^www\./, '');
      if (SITE_DOMAINS[host]) return { site: SITE_DOMAINS[host], productId: null, promoId: null, ref, from: 'page' };
    } catch { /* not an address */ }
  }
  return { site: '', productId: null, promoId: null, ref, from: '' };
}

const money = x => {
  const a = x && Number(x.amount);
  return { amount: Number.isFinite(a) ? a : 0, currency: String((x && x.currency) || 'GBP').toUpperCase() };
};

// Transactions from several API answers (windows), each once.
export function readTransactions(texts) {
  const seen = new Map();
  for (const text of texts) {
    const j = JSON.parse(String(text).replace(/^﻿/, ''));
    if (!Array.isArray(j)) throw new Error('the Awin answer is not a list of transactions');
    for (const t of j) if (t && t.id != null && !seen.has(String(t.id))) seen.set(String(t.id), t);
  }
  return [...seen.values()];
}

// Advertiser id -> name, from GET /publishers/<id>/programmes.
export function readProgrammes(text) {
  const out = {};
  if (!text) return out;
  const j = JSON.parse(String(text).replace(/^﻿/, ''));
  for (const p of Array.isArray(j) ? j : []) if (p && p.id != null && p.name) out[String(p.id)] = String(p.name);
  return out;
}

export function productIdsBySite(transactions) {
  const by = {};
  for (const t of transactions) {
    const s = siteOf(t);
    if (s.site && s.productId) (by[s.site] = by[s.site] || new Set()).add(s.productId);
  }
  return Object.fromEntries(Object.entries(by).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]));
}

export function planSales({ transactions, programmes = {}, names = {} }) {
  const rows = transactions.map(t => {
    const s = siteOf(t);
    const status = String(t.commissionStatus || '').toLowerCase();
    const adv = String(t.advertiserId || '');
    return {
      id: String(t.id), date: String(t.transactionDate || '').slice(0, 10), clickDate: String(t.clickDate || '').slice(0, 10),
      status, sale: money(t.saleAmount), commission: money(t.commissionAmount), advertiserId: adv,
      shop: programmes[adv] || (adv ? `Awin ${adv}` : '?'), declineReason: t.declineReason || '',
      ...s, name: s.site && s.productId ? (names[`${s.site}-${s.productId}`] || '') : ''
    };
  }).sort((a, b) => (b.date.localeCompare(a.date)) || a.id.localeCompare(b.id));
  const add = (map, key, r) => {
    const e = map.get(key) || { key, n: 0, live: 0, sale: {}, commission: {} };
    e.n++;
    if (r.status !== 'declined' && r.status !== 'deleted') {
      e.live++;
      e.sale[r.sale.currency] = (e.sale[r.sale.currency] || 0) + r.sale.amount;
      e.commission[r.commission.currency] = (e.commission[r.commission.currency] || 0) + r.commission.amount;
    }
    map.set(key, e);
  };
  const byStatus = new Map(), bySite = new Map(), byShop = new Map(), byProduct = new Map();
  for (const r of rows) {
    const e = byStatus.get(r.status) || { key: r.status, n: 0, commission: {} };
    e.n++; e.commission[r.commission.currency] = (e.commission[r.commission.currency] || 0) + r.commission.amount;
    byStatus.set(r.status, e);
    add(bySite, r.site || '?', r);
    add(byShop, `${r.shop}|${r.advertiserId}`, r);
    if (r.site && r.productId) add(byProduct, `${r.site}-${r.productId}`, r);
  }
  const live = rows.filter(r => r.status !== 'declined' && r.status !== 'deleted');
  const sum = (list, f) => list.reduce((acc, r) => { const m = f(r); acc[m.currency] = (acc[m.currency] || 0) + m.amount; return acc; }, {});
  const order = list => [...list.values()].sort((a, b) => (b.live - a.live) || (b.n - a.n));
  return {
    rows, live: live.length, sale: sum(live, r => r.sale), commission: sum(live, r => r.commission),
    byStatus: [...byStatus.values()], bySite: order(bySite), byShop: order(byShop), byProduct: order(byProduct),
    unknown: rows.filter(r => !r.site).length
  };
}

const fmtMoney = m => {
  const parts = Object.entries(m || {}).filter(([, v]) => Math.abs(v) > 0.0001);
  if (!parts.length) return '£0.00';
  return parts.map(([c, v]) => (c === 'GBP' ? '£' : c === 'EUR' ? '€' : c + ' ') + v.toFixed(2)).join(' + ');
};
const one = m => fmtMoney({ [m.currency]: m.amount });

export function renderSalesReport(plan, { from = '', to = '' } = {}) {
  const L = [];
  L.push(`Πωλήσεις από το Awin ${from} έως ${to} (με ημερομηνία πώλησης). Μόνο ανάγνωση.`);
  if (!plan.rows.length) {
    L.push('Καμία πώληση σε αυτές τις μέρες.');
    return L.join('\n') + '\n';
  }
  const st = plan.byStatus.map(s => `${STATUS[s.key] || s.key} ${s.n} (${fmtMoney(s.commission)})`).join(' · ');
  L.push(`Σύνολο: ${plan.rows.length} πωλήσεις. Χωρίς τις απορριφθείσες: ${plan.live}, αξία ${fmtMoney(plan.sale)}, προμήθεια ${fmtMoney(plan.commission)}.`);
  L.push(`Κατάσταση: ${st}.`);
  L.push('');
  L.push('Ανά site (προμήθεια χωρίς τις απορριφθείσες):');
  for (const s of plan.bySite) L.push(`   ${(s.key === '?' ? 'άγνωστο' : s.key.toUpperCase()).padEnd(8)} ${String(s.n).padStart(3)} πωλήσεις · προμήθεια ${fmtMoney(s.commission)}`);
  if (plan.unknown) L.push(`   (άγνωστο = η πώληση δεν έχει clickref του Gear World ούτε σελίδα από τα sites: παλιό link ή άλλη πηγή)`);
  L.push('');
  L.push('Ανά κατάστημα:');
  for (const s of plan.byShop) { const [name, id] = s.key.split('|'); L.push(`   ${name}${id && !name.endsWith(id) ? ` (Awin ${id})` : ''}: ${s.n} πωλήσεις · προμήθεια ${fmtMoney(s.commission)}`); }
  L.push('');
  L.push('Όλες οι πωλήσεις (νεότερες πρώτα):');
  for (const r of plan.rows) {
    const where = r.site ? r.site.toUpperCase() : 'άγνωστο';
    const what = r.productId ? `${r.name ? `«${r.name.slice(0, 70)}» ` : ''}(προϊόν #${r.productId})` : r.promoId ? `(κουπόνι #${r.promoId})` : (r.ref ? `(clickref ${r.ref})` : '');
    let line = `   ${r.date}  ${where.padEnd(7)} ${r.shop}  ${what}  αξία ${one(r.sale)}  προμήθεια ${one(r.commission)}  ${STATUS[r.status] || r.status}`;
    if (r.status === 'declined' && r.declineReason) line += ` (${String(r.declineReason).slice(0, 80)})`;
    L.push(line);
  }
  return L.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
  const all = k => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
  const transactions = readTransactions(all('--in').map(f => readFileSync(f, 'utf8')));
  if (opt('--ids-out')) {
    const ids = productIdsBySite(transactions);
    writeFileSync(opt('--ids-out'), Object.entries(ids).filter(([k]) => SITE_DB[k]).map(([k, v]) => `${k} ${SITE_DB[k]} ${v.join(',')}`).join('\n') + '\n');
  } else {
    const programmes = opt('--programmes') ? readProgrammes(readFileSync(opt('--programmes'), 'utf8')) : {};
    const names = {};
    for (const s of all('--names')) {
      const site = s.slice(0, s.indexOf('=')), file = s.slice(s.indexOf('=') + 1);
      try { for (const r of rowsFromWrangler(readFileSync(file, 'utf8'))) names[`${site}-${r.id}`] = String(r.product_name || ''); } catch { /* names are optional */ }
    }
    const out = opt('--out');
    mkdirSync(out, { recursive: true });
    const plan = planSales({ transactions, programmes, names });
    writeFileSync(join(out, 'report.txt'), renderSalesReport(plan, { from: opt('--from'), to: opt('--to') }));
    writeFileSync(join(out, 'summary.json'), JSON.stringify({ sales: plan.rows.length, live: plan.live, commission: plan.commission,
      bySite: plan.bySite.map(s => ({ site: s.key, n: s.n, commission: s.commission })) }, null, 2));
  }
}
