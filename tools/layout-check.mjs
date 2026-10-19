#!/usr/bin/env node
// Gear World layout check. READ-ONLY: opens pages in a real browser (Chromium) and checks the layout
// on a phone (390 px) and a desktop (1366 px). Catches what the HTML-only QA gate cannot see:
//   - the page scrolls sideways (horizontal overflow)
//   - text or buttons touching the screen edge (missing 16 px gutter)
//   - buttons smaller than 44 px (hard to tap)
//   - JavaScript errors and failed requests for the site's own files
// Saves a screenshot of every page so a person can look at them.
//
// Usage: node tools/layout-check.mjs <baseUrl> [--shots <dir>] [--out report.txt] [--lang de-DE] [--currency RUB]
//   --lang / --currency open every page as a visitor who chose that language and currency (lessons L24, L25):
//   longer words and "≈" prices must still fit.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const base = (args.find(a => /^https?:\/\//.test(a)) || 'http://127.0.0.1:8787').replace(/\/$/, '');
const val = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const shotsDir = val('shots') || 'layout-shots';
const outFile = val('out');
const prefLang = val('lang');
const prefCurrency = val('currency');
mkdirSync(shotsDir, { recursive: true });

const GUTTER = 12; // px: the design uses 16 px; 12 leaves room for borders
const MIN_TAP = 44;
const results = [];
const check = (ok, name, detail = '') => results.push({ ok: Boolean(ok), name, detail });

const viewports = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1366, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

const browser = await chromium.launch();
try {
  // Find one category and one product page from the home page, so the check needs no fixed slugs.
  const probe = await browser.newPage();
  await probe.goto(base + '/');
  const categoryPath = await probe.$eval('a[href^="/category/"]', a => a.getAttribute('href')).catch(() => '');
  const productPath = await probe.$eval('a[href^="/product/"]', a => a.getAttribute('href')).catch(() => '');
  await probe.close();
  check(categoryPath, 'home links to a category page');
  check(productPath, 'home links to a product page');

  let comparePath = '';
  let cartPath = '';
  try {
    const d = await (await fetch(base + '/api/products?limit=3')).json();
    const ids = (d.products || []).slice(0, 3).map(p => p.id);
    if (ids.length >= 2) comparePath = '/compare/?ids=' + ids.join(',');
    if (ids.length) cartPath = '/cart/?items=' + ids.map((id, i) => `${id}:${i + 1}`).join(',');
  } catch { comparePath = ''; }
  // The cart page exists only on sites with a cart.
  if (cartPath) {
    const r = await fetch(base + cartPath).catch(() => null);
    if (!r || r.status !== 200) cartPath = '';
  }

  const pages = [
    ['home', '/'],
    ['category', categoryPath],
    ['product', productPath],
    ['search', '/search?q=laptop'],
    ['compare', comparePath],
    ['cart', cartPath],
    ['privacy', '/privacy/'],
    ['not-found', '/this-page-does-not-exist/']
  ].filter(([, p]) => p);

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor,
      reducedMotion: 'reduce'
    });
    if (prefLang || prefCurrency) {
      // The site script reads these from the browser's storage; the key prefix is on <html data-store>.
      await context.addInitScript(([l, c]) => {
        const store = () => document.documentElement.getAttribute('data-store') || 'gw';
        document.addEventListener('readystatechange', () => {
          try {
            if (l) localStorage.setItem(store() + '-lang', l);
            if (c) localStorage.setItem(store() + '-currency', c);
          } catch (e) { /* ignore */ }
        }, { once: true });
      }, [prefLang, prefCurrency]);
    }
    const page = await context.newPage();
    for (const [name, path] of pages) {
      const label = `${vp.name} ${path}`;
      const consoleErrors = [];
      const failed = [];
      // The 404 page reports its own 404 status in the console; that one is expected.
      const onConsole = m => {
        if (m.type() !== 'error') return;
        if (name === 'not-found' && m.text().startsWith('Failed to load resource') && m.location().url.includes('/this-page-does-not-exist/')) return;
        consoleErrors.push(m.text());
      };
      const onResponse = r => { if (r.url().startsWith(base) && r.status() >= 400 && !r.url().includes('/this-page-does-not-exist/')) failed.push(`${r.status()} ${r.url()}`); };
      page.on('console', onConsole);
      page.on('response', onResponse);
      await page.goto(base + path, { waitUntil: 'networkidle' });
      if (prefLang || prefCurrency) await page.waitForSelector('html[data-ready]', { timeout: 10000 }).catch(() => {});
      if (prefLang) check(await page.evaluate(() => document.documentElement.lang) === prefLang, `${label}: page is in ${prefLang}`);
      if (prefCurrency && prefCurrency !== 'GBP' && ['home', 'category', 'product', 'cart'].includes(name)) {
        check(await page.$('.fx') !== null, `${label}: prices also shown in ${prefCurrency}`);
      }

      const m = await page.evaluate(({ GUTTER, MIN_TAP }) => {
        const vw = document.documentElement.clientWidth;
        const scrollsSideways = document.documentElement.scrollWidth > vw + 1;
        // Elements inside a sideways scroller (product strip, category bar) may extend past the edge by design.
        const inScroller = el => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll') return true;
          }
          return false;
        };
        const visible = el => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        };
        const describe = el => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''} "${(el.textContent || '').trim().slice(0, 40)}"`;
        const edge = [];
        for (const el of document.querySelectorAll('main h1, main h2, main h3, main p, main .btn, main .drawer, main .cat-tile, main .label-card, main form, main table, main dl')) {
          if (!visible(el) || inScroller(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.left < GUTTER - 0.5 || r.right > vw - GUTTER + 0.5) edge.push(`${describe(el)} left=${Math.round(r.left)} right=${Math.round(vw - r.right)}`);
        }
        const small = [];
        for (const el of document.querySelectorAll('.btn, button, input[type="search"], input[type="email"], select')) {
          if (!visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.height < MIN_TAP - 4) small.push(`${describe(el)} h=${Math.round(r.height)}`);
        }
        // Text cut off inside a button or link (e.g. a long German word): the content is wider than the box.
        // Two ways: the text is wider than the button, or the button is wider than a box that hides overflow
        // (a product card), so part of it is cut away.
        const clipped = [];
        const clipBox = el => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (s.overflowX === 'hidden' || s.overflowX === 'clip' || s.overflow === 'hidden') return p;
          }
          return null;
        };
        for (const el of document.querySelectorAll('.btn, button, .cart-link, .catbar a, .chip-list a')) {
          if (!visible(el) || inScroller(el)) continue;
          if (el.scrollWidth > el.clientWidth + 1) { clipped.push(`${describe(el)} ${el.scrollWidth}>${el.clientWidth}`); continue; }
          const box = clipBox(el);
          if (box) {
            const r = el.getBoundingClientRect();
            const b = box.getBoundingClientRect();
            if (r.left < b.left - 1 || r.right > b.right + 1) clipped.push(`${describe(el)} sticks out of its box`);
          }
        }
        return { scrollsSideways, scrollWidth: document.documentElement.scrollWidth, vw, edge, small, clipped, hasMain: !!document.querySelector('main') };
      }, { GUTTER, MIN_TAP });

      // Lessons L30: on a phone, the home page shows the search box and "Shop by category" on the first
      // screen. 620 px leaves room for the phone's own browser bars (address bar and bottom menu).
      if (vp.name === 'phone' && name === 'home') {
        const fold = await page.evaluate(() => {
          const b = sel => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().bottom + window.scrollY) : 99999; };
          return { search: b('.hero-search'), shop: b('.hero-actions .btn') };
        });
        check(fold.search <= 620 && fold.shop <= 620, `${label}: search box and "Shop by category" on the first screen`, `search ends at ${fold.search}px, button at ${fold.shop}px (max 620)`);
      }
      check(m.hasMain, `${label}: page has <main>`);
      check(!m.scrollsSideways, `${label}: no sideways scrolling`, `scrollWidth ${m.scrollWidth} > ${m.vw}`);
      check(m.edge.length === 0, `${label}: content keeps the ${GUTTER}px gutter`, m.edge.slice(0, 5).join(' | '));
      check(m.small.length === 0, `${label}: buttons and fields at least ${MIN_TAP - 4}px tall`, m.small.slice(0, 5).join(' | '));
      check(m.clipped.length === 0, `${label}: no text cut off inside buttons`, m.clipped.slice(0, 5).join(' | '));
      check(consoleErrors.length === 0, `${label}: no JavaScript errors`, consoleErrors.slice(0, 3).join(' | '));
      check(failed.length === 0, `${label}: all site files load`, failed.slice(0, 3).join(' | '));

      // Scroll through the page so lazy images load, then take the screenshot from the top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
        window.scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: join(shotsDir, `${vp.name}-${name}.png`), fullPage: true });
      page.off('console', onConsole);
      page.off('response', onResponse);
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const failedChecks = results.filter(r => !r.ok);
const lines = [`Layout check | Base: ${base} | Checks: ${results.length} | Passed: ${results.length - failedChecks.length} | Failed: ${failedChecks.length}`, ''];
for (const r of failedChecks) lines.push(`FAIL ${r.name}${r.detail ? ' -> ' + r.detail : ''}`);
if (!failedChecks.length) lines.push('All layout checks passed.');
lines.push('', `Screenshots: ${shotsDir}`);
const report = lines.join('\n');
console.log(report);
if (outFile) writeFileSync(outFile, report + '\n');
process.exit(failedChecks.length ? 1 : 0);
