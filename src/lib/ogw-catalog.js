// The catalogue of the big Linkwise stores of Mega Stores (owner, 24 Nov 2026, lessons L228), read from its own D1
// database (binding CATALOG, sites/ogw/catalog-schema.sql, loaded by tools/ogw-site.ps1 -Step catalog). One store per
// page, never compared: every query names one programme. Every read has a time limit (an import keeps the database
// busy): a failure is "busy" (the category pages answer 503, the store pages keep their sets and ideas), never a wait.
export const CATALOG_MAX_AGE_MS = 72 * 3600 * 1000; // older than this: no catalogue at all (only the sets and ideas)
export const PAGE_SIZE = 48;
export const QUERY_TIMEOUT_MS = 1500;
const CACHE_MS = 10000;
const FAIL_CACHE_MS = 30000;
let cached = { db: null, at: 0, state: null };

export function withTimeout(promise, ms = QUERY_TIMEOUT_MS) {
  let timer;
  const t = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('D1 timeout')), ms); });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

// Every store of the catalogue: { ok, stores: Map(programme -> { t, products, loading, picks: Map(priceKey -> euros) }) },
// 10 seconds in memory, so a load that starts shows «being updated» within seconds (a failure: 30 seconds, so a busy
// database is not asked again at every page).
export async function catalogState(db, now = Date.now()) {
  if (!db || typeof db.prepare !== 'function') return { ok: true, stores: new Map() };
  if (cached.db === db && cached.state && now - cached.at < (cached.state.ok ? CACHE_MS : FAIL_CACHE_MS) && now >= cached.at) return cached.state;
  let state;
  try {
    const r = await withTimeout(db.prepare('SELECT program, slug, checked_at, products, loading, picks FROM stores').all());
    const stores = new Map();
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
      stores.set(String(program), { t, products: Math.max(0, Number(row.products) || 0), loading: Number(row.loading) === 1, picks });
    }
    state = { ok: true, stores };
  } catch {
    state = { ok: false, stores: new Map() };
  }
  cached = { db, at: now, state };
  return state;
}
export const catalogStores = async (db, now) => (await catalogState(db, now)).stores;
// A catalogue to show: loaded (not in the middle of a load), with products, its feed of the last 72 hours (maxAge).
export const catalogFresh = (entry, now, maxAge = CATALOG_MAX_AGE_MS) => Boolean(entry && !entry.loading && entry.products > 0 && now - entry.t <= maxAge && entry.t - now <= 600000);

// The top categories of one store, biggest first; null when the database does not answer.
export async function catalogTop(db, program) {
  try {
    const r = await withTimeout(db.prepare('SELECT id, name, slug, products FROM categories WHERE program = ? AND parent = 0 ORDER BY products DESC, name LIMIT 300').bind(program).all());
    return (r && r.results) || [];
  } catch { return null; }
}
// One category of one store: itself, the categories above it, the ones below it and one page of its products (after
// the place `after`, in the store's stable order). null: no such category; throws when the database does not answer.
export async function catalogCategory(db, program, id, after = 0) {
  const first = (sql, ...args) => withTimeout(db.prepare(sql).bind(...args).first());
  const all = async (sql, ...args) => ((await withTimeout(db.prepare(sql).bind(...args).all())) || {}).results || [];
  const cat = await first('SELECT id, parent, level, name, slug, products FROM categories WHERE program = ? AND id = ?', program, id);
  if (!cat) return null;
  const trail = [];
  let up = Number(cat.parent);
  for (let i = 0; up && i < 3; i++) {
    const p = await first('SELECT id, parent, name, slug FROM categories WHERE program = ? AND id = ?', program, up);
    if (!p) break;
    trail.unshift(p);
    up = Number(p.parent);
  }
  const children = await all('SELECT id, name, slug, products FROM categories WHERE program = ? AND parent = ? ORDER BY products DESC, name LIMIT 300', program, id);
  const col = ['c1', 'c2', 'c3'][Math.min(3, Math.max(1, Number(cat.level))) - 1];
  const list = await all(`SELECT pid, pos, name, brand, page, image, price FROM products WHERE program = ? AND ${col} = ? AND pos > ? ORDER BY pos LIMIT ?`, program, id, after, PAGE_SIZE + 1);
  const next = list.length > PAGE_SIZE ? Number(list[PAGE_SIZE - 1].pos) : 0;
  return { cat, trail, children, products: list.slice(0, PAGE_SIZE), next };
}
