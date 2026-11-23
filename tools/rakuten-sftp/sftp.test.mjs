// The Rakuten SFTP client (lessons L219) against a local fake server: list, a whole file, the first part of a file, a wrong
// password, a changed host key, and never a server that is not Rakuten's. Run by tests/run-tests.ps1 after npm ci here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { run, rakutenHost, safeRemote } from './sftp.mjs';
import { startFakeSftp } from './fake-server.mjs';

test('Rakuten SFTP: only Rakuten hosts, only plain file names', () => {
  assert.ok(rakutenHost('aftp.linksynergy.com'));
  assert.ok(rakutenHost('127.0.0.1'));
  assert.ok(!rakutenHost('aftp.linksynergy.com.evil.example'));
  assert.ok(!rakutenHost('example.com'));
  assert.ok(safeRemote('1606623_4561_mp.txt.gz'));
  assert.ok(!safeRemote('../etc/passwd'));
  assert.ok(!safeRemote('a/b.gz'));
});

test('Rakuten SFTP: list, whole and partial download, wrong password, host key pinned', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gw-sftp-srv-'));
  const data = randomBytes(300000);
  writeFileSync(join(dir, '1606623_4561_mp.txt.gz'), data);
  writeFileSync(join(dir, 'readme.txt'), 'hello');
  const srv = await startFakeSftp({ dir, user: 'gw', pass: 'secret-pass' });
  try {
    const env = { GW_RK_HOST: '127.0.0.1', GW_RK_PORT: String(srv.port), GW_RK_USER: 'gw', GW_RK_PASS: 'secret-pass' };
    const L = await run(['--mode', 'list'], env);
    assert.equal(L.ok, true, L.error);
    assert.match(L.fingerprint, /^SHA256:[A-Za-z0-9+/]{43}$/);
    assert.deepEqual(L.files.map(f => f.name).sort(), ['1606623_4561_mp.txt.gz', 'readme.txt']);
    assert.equal(L.files.find(f => f.name === 'readme.txt').size, 5);
    const out = join(mkdtempSync(join(tmpdir(), 'gw-sftp-out-')), 'x.gz');
    const G = await run(['--mode', 'get', '--remote', '1606623_4561_mp.txt.gz', '--out', out], { ...env, GW_RK_HOSTKEY: L.fingerprint });
    assert.equal(G.ok, true, G.error);
    assert.equal(G.got, data.length);
    assert.ok(readFileSync(out).equals(data));
    const P = await run(['--mode', 'get', '--remote', '1606623_4561_mp.txt.gz', '--out', `${out}.part`, '--bytes', '65536'], env);
    assert.equal(P.got, 65536);
    assert.ok(readFileSync(`${out}.part`).equals(data.subarray(0, 65536)));
    const bad = await run(['--mode', 'list'], { ...env, GW_RK_PASS: 'wrong' });
    assert.equal(bad.ok, false);
    assert.equal(bad.auth, true);
    const changed = await run(['--mode', 'list'], { ...env, GW_RK_HOSTKEY: 'SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' });
    assert.equal(changed.ok, false);
    assert.equal(changed.hostKey, true, 'a changed host key stops before the password is sent');
    assert.equal((await run(['--mode', 'get', '--remote', '../x', '--out', out], env)).ok, false);
    assert.match((await run(['--mode', 'list'], { ...env, GW_RK_HOST: 'example.com' })).error, /not a Rakuten server/);
  } finally { await srv.close(); }
});
