// Text helpers shared by pages, sitemap and the import tool.

export function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/g, '') || 'product';
}

export function productPath(product) {
  return `/product/${product.product_slug || slugify(product.product_name)}-${product.id}/`;
}

export function categoryPath(slug) {
  return `/category/${slug}/`;
}

export function formatPrice(amount, currency = 'GBP', locale = 'en-GB') {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
}

export function savingPercent(price, wasPrice) {
  const p = Number(price);
  const w = Number(wasPrice);
  if (!Number.isFinite(p) || !Number.isFinite(w) || w <= p || p <= 0) return 0;
  const pct = Math.round(((w - p) / w) * 100);
  return pct >= 5 && pct <= 90 ? pct : 0;
}

export function truncate(value, max) {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut) + '…';
}

export function formatDate(iso, locale = 'en-GB') {
  const d = new Date(String(iso ?? '').replace(' ', 'T') + (String(iso ?? '').endsWith('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/London' }).format(d);
}
