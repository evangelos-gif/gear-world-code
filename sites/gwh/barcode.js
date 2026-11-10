// GWH-BARCODE (lessons L115, 10/11/2026): barcode search across all Gear World sites, for the "Scan barcode" button of the
// Gear World app and the page /barcode/ of the Hub.
//   GET /api/barcode?code=<EAN-8, UPC-A, EAN-13 or GTIN-14>&country=XX
// The code is checked here first (GS1 check digit, the same rules as src/lib/gtin.js of the sites; 400 when it is not a
// GTIN). Then every active site of the Hub's list (D1 gear_world_registry, like /api/search) is asked once:
//   https://<site>/api/products?gtin=<code>&limit=20&deliver_to=<country>&translate=0
// at most 6 at a time, each with its own 4.5 s from the moment it is really asked (lessons L74), with the Hub's user agent.
// A site lists only the retailers that deliver to the visitor's country (lessons L107: ?country=, else Cloudflare's
// country of the visitor; unknown and Google's crawlers: GB). Each site finds the code through an index (exact match,
// never a word search, lessons L51, L105, L115). No translation and no model call of any kind: a barcode is digits.
// A site answer counts only when it says it looked for this GTIN (its "gtin"): an older site version would send its
// plain product list for the same address, which is not a match. The answer is private (it depends on the country).

// The GS1 check digit, exactly like src/lib/gtin.js normalizeGtin (tests compare the two on many codes). The Hub is
// deployed from sites/gwh only, so it keeps its own copy.
export function normalizeGtin(value) {
  const digits = String(value ?? "").replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  if (/^0+$/.test(digits)) return null;
  let sum = 0;
  const body = digits.slice(0, -1);
  for (let i = 0; i < body.length; i++) {
    const n = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[digits.length - 1]) ? digits : null;
}

export const BARCODE_SITE_TIMEOUT_MS = 4500;
export const BARCODE_LIMIT = 20;
export const BARCODE_ERROR = "Invalid barcode: send the 8, 12, 13 or 14 digits of an EAN, UPC or GTIN.";

// At most 6 requests at a time, each timer starting when its request is sent (the same as the search, lessons L74).
export async function settleAtMostSix(items, task) {
  const out = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = { status: "fulfilled", value: await task(items[i]) }; }
      catch (reason) { out[i] = { status: "rejected", reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, items.length) }, lane));
  return out;
}

function json(status, data, cache) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache || "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

const STOCK_ORDER = { in_stock: 0, check_retailer: 1, out_of_stock: 2 };

// opts: { visitorCountry(request) -> "GB" | "DE" ..., userAgent, fetchImpl }
export async function handleBarcode(request, env, opts = {}) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("code") ?? url.searchParams.get("gtin") ?? url.searchParams.get("barcode") ?? "";
  const gtin = String(raw).length <= 64 ? normalizeGtin(raw) : null;
  if (!gtin) return json(400, { ok: false, error: BARCODE_ERROR });
  const countryRaw = String(url.searchParams.get("country") || "").trim().toUpperCase();
  if (countryRaw && !/^[A-Z]{2}$/.test(countryRaw)) return json(400, { ok: false, error: "Invalid country code." });
  const country = countryRaw || null;
  const deliverTo = country || (typeof opts.visitorCountry === "function" ? opts.visitorCountry(request) : "GB");
  const doFetch = opts.fetchImpl || ((u, init) => fetch(u, init));
  try {
    const siteRows = await env.gear_world_registry.prepare(`
      SELECT site_key, site_name, domain FROM sites
      WHERE is_active = 1 ORDER BY priority ASC, site_name ASC
    `).all();
    const sites = (siteRows.results || []).map(row => ({
      key: String(row.site_key || "").toLowerCase(),
      name: row.site_name,
      base: `https://${row.domain}`
    })).filter(site => /^https:\/\/[a-z0-9.-]+$/.test(site.base));
    const settled = await settleAtMostSix(sites, async site => {
      const endpoint = new URL("/api/products", site.base);
      endpoint.searchParams.set("gtin", gtin);
      endpoint.searchParams.set("limit", String(BARCODE_LIMIT));
      endpoint.searchParams.set("deliver_to", deliverTo);
      endpoint.searchParams.set("translate", "0");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), BARCODE_SITE_TIMEOUT_MS);
      try {
        const response = await doFetch(endpoint.toString(), {
          headers: { Accept: "application/json", "User-Agent": opts.userAgent || "GearWorldHub/1.0" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`${site.key} returned ${response.status}`);
        const data = await response.json();
        // Only a barcode answer for this code counts (an older site version answers its plain list instead).
        if (!data || data.ok !== true || String(data.gtin || "") !== gtin) throw new Error(`${site.key}: not a barcode answer`);
        return { site, products: Array.isArray(data.products) ? data.products.slice(0, BARCODE_LIMIT) : [] };
      } finally {
        clearTimeout(timeout);
      }
    });
    const results = [];
    const failures = [];
    const seen = new Set();
    const siteCounts = Object.fromEntries(sites.map(site => [site.key, 0]));
    settled.forEach((outcome, index) => {
      if (outcome.status !== "fulfilled") { failures.push(sites[index].key); return; }
      const { site, products } = outcome.value;
      for (const product of products) {
        if (!product || product.id === null || product.id === undefined) continue;
        const key = `${site.key}:${String(product.id)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const own = String(product.product_url || "");
        results.push({
          id: product.id,
          product_id: product.id,
          site: site.key,
          site_name: site.name,
          site_url: site.base,
          product_name: product.product_name || "",
          brand: product.brand || "",
          retailer: product.retailer || "",
          category: product.site_category || "",
          subcategory: product.subcategory || "",
          merchant_category: product.merchant_category || "",
          price: product.price,
          currency: product.currency || null,
          stock_status: product.stock_status || "",
          offers: Number(product.offers) || 1,
          image_url: product.image_url || "",
          country_code: country,
          delivery_status: "UNKNOWN",
          // The product page on its own site (never /out/ or /go/: the site's button there goes to the retailer).
          product_url: own.startsWith(`${site.base}/product/`) ? own : `${site.base}/?highlight=${encodeURIComponent(String(product.id))}`
        });
        siteCounts[site.key]++;
      }
    });
    // In stock first, then the lowest price (pounds before other currencies), then the order of the sites.
    const order = new Map(results.map((r, i) => [r, i]));
    results.sort((a, b) => ((STOCK_ORDER[a.stock_status] ?? 3) - (STOCK_ORDER[b.stock_status] ?? 3))
      || ((a.currency === "GBP" ? 0 : 1) - (b.currency === "GBP" ? 0 : 1))
      || ((Number(a.price) || 0) - (Number(b.price) || 0))
      || (order.get(a) - order.get(b)));
    return json(200, {
      ok: true, code: gtin, gtin14: gtin.padStart(14, "0"), count: results.length,
      sites: siteCounts, results,
      country_code: country,
      deliver_to: deliverTo,
      partial: failures.length > 0,
      failed_sites: failures
    }, "private, max-age=60");
  } catch (error) {
    console.error("Gear World Hub barcode search error:", error);
    return json(500, { ok: false, error: "Barcode search is temporarily unavailable." });
  }
}
