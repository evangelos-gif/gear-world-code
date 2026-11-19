// gear-world-network-sync: the private Worker that copies the sales of the affiliate networks OTHER than Awin (CJ,
// Daisycon, Linkwise now; Rakuten, Admitad, bol.com, eBay later) into the D1 database gear-world-awin, next to the Awin
// sales, so the private dashboard can show every network on one page (lessons L197). It copies the safety pattern of the
// Awin sync (src/awin-sync.js, lessons L91) and does not change it:
// - Read-only towards the networks: only report calls (CJ's GraphQL report is a POST that only reads; Daisycon's token
//   call is a POST to its login service). Each network's keys go only to that network's own hosts.
// - No public address (no routes, workers.dev off): it runs on its cron only and answers 404 to any request.
// - Only the fields of sites/awin/migrations/0002_network_sales.sql are kept: never the full answer, no customer data.
// - The site and product come from our own sub id ("cgw-82540", the same form as the Awin clickref, src/engine.js).
// - A network runs only when its secrets exist. One network failing never stops the others; each network writes its
//   own row in network_sync_runs (ok or not, and why, never a secret).
//
// Adding a network (Rakuten, Admitad, bol.com, eBay ...): one file in src/networks/ that exports
//   { id, label, hosts, secrets, optionalSecrets, ready, waiting, async run(ctx) -> rows, afterSave(db)? }
// one line in NETWORKS below, and its secrets in tools/network-sales-setup.ps1 ($Networks).
import { COLS, DAY, FIRST_DAY, LOOKBACK_DAYS, makeMask, setMeta } from './networks/common.js';
import { cj } from './networks/cj.js';
import { daisycon } from './networks/daisycon.js';
import { linkwise } from './networks/linkwise.js';

export { FIRST_DAY, LOOKBACK_DAYS };
export const NETWORKS = [cj, daisycon, linkwise];
export const KEEP_RUNS = 600;
// At most this many calls to one network in one run (CJ allows 200 per 5 minutes, Daisycon 50 a minute).
export const MAX_CALLS = 40;

const UPSERT_SQL = `INSERT INTO network_transactions (${COLS.join(', ')})
VALUES (${COLS.map(() => '?').join(', ')})
ON CONFLICT (network, id) DO UPDATE SET ${COLS.filter(c => !['network', 'id', 'first_seen_at'].includes(c)).map(c => `${c} = excluded.${c}`).join(', ')}`;

export async function saveRows(db, rows) {
  let saved = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const part = rows.slice(i, i + 50).map(r => db.prepare(UPSERT_SQL).bind(...COLS.map(c => r[c])));
    await db.batch(part);
    saved += part.length;
  }
  return saved;
}

// state: ok, failed or held (built but waiting, e.g. Linkwise). ok: 1, 0, and 2 for held, so a reader of ok alone never
// sees a held network as a problem (migration 0003).
async function logRun(db, run) {
  const okValue = run.state === 'held' ? 2 : (run.ok ? 1 : 0);
  await db.prepare('INSERT INTO network_sync_runs (ran_at, network, ok, state, calls, fetched, saved, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(run.ran_at, run.network, okValue, run.state, run.calls, run.fetched, run.saved, run.message ? String(run.message).slice(0, 300) : null).run();
  await db.prepare('DELETE FROM network_sync_runs WHERE id NOT IN (SELECT id FROM network_sync_runs ORDER BY id DESC LIMIT ?)').bind(KEEP_RUNS).run();
}

const value = (env, name) => String((env && env[name]) || '').trim();

// Which of a network's secrets are missing (names only).
export function missingSecrets(net, env) {
  return net.secrets.filter(n => !value(env, n));
}

// One network, one run. Never throws: the result (also written to network_sync_runs) says what happened.
export async function syncOne(net, env, { fetchFn = fetch, now = new Date(), db } = {}) {
  const nowIso = now.toISOString();
  const run = { network: net.id, ran_at: nowIso, ok: false, state: 'failed', calls: 0, fetched: 0, saved: 0, message: '' };
  const secretValues = [...net.secrets, ...(net.optionalSecrets || [])].map(n => value(env, n)).filter(Boolean);
  const mask = makeMask(secretValues);
  // A network that is built but held (ready: false) is not a failure: its own state, and no call at all.
  if (net.ready === false) {
    run.state = 'held';
    run.message = mask(`${net.label}: ${net.waiting || 'not ready yet'}`).slice(0, 300);
    try { await logRun(db, run); } catch { /* the result is still returned */ }
    return run;
  }
  try {
    const missing = missingSecrets(net, env);
    if (missing.length) throw new Error(`missing secret(s): ${missing.join(', ')}`);
    // The first run is the first one that ends well (not "no sales yet"): a network with no sales still reads only the
    // look-back window from its second run on.
    const last = await db.prepare('SELECT MAX(ran_at) AS t FROM network_sync_runs WHERE network = ? AND ok = 1').bind(net.id).first();
    const lastOk = last && last.t ? new Date(last.t) : null;
    const seen = Boolean(lastOk && Number.isFinite(lastOk.getTime()));
    const ctx = {
      env, db, now, nowIso,
      firstRun: !seen,
      lastOk: seen ? lastOk : null,
      from: seen ? new Date(now.getTime() - LOOKBACK_DAYS * DAY) : new Date(`${FIRST_DAY}T00:00:00Z`),
      callsLeft: () => MAX_CALLS - run.calls,
      secret: name => value(env, name),
      // A key that appears only during the run (an access token, a new refresh token) is hidden from every message too.
      addSecret: v => { if (v) secretValues.push(String(v)); },
      mask,
      notes: [],
      // The one way an adapter reaches its network: only its own hosts, at most MAX_CALLS calls.
      async call(url, init = {}) {
        let host = '';
        try { host = new URL(url).hostname; } catch { /* bad address */ }
        if (!net.hosts.includes(host)) throw new Error(`refused: ${host || 'a bad address'} is not a ${net.label} address`);
        if (run.calls >= MAX_CALLS) throw new Error(`more than ${MAX_CALLS} ${net.label} calls in one run`);
        run.calls++;
        // Never followed: a redirect could send the key on to another host.
        const res = await fetchFn(url, { ...init, redirect: 'manual' });
        if (res.status >= 300 && res.status < 400) throw new Error(`${net.label} answered with a redirect (${res.status}); it is not followed`);
        return res;
      }
    };
    const rows = await net.run(ctx);
    const unique = new Map();
    for (const r of rows) unique.set(r.id, r);
    run.fetched = unique.size;
    run.saved = await saveRows(db, [...unique.values()]);
    if (typeof net.afterSave === 'function') await net.afterSave(db);
    // ctx.fail: the sales were saved, but something must be fixed before the next run (e.g. a sign-in not kept).
    run.ok = !ctx.fail;
    run.state = run.ok ? 'ok' : 'failed';
    run.message = [ctx.fail, ...ctx.notes].filter(Boolean).join('; ');
  } catch (e) {
    run.message = String(e && e.message || e);
  }
  run.message = mask(run.message).slice(0, 300);
  try { await logRun(db, run); } catch { /* the result is still returned */ }
  return run;
}

// One sync of every network that is set up. A network with none of its secrets is not set up: it is skipped without a
// run row (the setup tool shows it as "not set up"). One network failing does not stop the next one.
export async function syncNetworks(env, { fetchFn = fetch, now = new Date(), networks = NETWORKS } = {}) {
  const db = env && env.SALES_DB;
  const results = [];
  if (!db) return { ok: false, message: 'no database binding SALES_DB', results };
  // The code version this Worker runs (deploy --var GW_COMMIT:<commit>), for the setup tool's live-version guard (L156).
  const commit = String((env && env.GW_COMMIT) || '');
  if (/^[0-9a-f]{40}$/.test(commit)) { try { await setMeta(db, 'commit', commit, now.toISOString()); } catch { /* the sync goes on */ } }
  for (const net of networks) {
    if (net.secrets.every(n => !value(env, n))) { results.push({ network: net.id, skipped: true }); continue; }
    results.push(await syncOne(net, env, { fetchFn, now, db }));
  }
  return { ok: results.every(r => r.skipped || r.ok || r.state === 'held'), results };
}

export function createNetworkSync({ fetchFn } = {}) {
  return {
    async scheduled(event, env, ctx) {
      ctx.waitUntil(syncNetworks(env, { fetchFn: fetchFn || fetch }));
    },
    // No public address; anything that reaches it anyway gets nothing.
    async fetch() {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
  };
}
