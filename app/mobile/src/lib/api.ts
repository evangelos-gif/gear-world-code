// Everything the app reads comes from gearworldhub.com and the Gear World sites' public APIs.
// Nothing here writes to a site, except the newsletter sign-up (the same endpoint the Hub page uses).

export const HUB_URL = 'https://gearworldhub.com';
export const LEGAL = {
  privacy: `${HUB_URL}/privacy/`,
  terms: `${HUB_URL}/terms/`,
  affiliate: `${HUB_URL}/affiliate-disclosure/`,
  contact: `${HUB_URL}/contact/`,
  email: 'contact@gearworldhub.com'
} as const;

export type Category = { key: string; name: string; slug: string };
export type World = { key: string; name: string; domain: string; base: string; audience: string; categories: Category[] };

export type Product = {
  key: string;
  id: string;
  worldKey: string;
  worldName: string;
  base: string;
  name: string;
  brand: string;
  retailer: string;
  category: string;
  price: number | null;
  wasPrice: number | null;
  currency: string;
  inStock: boolean | null;
  image: string;
  productUrl: string;
  outUrl: string;
};

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'newest';

/** Used when the Hub cannot be reached on the very first start. The live list always wins. */
export const FALLBACK_WORLDS: World[] = [
  ['CGW', 'Construction Gear World', 'constructiongearworld.com', 'construction'],
  ['MGW', 'Mens Gear World', 'mensgearworld.com', 'adult'],
  ['WGW', 'Womens Gear World', 'womensgearworld.com', 'adult'],
  ['KGW', 'Kids Gear World', 'kidsgearworld.com', 'kids'],
  ['HGW', 'Home Gear World', 'homegearworld.com', 'home'],
  ['GGW', 'Garden Gear World', 'gardengearworld.com', 'garden'],
  ['TGW', 'Technology Gear World', 'technologygearworld.com', 'technology'],
  ['AGW', 'Car Gear World', 'cargearworld.com', 'car']
].map(([key, name, domain, audience]) => ({ key, name, domain, base: `https://${domain}`, audience, categories: [] }));

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function safeBase(domainOrUrl: unknown): string | null {
  const s = String(domainOrUrl ?? '').trim().toLowerCase().replace(/^https:\/\//, '').replace(/\/+$/, '');
  return DOMAIN_RE.test(s) ? `https://${s}` : null;
}

/** Only https links are ever opened from the app. (No URL class: React Native's is incomplete.) */
export function safeHttps(url: unknown): string | null {
  const s = String(url ?? '').trim();
  return /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:[/?#][^\s]*)?$/i.test(s) ? s : null;
}

export function outUrl(base: string, id: string | number): string {
  return `${base}/out/${encodeURIComponent(String(id))}`;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v)).trim();
const stock = (v: unknown): boolean | null => {
  const s = str(v).toLowerCase();
  if (s === 'in_stock' || s === 'instock' || s === 'in stock') return true;
  if (s === 'out_of_stock' || s === 'outofstock' || s === 'out of stock') return false;
  return null;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, headers: { Accept: 'application/json', ...(init.headers ?? {}) } });
    const text = await res.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok) throw new ApiError((data as { error?: string } | null)?.error || `HTTP ${res.status}`, res.status);
    if (data === null) throw new ApiError('Invalid response', res.status);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Hub registry: the list of worlds (new worlds appear here without a new app version) ----------

type RegistryResponse = {
  ok: boolean;
  sites?: { site_key: string; site_name: string; domain: string; audience?: string | null;
    categories?: { category_key: string; category_name: string; slug: string }[] }[];
};

export function parseRegistry(data: RegistryResponse): World[] {
  if (!data || data.ok !== true || !Array.isArray(data.sites)) throw new ApiError('Invalid registry');
  const worlds: World[] = [];
  for (const s of data.sites) {
    const base = safeBase(s.domain);
    const key = str(s.site_key).toUpperCase();
    if (!base || !/^[A-Z]{2,6}$/.test(key)) continue;
    worlds.push({
      key,
      name: str(s.site_name) || key,
      domain: base.slice(8),
      base,
      audience: str(s.audience),
      categories: (s.categories ?? [])
        .filter(c => /^[a-z0-9-]{1,80}$/.test(str(c.slug)))
        .map(c => ({ key: str(c.category_key), name: str(c.category_name), slug: str(c.slug) }))
    });
  }
  if (worlds.length === 0) throw new ApiError('Empty registry');
  return worlds;
}

export async function getWorlds(): Promise<World[]> {
  return parseRegistry(await fetchJson<RegistryResponse>(`${HUB_URL}/api/registry`));
}

// ---------- Search across all worlds (the Hub search) ----------

type HubSearchResponse = {
  ok: boolean; error?: string; count?: number; partial?: boolean; failed_sites?: string[];
  sites?: Record<string, number>;
  results?: Record<string, unknown>[];
};

export type SearchResult = { products: Product[]; counts: Record<string, number>; partial: boolean };

export function parseHubResult(r: Record<string, unknown>): Product | null {
  const base = safeBase(r.site_url);
  const id = str(r.id ?? r.product_id);
  const name = str(r.product_name);
  if (!base || !id || !name) return null;
  const worldKey = str(r.site).toUpperCase();
  return {
    key: `${worldKey}:${id}`,
    id,
    worldKey,
    worldName: str(r.site_name) || worldKey,
    base,
    name,
    brand: str(r.brand),
    retailer: str(r.retailer),
    category: str(r.category),
    price: num(r.price),
    wasPrice: null,
    currency: str(r.currency) || 'GBP',
    inStock: stock(r.stock_status),
    image: safeHttps(r.image_url) ?? '',
    productUrl: safeHttps(r.product_url) ?? base,
    outUrl: outUrl(base, id)
  };
}

export function parseSearch(data: HubSearchResponse): SearchResult {
  if (!data || data.ok !== true) throw new ApiError(data?.error || 'Search failed');
  const products = (data.results ?? []).map(parseHubResult).filter((p): p is Product => p !== null);
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(data.sites ?? {})) if (Number(v) > 0) counts[k.toUpperCase()] = Number(v);
  return { products, counts, partial: Boolean(data.partial) };
}

export async function searchAll(query: string): Promise<SearchResult> {
  const q = query.trim().slice(0, 80);
  return parseSearch(await fetchJson<HubSearchResponse>(`${HUB_URL}/api/search?q=${encodeURIComponent(q)}`, {}, 20000));
}

// ---------- One world: the site's own product API ----------

type SiteProductsResponse = {
  ok: boolean;
  products?: Record<string, unknown>[];
  pagination?: { page: number; limit: number; total: number; has_more: boolean };
};

export type WorldPage = { products: Product[]; total: number; hasMore: boolean; page: number };

export function parseSiteProduct(p: Record<string, unknown>, world: Pick<World, 'key' | 'name' | 'base'>): Product | null {
  const id = str(p.id);
  const name = str(p.product_name);
  if (!id || !name) return null;
  return {
    key: `${world.key}:${id}`,
    id,
    worldKey: world.key,
    worldName: world.name,
    base: world.base,
    name,
    brand: str(p.brand),
    retailer: str(p.retailer),
    category: str(p.site_category),
    price: num(p.price),
    wasPrice: num(p.was_price),
    currency: str(p.currency) || 'GBP',
    inStock: stock(p.stock_status),
    image: safeHttps(p.image_url) ?? '',
    productUrl: safeHttps(p.product_url) ?? world.base,
    outUrl: outUrl(world.base, id)
  };
}

export function worldProductsUrl(world: Pick<World, 'base'>, opts: { search?: string; category?: string; sort?: SortKey; page?: number; limit?: number }): string {
  // Built by hand: URLSearchParams is incomplete in React Native.
  const parts: [string, string][] = [];
  if (opts.search && opts.search.trim()) parts.push(['search', opts.search.trim().slice(0, 80)]);
  if (opts.category) parts.push(['category', opts.category]);
  if (opts.sort && opts.sort !== 'featured') parts.push(['sort', opts.sort]);
  parts.push(['page', String(Math.max(1, opts.page ?? 1))]);
  parts.push(['limit', String(Math.min(60, Math.max(1, opts.limit ?? 24)))]);
  return `${world.base}/api/products?${parts.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export async function worldProducts(world: World, opts: Parameters<typeof worldProductsUrl>[1]): Promise<WorldPage> {
  const data = await fetchJson<SiteProductsResponse>(worldProductsUrl(world, opts), {}, 15000);
  if (!data || data.ok !== true) throw new ApiError('Products failed');
  const products = (data.products ?? []).map(p => parseSiteProduct(p, world)).filter((p): p is Product => p !== null);
  const pg = data.pagination;
  return { products, total: pg?.total ?? products.length, hasMore: Boolean(pg?.has_more), page: pg?.page ?? 1 };
}

// ---------- Newsletter (same endpoint and consent as the Hub page) ----------

export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function subscribe(email: string, locale: string): Promise<void> {
  const data = await fetchJson<{ ok: boolean; error?: string }>(`${HUB_URL}/api/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), locale, consent: true, website: '' })
  });
  if (!data.ok) throw new ApiError(data.error || 'subscribe_failed');
}
