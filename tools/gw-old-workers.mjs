// Gear World: can the old Workers go? READ-ONLY. Used by tools/gw-old-workers.ps1.
// It reads the Cloudflare settings with the login that wrangler already has (the token comes in the environment
// variable GW_CF_TOKEN and is never printed or saved) and answers for each candidate Worker:
//   - does it exist, when was it last deployed
//   - custom domains and routes that send visitors to it, its workers.dev address, cron triggers
//   - who uses it: service bindings, tail consumers and Durable Objects of the other Workers, queues, Pages projects
//   - requests in the last 7 days (when Cloudflare lets this login read them)
// A candidate is "safe" only when nothing sends visitors to it and nothing uses it.
//
//   node tools/gw-old-workers.mjs check  <candidates,comma,separated> <protected,comma,separated>   -> JSON on stdout
//   node tools/gw-old-workers.mjs backup <worker name> <folder>   -> its code, settings and deployments into the folder
//   node tools/gw-old-workers.mjs delete <worker name> <candidates> <protected>   -> CHANGES CLOUDFLARE: checks once more
//        that it is "safe", then deletes it with force=false (Cloudflare itself refuses a Worker that is still used).
//        Only tools/gw-old-workers.ps1 calls this, after the owner's approval phrase.
//
// For tests, GW_CF_FAKE can name a JSON file of fake answers ("GET /path": {...}); then nothing goes to Cloudflare.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const API = 'https://api.cloudflare.com/client/v4';
const NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function makeApi({ token, base = API, fetchImpl = globalThis.fetch, fake = null }) {
  return async function api(path, init = {}) {
    const method = init.method || 'GET';
    if (fake) {
      const key = `${method} ${path}`;
      if (!(key in fake)) return { success: false, errors: [{ code: 404, message: 'not in the fake answers' }], result: null };
      const entry = fake[key];
      if (init.raw) return { success: entry.success !== false, raw: Buffer.from(String(entry.raw_text || '')), type: entry.type || '' };
      return entry;
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetchImpl(base + path, {
          method,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
          body: init.body,
          signal: controller.signal
        });
        const raw = init.raw ? Buffer.from(await response.arrayBuffer()) : null;
        if (raw) return { success: response.ok, status: response.status, raw, type: response.headers.get('content-type') || '' };
        const data = await response.json().catch(() => ({ success: false, errors: [{ message: `HTTP ${response.status}` }] }));
        if (!('success' in data)) data.success = response.ok;
        data.status = response.status;
        return data;
      } catch (error) {
        if (attempt === 2) return { success: false, errors: [{ message: String(error && error.message || error) }], result: null };
      } finally {
        clearTimeout(timer);
      }
    }
    return { success: false, errors: [{ message: 'no answer' }], result: null };
  };
}

async function listAll(api, path) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const r = await api(`${path}${sep}page=${page}&per_page=50`);
    if (!r.success) return page === 1 ? null : out;
    const items = Array.isArray(r.result) ? r.result : [];
    out.push(...items);
    const info = r.result_info || {};
    if (!info.total_pages || page >= info.total_pages || items.length === 0) break;
  }
  return out;
}

// What blocks a delete, and what only needs a look.
export function verdict(info) {
  if (!info.exists) return { status: 'missing', reasons: [] };
  const reasons = [];
  if (info.domains.length) reasons.push(`custom domain: ${info.domains.join(', ')}`);
  if (info.routes.length) reasons.push(`route: ${info.routes.join(', ')}`);
  if (info.crons.length) reasons.push(`cron: ${info.crons.join(', ')}`);
  if (info.usedBy.length) reasons.push(`used by: ${info.usedBy.join(', ')}`);
  if (info.checksFailed.length) reasons.push(`could not check: ${info.checksFailed.join(', ')}`);
  return { status: reasons.length ? 'keep' : 'safe', reasons };
}

export async function inspect({ api, candidates, protectedNames, now = Date.now() }) {
  for (const name of candidates) {
    if (protectedNames.includes(name)) throw new Error(`${name} is protected and can never be a candidate`);
  }
  const report = { account: null, subdomain: '', notes: [], workers: [] };
  const accounts = await listAll(api, '/accounts');
  if (!accounts || !accounts.length) throw new Error('Cloudflare did not list any account for this login');
  // The account of the Gear World Workers: the one that has the protected Workers (e.g. gear-world-hub).
  let account = null;
  let scripts = [];
  for (const acc of accounts) {
    const list = await listAll(api, `/accounts/${acc.id}/workers/scripts`);
    if (!list) continue;
    const names = list.map(s => String(s.id || s.name || ''));
    if (!account || protectedNames.some(n => names.includes(n))) { account = acc; scripts = names; }
    if (protectedNames.some(n => names.includes(n))) break;
  }
  if (!account) throw new Error('Could not read the Workers of the account');
  report.account = account.id;
  const acc = account.id;
  const sub = await api(`/accounts/${acc}/workers/subdomain`);
  report.subdomain = (sub.success && sub.result && sub.result.subdomain) || '';

  const failed = new Set();
  const domains = await listAll(api, `/accounts/${acc}/workers/domains`);
  if (!domains) failed.add('custom domains');
  const routes = [];
  const zones = await listAll(api, '/zones');
  if (!zones) failed.add('routes');
  for (const zone of zones || []) {
    const r = await api(`/zones/${zone.id}/workers/routes`);
    if (!r.success) { failed.add(`routes of ${zone.name}`); continue; }
    for (const route of r.result || []) routes.push({ pattern: route.pattern, script: route.script || '' });
  }

  // Who uses whom: the settings of EVERY Worker of the account.
  const usedBy = new Map(candidates.map(c => [c, []]));
  for (const name of scripts) {
    const r = await api(`/accounts/${acc}/workers/scripts/${encodeURIComponent(name)}/settings`);
    if (!r.success) { failed.add(`settings of ${name}`); continue; }
    const s = r.result || {};
    for (const b of s.bindings || []) {
      const target = b.type === 'service' ? b.service : b.type === 'durable_object_namespace' ? b.script_name : '';
      if (target && target !== name && usedBy.has(target)) usedBy.get(target).push(`${name} (${b.type} ${b.name || ''})`.trim());
    }
    for (const t of s.tail_consumers || []) {
      if (t && t.service && t.service !== name && usedBy.has(t.service)) usedBy.get(t.service).push(`${name} (tail consumer)`);
    }
  }
  const kv = await listAll(api, `/accounts/${acc}/storage/kv/namespaces`);
  if (!kv) report.notes.push('KV namespaces: not readable with this login');
  const queues = await listAll(api, `/accounts/${acc}/queues`);
  if (!queues) report.notes.push('queues: not readable with this login');
  for (const q of queues || []) {
    for (const c of q.consumers || []) {
      const script = c.script || c.script_name || c.service || '';
      if (usedBy.has(script)) usedBy.get(script).push(`queue ${q.queue_name || q.queue_id}`);
    }
    for (const p of q.producers || []) {
      const script = p.script || p.service || '';
      if (usedBy.has(script)) usedBy.get(script).push(`queue producer ${q.queue_name || q.queue_id}`);
    }
  }
  const pages = await listAll(api, `/accounts/${acc}/pages/projects`);
  if (!pages) report.notes.push('Pages projects: not readable with this login');
  for (const p of pages || []) {
    for (const env of ['production', 'preview']) {
      const services = (((p.deployment_configs || {})[env] || {}).services) || {};
      for (const [binding, svc] of Object.entries(services)) {
        const target = svc && svc.service;
        if (usedBy.has(target)) usedBy.get(target).push(`Pages ${p.name} (${env} ${binding})`);
      }
    }
  }

  // Requests in the last 7 days (needs analytics access; when missing it only says so).
  const since = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  const gql = await api('/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query: 'query($acc: String!, $since: Time!, $names: [String!]) { viewer { accounts(filter: {accountTag: $acc}) { workersInvocationsAdaptive(limit: 1000, filter: {datetime_geq: $since, scriptName_in: $names}) { sum { requests } dimensions { scriptName } } } } }',
      variables: { acc, since, names: candidates }
    })
  });
  const requests = new Map();
  const rows = gql && gql.data && gql.data.viewer && gql.data.viewer.accounts && gql.data.viewer.accounts[0] && gql.data.viewer.accounts[0].workersInvocationsAdaptive;
  if (Array.isArray(rows) && !(gql.errors && gql.errors.length)) {
    for (const c of candidates) requests.set(c, 0);
    for (const row of rows) {
      const n = row && row.dimensions && row.dimensions.scriptName;
      if (requests.has(n)) requests.set(n, requests.get(n) + Number((row.sum && row.sum.requests) || 0));
    }
  } else {
    report.notes.push('requests of the last 7 days: not readable with this login');
  }

  for (const name of candidates) {
    const info = {
      name, exists: scripts.includes(name), lastDeploy: '', workersDev: null, domains: [], routes: [], crons: [],
      usedBy: (usedBy.get(name) || []).slice(), requests7d: requests.has(name) ? requests.get(name) : null,
      checksFailed: [...failed], kvLeftover: []
    };
    if (info.exists) {
      info.domains = (domains || []).filter(d => d.service === name).map(d => d.hostname);
      info.routes = routes.filter(r => r.script === name).map(r => r.pattern);
      const sd = await api(`/accounts/${acc}/workers/scripts/${encodeURIComponent(name)}/subdomain`);
      if (sd.success && sd.result) info.workersDev = !!sd.result.enabled;
      const sc = await api(`/accounts/${acc}/workers/scripts/${encodeURIComponent(name)}/schedules`);
      if (sc.success) info.crons = ((sc.result && sc.result.schedules) || []).map(s => s.cron).filter(Boolean);
      else info.checksFailed.push('cron triggers');
      const dep = await api(`/accounts/${acc}/workers/scripts/${encodeURIComponent(name)}/deployments`);
      const list = (dep.success && dep.result && dep.result.deployments) || [];
      info.lastDeploy = list.map(d => String(d.created_on || '')).sort().pop() || '';
      // The same check wrangler makes before a delete: who points to this Worker.
      const refs = await api(`/accounts/${acc}/workers/scripts/${encodeURIComponent(name)}/references`);
      if (!refs.success) info.checksFailed.push('references');
      const r = (refs.success && refs.result) || {};
      for (const s of ((r.services || {}).incoming) || []) info.usedBy.push(`${s.service || s.script || '?'} (service binding)`);
      for (const d of r.durable_objects || []) {
        if ((d.service || d.script) && (d.service || d.script) !== name) info.usedBy.push(`${d.service || d.script} (Durable Object)`);
      }
      for (const o of r.dispatch_outbounds || []) info.usedBy.push(`${o.service || o.script || '?'} (dispatch outbound)`);
      if (Array.isArray(r.pages_function) ? r.pages_function.length : r.pages_function) info.usedBy.push('a Pages project (service binding)');
      const tails = await api(`/accounts/${acc}/workers/tails/by-consumer/${encodeURIComponent(name)}`);
      if (!tails.success) info.checksFailed.push('tail producers');
      for (const tp of (tails.success && Array.isArray(tails.result) ? tails.result : [])) {
        const producer = tp && tp.producer && (tp.producer.service || tp.producer.script);
        info.usedBy.push(`${producer || '?'} (tail consumer)`);
      }
      info.usedBy = [...new Set(info.usedBy)];
      info.kvLeftover = (kv || []).map(n => String(n.title || '')).filter(title => title === `__${name}-workers_sites_assets`);
    }
    info.verdict = verdict(info);
    report.workers.push(info);
  }
  return report;
}

// Before a delete: the code, the settings (names of bindings and secrets, never their values) and the deployments.
export async function backup({ api, account, name, folder }) {
  mkdirSync(folder, { recursive: true });
  const base = `/accounts/${account}/workers/scripts/${encodeURIComponent(name)}`;
  const saved = [];
  const content = await api(`${base}/content/v2`, { raw: true });
  if (content.success && content.raw) {
    const ext = /javascript/.test(content.type) ? 'js' : /multipart/.test(content.type) ? 'multipart.txt' : 'bin';
    writeFileSync(join(folder, `${name}-code.${ext}`), content.raw);
    saved.push(`${name}-code.${ext}`);
  }
  for (const [part, path] of [['settings', `${base}/settings`], ['deployments', `${base}/deployments`], ['schedules', `${base}/schedules`]]) {
    const r = await api(path);
    if (r.success) { writeFileSync(join(folder, `${name}-${part}.json`), JSON.stringify(r.result, null, 2)); saved.push(`${name}-${part}.json`); }
  }
  return saved;
}

// CHANGES CLOUDFLARE. Only for a Worker of the list, never a protected one, and only when it is still "safe" right
// before. force=false: Cloudflare itself refuses to delete a Worker that another one still uses.
export async function deleteWorker({ api, name, candidates, protectedNames }) {
  if (!NAME.test(String(name || '')) || !candidates.includes(name) || protectedNames.includes(name)) {
    throw new Error('This Worker is not on the list of old Workers');
  }
  const report = await inspect({ api, candidates: [name], protectedNames });
  const info = report.workers[0];
  if (info.verdict.status === 'missing') return { name, deleted: false, missing: true };
  if (info.verdict.status !== 'safe') throw new Error(`${name} is not safe to delete: ${info.verdict.reasons.join('; ')}`);
  const r = await api(`/accounts/${report.account}/workers/scripts/${encodeURIComponent(name)}?force=false`, { method: 'DELETE' });
  if (!r.success) throw new Error(`Cloudflare did not delete ${name}: ${((r.errors || [])[0] || {}).message || 'unknown error'}`);
  return { name, deleted: true };
}

async function main() {
  const [step, a, b] = process.argv.slice(2);
  const fakeFile = process.env.GW_CF_FAKE;
  const token = process.env.GW_CF_TOKEN || '';
  if (!fakeFile && !token) throw new Error('No Cloudflare login (GW_CF_TOKEN) was given');
  const api = makeApi({ token, fake: fakeFile ? JSON.parse(readFileSync(fakeFile, 'utf8')) : null });
  if (step === 'check') {
    const candidates = String(a || '').split(',').map(s => s.trim()).filter(Boolean);
    const protectedNames = String(b || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!candidates.length || !candidates.every(n => NAME.test(n)) || !protectedNames.every(n => NAME.test(n))) throw new Error('Bad Worker names');
    const report = await inspect({ api, candidates, protectedNames });
    process.stdout.write(JSON.stringify(report) + '\n');
    return;
  }
  if (step === 'backup') {
    if (!NAME.test(String(a || '')) || !b) throw new Error('Usage: backup <worker> <folder>');
    const accounts = await listAll(api, '/accounts');
    let account = null;
    for (const acc of accounts || []) {
      const list = await listAll(api, `/accounts/${acc.id}/workers/scripts`);
      if (list && list.some(s => String(s.id || s.name) === a)) { account = acc.id; break; }
    }
    if (!account) throw new Error(`Worker ${a} not found`);
    const saved = await backup({ api, account, name: a, folder: b });
    process.stdout.write(JSON.stringify({ saved }) + '\n');
    return;
  }
  if (step === 'delete') {
    const candidates = String(b || '').split(',').map(s => s.trim()).filter(Boolean);
    const protectedNames = String(process.argv[5] || '').split(',').map(s => s.trim()).filter(Boolean);
    process.stdout.write(JSON.stringify(await deleteWorker({ api, name: a, candidates, protectedNames })) + '\n');
    return;
  }
  throw new Error('Usage: check <candidates> <protected> | backup <worker> <folder> | delete <worker> <candidates> <protected>');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    // Never the token: only the message of the error.
    process.stdout.write(JSON.stringify({ error: String(error && error.message || error) }) + '\n');
    process.exit(1);
  });
}
