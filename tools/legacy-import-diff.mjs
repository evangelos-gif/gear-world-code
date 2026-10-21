#!/usr/bin/env node
// Compares an import plan with what the site database has for the same retailer (READ-ONLY).
// A refresh of a retailer = add the new products, update the ones still in the feed, and HIDE the ones that are
// no longer in the plan (sold out in every size, or gone from the shop). Nothing is deleted; a rollback file
// shows them again.
//
// node tools/legacy-import-diff.mjs <plan ids.txt> <wrangler output with id, awin_product_id, is_active> <out dir>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { rowsFromWrangler } from './cleanup-rules/tidy.mjs';
import { updateSql } from './cleanup-rules/instock.mjs';

export function diff(planIds, rows) {
  const plan = new Set(planIds);
  const seen = new Set();
  const gone = [];
  let updated = 0, back = 0;
  for (const r of rows) {
    const key = String(r.awin_product_id);
    seen.add(key);
    const active = Number(r.is_active) === 1;
    if (plan.has(key)) { if (active) updated++; else back++; }
    else if (active) gone.push(Number(r.id));
  }
  const addedIds = [...plan].filter(k => !seen.has(k));
  const added = addedIds.length;
  const activeNow = rows.filter(r => Number(r.is_active) === 1).length;
  // A feed that suddenly misses most products is more likely a broken download than a closed shop.
  const safe = !(activeNow >= 100 && gone.length > activeNow * 0.5);
  return { added, addedIds, updated, back, gone, activeNow, safe };
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
  const [idsFile, dbFile, out] = process.argv.slice(2);
  const planIds = readFileSync(idsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  const d = diff(planIds, rowsFromWrangler(readFileSync(dbFile, 'utf8')));
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'gone-ids.txt'), d.gone.join('\n') + (d.gone.length ? '\n' : ''));
  writeFileSync(join(out, 'hide-gone.sql'), d.gone.length ? updateSql(d.gone, false) : '');
  writeFileSync(join(out, 'rollback-gone.sql'), d.gone.length ? updateSql(d.gone, true) : '');
  writeFileSync(join(out, 'rollback-added.sql'), hideByAwinIdSql(d.addedIds));
  writeFileSync(join(out, 'diff.txt'), `${d.added} ${d.updated} ${d.back} ${d.gone.length} ${d.activeNow} ${d.safe ? 1 : 0}\n`);
}
