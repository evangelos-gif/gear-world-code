import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { LOCALES } from '@/i18n/core';
import { HUB_URL, LEGAL } from '@/lib/api';
import { COUNTRY_NAMES, DELIVERY_COUNTRIES, megaStoresUrl } from '@/lib/client';
import { openEmail, openInBrowser, openSheet } from '@/lib/open';
import { phoneRegion, useSettings } from '@/lib/settings-context';
import { useTheme } from '@/lib/theme-context';
import { MAX_WIDTH, R, S, themed, THEME_CHOICES, useColors, type ThemeChoice } from '@/theme';

const THEME_LABEL: Record<ThemeChoice, 'themeDark' | 'themeLight' | 'themeSystem'> = { dark: 'themeDark', light: 'themeLight', system: 'themeSystem' };

function Row({ label, icon, onPress, selected }: { label: string; icon?: 'chevron-forward' | 'open-outline' | 'mail-outline'; onPress: () => void; selected?: boolean }) {
  const s = useS();
  const C = useColors();
  return (
    <Pressable accessibilityRole={selected === undefined ? 'link' : 'radio'} accessibilityState={selected === undefined ? undefined : { checked: selected }}
      onPress={onPress} style={({ pressed }) => [s.row, pressed && s.pressed]}>
      {selected !== undefined ? (
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? C.gold : C.muted} />
      ) : null}
      <Txt style={[s.rowText, selected ? s.bold : null]}>{label}</Txt>
      {icon ? <Ionicons name={icon} size={20} color={C.muted} /> : null}
    </Pressable>
  );
}

export default function Settings() {
  const s = useS();
  const { t, locale, setLocale } = useI18n();
  const { country, setCountry } = useSettings();
  const theme = useTheme();
  // A tab: the tab bar sits above the phone's own buttons, so the list needs no extra space at the bottom.
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.inner}>
          <Txt v="title">{t('settings')}</Txt>
          <Txt v="h2">{t('languageLabel')}</Txt>
          <View style={s.card} accessibilityRole="radiogroup">
            {LOCALES.map(l => <Row key={l.code} label={l.name} selected={locale === l.code} onPress={() => setLocale(l.code)} />)}
          </View>

          {/* Version 1.0.3 (Idea 17 Γ): the light theme. The bars with the logo stay dark navy in both. */}
          <Txt v="h2">{t('appearanceTitle')}</Txt>
          <View style={s.card} accessibilityRole="radiogroup">
            {THEME_CHOICES.map(c => <Row key={c} label={t(THEME_LABEL[c])} selected={theme.choice === c} onPress={() => theme.setChoice(c)} />)}
          </View>

          <Txt v="h2">{t('deliverTitle')}</Txt>
          <Txt v="small">{t('deliverHint')}</Txt>
          <View style={s.card} accessibilityRole="radiogroup">
            <Row label={t('deliverAuto')} selected={country === ''} onPress={() => setCountry('')} />
            {DELIVERY_COUNTRIES.map(c => <Row key={c} label={COUNTRY_NAMES[c]} selected={country === c} onPress={() => setCountry(c)} />)}
          </View>

          <Txt v="h2">{t('legal')}</Txt>
          <View style={s.card}>
            <Row label={t('privacy')} icon="chevron-forward" onPress={() => openSheet(LEGAL.privacy)} />
            <Row label={t('terms')} icon="chevron-forward" onPress={() => openSheet(LEGAL.terms)} />
            <Row label={t('affiliate')} icon="chevron-forward" onPress={() => openSheet(LEGAL.affiliate)} />
            <Row label={t('contact')} icon="chevron-forward" onPress={() => openSheet(LEGAL.contact)} />
            <Row label={LEGAL.email} icon="mail-outline" onPress={() => openEmail(LEGAL.email)} />
          </View>

          <Txt v="h2">{t('about')}</Txt>
          <View style={[s.card, s.about]}>
            <Txt v="muted">{t('aboutText', { url: 'gearworldhub.com' })}</Txt>
            <Txt v="small">{t('runBy', { name: LEGAL.operator })}</Txt>
            <Row label="gearworldhub.com" icon="open-outline" onPress={() => openInBrowser(`${HUB_URL}/`)} />
            {/* Mega Stores opens in the phone's browser, never inside the app (owner's decision «Α», 25/11/2026). */}
            <Row label="Mega Stores · megastoresgearworld.com" icon="open-outline" onPress={() => openInBrowser(megaStoresUrl(country, phoneRegion()))} />
            <Txt v="small">{t('version', { version })}</Txt>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const useS = themed(C => StyleSheet.create({
  scroll: { paddingBottom: S.xxl },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: S.lg, gap: S.md },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  about: { padding: S.lg, gap: S.sm },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  pressed: { backgroundColor: C.cardHigh },
  rowText: { flex: 1 },
  bold: { fontWeight: '800' }
}));
