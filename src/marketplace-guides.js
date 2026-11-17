// Gift-guide site that links to the big marketplaces and to the Gear World sites (Mega Stores Gear World, OGW).
// No database, no cookies, no forms, no scripts. Owner's decision, 17 Nov 2026: no price tracking, price history or
// price alerts here (Amazon Associates Operating Agreement 6(y)); no Amazon prices or photos (no Product Advertising
// API yet); Amazon links go straight to the marketplace with the Associates ID, never through a redirect of ours.
// Amazon links appear only when the Worker has AMAZON_LINKS=on (set by tools/ogw-site.ps1 after the owner's phrase
// that the site is in his Associates account); AMAZON_LINKS=preview (the test Worker) links without the ID.
import { html, toString } from './lib/html.js';
import { htmlResponse, textResponse, redirect } from './lib/http.js';
import { versionResponse } from './lib/version.js';
import { GEAR_WORLDS } from '../promos/network.js';

export const AMAZON_STATEMENT = 'As an Amazon Associate I earn from qualifying purchases.';
const AMAZON_TRADEMARK = 'Amazon and the Amazon logo are trademarks of Amazon.com, Inc. or its affiliates.';
// The legal texts last changed on this day (UK and EU GDPR wording as approved for the Gear World sites on 17 Nov 2026).
const LEGAL_UPDATED = '18 November 2026';

const asset = (site, p) => `/assets/${p}?v=${encodeURIComponent(site.assetVersion)}`;

// 'on' (the live site, after the owner's phrase), 'preview' (the test Worker: links without the Associates ID) or
// 'off' (no Amazon links at all).
export function amazonMode(env) {
  const v = env && typeof env.AMAZON_LINKS === 'string' ? env.AMAZON_LINKS.trim().toLowerCase() : '';
  return v === 'on' || v === 'preview' ? v : 'off';
}

// A search on amazon.co.uk for one idea. Only the host and the Associates ID of the site config, and the idea's search
// words, so the link always goes to the marketplace named on the button.
export function amazonUrl(site, q, mode) {
  if (mode !== 'on' && mode !== 'preview') return '';
  const a = site.amazon || {};
  if (!a.host || (mode === 'on' && !/^[a-z0-9-]+-21$/.test(String(a.tag || '')))) return '';
  const u = new URL(`https://${a.host}/s`);
  u.searchParams.set('k', String(q));
  if (mode === 'on') u.searchParams.set('tag', a.tag);
  return u.toString();
}

// The Gear World site of an idea (its code in promos/network.js) and its category page for the same kind of product.
// A category page always lists products; a site search for several words often finds none (checked 17 Nov 2026).
export function gearWorldFor(code) {
  return GEAR_WORLDS.find(w => w.code === String(code || '').toUpperCase()) || null;
}

export function gearWorldUrl(code, cat) {
  const w = gearWorldFor(code);
  if (!w || !/^[a-z0-9-]+$/.test(String(cat || ''))) return '';
  return new URL(`/category/${cat}/`, w.url).toString();
}

// The UK date (YYYY-MM-DD) of a moment: the countdown changes at midnight in London.
export function ukDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = t => parts.find(p => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
// "27 Nov" for 2026-11-27.
const shortDate = day => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));

// The line above the guides: days to Black Friday, the Black Friday weekend, then days to Christmas. A date, never a
// promise of discounts (lessons L107). Empty after Christmas Day.
export function countdown(site, now = new Date()) {
  const today = ukDay(now);
  const bf = site.blackFriday;
  const xmas = site.christmas;
  if (bf) {
    const d = daysBetween(today, bf);
    const day = shortDate(bf);
    if (d > 1) return `Black Friday: ${day} · ${d} days to go`;
    if (d === 1) return `Black Friday: ${day} · 1 day to go`;
    if (d <= 0 && d >= -3) return `Black Friday weekend: ${day} to ${shortDate(addDays(bf, 3))}`;
  }
  if (xmas) {
    const d = daysBetween(today, xmas);
    if (d > 1) return `Christmas: ${d} days to go`;
    if (d === 1) return 'Christmas: 1 day to go';
    if (d === 0) return 'Happy Christmas';
  }
  return '';
}

const FOOTER_LINKS = [
  ['/about/', 'About'],
  ['/how-we-make-money/', 'How we make money'],
  ['/privacy/', 'Privacy policy'],
  ['/cookies/', 'Cookies'],
  ['/terms/', 'Terms of use']
];

const mail = site => html`<a href="mailto:${site.contactEmail}">${site.contactEmail}</a>`;

// The note at the top of every guide (and the home page): what the links are, before the reader meets one.
function disclosure(site, mode) {
  return html`<div class="note" role="note">
  <p><strong>#ad</strong> · The buttons on this page are links to marketplaces and to the Gear World sites. If you choose something after following one, we may earn a commission, at no extra cost to you. ${mode === 'on' ? AMAZON_STATEMENT : ''}</p>
  <p>Prices, stock and delivery are on the marketplace's own page. We do not sell anything and we do not track prices.</p>
</div>`;
}

// The same header and footer on every page; the footer links to the legal pages (lessons L17) and says who runs the
// site (L101). The Amazon statement and trademark notice only where Amazon links are shown.
function shell(site, env, { title, description, path, body, robots = '' }) {
  const mode = amazonMode(env);
  const year = new Date().getUTCFullYear();
  return toString(html`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://${site.domain}${path}">
${robots ? html`<meta name="robots" content="${robots}">` : ''}
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://${site.domain}${path}">
<meta property="og:type" content="website">
<link rel="icon" href="${asset(site, 'favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${asset(site, 'ogw.css')}">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="wrap top-row">
  <a class="brand" href="/"><img src="${asset(site, 'logo.svg')}" alt="" width="40" height="40"><span>${site.name}</span></a>
  <a class="top-link" href="/#guides">Gift guides</a>
</div></header>
<main id="main">${body}</main>
<footer class="foot"><div class="wrap">
  <nav aria-label="Legal"><ul class="foot-links">${FOOTER_LINKS.map(([href, label]) => html`<li><a href="${href}">${label}</a></li>`)}</ul></nav>
  ${mode === 'on' ? html`<p>${AMAZON_STATEMENT} ${AMAZON_TRADEMARK}</p>` : ''}
  <p>This site sets no cookies of its own and does no tracking. Prices and stock are on each marketplace's own page.</p>
  <p>&copy; ${year} ${site.name} · Run by ${site.operatorName} · We don't sell products: we link to marketplaces and to the Gear World sites, and may earn a commission.</p>
</div></footer>
</body>
</html>`);
}

function ideaButtons(site, idea, mode) {
  const amazon = amazonUrl(site, idea.q, mode);
  const gw = gearWorldFor(idea.gw);
  const gwUrl = gearWorldUrl(idea.gw, idea.cat);
  return html`<p class="buttons">
    ${amazon ? html`<a class="btn btn-market" href="${amazon}" rel="sponsored nofollow noopener" target="_blank">See prices on Amazon</a>` : ''}
    ${gwUrl ? html`<a class="btn btn-gw" href="${gwUrl}" rel="noopener" target="_blank">Browse on ${gw.name}</a>` : ''}
  </p>`;
}

export function homePage(site, env, now = new Date()) {
  const mode = amazonMode(env);
  const count = countdown(site, now);
  const all = [...site.guides, site.checks].filter(Boolean);
  return shell(site, env, {
    title: `Gift guides and marketplace searches | ${site.name}`,
    description: 'Christmas gift ideas for everyone, with searches on the big marketplaces and on the Gear World sites. Compare models, sellers and prices before you choose.',
    path: '/',
    body: html`
<section class="hero"><div class="wrap">
  <p class="eyebrow">Gift guides</p>
  <h1>Gift ideas first. Then compare on the big marketplaces.</h1>
  <p class="lede">Short gift guides for Christmas and the winter. Every idea opens a search on a big marketplace and the matching category of a Gear World site, so you can compare models, sellers and prices before you choose.</p>
  ${count ? html`<p class="count">${count}</p>` : ''}
</div></section>
<section class="wrap section">${disclosure(site, mode)}</section>
<section class="wrap section" id="guides">
  <h2>Gift guides</h2>
  <ul class="cards">${all.map(g => html`<li class="card"><h3><a href="/guides/${g.slug}/">${g.title}</a></h3><p>${g.teaser}</p></li>`)}</ul>
</section>
<section class="wrap section">
  <h2>How this site works</h2>
  <ul class="ticks">
    <li>We write short lists of gift ideas. An idea is a kind of product, not a product we claim to have tested.</li>
    <li>Each idea opens a search on a marketplace and the matching category of a Gear World site. Those pages show the products, the seller, the price and delivery.</li>
    <li>We do not sell anything, we do not track prices and we do not set cookies.</li>
  </ul>
</section>
<section class="wrap section">
  <h2>The Gear World sites</h2>
  <p>Independent product search and price-comparison sites. Each product shows the retailer that sells it and where that retailer delivers. <a href="https://gearworldhub.com/">Gear World Hub</a> searches all of them at once.</p>
  <ul class="gw-list">${GEAR_WORLDS.map(w => html`<li><a href="${w.url}">${w.name}</a></li>`)}</ul>
</section>`
  });
}

export function guidePage(site, env, guide) {
  const mode = amazonMode(env);
  return shell(site, env, {
    title: `${guide.title} | ${site.name}`,
    description: `${guide.teaser} Ideas with searches on the big marketplaces and the Gear World sites.`,
    path: `/guides/${guide.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="/#guides">Gift guides</a></p>
  <h1>${guide.title}</h1>
  <p class="lede">${guide.intro}</p>
</div></section>
<section class="wrap section">${disclosure(site, mode)}</section>
<section class="wrap section">
  <ol class="ideas">${guide.ideas.map(i => html`<li class="idea">
    <h2>${i.name}</h2>
    <p>${i.why}</p>
    ${ideaButtons(site, i, mode)}
  </li>`)}</ol>
</section>
<section class="wrap section">
  <p><a href="/guides/${site.checks.slug}/">${site.checks.title}</a> · <a href="/#guides">All gift guides</a></p>
</section>`
  });
}

export function checksPage(site, env) {
  const c = site.checks;
  const mode = amazonMode(env);
  return shell(site, env, {
    title: `${c.title} | ${site.name}`,
    description: `${c.teaser} Seven checks that take a few minutes.`,
    path: `/guides/${c.slug}/`,
    body: html`
<section class="hero hero-small"><div class="wrap">
  <p class="eyebrow"><a href="/#guides">Gift guides</a></p>
  <h1>${c.title}</h1>
  <p class="lede">${c.intro}</p>
</div></section>
<section class="wrap section prose">
  <ol class="steps">${c.steps.map(s => html`<li><h2>${s.name}</h2><p>${s.text}</p></li>`)}</ol>
</section>
<section class="wrap section">${disclosure(site, mode)}<p><a href="/#guides">All gift guides</a></p></section>`
  });
}

// Legal pages (lessons L17). They describe this site only: no forms, no accounts, no cookies of its own.
// NOTE: a starting point that needs review by a qualified adviser (T31), like the other Gear World sites.
const LEGAL = {
  '/about/': (site, mode) => ({
    title: 'About',
    description: `Who runs ${site.name} and how to contact us.`,
    content: html`
<p>${site.name} (${site.domain}) is a small site of gift guides. Each idea links to a search on a big marketplace and to the matching category of one of the Gear World sites, so you can compare models, sellers and prices yourself.</p>
<p>It is part of the Gear World sites, a group of independent product search and price-comparison sites.</p>
<p>Run by ${site.operatorName}. Contact: ${mail(site)}.</p>
<h2>What we do not do</h2>
<ul>
<li>We do not sell anything and we do not take payments.</li>
<li>We do not track prices or send price alerts.</li>
<li>We do not show marketplace prices or photos: they are on the marketplace's own page, where they are up to date.</li>
</ul>
${mode === 'on' ? html`<p>${AMAZON_STATEMENT}</p>` : ''}`
  }),

  '/how-we-make-money/': (site, mode) => ({
    title: 'How we make money',
    description: `How ${site.name} earns money through affiliate links.`,
    content: html`
<p>${site.name} is free to use. We earn money through affiliate links.</p>
<h2>What an affiliate link is</h2>
<p>Some buttons on this site are affiliate links to marketplaces. If you follow one and then buy something, the marketplace may pay us a commission. You pay the same price as you would if you went to the marketplace directly.</p>
${mode === 'on' ? html`<h2>Amazon</h2><p>${AMAZON_STATEMENT}</p><p>${AMAZON_TRADEMARK}</p>` : ''}
<h2>The Gear World sites</h2>
<p>The "Browse on" buttons open a category of a Gear World site. Those sites have their own affiliate links and explain them on their own "How we make money" page.</p>
<h2>How this affects what you see</h2>
<p>The ideas are not ranked by commission, and no marketplace or retailer pays to be in a guide. We do not show prices: the marketplace's page has the current price.</p>`
  }),

  '/privacy/': site => ({
    title: 'Privacy policy',
    description: `How ${site.name} (${site.domain}) handles personal data.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>This policy explains what personal data ${site.name} (${site.domain}) uses, why, and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018) and, if you are in the European Union or the European Economic Area, under the EU General Data Protection Regulation (GDPR).</p>
<h2>Who is responsible</h2>
<p>The data controller is ${site.operatorName}. Contact: ${mail(site)}.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Visiting the site.</strong> The site has no forms, no accounts, no analytics and no advertising tags. We do not record your visit.</li>
<li><strong>Email.</strong> If you email us, we keep your message and email address to reply (legitimate interests) and delete them when they are no longer needed.</li>
<li><strong>Hosting.</strong> The site is hosted by Cloudflare, which processes technical data such as IP addresses to deliver and protect the site.</li>
</ul>
<h2>When you follow a link</h2>
<p>When you follow a link to a marketplace or to a Gear World site, that site's own privacy policy applies. A marketplace may set its own cookies on its own site to know that you came from us, so it can pay a commission.</p>
<h2>Sharing and transfers</h2>
<p>We do not sell personal data. Our service provider (Cloudflare) may process data outside the UK and the European Economic Area with appropriate safeguards.</p>
<h2>Your rights</h2>
<p>You can ask for access to, correction or deletion of your data, ask us to restrict or stop using it, object, and ask for a copy. Email ${mail(site)}. You can complain to the Information Commissioner's Office at <a href="https://ico.org.uk/">ico.org.uk</a>. If you are in the European Union or the European Economic Area, you can also complain to the data protection authority of the country where you live.</p>`
  }),

  '/cookies/': site => ({
    title: 'Cookies',
    description: `Which cookies ${site.domain} uses.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>${site.domain} sets no advertising, analytics or tracking cookies and stores nothing on your device, so there is no cookie banner.</p>
<h2>Strictly necessary</h2>
<p>Our hosting provider Cloudflare may set short-lived security cookies to protect the site from bots. They are needed for the site to work safely and do not track you across sites.</p>
<h2>Other sites</h2>
<p>When you follow a link to a marketplace or to a Gear World site, that site may set its own cookies, which its own cookies page explains.</p>`
  }),

  '/terms/': site => ({
    title: 'Terms of use',
    description: `The terms for using ${site.domain}.`,
    content: html`
<p class="updated">Last updated: ${LEGAL_UPDATED}</p>
<p>These terms apply when you use ${site.domain}, operated by ${site.operatorName}. By using the site you accept them.</p>
<h2>What the site does</h2>
<p>The site publishes gift ideas with links to searches on marketplaces and to categories of the Gear World sites. It does not sell anything. Any purchase is between you and the seller on the marketplace, under the seller's and the marketplace's terms.</p>
<h2>The ideas</h2>
<p>The ideas are general suggestions, not advice about a particular product. Check the product page, the age and safety marks, the seller and the returns policy before you choose.</p>
<h2>Links to other websites</h2>
<p>We are not responsible for the content, prices or availability on websites we link to.</p>
<h2>Liability</h2>
<p>Nothing in these terms limits liability that cannot be limited by law. Otherwise we are not liable for losses arising from your use of this site.</p>
<h2>Law</h2>
<p>These terms are governed by the law of England and Wales. If you are a consumer living in the European Union, you also keep the protection of the mandatory consumer laws of the country where you live.</p>
<h2>Contact</h2>
<p>${mail(site)}</p>`
  })
};

export function legalPaths() {
  return Object.keys(LEGAL);
}

export function legalPage(site, env, path) {
  const make = LEGAL[path];
  if (!make) return null;
  const p = make(site, amazonMode(env));
  return shell(site, env, {
    title: `${p.title} | ${site.name}`,
    description: p.description,
    path,
    body: html`
<section class="wrap section prose">
  <h1>${p.title}</h1>
  ${p.content}
</section>`
  });
}

function notFoundPage(site, env, path) {
  return shell(site, env, {
    title: `Page not found | ${site.name}`,
    description: 'This page does not exist.',
    path,
    robots: 'noindex',
    body: html`
<section class="wrap section prose">
  <h1>Page not found</h1>
  <p>This page does not exist. <a href="/#guides">See all gift guides</a>.</p>
</section>`
  });
}

// Every page address, for the sitemap.
export function pagePaths(site) {
  return ['/', ...site.guides.map(g => `/guides/${g.slug}/`), `/guides/${site.checks.slug}/`, ...Object.keys(LEGAL)];
}

export function createGuidesWorker(site) {
  const guides = new Map(site.guides.map(g => [g.slug, g]));
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.hostname === `www.${site.domain}`) {
        url.hostname = site.domain;
        return redirect(url.toString(), 301);
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return textResponse('Method not allowed', { status: 405, cache: 'none' });
      // The test Worker (*.workers.dev) is never indexed.
      const preview = url.hostname !== site.domain && !['localhost', '127.0.0.1'].includes(url.hostname);
      const page = (body, status = 200) => {
        const res = htmlResponse(body, { status, method: request.method, cache: 'page' });
        if (preview) res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        return res;
      };
      // Which code version is live, for the deploy tool's check (lessons L156).
      if (url.pathname === '/api/version') return versionResponse(env);
      if (url.pathname === '/robots.txt') {
        return textResponse(preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: https://${site.domain}/sitemap.xml\n`, { method: request.method });
      }
      if (url.pathname === '/sitemap.xml') {
        const urls = pagePaths(site).map(p => `<url><loc>https://${site.domain}${p}</loc></url>`).join('\n');
        return textResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { type: 'application/xml', method: request.method });
      }
      if (url.pathname === '/' || url.pathname === '/index.html') return page(homePage(site, env));
      if (url.pathname === '/guides' || url.pathname === '/guides/') return redirect(`https://${site.domain}/#guides`, 302);
      const gm = url.pathname.match(/^\/guides\/([a-z0-9-]+)\/?$/);
      if (gm) {
        const slug = gm[1];
        const known = guides.has(slug) || slug === site.checks.slug;
        if (known && !url.pathname.endsWith('/')) { url.pathname = `${url.pathname}/`; return redirect(url.toString(), 301); }
        if (guides.has(slug)) return page(guidePage(site, env, guides.get(slug)));
        if (slug === site.checks.slug) return page(checksPage(site, env));
      }
      // Legal pages; the address without the final slash goes to the one with it.
      if (!url.pathname.endsWith('/') && LEGAL[`${url.pathname}/`]) {
        url.pathname = `${url.pathname}/`;
        return redirect(url.toString(), 301);
      }
      if (LEGAL[url.pathname]) return page(legalPage(site, env, url.pathname));
      if (env && env.ASSETS && url.pathname.startsWith('/assets/')) return env.ASSETS.fetch(request);
      return page(notFoundPage(site, env, url.pathname), 404);
    }
  };
}
