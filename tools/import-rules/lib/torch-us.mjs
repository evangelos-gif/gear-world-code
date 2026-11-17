// The three US torch makers of wave 3 (Skilhunt, WUBEN, NITECORE; lessons L170) on Construction Gear World: flashlights,
// headlamps and work lights go to Site Equipment > Lighting (CGW's place for site and work lights); batteries, chargers,
// lenses, holsters and other spare parts are left out.
import { clean } from './wave3-legacy.mjs';

export function placeTorch(name) {
  const n = clean(name);
  if (!n) return { reject: 'no name' };
  if (/diffuser|holster|souvenir box|gift box only/i.test(n)) return { reject: 'diffuser, holster or box' };
  if (/batter(y|ies)|charger|cable|optics?|lens|holster|clip\b|o-?ring|diffuser|filter|mount|bracket|strap|lanyard|gift ?card|sticker|patch\b/i.test(n) && !/(flashlight|headlamp|torch|lantern|work light)(?!.*(battery|charger))/i.test(n)) {
    return { reject: 'battery, charger or spare part' };
  }
  if (/flashlight|headlamp|head lamp|torch|lantern|work light|spotlight|searchlight|keychain light|edc light|hunting kit|lumens?/i.test(n)) {
    return { site: 'cgw', siteCategory: 'Site Equipment', subcategory: 'Lighting', name: n };
  }
  return { reject: 'not a light' };
}
