// A site's config as it was before the Priority A lines (L234, sites/_shared/wave-a.js), for the tests that use a real
// site as the example of an engine rule (AGW: "nobody ships to the US there", WGW: a collection walked in one statement).
// tests/worker/wave-a.test.mjs checks the lines themselves on the real configs.
import { WAVE_A } from '../../sites/_shared/wave-a.js';

export function withoutWaveA(code, site) {
  const names = new Set(WAVE_A.filter(e => e.site === code).map(e => e.retailer));
  if (!names.size || !site.deliversTo) return site;
  const keep = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !names.has(k)));
  const d = site.deliversTo;
  return { ...site, deliversTo: { ...d, retailers: keep(d.retailers), ...(d.languages ? { languages: keep(d.languages) } : {}) } };
}
