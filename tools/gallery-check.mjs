#!/usr/bin/env node
// Gear World photo gallery check (lessons L206). READ-ONLY: opens a product page that has extra photos in a real browser
// (Chromium), on a phone (390 px, touch) and a desktop (1366 px), and checks what the HTML tests cannot see:
//   - the extra photos are not fetched with the page: no request for them until the visitor swipes, clicks or tabs in
//   - the gallery box keeps its size before and after the script, and while it moves (no layout shift)
//   - the arrows (44 px) and the dots work, with the mouse, the keyboard and a swipe; the page never scrolls sideways
//   - a photo that does not load is taken out (and the rest numbered again); the photos that load are shown
//   - no JavaScript error
// The photos of the test data are at https://images.example/ (never on the internet): this check answers them itself,
// a 1x1 PNG for "...-ok-..." and a network error for "...-fail-...", so the page is tested without any outside site.
//
// Usage: node tools/gallery-check.mjs <baseUrl> [--path /product/<slug>-<id>/] [--shots <dir>] [--out report.txt]
//   Without --path it takes the first product of /api/products?images=1 that has extra photos.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const base = (args.find(a => /^https?:\/\//.test(a)) || 'http://127.0.0.1:8787').replace(/\/$/, '');
const val = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const shotsDir = val('shots') || 'gallery-shots';
const outFile = val('out');
mkdirSync(shotsDir, { recursive: true });
const PHOTO_HOST = 'https://images.example/';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const results = [];
const check = (ok, name, detail = '') => results.push({ ok: Boolean(ok), name, detail });

async function findPath() {
  if (val('path')) return val('path');
  const d = await (await fetch(`${base}/api/products?limit=60&images=1`)).json();
  const p = (d.products || []).find(x => Array.isArray(x.images) && x.images.length >= 2);
  return p ? new URL(p.product_url).pathname : '';
}

const viewports = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1366, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

const path = await findPath().catch(() => '');
check(path, 'a product with at least 2 extra photos (/api/products?images=1)', path || 'none found');
const browser = await chromium.launch();
try {
  for (const vp of path ? viewports : []) {
    const label = `${vp.name} ${path}`;
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const photoRequests = [];
    const errors = [];
    await page.route(`${PHOTO_HOST}**`, route => {
      photoRequests.push(route.request().url());
      return /-fail-/.test(route.request().url()) ? route.abort('failed') : route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    });
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    page.on('console', m => {
      // The photo that is made to fail logs its own failed request: expected.
      if (m.type() === 'error' && !(m.text().startsWith('Failed to load resource') && (m.location().url || '').startsWith(PHOTO_HOST))) errors.push(m.text());
    });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-gallery][data-ready]', { timeout: 10000 }).catch(() => {});
    const state = () => page.evaluate(() => {
      const box = document.querySelector('[data-gallery]');
      const track = box && box.querySelector('[data-gallery-track]');
      const r = box ? box.getBoundingClientRect() : { width: 0, height: 0 };
      const visible = el => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).display !== 'none' && !el.hidden; };
      const slides = track ? [...track.querySelectorAll('.gallery-slide')] : [];
      const cur = track ? Math.round(track.scrollLeft / (track.clientWidth || 1)) : -1;
      const img = slides[cur] && slides[cur].querySelector('img');
      const arrow = box && box.querySelector('[data-gallery-next]');
      const ab = arrow ? arrow.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        ready: !!(box && box.hasAttribute('data-ready')), width: Math.round(r.width), height: Math.round(r.height),
        slides: slides.length, dots: box ? box.querySelectorAll('[data-gallery-dots] a').length : 0, current: cur,
        currentDot: box ? [...box.querySelectorAll('[data-gallery-dots] a')].findIndex(a => a.getAttribute('aria-current') === 'true') : -1,
        arrows: visible(arrow) && visible(box.querySelector('[data-gallery-prev]')), arrowSize: [Math.round(ab.width), Math.round(ab.height)],
        dotsShown: visible(box && box.querySelector('[data-gallery-dots]')),
        currentLoaded: !!(img && img.complete && img.naturalWidth > 0 && !/^data:/.test(img.currentSrc || img.src)),
        waiting: track ? track.querySelectorAll('img[data-src]').length : 0,
        alts: slides.map(s => (s.querySelector('img') || {}).alt || ''),
        sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
      };
    });
    const s0 = await state();
    check(s0.ready, `${label}: the gallery is ready (site script)`);
    check(s0.slides >= 3 && s0.dots === s0.slides && s0.arrows && s0.dotsShown, `${label}: main photo and the extra ones, with arrows and dots`, JSON.stringify(s0));
    check(photoRequests.length === 0 && s0.waiting === s0.slides - 1, `${label}: no extra photo fetched with the page`, photoRequests.join(' | '));
    check(s0.arrowSize[0] >= 44 && s0.arrowSize[1] >= 44, `${label}: arrows at least 44 px`, s0.arrowSize.join('x'));
    check(!s0.sideways, `${label}: no sideways page scrolling`);
    const ratio = s0.height / (s0.width || 1);
    check(Math.abs(ratio - (vp.width >= 900 ? 1 : 0.75)) < 0.02 || Math.abs(ratio - 0.75) < 0.02, `${label}: the box has the photo's fixed shape`, `${s0.width}x${s0.height}`);
    await page.screenshot({ path: join(shotsDir, `${vp.name}-gallery-1.png`) });

    // Next (mouse or tap): the other photos are fetched now, the failing one goes, the second photo shows.
    await page.click('[data-gallery-next]');
    await page.waitForTimeout(400);
    await page.waitForLoadState('networkidle');
    const s1 = await state();
    const failed = photoRequests.filter(u => /-fail-/.test(u)).length;
    check(photoRequests.length >= 2 && s1.waiting === 0, `${label}: after a click the extra photos are fetched`, `${photoRequests.length} requests`);
    check(failed === 0 || (s1.slides === s0.slides - failed && s1.dots === s1.slides), `${label}: a photo that does not load is taken out`, `${s0.slides} -> ${s1.slides} slides, ${failed} failed`);
    check(s1.alts.slice(1).every((a, i) => a.endsWith(` – photo ${i + 2} of ${s1.slides}`)), `${label}: the photos are numbered again`, s1.alts.join(' | '));
    check(s1.current === 1 && s1.currentDot === 1 && s1.currentLoaded, `${label}: the second photo shows (and its dot)`, JSON.stringify({ current: s1.current, dot: s1.currentDot, loaded: s1.currentLoaded }));
    check(s1.height === s0.height && s1.width === s0.width, `${label}: no layout shift`, `${s0.width}x${s0.height} -> ${s1.width}x${s1.height}`);
    await page.screenshot({ path: join(shotsDir, `${vp.name}-gallery-2.png`) });

    // A dot, then the keyboard, then a swipe (the track scrolled like a finger does).
    await page.click('[data-gallery-dots] a[data-gallery-dot="0"]');
    await page.waitForTimeout(300);
    const s2 = await state();
    check(s2.current === 0 && s2.currentDot === 0, `${label}: a dot shows its photo`);
    await page.focus('[data-gallery-next]');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
    const s3 = await state();
    check(s3.current === 1, `${label}: the arrow keys move the gallery`, String(s3.current));
    await page.evaluate(() => { const t = document.querySelector('[data-gallery-track]'); t.scrollTo({ left: 0, behavior: 'auto' }); });
    await page.waitForTimeout(300);
    const s4 = await state();
    check(s4.current === 0 && s4.currentDot === 0, `${label}: a swipe moves the dots too`);
    check(!s4.sideways && s4.height === s0.height, `${label}: still no sideways scrolling, same box`);
    check(errors.length === 0, `${label}: no JavaScript errors`, errors.slice(0, 3).join(' | '));
    await context.close();
  }

  // A visitor who swipes first (phone): the first scroll of the track fetches the photos.
  if (path) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const photoRequests = [];
    await page.route(`${PHOTO_HOST}**`, route => { photoRequests.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'image/png', body: PNG }); });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-gallery][data-ready]', { timeout: 10000 }).catch(() => {});
    const before = photoRequests.length;
    await page.evaluate(() => { const t = document.querySelector('[data-gallery-track]'); t.scrollTo({ left: t.clientWidth, behavior: 'auto' }); });
    await page.waitForTimeout(400);
    await page.waitForLoadState('networkidle');
    check(before === 0 && photoRequests.length >= 1, 'phone swipe: nothing before the swipe, the photos right after it', `${before} -> ${photoRequests.length}`);
    await context.close();
  }
} finally {
  await browser.close();
}

const bad = results.filter(r => !r.ok);
const lines = [`Gallery check (lessons L206) ${base}${path || ''}: ${results.length - bad.length} OK, ${bad.length} PROBLEM`];
for (const r of results) lines.push(`${r.ok ? 'OK     ' : 'PROBLEM'}  ${r.name}${r.detail && !r.ok ? `  (${r.detail})` : ''}`);
const text = lines.join('\n') + '\n';
if (outFile) writeFileSync(outFile, text);
console.log(text);
process.exit(bad.length ? 1 : 0);
