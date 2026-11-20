#!/usr/bin/env node
// bol.com removal (lessons L204): the SQL of tools/bol-remove.ps1, which runs it through wrangler. bol.com's terms
// (9.1 f): when the partnership ends every bol.com product must come off the sites at once (a fine of EUR 1,000 a day).
// This file only WRITES text (SQL and JSON); it never connects to Cloudflare or to a database.
//
//   --mode targets                         JSON: the 13 site databases and gear-world-prices, with the names of bol.com
//                                          on each (database.retailerNames of the older sites included)
//   --mode tables-sql                      the SELECT of the table names of a database
//   --mode count-sql --target <code> --tables <a,b,...>
//                                          one SELECT (one line, no character that cmd.exe would change) that counts the
//                                          bol.com rows of every table that has them
//   --mode delete-sql --target <code> --tables <a,b,...> --rows <n> [--rows-log <n>] --out <file>
//                                          the DELETE statements, side tables first, products in parts of 500
//   --mode switch-sql --out <file>         the kill switch of the daily refresh (gear-world-awin, bol_refresh_meta
//                                          'enabled' = '0', the contract of src/bol-refresh.js, lessons L205), and its
//                                          reason 'removal tool <time>' (never 'worker ...': that one makes every run an error)
//   --mode switch-read-sql                 the SELECT of that switch
//
// A bol.com row: retailer 'bol.com' (or a name that the site shows as 'bol.com'), OR the bol.com partner link
// (https://partner.bol.com/...), so a row with another spelling is removed too (src/lib/retailer-terms.js).
// Price Watch (D1 gear-world-prices): its product key, "<retailer>:<id>" on the older sites and the stable key
// "-4<11 digits>:<id>" of the bol.com shop on the newer ones (src/lib/retailer-terms.js bolPriceKey).
// Click and sales logs (affiliate_clicks, reward_clicks, awin_*) stay: they show nothing on the sites and are needed to
// match the commission bol.com pays for clicks before the end.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PRICE_SITES } from '../sites/prices/sites.js';
import { NO_ALERT_RETAILERS, BOL_PARTNER_PREFIX } from '../src/lib/retailer-terms.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const BOL = NO_ALERT_RETAILERS[0];
export const PRICES_DB = 'gear-world-prices';
export const REFRESH_WORKER = 'gear-world-bol-refresh';
// The database of the daily refresh's own tables (sites/bol-refresh/migrations, lessons L205).
export const AWIN_DB = 'gear-world-awin';
export const PRODUCTS_PER_DELETE = 500;
export const PRICE_ROWS_PER_DELETE = 20000;
// Characters that tools/bol-remove.ps1 never sends in a --command (cmd.exe would change them): & | < > ^ %
export const UNSAFE = /[&|<>^%\r\n]/;

const q = v => `'${String(v).replace(/'/g, "''")}'`;

// The side tables of the older databases that hold bol.com rows or point to bol.com products (the live CGW database,
// 20 Nov 2026): by: 'id' = a column with the product id, 'row' = the table has retailer and affiliate_url,
// 'retailer' = only the retailer name.
export const SIDE_TABLES = [
  { table: 'product_group_offers', by: 'id', column: 'product_id' },
  { table: 'product_finalize_update_queue', by: 'id', column: 'live_id' },
  { table: 'product_finalize_deactivate_queue', by: 'id', column: 'live_id' },
  { table: 'product_finalize_insert_queue', by: 'retailer' },
  { table: 'product_refresh_baseline', by: 'retailer' },
  { table: 'product_refresh_stage', by: 'row' },
  { table: 'products_backup_before_safe_refresh', by: 'row' }
];

// The 13 site databases (sites/prices/sites.js: code, database, layout) with each site's bol.com names, then Price Watch.
export async function targets(root = join(HERE, '..')) {
  const out = [];
  for (const s of PRICE_SITES) {
    const file = join(root, 'sites', s.code, 'site.config.js');
    const cfg = existsSync(file) ? (await import(pathToFileURL(file).href)).default || {} : {};
    const map = (cfg.database && cfg.database.retailerNames) || {};
    const names = [BOL, ...Object.keys(map).filter(k => String(map[k]).toLowerCase() === BOL && k !== BOL)];
    const listed = Boolean(cfg.deliversTo && cfg.deliversTo.retailers && Object.prototype.hasOwnProperty.call(cfg.deliversTo.retailers, BOL));
    out.push({ code: s.code, kind: 'site', name: String(cfg.name || s.code.toUpperCase()), domain: String(cfg.domain || ''), db: s.database,
      legacy: Boolean(s.legacy), names, listed });
  }
  out.push({ code: 'prices', kind: 'prices', name: 'Price Watch', domain: '', db: PRICES_DB, legacy: false,
    names: [...new Set(out.flatMap(t => t.names))], listed: false,
    legacySites: out.filter(t => t.legacy).map(t => t.code), newSites: out.filter(t => !t.legacy).map(t => t.code) });
  return out;
}

export function targetOf(list, code) {
  const t = list.find(x => x.code === code);
  if (!t) throw new Error(`unknown target ${code}`);
  return t;
}

// A bol.com row of a table with retailer and affiliate_url (alias: the table's name in the query, or none).
export function bolWhere(names, alias = '') {
  const a = alias ? `${alias}.` : '';
  return `(${a}retailer IN (${names.map(q).join(', ')}) OR substr(COALESCE(${a}affiliate_url, ''), 1, ${BOL_PARTNER_PREFIX.length}) = ${q(BOL_PARTNER_PREFIX)})`;
}

// A bol.com key of Price Watch (price_last, price_log).
export function priceKeyWhere(t) {
  const lowerNames = [...new Set(t.names.map(n => String(n).toLowerCase()))];
  const old = lowerNames.map(n => `lower(substr(pkey, 1, ${n.length + 1})) = ${q(`${n}:`)}`).join(' OR ');
  const neu = "substr(pkey, 1, 2) = '-4' AND substr(pkey, 14, 1) = ':' AND CAST(substr(pkey, 2, 12) AS INTEGER) BETWEEN 400000000000 AND 499999999999";
  return `((site IN (${t.legacySites.map(q).join(', ')}) AND (${old})) OR (site IN (${t.newSites.map(q).join(', ')}) AND ${neu}))`;
}

export const tablesSql = () => "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name";

const has = (tables, name) => tables.includes(name);
// The groups of CGW whose every offer is a bol.com product (a group with another shop's offer stays).
const bolGroups = w => `SELECT o.group_id FROM product_group_offers o JOIN products p ON p.id = o.product_id GROUP BY o.group_id HAVING SUM(CASE WHEN ${w} THEN 0 ELSE 1 END) = 0`;

// The tables of a target that can hold bol.com rows, in the order of the deletes, as [label, count SQL, delete SQL].
export function parts(t, tables) {
  if (t.kind === 'prices') {
    const k = priceKeyWhere(t);
    return [
      ['price_log', `SELECT COUNT(*) FROM price_log WHERE ${k}`, null],
      ['price_last', `SELECT COUNT(*) FROM price_last WHERE ${k}`, null]
    ].filter(([n]) => has(tables, n));
  }
  if (!has(tables, 'products')) return [];
  const w = bolWhere(t.names);
  const wp = bolWhere(t.names, 'p');
  const ids = `SELECT id FROM products WHERE ${w}`;
  const out = [];
  if (has(tables, 'product_groups') && has(tables, 'product_group_offers')) {
    out.push(['product_groups', `SELECT COUNT(*) FROM product_groups WHERE id IN (${bolGroups(wp)})`, `DELETE FROM product_groups WHERE id IN (${bolGroups(wp)});`]);
  }
  for (const s of SIDE_TABLES) {
    if (!has(tables, s.table)) continue;
    const where = s.by === 'id' ? `${s.column} IN (${ids})` : s.by === 'row' ? w : `retailer IN (${t.names.map(q).join(', ')})`;
    out.push([s.table, `SELECT COUNT(*) FROM ${s.table} WHERE ${where}`, `DELETE FROM ${s.table} WHERE ${where};`]);
  }
  out.push(['products', `SELECT COUNT(*) FROM products WHERE ${w}`, null]);
  return out;
}

// One SELECT with one column per table (and "active": the products a visitor could see).
export function countSql(t, tables) {
  const cols = parts(t, tables).map(([n, sql]) => `(${sql}) AS ${n}`);
  if (t.kind === 'site' && has(tables, 'products')) cols.push(`(SELECT COUNT(*) FROM products WHERE is_active = 1 AND ${bolWhere(t.names)}) AS active`);
  const sql = `SELECT ${cols.length ? cols.join(', ') : '0 AS none'}`;
  if (UNSAFE.test(sql)) throw new Error('count SQL with a character cmd.exe would change');
  return sql;
}

// The DELETE file. rows: the products (or price_last) rows counted just before; rowsLog: price_log rows.
export function deleteSql(t, tables, { rows = 0, rowsLog = 0, stamp = new Date().toISOString() } = {}) {
  const L = [`-- bol.com removal (lessons L204): ${t.code.toUpperCase()} database ${t.db}, ${stamp}. Deletes every bol.com row.`,
    '-- A Time Travel restore point of this database is taken before this file runs (tools/bol-remove.ps1).'];
  if (t.kind === 'prices') {
    const k = priceKeyWhere(t);
    if (has(tables, 'price_log')) for (let i = 0; i <= Math.ceil(Math.max(0, rowsLog) / PRICE_ROWS_PER_DELETE); i++) {
      L.push(`DELETE FROM price_log WHERE (site, pkey, day) IN (SELECT site, pkey, day FROM price_log WHERE ${k} LIMIT ${PRICE_ROWS_PER_DELETE});`);
    }
    if (has(tables, 'price_last')) for (let i = 0; i <= Math.ceil(Math.max(0, rows) / PRICE_ROWS_PER_DELETE); i++) {
      L.push(`DELETE FROM price_last WHERE (site, pkey) IN (SELECT site, pkey FROM price_last WHERE ${k} LIMIT ${PRICE_ROWS_PER_DELETE});`);
    }
    return L.join('\n') + '\n';
  }
  for (const [, , del] of parts(t, tables)) if (del) L.push(del);
  if (has(tables, 'products')) {
    const w = bolWhere(t.names);
    // In parts, so no statement runs long (the search index of each product is updated by its trigger).
    for (let i = 0; i <= Math.ceil(Math.max(0, rows) / PRODUCTS_PER_DELETE); i++) {
      L.push(`DELETE FROM products WHERE id IN (SELECT id FROM products WHERE ${w} LIMIT ${PRODUCTS_PER_DELETE});`);
    }
  }
  return L.join('\n') + '\n';
}

// The kill switch of gear-world-bol-refresh (src/bol-refresh.js reads it at the start of every run): '0' = no bol.com
// call and no price change. The table may not be there yet (the refresh not set up): it is made, as its own migration
// would (IF NOT EXISTS), and that migration keeps the 0 (ON CONFLICT DO NOTHING). bol_refresh_hidden is left as it is.
// disabled_reason: who turned it off. The Worker records every run as an error while the reason starts with 'worker'
// (its own stop after a 401/403 from bol.com); the removal tool's own reason replaces such an old one, so the later runs
// are pauses, not errors (Manager, 20 Nov 2026).
export const SWITCH_REASON = 'removal tool';
export function switchSql(now = new Date()) {
  const at = now.toISOString().slice(0, 19).replace('T', ' ');
  return ['-- bol.com removal (lessons L204): the daily refresh off first (bol_refresh_meta enabled = 0, lessons L205).',
    'CREATE TABLE IF NOT EXISTS bol_refresh_meta (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL);',
    `INSERT INTO bol_refresh_meta (key, value, updated_at) VALUES ('enabled', '0', ${q(at)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    `INSERT INTO bol_refresh_meta (key, value, updated_at) VALUES ('disabled_reason', ${q(`${SWITCH_REASON} ${at.slice(0, 16)}`)}, ${q(at)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`
  ].join('\n') + '\n';
}
export const switchReadSql = () => "SELECT value, updated_at FROM bol_refresh_meta WHERE key = 'enabled'";

async function main() {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? String(args[i + 1] ?? '') : ''; };
  const tables = () => val('tables').split(',').map(x => x.trim()).filter(x => /^[A-Za-z0-9_]{1,64}$/.test(x));
  const mode = val('mode');
  if (mode === 'tables-sql') { process.stdout.write(tablesSql() + '\n'); return; }
  if (mode === 'switch-read-sql') { process.stdout.write(switchReadSql() + '\n'); return; }
  if (mode === 'switch-sql') {
    if (!val('out')) throw new Error('--out is needed');
    writeFileSync(val('out'), switchSql());
    process.stdout.write(JSON.stringify({ ok: true }) + '\n');
    return;
  }
  const list = await targets();
  // One object, not a bare array: Windows PowerShell 5.1 reads a bare array as a single item.
  if (mode === 'targets') { process.stdout.write(JSON.stringify({ targets: list }) + '\n'); return; }
  const t = targetOf(list, val('target'));
  if (mode === 'count-sql') { process.stdout.write(countSql(t, tables()) + '\n'); return; }
  if (mode === 'delete-sql') {
    const out = val('out');
    if (!out) throw new Error('--out is needed');
    const sql = deleteSql(t, tables(), { rows: Number(val('rows')) || 0, rowsLog: Number(val('rows-log')) || 0 });
    writeFileSync(out, sql);
    process.stdout.write(JSON.stringify({ ok: true, statements: sql.split('\n').filter(l => /^DELETE /.test(l)).length }) + '\n');
    return;
  }
  throw new Error('unknown --mode (targets, tables-sql, count-sql, delete-sql, switch-sql, switch-read-sql)');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e => { process.stderr.write(`${e && e.message ? e.message : e}\n`); process.exit(2); });
