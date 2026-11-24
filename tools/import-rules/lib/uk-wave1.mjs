// Shared helpers for the UK shops of wave 1 of the massive import (chat 7, 22-24 Nov 2026, lessons L224): the Rakuten,
// Awin and Daisycon shops in pounds on the older sites. The subcategory names are the ones each site already uses (live
// databases of 24 Nov 2026), never new ones (lessons L56).

export const clean = name => String(name || '').replace(/&amp;/gi, '&').replace(/&#39;|&rsquo;|&#8217;/gi, "'").replace(/&quot;/gi, '"')
  .replace(/[ 　]/g, ' ').replace(/\s{2,}/g, ' ').trim();

// Words that the sites never show in their own texts (lessons L107): a shop's "Official", "VIP Offer", "(offer)" in a
// product name goes; the product itself stays.
export function tidy(name) {
  return clean(name).replace(/^official\s+/i, '').replace(/\s*[-–]\s*vip offer\s*$/i, '').replace(/\s*\(offer\)\s*$/i, '').replace(/\s+offer$/i, '')
    .replace(/\s*[-–]\s*default title.*$/i, '').replace(/\s+-\s+option\d* value.*$/i, '').replace(/\s{2,}/g, ' ').trim();
}

// Shopify option tails such as " - K", " - 54", " - S/M", " - Default Title / Silver": one card per page, named without
// the size (the plan joins the sizes of one page into one card).
export function withoutOption(name) {
  return tidy(name).replace(/\s+-\s+(?:[A-Z]{1,2}(?:\.5|\s*1\/2)?|\d{1,3}(?:\.\d)?|xs|s|m|l|xl|s\/m|m\/l|l\/xl|one size)$/i, '')
    .replace(/\s+-\s+(?:silver|gold|yellow gold|white gold|rose gold|platinum|palladium|steel|brass|copper|black|white|rose)$/i, '').trim();
}
