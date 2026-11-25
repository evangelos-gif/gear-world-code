import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useI18n } from '@/i18n';
import { useSaved } from '@/lib/saved-context';
import { DARK, useColors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

// The app's own tab bar (version 1.0.1): Home, saved products and settings (no barcode scanner: owner, 10/11/2026). Each tab has its icon
// AND its name, never colour alone (owner is colour-blind, lessons L35). The bar sits above the phone's own buttons.
// Since 1.0.3 the bar keeps the dark brand colours in both themes; the screens above it follow the chosen theme.
export default function TabsLayout() {
  const C = DARK;
  const screen = useColors();
  const { t } = useI18n();
  const { items } = useSaved();
  const icon = (name: IconName, active: IconName) =>
    ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) =>
      <Ionicons name={focused ? active : name} size={size} color={typeof color === 'string' ? color : C.muted} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.gold,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: { backgroundColor: C.bgDeep, borderTopColor: C.border },
        tabBarLabelStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: screen.bg }
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabHome'), tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="saved" options={{
        title: t('tabSaved'), tabBarIcon: icon('bookmark-outline', 'bookmark'),
        tabBarBadge: items.length ? items.length : undefined,
        tabBarBadgeStyle: { backgroundColor: C.goldFill, color: C.onGold, fontWeight: '800' }
      }} />
      <Tabs.Screen name="settings" options={{ title: t('settings'), tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}
