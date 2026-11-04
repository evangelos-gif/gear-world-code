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

/** An amount for a deal: whole numbers without decimals (£4, not £4.00), as on the Hub. */
export function formatMoney(value: number, currency: string, locale: string): string {
  const cur = /^[A-Z]{3}$/.test(currency) ? currency : 'GBP';
  const whole = Math.round(value) === value;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: cur, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(value);
  } catch {
    const sym: Record<string, string> = { GBP: '£', EUR: '€', USD: '$' };
    return `${sym[cur] ?? cur + ' '}${whole ? value : value.toFixed(2)}`;
  }
}

/** A UK day (YYYY-MM-DD) as "27 November" in the app's language. */
export function formatDay(day: string, locale: string, month: 'long' | 'short' = 'long'): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  } catch {
    return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  }
}
