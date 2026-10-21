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

// Words that only describe a colour (the feed writes "Name - Colour - Colour / Size / Leg").
const COLOUR_WORDS = new Set(('black white grey gray navy blue royal sky red green bottle yellow orange brown beige khaki olive tan sand stone ' +
  'charcoal graphite anthracite burgundy maroon purple pink camo camouflage silver gold cream natural teal turquoise lime hi vis viz hi-vis hi-viz ' +
  'dark light mid heather marl melange denim indigo cobalt steel slate moss forest aqua azure coral claret oxford ebony coyote smoke clear amber ' +
  'sapphire midnight convoy alert zoom nut hamilton saturn fluo fluorescent neon bright deep pale french jet electric classic antique vintage ' +
  'multi multicolour mixed assorted ash sport arctic ice charcoal mink chocolate wine plum lilac mauve peach mustard ochre rust copper bronze ' +
  'gunmetal pewter platinum ivory off oatmeal biscuit taupe putty fawn mocha espresso coffee spruce mallard pine sage mint emerald jade ' +
  'ocean marine cyan petrol peacock cornflower powder baby candy hot fuchsia magenta raspberry cherry ruby scarlet crimson traffic signal ' +
  'warm cool true new old pure solid tweed loden check tartan and nvr').split(' '));

function isColourish(seg) {
  const tokens = String(seg || '').toLowerCase().replace(/[*®™]/g, '').split(/[\s\/&+,]+/).filter(Boolean);
  return tokens.length > 0 && tokens.length <= 6 && tokens.every(t => COLOUR_WORDS.has(t));
}

// "Blaklader Service Trousers 1456 - Black/Hi-Vis Yellow - Black/Hi-Vis Yellow / 34\" / Long" -> "Blaklader Service Trousers 1456"
// "Portwest Classic Ear Protector - Yellow" -> "Portwest Classic Ear Protector"
export function baseName(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s[-–]\s/);
  if (parts.length < 2) return t;
  const seps = t.match(/\s[-–]\s/g); // keep the shop's own dashes in the part we keep
  let colour = '';
  const last = parts[parts.length - 1];
  // the size ending always has " / " between colour, size and leg length
  if (/\s\/\s/.test(last.replace(/\([^()]*\)/g, '')) && last.length <= 90) {
    colour = last.split(/\s\/\s/)[0].replace(/[*]/g, '').trim().toLowerCase();
    parts.pop();
  }
  while (parts.length > 1) {
    const seg = parts[parts.length - 1];
    const clean = seg.replace(/[*]/g, '').trim().toLowerCase();
    if ((colour && clean === colour) || isColourish(seg)) parts.pop(); else break;
  }
  return parts.reduce((out, p, i) => (i ? out + seps[i - 1] : '') + p, '').trim();
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
const BLANK_BRANDS = /^(sf|sf minni|skinnifit|spiro|russell|russell europe|flexfit|flexfit by yupoong|yupoong|result headwear|prortx|colortone|tridri|onna|front row|asquith|asquith & fox|henbury|stanley\s*\/?\s*stella|b\s*&\s*c( collection)?|build your brand|awdis|just hoods|gildan|fruit of the loom|bella\s*\+?\s*canvas|next level|anvil|kariban|sols|sol's|native spirit|westford mill|towel city|mantis|larkwood|babybugz|finden\s*&?\s*hales|ecologie|tombo|beechfield|quadra|bagbase|kimood|shugon|nutshell|brand lab)(\s|$)/i;
const NOT_TRADE = words(['chef', 'chefs', 'kitchen', 'catering', 'scrubs', 'tunic', 'nurse', 'nursing', 'medical', 'salon', 'beauty', 'barber', 'waiter',
  'waitress', 'bartender', 'baby', 'babies', 'toddler', 'kids', "kid's", 'children', "children's", 'junior', 'youth', 'school', 'mug', 'mugs', 'tea towel',
  'cushion', 'blanket', 'umbrella', 'teddy', 'toy', 'dress', 'skirt', 'blouse', 'bikini', 'swim', 'pyjama', 'pyjamas', 'gift card', 'garden', 'lawn',
  'plant', 'plants', 'compost', 'seed', 'seeds', 'bird', 'pond', 'golf', 'butcher', 'butchers', 'tridri', 'crop top', 'sports bra',
  'air filter', 'frill']);

const PLACES = [
  // [category, subcategory, words] - the first match wins, so the order matters
  ['Power Tools', 'Power Tools', ['drill bit', 'drill bits', 'saw blade', 'saw blades', 'sanding belt', 'sanding belts', 'sanding sheet', 'sanding sheets',
    'sanding disc', 'sanding discs', 'abrasive', 'flap disc', 'cutting disc', 'grinding disc', 'hole saw', 'jobber drill']],
  ['Site Equipment', 'Site Equipment', ['rucksack', 'backpack', 'holdall', 'hold all', 'kitbag', 'kit bag', 'tool bag', 'duffle', 'duffel']],
  ['Workwear', 'Work Gloves', ['glove', 'gloves', 'gauntlet', 'gauntlets', 'mitt', 'mitts']],
  ['Safety Boots', 'Rigger Boots', ['rigger', 'riggers']],
  ['Safety Boots', 'Wellingtons', ['wellington', 'wellingtons', 'wellies', 'welly', 'gumboot', 'gumboots']],
  ['Safety Boots', 'Safety Trainers', ['safety trainer', 'safety trainers', 'trainer', 'trainers', 'sneaker', 'sneakers']],
  ['Safety Boots', 'Safety Shoes', ['safety shoe', 'safety shoes', 'shoe', 'shoes', 'clog', 'clogs']],
  ['Safety Boots', 'Safety Boots', ['boot', 'boots', 'chukka', 'dealer boot']],
  ['Safety Boots', 'Insoles & Footwear Care', ['insole', 'insoles', 'boot laces', 'laces', 'boot polish']],
  ['PPE', 'Hearing Protection', ['ear protector', 'ear protectors', 'ear defender', 'ear defenders', 'ear muff', 'ear muffs', 'earmuff', 'earmuffs', 'ear plug', 'ear plugs', 'earplug', 'earplugs', 'hearing']],
  ['PPE', 'Eye & Face Protection', ['safety glasses', 'safety spectacles', 'spectacles', 'goggle', 'goggles', 'visor', 'face shield', 'faceshield', 'eye protection', 'safety specs', 'overspecs', 'eyewear']],
  ['PPE', 'Head Protection', ['hard hat', 'safety helmet', 'helmet', 'bump cap', 'chin strap']],
  ['PPE', 'Respiratory Protection', ['respirator', 'respirators', 'dust mask', 'mask', 'masks', 'ffp1', 'ffp2', 'ffp3', 'p3 filter', 'p3 filters', 'abek', 'abek1', 'filter cartridge', 'half mask', 'full face']],
  ['PPE', 'Fall Protection', ['harness', 'lanyard', 'fall arrest', 'fall arrester', 'anchor sling', 'karabiner', 'carabiner']],
  ['PPE', 'First Aid', ['first aid', 'eye wash', 'eyewash', 'plaster', 'plasters', 'bandage', 'burns kit']],
  ['PPE', 'Hand Care & Hygiene', ['hand wipes', 'wipes', 'sanitiser', 'sanitizer', 'hand cleaner', 'hand cleanser', 'barrier cream', 'soap', 'skin care']],
  ['PPE', 'Safety Signs & Barriers', ['warning sign', 'safety sign', 'sign', 'signs', 'barrier', 'barrier tape', 'hazard tape', 'cone', 'cones']],
  ['PPE', 'Disposable Coveralls', ['disposable coverall', 'disposable coveralls', 'type 5/6', 'type 5', 'type 6']],
  ['Workwear', 'Coveralls & Overalls', ['coverall', 'coveralls', 'coveral', 'overall', 'overalls', 'boilersuit', 'boiler suit', 'bib and brace', 'bib & brace',
    'dungarees', 'combi suit', 'winter suit', 'bib']],
  ['Workwear', 'Waterproofs', ['waterproof', 'rain jacket', 'raincoat', 'rain suit', 'rainsuit', 'rain trousers', 'rain trouser', 'over trousers', 'overtrousers',
    'overtrouser', 'pu jacket']],
  ['Workwear', 'Work Trousers', ['trouser', 'trousers', 'jeans', 'jean', 'chino', 'chinos', 'cargo pants', 'work pants', 'pant', 'pants', 'jogger', 'joggers', 'combat']],
  ['Workwear', 'Work Shorts', ['shorts']],
  // after the garments: "Trousers with kneepad pockets" are trousers, "Knee Pads" are PPE
  ['PPE', 'Knee Protection', ['knee pad', 'knee pads', 'kneepad', 'kneepads', 'knee protector', 'knee protectors']],
  ['Workwear', 'Headwear', ['balaclava', 'snood', 'neck warmer', 'hood', 'hoods']],
  ['Workwear', 'Bodywarmers & Gilets', ['bodywarmer', 'body warmer', 'gilet', 'gilets']],
  ['Workwear', 'Fleeces & Softshells', ['fleece', 'fleeces', 'softshell', 'soft shell', 'microfleece']],
  ['Workwear', 'Jackets & Coats', ['jacket', 'jackets', 'coat', 'coats', 'parka', 'bomber', 'anorak', 'cagoule', 'blouson', 'insulator']],
  ['Workwear', 'Hoodies & Sweatshirts', ['track top', 'hoodie', 'hoodies', 'hoody', 'sweatshirt', 'sweatshirts', 'sweater', 'jumper', 'quarter zip', '1/4 zip', 'pullover']],
  ['Workwear', 'Shirts, Polos & T-Shirts', ['polo', 'polos', 'polo shirt', 't-shirt', 't-shirts', 't shirt', 'tee', 'tees', 'shirt', 'shirts']],
  ['Workwear', 'Base Layers', ['base layer', 'baselayer', 'thermal', 'thermals', 'long johns']],
  ['Workwear', 'Tabards & Aprons', ['tabard', 'tabards', 'apron', 'aprons', 'smock']],
  ['Workwear', 'Socks', ['sock', 'socks']],
  ['Workwear', 'Headwear', ['beanie', 'hat', 'hats', 'cap', 'caps', 'snood', 'neck warmer', 'balaclava', 'headband']],
  ['Workwear', 'Workwear Accessories', ['belt', 'belts', 'braces', 'holster', 'holster pocket', 'tool belt', 'pouch', 'name badge', 'id holder', 'lanyards']],
  ['Power Tools', 'Power Tools', ['drill', 'drills', 'impact driver', 'grinder', 'circular saw', 'jigsaw', 'sander', 'multi tool', 'multi-tool', 'cordless']],
  ['Hand Tools', 'Hand Tools', ['spanner', 'spanners', 'screwdriver', 'screwdrivers', 'hammer', 'pliers', 'tape measure', 'spirit level', 'chisel', 'utility knife', 'trowel', 'hand saw', 'socket set', 'allen key', 'hex key']],
  ['Site Equipment', 'Site Equipment', ['ladder', 'ladders', 'step ladder', 'work light', 'worklight', 'site light', 'torch', 'head torch', 'wheelbarrow', 'tool box', 'toolbox', 'tool chest', 'storage box', 'trestle', 'bucket']]
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
