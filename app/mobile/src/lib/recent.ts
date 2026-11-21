// Recent searches: the last few things the person searched for, kept only on this phone (no account).
// Plain functions, no React, so the Node tests can check them.

export const RECENT_KEY = 'gw-recent-v1';
export const RECENT_MAX = 8;

const clean = (q: unknown): string => (typeof q === 'string' ? q.replace(/\s+/g, ' ').trim().slice(0, 80) : '');

/** Newest first; the same words in other letters (Drill / drill) count once. */
export function addRecent(list: string[], query: string): string[] {
  const q = clean(query);
  if (q.length < 2) return list;
  return [q, ...list.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_MAX);
}

export function removeRecent(list: string[], query: string): string[] {
  return list.filter(x => x.toLowerCase() !== clean(query).toLowerCase());
}

export function parseRecent(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(data)) return [];
  // Stored newest first: keep that order, drop repeats and anything that is not a search.
  const out: string[] = [];
  for (const item of data) {
    const q = clean(item);
    if (q.length < 2 || out.some(x => x.toLowerCase() === q.toLowerCase())) continue;
    out.push(q);
    if (out.length >= RECENT_MAX) break;
  }
  return out;
}
