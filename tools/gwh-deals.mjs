#!/usr/bin/env node
// Gear World Hub - the deals of the home page (sites/gwh/public/hub-deals.json), made from promos/promos.js.
// The Hub shows only what the retailers or Awin gave us (lessons L32): every deal keeps its end date, and its button
// goes to the retailer page of a Gear World site (/discount-codes/<slug>/), where the code and the /go/ link are.
// The Hub never shows the code itself and never links to /go/ or /out/.
//
// Usage: node tools/gwh-deals.mjs            write the file
//        node tools/gwh-deals.mjs --check    exit 1 when the file is not what promos.js gives (used by the tests)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROMOS } from '../promos/promos.js';

const repo = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(repo, 'sites', 'gwh', 'public', 'hub-deals.json');
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// The domain of each Gear World, from its own site.config.js (no list of sites written by hand, lessons L01).
export async function siteDomains() {
  const out = {};
  const dir = join(repo, 'sites');
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name, 'site.config.js');
    if (!existsSync(file)) continue;
    const site = (await import(pathToFileURL(file).href)).default;
    if (site && /^[A-Z]{3}$/.test(site.code || '') && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(site.domain || '')) out[site.code] = site.domain;
  }
  return out;
}

export function buildDeals(promos, domains) {
  const deals = [];
  for (const p of promos) {
    if (!p || !p.id || !p.retailer || !/^[a-z0-9-]{1,40}$/.test(p.slug || '')) continue;
    if (!DAY.test(p.start || '') || !DAY.test(p.end || '') || p.start > p.end) continue;
    if (p.kind === 'code' ? !(Number(p.off) > 0) : !(Number(p.upTo) > 0)) continue;
    const sites = (p.sites || []).filter(code => domains[code]);
    if (!sites.length) continue;
    const deal = {
      id: p.id, retailer: p.retailer, slug: p.slug, kind: p.kind === 'code' ? 'code' : 'sale', campaign: p.campaign || '',
      currency: p.currency || 'GBP', sites, start: p.start, end: p.end,
      link: `https://${domains[sites[0]]}/discount-codes/${p.slug}/`
    };
    if (deal.kind === 'code') { deal.off = Number(p.off); deal.minSpend = Number(p.minSpend) || 0; }
    else deal.upTo = Number(p.upTo);
    deals.push(deal);
  }
  return deals;
}

export function dealsJson(deals) {
  return JSON.stringify({
    about: 'Made by tools/gwh-deals.mjs from promos/promos.js. Do not edit by hand: change promos.js and run the tool.',
    deals
  }, null, 2) + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = dealsJson(buildDeals(PROMOS, await siteDomains()));
  if (process.argv.includes('--check')) {
    const now = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (now !== text) { console.error('hub-deals.json is not up to date: run node tools/gwh-deals.mjs'); process.exit(1); }
    console.log('hub-deals.json is up to date.');
  } else {
    writeFileSync(OUT, text);
    console.log(`Wrote ${OUT}`);
  }
}
