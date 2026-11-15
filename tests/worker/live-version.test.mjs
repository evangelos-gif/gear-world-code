// Lessons L156 (owner, 15 Nov 2026: "so that the map never goes again"): every site and the Group say which code
// version is live (GET /api/version, written by the deploy tools with --var GW_COMMIT:<commit>), so the tools can refuse
// a deploy from a branch that does not contain it. The answer touches no database and is never cached.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createWorker } from '../../src/engine.js';
import { createGroupWorker } from '../../src/group.js';
import { liveCommit } from '../../src/lib/version.js';
import agw from '../../sites/agw/site.config.js';
import group from '../../sites/group/site.config.js';

const COMMIT = 'ab'.repeat(20);
// A database that fails if anything reads it: /api/version must answer without it.
const noDb = { prepare() { throw new Error('the database was read'); }, batch() { throw new Error('the database was read'); } };
const ctx = { waitUntil: p => p };

test('L156: a site says its live commit, without reading the database, never cached', async () => {
  const w = createWorker(agw);
  const r = await w.fetch(new Request('https://cargearworld.com/api/version'), { DB: noDb, GW_COMMIT: COMMIT }, ctx);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { commit: COMMIT });
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const old = await w.fetch(new Request('https://cargearworld.com/api/version'), { DB: noDb }, ctx);
  assert.deepEqual(await old.json(), { commit: null }, 'a deploy without the version (by hand): null, the tools then use the base version');
});

test('L156: the Group says its live commit too', async () => {
  const w = createGroupWorker({ ...group, sites: [] });
  const r = await w.fetch(new Request('https://gearworldgroup.com/api/version'), { GW_COMMIT: COMMIT }, ctx);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { commit: COMMIT });
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

test('L156: only a full 40-character commit is ever shown', () => {
  assert.equal(liveCommit({ GW_COMMIT: COMMIT }), COMMIT);
  for (const bad of ['', 'abc', COMMIT.toUpperCase(), `${COMMIT}0`, '<script>', null, 42]) assert.equal(liveCommit({ GW_COMMIT: bad }), null, String(bad));
  assert.equal(liveCommit(undefined), null);
});

test('L156: every site tool deploy writes its version, and checks the live one before a live update', () => {
  const tools = readdirSync('tools').filter(f => /^(\w{3}-(engine|cloudflare)|group-site)\.ps1$/.test(f));
  assert.equal(tools.length, 14, tools.join(', '));
  for (const f of tools) {
    const text = readFileSync(`tools/${f}`, 'utf8');
    assert.ok(text.includes("'live-guard.ps1')"), `${f}: loads tools/lib/live-guard.ps1`);
    assert.ok(text.includes('Assert-GwLiveGuard @($Domain) $repo'), `${f}: checks the live version before its update`);
    for (const line of text.split('\n')) {
      if (/Invoke-Wrangler/.test(line) && /'deploy[ ']/.test(line)) {
        assert.ok(line.includes('$GwVersionVar'), `${f}: ${line.trim()}`);
        // A backslash before a quote inside a PowerShell '...' string stays a backslash: wrangler would get a broken path.
        assert.ok(!line.includes('\\"'), `${f}: no backslash before a quote: ${line.trim()}`);
      }
    }
  }
  const all = readFileSync('tools/sites-update-all.ps1', 'utf8');
  assert.ok(all.includes('Test-GwLiveGuard') && all.includes('Finish 13'), 'ALL UPDATES checks all 14 sites before any of them');
  // The base version of the guard (used while a site does not say its version yet) is a full commit.
  assert.match(readFileSync('tools/lib/live-guard.ps1', 'utf8'), /\$script:GwGuardFloor = '[0-9a-f]{40}'/);
});
