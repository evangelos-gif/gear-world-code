// Linkwise programme 10981 (Greece and Cyprus, lessons L199): tools/import-rules/lib/linkwise.mjs and
// tools/import-rules/lib/linkwise-programmes.mjs. Yolenis (home and kitchen), approved 28 Nov 2026 (chat 7).
import { linkwiseRules } from './lib/linkwise.mjs';

export const { RULES, classify, displayName, productKey } = await linkwiseRules(10981);
