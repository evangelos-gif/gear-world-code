// The SFTP client of tools/rakuten-feed-download.ps1 (lessons L219). Rakuten's publisher guide: the catalogues are on
// aftp.linksynergy.com by SFTP; plain FTP "is currently supported" but is being retired and sends the password unencrypted,
// and FTPS is not offered (the old tool tried FTPS and then fell back to plain FTP). The user name and password come only
// from the environment (GW_RK_USER, GW_RK_PASS, set by the PowerShell tool from its DPAPI file), never from the command
// line, and go only to a Rakuten host. The server's host key is pinned: the first connection gives its SHA256 fingerprint
// (kept by the tool), later ones must show the same one (GW_RK_HOSTKEY).
// Command line (one JSON line on stdout, nothing on stderr):
//   node sftp.mjs --mode list                                   -> { ok, fingerprint, files: [{ name, size, mtime }] }
//   node sftp.mjs --mode get --remote <name> --out <file> [--bytes N]   -> { ok, fingerprint, got }
import { createWriteStream, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import ssh2 from 'ssh2';

const { Client } = ssh2;

export function rakutenHost(h) {
  return /^[a-z0-9.-]+\.(linksynergy\.com|rakutenadvertising\.(com|io)|rakutenmarketing\.com)$/i.test(String(h || '')) || h === '127.0.0.1';
}
export const fingerprintOf = key => `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;
// Only a plain file name of the catalogue folder (no path, no ..).
export const safeRemote = n => /^[A-Za-z0-9._-]{1,120}$/.test(String(n || '')) && !String(n).includes('..');

function open({ host, port, username, password, hostKey, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let fingerprint = '';
    let mismatch = false;
    conn.on('ready', () => conn.sftp((err, sftp) => (err ? (conn.end(), reject(err)) : resolve({ conn, sftp, fingerprint }))));
    conn.on('error', e => reject(mismatch ? Object.assign(new Error('host key changed'), { hostKey: true, fingerprint }) : e));
    conn.connect({
      host, port, username, password, readyTimeout: timeout, keepaliveInterval: 15000,
      hostVerifier: key => { fingerprint = fingerprintOf(key); mismatch = Boolean(hostKey) && hostKey !== fingerprint; return !mismatch; }
    });
  });
}

const listDir = sftp => new Promise((resolve, reject) => sftp.readdir('.', (e, list) => (e ? reject(e) : resolve(list))));
function getFile(sftp, remote, out, bytes) {
  return new Promise((resolve, reject) => {
    const opts = bytes > 0 ? { start: 0, end: bytes - 1 } : {};
    const rs = sftp.createReadStream(remote, opts);
    const ws = createWriteStream(out);
    rs.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', () => resolve(statSync(out).size));
    rs.pipe(ws);
  });
}

export async function run(argv, env = process.env) {
  const val = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : ''; };
  const host = String(env.GW_RK_HOST || 'aftp.linksynergy.com');
  const port = Number(env.GW_RK_PORT || 22);
  const username = String(env.GW_RK_USER || '');
  const password = String(env.GW_RK_PASS || '');
  if (!rakutenHost(host)) return { ok: false, error: `not a Rakuten server: ${host}` };
  if (!username || !password) return { ok: false, error: 'no user name or password' };
  const mode = val('mode');
  if (mode !== 'list' && mode !== 'get') return { ok: false, error: 'mode must be list or get' };
  if (mode === 'get' && (!safeRemote(val('remote')) || !val('out'))) return { ok: false, error: 'get needs --remote <file name> and --out <file>' };
  let c = null;
  try {
    c = await open({ host, port, username, password, hostKey: String(env.GW_RK_HOSTKEY || '') });
    if (mode === 'list') {
      const list = await listDir(c.sftp);
      const files = list.filter(e => e.attrs && e.attrs.isFile && e.attrs.isFile()).map(e => ({ name: e.filename, size: e.attrs.size, mtime: e.attrs.mtime }));
      return { ok: true, fingerprint: c.fingerprint, files };
    }
    const got = await getFile(c.sftp, val('remote'), val('out'), Number(val('bytes')) || 0);
    return { ok: true, fingerprint: c.fingerprint, got };
  } catch (e) {
    const msg = String(e && e.message || e).slice(0, 200);
    return { ok: false, error: msg, auth: /authentication methods failed|auth/i.test(msg), hostKey: Boolean(e && e.hostKey), fingerprint: (e && e.fingerprint) || '' };
  } finally {
    if (c) try { c.conn.end(); } catch { }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  run(process.argv.slice(2)).then(S => { console.log(JSON.stringify(S)); }, e => { console.log(JSON.stringify({ ok: false, error: String(e && e.message || e).slice(0, 200) })); });
}
