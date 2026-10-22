import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TopBar, Txt } from '@/components/ui';
import { useI18n } from '@/i18n';
import { LOCALES } from '@/i18n/core';
import { HUB_URL, LEGAL } from '@/lib/api';
import { openEmail, openInBrowser, openSheet } from '@/lib/open';
import { C, MAX_WIDTH, R, S } from '@/theme';

function Row({ label, icon, onPress, selected }: { label: string; icon?: 'chevron-forward' | 'open-outline' | 'mail-outline'; onPress: () => void; selected?: boolean }) {
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
  const { t, locale, setLocale } = useI18n();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <TopBar title={t('settings')} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.inner}>
          <Txt v="h2">{t('languageLabel')}</Txt>
          <View style={s.card} accessibilityRole="radiogroup">
            {LOCALES.map(l => <Row key={l.code} label={l.name} selected={locale === l.code} onPress={() => setLocale(l.code)} />)}
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
            <Row label="gearworldhub.com" icon="open-outline" onPress={() => openInBrowser(`${HUB_URL}/`)} />
            <Txt v="small">{t('version', { version })}</Txt>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: S.xxl },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: S.lg, gap: S.md },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  about: { padding: S.lg, gap: S.sm },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: S.md, paddingHorizontal: S.lg, borderBottomWidth: 1, borderBottomColor: C.border },
  pressed: { backgroundColor: C.cardHigh },
  rowText: { flex: 1 },
  bold: { fontWeight: '800' }
});
