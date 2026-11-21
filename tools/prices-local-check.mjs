// Daily price log (lessons L100): the real Worker gear-world-prices on the real (local) D1 of wrangler, before it goes
// live. The 13 site databases get their own layout and the synthetic products of tests/fixtures; then the cron runs
// (wrangler dev --test-scheduled) and the results are checked: one site per run, every shown product logged once,
// nothing new on a second round, and the 13 site databases exactly as they were. Local only: nothing on Cloudflare.
//
//   node tools/prices-local-check.mjs [--port 8795] [--out prices-local-report.txt]
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PRICE_SITES } from '../sites/prices/sites.js';
import { buildConfig, databaseNames } from './prices-config.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const port = Number(opt('--port', '8795'));
const outFile = opt('--out', 'prices-local-report.txt');
const dir = 'sites/prices';
const cfgFile = `${dir}/wrangler.jsonc`;
const lines = [];
let failed = 0;
const say = s => { lines.push(s); console.log(s); };
const check = (ok, name) => { if (!ok) failed++; say(`${ok ? 'PASS' : 'FAIL'}  ${name}`); };
const env = { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1', FORCE_COLOR: '0' };

function wrangler(...a) {
  return execFileSync('npx', ['wrangler', ...a], { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
function query(db, sql) {
  const out = wrangler('d1', 'execute', db, '--local', '--config', cfgFile, '--json', '--command', sql);
  const j = JSON.parse(out.slice(out.indexOf('[')));
  return j[0].results;
}
const fingerprint = db => createHash('sha256').update(JSON.stringify(query(db, 'SELECT * FROM products ORDER BY id'))).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A local config: the template with made-up IDs (one local database each), never committed (.gitignore).
const template = readFileSync(`${dir}/wrangler.jsonc.example`, 'utf8');
const ids = {};
databaseNames(template).forEach((n, i) => { ids[n] = ['0000' + String(i).padStart(4, '0'), '0000', '4000', '8000', '0000' + String(i).padStart(8, '0')].join('-'); });
rmSync(`${dir}/.wrangler`, { recursive: true, force: true });
writeFileSync(cfgFile, buildConfig(template, ids, 'run', 'local check'));

say('Price log, local check (wrangler dev, local D1)');
for (const s of PRICE_SITES) {
  const files = s.legacy ? ['tests/fixtures/ggw-legacy-schema.sql']
    : readdirSync(`sites/${s.code}/migrations`).filter(f => f.endsWith('.sql')).sort().map(f => `sites/${s.code}/migrations/${f}`);
  files.push(`tests/fixtures/${s.code}-seed.sql`);
  for (const f of files) wrangler('d1', 'execute', s.database, '--local', '--config', cfgFile, '--file', f);
}
wrangler('d1', 'migrations', 'apply', 'gear-world-prices', '--local', '--config', cfgFile);
const before = {};
const shown = {};
for (const s of PRICE_SITES) {
  before[s.code] = fingerprint(s.database);
  shown[s.code] = query(s.database, 'SELECT COUNT(*) AS n FROM products WHERE is_active = 1')[0].n;
}
say(`Site databases ready: ${PRICE_SITES.map(s => `${s.code} ${shown[s.code]}`).join(', ')}`);

// wrangler dev runs only while the cron is called; the databases are read with it stopped (one user of the files).
let devLog = '';
let round = 0;
let base = '';
async function withDev(fn) {
  // its own process group and its own port each round: stopping npx alone would leave wrangler and workerd running
  base = `http://127.0.0.1:${port + round}`;
  const dev = spawn('npx', ['wrangler', 'dev', '--config', cfgFile, '--local', '--port', String(port + round), '--ip', '127.0.0.1', '--test-scheduled'],
    { env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  round++;
  dev.stdout.on('data', d => { devLog += d; });
  dev.stderr.on('data', d => { devLog += d; });
  try {
    let up = 0;
    for (let i = 0; i < 90 && !up; i++) { try { up = (await fetch(`${base}/`)).status; } catch { await sleep(1000); } }
    const r = await fn(up);
    await sleep(1500); // the Worker's own log lines reach the output a moment later
    return r;
  } finally {
    try { process.kill(-dev.pid, 'SIGTERM'); } catch { /* already gone */ }
    for (let i = 0; i < 40 && dev.exitCode === null; i++) await sleep(250);
    try { process.kill(-dev.pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}
const cron = async () => (await fetch(`${base}/cdn-cgi/local/scheduled?cron=${encodeURIComponent('*/15 * * * *')}`)).status;
let calls = [];
await withDev(async up => {
  check(up === 404, `the Worker answers every address with 404 (got ${up})`);
  for (let i = 0; i < PRICE_SITES.length; i++) calls.push(await cron());
});
check(calls.length === 13 && calls.every(c => c === 200), `13 cron runs (${calls.join(' ')})`);
const runs = query('gear-world-prices', 'SELECT site, status, products, added, changed, gone, skipped, writes, attempts, error FROM price_runs ORDER BY site');
check(runs.length === 13, `13 runs logged 13 sites (${runs.length})`);
for (const s of PRICE_SITES) {
  const r = runs.find(x => x.site === s.code) || {};
  const logged = query('gear-world-prices', `SELECT COUNT(*) AS n FROM price_log WHERE site = '${s.code}'`)[0].n;
  const last = query('gear-world-prices', `SELECT COUNT(*) AS n FROM price_last WHERE site = '${s.code}' AND listed = 1`)[0].n;
  const ok = r.status === 'ok' && r.attempts === 1 && r.products + r.skipped === shown[s.code] && r.added === r.products
    && logged === r.products && last === r.products && r.writes === 2 * r.products && r.products > 0;
  check(ok, `${s.code}: ${r.status} ${r.error || ''} products ${r.products}/${shown[s.code]} (skipped ${r.skipped}), log ${logged}, last ${last}, writes ${r.writes}`);
}
const total = query('gear-world-prices', 'SELECT COUNT(*) AS n FROM price_log')[0].n;
calls = [];
await withDev(async () => { for (let i = 0; i < 3; i++) calls.push(await cron()); });
const again = query('gear-world-prices', 'SELECT COUNT(*) AS n, SUM(attempts) AS a FROM price_runs')[0];
check(calls.every(c => c === 200) && query('gear-world-prices', 'SELECT COUNT(*) AS n FROM price_log')[0].n === total && again.n === 13 && again.a === 13,
  'more runs the same day: nothing new, no site taken twice');
const sample = query('gear-world-prices', "SELECT pkey, price, was_price, in_stock, listed FROM price_log WHERE site = 'tgw' ORDER BY pkey LIMIT 1")[0];
check(sample && typeof sample.price === 'number' && sample.listed === 1, `a TGW row as written: ${JSON.stringify(sample)}`);
check(/"status":"idle"/.test(devLog), 'the extra runs said "idle"');
for (const s of PRICE_SITES) check(fingerprint(s.database) === before[s.code], `${s.code}: the site database is exactly as it was (only read)`);
const errors = devLog.split('\n').filter(l => /\b(error|exception|uncaught)\b/i.test(l) && !/no products|newer version of Wrangler/i.test(l));
check(errors.length === 0, `no error in the wrangler dev log${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
say(failed ? `RESULT: ${failed} FAILED` : 'RESULT: OK');
writeFileSync(outFile, `${lines.join('\n')}\n\n--- wrangler dev log ---\n${devLog}`);
process.exit(failed ? 1 : 0);
