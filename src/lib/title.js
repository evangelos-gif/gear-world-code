// The name part of a product page's <title> (lessons L217, idea 3 of 22/11/2026): the brand first and the model number
// in it, because Search Console shows that our clicks come from people who type an exact model number or brand + model.
// Only the <title> (and og:title, which repeats it) uses this. The H1, the Product structured data and the cards keep
// the retailer's own name.
//
// The feeds' brand and model fields are often wrong (a seller's name as the brand, "OEM", "No Brand", a retailer's own
// stock code as the model number), so each step only runs where the data can be trusted. When no step runs, the name
// is exactly as before: the first 70 characters of the product name.
import { truncate } from './text.js';

export const TITLE_NAME_MAX = 70;

const clean = s => String(s ?? '').replace(/[®™©]/g, '').replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
// Letters and digits only, lower case, accents removed: "Schildkröt" = "schildkrot", "Blue Spot" = "bluespot".
const squash = s => clean(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Brand fields that are not a brand (compared letters and digits only: "No Brand", "N.A.", "Does Not Apply").
const NOT_A_BRAND = new Set(['oem', 'none', 'generic', 'unbranded', 'unbrandedgeneric', 'genericunbranded', 'na', 'nan',
  'nobrand', 'noname', 'unknown', 'other', 'others', 'various', 'variousbrands', 'brak', 'default', 'doesnotapply',
  'notapplicable', 'null', 'undefined', 'ownlabel', 'ownbrand', 'test']);
// A seller, a web address or a word the sites never show (lessons L107) in the brand field.
const SELLER_WORDS = /(\bsales?\b|\bstore\b|\bshop\b|\bshopping\b|\bexpert\b|\bltd\b|\blimited\b|\bdirect\b|\boutlet\b|\btrading\b|\bwholesale\b|\bwarehouse\b|\bhub\b|\bmall\b|\bonline\b|\bofficial\b|\bpartners?\b|\bdeals?\b|\boffers?\b|\bcart\b|\.co\.uk\b|\.com\b|\.net\b)/i;
const GLUED_SELLER = /[a-z](UK|Store|Shop)$/;
// Words that may stand before the brand and move behind it: "Mens Nike Air Max" -> "Nike Mens Air Max". Not "The",
// "Original" or "New": they belong to brand names ("The North Face", "Original Penguin").
const LEADING_WORDS = new Set(['mens', "men's", 'womens', "women's", 'ladies', 'kids', "kid's", 'boys', 'girls', 'baby',
  'unisex', 'junior', 'jr', 'childrens', "children's", 'toddler', 'infant', 'youth', 'adults', 'adult']);
// A feed in another language (lessons L165): named in the site's deliversTo.languages, or a retailer name that ends
// with a country code ("e-tennis GR", "AliExpress PL"), or a name with Greek or Cyrillic letters or with letters of
// Polish, Czech, Romanian or Hungarian.
const OTHER_LANGUAGE_RETAILER = /\b(GR|PL|DE|FR|NL|BE|ES|IT|CZ|RO|HU|AT|SE|DK|PT)$/;
const OTHER_SCRIPT = /[\u0370-\u03ff\u0400-\u04ff]|[ąćęłńśźżĄĆĘŁŃŚŹŻčďěňřšťůžČĎĚŇŘŠŤŮŽășțȘȚőűŐŰ]/;
// Marketplaces: the brand field holds a seller's name.
const MARKETPLACE = /^(aliexpress|joybuy|temu|dhgate)/i;
// Retailers whose brand field holds the seller of the item, not its maker (InStock UK: "Mira Sales", "Hipeon" for PAPO).
const SELLER_IN_BRAND = /^instock uk$/i;
// Retailers whose mpn field holds their own stock code ("S3605743-GRY"), not the maker's model number.
const STOCK_CODE_IN_MPN = /^(plusshop uk|bazta uk|bazta ie)$/i;

function otherLanguage(site, retailer, name) {
  const langs = site && site.deliversTo && site.deliversTo.languages;
  if (langs && Object.prototype.hasOwnProperty.call(langs, retailer)) return true;
  return OTHER_LANGUAGE_RETAILER.test(retailer) || OTHER_SCRIPT.test(name);
}

function brandUsable(brand) {
  if (brand.length < 2 || brand.length > 25 || !/\p{L}/u.test(brand)) return false;
  if (NOT_A_BRAND.has(squash(brand))) return false;
  return !SELLER_WORDS.test(brand) && !GLUED_SELLER.test(brand);
}

// The brand is only the retailer's own label ("MINT Outdoor" at Mint Outdoor, who also sells Keter): never added.
function brandIsRetailer(brand, retailer) {
  const b = squash(brand);
  const r = squash(String(retailer || '').replace(/\s+(UK|IE|GR|PL|EU|US)$/i, ''));
  return Boolean(b && r && (b === r || b.startsWith(r) || r.startsWith(b)));
}

// Spaces, "|", ",", "-" and "–" at the end of a text, removed in one pass from the end (linear time, also for a long run
// of separators in a junk name).
function dropTrailingSeparators(text) {
  let end = text.length;
  while (end > 0 && ' |,-–'.includes(text[end - 1])) end--;
  return text.slice(0, end).trim();
}

// A first word that is itself a brand or a short form of one: "PAPO", "HP", "VW", "CarPlan".
const looksLikeBrand = w => /^[A-Z][A-Z0-9&]{1,}$/.test(w) || /^[A-Z][a-z]+[A-Z][A-Za-z]*$/.test(w);

// The name starts with the brand, word by word: "BlueSpot" = "Blue Spot", "REV’IT!" = "REV'IT!", "Bosch ..." for
// "Bosch Home and Garden", "adidas ..." for "adidas performance". Never a part of a word ("Onesie" is not "On").
function startsWithBrand(words, brand) {
  const sqBrand = squash(brand);
  const brandWords = brand.split(' ');
  for (let k = 1; k <= Math.min(words.length, brandWords.length + 1); k++) {
    if (squash(words.slice(0, k).join(' ')) === sqBrand) return true;
  }
  const first = squash(brandWords[0]);
  return first.length >= 3 && squash(words[0]) === first;
}

// The maker's model number: 3 to 14 letters, digits, - / . with at least one letter and one digit, not the GTIN, not
// already in the name, not a size, colour or quantity ("SIZE10", "BLK-10", "500ml"). A number-only code is a
// retailer's (TradeInn: "140393227") or a GTIN, so it never counts.
function modelNumber(product, name) {
  const m = clean(product.mpn);
  if (!/^[A-Za-z0-9][A-Za-z0-9\-/.]{2,13}$/.test(m)) return '';
  if (!/[A-Za-z]/.test(m) || !/[0-9]/.test(m)) return '';
  if (/^(size|sz|eu|uk|us)[\s\-/]?\d/i.test(m) || /^\d+([.,]\d+)?(ml|cl|l|g|kg|mg|cm|mm|m|w|kw|v|oz|in|pcs?)$/i.test(m)) return '';
  if (/^(blk|wht|blu|red|grn|gry|nvy|pnk|brn)[-/]?\d/i.test(m)) return '';
  if (product.gtin && squash(m) === squash(product.gtin)) return '';
  if (squash(name).includes(squash(m))) return '';
  return m;
}

// Returns { name, steps }: name = the title's name part (at most 70 characters), steps = what changed (for tests and
// reports): 'double' (a doubled brand word written once), 'case' (a short brand's capitals: HJC, JBL, 3M), 'tail' (the
// brand from the end to the front), 'moved' (the brand in front of "Mens"/"Kids"...), 'added' (the brand added in
// front), 'model' (the model number at the end). A step that would make the name longer ('added', 'model') runs only
// when the whole name still fits in 70 characters, so the end of a name (a size, a colour) is never cut off by it.
export function titleNameParts(product, site) {
  const original = truncate(product && product.product_name, TITLE_NAME_MAX);
  if (!product) return { name: original, steps: [] };
  const retailer = String(product.retailer || '');
  let name = String(product.product_name || '').replace(/\s+/g, ' ').trim();
  if (!name || MARKETPLACE.test(retailer) || otherLanguage(site, retailer, name)) return { name: original, steps: [] };
  const brand = clean(product.brand);
  if (!brandUsable(brand)) return { name: original, steps: [] };
  const steps = [];
  const brandWords = brand.split(' ');
  const sqBrand = squash(brand);

  // "DEWALT DEWALT DT20711 ..." / "Miffy Miffy Head Luggage Tag": the brand word twice at the start. Not for brands
  // that are a doubled word themselves ("Chi Chi London", "Duran Duran", "Tom Tom").
  const doubled = name.match(/^(\S{3,})\s+\1(?:\s+|$)/i);
  const brandDoubled = brandWords.length >= 2 && squash(brandWords[0]) === squash(brandWords[1]);
  if (doubled && !brandDoubled && squash(doubled[1]) === squash(brandWords[0])) {
    name = (doubled[1] + ' ' + name.slice(doubled[0].length)).trim();
    steps.push('double');
  }

  let words = name.split(' ');
  if (startsWithBrand(words, brand)) {
    // "Hjc C-91 ..." with the brand HJC: the capitals of a short brand (up to 3 characters, or with a digit or "&").
    // Longer brands keep the name's own writing ("Apple iPhone", not "APPLE iPhone").
    const short = /^[A-Z0-9&]{2,3}$/.test(brand) || (/^[A-Z0-9&]{2,5}$/.test(brand) && /[0-9&]/.test(brand));
    if (short && /[A-Z]/.test(brand) && words[0].toLowerCase() === brand.toLowerCase() && words[0] !== brand) {
      words[0] = brand; name = words.join(' '); steps.push('case');
    }
  } else {
    // The brand after " | ", ", " or a spaced dash at the very end ("... | XXL | Stan Ray®"), never "Turbo-Jet".
    const tail = new RegExp('(?:\\s*[|,]\\s*|\\s+[-–]\\s+)' + escapeRe(brand) + '[®™]?\\s*$', 'i');
    let at = -1;
    for (let i = 1; i <= 3 && i < words.length; i++) {
      if (words.slice(i, i + brandWords.length).join(' ').toLowerCase() === brand.toLowerCase()) { at = i; break; }
    }
    // A word of the brand already near the start ("Wham" for "What Wham", "Pig" for "Peppa Pig", "Glerc" for
    // "GlercBikesUK"): the brand field and the name disagree, so nothing is added.
    const brandParts = new Set(brandWords.map(squash).filter(Boolean));
    const overlap = words.slice(0, 3).some(w => brandParts.has(squash(w)) || (squash(w).length >= 4 && sqBrand.startsWith(squash(w))));
    const firstBrandWord = squash(brandWords[0]);
    // Also a glued form ("Makita-style" for "Makita Tools"): then nothing is added.
    const nameHasBrand = squash(name).includes(sqBrand) || (firstBrandWord.length >= 3 && squash(name).includes(firstBrandWord));
    // The name without the brand at its end, and without a separator left over ("Shirt | | Nike" -> "Shirt").
    const rest = tail.test(name) ? dropTrailingSeparators(name.replace(tail, '')) : '';
    if (rest && brand.length + 1 + rest.length <= TITLE_NAME_MAX) {
      // "Tour Shirt (Choc Chip Camo) | XXL | Stan Ray®" -> "Stan Ray Tour Shirt (Choc Chip Camo) | XXL". Only when the whole
      // name fits: a size or colour at the end of a long name is never cut off by it.
      name = brand + ' ' + rest; steps.push('tail');
    } else if (rest) {
      // Too long with the brand in front: the name stays as it is.
    } else if (at > 0 && words.slice(0, at).every(w => LEADING_WORDS.has(w.toLowerCase()))) {
      name = [...words.slice(at, at + brandWords.length), ...words.slice(0, at), ...words.slice(at + brandWords.length)].join(' ');
      steps.push('moved');
    } else if (!SELLER_IN_BRAND.test(retailer) && !brandIsRetailer(brand, retailer) && !overlap && !nameHasBrand
      && !looksLikeBrand(words[0]) && brand.length + 1 + name.length <= TITLE_NAME_MAX) {
      name = brand + ' ' + name; steps.push('added');
    }
  }
  name = name.replace(/\s+/g, ' ').trim();

  const model = startsWithBrand(name.split(' '), brand) && !STOCK_CODE_IN_MPN.test(retailer) ? modelNumber(product, name) : '';
  if (model && name.length + 1 + model.length <= TITLE_NAME_MAX) { name = name + ' ' + model; steps.push('model'); }
  return steps.length ? { name: truncate(name, TITLE_NAME_MAX), steps } : { name: original, steps };
}

export function titleName(product, site) {
  return titleNameParts(product, site).name;
}
