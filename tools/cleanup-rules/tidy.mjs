// Tidy-up of products already on MGW / WGW (20 Oct 2026, after the InStock clean-up):
//  1. InStock names still end with the size/colour of the one card that was kept ("Thermal Top - Black / M"):
//     the last " - <option> / <option>" part is removed. The product address follows the new name and the old
//     address redirects to it (the engine finds products by id), so no link breaks.
//  2. Products for the other site: women-only products on MGW, men-only products on WGW are hidden.
//     "Mens & Ladies", "unisex", "couple" and the like stay on both.
// Nothing is deleted. Every change is written with its rollback (old name, is_active = 1).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const WOMEN = words(['women', "women's", 'womens', 'woman', 'ladies', "ladies'", 'lady', 'female', 'for her']);
const MEN = words(['men', "men's", 'mens', 'male', 'gents', 'gentlemen', 'for him']);
const BOTH = words(['unisex', 'couple', 'couples', 'his and hers', 'his & hers', 'for him and her', 'family']);

export function genderOf(name) {
  const n = String(name || '').replace(/[’`]/g, "'");
  if (BOTH.test(n)) return 'both';
  const w = WOMEN.test(n), m = MEN.test(n);
  if (w && m) return 'both';
  if (w) return 'W';
  if (m) return 'M';
  return '';
}

// "Organic Poplin Long Sleeve Shirt: Mens - 3XL / Cream" -> "Organic Poplin Long Sleeve Shirt: Mens"
export function tidyName(name) {
  let s = String(name || '');
  for (let k = 0; k < 3; k++) {
    const i = s.lastIndexOf(' - ');
    if (i < 8) break;
    const tail = s.slice(i + 3);
    if (!/ \/ /.test(tail) || tail.length > 80) break;
    s = s.slice(0, i).replace(/[\s,\-:]+$/, '').trim();
  }
  return s;
}

const q = v => `'${String(v).replace(/'/g, "''")}'`;
const isInStock = r => /^instock/i.test(String(r.retailer || ''));

// The rows to look at (read-only). No % < > & | ^ or double quotes: they go on a Windows cmd line.
export function rowsSql(site, part) {
  const has = ws => '(' + ws.map(w => `instr(lower(product_name), '${w}') BETWEEN 1 AND 100000`).join(' OR ') + ')';
  if (part === 'names') return "SELECT id, retailer, site_category, product_name FROM products WHERE is_active = 1 AND substr(lower(retailer), 1, 7) = 'instock' AND instr(product_name, ' / ') BETWEEN 1 AND 100000";
  if (part === 'gender' && site === 'mgw') return `SELECT id, retailer, site_category, product_name FROM products WHERE is_active = 1 AND ${has(['women', 'ladies', 'lady', 'female', 'for her', 'woman'])}`;
  if (part === 'gender' && site === 'wgw') return `SELECT id, retailer, site_category, product_name FROM products WHERE is_active = 1 AND ${has(['men', 'male', 'gents', 'for him'])}`;
  throw new Error('unknown part');
}

export function plan(site, nameRows, genderRows) {
  const hide = [];
  const rename = [];
  const hidden = new Set();
  for (const r of genderRows) {
    const g = genderOf(r.product_name);
    if ((site === 'mgw' && g === 'W') || (site === 'wgw' && g === 'M')) {
      hide.push({ id: r.id, retailer: r.retailer, site_category: r.site_category, name: r.product_name, reason: site === 'mgw' ? "women's product on Men's Gear World" : "men's product on Women's Gear World" });
      hidden.add(r.id);
    }
  }
  for (const r of nameRows) {
    if (hidden.has(r.id) || !isInStock(r)) continue;
    const to = tidyName(r.product_name);
    if (to && to !== r.product_name) rename.push({ id: r.id, from: r.product_name, to });
  }
  return { hide, rename };
}

export function sqlFiles(p) {
  const hideIds = p.hide.map(h => Number(h.id));
  const lines = [], undo = [];
  for (let i = 0; i < hideIds.length; i += 500) {
    const part = hideIds.slice(i, i + 500);
    lines.push(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id IN (${part.join(', ')});`);
    undo.push(`UPDATE products SET is_active = 1, updated_at = datetime('now') WHERE id IN (${part.join(', ')});`);
  }
  for (const r of p.rename) {
    lines.push(`UPDATE products SET product_name = ${q(r.to)}, updated_at = datetime('now') WHERE id = ${Number(r.id)};`);
    undo.push(`UPDATE products SET product_name = ${q(r.from)}, updated_at = datetime('now') WHERE id = ${Number(r.id)};`);
  }
  return { change: lines.join('\n') + '\n', rollback: undo.join('\n') + '\n' };
}

// wrangler --json output (may have text before it) -> rows
export function rowsFromWrangler(text) {
  const t = String(text || '');
  // The JSON starts with "[" followed by "{" (warnings such as "[WARNING]" before it are skipped).
  const m = /\[\s*\{/.exec(t);
  const i = m ? m.index : -1, j = t.lastIndexOf(']');
  if (i < 0 || j <= i) throw new Error('no JSON in wrangler output');
  const j1 = JSON.parse(t.slice(i, j + 1));
  return (j1[0] && j1[0].results) || [];
}

export function renderPlan(site, p) {
  const fmt = n => new Intl.NumberFormat('en-GB').format(n);
  const L = [`Θα κρύβονταν: ${fmt(p.hide.length)} | Θα καθάριζαν όνομα: ${fmt(p.rename.length)}`];
  const by = {};
  for (const h of p.hide) { const k = `${h.retailer} / ${h.site_category}`; by[k] = (by[k] || 0) + 1; }
  if (p.hide.length) L.push(`-- ${p.hide[0].reason}`);
  for (const [k, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) L.push(`   ${k.padEnd(40)} ${fmt(n)}`);
  const pick = (list, n) => list.length <= n ? list : Array.from({ length: n }, (_, i) => list[Math.floor(i * list.length / n)]);
  if (p.hide.length) { L.push('', 'Δείγματα από όσα θα κρύβονταν:'); for (const h of pick(p.hide, 15)) L.push(`   - ${String(h.name).slice(0, 110)}`); }
  if (p.rename.length) { L.push('', 'Δείγματα ονομάτων (πριν -> μετά):'); for (const r of pick(p.rename, 15)) L.push(`   - ${String(r.from).slice(0, 90)}`, `     -> ${String(r.to).slice(0, 90)}`); }
  return L.join('\n') + '\n';
}

// node tidy.mjs sql <site> <names|gender>
// node tidy.mjs plan <site> <names-output.txt> <gender-output.txt> <outDir>
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [cmd, site, a, b, out] = process.argv.slice(2);
  if (!['mgw', 'wgw'].includes(site)) { console.error('site'); process.exit(2); }
  if (cmd === 'sql') console.log(rowsSql(site, a));
  else if (cmd === 'plan') {
    const p = plan(site, rowsFromWrangler(readFileSync(a, 'utf8')), rowsFromWrangler(readFileSync(b, 'utf8')));
    mkdirSync(out, { recursive: true });
    const f = sqlFiles(p);
    writeFileSync(join(out, 'change.sql'), f.change);
    writeFileSync(join(out, 'rollback.sql'), f.rollback);
    writeFileSync(join(out, 'plan.txt'), renderPlan(site, p));
    writeFileSync(join(out, 'counts.txt'), `${p.hide.length} ${p.rename.length}\n`);
  } else { console.error('usage'); process.exit(2); }
}
