// Import rules for Cufflinks Gift Hub (Awin advertiser 130341) on Men's Gear World (29 Oct 2026, lessons L83).
// Joined 24 Sep 2026 (20% commission, last Christmas orders 18 Dec). On 27 Oct the programme had no product feed; on
// 29 Oct it had one (feed 118911, 1,351 products), downloaded with awin-feed-download -AllJoined -OnlyMissing.
// The shop is cufflinksgifthub.co.uk (UK, GBP). MGW already has the places: Men's Jewellery > Cufflinks / Jewellery and
// Bags & Accessories > Ties / Wallets & Purses / Accessories (lessons L56: no new subcategory names).
//  - In: cufflinks (also sets, boxed and personalised ones), shirt studs and collar stays, tie clips, bars and pins,
//    ties, bow ties and pocket squares, money clips and wallets, keyrings and small men's gifts.
//  - Out: women's jewellery (earrings, necklaces, bracelets for her), gift cards, packaging sold alone, repair parts.
// Lessons L14: a "yes" list and a "no" list, a read-only plan with samples first, an import only with approval.
export const RULES = {
  key: 'cufflinksgifthub',
  advertiserId: 130341,
  retailer: 'Cufflinks Gift Hub',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?cufflinksgifthub\.(co\.uk|com)\//i,
  sites: ['mgw'],
  maxPrice: 500,
  keepQuery: true
};

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![a-z0-9])', 'i');
const ADULT = words(['erotic', 'adult', 'naked', 'nude', 'sexy', 'boobs', 'willy']);
const FOR_HER = words(['earring', 'earrings', 'necklace for her', 'for her', 'ladies', "women's", 'womens', 'woman', 'girls', 'brooch', 'hair clip',
  'hair slide', 'anklet', 'charm bracelet']);
const NOT_HERE = words(['gift card', 'gift voucher', 'voucher', 'empty box', 'replacement back', 'replacement backs', 'spare back', 'spare backs',
  'gift wrap', 'gift wrapping', 'engraving service']);
const CUFFLINK = words(['cufflink', 'cufflinks', 'cuff link', 'cuff links', 'shirt stud', 'shirt studs', 'dress studs', 'tuxedo studs', 'collar stay',
  'collar stays', 'collar stiffeners']);
const TIE_PIN = words(['tie clip', 'tie clips', 'tie bar', 'tie bars', 'tie pin', 'tie pins', 'tie slide', 'tie tack', 'lapel pin', 'lapel pins',
  'collar bar', 'collar pin']);
const TIE = words(['tie', 'ties', 'bow tie', 'bow ties', 'bowtie', 'cravat', 'pocket square', 'pocket squares', 'handkerchief']);
const WALLET = words(['money clip', 'money clips', 'wallet', 'wallets', 'card holder', 'cardholder']);
const SMALL = words(['keyring', 'key ring', 'keychain', 'key chain', 'hip flask', 'pen', 'bottle opener', 'watch box', 'cufflink box',
  'jewellery box', 'valet tray']);
const JEWEL = words(['bracelet', 'bracelets', 'ring', 'rings', 'signet', 'necklace', 'chain', 'pendant', 'dog tag']);

// The feed name carries the chosen option: "Motor Racing Car Cufflinks Cufflinks Box" (2 options: box or not).
export function cardName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim().replace(/(\bcufflinks?)\s+cufflinks?\s+box$/i, '$1');
}

// Decide where one product goes. Returns { site, siteCategory, subcategory } or { reject: '<reason>' }.
export function classify({ name, feedCategory = '' }) {
  const n = String(name || '');
  const cat = String(feedCategory || '');
  if (NOT_HERE.test(n)) return { reject: 'gift card, packaging or spare part' };
  if (ADULT.test(n) || /adult/i.test(cat)) return { reject: 'adult-themed (not on the sites)' };
  if (FOR_HER.test(n) || /women|ladies/i.test(cat)) return { reject: "women's jewellery (not on Men's Gear World)" };
  if (CUFFLINK.test(n)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Cufflinks', name: cardName(n) };
  if (TIE_PIN.test(n)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Jewellery' };
  if (TIE.test(n)) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Ties' };
  if (WALLET.test(n)) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Wallets & Purses' };
  if (SMALL.test(n)) return { site: 'mgw', siteCategory: 'Bags & Accessories', subcategory: 'Accessories' };
  if (JEWEL.test(n)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Jewellery' };
  // Only the feed category says so: placed, and listed in the report for checking (doubt).
  if (/cufflink/i.test(cat)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Cufflinks', doubt: true };
  if (/tie (clip|bar|pin)/i.test(cat)) return { site: 'mgw', siteCategory: "Men's Jewellery", subcategory: 'Jewellery', doubt: true };
  return { reject: 'not cufflinks, a tie or a small men\'s accessory' };
}
