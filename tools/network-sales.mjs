#!/usr/bin/env node
// Helper of tools/network-sales-setup.ps1 (lessons L197): READ-ONLY checks with a key typed at the prompt. The key
// reaches this process ONLY through its environment (set for this one process by the PowerShell tool) and is never
// printed: the one JSON line on stdout goes through mask().
//   node tools/network-sales.mjs --mode cj-test --cid 8114224,7806395     (GW_NS_CJ_TOKEN)
//     One Commission Detail question per CID for the last 30 days (src/networks/cj.js): is the key accepted, and how
//     many commissions each CID has. Docs: https://developers.cj.com/graphql/reference/Commission%20Detail
//   node tools/network-sales.mjs --mode linkwise-probe                     (GW_NS_LW_USER, GW_NS_LW_PASS)
//     reports_transaction.json and programs.json of the Linkwise API (https://affiliate.linkwi.se/api/1.1/), once each,
//     with no parameters: only the parameter names, field names and messages are reported, never the values of a
//     transaction or a programme (TODO(linkwise) in src/networks/linkwise.js).
// Nothing here writes to stderr: in Windows PowerShell 5.1 with ErrorActionPreference Stop, a stderr line stops the tool.
import { pathToFileURL } from 'node:url';
import { CJ_COMMISSIONS_API, commissionsQuery } from '../src/networks/cj.js';
import { LW_API, basicAuth } from '../src/networks/linkwise.js';
import { iso, makeMask } from '../src/networks/common.js';

const read = async res => { let t = ''; try { t = await res.text(); } catch { /* no body */ } let j = null; try { j = JSON.parse(t); } catch { /* not JSON */ } return { t, j }; };

export async function cjTest({ token, cids, fetchImpl = fetch, now = new Date() }) {
  const out = { ok: false, refused: false, cids: [] };
  if (!token || token.length < 10) return { ...out, error: 'no CJ key' };
  const since = iso(new Date(now.getTime() - 30 * 864e5));
  for (const cid of cids) {
    let res;
    try {
      res = await fetchImpl(CJ_COMMISSIONS_API, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: commissionsQuery(cid, { sincePostingDate: since, beforePostingDate: iso(now) }) }) });
    } catch (e) { out.cids.push({ cid, ok: false, error: `network: ${String(e && e.message || e).slice(0, 120)}` }); continue; }
    const { t, j } = await read(res);
    if (res.status === 401 || res.status === 403 || /invalid auth token/i.test(t)) { out.refused = true; out.cids.push({ cid, ok: false, error: `refused (${res.status})` }); break; }
    const errs = j && Array.isArray(j.errors) && j.errors.length ? j.errors.map(e => (e && e.message) || '').join('; ').slice(0, 200) : '';
    const block = j && j.data && j.data.publisherCommissions;
    if (errs || !block) { out.cids.push({ cid, ok: false, error: errs || `HTTP ${res.status}` }); continue; }
    out.cids.push({ cid, ok: true, count: Number(block.count) || 0 });
  }
  out.ok = !out.refused && out.cids.some(c => c.ok);
  return out;
}

const keysOf = o => (o && typeof o === 'object' && !Array.isArray(o) ? Object.keys(o).slice(0, 60) : []);
const firstArray = j => { if (Array.isArray(j)) return j; if (j && typeof j === 'object') for (const v of Object.values(j)) if (Array.isArray(v)) return v; return null; };
// Values reported as they are: only the ones that describe the call, never data.
const TELL = ['error', 'errors', 'message', 'messages', 'description', 'parameters', 'params', 'usage', 'help'];

export async function linkwiseProbe({ user, pass, fetchImpl = fetch, api = LW_API }) {
  const out = { ok: false, calls: [] };
  if (!user || !pass) return { ...out, error: 'no Linkwise API login' };
  const host = new URL(api).hostname;
  if (host !== 'affiliate.linkwi.se' && host !== '127.0.0.1') return { ...out, error: 'unexpected API address' };
  for (const path of ['/reports_transaction.json', '/programs.json']) {
    const c = { path, status: 0, kind: '', keys: [], itemKeys: [], items: null, tell: {} };
    let res;
    try { res = await fetchImpl(api + path, { method: 'GET', headers: { authorization: basicAuth(user, pass), accept: 'application/json' } }); }
    catch (e) { c.error = `network: ${String(e && e.message || e).slice(0, 120)}`; out.calls.push(c); continue; }
    c.status = res.status;
    c.type = String((res.headers && typeof res.headers.get === 'function' && res.headers.get('content-type')) || '').slice(0, 60);
    const { t, j } = await read(res);
    if (j !== null) {
      c.kind = Array.isArray(j) ? 'array' : typeof j;
      c.keys = keysOf(j);
      const arr = firstArray(j);
      if (arr) { c.items = arr.length; c.itemKeys = keysOf(arr.find(x => x && typeof x === 'object')); }
      if (j && typeof j === 'object' && !Array.isArray(j)) for (const k of TELL) if (j[k] !== undefined) c.tell[k] = JSON.stringify(j[k]).slice(0, 400);
    } else if (res.status >= 400) {
      c.kind = 'text';
      c.tell.text = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
    } else {
      // XML or HTML with status 200: only its tag names (its text could be data).
      c.kind = 'markup';
      c.tags = [...new Set((t.match(/<([A-Za-z_][\w.-]*)/g) || []).map(x => x.slice(1)))].slice(0, 60);
    }
    out.calls.push(c);
  }
  out.ok = out.calls.some(c => c.status === 200);
  out.refused = out.calls.length > 0 && out.calls.every(c => c.status === 401 || c.status === 403);
  return out;
}

function arg(name) { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] || '' : ''; }

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const mode = arg('--mode');
  const secrets = [process.env.GW_NS_CJ_TOKEN, process.env.GW_NS_LW_USER, process.env.GW_NS_LW_PASS].filter(Boolean).map(String);
  if (process.env.GW_NS_LW_USER && process.env.GW_NS_LW_PASS) secrets.push(basicAuth(process.env.GW_NS_LW_USER, process.env.GW_NS_LW_PASS).slice(6));
  const mask = makeMask(secrets);
  let result;
  try {
    if (mode === 'cj-test') {
      const cids = arg('--cid').split(/[,\s]+/).filter(x => /^\d{3,12}$/.test(x));
      result = cids.length ? await cjTest({ token: String(process.env.GW_NS_CJ_TOKEN || '').trim(), cids }) : { ok: false, error: 'no CJ account number (CID)' };
    } else if (mode === 'linkwise-probe') {
      const api = arg('--api') || LW_API;
      result = await linkwiseProbe({ user: String(process.env.GW_NS_LW_USER || '').trim(), pass: String(process.env.GW_NS_LW_PASS || ''), api });
    } else {
      result = { ok: false, error: 'mode must be cj-test or linkwise-probe' };
    }
  } catch (e) {
    result = { ok: false, error: `crash: ${String(e && e.message || e).slice(0, 200)}` };
  }
  console.log(mask(JSON.stringify(result)));
}
