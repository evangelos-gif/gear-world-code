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

// The legal texts last changed on 9 Nov 2026 (the retailer links go through Awin or CJ, Google Ads compliance, lessons
// L107; before: 8 Nov 2026, Cloudflare Turnstile on the "Get deal updates" form, L106; 7 Nov 2026, who runs Gear World,
// L101); keep this date honest (L103).
const UPDATED = '9 November 2026';

// Who runs the network and how to reach them, the same on every site and on the Hub (Google Ads review, 7 Nov 2026,
// lessons L101). Owner's decision, 7 Nov 2026: "Run by Evangelos Kalogerakis, United Kingdom" and the email, no address.
export const NETWORK_EMAIL = 'contact@gearworldhub.com';

const PAGES = {
  // About, money and contact pages are translated (lessons L24): whole sentences only, no link in the middle of
  // a sentence, so each language can order the words its own way. Legal pages (legal: true) stay in English.
  '/about/': site => ({
    title: 'About us',
    description: `What ${site.name} is, where the prices come from and how the site is run.`,
    content: html`
<p class="about-lead">Gear World is a network of independent product search and price-comparison sites from the same publisher. We do not sell products, take payments or handle deliveries. Every product links to the retailer that sells it, and we may earn a commission through the Awin and CJ affiliate networks.</p>
<p class="about-run"><span>Run by Evangelos Kalogerakis, United Kingdom</span></p>
<p class="about-contact"><span>Contact:</span> <a href="mailto:${NETWORK_EMAIL}" translate="no">${NETWORK_EMAIL}</a></p>
<p>${site.retailersFromEurope
  ? tr('{0} is an independent price comparison site. It lists products from retailers in the UK and Europe, so you can compare prices in one place and then buy from the retailer you choose.', site.name)
  : tr('{0} is an independent price comparison site. It lists products from many retailers, so you can compare prices in one place and then buy from the retailer you choose.', site.name)}</p>
<h2>What you can compare</h2>
<ul class="chip-list">${site.categories.map(c => html`<li><a href="${categoryPath(c.slug)}">${c.name}</a></li>`)}</ul>
<h2>Where the prices come from</h2>
<p>Retailers publish product feeds through the Awin and CJ affiliate networks. We import those feeds, sort the products into categories and show the price, stock and condition that the retailer reports. Each product page shows the date the price was last checked.</p>
<p>A product whose price has not been checked for more than 30 days is no longer listed. After 14 days we ask you to check the price and stock at the retailer. You see only the retailers that deliver to your country. Prices can change after a check, so the retailer's website always has the final price.</p>
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
<p>When you select a "View at" button, you go to the retailer through an affiliate network, Awin or CJ. If you then buy something, the retailer may pay us a commission. You pay the same price as you would if you went to the retailer directly.</p>
<h2>How this affects what you see</h2>
<p>We do not rank products by commission. The default order mixes products in stock first, and you can sort by price, newest or furthest below RRP at any time. A retailer cannot pay to change a price or a product's position on this site.</p>
<h2>RRP</h2>
<p>When a retailer's feed lists a recommended retail price (RRP), we show it as "RRP" next to the price. An RRP is the price the brand or the retailer recommends, not a price the product was sold at before, so we do not present it as a saving.</p>`
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
<p>The data controller is ${operator(site)}, run by Evangelos Kalogerakis, United Kingdom. Contact: ${contactLink(site)}.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Clicks to retailers.</strong> When you select a "View at" button we record the product, the retailer, the page you were on, the date and your country as reported by our hosting provider. We do not record your IP address or anything that identifies you. We use this to understand which products are useful (legitimate interests). If you came to this site from one of our ads or campaign links, the campaign name and source of that link (utm_campaign, utm_source) go with the click to Awin, so we can see which campaigns are useful. They do not identify you.</li>
${site.dealUpdates ? html`<li><strong>Deal updates.</strong> If you sign up with the "Get deal updates" form, we keep your email address, the site you signed up on, the date and the consent you gave. The list is shared by the Gear World sites and kept by Gear World Hub (gearworldhub.com), and the emails are sent for us by MailerLite (our email service provider). We use it only to send deal and new-site emails (consent). Every email has an unsubscribe link, and you can also ask us by email to delete your address.</li>
<li><strong>Abuse protection.</strong> To stop automated abuse of the form we keep a one-way scrambled (hashed) form of your IP address for up to one hour, and the form uses Cloudflare Turnstile, which checks that you are a person when you start to fill it in (legitimate interests).</li>` : html`<li><strong>Newsletter.</strong> If you sign up, we keep your email address, the date and the consent text you agreed to. We use it only to send the newsletter (consent). You can withdraw consent at any time by emailing us, and we will delete your address.</li>
<li><strong>Abuse protection.</strong> To stop automated abuse of forms we keep a one-way scrambled (hashed) form of your IP address for up to one hour, and the form uses Cloudflare Turnstile (legitimate interests).</li>`}
<li><strong>Hosting.</strong> The site is hosted by Cloudflare, which processes technical data such as IP addresses to deliver and protect the site.</li>
${site.voiceSearch ? html`<li><strong>Voice search.</strong> If you press the microphone button, your browser asks for permission and its own speech service turns what you say into text (for example Google in Chrome, Apple in Safari). Their privacy policies apply to that step. We receive only the text, as a normal search, and we do not record audio.</li>` : ''}
${site.cart || (site.languages || []).length > 1 ? html`<li><strong>Choices kept on your device.</strong> Your browser remembers your language, currency, compare list${site.cart ? ' and saved list' : ''} in its local storage. This stays on your device and is not sent to us. You can clear it in your browser settings.</li>` : ''}
</ul>
<h2>Cookies and tracking</h2>
${site.googleAds === false ? html`<p>We do not use advertising or tracking cookies. See the <a href="/cookies/">cookies page</a> for details.</p>` : html`<p>Only if you select "Allow" in the cookie banner, we use Google Ads (Google Ireland Limited) to measure which of our ads bring visitors and which visits lead to a click to a retailer. Google then sets its cookies on this site and receives details of your visit, such as the page, a click on a "View at" button, the ad click identifier and your IP address. We do not use Google for personalised advertising (remarketing). Legal basis: your consent. You can change your choice at any time with "Cookie settings" at the bottom of every page. The <a href="https://policies.google.com/privacy">Google privacy policy</a> applies to the data Google receives. If you select "Reject", or make no choice, nothing is sent to Google. See the <a href="/cookies/">cookies page</a> for details.</p>`}
<h2>When you go to a retailer</h2>
<p>Retailer links go through an affiliate network: Awin, or for a few retailers CJ (Commission Junction). The network and the retailer may set their own cookies to record that you came from this site. Their privacy policies apply on their websites: the <a href="https://www.awin.com/gb/privacy">Awin privacy policy</a> and the <a href="https://www.cj.com/legal/privacy">CJ privacy policy</a>.</p>
<h2>Sharing and transfers</h2>
<p>We do not sell personal data. Our service providers (Cloudflare${site.dealUpdates ? ', MailerLite' : ''}${site.googleAds === false ? '' : ' and, only after you allow it, Google'}) may process data outside the UK with appropriate safeguards.</p>
<h2>How long we keep data</h2>
<p>Click records: up to 26 months. ${site.dealUpdates ? 'Deal updates' : 'Newsletter'}: until you unsubscribe. Abuse protection: up to one hour.${site.googleAds === false ? '' : ' Google Ads cookies: up to 90 days, or until you select "Reject".'}</p>
<h2>Your rights</h2>
<p>You can ask for access to, correction or deletion of your data, ask us to restrict or stop using it, and ask for a copy. Email ${contactLink(site)}. You can also complain to the Information Commissioner's Office at <a href="https://ico.org.uk/">ico.org.uk</a>.</p>`
  }),

  '/cookies/': site => ({
    legal: true,
    title: 'Cookies',
    description: `Which cookies ${site.name} uses.`,
    content: html`
<p>Last updated: ${UPDATED}</p>
${site.googleAds === false ? html`<p>${site.name} does not set advertising, analytics or tracking cookies, so there is no cookie banner.</p>` : html`<p>${site.name} sets advertising cookies only if you select "Allow" in the cookie banner. Until then, and if you select "Reject", no request goes to Google and no Google cookie is set. You can change your choice at any time with "Cookie settings" at the bottom of every page.</p>
<h2>Optional: Google Ads (only after "Allow")</h2>
<p>The Google tag measures which of our ads bring visitors and when a visit leads to a click on a "View at" button or a discount code. It does not show you personalised ads (remarketing is off). Cookies: <code>_gcl_au</code>, and <code>_gcl_aw</code> or similar <code>_gcl_</code> cookies when you came from a Google ad, each kept up to 90 days. Selecting "Reject" later removes them from this site. The <a href="https://policies.google.com/privacy">Google privacy policy</a> applies.</p>`}
<h2>Strictly necessary</h2>
<p>Our hosting provider Cloudflare may set short-lived security cookies to protect the site from bots. ${site.dealUpdates ? 'If you use the "Get deal updates" form, Cloudflare Turnstile checks that you are a person. ' : 'If you use the newsletter form, Cloudflare Turnstile checks that you are a person. '}These are needed for the site to work safely and do not track you across sites.</p>
<h2>Saved on your device</h2>
<p>Your browser's local storage keeps your language, currency, compare list${site.cart ? ` and ${site.cart.name}` : ''}${site.googleAds === false ? '' : ' and your cookie choice'}, so they are still there on your next visit. This information is not a cookie, is not sent to us and is not used for tracking. Clearing your browser data removes it.${site.googleAds === false ? '' : ' Only after "Allow", the campaign name of the link you arrived from (utm_campaign, utm_source) is kept in this browser tab until you close it, so a later click to a retailer still counts for that campaign.'}</p>
<h2>After you leave this site</h2>
<p>When you select a "View at" button, the affiliate network (Awin or CJ) and the retailer may set cookies on their own websites to record the referral. You can manage those in your browser settings.</p>`
  }),

  '/terms/': site => ({
    legal: true,
    title: 'Terms of use',
    description: `The terms for using ${site.name}.`,
    content: html`
<p>Last updated: ${UPDATED}</p>
<p>These terms apply when you use ${site.domain}, operated by ${operator(site)} (run by Evangelos Kalogerakis, United Kingdom). By using the site you accept them.</p>
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

// The answer to the "Get deal updates" form when it is sent without JavaScript (a normal form post).
export function dealUpdatesPage(site, ok, message) {
  const body = html`
<div class="wrap narrow">
  <article class="prose">
    <h1>${ok ? 'You are signed up' : 'Not signed up yet'}</h1>
    <p>${message}</p>
    <p><a href="/">${tr('Go to the home page')}</a></p>
  </article>
</div>`;
  return page(site, { title: `Deal updates | ${site.name}`, description: 'Deal updates sign-up.', path: '/api/newsletter', canonical: null, robots: 'noindex,nofollow', body });
}
