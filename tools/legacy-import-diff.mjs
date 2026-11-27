#!/usr/bin/env node
// Compares an import plan with what the site database has for the same retailer (READ-ONLY).
// A refresh of a retailer = add the new products, update the ones still in the feed, and HIDE the ones that are
// no longer in the plan (sold out in every size, or gone from the shop). Nothing is deleted; a rollback file
// shows them again.
//
// Also writes recat-categories.sql, rollback-categories.sql and category-moves.txt (the -CategoriesOnly import, L223).
// node tools/legacy-import-diff.mjs <plan ids.txt> <wrangler output with id, awin_product_id, is_active[, site_category, subcategory]> <out dir>
//   [<wrangler output with the site's site_category, subcategory pairs>]
// With places.json next to ids.txt (lessons L56) it also counts the products that get the site's own subcategory names
// (and writes their rollback), and lists the plan's subcategories that the site does not have yet.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rowsFromWrangler } from './cleanup-rules/tidy.mjs';
import { updateSql } from './cleanup-rules/instock.mjs';

// keys (optional): [[awin_product_id, merchant_product_id]] of the plan (keys.json). A database row that has another Awin id
// but the same shop id (merchant_product_id) is the same product: on CGW the import updates it (lessons L119).
export function planRowMatcher(planIds, keys = []) {
  const byMerchant = new Map();
  for (const [awin, mid] of keys || []) if (mid !== null && mid !== undefined && String(mid).trim()) byMerchant.set(String(mid).trim(), String(awin));
  const plan = new Set(planIds);
  // The plan id a database row stands for, or '' when the plan does not have it.
  return r => {
    const key = String(r.awin_product_id);
    if (plan.has(key)) return key;
    const mid = r.merchant_product_id === null || r.merchant_product_id === undefined ? '' : String(r.merchant_product_id).trim();
    const viaMerchant = mid ? byMerchant.get(mid) : '';
    return viaMerchant && plan.has(viaMerchant) ? viaMerchant : '';
  };
}

export function diff(planIds, rows, keys = []) {
  const plan = new Set(planIds);
  const match = planRowMatcher(planIds, keys);
  const seen = new Set();
  const gone = [];
  let updated = 0, back = 0;
  for (const r of rows) {
    const key = match(r);
    const active = Number(r.is_active) === 1;
    if (key) { seen.add(key); if (active) updated++; else back++; }
    else if (active) gone.push(Number(r.id));
  }
  const addedIds = [...plan].filter(k => !seen.has(k));
  const added = addedIds.length;
  const activeNow = rows.filter(r => Number(r.is_active) === 1).length;
  // A feed that suddenly misses most products is more likely a broken download than a closed shop.
  const safe = !(activeNow >= 100 && gone.length > activeNow * 0.5);
  return { added, addedIds, updated, back, gone, activeNow, safe };
}

const sq = v => (v === null || v === undefined) ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

// Subcategory names (lessons L56). places: [[awin_product_id, site_category, subcategory]] of the plan; replace: names an
// earlier plan wrote that the site does not use; siteSubs: the site's active (site_category, subcategory) pairs.
// recat = products already on the site that get the plan's place (rollback puts back their old one);
// newSubs = where the products of this import would end up in a subcategory the site does not have yet.
export function subcategoryCheck(places, rows, replace = [], siteSubs = [], keys = []) {
  const match = planRowMatcher(places.map(p => String(p[0])), keys);
  const byKey = new Map();
  for (const r of rows) { const k = match(r); if (k && !byKey.has(k)) byKey.set(k, r); }
  const rep = new Set(replace);
  const recat = [];
  const landing = {};
  for (const [key, cat, sub] of places) {
    const r = byKey.get(String(key));
    let place = [cat, sub];
    if (r) {
      if (rep.has(r.subcategory) && (r.site_category !== cat || r.subcategory !== sub)) recat.push({ id: Number(r.id), from: [r.site_category, r.subcategory], to: [cat, sub] });
      else place = [r.site_category, r.subcategory];
    }
    const k = `${place[0]} > ${place[1]}`;
    landing[k] = (landing[k] || 0) + 1;
  }
  // The site's own names: what its active products use, except the names known to be wrong (replace).
  const have = new Set(siteSubs.filter(r => !rep.has(r.subcategory)).map(r => `${r.site_category} > ${r.subcategory}`));
  const newSubs = !siteSubs.length ? [] : Object.entries(landing).filter(([k]) => !have.has(k)).map(([k, n]) => ({ place: k, n })).sort((a, b) => b.n - a.n);
  const rollback = recat.map(x => `UPDATE products SET site_category = ${sq(x.from[0])}, subcategory = ${sq(x.from[1])}, updated_at = datetime('now') WHERE id = ${x.id};`);
  return { recat, newSubs, rollback: rollback.length ? rollback.join('\n') + '\n' : '' };
}

// Categories only (lessons L223, 23 Nov 2026: Julia of Linkwise found rugs and leather sandals in «Ομορφιά & αρώματα»):
// the active products already on the site whose place (category, subcategory) the plan changes, as one UPDATE per new
// place (ids in groups of 400), and the rollback that puts back each old place. Nothing else of the row changes, so a
// refresh of 1.3 million Greek products becomes a few thousand writes.
export function categoryFix(places, rows, keys = []) {
  const match = planRowMatcher(places.map(p => String(p[0])), keys);
  const byKey = new Map();
  for (const r of rows) { if (Number(r.is_active) !== 1) continue; const k = match(r); if (k && !byKey.has(k)) byKey.set(k, r); }
  const to = new Map(), from = new Map();
  let n = 0;
  for (const [key, cat, sub] of places) {
    const r = byKey.get(String(key));
    if (!r || (r.site_category === cat && r.subcategory === sub)) continue;
    n++;
    const t = JSON.stringify([cat, sub]), f = JSON.stringify([r.site_category ?? null, r.subcategory ?? null]);
    if (!to.has(t)) to.set(t, []);
    if (!from.has(f)) from.set(f, []);
    to.get(t).push(Number(r.id));
    from.get(f).push(Number(r.id));
  }
  const sql = groups => {
    const out = [];
    for (const [k, ids] of groups) {
      const [c, sb] = JSON.parse(k);
      for (let i = 0; i < ids.length; i += 400) out.push(`UPDATE products SET site_category = ${sq(c)}, subcategory = ${sq(sb)}, updated_at = datetime('now') WHERE id IN (${ids.slice(i, i + 400).join(', ')});`);
    }
    return out.length ? out.join('\n') + '\n' : '';
  };
  const moves = new Map();
  for (const [key, cat, sub] of places) {
    const r = byKey.get(String(key));
    if (!r || (r.site_category === cat && r.subcategory === sub)) continue;
    const m = `${r.site_category} > ${r.subcategory}  ->  ${cat} > ${sub}`;
    moves.set(m, (moves.get(m) || 0) + 1);
  }
  return { n, sql: sql(to), rollback: sql(from), moves: [...moves.entries()].sort((a, b) => b[1] - a[1]) };
}

// Undo for products an import ADDS (they have no database id yet): hide them again by their awin_product_id.
export function hideByAwinIdSql(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const list = ids.slice(i, i + 200).map(id => `'${String(id).replace(/'/g, "''")}'`).join(', ');
    out.push(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE awin_product_id IN (${list});`);
  }
  return out.length ? out.join('\n') + '\n' : '';
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [idsFile, dbFile, out, subsFile] = process.argv.slice(2);
  const planIds = readFileSync(idsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  // The database rows: one wrangler answer, or a folder of pages database-0001.json.txt ... (lessons L223).
  const rows = statSync(dbFile).isDirectory()
    ? readdirSync(dbFile).filter(f => /^database-\d+\.json\.txt$/.test(f)).sort().flatMap(f => rowsFromWrangler(readFileSync(join(dbFile, f), 'utf8')))
    : rowsFromWrangler(readFileSync(dbFile, 'utf8'));
  const keysFile = join(dirname(idsFile), 'keys.json');
  const keys = existsSync(keysFile) ? JSON.parse(readFileSync(keysFile, 'utf8')) : [];
  const d = diff(planIds, rows, keys);
  const placesFile = join(dirname(idsFile), 'places.json');
  let sc = { recat: [], newSubs: [], rollback: '' };
  let cf = { n: 0, sql: '', rollback: '', moves: [] };
  if (existsSync(placesFile)) {
    const pl = JSON.parse(readFileSync(placesFile, 'utf8'));
    const siteSubs = subsFile && existsSync(subsFile) ? rowsFromWrangler(readFileSync(subsFile, 'utf8')) : [];
    sc = subcategoryCheck(pl.places || [], rows, pl.replace || [], siteSubs, keys);
    cf = categoryFix(pl.places || [], rows, keys);
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'gone-ids.txt'), d.gone.join('\n') + (d.gone.length ? '\n' : ''));
  writeFileSync(join(out, 'hide-gone.sql'), d.gone.length ? updateSql(d.gone, false) : '');
  writeFileSync(join(out, 'rollback-gone.sql'), d.gone.length ? updateSql(d.gone, true) : '');
  writeFileSync(join(out, 'rollback-added.sql'), hideByAwinIdSql(d.addedIds));
  writeFileSync(join(out, 'rollback-recat.sql'), sc.rollback);
  writeFileSync(join(out, 'recat-categories.sql'), cf.sql);
  writeFileSync(join(out, 'rollback-categories.sql'), cf.rollback);
  writeFileSync(join(out, 'category-moves.txt'), cf.moves.map(([m, k]) => `${k}  ${m}`).join('\n') + (cf.moves.length ? '\n' : ''));
  writeFileSync(join(out, 'new-subcategories.txt'), sc.newSubs.map(x => `${x.place}: ${x.n}`).join('\n') + (sc.newSubs.length ? '\n' : ''));
  writeFileSync(join(out, 'diff.txt'), `${d.added} ${d.updated} ${d.back} ${d.gone.length} ${d.activeNow} ${d.safe ? 1 : 0} ${sc.recat.length} ${sc.newSubs.length} ${cf.n}\n`);
}
