// A small SFTP server on 127.0.0.1 for the tests of the Rakuten SFTP client (lessons L219): one user, one folder, read-only.
// It answers only what the client uses (stat, open, read, close, opendir, readdir). Never used against the real Rakuten.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ssh2 from 'ssh2';

const { Server, utils } = ssh2;
const { STATUS_CODE } = utils.sftp;

export function startFakeSftp({ dir, user, pass, port = 0 }) {
  const hostKey = utils.generateKeyPairSync('ed25519').private;
  const attrsOf = st => ({ mode: (st.isDirectory() ? 0o040000 : 0o100000) | 0o644, uid: 0, gid: 0, size: st.size, atime: Math.floor(st.atimeMs / 1000), mtime: Math.floor(st.mtimeMs / 1000) });
  const server = new Server({ hostKeys: [hostKey] }, client => {
    client.on('authentication', ctx => {
      if (ctx.method === 'password' && ctx.username === user && ctx.password === pass) return ctx.accept();
      return ctx.reject(['password']);
    });
    client.on('ready', () => client.on('session', accept => {
      const session = accept();
      session.on('sftp', acc => {
        const sftp = acc();
        const handles = new Map();
        let next = 1;
        const safe = p => String(p).replace(/^\.?\/?/, '').replace(/\\/g, '/');
        sftp.on('REALPATH', (id) => sftp.name(id, [{ filename: '/', longname: '/', attrs: {} }]));
        sftp.on('STAT', (id, p) => { try { sftp.attrs(id, attrsOf(statSync(join(dir, safe(p))))); } catch { sftp.status(id, STATUS_CODE.NO_SUCH_FILE); } });
        sftp.on('LSTAT', (id, p) => { try { sftp.attrs(id, attrsOf(statSync(join(dir, safe(p))))); } catch { sftp.status(id, STATUS_CODE.NO_SUCH_FILE); } });
        sftp.on('OPEN', (id, p) => {
          const f = join(dir, safe(p));
          let data;
          try { data = readFileSync(f); } catch { return sftp.status(id, STATUS_CODE.NO_SUCH_FILE); }
          const h = Buffer.alloc(4); h.writeUInt32BE(next++);
          handles.set(h.toString('hex'), { data, st: statSync(f) });
          sftp.handle(id, h);
        });
        sftp.on('FSTAT', (id, h) => { const e = handles.get(h.toString('hex')); if (!e || !e.st) return sftp.status(id, STATUS_CODE.FAILURE); sftp.attrs(id, attrsOf(e.st)); });
        sftp.on('READ', (id, h, offset, length) => {
          const e = handles.get(h.toString('hex'));
          if (!e || !e.data) return sftp.status(id, STATUS_CODE.FAILURE);
          if (offset >= e.data.length) return sftp.status(id, STATUS_CODE.EOF);
          sftp.data(id, e.data.subarray(offset, Math.min(e.data.length, offset + length)));
        });
        sftp.on('OPENDIR', (id) => { const h = Buffer.alloc(4); h.writeUInt32BE(next++); handles.set(h.toString('hex'), { list: readdirSync(dir), sent: false }); sftp.handle(id, h); });
        sftp.on('READDIR', (id, h) => {
          const e = handles.get(h.toString('hex'));
          if (!e || !e.list) return sftp.status(id, STATUS_CODE.FAILURE);
          if (e.sent) return sftp.status(id, STATUS_CODE.EOF);
          e.sent = true;
          sftp.name(id, e.list.map(n => { const st = statSync(join(dir, n)); return { filename: n, longname: n, attrs: attrsOf(st) }; }));
        });
        sftp.on('CLOSE', (id, h) => { handles.delete(h.toString('hex')); sftp.status(id, STATUS_CODE.OK); });
      });
    }));
    client.on('error', () => { });
  });
  return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve({ port: server.address().port, close: () => new Promise(r => server.close(() => r())) })));
}

// node fake-server.mjs --dir <folder> --user <u> --pass <p> --port-file <file>: for the PowerShell test (tests/run-tests.ps1).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2);
  const val = n => { const i = a.indexOf(`--${n}`); return i >= 0 ? a[i + 1] : ''; };
  startFakeSftp({ dir: val('dir'), user: val('user'), pass: val('pass') }).then(async s => {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(val('port-file'), String(s.port));
  });
}
