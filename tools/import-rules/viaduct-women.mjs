// Import rules for Viaduct Clothing (Awin 125096): women's and unisex sportswear -> WGW.
// Men's and juniors: viaduct.mjs (MGW, KGW). Shared facts and helpers: lib/viaduct.mjs.
import { BASE, audience, placeOf } from './lib/viaduct.mjs';
export { displayName } from './lib/viaduct.mjs';

export const RULES = { ...BASE, key: 'viaduct-women', sites: ['wgw'] };

export function classify({ name, shopType = '', shopTags = [] }) {
  const who = audience(name, shopTags);
  if (who !== 'women' && who !== 'both') return { reject: who === 'kids' ? "juniors (on Kids' Gear World)" : "men's (on Men's Gear World)" };
  return { site: 'wgw', ...placeOf(name, shopType) };
}
