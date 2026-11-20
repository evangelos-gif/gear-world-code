// More photos of a product (lessons L206). Shared by the import tools (tools/legacy-import-plan.mjs,
// tools/tgw-import-plan.mjs) and the sites (src/db.js, src/pages/product.js), so a photo is judged the same way when it
// is written and when it is shown.
//
// Storage: the products table of every site database has one nullable TEXT column, `images`
// (sites/<site>/migrations/0004_product_images.sql on the new layout, 0002_product_images.sql on the older sites, put in
// the live databases by tools/d1-photo-column.ps1). It holds up to PHOTO_LIMIT EXTRA photos, never the main one
// (image_url), each a full-size https address that passed realImage(), separated by ONE space: a URL as the URL
// serializer writes it never has a raw space (it becomes %20), so the space can never be part of an address.
// NULL (not '') when a product has no extra photo. Example: "https://cdn.shop.com/a-2.jpg https://cdn.shop.com/a-3.jpg".
//
// Only the retailer's own photos from its feed, never a picture made or changed by AI, and no 360-degree spin: a real
// 360-degree or 3D viewer may be added only if a retailer's feed supplies one (none does today).

export const PHOTO_LIMIT = 4;
// A longer address is left out: four of them must fit easily in one D1 statement (100 KB, lessons L118).
export const PHOTO_MAX_LENGTH = 1000;
// Awin's extra photo columns (tools/awin-feed-download.ps1 asks for them; tools/cj-feed.mjs and the other networks'
// tools write their extra photos under the same names).
export const EXTRA_IMAGE_COLUMNS = ['alternate_image', 'alternate_image_two', 'alternate_image_three', 'alternate_image_four'];
// "Image coming soon" and the like are not photos of the product (the same words as tools/tgw-import-plan.mjs, L38).
const PLACEHOLDER = /placeholder|coming[-_ ]?soon|no[-_ ]?image|image[-_ ]?not[-_ ]?available|noimage|no[-_]?photo|default[-_]?image/i;

// The product picture (lessons L38). Awin fills aw_image_url with a placeholder ("images2.productserve.com/noimage.gif")
// when the shop sends none, and with a 200x200 resize proxy ("images2.productserve.com/?w=200&...&url=ssl:cdn.shopify.com/...")
// otherwise. The plan takes the first real picture of the shop's own columns, unwraps the proxy to the full-size image and
// never takes the placeholder: a product without a picture is left out ("no image").
// (Moved here from tools/legacy-import-plan.mjs, which still exports it, without any change: lessons L206.)
export function realImage(raw) {
  let u = String(raw || '').trim();
  // House of Sneakers puts ALL its pictures in one column, joined by commas ("...00_png.png?v=1,https://...01_jpg.jpg?v=2"):
  // the card takes the first one (import of 12 Nov 2026: 9 links in one image_url, lessons L117).
  const list = u.split(/,(?=\s*https?:\/\/)/);
  if (list.length > 1) u = list[0].trim();
  if (!u) return '';
  let parsed;
  try { parsed = new URL(u); } catch { return ''; }
  if (/(^|\.)productserve\.com$/i.test(parsed.hostname)) {
    if (/noimage/i.test(parsed.pathname)) return '';
    const inner = parsed.searchParams.get('url') || '';
    if (!inner) return '';
    u = inner.replace(/^ssl:/i, 'https://').replace(/^http:/i, 'https:');
    if (!/^https:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
    try { parsed = new URL(u); } catch { return ''; }
  }
  if (parsed.protocol !== 'https:' || /noimage|no-image|placeholder/i.test(parsed.pathname)) return '';
  return parsed.toString();
}

// Every real picture of one feed value: a list joined by commas (House of Sneakers, lessons L117) gives each of them.
export function imageList(raw) {
  return String(raw || '').split(/,(?=\s*https?:\/\/)/).map(x => realImage(x)).filter(Boolean);
}

// Query parameters that only change the size, quality or cache copy of a picture: the same photo with another one of
// them is the same photo ("...a.jpg?v=1" and "...a.jpg?v=2", "?w=200" and "?w=600").
const SIZE_PARAMS = new Set(['w', 'h', 'width', 'height', 'v', 'ver', 'version', 'q', 'quality', 'fit', 'crop', 'size', 'format',
  'fm', 'auto', 'dpr', 'resize', 'imwidth', 'cb']);
// The key that tells two addresses of the same photo apart from two photos.
export function photoKey(url) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch { return ''; }
  const kept = [...u.searchParams.entries()].filter(([k]) => !SIZE_PARAMS.has(k.toLowerCase())).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return `${u.hostname.toLowerCase()}${u.pathname}${kept.length ? '?' + new URLSearchParams(kept).toString() : ''}`;
}
const pathOf = u => { try { return new URL(u).pathname; } catch { return ''; } };

// The extra photos of a product from its feed values (each value may be a comma list): real full-size https pictures
// (realImage), never a placeholder, never the main picture again, each photo once, at most `limit`, in the feed's order.
export function extraImages(main, values, limit = PHOTO_LIMIT) {
  const seen = new Set([photoKey(main), photoKey(realImage(main))].filter(Boolean));
  const out = [];
  for (const v of values || []) {
    for (const u of imageList(v)) {
      if (out.length >= limit) return out;
      if (u.length > PHOTO_MAX_LENGTH || PLACEHOLDER.test(pathOf(u))) continue;
      const k = photoKey(u);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(u);
    }
  }
  return out;
}

// The column's value: the addresses joined by one space, or null (NULL) when there is none.
export function encodeImages(list) {
  const l = (list || []).filter(Boolean).slice(0, PHOTO_LIMIT);
  return l.length ? l.join(' ') : null;
}

// The column read back on a site: only https addresses that look like one, never the main photo again, at most
// PHOTO_LIMIT. Anything else (an empty value, a column that does not exist yet) is no extra photo.
export function parseImages(text, main = '') {
  const s = Array.isArray(text) ? text.join(' ') : String(text ?? '');
  if (!s.trim()) return [];
  const seen = new Set([photoKey(main), photoKey(realImage(main))].filter(Boolean));
  const out = [];
  for (const u of s.trim().split(/\s+/)) {
    if (out.length >= PHOTO_LIMIT) break;
    if (u.length > PHOTO_MAX_LENGTH || !/^https:\/\/[^\s"<>]+$/i.test(u)) continue;
    const k = photoKey(u);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}
