// Import rules for Tuinmeubelwereld (Daisycon 19167) on Garden Gear World (Wave 3 of Daisycon, chat 9, 17 Nov 2026).
// Feed (download of 16-17 Nov 2026): 995 garden furniture products, all in euros, names in Dutch with English words
// ("Palau/Tulum Lava Grey dining tuinset | 4 personen | teakhout + touw", "Tulum ligbed | touw + aluminium",
// "Riva stokparasol antraciet | Ø250cm rond", "Stockholm dining loungeset met hockers 8 personen"), five folders
// ("Meubelen|Buitenmeubelen|Sets van buitenmeubelen", "...|Buitenzitjes|Buitenstoelen", "...|Tuintafels",
// "Huis en tuin|Tuin en gazon|Buitenleven|Parasols", "...|Buitenzitjes|Buitenbanken"), brands BUITEN living, LUX outdoor
// living, Platinum, Denza. Shown only in the Netherlands, in Dutch (sites/ggw/site.config.js deliversTo + languages, L165).
// The place: the head of the name first (Dutch glues words, so a word ENDING says what it is: "stokparasol" is a parasol,
// "loungeset" a lounge set), then the folder. The subcategories are the ones of lib/garden.mjs.
import { daisyconPageField } from './lib/daisycon-home.mjs';
import { pageKey } from './lib/daisycon-shop.mjs';
import { GARDEN_CATEGORIES } from './lib/garden.mjs';

const SHOP_URL = 'https://www.tuinmeubelwereld.nl/';
export const RULES = {
  key: 'tuinmeubelwereld-nl',
  network: 'daisycon',
  advertiserId: 19167,
  retailer: 'Tuinmeubelwereld',
  currency: 'EUR',
  shop: /^https:\/\/(www\.)?tuinmeubelwereld\.nl\//i,
  sites: ['ggw'],
  minPrice: 20,
  maxPrice: 5000,
  maxPerSubcategory: 300,
  joinSameNameAcrossFeeds: true
};
export { SHOP_URL };
export const field = daisyconPageField(SHOP_URL, RULES.advertiserId);
export const productKey = pageKey;

const END = list => new RegExp('(?:^|[^\\p{L}\\d])[\\p{L}\\d-]*?(?:' + list.join('|') + ')(?=$|[^\\p{L}\\d])', 'iu');
// Covers, cushions and parts are not a piece of furniture; not sure = out.
const NO = END(['hoes', 'hoezen', 'beschermhoes', 'kussen', 'kussens', 'kussenset', 'kussensets', 'zitkussen', 'rugkussen', 'onderdeel', 'onderdelen', 'reserveonderdeel', 'staal', 'stalen']);
const PIECES = [
  ['Parasols, gazebos & shade', END(['parasol', 'parasols', 'parasolvoet', 'parasolvoeten', 'schaduwdoek', 'schaduwdoeken', 'pergola', "pergola's", 'overkapping'])],
  ['Loungers', END(['ligbed', 'ligbedden', 'ligstoel', 'ligstoelen', 'strandstoel', 'strandstoelen', 'daybed', 'daybeds'])],
  ['Dining sets', END(['dining', 'diningset', 'diningsets', 'eetset', 'eetsets', 'tuinset', 'tuinsets'])],
  ['Lounge & corner sets', END(['loungeset', 'loungesets', 'lounge', 'hoekbank', 'hoekbanken', 'loungebank', 'loungebanken', 'hoekset', 'hoeksets'])],
  ['Bistro sets', END(['bistroset', 'bistrosets', 'balkonset', 'balkonsets'])],
  ['Chairs & benches', END(['stoel', 'stoelen', 'fauteuil', 'fauteuils', 'bank', 'banken', 'kruk', 'krukken', 'hocker', 'hockers', 'poef', 'poefs'])],
  ['Tables', END(['tafel', 'tafels'])]
];
// Folders, deepest first, when the name says nothing.
const FOLDERS = [
  ['Parasols, gazebos & shade', END(['parasols'])],
  ['Chairs & benches', END(['buitenstoelen', 'buitenbanken'])],
  ['Tables', END(['tuintafels'])],
  ['Dining sets', END(['sets van buitenmeubelen'])]
];

export function displayName(name) {
  return String(name || '').replace(/\s{2,}/g, ' ').trim();
}
const headOf = name => (displayName(name).split(/\s*\|\s*/)[0] || '').trim();

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  const head = headOf(n);
  const notFurniture = { reject: 'a cover, cushion or part, not a piece of garden furniture' };
  // "Kussen voor ligbed" is a cushion, "Loungeset met kussens" a lounge set: the first word, then the pieces, then any word.
  if (NO.test(head.split(/\s+/)[0])) return notFurniture;
  const place = sub => ({ site: 'ggw', siteCategory: GARDEN_CATEGORIES.furniture, subcategory: sub, name: n });
  for (const [sub, re] of PIECES) if (re.test(head)) return place(sub);
  if (NO.test(head)) return notFurniture;
  const parts = String(feedCategory).split('>')[0].split('|').map(s => s.trim()).filter(Boolean).reverse();
  for (const part of parts) for (const [sub, re] of FOLDERS) if (re.test(part)) return { ...place(sub), doubt: true };
  return { reject: 'not sure where it goes on Garden Gear World' };
}
