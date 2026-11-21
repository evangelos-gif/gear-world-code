// Import rules for Bioethanol-fireplace.co.uk (Daisycon programme 15514 "Bioethanol-fireplace (UK)", pounds) on Home Gear
// World and Garden Gear World (phase 1 of the mass import, chat 7 sheet «Λείπουν 20-11», 21 Nov 2026, lessons L207).
// Feed facts (20 Nov 2026 download): 2,152 rows, 591 in stock, all in pounds, pictures on www.bioethanol-fireplace.co.uk
// (the shop page is that address and the link's path, lib/daisycon-shop.mjs); 87 shop categories such as "Bio Fireplace -
// Wall-mount" 103, "Electric Fireplace - Wall-mounted" 91, "Hybrid Fireplace - Spare parts" 63, "Mounted Heaters" 49,
// "Fire bowl" 37, "Brazier" 34; names often end with " | Bioethanol-fireplace.co.uk". Brands Höfats, Planika, ScandiFlames,
// Kratki, Dimplex, Heatstrip ...
//  - Indoor fireplaces (bioethanol, electric, water vapour "Opti-myst", hybrid and gas fireplaces, burner inserts, mantel
//    frames) to HGW Home Decor > Fireplaces (live HGW database 21 Nov 2026).
//  - Outdoor fires and heaters (fire bowls, braziers, garden fireplaces, fire tables, patio heaters of every kind: the
//    shop's "Free-standing", "Mounted" and "Overhead" heaters are patio heaters) to GGW Garden Furniture & Outdoor Living >
//    Fire pits & heaters.
//  - Spare parts, glass, install kits, covers, fragrances, bioethanol fuel (a flammable liquid), BBQ and pizza tools,
//    wine cellars, building materials and the rest stay out.
import { daisyconField, pageKey } from './lib/daisycon-shop.mjs';

export const RULES = {
  key: 'bioethanol-uk',
  network: 'daisycon',
  advertiserId: 15514,
  retailer: 'Bioethanol-fireplace.co.uk',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?bioethanol-fireplace\.co\.uk\//i,
  sites: ['hgw', 'ggw'],
  maxPrice: 10000,
  minPrice: 20
};

export const SHOP_URL = 'https://www.bioethanol-fireplace.co.uk/';
export const field = daisyconField(SHOP_URL);
export const productKey = pageKey;

export function displayBrand(brand) { return String(brand || '').trim(); }

// " | Bioethanol-fireplace.co.uk" and the shop's other " | ..." tails go; the first part is the product.
export function displayName(name) {
  const n = String(name || '').replace(/\s{2,}/g, ' ').trim();
  const parts = n.split(/\s+\|\s+/).filter(p => !/^bioethanol-fireplace\.co\.uk$/i.test(p));
  return (parts[0] || n).replace(/[\s\-–|]+$/, '').trim();
}

const FIREPLACES = { site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Fireplaces' };
const OUTDOOR = { site: 'ggw', siteCategory: 'Garden Furniture & Outdoor Living', subcategory: 'Fire pits & heaters' };

// Never, whatever the shop category: parts and add-ons, not the fire itself. Read in the head of the name only (before the
// first " - "), as the rest lists features ("... - Remote control - Dekton marble plates", "... With tempered glass").
const NOT_A_FIRE = /\b(covers?|rain cover|safety glass|glass for|spare|replacement|hanging system|ceiling rod|extension rod|profile|brackets?|fragrance|fuel|gloves?|skewers?|peel|cutter|thermometer|lighter|extinguisher|pebbles?|logs? ?set|logset|deco(ration)? logs?|upgrade|kit|pedestal|mounting plate|shell for|bowl for|top plate|smart home)\b/i;
const head = n => n.split(/\s+[-–]\s+/)[0];

export function classify({ name, feedCategory = '', awinCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  const cat = String(feedCategory || awinCategory || '').trim();
  if (/spare parts|accessor|acces -|install|safety glass|decoration|fragrance|equipment|bioethanol fuel|^cover$|ventilation|gas cylinder|firewood|bbq|skewers|pizza|wine|vink|vinreol|byggemat|speaker|remote|furnitures|gas heater spares/i.test(cat)) {
    return { reject: `shop category "${cat}": parts, accessories or not a fireplace` };
  }
  if (NOT_A_FIRE.test(head(n))) return { reject: 'a part or add-on, not the fire itself' };
  if (/^outdoor - |fire bowl|brazier|garden fireplace|tables with fireplace|firegrill|patio heater|parasol heater|free-standing heater|mounted heaters|overhead heaters|table-top heater|tabletop fires/i.test(cat)) return OUTDOOR;
  if (/^(bio fireplace|electric fireplace|hybrid fireplace|gas fireplace|opti-myst)\b|^electric fireplaces$|fireplace mantel frame|gas burner insert|^biopejs$|^hybridpejs$/i.test(cat)) {
    // A gas insert or fire "for outdoor use" is a garden fire.
    if (/\b(outdoor|garden|patio|terrace)\b/i.test(n) && !/\bindoor\b/i.test(n)) return OUTDOOR;
    return FIREPLACES;
  }
  if (!cat) {
    if (/\b(patio heater|fire pit|fire bowl|outdoor (gas )?fireplace|garden fireplace)\b/i.test(n)) return OUTDOOR;
    if (/\b(bioethanol fireplace|electric fireplace|water vapour fireplace|biofireplace)\b/i.test(n)) return FIREPLACES;
  }
  return { reject: `shop category "${cat || 'none'}" is not a fireplace or a heater` };
}
