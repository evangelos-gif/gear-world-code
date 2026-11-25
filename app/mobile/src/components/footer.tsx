import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { LEGAL } from '@/lib/api';
import { MEGA_STORES_URL } from '@/lib/client';
import { openInBrowser, openSheet } from '@/lib/open';
import { useI18n } from '@/i18n';
import { S, themed } from '@/theme';
import { Txt } from './ui';

export function LegalLinks() {
  const s = useS();
  const { t } = useI18n();
  const links = [
    { label: t('privacy'), url: LEGAL.privacy },
    { label: t('terms'), url: LEGAL.terms },
    { label: t('affiliate'), url: LEGAL.affiliate },
    { label: t('contact'), url: LEGAL.contact }
  ];
  return (
    <View style={s.links}>
      {links.map(l => (
        <Pressable key={l.url} accessibilityRole="link" onPress={() => openSheet(l.url)} style={s.link}>
          <Txt v="small" style={s.linkText}>{l.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

export function Footer() {
  const s = useS();
  const { t } = useI18n();
  return (
    <View style={s.footer}>
      <LegalLinks />
      {/* Mega Stores opens in the phone's browser, never inside the app (owner's decision «Α», 25/11/2026). */}
      <Pressable accessibilityRole="link" accessibilityHint={t('opensBrowser')} onPress={() => openInBrowser(MEGA_STORES_URL)} style={s.link}>
        <Txt v="small" style={s.linkText}>Mega Stores · megastoresgearworld.com</Txt>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => router.navigate('/settings')} style={s.link}>
        <Txt v="small" style={s.linkText}>{`${t('settings')} · ${t('about')}`}</Txt>
      </Pressable>
      <Txt v="small">© {new Date().getFullYear()} {t('footerRights')}</Txt>
    </View>
  );
}

const useS = themed(C => StyleSheet.create({
  footer: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: S.lg, gap: S.sm },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: S.lg },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { color: C.gold, textDecorationLine: 'underline' }
}));
