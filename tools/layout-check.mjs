#!/usr/bin/env node
// Gear World layout check. READ-ONLY: opens pages in a real browser (Chromium) and checks the layout
// on a phone (390 px), a small phone (360 px) and a desktop (1366 px). Catches what the HTML-only QA gate cannot see:
//   - the page scrolls sideways (horizontal overflow)
//   - text or buttons touching the screen edge (missing 16 px gutter)
//   - buttons smaller than 44 px (hard to tap)
//   - JavaScript errors and failed requests for the site's own files
//   - the discount codes bar (lessons L115): between the masthead row and the menu, full width, its words not cut off,
//     and only on a page whose footer links to the codes
//   - the first screen of the home page on a phone (lessons L30, L115): the search box and "Browse by category" end
//     within 620 px at 390 px and at 360 px, in English and the 10 other languages, in the worst case: the country bar
//     (lessons L107) and the discount codes bar both showing. A page without one of them gets it added for this
//     measurement (the same HTML as the engine's, src/pages/layout.js), so every site is measured the same way, with or
//     without running codes and whatever country the local Worker thinks the visitor is in.
// Saves a screenshot of every page so a person can look at them.
//
// Usage: node tools/layout-check.mjs <baseUrl> [--shots <dir>] [--out report.txt] [--lang de-DE] [--currency RUB]
//   --lang / --currency open every page as a visitor who chose that language and currency (lessons L24, L25):
//   longer words and "≈" prices must still fit. The first-screen check in every language runs only without --lang.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ukBarHtml, codesBarFor } from '../src/pages/layout.js';
import { toString } from '../src/lib/html.js';

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
const firstScreen = []; // the numbers of the first-screen pass, for the report
const check = (ok, name, detail = '') => results.push({ ok: Boolean(ok), name, detail });

const viewports = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  // A small phone (lessons L115): the same checks; its first screen is measured in the pass for every language below.
  { name: 'phone-360', width: 360, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1366, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];
// Lessons L30: what a phone shows before any scrolling. 620 px leaves room for the phone's own browser bars.
const FIRST_SCREEN = 620;
// English and the 10 languages of the dictionaries (lessons L24).
const LANGUAGES = ['en-GB', 'de-DE', 'el-GR', 'es-ES', 'fr-FR', 'it-IT', 'nl-NL', 'pt-PT', 'ro-RO', 'ru-RU', 'sq-AL'];
// The worst case of the first screen (lessons L115): the country bar (L107) and the codes bar with its longest words
// ("4 active codes and offers"), added to a home page that has neither, exactly as the engine writes them.
const WORST_COUNTRY_BAR = ukBarHtml();
const WORST_CODES_BAR = toString(codesBarFor([{ kind: 'code' }, { kind: 'code' }, { kind: 'sale' }, { kind: 'coupon' }]));
function worstCase(page) {
  const added = { country: false, codes: false };
  let h = page;
  if (!h.includes('class="country-bar"')) {
    h = h.replace('<header class="masthead">', `${WORST_COUNTRY_BAR}<header class="masthead">`);
    added.country = true;
  }
  if (!h.includes('class="codes-bar"')) {
    const v = encodeURIComponent((h.match(/<html[^>]* data-v="([^"]*)"/) || [])[1] || '');
    const bar = WORST_CODES_BAR.replace(/\/assets\/icons\.svg(\?v=[^#"]*)?#/g, `/assets/icons.svg?v=${v}#`);
    h = h.replace(/(<\/div>\s*)(<nav class="catbar")/, `$1${bar}\n  $2`).replace(/<body class="([^"]*)">/, '<body class="$1" data-codes>');
    added.codes = true;
  }
  return { html: h, added };
}

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
    if (ids.length) cartPath = '/saved/?items=' + ids.join(',');
  } catch { comparePath = ''; }
  // The saved list exists only on sites with one (site.cart).
  if (cartPath) {
    const r = await fetch(base + cartPath).catch(() => null);
    if (!r || r.status !== 200) cartPath = '';
  }

  // Discount codes (lessons L32): the retailer page when the bar links to one, else the index page.
  const codesPath = await (async () => {
    try {
      const h = await (await fetch(base + '/')).text();
      return (h.match(/<div class="promo-bar">[\s\S]*?href="(\/discount-codes\/[a-z0-9-]+\/)"/) || [])[1] || '/discount-codes/';
    } catch { return '/discount-codes/'; }
  })();
  const pages = [
    ['home', '/'],
    ['category', categoryPath],
    ['product', productPath],
    ['search', '/search?q=laptop'],
    ['compare', comparePath],
    ['cart', cartPath],
    ['privacy', '/privacy/'],
    ['discount-codes', codesPath],
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
        for (const el of document.querySelectorAll('.btn, button, .cart-link, .catbar a, .chip-list a, .codes-bar')) {
          if (!visible(el) || inScroller(el)) continue;
          if (el.scrollWidth > el.clientWidth + 1) { clipped.push(`${describe(el)} ${el.scrollWidth}>${el.clientWidth}`); continue; }
          const box = clipBox(el);
          if (box) {
            const r = el.getBoundingClientRect();
            const b = box.getBoundingClientRect();
            if (r.left < b.left - 1 || r.right > b.right + 1) clipped.push(`${describe(el)} sticks out of its box`);
          }
        }
        // The discount codes bar (lessons L115): right after the masthead row and right before the menu, in the page and
        // on the screen, as wide as the screen, at least 24 px tall (one link across the whole bar), and there exactly when
        // the footer links to the codes.
        const bar = document.querySelector('.codes-bar');
        const footerCodes = !!document.querySelector('.site-footer a[href="/discount-codes/"]');
        let codes = { present: !!bar, footerCodes, problems: [] };
        if (bar) {
          const row = document.querySelector('.masthead-row');
          const cat = document.querySelector('.catbar');
          const rb = bar.getBoundingClientRect();
          if (document.querySelectorAll('.codes-bar').length !== 1) codes.problems.push('more than one bar');
          if (!row || bar.previousElementSibling !== row) codes.problems.push('not right after the masthead row');
          if (!cat || bar.nextElementSibling !== cat) codes.problems.push('not right before the menu');
          if (row && rb.top < row.getBoundingClientRect().bottom - 1) codes.problems.push('overlaps the masthead row');
          if (cat && rb.bottom > cat.getBoundingClientRect().top + 1) codes.problems.push('overlaps the menu');
          if (Math.abs(rb.width - vw) > 1 || rb.left > 0.5) codes.problems.push(`not full width (${Math.round(rb.width)}px)`);
          if (rb.height < 24) codes.problems.push(`only ${Math.round(rb.height)}px tall`);
          if (bar.getAttribute('href') !== '/discount-codes/' || bar.querySelector('a, button')) codes.problems.push('not one link to /discount-codes/');
        }
        return { scrollsSideways, scrollWidth: document.documentElement.scrollWidth, vw, edge, small, clipped, codes, hasMain: !!document.querySelector('main') };
      }, { GUTTER, MIN_TAP });

      // Lessons L30: on a phone, the home page shows the search box and "Browse by category" on the first
      // screen. 620 px leaves room for the phone's own browser bars (address bar and bottom menu).
      if (vp.name === 'phone' && name === 'home') {
        const fold = await page.evaluate(() => {
          const b = sel => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().bottom + window.scrollY) : 99999; };
          return { search: b('.hero-search'), browse: b('.hero-actions .btn') };
        });
        check(fold.search <= FIRST_SCREEN && fold.browse <= FIRST_SCREEN, `${label}: search box and "Browse by category" on the first screen`, `search ends at ${fold.search}px, button at ${fold.browse}px (max ${FIRST_SCREEN})`);
      }
      check(m.codes.present === m.codes.footerCodes, `${label}: the discount codes bar shows exactly when the footer links to the codes (L115)`, `bar ${m.codes.present}, footer link ${m.codes.footerCodes}`);
      if (m.codes.present) check(m.codes.problems.length === 0, `${label}: the discount codes bar sits between the masthead row and the menu (L115)`, m.codes.problems.join(' | '));
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

  // Lessons L30 and L115: the first screen of the home page on a phone, in every language, in the worst case (the
  // country bar and the codes bar both showing). Only in the run without --lang (that run already has every language).
  if (!prefLang) {
    for (const vp of viewports.filter(v => v.isMobile)) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor,
        reducedMotion: 'reduce'
      });
      let added = { country: false, codes: false };
      await context.route(base + '/', async route => {
        const res = await route.fetch();
        const worst = worstCase(await res.text());
        added = worst.added;
        const headers = { ...res.headers() };
        delete headers['content-length'];
        await route.fulfill({ status: res.status(), headers, body: worst.html });
      });
      const page = await context.newPage();
      const numbers = [];
      for (const lang of LANGUAGES) {
        // The site script reads the language from the browser's storage; the key prefix is on <html data-store>.
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(l => { try { localStorage.setItem((document.documentElement.getAttribute('data-store') || 'gw') + '-lang', l); } catch (e) { /* ignore */ } }, lang);
        await page.goto(base + '/', { waitUntil: 'networkidle' });
        await page.waitForSelector('html[data-ready]', { timeout: 10000 }).catch(() => {});
        const fold = await page.evaluate(() => {
          const b = sel => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().bottom + window.scrollY) : 99999; };
          return {
            lang: document.documentElement.lang,
            bars: !!document.querySelector('.country-bar') && document.querySelectorAll('.codes-bar').length === 1 && document.body.hasAttribute('data-codes'),
            search: b('.hero-search'), browse: b('.hero-actions .btn'), sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
          };
        });
        const label = `${vp.name} / in ${lang}, with the country bar${added.country ? ' (added)' : ''} and the codes bar${added.codes ? ' (added)' : ''}`;
        check(fold.lang === lang, `${label}: page is in ${lang}`, fold.lang);
        check(fold.bars, `${label}: both bars on the page`);
        check(fold.search <= FIRST_SCREEN && fold.browse <= FIRST_SCREEN, `${label}: search box and "Browse by category" on the first screen (L30, L115)`, `search ends at ${fold.search}px, button at ${fold.browse}px (max ${FIRST_SCREEN})`);
        check(!fold.sideways, `${label}: no sideways scrolling`);
        numbers.push(`${lang} ${fold.browse}`);
        if (lang === 'el-GR' || lang === 'ru-RU') await page.screenshot({ path: join(shotsDir, `${vp.name}-home-first-screen-${lang}.png`) });
      }
      firstScreen.push(`${vp.name} (${vp.width} px), "Browse by category" ends at: ${numbers.join(', ')}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const failedChecks = results.filter(r => !r.ok);
const lines = [`Layout check | Base: ${base} | Checks: ${results.length} | Passed: ${results.length - failedChecks.length} | Failed: ${failedChecks.length}`, ''];
for (const r of failedChecks) lines.push(`FAIL ${r.name}${r.detail ? ' -> ' + r.detail : ''}`);
if (!failedChecks.length) lines.push('All layout checks passed.');
if (firstScreen.length) lines.push('', 'First screen of the home page, worst case (L30, L115):', ...firstScreen);
lines.push('', `Screenshots: ${shotsDir}`);
const report = lines.join('\n');
console.log(report);
if (outFile) writeFileSync(outFile, report + '\n');
process.exit(failedChecks.length ? 1 : 0);
