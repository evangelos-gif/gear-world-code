// Shared words for the wave 3 shops on the six older sites (approvals file of chat 7, 16 Nov 2026, lessons L170):
// who a product is for, and the subcategory of clothes, shoes and fragrances by the words of its name. The subcategory
// names are the ones each site already uses (live databases of 17 Nov 2026), never new ones (lessons L56).
export const W = list => new RegExp('(?<![a-z0-9])(' + list.join('|') + ')(?![a-z0-9])', 'i');
const pick = (n, list, fallback) => { for (const [re, sub] of list) if (re.test(n)) return sub; return fallback; };
// Clothes: the LAST garment word of the name says what it is ("Soft Knit Button Front Booty Short" is shorts, "Short
// Sleeve Shirt" a shirt, "Knit Relaxed Fit Tank" a tank top), not the first one (dry run of 17 Nov 2026).
// Overlapping words: the longer one ("T-shirt" is a T-shirt, not a shirt).
const pickLast = (n, list, fallback) => {
  let best = null, end = -1, start = 0;
  for (const [re, sub] of list) {
    const g = new RegExp(re.source, 'gi');
    for (let m; (m = g.exec(n));) {
      const e = m.index + m[0].length;
      if (e > end || (e === end && m.index < start)) { end = e; start = m.index; best = sub; }
    }
  }
  return best || fallback;
};
const K = (list, sub) => [W(list), sub];

export const clean = name => String(name || '').replace(/&amp;/gi, '&').replace(/&#39;|&rsquo;/gi, "'").replace(/[\u00a0\u3000]/g, ' ').replace(/\s{2,}/g, ' ').trim();

// Who it is for, by the words of the name (and an extra text such as the feed's category).
const KIDS = W(["kids?'?", "kid's", 'children', "children's", 'child', 'boys?', "boys'", 'girls?', "girls'", 'toddlers?', 'baby', 'babies', 'infants?', 'youth', 'juniors?', "junior's", 'little kids?', 'big kids?', 'teens?']);
const WOMEN = W(["women'?s?", "womens", 'woman', "ladies'?", 'lady', 'female', 'her\\b']);
const MEN = W(["men'?s?", "mens", 'man', 'male', 'gentlemen', 'him\\b']);
export function audience(text) {
  const t = String(text || '').replace(/\bwomen/gi, 'WOMEN');
  if (KIDS.test(t)) return 'kids';
  const w = WOMEN.test(t);
  const m = MEN.test(t.replace(/WOMEN'?S?/g, ' '));
  if (w && !m) return 'women';
  if (m && !w) return 'men';
  if (m && w) return 'unisex';
  return '';
}

export const SHOES = [K(['boots?', 'booties', 'chelsea', 'wellingtons?', 'snow boots?'], 'Boots'), K(['sandals?', 'slides?', 'flip-?flops?', 'thongs? sandals?', 'clogs?'], 'Sandals'),
  K(['slippers?', 'house shoes?', 'recovery'], 'Slippers'), K(['sneakers?', 'trainers?', 'running', 'running shoes?', 'walking shoes?', 'tennis shoes?', 'athletic shoes?', 'cross[- ]?trainers?', 'gel', 'runners?'], 'Trainers'),
  K(['heels?', 'pumps', 'stilettos?'], 'Heels')];
export const shoeSub = (n, site) => { const s = pick(n, SHOES, 'Shoes'); return site !== 'wgw' && s === 'Heels' ? 'Shoes' : s; };

export const MEN_CLOTHES = [K(['suits?', 'tuxedos?', 'tux'], 'Suits'), K(['blazers?', 'jackets?', 'coats?', 'parkas?', 'gilets?', 'vests?', 'waistcoats?', 'bombers?', 'windbreakers?'], 'Jackets'),
  K(['hoodies?', 'hooded sweatshirt'], 'Hoodies'), K(['sweat ?shirts?', 'crewneck sweat'], 'Sweatshirts'), K(['sweaters?', 'cardigans?', 'jumpers?', 'knit', 'knitted', 'pullovers?', 'turtlenecks?'], 'Knitwear'),
  K(['t-?shirts?', 'tees?', 'tank tops?', 'tanks?', 'henleys?'], 'T-Shirts'), K(['shirts?', 'polos?', 'polo shirts?'], 'Shirts'), K(['jeans', 'denim pants'], 'Jeans'),
  K(['shorts?', 'swim trunks', 'board shorts'], 'Shorts'), K(['pants', 'trousers', 'joggers', 'sweatpants', 'chinos', 'slacks'], 'Trousers'), K(['socks'], 'Socks'),
  K(['boxers?', 'briefs', 'underwear', 'trunks'], 'Underwear'), K(['pajamas?', 'pyjamas?', 'sleepwear', 'loungewear', 'robes?'], 'Nightwear')];
export const menClothSub = (n, fallback = 'Clothing') => pickLast(n, MEN_CLOTHES, fallback);

export const WOMEN_CLOTHES = [K(['dress', 'dresses', 'sundress'], 'Dresses'), K(['jumpsuits?', 'rompers?', 'playsuits?'], 'Clothing'), K(['jeans'], 'Jeans'), K(['skirts?', 'skorts?'], 'Skirts'),
  K(['shorts'], 'Shorts'), K(['leggings'], 'Leggings'), K(['pants', 'trousers', 'joggers', 'sweatpants'], 'Trousers'), K(['hoodies?'], 'Hoodies'), K(['sweat ?shirts?'], 'Sweatshirts'),
  K(['cardigans?', 'sweaters?', 'jumpers?', 'knit', 'knitted', 'pullovers?'], 'Knitwear'), K(['coats?', 'jackets?', 'blazers?', 'gilets?', 'parkas?'], 'Jackets & Coats'),
  K(['pajamas?', 'pyjamas?', 'nightgown', 'nightdress', 'sleepwear', 'loungewear', 'robes?'], 'Nightwear'), K(['t-?shirts?', 'tees?', 'tank tops?', 'camis?'], 'T-Shirts'),
  K(['blouses?', 'shirts?', 'tops?', 'tunics?'], 'Tops & Blouses')];
export const womenClothSub = (n, fallback = 'Clothing') => pickLast(n, WOMEN_CLOTHES, fallback);

// Fragrance shops (CJ, US): never a "type" or "inspired by" copy of a famous scent, never a children's character set.
export const FRAGRANCE_COPY = W(['type', 'inspired by', 'dupe', 'our version of', 'version of', 'impression of', 'alternative to', 'compare to', 'smells like', 'clone']);
export const CHARACTER = W(['disney', 'frozen', 'marvel', 'avengers', 'spider-?man', 'batman', 'superman', 'barbie', 'hello kitty', 'paw patrol', 'minions?', 'trolls',
  'peppa', 'pokemon', 'star wars', 'harry potter', 'princess', 'cars', 'sonic', 'mickey', 'minnie', 'toy story', 'bluey', 'cocomelon', 'sesame street', 'smurfs?']);
export const TESTER = W(['tester', 'testers', 'unboxed', 'sample', 'samples', 'vials?', 'mini set']);
// Women's or men's fragrance: the shop's own words first (category, "for Men", "Cologne"), then unisex as women's.
export function fragranceFor(name, category = '') {
  const t = `${name} | ${category}`;
  if (/\bunisex\b/i.test(t)) return 'unisex';
  if (/\b(cologne|aftershave|after shave|pour homme|for men|men'?s|homme)\b/i.test(t) && !/\b(for women|women'?s|pour femme|femme)\b/i.test(t)) return 'men';
  return 'women';
}
// A set is a gift set only in those words ("Set Sail Martinique Body Spray" is a body spray).
export const fragranceSub = n => (/\bgift set|\b\d+\s*(?:pc|pcs|piece)\b|\bcoffret|\b(?:miniature|mini|discovery|travel|trio|duo) set|\bset of\b/i.test(n) ? 'Gift sets' : (/body (spray|mist|lotion|wash|cream|oil)|shower gel|deodorant|dusting powder/i.test(n) ? 'Bath & body' : 'Fragrance'));
