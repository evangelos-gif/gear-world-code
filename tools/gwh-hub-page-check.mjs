#!/usr/bin/env node
// Gear World Hub V2 ("Συνδυασμός") - page check. READ-ONLY, runs on a copy of the Hub files (sites/gwh/public).
// Opens the home page in a real browser (Chromium) on a small phone (320 px), a phone (390 px) and a desktop
// (1366 px), and checks what the owner asked for on 27/10/2026:
//   - the search is on the first screen of the phone, with the camera inside it and the big photo button
//   - nothing moves by itself: the season picture drops in once (ends within 3 s), and the slide stays the same
//     until an arrow is used; with "reduce motion" nothing moves at all
//   - the campaigns follow their dates (Black Friday only 27-30/11), the arrows go round
//   - the gift finder asks only the Gear Worlds of the idea and the chosen price (no new database cost)
//   - the deals come from hub-deals.json, keep their end date and link to a site page, never /go/ or /out/
//   - the phone dock never covers the cookie notice, the results or the camera, and is not on the desktop
//   - "Sell Your Business" is a quiet card at the bottom; buttons at least 44 px; no sideways scrolling
//   - the 11 languages, no JavaScript errors, no request for the old 2.8 MB picture (gwh-hero.png)
// The API answers are fixed test data (no live sites). Screenshots are saved.
//
// Usage: node tools/gwh-hub-page-check.mjs [--shots <dir>] [--out report.txt]
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const val = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const shotsDir = val('shots') || 'gwh-hub-shots';
const outFile = val('out');
mkdirSync(shotsDir, { recursive: true });
const publicDir = fileURLToPath(new URL('../sites/gwh/public/', import.meta.url));

// The texts of the page, read from the script itself.
const sandbox = { window: { addEventListener() {}, dispatchEvent() {} }, document: { readyState: 'loading', addEventListener() {} }, URLSearchParams, Intl };
vm.runInNewContext(readFileSync(join(publicDir, 'hub-v2.js'), 'utf8'), sandbox);
const HUB = sandbox.window.GearWorldHubV2;
const LOCALES = [...HUB.locales];
const text = (key, locale) => HUB.strings[key][LOCALES.indexOf(locale)];

const results = [];
const check = (ok, name, detail = '') => results.push({ ok: Boolean(ok), name, detail });

// ---------- a tiny static server for the Hub files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const asked = [];
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  asked.push(path);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(publicDir, path));
  if (!file.startsWith(publicDir) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// ---------- fixed test answers ----------
const product = (site, id, price, name) => ({
  id, product_id: id, site, site_name: site.toUpperCase(), site_url: `https://${site}.example.invalid`, product_name: name,
  brand: 'Test Brand', retailer: 'Test Shop', price, currency: 'GBP', image_url: '', product_url: `https://${site}.example.invalid/?search=x&highlight=${id}`
});
const searchAnswer = url => {
  const q = url.searchParams.get('q') || '';
  const worlds = (url.searchParams.get('worlds') || 'cgw,tgw,agw').split(',');
  const max = Number(url.searchParams.get('max_price') || 0);
  const items = worlds.flatMap((w, i) => [product(w, 100 + i * 10, 12.5, `${q} one`), product(w, 101 + i * 10, 39, `${q} two`), product(w, 102 + i * 10, 89, `${q} three`)])
    .filter(p => !max || p.price <= max);
  return { ok: true, query: q, count: items.length, sites: {}, results: items, partial: false, failed_sites: [] };
};

const viewports = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'small-phone', width: 320, height: 640, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1366, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

async function openPage(browser, vp, locale, { day = '2026-11-28', consent = 'denied' } = {}) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor });
  await context.addInitScript(([l, c]) => {
    try { localStorage.setItem('gwh-language', l); if (c) localStorage.setItem('gwh_analytics_consent', c); else localStorage.removeItem('gwh_analytics_consent'); } catch (_) { /* ignore */ }
  }, [locale, consent]);
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(`${day}T12:00:00Z`));
  const errors = [];
  const searches = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === '/api/search') { searches.push(url); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(searchAnswer(url)) }); }
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"ok":false}' });
    return route.continue();
  });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(300);
  return { context, page, errors, searches };
}

const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    for (const locale of LOCALES) {
      const full = vp.name !== 'small-phone' && (locale === 'en-GB' || locale === 'el-GR');
      if (vp.name === 'small-phone' && locale !== 'en-GB' && locale !== 'ru-RU') continue;
      const tag = `${vp.name} ${locale}`;
      const { context, page, errors, searches } = await openPage(browser, vp, locale);

      // texts in the chosen language
      const lead = await page.locator('.gwh2-lead').innerText();
      check(lead === text('lead', locale), `${tag}: the new texts are in the chosen language`, lead.slice(0, 60));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 1, `${tag}: no sideways scrolling`, `${overflow}px`);

      // the search on the first screen, the camera inside the field, the big photo button
      const field = await page.locator('.gwh2-field').boundingBox();
      check(field && field.y + field.height <= vp.height, `${tag}: the search box is on the first screen`, field ? `${Math.round(field.y)}-${Math.round(field.y + field.height)}px` : 'missing');
      const cam = await page.locator('.gw-photo-v1-button').boundingBox().catch(() => null);
      const camIn = await page.evaluate(() => !!document.querySelector('.gwh2-field .gw-photo-v1-button'));
      check(cam && camIn && cam.width >= 44 && cam.height >= 44, `${tag}: camera button inside the search box, at least 44 px`, cam ? `${Math.round(cam.width)}x${Math.round(cam.height)}` : 'missing');
      const big = await page.locator('#gwh2Photo').boundingBox().catch(() => null);
      check(big && big.height >= 44 && field && big.y + big.height <= vp.height + 80, `${tag}: big "photo" button next to the search`, big ? `${Math.round(big.width)}x${Math.round(big.height)} at ${Math.round(big.y)}px` : 'missing');

      // buttons at least 44 px (chips, arrows, nav, gift finder, dock)
      const small = await page.evaluate(() => [...document.querySelectorAll('main button, main .gwh2-btn, .main-nav a, .gwh2-chip, .footer-legal a, .gwh-business-link')]
        .filter(el => el.offsetParent !== null).map(el => ({ t: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30), h: el.getBoundingClientRect().height }))
        .filter(x => x.h < 43.5));
      check(small.length === 0, `${tag}: every button at least 44 px tall`, small.map(x => `${x.t}:${Math.round(x.h)}`).join(', '));

      // nothing moves by itself
      // The campaign picture drops in once; after 3 s nothing moves any more, and nothing repeats.
      const endless = await page.evaluate(() => document.getAnimations().filter(a => { const t = a.effect && a.effect.getComputedTiming(); return !t || t.iterations !== 1 || t.endTime > 3000; }).length);
      check(endless === 0, `${tag}: every animation plays once and ends within 3 s`, `${endless} endless or long`);
      await page.waitForTimeout(3000);
      const anims = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
      check(anims === 0, `${tag}: after 3 s nothing moves or blinks by itself`, `${anims} running animations`);
      if (full) {
        const before = await page.getAttribute('.gwh2-slide', 'data-campaign');
        await page.clock.runFor(8000);
        const after = await page.getAttribute('.gwh2-slide', 'data-campaign');
        check(before === after, `${tag}: the campaign slide stays the same without the arrows (8 s)`, `${before} -> ${after}`);
        const seen = [before];
        for (let i = 0; i < 2; i++) { await page.click('[data-gwh2-slide="1"]'); seen.push(await page.getAttribute('.gwh2-slide', 'data-campaign')); }
        check(seen.join(',') === 'black-friday,christmas,black-friday', `${tag}: the arrows go through the 2 campaigns of 28/11 and round`, seen.join(','));
        await page.click('[data-gwh2-slide="-1"]');
        check(await page.getAttribute('.gwh2-slide', 'data-campaign') === 'christmas', `${tag}: the back arrow works`);
      }

      // the 10 worlds, translated by translations.js
      const worlds = await page.$$eval('.gwh-image-world', els => els.map(e => ({ world: e.dataset.world, href: e.getAttribute('href'), title: e.querySelector('.gwh-image-world-title').textContent.trim() })));
      check(worlds.length === 10 && worlds.every(w => /^https:\/\/[a-z]+gearworld\.com\/$/.test(w.href)), `${tag}: 10 Gear World cards with their sites`, worlds.map(w => w.world).join(','));
      if (locale === 'el-GR') check(worlds[0].title === 'Εργαλεία & ρούχα εργασίας' || /[Α-Ωα-ω]/.test(worlds[0].title), `${tag}: world titles in Greek`, worlds[0].title);

      // deals: from hub-deals.json, to site pages only
      await page.locator('.gwh2-deal').first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
      const deals = await page.$$eval('.gwh2-deal', els => els.map(e => ({ href: e.getAttribute('href'), end: e.querySelector('.gwh2-deal-end').textContent })));
      check(deals.length >= 1 && deals.length <= 4, `${tag}: deals shown (at most 4)`, String(deals.length));
      check(deals.every(d => /^https:\/\/[a-z]+gearworld\.com\/discount-codes\/[a-z0-9-]+\/$/.test(d.href)), `${tag}: every deal links to a site page, never /go/ or /out/`, deals.map(d => d.href).join(' '));
      check(deals.every(d => d.end && d.end.length > 3), `${tag}: every deal shows its end date`, deals.map(d => d.end).join(' | '));
      const allLinks = await page.$$eval('a[href]', els => els.map(e => e.getAttribute('href')));
      check(!allLinks.some(h => /\/(go|out)\//.test(h)), `${tag}: no /go/ or /out/ link on the page`);

      // sponsored card: quiet and at the bottom
      const sponsor = await page.evaluate(() => {
        const card = document.querySelector('.gwh-business-banner');
        const email = document.getElementById('newsletter');
        const link = document.querySelector('.gwh-business-link');
        return { after: !!(card && email && (email.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING)), animation: link ? getComputedStyle(link).animationName : '' };
      });
      check(sponsor.after && (sponsor.animation === 'none' || sponsor.animation === ''), `${tag}: "Sell Your Business" is a quiet card after the sign-up`, JSON.stringify(sponsor));

      if (full) {
        // gift finder: Her, up to £25, perfume -> only WGW, max_price=25
        searches.length = 0;
        await page.click('[data-gwh2-who="1"]');
        await page.click('[data-gwh2-budget="0"]');
        await page.click('[data-gwh2-idea="1"]');
        await page.locator('#gwh2GiftResults .gwh-search-item').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        const last = searches[searches.length - 1];
        check(last && last.searchParams.get('q') === 'perfume' && last.searchParams.get('worlds') === 'wgw' && last.searchParams.get('max_price') === '25', `${tag}: gift finder asks only WGW, up to £25`, last ? last.search : 'no request');
        const gifts = await page.$$eval('#gwh2GiftResults .gwh-search-item', els => els.length);
        check(gifts === 1, `${tag}: gift ideas within the price`, `${gifts} shown`);
        await page.click('[data-gwh2-budget="3"]');
        await page.waitForTimeout(300);
        const any = searches[searches.length - 1];
        check(any && !any.searchParams.has('max_price'), `${tag}: "any price" sends no price`, any ? any.search : '');
        await page.locator('#gifts').screenshot({ path: join(shotsDir, `${vp.name}-${locale}-gifts.png`) });
      }

      // the phone dock
      if (vp.isMobile) {
        await page.evaluate(() => window.scrollTo(0, document.getElementById('worlds').offsetTop));
        await page.waitForTimeout(300);
        const dockOn = await page.locator('#gwh2Dock').isVisible();
        check(dockOn, `${tag}: the dock shows when the search is out of sight`);
        if (full) {
          await page.screenshot({ path: join(shotsDir, `${vp.name}-${locale}-dock.png`) });
          // the dock search button brings back the search box
          await page.click('#gwh2DockSearch');
          await page.waitForTimeout(900);
          const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
          check(focused === 'hubSearchInput', `${tag}: the dock button goes to the search box`, focused);
          check(!(await page.locator('#gwh2Dock').isVisible()), `${tag}: the dock hides while typing`);
          // open results: the dock stays hidden
          await page.fill('#hubSearchInput', 'drill');
          await page.press('#hubSearchInput', 'Enter');
          await page.locator('#hubSearchResults.is-open').waitFor({ timeout: 5000 }).catch(() => {});
          await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, document.getElementById('gifts').offsetTop); });
          await page.waitForTimeout(300);
          check(!(await page.locator('#gwh2Dock').isVisible()), `${tag}: the dock stays hidden while results are open`);
        }
      } else {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(300);
        check(!(await page.locator('#gwh2Dock').isVisible()), `${tag}: no dock on the desktop`);
      }

      if (full || vp.name === 'small-phone') {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: join(shotsDir, `${vp.name}-${locale}-top.png`) });
        await page.screenshot({ path: join(shotsDir, `${vp.name}-${locale}-full.png`), fullPage: true });
      }
      check(errors.length === 0, `${tag}: no JavaScript errors`, errors.join(' | ').slice(0, 300));
      await context.close();
    }
  }

  // The cookie notice (first visit): the dock never covers it.
  for (const vp of viewports.filter(v => v.isMobile)) {
    const { context, page, errors } = await openPage(browser, vp, 'en-GB', { consent: '' });
    const notice = await page.locator('#gwhAnalyticsConsent').isVisible();
    await page.evaluate(() => window.scrollTo(0, document.getElementById('worlds').offsetTop));
    await page.waitForTimeout(300);
    check(notice, `${vp.name}: the cookie notice shows on the first visit (test set-up)`);
    check(!(await page.locator('#gwh2Dock').isVisible()), `${vp.name}: the dock stays hidden while the cookie notice is open`);
    await page.screenshot({ path: join(shotsDir, `${vp.name}-cookie-notice.png`) });
    await page.click('#gwhAnalyticsReject');
    await page.waitForTimeout(300);
    check(await page.locator('#gwh2Dock').isVisible(), `${vp.name}: the dock comes back after the cookie answer`);
    check(errors.length === 0, `${vp.name} cookie notice: no JavaScript errors`, errors.join(' | ').slice(0, 300));
    await context.close();
  }

  // "Reduce motion" on the phone: the campaign picture is there, but nothing moves at all.
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
    await page.route('**/*', route => (new URL(route.request().url()).origin === base ? route.continue() : route.abort()));
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ art: !!document.querySelector('#gwh2Campaigns svg.gwh2-art'), running: document.getAnimations().filter(a => a.playState === 'running').length }));
    check(r.art && r.running === 0, 'reduce motion: the Halloween picture shows and nothing moves', JSON.stringify(r));
    await page.locator('#gwh2Campaigns').screenshot({ path: join(shotsDir, 'phone-halloween-reduce-motion.png') });
    await context.close();
  }

  // The campaigns follow their dates (UK days).
  const days = { '2026-10-28': 'halloween', '2026-11-20': 'black-friday-soon,christmas', '2026-11-30': 'black-friday,christmas', '2026-12-01': 'christmas', '2027-01-05': 'winter-sales,new-year-fitness', '2027-02-20': 'all-worlds' };
  for (const [day, want] of Object.entries(days)) {
    const { context, page } = await openPage(browser, viewports[0], 'en-GB', { day });
    const seen = [];
    const n = await page.locator('[data-gwh2-slide="1"]').count() ? want.split(',').length : 1;
    for (let i = 0; i < n; i++) {
      seen.push(await page.getAttribute('.gwh2-slide', 'data-campaign'));
      if (i < n - 1) await page.click('[data-gwh2-slide="1"]');
    }
    check(seen.join(',') === want, `campaigns on ${day}`, seen.join(','));
    const pic = await page.evaluate(() => { const a = document.querySelector('#gwh2Campaigns .gwh2-art'); return a ? a.tagName.toLowerCase() + (a.classList.contains('gwh2-mosaic') ? ':mosaic' : '') : ''; });
    check(want === 'all-worlds' ? pic === 'div:mosaic' : pic === 'svg', `campaigns on ${day}: ${want === 'all-worlds' ? 'the 10 worlds side by side' : 'a drawn picture of the season'}`, pic);
    await page.waitForTimeout(2500);
    await page.locator('#gwh2Campaigns').screenshot({ path: join(shotsDir, `campaign-${day}.png`) });
    await context.close();
  }
  // The seasonal banner at the top of the deals (video loop, or its still picture; text on top in HTML).
  for (const [day, want, vp, opts] of [
    ['2026-10-28', 'halloween', viewports[0], {}], ['2026-11-28', 'black-friday', viewports[2], {}], ['2026-12-10', 'christmas', viewports[0], {}],
    ['2026-11-10', '', viewports[0], {}], ['2026-10-28', 'halloween', viewports[0], { reducedMotion: 'reduce' }]
  ]) {
    const tag = `banner ${day} ${vp.name}${opts.reducedMotion ? ' reduce motion' : ''}`;
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: 1, ...opts });
    await context.addInitScript(() => { try { localStorage.setItem('gwh-language', 'en-GB'); localStorage.setItem('gwh_analytics_consent', 'denied'); } catch (_) { /* ignore */ } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message || e)));
    await page.clock.setFixedTime(new Date(`${day}T12:00:00Z`));
    await page.route('**/*', route => (new URL(route.request().url()).origin === base ? route.continue() : route.abort()));
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const b = document.getElementById('gwh2Season');
      return { shown: !!b && !b.hidden, season: b ? b.getAttribute('data-season') || '' : '', title: (b && b.querySelector('.gwh2-season-title') || {}).textContent || '',
        count: (b && b.querySelector('[data-gwh2-count]:not([hidden])') || {}).textContent || '', video: !!(b && b.querySelector('video')),
        deals: !document.getElementById('deals').hidden };
    });
    if (!want) {
      check(!info.shown, `${tag}: no banner outside the seasons`, JSON.stringify(info));
    } else {
      check(info.shown && info.season === want && info.title.length > 5, `${tag}: the ${want} banner with its title on top`, `${info.season} "${info.title}"`);
      if (want === 'black-friday') check(/^Ends in \d+ d \d+ h \d+ min$/.test(info.count), `${tag}: countdown to 30/11 23:59`, info.count);
      else check(!info.count, `${tag}: no countdown`);
      if (opts.reducedMotion) check(!info.video, `${tag}: only the still picture, no video`);
      else {
        await page.locator('#gwh2Season').scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
        const v = await page.evaluate(() => { const x = document.querySelector('#gwh2Season video'); const img = document.querySelector('#gwh2Season img'); return { video: !!x, muted: !!x && x.muted, loop: !!x && x.loop, inline: !!x && x.playsInline, preload: x ? x.getAttribute('preload') : '', poster: x ? x.getAttribute('poster') : '', src: x ? (x.querySelector('source') || {}).src || '' : '', still: !!img && !img.hidden, pause: !!document.querySelector('#gwh2Season .gwh2-season-pause:not([hidden])') }; });
        // The test browser may not play H.264: then the still picture must stay (and that is all right).
        check((v.video && v.muted && v.loop && v.inline && v.preload === 'none' && /\/seasonal\/[a-z-]+\.jpg\?v=/.test(v.poster) && /\/seasonal\/[a-z-]+\.mp4\?v=/.test(v.src)) || (!v.video && v.still), `${tag}: muted looping video after the page loaded (or the still picture)`, JSON.stringify(v));
        if (v.video && v.pause) {
          const box = await page.locator('#gwh2Season .gwh2-season-pause').boundingBox();
          check(box && box.width >= 44 && box.height >= 44, `${tag}: Pause button at least 44 px`);
          await page.click('#gwh2Season .gwh2-season-pause');
          check(await page.evaluate(() => document.querySelector('#gwh2Season video').paused), `${tag}: Pause stops the video`);
        }
      }
      await page.locator('#gwh2Season').screenshot({ path: join(shotsDir, `banner-${want}-${vp.name}${opts.reducedMotion ? '-still' : ''}.png`) });
    }
    check(errors.length === 0, `${tag}: no JavaScript errors`, errors.join(' | ').slice(0, 300));
    await context.close();
  }
  check(!asked.some(p => p.includes('gwh-hero.png')), 'the old 2.8 MB picture (gwh-hero.png) is never loaded');
  check(!asked.some(p => p === '/styles.css'), 'the old styles.css is not loaded by the new page');
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(r => !r.ok);
const lines = [`GWH Hub V2 page check - ${new Date().toISOString()}`, `${results.length - failed.length} passed, ${failed.length} failed`, ''];
for (const r of results) lines.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
const report = lines.join('\n') + '\n';
if (outFile) writeFileSync(outFile, report);
console.log(report);
process.exit(failed.length ? 1 : 0);
