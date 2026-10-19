// Search in other languages. When a search finds nothing (for example a Greek word on an English catalogue),
// the site asks Gear World Hub, through the private service binding GW_HUB, for the English search words.
// Same rule as the older sites: only on page 1 of an empty search, only 4-80 characters, and the answer
// must look like plain search words. Nothing else is sent (no visitor data).

const CANDIDATE = /^[A-Za-z0-9][A-Za-z0-9 \-+./&()']*$/;

export async function hubTranslation(env, q) {
  const term = String(q || '').normalize('NFKC').trim();
  if (term.length < 4 || term.length > 80) return '';
  if (!env || !env.GW_HUB || typeof env.GW_HUB.fetch !== 'function' || !env.GW_INTERNAL_TOKEN) return '';
  try {
    const answer = await env.GW_HUB.fetch(new Request('https://gearworldhub.com/__gw_internal/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GW_INTERNAL_TOKEN}` },
      body: JSON.stringify({ q: term })
    }));
    if (!answer.ok) return '';
    const data = await answer.json();
    const candidate = typeof data?.candidate === 'string' ? data.candidate.trim() : '';
    if (candidate.length < 2 || candidate.length > 80 || !CANDIDATE.test(candidate)) return '';
    if (candidate.toLowerCase() === term.toLowerCase()) return '';
    return candidate;
  } catch {
    return '';
  }
}
