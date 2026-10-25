// Import rules for Viaduct Clothing (Awin 125096): men's and unisex sportswear -> MGW, juniors -> KGW.
// Women's: viaduct-women.mjs (WGW). Shared facts and helpers: lib/viaduct.mjs.
import { BASE, audience, placeOf } from './lib/viaduct.mjs';
export { displayName } from './lib/viaduct.mjs';

export const RULES = { ...BASE, key: 'viaduct', sites: ['mgw', 'kgw'] };

export function classify({ name, shopType = '', shopTags = [] }) {
  const who = audience(name, shopTags);
  if (who === 'women') return { reject: "women's (on Women's Gear World, viaduct-women)" };
  const place = placeOf(name, shopType);
  if (who === 'kids') {
    if (place.siteCategory === 'Bags & Accessories') return { site: 'kgw', siteCategory: 'Accessories', subcategory: place.subcategory };
    return { site: 'kgw', siteCategory: place.siteCategory === 'Shoes' ? 'Shoes' : 'Clothing', subcategory: place.subcategory };
  }
  if (/^(Dresses & Skirts|Sports Bras & Tops|Leggings)$/.test(place.subcategory)) return { reject: "women's clothing type without a women's tag (check)" };
  return { site: 'mgw', ...place };
}
