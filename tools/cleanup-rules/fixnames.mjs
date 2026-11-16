// Repair of product names broken by the tidy step on 20 Oct 2026 (MGW, WGW, KGW).
// The tidy tool read the database through the Windows console code page (850) instead of UTF-8, so a name such as
// "YOMO KIDS’ Helmet" was written back as "YOMO KIDSÔÇÖ Helmet". The feed name (feed_product_name) was never
// touched, so the right name is the feed name without its size/colour, exactly what the tidy step meant to write.
// A name is changed only when it differs from that name in its non-ASCII characters alone: every letter, number
// and sign that can be read is the same. Anything else is listed and left as it is.
// 16 Nov 2026 (chat 9, lessons L167): also UTF-8 that was read ONCE as Latin-1/Windows-1252 ("double UTF-8") and came
// so from the feed: Reidl on CGW "SchlÃ¼ssel" for "Schlüssel", "â€“" for "–". Each broken letter is turned back into
// its bytes and read as UTF-8 again, one letter at a time and only when those bytes are exactly one valid UTF-8
// letter; anything else in the name stays as it is (so a real "Â" or "â" in a name is never touched).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tidyName, sqlFiles, rowsFromWrangler } from './tidy.mjs';

// Characters that UTF-8 text gets when it is read as code page 850 (and that never belong in a product name).
// Written with char() so the SQL stays ASCII for the cmd line: ├ ┬ and Ô followed by Ç, é or ä.
// The double UTF-8 ones: Ã (umlauts, é ...), Â (° ® ...), â€ (– ’ “ ” …) and â„ (™).
const MARKERS = ['char(9500)', 'char(9516)', 'char(212, 199)', 'char(212, 233)', 'char(212, 228)',
  'char(195)', 'char(194)', 'char(226, 8364)', 'char(226, 8222)'];
const BROKEN = /[├┬]|Ô[Çéä]/;

// Windows-1252 letters 0x80-0x9F (the others of Latin-1 are their own byte).
const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
  0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94,
  0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
const CONT = '[\\u0080-\\u00BF' + Object.keys(CP1252).map(k => '\\u' + Number(k).toString(16).padStart(4, '0')).join('') + ']';
const DOUBLE = new RegExp(`[\\u00C2-\\u00DF]${CONT}|[\\u00E0-\\u00EF]${CONT}{2}|[\\u00F0-\\u00F4]${CONT}{3}`, 'g');
const byteOf = ch => { const c = ch.codePointAt(0); return c >= 0x80 && c <= 0xFF ? c : (CP1252[c] ?? -1); };
const utf8 = new TextDecoder('utf-8', { fatal: true });
// The name with every double-UTF-8 letter read again; '' when nothing changes.
export function demojibake(name) {
  let changed = false;
  const out = String(name || '').replace(DOUBLE, run => {
    const bytes = [...run].map(byteOf);
    if (bytes.some(b => b < 0)) return run;
    try { const t = utf8.decode(Uint8Array.from(bytes)); if ([...t].length !== 1 || t.codePointAt(0) < 0x80) return run; changed = true; return t; } catch { return run; }
  });
  return changed ? out : '';
}
const isDouble = s => { DOUBLE.lastIndex = 0; return Boolean(demojibake(s)); };

export function rowsSql() {
  return `SELECT id, retailer, product_name, feed_product_name FROM products WHERE ${MARKERS.map(m => `instr(product_name, ${m})`).join(' OR ')} ORDER BY id`;
}

const skeleton = s => String(s || '').replace(/[^\x20-\x7e]/g, '');

export function fixedName(row) {
  const feed = String(row.feed_product_name || '');
  if (!feed || BROKEN.test(feed)) return '';
  // The tidy step only shortened InStock and Finediam names; any other name was the feed name as it is.
  const cand = /^(instock|finediam$)/i.test(String(row.retailer || '')) ? tidyName(feed) : feed;
  if (!cand || BROKEN.test(cand)) return '';
  return skeleton(cand) === skeleton(row.product_name) ? cand : '';
}

export function plan(rows) {
  const rename = [], skip = [];
  for (const r of rows) {
    const name = String(r.product_name || '');
    const cp850 = BROKEN.test(name);
    if (!cp850 && !isDouble(name)) continue;
    // First the code page 850 repair (back to the feed name), then the double UTF-8 letters of what is left.
    let to = cp850 ? fixedName(r) : name;
    if (to) to = demojibake(to) || to;
    if (to && to !== name && !BROKEN.test(to)) rename.push({ id: r.id, from: r.product_name, to });
    else skip.push({ id: r.id, name: r.product_name });
  }
  return { hide: [], rename, skip };
}

export function renderPlan(p) {
  const L = [`Θα διορθώνονταν: ${p.rename.length} ονόματα | Χωρίς σίγουρη διόρθωση (μένουν όπως είναι): ${p.skip.length}`];
  if (p.rename.length) {
    L.push('', 'Όλα τα ονόματα (πριν -> μετά):');
    for (const r of p.rename) L.push(`   - ${String(r.from).slice(0, 110)}`, `     -> ${String(r.to).slice(0, 110)}`);
  }
  if (p.skip.length) {
    L.push('', 'Χωρίς σίγουρη διόρθωση:');
    for (const s of p.skip.slice(0, 30)) L.push(`   - [${s.id}] ${String(s.name).slice(0, 110)}`);
  }
  return L.join('\n') + '\n';
}

// node fixnames.mjs sql
// node fixnames.mjs plan <wrangler-output.txt> <outDir>
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [cmd, a, out] = process.argv.slice(2);
  if (cmd === 'sql') console.log(rowsSql());
  else if (cmd === 'plan') {
    const p = plan(rowsFromWrangler(readFileSync(a, 'utf8')));
    mkdirSync(out, { recursive: true });
    const f = sqlFiles(p);
    writeFileSync(join(out, 'change.sql'), f.change);
    writeFileSync(join(out, 'rollback.sql'), f.rollback);
    writeFileSync(join(out, 'plan.txt'), renderPlan(p));
    writeFileSync(join(out, 'counts.txt'), `${p.rename.length} ${p.skip.length}\n`);
  } else { console.error('usage'); process.exit(2); }
}
