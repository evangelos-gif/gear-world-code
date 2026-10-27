// tools/gw-old-workers.mjs: which old Workers can go. Fake Cloudflare answers, nothing leaves this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeApi, inspect, verdict, backup, deleteWorker } from '../../tools/gw-old-workers.mjs';

const ACC = 'acc1';
const ok = (result, extra = {}) => ({ success: true, result, ...extra });
const PROTECTED = ['gear-world-hub', 'gwh-sitemap', 'construction-gear-uk'];
const CANDIDATES = ['old-test', 'bound-test', 'domain-test', 'cron-test', 'route-test', 'gone-test'];

function fakeAnswers({ graphql = true } = {}) {
  const scripts = ['gear-world-hub', 'gwh-sitemap', 'construction-gear-uk', 'old-test', 'bound-test', 'domain-test', 'cron-test', 'route-test'];
  const f = {
    'GET /accounts?page=1&per_page=50': ok([{ id: ACC, name: 'Gear World' }], { result_info: { total_pages: 1 } }),
    [`GET /accounts/${ACC}/workers/scripts?page=1&per_page=50`]: ok(scripts.map(id => ({ id })), { result_info: { total_pages: 1 } }),
    [`GET /accounts/${ACC}/workers/subdomain`]: ok({ subdomain: 'example' }),
    [`GET /accounts/${ACC}/workers/domains?page=1&per_page=50`]: ok([
      { hostname: 'gearworldhub.com', service: 'gear-world-hub' },
      { hostname: 'old.example.com', service: 'domain-test' }
    ]),
    'GET /zones?page=1&per_page=50': ok([{ id: 'z1', name: 'gearworldhub.com' }], { result_info: { total_pages: 1 } }),
    'GET /zones/z1/workers/routes': ok([{ pattern: 'gearworldhub.com/sitemap.xml', script: 'gwh-sitemap' }, { pattern: 'gearworldhub.com/old/*', script: 'route-test' }]),
    [`GET /accounts/${ACC}/queues?page=1&per_page=50`]: ok([]),
    [`GET /accounts/${ACC}/storage/kv/namespaces?page=1&per_page=50`]: ok([{ id: 'kv1', title: '__old-test-workers_sites_assets' }, { id: 'kv2', title: 'gwh-cache' }]),
    [`GET /accounts/${ACC}/pages/projects?page=1&per_page=50`]: ok([])
  };
  for (const s of scripts) {
    const bindings = s === 'gear-world-hub' ? [{ type: 'service', name: 'HELPER', service: 'bound-test' }, { type: 'd1', name: 'DB' }] : [];
    f[`GET /accounts/${ACC}/workers/scripts/${s}/settings`] = ok({ bindings, tail_consumers: [] });
    f[`GET /accounts/${ACC}/workers/scripts/${s}/subdomain`] = ok({ enabled: s === 'old-test' });
    f[`GET /accounts/${ACC}/workers/scripts/${s}/schedules`] = ok({ schedules: s === 'cron-test' ? [{ cron: '0 3 * * *' }] : [] });
    f[`GET /accounts/${ACC}/workers/scripts/${s}/deployments`] = ok({ deployments: [{ created_on: '2026-10-01T10:00:00Z' }, { created_on: '2026-10-11T17:45:10Z' }] });
    f[`GET /accounts/${ACC}/workers/scripts/${s}/references`] = ok({ services: { incoming: s === 'bound-test' ? [{ service: 'gear-world-hub' }] : [] }, durable_objects: [], dispatch_outbounds: [] });
    f[`GET /accounts/${ACC}/workers/tails/by-consumer/${s}`] = ok([]);
  }
  f[`DELETE /accounts/${ACC}/workers/scripts/old-test?force=false`] = ok(null);
  if (graphql) {
    f['POST /graphql'] = { data: { viewer: { accounts: [{ workersInvocationsAdaptive: [
      { sum: { requests: 3 }, dimensions: { scriptName: 'old-test' } }
    ] }] } }, errors: null, success: true };
  }
  return f;
}

test('old workers: only a Worker that nothing uses and nothing points to is safe', async () => {
  const report = await inspect({ api: makeApi({ fake: fakeAnswers() }), candidates: CANDIDATES, protectedNames: PROTECTED });
  const by = Object.fromEntries(report.workers.map(w => [w.name, w]));
  assert.equal(report.subdomain, 'example');
  assert.equal(by['old-test'].verdict.status, 'safe');
  assert.equal(by['old-test'].workersDev, true);
  assert.equal(by['old-test'].requests7d, 3);
  assert.equal(by['old-test'].lastDeploy, '2026-10-11T17:45:10Z');
  assert.deepEqual(by['old-test'].kvLeftover, ['__old-test-workers_sites_assets']);
  assert.equal(by['bound-test'].verdict.status, 'keep');
  assert.match(by['bound-test'].verdict.reasons.join(' '), /used by: gear-world-hub \(service HELPER\)/);
  assert.equal(by['domain-test'].verdict.status, 'keep');
  assert.deepEqual(by['domain-test'].domains, ['old.example.com']);
  assert.equal(by['cron-test'].verdict.status, 'keep');
  assert.equal(by['route-test'].verdict.status, 'keep');
  assert.deepEqual(by['route-test'].routes, ['gearworldhub.com/old/*']);
  assert.equal(by['gone-test'].verdict.status, 'missing');
});

test('old workers: when something cannot be read, nothing is called safe (fail closed)', async () => {
  const answers = fakeAnswers({ graphql: false });
  delete answers['GET /zones/z1/workers/routes'];
  const report = await inspect({ api: makeApi({ fake: answers }), candidates: ['old-test'], protectedNames: PROTECTED });
  assert.equal(report.workers[0].verdict.status, 'keep');
  assert.match(report.workers[0].verdict.reasons.join(' '), /could not check: routes of gearworldhub\.com/);
  assert.equal(report.workers[0].requests7d, null);
  assert.ok(report.notes.some(n => /requests of the last 7 days/.test(n)));
});

test('old workers: a protected Worker can never be a candidate', async () => {
  await assert.rejects(() => inspect({ api: makeApi({ fake: fakeAnswers() }), candidates: ['gwh-sitemap'], protectedNames: PROTECTED }), /protected/);
  assert.deepEqual(verdict({ exists: false }), { status: 'missing', reasons: [] });
});

test('old workers: the backup keeps the code, settings and deployments', async () => {
  const answers = fakeAnswers();
  const dir = mkdtempSync(join(tmpdir(), 'gw-old-'));
  const api = async (path, init = {}) => {
    if (init.raw) return { success: true, raw: Buffer.from('export default {}'), type: 'application/javascript' };
    return makeApi({ fake: answers })(path, init);
  };
  const saved = await backup({ api, account: ACC, name: 'old-test', folder: dir });
  assert.deepEqual(saved.sort(), ['old-test-code.js', 'old-test-deployments.json', 'old-test-schedules.json', 'old-test-settings.json']);
  assert.equal(readFileSync(join(dir, 'old-test-code.js'), 'utf8'), 'export default {}');
  assert.equal(readdirSync(dir).length, 4);
});

test('old workers: the command line prints JSON and never the token', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw-old-cli-'));
  const fake = join(dir, 'fake.json');
  writeFileSync(fake, JSON.stringify(fakeAnswers()));
  const tool = new URL('../../tools/gw-old-workers.mjs', import.meta.url);
  const run = spawnSync(process.execPath, [tool.pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'check', CANDIDATES.join(','), PROTECTED.join(',')], {
    env: { ...process.env, GW_CF_FAKE: fake, GW_CF_TOKEN: 'secret-token-never-printed' }, encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.workers.length, CANDIDATES.length);
  assert.ok(!run.stdout.includes('secret-token-never-printed'));
  const bad = spawnSync(process.execPath, [tool.pathname.replace(/^\/([A-Za-z]:)/, '$1'), 'check', 'gwh-sitemap', PROTECTED.join(',')], {
    env: { ...process.env, GW_CF_FAKE: fake, GW_CF_TOKEN: 'secret-token-never-printed' }, encoding: 'utf8'
  });
  assert.equal(bad.status, 1);
  assert.match(JSON.parse(bad.stdout).error, /protected/);
});

test('old workers: delete only a safe Worker of the list, with force=false, after one more check', async () => {
  const answers = fakeAnswers();
  const calls = [];
  const api = async (path, init = {}) => { calls.push(`${init.method || 'GET'} ${path}`); return makeApi({ fake: answers })(path, init); };
  assert.deepEqual(await deleteWorker({ api, name: 'old-test', candidates: CANDIDATES, protectedNames: PROTECTED }), { name: 'old-test', deleted: true });
  assert.deepEqual(calls.filter(c => c.startsWith('DELETE')), [`DELETE /accounts/${ACC}/workers/scripts/old-test?force=false`]);
  assert.ok(calls.indexOf(`GET /accounts/${ACC}/workers/scripts/old-test/references`) < calls.indexOf(`DELETE /accounts/${ACC}/workers/scripts/old-test?force=false`));
  calls.length = 0;
  await assert.rejects(() => deleteWorker({ api, name: 'bound-test', candidates: CANDIDATES, protectedNames: PROTECTED }), /not safe to delete/);
  await assert.rejects(() => deleteWorker({ api, name: 'gwh-sitemap', candidates: CANDIDATES, protectedNames: PROTECTED }), /not on the list/);
  await assert.rejects(() => deleteWorker({ api, name: 'some-other-worker', candidates: CANDIDATES, protectedNames: PROTECTED }), /not on the list/);
  assert.deepEqual(calls.filter(c => c.startsWith('DELETE')), [], 'nothing else was deleted');
  assert.deepEqual(await deleteWorker({ api, name: 'gone-test', candidates: CANDIDATES, protectedNames: PROTECTED }), { name: 'gone-test', deleted: false, missing: true });
});
