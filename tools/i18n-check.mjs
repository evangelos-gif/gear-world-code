#!/usr/bin/env node
// Gear World translation check (lessons L24). READ-ONLY.
// 1. Every language in the site config has a dictionary file in public/assets/i18n/, valid JSON, with the
//    same {0} {1} placeholders as the English text.
// 2. Every text the site script writes itself (t('...') and tf('...') in site.js) is in every dictionary.
// 3. In a real browser, every page is opened in every language: the script lists any English text it could
//    not translate (window.GW_I18N_MISSING). One missing text fails the check.
//
// Usage: node tools/i18n-check.mjs <baseUrl> --site sites/tgw [--out report.txt] [--dump keys.json]
//   --dump writes every English text found, for adding a new language or new texts.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const base = (args.find(a => /^https?:\/\//.test(a)) || 'http://127.0.0.1:8787').replace(/\/$/, '');
const val = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const siteDir = val('site') || 'sites/tgw';
const site = (await import(pathToFileURL(resolve(siteDir, 'site.config.js')).href)).default;
const BASE_LANG = 'en-GB';
const langs = (site.languages || []).map(l => l.code).filter(c => c !== BASE_LANG);
const store = site.storagePrefix || site.code.toLowerCase();

const results = [];
const check = (ok, name, detail = '') => results.push({ ok: Boolean(ok), name, detail });
const placeholders = s => (String(s).match(/\{\d+\}/g) || []).sort().join(',');

// ---------- 1. dictionary files ----------
const dicts = {};
for (const code of langs) {
  const file = join(siteDir, 'public', 'assets', 'i18n', `${code}.json`);
  if (!existsSync(file)) { check(false, `${code}: dictionary file exists`, file); continue; }
  let d = null;
  try { d = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { check(false, `${code}: dictionary is valid JSON`, e.message); continue; }
  const okShape = d && typeof d === 'object' && !Array.isArray(d) && Object.values(d).every(v => typeof v === 'string' && v.trim());
  check(okShape, `${code}: every translation is non-empty text`);
  const badPh = Object.entries(d).filter(([k, v]) => placeholders(k) !== placeholders(v)).map(([k]) => k);
  check(badPh.length === 0, `${code}: placeholders {0} {1} kept`, badPh.slice(0, 5).join(' | '));
  dicts[code] = d;
}

// ---------- 2. texts written by site.js ----------
const js = readFileSync(join(siteDir, 'public', 'assets', 'site.js'), 'utf8');
const scriptKeys = new Set();
for (const m of js.matchAll(/\bt[f]?\('((?:[^'\\]|\\.)*)'/g)) {
  scriptKeys.add(JSON.parse('"' + m[1].replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'));
}
// Texts with a changing part that the server writes with tr('...') in src/pages/ (some only on rare pages).
for (const f of ['layout', 'home', 'listing', 'product', 'compare', 'cart', 'info']) {
  const file = join('src', 'pages', `${f}.js`);
  if (!existsSync(file)) continue;
  for (const m of readFileSync(file, 'utf8').matchAll(/\btr\('((?:[^'\\]|\\.)*)'/g)) scriptKeys.add(m[1].replace(/\\'/g, "'"));
}
// Messages the Worker sends to the newsletter form, which the site script shows translated.
for (const m of readFileSync(join('src', 'engine.js'), 'utf8').matchAll(/\b(?:error|message): '((?:[^'\\]|\\.)*)'/g)) scriptKeys.add(m[1]);
// Texts that only appear with many products (page buttons): the test data has too few products to show them.
for (const k of ['Pages', 'Next', 'Previous']) scriptKeys.add(k);
// Every text of the site config that pages show: category names, menu names and intros, hero texts.
for (const c of site.categories || []) for (const k of ['name', 'nav', 'intro']) if (c[k]) scriptKeys.add(c[k]);
for (const k of ['heroEyebrow', 'heroTitle', 'heroText', 'searchPlaceholder']) if (site[k]) scriptKeys.add(site[k]);
if (site.cart && site.cart.name) scriptKeys.add(site.cart.name);
for (const code of Object.keys(dicts)) {
  const miss = [...scriptKeys].filter(k => !(k in dicts[code]));
  check(miss.length === 0, `${code}: has the ${scriptKeys.size} texts of the script, the pages and the config`, miss.slice(0, 5).join(' | '));
}

// ---------- 3. every page, every language, in a real browser ----------
const allKeys = new Set(scriptKeys);
const browser = await chromium.launch();
try {
  const probe = await browser.newPage();
  await probe.goto(base + '/');
  const categoryPath = await probe.$eval('a[href^="/category/"]', a => a.getAttribute('href')).catch(() => '');
  const productPath = await probe.$eval('a[href^="/product/"]', a => a.getAttribute('href')).catch(() => '');
  await probe.close();
  let ids = [];
  try { ids = ((await (await fetch(base + '/api/products?limit=3')).json()).products || []).map(p => p.id); } catch { ids = []; }
  // Two products of the same category, so the compare page shows "Our pick".
  let sameCat = [];
  try {
    const c0 = (site.categories[0] || {}).slug;
    sameCat = ((await (await fetch(`${base}/api/products?category=${c0}&limit=2`)).json()).products || []).map(p => p.id);
  } catch { sameCat = []; }
  const pages = [
    '/', ...(site.categories || []).map(c => `/category/${c.slug}/`), categoryPath ? `${categoryPath}?min=99999` : '', categoryPath ? `${categoryPath}?sort=price-asc&page=2` : '', '/deals/?page=2',
    productPath, '/deals/', '/search', '/search?q=laptop', '/search?q=zzzzqqq',
    ids.length >= 2 ? `/compare/?ids=${ids.slice(0, 2).join(',')}` : '', sameCat.length === 2 ? `/compare/?ids=${sameCat.join(',')}` : '', '/compare/',
    ids.length ? `/cart/?items=${ids.map((id, i) => `${id}:${i + 1}`).join(',')}` : '', '/cart/',
    '/about/', '/privacy/', '/this-page-does-not-exist/'
  ].filter(Boolean);

  // With an empty dictionary every English text is "missing": that is the full list of texts on the pages.
  const runs = [...Object.keys(dicts).map(code => ({ code, dict: null })), ...(val('dump') ? [{ code: langs[0] || 'el-GR', dict: {}, dump: true }] : [])];
  for (const run of runs) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(([key, code]) => { try { localStorage.setItem(key, code); } catch (e) { /* ignore */ } }, [`${store}-lang`, run.code]);
    if (run.dump) {
      await context.route('**/assets/i18n/*.json*', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    }
    const page = await context.newPage();
    const missing = new Set();
    for (const p of pages) {
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.waitForSelector('html[data-ready]', { timeout: 10000 }).catch(() => {});
      const r = await page.evaluate(() => ({ lang: document.documentElement.lang, ready: document.documentElement.getAttribute('data-ready'), miss: window.GW_I18N_MISSING || [] }));
      if (!run.dump) check(r.ready === run.code && r.lang === run.code, `${run.code} ${p}: page switched to ${run.code}`, `lang=${r.lang} ready=${r.ready}`);
      for (const k of r.miss) missing.add(k);
    }
    if (run.dump) for (const k of missing) allKeys.add(k);
    else check(missing.size === 0, `${run.code}: every text on ${pages.length} pages is translated`, [...missing].slice(0, 8).join(' | '));
    await context.close();
  }
} finally {
  await browser.close();
}

if (val('dump')) {
  writeFileSync(val('dump'), JSON.stringify([...allKeys].sort(), null, 2) + '\n');
  console.log(`Wrote ${allKeys.size} English texts to ${val('dump')}`);
}

const failed = results.filter(r => !r.ok);
const lines = [`Translation check | Base: ${base} | Languages: ${langs.length} | Checks: ${results.length} | Passed: ${results.length - failed.length} | Failed: ${failed.length}`, ''];
for (const r of failed) lines.push(`FAIL ${r.name}${r.detail ? ' -> ' + r.detail : ''}`);
if (!failed.length) lines.push('All translation checks passed.');
const report = lines.join('\n');
console.log(report);
if (val('out')) writeFileSync(val('out'), report + '\n');
process.exit(failed.length && !val('dump') ? 1 : 0);
