import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { DARK, DEFAULT_THEME, isThemeChoice, PALETTES, resolveMode, ThemeContext, type Mode, type ThemeChoice } from '@/theme';

// Version 1.0.3 (Idea 17 Γ): the theme the person chose in Settings, kept on the phone.
export const THEME_KEY = 'gw-theme';

type ThemeState = { ready: boolean; choice: ThemeChoice; mode: Mode; setChoice: (c: ThemeChoice) => void };

const ChoiceContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The phone's own light or dark setting (app.json userInterfaceStyle "automatic" since 1.0.3).
  const phone = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(THEME_KEY)
      .then(v => { if (alive && isThemeChoice(v)) setChoiceState(v); })
      .catch(() => undefined)
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    AsyncStorage.setItem(THEME_KEY, c).catch(() => undefined);
  }, []);

  const mode = resolveMode(choice, phone);
  const colors = PALETTES[mode];

  // The colour behind the screens while they slide in, so no other colour flashes between them.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => undefined);
  }, [colors]);

  const state = useMemo<ThemeState>(() => ({ ready, choice, mode, setChoice }), [ready, choice, mode, setChoice]);
  return (
    <ChoiceContext.Provider value={state}>
      <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>
    </ChoiceContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const v = useContext(ChoiceContext);
  if (!v) throw new Error('useTheme outside ThemeProvider');
  return v;
}

/** The brand bars (top bar with the logo, photo cards, season banners) keep the dark colours in both themes. */
export function DarkScope({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={DARK}>{children}</ThemeContext.Provider>;
}
