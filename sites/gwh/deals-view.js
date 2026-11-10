// GWH-DEALS-VIEW (lessons L114, L115): the deals of the Hub follow the visitor's country, like the codes on the sites.
// public/hub-deals.json (made by tools/gwh-deals.mjs from promos/promos.js) gives every deal "hide_in": the countries
// where at least one of the sites it names does NOT show that retailer's code, worked out with the sites' own view rules
// (src/lib/visibility.js viewFor + retailerInView, each site's deliversTo): e.g. the UK-only Tooled Up and My Tool Shed
// codes are hidden in Germany, Belgium and every other European country where Construction Gear World has a view of its
// own (Reidl, VEVOR, GRABO), and shown in the UK. A country without a view of its own (the US, unknown, ...) gets the
// UK view, and Google's crawlers count as the UK (visitorCountry of worker.js), exactly like the sites.
// The page (hub-v2.js) and the Gear World app read /hub-deals.json, so the answer is filtered here, for both.
// ?country=XX picks the country, like /api/search?country= (the live checks of tools/gwh-hub-v2.ps1 ask GB, so the file
// can be compared byte for byte). When nothing is hidden the bytes are exactly the file's. The answer is private.

// The countries that can have a view of their own (src/lib/visibility.js OWN_VIEW_COUNTRIES; the tests check both agree).
export const OWN_VIEW_COUNTRIES = ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT",
  "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "IS", "LI", "NO", "CH", "GB"];

// Is a deal hidden for this country? A country named in hide_in: hidden. Any other country without a view of its own
// sees what the UK sees.
export function dealHidden(deal, country) {
  const list = deal && Array.isArray(deal.hide_in) ? deal.hide_in : [];
  const cc = String(country || "").toUpperCase();
  if (list.includes(cc)) return true;
  return !OWN_VIEW_COUNTRIES.includes(cc) && list.includes("GB");
}

export function dealsFor(data, country) {
  const deals = data && Array.isArray(data.deals) ? data.deals : [];
  return deals.filter(d => !dealHidden(d, country));
}

// GET/HEAD /hub-deals.json. visitorCountry: worker.js visitorCountry (GB for unknown and for Google's crawlers).
export async function handleDeals(request, env, visitorCountry) {
  const url = new URL(request.url);
  const asked = String(url.searchParams.get("country") || "").trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(asked) ? asked : visitorCountry(request);
  // A plain GET of the file (no If-None-Match: one country's copy must never be confirmed for another).
  const file = await env.ASSETS.fetch(new Request(new URL("/hub-deals.json", url.origin).toString(), { method: "GET" }));
  if (file.status !== 200) return file;
  const text = await file.text();
  let body = text;
  try {
    const data = JSON.parse(text);
    const kept = dealsFor(data, country);
    if (Array.isArray(data.deals) && kept.length !== data.deals.length) body = JSON.stringify({ ...data, deals: kept }, null, 2) + "\n";
  } catch (_) {
    // Not JSON: never send deals nobody can check.
    body = JSON.stringify({ deals: [] });
  }
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff"
  });
  return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
}
