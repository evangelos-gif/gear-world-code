import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider, useI18n } from '@/i18n';
// The background price check must be defined when the app's code loads (version 1.0.2).
import '@/lib/price-task';
import { SavedProvider } from '@/lib/saved-context';
import { SettingsProvider } from '@/lib/settings-context';
import { ThemeProvider, useTheme } from '@/lib/theme-context';
import { WorldsProvider } from '@/lib/worlds-context';
import { useColors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function HideSplashWhenReady({ children }: { children: ReactNode }) {
  const { ready } = useI18n();
  // The chosen theme is read first, so a light-theme phone never sees the dark screens flash (1.0.3).
  const theme = useTheme();
  useEffect(() => {
    if (ready && theme.ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, theme.ready]);
  return <>{children}</>;
}

/** The screens, on the chosen theme's background. The status bar sits on the dark strip in both themes. */
function Screens() {
  const C = useColors();
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
    </>
  );
}

/** A tapped price alert opens its saved product (also when the tap started the app). */
function OpenFromNotification() {
  useEffect(() => {
    const open = (n: Notifications.Notification) => {
      const key = n.request.content.data?.key;
      if (typeof key === 'string' && /^[A-Z]{3}:[0-9A-Za-z_-]{1,40}$/.test(key)) router.push({ pathname: '/product', params: { key } });
    };
    // Never stops the app: where notifications are not available (the web preview), nothing opens from one.
    try {
      const last = Notifications.getLastNotificationResponse();
      if (last?.notification) open(last.notification);
    } catch { /* no notifications here */ }
    let sub: { remove: () => void } | null = null;
    try { sub = Notifications.addNotificationResponseReceivedListener(r => open(r.notification)); } catch { /* none */ }
    return () => sub?.remove();
  }, []);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <SettingsProvider>
            <WorldsProvider>
              <SavedProvider>
                <HideSplashWhenReady>
                  <Screens />
                  <OpenFromNotification />
                </HideSplashWhenReady>
              </SavedProvider>
            </WorldsProvider>
          </SettingsProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
