// Import rules for GS Workwear (Awin advertiser 48473): UK workwear, PPE and safety footwear, for Construction Gear World.
// Written from the real feed (gw-feed-peek, 20 Oct 2026): the feed is NOT the usual Awin CSV but a Google Shopping
// format file saved as Downloads\48473-retail-en_GB.csv.gz (62 columns: title, link, image_link, availability,
// price/sale_price "4.99 GBP", brand, gtin, product_type ...). 311,663 rows, all GBP, all with an Awin link, 93% with an
// EAN. product_type, item_group_id, colour and size are empty, so:
//   - one product = brand + the title without its colour/size ending ("Portwest Classic Ear Protector - Yellow" and
//     "- Red" become one card, with the lowest in-stock price);
//   - the category comes from words in the name (a "yes" list per category and a "no" list), lessons L14.
// Blank promotional clothing brands (Stanley/Stella, B&C, Build Your Brand ...) are left out: plain T-shirts for
// printing are not construction gear. Garden products are left out (Garden Gear World is not in this plan).
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const RULES = {
  key: 'gsworkwear',
  advertiserId: 48473,
  retailer: 'GS Workwear',
  currency: 'GBP',
  shop: /^https:\/\/(?!(www\.)?awin1\.com\/)[a-z0-9.-]+\.[a-z]{2,}\//i,
  sites: ['cgw'],
  maxPrice: 2000
};

// The feed is saved next to the Awin archive (Downloads) under the advertiser id, or inside the archive.
export function feedFiles(archive) {
  const out = [];
  for (const dir of [archive, dirname(archive)]) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (/^48473-.+\.csv(\.gz)?$/i.test(n) || /^AWIN_48473_\d+\.csv(\.gz)?$/i.test(n)) out.push(join(dir, n));
    }
  }
  return [...new Set(out)].filter(f => existsSync(f));
}

const first = (column, names) => { for (const n of names) { const v = column(n); if (v) return v; } return ''; };
const host = u => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

// Google Shopping column names -> the Awin names the import planner reads.
export function field(name, column) {
  switch (name) {
    case 'product_name': return first(column, ['product_name', 'title']);
    case 'brand_name': return first(column, ['brand_name', 'brand']);
    case 'merchant_category': return first(column, ['merchant_category', 'product_type', 'google_product_category']);
    case 'merchant_image_url': return first(column, ['merchant_image_url', 'image_link']);
    case 'ean': return first(column, ['ean', 'gtin']);
    case 'search_price': return first(column, ['search_price', 'sale_price', 'price']);
    case 'merchant_product_id': return first(column, ['merchant_product_id', 'id', 'mpn']);
    case 'merchant_deep_link': {
      // The shop's own page (the planner builds the Awin tracking link from it). Never the Awin link itself.
      const page = first(column, ['merchant_deep_link', 'link', 'mobile_link']);
      return page && host(page) !== 'www.awin1.com' && host(page) !== 'awin1.com' ? page : '';
    }
    case 'currency': {
      const c = column('currency');
      if (c) return c;
      const p = first(column, ['sale_price', 'price']);
      return (p.match(/\b([A-Z]{3})\b/) || [])[1] || (/£/.test(p) ? 'GBP' : '');
    }
    case 'stock_quantity': {
      const q = column('stock_quantity');
      if (q) return q;
      const a = column('availability').toLowerCase().replace(/[\s-]+/g, '_');
      if (a === 'in_stock' || a === 'limited_stock') return '1';
      if (a === 'out_of_stock' || a === 'discontinued') return '0';
      return ''; // backorder, preorder or empty: unknown
    }
    case 'parent_product_id': return first(column, ['parent_product_id', 'item_group_id']);
    default: return column(name);
  }
}

// ---------- One card per product ----------

const COLOURS = ['black', 'white', 'grey', 'gray', 'navy', 'blue', 'royal', 'royal blue', 'sky', 'red', 'green', 'bottle', 'bottle green',
  'yellow', 'orange', 'brown', 'beige', 'khaki', 'olive', 'tan', 'sand', 'stone', 'charcoal', 'graphite', 'anthracite', 'burgundy', 'maroon',
  'purple', 'pink', 'camo', 'camouflage', 'silver', 'gold', 'cream', 'natural', 'teal', 'turquoise', 'lime', 'hi vis', 'hi-vis', 'dark', 'light',
  'mid', 'heather', 'marl', 'melange', 'denim', 'indigo', 'cobalt', 'steel', 'slate', 'moss', 'forest', 'aqua', 'azure', 'coral', 'claret', 'oxford'];
const COLOUR_PART = new RegExp(`^(${COLOURS.map(c => c.replace(/[-\s]/g, '[-\\s]')).join('|')})([\\s/&+-]+(${COLOURS.map(c => c.replace(/[-\s]/g, '[-\\s]')).join('|')}|and))*$`, 'i');
const SIZE_PART = /^(size\s*)?(\d{1,3}(\.\d)?(\s*(cm|mm|in|"|r|s|l|t|w))?|x{0,4}[sml]|x{1,4}l|\d?x{1,3}l|\d{1,2}xl|one size|os|small|medium|large|regular|tall|short|long|(uk\s*)?\d{1,2}(\.5)?|eu\s*\d{2}|w\d{2}(\s*l\d{2})?|\d{2}\s*[rlst]|\d{2}"\s*(chest|waist|leg)?)$/i;

function isVariantPart(part) {
  const p = String(part || '').replace(/[()]/g, '').trim();
  if (!p) return true;
  if (COLOUR_PART.test(p) || SIZE_PART.test(p)) return true;
  // "Navy / XL", "Black, 10", "Yellow/Navy 3XL"
  const bits = p.split(/\s*[\/,|]\s*|\s+(?=\d?x{0,3}l\b|\d{1,3}\b)/i).filter(Boolean);
  return bits.length > 1 && bits.every(b => COLOUR_PART.test(b) || SIZE_PART.test(b));
}

// "Portwest Classic Ear Protector - Yellow" -> "Portwest Classic Ear Protector"
export function baseName(title) {
  let t = String(title || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    const m = t.match(/^(.*\S)\s*(?:\s[-–]\s|,\s|\s\(([^()]*)\)$)\s*([^-–,()]*)$/);
    if (!m) break;
    const tail = (m[2] !== undefined ? m[2] : m[3]) || '';
    if (!isVariantPart(tail)) break;
    t = m[1].replace(/[\s,–-]+$/, '').trim();
  }
  return t;
}

export function displayName(title) { return baseName(title); }

const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);

// The same brand + base name (and the same shop page when there is one) is one product.
export function productKey(get) {
  const group = get('parent_product_id');
  if (group) return slug(`${get('brand_name')} ${group}`);
  return slug(`${get('brand_name')} ${baseName(get('product_name'))}`);
}

// ---------- Categories ----------

const words = list => new RegExp('(?<![a-z0-9])(' + list.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s-]?')).join('|') + ')(?![a-z0-9])', 'i');

// Plain clothing for printing logos on: not construction gear.
const BLANK_BRANDS = /^(stanley\s*\/?\s*stella|b\s*&\s*c( collection)?|build your brand|awdis|just hoods|gildan|fruit of the loom|bella\s*\+?\s*canvas|next level|anvil|kariban|sols|sol's|native spirit|westford mill|towel city|mantis|larkwood|babybugz|finden\s*&?\s*hales|ecologie|tombo|beechfield|quadra|bagbase|kimood|shugon|nutshell|brand lab)$/i;
const NOT_TRADE = words(['chef', 'chefs', 'kitchen', 'catering', 'scrubs', 'tunic', 'nurse', 'nursing', 'medical', 'salon', 'beauty', 'barber', 'waiter',
  'waitress', 'bartender', 'baby', 'babies', 'toddler', 'kids', "kid's", 'children', "children's", 'junior', 'youth', 'school', 'mug', 'mugs', 'tea towel',
  'cushion', 'blanket', 'umbrella', 'teddy', 'toy', 'dress', 'skirt', 'blouse', 'bikini', 'swim', 'pyjama', 'pyjamas', 'gift card', 'garden', 'lawn',
  'plant', 'plants', 'compost', 'seed', 'seeds', 'bird', 'pond', 'golf']);

const PLACES = [
  // [category, subcategory, words]
  ['Safety Boots', 'Rigger Boots', ['rigger', 'riggers']],
  ['Safety Boots', 'Wellingtons', ['wellington', 'wellingtons', 'wellies', 'welly', 'gumboot', 'gumboots']],
  ['Safety Boots', 'Safety Trainers', ['safety trainer', 'safety trainers', 'trainer', 'trainers', 'sneaker', 'sneakers']],
  ['Safety Boots', 'Safety Shoes', ['safety shoe', 'safety shoes', 'shoe', 'shoes', 'clog', 'clogs']],
  ['Safety Boots', 'Safety Boots', ['boot', 'boots', 'chukka', 'dealer boot']],
  ['Safety Boots', 'Insoles & Footwear Care', ['insole', 'insoles', 'boot laces', 'laces', 'boot polish']],
  ['PPE', 'Hearing Protection', ['ear protector', 'ear protectors', 'ear defender', 'ear defenders', 'ear muff', 'ear muffs', 'earmuff', 'earmuffs', 'ear plug', 'ear plugs', 'earplug', 'earplugs', 'hearing']],
  ['PPE', 'Eye & Face Protection', ['safety glasses', 'safety spectacles', 'spectacles', 'goggle', 'goggles', 'visor', 'face shield', 'faceshield', 'eye protection', 'safety specs', 'overspecs', 'eyewear']],
  ['PPE', 'Head Protection', ['hard hat', 'safety helmet', 'helmet', 'bump cap', 'chin strap']],
  ['PPE', 'Respiratory Protection', ['respirator', 'respirators', 'dust mask', 'mask', 'masks', 'ffp1', 'ffp2', 'ffp3', 'filter', 'filters', 'half mask', 'full face']],
  ['PPE', 'Fall Protection', ['harness', 'lanyard', 'fall arrest', 'fall arrester', 'anchor sling', 'karabiner', 'carabiner']],
  ['PPE', 'Knee Protection', ['knee pad', 'knee pads', 'kneepad', 'kneepads', 'knee protector', 'knee protectors']],
  ['PPE', 'First Aid', ['first aid', 'eye wash', 'eyewash', 'plaster', 'plasters', 'bandage', 'burns kit']],
  ['PPE', 'Hand Care & Hygiene', ['hand wipes', 'wipes', 'sanitiser', 'sanitizer', 'hand cleaner', 'hand cleanser', 'barrier cream', 'soap', 'skin care']],
  ['PPE', 'Safety Signs & Barriers', ['warning sign', 'safety sign', 'sign', 'signs', 'barrier', 'barrier tape', 'hazard tape', 'cone', 'cones']],
  ['PPE', 'Disposable Coveralls', ['disposable coverall', 'disposable coveralls', 'type 5/6', 'type 5', 'type 6']],
  ['Workwear', 'Work Gloves', ['glove', 'gloves', 'gauntlet', 'gauntlets', 'mitt', 'mitts']],
  ['Workwear', 'Coveralls & Overalls', ['coverall', 'coveralls', 'overall', 'overalls', 'boilersuit', 'boiler suit', 'bib and brace', 'bib & brace', 'dungarees']],
  ['Workwear', 'Waterproofs', ['waterproof', 'rain jacket', 'rain suit', 'rainsuit', 'rain trousers', 'rain trouser', 'over trousers', 'overtrousers', 'pu jacket']],
  ['Workwear', 'Work Trousers', ['trouser', 'trousers', 'jeans', 'jean', 'chino', 'chinos', 'cargo pants', 'work pants', 'combat']],
  ['Workwear', 'Work Shorts', ['shorts']],
  ['Workwear', 'Bodywarmers & Gilets', ['bodywarmer', 'body warmer', 'gilet', 'gilets']],
  ['Workwear', 'Fleeces & Softshells', ['fleece', 'fleeces', 'softshell', 'soft shell', 'microfleece']],
  ['Workwear', 'Jackets & Coats', ['jacket', 'jackets', 'coat', 'coats', 'parka', 'bomber', 'anorak', 'cagoule', 'blouson']],
  ['Workwear', 'Hoodies & Sweatshirts', ['hoodie', 'hoodies', 'hoody', 'sweatshirt', 'sweatshirts', 'sweater', 'jumper', 'quarter zip', '1/4 zip', 'pullover']],
  ['Workwear', 'Shirts, Polos & T-Shirts', ['polo', 'polos', 'polo shirt', 't-shirt', 't-shirts', 't shirt', 'tee', 'tees', 'shirt', 'shirts']],
  ['Workwear', 'Base Layers', ['base layer', 'baselayer', 'thermal', 'thermals', 'long johns']],
  ['Workwear', 'Tabards & Aprons', ['tabard', 'tabards', 'apron', 'aprons', 'smock']],
  ['Workwear', 'Socks', ['sock', 'socks']],
  ['Workwear', 'Headwear', ['beanie', 'hat', 'hats', 'cap', 'caps', 'snood', 'neck warmer', 'balaclava', 'headband']],
  ['Workwear', 'Workwear Accessories', ['belt', 'belts', 'braces', 'holster', 'holster pocket', 'tool belt', 'pouch', 'name badge', 'id holder', 'lanyards']],
  ['Power Tools', 'Power Tools', ['drill', 'drills', 'impact driver', 'grinder', 'circular saw', 'jigsaw', 'sander', 'multi tool', 'multi-tool', 'cordless']],
  ['Hand Tools', 'Hand Tools', ['spanner', 'spanners', 'screwdriver', 'screwdrivers', 'hammer', 'pliers', 'tape measure', 'spirit level', 'chisel', 'utility knife', 'trowel', 'hand saw', 'socket set', 'allen key', 'hex key']],
  ['Site Equipment', 'Site Equipment', ['ladder', 'ladders', 'step ladder', 'work light', 'worklight', 'site light', 'torch', 'head torch', 'wheelbarrow', 'tool box', 'toolbox', 'tool bag', 'tool chest', 'kit bag', 'storage box', 'trestle', 'bucket']]
].map(([cat, sub, list]) => [cat, sub, words(list)]);

const HI_VIS = words(['hi vis', 'hi-vis', 'hivis', 'high vis', 'high visibility', 'hi viz', 'hi-viz', 'en iso 20471', 'en20471', 'iso 20471']);
const HI_VIS_GARMENT = /^(Work Trousers|Work Shorts|Bodywarmers & Gilets|Fleeces & Softshells|Jackets & Coats|Hoodies & Sweatshirts|Shirts, Polos & T-Shirts|Coveralls & Overalls|Waterproofs|Tabards & Aprons)$/;
const VEST = words(['vest', 'waistcoat']);

export function classify({ name, brand = '' }) {
  const n = String(name || '');
  if (BLANK_BRANDS.test(String(brand || '').trim())) return { reject: 'plain clothing brand for printing logos (not construction gear)' };
  if (NOT_TRADE.test(n)) return { reject: 'not work gear (catering, medical, kids, home, garden ...)' };
  const hiVis = HI_VIS.test(n);
  for (const [cat, sub, re] of PLACES) {
    if (!re.test(n)) continue;
    if (cat === 'Workwear' && hiVis && HI_VIS_GARMENT.test(sub)) return { site: 'cgw', siteCategory: 'Workwear', subcategory: 'Hi-Vis' };
    return { site: 'cgw', siteCategory: cat, subcategory: sub };
  }
  if (hiVis && VEST.test(n)) return { site: 'cgw', siteCategory: 'Workwear', subcategory: 'Hi-Vis' };
  if (hiVis) return { site: 'cgw', siteCategory: 'Workwear', subcategory: 'Hi-Vis', doubt: true };
  return { reject: 'not sure which category (no clear word in the name)' };
}
