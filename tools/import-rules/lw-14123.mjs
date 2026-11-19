// Linkwise programme 14123 (Greece and Cyprus, lessons L199): tools/import-rules/lib/linkwise.mjs and
// tools/import-rules/lib/linkwise-programmes.mjs.
import { linkwiseRules } from './lib/linkwise.mjs';

export const { RULES, classify, displayName, productKey } = await linkwiseRules(14123);
