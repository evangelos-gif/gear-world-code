// Gear World Hub - legal pages (Privacy, Cookies, Terms, Affiliate disclosure, Contact) and footer links.
//   node tools/gwh-legal-pages.mjs --hub <hub folder>            plan only (prints JSON, changes nothing)
//   node tools/gwh-legal-pages.mjs --hub <hub folder> --write    writes the pages and the footer links
// The pages are static files in the hub's public/ folder, served by Cloudflare at /privacy/, /cookies/ ...
// worker.js, the hub D1 and the other hub files are never touched (lessons L01, L04, L17).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const HUB = { name: 'Gear World Hub', domain: 'gearworldhub.com', operator: 'Gear World', email: 'contact@gearworldhub.com' };
export const UPDATED = '22 October 2026';
// The privacy policy changed on its own when the Gear World app section was added.
export const PRIVACY_UPDATED = '23 October 2026';
const ASSET_V = '20261022';

export const PAGES = [
  { slug: 'privacy', label: 'Privacy' },
  { slug: 'cookies', label: 'Cookies' },
  { slug: 'terms', label: 'Terms' },
  { slug: 'affiliate-disclosure', label: 'Affiliate disclosure' },
  { slug: 'contact', label: 'Contact' }
];

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mail = `<a href="mailto:${HUB.email}">${HUB.email}</a>`;
const updated = `<p class="lg-updated">Last updated: ${UPDATED}</p>`;
const privacyUpdated = `<p class="lg-updated">Last updated: ${PRIVACY_UPDATED}</p>`;

const CONTENT = {
  privacy: {
    title: 'Privacy policy',
    description: 'How Gear World Hub and the Gear World app handle personal data.',
    body: `${privacyUpdated}
<p>This policy explains what personal data ${HUB.name} (${HUB.domain}) and the Gear World app for Android and iPhone use, why, and your rights under UK data protection law (UK GDPR and the Data Protection Act 2018) and, where it applies to you, the EU GDPR.</p>
<h2>Who is responsible</h2>
<p>The data controller is ${HUB.operator}. Contact: ${mail}.</p>
<h2>What we use and why</h2>
<ul>
<li><strong>Search.</strong> When you search, your search words, and your delivery country if you choose one, are sent to the Gear World sites to find matching products. Searches in a language other than English may be translated into English by Cloudflare Workers AI, inside our hosting provider. We do not store your searches or link them to you. We do this to give you the results you asked for (legitimate interests).</li>
<li><strong>Voice search.</strong> If you use the microphone button, your browser turns your speech into text with its own speech service (for example Google in Chrome or Apple in Safari). Your browser asks for permission first. We receive only the text, never the recording.</li>
<li><strong>Newsletter.</strong> If you sign up, we keep your email address, your language, the date and the version of the consent text you agreed to. We use them only to send Gear World updates (consent). You can withdraw your consent at any time by emailing us, and we will delete your address.</li>
<li><strong>Analytics, only if you allow it.</strong> If you select "Allow analytics", we use Google Analytics 4 to count visits and see which parts of the Hub are used (consent). Google Signals and ad personalisation are switched off, and Google Analytics does not store IP addresses. If you select "Reject", Google Analytics is not loaded at all. You can change your choice at any time on the <a href="/cookies/">cookies page</a>.</li>
<li><strong>Hosting, security and visit counts.</strong> The Hub is hosted by Cloudflare, which processes technical data such as IP addresses to deliver the site and protect it from attacks. Cloudflare Web Analytics also counts page visits and measures loading speed without cookies and without following you across other websites (legitimate interests).</li>
</ul>
<h2>The Gear World app</h2>
<p>The Gear World app shows the same Gear World sites and products as the Hub. It has no accounts, no ads and no analytics.</p>
<ul>
<li><strong>Search.</strong> Searches in the app work like searches on the Hub (see above). The app does not store your searches.</li>
<li><strong>Voice search.</strong> If you tap the microphone button, the app asks for permission to use the microphone (and, on iPhone, speech recognition). Your phone's own speech service, Google on Android or Apple on iPhone, turns your speech into text under Google's or Apple's privacy terms. The app uses only the text, as your search. The app does not record or keep audio. You can turn microphone access off at any time in your phone's settings.</li>
<li><strong>Newsletter.</strong> Signing up in the app works exactly like signing up on the Hub (see above).</li>
<li><strong>Stored on your phone.</strong> The app keeps your chosen language and a copy of the list of Gear World sites on your phone, so it starts quickly. This stays on your phone and is deleted when you uninstall the app.</li>
<li><strong>Retailer links.</strong> When you tap "View at", the retailer's website opens in your phone's browser through the Gear World site and the Awin affiliate network (see "When you leave the Hub" below).</li>
</ul>
<h2>Cookies</h2>
<p>See the <a href="/cookies/">cookies page</a> for the full list and to change your analytics choice.</p>
<h2>When you leave the Hub</h2>
<p>The Hub links to the Gear World specialist sites, which have their own privacy policies. Links to retailers on those sites, and partner links on the Hub, go through the Awin affiliate network. Awin and the retailer may set their own cookies to record that you came from Gear World. Their privacy policies apply on their websites, for example the <a href="https://www.awin.com/gb/privacy">Awin privacy policy</a>.</p>
<h2>Sharing and transfers</h2>
<p>We do not sell personal data. Our service providers, Cloudflare and, only if you allowed analytics, Google, may process data outside the UK. Where they do, they use the safeguards required by law, such as standard contractual clauses.</p>
<h2>How long we keep data</h2>
<ul>
<li>Newsletter: until you withdraw your consent.</li>
<li>Analytics: for the retention period set in our Google Analytics account, at most 14 months.</li>
<li>Searches: not stored by us.</li>
</ul>
<h2>Children</h2>
<p>The Hub and the app are a shopping directory for adults. They are not aimed at children under 16, and we do not knowingly collect their data.</p>
<h2>Your rights</h2>
<p>You can ask for access to, correction or deletion of your data, ask us to restrict or stop using it, object to its use, and ask for a copy. Email ${mail}. You can also complain to the Information Commissioner's Office at <a href="https://ico.org.uk/">ico.org.uk</a>, or to the data protection authority in your country.</p>
<h2>Changes to this policy</h2>
<p>When we change how we use personal data, we will update this page and the date at the top.</p>`
  },

  cookies: {
    title: 'Cookies',
    description: 'Which cookies and browser storage Gear World Hub uses, and how to change your analytics choice.',
    body: `${updated}
<p>${HUB.name} uses a small number of cookies and similar browser storage. Analytics cookies are set only if you allow them.</p>
<div class="lg-table-wrap"><table>
<thead><tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">What it does</th><th scope="col">How long</th></tr></thead>
<tbody>
<tr><td data-label="Name"><span><code>gwh-language</code></span></td><td data-label="Type"><span>Browser storage, necessary</span></td><td data-label="What it does"><span>Remembers the language you chose</span></td><td data-label="How long"><span>Until you clear your browser data</span></td></tr>
<tr><td data-label="Name"><span><code>gwh_analytics_consent</code></span></td><td data-label="Type"><span>Browser storage, necessary</span></td><td data-label="What it does"><span>Remembers whether you allowed or rejected analytics</span></td><td data-label="How long"><span>Until you reset it below or clear your browser data</span></td></tr>
<tr><td data-label="Name"><span><code>_ga</code>, <code>_ga_*</code></span></td><td data-label="Type"><span>Cookie, Google Analytics, optional</span></td><td data-label="What it does"><span>Tells visits apart so we can count them. Set only after you select "Allow analytics"</span></td><td data-label="How long"><span>Up to 2 years</span></td></tr>
<tr><td data-label="Name"><span><code>__cf_bm</code> and similar</span></td><td data-label="Type"><span>Cookie, Cloudflare, necessary</span></td><td data-label="What it does"><span>Protects the site from automated abuse</span></td><td data-label="How long"><span>Up to 30 minutes</span></td></tr>
</tbody>
</table></div>
<p>Cloudflare Web Analytics, which counts page visits, does not use cookies or browser storage.</p>
<h2>Your analytics choice</h2>
<p id="gwhAnalyticsStatus" class="lg-status" aria-live="polite">To see or change your choice, turn on JavaScript, or clear this site's data in your browser settings.</p>
<p><button type="button" id="gwhAnalyticsReset" class="lg-button" hidden>Reset my analytics choice</button></p>
<p>After a reset, the Hub asks you again on your next visit. Resetting also removes the Google Analytics cookies from this site.</p>
<h2>After you leave the Hub</h2>
<p>When you follow a link to a Gear World site or to a retailer, those websites, and the Awin affiliate network, may set their own cookies. You can manage those in your browser settings.</p>`
  },

  terms: {
    title: 'Terms of use',
    description: 'The terms for using Gear World Hub.',
    body: `${updated}
<p>These terms apply when you use ${HUB.domain}, operated by ${HUB.operator}. By using the site you accept them.</p>
<h2>What the Hub does</h2>
<p>${HUB.name} helps you find products across the Gear World specialist sites. We do not sell products, take payments or handle deliveries. Any purchase is a contract between you and the retailer, on the retailer's terms.</p>
<h2>Accuracy</h2>
<p>Product details, prices and stock come from retailers and can change or contain errors. Always check the details on the retailer's website before you buy.</p>
<h2>Links to other websites</h2>
<p>We are not responsible for the content, products or services of the websites we link to.</p>
<h2>Using the site</h2>
<p>You may use the site for personal, non-commercial purposes. Do not copy its content in bulk, scrape it, or try to disrupt it or gain unauthorised access to it.</p>
<h2>Liability</h2>
<p>Nothing in these terms limits liability that cannot be limited by law. Otherwise we are not liable for losses arising from your use of the site or from purchases made with retailers.</p>
<h2>Law</h2>
<p>These terms are governed by the law of England and Wales. If you live elsewhere, you keep any rights that the law of your country gives you.</p>
<h2>Contact</h2>
<p>${mail}</p>`
  },

  'affiliate-disclosure': {
    title: 'Affiliate disclosure',
    description: 'How the Gear World network earns money through affiliate links.',
    body: `${updated}
<p>${HUB.name} is free to use. The Gear World network earns money through affiliate links.</p>
<h2>How it works</h2>
<p>On the Gear World sites, the buttons that take you to a retailer go through the Awin affiliate network. If you then buy something, the retailer may pay Gear World a commission. You pay the same price as you would if you went to the retailer directly.</p>
<h2>On the Hub</h2>
<p>Most links on the Hub take you to the Gear World specialist sites. Some links, such as partner banners, are affiliate links, and Gear World may earn a commission if you buy through them.</p>
<h2>What it does not change</h2>
<p>The Hub search orders products by how well they match your search words, not by commission. A retailer cannot pay to change a price or a product's position in the search results.</p>`
  },

  contact: {
    title: 'Contact',
    description: 'How to contact Gear World Hub.',
    body: `<p>For questions about Gear World Hub or the Gear World sites, and for partnership enquiries, email ${mail}.</p>
<p>We cannot help with orders, deliveries, returns or refunds, because we do not sell products. For those, please contact the retailer you bought from.</p>
<p>For questions about your personal data, see the <a href="/privacy/">privacy policy</a>.</p>`
  }
};

function legalNav(current) {
  return PAGES.map(p => p.slug === current
    ? `<a href="/${p.slug}/" aria-current="page">${p.label}</a>`
    : `<a href="/${p.slug}/">${p.label}</a>`).join('\n      ');
}

export function pageHtml(slug) {
  const c = CONTENT[slug];
  if (!c) throw new Error('unknown page ' + slug);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.title)} | ${HUB.name}</title>
<meta name="description" content="${esc(c.description)}">
<link rel="canonical" href="https://${HUB.domain}/${slug}/">
<meta name="robots" content="index,follow">
<link rel="stylesheet" href="/legal/legal.css?v=${ASSET_V}">
</head>
<body>
<header class="lg-header">
  <div class="lg-wrap"><a class="lg-brand" href="/">Gear <span>World</span> Hub</a></div>
</header>
<main class="lg-wrap lg-main">
  <nav class="lg-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">/</span> <span>${esc(c.title)}</span></nav>
  <article class="lg-prose">
<h1>${esc(c.title)}</h1>
${c.body}
  </article>
</main>
<footer class="lg-footer">
  <div class="lg-wrap">
    <nav class="lg-legal" aria-label="Legal">
      ${legalNav(slug)}
    </nav>
    <p>${mail}</p>
    <p>&copy; <span id="lgYear">2026</span> ${HUB.operator}. All rights reserved.</p>
  </div>
</footer>
<script src="/legal/legal.js?v=${ASSET_V}" defer></script>
</body>
</html>
`;
}

export const LEGAL_CSS = `/* Gear World Hub - legal pages. Same colours as the hub; light text on dark, links underlined (lessons L21, L35). */
:root { --bg: #08111f; --card: #101c2e; --text: #f5f7fb; --muted: #c9d4e3; --gold: #ffc94d; --border: rgba(255,255,255,.14); }
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font: 17px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
a { color: var(--gold); text-decoration: underline; text-underline-offset: 3px; }
a:hover, a:focus-visible { color: #fff; }
.lg-wrap { width: min(100% - 32px, 820px); margin: 0 auto; }
.lg-header { border-bottom: 1px solid var(--border); background: var(--card); }
.lg-header .lg-wrap { min-height: 64px; display: flex; align-items: center; }
.lg-brand { color: #fff; font-weight: 800; font-size: 20px; text-decoration: none; letter-spacing: .2px; }
.lg-brand span { color: var(--gold); }
.lg-main { padding: 20px 0 48px; }
.lg-crumbs { color: var(--muted); font-size: 15px; margin-bottom: 8px; }
.lg-prose h1 { font-size: clamp(28px, 6vw, 40px); line-height: 1.2; margin: 8px 0 12px; }
.lg-prose h2 { font-size: 21px; margin: 32px 0 8px; color: #fff; }
.lg-prose p, .lg-prose li { color: var(--muted); }
.lg-prose strong { color: #fff; }
.lg-prose ul { padding-left: 22px; }
.lg-prose li { margin-bottom: 10px; }
.lg-updated { font-size: 15px; }
.lg-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
table { width: 100%; border-collapse: collapse; font-size: 15px; min-width: 560px; }
th, td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid var(--border); }
th { color: #fff; background: var(--card); }
td { color: var(--muted); }
code { color: #fff; font-size: 14px; }
@media (max-width: 640px) {
  table { min-width: 0; }
  thead { display: none; }
  tr { display: block; padding: 6px 0; border-bottom: 1px solid var(--border); }
  td { display: grid; grid-template-columns: 112px 1fr; gap: 10px; border: 0; padding: 6px 12px; }
  td::before { content: attr(data-label); color: #fff; font-weight: 600; }
}
.lg-status { color: #fff; font-weight: 600; }
.lg-button { min-height: 44px; padding: 10px 18px; border-radius: 10px; border: 2px solid var(--gold); background: var(--gold); color: #08111f; font: inherit; font-weight: 700; cursor: pointer; }
.lg-button:hover, .lg-button:focus-visible { background: #fff; border-color: #fff; }
.lg-footer { border-top: 1px solid var(--border); padding: 24px 0 32px; color: var(--muted); font-size: 15px; }
.lg-legal { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-bottom: 8px; }
.lg-legal a { display: inline-block; min-height: 40px; line-height: 40px; }
.lg-legal a[aria-current="page"] { color: #fff; font-weight: 700; }
`;

export const LEGAL_JS = `// Gear World Hub - legal pages: footer year and the analytics choice on /cookies/.
(function () {
  "use strict";
  var KEY = "gwh_analytics_consent";
  var y = document.getElementById("lgYear");
  if (y) y.textContent = String(new Date().getFullYear());
  var status = document.getElementById("gwhAnalyticsStatus");
  var button = document.getElementById("gwhAnalyticsReset");
  if (!status || !button) return;
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function show() {
    var v = read();
    status.textContent = v === "granted" ? "Your choice: analytics allowed."
      : v === "denied" ? "Your choice: analytics rejected."
      : "You have not made a choice yet. The Hub will ask you on the home page.";
  }
  function dropGaCookies() {
    var host = location.hostname.replace(/^www\\./, "");
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (!/^_ga/.test(name)) return;
      ["", "; domain=" + host, "; domain=." + host].forEach(function (d) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
      });
    });
  }
  button.hidden = false;
  button.addEventListener("click", function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    dropGaCookies();
    status.textContent = "Your choice has been reset. The Hub will ask you again on the home page.";
  });
  show();
})();
`;

/** All files the hub needs, keyed by path relative to public/ (forward slashes). */
export function legalFiles() {
  const files = {};
  for (const p of PAGES) files[`${p.slug}/index.html`] = pageHtml(p.slug);
  files['legal/legal.css'] = LEGAL_CSS;
  files['legal/legal.js'] = LEGAL_JS;
  return files;
}

const FOOTER_MARK = '<!-- GWH-LEGAL-LINKS -->';
const COPYRIGHT = /<span>&copy; <span id="year"><\/span> Gear World\. All rights reserved\.<\/span>/g;

/** Adds the legal links to the hub footer, right after the copyright line. Throws if the footer is not as expected. */
export function patchFooter(indexHtml) {
  if (indexHtml.includes(FOOTER_MARK)) return { already: true, text: indexHtml };
  const found = indexHtml.match(COPYRIGHT) || [];
  if (found.length !== 1) throw new Error(`Footer: expected the copyright line once, found it ${found.length} times`);
  if ((indexHtml.match(/<\/footer>/g) || []).length !== 1) throw new Error('Footer: expected one </footer>');
  const nl = indexHtml.includes('\r\n') ? '\r\n' : '\n';
  const style = 'color:inherit;text-decoration:underline;text-underline-offset:3px;display:inline-block;min-height:40px;line-height:40px;';
  const links = PAGES.map(p => `<a href="/${p.slug}/" style="${style}">${p.label}</a>`).join('');
  const nav = [
    `      ${FOOTER_MARK}`,
    `      <nav class="footer-legal" aria-label="Legal" style="display:flex;flex-wrap:wrap;gap:0 16px;">${links}</nav>`
  ].join(nl);
  const text = indexHtml.replace(COPYRIGHT, m => m + nl + nav);
  return { already: false, text };
}

function readIf(p) { return existsSync(p) ? readFileSync(p, 'utf8') : null; }

/** Plans (and with write=true applies) the change in a hub folder. Never touches anything else. */
export function run(hubDir, write = false) {
  const pub = join(hubDir, 'public');
  const indexPath = join(pub, 'index.html');
  if (!existsSync(indexPath)) throw new Error('public/index.html not found');
  const index = readFileSync(indexPath, 'utf8');
  const footer = patchFooter(index);
  const files = legalFiles();
  const toWrite = [];
  for (const [rel, content] of Object.entries(files)) {
    const cur = readIf(join(pub, ...rel.split('/')));
    if (cur === null) toWrite.push({ rel, kind: 'new' });
    else if (cur !== content) toWrite.push({ rel, kind: 'update' });
  }
  const changes = [];
  if (!footer.already) changes.push('public\\index.html: links Privacy, Cookies, Terms, Affiliate disclosure, Contact in the footer');
  for (const f of toWrite) changes.push(`public\\${f.rel.replace(/\//g, '\\')}: ${f.kind === 'new' ? 'new page' : 'updated'}`);
  if (write) {
    for (const f of toWrite) {
      const p = join(pub, ...f.rel.split('/'));
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, files[f.rel], 'utf8');
    }
    if (!footer.already) writeFileSync(indexPath, footer.text, 'utf8');
  }
  return {
    ok: true,
    already: footer.already && toWrite.length === 0,
    changes,
    existing: toWrite.filter(f => f.kind === 'update').map(f => f.rel),
    paths: PAGES.map(p => `/${p.slug}/`)
  };
}

if (process.argv[1] && process.argv[1].endsWith('gwh-legal-pages.mjs')) {
  const a = process.argv.slice(2);
  const hub = a[a.indexOf('--hub') + 1];
  try {
    if (a.indexOf('--hub') < 0 || !hub) throw new Error('usage: --hub <folder> [--write]');
    console.log(JSON.stringify(run(hub, a.includes('--write'))));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: e.message }));
    process.exit(2);
  }
}
