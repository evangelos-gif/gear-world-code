const cache = new Map<string, Intl.NumberFormat>();

/** Price in the retailer's currency (the retailer charges in that currency). */
export function formatPrice(value: number | null, currency: string, locale: string): string {
  if (value === null || !Number.isFinite(value)) return '';
  const cur = /^[A-Z]{3}$/.test(currency) ? currency : 'GBP';
  const key = `${locale}|${cur}`;
  try {
    let f = cache.get(key);
    if (!f) {
      f = new Intl.NumberFormat(locale, { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 });
      cache.set(key, f);
    }
    return f.format(value);
  } catch {
    const sym: Record<string, string> = { GBP: '£', EUR: '€', USD: '$' };
    return `${sym[cur] ?? cur + ' '}${value.toFixed(2)}`;
  }
}
