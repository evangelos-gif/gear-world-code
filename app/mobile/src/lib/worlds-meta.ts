import { HUB_URL, type World } from './api';

// Order of the world titles and descriptions in the Hub translations (translations.js, V2.titles).
export const HUB_ORDER = ['CGW', 'MGW', 'WGW', 'KGW', 'HGW', 'GGW', 'TGW', 'AGW', 'VGW', 'SGW'];

/** The Hub keeps one photo per world at /hub-<code>.jpg (the same photo as the Hub card). */
export function worldImage(key: string): string {
  return `${HUB_URL}/hub-${key.toLowerCase()}.jpg`;
}

export function worldTitle(world: Pick<World, 'key' | 'name'>, titles: string[]): string {
  const i = HUB_ORDER.indexOf(world.key);
  if (i >= 0 && titles[i]) return titles[i];
  return world.name.replace(/\s*Gear World$/i, '') || world.name;
}

export function worldDescription(world: Pick<World, 'key'>, descriptions: string[]): string {
  const i = HUB_ORDER.indexOf(world.key);
  return i >= 0 && descriptions[i] ? descriptions[i] : '';
}

/** "Shop by Interest" on the Hub: the same 6 shortcuts, opened inside the app. */
export const INTERESTS = [
  { label: 'powerTools', world: 'CGW', category: 'power-tools' },
  { label: 'safetyBoots', world: 'CGW', category: 'safety-boots' },
  { label: 'mensShoes', world: 'MGW', category: 'shoes' },
  { label: 'mensWatches', world: 'MGW', category: 'watches' },
  { label: 'womensBags', world: 'WGW', category: 'bags-accessories' },
  { label: 'womensFashion', world: 'WGW', category: 'clothing' }
] as const;
