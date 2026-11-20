#!/usr/bin/env node
// Helper of tools/bol-refresh-setup.ps1 (lessons L205): READ-ONLY test of the bol.com catalog keys before they become
// Worker secrets. The keys reach this process ONLY through its environment (GW_BOL_ID, GW_BOL_SECRET, set for this one
// process by the PowerShell tool) and are never printed: the one JSON line on stdout goes through the mask.
//   node tools/bol-refresh.mjs --mode key-test
//     ONE token and ONE call (the popular list, page-size 1, NL) of the Marketing Catalog API (src/lib/bol-catalog.js):
//     refused = 401 (wrong keys), blocked = 403/429 (too many requests: no new try), ok = the API answered 200.
// Nothing here writes to stderr: in Windows PowerShell 5.1 with ErrorActionPreference Stop, a stderr line stops the tool.
import { pathToFileURL } from 'node:url';
import { session, base64Utf8, okBase, LOGIN_BASE, API_BASE } from '../src/lib/bol-catalog.js';

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
    result = mode === 'key-test' ? await keyTest({ id, secret }) : { ok: false, error: 'mode must be key-test' };
  } catch (e) {
    result = { ok: false, error: `crash: ${String(e && e.message || e).slice(0, 200)}` };
  }
  console.log(mask(JSON.stringify(result), values));
}
