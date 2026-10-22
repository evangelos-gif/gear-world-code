import { Pressable, StyleSheet, View } from 'react-native';

import { LEGAL } from '@/lib/api';
import { openSheet } from '@/lib/open';
import { useI18n } from '@/i18n';
import { C, S } from '@/theme';
import { Txt } from './ui';

export function LegalLinks() {
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
  const { t } = useI18n();
  return (
    <View style={s.footer}>
      <LegalLinks />
      <Txt v="small">© {new Date().getFullYear()} {t('footerRights')}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  footer: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: S.lg, gap: S.sm },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: S.lg },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { color: C.gold, textDecorationLine: 'underline' }
});
