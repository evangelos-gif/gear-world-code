import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { hasMegaStoresPage, megaStoresUrl } from '@/lib/client';
import { openInBrowser } from '@/lib/open';
import { phoneRegion, useSettings } from '@/lib/settings-context';
import { DarkScope } from '@/lib/theme-context';
import { DARK, R, S } from '@/theme';
import { Txt } from './ui';

// A dark navy panel in both themes, so it stands out on the cream Home like the season banner.
const C = DARK;

/**
 * Mega Stores on Home (owner 27/11/2026: "στην αρχική… με κουμπί Enter Mega Stores"). The button opens
 * megastoresgearworld.com in the phone's browser, at the page of the person's country, never inside the app (decision
 * «Α», 25/11/2026: no Amazon link inside the app). Shown only where Mega Stores has a page for that country.
 */
export function MegaStoresCard() {
  const { t } = useI18n();
  const { country } = useSettings();
  const region = phoneRegion();
  if (!hasMegaStoresPage(country, region)) return null;
  const open = () => openInBrowser(megaStoresUrl(country, region));
  return (
    <DarkScope>
      <View style={s.card}>
        <View style={s.head}>
          <Ionicons name="storefront-outline" size={26} color={C.gold} accessible={false} />
          <Txt style={s.title}>Mega Stores</Txt>
        </View>
        <Txt style={s.text}>{t('megaText')}</Txt>
        <Pressable accessibilityRole="link" accessibilityLabel={t('megaCta')} accessibilityHint={t('opensBrowser')} onPress={open}
          style={({ pressed }) => [s.button, pressed && s.pressed]}>
          <Txt style={s.buttonText}>{t('megaCta')}</Txt>
          <Ionicons name="open-outline" size={18} color={C.onGold} accessible={false} />
        </Pressable>
        <Txt v="small" style={s.hint}>{t('opensBrowser')} · megastoresgearworld.com</Txt>
      </View>
    </DarkScope>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.bgDeep, borderRadius: R.lg, borderWidth: 1, borderColor: C.gold, padding: S.lg, gap: S.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  title: { color: C.text, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  text: { color: C.muted, fontSize: 15, lineHeight: 21 },
  button: {
    marginTop: S.xs, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: S.sm,
    backgroundColor: C.goldFill, borderRadius: R.pill, paddingHorizontal: S.lg, paddingVertical: S.md, minHeight: 48
  },
  pressed: { opacity: 0.85 },
  buttonText: { color: C.onGold, fontSize: 16, fontWeight: '800' },
  hint: { color: C.faint }
});
