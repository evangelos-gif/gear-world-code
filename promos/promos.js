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
//   kind      'code' (code, off or pct, minSpend: money off, or pct = the retailer's own percentage, e.g. 10 for 10%,
//             lessons L186; minSpend 0 = no minimum; on: the one product line a code is for, e.g. 'iK1S', lessons L196), 'coupon' (off, minSpend: money off with no code to type, the retailer's
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

// Tooled Up and My Tool Shed: their own Black Friday voucher codes (owner's decision «Γ1», 10 Nov 2026, lessons L114).
// Only the retailers' codes show, as the retailer's campaign in the small print of the code card: no Gear World
// "Black Friday" banner, countdown or slide (SEASONS_ON['black-friday'] above stays false) and no top bar.
// Both emails say the same: the campaign runs from 9:30am Monday 9 November 2026 until midnight Sunday 6 December 2026
// (UK time), while stocks last; CLAIMFIFTY £50 off orders of £500 or more and CLAIMSEVFY £75 off orders of £750 or more,
// valid 9 Nov - 6 Dec; one voucher code per order, entered at checkout; prices and availability may change. "Coming
// soon: 15% off selected Einhell tools" is not live yet, so it is not here.
// Sites: only where the retailer has products in the UK view (live /api/stats retailer_names, 10 Nov 2026: Tooled Up on
// CGW, GGW, AGW, BGW; My Tool Shed on CGW and GGW). Both are UK retailers (deliversTo default GB on those sites).
const TOOLED_UP = { retailer: 'Tooled Up', slug: 'tooled-up', awinMid: 496, currency: 'GBP', sites: ['CGW', 'GGW', 'AGW', 'BGW'],
  url: 'https://www.tooled-up.com/black-friday-offers-while-stocks-last/landing/336/',
  source: 'Awin email "Tooled Up (496): Black Friday 2026 Is Live: Four Weekly Drops", received 9 Nov 2026 (owner\'s decision «Γ1», 10 Nov 2026)' };
const MY_TOOL_SHED = { retailer: 'My Tool Shed', slug: 'my-tool-shed', awinMid: 49385, currency: 'GBP', sites: ['CGW', 'GGW'],
  url: 'https://www.mytoolshed.co.uk/black-friday-offers-while-stocks-last/landing/336/',
  source: 'Awin email "My Tool Shed (49385): Black Friday 2026 Is Live: Four Weekly Drops", received 9 Nov 2026 (owner\'s decision «Γ1», 10 Nov 2026)' };
const BLACK_FRIDAY_2026 = { kind: 'code', campaign: 'Black Friday', start: '2026-11-09', end: '2026-12-06' };

// Angel Barocco (Women's Gear World): its own early Black Friday code, approved by the owner from the offers tracker
// («ΕΓΚΡΙΝΩ ΠΡΟΣΦΟΡΕΣ 18/11: 3», 18 Nov 2026, lessons L186). The email: "EARLYBF10: 10% off your purchase · Early Access
// Black Friday · Live now until 21 November 2026". Its BFCM20 (20% off 2 or more items, 22 Nov - 6 Dec) must not be
// published before 22 November, so it is not here. WGW only: Angel Barocco is there in the UK view (418 products, GBP).
const ANGEL_BAROCCO = { retailer: 'Angel Barocco', slug: 'angel-barocco', awinMid: 70252, currency: 'GBP', sites: ['WGW'],
  url: 'https://www.angelbarocco.com/',
  source: 'Awin email "Angel Barocco (70252): Early Access Black Friday is live: EARLYBF10", received 11 Nov 2026 (owner\'s approval «ΕΓΚΡΙΝΩ ΠΡΟΣΦΟΡΕΣ 18/11: 3», 18 Nov 2026)' };

// Tooled Up and My Tool Shed: their Einhell voucher code (owner's approval «ΕΓΚΡΙΝΩ ΠΡΟΣΦΟΡΕΣ 18/11: 11,12,13», offers
// tracker #11 and #12, lessons L187). Both emails of 16 Nov 2026: "15% off Einhell products when you spend £50 or more on
// Einhell products in one transaction. Voucher code EIN15PCDD must be entered at checkout. Valid from 9:30am 16.11.2026
// until 30.12.2026. One voucher code per order." Only where the retailer has Einhell products in the UK view (18 Nov 2026):
// Tooled Up on CGW and AGW (none on BGW), My Tool Shed on CGW and GGW. The campaign line says "Einhell": the 15% is on
// Einhell only.
const EINHELL_2026 = { kind: 'code', campaign: 'Einhell', code: 'EIN15PCDD', pct: 15, minSpend: 50, start: '2026-11-16', end: '2026-12-30' };
const EINHELL_APPROVAL = 'owner\'s approval «ΕΓΚΡΙΝΩ ΠΡΟΣΦΟΡΕΣ 18/11: 11,12,13», 18 Nov 2026';

// Joybuy's Black Friday vouchers (offers tracker #13, lessons L187): money off with no code to type, on selected products,
// 16-30 Nov 2026, UK. Like Joy Day: a coupon card with Joybuy in the small print, no bar. The sites of the email's
// categories: Home & Living (HGW), Toys (KGW), Gaming (PGW), electronics (TGW), Beauty (WGW).
const JOYBUY_BF = { ...JOYBUY, kind: 'coupon', campaign: 'Black Friday', sites: ['HGW', 'KGW', 'PGW', 'TGW', 'WGW'],
  url: 'https://www.joybuy.co.uk/campaign/active/2NtPpZpkV1c8jJk4UL6tXcxWfsvM', start: '2026-11-16', end: '2026-11-30',
  source: `Awin email "Joybuy UK (123932): Joybuy - Black Friday BIG DEALS live now", received 17 Nov 2026 (${EINHELL_APPROVAL})` };

// iHoverboard (Biker Gear World): its own codes, approved by the owner from the offers tracker #14-#17
// («ΕΓΚΡΙΝΩ ΠΡΟΣΦΟΡΕΣ 19/11: 14,15,16,17,19», 19 Nov 2026, lessons L196). The Awin email of 18 Nov 2026 (ihoverboard.co.uk
// links, Europe/London dates): "BF8%: 8% off everything, Black Friday, 18-30 Nov 2026"; "12%H1Q4: extra 12% off H1 and H2
// hoverboards, 17 Oct 2024 - 31 Dec 2029"; "15%iK1S: 15% off the iK1S kids electric scooter, 17 Nov 2026 - 31 Jan 2027";
// "F7Ultra100: 15% off the F7Ultra electric scooter, 16 Oct 2026 - 31 Mar 2027". Its 10%iK3Pro (#18) links to the German
// shop, so it is not here. BGW only: iHoverboard is there in the UK view (13 products, 19 Nov 2026). A code for one product
// line says so: the campaign line names the line and the offer line "15% off iK1S" (`on`, lessons L196), never "your order".
const IHOVERBOARD = { retailer: 'iHoverboard', slug: 'ihoverboard', awinMid: 35810, currency: 'GBP', sites: ['BGW'],
  source: 'Awin email "iHoverboard (35810): Extra 15% OFF + 6% CPA on Selected Products!", received 18 Nov 2026 (owner\'s approval «ΕΓΚΡΙΝΩ ΠΡΟΣΦΟΡΕΣ 19/11: 14,15,16,17,19», 19 Nov 2026)' };

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
    url: 'https://www.joybuy.co.uk/campaign/active/ojYViWn7U8SqEeb4F2gE5Uw4MdW', sites: ['TGW'], start: '2026-10-26', end: '2026-10-31', source: JOYDAY_EMAIL },
  // The retailers' own Black Friday codes (lessons L114): 9 Nov - 6 Dec 2026, no bar.
  { ...TOOLED_UP, ...BLACK_FRIDAY_2026, id: 'tooled-up-claimfifty', code: 'CLAIMFIFTY', off: 50, minSpend: 500 },
  { ...TOOLED_UP, ...BLACK_FRIDAY_2026, id: 'tooled-up-claimsevfy', code: 'CLAIMSEVFY', off: 75, minSpend: 750 },
  { ...MY_TOOL_SHED, ...BLACK_FRIDAY_2026, id: 'my-tool-shed-claimfifty', code: 'CLAIMFIFTY', off: 50, minSpend: 500 },
  { ...MY_TOOL_SHED, ...BLACK_FRIDAY_2026, id: 'my-tool-shed-claimsevfy', code: 'CLAIMSEVFY', off: 75, minSpend: 750 },
  // A percentage with no minimum spend (lessons L186): "10% off your order", until 21 Nov 2026, no bar.
  { ...ANGEL_BAROCCO, id: 'angel-barocco-earlybf10', kind: 'code', campaign: 'Black Friday', code: 'EARLYBF10', pct: 10, minSpend: 0,
    start: '2026-11-11', end: '2026-11-21' },
  // Einhell: 15% when you spend £50 on Einhell (lessons L187), until 30 Dec 2026, no bar.
  { ...TOOLED_UP, ...EINHELL_2026, id: 'tooled-up-ein15pcdd', sites: ['CGW', 'AGW'],
    url: 'https://www.tooled-up.com/save-15-percent-on-einhell-products/landing/320/',
    source: `Awin email "Tooled Up (496): Einhell 15% Off Voucher Code – Now Live", received 16 Nov 2026 (${EINHELL_APPROVAL})` },
  { ...MY_TOOL_SHED, ...EINHELL_2026, id: 'my-tool-shed-ein15pcdd', sites: ['CGW', 'GGW'],
    url: 'https://www.mytoolshed.co.uk/save-15-percent-on-einhell-products/landing/320/',
    source: `Awin email "My Tool Shed (49385): 15% Off All Einhell with Our Voucher Code", received 16 Nov 2026 (${EINHELL_APPROVAL})` },
  // Joybuy's Black Friday vouchers (L187): £10 off £59 and £40 off £199 on selected products, 16-30 Nov 2026, no bar.
  { ...JOYBUY_BF, id: 'joybuy-bf-10-off-59', off: 10, minSpend: 59 },
  { ...JOYBUY_BF, id: 'joybuy-bf-40-off-199', off: 40, minSpend: 199 },
  // iHoverboard (L196): 8% off everything for Black Friday, and three codes for one product line each, no bar.
  { ...IHOVERBOARD, id: 'ihoverboard-bf8', kind: 'code', campaign: 'Black Friday', code: 'BF8%', pct: 8, minSpend: 0,
    url: 'https://www.ihoverboard.co.uk/', start: '2026-11-18', end: '2026-11-30' },
  { ...IHOVERBOARD, id: 'ihoverboard-12h1q4', kind: 'code', campaign: 'Self-balancing scooters', code: '12%H1Q4', pct: 12, minSpend: 0, on: 'H1, H2',
    url: 'https://www.ihoverboard.co.uk/collections/hoverboards', start: '2024-10-17', end: '2029-12-31' },
  { ...IHOVERBOARD, id: 'ihoverboard-15ik1s', kind: 'code', campaign: 'Kids electric scooters', code: '15%iK1S', pct: 15, minSpend: 0, on: 'iK1S',
    url: 'https://www.ihoverboard.co.uk/products/kids-electric-scooters', start: '2026-11-17', end: '2027-01-31' },
  { ...IHOVERBOARD, id: 'ihoverboard-f7ultra100', kind: 'code', campaign: 'Electric scooters', code: 'F7Ultra100', pct: 15, minSpend: 0, on: 'F7Ultra',
    url: 'https://www.ihoverboard.co.uk/products/iscooter-f7ultra-electric-scooter', start: '2026-10-16', end: '2027-03-31' }
];

export function promosFor(siteCode) {
  return PROMOS.filter(p => p.sites.includes(siteCode));
}
