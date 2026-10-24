// About, disclosure, contact and legal pages (lessons L17). Text comes from the site config, never another site.
// NOTE: legal texts are a starting point and need review by a qualified adviser before launch (task T31).
import { html } from '../lib/html.js';
import { categoryPath } from '../lib/text.js';
import { page, breadcrumbs, breadcrumbSchema, tr } from './layout.js';

export const PLACEHOLDER = 'To be completed before launch';

function operator(site) {
  return site.operatorName || PLACEHOLDER;
}

function contactLink(site) {
  return site.contactEmail ? html`<a href="mailto:${site.contactEmail}">${site.contactEmail}</a>` : PLACEHOLDER;
}

const UPDATED = '19 October 2026';

const PAGES = {
  // About, money and contact pages are translated (lessons L24): whole sentences only, no link in the middle of
  // a sentence, so each language can order the words its own way. Legal pages (legal: true) stay in English.
  '/about/': site => ({
    title: 'About us',
    description: `What ${site.name} is, where the prices come from and how the site is run.`,
    content: html`
<p>${site.retailersFromEurope
  ? tr('{0} is an independent price comparison site. It lists products from retailers in the UK and Europe, so you can compare prices in one place and then buy from the retailer you choose.', site.name)
  : tr('{0} is an independent price comparison site. It lists products from UK retailers, so you can compare prices in one place and then buy from the retailer you choose.', site.name)}</p>
<h2>What you can compare</h2>
<ul class="chip-list">${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}">${c.name}</a></li>`)}</ul>
<h2>Where the prices come from</h2>
<p>Retailers publish product feeds through the Awin affiliate network. We import those feeds, sort the products into categories and show the price, stock and condition that the retailer reports. Each product page shows the date the price was last checked. Prices can change after that, so the retailer's website always has the final price.</p>
<h2>What we do not do</h2>
<p>We do not sell products, take payments or handle deliveries. Orders, returns and warranties are between you and the retailer.</p>
<h2>Part of the Gear World network</h2>
<p>${tr('{0} is one of the Gear World comparison sites, alongside the other specialist sites on Gear World Hub.', site.name)}</p>
<p><a class="btn btn-gold" href="${site.hub.url}">Explore the Hub</a></p>`
  }),

  '/how-we-make-money/': site => ({
    title: 'How we make money',
    description: `How ${site.name} earns money through affiliate links, and what that means for you.`,
    content: html`
<p>${tr('{0} is free to use. We earn money through affiliate links.', site.name)}</p>
<h2>What an affiliate link is</h2>
<p>When you select a "View at" button, you go to the retailer through the Awin affiliate network. If you then buy something, the retailer may pay us a commission. You pay the same price as you would if you went to the retailer directly.</p>
<h2>How this affects what you see</h2>
<p>We do not rank products by commission. The default order mixes products in stock first, and you can sort by price, newest or biggest saving at any time. A retailer cannot pay to change a price or a product's position on this site.</p>
<h2>Price drops</h2>
<p>We mark a price drop only when the retailer reports a previous price that is at least 5% higher than the current one. We show both prices so you can judge the saving yourself.</p>`
  }),

  '/contact/': site => ({
    title: 'Contact',
    description: `How to contact ${site.name}.`,
    content: html`
<p>For questions about this website, send us an email:</p>
<p class="contact-email" translate="no">${contactLink(site)}</p>
<p>We cannot help with orders, deliveries, returns or refunds, because we do not sell products. For those, please contact the retailer you bought from.</p>`
  }),

  '/privacy/': site => ({
    legal: true,
    title: 'Privacy policy',
    description: `How ${site.name} handles personal data.`,
    content: html`
<p>Last updated: ${UPDATED}</p>
<p>This policy explains what personal data ${site.name} (${site.domain}) uses, why, and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018).</p>
<h2>Who is responsible</h2>
<p>The data controller is ${operator(site)}. Contact: ${contactLink(site)}.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Clicks to retailers.</strong> When you select a "View at" button we record the product, the retailer, the page you were on, the date and your country as reported by our hosting provider. We do not record your IP address or anything that identifies you. We use this to understand which products are useful (legitimate interests).</li>
<li><strong>Newsletter.</strong> If you sign up, we keep your email address, the date and the consent text you agreed to. We use it only to send the newsletter (consent). You can withdraw consent at any time by emailing us, and we will delete your address.</li>
<li><strong>Abuse protection.</strong> To stop automated abuse of forms we keep a one-way scrambled (hashed) form of your IP address for up to one hour, and the form uses Cloudflare Turnstile (legitimate interests).</li>
<li><strong>Hosting.</strong> The site is hosted by Cloudflare, which processes technical data such as IP addresses to deliver and protect the site.</li>
${site.voiceSearch ? html`<li><strong>Voice search.</strong> If you press the microphone button, your browser asks for permission and its own speech service turns what you say into text (for example Google in Chrome, Apple in Safari). Their privacy policies apply to that step. We receive only the text, as a normal search, and we do not record audio.</li>` : ''}
${site.cart || (site.languages || []).length > 1 ? html`<li><strong>Choices kept on your device.</strong> Your browser remembers your language, currency, compare list${site.cart ? ` and ${site.cart.name}` : ''} in its local storage. This stays on your device and is not sent to us. You can clear it in your browser settings.</li>` : ''}
</ul>
<h2>Cookies and tracking</h2>
<p>We do not use advertising or tracking cookies. See the <a href="/cookies/">cookies page</a> for details.</p>
<h2>When you go to a retailer</h2>
<p>Retailer links go through Awin. Awin and the retailer may set their own cookies to record that you came from this site. Their privacy policies apply on their websites, for example the <a href="https://www.awin.com/gb/privacy">Awin privacy policy</a>.</p>
<h2>Sharing and transfers</h2>
<p>We do not sell personal data. Our service providers (Cloudflare) may process data outside the UK with appropriate safeguards.</p>
<h2>How long we keep data</h2>
<p>Click records: up to 26 months. Newsletter: until you unsubscribe. Abuse protection: up to one hour.</p>
<h2>Your rights</h2>
<p>You can ask for access to, correction or deletion of your data, ask us to restrict or stop using it, and ask for a copy. Email ${contactLink(site)}. You can also complain to the Information Commissioner's Office at <a href="https://ico.org.uk/">ico.org.uk</a>.</p>`
  }),

  '/cookies/': site => ({
    legal: true,
    title: 'Cookies',
    description: `Which cookies ${site.name} uses.`,
    content: html`
<p>Last updated: ${UPDATED}</p>
<p>${site.name} does not set advertising, analytics or tracking cookies, so there is no cookie banner.</p>
<h2>Strictly necessary</h2>
<p>Our hosting provider Cloudflare may set short-lived security cookies to protect the site from bots. If you use the newsletter form, Cloudflare Turnstile checks that you are a person. These are needed for the site to work safely and do not track you across sites.</p>
<h2>Saved on your device</h2>
<p>Your browser's local storage keeps your language, currency, compare list${site.cart ? ` and ${site.cart.name}` : ''}, so they are still there on your next visit. This information is not a cookie, is not sent to us and is not used for tracking. Clearing your browser data removes it.</p>
<h2>After you leave this site</h2>
<p>When you select a "View at" button, Awin and the retailer may set cookies on their own websites to record the referral. You can manage those in your browser settings.</p>`
  }),

  '/terms/': site => ({
    legal: true,
    title: 'Terms of use',
    description: `The terms for using ${site.name}.`,
    content: html`
<p>Last updated: ${UPDATED}</p>
<p>These terms apply when you use ${site.domain}, operated by ${operator(site)}. By using the site you accept them.</p>
<h2>What the site does</h2>
<p>${site.name} shows product information and prices supplied by retailers. We do not sell products. Any purchase is a contract between you and the retailer, on the retailer's terms.</p>
<h2>Accuracy</h2>
<p>We work to keep information correct, but prices, stock and product details come from retailers and can change or contain errors. Always check the details on the retailer's website before you buy.</p>
<h2>Links to other websites</h2>
<p>We are not responsible for the content, products or services of the websites we link to.</p>
<h2>Using the site</h2>
<p>You may use the site for personal, non-commercial purposes. Do not copy the site's content in bulk, scrape it, or try to disrupt or gain unauthorised access to it.</p>
<h2>Liability</h2>
<p>Nothing in these terms limits liability that cannot be limited by law. Otherwise we are not liable for losses arising from your use of the site or from purchases made with retailers.</p>
<h2>Law</h2>
<p>These terms are governed by the law of England and Wales.</p>
<h2>Contact</h2>
<p>${contactLink(site)}</p>`
  })
};

export function infoPaths() {
  return Object.keys(PAGES);
}

export function infoPage(site, path) {
  const make = PAGES[path];
  if (!make) return null;
  const p = make(site);
  const crumbs = [{ name: 'Home', path: '/' }, { name: p.title, path }];
  const body = html`
<div class="wrap narrow">
  ${breadcrumbs(crumbs)}
  <article class="prose">
    <h1>${p.title}</h1>
    ${p.legal ? html`<p class="lang-note" data-lang-note hidden>This page is available in English only.</p>
    <div translate="no">${p.content}</div>` : p.content}
  </article>
</div>`;
  return page(site, {
    title: `${p.title} | ${site.name}`,
    description: p.description,
    path,
    body,
    schema: [breadcrumbSchema(site, crumbs)]
  });
}

// The search box is the header's: one per page (lessons L03).
export function notFoundPage(site, path) {
  const body = html`
<div class="wrap narrow">
  <article class="prose">
    <h1>Page not found</h1>
    <p>There is no page at this address. The product may have been removed by the retailer.</p>
    <h2>Browse a category</h2>
    <ul class="chip-list">${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}">${c.name}</a></li>`)}</ul>
  </article>
</div>`;
  return page(site, {
    title: `Page not found | ${site.name}`,
    description: 'This page does not exist.',
    path,
    canonical: null,
    robots: 'noindex,follow',
    body
  });
}

export function errorPage(site) {
  const body = html`
<div class="wrap narrow">
  <article class="prose">
    <h1>${tr('Something went wrong')}</h1>
    <p>${tr('The page could not load. Please try again in a minute.')} <a href="/">${tr('Go to the home page')}</a></p>
  </article>
</div>`;
  return page(site, { title: `Error | ${site.name}`, description: 'Error', path: '/', canonical: null, robots: 'noindex,nofollow', body });
}
