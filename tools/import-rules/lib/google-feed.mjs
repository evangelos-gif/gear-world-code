// Shops whose Awin feed comes only in the Google format ("<advertiser>-retail-en_GB.csv.gz", from the Awin feed list of
// Google feeds; tools/awin-feed-download.ps1 saves it in the archive, lessons L114). The planner reads Awin column names;
// these helpers give it the Google file and map the Google columns to the Awin names (the same way as gsworkwear.mjs).
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

// The shop's Google file(s) in the archive, else in the folder above it (Downloads), never an older copy in _old.
export function googleFeedFiles(advertiserId) {
  const id = String(advertiserId);
  const re = new RegExp(`^${id}-[A-Za-z0-9_-]+\\.csv(\\.gz)?$`, 'i');
  return function feedFiles(archive) {
    for (const dir of [archive, dirname(archive)]) {
      let names = [];
      try { names = readdirSync(dir); } catch { continue; }
      const found = names.filter(n => re.test(n)).sort().map(n => join(dir, n)).filter(f => existsSync(f));
      if (found.length) return found;
    }
    return [];
  };
}

const first = (column, names) => { for (const n of names) { const v = column(n); if (v) return v; } return ''; };
const host = u => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

// Google Shopping column names -> the Awin names the import planner reads.
export function googleField(name, column) {
  switch (name) {
    case 'product_name': return first(column, ['product_name', 'title']);
    case 'brand_name': return first(column, ['brand_name', 'brand']);
    case 'merchant_category': return first(column, ['merchant_category', 'product_type', 'google_product_category']);
    case 'category_name': return first(column, ['category_name', 'google_product_category']);
    case 'merchant_image_url': return first(column, ['merchant_image_url', 'image_link']);
    case 'ean': return first(column, ['ean', 'gtin']);
    // The price the shop asks today: the sale price when there is one ("24.00 GBP" -> parsed by the planner).
    case 'search_price': return first(column, ['search_price', 'sale_price', 'price']);
    case 'merchant_product_id': return first(column, ['merchant_product_id', 'id', 'mpn']);
    case 'merchant_deep_link': {
      // The shop's own page (the planner builds the Awin tracking link from it). Never the Awin link itself.
      const page = first(column, ['merchant_deep_link', 'link', 'mobile_link']);
      return page && !/(^|\.)awin1\.com$/.test(host(page)) ? page : '';
    }
    case 'currency': {
      const c = column('currency');
      if (c) return c;
      const p = first(column, ['sale_price', 'price']);
      return (p.match(/\b([A-Z]{3})\b/) || [])[1] || (/£/.test(p) ? 'GBP' : '');
    }
    case 'stock_quantity': {
      const q = column('stock_quantity');
      if (q) return q;
      const a = column('availability').toLowerCase().replace(/[\s-]+/g, '_');
      if (a === 'in_stock' || a === 'limited_stock') return '1';
      if (a === 'out_of_stock' || a === 'discontinued') return '0';
      return ''; // backorder, preorder or empty: unknown
    }
    case 'parent_product_id': return first(column, ['parent_product_id', 'item_group_id']);
    default: return column(name);
  }
}

// A card made from ONE option keeps that option in its name ("Animal Blanket - one size / Animal / White",
// "Venter Chino Shorts - XXL"): take off the option part (" / " between its parts, or a plain size) at the end.
const SIZE = /^(?:uk\s*|eu\s*|us\s*)?(?:x{0,3}s|s|m|l|x{1,3}l|\dxl|xxs|one(?: size)?|os|\d{1,2}(?:\.5)?|\d{1,2}\s*-\s*\d{1,2}\s*(?:yrs?|y|mths?|m)?|\d{1,2}\s*(?:yrs?|y|mths?|years?|months?))$/i;
export function stripOption(name) {
  let s = String(name || '').replace(/\s{2,}/g, ' ').trim();
  const m = /^(.*\S)\s+-\s+(.+)$/.exec(s);
  if (m && (/\s\/\s/.test(m[2]) || SIZE.test(m[2].trim()))) s = m[1];
  // The words all sizes share can end in the size system ("Pro Tennis V-Back Tank - UK" from "- UK 8", "- UK 10").
  return s.replace(/\s+-\s+(?:UK|EU|US)\s*$/, '').replace(/\s+-\s*$/, '').trim();
}
