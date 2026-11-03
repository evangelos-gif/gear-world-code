// Google Ads on the Gear World sites and the Hub (lessons L93).
// - The Google tag (gtag.js) loads ONLY after the visitor selects "Allow" in the cookie banner (UK GDPR / PECR,
//   consent mode v2 "basic"): before that no request goes to Google and no Google cookie is set.
// - Conversion "outbound_click": a click on /out/ ("View at <retailer>") or /go/ (a discount code). It is sent only
//   when OUTBOUND_LABEL is filled in (the label comes from the Google Ads account) and the visitor allowed it.
// - utm_source / utm_campaign: kept for the visit, then passed with the click to Awin as clickref2 / clickref3,
//   so the Awin reports show clicks and sales per campaign. No database change.

export const GOOGLE_ADS_ID = 'AW-18554591090';
// The conversion label of the "outbound_click" conversion action (Google Ads > Goals > Conversions).
// Conversion action "Outbound click" (count: one, enhanced conversions off), created 3/11/2026. Empty: nothing is sent.
export const OUTBOUND_LABEL = 'Y2PgCP3X0bEdEPKuwo9F';

// Every Gear World domain: the Google tag passes the click id across them (cross-domain linker).
export const GEAR_WORLD_DOMAINS = [
  'gearworldhub.com', 'constructiongearworld.com', 'mensgearworld.com', 'womensgearworld.com', 'kidsgearworld.com',
  'homegearworld.com', 'gardengearworld.com', 'sportygearworld.com', 'technologygearworld.com', 'cargearworld.com',
  'travelgearworld.com', 'bikergearworld.com', 'gaminggearworld.com', 'petsgearworld.com'
];

// A campaign name from a link: letters, digits, - _ . only, up to 40 characters. Anything else is dropped,
// so nothing odd (an email address, a script) ever reaches Awin.
export function cleanUtm(value) {
  const v = String(value == null ? '' : value).trim().slice(0, 40);
  return /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v) && !v.includes('@') ? v : '';
}

// The extra Awin click references of a /out/ or /go/ click: clickref2 = campaign, clickref3 = source.
export function campaignRefs(url) {
  const p = url && url.searchParams ? url.searchParams : new URLSearchParams();
  const refs = {};
  const campaign = cleanUtm(p.get('utm_campaign'));
  const source = cleanUtm(p.get('utm_source'));
  if (campaign) refs.clickref2 = campaign;
  if (source) refs.clickref3 = source;
  return refs;
}
