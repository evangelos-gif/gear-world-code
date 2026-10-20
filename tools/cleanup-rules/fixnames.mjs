// Repair of product names broken by the tidy step on 20 Oct 2026 (MGW, WGW, KGW).
// The tidy tool read the database through the Windows console code page (850) instead of UTF-8, so a name such as
// "YOMO KIDS’ Helmet" was written back as "YOMO KIDSÔÇÖ Helmet". The feed name (feed_product_name) was never
// touched, so the right name is the feed name without its size/colour, exactly what the tidy step meant to write.
// A name is changed only when it differs from that name in its non-ASCII characters alone: every letter, number
// and sign that can be read is the same. Anything else is listed and left as it is.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tidyName, sqlFiles, rowsFromWrangler } from './tidy.mjs';

// Characters that UTF-8 text gets when it is read as code page 850 (and that never belong in a product name).
// Written with char() so the SQL stays ASCII for the cmd line: ├ ┬ and Ô followed by Ç, é or ä.
const MARKERS = ['char(9500)', 'char(9516)', 'char(212, 199)', 'char(212, 233)', 'char(212, 228)'];
const BROKEN = /[├┬]|Ô[Çéä]/;

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
    if (!BROKEN.test(String(r.product_name || ''))) continue;
    const to = fixedName(r);
    if (to) rename.push({ id: r.id, from: r.product_name, to });
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
