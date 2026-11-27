// Linkwise programme 11742 (Greece and Cyprus, lessons L199; massive import of 22 Nov 2026): tools/import-rules/lib/linkwise.mjs and
// tools/import-rules/lib/linkwise-programmes.mjs.
// CLOSED (lessons L225): Linkwise removed The Body Shop at the end of 23 Nov 2026 (chat 7, the email to Julia of 24 Nov says we
// take it off). Every product is rejected from now on, so neither an import nor a refresh shows its cards again; the cards on
// WGW are hidden by tools/cleanup-rules/closed.mjs. If the programme comes back: delete CLOSED and the classify below.
import { linkwiseRules } from './lib/linkwise.mjs';

const base = await linkwiseRules(11742);
export const { RULES, displayName, productKey } = base;
export const CLOSED = '23 Nov 2026: programme removed by Linkwise';
export function classify() { return { reject: `programme closed (${CLOSED})` }; }
