// Import rules for Elegant Showers (Daisycon programme 21657 "Elegant Showers (UK)", elegantshowers.co.uk, pounds) on Home
// Gear World. Wave 1 UK of the massive import (chat 7 sheet «Εγκρίσεις» row 490, 22-24 Nov 2026, lessons L224).
// Feed of 22 Nov 2026: 1,278 rows, all in stock, every name starting with the brand "ELEGANT": shower enclosures, doors,
// screens and trays 566, radiators and towel rails 249, LED bathroom mirrors and mirror cabinets 181, bathroom furniture
// (vanity units, toilets, storage units) 48, over-bath screens 12, and bedroom and living-room furniture (wardrobes, TV
// units, sideboards, sofa beds, dressing tables, desks) about 210.
//  - Shower enclosures, doors, screens, trays, bath screens, towel rails, toilets, basins and vanity units to HGW
//    Bedding & Bath > Bathroom Accessories (the site has no shower subcategory and never gets a new one, L56).
//  - Radiators to Home Appliances > Heater; mirrors and mirror cabinets to Home Decor > Mirror; a mirror light to
//    Lighting > Wall Light.
//  - Furniture by its name (lib/hgw-home.mjs, as the other home shops).
//  - Radiator valves and covers, spare parts and wastes on their own stay out.
import { daisyconField, pageKey } from './lib/daisycon-shop.mjs';
import { homePlace } from './lib/hgw-home.mjs';
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'elegantshowers-uk',
  network: 'daisycon',
  advertiserId: 21657,
  retailer: 'Elegant Showers',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?elegantshowers\.co\.uk\//i,
  sites: ['hgw'],
  maxPrice: 2000,
  minPrice: 10
};

export const SHOP_URL = 'https://www.elegantshowers.co.uk/';
export const field = daisyconField(SHOP_URL);
export const productKey = pageKey;

export function displayBrand() { return 'Elegant'; }

// "ELEGANT 1200mm Sliding Shower Door" -> "1200mm Sliding Shower Door" (the brand is shown on its own).
export function displayName(name) {
  return clean(name).replace(/^elega[a-z]*\s+/i, '').replace(/\s*\|\s*/g, ', ').trim();
}

const BATH = { site: 'hgw', siteCategory: 'Bedding & Bath', subcategory: 'Bathroom Accessories' };

export function classify({ name }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (/\bvalves?\b|radiator covers?|\bgrille\b|spare|replacement|\bwaste\b(?! ?trap)(?!.*tray)|\bhinge (set|kit)s?\b|seal strip|riser (kit|pack)|legs? kit/i.test(n) && !/shower tray|enclosure|cubicle/i.test(n)) {
    return { reject: 'a part or a radiator cover, not the product itself' };
  }
  const place = p => ({ ...p, name: n });
  if (/towel (rails?|radiators?|warmers?|bars?|racks?|holders?)|heated towel/i.test(n)) return place(BATH);
  if (/mirror light/i.test(n)) return place({ site: 'hgw', siteCategory: 'Lighting', subcategory: 'Wall Light' });
  if (/\bradiators?\b|\brads\b/i.test(n)) return place({ site: 'hgw', siteCategory: 'Home Appliances', subcategory: 'Heater' });
  if (/shower|wet ?room|enclosure|cubicle|bath ?screen|bathtub|\btoilet|\bbasin|\bpan\b|vanity unit|bathroom (storage|furniture|cabinet|accessor)|towel hooks?|toilet (paper|roll)/i.test(n)) {
    // A bathroom mirror cabinet is a mirror; a vanity unit with a basin or toilet is bathroom furniture.
    if (/\bmirror/i.test(n) && !/vanity unit|basin|toilet/i.test(n)) return place({ site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Mirror' });
    return place(BATH);
  }
  // A wardrobe or a bedroom furniture set with a wardrobe in it is a wardrobe; a vanity or makeup table a dressing table.
  if (/wardrobes?|bedroom furniture (set|suite|package)/i.test(n)) return place({ site: 'hgw', siteCategory: 'Furniture', subcategory: 'Wardrobe' });
  if (/(vanity|makeup|make-up) (makeup )?(table|desk)|dressing table/i.test(n)) return place({ site: 'hgw', siteCategory: 'Furniture', subcategory: 'Dressing Table' });
  // An LED or mirror cabinet is a mirror; a sideboard or display cabinet with a mirror is that furniture.
  if (/\bmirror/i.test(n) && !/sideboard|display cabinet|furniture (set|suite)|chest/i.test(n)) {
    return place({ site: 'hgw', siteCategory: 'Home Decor', subcategory: 'Mirror' });
  }
  const home = homePlace(n);
  if (home) return place({ site: 'hgw', ...home });
  return { reject: 'not a bathroom product or furniture the site has a place for' };
}
