// The name part of a product page's <title> (lessons L217, idea 3 of 22/11/2026): the brand first and the model number
// in it, because Search Console shows that our clicks come from people who type an exact model number or brand + model.
// Only the <title> uses this. The H1, the Product structured data and the cards keep the retailer's own name.
//
// The feeds' brand and model fields are often wrong (a seller's name as the brand, "OEM", "NONE", a retailer's own stock
// code as the model number), so each step only runs where the data can be trusted, and otherwise the name stays as it
// was: the first 70 characters of the product name, exactly as before.
import { truncate } from './text.js';

export const TITLE_NAME_MAX = 70;

// Brand fields that are not a brand.
const NOT_A_BRAND = new Set(['oem', 'none', 'generic', 'unbranded', 'n/a', 'na', 'nobrand', 'unknown', 'other', 'others',
  'various', 'brak', 'default', 'noname']);
// A seller or a web address in the brand field ("Mira Sales", "Pushchair Expert", "Lights4fun.co.uk", "GlercBikesUK").
const SELLER_WORDS = /(\bsales\b|\bstore\b|\bshop\b|\bexpert\b|\bltd\b|\blimited\b|\bdirect\b|\boutlet\b|\btrading\b|\bwholesale\b|\bwarehouse\b|\bhub\b|\bmall\b|\bonline\b|\.co\.uk\b|\.com\b|\.net\b)/i;
const GLUED_SELLER = /[a-z](UK|Store|Shop)$/;
// Words that may stand before the brand and move behind it: "Mens Nike Air Max" -> "Nike Mens Air Max".
const LEADING_WORDS = new Set(['mens', "men's", 'womens', "women's", 'ladies', 'kids', "kid's", 'boys', 'girls', 'baby',
  'unisex', 'new', 'genuine', 'original', 'the', 'junior', 'jr', 'childrens', "children's", 'toddler', 'infant', 'youth',
  'adults', 'adult']);
// A feed in another language (lessons L165): the retailer's name ends with its country code ("e-tennis GR", "AliExpress PL").
const OTHER_LANGUAGE_RETAILER = /\b(GR|PL|DE|FR|NL|BE|ES|IT|CZ|RO|HU|AT|SE|DK|PT)$/;
// Marketplaces: the brand field holds a seller's name.
const MARKETPLACE = /^(aliexpress|joybuy|temu|dhgate)/i;
// Retailers whose brand field holds the seller of the item, not its maker (InStock UK: "Mira Sales", "Hipeon" for PAPO).
const SELLER_IN_BRAND = /^instock uk$/i;
// Retailers whose mpn field holds their own stock code ("S3605743-GRY"), not the maker's model number.
const STOCK_CODE_IN_MPN = /^(plusshop uk|bazta uk|bazta ie)$/i;
const GREEK = /[Ͱ-Ͽ]/;

const clean = s => String(s ?? '').replace(/[®™©]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
// Letters and digits only, lower case, accents removed: "Schildkröt" = "schildkrot", "Blue Spot" = "bluespot".
const squash = s => clean(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function brandUsable(brand) {
  if (brand.length < 2 || brand.length > 25) return false;
  if (NOT_A_BRAND.has(brand.toLowerCase())) return false;
  return !SELLER_WORDS.test(brand) && !GLUED_SELLER.test(brand);
}

// The brand is only the retailer's own label ("MINT Outdoor" at Mint Outdoor, who also sells Keter): never added.
function brandIsRetailer(brand, retailer) {
  const b = squash(brand);
  const r = squash(String(retailer || '').replace(/\s+(UK|IE|GR|PL|EU|US)$/i, ''));
  return Boolean(b && r && (b === r || b.startsWith(r) || r.startsWith(b)));
}

// A first word that is itself a brand: "PAPO ...", "CarPlan ...". Then no other brand goes in front of it.
const looksLikeBrand = w => /^[A-Z][A-Z0-9&]{2,}$/.test(w) || /^[A-Z][a-z]+[A-Z][A-Za-z]*$/.test(w);

// The maker's model number: 3 to 14 letters, digits, - / . with at least one letter and one digit, not the GTIN, not
// already in the name. A number-only code is a retailer's (TradeInn: "140393227") or a GTIN, so it never counts.
function modelNumber(product, name) {
  const m = clean(product.mpn);
  if (!/^[A-Za-z0-9][A-Za-z0-9\-/.]{2,13}$/.test(m)) return '';
  if (!/[A-Za-z]/.test(m) || !/[0-9]/.test(m)) return '';
  if (product.gtin && squash(m) === squash(product.gtin)) return '';
  if (squash(name).includes(squash(m))) return '';
  return m;
}

// Returns { name, steps }: name = the title's name part (at most 70 characters), steps = what changed (for tests and
// reports): 'double' (a doubled brand word removed), 'case' (the brand's capitals), 'tail' (the brand from the end to
// the front), 'moved' (the brand in front of "Mens"/"Kids"...), 'added' (the brand added in front), 'model' (the model
// number at the end, only when it fits without cutting the name).
export function titleNameParts(product) {
  const original = truncate(product && product.product_name, TITLE_NAME_MAX);
  if (!product) return { name: original, steps: [] };
  const retailer = String(product.retailer || '');
  let name = String(product.product_name || '').replace(/\s+/g, ' ').trim();
  if (!name || OTHER_LANGUAGE_RETAILER.test(retailer) || MARKETPLACE.test(retailer) || GREEK.test(name)) {
    return { name: original, steps: [] };
  }
  const brand = clean(product.brand);
  if (!brandUsable(brand)) return { name: original, steps: [] };
  const steps = [];
  const brandWords = brand.split(' ');
  const firstBrandWord = squash(brandWords[0]);

  // "DEWALT DEWALT DT20711 ..." / "Miffy Miffy Head Luggage Tag": the brand word twice at the start.
  const doubled = name.match(/^(\S{3,})\s+\1\b\s*/i);
  if (doubled && squash(doubled[1]) === firstBrandWord) { name = name.replace(doubled[0], doubled[1] + ' ').trim(); steps.push('double'); }

  let words = name.split(' ');
  const sqName = squash(name);
  const sqBrand = squash(brand);
  const startsWithBrand = sqName.startsWith(sqBrand) || (firstBrandWord.length >= 3 && sqName.startsWith(firstBrandWord));
  if (startsWithBrand) {
    // "Nexx X.R3R ..." with the brand NEXX: the brand's own capitals.
    if (/^[A-Z0-9&]{2,5}$/.test(brand) && words[0].toLowerCase() === brand.toLowerCase() && words[0] !== brand) {
      words[0] = brand; name = words.join(' '); steps.push('case');
    }
  } else {
    const tail = new RegExp('\\s*[|\\-–,]\\s*' + escapeRe(brand) + '[®™]?\\s*$', 'i');
    let at = -1;
    for (let i = 1; i <= 3 && i < words.length; i++) {
      if (words.slice(i, i + brandWords.length).join(' ').toLowerCase() === brand.toLowerCase()) { at = i; break; }
    }
    // A word of the brand already near the start ("Wham" for "What Wham", "Pig" for "Peppa Pig", "Glerc" for
    // "GlercBikesUK"): the brand field and the name disagree, so nothing is added.
    const brandParts = new Set(brandWords.map(squash).filter(Boolean));
    const overlap = words.slice(0, 3).some(w => brandParts.has(squash(w)) || (squash(w).length >= 4 && sqBrand.startsWith(squash(w))));
    if (tail.test(name)) {
      // "Tour Shirt (Choc Chip Camo) | XXL | Stan Ray®" -> "Stan Ray Tour Shirt (Choc Chip Camo) | XXL"
      name = brand + ' ' + name.replace(tail, ''); steps.push('tail');
    } else if (at > 0 && words.slice(0, at).every(w => LEADING_WORDS.has(w.toLowerCase()))) {
      name = [...words.slice(at, at + brandWords.length), ...words.slice(0, at), ...words.slice(at + brandWords.length)].join(' ');
      steps.push('moved');
    } else if (!SELLER_IN_BRAND.test(retailer) && !brandIsRetailer(brand, retailer) && !overlap && !sqName.includes(sqBrand)
      && !(firstBrandWord.length >= 3 && sqName.includes(firstBrandWord)) && !looksLikeBrand(words[0])) {
      name = brand + ' ' + name; steps.push('added');
    }
  }
  name = name.replace(/\s+/g, ' ').trim();

  const brandInFront = squash(name).startsWith(sqBrand) || (firstBrandWord.length >= 3 && squash(name).startsWith(firstBrandWord));
  const model = brandInFront && !STOCK_CODE_IN_MPN.test(retailer) ? modelNumber(product, name) : '';
  if (model && name.length + 1 + model.length <= TITLE_NAME_MAX) { name = name + ' ' + model; steps.push('model'); }
  return { name: truncate(name, TITLE_NAME_MAX), steps };
}

export function titleName(product) {
  return titleNameParts(product).name;
}
