#!/usr/bin/env node
// Travel Gear World - import PLAN (dry run). READ-ONLY for feeds and for D1.
// The same tool as TGW (tools/tgw-import-plan.mjs) with the VGW rules (sites/vgw/category-rules.js) and sources
// (sites/vgw/sources.json). Writes report.txt and the SQL that WOULD load the products (not executed).
//
// Usage: node tools/vgw-import-plan.mjs --archive <dir> --out <dir> [--sources sites/vgw/sources.json] [--only 123932]
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planImport } from './tgw-import-plan.mjs';
import * as VGW_RULES from '../sites/vgw/category-rules.js';

const here = dirname(fileURLToPath(import.meta.url));

export function planVgwImport(opts) {
  return planImport({ ...opts, rules: VGW_RULES, label: 'VGW' });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const val = n => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : ''; };
  const archive = val('archive');
  const outDir = val('out');
  const sourcesFile = val('sources') || join(here, '..', 'sites', 'vgw', 'sources.json');
  if (!archive || !outDir) {
    console.error('usage: node tools/vgw-import-plan.mjs --archive <dir> --out <dir> [--sources <file>]');
    process.exit(2);
  }
  if (existsSync(join(outDir, 'report.txt'))) {
    console.error(`Output folder already has a report: ${outDir}. Use a new folder.`);
    process.exit(2);
  }
  mkdirSync(outDir, { recursive: true });
  const only = val('only') ? val('only').split(',').map(x => x.trim()).filter(Boolean) : null;
  const { stats, sqlFiles } = await planVgwImport({ archive, sourcesFile, outDir, only });
  console.log(`rows ${stats.rows} | would import ${stats.accepted} | SQL files ${sqlFiles.length} (not executed)`);
  console.log(`report: ${join(outDir, 'report.txt')}`);
}
