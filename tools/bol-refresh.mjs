#!/usr/bin/env node
// Helper of tools/bol-refresh-setup.ps1 (lessons L205): READ-ONLY test of the bol.com catalog keys before they become
// Worker secrets. The keys reach this process ONLY through its environment (GW_BOL_ID, GW_BOL_SECRET, set for this one
// process by the PowerShell tool) and are never printed: the one JSON line on stdout goes through the mask.
//   node tools/bol-refresh.mjs --mode key-test
//     ONE token and ONE call (the popular list, page-size 1, NL) of the Marketing Catalog API (src/lib/bol-catalog.js):
//     refused = 401 (wrong keys), blocked = 403/429 (too many requests: no new try), ok = the API answered 200.
//   node tools/bol-refresh.mjs --mode aliases
//     READ-ONLY, no network: per site, the retailer names the setup's check counts through the retailer index: 'bol.com'
//     and every stored name of the site's retailerNames (src/db.js: { stored: shown }) that is shown as bol.com or looks
//     like bol.com. The Worker refreshes only rows stored exactly as 'bol.com', so any other name there is a ΠΡΟΣΟΧΗ.
// Nothing here writes to stderr: in Windows PowerShell 5.1 with ErrorActionPreference Stop, a stderr line stops the tool.
import { pathToFileURL } from 'node:url';
import { session, base64Utf8, okBase, LOGIN_BASE, API_BASE } from '../src/lib/bol-catalog.js';
import { BOL_RETAILER } from '../src/lib/bol-lists.js';
import { BOL_SITES } from '../src/bol-refresh.js';

// The names to count for one site: 'bol.com' first, then its aliases (stored names shown as bol.com, or like bol.com).
export function bolAliases(config) {
  const names = (config && config.database && config.database.retailerNames) || {};
  const out = [BOL_RETAILER];
  for (const [stored, shown] of Object.entries(names)) {
    if (stored === BOL_RETAILER) continue;
    if (String(shown).trim().toLowerCase() === BOL_RETAILER || /\bbol(\.com)?\b/i.test(stored)) out.push(stored);
  }
  return out;
}
export async function siteAliases(sites = BOL_SITES) {
  const out = {};
  for (const s of sites) {
    const m = await import(new URL(`../sites/${s.code}/site.config.js`, import.meta.url).href);
    out[s.code] = bolAliases(m.default || m);
  }
  return out;
}

export async function keyTest({ id, secret, fetchImpl = fetch, loginBase = LOGIN_BASE, apiBase = API_BASE }) {
  const out = { ok: false, refused: false, blocked: false, status: 0, tokens: 0, calls: 0 };
  if (!id || !secret) return { ...out, error: 'no bol.com catalog keys' };
  if (!okBase(loginBase, 'login.bol.com') || !okBase(apiBase, 'api.bol.com')) return { ...out, error: 'the keys go only to login.bol.com and api.bol.com' };
  const api = session({ id, secret, loginBase, apiBase, fetchImpl, userAgent: 'GearWorld-bol-refresh-setup/1.0 (+https://gearworldgroup.com)' });
  try {
    const r = await api.get('/products/lists/popular', { 'country-code': 'NL', page: 1, 'page-size': 1 });
    out.status = r.status;
    out.ok = r.status === 200;
    if (!out.ok) out.error = `HTTP ${r.status}${r.why ? ` ${r.why.slice(0, 80)}` : ''}`;
  } catch (e) {
    if (e && e.code === 3) out.refused = true;
    else if (e && e.code === 6) out.blocked = true;
    out.error = String(e && e.message || e).slice(0, 160);
  }
  out.tokens = api.stats.tokens;
  out.calls = api.stats.calls;
  return out;
}

function mask(text, values) {
  let t = String(text);
  for (const v of values) if (v && v.length >= 4) t = t.split(v).join('[secret]');
  return t.replace(/((?:Bearer|Basic)\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[secret]');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const i = process.argv.indexOf('--mode');
  const mode = i > 0 ? process.argv[i + 1] || '' : '';
  const id = String(process.env.GW_BOL_ID || '').trim();
  const secret = String(process.env.GW_BOL_SECRET || '').trim();
  const values = [id, secret, id && secret ? base64Utf8(`${id}:${secret}`) : ''];
  let result;
  try {
    if (mode === 'key-test') result = await keyTest({ id, secret });
    else if (mode === 'aliases') result = { ok: true, sites: await siteAliases() };
    else result = { ok: false, error: 'mode must be key-test or aliases' };
  } catch (e) {
    result = { ok: false, error: `crash: ${String(e && e.message || e).slice(0, 200)}` };
  }
  console.log(mask(JSON.stringify(result), values));
}
