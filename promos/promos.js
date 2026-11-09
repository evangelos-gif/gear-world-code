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
//   kind      'code' (code, off, minSpend), 'coupon' (off, minSpend: money off with no code to type, the retailer's
//             own coupon on its page) or 'sale' (a retailer's sale: only "Joybuy sale" and the campaign name, never a
//             percentage or a saving we cannot check, Google Ads compliance, lessons L107)
//   campaign  campaign name as the retailer wrote it
//   start/end first and last day (YYYY-MM-DD, UK time); bar: emoji shown in the top bar (one per site)
//   source    where it came from, for checking later

export const AWIN_PUBLISHER_ID = 3057233;

// Seasons that may show at all (Google Ads compliance, 9 Nov 2026, lessons L107): nothing seasonal switches on by its
// dates alone. A season shows only while it is true here AND today is within its days (src/lib/seasons.js on the 13
// sites; the Hub's slides and video banner through tools/gwh-deals.mjs, which copies this list into
// sites/gwh/public/hub-v2.js). Black Friday (its countdown and the "Black Friday is coming" slide) stays false until the
// owner says so after Google answers the appeal: one line here, `node tools/gwh-deals.mjs`, then the sites and the Hub
// go out with their approval phrases. Christmas was already on (the "Gifts for everyone" banner, gift guides).
export const SEASONS_ON = {
  halloween: false,
  'black-friday': false,
  christmas: true,
  'winter-sales': false,
  'new-year-fitness': false,
  'valentines-day': false
};

const JOYBUY = { retailer: 'Joybuy', slug: 'joybuy', awinMid: 123932, currency: 'GBP' };
const JOYBUY_EMAIL = 'Awin email "Joybuy UK" to UK partners, received 20 Oct 2026';
const JOYDAY_EMAIL = 'Awin email "Joybuy UK - Joyday campaign - Oct" to UK partners, received 26 Oct 2026 (approved by the owner 28 Oct 2026)';

export const PROMOS = [
  // The four Joybuy Halloween codes (halloween, beauty, sports, tools; email of 20 Oct 2026) were removed on 9 Nov 2026:
  // a Halloween code and its top bar in November look like a stale offer (Google Ads compliance, lessons L107).
  // The Joybuy sales ran with "up to 60% off" and "£5 off £20 every Thursday" from the email; those figures were removed on
  // 9 Nov 2026 (nobody can check them product by product, lessons L107): the cards say "Sale at Joybuy" and the campaign.
  { ...JOYBUY, id: 'joybuy-household', kind: 'sale', campaign: 'Household & Cleaning',
    url: 'https://www.joybuy.co.uk/campaign/active/WaWN6fWUxoEaEDqiHQcjqvfmPky', sites: ['HGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-home-pet', kind: 'sale', campaign: 'Home & Living & Pet',
    url: 'https://www.joybuy.co.uk/campaign/active/8mf2xXjoDh2G5uWeA2efD3uQKxz', sites: ['HGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-baby', kind: 'sale', campaign: 'Baby',
    url: 'https://www.joybuy.co.uk/campaign/active/3ch27U9EYB1mZUfSbrzEq886jtsx', sites: ['KGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-hotpot', kind: 'sale', campaign: 'Hotpot & Asian Food',
    url: 'https://www.joybuy.co.uk/minihome/UK-Mini-HP-CN-Food', sites: ['HGW'], start: '2026-10-20', end: '2026-12-31', source: JOYBUY_EMAIL },
  { ...JOYBUY, id: 'joybuy-joy-day', kind: 'coupon', campaign: 'Joy Day', off: 15, minSpend: 99,
    url: 'https://www.joybuy.co.uk/campaign/active/ojYViWn7U8SqEeb4F2gE5Uw4MdW', sites: ['TGW'], start: '2026-10-26', end: '2026-10-31', source: JOYDAY_EMAIL }
];

export function promosFor(siteCode) {
  return PROMOS.filter(p => p.sites.includes(siteCode));
}
