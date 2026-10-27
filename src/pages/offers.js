// Discount codes pages and the offer bar (lessons L32). Data: site.promos (promos/promos.js).
import { html, raw } from '../lib/html.js';
import { page, tr, breadcrumbs, breadcrumbSchema } from './layout.js';
import { activePromos, barPromo, promoRetailers } from '../lib/promos.js';
import { seasonBanner } from './season.js';

export const OFFERS_PATH = '/discount-codes/';

function money(amount, currency = 'GBP') {
  const n = Number(amount);
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
}

function ukDate(day) {
  const d = new Date(`${day}T12:00:00Z`);
  return { date: day, text: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d) };
}

function offerText(p) {
  if (p.kind === 'code') return tr('{0} off when you spend {1}', money(p.off, p.currency), money(p.minSpend, p.currency));
  // A changing part of tr() is plain text, never another tr(): the day is its own text ("every Thursday").
  return html`${tr('Up to {0}% off', p.upTo)}${p.extraOff ? html`. ${tr('{0} off when you spend {1}', money(p.extraOff, p.currency), money(p.extraMin, p.currency))}${p.day ? html` (${tr(`every ${p.day}`)})` : ''}` : ''}`;
}

function promoCard(p) {
  return html`<li class="promo-card${p.kind === 'code' ? ' promo-code-card' : ''}">
  <p class="promo-campaign">${tr(p.campaign)}</p>
  ${p.kind === 'code' ? html`<p class="promo-code"><span class="promo-code-label">${tr('Code')}</span> <strong translate="no">${p.code}</strong></p>` : ''}
  <p class="promo-offer">${offerText(p)}</p>
  <p class="promo-valid">${tr('Valid until {0}', ukDate(p.end))}</p>
  <p class="promo-actions">
    ${p.kind === 'code' ? html`<button type="button" class="btn btn-outline btn-copy" data-copy="${p.code}" hidden>${tr('Copy code')}</button>` : ''}
    <a class="btn btn-deal" href="/go/${p.id}" rel="sponsored nofollow noopener" target="_blank">${tr('Shop at {0}', p.retailer)}</a>
  </p>
</li>`;
}

function retailerBlock(promos, headingTag) {
  const codes = promos.filter(p => p.kind === 'code');
  const sales = promos.filter(p => p.kind !== 'code');
  const h = headingTag;
  return html`
  ${codes.length ? html`${raw(`<${h}>`)}${tr('Discount codes')}${raw(`</${h}>`)}<ul class="promo-list">${codes.map(promoCard)}</ul>` : ''}
  ${sales.length ? html`${raw(`<${h}>`)}${tr('Sales and campaigns')}${raw(`</${h}>`)}<ul class="promo-list">${sales.map(promoCard)}</ul>` : ''}`;
}

function howTo(retailer) {
  return html`<p class="promo-note">${tr('Copy the code, open {0} with the button and enter the code at checkout. {0} sets the final terms, so check the discount before you pay.', retailer)}</p>`;
}

export function offersIndexPage(site, now = Date.now()) {
  const promos = activePromos(site, now);
  const retailers = promoRetailers(site, now);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Discount codes', path: OFFERS_PATH }];
  const body = html`
<div class="wrap">
  ${breadcrumbs(crumbs)}
  <header class="page-head">
    <h1>${tr('Discount codes and offers')}</h1>
    <p class="lede">${tr('Codes and sales that retailers give to their affiliate partners. Every code has an end date and is removed when it ends.')}</p>
  </header>
  ${seasonBanner(site, 'offers-list', now)}
  <div id="offers-list"></div>
  ${retailers.length ? retailers.map(r => html`<section class="section" aria-labelledby="r-${r.slug}">
    <h2 id="r-${r.slug}" translate="no"><a href="${OFFERS_PATH}${r.slug}/">${r.name}</a></h2>
    ${retailerBlock(promos.filter(p => p.slug === r.slug), 'h3')}
    ${howTo(r.name)}
  </section>`) : html`<div class="empty"><h2>${tr('No codes right now')}</h2><p>${tr('Check back soon. In the meantime, compare prices in the categories.')}</p></div>`}
</div>`;
  return page(site, {
    title: `Discount codes and offers | ${site.name}`,
    description: `Current discount codes and sales from ${retailers.map(r => r.name).join(', ') || 'our retailers'}, with end dates. Shop through ${site.name}.`,
    path: OFFERS_PATH,
    robots: promos.length ? 'index,follow' : 'noindex,follow',
    body,
    schema: [breadcrumbSchema(site, crumbs)]
  });
}

// null when the retailer has no offers on this site at all (404).
export function retailerOffersPage(site, slug, now = Date.now()) {
  const known = (site.promos || []).find(p => p.slug === slug);
  if (!known) return null;
  const retailer = known.retailer;
  const promos = activePromos(site, now).filter(p => p.slug === slug);
  const path = `${OFFERS_PATH}${slug}/`;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Discount codes', path: OFFERS_PATH }, { name: retailer, path, keep: true }];
  const body = html`
<div class="wrap">
  ${breadcrumbs(crumbs)}
  <header class="page-head">
    <h1>${tr('{0} discount codes', retailer)}</h1>
    <p class="lede">${tr('Codes and sales that {0} gives to its affiliate partners. Every code has an end date and is removed when it ends.', retailer)}</p>
  </header>
  ${promos.length ? html`${retailerBlock(promos, 'h2')}${howTo(retailer)}`
    : html`<div class="empty"><h2>${tr('No codes right now')}</h2><p>${tr('Check back soon. In the meantime, compare prices in the categories.')}</p></div>`}
</div>`;
  const codes = promos.filter(p => p.kind === 'code');
  return page(site, {
    title: `${retailer} discount codes${codes.length ? ` (${codes.length} active)` : ''} | ${site.name}`,
    description: codes.length
      ? `${codes.length} ${retailer} discount codes from ${retailer}'s affiliate programme, with end dates: ${codes.slice(0, 3).map(c => `${c.code} (${money(c.off, c.currency)} off ${money(c.minSpend, c.currency)})`).join(', ')}.`
      : `${retailer} discount codes and sales, when ${retailer} has them.`,
    path,
    robots: promos.length ? 'index,follow' : 'noindex,follow',
    body,
    schema: [breadcrumbSchema(site, crumbs)]
  });
}

// One short line at the top of every page.
export function promoBarHtml(site, now = Date.now()) {
  const p = barPromo(site, now);
  if (!p) return '';
  return html`<div class="promo-bar"><p class="wrap promo-row"><span aria-hidden="true">${p.bar}</span>
  ${p.kind === 'code'
    ? tr('{0}: {1} off {2}+ with code {3}', p.retailer, money(p.off, p.currency), money(p.minSpend, p.currency), p.code)
    : tr('{0}: up to {1}% off', p.retailer, p.upTo)}
  <a href="${OFFERS_PATH}${p.slug}/">${tr('All codes')}<span aria-hidden="true"> &rarr;</span></a></p></div>`;
}
