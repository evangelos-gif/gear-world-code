import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { I18nProvider, useI18n } from '@/i18n';
import { WorldsProvider } from '@/lib/worlds-context';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function HideSplashWhenReady({ children }: { children: ReactNode }) {
  const { ready } = useI18n();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <WorldsProvider>
          <HideSplashWhenReady>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }} />
          </HideSplashWhenReady>
        </WorldsProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
