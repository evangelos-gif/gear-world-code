// Daily price log (lessons L100): makes the real config (wrangler.jsonc) of the private Worker gear-world-prices from
// sites/prices/wrangler.jsonc.example, with the database IDs of this Cloudflare account. Used by tools/prices-setup.ps1
// on the PC only: the file it writes holds the IDs and is never committed.
//
//   node tools/prices-config.mjs names <template>                       read-only: "db=<database name>" per database
//   node tools/prices-config.mjs write <template> <ids.json> <out> run  the config with the 15-minute cron
//   node tools/prices-config.mjs write <template> <ids.json> <out> stop the same config without any cron
// ids.json: { "<database name>": "<database id>" }. Exit 1 and nothing written on any doubt.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseJsonc } from './poster-config.mjs';

export const WORKER = 'gear-world-prices';
export const PRICES_DB = 'gear-world-prices';
export const CRON = '*/15 * * * *';
const PLACEHOLDER = 'REPLACE_WITH_DATABASE_ID';
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The template, checked: private (no address of any kind), one cron, the prices database first with its migrations,
// then the 13 site databases, every ID a placeholder.
export function readTemplate(text) {
  const cfg = parseJsonc(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  if (!cfg || cfg.name !== WORKER) throw new Error('not the gear-world-prices template');
  if (cfg.workers_dev !== false || cfg.preview_urls !== false) throw new Error('workers.dev and preview addresses must be off');
  if (cfg.routes || cfg.route) throw new Error('the price Worker has no routes');
  if (!cfg.triggers || !Array.isArray(cfg.triggers.crons) || cfg.triggers.crons.length !== 1 || cfg.triggers.crons[0] !== CRON) throw new Error(`one cron: ${CRON}`);
  const dbs = cfg.d1_databases;
  if (!Array.isArray(dbs) || dbs.length !== 14) throw new Error('14 databases expected');
  if (dbs[0].binding !== 'PRICES_DB' || dbs[0].database_name !== PRICES_DB || !dbs[0].migrations_dir) throw new Error('PRICES_DB first, with its migrations');
  const names = new Set();
  for (const d of dbs) {
    if (!d || !d.binding || !d.database_name || d.database_id !== PLACEHOLDER) throw new Error('every database needs a binding, a name and the placeholder id');
    if (names.has(d.database_name)) throw new Error(`database twice: ${d.database_name}`);
    names.add(d.database_name);
    if (d !== dbs[0] && d.migrations_dir) throw new Error(`no migrations for a site database: ${d.database_name}`);
  }
  return cfg;
}

export function databaseNames(text) {
  return readTemplate(text).d1_databases.map(d => d.database_name);
}

// The real config text. mode "run": with the cron; "stop": with an empty cron list (wrangler then removes the cron).
export function buildConfig(text, ids, mode, stamp = new Date().toISOString().slice(0, 16)) {
  if (mode !== 'run' && mode !== 'stop') throw new Error('mode is run or stop');
  const cfg = readTemplate(text);
  for (const d of cfg.d1_databases) {
    const id = ids && ids[d.database_name];
    if (!id || !ID.test(String(id))) throw new Error(`no id for ${d.database_name}`);
    d.database_id = String(id).toLowerCase();
  }
  if (mode === 'stop') cfg.triggers.crons = [];
  const out = `// gear-world-prices - made by tools/prices-setup.ps1 (${stamp}, ${mode}). Holds database IDs: never commit.\n${JSON.stringify(cfg, null, 2)}\n`;
  const back = parseJsonc(out);
  if (back.d1_databases.length !== 14 || back.d1_databases.some(d => !ID.test(d.database_id))) throw new Error('read back failed');
  if (back.triggers.crons.length !== (mode === 'run' ? 1 : 0)) throw new Error('read back failed (cron)');
  return out;
}

function main(argv) {
  const [mode, template, idsFile, outFile, kind] = argv;
  try {
    const text = readFileSync(template, 'utf8');
    if (mode === 'names') { for (const n of databaseNames(text)) console.log(`db=${n}`); return 0; }
    if (mode === 'write' && idsFile && outFile) {
      const ids = JSON.parse(readFileSync(idsFile, 'utf8').replace(/^﻿/, ''));
      const out = buildConfig(text, ids, kind || 'run');
      writeFileSync(outFile, out, 'utf8');
      console.log(`ok databases=14 crons=${kind === 'stop' ? 0 : 1}`);
      return 0;
    }
    console.log('usage: prices-config.mjs names <template> | write <template> <ids.json> <out> run|stop');
    return 2;
  } catch (e) {
    console.log(`error: ${e.message}`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = main(process.argv.slice(2));
