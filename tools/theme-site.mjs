#!/usr/bin/env node
// Copies the shared front-end files from TGW (the reference site) to another site and recolours the stylesheet.
// Every Gear World site on the shared engine uses the same site.js, icons and fonts, so a fix made on TGW
// reaches every site the next time this runs. The unit tests fail if a site's copy is out of date.
//
//   node tools/theme-site.mjs ggw          write sites/ggw/public/assets/{site.js,site.css,icons.svg,fonts/*,flags/*}
//   node tools/theme-site.mjs ggw --check  only compare, exit 1 if different
//
// The colours come from cssColorMap in sites/<site>/site.config.js: { '<TGW colour>': '<this site colour>' }.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REF = join(root, 'sites', 'tgw', 'public', 'assets');

export async function themedFiles(siteCode) {
  const site = (await import(pathToFileURL(join(root, 'sites', siteCode, 'site.config.js')).href)).default;
  const map = site.cssColorMap || {};
  let css = readFileSync(join(REF, 'site.css'), 'utf8');
  css = css.replace(/^\/\* Technology Gear World\.[^\n]*\n/, `/* ${site.name}. Made by tools/theme-site.mjs from the TGW stylesheet: change TGW, then run the tool.\n`);
  for (const [from, to] of Object.entries(map)) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'), 'gi');
    css = css.replace(re, to);
  }
  // A few rules only one site needs (e.g. CGW: "≈ £" next to euro prices), from its config.
  if (site.extraCss) css += `\n/* ${site.code} only (site.config.js extraCss) */\n${String(site.extraCss).trim()}\n`;
  const files = {
    'site.css': css,
    'site.js': readFileSync(join(REF, 'site.js'), 'utf8'),
    'icons.svg': readFileSync(join(REF, 'icons.svg'), 'utf8')
  };
  for (const f of readdirSync(join(REF, 'fonts'))) files[`fonts/${f}`] = readFileSync(join(REF, 'fonts', f));
  // Small flags for "Delivers to" (lessons L62), on every site that says where its retailers deliver.
  if (site.deliversTo) for (const f of readdirSync(join(REF, 'flags'))) files[`flags/${f}`] = readFileSync(join(REF, 'flags', f));
  return files;
}

async function main() {
  const [code, flag] = process.argv.slice(2);
  if (!code || code === 'tgw' || !existsSync(join(root, 'sites', code, 'site.config.js'))) {
    console.error('Usage: node tools/theme-site.mjs <site folder, e.g. ggw> [--check]');
    process.exit(2);
  }
  const out = join(root, 'sites', code, 'public', 'assets');
  const files = await themedFiles(code);
  const stale = [];
  for (const [name, content] of Object.entries(files)) {
    const target = join(out, name);
    const same = existsSync(target) && Buffer.compare(readFileSync(target), Buffer.from(content)) === 0;
    if (same) continue;
    stale.push(name);
    if (flag !== '--check') {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content);
    }
  }
  console.log(stale.length ? `${flag === '--check' ? 'Out of date' : 'Written'}: ${stale.join(', ')}` : 'Up to date');
  process.exit(flag === '--check' && stale.length ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
