// The rows and the header check of a gzip feed file, read as a stream (18 Nov 2026, lessons L185): the old check read the
// whole unzipped file into one string, and a feed over 512 MB (Spartoo BE 20061, OpticsPlanet) stopped with
// ERR_STRING_TOO_LONG, so the downloader kept the old file. Prints "<ok|bad> <rows>": ok when the first line has every
// column asked for (default product_name), rows = lines with text after the header. A file that is not a valid gzip
// feed prints "bad 0". Nothing is ever written to stderr (Windows PowerShell 5.1 stops on any stderr line).
//
// node tools/feed-rows.mjs <file.csv.gz> [column ...]
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pathToFileURL } from 'node:url';

export function feedRows(path, columns = ['product_name']) {
  return new Promise(resolve => {
    let header = '';
    let headerDone = false;
    let lines = 0;
    let lineHasText = false;
    let done = false;
    const finish = out => { if (!done) { done = true; resolve(out); } };
    const src = createReadStream(path);
    const gz = createGunzip();
    const fail = () => { finish({ ok: false, rows: 0 }); try { src.destroy(); gz.destroy(); } catch { /* nothing */ } };
    src.on('error', fail);
    gz.on('error', fail);
    gz.on('data', buf => {
      let start = 0;
      if (!headerDone) {
        const nl = buf.indexOf(10);
        if (nl === -1) { if (header.length < 1048576) header += buf.toString('utf8'); return; }
        header += buf.toString('utf8', 0, nl);
        headerDone = true;
        start = nl + 1;
      }
      for (let i = start; i < buf.length; i++) {
        const c = buf[i];
        if (c === 10) { if (lineHasText) lines++; lineHasText = false; }
        else if (c !== 13 && c !== 32 && c !== 9) lineHasText = true;
      }
    });
    gz.on('end', () => {
      if (lineHasText) lines++;
      const h = header.toLowerCase();
      finish({ ok: headerDone || header.length > 0 ? columns.every(c => h.includes(String(c).toLowerCase())) : false, rows: lines });
    });
    src.pipe(gz);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, ...cols] = process.argv.slice(2);
  feedRows(file || '', cols.length ? cols : ['product_name'])
    .then(r => process.stdout.write(`${r.ok ? 'ok' : 'bad'} ${r.rows}\n`))
    .catch(() => process.stdout.write('bad 0\n'));
}
