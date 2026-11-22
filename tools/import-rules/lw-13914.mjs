// Linkwise programme 13914 (Greece and Cyprus, lessons L199; massive import of 22 Nov 2026): tools/import-rules/lib/linkwise.mjs and
// tools/import-rules/lib/linkwise-programmes.mjs.
import { linkwiseRules } from './lib/linkwise.mjs';

export const { RULES, classify, displayName, productKey } = await linkwiseRules(13914);
