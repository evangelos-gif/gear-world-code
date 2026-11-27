// Import rules for Online Bedrooms (Adtraction programme 2066244013 "Online Bedrooms UK", online-bedrooms.co.uk, pounds)
// on Home Gear World. Massive import, wave 1 UK, Adtraction (chat 7 sheet «Εγκρίσεις», approved 23 Nov 2026, lessons L225).
// Feed of 24 Nov 2026: 2,376 rows, 206 product pages (Shopify, one row per size, colour and side), 2,365 rows in stock,
// made-to-order furniture: media walls, fitted and freestanding wardrobes, sliding wardrobe doors, chests of drawers,
// bedside tables, dressing tables, office desks, boot room furniture, laundry towers, and some bought-in coffee and side
// tables and office chairs.
//  - Media walls to Furniture > TV Unit; fitted and freestanding wardrobes and sliding wardrobe doors to Wardrobe; boot room
//    furniture, laundry appliance towers and floor cabinets to Storage & Organisation > Storage Unit; the rest by its name
//    (lib/hgw-home.mjs, as the other furniture shops).
//  - Left out: handles and knobs, colour samples, LED lighting upgrades, TV backing and slat panels, wardrobe rails,
//    brackets, panels and the storage inserts for sliding wardrobes (parts or add-ons, not a piece of furniture).
//  - One card per product page (lowest in-stock price of its sizes and colours); the card name stops before the size.
import { homePlace, notHome } from './lib/hgw-home.mjs';
import { clean } from './lib/uk-wave1.mjs';

export const RULES = {
  key: 'onlinebedrooms-uk',
  network: 'adtraction',
  advertiserId: 2066244013,
  retailer: 'Online Bedrooms',
  currency: 'GBP',
  shop: /^https:\/\/(www\.)?online-bedrooms\.co\.uk\//i,
  sites: ['hgw'],
  maxPrice: 8000,
  minPrice: 20,
  commonVariantName: true
};

export function displayBrand() { return 'Online Bedrooms'; }

// "Freestanding Single Wardrobe With 2 Drawers - W: 300mm x H: 2250mm x D: 620mm, W: 600mm | ..." -> "Freestanding Single
// Wardrobe With 2 Drawers"; "3 Door Front Frame Fitted Wardrobe - Widths Available 1401mm - 2000mm, Dust Grey" -> "3 Door
// Front Frame Fitted Wardrobe, 1401-2000mm wide"; "Blyth Tall Smooth Media Wall Base Unit, 4836mm / ..." -> "Blyth Tall
// Smooth Media Wall Base Unit".
export function displayName(name) {
  let n = clean(name).replace(/^clearance\s*[-–:]?\s*/i, '').replace(/\s*[,|/\s]+$/, '');
  const widths = /\s*[-–]\s*widths available\s*(\d{3,4})\s*(?:mm)?\s*[-–]\s*(\d{3,4})\s*mm/i.exec(n);
  n = n.split(/,\s+/)[0];
  n = n.replace(/\s*[-–]\s*widths available.*$/i, '').replace(/\s*[-–]\s*W:\s*\d.*$/i, '').replace(/\s*[-–]\s*$/, '').trim();
  if (widths) n = `${n}, ${widths[1]}-${widths[2]}mm wide`;
  return n.replace(/\s{2,}/g, ' ').trim();
}

const HGW = (cat, sub) => ({ site: 'hgw', siteCategory: cat, subcategory: sub });
const PARTS = /\b(handles?|knobs?|samples?|lighting upgrade|led strip|backing panels?|slat panels?|vertical panels?|wardrobe rails?|oval rails?|brackets?|open back storage units? for sliding wardrobes?)\b/i;

export function classify({ name, feedCategory = '' }) {
  const n = displayName(name);
  if (!n) return { reject: 'no name' };
  if (PARTS.test(n) || /samples|lighting upgrade|media wall accessories/i.test(feedCategory)) {
    return { reject: 'a handle, sample, panel or add-on, not a piece of furniture' };
  }
  const place = p => ({ ...p, name: n });
  if (/media wall/i.test(n) || /media wall/i.test(feedCategory)) return place(HGW('Furniture', 'TV Unit'));
  if (/wardrobe/i.test(n) || /face frame|freestanding wardrobe|sliding wardrobe doors/i.test(feedCategory)) return place(HGW('Furniture', 'Wardrobe'));
  if (/boot room|laundry|appliance cabinet|floor cabinet/i.test(n) || /boot room|laundry appliance/i.test(feedCategory)) {
    return place(HGW('Storage & Organisation', 'Storage Unit'));
  }
  if (/dressing table/i.test(n)) return place(HGW('Furniture', 'Dressing Table'));
  if (/office desk|\bdesk\b/i.test(n)) return place(HGW('Home Office', 'Office Desk'));
  if (notHome(n)) return { reject: 'not a home product' };
  const home = homePlace(n);
  if (home) return place({ site: 'hgw', ...home });
  return { reject: 'not furniture the site has a place for' };
}
