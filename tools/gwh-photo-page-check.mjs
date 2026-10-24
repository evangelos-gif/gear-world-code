#!/usr/bin/env node
// Gear World Hub - photo search page check. READ-ONLY, runs on a copy of the Hub files (sites/gwh/public).
// Opens the Hub home page in a real browser (Chromium) on a phone (390 px) and a desktop (1366 px), in all
// 11 languages of the Hub, and checks the camera button (lessons L21, L24, L27, L35):
//   - the button is there, next to the search box, at least 40 px, not touching the screen edge
//   - the button label and the privacy note are in the chosen language
//   - a big photo is made smaller in the browser (max 1024 px, max 1 MB JPEG) before it is sent
//   - the results are grouped by Gear World site, the best match first, the words in the search box
//   - the friendly limit message, no sideways scrolling, no JavaScript errors
// The API answers are fixed test data (no Workers AI, no live sites). Screenshots are saved.
//
// Usage: node tools/gwh-photo-page-check.mjs [--shots <dir>] [--out report.txt]
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const val = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const shotsDir = val('shots') || 'gwh-photo-shots';
const outFile = val('out');
mkdirSync(shotsDir, { recursive: true });
const publicDir = fileURLToPath(new URL('../sites/gwh/public/', import.meta.url));

// The texts the page must show, read from the script itself.
const sandbox = { window: { addEventListener() {}, dispatchEvent() {} }, document: { readyState: 'loading', addEventListener() {}, documentElement: { lang: 'en-GB' } } };
vm.runInNewContext(readFileSync(join(publicDir, 'gear-world-camera.js'), 'utf8'), sandbox);
const { locales: LOCALES, strings: S } = JSON.parse(JSON.stringify(sandbox.window.GearWorldPhotoSearch));
const text = (key, locale) => S[key][LOCALES.indexOf(locale)];

const results = [];
const check = (ok, name, detail = '') => results.push({ ok: Boolean(ok), name, detail });

// ---------- a tiny static server for the Hub files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(publicDir, path));
  if (!file.startsWith(publicDir) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// ---------- fixed test answers ----------
const PHOTO_ANSWER = {
  ok: true, found: true, product: 'cordless drill', query: 'cordless drill',
  keywords: ['drill', 'cordless', 'power', 'tool'], brand: 'Makita',
  world: { key: 'CGW', name: 'Construction Gear World', domain: 'constructiongearworld.com' }
};
const product = (site, name, id, price) => ({
  id, product_id: id, site, site_name: name, site_url: `https://${{ cgw: 'constructiongearworld.com', agw: 'cargearworld.com', ggw: 'gardengearworld.com' }[site]}`,
  product_name: `Test product ${id} with a fairly long name that must wrap on a phone screen`, brand: 'Makita', retailer: 'Tooled Up',
  price, currency: 'GBP', image_url: '', product_url: `https://example.invalid/?search=cordless%20drill&highlight=${id}`
});
// Car first in the list on purpose: the page must still put the best match (Construction) first.
const SEARCH_ANSWER = {
  ok: true, query: 'cordless drill', count: 4, partial: false, failed_sites: [],
  sites: { agw: 2, cgw: 1, ggw: 1 },
  results: [product('agw', 'Car Gear World', 11, 19.99), product('agw', 'Car Gear World', 12, 29), product('cgw', 'Construction Gear World', 21, 129.5), product('ggw', 'Garden Gear World', 31, 49)]
};

const viewports = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1366, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

// A picture of the search area only: the search box, the camera button, the note and the results under it.
async function shootSearch(page, path, width) {
  const area = await page.evaluate(() => {
    const els = ['#hubSearch', '#hubSearchResults', '.gwh-photo-note', '#searchMessage'].map(s => document.querySelector(s)).filter(Boolean);
    const rects = els.map(e => e.getBoundingClientRect()).filter(r => r.height > 0);
    const top = Math.min(...rects.map(r => r.top)) + window.scrollY;
    const bottom = Math.max(...rects.map(r => r.bottom)) + window.scrollY;
    return { top, bottom };
  });
  const y = Math.max(0, Math.floor(area.top - 60));
  await page.screenshot({ path, fullPage: true, clip: { x: 0, y, width, height: Math.min(1400, Math.ceil(area.bottom + 30 - y)) } });
}

const browser = await chromium.launch();
let photoBody = null;
try {
  // A real JPEG made by the browser: a big one (3000 x 2000) to check the shrinking.
  const maker = await browser.newPage();
  const bigJpeg = Buffer.from((await maker.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 3000; c.height = 2000;
    const x = c.getContext('2d');
    for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${(i * 37) % 360} 70% 50%)`; x.fillRect((i * 97) % 3000, (i * 53) % 2000, 180, 120); }
    return c.toDataURL('image/jpeg', 0.95);
  })).split(',')[1], 'base64');
  await maker.close();
  check(bigJpeg.length > 0, 'test photo made', `${bigJpeg.length} bytes`);

  for (const vp of viewports) {
    for (const locale of LOCALES) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
      await context.addInitScript(([l]) => {
        try { localStorage.setItem('gwh-language', l); localStorage.setItem('gwh_analytics_consent', 'denied'); } catch (_) { /* ignore */ }
      }, [locale]);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e.message || e)));
      let limitMode = false;
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin !== base) return route.abort();
        if (url.pathname === '/api/photo-search') {
          if (vp.name === 'phone' && locale === 'en-GB') photoBody = { body: route.request().postDataBuffer(), type: route.request().headers()['content-type'] };
          if (limitMode) return route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'limit_hour', retry_after: 600 }) });
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PHOTO_ANSWER) });
        }
        if (url.pathname === '/api/search') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SEARCH_ANSWER) });
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' });
        return route.continue();
      });
      const tag = `${vp.name} ${locale}`;
      await page.goto(base + '/', { waitUntil: 'load' });
      const formTop = await page.evaluate(() => { const f = document.getElementById('hubSearch'); return f ? Math.round(f.getBoundingClientRect().top + window.scrollY) : -1; });
      if (locale === 'en-GB') check(formTop >= 0, `${vp.name}: where the Hub search starts (information, lesson L30)`, `${formTop}px from the top`);
      const button = page.locator('.gw-photo-v1-button');
      await button.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
      const box = await button.boundingBox();
      check(box, `${tag}: camera button visible`);
      if (box) {
        check(box.width >= 40 && box.height >= 40, `${tag}: camera button at least 40 px`, `${Math.round(box.width)}x${Math.round(box.height)}`);
        check(box.x >= 12 && box.x + box.width <= vp.width - 12, `${tag}: camera button not touching the edge`, `x=${Math.round(box.x)}`);
      }
      const inForm = await page.evaluate(() => {
        const b = document.querySelector('.gw-photo-v1-button');
        const voice = document.querySelector('.gw-voice-v2-wrap');
        return { inForm: !!b && !!b.closest('#hubSearch'), afterVoice: !voice || !!(voice.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) };
      });
      check(inForm.inForm && inForm.afterVoice, `${tag}: camera button inside the search, after the microphone`);
      check(await button.getAttribute('aria-label') === text('button', locale), `${tag}: button label in the chosen language`);
      const note = await page.locator('.gwh-photo-note').innerText().catch(() => '');
      check(note.includes(text('note', locale)), `${tag}: privacy note in the chosen language`, note.slice(0, 80));
      if (vp.hasTouch) check(note.includes(text('gallery', locale)), `${tag}: "choose from gallery" on the phone`);
      else check(!(await page.locator('.gwh-photo-gallery').count()), `${tag}: no gallery link on the desktop`);

      // A photo: on the phone the camera input, on the desktop the file picker.
      const inputSel = vp.hasTouch ? 'input.gw-photo-v1-input[capture]' : 'input.gw-photo-v1-input:not([capture])';
      await page.setInputFiles(inputSel, { name: 'drill.jpg', mimeType: 'image/jpeg', buffer: bigJpeg });
      await page.locator('.gwh-photo-group').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      const groups = await page.$$eval('.gwh-photo-group', els => els.map(e => ({ site: e.dataset.site, best: e.classList.contains('is-best'), badge: (e.querySelector('.gwh-photo-badge') || {}).textContent || '', items: e.querySelectorAll('.gwh-search-item').length })));
      check(groups.length === 3, `${tag}: results grouped by site`, JSON.stringify(groups.map(g => g.site)));
      check(groups[0] && groups[0].site === 'cgw' && groups[0].best && groups[0].badge === text('best', locale), `${tag}: best match first, said in words`);
      check(groups[1] && groups[1].site === 'agw' && groups[1].items === 2, `${tag}: then the site with the most results`);
      check(await page.inputValue('#hubSearchInput') === 'cordless drill', `${tag}: the words are in the search box`);
      const summary = await page.locator('.gwh-photo-summary').innerText().catch(() => '');
      check(summary.includes(text('found', locale).replace('{words}', 'drill · cordless · power · tool')) && summary.includes(text('editHint', locale)), `${tag}: words found and how to change them`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 1, `${tag}: no sideways scrolling`, `${overflow}px`);
      // The screenshot shows the search with the camera button and the results (the search is lower on the page).
      await shootSearch(page, join(shotsDir, `${vp.name}-${locale}.png`), vp.width);

      // The friendly limit message.
      if (locale === 'en-GB' || locale === 'el-GR') {
        limitMode = true;
        await page.setInputFiles(inputSel, { name: 'drill.jpg', mimeType: 'image/jpeg', buffer: bigJpeg });
        await page.waitForFunction(t => (document.getElementById('searchMessage') || {}).textContent === t, text('limitHour', locale), { timeout: 10000 }).catch(() => {});
        check(await page.locator('#searchMessage').innerText() === text('limitHour', locale), `${tag}: friendly message when the hourly limit is reached`);
        await shootSearch(page, join(shotsDir, `${vp.name}-${locale}-limit.png`), vp.width);
      }
      check(errors.length === 0, `${tag}: no JavaScript errors`, errors.join(' | ').slice(0, 300));
      await context.close();
    }
  }

  // The photo that was sent: JPEG, at most 1 MB and 1024 px.
  check(photoBody && photoBody.type === 'image/jpeg', 'photo sent as image/jpeg');
  if (photoBody && photoBody.body) {
    const b = photoBody.body;
    let w = 0, h = 0;
    for (let i = 2; i < b.length - 9;) {
      if (b[i] !== 0xff) break;
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; }
      i += 2 + len;
    }
    check(b.length <= 1024 * 1024, 'photo made smaller in the browser: at most 1 MB', `${b.length} bytes`);
    check(Math.max(w, h) === 1024 && Math.min(w, h) > 0, 'photo made smaller in the browser: 1024 px long side', `${w}x${h}`);
    check(!b.includes(Buffer.from('Exif')), 'photo sent without hidden details (no EXIF)');
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(r => !r.ok);
const lines = [`GWH photo search page check - ${new Date().toISOString()}`, `${results.length - failed.length} passed, ${failed.length} failed`, ''];
for (const r of results) lines.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
const report = lines.join('\n') + '\n';
if (outFile) writeFileSync(outFile, report);
console.log(report);
process.exit(failed.length ? 1 : 0);
