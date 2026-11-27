import { createContext, useContext } from 'react';

// Gear World colours (same family as gearworldhub.com). Version 1.0.3 adds a light theme (Idea 17 Γ, owner
// 25/11/2026): the app starts light, and the person can choose Dark or "Same as the phone" in Settings. The brand
// bars (the top bar with the logo and the tab bar) stay dark navy in both themes, so the logo and the phone's status
// bar always read well.
// Meaning is never carried by colour alone (owner is colour-blind, lessons L35), and every text colour reads at
// least 4.5:1 on the backgrounds it sits on, in both themes (checked by the tests).
export type Mode = 'dark' | 'light';

export type Palette = {
  mode: Mode;
  /** Screen background. */
  bg: string;
  /** Bars and the deepest panels. */
  bgDeep: string;
  card: string;
  cardHigh: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  /** Gold for words, icons and outlines (a darker amber in the light theme, so it can be read on white). */
  gold: string;
  goldDark: string;
  /** Gold as the fill of the main buttons; their words use onGold. The same in both themes. */
  goldFill: string;
  onGold: string;
  /** Blue for information. */
  blue: string;
};

export const DARK: Palette = {
  mode: 'dark',
  bg: '#08111F',
  bgDeep: '#030A1F',
  card: '#132238',
  cardHigh: '#1B2E4A',
  border: 'rgba(255,255,255,0.12)',
  text: '#F5F7FB',
  muted: '#C9D4E3',
  faint: '#93A4BC',
  gold: '#FFC23D',
  goldDark: '#E5A400',
  goldFill: '#FFC23D',
  onGold: '#08111F',
  blue: '#7CC4FF'
};

/** The light theme is cream, not pure white (owner, 27/11/2026); it is the theme the app starts in. */
export const LIGHT: Palette = {
  mode: 'light',
  bg: '#F3EAD6',
  bgDeep: '#E9DEC6',
  card: '#FBF6EA',
  cardHigh: '#E9DEC6',
  border: 'rgba(70,50,20,0.18)',
  text: '#0B1626',
  muted: '#33435A',
  faint: '#4A586D',
  gold: '#7E5000',
  goldDark: '#643F00',
  goldFill: '#FFC23D',
  onGold: '#08111F',
  blue: '#0A539B'
};

export const PALETTES: Record<Mode, Palette> = { dark: DARK, light: LIGHT };

/** The person's choice in Settings. "system" follows the phone's own light or dark setting. */
export type ThemeChoice = 'dark' | 'light' | 'system';
export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];
/** The app starts light; the person can choose dark in Settings (owner's decision, 25/11/2026). */
export const DEFAULT_THEME: ThemeChoice = 'light';

export function isThemeChoice(v: unknown): v is ThemeChoice {
  return typeof v === 'string' && (THEME_CHOICES as readonly string[]).includes(v);
}

/** The theme to show: the choice, or for "system" the phone's setting (light when the phone does not say). */
export function resolveMode(choice: ThemeChoice, phone: string | null | undefined): Mode {
  if (choice === 'system') return phone === 'dark' ? 'dark' : 'light';
  return choice;
}

/** The colours of the theme in use. The brand bars give their contents the dark colours (DarkScope). */
export const ThemeContext = createContext<Palette>(DARK);

export function useColors(): Palette {
  return useContext(ThemeContext);
}

/** Styles made once per theme: `const useS = themed(C => StyleSheet.create({...}))`, then `const s = useS()`. */
export function themed<T>(make: (C: Palette) => T): () => T {
  const made = new Map<Palette, T>();
  return function useThemed(): T {
    const C = useContext(ThemeContext);
    let v = made.get(C);
    if (v === undefined) {
      v = make(C);
      made.set(C, v);
    }
    return v;
  };
}

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const MAX_WIDTH = 760;
