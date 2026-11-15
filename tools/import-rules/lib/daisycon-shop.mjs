// Daisycon shops whose links carry the shop page only as a path ("dl=collections/bolt/invicta-bolt-46037-...", round 3,
// 15 Nov 2026, lessons L145): the page is the shop's own address and that path, put together as Daisycon does. The shop's
// address is read once by hand from a real product page (the programme details of the Daisycon API answer 403 to our app).
import { pageFromDl } from '../../daisycon-feed.mjs';

// field(c, column) for the import plan: merchant_deep_link from the link when the file has none; category_name carries
// Daisycon's "gender_target" (dc_gender) to the rules, which do not store it.
export function daisyconField(shopUrl) {
  return (c, column) => {
    if (c === 'merchant_deep_link') return column('merchant_deep_link') || pageFromDl(column('aw_deep_link'), shopUrl);
    if (c === 'category_name') return column('dc_gender') || column('category_name');
    return column(c);
  };
}

// One card per shop page (sizes and colours are options of it).
export function pageKey(get) {
  try {
    const u = new URL(get('merchant_deep_link'));
    const path = u.pathname.replace(/^\/+|\/+$/g, '');
    if (/^[A-Za-z0-9][A-Za-z0-9/._%()+-]{2,240}$/.test(path)) return path.toLowerCase();
  } catch { /* no page */ }
  return String(get('merchant_product_id') || get('aw_product_id') || '').trim();
}
