// Women's Gear World: the same general category rules as the newer sites (classify by product name, then the shop's section),
// shared with the other fashion site in sites/_shared/fashion-rules.js. Used by the Hub's shadow catalogue and, later,
// by the shared import (owner, 31 Oct 2026: every product through the Hub, the same logic on all 11 sites).
import { makeRules, cleanProductName, QUALITY, CATEGORY_NAMES } from '../_shared/fashion-rules.js';

const rules = makeRules('wgw');
export const classify = rules.classify;
export const CATEGORY_SLUGS = rules.CATEGORY_SLUGS;
// The database of this site keeps category NAMES (layout "legacy", site.config.js database.categories).
export const CATEGORY_DB_NAMES = CATEGORY_NAMES.wgw;
export { cleanProductName, QUALITY };
