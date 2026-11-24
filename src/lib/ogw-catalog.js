// The catalogue of the big Linkwise stores of Mega Stores (owner, 24 Nov 2026, lessons L228), read from its own D1
// database (binding CATALOG, sites/ogw/catalog-schema.sql, loaded by tools/ogw-site.ps1 -Step catalog). One store per
// page, never compared: every query names one programme. Any failure (no binding, the database busy with an import)
// is "no catalogue": the store page keeps its sets and ideas.
export const CATALOG_MAX_AGE_MS = 72 * 3600 * 1000; // older than this: no catalogue at all (only the sets and ideas)
export const PAGE_SIZE = 48;
const CACHE_MS = 60000;
let cached = { db: null, at: 0, data: null };

// Every store of the catalogue: Map(programme -> { t, products, picks: Map(priceKey -> euros) }), cached a minute.
export async function catalogStores(db, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') return new Map();
  if (cached.db === db && cached.data && now - cached.at < CACHE_MS) return cached.data;
  const out = new Map();
  try {
    const r = await db.prepare('SELECT program, slug, checked_at, products, picks FROM stores').all();
    for (const row of (r && r.results) || []) {
      const t = Date.parse(row.checked_at);
      const program = Number(row.program);
      if (!Number.isInteger(program) || program <= 0 || !Number.isFinite(t)) continue;
      const picks = new Map();
      try {
        const p = JSON.parse(row.picks || '{}');
        for (const [k, v] of Object.entries(p && typeof p === 'object' ? p : {})) {
          if (/^[0-9a-f]{8}$/.test(k) && typeof v === 'number' && v > 0 && v < 100000) picks.set(k, Math.round(v * 100) / 100);
        }
      } catch { /* no prices of its sets */ }
      out.set(String(program), { t, products: Math.max(0, Number(row.products) || 0), picks });
    }
  } catch { return new Map(); }
  cached = { db, at: now, data: out };
  return out;
}
export const catalogFresh = (entry, now, maxAge = CATALOG_MAX_AGE_MS) => Boolean(entry && entry.products > 0 && now - entry.t <= maxAge && entry.t - now <= 600000);

// The top categories of one store, biggest first.
export async function catalogTop(db, program) {
  try {
    const r = await db.prepare('SELECT id, name, slug, products FROM categories WHERE program = ? AND parent = 0 ORDER BY products DESC, name LIMIT 300').bind(program).all();
    return (r && r.results) || [];
  } catch { return null; }
}
// One category of one store: itself, the categories above it, the ones below it and one page of its products (after
// the place `after`, in the store's stable order). null: no such category; throws when the database does not answer.
export async function catalogCategory(db, program, id, after = 0) {
  const cat = await db.prepare('SELECT id, parent, level, name, slug, products FROM categories WHERE program = ? AND id = ?').bind(program, id).first();
  if (!cat) return null;
  const trail = [];
  let up = Number(cat.parent);
  for (let i = 0; up && i < 3; i++) {
    const p = await db.prepare('SELECT id, parent, name, slug FROM categories WHERE program = ? AND id = ?').bind(program, up).first();
    if (!p) break;
    trail.unshift(p);
    up = Number(p.parent);
  }
  const kids = await db.prepare('SELECT id, name, slug, products FROM categories WHERE program = ? AND parent = ? ORDER BY products DESC, name LIMIT 300').bind(program, id).all();
  const col = ['c1', 'c2', 'c3'][Math.min(3, Math.max(1, Number(cat.level))) - 1];
  const rows = await db.prepare(`SELECT pid, pos, name, brand, page, image, price FROM products WHERE program = ? AND ${col} = ? AND pos > ? ORDER BY pos LIMIT ?`)
    .bind(program, id, after, PAGE_SIZE + 1).all();
  const list = (rows && rows.results) || [];
  const next = list.length > PAGE_SIZE ? Number(list[PAGE_SIZE - 1].pos) : 0;
  return { cat, trail, children: (kids && kids.results) || [], products: list.slice(0, PAGE_SIZE), next };
}
