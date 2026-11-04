#!/usr/bin/env node
// Gear World Hub /api/registry: "shop_categories" for every Gear World site (owner, 4/11/2026, option A).
// The categories come from the sites' own settings (sites/<code>/site.config.js), the same ones their menus use, and
// are written into sites/gwh/worker.js between the GWH-SHOP-CATEGORIES lines. They are NOT in the Hub D1: the D1
// table "categories" also feeds /api/classify and the central import, so it stays as it is (lessons L70).
// The Gear World app reads shop_categories to show the category buttons of a world.
//
// Usage:
//   node tools/gwh-shop-categories.mjs --check   READ-ONLY: is the list in worker.js the same as the site settings?
//   node tools/gwh-shop-categories.mjs --write   writes the list into sites/gwh/worker.js (a repo file only)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SITES_DIR = fileURLToPath(new URL('../sites/', import.meta.url));
const WORKER = fileURLToPath(new URL('../sites/gwh/worker.js', import.meta.url));
const START = '// GWH-SHOP-CATEGORIES start';
const END = '// GWH-SHOP-CATEGORIES end';

// site key (CGW, MGW ...) -> [{ name, slug, url }], in menu order. Only folders with a site.config.js that has categories.
export async function shopCategories() {
  const out = {};
  for (const code of readdirSync(SITES_DIR).sort()) {
    const file = `${SITES_DIR}${code}/site.config.js`;
    if (!/^[a-z]{3}$/.test(code) || !existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href);
    const site = mod.default || mod.site || Object.values(mod)[0];
    if (!site || !Array.isArray(site.categories) || site.categories.length === 0) continue;
    out[code.toUpperCase()] = site.categories.map(c => ({
      name: String(c.name),
      slug: String(c.slug),
      url: `https://${site.domain}/category/${c.slug}/`
    }));
  }
  return out;
}

export function block(map) {
  return [
    `${START} (made by tools/gwh-shop-categories.mjs from sites/<code>/site.config.js; not in the D1, lessons L70)`,
    `const SHOP_CATEGORIES = ${JSON.stringify(map)};`,
    END
  ].join('\n');
}

export function currentBlock(text) {
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a < 0 || b < a) return null;
  return text.slice(a, b + END.length);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const want = block(await shopCategories());
  const text = readFileSync(WORKER, 'utf8');
  const have = currentBlock(text);
  if (process.argv.includes('--write')) {
    if (have === null) { console.error('worker.js has no GWH-SHOP-CATEGORIES lines'); process.exit(2); }
    writeFileSync(WORKER, text.replace(have, want));
    console.log('sites/gwh/worker.js: shop categories written');
  } else {
    const ok = have === want;
    console.log(ok ? 'OK: the shop categories in worker.js are the same as the site settings.' : 'NOT UP TO DATE: run node tools/gwh-shop-categories.mjs --write');
    process.exitCode = ok ? 0 : 1;
  }
}
