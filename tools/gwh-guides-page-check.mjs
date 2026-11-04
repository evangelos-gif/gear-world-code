#!/usr/bin/env node
// Gear World Hub gift guides - page check. READ-ONLY, runs on a copy of the Hub files (sites/gwh/public).
// Opens /guides/ and the 5 guide pages in a real browser (Chromium) on a small phone (320 px), a phone (390 px) and a
// desktop (1366 px), and checks (lessons L21, L35):
//   - no sideways scrolling; texts and buttons at least 12 px from the edge of the screen
//   - the "See it on ..." buttons and the guide links under the gift finder are at least 44 px high
//   - "Price checked <date>, may change" is on the first screen of the phone
//   - no JavaScript errors on the guide pages
// Nothing outside this computer is opened (product photos and analytics are blocked), and nothing changes anywhere.
// Usage: node tools/gwh-guides-page-check.mjs [--shots <dir>] [--out report.txt]
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { loadData, dateLabel } from './gwh-guides.mjs';

const args = process.argv.slice(2);
const val = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const shotsDir = val('shots') || 'gwh-guides-shots';
const outFile = val('out');
mkdirSync(shotsDir, { recursive: true });
const publicDir = fileURLToPath(new URL('../sites/gwh/public/', import.meta.url));
const data = loadData();
const checked = `Price checked ${dateLabel(data.checked)}, may change.`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true,"products":[],"results":[],"sites":{}}'); return; }
  let file = normalize(join(publicDir, decodeURIComponent(url.pathname)));
  if (!file.startsWith(publicDir)) { res.writeHead(403); res.end(); return; }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (ok, name, detail = '') => results.push({ ok: Boolean(ok), name, detail });
const VIEWS = [
  { name: 'small-phone', width: 320, height: 640, isMobile: true, hasTouch: true },
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1366, height: 900, isMobile: false, hasTouch: false }
];
const PATHS = ['/guides/', ...data.guides.map(g => `/guides/${g.slug}/`)];

const browser = await chromium.launch();
try {
  for (const view of VIEWS) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, isMobile: view.isMobile, hasTouch: view.hasTouch });
    await context.route('**/*', route => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
    for (const path of PATHS) {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base + path, { waitUntil: 'load' });
      const m = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const edge = [];
        for (const el of document.querySelectorAll('main h1, main h2, main h3, main p, .gd-btn, .gd-img')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < 12 || r.right > W - 12) edge.push(`${el.tagName.toLowerCase()}.${el.className || ''} ${Math.round(r.left)}-${Math.round(r.right)}`);
        }
        const small = [...document.querySelectorAll('.gd-btn')].filter(b => b.getBoundingClientRect().height < 44).length;
        const checkedEl = document.querySelector('.gd-checked');
        return {
          sideways: document.documentElement.scrollWidth > W,
          edge: edge.slice(0, 5), small,
          checkedText: checkedEl ? checkedEl.textContent : '',
          checkedTop: checkedEl ? checkedEl.getBoundingClientRect().top : 99999,
          buttons: document.querySelectorAll('.gd-btn').length
        };
      });
      const tag = `${view.name} ${path}`;
      check(!m.sideways, `${tag}: no sideways scrolling`);
      check(m.edge.length === 0, `${tag}: texts and buttons at least 12 px from the edge`, m.edge.join('; '));
      check(m.buttons > 0 && m.small === 0, `${tag}: buttons at least 44 px high`, `${m.small} smaller of ${m.buttons}`);
      check(m.checkedText.includes(checked), `${tag}: "${checked}" is on the page`);
      if (view.width < 500) check(m.checkedTop < view.height, `${tag}: the price-checked line is on the first screen`, `top ${Math.round(m.checkedTop)}`);
      check(errors.length === 0, `${tag}: no JavaScript errors`, errors.join(' | '));
      const shot = `${view.name}${path.replace(/\//g, '_')}.png`.replace(/_+\.png$/, '.png');
      await page.screenshot({ path: join(shotsDir, shot), fullPage: true });
      await page.close();
    }
    // The links under the gift finder on the Hub home page (the rest of the home page has its own check).
    const home = await context.newPage();
    await home.goto(base + '/', { waitUntil: 'load' });
    const links = await home.evaluate(() => {
      const W = document.documentElement.clientWidth;
      return [...document.querySelectorAll('.gwh2-guides a')].map(a => { const r = a.getBoundingClientRect(); return { href: a.getAttribute('href'), h: r.height, left: r.left, right: r.right, W }; });
    });
    check(links.length === data.guides.length, `${view.name} home: ${data.guides.length} guide links under the gift finder`, String(links.length));
    check(links.every(l => l.h >= 44), `${view.name} home: guide links at least 44 px high`, links.map(l => Math.round(l.h)).join(','));
    check(links.every(l => l.left >= 12 && l.right <= l.W - 12), `${view.name} home: guide links at least 12 px from the edge`);
    await home.locator('.gwh2-guides').first().scrollIntoViewIfNeeded().catch(() => {});
    await home.screenshot({ path: join(shotsDir, `${view.name}_home-guides.png`) });
    await home.close();
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

const bad = results.filter(r => !r.ok);
const report = [`Gear World Hub gift guides - page check (${results.length} checks, ${bad.length} failed)`,
  ...results.map(r => `${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ` (${r.detail})` : ''}`)].join('\n') + '\n';
if (outFile) writeFileSync(outFile, report);
process.stdout.write(report);
process.exitCode = bad.length ? 1 : 0;
