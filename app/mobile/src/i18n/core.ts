// Language logic without React, so it can be tested with plain Node.

export const LOCALES = [
  { code: 'en-GB', name: 'English' },
  { code: 'el-GR', name: 'Ελληνικά' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'it-IT', name: 'Italiano' },
  { code: 'es-ES', name: 'Español' },
  { code: 'pt-PT', name: 'Português' },
  { code: 'nl-NL', name: 'Nederlands' },
  { code: 'sq-AL', name: 'Shqip' },
  { code: 'ro-RO', name: 'Română' },
  { code: 'ru-RU', name: 'Русский' }
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];
export const DEFAULT_LOCALE: LocaleCode = 'en-GB';

export function isLocale(value: unknown): value is LocaleCode {
  return typeof value === 'string' && LOCALES.some(l => l.code === value);
}

/** Picks the first supported language from the phone's list (exact tag first, then same language), else English. */
export function pickLocale(deviceTags: readonly (string | null | undefined)[]): LocaleCode {
  for (const tag of deviceTags) {
    if (!tag) continue;
    const exact = LOCALES.find(l => l.code.toLowerCase() === tag.toLowerCase());
    if (exact) return exact.code;
    const lang = tag.split(/[-_]/)[0].toLowerCase();
    const same = LOCALES.find(l => l.code.split('-')[0] === lang);
    if (same) return same.code;
  }
  return DEFAULT_LOCALE;
}

/** Replaces {name} placeholders. Unknown placeholders stay visible so a missing value is easy to spot. */
export function fill(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export type Dict = Record<string, unknown>;

/** Looks a key up in the chosen language, then English, then returns the key itself. */
export function lookup(dicts: Record<string, Dict>, locale: string, key: string): unknown {
  const own = dicts[locale];
  if (own && own[key] !== undefined && own[key] !== '') return own[key];
  const en = dicts[DEFAULT_LOCALE];
  if (en && en[key] !== undefined) return en[key];
  return key;
}
