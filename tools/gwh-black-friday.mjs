#!/usr/bin/env node
// Gear World Hub - Black Friday 2026 (owner's approval «ΕΓΚΡΙΝΩ ΙΔΕΑ 11 Β», 18 Nov 2026, lessons L188).
// One honest page inside the Hub, gearworldhub.com/black-friday/, at the same address every year:
//   (a) the retailers on the Gear World sites that announced their Black Friday to us (their affiliate emails), with
//       their own dates, and links to their products on the Gear World sites (search filtered by the retailer);
//   (b) their discount codes and coupons with end dates, the same as each site's /discount-codes/ page;
//   (c) the dates: Black Friday 27 Nov 2026, Cyber Monday 30 Nov 2026;
//   (d) from 27 Nov (second step, lessons L188): the products whose price is the lowest in our daily checks since
//       7 Nov 2026 (the D1 gear-world-prices of the 13 sites). Until then the page only says that this comes.
// Never a saving, a percentage, "was", "sale", a store banner or a link to a retailer, /out/ or /go/ (L103, L107): the
// Hub links only to Gear World pages. Nothing on the 13 sites changes (their Black Friday season stays closed, Γ1).
// Like /stores/, every retailer, code and coupon carries its last day, and /stores/stores.js hides it once that day
// has passed (UK day), even before the page is built again.
// The data is sites/gwh/black-friday/black-friday.json, kept by the Gear World Manager from the offers tracker
// ("Προσφορές & Εποχές"): only offers the owner approved there.
//
// Usage:
//   node tools/gwh-black-friday.mjs build      writes sites/gwh/public/black-friday/index.html (nothing goes online)
//   node tools/gwh-black-friday.mjs validate   OFFLINE: is the data still valid today (UK day)? Exit 20 when a code ended
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { esc, day, SITES, BAD_WORDS, siteLink, codesLink, londonToday, PUBLIC_DIR, head, FOOT } from './gwh-stores.mjs';

const DATA_FILE = fileURLToPath(new URL('../sites/gwh/black-friday/black-friday.json', import.meta.url));
export const PAGE = 'black-friday/index.html';
export const PATH = '/black-friday/';
const ORIGIN = 'https://gearworldhub.com';
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekday = iso => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
const name = r => `<span translate="no">${esc(r.name)}</span>`;
// The countries an entry delivers to, as data-delivers (L211): its deliversTo, the UK when it has none.
const delivers = r => (Array.isArray(r.deliversTo) && r.deliversTo.length ? r.deliversTo : ['GB']).map(c => String(c).toUpperCase()).join(' ');

export function loadData(file = DATA_FILE) { return JSON.parse(readFileSync(file, 'utf8')); }

// Everything the page may hold, checked before it is written: returns the problems (empty = fine).
export function validate(data, today = data.checked) {
  const problems = [];
  if (data.checked && today < data.checked) today = data.checked;
  if (!DATE.test(today || '')) problems.push('checked: a date like 2026-11-18');
  if (data.blackFriday !== '2026-11-27' || data.cyberMonday !== '2026-11-30') problems.push('the dates: Black Friday 2026-11-27, Cyber Monday 2026-11-30');
  for (const r of data.started || []) {
    const at = r.name || '(no name)';
    if (!r.name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug || '')) problems.push(`${at}: name and slug`);
    if (!DATE.test(r.from || '') || (r.to && !DATE.test(r.to)) || !DATE.test(r.hide || '')) problems.push(`${at}: from, to (or empty) and hide dates`);
    if (r.to && r.hide !== r.to) problems.push(`${at}: hide is the retailer's own last day`);
    if (!Array.isArray(r.sites) || !r.sites.length || r.sites.some(s => !SITES[s])) problems.push(`${at}: sites, each a Gear World site`);
    if (!Array.isArray(r.deliversTo) || !r.deliversTo.includes('GB')) problems.push(`${at}: delivers to the UK`);
    if (!/^Awin email /.test(r.source || '')) problems.push(`${at}: the source is the retailer's affiliate email`);
  }
  for (const c of data.codes || []) {
    const at = `${c.name || '?'} ${c.code || c.title || ''}`;
    if (!['code', 'coupon'].includes(c.kind)) problems.push(`${at}: a code or a coupon`);
    if (c.kind === 'code' && !/^[A-Z0-9]{3,30}$/.test(c.code || '')) problems.push(`${at}: a code of capital letters and digits`);
    if (c.kind === 'coupon' && c.code) problems.push(`${at}: a coupon has no code`);
    const retailer = (data.started || []).find(r => r.slug === c.slug);
    if (!c.title || !SITES[c.site] || !retailer || !retailer.sites.includes(c.site)) problems.push(`${at}: a title, and a site of its retailer in the list`);
    if (!DATE.test(c.end || '')) problems.push(`${at}: an end date like 2026-12-06`);
    else if (c.end < today) problems.push(`${at}: ended on ${c.end} (take it out of black-friday.json and build again)`);
  }
  for (const r of data.started || []) {
    if (DATE.test(r.hide || '') && r.hide < today) problems.push(`${r.name}: its Black Friday ended on ${r.hide} (take it out of black-friday.json and build again)`);
  }
  const words = [...(data.started || []).map(r => r.name), ...(data.codes || []).map(c => c.title)].join(' ');
  const bad = words.match(BAD_WORDS);
  if (bad) problems.push(`"${bad[0]}" (L103/L107)`);
  return problems;
}

function startedItem(r) {
  const until = r.to ? ` · until ${day(r.to)}` : '';
  const sites = r.sites.map(code => `<a href="${esc(siteLink(r, code))}">${esc(SITES[code].name)}</a>`).join(', ');
  // rt-offer: /stores/stores.js counts it, so "Nothing running right now" shows only when every retailer has ended.
  // data-delivers (L211): the Hub Worker shows the item only to visitors from these countries.
  return `      <li class="gd-item rt-item rt-offer" data-end="${r.hide}" data-delivers="${esc(delivers(r))}">
        <div class="gd-body">
          <h3>${name(r)}</h3>
          <p class="gd-why">Black Friday from ${day(r.from)}${until} (the retailer's own dates)</p>
          <p class="rt-meta">Products on ${sites}</p>
          <a class="gd-btn" href="${esc(siteLink(r, r.sites[0]))}"><span>See ${name(r)} products</span></a>
        </div>
      </li>`;
}

function codeItem(c, data) {
  const r = { name: c.name, slug: c.slug };
  // A code delivers where it says (deliversTo), else where its retailer does (L211).
  const retailer = Array.isArray(c.deliversTo) && c.deliversTo.length ? c : (data.started || []).find(x => x.slug === c.slug) || {};
  const what = c.kind === 'code'
    ? `${name(r)} · code <strong class="rt-code" translate="no">${esc(c.code)}</strong>: ${esc(c.title)}`
    : `${name(r)} · coupon: ${esc(c.title)}`;
  const how = c.kind === 'code' ? 'Copy the code on the site page' : 'No code: the coupon is on the retailer\'s page';
  return `      <li class="gd-item rt-item rt-offer" data-end="${c.end}" data-delivers="${esc(delivers(retailer))}">
        <div class="gd-body">
          <h3>${what}</h3>
          <p class="gd-why">Valid until ${day(c.end)} · ${how}</p>
          <a class="gd-btn" href="${esc(codesLink(r, c.site))}">See it on ${esc(SITES[c.site].name)}</a>
        </div>
      </li>`;
}

export function page(data) {
  const title = 'Black Friday 2026: dates and discount codes on Gear World | Gear World Hub';
  const description = `Black Friday is on ${day(data.blackFriday)} and Cyber Monday on ${day(data.cyberMonday)}. The retailers on the Gear World sites that have started, with their dates and codes.`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: 'Black Friday 2026', item: `${ORIGIN}${PATH}` }
    ]
  };
  const body = `
<main class="lg-wrap lg-main gd-main">
  <nav class="lg-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span>Black Friday 2026</span></nav>
  <article class="gd-article">
    <h1>Black Friday 2026 on Gear World</h1>
    <p class="gd-lead">Black Friday is on ${weekday(data.blackFriday)} ${day(data.blackFriday)} and Cyber Monday on ${weekday(data.cyberMonday)} ${day(data.cyberMonday)}. Here are the retailers on the 13 Gear World sites that have told us their Black Friday has started, with their own dates, and their discount codes with end dates. Each Gear World site shows the price and stock it last checked.</p>
    <p class="gd-checked">Checked ${day(data.checked)}.</p>
    <section class="gd-group" aria-labelledby="bf-dates-h">
      <h2 id="bf-dates-h">The dates</h2>
      <ul class="gd-list">
      <li class="gd-item rt-item"><div class="gd-body"><h3>Black Friday</h3><p class="gd-why">${weekday(data.blackFriday)} ${day(data.blackFriday)}</p></div></li>
      <li class="gd-item rt-item"><div class="gd-body"><h3>Cyber Monday</h3><p class="gd-why">${weekday(data.cyberMonday)} ${day(data.cyberMonday)}</p></div></li>
      </ul>
    </section>
    <section class="gd-group rt-offers" aria-labelledby="bf-started-h">
      <h2 id="bf-started-h">Retailers that have started their Black Friday</h2>
      <ul class="gd-list">
${data.started.map(startedItem).join('\n')}
      </ul>
      <p class="gd-note rt-none" hidden>Nothing running right now. Check back soon.</p>
      <p class="gd-note">From the retailers' own emails to Gear World. Each Gear World site lists only the products that deliver to your country.</p>
    </section>
    <section class="gd-group rt-offers" aria-labelledby="bf-codes-h">
      <h2 id="bf-codes-h">Discount codes and coupons</h2>
      <ul class="gd-list">
${data.codes.map(c => codeItem(c, data)).join('\n')}
      </ul>
      <p class="gd-note rt-none" hidden>No codes right now. Check back soon.</p>
      <p class="gd-note">Published by each retailer through its affiliate programme. The retailer sets the final terms, so check the discount before you pay.</p>
    </section>
    <section class="gd-group" aria-labelledby="bf-watch-h">
      <h2 id="bf-watch-h">From ${day(data.blackFriday)}: the lowest prices in our checks</h2>
      <p class="gd-note">We check the prices of the Gear World sites every day since 7 Nov 2026. On ${day(data.blackFriday)} this page adds the products whose price that day is the lowest in our checks since 7 Nov 2026.</p>
    </section>
    <div class="gd-tips">
      <p class="gd-tip"><strong>How it works:</strong> Gear World does not sell anything. Each Gear World site shows the price and stock it last checked, and its button takes you to the retailer, where you check the final price and delivery before you buy.</p>
    </div>
    <p class="gd-note"><a href="/stores/">All stores on Gear World</a> · <a href="/">Search every Gear World</a></p>
  </article>
</main>
`;
  return `${head({ title, description, path: PATH, jsonLd })}${body}${FOOT}`;
}

export function build(data = loadData(), today = data.checked) {
  const problems = validate(data, today);
  if (problems.length) throw new Error('black-friday.json: ' + problems.join('; '));
  return { [PAGE]: page(data) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2] || 'build';
  const data = loadData();
  if (cmd === 'validate') {
    const problems = validate(data, londonToday());
    if (problems.length) { console.log(problems.join('\n')); process.exit(20); }
    console.log('black-friday.json: OK');
  } else if (cmd === 'build') {
    const problems = validate(data, londonToday());
    if (problems.length) { console.log(problems.join('\n')); process.exit(20); }
    for (const [rel, html] of Object.entries(build(data))) {
      mkdirSync(`${PUBLIC_DIR}${rel.replace(/[^/]+$/, '')}`, { recursive: true });
      writeFileSync(`${PUBLIC_DIR}${rel}`, html);
      console.log(`wrote sites/gwh/public/${rel}`);
    }
  } else {
    console.log('usage: node tools/gwh-black-friday.mjs build|validate');
    process.exit(2);
  }
}
