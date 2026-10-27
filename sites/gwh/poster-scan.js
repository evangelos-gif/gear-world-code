// Poster QR scans (lessons L76). The printed A3 posters have QR codes that open a site's home page with
//   ?utm_source=poster&utm_medium=qr&utm_campaign=<poster>&utm_content=<site>
// Every Gear World Worker (the 10 sites and the Hub) counts such a visit: +1 for (day, poster, site) in the D1
// database gear-world-posters, through the private Worker gear-world-posters (service binding POSTERS; it has no
// public address, so nobody outside can send counts).
// Nothing about the visitor is kept or sent: no IP address, no cookie, no browser name. Only the poster name from the
// address (utm_campaign) and the site's own code (not utm_content: a wrong code in an address cannot count elsewhere).
// The count never slows the page (ctx.waitUntil) and never breaks it: every error is swallowed.
// This file has no imports, so the Hub uses the same code: sites/gwh/poster-scan.js is a byte-for-byte copy
// (tests/worker/posters.test.mjs checks it).

// Link previews, crawlers and scripts do not count: a scan is a person opening the page in a browser.
// The same words as the engine's bot check (src/lib/security.js), plus link fetchers of chat apps whose name has no
// "bot" or "preview" (WhatsApp, Viber, Slack), HTTP libraries and PowerShell (our own checks never count). Apps whose
// in-app browser carries the app name (Snapchat, Pinterest, Telegram) are not listed: a person can scan a QR there.
export const POSTER_BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|facebot|embedly|monitor|headless|curl|wget|python|java\/|go-http|httpclient|axios|node-fetch|scrapy|lighthouse|whatsapp|viber|slack|iframely|google-read-aloud|bitly|okhttp|powershell|postman|insomnia/i;

// The private Worker's address inside Cloudflare (any host works through a service binding).
export const POSTER_COUNT_URL = 'https://gear-world-posters/scan';

// The poster name from the address, cleaned: lower case, letters, digits and dashes, at most 40 characters.
// The counter Worker keeps only the posters it knows (anything else is counted as "other").
export function posterCampaign(url) {
  return String(url.searchParams.get('utm_campaign') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
}

// Does this request count as one poster scan? A GET of the home page, on the site's own domain (www is sent to the
// domain first and counted there, once), with utm_source=poster, opened by a person in a browser: not a bot or link
// preview, not a prefetch or prerender, not an image or script request.
export function isPosterScan(request, url, domain) {
  if (request.method !== 'GET') return false;
  if (url.hostname.toLowerCase() !== String(domain || '').toLowerCase()) return false;
  if (url.pathname !== '/') return false;
  if (String(url.searchParams.get('utm_source') || '').trim().toLowerCase() !== 'poster') return false;
  const h = request.headers;
  const ua = h.get('user-agent') || '';
  if (!ua || POSTER_BOT_UA.test(ua)) return false;
  const purpose = [h.get('sec-purpose'), h.get('purpose'), h.get('x-purpose'), h.get('x-moz')].join(' ').toLowerCase();
  if (/prefetch|prerender|preview/.test(purpose)) return false;
  const mode = h.get('sec-fetch-mode');
  if (mode && mode.toLowerCase() !== 'navigate') return false;
  const dest = h.get('sec-fetch-dest');
  if (dest && dest.toLowerCase() !== 'document') return false;
  if (!/text\/html/i.test(h.get('accept') || '')) return false;
  const cf = request.cf;
  if (cf && cf.botManagement && cf.botManagement.verifiedBot) return false;
  return true;
}

// Sends one count in the background. Returns true when a count was sent (for the tests), false otherwise.
// off: true on a test address (preview Worker), where nothing is counted.
export function posterScan(request, env, ctx, { site, domain, off = false } = {}) {
  try {
    if (off || !env || !env.POSTERS || typeof env.POSTERS.fetch !== 'function') return false;
    const url = new URL(request.url);
    if (!isPosterScan(request, url, domain)) return false;
    const body = JSON.stringify({ site: String(site || '').toLowerCase(), campaign: posterCampaign(url) });
    const call = Promise.resolve()
      .then(() => env.POSTERS.fetch(POSTER_COUNT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))
      .then(() => undefined, () => undefined);
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(call);
    return true;
  } catch {
    return false;
  }
}
