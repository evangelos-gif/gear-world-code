// Discount codes and campaigns that retailers give to affiliates (lessons L32).
// Rules: only codes the retailer or Awin sent to us (never codes found elsewhere), always with an end date,
// and every button goes through /go/<id> so the visit is an Awin click with our clickref.
// Expired entries disappear from the sites by themselves; delete them here from time to time.
//
// Fields:
//   id        unique, lower case, used in /go/<id>
//   retailer  shown name; slug: address of the retailer page (/discount-codes/<slug>/)
//   awinMid   Awin advertiser id; url: landing page given by the retailer (becomes an Awin deep link)
//   sites     site codes that show it (only sites where the retailer fits)
//   kind      'code' (code, off, minSpend) or 'sale' (upTo, and optional extraOff/extraMin/day)
//   campaign  campaign name as the retailer wrote it
//   start/end first and last day (YYYY-MM-DD, UK time); bar: emoji shown in the top bar (one per site)
//   source    where it came from, for checking later

export const AWIN_PUBLISHER_ID = 3057233;

const JOYBUY = { retailer: 'Joybuy', slug: 'joybuy', awinMid: 123932, currency: 'GBP' };
const JOYBUY_EMAIL = 'Awin email "Joybuy UK" to UK partners, received 20 Oct 2026';
const HALLOWEEN = 'https://www.joybuy.co.uk/campaign/active/2hGagKjWWkaR2Kxt1wwwT8LAwXWK';

export const PROMOS = [
  { ...JOYBUY, id: 'joybuy-halloween', kind: 'code', campaign: 'Halloween', code: 'halloween', off: 4, minSpend: 20,
    url: HALLOWEEN, sites: ['TGW', 'MGW', 'WGW', 'HGW', 'KGW'], start: '2026-10-20', end: '2026-12-31', bar: '🎃', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-beauty', kind: 'code', campaign: 'Halloween', code: 'beauty', off: 5, minSpend: 30,
    url: HALLOWEEN, sites: ['TGW', 'MGW', 'WGW', 'HGW', 'KGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-sports', kind: 'code', campaign: 'Halloween', code: 'sports', off: 5, minSpend: 45,
    url: HALLOWEEN, sites: ['TGW', 'MGW', 'WGW', 'HGW', 'KGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-tools', kind: 'code', campaign: 'Halloween', code: 'tools', off: 15, minSpend: 100,
    url: HALLOWEEN, sites: ['TGW', 'MGW', 'WGW', 'HGW', 'KGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-household', kind: 'sale', campaign: 'Household & Cleaning', upTo: 60, extraOff: 5, extraMin: 20, day: 'Thursday',
    url: 'https://www.joybuy.co.uk/campaign/active/WaWN6fWUxoEaEDqiHQcjqvfmPky', sites: ['HGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-home-pet', kind: 'sale', campaign: 'Home & Living & Pet', upTo: 50,
    url: 'https://www.joybuy.co.uk/campaign/active/8mf2xXjoDh2G5uWeA2efD3uQKxz', sites: ['HGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-baby', kind: 'sale', campaign: 'Baby', upTo: 60,
    url: 'https://www.joybuy.co.uk/campaign/active/3ch27U9EYB1mZUfSbrzEq886jtsx', sites: ['KGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-hotpot', kind: 'sale', campaign: 'Hotpot & Asian Food', upTo: 20,
    url: 'https://www.joybuy.co.uk/minihome/UK-Mini-HP-CN-Food', sites: ['HGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL }
];

export function promosFor(siteCode) {
  return PROMOS.filter(p => p.sites.includes(siteCode));
}
