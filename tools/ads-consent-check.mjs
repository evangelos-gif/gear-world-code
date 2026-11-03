#!/usr/bin/env node
// Google Ads cookie banner check in a real browser (lessons L93). READ-ONLY: runs against a local Worker.
// The browser asks for https://<site domain>/..., which this check answers from the local Worker, so the page runs
// as on the real domain. Nothing reaches Google: the Google tag address is answered here with an empty script.
//   1. First visit: the banner shows; no request to Google; the /out/ links carry utm_source / utm_campaign;
//      nothing about the campaign is stored in the browser.
//   2. "Reject": no request to Google, the choice is kept, the banner stays closed on the next page.
//   3. "Allow": the Google tag is asked for exactly once; consent "granted" for ads, never for ad personalisation;
//      the campaign is kept for the tab and reaches the /out/ links of the next page; a click on "View at" sends
//      the conversion (here with a test label); "Cookie settings" opens the banner again.
//   4. "Reject" after "Allow": the Google cookies of the site are removed and the page starts again without Google.
//   5. No JavaScript error and no Content-Security-Policy error.
// Usage: node tools/ads-consent-check.mjs http://127.0.0.1:8787 --site sites/tgw [--out report.txt]
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const local = (args.find(a => /^https?:\/\//.test(a)) || 'http://127.0.0.1:8787').replace(/\/$/, '');
const val = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ''; };
const site = (await import(pathToFileURL(resolve(val('site') || 'sites/tgw', 'site.config.js')).href)).default;
const origin = `https://${site.domain}`;
const store = site.storagePrefix || site.code.toLowerCase();
const LABEL = 'TestLabel_123';

const results = [];
const check = (ok, name, detail = '') => results.push({ ok: Boolean(ok), name, detail });

async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const google = [];
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text()); });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (/google|doubleclick/.test(url.hostname)) {
      google.push(url.toString());
      if (url.hostname === 'www.googletagmanager.com') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '/* test */' });
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.origin !== origin) return route.abort();
    // A click on "View at" opens a new tab: answer it here, nothing goes to Awin or a retailer.
    if (/^\/(out|go)\//.test(url.pathname)) return route.fulfill({ status: 200, contentType: 'text/plain', body: 'retailer' });
    const r = await fetch(local + url.pathname + url.search, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' }, redirect: 'manual' });
    const headers = {};
    r.headers.forEach((v, k) => { if (!/^(content-encoding|content-length|transfer-encoding)$/i.test(k)) headers[k] = v; });
    let body = Buffer.from(await r.arrayBuffer());
    if (/text\/html/.test(r.headers.get('content-type') || '')) body = Buffer.from(body.toString('utf8').replace(/data-label=""/, `data-label="${LABEL}"`));
    return route.fulfill({ status: r.status, headers, body });
  });
  return { context, page, google, errors };
}

const visible = (page, sel) => page.locator(sel).first().isVisible();
const outHrefs = page => page.$$eval('a[href^="/out/"]', as => as.map(a => a.getAttribute('href')));
const layer = page => page.evaluate(() => JSON.parse(JSON.stringify((window.dataLayer || []).map(a => Array.from(a)))));

// a category page of the site (with "View at" buttons)
const catPath = `/category/${(site.categories[0] || {}).slug || ''}/`;

const browser = await chromium.launch();
try {
  // 1 + 2: first visit, then Reject
  {
    const { context, page, google, errors } = await newPage(browser);
    await page.goto(`${origin}/?utm_source=google&utm_campaign=bf-2026`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    check(await visible(page, '[data-consent]'), 'first visit: the banner shows');
    check(google.length === 0, 'first visit: no request to Google before a choice', google.join(' '));
    const dl = await layer(page);
    check(dl.length > 0 && dl[0][0] === 'consent' && dl[0][1] === 'default' && dl[0][2].ad_storage === 'denied' && dl[0][2].ad_user_data === 'denied' && dl[0][2].ad_personalization === 'denied', 'consent mode v2: everything "denied" by default', JSON.stringify(dl[0] || null));
    const hrefs = await outHrefs(page);
    check(hrefs.length > 0 && hrefs.every(h => /utm_source=google/.test(h) && /utm_campaign=bf-2026/.test(h)), 'the /out/ links carry the campaign of the visit', hrefs.slice(0, 2).join(' '));
    const stored = await page.evaluate(k => { try { return sessionStorage.getItem(k); } catch (e) { return 'error'; } }, `${store}-utm`);
    check(stored === null, 'without a choice the campaign is not stored in the browser', String(stored));
    check(await visible(page, '[data-consent-open]'), '"Cookie settings" shows in the footer');
    await page.click('[data-consent-choice="denied"]');
    await page.waitForTimeout(200);
    check(!(await visible(page, '[data-consent]')), '"Reject" closes the banner');
    const saved = await page.evaluate(k => localStorage.getItem(k), `${store}-cookie-consent`);
    check(saved === 'denied', '"Reject" is remembered', String(saved));
    await page.goto(`${origin}${catPath}`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    check(!(await visible(page, '[data-consent]')), 'after "Reject" the banner stays closed on the next page');
    const view = page.locator('a[href^="/out/"]').first();
    if (await view.count()) {
      const [tab] = await Promise.all([context.waitForEvent('page'), view.click()]);
      await tab.close();
    }
    await page.waitForTimeout(200);
    check(google.length === 0, 'after "Reject": still no request to Google, also not on a "View at" click', google.join(' '));
    check(errors.length === 0, 'Reject: no JavaScript or CSP errors', errors.join(' | ').slice(0, 300));
    await context.close();
  }

  // 3 + 4: Allow, next page, View at, Cookie settings, then Reject
  {
    const { context, page, google, errors } = await newPage(browser);
    await page.goto(`${origin}/?utm_source=google&utm_campaign=bf-2026`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.click('[data-consent-choice="granted"]');
    await page.waitForTimeout(300);
    const tags = google.filter(u => u.startsWith('https://www.googletagmanager.com/gtag/js?id=AW-18554591090'));
    check(tags.length === 1, '"Allow": the Google tag is asked for exactly once', google.join(' '));
    const dl = await layer(page);
    const update = dl.find(a => a[0] === 'consent' && a[1] === 'update');
    check(update && update[2].ad_storage === 'granted' && update[2].ad_user_data === 'granted' && update[2].ad_personalization === 'denied', '"Allow": ads measurement granted, ad personalisation (remarketing) still denied', JSON.stringify(update || null));
    const config = dl.find(a => a[0] === 'config');
    check(config && config[1] === 'AW-18554591090' && config[2].allow_ad_personalization_signals === false && config[2].linker.domains.includes('gearworldhub.com'), 'the tag is set up for AW-18554591090, no personalisation, linker with the Hub', JSON.stringify(config || null));
    const stored = await page.evaluate(k => sessionStorage.getItem(k), `${store}-utm`);
    check(/bf-2026/.test(String(stored)), 'after "Allow" the campaign is kept for this tab', String(stored));

    await page.goto(`${origin}${catPath}`, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const perPage = google.filter(u => u.startsWith('https://www.googletagmanager.com/gtag/js'));
    check(perPage.length === 2, 'next page: the Google tag once on this page too (2 pages, 2 loads)', String(perPage.length));
    const scripts = await page.$$eval('script[src*="googletagmanager.com/gtag/js"]', s => s.length);
    check(scripts === 1, 'one Google tag in the page', String(scripts));
    const hrefs = await outHrefs(page);
    check(hrefs.length > 0 && hrefs.every(h => /utm_campaign=bf-2026/.test(h)), 'the campaign reaches the /out/ links of the next page', hrefs.slice(0, 2).join(' '));
    const view = page.locator('a[href^="/out/"]').first();
    const [tab] = await Promise.all([context.waitForEvent('page'), view.click()]);
    await tab.waitForURL(/\/out\//, { timeout: 10000 }).catch(() => {});
    const tabUrl = new URL(tab.url() || 'about:blank');
    await tab.close();
    check(tabUrl.searchParams.get('utm_campaign') === 'bf-2026' && tabUrl.searchParams.get('utm_source') === 'google', 'the "View at" click opens /out/ with the campaign', tabUrl.pathname + tabUrl.search);
    const conv = (await layer(page)).filter(a => a[0] === 'event' && a[1] === 'conversion');
    check(conv.length === 1 && conv[0][2].send_to === `AW-18554591090/${LABEL}`, 'the "View at" click sends one conversion "outbound_click"', JSON.stringify(conv));

    await page.click('[data-consent-open]');
    check(await visible(page, '[data-consent]'), '"Cookie settings" opens the banner again');
    await context.addCookies([{ name: '_gcl_au', value: '1.1.test', domain: site.domain, path: '/' }]);
    await Promise.all([page.waitForEvent('load'), page.click('[data-consent-choice="denied"]')]);
    await page.waitForTimeout(300);
    const cookies = (await context.cookies(origin)).map(c => c.name);
    check(!cookies.some(n => n.startsWith('_gcl_')), '"Reject" after "Allow" removes the Google cookies', cookies.join(','));
    const after = await page.$$eval('script[src*="googletagmanager.com/gtag/js"]', s => s.length);
    check(after === 0, '"Reject" after "Allow": the page starts again without the Google tag', String(after));
    const utmAfter = await page.evaluate(k => sessionStorage.getItem(k), `${store}-utm`);
    check(utmAfter === null, '"Reject" removes the kept campaign', String(utmAfter));
    check(errors.length === 0, 'Allow: no JavaScript or CSP errors', errors.join(' | ').slice(0, 300));
    await context.close();
  }

  // the real label is still empty: no conversion is sent from the real page
  {
    const html = await (await fetch(`${local}/`)).text();
    check(/<meta name="gw-ads" content="AW-18554591090" data-label="[A-Za-z0-9_-]*"/.test(html), 'the page has the Google Ads account and the label field');
  }
} finally {
  await browser.close();
}

const failed = results.filter(r => !r.ok);
const lines = [`Google Ads cookie banner check (lessons L93): ${site.domain} via ${local}`, ''];
for (const r of results) lines.push(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.detail && !r.ok ? ` | ${r.detail}` : ''}`);
lines.push('', failed.length ? `${failed.length} of ${results.length} checks FAILED` : `All ${results.length} checks passed`);
const text = lines.join('\n');
console.log(text);
if (val('out')) writeFileSync(val('out'), text + '\n');
process.exit(failed.length ? 1 : 0);
